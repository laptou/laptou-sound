// play tracking server functions

import { createServerFn } from "@tanstack/solid-start";
import { getRequest, getRequestIP } from "@tanstack/solid-start/server";
import { eq, sql } from "drizzle-orm";
import { getDb, plays } from "@/db";
import { createAuth } from "@/lib/auth";

// record a play
export const recordPlay = createServerFn({ method: "POST" })
	.inputValidator((data: { trackId: string; versionId?: string }) => data)
	.handler(async ({ data }) => {
		const request = getRequest();
		const auth = createAuth();
		const session = await auth.api.getSession({ headers: request.headers });

		// get ip hash for anonymous tracking
		const ip = getRequestIP({ xForwardedFor: true }) ?? "unknown";
		const ipHash = await hashString(ip);

		const db = getDb();

		// insert play record
		await db.insert(plays).values({
			id: crypto.randomUUID(),
			trackId: data.trackId,
			versionId: data.versionId ?? null,
			userId: session?.user.id ?? null,
			ipHash,
			playedAt: new Date(),
		});

		return { success: true };
	});

// get play count for a track
export const getPlayCount = createServerFn({ method: "GET" })
	.inputValidator((data: { trackId: string }) => data)
	.handler(async ({ data }) => {
		const db = getDb();

		const result = await db
			.select({ count: sql<number>`count(*)` })
			.from(plays)
			.where(eq(plays.trackId, data.trackId));

		return { count: result[0]?.count ?? 0 };
	});

// hash string for ip anonymization
async function hashString(str: string): Promise<string> {
	const encoder = new TextEncoder();
	const data = encoder.encode(str);
	const hashBuffer = await crypto.subtle.digest("SHA-256", data);
	const hashArray = Array.from(new Uint8Array(hashBuffer));
	return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}
