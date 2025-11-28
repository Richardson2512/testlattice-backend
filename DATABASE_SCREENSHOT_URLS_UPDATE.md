# Database Configuration for Screenshot URLs Support

## Summary

The database has been configured to support the new `screenshotUrls` array field in `DiagnosisPageSummary`. No schema migration is required because the diagnosis data is stored as JSONB, which can handle any JSON structure.

## Changes Made

### 1. TypeScript Type Updates

#### API Types (`api/src/types/index.ts`)
- ✅ Added `screenshotUrls?: string[]` to `DiagnosisPageSummary` interface

#### Frontend Types (`frontend/lib/api.ts`)
- ✅ Added `screenshotUrls?: string[]` to `DiagnosisPageSummary` interface

#### Worker Types (`worker/src/types/index.ts`)
- ✅ Already updated with `screenshotUrls?: string[]` field

### 2. Database Schema

**No changes required!** The `test_runs` table already has:
```sql
diagnosis JSONB  -- Can store any JSON structure
```

Since diagnosis is stored as JSONB, it automatically supports the new structure:
```json
{
  "pages": [
    {
      "id": "page-0",
      "screenshotUrl": "https://...",           // Primary (backward compatible)
      "screenshotUrls": ["https://...", "..."]  // All screenshots
    }
  ]
}
```

### 3. Database Mapping

The database mapping code in `api/src/lib/db.ts` doesn't need changes because:
- `mapTestRunFromDb()` passes through the JSONB `diagnosis` field as-is
- JSONB fields are automatically parsed/stringified by Supabase
- No special handling is needed for nested JSON structures

### 4. Migration Script

Created documentation migration script:
- `api/supabase-patches/2025-02-17-add-screenshot-urls-support.sql`
- This is a documentation-only migration (no SQL changes needed)
- Documents the schema evolution for future reference

## Backward Compatibility

✅ **Fully backward compatible!**

- Existing diagnosis records without `screenshotUrls` will continue to work
- The `screenshotUrl` field is still present (primary screenshot)
- Frontend code can check for `screenshotUrls` array and fall back to `screenshotUrl` if needed

## Data Flow

1. **Worker** captures multiple screenshots during diagnosis crawling
2. **Worker** uploads all screenshots and stores URLs in `screenshotUrls` array
3. **Worker** saves diagnosis with `screenshotUrls` to database (via API)
4. **API** stores diagnosis JSONB (includes `screenshotUrls` array)
5. **Frontend** receives diagnosis data with `screenshotUrls` array
6. **Frontend** can display all screenshots or use primary `screenshotUrl`

## Verification

To verify the database is properly configured, you can run this query in Supabase SQL Editor:

```sql
-- Check if diagnosis pages have screenshotUrls
SELECT 
  id,
  diagnosis->'pages'->0->>'screenshotUrl' as primary_screenshot,
  jsonb_array_length(COALESCE(diagnosis->'pages'->0->'screenshotUrls', '[]'::jsonb)) as screenshot_count
FROM test_runs 
WHERE diagnosis IS NOT NULL 
  AND diagnosis->'pages' IS NOT NULL
LIMIT 10;
```

## Next Steps

The database is fully configured and ready to use. The frontend can now:
1. Access `screenshotUrls` array from diagnosis pages
2. Display all screenshots captured during crawling
3. Fall back to `screenshotUrl` for backward compatibility

No database migration or schema changes are required! 🎉

