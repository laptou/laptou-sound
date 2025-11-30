// src/server.ts
import handler from "@tanstack/solid-start/server-entry";

import { handleQueueBatch, type QueueMessage } from "./server/queue-handler";
export default {
	async fetch(request: Request) {
		return await handler.fetch(request);
	},
	async queue(batch: MessageBatch<QueueMessage>) {
		return await handleQueueBatch(batch);
	},
};
