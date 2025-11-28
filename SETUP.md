# Ghost Tester - Setup Guide

This guide will help you set up the Ghost Tester platform locally.

## Prerequisites

- **Node.js** 18+ and npm/yarn
- **Redis** (for BullMQ queue)
- **Docker** (optional, for local development with docker-compose)
- Accounts for:
  - Supabase (database & storage)
  - OpenAI (LLM)
  - Pinecone (vector embeddings)
  - Clerk (authentication)
  - Stripe (billing)
  - Sentry (error tracking)

## Quick Start

### 1. Clone and Navigate

```bash
cd C:\Users\AMD\ghost-tester
```

### 2. Redis Configuration

✅ **Redis is already configured!** (Cloud Redis Labs)

**Connection Details**:
- Database: `ghost-tester`
- Endpoint: `redis-17888.c62.us-east-1-4.ec2.cloud.redislabs.com:17888`

**Test Connection**:
```bash
redis-cli -u redis://default:rWoyaB8mX9IeH1e1jV5UUhzmHZrMSPqh@redis-17888.c62.us-east-1-4.ec2.cloud.redislabs.com:17888 PING
```

**Note**: If you prefer local Redis for development, you can:
```bash
# Windows (using Chocolatey)
choco install redis-64
redis-server

# Or use WSL
wsl
sudo apt-get install redis-server
redis-server
```

### 3. Set Up Frontend

```bash
cd frontend
npm install
cp .env.example .env.local
# Edit .env.local with your Clerk keys and API URL
npm run dev
```

Frontend will be available at `http://localhost:3000`

### 4. Set Up API Server

```bash
cd ../api
npm install
cp .env.example .env
# Edit .env with your Supabase, Redis, Clerk, Stripe, OpenAI, Pinecone, Sentry keys
npm run dev
```

API will be available at `http://localhost:3001`

### 5. Set Up Worker

```bash
cd ../worker
npm install
cp .env.example .env
# Edit .env with your Redis, Supabase, OpenAI, Pinecone keys
npm run dev
```

Worker will start processing jobs from the queue.

## Environment Variables

### Frontend (.env.local)

```env
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### API (.env)

```env
PORT=3001
NODE_ENV=development

# Supabase
DATABASE_URL=postgresql://...
SUPABASE_URL=https://...supabase.co
SUPABASE_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...

# Redis (Cloud Redis Labs)
REDIS_URL=redis://default:rWoyaB8mX9IeH1e1jV5UUhzmHZrMSPqh@redis-17888.c62.us-east-1-4.ec2.cloud.redislabs.com:17888

# Clerk
CLERK_SECRET_KEY=sk_test_...

# Stripe
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Llama 4 (Local Ollama)
LLAMA_API_KEY=ollama
LLAMA_API_URL=http://localhost:11434/v1
LLAMA_MODEL=llama3.2:latest

# Pinecone
PINECONE_API_KEY=pcsk_3DXKLG_RVif7NDP1SjVQV8WkFpyfa1tvfZcWkKoERzqgnc6wmfvqGXXqDrgBev3rSBSgzr
PINECONE_INDEX_NAME=ghost-tester

# Sentry
SENTRY_DSN=https://...@sentry.io/...

APP_URL=http://localhost:3000
```

### Worker (.env)

```env
# Redis (Cloud Redis Labs)
REDIS_URL=redis://default:rWoyaB8mX9IeH1e1jV5UUhzmHZrMSPqh@redis-17888.c62.us-east-1-4.ec2.cloud.redislabs.com:17888

# Supabase Storage
SUPABASE_URL=https://...supabase.co
SUPABASE_STORAGE_KEY=...

# Llama 4 (Local Ollama)
LLAMA_API_KEY=ollama
LLAMA_API_URL=http://localhost:11434/v1
LLAMA_MODEL=llama3.2:latest

# Pinecone
PINECONE_API_KEY=pcsk_3DXKLG_RVif7NDP1SjVQV8WkFpyfa1tvfZcWkKoERzqgnc6wmfvqGXXqDrgBev3rSBSgzr
PINECONE_INDEX_NAME=ghost-tester

