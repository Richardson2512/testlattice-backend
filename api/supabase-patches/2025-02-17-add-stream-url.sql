-- Migration: Add stream_url column for live streaming support
-- Date: 2025-02-17
-- Description: Adds stream_url field to test_runs table to store WebRTC/live streaming URLs

-- Add stream_url column to test_runs table
ALTER TABLE test_runs
  ADD COLUMN IF NOT EXISTS stream_url TEXT;

-- Add comment for documentation
COMMENT ON COLUMN test_runs.stream_url IS 'WebRTC/live streaming URL for real-time test viewing (optional)';

-- Note: stream_url is nullable because streaming is optional
-- The URL is set when streaming starts and cleared when streaming stops

