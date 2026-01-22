/**
 * Cleanup Jobs
 * Issue #21: Automated maintenance tasks
 * 
 * Cron jobs for:
 * - Abandoned test runs (stuck > 2 hours)
 * - Old artifacts (24h for guest, 7d for free)
 * - Token usage table pruning (90 days)
 * - Orphaned Redis keys
 */

import cron from 'node-cron'
import { createClient } from '@supabase/supabase-js'
import Redis from 'ioredis'

interface CleanupConfig {
    supabaseUrl: string
    supabaseServiceKey: string
    redisUrl: string
    enabled: boolean
}

interface CleanupStats {
    abandonedRuns: number
    oldArtifacts: number
    prunedTokenUsage: number
    orphanedKeys: number
    lastRun: string
}

let redis: Redis | null = null
// Using any type since we don't have generated Supabase types
let supabase: any = null
let cleanupStats: CleanupStats = {
    abandonedRuns: 0,
    oldArtifacts: 0,
    prunedTokenUsage: 0,
    orphanedKeys: 0,
    lastRun: 'never',
}

/**
 * Initialize cleanup jobs
 */
export function initializeCleanupJobs(config: CleanupConfig): void {
    if (!config.enabled) {
        console.log('[CleanupJobs] Disabled via config')
        return
    }

    // Initialize clients
    redis = new Redis(config.redisUrl)
    // Type assertion needed since we don't have generated types
    supabase = createClient(config.supabaseUrl, config.supabaseServiceKey) as any

    console.log('[CleanupJobs] Initializing scheduled tasks...')

    // Every hour: Clean abandoned test runs
    cron.schedule('0 * * * *', async () => {
        console.log('[CleanupJobs] Running: cleanAbandonedRuns')
        try {
            const count = await cleanAbandonedRuns()
            cleanupStats.abandonedRuns += count
            cleanupStats.lastRun = new Date().toISOString()
            console.log(`[CleanupJobs] Cleaned ${count} abandoned runs`)
        } catch (error: any) {
            console.error('[CleanupJobs] cleanAbandonedRuns failed:', error.message)
        }
    })

    // Daily at 3 AM: Clean old artifacts
    cron.schedule('0 3 * * *', async () => {
        console.log('[CleanupJobs] Running: cleanOldArtifacts')
        try {
            const count = await cleanOldArtifacts()
            cleanupStats.oldArtifacts += count
            cleanupStats.lastRun = new Date().toISOString()
            console.log(`[CleanupJobs] Cleaned ${count} old artifacts`)
        } catch (error: any) {
            console.error('[CleanupJobs] cleanOldArtifacts failed:', error.message)
        }
    })

    // Weekly Sunday 4 AM: Prune token_usage table
    cron.schedule('0 4 * * 0', async () => {
        console.log('[CleanupJobs] Running: pruneTokenUsage')
        try {
            const count = await pruneTokenUsage(90) // Keep 90 days
            cleanupStats.prunedTokenUsage += count
            cleanupStats.lastRun = new Date().toISOString()
            console.log(`[CleanupJobs] Pruned ${count} old token usage records`)
        } catch (error: any) {
            console.error('[CleanupJobs] pruneTokenUsage failed:', error.message)
        }
    })

    // Every 6 hours: Clean orphaned Redis keys
    cron.schedule('0 */6 * * *', async () => {
        console.log('[CleanupJobs] Running: cleanOrphanedRedisKeys')
        try {
            const count = await cleanOrphanedRedisKeys()
            cleanupStats.orphanedKeys += count
            cleanupStats.lastRun = new Date().toISOString()
            console.log(`[CleanupJobs] Cleaned ${count} orphaned Redis keys`)
        } catch (error: any) {
            console.error('[CleanupJobs] cleanOrphanedRedisKeys failed:', error.message)
        }
    })

    console.log('[CleanupJobs] All scheduled tasks initialized')
}

/**
 * Clean test runs stuck in 'running' status for > 2 hours
 */
async function cleanAbandonedRuns(): Promise<number> {
    if (!supabase) return 0

    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()

    const { data, error } = await supabase
        .from('test_runs')
        .update({
            status: 'abandoned',
        })
        .eq('status', 'running')
        .lt('updated_at', twoHoursAgo)
        .select('id')

    if (error) {
        throw new Error(`Failed to clean abandoned runs: ${error.message}`)
    }

    return data?.length || 0
}

/**
 * Clean old artifacts based on user tier
 * - Guest: 24 hours
 * - Free: 7 days
 * - Paid: 30 days (keep longer)
 */
