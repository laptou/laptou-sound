// server functions for track operations
import { createServerFn } from "@tanstack/solid-start/server";
import { eq, sql } from "drizzle-orm";
import {
	createTrack,
	createTrackVersion,
	deleteTrack,
	generateId,
	getPlayCount,
	getRecentTracks,
	getTrackById,
	getTrackVersions,
	recordPlay,
} from "../db";
import * as schema from "../db/schema";
import { getSession } from "./auth";
import { getAudioQueue, getDrizzleDB, getR2 } from "./context";

// get recent tracks for home page
export const fetchRecentTracks = createServerFn({ method: "GET" })
	.validator((data?: { limit?: number; offset?: number }) => data ?? {})
	.handler(async ({ data }) => {
		const db = getDrizzleDB();
		return getRecentTracks(db, data.limit ?? 20, data.offset ?? 0);
	});

// get single track by id
export const fetchTrack = createServerFn({ method: "GET" })
	.validator((trackId: string) => trackId)
	.handler(async ({ data: trackId }) => {
		const db = getDrizzleDB();
		const track = await getTrackById(db, trackId);
		if (!track) {
			throw new Error("Track not found");
		}
		return track;
	});

// get track versions
export const fetchTrackVersions = createServerFn({ method: "GET" })
	.validator((trackId: string) => trackId)
	.handler(async ({ data: trackId }) => {
		const db = getDrizzleDB();
		return getTrackVersions(db, trackId);
	});

// create new track (uploader+ only)
export const createNewTrack = createServerFn({ method: "POST" })
	.validator((data: { title: string; description?: string }) => data)
	.handler(async ({ data }) => {
		const session = await getSession();
		const db = getDrizzleDB();

		// create auth context for authorization checks
		const context = session
			? { userId: session.user.id, role: session.role }
			: null;

		return createTrack(
			db,
			session.user.id,
			data.title,
			data.description,
			context,
		);
	});

// upload new version of a track
export const uploadTrackVersion = createServerFn({ method: "POST" })
	.validator(
		(data: { trackId: string; filename: string; contentType: string }) => data,
	)
	.handler(async ({ data }) => {
		const session = await getSession();
		const db = getDrizzleDB();

		// create auth context for authorization checks
		const context = session
			? { userId: session.user.id, role: session.role }
			: null;

		// create version record (authorization checked inside createTrackVersion)
		const versionId = generateId();
		const originalKey = `originals/${data.trackId}/${versionId}/${data.filename}`;

		const version = await createTrackVersion(
			db,
			data.trackId,
			originalKey,
			context,
		);

		// generate presigned url for direct upload to r2
		// for now, return the key - actual upload will happen client-side
		return {
			version,
			uploadKey: originalKey,
			// client will upload to this key via api route
		};
	});

// delete track version
export const deleteTrackVersion = createServerFn({ method: "POST" })
	.validator((versionId: string) => versionId)
	.handler(async ({ data: versionId }) => {
		const session = await getSession();
		const db = getDrizzleDB();
		const r2 = getR2();

		// get version by id
		const versions = await db
			.select()
			.from(schema.trackVersion)
			.where(eq(schema.trackVersion.id, versionId))
			.limit(1);

		const version = versions[0];
		if (!version) {
			throw new Error("Version not found");
		}

		// get track to check ownership
		const track = await getTrackById(db, version.trackId);
		if (!track) {
			throw new Error("Track not found");
		}

		// create auth context for authorization checks
		const context = session
			? { userId: session.user.id, role: session.role }
			: null;

		// authorization check
		if (
			!context ||
			(track.uploader_id !== context.userId && context.role !== "admin")
		) {
			throw new Error("You can only delete your own versions");
		}

		// delete files from r2
		const keysToDelete: string[] = [version.originalKey];
		if (version.playbackKey) keysToDelete.push(version.playbackKey);
		if (version.waveformKey) keysToDelete.push(version.waveformKey);

		await r2.delete(keysToDelete);

		// delete from database using Drizzle
		await db
			.delete(schema.trackVersion)
			.where(eq(schema.trackVersion.id, versionId));

		return { deleted: true };
	});

