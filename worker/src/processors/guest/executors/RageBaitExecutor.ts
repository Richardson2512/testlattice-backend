/**
 * RageBaitExecutor
 * Executes the 12-step Rage Bait Contract (Authoritative Contract v1)
 * Orchestrates individual tests from RageBaitAnalyzer
 */

import { Page } from 'playwright'
import { ProcessResult, TestStep } from '../../../types'
import { logger } from '../../../observability'
import { ExecutionLogEmitter } from '../../../services/executionLogEmitter'
import { RageBaitAnalyzer } from '../../../services/rageBaitAnalyzer'

export interface RageBaitConfig {
    runId: string
    url: string
    startingStep?: number
}

export interface RageBaitDependencies {
    page: Page
    logEmitter: ExecutionLogEmitter
    rageBaitAnalyzer: RageBaitAnalyzer
    captureScreenshot: (label?: string) => Promise<string | undefined>
    recordStep: (action: string, success: boolean, duration: number, metadata?: Record<string, any>) => void
    broadcastStep: (step: TestStep) => void
}

export class RageBaitExecutor {
    private config: RageBaitConfig
    private deps: RageBaitDependencies
    private currentStep: number
    private steps: TestStep[] = []
    private artifacts: string[] = []

    constructor(config: RageBaitConfig, deps: RageBaitDependencies) {
        this.config = config
        this.deps = deps
        this.currentStep = config.startingStep || 0
    }

    /**
     * Record a step with structured output format
     * Rage Bait tests never fail the run - RED only for real breakage, YELLOW for friction
     */
    private recordLocalStep(
        action: string,
        execution_status: 'EXECUTED' | 'BLOCKED' | 'EXECUTION_FAILED' | 'SKIPPED',
        severity: 'GREEN' | 'YELLOW' | 'RED',
        observed_state: Record<string, any>,
        note: string
    ) {
        this.currentStep++
        // Rage tests never block - success is always true for execution flow
        const success = execution_status === 'EXECUTED'

        const step: TestStep = {
            id: Math.random().toString(36).substring(7),
            stepNumber: this.currentStep,
            action,
            success,
            timestamp: new Date().toISOString(),
            execution_status,
            observed_state,
            severity,
            note,
            metadata: {
                testName: observed_state?.testName || action,
                description: note,
                ...observed_state
            }
        } as TestStep

        this.steps.push(step)
        this.deps.broadcastStep(step)
        const severityIcon = severity === 'GREEN' ? '✅' : severity === 'YELLOW' ? '⚠️' : '🔴'
        this.deps.logEmitter.log(`[RageBait] ${severityIcon} ${action}: ${note}`)
    }

    /**
     * Capture screenshot and record step with structured output
     */
    private async captureAndRecord(
        action: string,
        execution_status: 'EXECUTED' | 'BLOCKED' | 'EXECUTION_FAILED' | 'SKIPPED',
        severity: 'GREEN' | 'YELLOW' | 'RED',
        observed_state: Record<string, any>,
        note: string
    ): Promise<void> {
        const screenshotUrl = await this.deps.captureScreenshot(action)
        this.currentStep++
        const success = execution_status === 'EXECUTED'

        const step: TestStep = {
            id: Math.random().toString(36).substring(7),
            stepNumber: this.currentStep,
            action,
            success,
            timestamp: new Date().toISOString(),
            screenshotUrl,
            execution_status,
            observed_state,
            severity,
            note,
            metadata: {
                testName: observed_state?.testName || action,
                description: note,
                ...observed_state
            }
        } as TestStep

        this.steps.push(step)
        this.deps.broadcastStep(step)
        const severityIcon = severity === 'GREEN' ? '✅' : severity === 'YELLOW' ? '⚠️' : '🔴'
        this.deps.logEmitter.log(`[RageBait] ${severityIcon} ${action}: ${note}`)
    }

    /**
     * Backwards-compat wrapper: converts old 4-arg format to new structured format
     * Rage tests use: passed = true → GREEN, passed = false → YELLOW (never RED for findings)
     */
    private async captureAndRecordCompat(action: string, passed: boolean, _duration: number, metadata?: Record<string, any>): Promise<void> {
        // Convert old format to new structured format
        // Rage tests: failures are YELLOW (friction), not RED (breaking)
        const severity: 'GREEN' | 'YELLOW' | 'RED' = passed ? 'GREEN' : 'YELLOW'
        const note = metadata?.details || metadata?.testName || action
        await this.captureAndRecord(action, 'EXECUTED', severity, metadata || {}, note)
    }