# Test Runners
PLAYWRIGHT_GRID_URL=http://localhost:4444
APPIUM_URL=http://localhost:4723

# Worker Config
WORKER_CONCURRENCY=5
MAX_TEST_DURATION_MINUTES=30

# Sentry
SENTRY_DSN=https://...@sentry.io/...

LOG_LEVEL=info
```

## Services Setup

### Supabase

1. Create a new project at https://supabase.com
2. Note down your project URL and anon key
3. Create a service role key for the API
4. Set up storage bucket for artifacts

### Llama 4 & Qwen Instruct (Local Ollama)

1. Install Ollama from https://ollama.ai/
2. Pull models: `ollama pull llama3.2:latest` and `ollama pull qwen2.5:latest`
3. Add to Worker `.env` file:
   - `LLAMA_API_URL=http://localhost:11434/v1`
   - `LLAMA_MODEL=llama3.2:latest`
   - `QWEN_API_URL=http://localhost:11434/v1`
   - `QWEN_MODEL=qwen2.5:latest`

### Pinecone

1. API key provided: `pcsk_3DXKLG_RVif7NDP1SjVQV8WkFpyfa1tvfZcWkKoERzqgnc6wmfvqGXXqDrgBev3rSBSgzr`
2. Create an index named `ghost-tester` using Pinecone CLI or Console
3. Add API key to Worker `.env` file
4. Models are pulled automatically when you run `ollama pull llama3.2:latest` and `ollama pull qwen2.5:latest`

### Supabase Authentication

1. Authentication is already configured with your Supabase project
2. Users can sign up and sign in via `/signup` and `/login` pages
3. See `SUPABASE_AUTH_SETUP.md` for detailed configuration

### Stripe

1. Get API keys from https://dashboard.stripe.com/apikeys
2. Set up webhook endpoint: `/api/webhooks/stripe`
3. Add keys to API `.env` file

### Sentry

1. Create project at https://sentry.io
2. Get DSN for Node.js
3. Add to API and Worker `.env` files

## Database Schema

You'll need to create the following tables in Supabase:

- `users` - User accounts
- `teams` - Team/organization records
- `projects` - Test projects
- `test_runs` - Test run records
- `test_artifacts` - Artifact metadata
- `integrations` - External integrations (GitHub, etc.)

See `ARCHITECTURE.md` for more details.

## Testing the Setup

1. **Frontend**: Visit `http://localhost:3000` - should show the homepage
2. **API**: Visit `http://localhost:3001/health` - should return `{"status":"ok"}`
3. **Worker**: Check logs - should show "Worker started, waiting for jobs..."

## Next Steps

1. Implement database schema in Supabase
2. Set up Clerk authentication in frontend
3. Implement API routes for test management
4. Set up test runner infrastructure (Playwright Grid, Appium)
5. Implement worker job processing logic
6. Connect OpenAI integration for test automation

## Troubleshooting

### Redis Connection Issues
- Test connection: `redis-cli -u redis://default:rWoyaB8mX9IeH1e1jV5UUhzmHZrMSPqh@redis-17888.c62.us-east-1-4.ec2.cloud.redislabs.com:17888 PING` should return `PONG`
- Check `REDIS_URL` in `.env` files matches the cloud endpoint
- Verify network access to Redis Labs endpoint

### Port Already in Use
- Change `PORT` in API `.env` file
- Update `NEXT_PUBLIC_API_URL` in frontend `.env.local`

### Module Not Found Errors
- Run `npm install` in each directory (frontend, api, worker)

## Development Tips

- Use `npm run dev` for hot reload in all services
- Check logs in each terminal window for errors
- Use `docker-compose up -d` to start Redis without managing it manually
- Use separate terminal windows for frontend, api, and worker

## Production Deployment

### Frontend (Vercel)
```bash
cd frontend
vercel deploy
```

### API (Railway/Heroku/Render)
```bash
cd api
# Build and deploy using your platform's CLI
```

### Worker (Railway/Heroku/Render)
```bash
cd worker
# Build and deploy using your platform's CLI
```

Make sure to set all environment variables in your hosting platform's dashboard.

