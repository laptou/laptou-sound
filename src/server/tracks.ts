// track management server functions

import { env } from "cloudflare:workers";
import { createServerFn } from "@tanstack/solid-start";
import { getRequest } from "@tanstack/solid-start/server";
import { desc, eq } from "drizzle-orm";
import { getDb, type NewTrack, tracks, trackVersions } from "@/db";
import { createAuth } from "@/lib/auth";
import { deleteTrackFiles, getOriginalKey, uploadFile } from "./files";

// get all public tracks (for home page)
export const getPublicTracks = createServerFn({ method: "GET" }).handler(
	async () => {
		const db = getDb();
		const result = await db
			.select()
			.from(tracks)
			.where(eq(tracks.isPublic, true))
			.orderBy(desc(tracks.createdAt))
			.limit(50);

		return result;
	},
);

// get a single track by id
export const getTrack = createServerFn({ method: "GET" })
	.inputValidator((data: { trackId: string }) => data)
	.handler(async ({ data }) => {
		const db = getDb();
		const result = await db
			.select()
			.from(tracks)
			.where(eq(tracks.id, data.trackId))
			.limit(1);

		return result[0] ?? null;
	});

// get track versions
export const getTrackVersions = createServerFn({ method: "GET" })
	.inputValidator((data: { trackId: string }) => data)
	.handler(async ({ data }) => {
		const db = getDb();
		const result = await db
			.select()
			.from(trackVersions)
			.where(eq(trackVersions.trackId, data.trackId))
			.orderBy(desc(trackVersions.versionNumber));

		return result;
	});

// get user's own tracks
export const getMyTracks = createServerFn({ method: "GET" }).handler(
	async () => {
		const request = getRequest();
		const auth = createAuth();
		const session = await auth.api.getSession({ headers: request.headers });

		if (!session) {
			throw new Error("Unauthorized");
		}

		const db = getDb();
		const result = await db
			.select()
			.from(tracks)
			.where(eq(tracks.ownerId, session.user.id))
			.orderBy(desc(tracks.createdAt));

		return result;
	},
);

// create a new track (metadata only, upload handled separately)
export const createTrack = createServerFn({ method: "POST" })
	.inputValidator(
		(data: {
			title: string;
			description?: string;
			isPublic?: boolean;
			allowDownload?: boolean;
		}) => data,
	)
	.handler(async ({ data }) => {
		const request = getRequest();
		const auth = createAuth();
		const session = await auth.api.getSession({ headers: request.headers });

		if (!session) {
			throw new Error("Unauthorized");
		}

		// check if user can upload
		const role = session.user.role as string;
		if (role !== "uploader" && role !== "admin") {
			throw new Error("You do not have permission to upload tracks");
		}

		const db = getDb();
		const trackId = crypto.randomUUID();
		const now = new Date();

		const newTrack: NewTrack = {
			id: trackId,
			ownerId: session.user.id,
			title: data.title,
			description: data.description ?? null,
			isPublic: data.isPublic ?? true,
			allowDownload: data.allowDownload ?? false,
			socialPromptEnabled: false,
			socialLinks: null,
			createdAt: now,
			updatedAt: now,
		};

		await db.insert(tracks).values(newTrack);

		return { id: trackId };
	});

