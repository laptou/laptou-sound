// admin server functions for invite code management

import { createServerFn } from "@tanstack/solid-start";
import { getRequest } from "@tanstack/solid-start/server";
import { desc, eq } from "drizzle-orm";
import { getDb, inviteCodes, type NewInviteCode, tracks, users } from "@/db";
import { createAuth } from "@/lib/auth";
import { hasRole } from "./auth";

// generate a random invite code
function generateInviteCode(): string {
	const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
	let code = "";
	for (let i = 0; i < 8; i++) {
		code += chars.charAt(Math.floor(Math.random() * chars.length));
	}
	return code;
}

// create a new invite code (admin only)
export const createInviteCode = createServerFn({ method: "POST" })
	.inputValidator((data: { role: "commenter" | "uploader" | "admin" }) => data)
	.handler(async ({ data }) => {
		const request = getRequest();
		const auth = createAuth();
		const session = await auth.api.getSession({ headers: request.headers });

		if (!session) {
			throw new Error("Unauthorized");
		}

		if (!hasRole(session.user.role as string, "admin")) {
			throw new Error("Admin access required");
		}

		const db = getDb();
		const code = generateInviteCode();

		const newCode: NewInviteCode = {
			id: crypto.randomUUID(),
			code,
			createdBy: session.user.id,
			role: data.role,
			createdAt: new Date(),
		};

		await db.insert(inviteCodes).values(newCode);

		return { code, role: data.role };
	});

// get all invite codes (admin only)
export const getInviteCodes = createServerFn({ method: "GET" }).handler(
	async () => {
		const request = getRequest();
		const auth = createAuth();
		const session = await auth.api.getSession({ headers: request.headers });

		if (!session) {
			throw new Error("Unauthorized");
		}

		if (!hasRole(session.user.role as string, "admin")) {
			throw new Error("Admin access required");
		}

		const db = getDb();
		const codes = await db
			.select()
			.from(inviteCodes)
			.orderBy(desc(inviteCodes.createdAt));

		return codes;
	},
);

// delete an invite code (admin only)
export const deleteInviteCode = createServerFn({ method: "POST" })
	.inputValidator((data: { codeId: string }) => data)
	.handler(async ({ data }) => {
		const request = getRequest();
		const auth = createAuth();
		const session = await auth.api.getSession({ headers: request.headers });

		if (!session) {
			throw new Error("Unauthorized");
		}

		if (!hasRole(session.user.role as string, "admin")) {
			throw new Error("Admin access required");
		}

		const db = getDb();

		// only delete unused codes
		const code = await db
			.select()
			.from(inviteCodes)
			.where(eq(inviteCodes.id, data.codeId))
			.limit(1);

		if (!code[0]) {
			throw new Error("Code not found");
		}

		if (code[0].usedBy) {
			throw new Error("Cannot delete used invite code");
		}

		await db.delete(inviteCodes).where(eq(inviteCodes.id, data.codeId));

		return { success: true };
	});

// get all users (admin only)
export const getUsers = createServerFn({ method: "GET" }).handler(async () => {
	const request = getRequest();
	const auth = createAuth();
	const session = await auth.api.getSession({ headers: request.headers });

	if (!session) {
		throw new Error("Unauthorized");
	}

	if (!hasRole(session.user.role as string, "admin")) {
		throw new Error("Admin access required");
	}

	const db = getDb();
	const allUsers = await db.select().from(users).orderBy(desc(users.createdAt));

	return allUsers;
});

// update user role (admin only)
export const updateUserRole = createServerFn({ method: "POST" })
	.inputValidator(
		(data: { userId: string; role: "commenter" | "uploader" | "admin" }) =>
			data,
	)
	.handler(async ({ data }) => {
		const request = getRequest();
		const auth = createAuth();
		const session = await auth.api.getSession({ headers: request.headers });

		if (!session) {
			throw new Error("Unauthorized");
		}

		if (!hasRole(session.user.role as string, "admin")) {
			throw new Error("Admin access required");
		}

		// prevent self-demotion
		if (data.userId === session.user.id && data.role !== "admin") {
			throw new Error("Cannot change your own role");
		}

		const db = getDb();
		await db
			.update(users)
			.set({ role: data.role, updatedAt: new Date() })
			.where(eq(users.id, data.userId));

		return { success: true };
	});

// delete any track (admin only)
export const adminDeleteTrack = createServerFn({ method: "POST" })
	.inputValidator((data: { trackId: string }) => data)
	.handler(async ({ data }) => {
		const request = getRequest();
		const auth = createAuth();
		const session = await auth.api.getSession({ headers: request.headers });

		if (!session) {
			throw new Error("Unauthorized");
		}

		if (!hasRole(session.user.role as string, "admin")) {
			throw new Error("Admin access required");
		}

		const db = getDb();

		// delete files from r2
		const { deleteTrackFiles } = await import("./files");
		await deleteTrackFiles(data.trackId);

		// delete from database
		await db.delete(tracks).where(eq(tracks.id, data.trackId));

		return { success: true };
	});
