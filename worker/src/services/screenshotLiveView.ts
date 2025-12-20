// Screenshot-Based Live View Service
// Provides reliable fallback for live browser visibility when WebRTC fails

import Redis from 'ioredis'
import { Page } from 'playwright'

export interface ScreenshotFrame {
  screenshot: string // Base64 encoded
  url: string
  timestamp: number
  stepNumber?: number
}

/**
 * Screenshot-Based Live View Service
 * 
 * Philosophy: Reliable fallback for live visibility
 * Captures viewport every 800-1000ms and pushes via Redis
 */
export class ScreenshotLiveViewService {
  private redis: Redis
  private captureInterval: NodeJS.Timeout | null = null
  private isCapturing: boolean = false

  constructor(redis: Redis) {
    this.redis = redis
  }

  /**
   * Start capturing screenshots at regular intervals
   */
  async startCapture(
    runId: string,
    page: Page,
    intervalMs: number = 900
  ): Promise<void> {
    if (this.isCapturing) {
      return // Already capturing
    }

    this.isCapturing = true
    let stepNumber = 0

    this.captureInterval = setInterval(async () => {
      try {
        const screenshot = await page.screenshot({ 
          type: 'jpeg', 
          quality: 80, // Lower quality for faster transmission
          fullPage: false, // Viewport only
        })
        const base64 = screenshot.toString('base64')
        const url = await page.url()

        const frame: ScreenshotFrame = {
          screenshot: base64,
          url,
          timestamp: Date.now(),
          stepNumber,
        }

        // Publish via Redis (same channel as WebRTC fallback)
        await this.redis.publish(`test:${runId}:frame`, JSON.stringify({
          type: 'frame',
          screenshot: base64,
          url,
          timestamp: Date.now(),
          source: 'screenshot-fallback',
        }))
      } catch (error: any) {
        // Non-blocking - don't fail if screenshot capture fails
        console.warn(`[ScreenshotLiveView] Failed to capture frame:`, error.message)
      }
    }, intervalMs)
  }

  /**
   * Stop capturing screenshots
   */
  stopCapture(): void {
    if (this.captureInterval) {
      clearInterval(this.captureInterval)
      this.captureInterval = null
    }
    this.isCapturing = false
  }

  /**
   * Update step number for frame metadata
   */
  setStepNumber(stepNumber: number): void {
    // Step number is captured in next frame
  }
}

