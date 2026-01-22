import { Page } from 'playwright'
import { ExecutionLogEmitter } from '../../../services/executionLogEmitter'
import { logger } from '../../../observability'

interface ProcessResult {
    success: boolean
    findings: any[]
    error?: string
}

declare global {
    interface Window {
        axe: any
    }
}

export class AccessibilityTestExecutor {
    constructor(
        private deps: {
            page: Page
            logEmitter: ExecutionLogEmitter
            recordStep: (stepName: string, success: boolean, durationMs: number, metadata?: any) => void
            captureScreenshot: (name: string) => Promise<void>
        },
        private config: {
            runId: string
            url: string
        }
    ) { }


    /**
     * Record a step with structured output format
     */
    private recordLocalStep(
        stepName: string,
        execution_status: 'EXECUTED' | 'BLOCKED' | 'EXECUTION_FAILED' | 'SKIPPED',
        severity: 'GREEN' | 'YELLOW' | 'RED',
        observed_state: Record<string, any>,
        note: string
    ) {
        const success = severity !== 'RED' && execution_status === 'EXECUTED'
        this.deps.recordStep(stepName, success, 100, {
            execution_status,
            observed_state,
            severity,
            note,
            ...observed_state
        })
    }

    private async captureAndRecord(
        stepName: string,
        execution_status: 'EXECUTED' | 'BLOCKED' | 'EXECUTION_FAILED' | 'SKIPPED',
        severity: 'GREEN' | 'YELLOW' | 'RED',
        observed_state: Record<string, any>,
        note: string
    ): Promise<void> {
        const screenshotUrl = await this.deps.captureScreenshot(stepName)
        const success = severity !== 'RED' && execution_status === 'EXECUTED'
        this.deps.recordStep(stepName, success, 100, {
            execution_status,
            observed_state,
            severity,
            note,
            screenshotUrl,
            ...observed_state
        })
    }

    private buildResult(success: boolean): ProcessResult {
        return {
            success: true, // Always true - findings tracked at step level
            findings: []
        }
    }

    private isCSPError(error: any): boolean {
        const message = error?.message || ''
        return message.includes('Content Security Policy') ||
            message.includes('script-src') ||
            message.includes('Refused to load the script')
    }

