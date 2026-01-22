/**
 * AI Rate Limiter
 * Issue #2, #13, #14: Token bucket rate limiting for AI APIs
 * 
 * Supports three modes:
 * - shadow: Log only, never block (Week 1-2)
 * - soft: Block 10% of violations (Week 3)
 * - full: Enforce all limits (Week 4+)
 * 
 * Uses Redis for distributed rate limiting across workers.
 */

import Redis from 'ioredis'

export interface RateLimitConfig {
    tokensPerMinute: number
    tokensPerHour: number
    requestsPerMinute: number
    burstAllowance: number
}

export interface RateLimitResult {
    allowed: boolean
    remaining?: number
    retryAfterMs?: number
    userMessage?: string
    reason?: string
}

// Per-model rate limits
const MODEL_LIMITS: Record<string, RateLimitConfig> = {
    'gpt-5-mini': {
        tokensPerMinute: 200000,
        tokensPerHour: 2000000,
        requestsPerMinute: 500,
        burstAllowance: 50000,
    },
    'gpt-4o': {
        tokensPerMinute: 40000,
        tokensPerHour: 400000,
        requestsPerMinute: 100,
        burstAllowance: 10000,
    },
    'gemini-1.5-flash': {
        tokensPerMinute: 1000000,
        tokensPerHour: 10000000,
        requestsPerMinute: 2000,
        burstAllowance: 100000,
    },
    'gemini-2.0-flash': {
        tokensPerMinute: 1000000,
        tokensPerHour: 10000000,
        requestsPerMinute: 2000,
        burstAllowance: 100000,
    },
    'claude-3.5-sonnet': {
        tokensPerMinute: 80000,
        tokensPerHour: 800000,
        requestsPerMinute: 200,
        burstAllowance: 20000,
    },
}

// Default limits for unknown models
const DEFAULT_LIMITS: RateLimitConfig = {
    tokensPerMinute: 50000,
    tokensPerHour: 500000,
    requestsPerMinute: 100,
    burstAllowance: 10000,
}

// Tier multipliers
const TIER_MULTIPLIERS: Record<string, number> = {
    guest: 0.5,
    free: 1,
    starter: 2,
    indie: 4,
    pro: 8,
}

export type RateLimiterMode = 'shadow' | 'soft' | 'full'

export class AIRateLimiter {
    private mode: RateLimiterMode
    private softEnforcementRate: number = 0.1 // 10% enforcement in soft mode

    constructor(
        private redis: Redis,
        mode: RateLimiterMode = 'shadow'
    ) {
        this.mode = mode
        console.log(`[AIRateLimiter] Initialized in ${mode} mode`)
    }

    /**
     * Check if a request is allowed
     */
    async check(
        model: string,
        userId: string,
        userTier: string,
        estimatedTokens: number
    ): Promise<RateLimitResult> {
        const limits = this.getLimits(model, userTier)
        const keyMinute = `ratelimit:${model}:${userId}:minute`
        const keyHour = `ratelimit:${model}:${userId}:hour`

        try {
            // Get current usage
            const [minuteUsage, hourUsage] = await Promise.all([
                this.redis.get(keyMinute),
                this.redis.get(keyHour),
            ])

            const currentMinute = parseInt(minuteUsage || '0', 10)
            const currentHour = parseInt(hourUsage || '0', 10)

            // Check limits
            const minuteExceeded = currentMinute + estimatedTokens > limits.tokensPerMinute
            const hourExceeded = currentHour + estimatedTokens > limits.tokensPerHour

            if (minuteExceeded || hourExceeded) {
                const result: RateLimitResult = {
                    allowed: false,
                    remaining: Math.max(0, limits.tokensPerMinute - currentMinute),
                    retryAfterMs: minuteExceeded ? 60000 : 3600000,
                    userMessage: minuteExceeded
                        ? `Rate limit reached. Your test will resume in ${Math.ceil(60000 / 1000)}s.`
                        : `Hourly limit reached. Please try again later.`,
                    reason: minuteExceeded ? 'minute_limit' : 'hour_limit',
                }

                // Handle based on mode
                return this.handleLimitExceeded(result, userId, model, estimatedTokens)
            }

            // Allowed - will record usage after actual call
            return {
                allowed: true,
                remaining: limits.tokensPerMinute - currentMinute - estimatedTokens,
            }
        } catch (error: any) {
            // Redis error - fail open (allow the request)
            console.error(`[AIRateLimiter] Redis error: ${error.message}`)
            return { allowed: true }
        }
    }

