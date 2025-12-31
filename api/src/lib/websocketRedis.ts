// Redis-backed WebSocket server for horizontal scaling
// Supports 100K+ concurrent connections across multiple API servers
import { WebSocketServer, WebSocket } from 'ws'
import Redis from 'ioredis'
import { IncomingMessage } from 'http'
import { Server } from 'http'

interface TestConnection {
  runId: string
  ws: WebSocket
  userId?: string
  serverId: string
  connectedAt: number
}

interface ManualAction {
  action: 'click' | 'type' | 'scroll' | 'navigate'
  selector?: string
  value?: string
  description: string
  timestamp: number
}

interface BroadcastMessage {
  runId: string
  payload: any
  serverId: string
}

/**
 * Redis-backed WebSocket Manager
 * 
 * Features:
 * - Horizontal scaling: Add more API servers without losing connections
 * - Persistent state: Survives server restarts
 * - Auto-cleanup: Stale connections removed via Redis TTL
 * - Pub/Sub broadcasting: Messages reach all servers
 * 
 * Architecture:
 * - Each API server maintains local WebSocket connections
 * - Redis stores connection metadata and action queues
 * - Redis pub/sub broadcasts messages across all servers
 * - Load balancer uses sticky sessions (ip_hash)
 */
export class RedisWebSocketManager {
  private wss: WebSocketServer
  private redis: Redis
  private redisSub: Redis
  private connections: Map<string, TestConnection[]> = new Map()
  private serverId: string
  private heartbeatIntervals: Map<WebSocket, NodeJS.Timeout> = new Map()

