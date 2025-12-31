// BullMQ queue setup
import { Queue } from 'bullmq'
import IORedis from 'ioredis'
import { config } from '../config/env'
import { JobData } from '../types'

// Lazy Redis connection - only create when needed
let connection: IORedis | null = null
let testQueue: Queue<JobData> | null = null
let guestQueue: Queue<JobData> | null = null // Separate queue for guest tests

function getRedisConnection(): IORedis {
  if (!connection) {
    // Read directly from process.env to avoid config module caching issues
    const redisUrl = process.env.REDIS_URL || config.redis.url || 'redis://localhost:6379'

    try {
      connection = new IORedis(redisUrl, {
        maxRetriesPerRequest: null,
        retryStrategy: (times) => {
          // Retry connection with exponential backoff
          if (times < 3) {
            return Math.min(times * 200, 2000)
          }
          // If Redis is not available, log warning but don't crash
          console.warn('Redis connection failed. Queue will not work, but API will continue.')
          return null
        },
        lazyConnect: true,
      })

      connection.on('error', (err) => {
        console.warn('Redis connection error:', err.message)
      })

      connection.connect().catch((err) => {
        console.warn('Redis not available. Queue functionality will be limited.')
        console.warn('Redis connection error:', err.message)
      })
    } catch (error: any) {
      console.warn('Failed to create Redis connection:', error.message)
      // Create a dummy connection to prevent crashes
      connection = new IORedis('redis://localhost:6379', {
        maxRetriesPerRequest: null,
        lazyConnect: true,
        enableOfflineQueue: false,
      })
    }
  }
  return connection
}

function getQueue(): Queue<JobData> {
  if (!testQueue) {
    try {
      testQueue = new Queue<JobData>('test-runner', {
        connection: getRedisConnection(),
        defaultJobOptions: {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000,
          },
          removeOnComplete: {
            age: 3600, // Keep completed jobs for 1 hour
            count: 1000,
          },
          removeOnFail: {
            age: 86400, // Keep failed jobs for 24 hours
          },
        },
      })
    } catch (error: any) {
      console.warn('Failed to create queue:', error.message)
      // Create a dummy queue that won't work but won't crash
      testQueue = new Queue<JobData>('test-runner', {
        connection: getRedisConnection(),
        defaultJobOptions: {},
      })
    }
  }
  return testQueue
}

/**
 * Get or create the guest test queue
 * Separate from main test queue for:
 * - Independent scaling
 * - Isolated processing
 * - Different retry/timeout settings
 */
function getGuestQueue(): Queue<JobData> {
  if (!guestQueue) {
    try {
      guestQueue = new Queue<JobData>('guest-runner', {
        connection: getRedisConnection(),
        defaultJobOptions: {
          attempts: 2, // Fewer retries for guests
          backoff: {
            type: 'exponential',
            delay: 1000,
          },
          removeOnComplete: {
            age: 1800, // Keep completed jobs for 30 minutes (shorter for guests)
            count: 500,
          },
          removeOnFail: {
            age: 3600, // Keep failed jobs for 1 hour (shorter for guests)
          },
        },
      })
      console.log('✅ Guest queue (guest-runner) initialized')
    } catch (error: any) {
      console.warn('Failed to create guest queue:', error.message)
      guestQueue = new Queue<JobData>('guest-runner', {
        connection: getRedisConnection(),
        defaultJobOptions: {},
      })
    }
  }
  return guestQueue
}

/**
 * Enqueue a registered user test run
 * Uses 'test-runner' queue → processed by main TestProcessor
 * 
 * If browserMatrix is provided, creates separate jobs for each browser.
 * Parallelism is controlled by queue concurrency settings.
 */
export async function enqueueTestRun(jobData: JobData, opts?: { allowDuplicate?: boolean }) {
  try {
    const queue = getQueue()
    const connection = getRedisConnection()

    // Verify Redis connection before adding job
    await connection.ping()

    // Handle parallel browser testing
    const browserMatrix = jobData.options?.browserMatrix
    const parentRunId = jobData.runId

    if (browserMatrix && browserMatrix.length > 1) {
      // Create separate jobs for each browser in the matrix
      const jobs = []
      for (const browserType of browserMatrix) {
        const browserJobData: JobData = {
          ...jobData,
          browserType,
          parentRunId,
          // Create unique runId for each browser job
          runId: `${parentRunId}-${browserType}`,
        }

        const jobId = opts?.allowDuplicate ? undefined : `test-${browserJobData.runId}`
        const priority = (jobData.userTier === 'pro' || jobData.userTier === 'enterprise') ? 10 : 1
        const job = await queue.add('test-run', browserJobData, {
          priority,
          jobId,
        })
        jobs.push(job)
        console.log(`✅ Browser job ${browserJobData.runId} (${browserType}) enqueued to test-runner (Job ID: ${job.id})`)
      }
      return jobs[0] // Return first job for compatibility
    } else {
      // Single browser job (default or single browser in matrix)
      const browserType = browserMatrix?.[0] || 'chromium'
      const singleJobData: JobData = {
        ...jobData,
        browserType: browserMatrix ? browserType : undefined, // Only set if explicitly in matrix
      }

      const jobId = opts?.allowDuplicate ? undefined : `test-${singleJobData.runId}`
      const priority = (jobData.userTier === 'pro' || jobData.userTier === 'enterprise') ? 10 : 1
      const job = await queue.add('test-run', singleJobData, {
        priority,
        jobId,
      })

      console.log(`✅ Test run ${singleJobData.runId} enqueued to test-runner (Job ID: ${job.id})`)
      return job
    }
  } catch (error: any) {
    console.error('❌ Failed to enqueue test run:', error.message)
    console.error('💡 Please check:')
    console.error('   1. Redis is running')
    console.error('   2. REDIS_URL in api/.env is correct')
    console.error('   3. Worker service is running')
    throw new Error(`Queue is not available: ${error.message}`)
  }
}

/**
 * Enqueue a guest test run
 * Uses 'guest-runner' queue → processed by GuestTestProcessor
 * Separate queue for:
 * - Isolated processing (doesn't compete with registered users)
 * - Independent scaling
 * - Shorter retention periods
 */
export async function enqueueGuestTestRun(jobData: JobData) {
  try {
    const queue = getGuestQueue()
    const connection = getRedisConnection()

    // Verify Redis connection before adding job
    await connection.ping()

    const jobId = `guest-${jobData.runId}`

    const job = await queue.add('guest-test-run', jobData, {
      priority: 1,
      jobId,
    })

    console.log(`✅ Guest test ${jobData.runId} enqueued to guest-runner (Job ID: ${job.id})`)
    return job
  } catch (error: any) {
    console.error('❌ Failed to enqueue guest test run:', error.message)
    throw new Error(`Guest queue is not available: ${error.message}`)
  }
}

export async function getJobStatus(jobId: string) {
  // Check both queues
  const mainQueue = getQueue()
  const guestQ = getGuestQueue()

  let job = await mainQueue.getJob(jobId)
  if (!job) {
    job = await guestQ.getJob(jobId)
  }
  if (!job) return null

  const state = await job.getState()
  const progress = job.progress
  const data = job.data

  return {
    id: job.id,
    state,
    progress,
    data,
    failedReason: job.failedReason,
  }
}
