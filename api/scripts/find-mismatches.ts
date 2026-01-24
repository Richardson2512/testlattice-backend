
import { createClient } from '@supabase/supabase-js'
import { config } from '../src/config/env'
import { POLAR_PRODUCTS } from '../src/services/polar'

const supabase = createClient(config.supabase.url, config.supabase.serviceRoleKey)

async function main() {
    console.log('--- Searching for Tier/Product Mismatches ---')

    const paidProductIds = [
        POLAR_PRODUCTS.starter,
        POLAR_PRODUCTS.indie,
        POLAR_PRODUCTS.pro,
    ]

    // Scenario 1: User has a PAID product ID, but is marked as 'free'
    const { data: mismatches, error } = await supabase
        .from('user_subscriptions')
        .select('*')
        .in('polar_product_id', paidProductIds)
        .eq('tier', 'free')

    if (error) {
        console.error('Error:', error)
    } else {
        console.log(`Found ${mismatches?.length || 0} users with PAID Product ID but FREE Tier.`)
        mismatches?.forEach(sub => {
            console.log(`User: ${sub.user_id}, Product: ${sub.polar_product_id}, Status: ${sub.status}`)
        })
    }

    // Scenario 2: Just dump the first 5 'free' users who have ANY polar_customer_id
    // This helps us see if there are any weird product IDs we missed.
    const { data: anyFree } = await supabase
        .from('user_subscriptions')
        .select('*')
        .eq('tier', 'free')
        .not('polar_customer_id', 'is', null)
        .limit(5)

    console.log('\n--- Sample of Free Users with Polar Customer IDs ---')
    anyFree?.forEach(sub => {
        console.log(`User: ${sub.user_id}`)
        console.log(`Product: ${sub.polar_product_id}`)
        console.log(`Tier: ${sub.tier}`)
        console.log(`Status: ${sub.status}`)
        console.log('---')
    })

}

main()
