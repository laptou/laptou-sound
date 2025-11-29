-- laptou sound initial schema
-- includes better auth tables and application-specific tables

-- better auth: user table
CREATE TABLE IF NOT EXISTS user (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT,
  email_verified INTEGER DEFAULT 0,
  image TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- better auth: session table
CREATE TABLE IF NOT EXISTS session (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES user(id) ON DELETE CASCADE
);

-- better auth: account table (for oauth providers)
CREATE TABLE IF NOT EXISTS account (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  account_id TEXT NOT NULL,
  provider_id TEXT NOT NULL,
  access_token TEXT,
  refresh_token TEXT,
  access_token_expires_at TEXT,
  refresh_token_expires_at TEXT,
  scope TEXT,
  id_token TEXT,
  password TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES user(id) ON DELETE CASCADE
);

-- better auth: verification table (email verification, password reset)
CREATE TABLE IF NOT EXISTS verification (
  id TEXT PRIMARY KEY,
  identifier TEXT NOT NULL,
  value TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- custom: user roles (commenter, uploader, admin)
CREATE TABLE IF NOT EXISTS user_role (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL DEFAULT 'commenter' CHECK (role IN ('commenter', 'uploader', 'admin')),
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES user(id) ON DELETE CASCADE
);

-- invite codes for uploader/admin registration
CREATE TABLE IF NOT EXISTS invite_code (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL CHECK (role IN ('uploader', 'admin')),
  created_by TEXT NOT NULL,
  used_by TEXT,
  used_at TEXT,
  expires_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (created_by) REFERENCES user(id) ON DELETE CASCADE,
  FOREIGN KEY (used_by) REFERENCES user(id) ON DELETE SET NULL
);

-- tracks (audio uploads)
CREATE TABLE IF NOT EXISTS track (
  id TEXT PRIMARY KEY,
  uploader_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  cover_key TEXT,
  is_downloadable INTEGER DEFAULT 0,
  social_prompt TEXT, -- json: { instagram?: string, soundcloud?: string, tiktok?: string }
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (uploader_id) REFERENCES user(id) ON DELETE CASCADE
);

-- track versions (multiple versions per track)
CREATE TABLE IF NOT EXISTS track_version (
  id TEXT PRIMARY KEY,
  track_id TEXT NOT NULL,
  version_number INTEGER NOT NULL,
  original_key TEXT NOT NULL,
  playback_key TEXT,
  waveform_key TEXT,
  duration INTEGER, -- duration in seconds
  processing_status TEXT NOT NULL DEFAULT 'pending' CHECK (processing_status IN ('pending', 'processing', 'complete', 'failed')),
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (track_id) REFERENCES track(id) ON DELETE CASCADE,
  UNIQUE (track_id, version_number)
);

-- play counts (individual play events for analytics)
CREATE TABLE IF NOT EXISTS play_count (
  id TEXT PRIMARY KEY,
  track_version_id TEXT NOT NULL,
  session_id TEXT, -- anonymous session identifier
  user_id TEXT, -- null if not logged in
  played_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (track_version_id) REFERENCES track_version(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES user(id) ON DELETE SET NULL
);

-- comments on tracks (with optional timestamp)
CREATE TABLE IF NOT EXISTS comment (
  id TEXT PRIMARY KEY,
  track_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  content TEXT NOT NULL,
  timestamp_seconds INTEGER, -- optional: timestamp in track where comment applies
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (track_id) REFERENCES track(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES user(id) ON DELETE CASCADE
);

-- indexes for common queries
CREATE INDEX IF NOT EXISTS idx_session_user ON session(user_id);
CREATE INDEX IF NOT EXISTS idx_session_token ON session(token);
CREATE INDEX IF NOT EXISTS idx_account_user ON account(user_id);
CREATE INDEX IF NOT EXISTS idx_user_role_user ON user_role(user_id);
CREATE INDEX IF NOT EXISTS idx_invite_code_code ON invite_code(code);
CREATE INDEX IF NOT EXISTS idx_track_uploader ON track(uploader_id);
CREATE INDEX IF NOT EXISTS idx_track_created ON track(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_track_version_track ON track_version(track_id);
CREATE INDEX IF NOT EXISTS idx_track_version_status ON track_version(processing_status);
CREATE INDEX IF NOT EXISTS idx_play_count_version ON play_count(track_version_id);
CREATE INDEX IF NOT EXISTS idx_play_count_played ON play_count(played_at DESC);
CREATE INDEX IF NOT EXISTS idx_comment_track ON comment(track_id);
CREATE INDEX IF NOT EXISTS idx_comment_user ON comment(user_id);

