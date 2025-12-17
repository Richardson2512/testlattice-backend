-- Migration: Add missing columns to test_runs table
-- Date: 2025-02-17
-- Description: Adds trace_url and stream_url columns that are required by the application

-- Add trace_url column (if it doesn't exist)
ALTER TABLE test_runs
  ADD COLUMN IF NOT EXISTS trace_url TEXT;

-- Add stream_url column (if it doesn't exist)
ALTER TABLE test_runs
  ADD COLUMN IF NOT EXISTS stream_url TEXT;

-- Add comments for documentation
COMMENT ON COLUMN test_runs.trace_url IS 'Fallback for trace URL if artifact save fails';
COMMENT ON COLUMN test_runs.stream_url IS 'WebRTC/live streaming URL for real-time test viewing';

-- Verify columns exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'test_runs' AND column_name = 'trace_url'
  ) THEN
    RAISE EXCEPTION 'Failed to add trace_url column';
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'test_runs' AND column_name = 'stream_url'
  ) THEN
    RAISE EXCEPTION 'Failed to add stream_url column';
  END IF;
  
  RAISE NOTICE 'Successfully added trace_url and stream_url columns';
END $$;

