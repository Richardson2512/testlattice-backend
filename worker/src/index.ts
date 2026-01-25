// IMPORTANT: Load environment variables FIRST, before any other imports
// Use require for dotenv to ensure it loads synchronously before any ES6 imports
const path = require('path')

// Only load dotenv in development - production uses real env vars from Railway/container
if (process.env.NODE_ENV !== 'production') {
  const dotenv = require('dotenv')

  // Load .env file from worker directory
  // When running with `npm run dev` from worker/, process.cwd() is worker/
  const envPath = path.resolve(process.cwd(), '.env')
  const result = dotenv.config({ path: envPath })

  // Log for debugging in development
  console.log('Loading .env from:', envPath)
  if (result.error) {
    console.error('❌ Error loading .env:', result.error.message)
  } else {
    console.log('✅ .env file loaded successfully')
  }
  console.log('PINECONE_API_KEY:', process.env.PINECONE_API_KEY ? '✅ Set' : '❌ Missing')
  console.log('REDIS_URL:', process.env.REDIS_URL ? '✅ Set' : '❌ Missing')
  console.log('OPENAI_API_KEY:', process.env.OPENAI_API_KEY ? '✅ Set' : '❌ Missing')
}

// IMPORTANT: Import Sentry instrument second, after env vars are loaded
import 'reflect-metadata'
import './instrument'

import { createClient } from '@supabase/supabase-js'

import { Worker } from 'bullmq'
import IORedis from 'ioredis'
import * as Sentry from '@sentry/node'
import { config } from './config/env'
import { logger } from './utils/logger'
import { JobData, TestRunStatus } from './types'
import { UnifiedBrainService } from './services/unifiedBrainService'
import { StorageService } from './services/storage'
import { PineconeService } from './services/pinecone'
import { PlaywrightRunner } from './runners/playwright'

import { TestProcessor } from './processors/testProcessor'
import { VisionValidatorService } from './services/visionValidator'
import { StateManager } from './services/StateManager'
import { GuestTestProcessorRefactored } from './processors/GuestTestProcessorRefactored'
// Import new architecture bootstrap
import { initializeArchitecture, shutdownArchitecture } from './bootstrap'

// Redis connection with error handling
// Read directly from process.env first (after dotenv loads) to avoid config caching
const redisUrl = process.env.REDIS_URL || config.redis.url || 'redis://localhost:6379'

logger.info(`📡 Connecting to Redis: ${redisUrl.replace(/:[^:@]+@/, ':****@')}`) // Hide password in logs

const connection = new IORedis(redisUrl, {
  maxRetriesPerRequest: null,
  retryStrategy: (times: number) => {
    if (times < 3) {
      const delay = Math.min(times * 200, 2000)
      logger.warn(`🔄 Redis retry attempt ${times}/3 (waiting ${delay}ms)...`)
      return delay
    }
    logger.error('❌ Redis connection failed after 3 retries.')
    logger.error('💡 Please check:')
    logger.error(`   1. Redis is running at: ${redisUrl.replace(/:[^:@]+@/, ':****@')}`)
    logger.error('   2. REDIS_URL in worker/.env is correct')
    logger.error('   3. Redis server is accessible from this machine')
    logger.error('   4. Firewall/network allows connection to Redis')
    return null
  },
  reconnectOnError: (err: Error) => {
    const targetError = 'READONLY'
    if (err.message.includes(targetError)) {
      return true
    }
    return false
  },
  lazyConnect: true, // Don't auto-connect, we'll connect manually
  enableOfflineQueue: false, // Don't queue commands when offline
})

connection.on('connect', () => {
  logger.info('✅ Redis connected')
})

connection.on('error', (err: Error) => {
  logger.error({ err: err.message }, '❌ Redis connection error')
  if (err.message.includes('ECONNREFUSED')) {
    logger.error('💡 Redis server is not running or not accessible')
  } else if (err.message.includes('ENOTFOUND')) {
    logger.error('💡 Redis hostname could not be resolved')
  } else if (err.message.includes('ETIMEDOUT')) {
    logger.error('💡 Redis connection timed out - check network/firewall')
  }
})

connection.on('ready', () => {
  logger.info('✅ Redis ready')
})

connection.on('close', () => {
  logger.warn('⚠️  Redis connection closed')
})

connection.on('reconnecting', (delay: number) => {
  logger.warn(`🔄 Redis reconnecting in ${delay}ms...`)
})

