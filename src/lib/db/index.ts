// database utilities and query helpers using drizzle orm
// all db access methods include authorization checks
import { eq, and, sql, desc, isNull, gt, max } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import * as schema from "./schema";
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

// authorization context for db operations
export interface AuthContext {
  userId?: string;
  role?: UserRole;
}

// check if user has required role
function requireRole(context: AuthContext | null, allowedRoles: UserRole[]): void {
  if (!context?.userId || !context.role) {
    throw new Error("Unauthorized: Authentication required");
  }
  if (!allowedRoles.includes(context.role)) {
    throw new Error(`Forbidden: Requires one of: ${allowedRoles.join(", ")}`);
  }
}

// check if user owns resource or is admin
function requireOwnershipOrAdmin(
  context: AuthContext | null,
  ownerId: string
): void {
  if (!context?.userId) {
    throw new Error("Unauthorized: Authentication required");
  }
  if (context.userId !== ownerId && context.role !== "admin") {
    throw new Error("Forbidden: You can only access your own resources");
  }
}

// user role queries
export async function getUserRole(
  db: DrizzleD1Database<typeof schema>,
  userId: string
): Promise<UserRole> {
  const result = await db
    .select({ role: schema.userRole.role })
    .from(schema.userRole)
    .where(eq(schema.userRole.userId, userId))
    .limit(1);

  return (result[0]?.role as UserRole) ?? "commenter";
}

export async function setUserRole(
  db: DrizzleD1Database<typeof schema>,
  userId: string,
  role: UserRole,
  context: AuthContext | null
): Promise<void> {
  // only admins can set roles
  requireRole(context, ["admin"]);

  const id = generateId();
  await db
    .insert(schema.userRole)
    .values({
      id,
      userId,
      role,
      updatedAt: sql`datetime('now')`,
    })
    .onConflictDoUpdate({
      target: schema.userRole.userId,
      set: {
        role,
        updatedAt: sql`datetime('now')`,
      },
    });
}

// invite code queries
export async function createInviteCode(
  db: DrizzleD1Database<typeof schema>,
  createdBy: string,
  role: "uploader" | "admin",
  expiresAt: string | undefined,
  context: AuthContext | null
): Promise<InviteCode> {
  // only admins can create invite codes
  requireRole(context, ["admin"]);

  const id = generateId();
  const code = generateInviteCode();

  await db.insert(schema.inviteCode).values({
    id,
    code,
    role,
    createdBy,
    expiresAt: expiresAt ?? null,
  });

  const result = await db
    .select()
    .from(schema.inviteCode)
    .where(eq(schema.inviteCode.id, id))
    .limit(1);

  return mapInviteCode(result[0]!);
}

export async function useInviteCode(
  db: DrizzleD1Database<typeof schema>,
  code: string,
  userId: string
): Promise<InviteCode | null> {
  // find valid unused code
  const invites = await db
    .select()
    .from(schema.inviteCode)
    .where(
      and(
        eq(schema.inviteCode.code, code),
        isNull(schema.inviteCode.usedBy),
        sql`(${schema.inviteCode.expiresAt} IS NULL OR ${schema.inviteCode.expiresAt} > datetime('now'))`
      )
    )
    .limit(1);

  const invite = invites[0];
  if (!invite) return null;

  // mark as used and set user role
  await db.transaction(async (tx) => {
    await tx
      .update(schema.inviteCode)
      .set({
        usedBy: userId,
        usedAt: sql`datetime('now')`,
      })
      .where(eq(schema.inviteCode.id, invite.id));

    const roleId = generateId();
    await tx
      .insert(schema.userRole)
      .values({
        id: roleId,
        userId,
        role: invite.role,
        updatedAt: sql`datetime('now')`,
      })
      .onConflictDoUpdate({
        target: schema.userRole.userId,
        set: {
          role: invite.role,
          updatedAt: sql`datetime('now')`,
        },
      });
  });

  return mapInviteCode(invite);
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
  db: DrizzleD1Database<typeof schema>,
  limit = 20,
  offset = 0
): Promise<TrackWithLatestVersion[]> {
  // public read access - no auth required
  // get tracks first, then get latest versions separately
  const tracks = await db
    .select()
    .from(schema.track)
    .orderBy(desc(schema.track.createdAt))
    .limit(limit)
    .offset(offset);

  // get latest versions for each track
  const trackIds = tracks.map((t) => t.id);
  if (trackIds.length === 0) return [];

  const latestVersions = await db
    .select({
      trackId: schema.trackVersion.trackId,
      id: schema.trackVersion.id,
      playbackKey: schema.trackVersion.playbackKey,
      waveformKey: schema.trackVersion.waveformKey,
      duration: schema.trackVersion.duration,
      processingStatus: schema.trackVersion.processingStatus,
    })
    .from(schema.trackVersion)
    .where(
      sql`${schema.trackVersion.trackId} IN (${sql.join(trackIds.map((id) => sql`${id}`), sql`, `)}) AND ${schema.trackVersion.versionNumber} = (
        SELECT MAX(version_number) FROM track_version WHERE track_id = ${schema.trackVersion.trackId}
      )`
    );

  // create map for quick lookup
  const versionMap = new Map(
    latestVersions.map((v) => [v.trackId, v])
  );

  return tracks.map((t) => {
    const version = versionMap.get(t.id);
    return {
      id: t.id,
      uploader_id: t.uploaderId,
      title: t.title,
      description: t.description ?? null,
      cover_key: t.coverKey ?? null,
      is_downloadable: t.isDownloadable ? 1 : 0,
      social_prompt: t.socialPrompt ?? null,
      created_at: t.createdAt,
      latest_version_id: version?.id ?? null,
      playback_key: version?.playbackKey ?? null,
      waveform_key: version?.waveformKey ?? null,
      duration: version?.duration ?? null,
      processing_status: (version?.processingStatus ?? null) as
        | "pending"
        | "processing"
        | "complete"
        | "failed"
        | null,
    };
  });
}

