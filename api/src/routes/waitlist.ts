import { FastifyInstance } from 'fastify'
import { JSONFilePreset } from 'lowdb/node'
import path from 'path'

// Initialize DB (stored in root of api folder)
// Note: In production (serverless), this won't persist well. 
// But for a persistent VM/container it works.
const dbPath = path.join(process.cwd(), 'waitlist-db.json')
const defaultData = { waitlist: [] as { email: string, joinedAt: string, status: 'free' | 'paid' }[] }

export async function waitlistRoutes(fastify: FastifyInstance) {

    // POST /api/waitlist/join
    fastify.post('/join', async (request, reply) => {
        try {
            const db = await JSONFilePreset(dbPath, defaultData)
            const { email } = request.body as { email: string }

            if (!email) return reply.code(400).send({ error: 'Email is required' })

            await db.read()
            const normalizedEmail = email.toLowerCase()

            const existing = db.data.waitlist.find(u => u.email === normalizedEmail)

            if (existing) {
                return reply.send({ success: true, message: 'Already on the waitlist!', status: existing.status })
            }

            db.data.waitlist.push({
                email: normalizedEmail,
                joinedAt: new Date().toISOString(),
                status: 'free'
            })
            await db.write()

            fastify.log.info(`Waitlist signup: ${email}`)
            return reply.send({ success: true, message: 'Added to waitlist' })

        } catch (error: any) {
            fastify.log.error(error)
            return reply.code(500).send({ error: 'Internal server error' })
        }
    })

    // POST /api/waitlist/webhook
    // Separate webhook specifically for handling "Pay for Queue Jump" if they aren't logged in users yet
    fastify.post('/webhook', async (request, reply) => {
        try {
            const event = request.body as any
            fastify.log.info(`Waitlist Webhook: ${event.type}`)

            // Handle checkout.created or order.created
            if (event.type === 'checkout.created' || event.type === 'order.created') {
                const data = event.data
                const email = (data.customer_email || data.user?.email || data.email)?.toLowerCase()

                if (email) {
                    const db = await JSONFilePreset(dbPath, defaultData)
                    await db.read()

                    const userIndex = db.data.waitlist.findIndex(u => u.email === email)

                    if (userIndex >= 0) {
                        // Update existing
                        db.data.waitlist[userIndex].status = 'paid'
                        // Add extra metadata if needed
                        Object.assign(db.data.waitlist[userIndex], {
                            paidAt: new Date().toISOString(),
                            orderId: data.id,
                            amount: data.amount
                        })
                    } else {
                        // New paid user (maybe didn't join waitlist first)
                        db.data.waitlist.push({
                            email,
                            joinedAt: new Date().toISOString(),
                            status: 'paid',
                            // @ts-ignore
                            paidAt: new Date().toISOString(),
                            orderId: data.id,
                            amount: data.amount
                        })
                    }
                    await db.write()
                    fastify.log.info(`Marked ${email} as PAID via webhook`)
                }
            }

            return reply.send({ received: true })
        } catch (error: any) {
            fastify.log.error(error)
            return reply.code(500).send({ error: 'Webhook failed' })
        }
    })

    // GET /api/waitlist/stats (Admin only - basic protection)
    fastify.get('/stats', async (request, reply) => {
        // Allow only valid admin secret or local dev
        const secret = request.headers['x-admin-secret']
        if (process.env.NODE_ENV !== 'development' && secret !== process.env.ADMIN_SECRET) {
            return reply.code(401).send({ error: 'Unauthorized' })
        }

        const db = await JSONFilePreset(dbPath, defaultData)
        await db.read()

        const paid = db.data.waitlist.filter(u => u.status === 'paid').length
        const free = db.data.waitlist.filter(u => u.status === 'free').length

        return reply.send({
            total: db.data.waitlist.length,
            paid,
            free,
            list: db.data.waitlist // Returns full list
        })
    })
}