// Initialize Unified Brain Service for GUEST tests (GPT-5 Mini)
// Uses OPENAI_API_KEY - token tracking labeled as [Guest]
const guestBrain = new UnifiedBrainService(connection)
logger.info('✅ Guest Brain Service initialized (GPT-5 Mini, OPENAI_API_KEY)')

// Initialize Unified Brain Service for REGISTERED tests (GPT-5 Mini)
// Uses OPENAI_API_KEY_REGISTERED for separate rate limits and cost tracking
let registeredBrain: UnifiedBrainService
const registeredApiKey = process.env.OPENAI_API_KEY_REGISTERED
if (registeredApiKey) {
  // Temporarily swap API key for registered brain initialization
  const originalKey = process.env.OPENAI_API_KEY
  process.env.OPENAI_API_KEY = registeredApiKey
  registeredBrain = new UnifiedBrainService(connection)
  process.env.OPENAI_API_KEY = originalKey // Restore
  logger.info('✅ Registered Brain Service initialized (GPT-5 Mini, OPENAI_API_KEY_REGISTERED)')
} else {
  // Fall back to guest brain if no separate key
  logger.info('ℹ️  OPENAI_API_KEY_REGISTERED not set, using same brain for both test types')
  registeredBrain = guestBrain
}

// Initialize storage service with Supabase configuration
// IMPORTANT: Use SERVICE_ROLE_KEY for storage operations to bypass RLS policies
// Uses config which validates env vars at startup
const supabaseUrl = config.supabase.url
// Worker MUST use service role key for storage uploads (bypasses RLS)
// Storage policies require service_role for INSERT operations
const supabaseServiceRoleKey = config.supabase.serviceRoleKey
const supabaseAnonKey = config.supabase.storageKey || config.supabase.serviceRoleKey
const supabaseBucket = process.env.SUPABASE_STORAGE_BUCKET || 'artifacts'

// Use service role key (required for storage), fall back to anon key only if service role not available
// Use service role key (required for storage), fall back to anon key only if service role not available
// Use service role key (required for storage), fall back to anon key only if service role not available
const storageKey = supabaseServiceRoleKey || supabaseAnonKey
const supabase = createClient(supabaseUrl, storageKey)
const stateManager = new StateManager(connection, supabase)

// Initialize Wasabi storage for heavy artifacts (videos, screenshots, traces)
import { createWasabiStorage, WasabiStorageService } from './services/wasabiStorage'
import { createTraceService, TraceService } from './services/traceService'

let wasabiStorage: WasabiStorageService | null = null
let traceService: TraceService

if (config.wasabi.enabled) {
  wasabiStorage = createWasabiStorage()
  if (wasabiStorage) {
    logger.info('✅ Wasabi storage initialized (videos, screenshots, traces)')
  }
} else {
  logger.info('ℹ️  Wasabi storage disabled (using Supabase for all artifacts)')
}

// Pass wasabiStorage to StorageService (facade)
const storageService = new StorageService(supabaseUrl, storageKey, supabaseBucket, wasabiStorage)

traceService = createTraceService(wasabiStorage)
logger.info('✅ TraceService initialized')

// Export for use in processors
export { wasabiStorage, traceService }

// Lazy Pinecone initialization - only create if API key is available
// Read directly from process.env to avoid config module caching issues
let pineconeService: PineconeService | null = null
function getPineconeService(): PineconeService | null {
  const apiKey = process.env.PINECONE_API_KEY || config.pinecone.apiKey
  const indexName = process.env.PINECONE_INDEX_NAME || config.pinecone.indexName || 'Rihario'

  if (!pineconeService && apiKey) {
    try {
      pineconeService = new PineconeService(apiKey, indexName)
      // Initialize Pinecone connection (async, non-blocking)
      pineconeService.initialize().catch((err) => {
        logger.warn({ err: err.message }, '⚠️  Pinecone initialization failed (optional service)')
        pineconeService = null // Reset on failure
      })
    } catch (error: any) {
      // Silent - Pinecone is optional
      return null
    }
  }
  return pineconeService
}
const playwrightRunner = new PlaywrightRunner(config.testRunners.playwrightGridUrl)
// Appium is disabled by default - set ENABLE_APPIUM=true to enable
// Appium is disabled/removed
const appiumRunner = null

