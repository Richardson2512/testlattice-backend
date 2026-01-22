/**
 * Worker Bootstrap
 * Initializes all new architecture modules
 * 
 * Called at worker startup to set up:
 * - Validated config
 * - Cleanup jobs
 * - Metrics collection
 * - DI container
 */

import { getConfig } from './config'
import { logger, startMetricsCollection, stopMetricsCollection } from './observability'
import { initializeCleanupJobs, shutdownCleanupJobs, getCleanupStats } from './jobs/cleanupJobs'

// Track initialization state
let isInitialized = false

/**
 * Initialize all architecture modules
 * Should be called once at worker startup
 */
export async function initializeArchitecture(): Promise<void> {
    if (isInitialized) {
        console.log('[Bootstrap] Already initialized, skipping')
        return
    }

    console.log('[Bootstrap] Initializing architecture modules...')

    try {
        // 1. Load and validate config (fails fast if invalid)
        const config = getConfig()
        console.log(`[Bootstrap] ✅ Config loaded (env: ${config.nodeEnv}, rate limiter: ${config.features.rateLimiterMode})`)

        // 2. Start metrics collection
        startMetricsCollection()
        console.log('[Bootstrap] ✅ Metrics collection started')

        // 3. Initialize cleanup jobs
        initializeCleanupJobs({
            supabaseUrl: config.supabase.url,
            supabaseServiceKey: config.supabase.serviceRoleKey,
            redisUrl: config.redis.url,
            enabled: config.nodeEnv === 'production', // Only in production
        })
        console.log(`[Bootstrap] ✅ Cleanup jobs ${config.nodeEnv === 'production' ? 'started' : 'disabled (dev mode)'}`)

        isInitialized = true
        console.log('[Bootstrap] ✅ All architecture modules initialized')
    } catch (error: any) {
        console.error('[Bootstrap] ❌ Failed to initialize architecture:', error.message)
        throw error
    }
}

/**
 * Shutdown all architecture modules gracefully
 * Should be called on worker shutdown
 */
export async function shutdownArchitecture(): Promise<void> {
    if (!isInitialized) {
        return
    }

    console.log('[Bootstrap] Shutting down architecture modules...')

    try {
        // Stop metrics collection
        stopMetricsCollection()

        // Shutdown cleanup jobs
        await shutdownCleanupJobs()

        // Log cleanup stats
        const stats = getCleanupStats()
        console.log('[Bootstrap] Cleanup stats:', stats)

        isInitialized = false
        console.log('[Bootstrap] ✅ All architecture modules shut down')
    } catch (error: any) {
        console.error('[Bootstrap] ⚠️ Error during shutdown:', error.message)
    }
}

/**
 * Check if architecture is initialized
 */
export function isArchitectureInitialized(): boolean {
    return isInitialized
}
