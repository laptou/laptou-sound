// track management server functions

import { env } from "cloudflare:workers";
import { createServerFn } from "@tanstack/solid-start";
import { getRequest } from "@tanstack/solid-start/server";
import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { getDb, type NewTrack, tracks, trackVersions, user } from "@/db";
import { createAuth } from "@/lib/auth";
import {
	deleteTrackFiles,
	getAlbumArtKey,
	getOriginalKey,
	getTempUploadKey,
	uploadFile,
	generatePresignedUrl,
	useIndirectAccess,
} from "./files";
import type { UpdateMetadataJob, ProcessAlbumArtJob } from "./queue-handler";

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

		// if user can view all versions, return all (including archived)
		if (canViewAllVersions) {
			const result = await db
				.select()
				.from(trackVersions)
				.where(eq(trackVersions.trackId, data.trackId))
				.orderBy(desc(trackVersions.versionNumber));
			return result;
		}

		// otherwise, only return the active version if it exists and not archived
		if (track[0].activeVersion) {
			const result = await db
				.select()
				.from(trackVersions)
				.where(
					and(
						eq(trackVersions.id, track[0].activeVersion),
						isNull(trackVersions.archivedAt),
					),
				)
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

// hard-delete a track version (permanently removes from db and r2)
// note: the FK constraint on tracks.active_version has ON DELETE SET NULL,
// so sqlite will automatically clear active_version if this version is active
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

		// delete from database (ON DELETE SET NULL handles clearing active_version)
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

// update version metadata and queue job to regenerate download file
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

		// queue job to regenerate download file with new metadata
		const queue = env.laptou_sound_audio_processing_queue;
		const job: UpdateMetadataJob = {
			type: "update_metadata",
			trackId: data.trackId,
			versionId: data.versionId,
		};
		await queue.send(job);

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

// archive (soft-delete) a track version
export const archiveTrackVersion = createServerFn({ method: "POST" })
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
			throw new Error("You do not have permission to archive this version");
		}

		// if this version is the active version, clear it
		if (track[0].activeVersion === data.versionId) {
			await db
				.update(tracks)
				.set({ activeVersion: null, updatedAt: new Date() })
				.where(eq(tracks.id, data.trackId));
		}

		// set archived_at timestamp
		await db
			.update(trackVersions)
			.set({ archivedAt: new Date() })
			.where(eq(trackVersions.id, data.versionId));

		return { success: true };
	});

// unarchive (restore) a track version
export const unarchiveTrackVersion = createServerFn({ method: "POST" })
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
			throw new Error("You do not have permission to unarchive this version");
		}

		// clear archived_at timestamp
		await db
			.update(trackVersions)
			.set({ archivedAt: null })
			.where(eq(trackVersions.id, data.versionId));

		return { success: true };
	});

// upload album art for a version - accepts FormData directly
export const uploadAlbumArt = createServerFn({ method: "POST" })
	.inputValidator((data) => {
		if (!(data instanceof FormData)) {
			throw new Error("Expected FormData");
		}

		const file = data.get("file") as File | null;
		const trackId = data.get("trackId")?.toString();
		const versionId = data.get("versionId")?.toString();

		if (!file) {
			throw new Error("No file provided");
		}

		if (!file.type.startsWith("image/")) {
			throw new Error("File must be an image");
		}

		if (!trackId || !versionId) {
			throw new Error("Track ID and version ID required");
		}

		return { file, trackId, versionId };
	})
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

		// determine extension from mime type
		const mimeToExt: Record<string, string> = {
			"image/jpeg": "jpg",
			"image/png": "png",
			"image/gif": "gif",
			"image/webp": "webp",
		};
		const ext = mimeToExt[data.file.type] ?? "jpg";
		const albumArtKey = getAlbumArtKey(data.trackId, data.versionId, ext);

		// delete old album art if it exists with a different key (e.g. different extension)
		const oldAlbumArtKey = version[0].albumArtKey;
		if (oldAlbumArtKey && oldAlbumArtKey !== albumArtKey) {
			const { deleteFile } = await import("./files");
			await deleteFile(oldAlbumArtKey);
		}

		// upload to r2
		await uploadFile(
			albumArtKey,
			await data.file.arrayBuffer(),
			data.file.type,
		);

		// update version record
		await db
			.update(trackVersions)
			.set({ albumArtKey })
			.where(eq(trackVersions.id, data.versionId));

		// queue job to regenerate download file with new album art
		const queue = env.laptou_sound_audio_processing_queue;
		const job: UpdateMetadataJob = {
			type: "update_metadata",
			trackId: data.trackId,
			versionId: data.versionId,
		};
		await queue.send(job);

		return { albumArtKey };
	});

// remove album art from a version - deletes from r2 and clears database
export const removeAlbumArt = createServerFn({ method: "POST" })
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

		// get version to find album art key
		const version = await db
			.select()
			.from(trackVersions)
			.where(eq(trackVersions.id, data.versionId))
			.limit(1);

		if (!version[0]) {
			throw new Error("Version not found");
		}

		// delete album art from r2 if it exists
		if (version[0].albumArtKey) {
			const { deleteFile } = await import("./files");
			await deleteFile(version[0].albumArtKey);
		}

		// clear album art key in database
		await db
			.update(trackVersions)
			.set({ albumArtKey: null })
			.where(eq(trackVersions.id, data.versionId));

		// queue job to regenerate download file without album art
		const queue = env.laptou_sound_audio_processing_queue;
		const job: UpdateMetadataJob = {
			type: "update_metadata",
			trackId: data.trackId,
			versionId: data.versionId,
		};
		await queue.send(job);

		return { success: true };
	});

