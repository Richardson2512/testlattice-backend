// Project routes
import { FastifyInstance } from 'fastify'
import { Database } from '../lib/db'
import { authenticate, AuthenticatedRequest } from '../middleware/auth'

export async function projectRoutes(fastify: FastifyInstance) {
  // List projects (requires authentication)
  fastify.get<{ Querystring: { teamId?: string } }>('/', {
    preHandler: authenticate,
  }, async (request: AuthenticatedRequest, reply) => {
    try {
      const { teamId } = request.query as { teamId?: string }
      const projects = await Database.listProjects(teamId)
      
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
      const project = await Database.getProject(projectId)
      
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

      if (!name || !teamId) {
        return reply.code(400).send({ error: 'Name and teamId are required' })
      }

      fastify.log.info({ name, teamId, userId: request.user?.id }, 'Creating project')

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
}

