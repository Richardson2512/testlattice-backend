/**
 * Dependency Injection Container
 * Issue #5: Centralized dependency management
 * 
 * Uses tsyringe for constructor injection.
 * All services registered here for testability and flexibility.
 */

import 'reflect-metadata'
import { container, DependencyContainer } from 'tsyringe'
import Redis from 'ioredis'
import { createClient, SupabaseClient } from '@supabase/supabase-js'

// Import config
import { getConfig } from '../config'
import type { Config } from '../config/schema'

// Token identifiers for injection
export const TOKENS = {
    Config: 'Config',
    Redis: 'Redis',
    Supabase: 'Supabase',
    SupabaseAdmin: 'SupabaseAdmin',
    StorageProvider: 'StorageProvider',
    AIRateLimiter: 'AIRateLimiter',
    Logger: 'Logger',
} as const

/**
 * Initialize the DI container with all dependencies
 */
export function initializeContainer(): DependencyContainer {
    const config = getConfig()

    // Register config
    container.register(TOKENS.Config, { useValue: config })

    // Register Redis
    const redis = new Redis(config.redis.url, {
        maxRetriesPerRequest: config.redis.maxRetries,
        retryStrategy: (times: number) => {
            if (times > 3) return null
            return Math.min(times * 200, 2000)
        },
    })
    container.register(TOKENS.Redis, { useValue: redis })

    // Register Supabase client (anon key for RLS)
    const supabaseClient = createClient(
        config.supabase.url,
        config.supabase.anonKey
    )
    container.register(TOKENS.Supabase, { useValue: supabaseClient })

    // Register Supabase admin client (service role for bypassing RLS)
    const supabaseAdmin = createClient(
        config.supabase.url,
        config.supabase.serviceRoleKey
    )
    container.register(TOKENS.SupabaseAdmin, { useValue: supabaseAdmin })

    console.log('[DI] Container initialized')
    return container
}

/**
 * Get a dependency from the container
 */
export function resolve<T>(token: string): T {
    return container.resolve<T>(token)
}

/**
 * Register a mock for testing
 */
export function registerMock<T>(token: string, mock: T): void {
    container.register(token, { useValue: mock })
}

/**
 * Reset the container (for testing)
 */
export function resetContainer(): void {
    container.reset()
}

/**
 * Shutdown all container resources
 */
export async function shutdownContainer(): Promise<void> {
    console.log('[DI] Shutting down container...')

    try {
        const redis = container.resolve<Redis>(TOKENS.Redis)
        if (redis) {
            await redis.quit()
        }
    } catch (e) {
        // Redis may not be registered
    }

    container.reset()
    console.log('[DI] Container shutdown complete')
}

// Export the container for direct access if needed
export { container }
