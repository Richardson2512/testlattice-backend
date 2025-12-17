'use client'

import React, { useState, useEffect, useRef } from 'react'

interface LiveTestControlProps {
  testRunId: string
  onClose?: () => void
}

interface PageState {
  url: string
  screenshot: string
  elements: Array<{
    selector: string
    bounds: { x: number; y: number; width: number; height: number }
    type: string
    text?: string
  }>
}

/**
 * Live Test Control Component (Human-in-the-Loop / God Mode)
 * Allows users to intervene in real-time when AI gets stuck
 * 
 * Features:
 * - Real-time WebSocket connection
 * - Live screenshot preview
 * - Clickable element overlay
 * - Manual action injection
 * - Test pause/resume control
 */
export function LiveTestControl({ testRunId, onClose }: LiveTestControlProps) {
  const [connected, setConnected] = useState(false)
  const [pageState, setPageState] = useState<PageState | null>(null)
  const [testStatus, setTestStatus] = useState<string>('running')
  const [aiStuck, setAiStuck] = useState(false)
  const [stuckMessage, setStuckMessage] = useState('')
  const [selectedElement, setSelectedElement] = useState<any>(null)
  const [actionType, setActionType] = useState<'click' | 'type' | 'scroll'>('click')
  const [inputValue, setInputValue] = useState('')
  const [injecting, setInjecting] = useState(false)
  const wsRef = useRef<WebSocket | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // WebSocket connection
  useEffect(() => {
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3001'
    const ws = new WebSocket(`${wsUrl}/ws/test-control?runId=${testRunId}`)

    ws.onopen = () => {
      console.log('WebSocket connected')
      setConnected(true)
    }

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data)
        handleWebSocketMessage(message)
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error)
      }
    }

    ws.onerror = (error) => {
      console.error('WebSocket error:', error)
      setConnected(false)
    }

    ws.onclose = () => {
      console.log('WebSocket disconnected')
      setConnected(false)
    }

    wsRef.current = ws

    // Ping every 30 seconds to keep connection alive
    const pingInterval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'ping' }))
      }
    }, 30000)

    return () => {
      clearInterval(pingInterval)
      ws.close()
    }
  }, [testRunId])

  const handleWebSocketMessage = (message: any) => {
    switch (message.type) {
      case 'connected':
        console.log('Connected to test run:', message.runId)
        break
      case 'test_status':
        setTestStatus(message.status)
        break
      case 'page_state':
        setPageState(message.state)
        break
      case 'ai_stuck':
        setAiStuck(true)
        setStuckMessage(message.context.message)
        if (message.context.screenshot) {
          setPageState({
            url: '',
            screenshot: message.context.screenshot,
            elements: [],
          })
        }
        break
      case 'action_queued':
        console.log('Action queued:', message.action)
        setInjecting(false)
        setSelectedElement(null)
        setInputValue('')
        break
      case 'pong':
        // Keep-alive response
        break
      default:
        console.log('Unknown message type:', message.type)
    }
  }

  // Draw elements on canvas
  useEffect(() => {
    if (!pageState || !canvasRef.current) return

    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Load screenshot
    const img = new Image()
    img.onload = () => {
      canvas.width = img.width
      canvas.height = img.height
      ctx.drawImage(img, 0, 0)

      // Draw element overlays
      pageState.elements.forEach((el) => {
        ctx.strokeStyle = selectedElement?.selector === el.selector ? '#10b981' : '#3b82f6'
        ctx.lineWidth = selectedElement?.selector === el.selector ? 3 : 2
        ctx.strokeRect(el.bounds.x, el.bounds.y, el.bounds.width, el.bounds.height)

        // Draw label
        if (el.text) {
          ctx.fillStyle = 'rgba(61, 54, 48, 0.7)' // Beige overlay matching theme
          ctx.fillRect(el.bounds.x, el.bounds.y - 20, 200, 20)
          ctx.fillStyle = '#fff'
          ctx.font = '12px Arial'
          ctx.fillText(el.text.substring(0, 30), el.bounds.x + 5, el.bounds.y - 5)
        }
      })
    }
    img.src = `data:image/png;base64,${pageState.screenshot}`
  }, [pageState, selectedElement])

  const handleCanvasClick = async (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!pageState || !canvasRef.current) return

    const canvas = canvasRef.current
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    const x = (e.clientX - rect.left) * scaleX
    const y = (e.clientY - rect.top) * scaleY

    // Find clicked element
    const clicked = pageState.elements.find((el) => {
      return (
        x >= el.bounds.x &&
        x <= el.bounds.x + el.bounds.width &&
        y >= el.bounds.y &&
        y <= el.bounds.y + el.bounds.height
      )
    })

    if (clicked) {
      setSelectedElement(clicked)
      
      // Enhanced: If clicking directly (not selecting), auto-inject click action
      // This provides immediate feedback and captures teaching moment
      if (actionType === 'click') {
        // Small delay to allow selection to update UI
        setTimeout(() => {
          handleInjectAction()
        }, 100)
      }
    } else {
      // Clicked on empty space - could be a coordinate-based action
      // Store coordinates for potential use
      setSelectedElement({
        selector: `[data-coords="${Math.round(x)},${Math.round(y)}"]`,
        bounds: { x, y, width: 1, height: 1 },
        type: 'unknown',
        text: `Point (${Math.round(x)}, ${Math.round(y)})`,
      })
    }
  }

  const handleInjectAction = async () => {
    if (!selectedElement) return

    setInjecting(true)

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
      
      // Enhanced: Send full God Mode event schema for learning
      const godModeEvent = {
        runId: testRunId,
        stepId: 'last_failed_step', // Will be updated by worker with actual step
        interaction: {
          type: actionType,
          coordinates: {
            x: selectedElement.bounds.x + selectedElement.bounds.width / 2,
            y: selectedElement.bounds.y + selectedElement.bounds.height / 2,
          },
          targetSelector: selectedElement.selector,
          value: actionType === 'type' ? inputValue : undefined,
          // DOM snapshots will be captured by worker (has access to Playwright page)
          domSnapshotBefore: undefined, // Worker will capture
          domSnapshotAfter: undefined, // Worker will capture after action
        },
        metadata: {
          isTeachingMoment: true, // Mark as learning opportunity
          userIntent: `Manual ${actionType} on ${selectedElement.text || selectedElement.selector}`,
          preCondition: {
            aiStuck: aiStuck,
            stuckMessage: stuckMessage,
          },
        },
      }

      const response = await fetch(`${apiUrl}/api/tests/${testRunId}/inject-action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: actionType,
          selector: selectedElement.selector,
          value: actionType === 'type' ? inputValue : undefined,
          description: `Manual ${actionType} on ${selectedElement.text || selectedElement.selector}`,
          // Enhanced: Include full God Mode event for learning
          godModeEvent,
        }),
      })

      if (!response.ok) {
        throw new Error(`Failed to inject action: ${response.statusText}`)
      }

      console.log('Action injected successfully (with learning context)')
    } catch (error: any) {
      console.error('Failed to inject action:', error)
      alert(`Failed to inject action: ${error.message}`)
      setInjecting(false)
    }
  }

  const handlePauseResume = () => {
    if (!wsRef.current) return

    wsRef.current.send(
      JSON.stringify({
        type: testStatus === 'running' ? 'pause' : 'resume',
      })
    )
  }

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(61, 54, 48, 0.9)', // Beige overlay matching theme
      zIndex: 9999,
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* Header */}
      <div style={{
        padding: '1rem',
        backgroundColor: 'var(--bg-secondary)',
        borderBottom: `2px solid var(--maroon-600)`,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <div>
          <h2 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            🎮 God Mode - Live Test Control
            <span style={{
              fontSize: '0.75rem',
              padding: '0.25rem 0.5rem',
              borderRadius: '9999px',
              backgroundColor: connected ? '#10b981' : '#ef4444',
              color: '#fff',
            }}>
              {connected ? '● Connected' : '○ Disconnected'}
            </span>
          </h2>
          <p style={{ margin: '0.25rem 0 0 0', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
            Click on elements to inject manual actions when AI gets stuck
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            onClick={handlePauseResume}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: 'var(--maroon-800)',
              color: '#fff',
              border: 'none',
              borderRadius: '0.375rem',
              cursor: 'pointer',
              fontSize: '0.875rem',
              fontWeight: '600',
            }}
          >
            {testStatus === 'running' ? '⏸ Pause' : '▶ Resume'}
          </button>
          <button
            onClick={onClose}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: 'var(--beige-600)',
              color: '#fff',
              border: 'none',
              borderRadius: '0.375rem',
              cursor: 'pointer',
              fontSize: '0.875rem',
              fontWeight: '600',
            }}
          >
            ✕ Close
          </button>
        </div>
      </div>

      {/* AI Stuck Alert */}
      {aiStuck && (
        <div style={{
          padding: '1rem',
          backgroundColor: '#fef3c7',
          borderBottom: '2px solid #f59e0b',
          color: '#92400e',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <div>
            <strong>⚠️ AI is stuck!</strong> {stuckMessage}
          </div>
          <button
            onClick={() => setAiStuck(false)}
            style={{
              padding: '0.25rem 0.75rem',
              backgroundColor: '#f59e0b',
              color: '#fff',
              border: 'none',
              borderRadius: '0.25rem',
              cursor: 'pointer',
              fontSize: '0.75rem',
            }}
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Main Content */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Left: Live Preview */}
        <div style={{
          flex: 1,
          overflow: 'auto',
          backgroundColor: 'var(--beige-100)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1rem',
        }}>
          {pageState ? (
            <canvas
              ref={canvasRef}
              onClick={handleCanvasClick}
              style={{
                maxWidth: '100%',
                maxHeight: '100%',
                cursor: 'crosshair',
                border: `2px solid var(--maroon-600)`,
              }}
            />
          ) : (
            <div style={{ color: 'var(--text-secondary)', textAlign: 'center' }}>
              <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>👁️</div>
              <p>Waiting for page state...</p>
              <p style={{ fontSize: '0.875rem' }}>The AI will send live screenshots when it needs help</p>
            </div>
          )}
        </div>

        {/* Right: Control Panel */}
        <div style={{
          width: '350px',
          backgroundColor: 'var(--bg-secondary)',
          borderLeft: `2px solid var(--maroon-600)`,
          padding: '1.5rem',
          overflowY: 'auto',
        }}>
          <h3 style={{ color: '#fff', marginTop: 0 }}>Manual Action</h3>

          {selectedElement ? (
            <div>
              <div style={{
                padding: '1rem',
                backgroundColor: '#10b981',
                borderRadius: '0.375rem',
                marginBottom: '1rem',
                color: '#fff',
              }}>
                <div style={{ fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.5rem' }}>
                  Selected Element
                </div>
                <div style={{ fontSize: '0.75rem', fontFamily: 'monospace' }}>
                  {selectedElement.type}: {selectedElement.text || selectedElement.selector}
                </div>
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ color: '#9ca3af', fontSize: '0.875rem', display: 'block', marginBottom: '0.5rem' }}>
                  Action Type
                </label>
                <select
                  value={actionType}
                  onChange={(e) => setActionType(e.target.value as any)}
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    backgroundColor: '#374151',
                    color: '#fff',
                    border: '1px solid #4b5563',
                    borderRadius: '0.375rem',
                  }}
                >
                  <option value="click">Click</option>
                  <option value="type">Type</option>
                  <option value="scroll">Scroll</option>
                </select>
              </div>

              {actionType === 'type' && (
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ color: '#9ca3af', fontSize: '0.875rem', display: 'block', marginBottom: '0.5rem' }}>
                    Value to Type
                  </label>
                  <input
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    placeholder="Enter text..."
                    style={{
                      width: '100%',
                      padding: '0.5rem',
                      backgroundColor: '#374151',
                      color: '#fff',
                      border: '1px solid #4b5563',
                      borderRadius: '0.375rem',
                    }}
                  />
                </div>
              )}

              <button
                onClick={handleInjectAction}
                disabled={injecting || (actionType === 'type' && !inputValue)}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  backgroundColor: injecting ? '#6b7280' : '#10b981',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '0.375rem',
                  cursor: injecting ? 'not-allowed' : 'pointer',
                  fontSize: '1rem',
                  fontWeight: '600',
                }}
              >
                {injecting ? '⏳ Injecting...' : '✨ Inject Action'}
              </button>
            </div>
          ) : (
            <div style={{
              padding: '2rem',
              textAlign: 'center',
              color: '#9ca3af',
              backgroundColor: '#374151',
              borderRadius: '0.375rem',
            }}>
              <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>👆</div>
              <p style={{ fontSize: '0.875rem', margin: 0 }}>
                Click on an element in the preview to select it
              </p>
            </div>
          )}

          <div style={{
            marginTop: '2rem',
            padding: '1rem',
            backgroundColor: '#374151',
            borderRadius: '0.375rem',
            fontSize: '0.75rem',
            color: '#9ca3af',
          }}>
            <div style={{ fontWeight: '600', marginBottom: '0.5rem', color: '#fff' }}>
              💡 How it works:
            </div>
            <ul style={{ margin: 0, paddingLeft: '1.25rem' }}>
              <li>AI detects it's stuck (e.g., cookie popup)</li>
              <li>Test pauses automatically</li>
              <li>You see the live screenshot here</li>
              <li>Click the element you want to interact with</li>
              <li>Choose action type and inject</li>
              <li>AI continues with your action in context</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}

