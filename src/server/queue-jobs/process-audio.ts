// audio processing job handler - extracts metadata, creates stream/download files

import { env } from "cloudflare:workers";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import * as mm from "music-metadata";
import NodeID3 from "node-id3";
import { DrizzleLogger } from "@/db/logger";
import * as schema from "@/db/schema";
import { logDebug, logError } from "@/lib/logger";
import {
	getAlbumArtKey,
	getDownloadKey,
	getStreamKey,
} from "../files";
import type { AudioProcessingJob } from "./types";

export async function processAudioJob(job: AudioProcessingJob): Promise<void> {
	logDebug("processing audio job", { job });

	const bucket = env.laptou_sound_files;
	const db = drizzle(env.laptou_sound_db, {
		schema,
		logger: new DrizzleLogger(),
	});

	// update status to processing
	await db
		.update(schema.trackVersions)
		.set({ processingStatus: "processing" })
		.where(eq(schema.trackVersions.id, job.versionId));

	try {
		// get original file
		const original = await bucket.get(job.originalKey);
		if (!original) {
			throw new Error("Original file not found");
		}

		// read into buffer (stream can only be consumed once)
		const originalData = await original.arrayBuffer();

		// extract metadata using music-metadata
		const metadata = await mm.parseBuffer(new Uint8Array(originalData), {
			mimeType: original.httpMetadata?.contentType,
		});

		logDebug("extracted metadata", {
			format: metadata.format,
			common: metadata.common,
			hasPicture: metadata.common.picture?.length ?? 0,
		});

		// store as stream file (in production, transcode to 128kbps mp3)
		const streamKey = getStreamKey(job.trackId, job.versionId);
		const streamObject = await bucket.put(streamKey, originalData, {
			httpMetadata: { contentType: "audio/mpeg" },
		});

		// extract and store album art if present
		let albumArtKey: string | null = null;
		const picture = metadata.common.picture?.[0];
		if (picture) {
			// determine file extension from mime type
			const mimeToExt: Record<string, string> = {
				"image/jpeg": "jpg",
				"image/png": "png",
				"image/gif": "gif",
				"image/webp": "webp",
			};
			const ext = mimeToExt[picture.format] ?? "jpg";
			albumArtKey = getAlbumArtKey(job.trackId, job.versionId, ext);

			await bucket.put(albumArtKey, picture.data, {
				httpMetadata: { contentType: picture.format },
			});

			logDebug("stored album art", {
				albumArtKey,
				format: picture.format,
				size: picture.data.length,
			});
		}

		// generate download file with id3 tags embedded
		const downloadKey = getDownloadKey(job.trackId, job.versionId);
		const id3Tags: NodeID3.Tags = {
			title: metadata.common.title ?? undefined,
			artist: metadata.common.artist ?? undefined,
			album: metadata.common.album ?? undefined,
			genre: metadata.common.genre?.[0] ?? undefined,
			year: metadata.common.year?.toString() ?? undefined,
		};

		// embed album art if present
		if (picture) {
			id3Tags.image = {
				mime: picture.format,
				type: { id: 3, name: "front cover" },
				description: "Album Art",
				imageBuffer: Buffer.from(picture.data),
			};
		}

		// write id3 tags to create download file
		const downloadBuffer = NodeID3.write(id3Tags, Buffer.from(originalData));
		await bucket.put(downloadKey, downloadBuffer, {
			httpMetadata: { contentType: "audio/mpeg" },
		});

		logDebug("stored download file with metadata", {
			downloadKey,
			tags: id3Tags,
		});

		// update status to complete with metadata
		await db
			.update(schema.trackVersions)
			.set({
				processingStatus: "complete",
				streamKey: streamObject.key,
				downloadKey,
				albumArtKey,
				// audio format metadata
				duration: metadata.format.duration
					? Math.round(metadata.format.duration)
					: null,
				bitrate: metadata.format.bitrate
					? Math.round(metadata.format.bitrate)
					: null,
				sampleRate: metadata.format.sampleRate ?? null,
				channels: metadata.format.numberOfChannels ?? null,
				codec: metadata.format.codec ?? null,
				// common tags
				artist: metadata.common.artist ?? null,
				album: metadata.common.album ?? null,
				genre: metadata.common.genre?.[0] ?? null,
				year: metadata.common.year ?? null,
			})
			.where(eq(schema.trackVersions.id, job.versionId));

		// update track's active version to point to this processed version
		await db
			.update(schema.tracks)
			.set({ activeVersion: job.versionId })
			.where(eq(schema.tracks.id, job.trackId));

		logDebug("audio processing completed", {
			job,
			streamKey: streamObject.key,
			downloadKey,
			duration: metadata.format.duration,
			bitrate: metadata.format.bitrate,
			artist: metadata.common.artist,
		});
	} catch (error) {
		logError("[queue/audio-processing] failed", { error });

		// update status to failed
		await db
			.update(schema.trackVersions)
			.set({ processingStatus: "failed" })
			.where(eq(schema.trackVersions.id, job.versionId));

		throw error;
	}
}

