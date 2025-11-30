// better auth server configuration
// handles authentication with email/password and magic link

import { env } from "cloudflare:workers";
import { createServerFn, createServerOnlyFn } from "@tanstack/solid-start";
import { getRequestHeaders } from "@tanstack/solid-start/server";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { magicLink } from "better-auth/plugins";
// import { tanstackStartCookies } from "better-auth/tanstack-start";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "@/db/schema";

// create auth instance - called fresh each request to get current env
export const createAuth = createServerOnlyFn(() => {
	const db = drizzle(env.laptou_sound_db);

	return betterAuth({
		database: drizzleAdapter(db, {
			provider: "sqlite",
			schema: {
				user: schema.user,
				session: schema.session,
				account: schema.account,
				verification: schema.verification,
			},
		}),
		emailAndPassword: {
			enabled: true,
		},
		plugins: [
			magicLink({
				sendMagicLink: async ({ email, url }) => {
					// todo: implement actual email sending
					// for now, log the magic link
					console.log(`[AUTH] Magic link for ${email}: ${url}`);
				},
			}),

			// according to docs, this must be last plugin
			// https://www.better-auth.com/docs/integrations/tanstack
			// tanstackStartCookies(),
		],
		user: {
			additionalFields: {
				role: {
					type: "string",
					defaultValue: "commenter",
					input: false,
				},
				inviteCodeUsed: {
					type: "string",
					required: false,
				},
			},
		},
		trustedOrigins: [
			"http://localhost:3000",
			// add production domain here
		],
	});
});

export const getSession = createServerFn().handler(async () => {
	return createAuth().api.getSession({ headers: getRequestHeaders() });
});

// type for the auth instance
export type Auth = ReturnType<typeof createAuth>;
