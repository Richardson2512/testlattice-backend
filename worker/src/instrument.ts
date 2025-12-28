// Sentry initialization - must be imported first
import * as Sentry from '@sentry/node'
// import { nodeProfilingIntegration } from '@sentry/profiling-node'  // Temporarily disabled due to TypeError
import { config } from './config/env'

if (config.sentry.dsn) {
  try {
    Sentry.init({
      dsn: config.sentry.dsn,
      integrations: [
        // nodeProfilingIntegration(),  // Temporarily disabled due to TypeError on setup
      ],
      // Send structured logs to Sentry
      // Tracing
      tracesSampleRate: 1.0, // Capture 100% of the transactions
      // Set sampling rate for profiling - this is evaluated only once per SDK.init call
      profilesSampleRate: 1.0,
      // Setting this option to true will send default PII data to Sentry.
      // For example, automatic IP address collection on events
      sendDefaultPii: true,
      environment: process.env.NODE_ENV || 'production',
    })

    console.log('✅ Sentry initialized for Worker service')
  } catch (error: any) {
    console.warn('⚠️  Sentry initialization failed:', error.message)
  }
} else {
  // Silent - Sentry is optional
}

// Profiling happens automatically after setting it up with `Sentry.init()`.
// All spans (unless those discarded by sampling) will have profiling data attached to them.

export { Sentry }

