/**
 * Structured Logging with Trace IDs
 * Issue #20: Observability for debugging and monitoring
 * 
 * Features:
 * - Structured JSON logs in production
 * - Pretty logs in development
 * - Trace ID propagation for request tracking
 * - Event-based logging for analytics
 */

import pino from 'pino'
import { AsyncLocalStorage } from 'async_hooks'

// Trace context storage
const traceStorage = new AsyncLocalStorage<TraceContext>()

export interface TraceContext {
    traceId: string
    runId?: string
    userId?: string
    userTier?: string
    testMode?: string
    startTime: number
}

// Log levels
export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal'

// Create logger instance
const isDevelopment = process.env.NODE_ENV !== 'production'
const logLevel = (process.env.LOG_LEVEL || 'info') as LogLevel

export const logger = pino({
    level: logLevel,
    formatters: {
        level: (label) => ({ level: label }),
        bindings: () => ({}), // Remove pid/hostname in production
    },
    timestamp: pino.stdTimeFunctions.isoTime,
    mixin() {
        // Add trace context to every log
        const context = traceStorage.getStore()
        if (context) {
            return {
                traceId: context.traceId,
                runId: context.runId,
                userId: context.userId,
                userTier: context.userTier,
                testMode: context.testMode,
            }
        }
        return {}
    },
    transport: isDevelopment
        ? {
            target: 'pino-pretty',
            options: {
                colorize: true,
                translateTime: 'SYS:standard',
                ignore: 'pid,hostname',
            },
        }
        : undefined,
})

/**
 * Generate a unique trace ID
 */
export function generateTraceId(): string {
    return `tr_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`
}

/**
 * Run a function with trace context
 */
export function withTrace<T>(
    context: Partial<TraceContext>,
    fn: () => T
): T {
    const fullContext: TraceContext = {
        traceId: context.traceId || generateTraceId(),
        runId: context.runId,
        userId: context.userId,
        testMode: context.testMode,
        startTime: Date.now(),
    }

    return traceStorage.run(fullContext, fn)
}

/**
 * Run an async function with trace context
 */
export async function withTraceAsync<T>(
    context: Partial<TraceContext>,
    fn: () => Promise<T>
): Promise<T> {
    const fullContext: TraceContext = {
        traceId: context.traceId || generateTraceId(),
        runId: context.runId,
        userId: context.userId,
        testMode: context.testMode,
        startTime: Date.now(),
    }

    return traceStorage.run(fullContext, fn)
}

/**
 * Get current trace context
 */
export function getTraceContext(): TraceContext | undefined {
    return traceStorage.getStore()
}

/**
 * Get current trace ID
 */
export function getTraceId(): string | undefined {
    return traceStorage.getStore()?.traceId
}

/**
 * Update current trace context
 */
export function updateTraceContext(updates: Partial<TraceContext>): void {
    const current = traceStorage.getStore()
    if (current) {
        Object.assign(current, updates)
    }
}

// Event logging helpers
export interface LogEvent {
    event: string
    [key: string]: unknown
}

/**
 * Log a structured event
 */
export function logEvent(event: string, data?: Record<string, unknown>): void {
    logger.info({ event, ...data })
}

/**
 * Log test lifecycle events
 */
export const testEvents = {
    started: (runId: string, testMode: string, url: string) => {
        logEvent('test_started', { runId, testMode, url })
    },

    stepCompleted: (runId: string, step: number, action: string, duration: number) => {
        logEvent('test_step_completed', { runId, step, action, durationMs: duration })
    },

    stepFailed: (runId: string, step: number, action: string, error: string) => {
        logEvent('test_step_failed', { runId, step, action, error })
    },

    completed: (runId: string, steps: number, duration: number, success: boolean) => {
        logEvent('test_completed', { runId, steps, durationMs: duration, success })
    },

    failed: (runId: string, step: number, error: string, recoverable: boolean) => {
        logEvent('test_failed', { runId, step, error, recoverable })
    },

    abandoned: (runId: string, reason: string) => {
        logEvent('test_abandoned', { runId, reason })
    },
}

/**
 * Log AI/API events
 */
export const aiEvents = {
    callStarted: (model: string, purpose: string, estimatedTokens: number) => {
        logEvent('ai_call_started', { model, purpose, estimatedTokens })
    },

    callCompleted: (model: string, purpose: string, tokens: number, duration: number) => {
        logEvent('ai_call_completed', { model, purpose, tokens, durationMs: duration })
    },

    callFailed: (model: string, purpose: string, error: string) => {
        logEvent('ai_call_failed', { model, purpose, error })
    },

    rateLimited: (model: string, userId: string, retryAfter: number) => {
        logEvent('ai_rate_limited', { model, userId, retryAfterMs: retryAfter })
    },

    circuitOpen: (service: string) => {
        logEvent('circuit_breaker_open', { service })
    },

    circuitClosed: (service: string) => {
        logEvent('circuit_breaker_closed', { service })
    },
}

/**
 * Log performance metrics
 */
export const perfEvents = {
    pageLoad: (url: string, duration: number) => {
        logEvent('page_load', { url, durationMs: duration })
    },

    screenshot: (runId: string, step: number, size: number, duration: number) => {
        logEvent('screenshot_captured', { runId, step, sizeBytes: size, durationMs: duration })
    },

    storageUpload: (key: string, size: number, duration: number) => {
        logEvent('storage_upload', { key, sizeBytes: size, durationMs: duration })
    },
}

/**
 * Create a child logger with additional context
 */
export function createChildLogger(bindings: Record<string, unknown>): pino.Logger {
    return logger.child(bindings)
}

/**
 * Measure and log duration of an async operation
 */
export async function measureAsync<T>(
    name: string,
    fn: () => Promise<T>,
    metadata?: Record<string, unknown>
): Promise<T> {
    const start = Date.now()

    try {
        const result = await fn()
        const duration = Date.now() - start
        logEvent(`${name}_completed`, { durationMs: duration, ...metadata })
        return result
    } catch (error: any) {
        const duration = Date.now() - start
        logEvent(`${name}_failed`, { durationMs: duration, error: error.message, ...metadata })
        throw error
    }
}
