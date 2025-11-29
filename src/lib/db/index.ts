// database utilities and query helpers
import type { D1Database } from "@cloudflare/workers-types";
import type {
  Track,
  TrackVersion,
  TrackWithLatestVersion,
  UserRole,
  UserRoleRecord,
  InviteCode,
  Comment,
  CommentWithUser,
  PlayCount,
} from "./types";

// generate a unique id
export function generateId(): string {
  return crypto.randomUUID();
}

// user role queries
export async function getUserRole(
  db: D1Database,
  userId: string
): Promise<UserRole> {
  const result = await db
    .prepare(`SELECT role FROM user_role WHERE user_id = ?`)
    .bind(userId)
    .first<{ role: UserRole }>();

  return result?.role ?? "commenter";
}

export async function setUserRole(
  db: D1Database,
  userId: string,
  role: UserRole
): Promise<void> {
  const id = generateId();
  await db
    .prepare(
      `INSERT INTO user_role (id, user_id, role) VALUES (?, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET role = ?, updated_at = datetime('now')`
    )
    .bind(id, userId, role, role)
    .run();
}

// invite code queries
export async function createInviteCode(
  db: D1Database,
  createdBy: string,
  role: "uploader" | "admin",
  expiresAt?: string
): Promise<InviteCode> {
  const id = generateId();
  const code = generateInviteCode();

  await db
    .prepare(
      `INSERT INTO invite_code (id, code, role, created_by, expires_at) VALUES (?, ?, ?, ?, ?)`
    )
    .bind(id, code, role, createdBy, expiresAt ?? null)
    .run();

  const result = await db
    .prepare(`SELECT * FROM invite_code WHERE id = ?`)
    .bind(id)
    .first<InviteCode>();

  return result!;
}

export async function useInviteCode(
  db: D1Database,
  code: string,
  userId: string
): Promise<InviteCode | null> {
  // find valid unused code
  const invite = await db
    .prepare(
      `SELECT * FROM invite_code 
       WHERE code = ? 
       AND used_by IS NULL 
       AND (expires_at IS NULL OR expires_at > datetime('now'))`
    )
    .bind(code)
    .first<InviteCode>();

  if (!invite) return null;

  // mark as used and set user role
  await db.batch([
    db
      .prepare(
        `UPDATE invite_code SET used_by = ?, used_at = datetime('now') WHERE id = ?`
      )
      .bind(userId, invite.id),
    db
      .prepare(
        `INSERT INTO user_role (id, user_id, role) VALUES (?, ?, ?)
         ON CONFLICT(user_id) DO UPDATE SET role = ?, updated_at = datetime('now')`
      )
      .bind(generateId(), userId, invite.role, invite.role),
  ]);

  return invite;
}

