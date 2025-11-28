// IMPORTANT: Load environment variables FIRST, before any other imports
// Use require for dotenv to ensure it loads synchronously before any ES6 imports
// This MUST execute before any ES6 imports that might use environment variables
const dotenv = require('dotenv')
const path = require('path')

// Load .env file from api directory
// When running with `npm run dev` from api/, process.cwd() is api/
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
  console.log('SUPABASE_URL:', process.env.SUPABASE_URL ? '✅ Set' : '❌ Missing')
  console.log('SUPABASE_KEY:', process.env.SUPABASE_KEY ? '✅ Set' : '❌ Missing')
  console.log('SUPABASE_SERVICE_ROLE_KEY:', process.env.SUPABASE_SERVICE_ROLE_KEY ? '✅ Set' : '❌ Missing')
  console.log('SENTRY_DSN:', process.env.SENTRY_DSN ? '✅ Set' : '❌ Missing')
  if (process.env.SENTRY_DSN) {
    console.log('SENTRY_DSN value:', process.env.SENTRY_DSN.substring(0, 30) + '...')
  }
}

// IMPORTANT: Import Sentry instrument second, after env vars are loaded
import { initializeSentry } from './instrument'

// Initialize Sentry after dotenv has loaded
initializeSentry()

import Fastify from 'fastify'
import cors from '@fastify/cors'
import helmet from '@fastify/helmet'
import * as Sentry from '@sentry/node'
import { config } from './config/env'
import { Database } from './lib/db'
import { testRoutes } from './routes/tests'
import { projectRoutes } from './routes/projects'
import { integrationRoutes } from './routes/integrations'
import { billingRoutes } from './routes/billing'
import { TestControlWebSocket } from './lib/websocket'
import { RedisWebSocketManager } from './lib/websocketRedis'
import { startCleanupScheduler } from './jobs/cleanupArtifacts'

const fastify = Fastify({
  logger: true,
})

// Register plugins
async function registerPlugins() {
  // Build allowed origins from environment variables
  const allowedOrigins: string[] = []
  
  // Add APP_URL if configured
  if (config.appUrl && config.appUrl !== 'http://localhost:3000') {
    allowedOrigins.push(config.appUrl)
  }
  
  // Add NEXT_PUBLIC_APP_URL from environment if set
  const frontendUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL
  if (frontendUrl && !allowedOrigins.includes(frontendUrl)) {
    allowedOrigins.push(frontendUrl)
  }
  
  // In development, allow localhost origins
  if (config.nodeEnv === 'development') {
    allowedOrigins.push('http://localhost:3000', 'http://127.0.0.1:3000')
  }
  
  // Fallback to allow all if no origins configured (development only)
  const corsOrigins = allowedOrigins.length > 0 ? allowedOrigins : (config.nodeEnv === 'development' ? ['http://localhost:3000', 'http://127.0.0.1:3000'] : [config.appUrl || '*'])
  
  await fastify.register(cors, {
    origin: corsOrigins,
    credentials: true,
    // Allow all headers and methods for downloads
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  })
  
  await fastify.register(helmet, {
    contentSecurityPolicy: false, // Allow inline styles for development
  })
}

