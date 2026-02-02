/**
 * Diagnoser Interface
 * 
 * Each diagnoser analyzes a specific test type and reports:
 * - What CAN be tested (elements, conditions)
 * - What CANNOT be tested (blockers, limitations)
 */

import { Page } from 'playwright'

export interface CapabilityItem {
    name: string
    selector?: string
    reason: string
    elementCount?: number
}

export interface TestTypeDiagnosis {
    testType: string
    steps: string[]
    canTest: CapabilityItem[]
    cannotTest: CapabilityItem[]
    duration: number
    // Plain English narrative for UI display
    narrative?: {
        what: string    // What is being diagnosed
        how: string     // How it is being diagnosed
        why: string     // Why it is being diagnosed
        result: string  // Passed/Failed with explanation
        passed: boolean
    }
}

export interface IDiagnoser {
    readonly testType: string
    readonly steps: string[]
    diagnose(page: Page): Promise<TestTypeDiagnosis>
}
