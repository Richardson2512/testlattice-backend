// Registered user test run routes - for authenticated users
import { FastifyInstance } from 'fastify'
import { CreateTestRunRequest, TestRunStatus } from '../../types'
import { Database } from '../../lib/db'
import { enqueueTestRun } from '../../lib/queue'
import { authenticate, AuthenticatedRequest } from '../../middleware/auth'
import { config } from '../../config/env'
import { getUserTier, validateTierLimits, applyTierRestrictions, TIER_LIMITS, UserTier } from '../../lib/tierSystem'

export async function registeredTestRunRoutes(fastify: FastifyInstance) {
  // Create a new test run (requires authentication)
  fastify.post<{ Body: CreateTestRunRequest }>('/run', {
    preHandler: authenticate,
  }, async (request: AuthenticatedRequest, reply: any) => {
    try {
      const { projectId, build, profile, options } = request.body as CreateTestRunRequest

      // Get user tier
      const userTier = await getUserTier(request.user?.id)
      const tierLimits = TIER_LIMITS[userTier]

      // Validate tier limits
      const validation = validateTierLimits(userTier, options || {}, profile)
      if (!validation.valid) {
        return reply.code(403).send({
          error: 'Tier limit exceeded',
          message: validation.errors.join('; '),
          tier: userTier,
          limits: tierLimits,
        })
      }

      // Apply tier restrictions to options
      const restrictedOptions = applyTierRestrictions(userTier, {
        ...(options || {}),
        approvalPolicy: options?.approvalPolicy ?? { mode: 'manual' as const },
      })

      const normalizedOptions = {
        ...restrictedOptions,
        userTier, // Pass tier to worker
      }

      // Reject mobile test requests (Appium is disabled)
      if (build.type === 'android' || build.type === 'ios') {
        return reply.code(400).send({
          error: 'Mobile testing is not available',
          message: 'Mobile testing (Android/iOS) is currently disabled. Only web application testing is supported. Set ENABLE_APPIUM=true in worker/.env to enable mobile testing.',
        })
      }

      // Enforce currently supported modes (single + multi only)
      const supportedModes: Array<'single' | 'multi'> = ['single', 'multi']
      if (options?.testMode && !supportedModes.includes(options.testMode as 'single' | 'multi')) {
        return reply.code(400).send({
          error: 'Unsupported test mode selected',
          message: 'All Pages and Monkey Explorer are upcoming features. Please choose single-page or multi-page tests.',
        })
      }
      if (options?.allPages || options?.monkeyMode) {
        return reply.code(400).send({
          error: 'Unsupported test configuration',
          message: 'All Pages and Monkey Explorer are not available yet. Disable legacy flags and try again.',
        })
      }

      // Validate project exists
      const project = await Database.getProject(projectId)
      if (!project) {
        return reply.code(404).send({ error: 'Project not found' })
      }

      // Create test run record (associate with authenticated user)
      const testRun = await Database.createTestRun({
        projectId,
        build,
        profile,
        options: normalizedOptions,
        status: TestRunStatus.PENDING,
      }, request.user?.id) // Pass authenticated user ID

      // Enqueue job
      try {
        await enqueueTestRun({
          runId: testRun.id,
          projectId,
          build,
          profile,
          options: normalizedOptions,
        })
        
        // Update status to queued only if enqueue succeeded
        await Database.updateTestRun(testRun.id, {
          status: TestRunStatus.QUEUED,
        })
        
        fastify.log.info(`Test run ${testRun.id} enqueued successfully`)
      } catch (queueError: any) {
        fastify.log.error(`Failed to enqueue test run ${testRun.id}:`, queueError)
        // Update status to failed if queue is unavailable
        await Database.updateTestRun(testRun.id, {
          status: TestRunStatus.FAILED,
          error: `Failed to enqueue: ${queueError.message}`,
        })
        return reply.code(500).send({ 
          error: 'Failed to enqueue test run. Please ensure Redis is running and worker service is started.',
          details: queueError.message 
        })
      }

      return reply.code(201).send({
        success: true,
        runId: testRun.id,
        testRun: await Database.getTestRun(testRun.id),
      })
    } catch (error: any) {
      fastify.log.error(error)
      return reply.code(500).send({ error: error.message || 'Failed to create test run' })
    }
  })

  // Approve test run (Explicit endpoint for approval) - Registered users only
  fastify.post<{ Params: { runId: string } }>('/:runId/approve', {
    preHandler: authenticate,
  }, async (request: AuthenticatedRequest, reply: any) => {
    try {
      const { runId } = request.params as { runId: string }
      
      const testRun = await Database.getTestRun(runId)
      if (!testRun) {
        return reply.code(404).send({ error: 'Test run not found' })
      }

      if (testRun.status !== TestRunStatus.WAITING_APPROVAL) {
        return reply.code(400).send({ error: 'Test run is not waiting for approval' })
      }

      await enqueueTestRun({
        runId: testRun.id,
        projectId: testRun.projectId,
        build: testRun.build,
        profile: testRun.profile,
        options: testRun.options
      }, { allowDuplicate: true })
      
      await Database.updateTestRun(runId, {
        status: TestRunStatus.QUEUED
      })

      const updatedRun = await Database.getTestRun(runId)
      return reply.send({ success: true, testRun: updatedRun })
    } catch (error: any) {
      fastify.log.error(error)
      return reply.code(500).send({ error: error.message || 'Failed to approve test run' })
    }
  })

  // Generate report (works with partial data) - Registered users only
  fastify.post<{ Params: { runId: string } }>('/:runId/report', {
    preHandler: authenticate,
  }, async (request: AuthenticatedRequest, reply: any) => {
    try {
      const { runId } = request.params as { runId: string }
      
      const testRun = await Database.getTestRun(runId)
      if (!testRun) {
        return reply.code(404).send({ error: 'Test run not found' })
      }

      // Generate report from current steps (partial or complete)
      const steps = testRun.steps || []
      const apiBaseUrl = config.apiUrl || process.env.API_URL || `http://localhost:3001`
      const reportUrl = `${apiBaseUrl}/api/tests/${runId}/report-view`

      const updated = await Database.updateTestRun(runId, {
        reportUrl,
      })

      return reply.send({ 
        success: true, 
        testRun: updated,
        reportUrl,
        message: `Report generated with ${steps.length} steps`,
      })
    } catch (error: any) {
      fastify.log.error(error)
      return reply.code(500).send({ error: error.message || 'Failed to generate report' })
    }
  })

  // Delete test run - Registered users only
  fastify.delete<{ Params: { runId: string } }>('/:runId', {
    preHandler: authenticate,
  }, async (request: AuthenticatedRequest, reply: any) => {
    try {
      const { runId } = request.params as { runId: string }
      
      const testRun = await Database.getTestRun(runId)
      if (!testRun) {
        return reply.code(404).send({ error: 'Test run not found' })
      }

      // Delete the test run
      await Database.deleteTestRun(runId)

      return reply.send({ success: true, message: 'Test run deleted successfully' })
    } catch (error: any) {
      fastify.log.error(error)
      return reply.code(500).send({ error: error.message || 'Failed to delete test run' })
    }
  })
}