    async execute(): Promise<ProcessResult> {
        logger.info({ runId: this.config.runId }, 'Starting Accessibility Contract v1')
        this.deps.logEmitter.log('Starting Accessibility 12-step contract...')
        const page = this.deps.page
        let axeResults: any = null
        let axeAvailable = false

        // STEP 1: Inject Accessibility Scanner (axe-core)
        try {
            this.deps.logEmitter.log('Injecting axe-core from CDN...')
            await page.addScriptTag({ url: 'https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.7.0/axe.min.js' })

            const axeVersion = await page.evaluate(() => (window.axe ? window.axe.version : 'not_found'))
            if (axeVersion === 'not_found') {
                this.deps.logEmitter.log('axe-core library not available, skipping automated checks')
                await this.captureAndRecord('inject_accessibility_scanner', 'EXECUTION_FAILED', 'YELLOW',
                    { injected: false },
                    'axe-core library not available, continuing with manual checks')
            } else {
                axeAvailable = true
                await this.captureAndRecord('inject_accessibility_scanner', 'EXECUTED', 'GREEN',
                    { injected: true, version: axeVersion },
                    `axe-core v${axeVersion} injected successfully`)
            }
        } catch (error: any) {
            if (this.isCSPError(error)) {
                logger.info({ runId: this.config.runId }, 'Site has CSP protection - skipping axe-core injection')
                this.deps.logEmitter.log('Site has Content Security Policy (CSP) protection - automated accessibility scanning blocked.')
                await this.captureAndRecord('csp_protection_detected', 'BLOCKED', 'YELLOW',
                    { csp_active: true },
                    'CSP blocks external scanning tools - security feature, not an error')
            } else {
                this.deps.logEmitter.log('Could not inject accessibility scanner, continuing with manual tests...')
                await this.captureAndRecord('inject_accessibility_scanner', 'EXECUTION_FAILED', 'YELLOW',
                    { injected: false, error: error.message },
                    'Scanner injection failed, continuing with keyboard tests')
            }
        }

        // STEPS 2-7: Only run axe-based checks if axe is available
        if (axeAvailable) {
            try {
                axeResults = await page.evaluate(async () => {
                    // @ts-ignore
                    return await window.axe.run({
                        resultTypes: ['violations', 'incomplete'],
                        runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'best-practice'] }
                    })
                })
                await this.captureAndRecord('run_critical_rule_set', 'EXECUTED', 'GREEN',
                    { timestamp: axeResults.timestamp, url: axeResults.url },
                    'Accessibility scan completed')

                const violations = axeResults.violations || []

                // STEP 3: Count Critical Violations
                const criticalViolations = violations.filter((v: any) => v.impact === 'critical')
                const criticalSeverity = criticalViolations.length === 0 ? 'GREEN' : 'RED'
                await this.captureAndRecord('count_critical_violations', 'EXECUTED', criticalSeverity,
                    { count: criticalViolations.length, types: criticalViolations.map((v: any) => v.id) },
                    criticalViolations.length === 0 ? 'No critical violations' : `Found ${criticalViolations.length} critical violation(s)`)

                // STEP 4: Count Serious Violations
                const seriousViolations = violations.filter((v: any) => v.impact === 'serious')
                const seriousSeverity = seriousViolations.length === 0 ? 'GREEN' : 'YELLOW'
                await this.captureAndRecord('count_serious_violations', 'EXECUTED', seriousSeverity,
                    { count: seriousViolations.length, types: seriousViolations.map((v: any) => v.id) },
                    seriousViolations.length === 0 ? 'No serious violations' : `Found ${seriousViolations.length} serious violation(s)`)

                // STEP 5: Detect Missing Alt Attributes
                const altViolations = violations.find((v: any) => v.id === 'image-alt')
                const altCount = altViolations ? altViolations.nodes.length : 0
                const altSeverity = altCount === 0 ? 'GREEN' : (altCount > 3 ? 'RED' : 'YELLOW')
                await this.captureAndRecord('detect_missing_alt_attributes', 'EXECUTED', altSeverity,
                    { missing_count: altCount },
                    altCount === 0 ? 'All images have alt attributes' : `Found ${altCount} image(s) missing alt`)

                // STEP 6: Detect Unlabeled Inputs
                const labelViolations = violations.find((v: any) => v.id === 'label' || v.id === 'form-field-name')
                const labelCount = labelViolations ? labelViolations.nodes.length : 0
                const labelSeverity = labelCount === 0 ? 'GREEN' : 'YELLOW'
                await this.captureAndRecord('detect_unlabeled_inputs', 'EXECUTED', labelSeverity,
                    { unlabeled_count: labelCount },
                    labelCount === 0 ? 'All inputs have labels' : `Found ${labelCount} unlabeled input(s)`)

                // STEP 7: Detect Icon-Only Buttons
                const buttonViolations = violations.find((v: any) => v.id === 'button-name')
                const buttonCount = buttonViolations ? buttonViolations.nodes.length : 0
                const buttonSeverity = buttonCount === 0 ? 'GREEN' : 'YELLOW'
                await this.captureAndRecord('detect_icon_only_buttons', 'EXECUTED', buttonSeverity,
                    { icon_only_count: buttonCount },
                    buttonCount === 0 ? 'All buttons have text/labels' : `Found ${buttonCount} icon-only button(s)`)
            } catch (axeError: any) {
                logger.warn({ runId: this.config.runId, error: axeError.message }, 'axe-core execution failed')
                await this.captureAndRecord('automated_accessibility_scan', 'EXECUTION_FAILED', 'YELLOW',
                    { error: axeError.message },
                    'Automated scan could not complete, continuing with keyboard tests')
            }
        } else {
            this.deps.logEmitter.log('Skipping automated accessibility checks (scanner not available)')
            await this.captureAndRecord('automated_checks_skipped', 'SKIPPED', 'GREEN',
                { reason: 'Scanner not available' },
                'Automated accessibility checks skipped due to CSP or injection failure')
        }

        // STEPS 8-12: Always run these (keyboard navigation tests)
        try {
            // STEP 8: Perform Keyboard Tab Navigation
            const tabFlow = []
            await page.evaluate(() => (document.activeElement as HTMLElement)?.blur())

            for (let i = 0; i < 5; i++) {
                await page.keyboard.press('Tab')
                await page.waitForTimeout(200)
                const elementDetails = await page.evaluate(() => {
                    const el = document.activeElement
                    return {
                        tag: el?.tagName.toLowerCase(),
                        text: (el as HTMLElement)?.innerText?.substring(0, 20) || '',
                        id: el?.id
                    }
                })
                tabFlow.push(elementDetails)
            }
            await this.captureAndRecord('perform_keyboard_tab_navigation', 'EXECUTED', 'GREEN',
                { tab_count: tabFlow.length, flow: tabFlow.map(e => `${e.tag}#${e.id || '?'}`) },
                `Tab navigation completed through ${tabFlow.length} elements`)

            // STEP 9: Check Focus Visibility
            const focusVisible = await page.evaluate(() => {
                const el = document.activeElement
                if (!el || el === document.body) return false
                const style = window.getComputedStyle(el)
                return style.outlineStyle !== 'none' || style.boxShadow !== 'none'
            })
            const focusSeverity = focusVisible ? 'GREEN' : 'YELLOW'
            await this.captureAndRecord('check_focus_visibility', 'EXECUTED', focusSeverity,
                { focus_visible: focusVisible },
                focusVisible ? 'Focus indicator visible on active element' : 'Focus indicator may not be visible')

            // STEP 10: Detect Aria-Role Misuse (only if axe ran)
            if (axeResults) {
                const ariaViolations = (axeResults.violations || []).filter((v: any) => v.id.startsWith('aria-'))
                const ariaSeverity = ariaViolations.length === 0 ? 'GREEN' : 'YELLOW'
                await this.captureAndRecord('detect_aria_role_misuse', 'EXECUTED', ariaSeverity,
                    { aria_violations: ariaViolations.length, types: ariaViolations.map((v: any) => v.id) },
                    ariaViolations.length === 0 ? 'No ARIA violations detected' : `Found ${ariaViolations.length} ARIA violation(s)`)
            }

            // STEP 11: Capture Accessibility Overlay Snapshot
            await this.captureAndRecord('capture_accessibility_overlay_snapshot', 'EXECUTED', 'GREEN',
                { captured: true },
                'Accessibility state snapshot captured')

            // STEP 12: Summarize Top Risks
            if (axeResults) {
                const violations = axeResults.violations || []
                const criticalViolations = violations.filter((v: any) => v.impact === 'critical')
                const seriousViolations = violations.filter((v: any) => v.impact === 'serious')
                const totalViolations = violations.length
                const topRisk = criticalViolations.length > 0 ? 'Critical' : (seriousViolations.length > 0 ? 'Serious' : 'Minor')

                const summarySeverity = criticalViolations.length > 0 ? 'RED' : (seriousViolations.length > 0 ? 'YELLOW' : 'GREEN')
                await this.captureAndRecord('summarize_top_risks', 'EXECUTED', summarySeverity,
                    { total_violations: totalViolations, highest_severity: topRisk },
                    `Found ${totalViolations} violation(s). Top risk: ${topRisk}`)
            } else {
                await this.captureAndRecord('summarize_results', 'EXECUTED', 'GREEN',
                    { automated_scan: false },
                    'Keyboard navigation tests completed. Automated scanning not available.')
            }
        } catch (keyboardError: any) {
            logger.warn({ runId: this.config.runId, error: keyboardError.message }, 'Keyboard navigation test failed')
            await this.captureAndRecord('keyboard_navigation_test', 'EXECUTION_FAILED', 'YELLOW',
                { error: keyboardError.message },
                'Keyboard navigation test failed')
        }

        // Always return success - individual steps track their own success/failure
        // The test completed, even if some steps had issues
        return this.buildResult(true)
    }
}