// Optional vision validator (OpenAI GPT-4o with selective usage)
let visionValidatorService: VisionValidatorService | null = null
const visionApiKey = process.env.OPENAI_API_KEY || process.env.VISION_API_KEY || ''
if (visionApiKey) {
  try {
    visionValidatorService = new VisionValidatorService(
      visionApiKey,
      config.vision.model,
      undefined, // endpoint (uses default)
      config.vision.interval,
      config.vision.onError,
      config.vision.onIRLFallback
    )
    logger.info(`✅ Vision validator ready (model: ${config.vision.model}, selective usage enabled)`)
    logger.info(`   Interval: every ${config.vision.interval} steps, on errors: ${config.vision.onError}, on IRL fallback: ${config.vision.onIRLFallback}`)
  } catch (error: any) {
    logger.warn({ err: error.message }, '⚠️  Failed to initialize vision validator')
    visionValidatorService = null
  }
} else {
  logger.info('ℹ️  Vision validator disabled (OPENAI_API_KEY not configured)')
  logger.info('   Note: Set OPENAI_API_KEY to enable GPT-4o vision (selective usage)')
}

// Create test processor for registered users (full diagnosis + execution)
// Uses SEPARATE brain with OPENAI_API_KEY_REGISTERED for isolated billing
// AppiumRunner is nullable - mobile tests will be rejected if Appium is disabled
const testProcessor = new TestProcessor(
  registeredBrain, // Separate brain for registered tests
  storageService,
  getPineconeService(), // Use lazy getter - will return null if API key not available
  playwrightRunner,
  // appiumRunner removed
  visionValidatorService,
  config.vision.validatorInterval
)

// Create guest test processor (no diagnosis, simplified flow)
// Uses SEPARATE brain with OPENAI_API_KEY for isolated billing
// import { GuestTestProcessor } from './processors/GuestTestProcessor'
/* const guestProcessor = new GuestTestProcessor(
  guestBrain, // Separate brain for guest tests
  storageService,
  playwrightRunner
) */
console.log('✅ Guest Test Processor initialized (skip diagnosis, 25-step limit)')

import { BehaviorProcessor } from './processors/behaviorProcessor'
const behaviorProcessor = new BehaviorProcessor(registeredBrain)
logger.info('✅ Behavior Processor initialized')

// Helper function to save token usage to API
async function saveTokenMetrics(runId: string, testMode: string, brain: UnifiedBrainService) {
  try {
    const metrics = brain.getMetrics()
    const apiUrl = config.api.url || process.env.API_URL || 'http://localhost:3001'
    const model = process.env.OPENAI_MODEL || 'gpt-5-mini'

    const fetch = (await import('node-fetch')).default
    await fetch(`${apiUrl}/api/admin/token-usage/save`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        testRunId: runId,
        testMode: testMode,
        model: model,
        promptTokens: metrics.totalPromptTokens || 0,
        completionTokens: metrics.totalCompletionTokens || 0,
        totalTokens: metrics.totalTokens || 0,
        apiCalls: metrics.totalCalls || 0,
      }),
    })
    logger.info({ runId, totalTokens: metrics.totalTokens, apiCalls: metrics.totalCalls }, '📊 Token usage saved')
  } catch (error: any) {
    // Don't fail test if token saving fails
    logger.warn({ runId, err: error.message }, '⚠️ Failed to save token usage (non-blocking)')
  }
}

// Refactored Guest Job Processor
import { WebRTCStreamer } from './services/webrtcStreamer'

