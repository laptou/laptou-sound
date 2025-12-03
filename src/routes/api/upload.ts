// file upload api route
// supports two modes:
// 1. with trackId: creates version for existing track (legacy/direct flow)
// 2. without trackId: uploads to temp location, returns tempKey for confirm step

import { env } from "cloudflare:workers";
import { createFileRoute } from "@tanstack/solid-router";
import { desc, eq } from "drizzle-orm";
import { getDb, tracks, trackVersions } from "@/db";
import { createAuth } from "@/lib/auth";
import { getOriginalKey, getTempUploadKey } from "@/server/files";

export const Route = createFileRoute("/api/upload")({
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

				const bucket = env.laptou_sound_files;
				const ext = file.name.split(".").pop() || "mp3";

				// mode 1: temp upload (no trackId) - returns tempKey for confirm step
				if (!trackId) {
					const uploadId = crypto.randomUUID();
					const tempKey = getTempUploadKey(uploadId, ext);

					await bucket.put(tempKey, await file.arrayBuffer(), {
						httpMetadata: { contentType: file.type },
					});

					return new Response(JSON.stringify({ tempKey }), {
						status: 200,
						headers: { "Content-Type": "application/json" },
					});
				}

				// mode 2: direct upload to existing track (legacy flow)
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
				const originalKey = getOriginalKey(trackId, versionId, ext);

				// upload to r2
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
				const queue = env.laptou_sound_audio_processing_queue;
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
