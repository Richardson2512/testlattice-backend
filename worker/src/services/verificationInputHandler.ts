/**
 * Verification Input Handler
 * 
 * Handles pause-and-wait for user verification input during signup flow testing.
 * Supports both email verification links and OTP codes.
 * 
 * Uses Redis pub/sub for communication between API and Worker.
 */

import Redis from 'ioredis'

export interface VerificationRequest {
    runId: string
    type: 'email' | 'magic_link' | 'otp' | 'sms'
    message: string
    timestamp: string
}

export interface VerificationInput {
    runId: string
    inputType: 'link' | 'otp'
    value: string
    timestamp: string
}

export class VerificationInputHandler {
    private redis: Redis
    private subscriber: Redis | null = null
    private readonly VERIFICATION_TIMEOUT_MS = 120000 // 2 minutes

    constructor(redisUrl?: string) {
        this.redis = new Redis(redisUrl || process.env.REDIS_URL || 'redis://localhost:6379')
    }

    /**
     * Request verification input from user and wait for response
     * Called by Worker when verification handoff is detected
     */
    async waitForVerificationInput(
        runId: string,
        verificationType: 'email' | 'magic_link' | 'otp' | 'sms',
        timeoutMs: number = this.VERIFICATION_TIMEOUT_MS
    ): Promise<VerificationInput | null> {
        return new Promise((resolve) => {
            const channel = `verification:${runId}`
            const subscriber = this.redis.duplicate()
            this.subscriber = subscriber

            // Set timeout
            const timeout = setTimeout(() => {
                console.log(`[VerificationInputHandler] Timeout waiting for verification input for ${runId}`)
                subscriber.unsubscribe(channel)
                subscriber.disconnect()
                this.subscriber = null
                resolve(null)
            }, timeoutMs)

            // Subscribe to channel
            subscriber.subscribe(channel, (err) => {
                if (err) {
                    console.error(`[VerificationInputHandler] Failed to subscribe to ${channel}:`, err)
                    clearTimeout(timeout)
                    resolve(null)
                }
            })

            // Listen for messages
            subscriber.on('message', (ch, message) => {
                if (ch === channel) {
                    try {
                        const input: VerificationInput = JSON.parse(message)
                        console.log(`[VerificationInputHandler] Received verification input for ${runId}: ${input.inputType}`)
                        clearTimeout(timeout)
                        subscriber.unsubscribe(channel)
                        subscriber.disconnect()
                        this.subscriber = null
                        resolve(input)
                    } catch (parseError) {
                        console.error(`[VerificationInputHandler] Failed to parse message:`, parseError)
                    }
                }
            })

            console.log(`[VerificationInputHandler] Waiting for ${verificationType} verification input for ${runId} (timeout: ${timeoutMs}ms)`)
        })
    }

    /**
     * Submit verification input from user
     * Called by API when user submits verification link or OTP
     */
    async submitVerificationInput(
        runId: string,
        inputType: 'link' | 'otp',
        value: string
    ): Promise<void> {
        const channel = `verification:${runId}`
        const input: VerificationInput = {
            runId,
            inputType,
            value,
            timestamp: new Date().toISOString(),
        }

        await this.redis.publish(channel, JSON.stringify(input))
        console.log(`[VerificationInputHandler] Published verification input to ${channel}: ${inputType}`)
    }

    /**
     * Cancel waiting for verification input
     */
    cancel(): void {
        if (this.subscriber) {
            this.subscriber.unsubscribe()
            this.subscriber.disconnect()
            this.subscriber = null
        }
    }

    /**
     * Cleanup resources
     */
    async disconnect(): Promise<void> {
        this.cancel()
        await this.redis.quit()
    }
}

// Singleton instance for API use
let apiHandlerInstance: VerificationInputHandler | null = null

export function getVerificationInputHandler(): VerificationInputHandler {
    if (!apiHandlerInstance) {
        apiHandlerInstance = new VerificationInputHandler()
    }
    return apiHandlerInstance
}
