
import { createClient } from '@supabase/supabase-js'
import { config } from '../src/config/env'
import { POLAR_PRODUCTS } from '../src/services/polar'

const supabase = createClient(config.supabase.url, config.supabase.serviceRoleKey)

async function main() {
    const userId = '534b3d80-5817-4a91-b880-ef9f3f39c6c7' // richsamven12@gmail.com
    console.log(`--- Updating Tier for User ${userId} ---`)

    // Upsert the subscription to ensure it exists and is set to PRO
    const { data, error } = await supabase
        .from('user_subscriptions')
        .upsert({
            user_id: userId,
            tier: 'pro',
            status: 'active',
            polar_customer_id: 'manual_fix_richsamven', // Placeholder to prevent 'missing ID' checks
            polar_subscription_id: 'manual_sub_comped',
            polar_product_id: POLAR_PRODUCTS.pro,
            updated_at: new Date().toISOString()
        }, { onConflict: 'user_id' })
        .select()

    if (error) {
        console.error('Update Failed:', error)
    } else {
        console.log('Update SUCCESS!')
        console.log('New Record:', data[0])
    }
}

main()
