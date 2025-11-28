# How to Start All Servers

## 🚀 Quick Start

You need **3 terminal windows** running simultaneously:

### Terminal 1: API Server
```bash
cd api
npm run dev
```
**Should show**: `Server listening on http://0.0.0.0:3001`

### Terminal 2: Worker Service
```bash
cd worker
npm run dev
```
**Should show**: `Worker started, waiting for jobs...`

### Terminal 3: Frontend
```bash
cd frontend
npm run dev
```
**Should show**: `Ready on http://localhost:3000`

## ✅ Verify All Services

### Check API Server
```bash
curl http://localhost:3001/health
# Should return: {"status":"ok","timestamp":"..."}
```

Or visit in browser: `http://localhost:3001/health`

### Check Frontend
Visit: `http://localhost:3000`

### Check Worker
Look at the worker terminal - should show:
```
Worker started, waiting for jobs...
Concurrency: 5
```

## 🔧 Troubleshooting

### API Server Not Starting

**Check if port 3001 is in use**:
```powershell
netstat -ano | findstr :3001
```

**Kill process if needed**:
```powershell
# Find the PID from netstat output, then:
taskkill /PID <PID> /F
```

**Check for errors**:
- Look at the API server terminal for error messages
- Check `api/.env` file exists and has correct values
- Verify Node.js is installed: `node --version`

### Frontend Can't Connect to API

**Error**: `Cannot connect to API server at http://localhost:3001`

**Solutions**:
1. ✅ Make sure API server is running (Terminal 1)
2. ✅ Check API server is on port 3001
3. ✅ Verify `NEXT_PUBLIC_API_URL` in `frontend/.env.local` (optional)
4. ✅ Check browser console for CORS errors

### Port Already in Use

If you get "port already in use" error:

**Windows**:
```powershell
# Find process using port 3001
netstat -ano | findstr :3001

# Kill the process (replace <PID> with actual PID)
taskkill /PID <PID> /F
```

**Or change the port** in `api/src/config/env.ts`:
```typescript
port: parseInt(process.env.PORT || '3002', 10), // Change to 3002
```

## 📋 Service Status Checklist

Before creating a project or test run, verify:

- [ ] ✅ API Server running on port 3001
- [ ] ✅ Worker Service running (check terminal)
- [ ] ✅ Frontend running on port 3000
- [ ] ✅ API health check works: `http://localhost:3001/health`
- [ ] ✅ Frontend can access: `http://localhost:3000`
- [ ] ✅ No errors in any terminal

## 🎯 Quick Test

1. **Start all 3 services** (see above)
2. **Open browser**: `http://localhost:3000`
3. **Sign in** to your account
4. **Try creating a project** - should work now!

---

**Remember**: All 3 services must be running for the platform to work!

