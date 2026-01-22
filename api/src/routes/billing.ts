/**
 * Billing routes - Polar.sh Payment Integration
 */
import { FastifyInstance } from 'fastify'
import { config } from '../config/env'
import {
  createCheckoutSession,
  getSubscription,
  getTierFromProductId,
  isAddOnProduct,
  getAddOnVisualTests,
  POLAR_PRODUCTS,
} from '../services/polar'

// Get Supabase client
const getSupabaseClient = async () => {
  const { createClient } = await import('@supabase/supabase-js')
  return createClient(config.supabase.url, config.supabase.serviceRoleKey)
}

export async function billingRoutes(fastify: FastifyInstance) {

  // Get current user's subscription/tier info
  fastify.get('/subscription', async (request, reply) => {
    try {
      const userId = (request as any).userId // Set by auth middleware

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

      // Transform to camelCase for frontend
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
  fastify.post('/checkout', async (request, reply) => {
    try {
      const { productId, tier, userId, userEmail } = request.body as {
        productId?: string
        tier?: string
        userId?: string
        userEmail?: string
      }

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
        customerEmail: userEmail,
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

  // Polar webhook handler
  fastify.post('/webhook', async (request, reply) => {
    try {
      const payload = request.body as any
      const webhookSecret = process.env.POLAR_WEBHOOK_SECRET

      // TODO: Verify webhook signature when Polar provides the method
      // For now, log all events

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

          fastify.log.info(`Subscription ${payload.type}: ${subscriptionId}, tier: ${tier}`)

          // Find user by Polar customer ID or email
          // First, try to find by polar_customer_id
          let { data: existingSub } = await supabase
            .from('user_subscriptions')
            .select('user_id')
            .eq('polar_customer_id', customerId)
            .single()

          if (existingSub) {
            // Update existing subscription
            await supabase
              .from('user_subscriptions')
              .update({
                tier: isAddOnProduct(productId) ? undefined : tier, // Don't change tier for add-ons
                polar_subscription_id: subscriptionId,
                polar_product_id: productId,
                status,
                current_period_start: subscription.current_period_start,
                current_period_end: subscription.current_period_end,
                cancel_at_period_end: subscription.cancel_at_period_end || false,
                addon_visual_tests: isAddOnProduct(productId)
                  ? getAddOnVisualTests(productId)
                  : undefined,
                updated_at: new Date().toISOString(),
              })
              .eq('polar_customer_id', customerId)
          } else {
            // Try to match by email via checkout metadata
            const metadata = subscription.metadata || {}
            const userId = metadata.userId

            if (userId) {
              await supabase
                .from('user_subscriptions')
                .upsert({
                  user_id: userId,
                  tier: isAddOnProduct(productId) ? 'free' : tier,
                  polar_customer_id: customerId,
                  polar_subscription_id: subscriptionId,
                  polar_product_id: productId,
                  status,
                  current_period_start: subscription.current_period_start,
                  current_period_end: subscription.current_period_end,
                  cancel_at_period_end: subscription.cancel_at_period_end || false,
                  addon_visual_tests: isAddOnProduct(productId) ? getAddOnVisualTests(productId) : 0,
                  updated_at: new Date().toISOString(),
                }, { onConflict: 'user_id' })
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

          // Downgrade to free tier
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
  fastify.post('/cancel', async (request, reply) => {
    try {
      const userId = (request as any).userId

      if (!userId) {
        return reply.code(401).send({ error: 'Unauthorized' })
      }

      const supabase = await getSupabaseClient()

      // Mark as canceling at period end (don't immediately revoke)
      const { error } = await supabase
        .from('user_subscriptions')
        .update({
          cancel_at_period_end: true,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId)

      if (error) throw error

      // Note: Actual cancellation should be done via Polar API
      // The webhook will handle the final status update

      return reply.send({ success: true, message: 'Subscription will be cancelled at period end' })
    } catch (error: any) {
      fastify.log.error(error)
      return reply.code(500).send({ error: error.message || 'Failed to cancel subscription' })
    }
  })

  // Reconcile subscription with Polar (self-healing for webhook failures)
  fastify.post('/reconcile', async (request, reply) => {
    try {
      const userId = (request as any).userId

      if (!userId) {
        return reply.code(401).send({ error: 'Unauthorized' })
      }

      const supabase = await getSupabaseClient()

      // Get current DB subscription
      const { data: subscription, error } = await supabase
        .from('user_subscriptions')
        .select('*')
        .eq('user_id', userId)
        .single()

      if (error && error.code !== 'PGRST116') throw error

      // If no Polar customer ID, they haven't paid - nothing to reconcile
      if (!subscription?.polar_customer_id) {
        return reply.send({ synced: true, tier: 'free', message: 'No Polar subscription found' })
      }

      // Fetch active subscriptions from Polar
      try {
        const polarSubscription = await getSubscription(subscription.polar_subscription_id)

        if (polarSubscription && polarSubscription.status === 'active') {
          // Get tier from product
          const productId = (polarSubscription as any).product?.id || (polarSubscription as any).productId
          const tier = getTierFromProductId(productId)

          // Update if different
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
          // Subscription was canceled - revert to free
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
        // Don't fail - just return current status
      }

      return reply.send({ synced: true, tier: subscription.tier })
    } catch (error: any) {
      fastify.log.error('Reconciliation error:', error)
      return reply.code(500).send({ error: 'Reconciliation failed' })
    }
  })

  // Check usage limits (called before starting a test)
  fastify.get('/usage', async (request, reply) => {
    try {
      const userId = (request as any).userId

      if (!userId) {
        return reply.code(401).send({ error: 'Unauthorized' })
      }

      const supabase = await getSupabaseClient()

      // Try the RPC function first, fallback to direct query if not deployed yet
      let result = { can_run: true, tests_used: 0, tests_limit: 3, tier: 'free' }

      try {
        const { data, error } = await supabase.rpc('check_usage_limit', { p_user_id: userId })
        if (!error && data?.[0]) {
          result = data[0]
        } else {
          // Fallback: direct query
          const { data: subscription } = await supabase
            .from('user_subscriptions')
            .select('tier, tests_used_this_month')
            .eq('user_id', userId)
            .single()

          const tier = subscription?.tier || 'free'
          const testsUsed = subscription?.tests_used_this_month || 0

          // Set limits based on tier
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
      } catch (rpcError) {
        fastify.log.warn('RPC check_usage_limit not available, using fallback')
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

  // Increment usage (called when a test starts)
  fastify.post('/usage/increment', async (request, reply) => {
    try {
      const userId = (request as any).userId
      const { type = 'test' } = request.body as { type?: 'test' | 'visual' }

      if (!userId) {
        return reply.code(401).send({ error: 'Unauthorized' })
      }

      const supabase = await getSupabaseClient()

      // Use atomic increment
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
