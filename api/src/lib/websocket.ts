// WebSocket server for real-time test control (Human-in-the-Loop / God Mode)
import { WebSocketServer, WebSocket } from 'ws'
import { IncomingMessage } from 'http'
import { Server } from 'http'

interface TestConnection {
  runId: string
  ws: WebSocket
  userId?: string
}

interface ManualAction {
  action: 'click' | 'type' | 'scroll' | 'navigate'
  selector?: string
  value?: string
  description: string
  timestamp: string
}

export class TestControlWebSocket {
  private wss: WebSocketServer
  private connections: Map<string, TestConnection[]> = new Map()
  private manualActionQueues: Map<string, ManualAction[]> = new Map()

  constructor(server: Server) {
    this.wss = new WebSocketServer({ 
      server,
      path: '/ws/test-control'
    })

    this.wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
      this.handleConnection(ws, req)
    })

    console.log('WebSocket server initialized for test control')
  }

  private handleConnection(ws: WebSocket, req: IncomingMessage) {
    const url = new URL(req.url || '', `http://${req.headers.host}`)
    const runId = url.searchParams.get('runId')
    const userId = url.searchParams.get('userId')

    if (!runId) {
      ws.close(1008, 'runId parameter required')
      return
    }

    // Add connection to active connections
    const connection: TestConnection = { runId, ws, userId: userId || undefined }
    
    if (!this.connections.has(runId)) {
      this.connections.set(runId, [])
    }
    this.connections.get(runId)!.push(connection)

    console.log(`WebSocket connected for test run: ${runId}, userId: ${userId || 'anonymous'}`)

    // Send initial state
    ws.send(JSON.stringify({
      type: 'connected',
      runId,
      timestamp: new Date().toISOString(),
    }))

    // Handle incoming messages
    ws.on('message', (data: Buffer) => {
      try {
        const message = JSON.parse(data.toString())
        this.handleMessage(runId, message, ws)
      } catch (error: any) {
        console.error('Failed to parse WebSocket message:', error.message)
        ws.send(JSON.stringify({
          type: 'error',
          error: 'Invalid message format',
        }))
      }
    })

    // Handle disconnection
    ws.on('close', () => {
      this.removeConnection(runId, ws)
      console.log(`WebSocket disconnected for test run: ${runId}`)
    })

    ws.on('error', (error: Error) => {
      console.error(`WebSocket error for test run ${runId}:`, error.message)
    })
  }

  private handleMessage(runId: string, message: any, ws: WebSocket) {
    switch (message.type) {
      case 'manual_action':
        // User is injecting a manual action (God Mode)
        this.queueManualAction(runId, message.action)
        this.broadcast(runId, {
          type: 'action_queued',
          action: message.action,
          timestamp: new Date().toISOString(),
        })
        break

      case 'pause':
        // User requests to pause the test
        this.broadcast(runId, {
          type: 'pause_requested',
          timestamp: new Date().toISOString(),
        })
        break

      case 'resume':
        // User requests to resume the test
        this.broadcast(runId, {
          type: 'resume_requested',
          timestamp: new Date().toISOString(),
        })
        break

      case 'step_override':
        // User overrides AI step with manual action
        this.queueManualAction(runId, {
          action: message.action.type,
          selector: message.action.selector,
          value: message.action.value,
          description: `Manual override: ${message.action.type}`,
          timestamp: new Date().toISOString(),
        })
        this.broadcast(runId, {
          type: 'step_override_queued',
          action: message.action,
          timestamp: new Date().toISOString(),
        })
        break

      case 'update_instructions':
        // User updates test instructions mid-run
        this.broadcast(runId, {
          type: 'instructions_updated',
          instructions: message.instructions,
          timestamp: new Date().toISOString(),
        })
        break

      case 'replay_step':
        // User requests to replay a specific step
        this.broadcast(runId, {
          type: 'replay_step_requested',
          stepNumber: message.stepNumber,
          timestamp: new Date().toISOString(),
        })
        break

      case 'ping':
        // Keep-alive ping
        ws.send(JSON.stringify({
          type: 'pong',
          timestamp: new Date().toISOString(),
        }))
        break

      default:
        ws.send(JSON.stringify({
          type: 'error',
          error: `Unknown message type: ${message.type}`,
        }))
    }
  }

  private removeConnection(runId: string, ws: WebSocket) {
    const connections = this.connections.get(runId)
    if (connections) {
      const index = connections.findIndex(c => c.ws === ws)
      if (index !== -1) {
        connections.splice(index, 1)
      }
      if (connections.length === 0) {
        this.connections.delete(runId)
      }
    }
  }

  /**
   * Queue a manual action for the test processor to pick up
   */
  private queueManualAction(runId: string, action: ManualAction) {
    if (!this.manualActionQueues.has(runId)) {
      this.manualActionQueues.set(runId, [])
    }
    this.manualActionQueues.get(runId)!.push(action)
    console.log(`Manual action queued for ${runId}:`, action.action, action.selector)
  }

  /**
   * Get queued manual actions for a test run
   */
  public getManualActions(runId: string): ManualAction[] {
    const actions = this.manualActionQueues.get(runId) || []
    this.manualActionQueues.set(runId, []) // Clear queue after retrieval
    return actions
  }

  /**
   * Broadcast a message to all connections for a test run
   */
  public broadcast(runId: string, message: any) {
    const connections = this.connections.get(runId)
    if (!connections) return

    const payload = JSON.stringify(message)
    connections.forEach(conn => {
      if (conn.ws.readyState === WebSocket.OPEN) {
        conn.ws.send(payload)
      }
    })
  }

  /**
   * Notify connected clients about test status changes
   */
  public notifyTestStatus(runId: string, status: string, data?: any) {
    this.broadcast(runId, {
      type: 'test_status',
      status,
      data,
      timestamp: new Date().toISOString(),
    })
  }

  /**
   * Notify connected clients about test step completion
   */
  public notifyTestStep(runId: string, step: any) {
    this.broadcast(runId, {
      type: 'test_step',
      step,
      timestamp: new Date().toISOString(),
    })
  }

  /**
   * Notify connected clients that AI is stuck and needs help
   */
  public notifyAIStuck(runId: string, context: { message: string; screenshot?: string }) {
    this.broadcast(runId, {
      type: 'ai_stuck',
      context,
      timestamp: new Date().toISOString(),
    })
  }

  /**
   * Notify connected clients about current page state
   */
  public notifyPageState(runId: string, state: { url: string; screenshot: string; elements: any[] }) {
    this.broadcast(runId, {
      type: 'page_state',
      state,
      timestamp: new Date().toISOString(),
    })
  }

  /**
   * Check if there are active connections for a test run
   */
  public hasActiveConnections(runId: string): boolean {
    const connections = this.connections.get(runId)
    return connections ? connections.length > 0 : false
  }

  /**
   * Notify about stream URL (for WebRTC/HTTP streaming)
   */
  public notifyStreamUrl(runId: string, streamUrl: string, token?: string) {
    this.broadcast(runId, {
      type: 'stream_available',
      streamUrl,
      token,
      timestamp: new Date().toISOString(),
    })
  }

  /**
   * Notify about step completion for replay
   */
  public notifyStepForReplay(runId: string, stepNumber: number, stepData: any) {
    this.broadcast(runId, {
      type: 'step_data',
      stepNumber,
      step: stepData,
      timestamp: new Date().toISOString(),
    })
  }

  /**
   * Close all connections (cleanup)
   */
  public close() {
    this.wss.close()
    console.log('WebSocket server closed')
  }
}

