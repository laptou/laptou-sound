// album art upload api route (for development/indirect mode)

import { env } from "cloudflare:workers";
import { createFileRoute } from "@tanstack/solid-router";
import { eq } from "drizzle-orm";
import { getDb, tracks } from "@/db";
import { createAuth } from "@/lib/auth";
import { getTempUploadKey } from "@/server/files";
import type { ProcessAlbumArtJob } from "@/server/queue-handler";

export const Route = createFileRoute("/api/upload-album-art")({
	server: {
		handlers: {
			POST: async ({ request }) => {
				const auth = createAuth();
				const session = await auth.api.getSession({ headers: request.headers });

				if (!session) {
					return new Response(JSON.stringify({ error: "Unauthorized" }), {
						status: 401,
						headers: { "Content-Type": "application/json" },
					});
				}

				const formData = await request.formData();
				const file = formData.get("file") as File | null;
				const trackId = formData.get("trackId") as string | null;
				const versionId = formData.get("versionId") as string | null;

				if (!file) {
					return new Response(JSON.stringify({ error: "No file provided" }), {
						status: 400,
						headers: { "Content-Type": "application/json" },
					});
				}

				if (!trackId || !versionId) {
					return new Response(
						JSON.stringify({ error: "Track ID and version ID required" }),
						{
							status: 400,
							headers: { "Content-Type": "application/json" },
						},
					);
				}

				if (!file.type.startsWith("image/")) {
					return new Response(
						JSON.stringify({ error: "File must be an image" }),
						{
							status: 400,
							headers: { "Content-Type": "application/json" },
						},
					);
				}

				// validate file size (max 10MB for album art)
				if (file.size > 10 * 1024 * 1024) {
					return new Response(
						JSON.stringify({ error: "File size must be less than 10MB" }),
						{
							status: 400,
							headers: { "Content-Type": "application/json" },
						},
					);
				}

				const db = getDb();

				// verify ownership
				const track = await db
					.select()
					.from(tracks)
					.where(eq(tracks.id, trackId))
					.limit(1);

				if (!track[0]) {
					return new Response(JSON.stringify({ error: "Track not found" }), {
						status: 404,
						headers: { "Content-Type": "application/json" },
					});
				}

				const isOwner = track[0].ownerId === session.user.id;
				const isAdmin = session.user.role === "admin";

				if (!isOwner && !isAdmin) {
					return new Response(
						JSON.stringify({ error: "You do not have permission to edit this track" }),
						{
							status: 403,
							headers: { "Content-Type": "application/json" },
						},
					);
				}

				// upload to temp location
				const uploadId = crypto.randomUUID();
				const ext = file.name.split(".").pop() || "png";
				const tempKey = getTempUploadKey(uploadId, ext);

				const bucket = env.laptou_sound_files;
				await bucket.put(tempKey, await file.arrayBuffer(), {
					httpMetadata: { contentType: file.type },
				});

				// queue processing job
				const queue = env.laptou_sound_audio_processing_queue;
				const job: ProcessAlbumArtJob = {
					type: "process_album_art",
					trackId,
					versionId,
					tempKey,
				};
				await queue.send(job);

				return new Response(
					JSON.stringify({ success: true, tempKey }),
					{
						status: 200,
						headers: { "Content-Type": "application/json" },
					},
				);
			},
		},
	},
});

