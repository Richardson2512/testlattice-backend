// Main test routes - delegates to guest, registered, and shared route modules
import { FastifyInstance } from 'fastify'
import { guestTestRunRoutes } from './guest/guestTestRuns'
import { registeredTestRunRoutes } from './registered/testRuns'
import { sharedTestManagementRoutes } from './shared/testManagement'
import { tierInfoRoutes } from './shared/tierInfo'

export async function testRoutes(fastify: FastifyInstance) {
  // Register guest routes (no auth required, rate limited)
  await fastify.register(guestTestRunRoutes, { prefix: '' })
  
  // Register registered user routes (requires authentication)
  await fastify.register(registeredTestRunRoutes, { prefix: '' })
  
  // Register shared routes (available to both guest and registered users)
  await fastify.register(sharedTestManagementRoutes, { prefix: '' })
  
  // Register tier info routes
  await fastify.register(tierInfoRoutes, { prefix: '/api' })
}
