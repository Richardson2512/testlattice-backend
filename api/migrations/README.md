# Database Migrations

This directory contains SQL migration scripts for the TestLattice database.

## Running Migrations

### Option 1: Using Supabase Dashboard (Recommended)

1. Go to your Supabase project: https://supabase.com/dashboard
2. Navigate to **SQL Editor**
3. Copy and paste the contents of each migration file
4. Run them in order

### Option 2: Using psql

```bash
# Connect to your Supabase database
psql "postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT-REF].supabase.co:5432/postgres"

# Run migrations
\i migrations/add_guest_session_id_to_test_runs.sql
\i migrations/add_expires_at_to_test_runs.sql
```

### Option 3: Using Supabase CLI

```bash
# If you have Supabase CLI installed
supabase db push
```

## Migration Files

1. **add_guest_session_id_to_test_runs.sql**
   - Adds `guest_session_id` column for tracking guest sessions
   - Required for rate limiting and guest analytics

2. **add_expires_at_to_test_runs.sql**
   - Adds `expires_at` column for guest test expiration
   - Required for automatic cleanup of expired guest tests

## Verification

After running migrations, verify the columns exist:

```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'test_runs'
  AND column_name IN ('guest_session_id', 'expires_at');
```

## Rollback (if needed)

If you need to remove these columns:

```sql
ALTER TABLE test_runs DROP COLUMN IF EXISTS expires_at;
ALTER TABLE test_runs DROP COLUMN IF EXISTS guest_session_id;
```

