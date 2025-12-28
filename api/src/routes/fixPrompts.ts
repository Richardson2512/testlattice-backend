/**
 * Fix Prompt Routes
 * Handles generation and retrieval of AI fix prompts for test runs
 */

import { FastifyInstance } from 'fastify'
import { FixPromptService } from '../services/fixPromptService'
import { Database } from '../lib/db'
import { AuthenticatedRequest, requireAuth } from '../middleware/auth'
import { OpenRouterService } from '../lib/openRouter'

export async function fixPromptRoutes(fastify: FastifyInstance) {
  const fixPromptService = new FixPromptService()

  /**
   * Generate fix prompt for a test run
   * POST /api/tests/:testId/fix-prompt
   */
  fastify.post('/api/tests/:testId/fix-prompt', {
    preHandler: requireAuth,
  }, async (request: AuthenticatedRequest, reply: any) => {
    try {
      const { testId } = request.params as { testId: string }
      const { model } = request.body as { model?: string }

      if (!testId) {
        return reply.code(400).send({ error: 'Test ID is required' })
      }

      // Get test run
      const testRun = await Database.getTestRun(testId)
      if (!testRun) {
        return reply.code(404).send({ error: 'Test run not found' })
      }

      // Check if prompt already exists
      const existing = await fixPromptService.getExistingPrompt(testId)
      if (existing) {
        return reply.send({
          success: true,
          fixPrompt: existing,
          message: 'Fix prompt already generated for this test run',
        })
      }

      // Validate eligibility
      const validation = await fixPromptService.validateEligibility(request.user?.id)
      if (!validation.eligible) {
        return reply.code(403).send({
          error: validation.reason || 'Not eligible',
          requiresUpgrade: true,
        })
      }

      // Validate test status
      if (testRun.status !== 'completed' && testRun.status !== 'failed') {
        return reply.code(400).send({
          error: 'Test must be completed to generate fix prompt',
        })
      }

      // Use provided model or default to recommended
      const selectedModel = model || OpenRouterService.getRecommendedModel()

      // Generate prompt
      const fixPrompt = await fixPromptService.generatePrompt(
        testRun,
        selectedModel,
        request.user?.id
      )

      return reply.send({
        success: true,
        fixPrompt,
        message: 'Fix prompt generated successfully',
      })
    } catch (error: any) {
      fastify.log.error('Fix prompt generation error:', error)
      return reply.code(500).send({
        error: error.message || 'Failed to generate fix prompt',
      })
    }
  })

  /**
   * Get existing fix prompt for a test run
   * GET /api/tests/:testId/fix-prompt
   */
  fastify.get('/api/tests/:testId/fix-prompt', {
    preHandler: requireAuth,
  }, async (request: AuthenticatedRequest, reply: any) => {
    try {
      const { testId } = request.params as { testId: string }

      if (!testId) {
        return reply.code(400).send({ error: 'Test ID is required' })
      }

      // Get test run
      const testRun = await Database.getTestRun(testId)
      if (!testRun) {
        return reply.code(404).send({ error: 'Test run not found' })
      }

      // Get existing prompt
      const fixPrompt = await fixPromptService.getExistingPrompt(testId)

      if (!fixPrompt) {
        return reply.code(404).send({
          error: 'Fix prompt not found',
          canGenerate: true,
        })
      }

      return reply.send({
        success: true,
        fixPrompt,
      })
    } catch (error: any) {
      fastify.log.error('Get fix prompt error:', error)
      return reply.code(500).send({
        error: error.message || 'Failed to get fix prompt',
      })
    }
  })

  /**
   * Get available models for fix prompt generation
   * GET /api/fix-prompts/models
   */
  fastify.get('/api/fix-prompts/models', {
    preHandler: requireAuth,
  }, async (request: AuthenticatedRequest, reply: any) => {
    try {
      const models = OpenRouterService.getAvailableModels()
      const recommended = OpenRouterService.getRecommendedModel()

      return reply.send({
        success: true,
        models,
        recommended,
      })
    } catch (error: any) {
      fastify.log.error('Get models error:', error)
      return reply.code(500).send({
        error: error.message || 'Failed to get models',
      })
    }
  })
}

