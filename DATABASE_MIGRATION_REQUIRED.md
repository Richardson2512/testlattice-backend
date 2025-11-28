# Database Migration Required

## Error
```
Failed to create test run: Could not find the 'trace_url' column of 'test_runs' in the schema cache
```

## Problem
The database is missing required columns:
- `trace_url` - Required for storing trace file URLs
- `stream_url` - Required for live streaming (may also be missing)

## Solution

### Option 1: Run the Migration Script (Recommended)

1. Open your **Supabase Dashboard**
2. Go to **SQL Editor**
3. Copy and paste this SQL:

```sql
-- Add missing columns to test_runs table
ALTER TABLE test_runs
  ADD COLUMN IF NOT EXISTS trace_url TEXT;

ALTER TABLE test_runs
  ADD COLUMN IF NOT EXISTS stream_url TEXT;
```

4. Click **Run** to execute

### Option 2: Use the Migration File

The migration file is located at:
```
api/supabase-patches/2025-02-17-add-missing-columns.sql
```

You can:
- Copy the contents and run in Supabase SQL Editor
- Or use psql if you have direct database access

### Option 3: Quick Fix (Individual Commands)

Run these commands one at a time in Supabase SQL Editor:

```sql
-- Add trace_url
ALTER TABLE test_runs ADD COLUMN IF NOT EXISTS trace_url TEXT;

-- Add stream_url  
ALTER TABLE test_runs ADD COLUMN IF NOT EXISTS stream_url TEXT;
```

## Verification

After running the migration, verify the columns exist:

```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'test_runs' 
  AND column_name IN ('trace_url', 'stream_url');
```

You should see both columns listed.

## Why This Happened

The database schema was updated in code, but the actual database table wasn't migrated. The `CREATE TABLE IF NOT EXISTS` statement in the schema file doesn't add new columns to existing tables - it only creates the table if it doesn't exist.

## Next Steps

After running the migration:
1. ✅ The error should be resolved
2. ✅ Test creation should work
3. ✅ Live streaming will be supported (once `stream_url` is added)

## Notes

- Both columns are nullable (optional)
- Existing test runs will continue to work
- No data loss will occur

