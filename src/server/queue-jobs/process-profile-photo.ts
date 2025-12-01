// profile photo processing job handler - resizes uploaded profile photo

import { env } from "cloudflare:workers";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { DrizzleLogger } from "@/db/logger";
import * as schema from "@/db/schema";
import { logDebug, logError } from "@/lib/logger";
import { getProfilePhotoKey, processImage } from "../files";
import type { ProcessProfilePhotoJob } from "./types";

export async function processProfilePhotoJob(
	job: ProcessProfilePhotoJob,
): Promise<void> {
	logDebug("processing profile photo job", { job });

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
		const destKey = getProfilePhotoKey(job.userId);
		await processImage(job.tempKey, destKey, {
			width: 256,
			height: 256,
			fit: "cover",
			format: "png",
		});

		// update user record with new profile photo key
		// store as /files/ path so it can be served
		await db
			.update(schema.user)
			.set({ image: `/files/${destKey}` })
			.where(eq(schema.user.id, job.userId));

		// delete temp file
		await bucket.delete(job.tempKey);

		logDebug("profile photo processing completed", {
			job,
			destKey,
		});
	} catch (error) {
		logError("[queue/process-profile-photo] failed", { error });
		throw error;
	}
}
