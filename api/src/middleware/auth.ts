import { FastifyRequest, FastifyReply } from 'fastify'
import { supabaseAnon } from '../lib/supabase'

export interface AuthenticatedRequest extends FastifyRequest {
  user?: {
    id: string
    email: string
  }
  body?: any
  params?: any
}

/**
 * Authentication middleware for Fastify
 * Verifies Supabase JWT token from Authorization header
 * Uses anon client to verify user tokens (service role can't verify user tokens)
 */
export async function authenticate(
  request: AuthenticatedRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    const authHeader = request.headers.authorization

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return reply.code(401).send({ error: 'Missing or invalid authorization header' })
    }

    const token = authHeader.substring(7) // Remove 'Bearer ' prefix

    // Verify the JWT token with Supabase using anon client
    // The anon client can verify user tokens, service role cannot
    const { data: { user }, error } = await supabaseAnon.auth.getUser(token)

    if (error || !user) {
      request.log.error('Authentication failed:', { error: error?.message, hasUser: !!user })
      return reply.code(401).send({ error: 'Invalid or expired token' })
    }

    // Attach user to request
    request.user = {
      id: user.id,
      email: user.email || '',
    }
  } catch (error: any) {
    request.log.error('Authentication error:', error)
    return reply.code(401).send({ error: 'Authentication failed' })
  }
}

/**
 * Optional authentication - doesn't fail if no token provided
 */
export async function optionalAuth(
  request: AuthenticatedRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    const authHeader = request.headers.authorization

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      // No token provided, continue without user
      return
    }

    const token = authHeader.substring(7)
    const { data: { user }, error } = await supabaseAnon.auth.getUser(token)

    if (!error && user) {
      request.user = {
        id: user.id,
        email: user.email || '',
      }
    }
  } catch (error: any) {
    // Silently fail for optional auth
    request.log.warn('Optional auth error:', error)
  }
}

