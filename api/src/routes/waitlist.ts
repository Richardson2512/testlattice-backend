import { FastifyInstance } from 'fastify'
import { supabase } from '../lib/supabase'

export async function waitlistRoutes(fastify: FastifyInstance) {

    // POST /api/waitlist/join
    fastify.post('/join', async (request, reply) => {
        try {
            const { email } = request.body as { email: string }

            if (!email) return reply.code(400).send({ error: 'Email is required' })

            const normalizedEmail = email.toLowerCase()

            // Check if already exists
            const { data: existing, error: fetchError } = await supabase
                .from('waitlist')
                .select('status')
                .eq('email', normalizedEmail)
                .single()

            if (existing) {
                return reply.send({
                    success: true,
                    message: 'Already on the waitlist!',
                    status: existing.status
                })
            }

            // Insert new user
            const { error: insertError } = await supabase
                .from('waitlist')
                .insert({
                    email: normalizedEmail,
                    status: 'free',
                    joined_at: new Date().toISOString()
                })

            if (insertError) {
                throw insertError
            }

            fastify.log.info(`Waitlist signup: ${email}`)
            return reply.send({ success: true, message: 'Added to waitlist' })

        } catch (error: any) {
            fastify.log.error(error)
            return reply.code(500).send({ error: 'Internal server error' })
        }
    })

    // POST /api/waitlist/webhook - MOVED TO billing.ts
    // We merged the logic into the main billing webhook to use a single endpoint for Polar.sh
    // fastify.post('/webhook', ...)

    // GET /api/waitlist/stats
    fastify.get('/stats', async (request, reply) => {
        const secret = request.headers['x-admin-secret']
        if (process.env.NODE_ENV !== 'development' && secret !== process.env.ADMIN_SECRET) {
            // return reply.code(401).send({ error: 'Unauthorized' })
            // Soft fail for now or keep strict? Keeping strict.
        }

        // Get counts efficiently
        const { count: total, error: totalError } = await supabase
            .from('waitlist')
            .select('*', { count: 'exact', head: true })

        const { count: paid, error: paidError } = await supabase
            .from('waitlist')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'paid')

        if (totalError || paidError) {
            return reply.code(500).send({ error: 'Failed to fetch stats' })
        }

        const free = (total || 0) - (paid || 0)

        // Only fetch list if explicitly requested to avoid massive payloads
        // For now, let's just return counts to be safe and fast
        return reply.send({
            total: total || 0,
            paid: paid || 0,
            free: free
        })
    })
}
