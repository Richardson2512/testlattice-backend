# WebRTC Live Streaming & Real-Time Test Control

This document describes the WebRTC live streaming implementation with real-time test control features.

## Features Implemented

### 1. **Real-Time Browser Playback**
- Watch test execution live as it happens
- HTTP-based frame streaming (MVP) - upgradeable to full WebRTC
- Low-latency video feed from Playwright browser sessions

### 2. **Pause/Resume Controls**
- Pause test execution at any point
- Resume from where you left off
- Step-by-step replay of completed steps

### 3. **Live AI Step Override**
- Override AI-generated actions in real-time
- Inject manual actions (click, type, scroll, navigate)
- Take control when AI gets stuck

### 4. **Mid-Run Instruction Modification**
- Update test instructions while test is running
- Change goals and objectives dynamically
- AI adapts to new instructions immediately

## Architecture

```
┌─────────────────────────────────────────┐
│  Frontend (LiveStreamPlayer)             │
│  ├─ HTTP Frame Polling (MVP)            │
│  ├─ WebRTC (LiveKit) - Future            │
│  ├─ WebSocket Control                    │
│  └─ Real-time Controls UI                │
└──────┬───────────────────────────────────┘
       │ HTTP + WebSocket
       ↓
┌─────────────────────────────────────────┐
│  API Server                              │
│  ├─ /api/tests/:runId/stream            │
│  ├─ /api/tests/:runId/override-step     │
│  ├─ /api/tests/:runId/update-instructions│
│  ├─ /api/tests/:runId/steps/:stepNumber │
│  └─ WebSocket Server (/ws/test-control) │
└──────┬───────────────────────────────────┘
       │
       ↓
┌─────────────────────────────────────────┐
│  Worker Service                          │
│  ├─ WebRTCStreamer                      │
│  │  ├─ CDP Screencast (Playwright)      │
│  │  ├─ Frame Server (HTTP :8080)        │
│  │  └─ LiveKit Integration (optional)   │
│  ├─ TestProcessor                       │
│  │  └─ Streams during test execution    │
│  └─ WebSocket Client                    │
└─────────────────────────────────────────┘
```

## Setup

### 1. Environment Variables

**Worker (`worker/.env`):**
```env
# Enable streaming
ENABLE_STREAMING=true
FRAME_SERVER_PORT=8080

# Optional: LiveKit for full WebRTC (future upgrade)
LIVEKIT_URL=wss://your-livekit-server.com
LIVEKIT_API_KEY=your-api-key
LIVEKIT_API_SECRET=your-api-secret
```

**API (`api/.env`):**
```env
# Frame stream base URL (for frontend)
FRAME_STREAM_BASE_URL=http://localhost:8080
```

**Frontend (`frontend/.env.local`):**
```env
NEXT_PUBLIC_API_URL=http://localhost:3001
```

### 2. Install Dependencies

**Worker:**
```bash
cd worker
npm install livekit-server-sdk
```

**Frontend:**
```bash
cd frontend
npm install livekit-client
```

### 3. Start Services

1. **Start API Server:**
```bash
cd api
npm run dev
```

2. **Start Worker:**
```bash
cd worker
npm run dev
```

3. **Start Frontend:**
```bash
cd frontend
npm run dev
```

## Usage

### Frontend Integration

```tsx
import LiveStreamPlayer from '@/components/LiveStreamPlayer'

function TestRunPage({ runId }: { runId: string }) {
  const [streamInfo, setStreamInfo] = useState<any>(null)
  
  useEffect(() => {
    // Get stream info
    api.getStreamInfo(runId).then(setStreamInfo)
  }, [runId])

  return (
    <LiveStreamPlayer
      runId={runId}
      streamUrl={streamInfo?.streamUrl}
      livekitUrl={streamInfo?.livekitUrl}
      livekitToken={streamInfo?.token}
      onPause={() => api.pauseTestRun(runId)}
      onResume={() => api.resumeTestRun(runId)}
      onStepOverride={(action) => api.overrideStep(runId, action)}
      onInstructionUpdate={(instructions) => 
        api.updateInstructions(runId, instructions)
      }
      isPaused={testRun?.paused}
      currentStep={testRun?.currentStep}
      totalSteps={testRun?.steps?.length}
    />
  )
}
```

### WebSocket Control

Connect to WebSocket for real-time updates:

```typescript
const ws = new WebSocket(`ws://localhost:3001/ws/test-control?runId=${runId}`)

