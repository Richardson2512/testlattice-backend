import { FastifyInstance } from 'fastify'
import { AuthenticatedRequest, requireAuth } from '../middleware/auth'
import { Database } from '../lib/db'
import { z } from 'zod'

const CreateCredentialSchema = z.object({
    name: z.string().min(1),
    username: z.string().optional(),
    email: z.string().email().optional(),
    password: z.string().min(1),
    projectId: z.string().uuid().optional(),
    guestSessionId: z.string().optional(),
})

const UpdateCredentialSchema = z.object({
    name: z.string().min(1).optional(),
    username: z.string().optional(),
    email: z.string().email().optional(),
    password: z.string().min(1).optional(),
})

export async function credentialsRoutes(fastify: FastifyInstance) {
    // List Credentials
    fastify.get('/', {
        preHandler: requireAuth,
    }, async (request: AuthenticatedRequest, reply) => {
        try {
            const { data: credentials, error } = await Database.supabase
                .from('test_credentials')
                .select('*')
                .eq('user_id', request.user!.id)
                .order('created_at', { ascending: false })

            if (error) throw error

            return reply.send({ credentials })
        } catch (error: any) {
            fastify.log.error('List credentials error:', error)
            return reply.code(500).send({ error: 'Failed to list credentials' })
        }
    })

    // Create Credential
    fastify.post('/', {
        preHandler: requireAuth,
    }, async (request: AuthenticatedRequest, reply) => {
        try {
            const body = CreateCredentialSchema.parse(request.body)

            // Encrypt password (placeholder - using simple text for now as per plan, but field is named encrypted)
            // In a real scenario, we would use a symmetric encryption key from env
            const password_encrypted = body.password

            const { data: credential, error } = await Database.supabase
                .from('test_credentials')
                .insert({
                    user_id: request.user!.id,
                    project_id: body.projectId,
                    name: body.name,
                    username: body.username,
                    email: body.email,
                    password_encrypted: password_encrypted,
                    guest_session_id: body.guestSessionId,
                })
                .select()
                .single()

            if (error) throw error

            return reply.code(201).send({ credential })
        } catch (error: any) {
            if (error instanceof z.ZodError) {
                return reply.code(400).send({ error: 'Validation failed', details: error.errors })
            }
            fastify.log.error('Create credential error:', error)
            return reply.code(500).send({ error: 'Failed to create credential' })
        }
    })

    // Update Credential
    fastify.put<{ Params: { id: string } }>('/:id', {
        preHandler: requireAuth,
    }, async (request: AuthenticatedRequest, reply) => {
        try {
            const { id } = request.params
            const body = UpdateCredentialSchema.parse(request.body)

            const updates: any = { ...body }
            if (body.password) {
                updates.password_encrypted = body.password
                delete updates.password
            }

            const { data: credential, error } = await Database.supabase
                .from('test_credentials')
                .update(updates)
                .eq('id', id)
                .eq('user_id', request.user!.id) // Security check
                .select()
                .single()

            if (error) throw error

            return reply.send({ credential })
        } catch (error: any) {
            fastify.log.error('Update credential error:', error)
            return reply.code(500).send({ error: 'Failed to update credential' })
        }
    })

    // Delete Credential
    fastify.delete<{ Params: { id: string } }>('/:id', {
        preHandler: requireAuth,
    }, async (request: AuthenticatedRequest, reply) => {
        try {
            const { id } = request.params

            const { error } = await Database.supabase
                .from('test_credentials')
                .delete()
                .eq('id', id)
                .eq('user_id', request.user!.id) // Security check

            if (error) throw error

            return reply.send({ success: true })
        } catch (error: any) {
            fastify.log.error('Delete credential error:', error)
            return reply.code(500).send({ error: 'Failed to delete credential' })
        }
    })
}
