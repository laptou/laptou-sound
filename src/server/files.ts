// file storage operations using cloudflare r2

import { logTrace } from "@/lib/logger";
import { env } from "cloudflare:workers";
import { AwsClient } from "aws4fetch";
import { createServerOnlyFn } from "@tanstack/solid-start";

// r2 key structure:
// tracks/{trackId}/versions/{versionId}/original.{ext}
// tracks/{trackId}/versions/{versionId}/stream.mp3
// tracks/{trackId}/versions/{versionId}/albumart.{ext}

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

		// sign the request
		const signed = await client.sign(
			new Request(url, {
				method,
			}),
			{
				aws: { signQuery: true },
			},
		);

		return signed.url;
	},
);
