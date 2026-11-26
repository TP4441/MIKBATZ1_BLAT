-- Migration 0007: Admin enhancements (user rename/block, custom identities, telemetry, version tracking)

ALTER TABLE identities ADD COLUMN blocked INTEGER NOT NULL DEFAULT 0;
ALTER TABLE identities ADD COLUMN blocked_at INTEGER NOT NULL DEFAULT 0;
ALTER TABLE identities ADD COLUMN blocked_reason TEXT NOT NULL DEFAULT '';
ALTER TABLE identities ADD COLUMN admin_renamed_at INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_identities_blocked ON identities(blocked);

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