// queue audio processing after upload complete
export const queueAudioProcessing = createServerFn({ method: "POST" })
	.validator((data: { trackId: string; versionId: string }) => data)
	.handler(async ({ data }) => {
		const session = await getSession();
		if (!session?.user) {
			throw new Error("Unauthorized");
		}

		const db = getDrizzleDB();
		const queue = getAudioQueue();

		// get version details
		const versions = await getTrackVersions(db, data.trackId);
		const version = versions.find((v) => v.id === data.versionId);

		if (!version) {
			throw new Error("Version not found");
		}

		// send to processing queue
		await queue.send({
			type: "process_audio",
			trackId: data.trackId,
			versionId: data.versionId,
			originalKey: version.original_key,
			targetPlaybackKey: `playback/${data.trackId}/${data.versionId}/audio.mp3`,
			targetWaveformKey: `waveforms/${data.trackId}/${data.versionId}/peaks.json`,
		});

		return { queued: true };
	});

// record a play
export const recordTrackPlay = createServerFn({ method: "POST" })
	.validator((data: { trackVersionId: string; sessionId?: string }) => data)
	.handler(async ({ data }) => {
		const session = await getSession();
		const db = getDrizzleDB();

		await recordPlay(
			db,
			data.trackVersionId,
			data.sessionId,
			session?.user?.id,
		);

		return { recorded: true };
	});

// get play count for a version
export const fetchPlayCount = createServerFn({ method: "GET" })
	.validator((trackVersionId: string) => trackVersionId)
	.handler(async ({ data: trackVersionId }) => {
		const db = getDrizzleDB();
		return getPlayCount(db, trackVersionId);
	});

// delete track (owner or admin only)
export const removeTrack = createServerFn({ method: "POST" })
	.validator((trackId: string) => trackId)
	.handler(async ({ data: trackId }) => {
		const session = await getSession();
		const db = getDrizzleDB();
		const r2 = getR2();

		// create auth context for authorization checks
		const context = session
			? { userId: session.user.id, role: session.role }
			: null;

		const track = await getTrackById(db, trackId);
		if (!track) {
			throw new Error("Track not found");
		}

		// delete all versions' files from r2
		const versions = await getTrackVersions(db, trackId);
		const keysToDelete: string[] = [];

		for (const version of versions) {
			keysToDelete.push(version.original_key);
			if (version.playback_key) keysToDelete.push(version.playback_key);
			if (version.waveform_key) keysToDelete.push(version.waveform_key);
		}

		if (track.cover_key) {
			keysToDelete.push(track.cover_key);
		}

		// delete from r2
		if (keysToDelete.length > 0) {
			await r2.delete(keysToDelete);
		}

		// delete from database (authorization checked inside deleteTrack)
		await deleteTrack(db, trackId, context);

		return { deleted: true };
	});

// update track settings (downloadable, social prompt)
export const updateTrackSettings = createServerFn({ method: "POST" })
	.validator(
		(data: {
			trackId: string;
			isDownloadable?: boolean;
			socialPrompt?: {
				instagram?: string;
				soundcloud?: string;
				tiktok?: string;
			};
		}) => data,
	)
	.handler(async ({ data }) => {
		const session = await getSession();
		const db = getDrizzleDB();

		// create auth context for authorization checks
		const context = session
			? { userId: session.user.id, role: session.role }
			: null;

		const track = await getTrackById(db, data.trackId);
		if (!track) {
			throw new Error("Track not found");
		}

		// authorization check
		if (
			!context ||
			(track.uploader_id !== context.userId && context.role !== "admin")
		) {
			throw new Error("You can only update your own tracks");
		}

		// build update using Drizzle
		const updates: Record<string, any> = {};

		if (data.isDownloadable !== undefined) {
			updates.isDownloadable = data.isDownloadable;
		}

		if (data.socialPrompt !== undefined) {
			updates.socialPrompt = JSON.stringify(data.socialPrompt);
		}

		if (Object.keys(updates).length === 0) {
			return track;
		}

		updates.updatedAt = sql`datetime('now')`;

		await db
			.update(schema.track)
			.set(updates)
			.where(eq(schema.track.id, data.trackId));

		return getTrackById(db, data.trackId);
	});
