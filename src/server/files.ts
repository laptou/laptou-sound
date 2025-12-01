// file storage operations using cloudflare r2

import { env } from "cloudflare:workers";
import { createServerOnlyFn } from "@tanstack/solid-start";
import { AwsClient } from "aws4fetch";
import { logTrace, logWarn } from "@/lib/logger";

// r2 key structure:
// tracks/{trackId}/versions/{versionId}/original.{ext}
// tracks/{trackId}/versions/{versionId}/stream.mp3
// tracks/{trackId}/versions/{versionId}/albumart.{ext}
// users/{userId}/avatar.png (processed profile photo)
// tmp/uploads/{uploadId}.{ext} (temporary upload location for presigned urls)

// check if we should use indirect (worker-proxied) uploads instead of presigned urls
export const useIndirectAccess = createServerOnlyFn(
	function useIndirectAccess(): boolean {
		const indirect = env.R2_INDIRECT_ACCESS;
		return indirect === "1" || indirect === "true";
	},
);

export function getTrackVersionPrefix(trackId: string, versionId: string) {
	return `tracks/${trackId}/versions/${versionId}/`;
}

export function getOriginalKey(
	trackId: string,
	versionId: string,
	ext: string,
) {
	return `${getTrackVersionPrefix(trackId, versionId)}original.${ext}`;
}

export function getStreamKey(trackId: string, versionId: string) {
	return `${getTrackVersionPrefix(trackId, versionId)}stream.mp3`;
}

export function getAlbumArtKey(
	trackId: string,
	versionId: string,
	ext: string,
) {
	return `${getTrackVersionPrefix(trackId, versionId)}albumart.${ext}`;
}

export function getDownloadKey(trackId: string, versionId: string) {
	return `${getTrackVersionPrefix(trackId, versionId)}download.mp3`;
}

// profile photo keys - stored as processed png
export function getProfilePhotoKey(userId: string) {
	return `users/${userId}/avatar.png`;
}

// temporary upload location for presigned url uploads
// these get moved/processed to their final location by the queue handler
export function getTempUploadKey(uploadId: string, ext: string) {
	return `tmp/uploads/${uploadId}.${ext}`;
}

// upload file to r2
export const uploadFile = createServerOnlyFn(async function uploadFile(
	key: string,
	data: ArrayBuffer | ReadableStream,
	contentType: string,
) {
	const bucket = env.laptou_sound_files;
	logTrace("[r2] uploading file", { key, contentType });
	await bucket.put(key, data, {
		httpMetadata: { contentType },
	});
});

// get file from r2
export const getFile = createServerOnlyFn(async function getFile(key: string) {
	const bucket = env.laptou_sound_files;
	const object = await bucket.get(key);

	if (!object) {
		return null;
	}

	return {
		body: object.body,
		contentType: object.httpMetadata?.contentType,
		size: object.size,
	};
});

// delete file from r2
export const deleteFile = createServerOnlyFn(async function deleteFile(
	key: string,
) {
	const bucket = env.laptou_sound_files;
	await bucket.delete(key);
});

// delete all files for a track version
export const deleteTrackVersionFiles = createServerOnlyFn(
	async function deleteTrackVersionFiles(trackId: string, versionId: string) {
		const bucket = env.laptou_sound_files;
		const prefix = getTrackVersionPrefix(trackId, versionId);

		const listed = await bucket.list({ prefix });
		for (const object of listed.objects) {
			await bucket.delete(object.key);
		}
	},
);

// delete all files for a track (all versions)
export const deleteTrackFiles = createServerOnlyFn(
	async function deleteTrackFiles(trackId: string) {
		const bucket = env.laptou_sound_files;
		const prefix = `tracks/${trackId}/`;

		let cursor: string | undefined;
		do {
			const listed = await bucket.list({ prefix, cursor });
			for (const object of listed.objects) {
				await bucket.delete(object.key);
			}
			cursor = listed.truncated ? listed.cursor : undefined;
		} while (cursor);
	},
);

// list version files
export const listTrackVersionFiles = createServerOnlyFn(
	async function listTrackVersionFiles(trackId: string, versionId: string) {
		const bucket = env.laptou_sound_files;
		const prefix = getTrackVersionPrefix(trackId, versionId);

		const listed = await bucket.list({ prefix });
		return listed.objects.map((obj) => ({
			key: obj.key,
			size: obj.size,
		}));
	},
);

