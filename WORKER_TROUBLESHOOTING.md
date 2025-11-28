# Worker Troubleshooting Guide

## Issue: Tests showing as "queued" but not running

### Common Causes:

1. **Worker server is not running**
   - Check if worker process is running: `ps aux | grep worker` (Linux/Mac) or check Task Manager (Windows)
   - Start worker: `cd worker && npm run dev`

2. **Redis connection issue**
   - Check if Redis is running: `redis-cli ping` (should return `PONG`)
   - Verify `REDIS_URL` in `worker/.env` matches your Redis instance
   - Check worker logs for Redis connection errors

3. **Queue name mismatch**
   - API uses queue name: `test-runner`
   - Worker listens to queue: `test-runner`
   - Job type: `test-run`
   - ✅ These should match (they do in current code)

4. **Environment variables missing**
   - Check `worker/.env` has:
     - `REDIS_URL` (required)
     - `SUPABASE_URL` (required)
     - `SUPABASE_KEY` (required)
     - `LLAMA_API_KEY` (required for local Ollama, or use cloud API)
     - `QWEN_API_KEY` (required for local Ollama, or use cloud API)
     - `API_URL` (optional, defaults to http://localhost:3001)

5. **Worker not processing jobs**
   - Check worker logs for errors
   - Verify worker shows: "Worker started, waiting for jobs..."
   - Check if jobs are being added to queue but not processed

### Debugging Steps:

1. **Check Worker Status**
   ```bash
   cd worker
   npm run dev
   ```
   Look for: "Worker started, waiting for jobs..."

2. **Check Redis Connection**
   ```bash
   redis-cli ping
   ```
   Should return: `PONG`

3. **Check Queue in Redis**
   ```bash
   redis-cli
   > KEYS bull:test-runner:*
   > LLEN bull:test-runner:wait
   > LLEN bull:test-runner:active
   ```
   - `wait` list should have queued jobs
   - `active` list should have jobs being processed

4. **Check Worker Logs**
   - Look for connection errors
   - Look for job processing messages
   - Look for any exceptions

5. **Verify API is enqueueing**
   - Check API logs when creating test run
   - Should see: "Test run enqueued" or similar
   - Check for Redis connection errors in API logs

### Quick Fixes:

1. **Restart Worker**
   ```bash
   cd worker
   npm run dev
   ```

2. **Restart Redis**
   ```bash
   # Windows (if using Redis via WSL or Docker)
   # Linux/Mac
   sudo systemctl restart redis
   # Or if using Docker:
   docker restart redis
   ```

3. **Check Environment Variables**
   ```bash
   cd worker
   cat .env
   ```
   Ensure all required variables are set

4. **Clear Queue (if stuck)**
   ```bash
   redis-cli
   > FLUSHDB
   ```
   ⚠️ This will clear ALL Redis data!

### Expected Worker Output:

```
✅ .env file loaded successfully
PINECONE_API_KEY: ✅ Set
REDIS_URL: ✅ Set
LLAMA_API_KEY: ✅ Set
QWEN_API_KEY: ✅ Set
Worker started, waiting for jobs...
Concurrency: 5
Playwright Grid: http://localhost:4444
Appium: http://localhost:4723
→ Job test-xxx started processing
[xxx] Processing test job: web chrome-latest
```

### If Worker Shows Errors:

1. **Redis Connection Error**
   - Fix: Ensure Redis is running and `REDIS_URL` is correct

2. **Missing Environment Variables**
   - Fix: Add missing variables to `worker/.env`

3. **API Connection Error**
   - Fix: Ensure API server is running on port 3001

4. **Llama/Qwen API Error**
   - Fix: Verify Ollama is running (`ollama serve`) or cloud API keys are valid
   - For local: Ensure models are pulled (`ollama pull llama3.2:latest` and `ollama pull qwen2.5:latest`)

