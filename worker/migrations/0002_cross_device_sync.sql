-- Migration 0002: Cross-device user identity and progress sync

ALTER TABLE identities ADD COLUMN sync_code_hash TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_identities_sync_code_hash ON identities(sync_code_hash);

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
