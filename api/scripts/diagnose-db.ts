
import { createClient } from '@supabase/supabase-js'
import { config } from '../src/config/env'

const supabase = createClient(config.supabase.url, config.supabase.serviceRoleKey)

async function main() {
    console.log('--- Database Diagnostic ---')
    console.log(`URL: ${config.supabase.url}`)

    // 1. Total Users
    const { count: total } = await supabase.from('user_subscriptions').select('*', { count: 'exact', head: true })
    console.log(`Total Rows: ${total}`)

    // 2. Users with Polar ID
    const { count: withPolar } = await supabase.from('user_subscriptions').select('*', { count: 'exact', head: true }).not('polar_customer_id', 'is', null)
    console.log(`With Polar ID: ${withPolar}`)

    // 3. Tiers breakdown
    const { data: tiers } = await supabase.from('user_subscriptions').select('tier')

    const counts: Record<string, number> = {}
    tiers?.forEach(t => {
        counts[t.tier] = (counts[t.tier] || 0) + 1
    })

    console.log('Tier Breakdown:', counts)

    // 4. Sample of "With Polar ID"
    if ((withPolar || 0) > 0) {
        const { data: sample } = await supabase.from('user_subscriptions').select('*').not('polar_customer_id', 'is', null).limit(5)
        console.log('\nSample Users with Polar ID:')
        sample?.forEach(s => console.log(`  ${s.user_id}: Tier=${s.tier}, Product=${s.polar_product_id}`))
    }
}

main()
