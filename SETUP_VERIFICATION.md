# Setup Verification & Configuration Guide

## ✅ Quick Verification Checklist

### 1. Ollama Models
- [x] `qwen2.5-coder:7b` - ✅ Downloaded (4.7 GB)
- [x] `qwen2.5-coder:14b` - ✅ Downloaded (9.0 GB)

**Verify:**
```bash
ollama list
```

### 2. Environment Variables

#### Worker Service (`worker/.env`)
Required:
```env
# Redis
REDIS_URL=redis://localhost:6379

# Supabase
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Qwen-Coder Models (Optional - defaults work)
QWEN_CODER_7B_API_URL=http://localhost:11434/v1
QWEN_CODER_7B_API_KEY=ollama
QWEN_CODER_7B_MODEL=qwen2.5-coder:7b

QWEN_CODER_14B_API_URL=http://localhost:11434/v1
QWEN_CODER_14B_API_KEY=ollama
QWEN_CODER_14B_MODEL=qwen2.5-coder:14b

# Optional
OPENAI_API_KEY=sk-...  # For GPT-4V vision
PINECONE_API_KEY=...    # For embeddings
```

#### API Service (`api/.env`)
Required:
```env
# Supabase
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
SUPABASE_ANON_KEY=your_anon_key

# Redis
REDIS_URL=redis://localhost:6379

# Server
PORT=3001
NODE_ENV=development
```

#### Frontend (`frontend/.env.local`)
Required:
```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
```

### 3. Database Schema

**Required Migration:**
Run this SQL in your Supabase SQL Editor:
```sql
-- File: api/supabase-patches/2025-02-17-add-missing-columns.sql
ALTER TABLE test_runs
  ADD COLUMN IF NOT EXISTS trace_url TEXT;
  
ALTER TABLE test_runs
  ADD COLUMN IF NOT EXISTS stream_url TEXT;
```

**Verify Tables Exist:**
- `projects`
- `test_runs` (with `trace_url` and `stream_url` columns)
- `test_artifacts`
- `test_steps`

### 4. Service Connections

#### Redis
```bash
# Check if Redis is running
redis-cli ping
# Should return: PONG
```

#### Ollama
```bash
# Check if Ollama is running
curl http://localhost:11434/api/tags

# Test model
curl http://localhost:11434/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "qwen2.5-coder:7b",
    "messages": [{"role": "user", "content": "test"}]
  }'
```

#### Supabase
- Verify URL is accessible
- Verify service role key has correct permissions
- Check that RLS policies allow service role access

## 🔧 Configuration Steps

### Step 1: Verify Models
```bash
ollama list
# Should show: qwen2.5-coder:7b and qwen2.5-coder:14b
```

### Step 2: Configure Environment Variables

**Worker:**
1. Copy `worker/.env.example` to `worker/.env` (if exists)
2. Set required variables (see above)

**API:**
1. Copy `api/.env.example` to `api/.env` (if exists)
2. Set required variables (see above)

**Frontend:**
1. Create `frontend/.env.local`
2. Set Supabase variables

### Step 3: Run Database Migration

1. Open Supabase Dashboard → SQL Editor
2. Run: `api/supabase-patches/2025-02-17-add-missing-columns.sql`
3. Verify columns exist:
```sql
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'test_runs' 
  AND column_name IN ('trace_url', 'stream_url');
```

### Step 4: Start Services

**Terminal 1 - Redis:**
```bash
redis-server
# Or if using Docker:
docker run -d -p 6379:6379 redis
```

**Terminal 2 - API:**
```bash
cd api
npm run dev
```

**Terminal 3 - Worker:**
```bash
cd worker
npm run dev
```

**Terminal 4 - Frontend:**
```bash
cd frontend
npm run dev
```

### Step 5: Verify Everything Works

Run the verification script:
```bash
node verify-setup.js
```

## 🧪 Testing Workflow

1. **Create a test run** via frontend
2. **Check worker logs** - should process the job
3. **Check API logs** - should update test run status
4. **Check database** - test run should be created
5. **Verify models are used** - check worker logs for model calls

## 🐛 Troubleshooting

### Models Not Found
```bash
# Re-download models
ollama pull qwen2.5-coder:7b
ollama pull qwen2.5-coder:14b
```

### Redis Connection Failed
```bash
# Check if Redis is running
redis-cli ping

# Start Redis
redis-server
# Or: docker run -d -p 6379:6379 redis
```

### Supabase Connection Failed
- Verify `SUPABASE_URL` is correct
- Verify `SUPABASE_SERVICE_ROLE_KEY` is correct
- Check Supabase dashboard for service status

### Database Schema Errors
- Run migration: `api/supabase-patches/2025-02-17-add-missing-columns.sql`
- Verify columns exist in Supabase dashboard

### Model API Errors
- Verify Ollama is running: `curl http://localhost:11434/api/tags`
- Check model names match: `qwen2.5-coder:7b` and `qwen2.5-coder:14b`
- Test model directly: Use curl command above

## ✅ Success Indicators

When everything is configured correctly:
- ✅ All services start without errors
- ✅ Worker can connect to Redis
- ✅ Worker can connect to Supabase
- ✅ Worker can call Ollama models
- ✅ API can create test runs
- ✅ Database has all required columns
- ✅ Frontend can authenticate and create tests