export async function getTrackById(
  db: DrizzleD1Database<typeof schema>,
  trackId: string
): Promise<TrackWithLatestVersion | null> {
  // public read access - no auth required
  const tracks = await db
    .select()
    .from(schema.track)
    .where(eq(schema.track.id, trackId))
    .limit(1);

  const track = tracks[0];
  if (!track) return null;

  // get latest version
  const latestVersions = await db
    .select()
    .from(schema.trackVersion)
    .where(
      sql`${schema.trackVersion.trackId} = ${trackId} AND ${schema.trackVersion.versionNumber} = (
        SELECT MAX(version_number) FROM track_version WHERE track_id = ${trackId}
      )`
    )
    .limit(1);

  const version = latestVersions[0];

  return {
    id: track.id,
    uploader_id: track.uploaderId,
    title: track.title,
    description: track.description ?? null,
    cover_key: track.coverKey ?? null,
    is_downloadable: track.isDownloadable ? 1 : 0,
    social_prompt: track.socialPrompt ?? null,
    created_at: track.createdAt,
    latest_version_id: version?.id ?? null,
    playback_key: version?.playbackKey ?? null,
    waveform_key: version?.waveformKey ?? null,
    duration: version?.duration ?? null,
    processing_status: (version?.processingStatus ?? null) as
      | "pending"
      | "processing"
      | "complete"
      | "failed"
      | null,
  };
}

export async function createTrack(
  db: DrizzleD1Database<typeof schema>,
  uploaderId: string,
  title: string,
  description: string | undefined,
  context: AuthContext | null
): Promise<Track> {
  // only uploaders and admins can create tracks
  requireRole(context, ["uploader", "admin"]);
  // user must be the uploader
  if (context.userId !== uploaderId) {
    throw new Error("Forbidden: You can only create tracks for yourself");
  }

  const id = generateId();

  await db.insert(schema.track).values({
    id,
    uploaderId,
    title,
    description: description ?? null,
  });

  const result = await db
    .select()
    .from(schema.track)
    .where(eq(schema.track.id, id))
    .limit(1);

  return mapTrack(result[0]!);
}

export async function deleteTrack(
  db: DrizzleD1Database<typeof schema>,
  trackId: string,
  context: AuthContext | null
): Promise<void> {
  // check ownership first
  const track = await getTrackById(db, trackId);
  if (!track) {
    throw new Error("Track not found");
  }
  requireOwnershipOrAdmin(context, track.uploader_id);

  await db.delete(schema.track).where(eq(schema.track.id, trackId));
}

// track version queries
export async function getTrackVersions(
  db: DrizzleD1Database<typeof schema>,
  trackId: string
): Promise<TrackVersion[]> {
  // public read access - no auth required
  const versions = await db
    .select()
    .from(schema.trackVersion)
    .where(eq(schema.trackVersion.trackId, trackId))
    .orderBy(desc(schema.trackVersion.versionNumber));

  return versions.map(mapTrackVersion);
}

export async function createTrackVersion(
  db: DrizzleD1Database<typeof schema>,
  trackId: string,
  originalKey: string,
  context: AuthContext | null
): Promise<TrackVersion> {
  // check track ownership
  const track = await getTrackById(db, trackId);
  if (!track) {
    throw new Error("Track not found");
  }
  requireOwnershipOrAdmin(context, track.uploader_id);

  const id = generateId();

  // get next version number
  const latest = await db
    .select({ maxVersion: max(schema.trackVersion.versionNumber) })
    .from(schema.trackVersion)
    .where(eq(schema.trackVersion.trackId, trackId))
    .limit(1);

  const versionNumber = (latest[0]?.maxVersion ?? 0) + 1;

  await db.insert(schema.trackVersion).values({
    id,
    trackId,
    versionNumber,
    originalKey,
    processingStatus: "pending",
  });

  const result = await db
    .select()
    .from(schema.trackVersion)
    .where(eq(schema.trackVersion.id, id))
    .limit(1);

  return mapTrackVersion(result[0]!);
}

