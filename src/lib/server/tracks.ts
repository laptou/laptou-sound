// server functions for track operations
import { createServerFn } from "@tanstack/solid-start/server";
import { getDB, getR2, getAudioQueue } from "./context";
import { getSession } from "./auth";
import {
  getRecentTracks,
  getTrackById,
  createTrack,
  deleteTrack,
  getTrackVersions,
  createTrackVersion,
  recordPlay,
  getPlayCount,
  generateId,
} from "../db";
import type { Track, TrackVersion, TrackWithLatestVersion } from "../db/types";

// get recent tracks for home page
export const fetchRecentTracks = createServerFn({ method: "GET" })
  .validator((data?: { limit?: number; offset?: number }) => data ?? {})
  .handler(async ({ data }) => {
    const db = getDB();
    return getRecentTracks(db, data.limit ?? 20, data.offset ?? 0);
  });

// get single track by id
export const fetchTrack = createServerFn({ method: "GET" })
  .validator((trackId: string) => trackId)
  .handler(async ({ data: trackId }) => {
    const db = getDB();
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
    const db = getDB();
    return getTrackVersions(db, trackId);
  });

// create new track (uploader+ only)
export const createNewTrack = createServerFn({ method: "POST" })
  .validator((data: { title: string; description?: string }) => data)
  .handler(async ({ data }) => {
    const session = await getSession();
    if (!session?.user) {
      throw new Error("Unauthorized");
    }

    if (session.role !== "uploader" && session.role !== "admin") {
      throw new Error("Only uploaders can create tracks");
    }

    const db = getDB();
    return createTrack(db, session.user.id, data.title, data.description);
  });

// upload new version of a track
export const uploadTrackVersion = createServerFn({ method: "POST" })
  .validator(
    (data: { trackId: string; filename: string; contentType: string }) => data
  )
  .handler(async ({ data }) => {
    const session = await getSession();
    if (!session?.user) {
      throw new Error("Unauthorized");
    }

    const db = getDB();

    // verify ownership
    const track = await getTrackById(db, data.trackId);
    if (!track) {
      throw new Error("Track not found");
    }

    if (track.uploader_id !== session.user.id && session.role !== "admin") {
      throw new Error("You can only upload versions to your own tracks");
    }

    // create version record
    const versionId = generateId();
    const originalKey = `originals/${data.trackId}/${versionId}/${data.filename}`;

    const version = await createTrackVersion(db, data.trackId, originalKey);

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
    if (!session?.user) {
      throw new Error("Unauthorized");
    }

    const db = getDB();
    const r2 = getR2();

    // get version
    const version = await db
      .prepare(`SELECT * FROM track_version WHERE id = ?`)
      .bind(versionId)
      .first<TrackVersion>();

    if (!version) {
      throw new Error("Version not found");
    }

    // get track to check ownership
    const track = await getTrackById(db, version.track_id);
    if (!track) {
      throw new Error("Track not found");
    }

    if (track.uploader_id !== session.user.id && session.role !== "admin") {
      throw new Error("You can only delete your own versions");
    }

    // delete files from r2
    const keysToDelete: string[] = [version.original_key];
    if (version.playback_key) keysToDelete.push(version.playback_key);
    if (version.waveform_key) keysToDelete.push(version.waveform_key);

    await r2.delete(keysToDelete);

    // delete from database
    await db
      .prepare(`DELETE FROM track_version WHERE id = ?`)
      .bind(versionId)
      .run();

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

    const db = getDB();
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
  .validator(
    (data: { trackVersionId: string; sessionId?: string }) => data
  )
  .handler(async ({ data }) => {
    const session = await getSession();
    const db = getDB();

    await recordPlay(
      db,
      data.trackVersionId,
      data.sessionId,
      session?.user?.id
    );

    return { recorded: true };
  });

// get play count for a version
export const fetchPlayCount = createServerFn({ method: "GET" })
  .validator((trackVersionId: string) => trackVersionId)
  .handler(async ({ data: trackVersionId }) => {
    const db = getDB();
    return getPlayCount(db, trackVersionId);
  });

// delete track (owner or admin only)
export const removeTrack = createServerFn({ method: "POST" })
  .validator((trackId: string) => trackId)
  .handler(async ({ data: trackId }) => {
    const session = await getSession();
    if (!session?.user) {
      throw new Error("Unauthorized");
    }

    const db = getDB();
    const r2 = getR2();

    const track = await getTrackById(db, trackId);
    if (!track) {
      throw new Error("Track not found");
    }

    // check permission
    if (track.uploader_id !== session.user.id && session.role !== "admin") {
      throw new Error("You can only delete your own tracks");
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

    // delete from database (cascades to versions, comments, plays)
    await deleteTrack(db, trackId);

    return { deleted: true };
  });

// update track settings (downloadable, social prompt)
export const updateTrackSettings = createServerFn({ method: "POST" })
  .validator(
    (data: {
      trackId: string;
      isDownloadable?: boolean;
      socialPrompt?: { instagram?: string; soundcloud?: string; tiktok?: string };
    }) => data
  )
  .handler(async ({ data }) => {
    const session = await getSession();
    if (!session?.user) {
      throw new Error("Unauthorized");
    }

    const db = getDB();

    const track = await getTrackById(db, data.trackId);
    if (!track) {
      throw new Error("Track not found");
    }

    if (track.uploader_id !== session.user.id && session.role !== "admin") {
      throw new Error("You can only update your own tracks");
    }

    // build update query
    const updates: string[] = [];
    const values: any[] = [];

    if (data.isDownloadable !== undefined) {
      updates.push("is_downloadable = ?");
      values.push(data.isDownloadable ? 1 : 0);
    }

    if (data.socialPrompt !== undefined) {
      updates.push("social_prompt = ?");
      values.push(JSON.stringify(data.socialPrompt));
    }

    if (updates.length === 0) {
      return track;
    }

    updates.push("updated_at = datetime('now')");
    values.push(data.trackId);

    await db
      .prepare(`UPDATE track SET ${updates.join(", ")} WHERE id = ?`)
      .bind(...values)
      .run();

    return getTrackById(db, data.trackId);
  });
