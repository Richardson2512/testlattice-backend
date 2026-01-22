// Credentials routes - manage test account credentials
import { FastifyInstance } from 'fastify'
import { authenticate, AuthenticatedRequest } from '../middleware/auth'
import { supabase } from '../lib/supabase'
import * as crypto from 'crypto'

// Simple encryption for storing passwords (in production, use proper secret management)
const ENCRYPTION_KEY = process.env.CREDENTIALS_ENCRYPTION_KEY || 'default-key-change-in-production'

function encrypt(text: string): string {
    const key = crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32)
    const iv = crypto.randomBytes(16)
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv)
    let encrypted = cipher.update(text, 'utf8', 'hex')
    encrypted += cipher.final('hex')
    return iv.toString('hex') + ':' + encrypted
}

function decrypt(encryptedText: string): string {
    try {
        const [ivHex, encrypted] = encryptedText.split(':')
        if (!ivHex || !encrypted) return '••••••••'
        const key = crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32)
        const iv = Buffer.from(ivHex, 'hex')
        const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv)
        let decrypted = decipher.update(encrypted, 'hex', 'utf8')
        decrypted += decipher.final('utf8')
        return decrypted
    } catch {
        return '••••••••'
    }
}

export async function credentialRoutes(fastify: FastifyInstance) {
    // List all credentials for authenticated user
    fastify.get('/', {
        preHandler: authenticate,
    }, async (request: AuthenticatedRequest, reply) => {
        try {
            const userId = request.user?.id
            if (!userId) {
                return reply.code(401).send({ error: 'Unauthorized' })
            }

            const { data: credentials, error } = await supabase
                .from('credentials')
                .select('id, name, username, email, password_encrypted, created_at')
                .eq('user_id', userId)
                .order('created_at', { ascending: false })

            if (error) {
                // If table doesn't exist, return empty array
                if (error.code === '42P01') {
                    return reply.send({ credentials: [] })
                }
                throw error
            }

            return reply.send({ credentials: credentials || [] })
        } catch (error: any) {
            fastify.log.error('Failed to fetch credentials:', error)
            return reply.code(500).send({ error: error.message || 'Failed to fetch credentials' })
        }
    })

    // Create a new credential
    fastify.post('/', {
        preHandler: authenticate,
    }, async (request: AuthenticatedRequest, reply) => {
        try {
            const userId = request.user?.id
            if (!userId) {
                return reply.code(401).send({ error: 'Unauthorized' })
            }

            const { name, username, email, password } = request.body as {
                name: string
                username?: string
                email?: string
                password: string
            }

            if (!name || !password) {
                return reply.code(400).send({ error: 'Name and password are required' })
            }

            const encryptedPassword = encrypt(password)

            const { data: credential, error } = await supabase
                .from('credentials')
                .insert({
                    user_id: userId,
                    name,
                    username: username || null,
                    email: email || null,
                    password_encrypted: encryptedPassword,
                })
                .select()
                .single()

            if (error) throw error

            return reply.code(201).send({ credential })
        } catch (error: any) {
            fastify.log.error('Failed to create credential:', error)
            return reply.code(500).send({ error: error.message || 'Failed to create credential' })
        }
    })

    // Delete a credential
    fastify.delete('/:id', {
        preHandler: authenticate,
    }, async (request: AuthenticatedRequest, reply) => {
        try {
            const userId = request.user?.id
            if (!userId) {
                return reply.code(401).send({ error: 'Unauthorized' })
            }

            const { id } = request.params as { id: string }

            const { error } = await supabase
                .from('credentials')
                .delete()
                .eq('id', id)
                .eq('user_id', userId) // Ensure user owns this credential

            if (error) throw error

            return reply.send({ success: true })
        } catch (error: any) {
            fastify.log.error('Failed to delete credential:', error)
            return reply.code(500).send({ error: error.message || 'Failed to delete credential' })
        }
    })
}
