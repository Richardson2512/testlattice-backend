/**
 * Billing routes - Polar.sh Payment Integration
 */
import { FastifyInstance } from 'fastify'
import { config } from '../config/env'
import { authenticate, AuthenticatedRequest } from '../middleware/auth'
import {
  createCheckoutSession,
  getSubscription,
  getTierFromProductId,
  isAddOnProduct,
  getAddOnVisualTests,
  getAddOnBehaviorCredits,
  POLAR_PRODUCTS,
} from '../services/polar'

// Get Supabase client
const getSupabaseClient = async () => {
  const { createClient } = await import('@supabase/supabase-js')
  return createClient(config.supabase.url, config.supabase.serviceRoleKey)
}

export async function billingRoutes(fastify: FastifyInstance) {

  // Get current user's subscription/tier info
  fastify.get('/subscription', {
    preHandler: authenticate,
  }, async (request: AuthenticatedRequest, reply) => {
    try {
      const userId = request.user?.id

      if (!userId) {
        return reply.code(401).send({ error: 'Unauthorized' })
      }

      const supabase = await getSupabaseClient()
      const { data: subscription, error } = await supabase
        .from('user_subscriptions')
        .select('*')
        .eq('user_id', userId)
        .single()

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows found
        throw error
      }

      const sub = subscription ? {
        tier: subscription.tier,
        status: subscription.status,
        testsUsed: subscription.tests_used_this_month || 0,
        visualTestsUsed: subscription.visual_tests_used_this_month || 0,
        addonVisualTests: subscription.addon_visual_tests || 0,
        currentPeriodStart: subscription.current_period_start,
        currentPeriodEnd: subscription.current_period_end,
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
        polarCustomerId: subscription.polar_customer_id,
        polarSubscriptionId: subscription.polar_subscription_id,
        usageResetDate: subscription.usage_reset_date,
      } : {
        tier: 'free',
        status: 'active',
        testsUsed: 0,
        visualTestsUsed: 0,
        addonVisualTests: 0,
      }

      return reply.send({ subscription: sub })
    } catch (error: any) {
      fastify.log.error(error)
      return reply.code(500).send({ error: error.message || 'Failed to get subscription' })
    }
  })

  // Create Polar checkout session
  fastify.post('/checkout', {
    preHandler: authenticate,
  }, async (request: AuthenticatedRequest, reply) => {
    try {
      const { productId, tier, userEmail } = request.body as {
        productId?: string
        tier?: string
        userEmail?: string
      }
      const userId = request.user?.id

      // Determine product ID from tier if not directly provided
      let targetProductId = productId
      if (!targetProductId && tier) {
        targetProductId = (POLAR_PRODUCTS as Record<string, string>)[tier]
      }

      if (!targetProductId) {
        return reply.code(400).send({ error: 'Product ID or tier is required' })
      }

      const appUrl = config.appUrl || process.env.APP_URL || 'https://Rihario-7ip77vn43-pricewises-projects.vercel.app'

      // Determine success URL based on product/tier
      const tierFromProduct = getTierFromProductId(targetProductId)
      const successUrl = `${appUrl}/dashboard?checkout=success&tier=${tierFromProduct}`

      const { checkoutUrl, checkoutId } = await createCheckoutSession({
        productId: targetProductId,
        customerEmail: userEmail || request.user?.email, // Fallback to auth email
        successUrl,
        metadata: {
          userId: userId || '',
          tier: tierFromProduct,
        },
      })

      fastify.log.info(`Checkout session created: ${checkoutId} for tier ${tierFromProduct}`)

      return reply.send({
        checkoutUrl,
        checkoutId,
      })
    } catch (error: any) {
      fastify.log.error('Checkout error:', error)
      return reply.code(500).send({ error: error.message || 'Failed to create checkout session' })
    }
  })

  // Polar webhook handler - NO AUTH required (called by Polar)
  fastify.post('/webhook', async (request, reply) => {
    try {
      const payload = request.body as any
      // const webhookSecret = process.env.POLAR_WEBHOOK_SECRET

      fastify.log.info(`Polar webhook received: ${payload.type}`)

      const supabase = await getSupabaseClient()

      switch (payload.type) {
        case 'checkout.created':
        case 'checkout.updated':
          fastify.log.info(`Checkout event: ${payload.data.id}`)
          break

        case 'subscription.created':
        case 'subscription.updated': {
          const subscription = payload.data
          const productId = subscription.product_id
          const customerId = subscription.customer_id
          const subscriptionId = subscription.id
          const tier = getTierFromProductId(productId)
          const status = subscription.status === 'active' ? 'active' :
            subscription.status === 'past_due' ? 'past_due' :
              subscription.status === 'canceled' ? 'cancelled' : 'active'

          const isAddOn = isAddOnProduct(productId)

          fastify.log.info(`Subscription ${payload.type}: ${subscriptionId}, tier: ${tier}, isAddOn: ${isAddOn}`)

          // Find user by Polar customer ID or email
          let { data: existingSub } = await supabase
            .from('user_subscriptions')
            .select('user_id')
            .eq('polar_customer_id', customerId)
            .single()

          if (existingSub) {
            // Update existing subscription
            const updatePayload: any = {
              polar_subscription_id: subscriptionId,
              polar_product_id: productId,
              status,
              current_period_start: subscription.current_period_start,
              current_period_end: subscription.current_period_end,
              cancel_at_period_end: subscription.cancel_at_period_end || false,
              updated_at: new Date().toISOString(),
            }

            if (!isAddOn) {
              updatePayload.tier = tier
            }

            if (isAddOn) {
              const visualTests = getAddOnVisualTests(productId)
              if (visualTests > 0) {
                updatePayload.addon_visual_tests = visualTests
              }

              const behaviorCredits = getAddOnBehaviorCredits(productId)
              if (behaviorCredits > 0) {
                updatePayload.behavior_credits = behaviorCredits
              }
            }

            await supabase
              .from('user_subscriptions')
              .update(updatePayload)
              .eq('polar_customer_id', customerId)
          } else {
            // Try to match by email via checkout metadata
            const metadata = subscription.metadata || {}
            const userId = metadata.userId

            if (userId) {
              const upsertPayload: any = {
                user_id: userId,
                tier: isAddOn ? 'free' : tier,
                polar_customer_id: customerId,
                polar_subscription_id: subscriptionId,
                polar_product_id: productId,
                status,
                current_period_start: subscription.current_period_start,
                current_period_end: subscription.current_period_end,
                cancel_at_period_end: subscription.cancel_at_period_end || false,
                updated_at: new Date().toISOString(),
              }

              if (isAddOn) {
                upsertPayload.addon_visual_tests = getAddOnVisualTests(productId)
                upsertPayload.behavior_credits = getAddOnBehaviorCredits(productId)
              } else {
                upsertPayload.addon_visual_tests = 0
                upsertPayload.behavior_credits = 0
              }

              await supabase
                .from('user_subscriptions')
                .upsert(upsertPayload, { onConflict: 'user_id' })
            }
          }
          break
        }

        case 'subscription.canceled': {
          const subscription = payload.data
          const customerId = subscription.customer_id
          fastify.log.info(`Subscription canceled: ${subscription.id}`)
          await supabase
            .from('user_subscriptions')
            .update({
              status: 'cancelled',
              cancel_at_period_end: true,
              updated_at: new Date().toISOString(),
            })
            .eq('polar_customer_id', customerId)
          break
        }

        case 'subscription.revoked': {
          const subscription = payload.data
          const customerId = subscription.customer_id
          fastify.log.info(`Subscription revoked: ${subscription.id}`)
          await supabase
            .from('user_subscriptions')
            .update({
              tier: 'free',
              status: 'expired',
              polar_subscription_id: null,
              updated_at: new Date().toISOString(),
            })
            .eq('polar_customer_id', customerId)
          break
        }

        default:
          fastify.log.info(`Unhandled Polar webhook: ${payload.type}`)
      }

      return reply.send({ received: true })
    } catch (error: any) {
      fastify.log.error('Webhook error:', error)
      return reply.code(500).send({ error: error.message || 'Webhook processing failed' })
    }
  })

  // Get available products/pricing
  fastify.get('/products', async (request, reply) => {
    return reply.send({
      products: {
        starter: POLAR_PRODUCTS.starter,
        indie: POLAR_PRODUCTS.indie,
        pro: POLAR_PRODUCTS.pro,
        addon50: POLAR_PRODUCTS.addon50,
        addon200: POLAR_PRODUCTS.addon200,
      },
    })
  })

  // Cancel subscription
  fastify.post('/cancel', {
    preHandler: authenticate,
  }, async (request: AuthenticatedRequest, reply) => {
    try {
      const userId = request.user?.id

      if (!userId) {
        return reply.code(401).send({ error: 'Unauthorized' })
      }

      const supabase = await getSupabaseClient()

      const { error } = await supabase
        .from('user_subscriptions')
        .update({
          cancel_at_period_end: true,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId)

      if (error) throw error

      return reply.send({ success: true, message: 'Subscription will be cancelled at period end' })
    } catch (error: any) {
      fastify.log.error(error)
      return reply.code(500).send({ error: error.message || 'Failed to cancel subscription' })
    }
  })

  // Reconcile subscription with Polar
  fastify.post('/reconcile', {
    preHandler: authenticate,
  }, async (request: AuthenticatedRequest, reply) => {
    try {
      const userId = request.user?.id

      if (!userId) {
        return reply.code(401).send({ error: 'Unauthorized' })
      }

      const supabase = await getSupabaseClient()

      const { data: subscription, error } = await supabase
        .from('user_subscriptions')
        .select('*')
        .eq('user_id', userId)
        .single()

      if (error && error.code !== 'PGRST116') throw error

      if (!subscription?.polar_customer_id) {
        return reply.send({ synced: true, tier: 'free', message: 'No Polar subscription found' })
      }

      try {
        const polarSubscription = await getSubscription(subscription.polar_subscription_id)

        if (polarSubscription && polarSubscription.status === 'active') {
          const productId = (polarSubscription as any).product?.id || (polarSubscription as any).productId
          const tier = getTierFromProductId(productId)

          if (subscription.tier !== tier) {
            await supabase
              .from('user_subscriptions')
              .update({
                tier,
                status: 'active',
                updated_at: new Date().toISOString()
              })
              .eq('user_id', userId)

            fastify.log.info(`Reconciled user ${userId}: ${subscription.tier} -> ${tier}`)
            return reply.send({ synced: true, updated: true, previousTier: subscription.tier, tier })
          }
        } else if (polarSubscription?.status === 'canceled') {
          if (subscription.tier !== 'free') {
            await supabase
              .from('user_subscriptions')
              .update({ tier: 'free', status: 'cancelled', updated_at: new Date().toISOString() })
              .eq('user_id', userId)

            return reply.send({ synced: true, updated: true, previousTier: subscription.tier, tier: 'free' })
          }
        }
      } catch (polarError: any) {
        fastify.log.warn(`Polar API error during reconciliation: ${polarError.message}`)
      }

      return reply.send({ synced: true, tier: subscription.tier })
    } catch (error: any) {
      fastify.log.error('Reconciliation error:', error)
      return reply.code(500).send({ error: 'Reconciliation failed' })
    }
  })

  // Check usage limits
  fastify.get('/usage', {
    preHandler: authenticate, // ADDED AUTHENTICATION
  }, async (request: AuthenticatedRequest, reply) => {
    try {
      const userId = request.user?.id // FIXED: Use authenticated user ID

      if (!userId) {
        return reply.code(401).send({ error: 'Unauthorized' })
      }

      const supabase = await getSupabaseClient()

      let result = { can_run: true, tests_used: 0, tests_limit: 3, tier: 'free' }

      try {
        // Try RPC first
        const { data, error } = await supabase.rpc('check_usage_limit', { p_user_id: userId })
        if (!error && data?.[0]) {
          result = data[0]
        } else {
          // Fallback
          throw new Error('RPC failed')
        }
      } catch (rpcError) {
        // Fallback: direct query
        const { data: subscription } = await supabase
          .from('user_subscriptions')
          .select('tier, tests_used_this_month')
          .eq('user_id', userId)
          .single()

        const tier = subscription?.tier || 'free'
        const testsUsed = subscription?.tests_used_this_month || 0

        const limitMap: Record<string, number> = {
          free: 3,
          starter: 100,
          indie: 300,
          pro: 750,
        }
        const testsLimit = limitMap[tier] || 3

        result = {
          can_run: testsUsed < testsLimit,
          tests_used: testsUsed,
          tests_limit: testsLimit,
          tier,
        }
      }

      return reply.send({
        canRun: result.can_run,
        testsUsed: result.tests_used,
        testsLimit: result.tests_limit,
        testsRemaining: Math.max(0, result.tests_limit - result.tests_used),
        tier: result.tier,
      })
    } catch (error: any) {
      fastify.log.error(error)
      return reply.code(500).send({ error: error.message || 'Failed to check usage' })
    }
  })

  // Increment usage
  fastify.post('/usage/increment', {
    preHandler: authenticate,
  }, async (request: AuthenticatedRequest, reply) => {
    try {
      const userId = request.user?.id
      const { type = 'test' } = request.body as { type?: 'test' | 'visual' }

      if (!userId) {
        return reply.code(401).send({ error: 'Unauthorized' })
      }

      const supabase = await getSupabaseClient()
      const rpcName = type === 'visual' ? 'increment_visual_test_usage' : 'increment_test_usage'
      const { data, error } = await supabase.rpc(rpcName, { p_user_id: userId })

      if (error) throw error

      const result = data?.[0] || { new_count: 0, tier: 'free' }

      return reply.send({
        success: true,
        newCount: result.new_count,
        tier: result.tier,
      })
    } catch (error: any) {
      fastify.log.error(error)
      return reply.code(500).send({ error: error.message || 'Failed to increment usage' })
    }
  })
}