function generateInviteCode(): string {
  // generate 8 character alphanumeric code
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no confusing chars
  let code = "";
  for (let i = 0; i < 8; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

// track queries
export async function getRecentTracks(
  db: D1Database,
  limit = 20,
  offset = 0
): Promise<TrackWithLatestVersion[]> {
  const { results } = await db
    .prepare(
      `SELECT 
        t.*,
        tv.id as latest_version_id,
        tv.playback_key,
        tv.waveform_key,
        tv.duration,
        tv.processing_status
       FROM track t
       LEFT JOIN track_version tv ON tv.track_id = t.id
       AND tv.version_number = (
         SELECT MAX(version_number) FROM track_version WHERE track_id = t.id
       )
       ORDER BY t.created_at DESC
       LIMIT ? OFFSET ?`
    )
    .bind(limit, offset)
    .all<TrackWithLatestVersion>();

  return results;
}

export async function getTrackById(
  db: D1Database,
  trackId: string
): Promise<TrackWithLatestVersion | null> {
  const result = await db
    .prepare(
      `SELECT 
        t.*,
        tv.id as latest_version_id,
        tv.playback_key,
        tv.waveform_key,
        tv.duration,
        tv.processing_status
       FROM track t
       LEFT JOIN track_version tv ON tv.track_id = t.id
       AND tv.version_number = (
         SELECT MAX(version_number) FROM track_version WHERE track_id = t.id
       )
       WHERE t.id = ?`
    )
    .bind(trackId)
    .first<TrackWithLatestVersion>();

  return result;
}

export async function createTrack(
  db: D1Database,
  uploaderId: string,
  title: string,
  description?: string
): Promise<Track> {
  const id = generateId();

  await db
    .prepare(
      `INSERT INTO track (id, uploader_id, title, description) VALUES (?, ?, ?, ?)`
    )
    .bind(id, uploaderId, title, description ?? null)
    .run();

  const result = await db
    .prepare(`SELECT * FROM track WHERE id = ?`)
    .bind(id)
    .first<Track>();

  return result!;
}

export async function deleteTrack(
  db: D1Database,
  trackId: string
): Promise<void> {
  await db.prepare(`DELETE FROM track WHERE id = ?`).bind(trackId).run();
}

// track version queries
export async function getTrackVersions(
  db: D1Database,
  trackId: string
): Promise<TrackVersion[]> {
  const { results } = await db
    .prepare(
      `SELECT * FROM track_version WHERE track_id = ? ORDER BY version_number DESC`
    )
    .bind(trackId)
    .all<TrackVersion>();

  return results;
}

export async function createTrackVersion(
  db: D1Database,
  trackId: string,
  originalKey: string
): Promise<TrackVersion> {
  const id = generateId();

  // get next version number
  const latest = await db
    .prepare(
      `SELECT MAX(version_number) as max_version FROM track_version WHERE track_id = ?`
    )
    .bind(trackId)
    .first<{ max_version: number | null }>();

  const versionNumber = (latest?.max_version ?? 0) + 1;

  await db
    .prepare(
      `INSERT INTO track_version (id, track_id, version_number, original_key, processing_status) 
       VALUES (?, ?, ?, ?, 'pending')`
    )
    .bind(id, trackId, versionNumber, originalKey)
    .run();

  const result = await db
    .prepare(`SELECT * FROM track_version WHERE id = ?`)
    .bind(id)
    .first<TrackVersion>();

  return result!;
}

export async function updateTrackVersionStatus(
  db: D1Database,
  versionId: string,
  status: string,
  playbackKey?: string,
  waveformKey?: string,
  duration?: number
): Promise<void> {
  await db
    .prepare(
      `UPDATE track_version 
       SET processing_status = ?, playback_key = ?, waveform_key = ?, duration = ?
       WHERE id = ?`
    )
    .bind(
      status,
      playbackKey ?? null,
      waveformKey ?? null,
      duration ?? null,
      versionId
    )
    .run();
}

// play count queries
export async function recordPlay(
  db: D1Database,
  trackVersionId: string,
  sessionId?: string,
  userId?: string
): Promise<void> {
  const id = generateId();
  await db
    .prepare(
      `INSERT INTO play_count (id, track_version_id, session_id, user_id) VALUES (?, ?, ?, ?)`
    )
    .bind(id, trackVersionId, sessionId ?? null, userId ?? null)
    .run();
}

export async function getPlayCount(
  db: D1Database,
  trackVersionId: string
): Promise<number> {
  const result = await db
    .prepare(
      `SELECT COUNT(*) as count FROM play_count WHERE track_version_id = ?`
    )
    .bind(trackVersionId)
    .first<{ count: number }>();

  return result?.count ?? 0;
}

// comment queries
export async function getTrackComments(
  db: D1Database,
  trackId: string
): Promise<CommentWithUser[]> {
  const { results } = await db
    .prepare(
      `SELECT c.*, u.name as user_name, u.image as user_image
       FROM comment c
       JOIN user u ON u.id = c.user_id
       WHERE c.track_id = ?
       ORDER BY c.created_at DESC`
    )
    .bind(trackId)
    .all<CommentWithUser>();

  return results;
}

export async function createComment(
  db: D1Database,
  trackId: string,
  userId: string,
  content: string,
  timestampSeconds?: number
): Promise<Comment> {
  const id = generateId();

  await db
    .prepare(
      `INSERT INTO comment (id, track_id, user_id, content, timestamp_seconds) 
       VALUES (?, ?, ?, ?, ?)`
    )
    .bind(id, trackId, userId, content, timestampSeconds ?? null)
    .run();

  const result = await db
    .prepare(`SELECT * FROM comment WHERE id = ?`)
    .bind(id)
    .first<Comment>();

  return result!;
}

export async function deleteComment(
  db: D1Database,
  commentId: string
): Promise<void> {
  await db.prepare(`DELETE FROM comment WHERE id = ?`).bind(commentId).run();
}

