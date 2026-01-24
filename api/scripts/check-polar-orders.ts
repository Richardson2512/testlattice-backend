
import { Polar } from '@polar-sh/sdk'
import { config } from '../src/config/env'
import * as dotenv from 'dotenv'

dotenv.config()

const polar = new Polar({ accessToken: process.env.POLAR_ACCESS_TOKEN || '' })

async function main() {
    console.log('--- Checking Polar Orders (One-time Purchases) ---')

    if (!process.env.POLAR_ACCESS_TOKEN) {
        console.error('Missing POLAR_ACCESS_TOKEN')
        return
    }

    try {
        // Note: SDK structure check
        // Some versions have 'orders', some 'checkouts'.
        // Let's try orders first.

        // @ts-ignore
        if (polar.orders) {
            // @ts-ignore
            const result = await polar.orders.list({ limit: 10, sorting: ['-created_at'] })
            const items = result.result?.items || result.items || []
            console.log(`Found ${items.length} Orders.`)

            for (const item of items) {
                console.log(`Order ID: ${item.id}`)
                console.log(`Customer: ${item.customer.email}`)
                console.log(`Product: ${item.product.name}`)
                console.log('---')
            }
        } else {
            console.log('polar.orders not found in SDK. Trying checkouts?')
        }

    } catch (err: any) {
        console.error('Polar Error:', err.message)
        console.error(err)
    }
}

main()
