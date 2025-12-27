/**
 * Scheduled Jobs for the API server
 * - Monthly usage reset
 * - Subscription reconciliation (optional)
 */
import cron from 'node-cron'

// Get Supabase client
const getSupabaseClient = async () => {
    const { createClient } = await import('@supabase/supabase-js')
    const { config } = await import('../config/env')
    return createClient(config.supabase.url, config.supabase.serviceRoleKey)
}

/**
 * Reset monthly usage counters for users whose reset date has passed
 * Runs at 00:05 UTC on the 1st of each month
 */
export function startUsageResetScheduler() {
    // Run at 00:05 on the 1st of every month (give 5 min buffer)
    cron.schedule('5 0 1 * *', async () => {
        console.log('[Scheduler] Running monthly usage reset...')
        try {
            const supabase = await getSupabaseClient()

            // Call the reset function we defined in SQL
            const { error } = await supabase.rpc('reset_monthly_usage')

            if (error) {
                console.error('[Scheduler] Failed to reset monthly usage:', error.message)
            } else {
                console.log('[Scheduler] ✅ Monthly usage reset complete')
            }
        } catch (err) {
            console.error('[Scheduler] Error in usage reset job:', err)
        }
    }, {
        timezone: 'UTC'
    })

    console.log('[Scheduler] Monthly usage reset job scheduled (1st of each month at 00:05 UTC)')
}

/**
 * Daily check for usage resets (for users who signed up mid-month)
 * Runs at 00:15 UTC every day
 */
export function startDailyUsageCheckScheduler() {
    cron.schedule('15 0 * * *', async () => {
        console.log('[Scheduler] Running daily usage check...')
        try {
            const supabase = await getSupabaseClient()

            // The SQL function already checks usage_reset_date <= NOW()
            const { error } = await supabase.rpc('reset_monthly_usage')

            if (error) {
                console.error('[Scheduler] Failed daily usage check:', error.message)
            } else {
                console.log('[Scheduler] ✅ Daily usage check complete')
            }
        } catch (err) {
            console.error('[Scheduler] Error in daily usage check:', err)
        }
    }, {
        timezone: 'UTC'
    })

    console.log('[Scheduler] Daily usage check job scheduled (00:15 UTC every day)')
}

/**
 * Start all scheduled jobs
 */
export function startScheduledJobs() {
    startUsageResetScheduler()
    startDailyUsageCheckScheduler()
    console.log('[Scheduler] All scheduled jobs started')
}
