-- Migration 0010: Store active site-wide admin broadcast popup on sync_meta

ALTER TABLE sync_meta ADD COLUMN announcement_json TEXT NOT NULL DEFAULT '';
