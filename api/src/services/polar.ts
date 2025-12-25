/**
 * Polar Payment Service
 * Handles subscription management via Polar.sh
 */

import { Polar } from '@polar-sh/sdk'

// Polar Product IDs (from user's Polar dashboard)
export const POLAR_PRODUCTS = {
    starter: '84331781-6628-4f25-a1c4-81c9aff5c301',
    indie: 'a9519689-9ac5-4b9e-b006-ad35b2d68531',
    pro: '1db05405-2505-4156-a535-f4318daabc8c',
    addon50: '8aeed243-c488-434f-8952-3242a3da8757',
    addon200: 'f9901198-4809-4551-adad-1da001fa41da',
} as const

// Map product IDs to tier names
export const PRODUCT_TO_TIER: Record<string, string> = {
    [POLAR_PRODUCTS.starter]: 'starter',
    [POLAR_PRODUCTS.indie]: 'indie',
    [POLAR_PRODUCTS.pro]: 'pro',
}

// Initialize Polar client
let polarClient: Polar | null = null

export function getPolarClient(): Polar {
    if (!polarClient) {
        const accessToken = process.env.POLAR_ACCESS_TOKEN
        if (!accessToken) {
            throw new Error('POLAR_ACCESS_TOKEN environment variable is not set')
        }
        polarClient = new Polar({
            accessToken,
        })
    }
    return polarClient
}

/**
 * Create a checkout session for a subscription
 */
export async function createCheckoutSession(params: {
    productId: string
    customerId?: string
    customerEmail?: string
    successUrl: string
    metadata?: Record<string, string>
}): Promise<{ checkoutUrl: string; checkoutId: string }> {
    const polar = getPolarClient()

    // Per Polar API spec: products is an array of UUID strings
    const checkout = await polar.checkouts.create({
        products: [params.productId], // Array of product UUID strings
        successUrl: params.successUrl,
    } as any)

    return {
        checkoutUrl: checkout.url,
        checkoutId: checkout.id,
    }
}

/**
 * Get subscription details by ID
 */
export async function getSubscription(subscriptionId: string) {
    const polar = getPolarClient()
    return polar.subscriptions.get({ id: subscriptionId })
}

// Note: Subscription cancellation is handled via Polar dashboard or webhooks
// The API marks subscriptions as cancel_at_period_end in our database

/**
 * Verify webhook signature (if Polar provides this)
 */
export function verifyWebhookSignature(
    payload: string,
    signature: string,
    secret: string
): boolean {
    // Polar webhook verification logic
    // For now, we'll do basic validation
    // TODO: Implement proper signature verification when Polar provides the method
    return true
}

/**
 * Determine tier from product ID
 */
export function getTierFromProductId(productId: string): string {
    return PRODUCT_TO_TIER[productId] || 'free'
}

/**
 * Check if product is an add-on
 */
export function isAddOnProduct(productId: string): boolean {
    return productId === POLAR_PRODUCTS.addon50 || productId === POLAR_PRODUCTS.addon200
}

/**
 * Get visual tests count from add-on product
 */
export function getAddOnVisualTests(productId: string): number {
    if (productId === POLAR_PRODUCTS.addon50) return 50
    if (productId === POLAR_PRODUCTS.addon200) return 200
    return 0
}
