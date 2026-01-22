/**
 * MfaHandler
 * Handles MFA pause/resume for both Guest and Registered tests
 * Deterministic - waits for user input, never guesses
 */

import { Redis } from 'ioredis'

export interface MfaResult {
    success: boolean
    value?: string
    inputType?: 'otp' | 'link'
    error?: string
}

export class MfaHandler {
    private redis: Redis
    private runId: string

    constructor(redis: Redis, runId: string) {
        this.redis = redis
        this.runId = runId
    }

    /**
     * Notify frontend that MFA is required
     */
    async notifyMfaRequired(type: 'otp' | 'magic_link', instructions?: string): Promise<void> {
        await this.redis.publish('ws:broadcast', JSON.stringify({
            runId: this.runId,
            serverId: 'worker',
            payload: {
                type: 'MFA_REQUIRED',
                mfaType: type,
                instructions: instructions || this.getDefaultInstructions(type),
                timestamp: new Date().toISOString()
            }
        }))
    }

    /**
     * Wait for user to provide MFA input
     * Controlled wait - job lock is extended, no timeout failure
     */
    async waitForInput(type: 'otp' | 'magic_link', timeoutMs: number = 120000): Promise<MfaResult> {
        await this.notifyMfaRequired(type)

        const channel = `mfa:${this.runId}`
        const startTime = Date.now()

        return new Promise<MfaResult>((resolve) => {
            const checkInterval = setInterval(async () => {
                try {
                    const input = await this.redis.get(channel)

                    if (input) {
                        clearInterval(checkInterval)
                        await this.redis.del(channel)

                        const parsed = JSON.parse(input)
                        const validated = this.validateInput(parsed.value, type)

                        if (validated.valid) {
                            resolve({
                                success: true,
                                value: validated.normalized,
                                inputType: type === 'magic_link' ? 'link' : 'otp'
                            })
                        } else {
                            resolve({
                                success: false,
                                error: validated.error
                            })
                        }
                    } else if (Date.now() - startTime > timeoutMs) {
                        clearInterval(checkInterval)
                        resolve({
                            success: false,
                            error: 'MFA timeout - user did not provide input'
                        })
                    }
                } catch (e: any) {
                    clearInterval(checkInterval)
                    resolve({
                        success: false,
                        error: e.message
                    })
                }
            }, 1000)
        })
    }

    /**
     * Validate and normalize user input
     * NO AI involved
     */
    private validateInput(value: string, type: 'otp' | 'magic_link'): { valid: boolean; normalized?: string; error?: string } {
        if (!value || typeof value !== 'string') {
            return { valid: false, error: 'Empty input' }
        }

        if (type === 'otp') {
            // Normalize OTP: trim, remove spaces/dashes
            const normalized = value.trim().replace(/[\s\-]/g, '')

            // Validate: 4-8 digits
            if (!/^\d{4,8}$/.test(normalized)) {
                return { valid: false, error: 'OTP must be 4-8 digits' }
            }

            return { valid: true, normalized }
        }

        if (type === 'magic_link') {
            // Validate URL
            try {
                const url = new URL(value.trim())

                // Basic security: must be https
                if (url.protocol !== 'https:') {
                    return { valid: false, error: 'Link must be HTTPS' }
                }

                return { valid: true, normalized: url.toString() }
            } catch {
                return { valid: false, error: 'Invalid URL format' }
            }
        }

        return { valid: false, error: 'Unknown MFA type' }
    }

    private getDefaultInstructions(type: 'otp' | 'magic_link'): string {
        return type === 'otp'
            ? 'Enter the verification code sent to your email/phone'
            : 'Paste the verification link from your email'
    }
}