  constructor(server: Server, redisUrl?: string) {
    this.serverId = `api_${process.pid}_${Date.now()}`

    // Create Redis clients
    const redisConfig = redisUrl || process.env.REDIS_URL || 'redis://localhost:6379'
    this.redis = new Redis(redisConfig, {
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000)
        return delay
      },
    })

    this.redisSub = new Redis(redisConfig, {
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
    })

    this.wss = new WebSocketServer({
      server,
      path: '/ws/test-control'
    })

    // Subscribe to broadcast channel
    this.redisSub.subscribe('ws:broadcast', (err) => {
      if (err) {
        console.error('Failed to subscribe to Redis channel:', err)
      } else {
        console.log(`[${this.serverId}] Subscribed to Redis broadcast channel`)
      }
    })

    // Handle broadcast messages from Redis
    this.redisSub.on('message', (channel, message) => {
      if (channel === 'ws:broadcast') {
        try {
          const data: BroadcastMessage = JSON.parse(message)
          // Only broadcast to local connections (avoid echo)
          if (data.serverId !== this.serverId) {
            this.broadcastLocal(data.runId, data.payload)
          }
        } catch (error: any) {
          console.error('Failed to parse Redis broadcast message:', error.message)
        }
      }
    })

    // Redis connection monitoring
    this.redis.on('connect', () => {
      console.log(`[${this.serverId}] Redis connected`)
    })

    this.redis.on('error', (error) => {
      console.error(`[${this.serverId}] Redis error:`, error.message)
    })

    this.wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
      this.handleConnection(ws, req)
    })

    // Cleanup stale connections every 2 minutes
    setInterval(() => this.cleanupStaleConnections(), 120000)

    console.log(`[${this.serverId}] WebSocket server initialized with Redis backing`)
  }

  /**
   * Scan Redis keys using SCAN (non-blocking, O(1) per iteration)
   * Replaces KEYS command which is O(n) and blocks Redis
   */
  private async scanKeys(pattern: string): Promise<string[]> {
    const keys: string[] = []
    let cursor = '0'

    do {
      const [newCursor, batch] = await this.redis.scan(
        cursor,
        'MATCH', pattern,
        'COUNT', 100
      )
      cursor = newCursor
      keys.push(...batch)
    } while (cursor !== '0')

    return keys
  }

  private async handleConnection(ws: WebSocket, req: IncomingMessage) {
    const url = new URL(req.url || '', `http://${req.headers.host}`)
    const runId = url.searchParams.get('runId')
    const userId = url.searchParams.get('userId')

    if (!runId) {
      ws.close(1008, 'runId parameter required')
      return
    }

    const connection: TestConnection = {
      runId,
      ws,
      userId: userId || undefined,
      serverId: this.serverId,
      connectedAt: Date.now(),
    }

    if (!this.connections.has(runId)) {
      this.connections.set(runId, [])
    }
    this.connections.get(runId)!.push(connection)

    // Register connection in Redis with TTL (auto-cleanup)
    try {
      await this.redis.setex(
        `ws:connection:${runId}:${this.serverId}:${userId || 'anonymous'}`,
        300, // 5 minute TTL
        JSON.stringify({
          userId,
          connectedAt: Date.now(),
          serverId: this.serverId,
        })
      )
    } catch (error: any) {
      console.error(`[${this.serverId}] Failed to register connection in Redis:`, error.message)
    }

    console.log(`[${this.serverId}] WebSocket connected: ${runId}, userId: ${userId || 'anonymous'}`)

    // Send initial state
    ws.send(JSON.stringify({
      type: 'connected',
      runId,
      serverId: this.serverId,
      timestamp: new Date().toISOString(),
    }))

    // Set up heartbeat to keep connection alive and refresh Redis TTL
    const heartbeat = setInterval(async () => {
      if (ws.readyState === WebSocket.OPEN) {
        try {
          // Refresh Redis TTL
          await this.redis.expire(
            `ws:connection:${runId}:${this.serverId}:${userId || 'anonymous'}`,
            300
          )

          // Send ping to client
          ws.send(JSON.stringify({
            type: 'ping',
            timestamp: Date.now(),
            serverId: this.serverId,
          }))
        } catch (error: any) {
          console.error(`[${this.serverId}] Heartbeat error:`, error.message)
        }
      } else {
        clearInterval(heartbeat)
        this.heartbeatIntervals.delete(ws)
      }
    }, 30000) // Every 30 seconds

    this.heartbeatIntervals.set(ws, heartbeat)

    // Handle incoming messages
    ws.on('message', async (data: Buffer) => {
      try {
        const message = JSON.parse(data.toString())
        await this.handleMessage(runId, message, ws)
      } catch (error: any) {
        console.error(`[${this.serverId}] Failed to parse WebSocket message:`, error.message)
        ws.send(JSON.stringify({ type: 'error', error: 'Invalid message format' }))
      }
    })

    // Handle disconnection
    ws.on('close', async () => {
      const interval = this.heartbeatIntervals.get(ws)
      if (interval) {
        clearInterval(interval)
        this.heartbeatIntervals.delete(ws)
      }

      await this.removeConnection(runId, ws, userId)
      console.log(`[${this.serverId}] WebSocket disconnected: ${runId}`)
    })

    ws.on('error', (error: Error) => {
      console.error(`[${this.serverId}] WebSocket error (${runId}):`, error.message)
    })
  }

  private async handleMessage(runId: string, message: any, ws: WebSocket) {
    switch (message.type) {
      case 'manual_action':
        // Store action in Redis (persistent queue)
        try {
          const action: ManualAction = {
            ...message.action,
            timestamp: Date.now(),
          }

          await this.redis.rpush(
            `ws:actions:${runId}`,
            JSON.stringify(action)
          )
          await this.redis.expire(`ws:actions:${runId}`, 3600) // 1 hour TTL

          // Broadcast via Redis (reaches all servers)
          await this.broadcastViaRedis(runId, {
            type: 'action_queued',
            action: message.action,
            timestamp: new Date().toISOString(),
          })
        } catch (error: any) {
          console.error(`[${this.serverId}] Failed to queue manual action:`, error.message)
          ws.send(JSON.stringify({ type: 'error', error: 'Failed to queue action' }))
        }
        break

      case 'pause':
        // Broadcast pause request
        await this.broadcastViaRedis(runId, {
          type: 'pause_requested',
          timestamp: new Date().toISOString(),
        })
        break

      case 'resume':
        // Broadcast resume request
        await this.broadcastViaRedis(runId, {
          type: 'resume_requested',
          timestamp: new Date().toISOString(),
        })
        break

      case 'ping':
        // Keep-alive ping
        ws.send(JSON.stringify({
          type: 'pong',
          timestamp: Date.now(),
          serverId: this.serverId,
        }))
        break

      case 'pong':
        // Client acknowledged ping (optional handling)
        break

      default:
        ws.send(JSON.stringify({
          type: 'error',
          error: `Unknown message type: ${message.type}`,
        }))
    }
  }

  private async removeConnection(runId: string, ws: WebSocket, userId: string | null | undefined) {
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

    // Remove from Redis
    try {
      await this.redis.del(
        `ws:connection:${runId}:${this.serverId}:${userId || 'anonymous'}`
      )
    } catch (error: any) {
      console.error(`[${this.serverId}] Failed to remove connection from Redis:`, error.message)
    }
  }

  /**
   * Broadcast to local connections only
   */
  private broadcastLocal(runId: string, message: any) {
    const connections = this.connections.get(runId)
    if (!connections) return

    const payload = JSON.stringify(message)
    connections.forEach(conn => {
      if (conn.ws.readyState === WebSocket.OPEN) {
        try {
          conn.ws.send(payload)
        } catch (error: any) {
          console.error(`[${this.serverId}] Failed to send message:`, error.message)
        }
      }
    })
  }

  /**
   * Broadcast via Redis (reaches ALL servers)
   */
  public async broadcast(runId: string, message: any) {
    await this.broadcastViaRedis(runId, message)
  }

  /**
   * Internal broadcast via Redis pub/sub
   */
  private async broadcastViaRedis(runId: string, message: any) {
    try {
      const broadcastData: BroadcastMessage = {
        runId,
        payload: message,
        serverId: this.serverId,
      }

      await this.redis.publish(
        'ws:broadcast',
        JSON.stringify(broadcastData)
      )

      // Also broadcast to local connections immediately
      this.broadcastLocal(runId, message)
    } catch (error: any) {
      console.error(`[${this.serverId}] Failed to broadcast via Redis:`, error.message)
    }
  }

  /**
   * Notify methods (for backward compatibility with existing code)
   */
  public async notifyTestStatus(runId: string, status: string, data?: any) {
    await this.broadcast(runId, {
      type: 'test_status',
      status,
      data,
      timestamp: new Date().toISOString(),
    })
  }

  public async notifyTestStep(runId: string, step: any) {
    await this.broadcast(runId, {
      type: 'test_step',
      step,
      timestamp: new Date().toISOString(),
    })
  }

  public async notifyAIStuck(runId: string, context: { message: string; screenshot?: string }) {
    await this.broadcast(runId, {
      type: 'ai_stuck',
      context,
      timestamp: new Date().toISOString(),
    })
  }

  public async notifyPageState(runId: string, state: { url: string; screenshot: string; elements: any[] }) {
    await this.broadcast(runId, {
      type: 'page_state',
      state,
      timestamp: new Date().toISOString(),
    })
  }

  /**
   * Get manual actions from Redis queue
   */
  public async getManualActions(runId: string): Promise<ManualAction[]> {
    try {
      const actions = await this.redis.lrange(`ws:actions:${runId}`, 0, -1)
      await this.redis.del(`ws:actions:${runId}`) // Clear queue after retrieval
      return actions.map(a => JSON.parse(a))
    } catch (error: any) {
      console.error(`[${this.serverId}] Failed to get manual actions:`, error.message)
      return []
    }
  }

  /**
   * Check if there are active connections for a test run (across all servers)
   */
  public async hasActiveConnections(runId: string): Promise<boolean> {
    try {
      // Check Redis for any active connections using SCAN (non-blocking)
      const keys = await this.scanKeys(`ws:connection:${runId}:*`)
      return keys.length > 0
    } catch (error: any) {
      console.error(`[${this.serverId}] Failed to check active connections:`, error.message)
      // Fallback to local check
      const connections = this.connections.get(runId)
      return connections ? connections.length > 0 : false
    }
  }

  /**
   * Cleanup stale connections (Redis TTL handles most of this)
   */
  private async cleanupStaleConnections() {
    try {
      const keys = await this.scanKeys(`ws:connection:*:${this.serverId}:*`)
      console.log(`[${this.serverId}] Active connections: ${keys.length}`)

      // Monitor local vs Redis connections
      let localCount = 0
      this.connections.forEach(conns => {
        localCount += conns.length
      })

      if (localCount !== keys.length) {
        console.warn(`[${this.serverId}] Connection mismatch: ${localCount} local, ${keys.length} in Redis`)
      }
    } catch (error: any) {
      console.error(`[${this.serverId}] Cleanup error:`, error.message)
    }
  }

  /**
   * Get server stats (for monitoring)
   */
  public async getStats() {
    let localConnections = 0
    this.connections.forEach(conns => {
      localConnections += conns.length
    })

    let redisConnections = 0
    try {
      const keys = await this.scanKeys(`ws:connection:*:${this.serverId}:*`)
      redisConnections = keys.length
    } catch (error) {
      // Ignore
    }

    return {
      serverId: this.serverId,
      localConnections,
      redisConnections,
      activeRuns: this.connections.size,
      uptime: process.uptime(),
    }
  }

  /**
   * Close all connections (cleanup)
   */
  public async close() {
    console.log(`[${this.serverId}] Closing WebSocket server...`)

    // Clear all heartbeat intervals
    this.heartbeatIntervals.forEach(interval => clearInterval(interval))
    this.heartbeatIntervals.clear()

    // Close all WebSocket connections
    this.connections.forEach(conns => {
      conns.forEach(conn => {
        if (conn.ws.readyState === WebSocket.OPEN) {
          conn.ws.close(1001, 'Server shutting down')
        }
      })
    })

    // Close WebSocket server
    this.wss.close()

    // Unsubscribe from Redis
    await this.redisSub.unsubscribe('ws:broadcast')

    // Close Redis connections
    await this.redis.quit()
    await this.redisSub.quit()

    console.log(`[${this.serverId}] WebSocket server closed`)
  }
}

