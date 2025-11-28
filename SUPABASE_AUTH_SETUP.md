# Supabase Authentication Setup Guide

This guide explains how Supabase Authentication is integrated into the Ghost Tester platform.

## Overview

The platform uses **Supabase Auth** for user authentication instead of Clerk. This provides:
- ✅ Email/password authentication
- ✅ JWT token-based API authentication
- ✅ Session management
- ✅ Protected routes
- ✅ User profile management

## Frontend Setup

### Environment Variables

Create or update `frontend/.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://txiidsabckkuzhsfzekr.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR4aWlkc2FiY2trdXpoc2Z6ZWtyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMzNzUwMzIsImV4cCI6MjA3ODk1MTAzMn0.h5GwLKnfwBaqWxsdijAdQP5eZiv_q0w36F_di9nlxlw
NEXT_PUBLIC_API_URL=http://localhost:3001
```

### Authentication Flow

1. **Sign Up**: Users create accounts at `/signup`
2. **Email Confirmation**: Supabase sends confirmation email (if enabled)
3. **Sign In**: Users log in at `/login`
4. **Protected Routes**: Dashboard requires authentication
5. **API Calls**: Frontend automatically includes JWT token in API requests

### Pages

- **`/login`** - Sign in page
- **`/signup`** - Sign up page
- **`/dashboard`** - Protected dashboard (requires auth)

### Components

- **`Navigation`** - Shows user email and sign out button when authenticated
- **Middleware** - Automatically redirects unauthenticated users from protected routes

## API Setup

### Environment Variables

The API uses the same Supabase credentials (already configured):

```env
SUPABASE_URL=https://txiidsabckkuzhsfzekr.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR4aWlkc2FiY2trdXpoc2Z6ZWtyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzM3NTAzMiwiZXhwIjoyMDc4OTUxMDMyfQ.FLUfoKy7hd5I00RpqrcBP7D2PWWYG70H04lO-Rxspc4
```

### Authentication Middleware

The API uses JWT token verification:

```typescript
// api/src/middleware/auth.ts
// Verifies Supabase JWT tokens from Authorization header
```

### Protected Routes

Routes that require authentication:
- `POST /api/tests/run` - Create test run
- Other routes can be protected by adding `preHandler: authenticate`

### Usage in Routes

```typescript
fastify.post('/run', {
  preHandler: authenticate,
}, async (request: AuthenticatedRequest, reply) => {
  // request.user is available here
  const userId = request.user?.id
  // ...
})
```

## Supabase Configuration

### Enable Email Authentication

1. Go to your Supabase Dashboard
2. Navigate to **Authentication** → **Providers**
3. Enable **Email** provider
4. Configure email templates (optional)

### Email Confirmation (Optional)

By default, Supabase requires email confirmation. To disable for development:

1. Go to **Authentication** → **Settings**
2. Disable **"Enable email confirmations"** (for development only)

### Password Requirements

Default requirements:
- Minimum 6 characters
- Can be customized in Supabase Dashboard

## User Management

### Creating Users

Users can sign up via the `/signup` page, or you can create them programmatically:

```typescript
const { data, error } = await supabase.auth.admin.createUser({
  email: 'user@example.com',
  password: 'secure-password',
  email_confirm: true, // Auto-confirm email
})
```

### User Profiles

User data is stored in Supabase Auth. To add custom profile data:

1. Create a `profiles` table in Supabase
2. Set up a database trigger to create profile on user signup
3. Query profile data alongside auth data

## Security Considerations

### JWT Tokens

- Tokens are automatically refreshed by the frontend
- Tokens expire after 1 hour (configurable in Supabase)
- Tokens are stored in HTTP-only cookies (via `@supabase/ssr`)

### API Security

- Always verify tokens on the server side
- Use service role key only on the backend
- Never expose service role key to frontend

### Row Level Security (RLS)

Consider enabling RLS in Supabase to:
- Restrict data access by user ID
- Ensure users only see their own test runs
- Protect sensitive data

Example RLS policy:
```sql
-- Allow users to see only their own test runs
CREATE POLICY "Users can view own test runs"
ON test_runs FOR SELECT
USING (auth.uid() = user_id);
```

## Testing Authentication

### Manual Testing

1. **Sign Up**:
   - Go to `http://localhost:3000/signup`
   - Create an account
   - Check email for confirmation (if enabled)

2. **Sign In**:
   - Go to `http://localhost:3000/login`
   - Enter credentials
   - Should redirect to dashboard

3. **Protected Routes**:
   - Try accessing `/dashboard` without logging in
   - Should redirect to `/login`

4. **API Calls**:
   - Check browser DevTools → Network
   - API requests should include `Authorization: Bearer <token>` header

### Troubleshooting

**Issue**: "Invalid or expired token"
- Solution: Check that Supabase URL and keys are correct
- Solution: Verify token hasn't expired (refresh page)

**Issue**: "Cannot connect to Supabase"
- Solution: Check `NEXT_PUBLIC_SUPABASE_URL` is correct
- Solution: Verify network connectivity

**Issue**: Email confirmation not working
- Solution: Check Supabase email settings
- Solution: Check spam folder
- Solution: Disable email confirmation for development

## Next Steps

1. **Add User Profiles**: Create profiles table for additional user data
2. **Enable RLS**: Add Row Level Security policies
3. **Add OAuth**: Enable Google, GitHub, etc. providers
4. **Add Roles**: Implement role-based access control
5. **Add Teams**: Support team/organization management

## References

- [Supabase Auth Docs](https://supabase.com/docs/guides/auth)
- [Next.js + Supabase Guide](https://supabase.com/docs/guides/auth/server-side/nextjs)
- [Supabase SSR Package](https://github.com/supabase/ssr)

