-- Migration 0004: Community inaccuracy flags on peer notes

CREATE TABLE IF NOT EXISTS note_flags (
  q_id TEXT NOT NULL,
  note_user_id TEXT NOT NULL,
  flagger_user_id TEXT NOT NULL,
  author TEXT NOT NULL,
  emoji TEXT NOT NULL,
  category TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (q_id, note_user_id, flagger_user_id)
);

CREATE INDEX IF NOT EXISTS idx_note_flags_target ON note_flags(q_id, note_user_id);
