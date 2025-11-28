# Database Updates for Live Streaming & Intelligent Retry Layer

## Summary

Database has been updated to support:
1. ✅ **Live Streaming (WebRTC)** - Added `stream_url` column
2. ✅ **Intelligent Retry Layer (IRL)** - Already supported via JSONB `steps` field

## Changes Made

### 1. Live Streaming Support

#### Database Schema
- ✅ Added `stream_url TEXT` column to `test_runs` table
- ✅ Migration script: `api/supabase-patches/2025-02-17-add-stream-url.sql`

#### TypeScript Types
- ✅ Added `streamUrl?: string` to `TestRun` interface in `api/src/types/index.ts`

#### Database Mapping
- ✅ Updated `createTestRun()` to include `stream_url`
- ✅ Updated `mapTestRunFromDb()` to map `stream_url` → `streamUrl`
- ✅ Updated `updateTestRun()` to support updating `stream_url`

### 2. Intelligent Retry Layer (IRL) Support

**No database changes needed!** ✅

IRL data is already stored in the `steps` JSONB field:
- Each test step can have a `selfHealing` property
- `SelfHealingInfo` includes: `strategy`, `originalSelector`, `healedSelector`, `note`
- Retry attempts and alternative strategies are tracked in step metadata
- All stored as JSONB, so no schema changes required

## Database Schema

### test_runs table
```sql
CREATE TABLE test_runs (
  ...
  stream_url TEXT,  -- NEW: WebRTC/live streaming URL
  steps JSONB,      -- Contains IRL data (selfHealing, retry info)
  ...
);
```

### Steps JSONB Structure (IRL data)
```json
{
  "steps": [
    {
      "stepNumber": 1,
      "action": "click",
      "selfHealing": {
        "strategy": "text",
        "originalSelector": "#button-123",
        "healedSelector": "button:has-text('Login')",
        "note": "Matched by visible text"
      },
      "success": true
    }
  ]
}
```

## Migration Instructions

### Run the migration:

1. **For Live Streaming**:
   ```sql
   -- Run in Supabase SQL Editor
   ALTER TABLE test_runs
     ADD COLUMN IF NOT EXISTS stream_url TEXT;
   ```

   Or use the migration script:
   ```bash
   # Apply migration
   psql -h your-db-host -U postgres -d your-db -f api/supabase-patches/2025-02-17-add-stream-url.sql
   ```

2. **For IRL**: No migration needed - already supported via JSONB

## Usage

### Live Streaming

**Worker** sets stream URL when streaming starts:
```typescript
await Database.updateTestRun(runId, {
  streamUrl: 'http://localhost:8080/stream/run-123'
})
```

**API** retrieves stream URL:
```typescript
const testRun = await Database.getTestRun(runId)
const streamUrl = testRun?.streamUrl // Available if streaming is active
```

**Frontend** can access stream URL:
```typescript
const testRun = await api.getTestRun(runId)
if (testRun.streamUrl) {
  // Connect to live stream
}
```

### Intelligent Retry Layer

**IRL data is automatically stored** in test steps:
- Self-healing information in `step.selfHealing`
- Retry attempts tracked in step metadata
- Alternative strategies logged in step history

**Access IRL data**:
```typescript
const testRun = await Database.getTestRun(runId)
const steps = testRun.steps || []

// Find steps that used self-healing
const healedSteps = steps.filter(step => step.selfHealing)

// Access healing details
healedSteps.forEach(step => {
  console.log(`Step ${step.stepNumber}:`)
  console.log(`  Original: ${step.selfHealing.originalSelector}`)
  console.log(`  Healed: ${step.selfHealing.healedSelector}`)
  console.log(`  Strategy: ${step.selfHealing.strategy}`)
})
```

## Verification

### Check stream_url column:
```sql
SELECT 
  id,
  status,
  stream_url,
  CASE 
    WHEN stream_url IS NOT NULL THEN 'Streaming active'
    ELSE 'No stream'
  END as stream_status
FROM test_runs
WHERE status = 'running'
LIMIT 10;
```

### Check IRL data in steps:
```sql
SELECT 
  id,
  jsonb_array_length(steps) as total_steps,
  (
    SELECT COUNT(*)
    FROM jsonb_array_elements(steps) AS step
    WHERE step->>'selfHealing' IS NOT NULL
  ) as healed_steps
FROM test_runs
WHERE steps IS NOT NULL
LIMIT 10;
```

## Backward Compatibility

✅ **Fully backward compatible!**

- `stream_url` is nullable (optional field)
- Existing test runs without `stream_url` continue to work
- IRL data in steps is optional (only present when healing occurred)
- Frontend can check for `streamUrl` and `selfHealing` before using

## Next Steps

1. ✅ Database schema updated
2. ✅ TypeScript types updated
3. ✅ Database mapping code updated
4. ⏳ **Run migration** in Supabase SQL Editor
5. ⏳ **Update worker** to save `streamUrl` to database when streaming starts

The database is ready to support both live streaming and IRL features! 🎉

