// download api route - serves original files with social prompt check

import type { D1Database, R2Bucket } from "@cloudflare/workers-types";
import { createFileRoute } from "@tanstack/solid-router";

export const Route = createFileRoute("/api/download/$trackId")({
	server: {
		handler: {
			GET: async ({ params, context }) => {
				const env = (context as any).cloudflare?.env;
				const db = env?.DB as D1Database | undefined;
				const r2 = env?.R2 as R2Bucket | undefined;

				if (!db || !r2) {
					return Response.json(
						{ error: "Storage not configured" },
						{ status: 500 },
					);
				}

				const { trackId } = params;
				if (!trackId) {
					return Response.json({ error: "Track ID required" }, { status: 400 });
				}

				// get track and latest version
				const track = await db
					.prepare(
						`SELECT t.*, tv.original_key, tv.id as version_id
         FROM track t
         LEFT JOIN track_version tv ON tv.track_id = t.id
         AND tv.version_number = (
           SELECT MAX(version_number) FROM track_version WHERE track_id = t.id
         )
         WHERE t.id = ?`,
					)
					.bind(trackId)
					.first<{
						id: string;
						title: string;
						is_downloadable: number;
						social_prompt: string | null;
						original_key: string | null;
					}>();

				if (!track) {
					return Response.json({ error: "Track not found" }, { status: 404 });
				}

				if (!track.is_downloadable) {
					return Response.json(
						{ error: "Downloads not enabled for this track" },
						{ status: 403 },
					);
				}

				if (!track.original_key) {
					return Response.json(
						{ error: "No downloadable file available" },
						{ status: 404 },
					);
				}

				// get file from r2
				const object = await r2.get(track.original_key);
				if (!object) {
					return Response.json({ error: "File not found" }, { status: 404 });
				}

				// determine filename for download
				const originalFilename = track.original_key.split("/").pop() || "download";
				const safeFilename = `${track.title.replace(/[^a-zA-Z0-9-_]/g, "_")}_${originalFilename}`;

				return new Response(object.body, {
					headers: {
						"Content-Type":
							object.httpMetadata?.contentType || "application/octet-stream",
						"Content-Length": object.size.toString(),
						"Content-Disposition": `attachment; filename="${safeFilename}"`,
						"Cache-Control": "private, max-age=3600",
					},
				});
			},
		},
	},
});
