// WebRTC streaming service using LiveKit for real-time test video streaming
// Simplified implementation: Uses HTTP frame streaming as MVP, upgradeable to WebRTC
import { AccessToken } from 'livekit-server-sdk'
import { Page } from 'playwright'
import { EventEmitter } from 'events'
import { createServer, Server } from 'http'
import { URL } from 'url'
import Redis from 'ioredis'

export interface StreamConfig {
  runId: string
  sessionId: string
  livekitUrl?: string
  livekitApiKey?: string
  livekitApiSecret?: string
  page: Page
  frameServerPort?: number // HTTP server port for frame streaming (MVP)
}

export interface StreamStatus {
  isStreaming: boolean
  roomName: string
  streamUrl?: string
  token?: string
  error?: string
}

/**
 * WebRTC Streamer Service
 * Captures Playwright browser screen and streams via LiveKit (or HTTP for MVP)
 */
export class WebRTCStreamer extends EventEmitter {
  private frameServer: Server | null = null
  private streamInterval: NodeJS.Timeout | null = null
  private isStreaming: boolean = false
  private config: StreamConfig | null = null
  private roomName: string | null = null
  private cdpSession: any = null
  private latestFrame: Buffer | null = null
  private frameCount: number = 0
  private redis: Redis
  private lastBroadcastTime: number = 0
  private shouldQuitRedis: boolean = true

  /**
   * Start streaming a Playwright page
   * MVP: HTTP-based frame streaming (upgradeable to WebRTC)
   */
  constructor(redisClient?: Redis) {
    super()
    if (redisClient) {
      this.redis = redisClient
      this.shouldQuitRedis = false
    } else {
      this.redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379')
      this.redis.on('error', (err) => console.error('[WebRTC] Redis Client Error:', err))
      this.shouldQuitRedis = true
    }
  }

  async startStream(config: StreamConfig): Promise<StreamStatus> {
    if (this.isStreaming) {
      throw new Error('Stream already active. Stop current stream before starting a new one.')
    }

    this.config = config
    this.roomName = `test-run-${config.runId}`

    try {
      // Start HTTP frame server (MVP approach)
      // Use port 0 (random available port) to avoid EADDRINUSE errors with concurrent tests
      const requestedPort = config.frameServerPort || 0
      const assignedPort = await this.startFrameServer(requestedPort)

      // Start capturing frames from Playwright
      await this.startFrameCapture(config.page)

      // Generate LiveKit token if configured (for future WebRTC upgrade)
      let token: string | undefined
      if (config.livekitApiKey && config.livekitApiSecret) {
        token = await this.generateAccessToken(config.runId, config.livekitApiKey, config.livekitApiSecret)
      }

      this.isStreaming = true
      const streamUrl = `http://localhost:${assignedPort}/stream/${config.runId}`

      this.emit('started', { roomName: this.roomName, streamUrl, token })

      return {
        isStreaming: true,
        roomName: this.roomName,
        streamUrl,
        token,
      }
    } catch (error: any) {
      console.error('[WebRTC] Failed to start stream:', error.message)
      this.isStreaming = false
      throw new Error(`Failed to start stream: ${error.message}`)
    }
  }

  /**
   * Stop streaming
   */
  async stopStream(): Promise<void> {
    if (!this.isStreaming) {
      return
    }

    try {
      // Stop frame capture
      if (this.streamInterval) {
        clearInterval(this.streamInterval)
        this.streamInterval = null
      }

      // Stop CDP screencast
      if (this.cdpSession) {
        try {
          await this.cdpSession.send('Page.stopScreencast')
        } catch (e) {
          // Ignore errors
        }
        this.cdpSession = null
      }

      // Stop HTTP server
      if (this.frameServer) {
        await new Promise<void>((resolve) => {
          this.frameServer!.close(() => resolve())
        })
        this.frameServer = null
      }

      this.isStreaming = false
      this.config = null
      this.roomName = null
      this.latestFrame = null
      this.frameCount = 0

      // Close Redis connection only if we created it
      if (this.redis && this.shouldQuitRedis) {
        await this.redis.quit().catch(err => {
            console.error('[WebRTC] Error closing Redis connection:', err)
        })
      }

      this.emit('stopped')
      console.log('[WebRTC] Stream stopped')
    } catch (error: any) {
      console.error('[WebRTC] Error stopping stream:', error.message)
      throw error
    }
  }

