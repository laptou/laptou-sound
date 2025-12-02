-- add hidden and deleted_at fields to comments table
ALTER TABLE comments ADD COLUMN hidden INTEGER NOT NULL DEFAULT 0;
ALTER TABLE comments ADD COLUMN deleted_at INTEGER;