// update track metadata
export const updateTrack = createServerFn({ method: "POST" })
	.inputValidator(
		(data: {
			trackId: string;
			title?: string;
			description?: string;
			isPublic?: boolean;
			allowDownload?: boolean;
			socialPromptEnabled?: boolean;
			socialLinks?: {
				instagram?: string;
				soundcloud?: string;
				tiktok?: string;
			};
		}) => data,
	)
	.handler(async ({ data }) => {
		const request = getRequest();
		const auth = createAuth();
		const session = await auth.api.getSession({ headers: request.headers });

		if (!session) {
			throw new Error("Unauthorized");
		}

		const db = getDb();

		// verify ownership or admin
		const track = await db
			.select()
			.from(tracks)
			.where(eq(tracks.id, data.trackId))
			.limit(1);

		if (!track[0]) {
			throw new Error("Track not found");
		}

		const isOwner = track[0].ownerId === session.user.id;
		const isAdmin = session.user.role === "admin";

		if (!isOwner && !isAdmin) {
			throw new Error("You do not have permission to edit this track");
		}

		const updates: Partial<NewTrack> = {
			updatedAt: new Date(),
		};

		if (data.title !== undefined) updates.title = data.title;
		if (data.description !== undefined) updates.description = data.description;
		if (data.isPublic !== undefined) updates.isPublic = data.isPublic;
		if (data.allowDownload !== undefined)
			updates.allowDownload = data.allowDownload;
		if (data.socialPromptEnabled !== undefined)
			updates.socialPromptEnabled = data.socialPromptEnabled;
		if (data.socialLinks !== undefined)
			updates.socialLinks = JSON.stringify(data.socialLinks);

		await db.update(tracks).set(updates).where(eq(tracks.id, data.trackId));

		return { success: true };
	});

// delete a track
export const deleteTrack = createServerFn({ method: "POST" })
	.inputValidator((data: { trackId: string }) => data)
	.handler(async ({ data }) => {
		const request = getRequest();
		const auth = createAuth();
		const session = await auth.api.getSession({ headers: request.headers });

		if (!session) {
			throw new Error("Unauthorized");
		}

		const db = getDb();

		// verify ownership or admin
		const track = await db
			.select()
			.from(tracks)
			.where(eq(tracks.id, data.trackId))
			.limit(1);

		if (!track[0]) {
			throw new Error("Track not found");
		}

		const isOwner = track[0].ownerId === session.user.id;
		const isAdmin = session.user.role === "admin";

		if (!isOwner && !isAdmin) {
			throw new Error("You do not have permission to delete this track");
		}

		// delete files from r2
		await deleteTrackFiles(data.trackId);

		// delete from database (cascades to versions, plays, comments)
		await db.delete(tracks).where(eq(tracks.id, data.trackId));

		return { success: true };
	});

// upload a new version of a track
export const uploadTrackVersion = createServerFn({ method: "POST" }).handler(
	async () => {
		const request = getRequest();
		const auth = createAuth();
		const session = await auth.api.getSession({ headers: request.headers });

		if (!session) {
			throw new Error("Unauthorized");
		}

		const formData = await request.formData();
		const file = formData.get("file") as File | null;
		const trackId = formData.get("trackId") as string | null;

		if (!file) {
			throw new Error("No file provided");
		}

		if (!trackId) {
			throw new Error("No track ID provided");
		}

		const db = getDb();

		// verify ownership
		const track = await db
			.select()
			.from(tracks)
			.where(eq(tracks.id, trackId))
			.limit(1);

		if (!track[0]) {
			throw new Error("Track not found");
		}

		if (track[0].ownerId !== session.user.id) {
			throw new Error("You do not have permission to upload to this track");
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
		await uploadFile(originalKey, await file.arrayBuffer(), file.type);

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

		return { versionId, versionNumber: nextVersion };
	},
);

// delete a track version
export const deleteTrackVersion = createServerFn({ method: "POST" })
	.inputValidator((data: { trackId: string; versionId: string }) => data)
	.handler(async ({ data }) => {
		const request = getRequest();
		const auth = createAuth();
		const session = await auth.api.getSession({ headers: request.headers });

		if (!session) {
			throw new Error("Unauthorized");
		}

		const db = getDb();

		// verify ownership
		const track = await db
			.select()
			.from(tracks)
			.where(eq(tracks.id, data.trackId))
			.limit(1);

		if (!track[0]) {
			throw new Error("Track not found");
		}

		const isOwner = track[0].ownerId === session.user.id;
		const isAdmin = session.user.role === "admin";

		if (!isOwner && !isAdmin) {
			throw new Error("You do not have permission to delete this version");
		}

		// delete files from r2
		const { deleteTrackVersionFiles } = await import("./files");
		await deleteTrackVersionFiles(data.trackId, data.versionId);

		// delete from database
		await db.delete(trackVersions).where(eq(trackVersions.id, data.versionId));

		return { success: true };
	});
