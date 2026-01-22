// Artifact Cleanup Job
// Deletes artifacts older than retention period to manage storage costs
import { createClient } from '@supabase/supabase-js'
import * as Sentry from '@sentry/node'
import { config } from '../config/env'

const RETENTION_DAYS = parseInt(process.env.ARTIFACT_RETENTION_DAYS || '30')
const BATCH_SIZE = 100 // Process in batches to avoid overwhelming the system

interface CleanupStats {
  artifactsDeleted: number
  storageFreed: number
  errors: number
  duration: number
  [key: string]: number // Index signature for Sentry compatibility
}

/**
 * Clean up old artifacts
 * Deletes artifacts older than RETENTION_DAYS from both storage and database
 */
export async function cleanupOldArtifacts(): Promise<CleanupStats> {
  const startTime = Date.now()
  const stats: CleanupStats = {
    artifactsDeleted: 0,
    storageFreed: 0,
    errors: 0,
    duration: 0,
  }

  console.log(`[Cleanup Job] Starting artifact cleanup (retention: ${RETENTION_DAYS} days)`)

  try {
    // Use config which validates env vars at startup
    const supabase = createClient(
      config.supabase.url,
      config.supabase.serviceRoleKey
    )

    // Calculate cutoff date
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - RETENTION_DAYS)
    const cutoffISO = cutoffDate.toISOString()

    console.log(`[Cleanup Job] Deleting artifacts older than ${cutoffISO}`)

    let processedCount = 0
    let hasMore = true

    while (hasMore) {
      // Get batch of old artifacts
      const { data: oldArtifacts, error: fetchError } = await supabase
        .from('test_artifacts')
        .select('id, path, size, run_id, type, created_at')
        .lt('created_at', cutoffISO)
        .limit(BATCH_SIZE)

      if (fetchError) {
        console.error('[Cleanup Job] Failed to fetch old artifacts:', fetchError)
        stats.errors++
        Sentry.captureException(fetchError, {
          tags: { job: 'artifact_cleanup' },
        })
        break
      }

      if (!oldArtifacts || oldArtifacts.length === 0) {
        hasMore = false
        break
      }

      console.log(`[Cleanup Job] Processing batch of ${oldArtifacts.length} artifacts`)

      // Delete from storage
      const paths = oldArtifacts.map(a => a.path)
      const { error: storageError } = await supabase.storage
        .from(process.env.SUPABASE_STORAGE_BUCKET || 'artifacts')
        .remove(paths)

      if (storageError) {
        console.error('[Cleanup Job] Failed to delete artifacts from storage:', storageError)
        stats.errors++
        Sentry.captureException(storageError, {
          tags: { job: 'artifact_cleanup' },
          extra: { pathCount: paths.length },
        })
        // Continue anyway - delete from database even if storage delete failed
      }

      // Delete from database (CASCADE will handle related records)
      const ids = oldArtifacts.map(a => a.id)
      const { error: dbError } = await supabase
        .from('test_artifacts')
        .delete()
        .in('id', ids)

      if (dbError) {
        console.error('[Cleanup Job] Failed to delete artifacts from database:', dbError)
        stats.errors++
        Sentry.captureException(dbError, {
          tags: { job: 'artifact_cleanup' },
          extra: { idCount: ids.length },
        })
        break
      }

      // Update stats
      stats.artifactsDeleted += oldArtifacts.length
      stats.storageFreed += oldArtifacts.reduce((sum, a) => sum + (a.size || 0), 0)
      processedCount += oldArtifacts.length

      console.log(`[Cleanup Job] Deleted ${oldArtifacts.length} artifacts (total: ${processedCount})`)

      // Check if there are more artifacts to process
      hasMore = oldArtifacts.length === BATCH_SIZE

      // Small delay between batches to avoid overwhelming the system
      if (hasMore) {
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
    }

    stats.duration = Date.now() - startTime

    console.log(`[Cleanup Job] Completed in ${stats.duration}ms`)
    console.log(`[Cleanup Job] Deleted: ${stats.artifactsDeleted} artifacts`)
    console.log(`[Cleanup Job] Freed: ${(stats.storageFreed / 1024 / 1024).toFixed(2)} MB`)
    console.log(`[Cleanup Job] Errors: ${stats.errors}`)

    // Report to Sentry for monitoring
    if (stats.artifactsDeleted > 0) {
      Sentry.captureMessage('Artifact cleanup completed', {
        level: 'info',
        tags: { job: 'artifact_cleanup' },
        extra: stats,
      })
    }

    return stats
  } catch (error: any) {
    stats.duration = Date.now() - startTime
    stats.errors++
    
    console.error('[Cleanup Job] Fatal error:', error.message)
    
    Sentry.captureException(error, {
      tags: { job: 'artifact_cleanup' },
      extra: stats,
    })

    throw error
  }
}

/**
 * Start cleanup job scheduler
 * Runs cleanup daily at 2 AM (configurable via env)
 */
export function startCleanupScheduler() {
  const intervalHours = parseInt(process.env.CLEANUP_INTERVAL_HOURS || '24')
  const intervalMs = intervalHours * 60 * 60 * 1000

  console.log(`[Cleanup Scheduler] Starting artifact cleanup scheduler (interval: ${intervalHours}h)`)

  // Run immediately on startup (after 1 minute delay)
  setTimeout(() => {
    cleanupOldArtifacts().catch(error => {
      console.error('[Cleanup Scheduler] Initial cleanup failed:', error)
    })
  }, 60000) // 1 minute delay

  // Then run on schedule
  setInterval(() => {
    const now = new Date()
    console.log(`[Cleanup Scheduler] Running scheduled cleanup at ${now.toISOString()}`)
    
    cleanupOldArtifacts().catch(error => {
      console.error('[Cleanup Scheduler] Scheduled cleanup failed:', error)
    })
  }, intervalMs)

  console.log(`[Cleanup Scheduler] Next cleanup in ${intervalHours} hours`)
}

/**
 * Get cleanup statistics (for monitoring endpoint)
 */
export async function getCleanupStats() {
  try {
    // Use config which validates env vars at startup
    const supabase = createClient(
      config.supabase.url,
      config.supabase.serviceRoleKey
    )

    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - RETENTION_DAYS)

    // Count artifacts that will be deleted
    const { count: oldCount, error: countError } = await supabase
      .from('test_artifacts')
      .select('*', { count: 'exact', head: true })
      .lt('created_at', cutoffDate.toISOString())

    if (countError) {
      console.error('[Cleanup Stats] Failed to count old artifacts:', countError)
      return null
    }

    // Get total storage usage
    const { data: artifacts, error: sizeError } = await supabase
      .from('test_artifacts')
      .select('size')

    if (sizeError) {
      console.error('[Cleanup Stats] Failed to get artifact sizes:', sizeError)
      return null
    }

    const totalSize = artifacts?.reduce((sum, a) => sum + (a.size || 0), 0) || 0

    return {
      retentionDays: RETENTION_DAYS,
      artifactsPendingDeletion: oldCount || 0,
      totalArtifacts: artifacts?.length || 0,
      totalStorageBytes: totalSize,
      totalStorageMB: (totalSize / 1024 / 1024).toFixed(2),
    }
  } catch (error: any) {
    console.error('[Cleanup Stats] Error:', error)
    return null
  }
}

