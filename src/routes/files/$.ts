// file serving route for r2 objects

import { env } from "cloudflare:workers";
import { createFileRoute } from "@tanstack/solid-router";
import { commonMiddleware } from "@/lib/middleware";

export const Route = createFileRoute("/files/$")({
	server: {
		middleware: commonMiddleware,
		handlers: {
			GET: async ({ params }) => {
				const key = params._splat;

				if (!key) {
					return new Response("Not found", { status: 404 });
				}

				const bucket = env.laptou_sound_files;
				const object = await bucket.get(key);

				if (!object) {
					return new Response("Not found", { status: 404 });
				}

				const contentType =
					object.httpMetadata?.contentType || "application/octet-stream";

				// set cache headers for audio files
				const isAudio = contentType.startsWith("audio/");
				const cacheControl = isAudio
					? "public, max-age=31536000, immutable"
					: "public, max-age=3600";

				return new Response(object.body, {
					headers: {
						"Content-Type": contentType,
						"Cache-Control": cacheControl,
						"Content-Length": object.size.toString(),
					},
				});
			},
		},
	},
});