export async function updateTrackVersionStatus(
  db: DrizzleD1Database<typeof schema>,
  versionId: string,
  status: "pending" | "processing" | "complete" | "failed",
  playbackKey: string | undefined,
  waveformKey: string | undefined,
  duration: number | undefined
): Promise<void> {
  // system operation - no auth required (called by worker)
  await db
    .update(schema.trackVersion)
    .set({
      processingStatus: status,
      playbackKey: playbackKey ?? null,
      waveformKey: waveformKey ?? null,
      duration: duration ?? null,
    })
    .where(eq(schema.trackVersion.id, versionId));
}

// play count queries
export async function recordPlay(
  db: DrizzleD1Database<typeof schema>,
  trackVersionId: string,
  sessionId: string | undefined,
  userId: string | undefined
): Promise<void> {
  // public write access - no auth required
  const id = generateId();
  await db.insert(schema.playCount).values({
    id,
    trackVersionId,
    sessionId: sessionId ?? null,
    userId: userId ?? null,
  });
}

export async function getPlayCount(
  db: DrizzleD1Database<typeof schema>,
  trackVersionId: string
): Promise<number> {
  // public read access - no auth required
  const results = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(schema.playCount)
    .where(eq(schema.playCount.trackVersionId, trackVersionId));

  return Number(results[0]?.count ?? 0);
}

// comment queries
export async function getTrackComments(
  db: DrizzleD1Database<typeof schema>,
  trackId: string
): Promise<CommentWithUser[]> {
  // public read access - no auth required
  const comments = await db
    .select({
      id: schema.comment.id,
      track_id: schema.comment.trackId,
      user_id: schema.comment.userId,
      content: schema.comment.content,
      timestamp_seconds: schema.comment.timestampSeconds,
      created_at: schema.comment.createdAt,
      updated_at: schema.comment.updatedAt,
      user_name: schema.user.name,
      user_image: schema.user.image,
    })
    .from(schema.comment)
    .innerJoin(schema.user, eq(schema.user.id, schema.comment.userId))
    .where(eq(schema.comment.trackId, trackId))
    .orderBy(desc(schema.comment.createdAt));

  return comments.map((c) => ({
    id: c.id,
    track_id: c.track_id,
    user_id: c.user_id,
    content: c.content,
    timestamp_seconds: c.timestamp_seconds ?? null,
    created_at: c.created_at,
    updated_at: c.updated_at,
    user_name: c.user_name ?? null,
    user_image: c.user_image ?? null,
  }));
}

export async function createComment(
  db: DrizzleD1Database<typeof schema>,
  trackId: string,
  userId: string,
  content: string,
  timestampSeconds: number | undefined,
  context: AuthContext | null
): Promise<Comment> {
  // any authenticated user can comment
  if (!context?.userId || context.userId !== userId) {
    throw new Error("Unauthorized: Must be logged in to comment");
  }

  const id = generateId();

  await db.insert(schema.comment).values({
    id,
    trackId,
    userId,
    content,
    timestampSeconds: timestampSeconds ?? null,
  });

  const result = await db
    .select()
    .from(schema.comment)
    .where(eq(schema.comment.id, id))
    .limit(1);

  return mapComment(result[0]!);
}

export async function deleteComment(
  db: DrizzleD1Database<typeof schema>,
  commentId: string,
  context: AuthContext | null
): Promise<void> {
  // get comment to check ownership
  const comments = await db
    .select()
    .from(schema.comment)
    .where(eq(schema.comment.id, commentId))
    .limit(1);

  const comment = comments[0];
  if (!comment) {
    throw new Error("Comment not found");
  }

  requireOwnershipOrAdmin(context, comment.userId);

  await db.delete(schema.comment).where(eq(schema.comment.id, commentId));
}

// mapping helpers to convert drizzle records to app types
function mapTrack(record: schema.TrackRecord): Track {
  return {
    id: record.id,
    uploader_id: record.uploaderId,
    title: record.title,
    description: record.description ?? null,
    cover_key: record.coverKey ?? null,
    is_downloadable: record.isDownloadable ? 1 : 0,
    social_prompt: record.socialPrompt ?? null,
    created_at: record.createdAt,
    updated_at: record.updatedAt,
  };
}

function mapTrackVersion(record: schema.TrackVersionRecord): TrackVersion {
  return {
    id: record.id,
    track_id: record.trackId,
    version_number: record.versionNumber,
    original_key: record.originalKey,
    playback_key: record.playbackKey ?? null,
    waveform_key: record.waveformKey ?? null,
    duration: record.duration ?? null,
    processing_status: record.processingStatus,
    created_at: record.createdAt,
  };
}

function mapComment(record: schema.CommentRecord): Comment {
  return {
    id: record.id,
    track_id: record.trackId,
    user_id: record.userId,
    content: record.content,
    timestamp_seconds: record.timestampSeconds ?? null,
    created_at: record.createdAt,
    updated_at: record.updatedAt,
  };
}

function mapInviteCode(record: schema.InviteCodeRecord): InviteCode {
  return {
    id: record.id,
    code: record.code,
    role: record.role,
    created_by: record.createdBy,
    used_by: record.usedBy ?? null,
    used_at: record.usedAt ?? null,
    expires_at: record.expiresAt ?? null,
    created_at: record.createdAt,
  };
}
