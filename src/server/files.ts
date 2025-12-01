// file storage operations using cloudflare r2

import { env } from "cloudflare:workers";

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

export function getAlbumArtKey(trackId: string, versionId: string, ext: string) {
	return `${getTrackVersionPrefix(trackId, versionId)}albumart.${ext}`;
}

// upload file to r2
export async function uploadFile(
	key: string,
	data: ArrayBuffer | ReadableStream,
	contentType: string,
) {
	const bucket = env.laptou_sound_files;
	await bucket.put(key, data, {
		httpMetadata: { contentType },
	});
}

// get file from r2
export async function getFile(key: string) {
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
}

// delete file from r2
export async function deleteFile(key: string) {
	const bucket = env.laptou_sound_files;
	await bucket.delete(key);
}

// delete all files for a track version
export async function deleteTrackVersionFiles(
	trackId: string,
	versionId: string,
) {
	const bucket = env.laptou_sound_files;
	const prefix = getTrackVersionPrefix(trackId, versionId);

	const listed = await bucket.list({ prefix });
	for (const object of listed.objects) {
		await bucket.delete(object.key);
	}
}

// delete all files for a track (all versions)
export async function deleteTrackFiles(trackId: string) {
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
}

// list version files
export async function listTrackVersionFiles(
	trackId: string,
	versionId: string,
) {
	const bucket = env.laptou_sound_files;
	const prefix = getTrackVersionPrefix(trackId, versionId);

	const listed = await bucket.list({ prefix });
	return listed.objects.map((obj) => ({
		key: obj.key,
		size: obj.size,
	}));
}
