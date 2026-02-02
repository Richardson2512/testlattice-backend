-- Migration to add per-type diagnosis columns to test_runs table
-- Run this in Supabase SQL Editor

-- Add testability_contract column for capability-focused diagnosis
ALTER TABLE test_runs ADD COLUMN IF NOT EXISTS testability_contract JSONB;

-- Add per_type_diagnosis column for per-test-type can/cannot results
ALTER TABLE test_runs ADD COLUMN IF NOT EXISTS per_type_diagnosis JSONB;

-- Verify columns were added
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'test_runs' 
AND column_name IN ('testability_contract', 'per_type_diagnosis');
