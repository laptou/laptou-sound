// cloudflare queue consumer for audio processing

import { env } from "cloudflare:workers";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "@/db/schema";
import { logDebug } from "@/lib/logger";
import { getStreamKey, getWaveformKey } from "./files";

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

export type QueueMessage = AudioProcessingJob | DeleteTrackJob;

// queue consumer handler - export this from your worker entry
export async function handleQueueBatch(
	batch: MessageBatch<QueueMessage>,
): Promise<void> {
	logDebug("handling queue batch", { batch });

	for (const message of batch.messages) {
		try {
			if (message.body.type === "process_audio") {
				await processAudioJob(message.body);
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
	const db = drizzle(env.laptou_sound_db, { schema });

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

		const streamKey = getStreamKey(job.trackId, job.versionId);
		const waveformKey = getWaveformKey(job.trackId, job.versionId);

		// note: real audio transcoding requires workers ai or external service
		// for now, we copy the original as the stream file
		// in production, use an audio processing service or workers ai
		const originalData = await original.arrayBuffer();

		// store as stream file (in production, transcode to 128kbps mp3)
		await bucket.put(streamKey, originalData, {
			httpMetadata: { contentType: "audio/mpeg" },
		});

		// generate simplified waveform data
		// in production, use an audio analysis library
		const waveformData = generateSimplifiedWaveform(originalData);
		await bucket.put(waveformKey, JSON.stringify(waveformData), {
			httpMetadata: { contentType: "application/json" },
		});

		// estimate duration (very rough, assumes ~128kbps mp3)
		const estimatedDuration = Math.floor(originalData.byteLength / 16000);

		// update status to complete
		await db
			.update(schema.trackVersions)
			.set({
				processingStatus: "complete",
				streamKey,
				waveformKey,
				duration: estimatedDuration,
			})
			.where(eq(schema.trackVersions.id, job.versionId));

		console.log("audio processing completed", {
			job,
			streamKey,
			waveformKey,
			duration: estimatedDuration,
			waveformDataSamples: waveformData.samples,
		});
	} catch (error) {
		console.error("Audio processing failed:", error);

		// update status to failed
		await db
			.update(schema.trackVersions)
			.set({ processingStatus: "failed" })
			.where(eq(schema.trackVersions.id, job.versionId));

		throw error;
	}
}

// generate simplified waveform data for visualization
// in production, use proper audio analysis
function generateSimplifiedWaveform(audioData: ArrayBuffer): {
	peaks: number[];
	samples: number;
} {
	// generate placeholder waveform with random-ish peaks
	// real implementation would analyze actual audio samples
	const numPeaks = 200;
	const peaks: number[] = [];

	// create a somewhat realistic-looking waveform shape
	const dataView = new Uint8Array(audioData);
	const chunkSize = Math.floor(dataView.length / numPeaks);

	for (let i = 0; i < numPeaks; i++) {
		const start = i * chunkSize;
		const end = Math.min(start + chunkSize, dataView.length);

		// sample some bytes and normalize to 0-1
		let max = 0;
		for (let j = start; j < end; j += 100) {
			max = Math.max(max, dataView[j] ?? 0);
		}

		peaks.push(max / 255);
	}

	return {
		peaks,
		samples: numPeaks,
	};
}