// generate presigned url for r2 object
// requires r2 credentials in environment variables:
// - R2_ACCESS_KEY_ID
// - R2_SECRET_ACCESS_KEY
// - CLOUDFLARE_ACCOUNT_ID
export const generatePresignedUrl = createServerOnlyFn(
	async function generatePresignedUrl(
		key: string,
		method: "GET" | "PUT" = "GET",
		expiresIn: number = 3600, // default 1 hour
		contentType?: string, // required for PUT operations
	): Promise<string> {
		const accessKeyId = env.R2_ACCESS_KEY_ID;
		const secretAccessKey = env.R2_SECRET_ACCESS_KEY;
		const accountId = env.CLOUDFLARE_ACCOUNT_ID;
		const bucketName = "laptou-sound-files";

		if (!accessKeyId || !secretAccessKey || !accountId) {
			throw new Error(
				"R2 credentials not configured. Set R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, and CLOUDFLARE_ACCOUNT_ID environment variables.",
			);
		}

		const client = new AwsClient({
			accessKeyId,
			secretAccessKey,
		});

		// construct r2 s3-compatible endpoint url
		const url = new URL(
			`https://${bucketName}.${accountId}.r2.cloudflarestorage.com/${key}`,
		);

		// set expiry in seconds
		url.searchParams.set("X-Amz-Expires", expiresIn.toString());

		// build headers for signing
		const headers: Record<string, string> = {};
		if (method === "PUT" && contentType) {
			headers["Content-Type"] = contentType;
		}

		// sign the request
		const signed = await client.sign(
			new Request(url, {
				method,
				headers,
			}),
			{
				aws: { signQuery: true },
			},
		);

		return signed.url;
	},
);

// move a file from one key to another (copy + delete)
export const moveFile = createServerOnlyFn(async function moveFile(
	sourceKey: string,
	destKey: string,
) {
	const bucket = env.laptou_sound_files;
	const source = await bucket.get(sourceKey);

	if (!source) {
		throw new Error(`Source file not found: ${sourceKey}`);
	}

	// copy to destination
	await bucket.put(destKey, source.body, {
		httpMetadata: source.httpMetadata,
	});

	// delete source
	await bucket.delete(sourceKey);

	logTrace("[r2] moved file", { sourceKey, destKey });
});

// copy a file to a new key
export const copyFile = createServerOnlyFn(async function copyFile(
	sourceKey: string,
	destKey: string,
) {
	const bucket = env.laptou_sound_files;
	const source = await bucket.get(sourceKey);

	if (!source) {
		throw new Error(`Source file not found: ${sourceKey}`);
	}

	await bucket.put(destKey, source.body, {
		httpMetadata: source.httpMetadata,
	});

	logTrace("[r2] copied file", { sourceKey, destKey });
});

// process and resize an image using cloudflare images
// fetches the image, transforms it, and stores the result
export async function processImage(
	sourceKey: string,
	destKey: string,
	options: {
		width?: number;
		height?: number;
		fit?: "scale-down" | "contain" | "cover" | "crop" | "pad";
		format?: "png" | "jpeg" | "webp" | "avif";
	},
): Promise<void> {
	const bucket = env.laptou_sound_files;
	const accountId = env.CLOUDFLARE_ACCOUNT_ID;

	// get source image
	const source = await bucket.get(sourceKey);
	if (!source) {
		throw new Error(`Source image not found: ${sourceKey}`);
	}

	const sourceData = await source.arrayBuffer();

	// use cloudflare images transform api via fetch
	// we'll construct a data url and use the images api
	const transformUrl = new URL(
		`https://api.cloudflare.com/client/v4/accounts/${accountId}/images/v1/transform`,
	);

	// build transform options
	const transformOptions: string[] = [];
	if (options.width) transformOptions.push(`width=${options.width}`);
	if (options.height) transformOptions.push(`height=${options.height}`);
	if (options.fit) transformOptions.push(`fit=${options.fit}`);
	if (options.format) transformOptions.push(`format=${options.format}`);

	// if no api token, fall back to storing without transformation
	const apiToken = env.CLOUDFLARE_IMAGES_API_TOKEN;
	if (!apiToken) {
		logWarn("[images] no api token, storing without transformation", {
			sourceKey,
			destKey,
		});
		// just copy the file as-is
		await bucket.put(destKey, sourceData, {
			httpMetadata: {
				contentType: options.format
					? `image/${options.format}`
					: (source.httpMetadata?.contentType ?? "image/png"),
			},
		});
		return;
	}

	// call cloudflare images transform api
	const formData = new FormData();
	formData.append(
		"file",
		new Blob([sourceData], {
			type: source.httpMetadata?.contentType ?? "image/png",
		}),
	);

	const response = await fetch(transformUrl, {
		method: "POST",
		headers: {
			Authorization: `Bearer ${apiToken}`,
			"CF-Image-Options": transformOptions.join(","),
		},
		body: formData,
	});

	if (!response.ok) {
		const errorText = await response.text();
		logTrace("[images] transform failed, using original", {
			status: response.status,
			error: errorText,
		});
		// fall back to storing original
		await bucket.put(destKey, sourceData, {
			httpMetadata: {
				contentType: options.format
					? `image/${options.format}`
					: (source.httpMetadata?.contentType ?? "image/png"),
			},
		});
		return;
	}

	// store transformed image
	const transformedData = await response.arrayBuffer();
	await bucket.put(destKey, transformedData, {
		httpMetadata: {
			contentType: options.format ? `image/${options.format}` : "image/png",
		},
	});

	logTrace("[images] processed image", {
		sourceKey,
		destKey,
		options,
		originalSize: sourceData.byteLength,
		transformedSize: transformedData.byteLength,
	});
}
