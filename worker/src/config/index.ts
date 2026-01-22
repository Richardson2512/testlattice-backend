/**
 * Configuration Loader
 * Issue #3: Centralized config with validation
 * 
 * Loads and validates all environment variables at startup.
 * Fails fast if required configuration is missing.
 */

import { ConfigSchema, Config } from './schema'

let cachedConfig: Config | null = null

/**
 * Parse boolean from environment variable
 */
function parseBoolean(value: string | undefined, defaultValue: boolean): boolean {
    if (value === undefined) return defaultValue
    return value.toLowerCase() === 'true' || value === '1'
}

/**
 * Parse number from environment variable
 */
function parseNumber(value: string | undefined, defaultValue: number): number {
    if (value === undefined) return defaultValue
    const parsed = parseFloat(value)
    return isNaN(parsed) ? defaultValue : parsed
}

/**
 * Build raw config from environment variables
 */
function buildRawConfig(): Record<string, unknown> {
    return {
        nodeEnv: process.env.NODE_ENV || 'development',
        logLevel: process.env.LOG_LEVEL || 'info',

        openai: {
            apiKey: process.env.OPENAI_API_KEY,
            apiKeyRegistered: process.env.OPENAI_API_KEY_REGISTERED,
            apiKeyBehavior: process.env.OPENAI_API_KEY_BEHAVIOR,
            apiUrl: process.env.OPENAI_API_URL,
            model: process.env.OPENAI_MODEL,
            temperature: parseNumber(process.env.OPENAI_TEMPERATURE, 0.3),
            maxTokens: parseNumber(process.env.OPENAI_MAX_TOKENS, 4096),
            orgId: process.env.OPENAI_ORG_ID,
        },

        gemini: {
            apiKey: process.env.GEMINI_API_KEY,
            model: process.env.GEMINI_MODEL,
        },

        vision: {
            model: process.env.VISION_MODEL,
            endpoint: process.env.VISION_MODEL_ENDPOINT,
            interval: parseNumber(process.env.VISION_INTERVAL, 5),
            onError: parseBoolean(process.env.VISION_ON_ERROR, true),
            onIRLFallback: parseBoolean(process.env.VISION_ON_IRL, true),
        },

        redis: {
            url: process.env.REDIS_URL,
            maxRetries: parseNumber(process.env.REDIS_MAX_RETRIES, 3),
        },

        supabase: {
            url: process.env.SUPABASE_URL,
            anonKey: process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
            serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
            storageBucket: process.env.SUPABASE_STORAGE_BUCKET,
        },

        wasabi: {
            enabled: parseBoolean(process.env.WASABI_ENABLED, false),
            accessKey: process.env.WASABI_ACCESS_KEY,
            secretKey: process.env.WASABI_SECRET_KEY,
            bucket: process.env.WASABI_BUCKET,
            region: process.env.WASABI_REGION,
            endpoint: process.env.WASABI_ENDPOINT,
        },

        api: {
            url: process.env.API_URL,
            internalKey: process.env.API_INTERNAL_KEY,
        },

        limits: {
            guestMaxSteps: parseNumber(process.env.GUEST_MAX_STEPS, 25),
            registeredMaxSteps: parseNumber(process.env.REGISTERED_MAX_STEPS, 100),
            diagnosisPageLimit: parseNumber(process.env.DIAGNOSIS_PAGE_LIMIT, 5),
            visionCallsPerTest: parseNumber(process.env.VISION_CALLS_PER_TEST, 10),
            actionTimeoutMs: parseNumber(process.env.ACTION_TIMEOUT_MS, 30000),
            pageLoadTimeoutMs: parseNumber(process.env.PAGE_LOAD_TIMEOUT_MS, 60000),
        },

        features: {
            enableVisionValidation: parseBoolean(process.env.ENABLE_VISION_VALIDATION, true),
            enablePinecone: parseBoolean(process.env.ENABLE_PINECONE, false),
            enableBehaviorTests: parseBoolean(process.env.ENABLE_BEHAVIOR_TESTS, true),
            enableWasabi: parseBoolean(process.env.ENABLE_WASABI, false),
            rateLimiterMode: process.env.RATE_LIMITER_MODE || 'shadow',
        },

        platform: {
            maxTokensPerHour: parseNumber(process.env.PLATFORM_MAX_TOKENS_PER_HOUR, 10_000_000),
            maxConcurrentAICalls: parseNumber(process.env.PLATFORM_MAX_CONCURRENT_AI_CALLS, 100),
            maxQueuedTests: parseNumber(process.env.PLATFORM_MAX_QUEUED_TESTS, 500),
        },
    }
}

/**
 * Load and validate configuration
 * Exits process if validation fails (fail fast)
 */
export function loadConfig(): Config {
    if (cachedConfig) return cachedConfig

    const rawConfig = buildRawConfig()
    const result = ConfigSchema.safeParse(rawConfig)

    if (!result.success) {
        console.error('❌ Configuration validation failed:')
        console.error('')

        result.error.issues.forEach(issue => {
            const path = issue.path.join('.')
            console.error(`  • ${path}: ${issue.message}`)
        })

        console.error('')
        console.error('Please set the required environment variables and restart.')

        // Fail fast - don't start with invalid config
        process.exit(1)
    }

    cachedConfig = result.data

    // Log successful config load (without sensitive data)
    console.log('✅ Configuration loaded successfully')
    console.log(`   Environment: ${cachedConfig.nodeEnv}`)
    console.log(`   Log Level: ${cachedConfig.logLevel}`)
    console.log(`   Rate Limiter Mode: ${cachedConfig.features.rateLimiterMode}`)

    return cachedConfig
}

/**
 * Get cached config (must call loadConfig first)
 */
export function getConfig(): Config {
    if (!cachedConfig) {
        return loadConfig()
    }
    return cachedConfig
}

/**
 * Reset config cache (for testing)
 */
export function resetConfig(): void {
    cachedConfig = null
}

// Export the config singleton
export const config = loadConfig()
