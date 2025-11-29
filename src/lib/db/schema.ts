// drizzle schema for laptou sound
// better auth tables are managed by better-auth, not included here
import { sqliteTable, text, integer, index, uniqueIndex } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

// user roles (commenter, uploader, admin)
export const userRole = sqliteTable(
  "user_role",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
    role: text("role", { enum: ["commenter", "uploader", "admin"] })
      .notNull()
      .default("commenter"),
    createdAt: text("created_at").default(sql`datetime('now')`).notNull(),
    updatedAt: text("updated_at").default(sql`datetime('now')`).notNull(),
  },
  (table) => ({
    userIdIdx: uniqueIndex("user_role_user_id_idx").on(table.userId),
  })
);

// invite codes for uploader/admin registration
export const inviteCode = sqliteTable("invite_code", {
  id: text("id").primaryKey(),
  code: text("code").notNull().unique(),
  role: text("role", { enum: ["uploader", "admin"] }).notNull(),
  createdBy: text("created_by").notNull().references(() => user.id, { onDelete: "cascade" }),
  usedBy: text("used_by").references(() => user.id, { onDelete: "set null" }),
  usedAt: text("used_at"),
  expiresAt: text("expires_at"),
  createdAt: text("created_at").default(sql`datetime('now')`).notNull(),
});

// tracks (audio uploads)
export const track = sqliteTable(
  "track",
  {
    id: text("id").primaryKey(),
    uploaderId: text("uploader_id").notNull().references(() => user.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description"),
    coverKey: text("cover_key"),
    isDownloadable: integer("is_downloadable", { mode: "boolean" }).default(false),
    socialPrompt: text("social_prompt"), // json: { instagram?: string, soundcloud?: string, tiktok?: string }
    createdAt: text("created_at").default(sql`datetime('now')`).notNull(),
    updatedAt: text("updated_at").default(sql`datetime('now')`).notNull(),
  },
  (table) => ({
    uploaderIdx: index("idx_track_uploader").on(table.uploaderId),
    createdIdx: index("idx_track_created").on(table.createdAt),
  })
);

// track versions (multiple versions per track)
export const trackVersion = sqliteTable(
  "track_version",
  {
    id: text("id").primaryKey(),
    trackId: text("track_id").notNull().references(() => track.id, { onDelete: "cascade" }),
    versionNumber: integer("version_number").notNull(),
    originalKey: text("original_key").notNull(),
    playbackKey: text("playback_key"),
    waveformKey: text("waveform_key"),
    duration: integer("duration"), // duration in seconds
    processingStatus: text("processing_status", {
      enum: ["pending", "processing", "complete", "failed"],
    })
      .notNull()
      .default("pending"),
    createdAt: text("created_at").default(sql`datetime('now')`).notNull(),
  },
  (table) => ({
    trackIdx: index("idx_track_version_track").on(table.trackId),
    statusIdx: index("idx_track_version_status").on(table.processingStatus),
    trackVersionUnique: uniqueIndex("track_version_track_version_unique").on(
      table.trackId,
      table.versionNumber
    ),
  })
);

// play counts (individual play events for analytics)
export const playCount = sqliteTable(
  "play_count",
  {
    id: text("id").primaryKey(),
    trackVersionId: text("track_version_id")
      .notNull()
      .references(() => trackVersion.id, { onDelete: "cascade" }),
    sessionId: text("session_id"), // anonymous session identifier
    userId: text("user_id").references(() => user.id, { onDelete: "set null" }), // null if not logged in
    playedAt: text("played_at").default(sql`datetime('now')`).notNull(),
  },
  (table) => ({
    versionIdx: index("idx_play_count_version").on(table.trackVersionId),
    playedIdx: index("idx_play_count_played").on(table.playedAt),
  })
);

// comments on tracks (with optional timestamp)
export const comment = sqliteTable(
  "comment",
  {
    id: text("id").primaryKey(),
    trackId: text("track_id").notNull().references(() => track.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
    content: text("content").notNull(),
    timestampSeconds: integer("timestamp_seconds"), // optional: timestamp in track where comment applies
    createdAt: text("created_at").default(sql`datetime('now')`).notNull(),
    updatedAt: text("updated_at").default(sql`datetime('now')`).notNull(),
  },
  (table) => ({
    trackIdx: index("idx_comment_track").on(table.trackId),
    userIdx: index("idx_comment_user").on(table.userId),
  })
);

// user table reference (managed by better-auth, but we reference it)
// this is a placeholder - better-auth manages the actual table
export const user = sqliteTable("user", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name"),
  emailVerified: integer("email_verified", { mode: "boolean" }).default(false),
  image: text("image"),
  createdAt: text("created_at").default(sql`datetime('now')`).notNull(),
  updatedAt: text("updated_at").default(sql`datetime('now')`).notNull(),
});

// type exports for use in queries
export type UserRoleRecord = typeof userRole.$inferSelect;
export type InviteCodeRecord = typeof inviteCode.$inferSelect;
export type TrackRecord = typeof track.$inferSelect;
export type TrackVersionRecord = typeof trackVersion.$inferSelect;
export type PlayCountRecord = typeof playCount.$inferSelect;
export type CommentRecord = typeof comment.$inferSelect;

