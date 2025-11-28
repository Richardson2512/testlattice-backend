# WebRTC Live Streaming Environment Setup

This guide helps you configure environment variables for the WebRTC live streaming feature.

## Quick Setup

### 1. API Server (`api/.env`)

Add these variables to your existing `api/.env` file:

```env
# WebRTC Live Streaming Configuration
FRAME_STREAM_BASE_URL=http://localhost:8080
```

**Full example:**
```env
# ... your existing variables ...

# WebRTC Live Streaming
FRAME_STREAM_BASE_URL=http://localhost:8080

# Optional: LiveKit (for future WebRTC upgrade)
# LIVEKIT_URL=wss://your-livekit-server.com
# LIVEKIT_API_KEY=your-api-key
# LIVEKIT_API_SECRET=your-api-secret
```

### 2. Worker Service (`worker/.env`)

Create or update `worker/.env` with:

```env
# WebRTC Live Streaming Configuration
ENABLE_STREAMING=true
FRAME_SERVER_PORT=8080

# Optional: LiveKit (for full WebRTC upgrade)
# LIVEKIT_URL=wss://your-livekit-server.com
# LIVEKIT_API_KEY=your-api-key
# LIVEKIT_API_SECRET=your-api-secret
```

**Full example:**
```env
# ... your existing variables ...

# WebRTC Live Streaming
ENABLE_STREAMING=true
FRAME_SERVER_PORT=8080

# Optional: LiveKit Configuration
# LIVEKIT_URL=wss://your-livekit-server.com
# LIVEKIT_API_KEY=your-api-key
# LIVEKIT_API_SECRET=your-api-secret
```

### 3. Frontend (`frontend/.env.local`)

Create `frontend/.env.local` with:

```env
NEXT_PUBLIC_API_URL=http://localhost:3001
```

**Full example:**
```env
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Optional: LiveKit (for WebRTC upgrade)
# NEXT_PUBLIC_LIVEKIT_URL=wss://your-livekit-server.com
```

## Configuration Details

### Required Variables

#### API Server
- `FRAME_STREAM_BASE_URL` - Base URL for the frame streaming server (default: `http://localhost:8080`)

#### Worker
- `ENABLE_STREAMING` - Set to `true` to enable live streaming (default: `false`)
- `FRAME_SERVER_PORT` - Port for the HTTP frame server (default: `8080`)

#### Frontend
- `NEXT_PUBLIC_API_URL` - API server URL (default: `http://localhost:3001`)

### Optional Variables (Future WebRTC Upgrade)

If you want to upgrade to full WebRTC with LiveKit:

#### Worker
```env
LIVEKIT_URL=wss://your-livekit-server.com
LIVEKIT_API_KEY=your-api-key
LIVEKIT_API_SECRET=your-api-secret
```

#### Frontend
```env
NEXT_PUBLIC_LIVEKIT_URL=wss://your-livekit-server.com
```

## Verification

### 1. Check Worker Configuration

After setting `ENABLE_STREAMING=true`, restart the worker and check logs:

```bash
cd worker
npm run dev
```

You should see:
```
[WebRTC] Frame server started on port 8080
```

### 2. Test Frame Server

Once worker is running, test the frame server:

```bash
curl http://localhost:8080/status
```

Should return:
```json
{
  "isStreaming": false,
  "frameCount": 0
}
```

### 3. Test API Endpoint

Test the stream info endpoint:

```bash
curl http://localhost:3001/api/tests/{runId}/stream
```

Should return:
```json
{
  "streamUrl": "http://localhost:8080/stream/{runId}",
  "livekitUrl": null
}
```

## Troubleshooting

### Stream Not Starting

1. **Check `ENABLE_STREAMING` is set to `true`**
   ```bash
   # In worker/.env
   ENABLE_STREAMING=true
   ```

2. **Verify port 8080 is available**
   ```bash
   # Windows
   netstat -ano | findstr :8080
   
   # Linux/Mac
   lsof -i :8080
   ```

3. **Check worker logs for errors**
   - Look for `[WebRTC]` log messages
   - Verify frame server started successfully

### Frame Server Not Accessible

1. **Check firewall settings**
   - Port 8080 must be accessible
   - For production, use proper security

2. **Verify worker is running**
   ```bash
   cd worker
   npm run dev
   ```

3. **Test direct connection**
   ```bash
   curl http://localhost:8080/status
   ```

### WebSocket Not Connecting

1. **Verify API server is running**
   ```bash
   curl http://localhost:3001/health
   ```

2. **Check WebSocket path**
   ```
   ws://localhost:3001/ws/test-control?runId={runId}
   ```

3. **Check browser console** for connection errors

## Production Configuration

For production deployment:

### Security Considerations

1. **Frame Server Authentication**
   - Add authentication to frame server
   - Use HTTPS/WSS
   - Implement rate limiting

2. **WebSocket Security**
   - Use WSS (WebSocket Secure)
   - Add authentication tokens
   - Validate runId ownership

3. **Network Configuration**
   - Use proper domain names
   - Configure CORS correctly
   - Set up reverse proxy if needed

### Example Production Config

**API (`api/.env`):**
```env
FRAME_STREAM_BASE_URL=https://stream.yourdomain.com
NODE_ENV=production
```

**Worker (`worker/.env`):**
```env
ENABLE_STREAMING=true
FRAME_SERVER_PORT=8080
# Use environment-specific URLs
LIVEKIT_URL=wss://livekit.yourdomain.com
```

**Frontend (`frontend/.env.production`):**
```env
NEXT_PUBLIC_API_URL=https://api.yourdomain.com
NEXT_PUBLIC_LIVEKIT_URL=wss://livekit.yourdomain.com
```

## Next Steps

1. ✅ Set `ENABLE_STREAMING=true` in worker/.env
2. ✅ Set `FRAME_STREAM_BASE_URL` in api/.env
3. ✅ Restart all services
4. ✅ Create a test run and verify streaming works
5. 🔄 (Optional) Set up LiveKit for full WebRTC upgrade

For more details, see [WEBRTC_LIVE_STREAMING.md](./WEBRTC_LIVE_STREAMING.md)

