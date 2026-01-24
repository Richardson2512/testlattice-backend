
import { createClient } from '@supabase/supabase-js'
import { config } from '../src/config/env'
import { POLAR_PRODUCTS } from '../src/services/polar'

const supabase = createClient(config.supabase.url, config.supabase.serviceRoleKey)

async function main() {
    console.log('--- Broad Search for Suspicious Free Users ---')

    // Find users who are 'free' but have a polar_customer_id (meaning they are linked to Polar)
    const { data: subs, error } = await supabase
        .from('user_subscriptions')
        .select('*')
        .eq('tier', 'free')
        .not('polar_customer_id', 'is', null)

    if (error) {
        console.error('Error fetching subscriptions:', error)
        process.exit(1)
    }

    console.log(`Found ${subs?.length || 0} *free* users with Polar IDs. Listing details...`)

    for (const sub of subs || []) {
        console.log(`User: ${sub.user_id}`)
        console.log(`  - Product ID: ${sub.polar_product_id}`)
        console.log(`  - Sub ID: ${sub.polar_subscription_id}`)
        console.log(`  - Status: ${sub.status}`)
        console.log(`  - Addon Visual: ${sub.addon_visual_tests}`)
        console.log(`  - Behavior Credits: ${sub.behavior_credits}`)
        console.log('--------------------------------------------------')
    }
}

main()
