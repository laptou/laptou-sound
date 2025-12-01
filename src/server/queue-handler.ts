// cloudflare queue consumer for audio processing

import { env } from "cloudflare:workers";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import * as mm from "music-metadata";
import NodeID3 from "node-id3";
import { DrizzleLogger } from "@/db/logger";
import * as schema from "@/db/schema";
import { logDebug, logError } from "@/lib/logger";
import { getAlbumArtKey, getDownloadKey, getStreamKey } from "./files";

export interface AudioProcessingJob {
	type: "process_audio";
	trackId: string;
	versionId: string;
	originalKey: string;
}

export interface DeleteTrackJob {
	type: "delete_track";
	trackId: string;
}

// job to regenerate the download file with updated metadata/album art
export interface UpdateMetadataJob {
	type: "update_metadata";
	trackId: string;
	versionId: string;
}

export type QueueMessage =
	| AudioProcessingJob
	| DeleteTrackJob
	| UpdateMetadataJob;

// queue consumer handler - export this from your worker entry
export async function handleQueueBatch(
	batch: MessageBatch<QueueMessage>,
): Promise<void> {
	logDebug("handling queue batch", { batch });

	for (const message of batch.messages) {
		try {
			if (message.body.type === "process_audio") {
				await processAudioJob(message.body);
			} else if (message.body.type === "update_metadata") {
				await updateMetadataJob(message.body);
			} else if (message.body.type === "delete_track") {
				// handle delete job if needed
			}
			message.ack();
		} catch (error) {
			console.error("Queue job failed:", error);
			message.retry();
		}
	}
}

async function processAudioJob(job: AudioProcessingJob): Promise<void> {
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

// regenerate download file with updated metadata from database
async function updateMetadataJob(job: UpdateMetadataJob): Promise<void> {
	logDebug("updating metadata job", { job });

	const bucket = env.laptou_sound_files;
	const db = drizzle(env.laptou_sound_db, {
		schema,
		logger: new DrizzleLogger(),
	});

	// get version from database
	const version = await db
		.select()
		.from(schema.trackVersions)
		.where(eq(schema.trackVersions.id, job.versionId))
		.limit(1);

	if (!version[0]) {
		throw new Error("Version not found");
	}

	const versionData = version[0];

	// get track title for the id3 tags
	const track = await db
		.select()
		.from(schema.tracks)
		.where(eq(schema.tracks.id, job.trackId))
		.limit(1);

	if (!track[0]) {
		throw new Error("Track not found");
	}

	try {
		// get original file
		const original = await bucket.get(versionData.originalKey);
		if (!original) {
			throw new Error("Original file not found");
		}

		const originalData = await original.arrayBuffer();

		// build id3 tags from database metadata
		const id3Tags: NodeID3.Tags = {
			title: track[0].title,
			artist: versionData.artist ?? undefined,
			album: versionData.album ?? undefined,
			genre: versionData.genre ?? undefined,
			year: versionData.year?.toString() ?? undefined,
		};

		// get album art if it exists
		if (versionData.albumArtKey) {
			const albumArt = await bucket.get(versionData.albumArtKey);
			if (albumArt) {
				const artData = await albumArt.arrayBuffer();
				const mime = albumArt.httpMetadata?.contentType ?? "image/jpeg";
				id3Tags.image = {
					mime,
					type: { id: 3, name: "front cover" },
					description: "Album Art",
					imageBuffer: Buffer.from(artData),
				};
			}
		}

		// write id3 tags to create new download file
		const downloadKey = getDownloadKey(job.trackId, job.versionId);
		const downloadBuffer = NodeID3.write(id3Tags, Buffer.from(originalData));
		await bucket.put(downloadKey, downloadBuffer, {
			httpMetadata: { contentType: "audio/mpeg" },
		});

		// update download key in database
		await db
			.update(schema.trackVersions)
			.set({ downloadKey })
			.where(eq(schema.trackVersions.id, job.versionId));

		logDebug("metadata update completed", {
			job,
			downloadKey,
			tags: { ...id3Tags, image: id3Tags.image ? "[present]" : undefined },
		});
	} catch (error) {
		logError("[queue/update-metadata] failed", { error });
		throw error;
	}
}
