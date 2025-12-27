# Quick Start Guide

Get Ghost Tester up and running in minutes!

## 🚀 Starting All Services

### Option 1: Manual Start (Recommended for Development)

Open **3 separate terminal windows**:

**Terminal 1 - API Server**:
```bash
cd api
npm run dev
```
✅ Should show: `Server listening on http://0.0.0.0:3001`

**Terminal 2 - Worker Service**:
```bash
cd worker
npm run dev
```
✅ Should show: `Worker started, waiting for jobs...`

**Terminal 3 - Frontend**:
```bash
cd frontend
npm run dev
```
✅ Should show: `Ready on http://localhost:3000`

### Option 2: Background Start (Windows PowerShell)

All services have been started in background PowerShell windows. Check the minimized windows for logs.

## 🌐 Access the Platform

1. **Open Browser**: `http://localhost:3000`
2. **Sign Up**: Create a new account
3. **Sign In**: Log in with your credentials
4. **Dashboard**: You'll see the test runs dashboard

## 🧪 Creating Your First Test

### Test a Live Website

1. Click **"+ New Test Run"** button
2. Fill the form:
   - **Project**: Select a project (or create one first)
   - **Build Type**: `web`
   - **Build URL**: `https://example.com` (or any live site)
   - **Device**: `chrome-latest`
   - **Max Steps**: `10`
3. Click **"Create Test Run"**
4. Watch the test execute in real-time!

### Test a Localhost Application

1. **Start your local server** first (e.g., `npm run dev` on port 3000)
2. Click **"+ New Test Run"**
3. Fill the form:
   - **Build Type**: `web`
   - **Build URL**: `http://localhost:3000` (your local server)
   - **Device**: `chrome-latest`
4. Click **"Create Test Run"**
5. Worker will test your localhost app!

## ✅ Verify Everything Works

### Check Services

1. **API Health**: Visit `http://localhost:3001/health`
   - Should return: `{"status":"ok","timestamp":"..."}`

2. **Frontend**: Visit `http://localhost:3000`
   - Should show login/signup page

3. **Worker Logs**: Check the worker terminal
   - Should show: `Worker started, waiting for jobs...`

### Test Sentry (Optional)

Visit: `http://localhost:3001/debug-sentry`
- Should throw an error
- Check your Sentry dashboard for the error

## 📋 Supported URLs

### ✅ Live Websites
- `https://example.com`
- `https://github.com`
- `https://www.google.com`
- Any publicly accessible URL

### ✅ Localhost URLs
- `http://localhost:3000`
- `http://127.0.0.1:8080`
- `http://localhost:5173`
- Any local development server

## 🎯 Example Test Scenarios

### Scenario 1: Test Google
```json
{
  "build": { "type": "web", "url": "https://www.google.com" },
  "profile": { "device": "chrome-latest" }
}
```

### Scenario 2: Test Your Local App
```json
{
  "build": { "type": "web", "url": "http://localhost:3000" },
  "profile": { "device": "chrome-latest" }
}
```

### Scenario 3: Test Production Site
```json
{
  "build": { "type": "web", "url": "https://your-production-site.com" },
  "profile": { "device": "firefox-latest" }
}
```

## 🔧 Troubleshooting

### Services Won't Start
- Check if ports are in use: `netstat -ano | findstr :3000`
- Kill existing processes if needed
- Ensure Redis is accessible (check `worker/.env`)

### Can't Access Frontend
- Verify frontend is running: `http://localhost:3000`
- Check browser console for errors
- Verify `NEXT_PUBLIC_API_URL` in `frontend/.env.local`

### Tests Not Running
- Check worker logs for errors
- Verify Redis connection
- Check Playwright browsers are installed: `npx playwright install`

### Localhost Not Working
- Ensure your local server is running
- Verify the URL matches your server port
- Check worker can access localhost (same machine)

## 📊 Service Status

| Service | Port | Status Check |
|---------|------|--------------|
| Frontend | 3000 | http://localhost:3000 |
| API | 3001 | http://localhost:3001/health |
| Worker | - | Check terminal logs |
| Redis | 6379 | Cloud Redis Labs (configured) |

## 🎉 You're Ready!

All services are configured and ready:
- ✅ Authentication (Supabase)
- ✅ Database (Supabase)
- ✅ Job Queue (Redis)
- ✅ Web Testing (Playwright)
- ✅ Error Tracking (Sentry)
- ✅ AI/LLM (Llama 4 & Qwen via Ollama)


**Start testing!** 🚀
