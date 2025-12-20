-- Migration: Add expires_at column to test_runs table for guest test runs
-- This allows guest test runs to automatically expire after 24 hours

-- Add expires_at column (nullable, only set for guest runs)
ALTER TABLE test_runs 
ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP WITH TIME ZONE;

-- Add index for efficient cleanup queries
CREATE INDEX IF NOT EXISTS idx_test_runs_expires_at 
ON test_runs(expires_at) 
WHERE expires_at IS NOT NULL;

-- Add comment
COMMENT ON COLUMN test_runs.expires_at IS 'Expiration timestamp for guest test runs. Automatically cleaned up after expiration.';

