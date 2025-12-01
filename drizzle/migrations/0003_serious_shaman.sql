ALTER TABLE `track_versions` ADD `bitrate` integer;--> statement-breakpoint
ALTER TABLE `track_versions` ADD `sample_rate` integer;--> statement-breakpoint
ALTER TABLE `track_versions` ADD `channels` integer;--> statement-breakpoint
ALTER TABLE `track_versions` ADD `codec` text;--> statement-breakpoint
ALTER TABLE `track_versions` ADD `artist` text;--> statement-breakpoint
ALTER TABLE `track_versions` ADD `album` text;--> statement-breakpoint
ALTER TABLE `track_versions` ADD `genre` text;--> statement-breakpoint
ALTER TABLE `track_versions` ADD `year` integer;--> statement-breakpoint
ALTER TABLE `track_versions` DROP COLUMN `waveform_key`;