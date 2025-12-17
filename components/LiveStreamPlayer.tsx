'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { Room, RemoteParticipant, RemoteTrack, Track } from 'livekit-client'

interface LiveStreamPlayerProps {
  runId: string
  streamUrl?: string // HTTP frame stream URL (MVP)
  livekitUrl?: string // LiveKit server URL (for WebRTC upgrade)
  livekitToken?: string // LiveKit access token
  onPause?: () => void
  onResume?: () => void
  onStepOverride?: (action: { type: string; selector?: string; value?: string }) => void
  onInstructionUpdate?: (instructions: string) => void
  isPaused?: boolean
  currentStep?: number
  totalSteps?: number
}

export default function LiveStreamPlayer({
  runId,
  streamUrl,
  livekitUrl,
  livekitToken,
  onPause,
  onResume,
  onStepOverride,
  onInstructionUpdate,
  isPaused = false,
  currentStep = 0,
  totalSteps = 0,
}: LiveStreamPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [room, setRoom] = useState<Room | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [streamMode, setStreamMode] = useState<'http' | 'webrtc'>('http')
  const [error, setError] = useState<string | null>(null)
  const frameIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const [playbackStep, setPlaybackStep] = useState(currentStep)
  const [isReplaying, setIsReplaying] = useState(false)
  const [overrideAction, setOverrideAction] = useState<{ type: string; selector?: string; value?: string } | null>(null)
  const [customInstructions, setCustomInstructions] = useState('')

  // Connect to LiveKit (WebRTC) if available
  useEffect(() => {
    if (livekitUrl && livekitToken && streamMode === 'webrtc') {
      connectToLiveKit()
    }

    return () => {
      if (room) {
        room.disconnect()
      }
      if (frameIntervalRef.current) {
        clearInterval(frameIntervalRef.current)
      }
    }
  }, [livekitUrl, livekitToken, streamMode])

  // HTTP frame streaming (MVP)
  useEffect(() => {
    if (streamUrl && streamMode === 'http' && !isReplaying) {
      startHttpStreaming()
    }

    return () => {
      if (frameIntervalRef.current) {
        clearInterval(frameIntervalRef.current)
      }
    }
  }, [streamUrl, streamMode, isReplaying])

  const connectToLiveKit = async () => {
    try {
      if (!livekitUrl || !livekitToken) return

      const newRoom = new Room({
        adaptiveStream: true,
        dynacast: true,
      })

      newRoom.on('trackSubscribed', (track: RemoteTrack, publication: any, participant: RemoteParticipant) => {
        if (track.kind === Track.Kind.Video && videoRef.current) {
          track.attach(videoRef.current)
        }
      })

      newRoom.on('disconnected', () => {
        setIsConnected(false)
        setError('Disconnected from stream')
      })

      await newRoom.connect(livekitUrl, livekitToken)
      setRoom(newRoom)
      setIsConnected(true)
      setError(null)
    } catch (err: any) {
      console.error('Failed to connect to LiveKit:', err)
      setError(`Failed to connect: ${err.message}`)
      // Fallback to HTTP streaming
      setStreamMode('http')
    }
  }

  const startHttpStreaming = () => {
    if (!streamUrl || !canvasRef.current) return

    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Poll for latest frame
    frameIntervalRef.current = setInterval(async () => {
      try {
        const response = await fetch(`${streamUrl}?t=${Date.now()}`, {
          cache: 'no-cache',
        })

        if (response.ok && response.headers.get('content-type')?.includes('image')) {
          const blob = await response.blob()
          const img = new Image()
          img.onload = () => {
            canvas.width = img.width
            canvas.height = img.height
            ctx.drawImage(img, 0, 0)
          }
          img.src = URL.createObjectURL(blob)
        }
      } catch (err) {
        // Ignore errors (stream might be paused)
      }
    }, 100) // 10fps polling
  }

  const handlePause = useCallback(() => {
    onPause?.()
  }, [onPause])

  const handleResume = useCallback(() => {
    onResume?.()
  }, [onResume])

  const handleStepBack = useCallback(() => {
    if (playbackStep > 0) {
      setPlaybackStep(playbackStep - 1)
      setIsReplaying(true)
      // TODO: Load step screenshot from API
    }
  }, [playbackStep])

  const handleStepForward = useCallback(() => {
    if (playbackStep < (totalSteps || 0)) {
      setPlaybackStep(playbackStep + 1)
      setIsReplaying(true)
      // TODO: Load step screenshot from API
    }
  }, [playbackStep, totalSteps])

  const handleOverrideAction = useCallback(() => {
    if (overrideAction) {
      onStepOverride?.(overrideAction)
      setOverrideAction(null)
    }
  }, [overrideAction, onStepOverride])

  const handleUpdateInstructions = useCallback(() => {
    if (customInstructions.trim()) {
      onInstructionUpdate?.(customInstructions)
      setCustomInstructions('')
    }
  }, [customInstructions, onInstructionUpdate])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Video Display */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          backgroundColor: '#000',
          borderRadius: '8px',
          overflow: 'hidden',
          aspectRatio: '16/9',
        }}
      >
        {/* WebRTC Video (if connected) */}
        {streamMode === 'webrtc' && isConnected && (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'contain',
            }}
          />
        )}

        {/* HTTP Frame Stream (MVP) */}
        {streamMode === 'http' && (
          <canvas
            ref={canvasRef}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'contain',
            }}
          />
        )}

        {/* Status Overlay */}
        <div
          style={{
            position: 'absolute',
            top: '8px',
            left: '8px',
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            color: '#fff',
            padding: '4px 8px',
            borderRadius: '4px',
            fontSize: '12px',
          }}
        >
          {isConnected ? '● Live' : '○ Offline'} | Step {playbackStep}/{totalSteps}
        </div>

        {/* Error Message */}
        {error && (
          <div
            style={{
              position: 'absolute',
              bottom: '8px',
              left: '8px',
              right: '8px',
              backgroundColor: 'rgba(255, 0, 0, 0.8)',
              color: '#fff',
              padding: '8px',
              borderRadius: '4px',
              fontSize: '12px',
            }}
          >
            {error}
          </div>
        )}
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {/* Playback Controls */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button
            onClick={handlePause}
            disabled={isPaused}
            style={{
              padding: '8px 16px',
              backgroundColor: isPaused ? '#ccc' : '#f44336',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              cursor: isPaused ? 'not-allowed' : 'pointer',
            }}
          >
            ⏸ Pause
          </button>
          <button
            onClick={handleResume}
            disabled={!isPaused}
            style={{
              padding: '8px 16px',
              backgroundColor: !isPaused ? '#ccc' : '#4caf50',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              cursor: !isPaused ? 'not-allowed' : 'pointer',
            }}
          >
            ▶ Resume
          </button>
          <button
            onClick={handleStepBack}
            disabled={playbackStep === 0}
            style={{
              padding: '8px 16px',
              backgroundColor: playbackStep === 0 ? '#ccc' : '#2196f3',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              cursor: playbackStep === 0 ? 'not-allowed' : 'pointer',
            }}
          >
            ⏮ Step Back
          </button>
          <button
            onClick={handleStepForward}
            disabled={playbackStep >= (totalSteps || 0)}
            style={{
              padding: '8px 16px',
              backgroundColor: playbackStep >= (totalSteps || 0) ? '#ccc' : '#2196f3',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              cursor: playbackStep >= (totalSteps || 0) ? 'not-allowed' : 'pointer',
            }}
          >
            ⏭ Step Forward
          </button>
        </div>

        {/* Step Override */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <label style={{ fontSize: '14px', fontWeight: 'bold' }}>Override Next AI Step:</label>
          <div style={{ display: 'flex', gap: '8px' }}>
            <select
              value={overrideAction?.type || ''}
              onChange={(e) => setOverrideAction({ ...overrideAction, type: e.target.value } as any)}
              style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
            >
              <option value="">Select action...</option>
              <option value="click">Click</option>
              <option value="type">Type</option>
              <option value="scroll">Scroll</option>
              <option value="navigate">Navigate</option>
            </select>
            {overrideAction?.type && (
              <>
                <input
                  type="text"
                  placeholder="Selector (e.g., #button)"
                  value={overrideAction.selector || ''}
                  onChange={(e) => setOverrideAction({ ...overrideAction, selector: e.target.value })}
                  style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc', flex: 1 }}
                />
                {(overrideAction.type === 'type' || overrideAction.type === 'navigate') && (
                  <input
                    type="text"
                    placeholder="Value"
                    value={overrideAction.value || ''}
                    onChange={(e) => setOverrideAction({ ...overrideAction, value: e.target.value })}
                    style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc', flex: 1 }}
                  />
                )}
                <button
                  onClick={handleOverrideAction}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: '#ff9800',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                  }}
                >
                  Override
                </button>
              </>
            )}
          </div>
        </div>

        {/* Instruction Update */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <label style={{ fontSize: '14px', fontWeight: 'bold' }}>Update Test Instructions:</label>
          <div style={{ display: 'flex', gap: '8px' }}>
            <textarea
              placeholder="Enter new instructions for the AI..."
              value={customInstructions}
              onChange={(e) => setCustomInstructions(e.target.value)}
              style={{
                padding: '8px',
                borderRadius: '4px',
                border: '1px solid #ccc',
                flex: 1,
                minHeight: '60px',
                resize: 'vertical',
              }}
            />
            <button
              onClick={handleUpdateInstructions}
              disabled={!customInstructions.trim()}
              style={{
                padding: '8px 16px',
                backgroundColor: customInstructions.trim() ? '#9c27b0' : '#ccc',
                color: '#fff',
                border: 'none',
                borderRadius: '4px',
                cursor: customInstructions.trim() ? 'pointer' : 'not-allowed',
              }}
            >
              Update
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

