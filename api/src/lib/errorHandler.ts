import { FastifyReply, FastifyRequest } from 'fastify'
import * as Sentry from '@sentry/node'
import { logger } from './logger'

/**
 * Standard API Error Response
 */
export interface ApiErrorResponse {
  error: string
  details?: string
  code?: string
  timestamp: string
  path?: string
}

/**
 * Standardized error handler for API routes
 * - Logs error to console/file
 * - Reports to Sentry if configured
 * - Returns consistent error response
 * 
 * @param error - The error that occurred
 * @param reply - Fastify reply object
 * @param request - Fastify request object (for context)
 * @param message - User-friendly error message
 * @param statusCode - HTTP status code (default: 500)
 */
export async function handleApiError(
  error: any,
  reply: FastifyReply,
  request?: FastifyRequest,
  message: string = 'Internal server error',
  statusCode: number = 500
): Promise<FastifyReply> {
  // Log to Fastify logger (structured logging)
  if (request?.log) {
    request.log.error({
      err: error,
      path: request.url,
      method: request.method,
      message,
    })
  } else {
    logger.error({ err: error, message }, '[API Error]')
  }

  // Report to Sentry (only if DSN is configured)
  if (process.env.SENTRY_DSN) {
    Sentry.captureException(error, {
      level: statusCode >= 500 ? 'error' : 'warning',
      tags: {
        path: request?.url,
        method: request?.method,
        statusCode: statusCode.toString(),
      },
      extra: {
        message,
        errorMessage: error?.message,
        stack: error?.stack,
      },
    })
  }

  // Construct error response
  const errorResponse: ApiErrorResponse = {
    error: message,
    timestamp: new Date().toISOString(),
    path: request?.url,
  }

  // Include error details in development only
  if (process.env.NODE_ENV === 'development' && error?.message) {
    errorResponse.details = error.message
  }

  // Include error code if available
  if (error?.code) {
    errorResponse.code = error.code
  }

  return reply.code(statusCode).send(errorResponse)
}

/**
 * Handle validation errors (400 Bad Request)
 */
export async function handleValidationError(
  error: any,
  reply: FastifyReply,
  request?: FastifyRequest
): Promise<FastifyReply> {
  return handleApiError(error, reply, request, 'Validation failed', 400)
}

/**
 * Handle not found errors (404 Not Found)
 */
export async function handleNotFoundError(
  resource: string,
  reply: FastifyReply,
  request?: FastifyRequest
): Promise<FastifyReply> {
  const error = new Error(`${resource} not found`)
  return handleApiError(error, reply, request, `${resource} not found`, 404)
}

/**
 * Handle unauthorized errors (401 Unauthorized)
 */
export async function handleUnauthorizedError(
  reply: FastifyReply,
  request?: FastifyRequest,
  message: string = 'Unauthorized'
): Promise<FastifyReply> {
  const error = new Error(message)
  return handleApiError(error, reply, request, message, 401)
}

/**
 * Handle forbidden errors (403 Forbidden)
 */
export async function handleForbiddenError(
  reply: FastifyReply,
  request?: FastifyRequest,
  message: string = 'Forbidden'
): Promise<FastifyReply> {
  const error = new Error(message)
  return handleApiError(error, reply, request, message, 403)
}

/**
 * Wrap async route handlers with automatic error handling
 */
export function withErrorHandler<T>(
  handler: (request: FastifyRequest, reply: FastifyReply) => Promise<T>
) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      return await handler(request, reply)
    } catch (error: any) {
      return handleApiError(error, reply, request)
    }
  }
}