// Register routes
async function registerRoutes() {
  // Health check
  fastify.get('/health', async (request, reply) => {
    return { status: 'ok', timestamp: new Date().toISOString() }
  })

  // WebSocket stats (for monitoring)
  fastify.get('/api/ws/stats', async (request, reply) => {
    if (!testControlWS) {
      return reply.code(503).send({ error: 'WebSocket server not initialized' })
    }

    // Check if it's RedisWebSocketManager (has getStats method)
    if ('getStats' in testControlWS && typeof testControlWS.getStats === 'function') {
      const stats = await testControlWS.getStats()
      return reply.send(stats)
    }

    return reply.send({
      message: 'Using legacy WebSocket (no stats available)',
      type: 'in-memory'
    })
  })

  // Cleanup stats (for monitoring)
  fastify.get('/api/cleanup/stats', async (request, reply) => {
    try {
      const { getCleanupStats } = await import('./jobs/cleanupArtifacts')
      const stats = await getCleanupStats()
      
      if (!stats) {
        return reply.code(500).send({ error: 'Failed to fetch cleanup stats' })
      }

      return reply.send(stats)
    } catch (error: any) {
      fastify.log.error('Error fetching cleanup stats:', error)
      return reply.code(500).send({ error: error.message })
    }
  })

  // Debug endpoint for testing Sentry (optional)
  if (config.nodeEnv === 'development') {
    fastify.get('/debug-sentry', async (request, reply) => {
      // Send a log before throwing the error
      Sentry.logger.info('User triggered test error', {
        action: 'test_error_endpoint',
      })
      // Send a test metric before throwing the error
      Sentry.metrics.count('test_counter', 1)
      throw new Error('My first Sentry error!')
    })
  }

  // API routes
  fastify.register(async function (fastify) {
    // Test routes
    await fastify.register(testRoutes, { prefix: '/api/tests' })
    
    // Project routes
    await fastify.register(projectRoutes, { prefix: '/api/projects' })
    
    // Integration routes
    await fastify.register(integrationRoutes, { prefix: '/api/integrations' })
    
    // Billing routes
    await fastify.register(billingRoutes, { prefix: '/api/billing' })
  }, { prefix: '' })

  // Set up Sentry error handler (must be after all routes)
  fastify.setErrorHandler(async (error, request, reply) => {
    // Log error to Sentry
    Sentry.captureException(error, {
      tags: {
        route: request.url,
        method: request.method,
      },
      extra: {
        url: request.url,
        method: request.method,
        headers: request.headers,
      },
    })

    // Send error response
    reply.status(error.statusCode || 500).send({
      error: error.message || 'Internal Server Error',
      statusCode: error.statusCode || 500,
    })
  })
}

// Global WebSocket instance for test control (Human-in-the-Loop)
let testControlWS: TestControlWebSocket | RedisWebSocketManager | null = null

export function getTestControlWS(): TestControlWebSocket | RedisWebSocketManager | null {
  return testControlWS
}

// Start server
async function start() {
  try {
    await registerPlugins()
    await registerRoutes()
    
    // Initialize database with sample data (non-blocking)
    // Wait a bit to ensure env vars are fully loaded
    setTimeout(() => {
      Database.initialize().catch((err) => {
        fastify.log.warn('Database initialization warning:', err.message)
      })
    }, 1000)
    
    const port = config.port || 3001
    const host = config.host || '0.0.0.0'
    
    await fastify.listen({ port, host })
    fastify.log.info(`Server listening on http://${host}:${port}`)
    
    // Initialize WebSocket server for real-time test control (God Mode)
    // Use Redis-backed WebSocket for horizontal scaling
    const useRedis = process.env.USE_REDIS_WEBSOCKET !== 'false' // Default to true
    
    if (useRedis && process.env.REDIS_URL) {
      testControlWS = new RedisWebSocketManager(fastify.server, process.env.REDIS_URL)
      fastify.log.info('✅ Redis-backed WebSocket initialized (scalable across multiple servers)')
    } else {
      testControlWS = new TestControlWebSocket(fastify.server)
      fastify.log.warn('⚠️  Using in-memory WebSocket (not scalable - set REDIS_URL for production)')
    }
    
    // Start artifact cleanup scheduler
    if (process.env.ENABLE_ARTIFACT_CLEANUP !== 'false') {
      startCleanupScheduler()
      fastify.log.info('✅ Artifact cleanup scheduler started')
    } else {
      fastify.log.info('Artifact cleanup scheduler disabled (set ENABLE_ARTIFACT_CLEANUP=true to enable)')
    }
  } catch (err) {
    fastify.log.error(err)
    process.exit(1)
  }
}

start()

