-- Migration 0005: Inaccuracy flags on problem reports + threaded replies on community notes

DROP TABLE IF EXISTS note_flags;

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
