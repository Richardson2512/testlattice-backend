-- Add findings and finalized_at columns to test_runs
-- This aligns with the new architecture separating execution (steps) from observation (findings)

ALTER TABLE test_runs 
ADD COLUMN IF NOT EXISTS findings JSONB,
ADD COLUMN IF NOT EXISTS finalized_at TIMESTAMPTZ;

-- Add index for finalized_at queries
CREATE INDEX IF NOT EXISTS idx_test_runs_finalized_at ON test_runs(finalized_at) WHERE finalized_at IS NOT NULL;
