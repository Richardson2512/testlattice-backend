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

      // Return default free tier if no subscription found
      const sub = subscription || {
        tier: 'free',
        status: 'active',
        tests_used_this_month: 0,
        visual_tests_used_this_month: 0,
        addon_visual_tests: 0,
      }

      return reply.send({ subscription: sub })
    } catch (error: any) {
      fastify.log.error(error)
      return reply.code(500).send({ error: error.message || 'Failed to get subscription' })
    }
  })

  // Get usage stats for current user
  fastify.get('/usage', async (request, reply) => {
    try {
      const userId = (request as any).userId

      if (!userId) {
        return reply.code(401).send({ error: 'Unauthorized' })
      }

      const supabase = await getSupabaseClient()
      const { data: subscription } = await supabase
        .from('user_subscriptions')
        .select('*')
        .eq('user_id', userId)
        .single()

      const usage = {
        period: {
          start: subscription?.current_period_start || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
          end: subscription?.current_period_end || new Date().toISOString(),
        },
        testsRun: subscription?.tests_used_this_month || 0,
        visualTestsRun: subscription?.visual_tests_used_this_month || 0,
        addonVisualTests: subscription?.addon_visual_tests || 0,
        tier: subscription?.tier || 'free',
      }

      return reply.send({ usage })
    } catch (error: any) {
      fastify.log.error(error)
      return reply.code(500).send({ error: error.message || 'Failed to get usage' })
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

      const appUrl = config.appUrl || process.env.APP_URL || 'http://localhost:3000'

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
}
