// profile photo upload api route (for development/indirect mode)

import { env } from "cloudflare:workers";
import { createFileRoute } from "@tanstack/solid-router";
import { createAuth } from "@/lib/auth";
import { getTempUploadKey } from "@/server/files";
import type { ProcessProfilePhotoJob } from "@/server/queue-handler";

export const Route = createFileRoute("/api/upload-profile-photo")({
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

				if (!file) {
					return new Response(JSON.stringify({ error: "No file provided" }), {
						status: 400,
						headers: { "Content-Type": "application/json" },
					});
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

				// validate file size (max 5MB for profile photos)
				if (file.size > 5 * 1024 * 1024) {
					return new Response(
						JSON.stringify({ error: "File size must be less than 5MB" }),
						{
							status: 400,
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
				const job: ProcessProfilePhotoJob = {
					type: "process_profile_photo",
					userId: session.user.id,
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

