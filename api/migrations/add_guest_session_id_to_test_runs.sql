-- Migration: Add guest_session_id column to test_runs table for guest test tracking
-- This allows tracking guest sessions for rate limiting and analytics

-- Add guest_session_id column (nullable, only set for guest runs)
ALTER TABLE test_runs 
ADD COLUMN IF NOT EXISTS guest_session_id TEXT;

-- Add index for efficient guest session queries
CREATE INDEX IF NOT EXISTS idx_test_runs_guest_session_id 
ON test_runs(guest_session_id) 
WHERE guest_session_id IS NOT NULL;

-- Add comment
COMMENT ON COLUMN test_runs.guest_session_id IS 'Session identifier for guest (unauthenticated) test runs. Used for rate limiting and analytics.';

