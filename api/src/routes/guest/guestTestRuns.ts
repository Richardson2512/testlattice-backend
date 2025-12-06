// Guest test run routes - for unauthenticated quick testing
import { FastifyInstance } from 'fastify'
import { CreateGuestTestRunRequest, TestRunStatus, DeviceProfile, BuildType } from '../../types'
import { Database } from '../../lib/db'
import { enqueueTestRun } from '../../lib/queue'
import { AuthenticatedRequest, optionalAuth } from '../../middleware/auth'
import { validateTestUrl, generateGuestSessionId, getGuestSessionFromCookie, setGuestSessionCookie } from '../../lib/urlValidator'
import { checkGuestRateLimit } from '../../lib/rateLimiter'
import { trackEvent, trackGuestTestStarted } from '../../lib/analytics'
import { validateTierLimits, applyTierRestrictions, TIER_LIMITS } from '../../lib/tierSystem'

export async function guestTestRunRoutes(fastify: FastifyInstance) {
  // Create a guest test run (no authentication required, but rate limited)
  fastify.post<{ Body: CreateGuestTestRunRequest & { email?: string } }>('/run/guest', {
    preHandler: optionalAuth, // Optional auth - allows guest or authenticated users
  }, async (request: AuthenticatedRequest, reply: any) => {
    try {
      const { url, build, profile, options, email } = request.body

      // Security: Validate URL (prevent SSRF attacks)
      const urlValidation = validateTestUrl(url)
      if (!urlValidation.valid) {
        return reply.code(400).send({ 
          error: 'Invalid URL',
          message: urlValidation.error 
        })
      }

      const sanitizedUrl = urlValidation.sanitizedUrl!

      // Enhanced session tracking with fingerprinting
      let guestSessionId: string
      if (request.user?.id) {
        // Authenticated users use their user ID
        guestSessionId = `user_${request.user.id}`
      } else {
        // Try to get from cookie first
        guestSessionId = getGuestSessionFromCookie(request) || generateGuestSessionId(request)
        // Set cookie for future requests
        setGuestSessionCookie(reply, guestSessionId)
      }

      // Progressive rate limiting
      const rateLimitResult = await checkGuestRateLimit(guestSessionId)
      if (!rateLimitResult.allowed) {
        // Track rate limit hit
        trackEvent('guest_rate_limit_exceeded', {
          sessionId: guestSessionId,
          tier: rateLimitResult.tier,
          retryAfter: rateLimitResult.retryAfter,
        }, request.user?.id, guestSessionId)
        
        return reply.code(429).send({
          error: 'Rate limit exceeded',
          message: rateLimitResult.reason,
          retryAfter: rateLimitResult.retryAfter,
          tier: rateLimitResult.tier,
          testsRemaining: rateLimitResult.testsRemaining,
          signupUrl: '/signup'
        })
      }

      // Get or create guest project
      const guestProject = await Database.getOrCreateGuestProject()

      // Enforce guest tier limits
      const guestTier = 'guest'
      const guestLimits = TIER_LIMITS[guestTier]

      // Validate guest tier limits
      const validation = validateTierLimits(guestTier, options || {}, profile)
      if (!validation.valid) {
        return reply.code(403).send({
          error: 'Guest tier limit exceeded',
          message: validation.errors.join('; '),
          tier: guestTier,
          limits: guestLimits,
          signupUrl: '/signup',
        })
      }

      // Apply guest tier restrictions
      // applyTierRestrictions will automatically set maxSteps to 25 for guest tier
      const restrictedOptions = applyTierRestrictions(guestTier, {
        ...options,
        skipDiagnosis: true, // Always skip diagnosis for guests
        approvalPolicy: { mode: 'auto' }, // Auto-approve for guests
        isGuestRun: true,
        guestSessionId,
        testMode: 'single', // Only single-page for guests
        userTier: guestTier, // Pass tier to worker
      })

      // Enforce Chrome only for guests
      const guestProfile = profile || {
        device: DeviceProfile.CHROME_LATEST,
      }
      if (guestProfile.device !== DeviceProfile.CHROME_LATEST) {
        return reply.code(403).send({
          error: 'Guest tier restriction',
          message: 'Guest tier only supports Chrome desktop. Please sign up for Starter tier to use other browsers.',
          tier: guestTier,
          signupUrl: '/signup',
        })
      }

      // Create test run with guest configuration
      const testRun = await Database.createTestRun({
        projectId: guestProject.id,
        build: {
          type: build?.type || 'web',
          url: sanitizedUrl,
          ...build,
        },
        profile: guestProfile,
        options: restrictedOptions,
        status: TestRunStatus.PENDING,
        guestSessionId,
      })

      // Enqueue job
      try {
        await enqueueTestRun({
          runId: testRun.id,
          projectId: guestProject.id,
          build: {
            type: BuildType.WEB,
            url: sanitizedUrl,
          },
          profile: profile || {
            device: DeviceProfile.CHROME_LATEST,
          },
          options: restrictedOptions,
        })
        
        // Update status to queued
        await Database.updateTestRun(testRun.id, {
          status: TestRunStatus.QUEUED,
        })
        
        fastify.log.info(`Guest test run ${testRun.id} enqueued successfully`)
        
        // Track analytics
        trackGuestTestStarted({
          url: sanitizedUrl,
          source: 'landing_page',
          sessionId: guestSessionId,
          email,
        })
      } catch (queueError: any) {
        fastify.log.error(`Failed to enqueue guest test run ${testRun.id}:`, queueError)
        await Database.updateTestRun(testRun.id, {
          status: TestRunStatus.FAILED,
          error: `Failed to enqueue: ${queueError.message}`,
        })
        return reply.code(500).send({ 
          error: 'Failed to start test. Please try again later.',
          details: queueError.message 
        })
      }

      const finalTestRun = await Database.getTestRun(testRun.id)
      
      return reply.code(201).send({
        success: true,
        runId: testRun.id,
        testRun: finalTestRun,
        isGuest: true,
        expiresAt: testRun.expiresAt,
        tier: rateLimitResult.tier,
        testsRemaining: rateLimitResult.testsRemaining,
        message: 'Test started! Results will be available for 24 hours.',
      })
    } catch (error: any) {
      fastify.log.error('Guest test run error:', error)
      return reply.code(500).send({ error: error.message || 'Failed to create guest test run' })
    }
  })

  // Cleanup expired guest runs (can be called by cron job)
  fastify.post('/cleanup-expired', async (request: any, reply: any) => {
    try {
      // Optional: Add API key check for security
      const apiKey = request.headers['x-api-key']
      const expectedKey = process.env.CLEANUP_API_KEY || 'cleanup-secret-key'
      
      if (apiKey !== expectedKey) {
        return reply.code(401).send({ error: 'Unauthorized' })
      }

      const deletedCount = await Database.cleanupExpiredGuestRuns()
      
      fastify.log.info(`Cleaned up ${deletedCount} expired guest test runs`)
      
      return reply.send({ 
        success: true, 
        deletedCount,
        message: `Cleaned up ${deletedCount} expired guest test runs` 
      })
    } catch (error: any) {
      fastify.log.error('Cleanup error:', error)
      return reply.code(500).send({ error: error.message || 'Failed to cleanup expired runs' })
    }
  })
}