  /**
   * Start HTTP server for frame streaming (MVP)
   * Serves latest frame as JPEG for frontend polling/SSE
   * Returns the assigned port
   */
  private async startFrameServer(port: number): Promise<number> {
    return new Promise((resolve, reject) => {
      this.frameServer = createServer((req, res) => {
        const url = new URL(req.url || '/', `http://${req.headers.host}`)
        const path = url.pathname

        // Stream endpoint: GET /stream/:runId
        if (path.startsWith('/stream/')) {
          const runId = path.split('/stream/')[1]

          if (runId !== this.config?.runId) {
            res.writeHead(404)
            res.end('Stream not found')
            return
          }

          // Set CORS headers
          res.setHeader('Access-Control-Allow-Origin', '*')
          res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
          res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

          if (req.method === 'OPTIONS') {
            res.writeHead(200)
            res.end()
            return
          }

          // Serve latest frame as JPEG
          if (this.latestFrame) {
            res.setHeader('Content-Type', 'image/jpeg')
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate')
            res.setHeader('Pragma', 'no-cache')
            res.setHeader('Expires', '0')
            res.writeHead(200)
            res.end(this.latestFrame)
          } else {
            res.writeHead(204) // No content
            res.end()
          }
        } else if (path === '/status') {
          // Status endpoint
          res.setHeader('Content-Type', 'application/json')
          res.setHeader('Access-Control-Allow-Origin', '*')
          res.writeHead(200)
          res.end(JSON.stringify({
            isStreaming: this.isStreaming,
            frameCount: this.frameCount,
            roomName: this.roomName,
          }))
        } else {
          res.writeHead(404)
          res.end('Not found')
        }
      })

      this.frameServer.listen(port, (err?: Error) => {
        if (err) {
          reject(err)
        } else {
          // Get assigned port
          const address = this.frameServer?.address()
          const assignedPort = typeof address === 'object' && address ? address.port : port
          console.log(`[WebRTC] Frame server started on port ${assignedPort}`)
          resolve(assignedPort)
        }
      })
    })
  }

  /**
   * Capture frames from Playwright page
   * Uses CDP screencast for efficient frame capture
   */
  private async startFrameCapture(page: Page): Promise<void> {
    try {
      const context = page.context()
      this.cdpSession = await context.newCDPSession(page)

      // Start screencast via CDP
      await this.cdpSession.send('Page.startScreencast', {
        format: 'jpeg', // Use JPEG for better performance
        quality: 80,
        maxWidth: 1920,
        maxHeight: 1080,
        everyNthFrame: 1,
      })

      console.log('[WebRTC] CDP screencast started')

      // Listen for screencast frames
      this.cdpSession.on('Page.screencastFrame', async ({ data, sessionId }: { data: string; sessionId: string }) => {
        try {
          // Store latest frame
          this.latestFrame = Buffer.from(data, 'base64')
          this.frameCount++

          // Emit frame event for potential WebRTC upgrade
          this.emit('frame', this.latestFrame)
          if (this.config) {
            this.broadcastFrame(this.config.runId, this.latestFrame)
          }

          // Acknowledge frame to CDP
          await this.cdpSession.send('Page.screencastFrameAck', { sessionId })
        } catch (error: any) {
          console.error('[WebRTC] Error processing frame:', error.message)
        }
      })

      // Fallback: Screenshot-based capture if CDP fails
      this.streamInterval = setInterval(async () => {
        try {
          if (!this.isStreaming || !page) return

          // Only use fallback if CDP isn't working (no frames received)
          if (this.frameCount === 0 || Date.now() % 3000 < 100) {
            const screenshot = await page.screenshot({
              type: 'jpeg',
              quality: 80,
            })

            this.latestFrame = screenshot
            this.frameCount++
            this.emit('frame', this.latestFrame)
            if (this.config) {
              this.broadcastFrame(this.config.runId, this.latestFrame)
            }
          }
        } catch (error: any) {
          // Ignore errors in fallback
        }
      }, 100) // Check every 100ms

      console.log('[WebRTC] Frame capture started')
    } catch (error: any) {
      console.error('[WebRTC] Failed to start CDP screencast, using screenshot fallback:', error.message)
      // Fallback to screenshot-based streaming
      await this.startScreenshotBasedStream(page)
    }
  }

