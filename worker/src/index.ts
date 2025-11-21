// IMPORTANT: Load environment variables FIRST, before any other imports
// Use require for dotenv to ensure it loads synchronously before any ES6 imports
const dotenv = require('dotenv')
const path = require('path')

// Load .env file from worker directory
// When running with `npm run dev` from worker/, process.cwd() is worker/
const envPath = path.resolve(process.cwd(), '.env')
const result = dotenv.config({ path: envPath })

// Log for debugging
if (process.env.NODE_ENV === 'development') {
  console.log('Loading .env from:', envPath)
  if (result.error) {
    console.error('❌ Error loading .env:', result.error.message)
  } else {
    console.log('✅ .env file loaded successfully')
  }
  console.log('PINECONE_API_KEY:', process.env.PINECONE_API_KEY ? '✅ Set' : '❌ Missing')
  console.log('REDIS_URL:', process.env.REDIS_URL ? '✅ Set' : '❌ Missing')
  console.log('MISTRAL_API_KEY:', process.env.MISTRAL_API_KEY ? '✅ Set' : '❌ Missing')
}

// IMPORTANT: Import Sentry instrument second, after env vars are loaded
import './instrument'

import { Worker } from 'bullmq'
import IORedis from 'ioredis'
import * as Sentry from '@sentry/node'
import { config } from './config/env'
import { JobData, TestRunStatus } from './types'
import { MistralService } from './services/mistral'
import { DeepseekService } from './services/deepseek'
import { StorageService } from './services/storage'
import { PineconeService } from './services/pinecone'
import { PlaywrightRunner } from './runners/playwright'
import { AppiumRunner } from './runners/appium'
import { TestProcessor } from './processors/testProcessor'

// Redis connection with error handling
// Read directly from process.env first (after dotenv loads) to avoid config caching
const redisUrl = process.env.REDIS_URL || config.redis.url || 'redis://localhost:6379'

console.log(`📡 Connecting to Redis: ${redisUrl.replace(/:[^:@]+@/, ':****@')}`) // Hide password in logs

