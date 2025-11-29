// file upload api route

import { env } from "cloudflare:workers";
import { createFileRoute } from "@tanstack/solid-router";
import { desc, eq } from "drizzle-orm";
import { getDb, tracks, trackVersions } from "@/db";
import { createAuth } from "@/lib/auth";
import { getOriginalKey } from "@/server/files";
import { commonMiddleware } from "@/lib/middleware";

export const Route = createFileRoute("/api/upload")({
	server: {
		middleware: commonMiddleware,
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

				// check uploader role
				const role = session.user.role as string;
				if (role !== "uploader" && role !== "admin") {
					return new Response(
						JSON.stringify({ error: "Insufficient permissions" }),
						{
							status: 403,
							headers: { "Content-Type": "application/json" },
						},
					);
				}

				const formData = await request.formData();
				const file = formData.get("file") as File | null;
				const trackId = formData.get("trackId") as string | null;

				if (!file) {
					return new Response(JSON.stringify({ error: "No file provided" }), {
						status: 400,
						headers: { "Content-Type": "application/json" },
					});
				}

				if (!trackId) {
					return new Response(
						JSON.stringify({ error: "No track ID provided" }),
						{
							status: 400,
							headers: { "Content-Type": "application/json" },
						},
					);
				}

				const db = getDb();

				// verify track ownership
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

				if (track[0].ownerId !== session.user.id) {
					return new Response(
						JSON.stringify({ error: "You do not own this track" }),
						{
							status: 403,
							headers: { "Content-Type": "application/json" },
						},
					);
				}

				// get next version number
				const existingVersions = await db
					.select()
					.from(trackVersions)
					.where(eq(trackVersions.trackId, trackId))
					.orderBy(desc(trackVersions.versionNumber))
					.limit(1);

				const nextVersion = existingVersions[0]
					? existingVersions[0].versionNumber + 1
					: 1;

				const versionId = crypto.randomUUID();
				const ext = file.name.split(".").pop() || "mp3";
				const originalKey = getOriginalKey(trackId, versionId, ext);

				// upload to r2
				const bucket = env.laptou_sound_files;
				await bucket.put(originalKey, await file.arrayBuffer(), {
					httpMetadata: { contentType: file.type },
				});

				// create version record
				await db.insert(trackVersions).values({
					id: versionId,
					trackId,
					versionNumber: nextVersion,
					originalKey,
					processingStatus: "pending",
					createdAt: new Date(),
				});

				// enqueue processing job
				const queue = env.AUDIO_QUEUE;
				await queue.send({
					type: "process_audio",
					trackId,
					versionId,
					originalKey,
				});

				return new Response(
					JSON.stringify({
						versionId,
						versionNumber: nextVersion,
					}),
					{
						status: 200,
						headers: { "Content-Type": "application/json" },
					},
				);
			},
		},
	},
});
