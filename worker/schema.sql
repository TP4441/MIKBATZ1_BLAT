-- Cloudflare D1 (SQLite) schema for Mikbatz 1 Exam Practice App

CREATE TABLE IF NOT EXISTS identities (
  user_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  emoji TEXT NOT NULL,
  category TEXT NOT NULL,
  client_secret_hash TEXT,
  sync_code_hash TEXT,
  first_seen_at INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL,
  blocked INTEGER NOT NULL DEFAULT 0,
  blocked_at INTEGER NOT NULL DEFAULT 0,
  blocked_reason TEXT NOT NULL DEFAULT '',
  admin_renamed_at INTEGER NOT NULL DEFAULT 0,
  role TEXT NOT NULL DEFAULT 'user'
);

CREATE INDEX IF NOT EXISTS idx_identities_name ON identities(name);
CREATE INDEX IF NOT EXISTS idx_identities_last_seen ON identities(last_seen_at DESC);
CREATE INDEX IF NOT EXISTS idx_identities_blocked ON identities(blocked);
CREATE INDEX IF NOT EXISTS idx_identities_role ON identities(role);
CREATE UNIQUE INDEX IF NOT EXISTS idx_identities_sync_code_hash ON identities(sync_code_hash);

CREATE TABLE IF NOT EXISTS admin_sessions (
  session_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL DEFAULT '',
  user_name TEXT NOT NULL DEFAULT '',
  user_emoji TEXT NOT NULL DEFAULT '',
  device_label TEXT NOT NULL DEFAULT '',
  remember_device INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  revoked_at INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_admin_sessions_active ON admin_sessions(revoked_at, expires_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_user ON admin_sessions(user_id);

CREATE TABLE IF NOT EXISTS custom_identities (
  name TEXT PRIMARY KEY,
  emoji TEXT NOT NULL,
  category TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS blocked_users (
  user_id TEXT PRIMARY KEY,
  name TEXT NOT NULL DEFAULT '',
  reason TEXT NOT NULL DEFAULT '',
  blocked_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS telemetry_daily (
  day_utc TEXT PRIMARY KEY,
  requests_total INTEGER NOT NULL DEFAULT 0,
  errors_4xx INTEGER NOT NULL DEFAULT 0,
  errors_5xx INTEGER NOT NULL DEFAULT 0,
  d1_rows_read INTEGER NOT NULL DEFAULT 0,
  d1_rows_written INTEGER NOT NULL DEFAULT 0,
  endpoints_json TEXT NOT NULL DEFAULT '{}',
  updated_at INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS version_releases (
  release_id TEXT PRIMARY KEY,
  version TEXT NOT NULL,
  component TEXT NOT NULL DEFAULT 'all',
  title TEXT NOT NULL,
  notes TEXT NOT NULL DEFAULT '',
  commit_sha TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_version_releases_created ON version_releases(created_at DESC);

CREATE TABLE IF NOT EXISTS user_device_secrets (
  secret_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  device_label TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_device_secrets_user ON user_device_secrets(user_id);

CREATE TABLE IF NOT EXISTS user_progress (
  user_id TEXT PRIMARY KEY,
  progress_json TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  version INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS sync_rate_limit (
  ip_hash TEXT PRIMARY KEY,
  attempts INTEGER NOT NULL,
  locked_until INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS community_notes (
  q_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  author TEXT NOT NULL,
  emoji TEXT NOT NULL,
  category TEXT NOT NULL,
  text TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (q_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_notes_updated ON community_notes(updated_at DESC);

CREATE TABLE IF NOT EXISTS note_replies (
  reply_id TEXT PRIMARY KEY,
  q_id TEXT NOT NULL,
  note_user_id TEXT NOT NULL,
  parent_reply_id TEXT,
  reply_to_author TEXT,
  user_id TEXT NOT NULL,
  author TEXT NOT NULL,
  emoji TEXT NOT NULL,
  category TEXT NOT NULL,
  text TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_note_replies_note ON note_replies(q_id, note_user_id, created_at ASC);

CREATE TABLE IF NOT EXISTS community_problems (
  q_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  type TEXT NOT NULL,
  text TEXT NOT NULL,
  author TEXT NOT NULL,
  emoji TEXT NOT NULL,
  category TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (q_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_problems_updated ON community_problems(updated_at DESC);

CREATE TABLE IF NOT EXISTS problem_flags (
  q_id TEXT NOT NULL,
  problem_user_id TEXT NOT NULL,
  flagger_user_id TEXT NOT NULL,
  author TEXT NOT NULL,
  emoji TEXT NOT NULL,
  category TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (q_id, problem_user_id, flagger_user_id)
);

CREATE INDEX IF NOT EXISTS idx_problem_flags_target ON problem_flags(q_id, problem_user_id);

CREATE TABLE IF NOT EXISTS question_overrides (
  q_id TEXT PRIMARY KEY,
  hidden INTEGER NOT NULL DEFAULT 0,
  stem TEXT,
  options_json TEXT,
  correct_json TEXT,
  all_accepted INTEGER,
  appeal_note TEXT,
  subject TEXT,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS admin_rate_limit (
  ip_hash TEXT PRIMARY KEY,
  attempts INTEGER NOT NULL,
  locked_until INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS sync_meta (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  community_version INTEGER NOT NULL DEFAULT 1,
  updated_at INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS user_feedback (
  feedback_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  author TEXT NOT NULL,
  emoji TEXT NOT NULL,
  category TEXT NOT NULL,
  text TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_user_feedback_created ON user_feedback(created_at DESC);

INSERT OR IGNORE INTO sync_meta (id, community_version, updated_at)
VALUES (1, 1, 0);