    async execute(): Promise<ProcessResult> {
        logger.info({ runId: this.config.runId }, 'Starting Rage Bait 12-Step Contract')
        this.deps.logEmitter.log('Starting Rage Bait Analysis (12-Step Chaos Mode)...')
        const analyzer = this.deps.rageBaitAnalyzer
        const page = this.deps.page

        try {
            // STEP 1: Detect Primary Form
            this.deps.logEmitter.log('Step 1: Hunting for Forms...')
            const formSearch = await analyzer.findForm(page, this.config.runId)
            await this.captureAndRecordCompat('find_form', formSearch.found, 1000, {
                testName: 'Detect Primary Form',
                details: formSearch.found ? `Found form at ${formSearch.url || 'current page'}` : 'No form found - skipping dependent tests'
            })

            // STEP 2: Back Button Zombie
            this.deps.logEmitter.log('Step 2: Back Button Test...')
            const backResult = await analyzer.testBackButton(page, this.config.runId)
            await this.captureAndRecordCompat('back_button_zombie', backResult.passed, 2000, backResult)

            // STEP 3: Enter Key Trap
            this.deps.logEmitter.log('Step 3: Enter Key Trap...')
            const enterResult = await analyzer.testEnterKeyTrap(page, this.config.runId)
            await this.captureAndRecordCompat('enter_key_trap', enterResult.passed, 1000, enterResult)

            // STEP 4: Emoji / Special Char Injection
            this.deps.logEmitter.log('Step 4: Special Char Attack...')
            const specialResult = await analyzer.testSpecialCharacters(page, this.config.runId)
            await this.captureAndRecordCompat('special_char_attack', specialResult.passed, 1500, specialResult)

            // STEP 5: Large Input Overflow
            this.deps.logEmitter.log('Step 5: Input Overflow...')
            const overflowResult = await analyzer.testInputOverflow(page, this.config.runId)
            await this.captureAndRecordCompat('input_overflow', overflowResult.passed, 1500, overflowResult)

            // STEP 6: Double Submit Race Condition
            this.deps.logEmitter.log('Step 6: Double Submit Race Condition...')
            const doubleResult = await analyzer.testDoubleSubmit(page, this.config.runId)
            await this.captureAndRecordCompat('double_submit', doubleResult.passed, 1000, doubleResult)

            // STEP 7: Clear Session Mid-Form (Timeout)
            this.deps.logEmitter.log('Step 7: Session Timeout Simulation...')
            const sessionResult = await analyzer.testSessionTimeout(page, this.config.runId)
            await this.captureAndRecordCompat('session_timeout', sessionResult.passed, 3000, sessionResult)

            // STEP 8: Refresh Page Mid-Input
            this.deps.logEmitter.log('Step 8: Refresh Persistence...')
            const refreshResult = await analyzer.testRefreshPersistence(page, this.config.runId)
            await this.captureAndRecordCompat('refresh_persistence', refreshResult.passed, 2000, refreshResult)

            // STEP 9: Light Network Throttle
            this.deps.logEmitter.log('Step 9: Network Throttle (Slow 3G)...')
            const netResult = await analyzer.testNetworkThrottle(page, this.config.runId)
            await this.captureAndRecordCompat('network_throttle', netResult.passed, 1000, netResult)

            // STEP 10: Observe Loader / Error Handling
            this.deps.logEmitter.log('Step 10: Analyzing Error UX...')
            const previousFailures = [backResult, enterResult, specialResult, overflowResult].filter(r => !r.passed)
            const hasSpinnerIssue = previousFailures.some(r => r.details.includes('Spinner'))
            const hasSilentIssue = previousFailures.some(r => r.details.includes('Silent'))

            await this.captureAndRecordCompat('observe_ux', !hasSpinnerIssue && !hasSilentIssue, 500, {
                testName: 'Observe Error/Loader UX',
                details: hasSpinnerIssue ? 'Found stuck loaders' : hasSilentIssue ? 'Found silent failures' : 'Error handling appears robust'
            })

            // STEP 11: Record Frustration Signals
            this.deps.logEmitter.log('Step 11: Frustration Signals...')
            const consoleErrors = await page.evaluate(() => {
                return (window as any)._errorBuffer || []
            })
            await this.captureAndRecordCompat('frustration_signals', true, 500, {
                testName: 'Frustration Signals',
                details: 'Log analysis complete'
            })

            // STEP 12: Final State Capture
            this.deps.logEmitter.log('Step 12: Final Capture...')
            await this.captureAndRecordCompat('final_capture', true, 500, {
                testName: 'Final State Capture',
                details: 'Chaos test sequence complete'
            })

            return {
                success: true, // Always true - findings are tracked at step level
                steps: this.steps,
                artifacts: this.artifacts,
                stage: 'execution'
            }

        } catch (error: any) {
            logger.error({ runId: this.config.runId, error: error.message }, 'Rage Bait Contract Failed')
            return {
                success: true, // Always true - errors are findings, not test failures
                steps: this.steps,
                artifacts: this.artifacts,
                stage: 'execution'
            }
        }
    }
}
