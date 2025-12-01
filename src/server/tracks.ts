// track management server functions

import { env } from "cloudflare:workers";
import { createServerFn } from "@tanstack/solid-start";
import { getRequest } from "@tanstack/solid-start/server";
import { desc, eq, inArray } from "drizzle-orm";
import { getDb, type NewTrack, tracks, trackVersions, user } from "@/db";
import { createAuth } from "@/lib/auth";
import { deleteTrackFiles, getOriginalKey, uploadFile } from "./files";

// public track info including owner and album art
export interface PublicTrackInfo {
	id: string;
	title: string;
	description: string | null;
	ownerId: string;
	ownerName: string;
	ownerImage: string | null;
	albumArtKey: string | null;
	createdAt: Date;
}

// get all public tracks (for home page)
export const getPublicTracks = createServerFn({ method: "GET" }).handler(
	async (): Promise<PublicTrackInfo[]> => {
		const db = getDb();
		const result = await db
			.select({
				id: tracks.id,
				title: tracks.title,
				description: tracks.description,
				ownerId: tracks.ownerId,
				ownerName: user.name,
				ownerImage: user.image,
				activeVersion: tracks.activeVersion,
				createdAt: tracks.createdAt,
			})
			.from(tracks)
			.innerJoin(user, eq(tracks.ownerId, user.id))
			.where(eq(tracks.isPublic, true))
			.orderBy(desc(tracks.createdAt))
			.limit(50);

		// fetch album art keys for tracks with active versions
		const tracksWithVersions = result.filter((t) => t.activeVersion);
		const versionIds = tracksWithVersions.map((t) => t.activeVersion as string);

		let albumArtMap: Record<string, string | null> = {};
		if (versionIds.length > 0) {
			const versions = await db
				.select({
					id: trackVersions.id,
					albumArtKey: trackVersions.albumArtKey,
				})
				.from(trackVersions)
				.where(inArray(trackVersions.id, versionIds));

			albumArtMap = Object.fromEntries(
				versions.map((v) => [v.id, v.albumArtKey]),
			);
		}

		return result.map((t) => ({
			id: t.id,
			title: t.title,
			description: t.description,
			ownerId: t.ownerId,
			ownerName: t.ownerName,
			ownerImage: t.ownerImage,
			albumArtKey: t.activeVersion
				? (albumArtMap[t.activeVersion] ?? null)
				: null,
			createdAt: t.createdAt,
		}));
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
// returns all versions for track owners/admins, otherwise only the active version
export const getTrackVersions = createServerFn({ method: "GET" })
	.inputValidator((data: { trackId: string }) => data)
	.handler(async ({ data }) => {
		const request = getRequest();
		const auth = createAuth();
		const session = await auth.api.getSession({ headers: request.headers });

		const db = getDb();

		// get track to check ownership and active version
		const track = await db
			.select()
			.from(tracks)
			.where(eq(tracks.id, data.trackId))
			.limit(1);

		if (!track[0]) {
			return [];
		}

		// check if user is owner or admin
		let canViewAllVersions = false;
		if (session?.user) {
			const isTrackOwner = track[0].ownerId === session.user.id;
			const userRole = (session.user as { role?: string }).role;
			const isAdmin = userRole === "admin";
			canViewAllVersions = isTrackOwner || isAdmin;
		}

		// if user can view all versions, return all
		if (canViewAllVersions) {
			const result = await db
				.select()
				.from(trackVersions)
				.where(eq(trackVersions.trackId, data.trackId))
				.orderBy(desc(trackVersions.versionNumber));
			return result;
		}

		// otherwise, only return the active version if it exists
		if (track[0].activeVersion) {
			const result = await db
				.select()
				.from(trackVersions)
				.where(eq(trackVersions.id, track[0].activeVersion))
				.limit(1);
			return result;
		}

		// no active version, return empty array
		return [];
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
		const queue = env.laptou_sound_audio_processing_queue;
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

// set active version for a track
export const setActiveVersion = createServerFn({ method: "POST" })
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
			throw new Error("You do not have permission to edit this track");
		}

		// verify version exists and is complete
		const version = await db
			.select()
			.from(trackVersions)
			.where(eq(trackVersions.id, data.versionId))
			.limit(1);

		if (!version[0]) {
			throw new Error("Version not found");
		}

		if (version[0].processingStatus !== "complete") {
			throw new Error("Cannot set incomplete version as active");
		}

		await db
			.update(tracks)
			.set({ activeVersion: data.versionId, updatedAt: new Date() })
			.where(eq(tracks.id, data.trackId));

		return { success: true };
	});

// update version metadata
export const updateVersionMetadata = createServerFn({ method: "POST" })
	.inputValidator(
		(data: {
			trackId: string;
			versionId: string;
			artist?: string | null;
			album?: string | null;
			genre?: string | null;
			year?: number | null;
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
			throw new Error("You do not have permission to edit this track");
		}

		// verify version exists
		const version = await db
			.select()
			.from(trackVersions)
			.where(eq(trackVersions.id, data.versionId))
			.limit(1);

		if (!version[0]) {
			throw new Error("Version not found");
		}

		const updates: Partial<typeof trackVersions.$inferInsert> = {};

		if (data.artist !== undefined) updates.artist = data.artist;
		if (data.album !== undefined) updates.album = data.album;
		if (data.genre !== undefined) updates.genre = data.genre;
		if (data.year !== undefined) updates.year = data.year;

		await db
			.update(trackVersions)
			.set(updates)
			.where(eq(trackVersions.id, data.versionId));

		return { success: true };
	});

// get a single version by id
export const getTrackVersion = createServerFn({ method: "GET" })
	.inputValidator((data: { versionId: string }) => data)
	.handler(async ({ data }) => {
		const db = getDb();
		const result = await db
			.select()
			.from(trackVersions)
			.where(eq(trackVersions.id, data.versionId))
			.limit(1);

		return result[0] ?? null;
	});
