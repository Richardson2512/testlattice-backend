# Trace File Loading Fix

## Problem

The Playwright Trace Viewer was showing an error:
```
Could not load trace from local:./traces/trace_playwright_1764262369686_ro1asvq1d_1764263061296.zip.gz
```

**Root Cause:**
- When trace file upload failed or file was too large, the worker stored a `local:` path in the database
- The frontend tried to load this `local:` URL, which browsers cannot access
- The `local:` protocol is not a valid URL scheme for web browsers

## Solution

### 1. Worker Changes (`worker/src/processors/testProcessor.ts`)

**Before:**
- Stored `local:${tracePath}` when upload failed
- Stored `local:${tracePath}` when file was too large

**After:**
- **Never stores `local:` paths** - only valid storage URLs
- **Retry logic**: Attempts upload retry with exponential backoff
- **Compression fallback**: If file is too large, attempts gzip compression
- **Graceful failure**: If upload fails completely, stores `null` instead of invalid path
- Only stores trace URL in database if upload succeeded

**Key Changes:**
```typescript
// OLD: traceUrl = `local:${tracePath}` ❌
// NEW: traceUrl = null (don't store invalid paths) ✅

// Added retry logic
// Added compression for large files
// Only store valid storage URLs
```

### 2. Frontend Changes

#### `frontend/components/TraceViewer.tsx`
- **Validates trace URL** before rendering
- **Shows error message** if URL is invalid or starts with `local:`
- **User-friendly error** explaining why trace is not available

#### `frontend/app/test/report/[testId]/page.tsx`
- **Filters out invalid URLs** before passing to TraceViewer
- Only passes valid HTTP/HTTPS URLs

## Benefits

1. ✅ **No more browser errors** - Invalid URLs are filtered out
2. ✅ **Better user experience** - Clear error messages instead of broken viewer
3. ✅ **Improved reliability** - Retry logic and compression help upload succeed
4. ✅ **Clean database** - No invalid `local:` paths stored

## Testing

After this fix:
1. **Valid trace URL**: Viewer loads correctly
2. **Invalid trace URL**: Shows helpful error message
3. **Missing trace URL**: Component doesn't render (handled by conditional)

## Migration Notes

**Existing Data:**
- Old test runs may have `local:` paths in `trace_url` column
- These will be filtered out by the frontend automatically
- No database migration needed - frontend handles it gracefully

**New Test Runs:**
- Will only have valid storage URLs or `null`
- No more `local:` paths will be stored

## Related Files

- `worker/src/processors/testProcessor.ts` - Trace upload logic
- `frontend/components/TraceViewer.tsx` - Trace viewer component
- `frontend/app/test/report/[testId]/page.tsx` - Test report page
- `worker/src/services/storage.ts` - Storage service

