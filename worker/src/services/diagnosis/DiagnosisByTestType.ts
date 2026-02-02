/**
 * Diagnosis By Test Type Orchestrator
 * 
 * Runs diagnosis for selected frontend test types.
 * Steps add up when multiple types are selected.
 */

import { Page } from 'playwright'
import { FrontendTestType, TEST_TYPE_MAPPINGS } from '../testabilityAnalyzer/types'
import { TestTypeDiagnosis, IDiagnoser } from './diagnosers/IDiagnoser'

// Import diagnosers
import { VisualDiagnoser } from './diagnosers/VisualDiagnoser'
import { LoginDiagnoser } from './diagnosers/LoginDiagnoser'
import { SignupDiagnoser } from './diagnosers/SignupDiagnoser'
import { FormDiagnoser } from './diagnosers/FormDiagnoser'
import { NavigationDiagnoser } from './diagnosers/NavigationDiagnoser'
import { AccessibilityDiagnoser } from './diagnosers/AccessibilityDiagnoser'
import { RageBaitDiagnoser } from './diagnosers/RageBaitDiagnoser'

export interface AggregatedDiagnosis {
    totalSteps: number
    totalDuration: number
    perType: TestTypeDiagnosis[]
    combined: {
        allCanTest: TestTypeDiagnosis['canTest']
        allCannotTest: TestTypeDiagnosis['cannotTest']
    }
}

export class DiagnosisByTestType {
    private static diagnosers = new Map<FrontendTestType, IDiagnoser>([
        ['visual', new VisualDiagnoser()],
        ['login', new LoginDiagnoser()],
        ['signup', new SignupDiagnoser()],
        ['form', new FormDiagnoser()],
        ['navigation', new NavigationDiagnoser()],
        ['accessibility', new AccessibilityDiagnoser()],
        ['rage_bait', new RageBaitDiagnoser()],
    ])

    /**
     * Run diagnosis for selected test types
     * Steps add up when multiple types selected
     */
    static async run(
        page: Page,
        selectedTypes: FrontendTestType[]
    ): Promise<AggregatedDiagnosis> {
        const results: TestTypeDiagnosis[] = []

        // Run each selected type's diagnoser
        for (const testType of selectedTypes) {
            const diagnoser = this.diagnosers.get(testType)
            if (diagnoser) {
                try {
                    const result = await diagnoser.diagnose(page)
                    results.push(result)
                } catch (error: any) {
                    console.error(`[DiagnosisByTestType] ${testType} diagnoser failed:`, error.message)
                    // Add empty result with error
                    results.push({
                        testType,
                        steps: diagnoser.steps,
                        canTest: [],
                        cannotTest: [{
                            name: 'Diagnosis Error',
                            reason: error.message
                        }],
                        duration: 0
                    })
                }
            }
        }

        // Aggregate results
        return this.aggregate(results)
    }

    /**
     * Aggregate diagnosis results from multiple types
     */
    private static aggregate(results: TestTypeDiagnosis[]): AggregatedDiagnosis {
        return {
            totalSteps: results.reduce((sum, r) => sum + r.steps.length, 0),
            totalDuration: results.reduce((sum, r) => sum + r.duration, 0),
            perType: results,
            combined: {
                allCanTest: results.flatMap(r => r.canTest),
                allCannotTest: results.flatMap(r => r.cannotTest)
            }
        }
    }

    /**
     * Get all steps that will run for selected types
     */
    static getStepsForTypes(selectedTypes: FrontendTestType[]): string[] {
        const allSteps: string[] = []
        for (const testType of selectedTypes) {
            const diagnoser = this.diagnosers.get(testType)
            if (diagnoser) {
                allSteps.push(...diagnoser.steps.map(s => `[${testType}] ${s}`))
            }
        }
        return allSteps
    }

    /**
     * Get total step count for selected types
     */
    static getStepCount(selectedTypes: FrontendTestType[]): number {
        return selectedTypes.reduce((sum, type) => {
            const diagnoser = this.diagnosers.get(type)
            return sum + (diagnoser?.steps.length || 0)
        }, 0)
    }
}
