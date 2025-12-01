// album art processing job handler - resizes uploaded album art

import { env } from "cloudflare:workers";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { DrizzleLogger } from "@/db/logger";
import * as schema from "@/db/schema";
import { logDebug, logError } from "@/lib/logger";
import { getAlbumArtKey, processImage } from "../files";
import type { ProcessAlbumArtJob } from "./types";

export async function processAlbumArtJob(
	job: ProcessAlbumArtJob,
): Promise<void> {
	logDebug("processing album art job", { job });

	const bucket = env.laptou_sound_files;
	const db = drizzle(env.laptou_sound_db, {
		schema,
		logger: new DrizzleLogger(),
	});

	try {
		// check if temp file exists
		const tempFile = await bucket.get(job.tempKey);
		if (!tempFile) {
			throw new Error(`Temp file not found: ${job.tempKey}`);
		}

		// process and resize image to standard size
		const destKey = getAlbumArtKey(job.trackId, job.versionId, "png");
		await processImage(job.tempKey, destKey, {
			width: 512,
			height: 512,
			fit: "cover",
			format: "png",
		});

		// update version record with new album art key
		await db
			.update(schema.trackVersions)
			.set({ albumArtKey: destKey })
			.where(eq(schema.trackVersions.id, job.versionId));

		// delete temp file
		await bucket.delete(job.tempKey);

		// queue job to regenerate download file with new album art
		const queue = env.laptou_sound_audio_processing_queue;
		await queue.send({
			type: "update_metadata",
			trackId: job.trackId,
			versionId: job.versionId,
		});

		logDebug("album art processing completed", {
			job,
			destKey,
		});
	} catch (error) {
		logError("[queue/process-album-art] failed", { error });
		throw error;
	}
}

