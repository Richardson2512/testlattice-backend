// Tier information endpoint - returns tier limits and features
import { FastifyInstance } from 'fastify'
import { TIER_LIMITS, UserTier, getUserTier } from '../../lib/tierSystem'
import { AuthenticatedRequest, optionalAuth } from '../../middleware/auth'

export async function tierInfoRoutes(fastify: FastifyInstance) {
  // Get tier information for current user
  fastify.get('/tier/info', {
    preHandler: optionalAuth,
  }, async (request: AuthenticatedRequest, reply: any) => {
    try {
      const userTier = await getUserTier(request.user?.id)
      const limits = TIER_LIMITS[userTier]
      
      return reply.send({
        tier: userTier,
        limits,
        features: {
          diagnosis: limits.diagnosis.enabled,
          godMode: limits.godMode,
          videoRecording: limits.videoRecording,
          traceRecording: limits.traceRecording,
          selfHealing: limits.selfHealingRetries > 0,
          testSuggestions: limits.testSuggestions,
          comprehensiveTesting: limits.comprehensiveTesting,
        },
      })
    } catch (error: any) {
      fastify.log.error('Tier info error:', error)
      return reply.code(500).send({ error: error.message || 'Failed to get tier information' })
    }
  })
}

