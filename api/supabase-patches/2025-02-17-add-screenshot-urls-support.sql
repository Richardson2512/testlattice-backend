-- Migration: Add support for screenshotUrls array in DiagnosisPageSummary
-- Date: 2025-02-17
-- Description: This migration adds support for storing multiple screenshots per diagnosis page.
--              The diagnosis column is JSONB, so no schema changes are needed.
--              This is a documentation-only migration to track the schema evolution.

-- No SQL changes required - JSONB column already supports the new structure
-- The diagnosis JSONB column in test_runs table can store:
-- {
--   "pages": [
--     {
--       "id": "page-0",
--       "screenshotUrl": "...",      -- Primary screenshot (backward compatible)
--       "screenshotUrls": ["...", ...] -- All screenshots captured during scrolling
--     }
--   ]
-- }

-- Verification query (optional - run to check existing data structure):
-- SELECT 
--   id,
--   diagnosis->'pages'->0->>'screenshotUrl' as primary_screenshot,
--   jsonb_array_length(diagnosis->'pages'->0->'screenshotUrls') as screenshot_count
-- FROM test_runs 
-- WHERE diagnosis IS NOT NULL 
--   AND diagnosis->'pages' IS NOT NULL
-- LIMIT 10;

-- Note: Existing diagnosis records without screenshotUrls will continue to work
--       due to backward compatibility (screenshotUrl field is still present)