async function processGuestJob(jobData: JobData) {
  const { runId } = jobData
  logger.info({ runId }, '🎯 Processing Guest Test Job (Refactored)')

  let session: any = null
  let streamer: WebRTCStreamer | null = null

  try {
    const profile = jobData.profile || { device: 'desktop_chrome', browser: 'chromium' } as any
    session = await playwrightRunner.reserveSession(profile)
    logger.info({ runId, sessionId: session.id }, '✅ Session reserved')

    // Update status to 'running' IMMEDIATELY so frontend can show the stream
    try {
      const apiUrl = config.api.url || process.env.API_URL || 'http://localhost:3001'
      logger.info({ runId, apiUrl }, '📡 Updating test status to running...')
      const response = await fetch(`${apiUrl}/api/tests/${runId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'running' })
      })
      const responseText = await response.text()
      if (response.ok) {
        logger.info({ runId, status: response.status }, '✅ Status updated to running')
      } else {
        logger.warn({ runId, status: response.status, body: responseText }, '⚠️ Status update returned error')
      }
    } catch (statusErr: any) {
      logger.error({ runId, error: statusErr.message, stack: statusErr.stack }, '❌ Failed to update status to running')
    }

    // Initialize Streamer (Visual Vibe)
    streamer = new WebRTCStreamer()
    try {
      const livekitUrl = process.env.LIVEKIT_URL || config.streaming.livekitUrl
      const livekitApiKey = process.env.LIVEKIT_API_KEY || config.streaming.livekitApiKey
      const livekitApiSecret = process.env.LIVEKIT_API_SECRET || config.streaming.livekitApiSecret

      // Start streaming (HTTP MJPEG + Redis Broadcast for WebSockets)
      const status = await streamer.startStream({
        runId,
        sessionId: session.id,
        page: session.page,
        livekitUrl,
        livekitApiKey,
        livekitApiSecret,
        frameServerPort: 0
      })
      logger.info({ runId, streamUrl: status.streamUrl }, '✅ Stream started successfully')

      // Broadcast status update to frontend via WebSocket
      try {
        await connection.publish('ws:broadcast', JSON.stringify({
          runId,
          payload: { type: 'test_status', status: 'running' },
          serverId: 'worker-guest'
        }))
        logger.info({ runId }, '📡 Broadcasted running status via WebSocket')
      } catch (wsErr: any) {
        logger.warn({ runId, error: wsErr.message }, '⚠️ Failed to broadcast status')
      }
    } catch (streamError: any) {
      logger.warn({ runId, error: streamError.message }, '⚠️ Failed to start visual streamer')
    }

    const startTime = new Date()
    const processor = new GuestTestProcessorRefactored(
      {
        runId: jobData.runId,
        url: jobData.build.url || 'about:blank',
        userId: jobData.runId,
        userTier: jobData.userTier || 'free',
        testMode: 'guest',
        ...jobData.options
      },
      {
        supabase,
        redis: connection,
        page: session.page,
        storage: storageService,
        runner: playwrightRunner,
        brain: (jobData.options?.guestTestType === 'login' || jobData.options?.guestTestType === 'signup') ? guestBrain : null,
        stateManager,
        sessionId: session.id
      }
    )
    logger.info({ runId }, '🚀 Starting Guest Processor Execution')
    const result = await processor.process()

    // Generate comprehensive report summary (ScoutQA-style)
    let reportSummary = null
    try {
      reportSummary = await processor.generateReportSummary(startTime)
      logger.info({ runId, issuesFound: reportSummary.issuesFound }, '📊 Report summary generated')
    } catch (summaryErr: any) {
      logger.warn({ runId, error: summaryErr.message }, '⚠️ Failed to generate report summary')
    }

    logger.info({ runId, success: result.success }, '🏁 Guest Processor Execution Completed')
    return { ...result, reportSummary }

  } catch (error: any) {
    // CRITICAL: Catch ALL errors (including session reservation) to prevent BullMQ retries
    logger.error({ runId, error: error.message, stack: error.stack }, '❌ Guest Job failed')

    // Save error to database so frontend shows failure instead of "Processing..."
    try {
      const apiUrl = config.api.url || process.env.API_URL || 'http://localhost:3001'
      await fetch(`${apiUrl}/api/tests/${runId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'completed',
          error: error.message || 'Test execution failed',
          completedAt: new Date().toISOString()
        })
      })
      logger.info({ runId }, '✅ Error state saved to DB')
    } catch (apiErr: any) {
      logger.error({ runId, error: apiErr.message }, '❌ Failed to save error state to DB')
    }

    // Return gracefully - never throw
    return {
      success: false,
      steps: [],
      artifacts: [],
      stage: 'execution',
      error: error.message
    }
  } finally {
    // Cleanup
    if (streamer) {
      await streamer.stopStream().catch(e => logger.warn({ err: e.message }, 'Failed to stop streamer'))
    }
    if (session) {
      await playwrightRunner.releaseSession(session.id).catch(e => logger.warn({ err: e.message }, 'Failed to release session'))
    }
  }
}

