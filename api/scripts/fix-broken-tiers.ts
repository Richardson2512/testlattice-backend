
import { createClient } from '@supabase/supabase-js'
import { Polar } from '@polar-sh/sdk'
import { config } from '../src/config/env'
import { POLAR_PRODUCTS, getTierFromProductId, isAddOnProduct } from '../src/services/polar'
import * as dotenv from 'dotenv'

dotenv.config()

const supabase = createClient(config.supabase.url, config.supabase.serviceRoleKey)
const polar = new Polar({ accessToken: process.env.POLAR_ACCESS_TOKEN || '' })

async function main() {
    console.log('--- Fixing Broken Tiers for Add-on Users ---')

    if (!process.env.POLAR_ACCESS_TOKEN) {
        console.error('Missing POLAR_ACCESS_TOKEN in env')
        process.exit(1)
    }

    // 1. Find users who are 'free' but have a Polar ID (corruption candidates)
    const { data: users, error } = await supabase
        .from('user_subscriptions')
        .select('*')
        .eq('tier', 'free')
        .not('polar_customer_id', 'is', null)

    if (error) {
        console.error('Database error:', error)
        process.exit(1)
    }

    console.log(`Found ${users?.length || 0} candidate users (Free Tier + Has Polar ID).`)

    for (const user of users || []) {
        console.log(`\nProcessing User: ${user.user_id} (Customer: ${user.polar_customer_id})`)

        try {
            // 2. Fetch all subscriptions for this customer from Polar
            const result = await polar.subscriptions.list({
                customerId: user.polar_customer_id,
                active: true,
            })

            const subs = result.result?.items || result.items || []
            console.log(`  Found ${subs.length} active subscriptions in Polar.`)

            let correctTier = 'free'
            let mainProductId = ''

            // 3. Look for a MAIN active subscription (not an add-on)
            for (const sub of subs) {
                const prodId = sub.product.id
                const isAddOn = isAddOnProduct(prodId)
                const tier = getTierFromProductId(prodId)

                console.log(`    - Product: ${prodId} (${sub.product.name}), Tier: ${tier}, AddOn: ${isAddOn}`)

                if (!isAddOn && tier !== 'free') {
                    correctTier = tier
                    mainProductId = prodId
                    console.log(`      => Found Main Plan: ${tier}`)
                }
            }

            // 4. Update the database if we found a better tier
            if (correctTier !== 'free') {
                console.log(`  UPDATING User ${user.user_id} to Tier: ${correctTier}`)

                // We intentionally do NOT overwrite polar_product_id if it's currently the add-on,
                // because that reflects the *latest* webhook event. 
                // BUT, the user wants the TIER to be correct.
                // Actually, if we leave polar_product_id as the add-on, that's fine as long as tier is fixed.
                // However, check_usage logic relies on 'tier' column.

                const { error: updateError } = await supabase
                    .from('user_subscriptions')
                    .update({
                        tier: correctTier,
                        updated_at: new Date().toISOString()
                    })
                    .eq('user_id', user.user_id)

                if (updateError) console.error('  Update failed:', updateError)
                else console.log('  Update SUCCESS.')

            } else {
                console.log('  No main paid subscription found. Staying as free (perhaps cancelled or only has add-ons?).')
            }

        } catch (err: any) {
            console.error('  Error processing user:', err.message)
        }
    }
}

main()
