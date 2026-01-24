
import {
    validateTierLimits,
    checkUsageLimits,
    TIER_LIMITS
} from '../src/lib/tierSystem'
import { config } from '../src/config/env'

// Mock user ID (pick one from the DB dump if possible, or just a random one)
// From previous log: 'b4933c73-57a6-4cae-bf96-27fed0898574' is 'free'
const FREE_USER_ID = 'b4933c73-57a6-4cae-bf96-27fed0898574'

async function main() {
    console.log('--- Testing Tier Enforcement Logic ---')

    // 1. Test Feature Gating for FREE Tier
    console.log('\n1. Validate Tier Limits (Free/Guest Tier)')

    const paidOptions = {
        testMode: 'single',
        browserMatrix: ['firefox'], // Paid feature
        skipDiagnosis: false, // Paid feature (diagnosis enabled)
    }

    // Note: logic in tests.ts maps 'free' -> 'guest' for validation
    const validation = validateTierLimits('guest', paidOptions as any)

    console.log('Requesting Firefox + Diagnosis on Guest Tier:')
    if (validation.valid) {
        console.error('FAIL: Validation PASSED (Features should be blocked!)')
    } else {
        console.log('PASS: Validation blocked with errors:')
        validation.errors.forEach(e => console.log(`  - ${e}`))
    }

    // 2. Test Usage Limits for FREE Tier
    console.log('\n2. Check Usage Limits (Free Tier)')

    // We need to verify if checkUsageLimits actually queries the DB and finds the usage
    const usage = await checkUsageLimits(FREE_USER_ID, 'free')

    console.log(`Usage Check Result: canRun=${usage.canRun}, Used=${usage.testsUsed}, Limit=${usage.testsLimit}`)

    if (usage.testsStart === 0 && usage.canRun === true) {
        console.log('NOTE: Usage is 0. If user has run tests, increment might be broken.')
    }

}

main()