// generate presigned url for streaming a track version
// checks access permissions before generating the url
export const getStreamPresignedUrl = createServerFn({ method: "GET" })
	.inputValidator((data: { trackId: string; versionId: string }) => data)
	.handler(async ({ data }) => {
		const request = getRequest();
		const auth = createAuth();
		const session = await auth.api.getSession({ headers: request.headers });

		const db = getDb();

		// get track to check access
		const track = await db
			.select()
			.from(tracks)
			.where(eq(tracks.id, data.trackId))
			.limit(1);

		if (!track[0]) {
			throw new Error("Track not found");
		}

		// check access: public tracks are accessible to everyone
		// private tracks are only accessible to owner or admin
		const isPublic = track[0].isPublic;
		const isOwner = session?.user && track[0].ownerId === session.user.id;
		const isAdmin = session?.user && session.user.role === "admin";

		if (!isPublic && !isOwner && !isAdmin) {
			throw new Error("You do not have permission to access this track");
		}

		// get version to verify it exists and is complete
		const version = await db
			.select()
			.from(trackVersions)
			.where(eq(trackVersions.id, data.versionId))
			.limit(1);

		if (!version[0]) {
			throw new Error("Version not found");
		}

		// only allow access to complete versions (unless owner/admin)
		if (version[0].processingStatus !== "complete") {
			if (!isOwner && !isAdmin) {
				throw new Error("Version is not ready for playback");
			}
		}

		// check if version belongs to this track
		if (version[0].trackId !== data.trackId) {
			throw new Error("Version does not belong to this track");
		}

		// if no stream key, return null
		if (!version[0].streamKey) {
			return { url: null };
		}

		// generate presigned url (valid for 1 hour)
		const url = await generatePresignedUrl(version[0].streamKey, "GET", 3600);

		return { url };
	});

// get upload url for album art
// in production: returns presigned url for direct upload to r2
// in development: returns indirect upload url
export const getAlbumArtUploadUrl = createServerFn({ method: "GET" })
	.inputValidator(
		(data: {
			trackId: string;
			versionId: string;
			contentType: string;
			fileExtension: string;
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
				uploadUrl: "/api/upload-album-art",
				uploadId,
				tempKey,
				trackId: data.trackId,
				versionId: data.versionId,
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
			trackId: data.trackId,
			versionId: data.versionId,
		};
	});

// confirm album art upload and queue processing
export const confirmAlbumArtUpload = createServerFn({ method: "POST" })
	.inputValidator(
		(data: { trackId: string; versionId: string; tempKey: string }) => data,
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

		// verify file exists in r2
		const bucket = env.laptou_sound_files;
		const file = await bucket.head(data.tempKey);

		if (!file) {
			throw new Error("Upload not found - file may have expired");
		}

		// queue processing job
		const queue = env.laptou_sound_audio_processing_queue;
		const job: ProcessAlbumArtJob = {
			type: "process_album_art",
			trackId: data.trackId,
			versionId: data.versionId,
			tempKey: data.tempKey,
		};
		await queue.send(job);

		return { success: true };
	});

// get upload url for track audio file
// in production: returns presigned url for direct upload to r2
// in development: returns indirect upload url
export const getTrackUploadUrl = createServerFn({ method: "GET" })
	.inputValidator(
		(data: { trackId: string; contentType: string; fileExtension: string }) =>
			data,
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

		if (track[0].ownerId !== session.user.id) {
			throw new Error("You do not have permission to upload to this track");
		}

		// validate content type
		if (!data.contentType.startsWith("audio/")) {
			throw new Error("File must be an audio file");
		}

		// get next version number
		const existingVersions = await db
			.select()
			.from(trackVersions)
			.where(eq(trackVersions.trackId, data.trackId))
			.orderBy(desc(trackVersions.versionNumber))
			.limit(1);

		const nextVersion = existingVersions[0]
			? existingVersions[0].versionNumber + 1
			: 1;

		const versionId = crypto.randomUUID();
		const originalKey = getOriginalKey(data.trackId, versionId, data.fileExtension);

		if (useIndirectAccess()) {
			// return indirect upload endpoint for development
			return {
				mode: "indirect" as const,
				uploadUrl: "/api/upload",
				trackId: data.trackId,
				versionId,
				versionNumber: nextVersion,
				originalKey,
			};
		}

		// generate presigned url for production
		const presignedUrl = await generatePresignedUrl(
			originalKey,
			"PUT",
			1800, // 30 minutes for larger audio files
			data.contentType,
		);

		return {
			mode: "presigned" as const,
			uploadUrl: presignedUrl,
			trackId: data.trackId,
			versionId,
			versionNumber: nextVersion,
			originalKey,
		};
	});

// confirm track upload and create version record
export const confirmTrackUpload = createServerFn({ method: "POST" })
	.inputValidator(
		(data: {
			trackId: string;
			versionId: string;
			versionNumber: number;
			originalKey: string;
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

		if (track[0].ownerId !== session.user.id) {
			throw new Error("You do not have permission to upload to this track");
		}

		// verify file exists in r2
		const bucket = env.laptou_sound_files;
		const file = await bucket.head(data.originalKey);

		if (!file) {
			throw new Error("Upload not found - file may have expired");
		}

		// create version record
		await db.insert(trackVersions).values({
			id: data.versionId,
			trackId: data.trackId,
			versionNumber: data.versionNumber,
			originalKey: data.originalKey,
			processingStatus: "pending",
			createdAt: new Date(),
		});

		// enqueue processing job
		const queue = env.laptou_sound_audio_processing_queue;
		await queue.send({
			type: "process_audio",
			trackId: data.trackId,
			versionId: data.versionId,
			originalKey: data.originalKey,
		});

		return { versionId: data.versionId, versionNumber: data.versionNumber };
	});
