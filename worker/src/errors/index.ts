/**
 * Unified Error Handling System
 * Issue #9: Standardized errors with mandatory user messages
 * 
 * Every error MUST have a userMessage that can be shown to end users.
 * No more silent failures or cryptic error messages.
 */

/**
 * Base application error
 * All custom errors extend this
 */
export class AppError extends Error {
    public readonly timestamp: string
    public readonly isOperational: boolean

    constructor(
        message: string,
        public readonly userMessage: string,
        public readonly code: string,
        public readonly statusCode: number = 500,
        isOperational: boolean = true,
        public readonly metadata?: Record<string, unknown>
    ) {
        super(message)
        this.name = this.constructor.name
        this.timestamp = new Date().toISOString()
        this.isOperational = isOperational
        Error.captureStackTrace(this, this.constructor)
    }

    toJSON() {
        return {
            name: this.name,
            code: this.code,
            message: this.message,
            userMessage: this.userMessage,
            statusCode: this.statusCode,
            timestamp: this.timestamp,
            metadata: this.metadata,
        }
    }
}

/**
 * Rate limit exceeded error
 */
export class RateLimitError extends AppError {
    constructor(
        message: string,
        public readonly retryAfterMs: number,
        metadata?: Record<string, unknown>
    ) {
        super(
            message,
            `Rate limit reached. Your request will resume in ${Math.ceil(retryAfterMs / 1000)} seconds.`,
            'RATE_LIMIT_EXCEEDED',
            429,
            true,
            metadata
        )
    }
}

/**
 * Budget exceeded error (token/cost budget)
 */
export class BudgetExceededError extends AppError {
    constructor(
        public readonly used: number,
        public readonly limit: number,
        metadata?: Record<string, unknown>
    ) {
        super(
            `Budget exceeded: ${used}/${limit} tokens used`,
            `Completed ${used} of ${limit} allowed steps. Upgrade your plan for more.`,
            'BUDGET_EXCEEDED',
            402,
            true,
            { used, limit, ...metadata }
        )
    }
}

/**
 * AI service error (OpenAI, Gemini, etc.)
 */
export class AIServiceError extends AppError {
    constructor(
        message: string,
        public readonly model: string,
        public readonly provider: string,
        metadata?: Record<string, unknown>
    ) {
        super(
            message,
            'AI service is temporarily unavailable. Your test is queued and will auto-resume.',
            'AI_SERVICE_ERROR',
            503,
            true,
            { model, provider, ...metadata }
        )
    }
}

/**
 * Circuit breaker open error
 */
export class CircuitBreakerError extends AppError {
    constructor(
        service: string,
        public readonly halfOpenAfterMs: number,
        metadata?: Record<string, unknown>
    ) {
        super(
            `Circuit breaker open for ${service}`,
            `${service} is recovering. Your test will automatically resume when ready.`,
            'CIRCUIT_BREAKER_OPEN',
            503,
            true,
            { service, halfOpenAfterMs, ...metadata }
        )
    }
}

/**
 * Platform ceiling error (global safety valve)
 */
export class PlatformCeilingError extends AppError {
    constructor(metadata?: Record<string, unknown>) {
        super(
            'Platform ceiling reached',
            'High demand - your test is queued. Please wait a moment.',
            'PLATFORM_CEILING',
            503,
            true,
            metadata
        )
    }
}

/**
 * Validation error (input validation failed)
 */
export class ValidationError extends AppError {
    constructor(
        message: string,
        public readonly fields: string[],
        metadata?: Record<string, unknown>
    ) {
        super(
            message,
            `Invalid input: ${fields.join(', ')}. Please check and try again.`,
            'VALIDATION_ERROR',
            400,
            true,
            { fields, ...metadata }
        )
    }
}

/**
 * Authentication error
 */
export class AuthenticationError extends AppError {
    constructor(message: string = 'Authentication required') {
        super(
            message,
            'Please log in to continue.',
            'AUTHENTICATION_REQUIRED',
            401,
            true
        )
    }
}

/**
 * Authorization error
 */
export class AuthorizationError extends AppError {
    constructor(message: string = 'Not authorized') {
        super(
            message,
            'You don\'t have permission to perform this action.',
            'NOT_AUTHORIZED',
            403,
            true
        )
    }
}

/**
 * Resource not found error
 */
export class NotFoundError extends AppError {
    constructor(resource: string, id?: string) {
        super(
            `${resource} not found${id ? `: ${id}` : ''}`,
            `The requested ${resource.toLowerCase()} could not be found.`,
            'NOT_FOUND',
            404,
            true,
            { resource, id }
        )
    }
}

/**
 * Test execution error
 */
export class TestExecutionError extends AppError {
    constructor(
        message: string,
        userMessage: string,
        public readonly stepNumber?: number,
        public readonly recoverable: boolean = false,
        metadata?: Record<string, unknown>
    ) {
        super(
            message,
            userMessage,
            recoverable ? 'TEST_EXECUTION_RECOVERABLE' : 'TEST_EXECUTION_FAILED',
            500,
            true,
            { stepNumber, recoverable, ...metadata }
        )
    }
}

/**
 * Legacy edge case error (graceful failure for unsupported modes)
 */
export class LegacyEdgeCaseError extends AppError {
    constructor(
        testMode: string,
        suggestion: string = 'single'
    ) {
        super(
            `Legacy edge case in ${testMode} mode`,
            `This test configuration is not fully supported. Try ${suggestion} mode instead.`,
            'LEGACY_EDGE_CASE',
            400,
            true,
            { testMode, suggestion }
        )
    }
}

/**
 * Check if an error is an operational AppError
 */
export function isOperationalError(error: unknown): error is AppError {
    return error instanceof AppError && error.isOperational
}

/**
 * Get user-friendly message from any error
 */
export function getUserMessage(error: unknown): string {
    if (error instanceof AppError) {
        return error.userMessage
    }
    if (error instanceof Error) {
        return 'An unexpected error occurred. Please try again.'
    }
    return 'Something went wrong. Please try again.'
}

/**
 * Get error code from any error
 */
export function getErrorCode(error: unknown): string {
    if (error instanceof AppError) {
        return error.code
    }
    return 'UNKNOWN_ERROR'
}
