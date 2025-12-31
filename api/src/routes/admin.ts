/**
 * Admin Routes - God's Eye Dashboard
 * Provides comprehensive analytics for admin users
 */
import { FastifyInstance } from 'fastify'
import { supabase } from '../lib/supabase'
import { authenticate } from '../middleware/auth'
import { getAggregatedStats, getModelPricing, saveTokenUsage, TokenUsageRecord } from '../services/tokenUsageService'

// Admin authentication middleware
async function requireAdmin(request: any, reply: any) {
    const userId = request.userId

    if (!userId) {
        return reply.code(401).send({ error: 'Unauthorized' })
    }

    // Check if user has admin role
    const { data: user, error } = await supabase
        .from('auth.users')
        .select('raw_app_meta_data')
        .eq('id', userId)
        .single()

    // Alternative: Direct query to auth.users
    const { data: authUser } = await supabase.auth.admin.getUserById(userId)

    const isAdmin = authUser?.user?.app_metadata?.role === 'admin' ||
        authUser?.user?.user_metadata?.role === 'admin'

    if (!isAdmin) {
        return reply.code(403).send({ error: 'Admin access required' })
    }
}

export async function adminRoutes(fastify: FastifyInstance) {

    // Get overall platform stats
    fastify.get('/stats', {
        preHandler: [authenticate, requireAdmin],
    }, async (request, reply) => {
        try {
            // Get user counts
            const { data: users, error: usersError } = await supabase
                .from('user_subscriptions')
                .select('tier, status')

            if (usersError) throw usersError

            const totalUsers = users?.length || 0
            const paidUsers = users?.filter(u => u.tier !== 'free').length || 0
            const activeUsers = users?.filter(u => u.status === 'active').length || 0

            // Get tier breakdown
            const tierBreakdown = {
                free: users?.filter(u => u.tier === 'free').length || 0,
                starter: users?.filter(u => u.tier === 'starter').length || 0,
                indie: users?.filter(u => u.tier === 'indie').length || 0,
                pro: users?.filter(u => u.tier === 'pro').length || 0,
            }

            // Get test run stats
            const { data: testRuns, error: testsError } = await supabase
                .from('test_runs')
                .select('id, status, steps')

            if (testsError) throw testsError

            const totalTests = testRuns?.length || 0
            const completedTests = testRuns?.filter(t => t.status === 'completed').length || 0
            const failedTests = testRuns?.filter(t => t.status === 'failed').length || 0
            const runningTests = testRuns?.filter(t => t.status === 'running' || t.status === 'queued').length || 0

            // Calculate total passed/failed steps
            let totalPassedSteps = 0
            let totalFailedSteps = 0
            testRuns?.forEach(run => {
                if (run.steps && Array.isArray(run.steps)) {
                    run.steps.forEach((step: any) => {
                        if (step.success) {
                            totalPassedSteps++
                        } else {
                            totalFailedSteps++
                        }
                    })
                }
            })

            // Get project count
            const { count: projectCount } = await supabase
                .from('projects')
                .select('*', { count: 'exact', head: true })

            // Get fix prompts count
            const { count: promptCount } = await supabase
                .from('fix_prompts')
                .select('*', { count: 'exact', head: true })

            return reply.send({
                users: {
                    total: totalUsers,
                    paid: paidUsers,
                    active: activeUsers,
                    tierBreakdown,
                },
                tests: {
                    total: totalTests,
                    completed: completedTests,
                    failed: failedTests,
                    running: runningTests,
                },
                steps: {
                    passed: totalPassedSteps,
                    failed: totalFailedSteps,
                    total: totalPassedSteps + totalFailedSteps,
                    passRate: totalPassedSteps + totalFailedSteps > 0
                        ? Math.round((totalPassedSteps / (totalPassedSteps + totalFailedSteps)) * 100)
                        : 0,
                },
                projects: projectCount || 0,
                fixPrompts: promptCount || 0,
            })
        } catch (error: any) {
            fastify.log.error(error)
            return reply.code(500).send({ error: error.message || 'Failed to get admin stats' })
        }
    })

    // Get all users with their analytics
    fastify.get('/users', {
        preHandler: [authenticate, requireAdmin],
    }, async (request, reply) => {
        try {
            const { page = '1', limit = '50', search = '' } = request.query as any

            // Get all users from auth
            const { data: authData, error: authError } = await supabase.auth.admin.listUsers({
                page: parseInt(page),
                perPage: parseInt(limit),
            })

            if (authError) throw authError

            const users = authData?.users || []

            // Get subscriptions
            const { data: subscriptions } = await supabase
                .from('user_subscriptions')
                .select('*')

            // Get projects per user
            const { data: projects } = await supabase
                .from('projects')
                .select('id, user_id')

            // Get test runs per user
            const { data: testRuns } = await supabase
                .from('test_runs')
                .select('id, user_id, status, steps')

            // Get fix prompts per user
            const { data: fixPrompts } = await supabase
                .from('fix_prompts')
                .select('id, user_id')

            // Combine data
            const usersWithAnalytics = users
                .filter(u => !search || u.email?.toLowerCase().includes(search.toLowerCase()))
                .map(user => {
                    const subscription = subscriptions?.find(s => s.user_id === user.id)
                    const userProjects = projects?.filter(p => p.user_id === user.id) || []
                    const userTestRuns = testRuns?.filter(t => t.user_id === user.id) || []
                    const userPrompts = fixPrompts?.filter(p => p.user_id === user.id) || []

                    // Calculate passed/failed steps for this user
                    let passedSteps = 0
                    let failedSteps = 0
                    userTestRuns.forEach(run => {
                        if (run.steps && Array.isArray(run.steps)) {
                            run.steps.forEach((step: any) => {
                                if (step.success) passedSteps++
                                else failedSteps++
                            })
                        }
                    })

                    return {
                        id: user.id,
                        email: user.email,
                        createdAt: user.created_at,
                        lastSignIn: user.last_sign_in_at,
                        isAdmin: user.app_metadata?.role === 'admin',
                        subscription: {
                            tier: subscription?.tier || 'free',
                            status: subscription?.status || 'active',
                            testsUsed: subscription?.tests_used_this_month || 0,
                        },
                        analytics: {
                            projects: userProjects.length,
                            testRuns: userTestRuns.length,
                            completedTests: userTestRuns.filter(t => t.status === 'completed').length,
                            failedTests: userTestRuns.filter(t => t.status === 'failed').length,
                            passedSteps,
                            failedSteps,
                            fixPrompts: userPrompts.length,
                        },
                    }
                })

            return reply.send({
                users: usersWithAnalytics,
                total: authData?.users?.length || 0,
                page: parseInt(page),
                limit: parseInt(limit),
            })
        } catch (error: any) {
            fastify.log.error(error)
            return reply.code(500).send({ error: error.message || 'Failed to get users' })
        }
    })

    // Get detailed analytics for a specific user
    fastify.get('/users/:userId', {
        preHandler: [authenticate, requireAdmin],
    }, async (request, reply) => {
        try {
            const { userId } = request.params as { userId: string }

            // Get user from auth
            const { data: authData, error: authError } = await supabase.auth.admin.getUserById(userId)
            if (authError || !authData?.user) {
                return reply.code(404).send({ error: 'User not found' })
            }

            const user = authData.user

            // Get subscription
            const { data: subscription } = await supabase
                .from('user_subscriptions')
                .select('*')
                .eq('user_id', userId)
                .single()

            // Get projects
            const { data: projects } = await supabase
                .from('projects')
                .select('*')
                .eq('user_id', userId)
                .order('created_at', { ascending: false })

            // Get test runs
            const { data: testRuns } = await supabase
                .from('test_runs')
                .select('*')
                .eq('user_id', userId)
                .order('created_at', { ascending: false })
                .limit(50)

            // Get fix prompts
            const { data: fixPrompts } = await supabase
                .from('fix_prompts')
                .select('*')
                .eq('user_id', userId)
                .order('created_at', { ascending: false })

            // Calculate step stats
            let passedSteps = 0
            let failedSteps = 0
            testRuns?.forEach(run => {
                if (run.steps && Array.isArray(run.steps)) {
                    run.steps.forEach((step: any) => {
                        if (step.success) passedSteps++
                        else failedSteps++
                    })
                }
            })

            return reply.send({
                user: {
                    id: user.id,
                    email: user.email,
                    createdAt: user.created_at,
                    lastSignIn: user.last_sign_in_at,
                    isAdmin: user.app_metadata?.role === 'admin',
                    emailConfirmed: user.email_confirmed_at != null,
                },
                subscription: subscription || { tier: 'free', status: 'active' },
                projects: projects || [],
                testRuns: testRuns || [],
                fixPrompts: fixPrompts || [],
                stats: {
                    totalProjects: projects?.length || 0,
                    totalTests: testRuns?.length || 0,
                    completedTests: testRuns?.filter(t => t.status === 'completed').length || 0,
                    failedTests: testRuns?.filter(t => t.status === 'failed').length || 0,
                    passedSteps,
                    failedSteps,
                    totalPrompts: fixPrompts?.length || 0,
                },
            })
        } catch (error: any) {
            fastify.log.error(error)
            return reply.code(500).send({ error: error.message || 'Failed to get user details' })
        }
    })

    // =========================================================================
    // TOKEN USAGE STATISTICS
    // =========================================================================

    // Get aggregated token usage statistics
    fastify.get('/token-usage', {
        preHandler: [authenticate, requireAdmin],
    }, async (request, reply) => {
        try {
            const { days = '30' } = request.query as { days?: string }
            const daysBack = parseInt(days) || 30

            const stats = await getAggregatedStats(daysBack)
            const pricing = getModelPricing()

            return reply.send({
                ...stats,
                pricing,
                period: {
                    days: daysBack,
                    startDate: new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000).toISOString(),
                    endDate: new Date().toISOString(),
                },
            })
        } catch (error: any) {
            fastify.log.error(error)
            return reply.code(500).send({ error: error.message || 'Failed to get token usage stats' })
        }
    })

    // Save token usage (called by worker at end of test run)
    // Note: This endpoint uses service-level auth, not user auth
    fastify.post('/token-usage/save', {
        preHandler: [authenticate],
    }, async (request, reply) => {
        try {
            const body = request.body as TokenUsageRecord

            if (!body.testRunId || !body.model) {
                return reply.code(400).send({ error: 'testRunId and model are required' })
            }

            await saveTokenUsage({
                testRunId: body.testRunId,
                testMode: body.testMode || 'unknown',
                model: body.model,
                promptTokens: body.promptTokens || 0,
                completionTokens: body.completionTokens || 0,
                totalTokens: body.totalTokens || 0,
                apiCalls: body.apiCalls || 0,
            })

            return reply.send({ success: true })
        } catch (error: any) {
            fastify.log.error(error)
            return reply.code(500).send({ error: error.message || 'Failed to save token usage' })
        }
    })
}

