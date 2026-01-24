
import { createClient } from '@supabase/supabase-js'
import { config } from '../src/config/env'

const supabase = createClient(config.supabase.url, config.supabase.serviceRoleKey)

async function main() {
    console.log('--- Dumping All Subscriptions ---')

    const { data: subs, error } = await supabase
        .from('user_subscriptions')
        .select('user_id, tier, polar_customer_id, polar_product_id')

    if (error) {
        console.log('Error', error)
    } else {
        console.table(subs)
    }
}

main()
