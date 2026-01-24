
import { createClient } from '@supabase/supabase-js'
import { config } from '../src/config/env'

const supabase = createClient(config.supabase.url, config.supabase.serviceRoleKey)

async function main() {
    console.log('--- Dumping User Subscriptions Sample ---')

    const { data: subs, error } = await supabase
        .from('user_subscriptions')
        .select('*')
        .limit(10)

    if (error) {
        console.error('Error:', error)
    } else {
        console.log(`Reference: config.supabase.url = ${config.supabase.url}`)
        console.log(`Found ${subs?.length} rows.`)
        console.log(JSON.stringify(subs, null, 2))
    }
}

main()
