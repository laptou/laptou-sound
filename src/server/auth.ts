// server-side auth helpers

import { createServerFn } from "@tanstack/solid-start";
import { getRequest } from "@tanstack/solid-start/server";
import { eq } from "drizzle-orm";
import { getDb, inviteCodes, user } from "@/db";
import { createAuth } from "@/lib/auth";

// get the current session from request headers
export const getSession = createServerFn({ method: "GET" }).handler(
	async () => {
		const request = getRequest();
		const auth = createAuth();
		const session = await auth.api.getSession({ headers: request.headers });
		return session;
	},
);

// get the current user or null
export const getCurrentUser = createServerFn({ method: "GET" }).handler(
	async () => {
		const request = getRequest();
		const auth = createAuth();
		const session = await auth.api.getSession({ headers: request.headers });
		return session?.user ?? null;
	},
);

// check if user has at least the specified role
export function hasRole(
	userRole: string | undefined,
	requiredRole: "commenter" | "uploader" | "admin",
): boolean {
	if (!userRole) return false;

	const roleHierarchy = {
		commenter: 0,
		uploader: 1,
		admin: 2,
	};

	const userLevel = roleHierarchy[userRole as keyof typeof roleHierarchy] ?? -1;
	const requiredLevel = roleHierarchy[requiredRole];

	return userLevel >= requiredLevel;
}

// redeem an invite code to upgrade the current user's role
export const redeemInviteCode = createServerFn({ method: "POST" })
	.inputValidator((data: { code: string }) => {
		if (
			!data.code ||
			typeof data.code !== "string" ||
			data.code.trim().length === 0
		) {
			throw new Error("Invite code is required");
		}
		return { code: data.code.trim().toUpperCase() };
	})
	.handler(async ({ data }) => {
		const request = getRequest();
		const auth = createAuth();
		const session = await auth.api.getSession({ headers: request.headers });

		if (!session) {
			throw new Error("Unauthorized");
		}

		const db = getDb();
		const userId = session.user.id;

		// find the invite code
		const codes = await db
			.select()
			.from(inviteCodes)
			.where(eq(inviteCodes.code, data.code))
			.limit(1);

		if (codes.length === 0) {
			throw new Error("Invalid invite code");
		}

		const inviteCode = codes[0];

		// check if code is already used
		if (inviteCode.usedBy) {
			throw new Error("Invite code has already been used");
		}

		// check if user already has equal or higher role
		const currentRole = (session.user.role as string) || "commenter";
		const roleHierarchy = {
			commenter: 0,
			uploader: 1,
			admin: 2,
		};

		const currentLevel =
			roleHierarchy[currentRole as keyof typeof roleHierarchy] ?? -1;
		const newLevel = roleHierarchy[inviteCode.role];

		if (currentLevel >= newLevel) {
			throw new Error(
				`You already have a role equal to or higher than ${inviteCode.role}`,
			);
		}

		// update user role and inviteCodeUsed field
		await db
			.update(user)
			.set({
				role: inviteCode.role,
				inviteCodeUsed: inviteCode.code,
				updatedAt: new Date(),
			})
			.where(eq(user.id, userId));

		// mark invite code as used
		await db
			.update(inviteCodes)
			.set({
				usedBy: userId,
				usedAt: new Date(),
			})
			.where(eq(inviteCodes.id, inviteCode.id));

		return { success: true, newRole: inviteCode.role };
	});