async function cleanOldArtifacts(): Promise<number> {
    if (!supabase) return 0

    let totalCleaned = 0

    // Guest artifacts (24 hours)
    const guestCutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const { data: guestRuns } = await supabase
        .from('test_runs')
        .select('id')
        .not('guest_session_id', 'is', null)
        .lt('created_at', guestCutoff)

    if (guestRuns && guestRuns.length > 0) {
        // Mark for artifact cleanup (actual storage cleanup would be separate)
        const { error } = await supabase
            .from('test_runs')
            .update({ artifacts_cleaned: true })
            .in('id', guestRuns.map((r: any) => r.id))

        if (!error) {
            totalCleaned += guestRuns.length
        }
    }

    // Free tier artifacts (7 days) - users without subscriptions
    const freeCutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    const { data: freeRuns } = await supabase
        .from('test_runs')
        .select('id, user_id')
        .is('guest_session_id', null)
        .lt('created_at', freeCutoff)
        .eq('artifacts_cleaned', false)

    // Filter to only free tier users (no active subscription)
    if (freeRuns && freeRuns.length > 0) {
        for (const run of freeRuns) {
            if (!run.user_id) continue

            const { data: subscription } = await supabase
                .from('user_subscriptions')
                .select('tier')
                .eq('user_id', run.user_id)
                .single()

            if (!subscription || subscription.tier === 'free') {
                await supabase
                    .from('test_runs')
                    .update({ artifacts_cleaned: true })
                    .eq('id', run.id)
                totalCleaned++
            }
        }
    }

    return totalCleaned
}

/**
 * Prune old token_usage records
 */
async function pruneTokenUsage(daysToKeep: number): Promise<number> {
    if (!supabase) return 0

    const cutoff = new Date(Date.now() - daysToKeep * 24 * 60 * 60 * 1000).toISOString()

    const { data, error } = await supabase
        .from('token_usage')
        .delete()
        .lt('created_at', cutoff)
        .select('id')

    if (error) {
        throw new Error(`Failed to prune token usage: ${error.message}`)
    }

    return data?.length || 0
}

/**
 * Clean orphaned Redis keys (test states for completed/failed runs)
 */
async function cleanOrphanedRedisKeys(): Promise<number> {
    if (!redis || !supabase) return 0

    let cleaned = 0

    // Find all test run state keys
    const stateKeys = await redis.keys('state:*')

    for (const key of stateKeys) {
        const runId = key.replace('state:', '')

        // Check if run exists and is in terminal state
        const { data: run } = await supabase
            .from('test_runs')
            .select('status')
            .eq('id', runId)
            .single()

        if (!run || ['completed', 'failed', 'abandoned', 'cancelled'].includes(run.status)) {
            await redis.del(key)
            cleaned++
        }
    }

    // Clean old rate limit keys (> 1 hour old with no TTL)
    const rateLimitKeys = await redis.keys('ratelimit:*')
    for (const key of rateLimitKeys) {
        const ttl = await redis.ttl(key)
        if (ttl === -1) { // No TTL set
            await redis.del(key)
            cleaned++
        }
    }

    return cleaned
}

/**
 * Get cleanup statistics
 */
export function getCleanupStats(): CleanupStats {
    return { ...cleanupStats }
}

/**
 * Run cleanup immediately (for manual trigger)
 */
export async function runCleanupNow(): Promise<CleanupStats> {
    const stats: CleanupStats = {
        abandonedRuns: 0,
        oldArtifacts: 0,
        prunedTokenUsage: 0,
        orphanedKeys: 0,
        lastRun: new Date().toISOString(),
    }

    try {
        stats.abandonedRuns = await cleanAbandonedRuns()
    } catch (e) {
        console.error('[CleanupJobs] Manual run - abandonedRuns failed')
    }

    try {
        stats.oldArtifacts = await cleanOldArtifacts()
    } catch (e) {
        console.error('[CleanupJobs] Manual run - oldArtifacts failed')
    }

    try {
        stats.orphanedKeys = await cleanOrphanedRedisKeys()
    } catch (e) {
        console.error('[CleanupJobs] Manual run - orphanedKeys failed')
    }

    // Update global stats
    cleanupStats.abandonedRuns += stats.abandonedRuns
    cleanupStats.oldArtifacts += stats.oldArtifacts
    cleanupStats.orphanedKeys += stats.orphanedKeys
    cleanupStats.lastRun = stats.lastRun

    return stats
}

/**
 * Shutdown cleanup jobs gracefully
 */
export async function shutdownCleanupJobs(): Promise<void> {
    console.log('[CleanupJobs] Shutting down...')

    if (redis) {
        await redis.quit()
        redis = null
    }

    console.log('[CleanupJobs] Shutdown complete')
}
