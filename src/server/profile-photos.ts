// profile photo upload server functions
// supports both presigned url uploads (production) and direct uploads (development)

import { env } from "cloudflare:workers";
import { createServerFn } from "@tanstack/solid-start";
import { getRequest } from "@tanstack/solid-start/server";
import { eq } from "drizzle-orm";
import { getDb, user } from "@/db";
import { createAuth } from "@/lib/auth";
import {
	generatePresignedUrl,
	getTempUploadKey,
	uploadFile,
	useIndirectAccess,
} from "./files";
import type { ProcessProfilePhotoJob } from "./queue-handler";

// get upload url for profile photo
// in production: returns presigned url for direct upload to r2
// in development: returns indirect upload url
export const getProfilePhotoUploadUrl = createServerFn({ method: "GET" })
	.inputValidator(
		(data: { contentType: string; fileExtension: string }) => data,
	)
	.handler(async ({ data }) => {
		const request = getRequest();
		const auth = createAuth();
		const session = await auth.api.getSession({ headers: request.headers });

		if (!session) {
			throw new Error("Unauthorized");
		}

		// validate content type
		if (!data.contentType.startsWith("image/")) {
			throw new Error("File must be an image");
		}

		const uploadId = crypto.randomUUID();
		const tempKey = getTempUploadKey(uploadId, data.fileExtension);

		if (useIndirectAccess()) {
			// return indirect upload endpoint for development
			return {
				mode: "indirect" as const,
				uploadUrl: `/api/upload-profile-photo`,
				uploadId,
				tempKey,
			};
		}

		// generate presigned url for production
		const presignedUrl = await generatePresignedUrl(
			tempKey,
			"PUT",
			900, // 15 minutes
			data.contentType,
		);

		return {
			mode: "presigned" as const,
			uploadUrl: presignedUrl,
			uploadId,
			tempKey,
		};
	});

// confirm profile photo upload and queue processing
// called after client uploads file to presigned url
export const confirmProfilePhotoUpload = createServerFn({ method: "POST" })
	.inputValidator((data: { tempKey: string }) => data)
	.handler(async ({ data }) => {
		const request = getRequest();
		const auth = createAuth();
		const session = await auth.api.getSession({ headers: request.headers });

		if (!session) {
			throw new Error("Unauthorized");
		}

		// verify file exists in r2
		const bucket = env.laptou_sound_files;
		const file = await bucket.head(data.tempKey);

		if (!file) {
			throw new Error("Upload not found - file may have expired");
		}

		// queue processing job
		const queue = env.laptou_sound_audio_processing_queue;
		const job: ProcessProfilePhotoJob = {
			type: "process_profile_photo",
			userId: session.user.id,
			tempKey: data.tempKey,
		};
		await queue.send(job);

		return { success: true };
	});

// direct upload handler for development mode (indirect access)
export const uploadProfilePhotoDirect = createServerFn({
	method: "POST",
}).handler(async () => {
	const request = getRequest();
	const auth = createAuth();
	const session = await auth.api.getSession({ headers: request.headers });

	if (!session) {
		throw new Error("Unauthorized");
	}

	const formData = await request.formData();
	const file = formData.get("file") as File | null;

	if (!file) {
		throw new Error("No file provided");
	}

	if (!file.type.startsWith("image/")) {
		throw new Error("File must be an image");
	}

	// validate file size (max 5MB for profile photos)
	if (file.size > 5 * 1024 * 1024) {
		throw new Error("File size must be less than 5MB");
	}

	// upload to temp location
	const uploadId = crypto.randomUUID();
	const ext = file.name.split(".").pop() || "png";
	const tempKey = getTempUploadKey(uploadId, ext);

	await uploadFile(tempKey, await file.arrayBuffer(), file.type);

	// queue processing job
	const queue = env.laptou_sound_audio_processing_queue;
	const job: ProcessProfilePhotoJob = {
		type: "process_profile_photo",
		userId: session.user.id,
		tempKey,
	};
	await queue.send(job);

	return { success: true, tempKey };
});

// remove profile photo
export const removeProfilePhoto = createServerFn({ method: "POST" }).handler(
	async () => {
		const request = getRequest();
		const auth = createAuth();
		const session = await auth.api.getSession({ headers: request.headers });

		if (!session) {
			throw new Error("Unauthorized");
		}

		const db = getDb();

		// get current user
		const currentUser = await db
			.select()
			.from(user)
			.where(eq(user.id, session.user.id))
			.limit(1);

		if (!currentUser[0]) {
			throw new Error("User not found");
		}

		// delete profile photo from r2 if it's stored there
		if (currentUser[0].image?.startsWith("/files/users/")) {
			const bucket = env.laptou_sound_files;
			const key = currentUser[0].image.replace("/files/", "");
			await bucket.delete(key);
		}

		// clear image field in database
		await db
			.update(user)
			.set({ image: null })
			.where(eq(user.id, session.user.id));

		return { success: true };
	},
);
