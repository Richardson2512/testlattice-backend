-- Patch: add diagnosis column + extended status enum for test_runs
-- Run this in Supabase SQL editor or via psql after selecting your project database.

ALTER TABLE test_runs
  ADD COLUMN IF NOT EXISTS diagnosis JSONB;

ALTER TABLE test_runs
  DROP CONSTRAINT IF EXISTS test_runs_status_check;

ALTER TABLE test_runs
  ADD CONSTRAINT test_runs_status_check
  CHECK (status IN ('pending', 'queued', 'diagnosing', 'waiting_approval', 'running', 'completed', 'failed', 'cancelled'));

-- Optional: make sure new artifact type is allowed (trace)
ALTER TABLE test_artifacts
  DROP CONSTRAINT IF EXISTS test_artifacts_type_check;

ALTER TABLE test_artifacts
  ADD CONSTRAINT test_artifacts_type_check
  CHECK (type IN ('screenshot', 'video', 'log', 'dom', 'network', 'trace'));