// Worker processor
async function processTestJob(jobData: JobData) {
  const { runId, options } = jobData
  const testMode = options?.testMode || 'single'

  // Route guest tests to dedicated processor
  if (options?.isGuestRun || options?.testMode === 'guest') {
    logger.info({ runId }, '🎯 Routing to Guest Test Processor (Refactored)')
    const result = await processGuestJob(jobData)

    // Update test run status via API (Reporting)
    const apiUrl = config.api.url || process.env.API_URL || 'http://localhost:3001'
    const updateStatus = TestRunStatus.COMPLETED // Tests always complete - findings at step level

    // Upload Report to Wasabi
    let reportUrl = ''
    if (wasabiStorage) {
      try {
        const reportData = {
          runId,
          status: updateStatus,
          steps: result.steps,
          summary: (result as any).reportSummary, // ScoutQA-style summary
          completedAt: new Date().toISOString(),
          options: jobData.options
        }
        reportUrl = await wasabiStorage.uploadJson(`runs/${runId}/report.json`, reportData)
        logger.info({ runId, reportUrl }, '✅ Uploaded test report to Wasabi')
      } catch (e: any) {
        logger.warn({ runId, error: e.message }, '⚠️ Failed to upload report to Wasabi')
      }
    }

    try {
      const fetch = (await import('node-fetch')).default
      await fetch(`${apiUrl}/api/tests/${runId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: updateStatus,
          steps: result.steps,
          summary: (result as any).reportSummary, // ScoutQA-style summary
          completedAt: new Date().toISOString(),
          reportUrl // Include Wasabi URL
        }),
      })
      logger.info({ runId, status: updateStatus }, '✅ Guest test report saved to API')

      // Broadcast completion status via WebSocket so frontend updates immediately
      try {
        await connection.publish('ws:broadcast', JSON.stringify({
          runId,
          serverId: 'worker-guest',
          payload: { type: 'test_status', status: 'completed' }
        }))
        logger.info({ runId }, '📡 Broadcasted completed status via WebSocket')
      } catch (wsErr) {
        logger.warn({ runId, err: wsErr }, '⚠️ Failed to broadcast completion')
      }
    } catch (apiError) {
      logger.error({ runId, err: apiError }, '❌ Failed to save guest test report to API')
    }

    // Save token usage for guest tests
    await saveTokenMetrics(runId, 'guest', guestBrain)
    return result
  }

  if (options?.testMode === 'behavior') {
    logger.info({ runId }, '🎯 Routing to Behavior Processor')
    const result = await behaviorProcessor.process(jobData)
    // Save token usage for behavior tests
    await saveTokenMetrics(runId, 'behavior', registeredBrain)
    return result
  }

  logger.info({ runId, type: jobData.build.type, device: jobData.profile.device }, 'Processing test job')

  try {
    // Process test run
    const result = await testProcessor.process(jobData)

    // If we're waiting for approval, don't mark the run as completed yet
    if (result.stage === 'diagnosis') {
      logger.info({ runId }, 'Diagnosis finished. Awaiting user approval before execution.')
      // Save partial token usage for diagnosis phase
      await saveTokenMetrics(runId, `${testMode}_diagnosis`, registeredBrain)
      return {
        success: true,
        runId,
        steps: result.steps.length,
        artifacts: result.artifacts.length,
        stage: 'diagnosis',
      }
    }

    // Update test run status via API
    const apiUrl = config.api.url || process.env.API_URL || 'http://localhost:3001'
    const updateStatus = TestRunStatus.COMPLETED // Tests always complete - findings at step level

    try {
      const fetch = (await import('node-fetch')).default
      await fetch(`${apiUrl}/api/tests/${runId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: updateStatus,
          steps: result.steps,
          completedAt: new Date().toISOString(),
        }),
      })
    } catch (apiError) {
      logger.error({ runId, err: apiError }, 'Failed to update API')
    }

    // Save token usage after execution completes
    await saveTokenMetrics(runId, testMode, registeredBrain)

    logger.info({
      runId,
      status: 'completed', // Tests always complete - findings at step level
      steps: result.steps.length,
      artifacts: result.artifacts.length,
    }, `Test run completed`)

    return {
      success: result.success,
      runId,
      steps: result.steps.length,
      artifacts: result.artifacts.length,
      stage: 'execution',
    }
  } catch (error: any) {
    logger.error({ runId, err: error }, 'Test job failed')

    // Still try to save token usage on failure
    await saveTokenMetrics(runId, `${testMode}_failed`, registeredBrain)

    // Capture error in Sentry (if configured)
    if (config.sentry.dsn) {
      try {
        Sentry.captureException(error, {
          tags: {
            runId,
            buildType: jobData.build.type,
            device: jobData.profile.device,
          },
          extra: {
            runId,
            projectId: jobData.projectId,
            build: jobData.build,
            profile: jobData.profile,
          },
        })
      } catch (sentryError) {
        // Sentry capture failed, but don't fail the job
        logger.warn({ err: sentryError }, 'Failed to capture error in Sentry')
      }
    }

    // Update test run status to failed
    const apiUrl = process.env.API_URL || 'http://localhost:3001'
    try {
      const fetch = (await import('node-fetch')).default
      await fetch(`${apiUrl}/api/tests/${runId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: TestRunStatus.COMPLETED, // Tests always complete - errors are findings
          error: error.message,
          completedAt: new Date().toISOString(),
        }),
      })
    } catch (apiError) {
      logger.error({ runId, err: apiError }, 'Failed to update API')
      if (config.sentry.dsn) {
        try {
          Sentry.captureException(apiError, {
            tags: { runId, errorType: 'api_update_failed' },
          })
        } catch (sentryError) {
          // Sentry capture failed, but don't fail the job
          logger.warn({ err: sentryError }, 'Failed to capture error in Sentry')
        }
      }
    }

    // Return gracefully with error info instead of throwing (prevents BullMQ retries)
    return {
      success: false,
      runId,
      steps: 0,
      artifacts: 0,
      stage: 'execution',
      error: error.message
    }
  }
}

// Create worker with error handling
let worker: Worker<JobData>
try {
  worker = new Worker<JobData>(
    'test-runner',
    async (job: any) => {
      return await processTestJob(job.data)
    },
    {
      connection,
      concurrency: config.worker.concurrency || 5,
    }
  )

  console.log('✅ Main worker (test-runner) created successfully')
} catch (error: any) {
  logger.error({ err: error.message }, '❌ Failed to create main worker')
  process.exit(1)
}

// Create separate guest worker for guest-runner queue
// This provides isolation from main test processing
let guestWorker: Worker<JobData> | undefined
try {
  guestWorker = new Worker<JobData>(
    'guest-runner',
    async (job: any) => {
      logger.info({ runId: job.data.runId }, '🎯 Guest worker processing job (Refactored)')
      // IMPORTANT: Call processTestJob, not processGuestJob directly!
      // processTestJob handles the API PATCH to save completion status
      return await processTestJob(job.data)
    },
    {
      connection,
      concurrency: 3, // Lower concurrency for guest tests
    }
  )

  logger.info('✅ Guest worker (guest-runner) created successfully')
} catch (error: any) {
  logger.error({ err: error.message }, '❌ Failed to create guest worker')
  // Don't exit - main worker can still run
  logger.warn('⚠️  Guest tests will not be processed')
}

// Helper to safely update status via API with retries
async function safeUpdateStatus(
  jobId: string | undefined,
  runId: string,
  status: 'completed' | 'failed',
  error?: string,
  summary?: any
) {
  if (!runId) return

  const apiUrl = process.env.API_URL || config.api.url || 'http://localhost:3001'
  const maxRetries = 3

  for (let i = 0; i < maxRetries; i++) {
    try {
      const fetch = (await import('node-fetch')).default

      // First check current status to avoid overwriting 'completed' with 'failed' race conditions
      // or unnecessary updates if already correct
      try {
        const checkRes = await fetch(`${apiUrl}/api/tests/${runId}/status`)
        if (checkRes.ok) {
          const data = await checkRes.json()
          const currentStatus = data.testRun?.status
          // If already in a terminal state, don't overwrite unless it's to provide error details for a 'failed' state
          if ((currentStatus === 'completed' || currentStatus === 'failed' || currentStatus === 'cancelled') && !error) {
            logger.info({ runId, currentStatus }, 'ℹ️ Skipping status update - run already in terminal state')
            return
          }
        }
      } catch (e) {
        // Ignore check errors, proceed to update
      }

      await fetch(`${apiUrl}/api/tests/${runId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: status === 'failed' ? 'failed' : 'completed', // Map to valid enum values
          error,
          summary,
          completedAt: new Date().toISOString()
        })
      })

      logger.info({ runId, status, attempt: i + 1 }, '✅ Safety Net: Status synced to DB')
      return // Success
    } catch (err: any) {
      logger.warn({ runId, err: err.message, attempt: i + 1 }, '⚠️ Safety Net: Failed to sync status')
      if (i < maxRetries - 1) await new Promise(r => setTimeout(r, 1000 * (i + 1)))
    }
  }
  logger.error({ runId }, '❌ Safety Net: Could not sync status after retries')
}

