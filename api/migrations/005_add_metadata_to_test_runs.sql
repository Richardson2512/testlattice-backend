-- Add metadata column to test_runs table
-- Run this in your Supabase SQL Editor

ALTER TABLE test_runs ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- Context: This column is used to store tier information (e.g. { "tier": "pro" }) 
-- and other run-specific context that shouldn't be in the main options JSON.
