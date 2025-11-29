// server-side auth helpers

import { createServerFn } from "@tanstack/solid-start";
import { getRequest } from "@tanstack/solid-start/server";
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
