
import { createClient } from '@supabase/supabase-js'
import * as Sentry from '@sentry/node'
import { config } from '../config/env'
import { createWasabiStorage } from '../lib/wasabiStorage'

const GUEST_RETENTION_HOURS = 48
const BATCH_SIZE = 50

/**
 * Clean up old test runs (Guest runs > 48h)
 */
export async function cleanupOldTestRuns() {
    console.log(`[Cleanup Job] Starting expired test run cleanup (Guest/Free > ${GUEST_RETENTION_HOURS}h)`)

    try {
        const supabase = createClient(
            config.supabase.url,
            config.supabase.serviceRoleKey
        )

        const wasabi = createWasabiStorage()

        // Caclulate cutoff time
        const cutoffDate = new Date()
        cutoffDate.setHours(cutoffDate.getHours() - GUEST_RETENTION_HOURS)
        const cutoffISO = cutoffDate.toISOString()

        // Find expired runs
        // Criteria:
        // 1. Created before cutoff
        // 2. Is guest run (guest_session_id is not null OR options->isGuestRun is true)
        // Note: We'll start with guest_session_id check as it's indexed and cleaner

        // We process in batches
        let hasMore = true
        let processedCount = 0

        while (hasMore) {
            const { data: expiredRuns, error: fetchError } = await supabase
                .from('test_runs')
                .select('id, project_id, guest_session_id, options')
                .lt('created_at', cutoffISO)
                .not('guest_session_id', 'is', null) // Only guests for now
                .limit(BATCH_SIZE)

            if (fetchError) {
                console.error('[Cleanup Job] Failed to fetch expired runs:', fetchError)
                Sentry.captureException(fetchError)
                return
            }

            if (!expiredRuns || expiredRuns.length === 0) {
                hasMore = false
                break
            }

            console.log(`[Cleanup Job] Processing batch of ${expiredRuns.length} expired runs`)

            for (const run of expiredRuns) {
                try {
                    // 1. Delete from Wasabi (Video, Trace, Screenshots)
                    if (wasabi) {
                        await wasabi.deleteRun(run.id)
                    }

                    // 2. Delete from Supabase Storage (if used)
                    // Note: 'cleanupArtifacts' job handles individual artifact rows, but we want to nuking the run.
                    // We should ideally list artifacts for this run and delete them from Supabase storage bucket `artifacts`
                    const { data: artifacts } = await supabase
                        .from('test_artifacts')
                        .select('path')
                        .eq('run_id', run.id)

                    if (artifacts && artifacts.length > 0) {
                        const paths = artifacts.map(a => a.path)
                        await supabase.storage
                            .from(process.env.SUPABASE_STORAGE_BUCKET || 'artifacts')
                            .remove(paths)
                    }

                    // 3. Delete from Database (CASCADE will remove artifacts, logs, etc.)
                    const { error: deleteError } = await supabase
                        .from('test_runs')
                        .delete()
                        .eq('id', run.id)

                    if (deleteError) {
                        console.error(`[Cleanup Job] Failed to delete run ${run.id} from DB:`, deleteError)
                    } else {
                        processedCount++
                    }

                } catch (runError) {
                    console.error(`[Cleanup Job] Error processing run ${run.id}:`, runError)
                }
            }

            // Check if we exhausted the batch
            hasMore = expiredRuns.length === BATCH_SIZE

            // Gentle pause
            if (hasMore) await new Promise(r => setTimeout(r, 1000))
        }

        console.log(`[Cleanup Job] Completed. Deleted ${processedCount} expired runs.`)

    } catch (error: any) {
        console.error('[Cleanup Job] Fatal error:', error)
        Sentry.captureException(error)
    }
}

/**
 * Start the scheduler
 */
export function startTestRunCleanupScheduler() {
    // Run every hour
    const interval = 60 * 60 * 1000

    console.log('[Cleanup Scheduler] Starting test run cleanup scheduler (1h interval)')

    // Run on startup after short delay
    setTimeout(() => {
        cleanupOldTestRuns().catch(e => console.error(e))
    }, 2 * 60 * 1000) // 2 mins after start

    setInterval(() => {
        cleanupOldTestRuns().catch(e => console.error(e))
    }, interval)
}
