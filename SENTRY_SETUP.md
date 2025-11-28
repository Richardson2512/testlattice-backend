# Sentry Setup Guide

This guide covers Sentry setup for error tracking and monitoring.

## Platform Selection

**Select: Node.js** when creating a project in Sentry.

This applies to both:
- **API Server** (`api/`) - Fastify/Node.js backend
- **Worker Service** (`worker/`) - Node.js worker process

Both services use `@sentry/node` package, so they both need **Node.js** platform projects.

## Setup Steps

### 1. Create Sentry Account

1. Go to https://sentry.io/
2. Sign up or log in
3. Create a new organization (if you don't have one)

### 2. Create Projects

You can create **one project for both services** or **separate projects**:

**Option A: Single Project (Recommended for simplicity)**
- Create one Node.js project called "Ghost Tester"
- Use the same DSN for both API and Worker

**Option B: Separate Projects (Recommended for production)**
- Create "Ghost Tester API" (Node.js)
- Create "Ghost Tester Worker" (Node.js)
- Use different DSNs for better separation

### 3. Select Platform

When creating the project:
1. **Platform**: Select **"Node.js"**
2. **Framework**: You can select "Express" or "Generic Node.js" (both work with Fastify)
3. **Project Name**: "Ghost Tester API" or "Ghost Tester Worker"

### 4. Get DSN

After creating the project, Sentry will show you the DSN (Data Source Name):
```
https://<key>@<org-id>.ingest.sentry.io/<project-id>
```

Example format:
```
https://abc123def456@o1234567.ingest.sentry.io/1234567
```

### 5. Configure Environment Variables

**For API Server** (`api/.env`):
```env
SENTRY_DSN=https://<your-dsn>@<org-id>.ingest.sentry.io/<project-id>
```

**For Worker Service** (`worker/.env`):
```env
SENTRY_DSN=https://<your-dsn>@<org-id>.ingest.sentry.io/<project-id>
```

If using separate projects, use different DSNs for each.

### 6. Initialize Sentry in Code

✅ **Sentry is now initialized!**

**Instrument Files Created**:
- `api/src/instrument.ts` - Sentry initialization for API server
- `worker/src/instrument.ts` - Sentry initialization for Worker service

**Entry Points Updated**:
- `api/src/index.ts` - Imports instrument.ts first
- `worker/src/index.ts` - Imports instrument.ts first

**Features Configured**:
- ✅ Error tracking
- ✅ Performance monitoring (profiling)
- ✅ Structured logging
- ✅ Transaction tracing (100% sample rate)
- ✅ Automatic profiling during traces

**Error Handlers**:
- ✅ Fastify error handler in API server
- ✅ Worker error capture in job processing

## Quick Setup Summary

1. **Go to**: https://sentry.io/
2. **Create Project**: Click "Create Project"
3. **Select Platform**: **Node.js**
4. **Project Name**: "Ghost Tester API" (or "Ghost Tester Worker")
5. **Copy DSN**: Sentry will show you the DSN
6. **Add to `.env` files**: 
   - `api/.env`: `SENTRY_DSN=<your-dsn>`
   - `worker/.env`: `SENTRY_DSN=<your-dsn>`
7. **Initialize in code**: Add Sentry.init() to both services

## Platform Details

### Why Node.js?

- Both API and Worker are Node.js applications
- They use `@sentry/node` package (v7.81.0)
- Fastify (API) and Node.js workers are both Node.js platforms
- Sentry Node.js SDK supports all Node.js frameworks

### Framework Selection

When creating the project, you can choose:
- **Express** - Works fine (Sentry supports all Node.js frameworks)
- **Generic Node.js** - Also works
- **Fastify** - Not listed, but "Generic Node.js" or "Express" both work

The framework selection in Sentry is mainly for getting started templates. Since you're using Fastify, "Generic Node.js" or "Express" will work fine.

## Testing Sentry

### Test Endpoint (Development Only)

The API server includes a test endpoint for Sentry:

```bash
curl http://localhost:3001/debug-sentry
```

This will:
- Send a log to Sentry
- Send a test metric
- Throw a test error

Check your Sentry dashboard to see if the error appears.

### Manual Testing

You can also test programmatically:

```typescript
import * as Sentry from '@sentry/node';

// Test error capture
Sentry.captureException(new Error('Test error from Ghost Tester'));

// Test message
Sentry.captureMessage('Test message from Ghost Tester', 'info');
```

### Verify in Sentry Dashboard

1. Go to your Sentry project dashboard
2. Navigate to **Issues** tab
3. You should see the test error appear
4. Check **Performance** tab for transaction traces
5. Check **Profiling** tab for performance profiles

## Free Tier

Sentry offers a free tier:
- **5,000 events/month** (errors, messages, transactions)
- Perfect for development and small projects
- Upgrade when you need more

## Current Status

- ✅ `@sentry/node` package installed in both API and Worker
- ✅ `@sentry/profiling-node` package installed for performance profiling
- ✅ Sentry initialized in `instrument.ts` files
- ✅ Error handlers configured
- ✅ DSN configured: `https://3d1c29d4bc40d1138df36bb9a9cfc70e@o4510386978357248.ingest.us.sentry.io/4510386990350336`

## Next Steps

1. ✅ Create Sentry account and Node.js project
2. ✅ Get DSN (already configured)
3. ✅ Add DSN to `.env` files (already done)
4. ✅ Initialize Sentry in code (already done)
5. **Test error tracking**:
   - Start API server: `cd api && npm run dev`
   - Visit: `http://localhost:3001/debug-sentry`
   - Check Sentry dashboard for the error

---

**Platform to Select**: **Node.js** ✅

