-- Migration: Add report visibility sharing options and summary storage
ALTER TABLE test_runs ADD COLUMN IF NOT EXISTS visibility TEXT CHECK (visibility IN ('private', 'public')) DEFAULT 'private';
ALTER TABLE test_runs ADD COLUMN IF NOT EXISTS report_summary JSONB;
CREATE INDEX IF NOT EXISTS idx_test_runs_visibility ON test_runs(visibility);
