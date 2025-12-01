// user info server functions
// provides public user profile data for display purposes

import { createServerFn } from "@tanstack/solid-start";
import { eq, inArray } from "drizzle-orm";
import { getDb, user } from "@/db";

// public user profile info (safe to expose to clients)
export interface PublicUserInfo {
	id: string;
	name: string;
	image: string | null;
}

// get public info for a single user by id
export const getUserInfo = createServerFn({ method: "GET" })
	.inputValidator((data: { userId: string }) => data)
	.handler(async ({ data }): Promise<PublicUserInfo | null> => {
		const db = getDb();
		const result = await db
			.select({
				id: user.id,
				name: user.name,
				image: user.image,
			})
			.from(user)
			.where(eq(user.id, data.userId))
			.limit(1);

		return result[0] ?? null;
	});

// get public info for multiple users by ids (batch fetch)
export const getUserInfoBatch = createServerFn({ method: "GET" })
	.inputValidator((data: { userIds: string[] }) => data)
	.handler(async ({ data }): Promise<Record<string, PublicUserInfo>> => {
		if (data.userIds.length === 0) return {};

		const db = getDb();
		const result = await db
			.select({
				id: user.id,
				name: user.name,
				image: user.image,
			})
			.from(user)
			.where(inArray(user.id, data.userIds));

		// return as a map for easy lookup
		return Object.fromEntries(result.map((u) => [u.id, u]));
	});