const connection = new IORedis(redisUrl, {
  maxRetriesPerRequest: null,
  retryStrategy: (times) => {
    if (times < 3) {
      const delay = Math.min(times * 200, 2000)
      console.log(`🔄 Redis retry attempt ${times}/3 (waiting ${delay}ms)...`)
      return delay
    }
    console.error('❌ Redis connection failed after 3 retries.')
    console.error('💡 Please check:')
    console.error(`   1. Redis is running at: ${redisUrl.replace(/:[^:@]+@/, ':****@')}`)
    console.error('   2. REDIS_URL in worker/.env is correct')
    console.error('   3. Redis server is accessible from this machine')
    console.error('   4. Firewall/network allows connection to Redis')
    return null
  },
  reconnectOnError: (err) => {
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
  console.log('✅ Redis connected')
})

connection.on('error', (err) => {
  console.error('❌ Redis connection error:', err.message)
  if (err.message.includes('ECONNREFUSED')) {
    console.error('💡 Redis server is not running or not accessible')
  } else if (err.message.includes('ENOTFOUND')) {
    console.error('💡 Redis hostname could not be resolved')
  } else if (err.message.includes('ETIMEDOUT')) {
    console.error('💡 Redis connection timed out - check network/firewall')
  }
})

connection.on('ready', () => {
  console.log('✅ Redis ready')
})

connection.on('close', () => {
  console.warn('⚠️  Redis connection closed')
})

connection.on('reconnecting', (delay) => {
  console.log(`🔄 Redis reconnecting in ${delay}ms...`)
})

// Initialize services
const mistralService = new MistralService(config.mistral.apiKey || '')

// Initialize Deepseek service for instruction parsing
let deepseekService: DeepseekService | null = null
const deepseekApiKey = process.env.DEEPSEEK_API_KEY || config.deepseek.apiKey || ''
if (deepseekApiKey) {
  deepseekService = new DeepseekService(deepseekApiKey)
  console.log('✅ Deepseek service initialized for instruction parsing')
} else {
  console.warn('⚠️  DEEPSEEK_API_KEY not found - instruction parsing will use fallback method')
}
// Initialize storage service with Supabase configuration
// IMPORTANT: Use SERVICE_ROLE_KEY for storage operations to bypass RLS policies
const supabaseUrl = process.env.SUPABASE_URL || config.supabase.url || ''
// Worker MUST use service role key for storage uploads (bypasses RLS)
// Storage policies require service_role for INSERT operations
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || config.supabase.serviceRoleKey || ''
const supabaseAnonKey = process.env.SUPABASE_KEY || config.supabase.storageKey || ''

if (!supabaseServiceRoleKey) {
  console.warn('⚠️  WARNING: SUPABASE_SERVICE_ROLE_KEY not found in worker/.env')
  console.warn('⚠️  Storage uploads will fail with RLS policy violations')
  console.warn('⚠️  Please add SUPABASE_SERVICE_ROLE_KEY to worker/.env')
}

// Use service role key (required for storage), fall back to anon key only if service role not available
const storageKey = supabaseServiceRoleKey || supabaseAnonKey
const storageService = new StorageService(supabaseUrl, storageKey)

// Lazy Pinecone initialization - only create if API key is available
// Read directly from process.env to avoid config module caching issues
let pineconeService: PineconeService | null = null
function getPineconeService(): PineconeService | null {
  const apiKey = process.env.PINECONE_API_KEY || config.pinecone.apiKey
  const indexName = process.env.PINECONE_INDEX_NAME || config.pinecone.indexName || 'testlattice'
  
  if (!pineconeService && apiKey) {
    try {
      pineconeService = new PineconeService(apiKey, indexName)
      // Initialize Pinecone connection (async, non-blocking)
      pineconeService.initialize().catch((err) => {
        console.warn('⚠️  Pinecone initialization failed (optional service):', err.message)
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
const appiumRunner = new AppiumRunner(config.testRunners.appiumUrl)

// Create test processor
const testProcessor = new TestProcessor(
  mistralService,
  deepseekService, // Deepseek service for instruction parsing
  storageService,
  getPineconeService(), // Use lazy getter - will return null if API key not available
  playwrightRunner,
  appiumRunner
)

// Worker processor
async function processTestJob(jobData: JobData) {
  const { runId } = jobData
  
  console.log(`[${runId}] Processing test job:`, jobData.build.type, jobData.profile.device)
  
  try {
    // Process test run
    const result = await testProcessor.process(jobData)
    
    // Update test run status via API
    const apiUrl = config.api.url || process.env.API_URL || 'http://localhost:3001'
    const updateStatus = result.success ? TestRunStatus.COMPLETED : TestRunStatus.FAILED
    
    try {
      const fetch = (await import('node-fetch')).default
      await fetch(`${apiUrl}/api/tests/${runId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: updateStatus,
          steps: result.steps,
          completedAt: new Date().toISOString(),
          reportUrl: result.artifacts[0], // First artifact as report URL
        }),
      })
    } catch (apiError) {
      console.error(`[${runId}] Failed to update API:`, apiError)
    }
    
    console.log(`[${runId}] Test run ${result.success ? 'completed' : 'failed'}:`, {
      steps: result.steps.length,
      artifacts: result.artifacts.length,
    })
    
    return {
      success: result.success,
      runId,
      steps: result.steps.length,
      artifacts: result.artifacts.length,
    }
  } catch (error: any) {
    console.error(`[${runId}] Test job failed:`, error)
    
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
        console.warn('Failed to capture error in Sentry:', sentryError)
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
          status: TestRunStatus.FAILED,
          error: error.message,
          completedAt: new Date().toISOString(),
        }),
      })
    } catch (apiError) {
      console.error(`[${runId}] Failed to update API:`, apiError)
      if (config.sentry.dsn) {
        try {
          Sentry.captureException(apiError, {
            tags: { runId, errorType: 'api_update_failed' },
          })
        } catch (sentryError) {
          // Sentry capture failed, but don't fail the job
          console.warn('Failed to capture error in Sentry:', sentryError)
        }
      }
    }
    
    throw error
  }
}

// Create worker with error handling
let worker: Worker<JobData>
try {
  worker = new Worker<JobData>(
    'test-runner',
    async (job) => {
      return await processTestJob(job.data)
    },
    {
      connection,
      concurrency: config.worker.concurrency || 5,
    }
  )
  
  console.log('✅ Worker created successfully')
} catch (error: any) {
  console.error('❌ Failed to create worker:', error.message)
  process.exit(1)
}

// Worker event handlers
worker.on('completed', (job) => {
  console.log(`✓ Job ${job.id} completed successfully`)
})

worker.on('failed', (job, err) => {
  console.error(`✗ Job ${job?.id} failed:`, err?.message)
})

worker.on('active', (job) => {
  console.log(`→ Job ${job.id} started processing`)
})

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully')
  await worker.close()
  await connection.quit()
  process.exit(0)
})

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully')
  await worker.close()
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
        console.log('✅ Redis connection already established')
      } else {
        // Wait for connection to complete
        console.log('⏳ Waiting for Redis connection to complete...')
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
          console.log('⏳ Redis connection already in progress, waiting for completion...')
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
    
    console.log('✅ Redis ping successful')
    console.log('✅ Worker started, waiting for jobs...')
    console.log(`📊 Concurrency: ${config.worker.concurrency || 5}`)
    console.log(`🌐 Playwright Grid: ${config.testRunners.playwrightGridUrl || 'Not configured'}`)
    console.log(`📱 Appium: ${config.testRunners.appiumUrl || 'Not configured'}`)
    console.log(`🔗 API URL: ${config.api.url || 'http://localhost:3001'}`)
    
    // Log optional services status (check process.env directly to avoid config caching)
    const pineconeApiKey = process.env.PINECONE_API_KEY || config.pinecone.apiKey
    if (pineconeApiKey) {
      console.log('✅ Pinecone: Configured (will initialize on first use)')
    } else {
      console.log('ℹ️  Pinecone: Not configured (optional)')
    }
    
    const sentryDsn = process.env.SENTRY_DSN || config.sentry.dsn
    if (sentryDsn) {
      console.log('✅ Sentry: Configured')
    } else {
      console.log('ℹ️  Sentry: Not configured (optional)')
    }
    
  } catch (err: any) {
    // Handle specific error cases
    if (err.message.includes('already connecting') || err.message.includes('already connected')) {
      // Connection is already in progress, wait a bit and try ping
      console.log('⏳ Redis connection in progress, waiting...')
      await new Promise(resolve => setTimeout(resolve, 2000))
      try {
        const pingResult = await connection.ping()
        if (pingResult === 'PONG') {
          console.log('✅ Redis connection established after wait')
          // Continue with worker startup - re-run the success path
          console.log('✅ Redis ping successful')
          console.log('✅ Worker started, waiting for jobs...')
          console.log(`📊 Concurrency: ${config.worker.concurrency || 5}`)
          console.log(`🌐 Playwright Grid: ${config.testRunners.playwrightGridUrl || 'Not configured'}`)
          console.log(`📱 Appium: ${config.testRunners.appiumUrl || 'Not configured'}`)
          console.log(`🔗 API URL: ${config.api.url || 'http://localhost:3001'}`)
          const pineconeApiKeyRetry = process.env.PINECONE_API_KEY || config.pinecone.apiKey
          if (pineconeApiKeyRetry) {
            console.log('✅ Pinecone: Configured (will initialize on first use)')
          } else {
            console.log('ℹ️  Pinecone: Not configured (optional)')
          }
          const sentryDsnRetry = process.env.SENTRY_DSN || config.sentry.dsn
          if (sentryDsnRetry) {
            console.log('✅ Sentry: Configured')
          } else {
            console.log('ℹ️  Sentry: Not configured (optional)')
          }
          return // Success, exit function
        } else {
          throw new Error('Redis ping failed after wait')
        }
      } catch (pingErr: any) {
        console.error('❌ Redis connection failed after retry:', pingErr.message)
        console.error('❌ Worker cannot start without Redis connection')
        console.error('💡 Please check:')
        console.error(`   1. Redis is running at: ${redisUrl.replace(/:[^:@]+@/, ':****@')}`)
        console.error('   2. REDIS_URL in worker/.env is correct')
        console.error('   3. Redis server is accessible from this machine')
        console.error('   4. Firewall/network allows connection to Redis')
        console.error('   5. No other worker instances are running')
        console.error('')
        console.error('   To test Redis connection manually:')
        console.error(`   redis-cli -u ${redisUrl.replace(/:[^:@]+@/, ':****@')} ping`)
        process.exit(1)
      }
    } else {
      console.error('❌ Redis connection failed:', err.message)
      console.error('❌ Worker cannot start without Redis connection')
      console.error('💡 Please check:')
      console.error(`   1. Redis is running at: ${redisUrl.replace(/:[^:@]+@/, ':****@')}`)
      console.error('   2. REDIS_URL in worker/.env is correct')
      console.error('   3. Redis server is accessible from this machine')
      console.error('   4. Firewall/network allows connection to Redis')
      console.error('   5. No other worker instances are running')
      console.error('')
      console.error('   To test Redis connection manually:')
      console.error(`   redis-cli -u ${redisUrl.replace(/:[^:@]+@/, ':****@')} ping`)
      process.exit(1)
    }
  }
}

// Start worker
startWorker()

