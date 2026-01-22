/**
 * Automated cleanup job for expired guest test runs
 * Runs every hour to clean up tests older than 24 hours
 */

import * as cron from 'node-cron'
import { Database } from '../lib/db'

let cleanupJob: cron.ScheduledTask | null = null

/**
 * Start the cleanup job
 * Runs every hour at minute 0
 */
export function startGuestCleanupJob(): void {
  if (cleanupJob) {
    console.log('Guest cleanup job already running')
    return
  }

  // Run every hour at minute 0 (e.g., 1:00, 2:00, 3:00, etc.)
  cleanupJob = cron.schedule('0 * * * *', async () => {
    try {
      console.log('[Cleanup] Starting guest test cleanup...')
      
      const deletedCount = await Database.cleanupExpiredGuestRuns()
      
      if (deletedCount > 0) {
        console.log(`[Cleanup] ✅ Cleaned up ${deletedCount} expired guest test runs`)
      } else {
        console.log('[Cleanup] No expired guest tests to clean up')
      }
      
      // Optional: Track metric
      // await trackMetric('guest_tests_cleaned', deletedCount)
    } catch (error: any) {
      console.error('[Cleanup] ❌ Error cleaning up guest tests:', error.message)
    }
  })

  console.log('✅ Guest cleanup job scheduled (runs every hour)')
}

/**
 * Stop the cleanup job
 */
export function stopGuestCleanupJob(): void {
  if (cleanupJob) {
    cleanupJob.stop()
    cleanupJob = null
    console.log('Guest cleanup job stopped')
  }
}

