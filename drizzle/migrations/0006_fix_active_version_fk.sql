-- fix tracks.active_version foreign key to include ON DELETE SET NULL
-- sqlite requires recreating the table to modify constraints
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_tracks` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`is_public` integer DEFAULT true NOT NULL,
	`allow_download` integer DEFAULT false NOT NULL,
	`social_prompt_enabled` integer DEFAULT false NOT NULL,
	`social_links` text,
	`active_version` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`active_version`) REFERENCES `track_versions`(`id`) ON UPDATE no action ON DELETE set null
);--> statement-breakpoint
INSERT INTO `__new_tracks`("id", "owner_id", "title", "description", "is_public", "allow_download", "social_prompt_enabled", "social_links", "active_version", "created_at", "updated_at") SELECT "id", "owner_id", "title", "description", "is_public", "allow_download", "social_prompt_enabled", "social_links", "active_version", "created_at", "updated_at" FROM `tracks`;--> statement-breakpoint
DROP TABLE `tracks`;--> statement-breakpoint
ALTER TABLE `__new_tracks` RENAME TO `tracks`;--> statement-breakpoint
CREATE INDEX `tracks_owner_idx` ON `tracks` (`owner_id`);--> statement-breakpoint
CREATE INDEX `tracks_created_idx` ON `tracks` (`created_at`);--> statement-breakpoint
PRAGMA foreign_keys=ON;