  /**
   * Fallback: Screenshot-based streaming
   */
  private async startScreenshotBasedStream(page: Page): Promise<void> {
    try {
      // Capture screenshots periodically
      this.streamInterval = setInterval(async () => {
        try {
          if (!this.isStreaming || !page) return

          const screenshot = await page.screenshot({
            type: 'jpeg',
            quality: 80,
          })

          this.latestFrame = screenshot
          this.frameCount++
          this.emit('frame', this.latestFrame)
          this.broadcastFrame(this.config!.runId, this.latestFrame)
        } catch (error: any) {
          console.error('[WebRTC] Screenshot capture error:', error.message)
        }
      }, 100) // 10fps for screenshot-based

      console.log('[WebRTC] Screenshot-based streaming started')
    } catch (error: any) {
      console.error('[WebRTC] Failed to start screenshot-based stream:', error.message)
      throw error
    }
  }

  /**
   * Generate LiveKit access token for frontend
   */
  private async generateAccessToken(runId: string, apiKey: string, apiSecret: string): Promise<string> {
    const token = new AccessToken(apiKey, apiSecret, {
      identity: `viewer-${runId}-${Date.now()}`,
      name: `Test Run Viewer ${runId}`,
    })

    token.addGrant({
      room: `test-run-${runId}`,
      roomJoin: true,
      canPublish: false,
      canSubscribe: true, // Viewers subscribe to stream
    })

    return await token.toJwt()
  }

  /**
   * Get current stream status
   */
  getStatus(): StreamStatus {
    return {
      isStreaming: this.isStreaming,
      roomName: this.roomName || '',
      streamUrl: this.config ? `http://localhost:${this.config.frameServerPort || 8080}/stream/${this.config.runId}` : undefined,
    }
  }

  /**
   * Generate access token for frontend to connect (if LiveKit configured)
   */
  async generateViewerToken(userId?: string): Promise<string | null> {
    if (!this.config || !this.config.livekitApiKey || !this.config.livekitApiSecret) {
      return null
    }
    return this.generateAccessToken(
      this.config.runId,
      this.config.livekitApiKey,
      this.config.livekitApiSecret
    )
  }

  /**
   * Broadcast frame to Redis (for WebSocket relay)
   */
  private async broadcastFrame(runId: string, frame: Buffer) {
    const now = Date.now()
    // Throttle to 10 FPS (100ms) to avoid overloading Redis
    if (now - this.lastBroadcastTime < 100) {
      return
    }
    this.lastBroadcastTime = now

    // DEBUG LOG removed

    try {
      // Strip runId suffix (e.g., "-chromium") to get base runId if needed
      // But here we want the exact runId that the frontend listens to.
      // Frontend listens to testId. TestProcessor starts stream with `${runId}-${browserType}` or just `${runId}`?
      // TestProcessor line 2044: runId: `${runId}-${browserType}`.
      // BUT frontend listens to `runId`.
      // We should broadcast to the BASE runId channel if possible, OR frontend needs to listen to specific browser channel.
      // For Guest (Single Browser), we should broadcast to the base runId.
      // Let's parse it.
      const baseRunId = runId.includes('-chromium') ? runId.split('-chromium')[0] :
        runId.includes('-firefox') ? runId.split('-firefox')[0] :
          runId.includes('-webkit') ? runId.split('-webkit')[0] : runId

      const payload = {
        type: 'page_state',
        state: {
          screenshot: frame.toString('base64'),
          url: '', // We don't have URL here easily without passing it, but screenshot is key
          elements: []
        }
      }
      await this.redis.publish('ws:broadcast', JSON.stringify({
        runId: baseRunId,
        payload,
        serverId: 'worker-streamer'
      }))
    } catch (e) {
      // Ignore broadcast errors
    }
  }
}
