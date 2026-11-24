-- Migration 0003: Single-row metadata version counter for conditional community polling

CREATE TABLE IF NOT EXISTS sync_meta (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  community_version INTEGER NOT NULL DEFAULT 1,
  updated_at INTEGER NOT NULL DEFAULT 0
);

INSERT OR IGNORE INTO sync_meta (id, community_version, updated_at)
VALUES (1, 1, 0);
