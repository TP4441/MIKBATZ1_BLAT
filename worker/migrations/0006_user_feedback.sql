-- Migration 0006: User feedback (suggestions / complaints)

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
