// database schema for laptou sound
// uses drizzle orm with cloudflare d1 (sqlite)

import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { session, user } from "./auth-schema.gen";

export { user, session };
export { account, verification } from "./auth-schema.gen";

export const tracks = sqliteTable(
	"tracks",
	{
		id: text("id").primaryKey(),
		ownerId: text("owner_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		title: text("title").notNull(),
		description: text("description"),
		isPublic: integer("is_public", { mode: "boolean" }).notNull().default(true),
		allowDownload: integer("allow_download", { mode: "boolean" })
			.notNull()
			.default(false),
		socialPromptEnabled: integer("social_prompt_enabled", { mode: "boolean" })
			.notNull()
			.default(false),
		// json string: { instagram?: string, soundcloud?: string, tiktok?: string }
		socialLinks: text("social_links"),
		createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
		updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
	},
	(table) => [
		index("tracks_owner_idx").on(table.ownerId),
		index("tracks_created_idx").on(table.createdAt),
	],
);

export const trackVersions = sqliteTable(
	"track_versions",
	{
		id: text("id").primaryKey(),
		trackId: text("track_id")
			.notNull()
			.references(() => tracks.id, { onDelete: "cascade" }),
		versionNumber: integer("version_number").notNull(),
		// r2 keys for stored files
		originalKey: text("original_key").notNull(),
		streamKey: text("stream_key"), // 128kbps mp3
		waveformKey: text("waveform_key"), // json waveform data
		processingStatus: text("processing_status", {
			enum: ["pending", "processing", "complete", "failed"],
		})
			.notNull()
			.default("pending"),
		duration: integer("duration"), // seconds
		createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
	},
	(table) => [
		index("track_versions_track_idx").on(table.trackId),
		index("track_versions_status_idx").on(table.processingStatus),
	],
);

export const plays = sqliteTable(
	"plays",
	{
		id: text("id").primaryKey(),
		trackId: text("track_id")
			.notNull()
			.references(() => tracks.id, { onDelete: "cascade" }),
		versionId: text("version_id").references(() => trackVersions.id, {
			onDelete: "set null",
		}),
		userId: text("user_id").references(() => user.id, {
			onDelete: "set null",
		}),
		ipHash: text("ip_hash"), // hashed ip for anonymous tracking
		playedAt: integer("played_at", { mode: "timestamp" }).notNull(),
	},
	(table) => [
		index("plays_track_idx").on(table.trackId),
		index("plays_user_idx").on(table.userId),
		index("plays_played_at_idx").on(table.playedAt),
	],
);

export const comments = sqliteTable(
	"comments",
	{
		id: text("id").primaryKey(),
		trackId: text("track_id")
			.notNull()
			.references(() => tracks.id, { onDelete: "cascade" }),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		content: text("content").notNull(),
		createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
	},
	(table) => [
		index("comments_track_idx").on(table.trackId),
		index("comments_user_idx").on(table.userId),
	],
);

export const inviteCodes = sqliteTable(
	"invite_codes",
	{
		id: text("id").primaryKey(),
		code: text("code").notNull().unique(),
		createdBy: text("created_by")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		// role to assign when code is used
		role: text("role", { enum: ["commenter", "uploader", "admin"] }).notNull(),
		usedBy: text("used_by").references(() => user.id, {
			onDelete: "set null",
		}),
		createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
		usedAt: integer("used_at", { mode: "timestamp" }),
	},
	(table) => [
		index("invite_codes_code_idx").on(table.code),
		index("invite_codes_created_by_idx").on(table.createdBy),
	],
);

// type exports for convenience
export type User = typeof user.$inferSelect;
export type NewUser = typeof user.$inferInsert;
export type Session = typeof session.$inferSelect;
export type Track = typeof tracks.$inferSelect;
export type NewTrack = typeof tracks.$inferInsert;
export type TrackVersion = typeof trackVersions.$inferSelect;
export type NewTrackVersion = typeof trackVersions.$inferInsert;
export type Play = typeof plays.$inferSelect;
export type Comment = typeof comments.$inferSelect;
export type InviteCode = typeof inviteCodes.$inferSelect;
export type NewInviteCode = typeof inviteCodes.$inferInsert;
export type UserRole = "commenter" | "uploader" | "admin";
