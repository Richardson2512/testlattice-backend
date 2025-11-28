# Supabase RLS Policy Fix - Storage Upload Error

## 🔍 Root Cause Analysis

### Error Message
```
Failed to upload screenshot: new row violates row-level security policy
```

### Problem Identified

1. **Storage RLS Policy**: The Supabase storage bucket `artifacts` has RLS enabled with this policy:
   ```sql
   CREATE POLICY "Service role upload access on artifacts" ON storage.objects
     FOR INSERT WITH CHECK (bucket_id = 'artifacts' AND auth.role() = 'service_role');
   ```
   This means **only the service role key** can upload files to storage.

2. **Worker Configuration**: The worker was using `SUPABASE_KEY` (anon key) instead of `SUPABASE_SERVICE_ROLE_KEY` for storage operations.

3. **Result**: Every screenshot upload attempt failed with RLS policy violation.

4. **Cascade Effect**: 
   - Screenshots failed to upload → No `screenshotUrl` in steps
   - Frontend checks for `screenshotUrl` → Shows "Waiting for browser view..."
   - Test steps have no screenshots → Live view doesn't work

## ✅ Fixes Applied

### 1. Added Service Role Key to Worker
- Added `SUPABASE_SERVICE_ROLE_KEY` to `worker/.env`
- Copied from `api/.env` where it was already configured

### 2. Updated Worker Code
- Modified `worker/src/index.ts` to:
  - Check for `SUPABASE_SERVICE_ROLE_KEY` first
  - Use service role key for storage operations
  - Warn if service role key is missing
  - Fall back to anon key only if service role not available (with warning)

### 3. Updated Config
- Added `serviceRoleKey` to `worker/src/config/env.ts` config object

## 🚀 Next Steps

**Restart the worker** to apply the fix:

```powershell
cd worker
npm run dev
```

### Expected Behavior After Fix

1. **Screenshots will upload successfully** - No more RLS policy violations
2. **Live browser view will work** - Screenshots will appear in the frontend
3. **Test steps will have screenshots** - Each step will show the page state

### Verification

After restarting, create a new test run and you should see:
- ✅ Screenshots uploading without errors
- ✅ Live browser view showing the page
- ✅ Steps displaying with screenshots

## 📝 Technical Details

### Why Service Role Key?

- **Anon Key**: Limited permissions, respects RLS policies, used for client-side operations
- **Service Role Key**: Bypasses RLS policies, full access, used for server-side operations (like worker)

### Storage Policy Logic

The storage bucket requires `auth.role() = 'service_role'` for INSERT operations. This is a security best practice:
- Prevents unauthorized uploads
- Ensures only backend services can write to storage
- Frontend (using anon key) can only read public URLs

### Worker Architecture

The worker is a backend service that:
- Processes test jobs from the queue
- Executes Playwright/Appium tests
- Uploads artifacts (screenshots, videos) to Supabase Storage
- Updates test run status via API

Since it's a backend service, it should use the service role key for all Supabase operations.

