
import { FastifyInstance } from 'fastify'
import { authenticate, AuthenticatedRequest } from '../middleware/auth'
import { Database } from '../lib/db'
import { enqueueTestRun } from '../lib/queue' // Will likely need to update this or add new function
import { config } from '../config/env'

export async function behaviorRoutes(fastify: FastifyInstance) {
    // Get Supabase client
    const getSupabaseClient = async () => {
        const { createClient } = await import('@supabase/supabase-js')
        return createClient(config.supabase.url, config.supabase.serviceRoleKey)
    }

    // Trigger Behavior Analysis
    fastify.post('/analyze', {
        preHandler: authenticate,
    }, async (request: AuthenticatedRequest, reply) => {
        try {
            const { projectId, startUrl, behaviors } = request.body as {
                projectId: string,
                startUrl: string,
                behaviors: string[] // e.g. ['bias', 'compliance']
            }
            const userId = request.user?.id

            if (!userId) return reply.code(401).send({ error: 'Unauthorized' })

            // 1. Check Limits (Indie/Pro + Usage)
            const supabase = await getSupabaseClient()
            const { data: limitCheck, error: limitError } = await supabase.rpc('check_behavior_usage_limit', {
                p_user_id: userId
            })

            if (limitError) throw limitError

            const status = limitCheck?.[0] || { can_run: false, tier: 'free' }
            if (!status.can_run) {
                return reply.code(403).send({
                    error: 'Limit Reached',
                    message: 'You have verified your behavior analysis limit or are not on a supported tier.',
                    tier: status.tier
                })
            }

            // 2. Create Database Record
            const { data: analysisRun, error: dbError } = await supabase
                .from('behavior_analysis_runs') // Need to create this table? Or use generic runs?
                .insert({
                    project_id: projectId,
                    user_id: userId,
                    status: 'pending',
                    start_url: startUrl,
                    behaviors: behaviors,
                    created_at: new Date().toISOString()
                })
                .select()
                .single()

            if (dbError) throw dbError

            // 3. Increment Usage
            await supabase.rpc('increment_behavior_test_usage', { p_user_id: userId })

            const { BuildType, DeviceProfile } = await import('../types')

            // 4. Enqueue Job
            // We will reuse the test-runner queue but with a special flag/type
            await enqueueTestRun({
                runId: analysisRun.id,
                projectId,
                build: { type: BuildType.WEB, url: startUrl },
                profile: { device: DeviceProfile.CHROME_LATEST, viewport: { width: 1280, height: 800 } },
                options: {
                    testMode: 'behavior', // Special mode
                    behaviors // Pass selected behaviors
                }
            })

            return reply.send({ success: true, runId: analysisRun.id })

        } catch (error: any) {
            fastify.log.error(error)
            return reply.code(500).send({ error: error.message || 'Failed to start analysis' })
        }
    })

    // Get Results
    fastify.get('/:id', async (request, reply) => {
        // TODO: Implement result retrieval
        return reply.send({ status: 'pending' })
    })
}
