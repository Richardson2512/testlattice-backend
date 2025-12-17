// BullMQ queue setup
import { Queue } from 'bullmq'
import IORedis from 'ioredis'
import { config } from '../config/env'
import { JobData } from '../types'

// Lazy Redis connection - only create when needed
let connection: IORedis | null = null
let testQueue: Queue<JobData> | null = null

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

export async function enqueueTestRun(jobData: JobData, opts?: { allowDuplicate?: boolean }) {
  try {
    const queue = getQueue()
    const connection = getRedisConnection()
    
    // Verify Redis connection before adding job
    await connection.ping()
    
    const jobId = opts?.allowDuplicate ? undefined : `test-${jobData.runId}`

    const job = await queue.add('test-run', jobData, {
      priority: 1,
      jobId,
    })
    
    console.log(`✅ Test run ${jobData.runId} enqueued successfully (Job ID: ${job.id})`)
    return job
  } catch (error: any) {
    console.error('❌ Failed to enqueue test run:', error.message)
    console.error('💡 Please check:')
    console.error('   1. Redis is running')
    console.error('   2. REDIS_URL in api/.env is correct')
    console.error('   3. Worker service is running')
    throw new Error(`Queue is not available: ${error.message}`)
  }
}

export async function getJobStatus(jobId: string) {
  const queue = getQueue()
  const job = await queue.getJob(jobId)
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