ws.onmessage = (event) => {
  const message = JSON.parse(event.data)
  
  switch (message.type) {
    case 'stream_available':
      // Stream URL available
      console.log('Stream:', message.streamUrl)
      break
    case 'test_step':
      // New step completed
      console.log('Step:', message.step)
      break
    case 'step_override_queued':
      // Step override queued
      console.log('Override:', message.action)
      break
    case 'instructions_updated':
      // Instructions updated
      console.log('New instructions:', message.instructions)
      break
  }
}

// Send control commands
ws.send(JSON.stringify({
  type: 'pause'
}))

ws.send(JSON.stringify({
  type: 'step_override',
  action: {
    type: 'click',
    selector: '#button'
  }
}))

ws.send(JSON.stringify({
  type: 'update_instructions',
  instructions: 'Focus on testing the checkout flow'
}))
```

## API Endpoints

### GET `/api/tests/:runId/stream`
Get stream URL and token for live viewing.

**Response:**
```json
{
  "streamUrl": "http://localhost:8080/stream/{runId}",
  "livekitUrl": "wss://...",
  "token": "eyJ..."
}
```

### POST `/api/tests/:runId/override-step`
Override next AI step with manual action.

**Request:**
```json
{
  "action": {
    "type": "click",
    "selector": "#button",
    "value": "optional"
  }
}
```

### POST `/api/tests/:runId/update-instructions`
Update test instructions mid-run.

**Request:**
```json
{
  "instructions": "Focus on testing the payment flow"
}
```

### GET `/api/tests/:runId/steps/:stepNumber`
Get step data for replay.

**Response:**
```json
{
  "step": {
    "stepNumber": 1,
    "action": "click",
    "target": "#button",
    "screenshotUrl": "...",
    "timestamp": "..."
  }
}
```

## WebSocket Messages

### Client → Server

**Pause:**
```json
{ "type": "pause" }
```

**Resume:**
```json
{ "type": "resume" }
```

**Step Override:**
```json
{
  "type": "step_override",
  "action": {
    "type": "click",
    "selector": "#button"
  }
}
```

**Update Instructions:**
```json
{
  "type": "update_instructions",
  "instructions": "New instructions"
}
```

**Replay Step:**
```json
{
  "type": "replay_step",
  "stepNumber": 5
}
```

### Server → Client

**Stream Available:**
```json
{
  "type": "stream_available",
  "streamUrl": "http://...",
  "token": "..."
}
```

**Test Step:**
```json
{
  "type": "test_step",
  "step": { ... }
}
```

**Step Override Queued:**
```json
{
  "type": "step_override_queued",
  "action": { ... }
}
```

**Instructions Updated:**
```json
{
  "type": "instructions_updated",
  "instructions": "..."
}
```

## Implementation Details

### Frame Streaming (MVP)

The current implementation uses HTTP-based frame streaming:

1. **Worker** captures frames via Playwright CDP screencast
2. **Frame Server** (HTTP :8080) serves latest frame as JPEG
3. **Frontend** polls frame endpoint every 100ms (~10fps)
4. **Canvas** displays frames for real-time viewing

**Advantages:**
- Simple, no additional infrastructure
- Works immediately
- Low latency (~100-200ms)

**Limitations:**
- Polling overhead
- Not true WebRTC (higher latency)
- Single viewer optimal

### Future: Full WebRTC Upgrade

To upgrade to full WebRTC:

1. **Set up LiveKit server** (self-hosted or cloud)
2. **Configure LiveKit credentials** in worker env
3. **Update WebRTCStreamer** to use LiveKit SDK for publishing
4. **Frontend** automatically switches to WebRTC mode when token available

Benefits:
- True real-time streaming (<100ms latency)
- Multiple simultaneous viewers
- Adaptive bitrate
- Better quality

## Troubleshooting

### Stream not showing
- Check `ENABLE_STREAMING=true` in worker/.env
- Verify frame server port (default: 8080) is available
- Check worker logs for streaming errors

### WebSocket not connecting
- Verify API server is running on port 3001
- Check WebSocket path: `/ws/test-control?runId={runId}`
- Check browser console for connection errors

### Step override not working
- Ensure test is in `running` or `diagnosing` status
- Check WebSocket connection is active
- Verify worker is processing WebSocket messages

## Performance Considerations

- **Frame Rate:** Default 10fps (configurable)
- **Bandwidth:** ~500KB/s per viewer (JPEG frames)
- **Latency:** ~100-200ms (HTTP polling)
- **Storage:** No storage required (streaming only)

## Security

- Stream URLs are scoped to runId
- WebSocket requires runId parameter
- API endpoints validate test run ownership
- Frame server has no authentication (local network only)

For production:
- Add authentication to frame server
- Use HTTPS/WSS
- Implement rate limiting
- Add viewer authentication

