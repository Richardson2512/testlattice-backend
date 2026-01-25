// Project routes
import { FastifyInstance } from 'fastify'
import { Database } from '../lib/db'
import { authenticate, AuthenticatedRequest } from '../middleware/auth'
import { getUserTier, TIER_LIMITS } from '../lib/tierSystem'

// UUID validation regex
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function projectRoutes(fastify: FastifyInstance) {
  // List projects (requires authentication)
  fastify.get<{ Querystring: { teamId?: string } }>('/', {
    preHandler: authenticate,
  }, async (request: AuthenticatedRequest, reply) => {
    try {
      const { teamId } = request.query as { teamId?: string }
      const userId = request.user?.id

      // Pass userId to enforce filtering if teamId is not provided (or in addition to it)
      const projects = await Database.listProjects(teamId, userId)

      return reply.send({ projects })
    } catch (error: any) {
      fastify.log.error(error)
      return reply.code(500).send({ error: error.message || 'Failed to list projects' })
    }
  })

  // Get project (requires authentication)
  fastify.get<{ Params: { projectId: string } }>('/:projectId', {
    preHandler: authenticate,
  }, async (request: AuthenticatedRequest, reply) => {
    try {
      const { projectId } = request.params as { projectId: string }

      // Validate UUID format
      if (!UUID_REGEX.test(projectId)) {
        return reply.code(400).send({ error: 'Invalid project ID format' })
      }

      // Enforce ownership: Pass request.user.id
      const project = await Database.getProject(projectId, request.user?.id)

      if (!project) {
        return reply.code(404).send({ error: 'Project not found' })
      }

      return reply.send({ project })
    } catch (error: any) {
      fastify.log.error(error)
      return reply.code(500).send({ error: error.message || 'Failed to get project' })
    }
  })

  // Create project (requires authentication)
  fastify.post<{ Body: { name: string; description?: string; teamId: string } }>('/', {
    preHandler: authenticate,
  }, async (request: AuthenticatedRequest, reply) => {
    try {
      const { name, description, teamId } = request.body as { name: string; description?: string; teamId: string }
      const userId = request.user?.id

      if (!name || !teamId) {
        return reply.code(400).send({ error: 'Name and teamId are required' })
      }

      // Enforce Project Creation Limits
      if (userId) {
        const tier = await getUserTier(userId)
        const limits = TIER_LIMITS[tier]
        const maxProjects = limits.maxProjects

        // If limit is finite (0 or specific number), check count
        if (maxProjects !== Infinity) {
          const userProjects = await Database.listProjects(undefined, userId)
          // Note: listProjects returns projects owned by user OR in their team. 
          // Stricter check: Count only projects owned by user if we want owner-based limits?
          // User said: "starter tier gets 1 project"
          // We'll count all accessible projects for now to be safe/strict as per "Enforce" request.
          // Or filtering by ownership might be fairer if they are invited to other teams.
          // Given "Free users... 0 projects", checking total access prevents loopholes.

          if (userProjects.length >= maxProjects) {
            const message = maxProjects === 0
              ? `Your current plan (${tier}) does not support creating projects. Please upgrade.`
              : `You have reached the maximum of ${maxProjects} project(s) allowed on the ${tier} plan.`
            return reply.code(403).send({
              error: message,
              tier,
              limit: maxProjects,
              current: userProjects.length
            })
          }
        }
      }

      fastify.log.info({ name, teamId, userId: request.user?.id }, 'Creating project')

      // Pass request.user.id as owner
      const project = await Database.createProject({
        name,
        description,
        teamId,
      }, request.user?.id) // Pass authenticated user ID

      fastify.log.info({ projectId: project.id }, 'Project created successfully')

      return reply.code(201).send({ project })
    } catch (error: any) {
      fastify.log.error({
        error: error.message,
        stack: error.stack,
        body: request.body,
        userId: request.user?.id,
      }, 'Failed to create project')

      // Provide more detailed error information
      const errorMessage = error.message || 'Failed to create project'
      const errorDetails = error.code ? ` (Code: ${error.code})` : ''

      return reply.code(500).send({
        error: errorMessage + errorDetails,
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      })
    }
  })

  // Update project (requires authentication)
  fastify.patch<{ Params: { projectId: string }; Body: { name?: string; description?: string } }>('/:projectId', {
    preHandler: authenticate,
  }, async (request: AuthenticatedRequest, reply) => {
    try {
      const { projectId } = request.params as { projectId: string }

      // Validate UUID format
      if (!UUID_REGEX.test(projectId)) {
        return reply.code(400).send({ error: 'Invalid project ID format' })
      }

      const updates = request.body as { name?: string; description?: string }

      // Enforce ownership: Pass request.user.id
      const project = await Database.getProject(projectId, request.user?.id)
      if (!project) {
        return reply.code(404).send({ error: 'Project not found' })
      }

      const updated = await Database.updateProject(projectId, updates)
      return reply.send({ project: updated })
    } catch (error: any) {
      fastify.log.error(error)
      return reply.code(500).send({ error: error.message || 'Failed to update project' })
    }
  })

  // Delete project (requires authentication)
  fastify.delete<{ Params: { projectId: string } }>('/:projectId', {
    preHandler: authenticate,
  }, async (request: AuthenticatedRequest, reply) => {
    try {
      const { projectId } = request.params as { projectId: string }

      // Validate UUID format
      if (!UUID_REGEX.test(projectId)) {
        return reply.code(400).send({ error: 'Invalid project ID format' })
      }

      // Enforce ownership: Pass request.user.id
      const project = await Database.getProject(projectId, request.user?.id)
      if (!project) {
        return reply.code(404).send({ error: 'Project not found' })
      }

      await Database.deleteProject(projectId)
      return reply.send({ success: true, message: 'Project deleted' })
    } catch (error: any) {
      fastify.log.error(error)
      return reply.code(500).send({ error: error.message || 'Failed to delete project' })
    }
  })
}
