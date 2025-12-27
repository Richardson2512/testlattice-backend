# Supabase Setup Guide

This guide will help you set up Supabase for the Ghost Tester platform.

## Prerequisites

- Supabase project created at https://supabase.com
- Your Supabase credentials:
  - **URL**: `https://txiidsabckkuzhsfzekr.supabase.co`
  - **Anon Key**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR4aWlkc2FiY2trdXpoc2Z6ZWtyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMzNzUwMzIsImV4cCI6MjA3ODk1MTAzMn0.h5GwLKnfwBaqWxsdijAdQP5eZiv_q0w36F_di9nlxlw`
  - **Service Role Key**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR4aWlkc2FiY2trdXpoc2Z6ZWtyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzM3NTAzMiwiZXhwIjoyMDc4OTUxMDMyfQ.FLUfoKy7hd5I00RpqrcBP7D2PWWYG70H04lO-Rxspc4`

## Step 1: Create Database Tables

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Copy and paste the contents of `api/supabase-schema.sql`
4. Click **Run** to execute the SQL script

This will create:
- `projects` table
- `test_runs` table
- `test_artifacts` table
- Required indexes
- Storage bucket for artifacts

## Step 2: Set Up Environment Variables

### API Server (`api/.env`)

Create or update `api/.env` with:

```env
PORT=3001
NODE_ENV=development

# Supabase
SUPABASE_URL=https://txiidsabckkuzhsfzekr.supabase.co
SUPABASE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR4aWlkc2FiY2trdXpoc2Z6ZWtyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMzNzUwMzIsImV4cCI6MjA3ODk1MTAzMn0.h5GwLKnfwBaqWxsdijAdQP5eZiv_q0w36F_di9nlxlw
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR4aWlkc2FiY2trdXpoc2Z6ZWtyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzM3NTAzMiwiZXhwIjoyMDc4OTUxMDMyfQ.FLUfoKy7hd5I00RpqrcBP7D2PWWYG70H04lO-Rxspc4

# Redis
REDIS_URL=redis://localhost:6379

# Other APIs (add as needed)
CLERK_SECRET_KEY=sk_test_...
STRIPE_SECRET_KEY=sk_test_...
OPENAI_API_KEY=sk-...

```

### Worker Service (`worker/.env`)

Create or update `worker/.env` with:

```env
# Redis
REDIS_URL=redis://localhost:6379

# Supabase Storage
SUPABASE_URL=https://txiidsabckkuzhsfzekr.supabase.co
SUPABASE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR4aWlkc2FiY2trdXpoc2Z6ZWtyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMzNzUwMzIsImV4cCI6MjA3ODk1MTAzMn0.h5GwLKnfwBaqWxsdijAdQP5eZiv_q0w36F_di9nlxlw

# Other APIs (add as needed)
OPENAI_API_KEY=sk-...

```

## Step 3: Verify Setup

1. **Test Database Connection**:
   ```bash
   cd api
   npm run dev
   ```
   Check the console for "Database connected successfully" message.

2. **Test Storage**:
   - The storage bucket `artifacts` should be created automatically by the SQL script
   - You can verify in Supabase Dashboard → Storage

## Step 4: Security Notes

⚠️ **Important Security Considerations**:

1. **Service Role Key**: This key has full database access. Keep it secure and never expose it in client-side code.

2. **Anon Key**: Safe to use in client-side code, but RLS policies should be configured properly.

3. **RLS Policies**: The current setup allows service role full access. For production:
   - Create user-specific policies
   - Use Clerk authentication to identify users
   - Restrict access based on team/project ownership

4. **Storage Bucket**: The `artifacts` bucket is set to public for easy access. Consider:
   - Making it private and using signed URLs
   - Implementing proper access controls

## Troubleshooting

### Database Connection Errors

- Verify your Supabase URL and keys are correct
- Check that tables were created successfully in SQL Editor
- Ensure RLS policies allow service role access

### Storage Upload Errors

- Verify the `artifacts` bucket exists in Storage
- Check storage policies allow service role to upload
- Ensure the bucket is set to public (or adjust policies)

### Migration Issues

If you need to reset the database:
1. Go to Supabase Dashboard → Database → Tables
2. Drop existing tables (in order: test_artifacts, test_runs, projects)
3. Re-run the SQL schema script

### Updating existing databases

Newer application versions expect extra fields (e.g. the `diagnosis` column on `test_runs` and additional status values).  
If you created your database before February 2025, run the patch script in `api/supabase-patches/2025-02-17-add-diagnosis-column.sql` inside the Supabase SQL editor to bring your schema up to date.

## Next Steps

1. Set up other APIs (OpenAI, Clerk, Stripe)
2. Configure authentication with Clerk
3. Test creating a project and test run
4. Verify artifacts are uploaded to storage correctly

