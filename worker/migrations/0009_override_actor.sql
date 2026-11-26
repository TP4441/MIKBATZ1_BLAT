-- Migration 0009: Track who modified or removed each question override

ALTER TABLE question_overrides ADD COLUMN updated_by_user_id TEXT NOT NULL DEFAULT '';
ALTER TABLE question_overrides ADD COLUMN updated_by_name TEXT NOT NULL DEFAULT '';
ALTER TABLE question_overrides ADD COLUMN updated_by_emoji TEXT NOT NULL DEFAULT '';
ALTER TABLE question_overrides ADD COLUMN updated_by_role TEXT NOT NULL DEFAULT '';