// Main worker event handlers
worker.on('completed', async (job: any) => {
  logger.info({ jobId: job.id }, '✓ Main job completed successfully')
  // Safety net: Ensure DB is marked completed
  if (job?.data?.runId) {
    await safeUpdateStatus(job.id, job.data.runId, 'completed', undefined, job.returnvalue?.reportSummary)
  }
})

worker.on('failed', async (job: any, err: Error) => {
  logger.error({ jobId: job?.id, err: err?.message }, '✗ Main job failed')
  // Safety net: Ensure DB is marked failed
  if (job?.data?.runId) {
    await safeUpdateStatus(job.id, job.data.runId, 'failed', err?.message || 'Job failed in queue')
  }
})

worker.on('active', (job: any) => {
  logger.info({ jobId: job.id }, '→ Main job started processing')
})

// Guest worker event handlers
if (guestWorker) {
  guestWorker.on('completed', async (job: any) => {
    logger.info({ jobId: job.id }, '✓ Guest job completed successfully')
    // Safety net
    if (job?.data?.runId) {
      await safeUpdateStatus(job.id, job.data.runId, 'completed', undefined, job.returnvalue?.reportSummary)
    }
  })

  guestWorker.on('failed', async (job: any, err: Error) => {
    logger.error({ jobId: job?.id, err: err?.message }, '✗ Guest job failed')
    // Safety net
    if (job?.data?.runId) {
      await safeUpdateStatus(job.id, job.data.runId, 'failed', err?.message || 'Guest job failed in queue')
    }
  })

  guestWorker.on('active', (job: any) => {
    logger.info({ jobId: job.id }, '→ Guest job started processing')
  })
}

