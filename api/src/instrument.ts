// Sentry initialization - must be imported first
import * as Sentry from '@sentry/node'
// import { nodeProfilingIntegration } from '@sentry/profiling-node'

// Initialize Sentry - this function is called after dotenv loads
export function initializeSentry() {
  // Read directly from process.env to avoid config module caching issues
  const sentryDsn = process.env.SENTRY_DSN || ''
  
  // Debug logging
  console.log('[Sentry Init] Checking SENTRY_DSN...')
  console.log('[Sentry Init] process.env.SENTRY_DSN exists:', !!process.env.SENTRY_DSN)
  console.log('[Sentry Init] sentryDsn value:', sentryDsn ? sentryDsn.substring(0, 30) + '...' : 'empty')
  
  if (sentryDsn) {
    console.log('✅ Sentry DSN found, initializing Sentry...')
    Sentry.init({
      dsn: sentryDsn,
      integrations: [
        // nodeProfilingIntegration(), // Temporarily disabled due to TypeError on setup
      ],
      // Send structured logs to Sentry
      enableLogs: true,
      // Tracing
      tracesSampleRate: 1.0, // Capture 100% of the transactions
      // Set sampling rate for profiling - this is evaluated only once per SDK.init call
      profileSessionSampleRate: 1.0,
      // Trace lifecycle automatically enables profiling during active traces
      profileLifecycle: 'trace',
      // Setting this option to true will send default PII data to Sentry.
      // For example, automatic IP address collection on events
      sendDefaultPii: true,
      environment: process.env.NODE_ENV || 'development',
    })
    
    console.log('✅ Sentry initialized for API server')
  } else {
    console.log('⚠️  Sentry DSN not configured, skipping initialization')
    console.log('   SENTRY_DSN value:', process.env.SENTRY_DSN ? 'Set (but empty or invalid)' : 'Not found in process.env')
  }
}

// Auto-initialize if this module is imported (for backward compatibility)
// But prefer calling initializeSentry() explicitly after dotenv loads
if (typeof process !== 'undefined' && process.env && process.env.SENTRY_DSN) {
  initializeSentry()
}

// Profiling happens automatically after setting it up with `Sentry.init()`.
// All spans (unless those discarded by sampling) will have profiling data attached to them.

export { Sentry }