    /**
     * Record actual token usage after a successful API call
     */
    async recordUsage(
        model: string,
        userId: string,
        actualTokens: number
    ): Promise<void> {
        const keyMinute = `ratelimit:${model}:${userId}:minute`
        const keyHour = `ratelimit:${model}:${userId}:hour`
        const keyDaily = `usage:${userId}:${new Date().toISOString().slice(0, 10)}`

        try {
            const multi = this.redis.multi()

            // Increment minute counter (expires in 60s)
            multi.incrby(keyMinute, actualTokens)
            multi.expire(keyMinute, 60)

            // Increment hour counter (expires in 3600s)
            multi.incrby(keyHour, actualTokens)
            multi.expire(keyHour, 3600)

            // Track daily usage by model for analytics
            multi.hincrby(keyDaily, model, actualTokens)
            multi.expire(keyDaily, 86400 * 7) // Keep for 7 days

            await multi.exec()
        } catch (error: any) {
            console.error(`[AIRateLimiter] Failed to record usage: ${error.message}`)
        }
    }

    /**
     * Check platform-wide ceiling (global safety valve)
     */
    async checkPlatformCeiling(maxTokensPerHour: number): Promise<RateLimitResult> {
        const key = `platform:tokens:hour`

        try {
            const current = parseInt(await this.redis.get(key) || '0', 10)

            if (current > maxTokensPerHour) {
                console.error(`🚨 [AIRateLimiter] Platform ceiling hit: ${current}/${maxTokensPerHour}`)
                return {
                    allowed: false,
                    userMessage: 'High demand - your test is queued. Please wait a moment.',
                    reason: 'platform_ceiling',
                }
            }

            return { allowed: true }
        } catch (error: any) {
            console.error(`[AIRateLimiter] Platform ceiling check failed: ${error.message}`)
            return { allowed: true } // Fail open
        }
    }

    /**
     * Increment platform-wide usage counter
     */
    async incrementPlatformUsage(tokens: number): Promise<void> {
        const key = `platform:tokens:hour`
        try {
            await this.redis.incrby(key, tokens)
            await this.redis.expire(key, 3600)
        } catch (error: any) {
            console.error(`[AIRateLimiter] Platform increment failed: ${error.message}`)
        }
    }

    /**
     * Get effective limits for a model and tier
     */
    private getLimits(model: string, userTier: string): RateLimitConfig {
        const baseLimits = MODEL_LIMITS[model] || DEFAULT_LIMITS
        const multiplier = TIER_MULTIPLIERS[userTier] || 1

        return {
            tokensPerMinute: Math.floor(baseLimits.tokensPerMinute * multiplier),
            tokensPerHour: Math.floor(baseLimits.tokensPerHour * multiplier),
            requestsPerMinute: Math.floor(baseLimits.requestsPerMinute * multiplier),
            burstAllowance: Math.floor(baseLimits.burstAllowance * multiplier),
        }
    }

    /**
     * Handle limit exceeded based on mode
     */
    private handleLimitExceeded(
        result: RateLimitResult,
        userId: string,
        model: string,
        tokens: number
    ): RateLimitResult {
        // Always log for monitoring
        console.log(`[AIRateLimiter] Limit check: mode=${this.mode}, userId=${userId}, model=${model}, tokens=${tokens}, wouldBlock=${!result.allowed}`)

        switch (this.mode) {
            case 'shadow':
                // Log only, allow the request
                console.log(`[AIRateLimiter] SHADOW: Would block ${userId} but allowing`)
                return { ...result, allowed: true, reason: 'shadow_mode_allowed' }

            case 'soft':
                // Block only 10% of violations
                if (Math.random() < this.softEnforcementRate) {
                    console.log(`[AIRateLimiter] SOFT: Blocking ${userId} (10% enforcement)`)
                    return result
                }
                console.log(`[AIRateLimiter] SOFT: Would block ${userId} but allowing (90% pass)`)
                return { ...result, allowed: true, reason: 'soft_mode_allowed' }

            case 'full':
                // Enforce all limits
                console.log(`[AIRateLimiter] FULL: Blocking ${userId}`)
                return result

            default:
                return result
        }
    }

    /**
     * Set rate limiter mode
     */
    setMode(mode: RateLimiterMode): void {
        console.log(`[AIRateLimiter] Mode changed: ${this.mode} -> ${mode}`)
        this.mode = mode
    }

    /**
     * Get current mode
     */
    getMode(): RateLimiterMode {
        return this.mode
    }
}
