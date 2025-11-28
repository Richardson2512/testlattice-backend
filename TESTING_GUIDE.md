# Testing Guide - Live Sites and Localhost

This guide explains how to test both live websites and localhost URLs with Ghost Tester.

## ✅ URL Support

The platform supports testing **both**:
- ✅ **Live Websites**: `https://example.com`, `https://github.com`, etc.
- ✅ **Localhost URLs**: `http://localhost:3000`, `http://127.0.0.1:8080`, etc.

## 🚀 Starting All Services

All three services should be running:

### 1. API Server
```bash
cd api
npm run dev
```
- Runs on: `http://localhost:3001`
- Handles test run creation and status

### 2. Worker Service
```bash
cd worker
npm run dev
```
- Processes test jobs from Redis queue
- Executes tests using Playwright

### 3. Frontend
```bash
cd frontend
npm run dev
```
- Runs on: `http://localhost:3000`
- User dashboard for creating and viewing tests

## 🌐 Testing Live Websites

### Example: Test a Live Website

1. **Open Dashboard**: Go to `http://localhost:3000` and sign in
2. **Create Test Run**: Click "+ New Test Run"
3. **Fill Form**:
   - **Project**: Select a project
   - **Build Type**: `web`
   - **Build URL**: `https://example.com` (or any live site)
   - **Device**: `chrome-latest`
   - **Max Steps**: `10`
4. **Submit**: Click "Create Test Run"
5. **Monitor**: Watch the test execute in real-time

### Supported Live Site Examples:
- `https://example.com`
- `https://github.com`
- `https://www.google.com`
- `https://your-production-site.com`
- Any publicly accessible URL

## 🏠 Testing Localhost URLs

### Example: Test a Local Development Server

1. **Start Your Local Server** (in a separate terminal):
   ```bash
   # Example: If you have a Next.js app running locally
   cd your-app
   npm run dev  # Runs on http://localhost:3000
   ```

2. **Create Test Run**:
   - **Build URL**: `http://localhost:3000` (or your local port)
   - **Build Type**: `web`
   - **Device**: `chrome-latest`

3. **Submit**: The worker will use Playwright to test your localhost app

### Supported Localhost Formats:
- `http://localhost:3000`
- `http://127.0.0.1:8080`
- `http://localhost:5173` (Vite)
- `http://localhost:8000` (Django)
- Any local development server

## ⚙️ How It Works

### URL Processing

1. **User enters URL** in the dashboard form
2. **API stores URL** in the test run `build.url` field
3. **Worker receives job** from Redis queue
4. **Playwright navigates** to the URL:
   ```typescript
   // In testProcessor.ts
   if (build.type === BuildType.WEB && build.url) {
     await runner.executeAction(session.id, {
       action: 'navigate',
       value: build.url,  // Can be localhost or live site
     })
   }
   ```
5. **Playwright can access**:
   - ✅ Live sites (public internet)
   - ✅ Localhost (same machine as worker)

### Important Notes

**For Localhost Testing**:
- ✅ Worker must run on the **same machine** as your local server
- ✅ Localhost URLs work because Playwright runs locally
- ✅ No network restrictions for localhost

**For Live Site Testing**:
- ✅ Worker can test any publicly accessible URL
- ✅ Works from any location
- ✅ Requires internet connection

## 📝 Example Test Scenarios

### Scenario 1: Test Production Website
```json
{
  "build": {
    "type": "web",
    "url": "https://myapp.com"
  },
  "profile": {
    "device": "chrome-latest"
  }
}
```

### Scenario 2: Test Local Development
```json
{
  "build": {
    "type": "web",
    "url": "http://localhost:3000"
  },
  "profile": {
    "device": "chrome-latest"
  }
}
```

### Scenario 3: Test Staging Environment
```json
{
  "build": {
    "type": "web",
    "url": "https://staging.myapp.com"
  },
  "profile": {
    "device": "firefox-latest"
  }
}
```

## 🔍 Verifying URL Support

### Test 1: Live Site
1. Create test with URL: `https://example.com`
2. Check worker logs - should see: `Navigate to https://example.com`
3. Check test results - should have screenshots from example.com

### Test 2: Localhost
1. Start a local server (e.g., `python -m http.server 8000`)
2. Create test with URL: `http://localhost:8000`
3. Check worker logs - should see: `Navigate to http://localhost:8000`
4. Check test results - should have screenshots from localhost

## 🎯 Current Status

**URL Support**: ✅ **Fully Functional**
- ✅ Live websites work
- ✅ Localhost URLs work
- ✅ Any valid HTTP/HTTPS URL supported
- ✅ Playwright handles both seamlessly

**Services Status**:
- ✅ API Server: Ready
- ✅ Worker Service: Ready
- ✅ Frontend: Ready
- ✅ Playwright: Installed and configured

## 🚨 Troubleshooting

### Localhost Not Accessible
- **Issue**: Worker can't reach localhost URL
- **Solution**: Ensure worker runs on the same machine as your local server
- **Check**: Verify local server is running before creating test

### Live Site Timeout
- **Issue**: Live site takes too long to load
- **Solution**: Increase timeout in Playwright configuration
- **Check**: Verify site is publicly accessible

### CORS Issues
- **Issue**: Some sites block automated access
- **Solution**: This is expected - some sites detect and block bots
- **Workaround**: Test sites that allow automation

---

**Ready to Test!** The platform supports both live sites and localhost URLs. Just enter the URL in the dashboard and create a test run.

