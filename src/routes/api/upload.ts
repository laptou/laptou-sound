// file upload api - handles direct uploads to r2

import type { D1Database, R2Bucket } from "@cloudflare/workers-types";
import { createFileRoute } from "@tanstack/solid-router";

export const Route = createFileRoute("/api/upload")({
	server: {
		handler: {
			POST: async ({ request, context }) => {
				const env = (context as any).cloudflare?.env;
				const r2 = env?.R2 as R2Bucket | undefined;
				const db = env?.DB as D1Database | undefined;

				if (!r2 || !db) {
					return new Response("Storage not configured", { status: 500 });
				}

				// verify session
				const cookies = request.headers.get("cookie") || "";
				const sessionToken = cookies
					.split(";")
					.find((c) => c.trim().startsWith("better-auth.session_token="))
					?.split("=")[1];

				if (!sessionToken) {
					return new Response("Unauthorized", { status: 401 });
				}

				// verify session is valid
				const session = await db
					.prepare(
						`SELECT user_id FROM session WHERE token = ? AND expires_at > datetime('now')`,
					)
					.bind(sessionToken)
					.first<{ user_id: string }>();

				if (!session) {
					return new Response("Unauthorized", { status: 401 });
				}

				// get upload key from query params
				const url = new URL(request.url);
				const key = url.searchParams.get("key");

				if (!key) {
					return new Response("Upload key required", { status: 400 });
				}

				// verify key format (must be in allowed paths)
				const allowedPrefixes = ["originals/", "covers/"];
				const isAllowed = allowedPrefixes.some((p) => key.startsWith(p));

				if (!isAllowed) {
					return new Response("Invalid upload path", { status: 400 });
				}

				// get content type
				const contentType =
					request.headers.get("content-type") || "application/octet-stream";

				// stream body directly to r2
				const body = await request.arrayBuffer();

				await r2.put(key, body, {
					httpMetadata: {
						contentType,
					},
				});

				return Response.json({ key, size: body.byteLength });
			},
		},
	},
});
