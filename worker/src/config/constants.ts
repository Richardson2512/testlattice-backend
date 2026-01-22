/**
 * Centralized Constants
 * Issue #10: No more magic numbers scattered across codebase
 * 
 * All limits, timeouts, and model constants in one place.
 */

// Test Mode Types
export const TEST_MODES = ['single', 'multi', 'all', 'monkey', 'guest', 'behavior'] as const
export type TestMode = typeof TEST_MODES[number]

// Test Run Outcome States (First-class partial success)
export const TEST_RUN_OUTCOMES = [
    'completed',
    'completed_with_limits',
    'paused_resumable',
    'failed_recoverable',
    'failed_unrecoverable',
    'abandoned',
] as const
export type TestRunOutcome = typeof TEST_RUN_OUTCOMES[number]

// Step Limits by Test Mode
export const STEP_LIMITS: Record<TestMode, number> = {
    single: 50,
    multi: 75,
    all: 100,
    monkey: 50,
    guest: 25,
    behavior: 100,
} as const

// Timeout Constants (milliseconds)
export const TIMEOUTS = {
    // Action execution
    ACTION_DEFAULT: 30000,
    ACTION_NAVIGATION: 60000,
    ACTION_INPUT: 10000,

    // Page operations
    PAGE_LOAD: 60000,
    PAGE_STABLE: 5000,

    // Screenshots
    SCREENSHOT: 5000,
    SCREENSHOT_UPLOAD: 15000,

    // AI calls
    AI_CALL: 30000,
    AI_VISION: 45000,

    // Redis operations
    REDIS_CONNECT: 10000,
    REDIS_OPERATION: 5000,

    // WebSocket/Streaming
    WS_PING: 30000,
    STREAM_RECONNECT: 5000,
} as const

// AI Model Constants
export const MODELS = {
    // OpenAI
    GPT_5_MINI: 'gpt-5-mini',
    GPT_4O: 'gpt-4o',
    GPT_4_TURBO: 'gpt-4-turbo',

    // Gemini
    GEMINI_FLASH: 'gemini-1.5-flash',
    GEMINI_PRO: 'gemini-1.5-pro',

    // Claude
    CLAUDE_SONNET: 'claude-3.5-sonnet',
} as const

// Rate Limit Tiers
export const RATE_LIMIT_TIERS = {
    guest: {
        testsPerDay: 3,
        cooldownMinutes: 60,
        maxSteps: 25,
    },
    free: {
        testsPerDay: 10,
        cooldownMinutes: 30,
        maxSteps: 50,
    },
    starter: {
        testsPerDay: 100,
        cooldownMinutes: 5,
        maxSteps: 75,
    },
    indie: {
        testsPerDay: 300,
        cooldownMinutes: 1,
        maxSteps: 100,
    },
    pro: {
        testsPerDay: 750,
        cooldownMinutes: 0.5,
        maxSteps: 100,
    },
} as const

// Model Pricing (per 1M tokens in USD)
export const MODEL_PRICING: Record<string, { input: number; output: number }> = {
    'gpt-5-mini': { input: 0.15, output: 0.60 },
    'gpt-4o': { input: 2.50, output: 10.00 },
    'gpt-4-turbo': { input: 10.00, output: 30.00 },
    'gemini-1.5-flash': { input: 0.075, output: 0.30 },
    'gemini-1.5-pro': { input: 1.25, output: 5.00 },
    'gemini-2.0-flash': { input: 0.10, output: 0.40 },
    'claude-3.5-sonnet': { input: 3.00, output: 15.00 },
} as const

// Test Mode Configuration
export const TEST_MODE_CONFIGS: Record<TestMode, {
    maxSteps: number
    timeout: number
    diagnosisRequired: boolean
    requiresAuth: boolean
    aiModel: string
    visionEnabled: boolean
}> = {
    single: {
        maxSteps: 50,
        timeout: 120000,
        diagnosisRequired: true,
        requiresAuth: true,
        aiModel: MODELS.GPT_5_MINI,
        visionEnabled: true,
    },
    multi: {
        maxSteps: 75,
        timeout: 180000,
        diagnosisRequired: true,
        requiresAuth: true,
        aiModel: MODELS.GPT_5_MINI,
        visionEnabled: true,
    },
    all: {
        maxSteps: 100,
        timeout: 300000,
        diagnosisRequired: true,
        requiresAuth: true,
        aiModel: MODELS.GPT_5_MINI,
        visionEnabled: true,
    },
    monkey: {
        maxSteps: 50,
        timeout: 120000,
        diagnosisRequired: false,
        requiresAuth: true,
        aiModel: MODELS.GPT_5_MINI,
        visionEnabled: false,
    },
    guest: {
        maxSteps: 25,
        timeout: 60000,
        diagnosisRequired: false,
        requiresAuth: false,
        aiModel: MODELS.GPT_5_MINI,
        visionEnabled: false,
    },
    behavior: {
        maxSteps: 100,
        timeout: 300000,
        diagnosisRequired: false,
        requiresAuth: true,
        aiModel: MODELS.GEMINI_FLASH,
        visionEnabled: true,
    },
} as const

// Retry Configuration
export const RETRY_CONFIG = {
    maxAttempts: 3,
    initialDelayMs: 1000,
    maxDelayMs: 10000,
    backoffMultiplier: 2,
} as const

// Circuit Breaker Configuration
export const CIRCUIT_BREAKER_CONFIG = {
    failureThreshold: 5,
    halfOpenAfterMs: 60000,
    successThreshold: 2,
} as const

// Queue Configuration
export const QUEUE_CONFIG = {
    guestTTL: 5 * 60 * 1000,      // 5 minutes
    freeTTL: 15 * 60 * 1000,      // 15 minutes
    paidTTL: 30 * 60 * 1000,      // 30 minutes
    deadLetterAfterAttempts: 3,
    alertThreshold: 50,
} as const
