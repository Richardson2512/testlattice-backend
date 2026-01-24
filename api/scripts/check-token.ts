
import * as dotenv from 'dotenv'
dotenv.config()

const token = process.env.POLAR_ACCESS_TOKEN || ''
console.log(`Token Prefix: ${token.substring(0, 15)}...`)
if (token.startsWith('polar_sand')) {
    console.log('Environment: SANDBOX')
} else if (token.startsWith('polar_live')) {
    console.log('Environment: LIVE')
} else {
    console.log('Environment: UNKNOWN FORMAT')
}
