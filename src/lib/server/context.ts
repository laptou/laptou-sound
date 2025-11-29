// cloudflare context helpers for server functions

import type { D1Database, Queue, R2Bucket } from "@cloudflare/workers-types";
import { drizzle } from "drizzle-orm/d1";
import { getRequestEvent } from "solid-js/web";
import * as schema from "../db/schema";

// cloudflare env bindings type
export interface CloudflareEnv {
	DB: D1Database;
	R2: R2Bucket;
	AUDIO_QUEUE: Queue;
}

// get cloudflare env from request context
export function getCloudflareEnv(): CloudflareEnv {
	const event = getRequestEvent();
	if (!event) {
		throw new Error("No request event found - are you in a server context?");
	}

	// access cloudflare bindings from the event
	const env = (event as any).nativeEvent?.context?.cloudflare?.env as
		| CloudflareEnv
		| undefined;

	if (!env) {
		throw new Error(
			"Cloudflare env not found - are you running on Cloudflare?",
		);
	}

	return env;
}

// get d1 database (raw d1 - only for better auth)
export function getDB(): D1Database {
	return getCloudflareEnv().DB;
}

// get drizzle database instance (for all non-auth db access)
export function getDrizzleDB() {
	return drizzle(getDB(), { schema });
}

// get r2 bucket
export function getR2(): R2Bucket {
	return getCloudflareEnv().R2;
}

// get audio processing queue
export function getAudioQueue(): Queue {
	return getCloudflareEnv().AUDIO_QUEUE;
}
