
import { Polar } from '@polar-sh/sdk'
import { config } from '../src/config/env'
import * as dotenv from 'dotenv'

dotenv.config()

const polar = new Polar({ accessToken: process.env.POLAR_ACCESS_TOKEN || '' })

async function main() {
    console.log('--- Checking Polar ALL Subscriptions ---')

    if (!process.env.POLAR_ACCESS_TOKEN) {
        console.error('Missing POLAR_ACCESS_TOKEN')
        return
    }

    try {
        const result = await polar.subscriptions.list({
            limit: 10,
            sorting: ['-started_at']
        })

        const subs = result.result?.items || result.items || []

        console.log(`Found ${subs.length} total subscriptions in Polar (limit 10).`)

        for (const sub of subs) {
            console.log(`Customer: ${sub.customer.email} (${sub.customer_id})`)
            console.log(`Product: ${sub.product.name} (${sub.product.id})`)
            console.log(`Status: ${sub.status}`)
            console.log('---')
        }

    } catch (err: any) {
        console.error('Polar Error:', err.message)
    }
}

main()
