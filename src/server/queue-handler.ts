// cloudflare queue consumer - routes messages to appropriate job handlers

import { logDebug } from "@/lib/logger";
import { processAudioJob } from "./queue-jobs/process-audio";
import { updateMetadataJob } from "./queue-jobs/update-metadata";
import { processProfilePhotoJob } from "./queue-jobs/process-profile-photo";
import { processAlbumArtJob } from "./queue-jobs/process-album-art";
import type {
	QueueMessage,
	AudioProcessingJob,
	DeleteTrackJob,
	UpdateMetadataJob,
	ProcessProfilePhotoJob,
	ProcessAlbumArtJob,
} from "./queue-jobs/types";

// re-export types for backward compatibility
export type {
	AudioProcessingJob,
	DeleteTrackJob,
	UpdateMetadataJob,
	ProcessProfilePhotoJob,
	ProcessAlbumArtJob,
	QueueMessage,
};

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
			} else if (message.body.type === "process_profile_photo") {
				await processProfilePhotoJob(message.body);
			} else if (message.body.type === "process_album_art") {
				await processAlbumArtJob(message.body);
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

