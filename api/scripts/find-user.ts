
import { createClient } from '@supabase/supabase-js'
import { config } from '../src/config/env'

const supabase = createClient(config.supabase.url, config.supabase.serviceRoleKey)

async function main() {
    console.log('--- Finding User by Email ---')
    const email = 'richsamven12@gmail.com'

    // 1. Check if user_subscriptions has email (unlikely but checking)
    const { data: sub } = await supabase
        .from('user_subscriptions')
        .select('*')
        .limit(1)

    if (sub && sub.length > 0) {
        console.log('Sample subscription keys:', Object.keys(sub[0]))
    }

    // 2. Try to list tables to guess where users are
    // Note: we can't easily list tables with supabase-js unless we have access to information_schema
    // but we can try to query common names

    const tables = ['users', 'profiles', 'accounts', 'auth.users']

    for (const table of tables) {
        console.log(`Checking table: ${table}...`)
        try {
            const { data, error } = await supabase
                .from(table)
                .select('*')
                .eq('email', email)
                .limit(1)

            if (error) {
                console.log(`  Error/Not Found: ${error.message}`)
            } else if (data && data.length > 0) {
                console.log(`  FOUND in ${table}:`, data[0])
                console.log(`  User ID: ${data[0].id || data[0].user_id || data[0].uuid}`)
                return
            } else {
                console.log(`  No match in ${table}`)
            }
        } catch (e) {
            console.log(`  Exception querying ${table}`)
        }
    }

    // 3. If all else fails, use the auth admin API (since we have service role key!)
    console.log('Checking Auth Admin API...')
    const { data: { users }, error: authError } = await supabase.auth.admin.listUsers()

    if (authError) {
        console.error('Auth Admin Error:', authError)
    } else {
        const match = users.find(u => u.email === email)
        if (match) {
            console.log('FOUND in Auth Admin:', match)
            console.log(`User ID: ${match.id}`)
        } else {
            console.log('User not found in Auth lists (fetched first 50).')
        }
    }
}

main()