// Graceful shutdown - close both workers
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully')
  await worker.close()
  if (guestWorker) await guestWorker.close()
  await connection.quit()
  process.exit(0)
})

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully')
  await worker.close()
  if (guestWorker) await guestWorker.close()
  await connection.quit()
  process.exit(0)
})

// Connect to Redis and verify before starting worker
async function startWorker() {
  try {
    // Check connection status before connecting
    const status = connection.status
    if (status === 'ready' || status === 'connecting') {
      // Connection already established or in progress
      if (status === 'ready') {
        logger.info('✅ Redis connection already established')
      } else {
        // Wait for connection to complete
        logger.info('⏳ Waiting for Redis connection to complete...')
        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error('Redis connection timeout'))
          }, 10000) // 10 second timeout

          const onReady = () => {
            clearTimeout(timeout)
            connection.removeListener('error', onError)
            resolve()
          }

          const onError = (err: Error) => {
            clearTimeout(timeout)
            connection.removeListener('ready', onReady)
            reject(err)
          }

          if (connection.status === 'ready') {
            clearTimeout(timeout)
            resolve()
          } else {
            connection.once('ready', onReady)
            connection.once('error', onError)
          }
        })
      }
    } else {
      // Connect to Redis
      try {
        await connection.connect()
      } catch (connectErr: any) {
        // Handle "already connecting/connected" error gracefully
        if (connectErr.message.includes('already connecting') || connectErr.message.includes('already connected')) {
          logger.info('⏳ Redis connection already in progress, waiting for completion...')
          // Wait for connection to complete
          await new Promise<void>((resolve, reject) => {
            const timeout = setTimeout(() => {
              reject(new Error('Redis connection timeout'))
            }, 10000) // 10 second timeout

            const onReady = () => {
              clearTimeout(timeout)
              connection.removeListener('error', onError)
              resolve()
            }

            const onError = (err: Error) => {
              clearTimeout(timeout)
              connection.removeListener('ready', onReady)
              reject(err)
            }

            if (connection.status === 'ready') {
              clearTimeout(timeout)
              resolve()
            } else {
              connection.once('ready', onReady)
              connection.once('error', onError)
            }
          })
        } else {
          throw connectErr // Re-throw other errors
        }
      }
    }

    // Verify connection with ping
    const pingResult = await connection.ping()
    if (pingResult !== 'PONG') {
      throw new Error('Redis ping returned unexpected result')
    }

    logger.info('✅ Redis ping successful')

    // Initialize new architecture modules (config, cleanup jobs, metrics)
    await initializeArchitecture()

    logger.info('✅ Worker started, waiting for jobs...')
    logger.info(`📊 Concurrency: ${config.worker.concurrency || 5}`)
    logger.info(`🌐 Playwright Grid: ${config.testRunners.playwrightGridUrl || 'Not configured'}`)
    if (config.testRunners.appiumEnabled) {
      logger.info(`📱 Appium: ${config.testRunners.appiumUrl || 'Not configured'} (enabled)`)
    } else {
      logger.info(`📱 Appium: Disabled (set ENABLE_APPIUM=true to enable)`)
    }
    logger.info(`🔗 API URL: ${config.api.url || 'http://localhost:3001'}`)

    // Log optional services status (check process.env directly to avoid config caching)
    const pineconeApiKey = process.env.PINECONE_API_KEY || config.pinecone.apiKey
    if (pineconeApiKey) {
      logger.info('✅ Pinecone: Configured (will initialize on first use)')
    } else {
      logger.info('ℹ️  Pinecone: Not configured (optional)')
    }

    const sentryDsn = process.env.SENTRY_DSN || config.sentry.dsn
    if (sentryDsn) {
      logger.info('✅ Sentry: Configured')
    } else {
      logger.info('ℹ️  Sentry: Not configured (optional)')
    }

  } catch (err: any) {
    if (err.message.includes('already connecting') || err.message.includes('already connected')) {
      // Connection is already in progress, wait a bit and try ping
      logger.info('⏳ Redis connection in progress, waiting...')
      await new Promise(resolve => setTimeout(resolve, 2000))
      try {
        const pingResult = await connection.ping()
        if (pingResult === 'PONG') {
          logger.info('✅ Redis connection established after wait')
          // Continue with worker startup - re-run the success path
          logger.info('✅ Redis ping successful')
          logger.info('✅ Worker started, waiting for jobs...')
          logger.info(`📊 Concurrency: ${config.worker.concurrency || 5}`)
          logger.info(`🌐 Playwright Grid: ${config.testRunners.playwrightGridUrl || 'Not configured'}`)
          if (config.testRunners.appiumEnabled) {
            logger.info(`📱 Appium: ${config.testRunners.appiumUrl || 'Not configured'} (enabled)`)
          } else {
            logger.info(`📱 Appium: Disabled (set ENABLE_APPIUM=true to enable)`)
          }
          logger.info(`🔗 API URL: ${config.api.url || 'http://localhost:3001'}`)
          const pineconeApiKeyRetry = process.env.PINECONE_API_KEY || config.pinecone.apiKey
          if (pineconeApiKeyRetry) {
            logger.info('✅ Pinecone: Configured (will initialize on first use)')
          } else {
            logger.info('ℹ️  Pinecone: Not configured (optional)')
          }
          const sentryDsnRetry = process.env.SENTRY_DSN || config.sentry.dsn
          if (sentryDsnRetry) {
            logger.info('✅ Sentry: Configured')
          } else {
            logger.info('ℹ️  Sentry: Not configured (optional)')
          }
          return // Success, exit function
        } else {
          throw new Error('Redis ping failed after wait')
        }
      } catch (pingErr: any) {
        logger.error({ err: pingErr.message }, '❌ Redis connection failed after retry')
        logger.error('❌ Worker cannot start without Redis connection')
        logger.error('💡 Please check:')
        logger.error(`   1. Redis is running at: ${redisUrl.replace(/:[^:@]+@/, ':****@')}`)
        logger.error('   2. REDIS_URL in worker/.env is correct')
        logger.error('   3. Redis server is accessible from this machine')
        logger.error('   4. Firewall/network allows connection to Redis')
        logger.error('   5. No other worker instances are running')
        logger.error('')
        logger.error('   To test Redis connection manually:')
        logger.error(`   redis-cli -u ${redisUrl.replace(/:[^:@]+@/, ':****@')} ping`)
        process.exit(1)
      }
    } else {
      logger.error({ err: err.message }, '❌ Redis connection failed')
      logger.error('❌ Worker cannot start without Redis connection')
      logger.error('💡 Please check:')
      logger.error(`   1. Redis is running at: ${redisUrl.replace(/:[^:@]+@/, ':****@')}`)
      logger.error('   2. REDIS_URL in worker/.env is correct')
      logger.error('   3. Redis server is accessible from this machine')
      logger.error('   4. Firewall/network allows connection to Redis')
      logger.error('   5. No other worker instances are running')
      logger.error('')
      logger.error('   To test Redis connection manually:')
      logger.error(`   redis-cli -u ${redisUrl.replace(/:[^:@]+@/, ':****@')} ping`)
      process.exit(1)
    }
  }
}

// Start worker
startWorker()

// Graceful shutdown handler
async function gracefulShutdown(signal: string) {
  logger.info(`\n${signal} received. Starting graceful shutdown...`)

  try {
    // Shutdown architecture modules (cleanup jobs, metrics)
    await shutdownArchitecture()

    // Close Redis connection
    await connection.quit()
    logger.info('✅ Redis connection closed')

    logger.info('✅ Graceful shutdown complete')
    process.exit(0)
  } catch (error: any) {
    logger.error({ err: error.message }, '❌ Error during shutdown')
    process.exit(1)
  }
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'))
process.on('SIGINT', () => gracefulShutdown('SIGINT'))


