// metadata update job handler - regenerates download file with updated metadata

import { env } from "cloudflare:workers";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import NodeID3 from "node-id3";
import { DrizzleLogger } from "@/db/logger";
import * as schema from "@/db/schema";
import { logDebug, logError } from "@/lib/logger";
import { getDownloadKey } from "../files";
import type { UpdateMetadataJob } from "./types";

export async function updateMetadataJob(
	job: UpdateMetadataJob,
): Promise<void> {
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

