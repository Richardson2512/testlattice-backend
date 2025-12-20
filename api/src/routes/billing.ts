// Billing routes (mocked - Stripe not configured)
import { FastifyInstance } from 'fastify'
import { config } from '../config/env'

export async function billingRoutes(fastify: FastifyInstance) {
  // Get usage stats
  fastify.get('/usage', async (request, reply) => {
    try {
      // Mock usage data
      const usage = {
        period: {
          start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
          end: new Date().toISOString(),
        },
        testsRun: 42,
        testsCompleted: 40,
        testsFailed: 2,
        totalMinutes: 120,
        estimatedCost: 15.50,
        currency: 'usd',
      }

      return reply.send({ usage })
    } catch (error: any) {
      fastify.log.error(error)
      return reply.code(500).send({ error: error.message || 'Failed to get usage' })
    }
  })

  // Get subscription info (mocked - replace with real Stripe integration when needed)
  fastify.get('/subscription', async (request, reply) => {
    try {
      // NOTE: Currently using mock subscription data
      // To implement real Stripe integration:
      // 1. Install @stripe/stripe-js package
      // 2. Initialize Stripe client with STRIPE_SECRET_KEY
      // 3. Use stripe.subscriptions.retrieve() to get real subscription data
      // Mock subscription data for development
      const subscription = {
        id: 'sub_mock_123',
        status: 'active',
        plan: 'pro',
        currentPeriodStart: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
        currentPeriodEnd: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000).toISOString(),
        cancelAtPeriodEnd: false,
        items: [
          {
            id: 'item_mock_123',
            price: {
              id: 'price_mock_123',
              amount: 9900,
              currency: 'usd',
              recurring: {
                interval: 'month',
              },
            },
          },
        ],
      }

      return reply.send({ subscription })
    } catch (error: any) {
      fastify.log.error(error)
      return reply.code(500).send({ error: error.message || 'Failed to get subscription' })
    }
  })

  // Create checkout session (mocked - replace with real Stripe integration when needed)
  fastify.post('/checkout', async (request, reply) => {
    try {
      const { priceId, successUrl, cancelUrl } = request.body as any

      // NOTE: Currently using mock checkout session
      // To implement real Stripe integration:
      // 1. Install @stripe/stripe-js package
      // 2. Initialize Stripe client with STRIPE_SECRET_KEY
      // 3. Use stripe.checkout.sessions.create() to create real checkout session
      // Mock checkout session for development
      const appUrl = config.appUrl || process.env.APP_URL || 'http://localhost:3000'
      const session = {
        id: 'cs_mock_' + Date.now(),
        url: `https://checkout.stripe.com/mock-session/${Date.now()}`,
        priceId: priceId || 'price_mock_123',
        successUrl: successUrl || `${appUrl}/billing/success`,
        cancelUrl: cancelUrl || `${appUrl}/billing/cancel`,
      }

      return reply.send({ session })
    } catch (error: any) {
      fastify.log.error(error)
      return reply.code(500).send({ error: error.message || 'Failed to create checkout session' })
    }
  })

  // Stripe webhook handler
  fastify.post('/webhook', async (request, reply) => {
    try {
      // SECURITY: Webhook signature verification should be implemented
      // To implement:
      // 1. Get webhook secret from STRIPE_WEBHOOK_SECRET env var
      // 2. Get signature from request.headers['stripe-signature']
      // 3. Use stripe.webhooks.constructEvent() to verify signature
      // 4. Reject request if signature is invalid
      const payload = request.body as any

      fastify.log.info('Stripe webhook received:', payload.type)

      // Handle different webhook events
      switch (payload.type) {
        case 'checkout.session.completed':
          fastify.log.info('Checkout session completed:', payload.data.object.id)
          break
        case 'customer.subscription.updated':
          fastify.log.info('Subscription updated:', payload.data.object.id)
          break
        case 'customer.subscription.deleted':
          fastify.log.info('Subscription deleted:', payload.data.object.id)
          break
        case 'invoice.payment_succeeded':
          fastify.log.info('Invoice payment succeeded:', payload.data.object.id)
          break
        case 'invoice.payment_failed':
          fastify.log.info('Invoice payment failed:', payload.data.object.id)
          break
        default:
          fastify.log.info('Unhandled webhook type:', payload.type)
      }

      return reply.send({ received: true })
    } catch (error: any) {
      fastify.log.error(error)
      return reply.code(500).send({ error: error.message || 'Webhook processing failed' })
    }
  })
}

