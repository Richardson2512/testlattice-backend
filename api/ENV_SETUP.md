# API Server Environment Variables Setup

## ❌ Error: "supabaseUrl is required"

This error means the `api/.env` file is missing or doesn't have the required Supabase configuration.

## ✅ Solution: Create `api/.env` File

### Step 1: Create the File

In the `api` directory, create a file named `.env` (no extension).

**Windows PowerShell**:
```powershell
cd C:\Users\AMD\ghost-tester\api
New-Item -Path .env -ItemType File
```

**Or manually**:
1. Navigate to `C:\Users\AMD\ghost-tester\api`
2. Create a new file named `.env` (make sure it's not `.env.txt`)

### Step 2: Add This Content

Copy and paste this entire content into the `.env` file:

```env
# Supabase Configuration
SUPABASE_URL=https://txiidsabckkuzhsfzekr.supabase.co
SUPABASE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR4aWlkc2FiY2trdXpoc2Z6ZWtyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMzNzUwMzIsImV4cCI6MjA3ODk1MTAzMn0.h5GwLKnfwBaqWxsdijAdQP5eZiv_q0w36F_di9nlxlw
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR4aWlkc2FiY2trdXpoc2Z6ZWtyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzM3NTAzMiwiZXhwIjoyMDc4OTUxMDMyfQ.FLUfoKy7hd5I00RpqrcBP7D2PWWYG70H04lO-Rxspc4

# Redis Configuration
REDIS_URL=redis://default:rWoyaB8mX9IeH1e1jV5UUhzmHZrMSPqh@redis-17888.c62.us-east-1-4.ec2.cloud.redislabs.com:17888

# Llama 4 (Local Ollama)
LLAMA_API_KEY=ollama
LLAMA_API_URL=http://localhost:11434/v1
LLAMA_MODEL=llama3.2:latest

# Qwen Instruct (Local Ollama)
QWEN_API_KEY=ollama
QWEN_API_URL=http://localhost:11434/v1
QWEN_MODEL=qwen2.5:latest

# Pinecone Configuration
PINECONE_API_KEY=pcsk_3DXKLG_RVif7NDP1SjVQV8WkFpyfa1tvfZcWkKoERzqgnc6wmfvqGXXqDrgBev3rSBSgzr
PINECONE_INDEX_NAME=ghost-tester

# Sentry Configuration
SENTRY_DSN=https://3d1c29d4bc40d1138df36bb9a9cfc70e@o4510386978357248.ingest.us.sentry.io/4510386990350336

# Server Configuration
PORT=3001
HOST=0.0.0.0
NODE_ENV=development
APP_URL=http://localhost:3000

# Stripe (not configured - not needed)
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=

# WebRTC Live Streaming Configuration
FRAME_STREAM_BASE_URL=http://localhost:8080

# Optional: LiveKit Configuration (for future WebRTC upgrade)
# LIVEKIT_URL=wss://your-livekit-server.com
# LIVEKIT_API_KEY=your-api-key
# LIVEKIT_API_SECRET=your-api-secret
```

### Step 3: Save the File

Make sure to save the file as `.env` (not `.env.txt`).

**Windows Note**: If Windows adds `.txt` extension:
1. Right-click the file
2. Rename it to `.env`
3. Remove the `.txt` extension

### Step 4: Restart API Server

After creating the `.env` file:

1. **Stop the API server** (Ctrl+C in the terminal)
2. **Start it again**:
   ```bash
   cd api
   npm run dev
   ```

### Step 5: Verify

You should see:
```
Server listening on http://0.0.0.0:3001
```

**No more errors about supabaseUrl!**

## 🔍 Quick Verification

After creating `.env` and restarting, test:

```bash
curl http://localhost:3001/health
```

Should return: `{"status":"ok","timestamp":"..."}`

## 📋 File Location

The `.env` file should be at:
```
C:\Users\AMD\ghost-tester\api\.env
```

## ⚠️ Important Notes

1. **Never commit `.env` to git** - It contains sensitive keys
2. **Keep it secure** - Don't share your `.env` file
3. **Restart required** - API server must be restarted after creating/updating `.env`

---

**After creating the `.env` file and restarting the API server, the error should be resolved!**

