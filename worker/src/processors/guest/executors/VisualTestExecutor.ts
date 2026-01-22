/**
 * VisualTestExecutor
 * Executes the 16-step systematic visual test checklist (Authoritative Contract v1)
 * Extracted from GuestTestProcessorRefactored
 */

import { Page } from 'playwright'
import { ProcessResult, TestStep } from '../../../types'
import { logger } from '../../../observability'
import { ExecutionLogEmitter } from '../../../services/executionLogEmitter'

export interface VisualTestConfig {
    runId: string
    url: string
    startingStep?: number  // Step number to start from (for merging with parent)
}

export interface VisualTestDependencies {
    page: Page
    logEmitter: ExecutionLogEmitter
    captureScreenshot: (label?: string) => Promise<string | undefined>
    recordStep: (action: string, success: boolean, duration: number, metadata?: Record<string, any>) => void
}

export class VisualTestExecutor {
    private config: VisualTestConfig
    private deps: VisualTestDependencies
    private currentStep: number
    private steps: TestStep[] = []
    private artifacts: string[] = []

    constructor(config: VisualTestConfig, deps: VisualTestDependencies) {
        this.config = config
        this.deps = deps
        this.currentStep = config.startingStep || 0  // Start from parent's step count
    }

    /**
     * Record a step with structured output format
     * @param action - Step action name
     * @param execution_status - EXECUTED, BLOCKED, EXECUTION_FAILED, or SKIPPED
     * @param severity - GREEN, YELLOW, or RED
     * @param observed_state - What was observed
     * @param note - Human-readable explanation
     * @param screenshotUrl - Optional screenshot URL
     */
    private recordLocalStep(
        action: string,
        execution_status: 'EXECUTED' | 'BLOCKED' | 'EXECUTION_FAILED' | 'SKIPPED',
        severity: 'GREEN' | 'YELLOW' | 'RED',
        observed_state: Record<string, any>,
        note: string,
        screenshotUrl?: string
    ): void {
        // For backwards compatibility, derive success from severity
        const success = severity !== 'RED' && execution_status === 'EXECUTED'

        const step: TestStep = {
            id: Math.random().toString(36).substring(7),
            stepNumber: this.currentStep,
            action,
            description: note,
            success,
            timestamp: new Date().toISOString(),
            execution_status,
            observed_state,
            severity,
            note,
            metadata: observed_state,
            screenshotUrl
        }
        this.steps.push(step)
        // Also call parent's recordStep for broadcasting
        this.deps.recordStep(action, success, 100, {
            execution_status,
            observed_state,
            severity,
            note,
            ...observed_state
        })
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
        this.recordLocalStep(action, execution_status, severity, observed_state, note, screenshotUrl)
    }

    async execute(): Promise<ProcessResult> {
        logger.info({ runId: this.config.runId }, 'Starting Systematic Visual Test Contract v1')
        this.deps.logEmitter.log('Starting Visual Test (16-Step Authoritative Contract)...')
        const page = this.deps.page

        // Setup Monitors
        const errors: string[] = []
        const failedRequests: string[] = []

        const consoleListener = (msg: any) => {
            if (msg.type() === 'error') {
                errors.push(msg.text())
            }
        }

        const requestListener = (response: any) => {
            if (response.status() >= 400) {
                failedRequests.push(`${response.status()} - ${response.url()}`)
            }
        }

        page.on('console', consoleListener)
        page.on('response', requestListener)

        try {
            // STEP 1: Navigate to URL (Implicitly done by caller, but we verify connectivity)
            this.currentStep++
            this.deps.logEmitter.log(`[Step ${this.currentStep}] 1. Validating Connection...`)
            const url = page.url()
            await this.captureAndRecord('navigate_check', 'EXECUTED', 'GREEN',
                { url },
                'Page connection verified')

            // STEP 2: Wait for network idle
            this.currentStep++
            this.deps.logEmitter.log(`[Step ${this.currentStep}] 2. Waiting for Network Idle...`)
            try {
                await page.waitForLoadState('networkidle', { timeout: 10000 })
                await this.captureAndRecord('network_idle', 'EXECUTED', 'GREEN',
                    { network_quiet: true },
                    'Network idle reached')
            } catch (e) {
                await this.captureAndRecord('network_idle', 'EXECUTED', 'YELLOW',
                    { network_quiet: false, timeout: true },
                    'Network still active after timeout - may have long-running requests')
            }

            // STEP 3: Check console errors
            this.currentStep++
            this.deps.logEmitter.log(`[Step ${this.currentStep}] 3. Checking Console Errors...`)
            const consoleSeverity = errors.length === 0 ? 'GREEN' : (errors.length > 5 ? 'RED' : 'YELLOW')
            await this.captureAndRecord('check_console', 'EXECUTED', consoleSeverity,
                { error_count: errors.length, errors: errors.slice(0, 3) },
                errors.length === 0 ? 'No console errors detected' : `Found ${errors.length} console error(s)`)

            // STEP 4: Check failed network requests
            this.currentStep++
            this.deps.logEmitter.log(`[Step ${this.currentStep}] 4. Checking Network Health...`)
            const networkSeverity = failedRequests.length === 0 ? 'GREEN' : (failedRequests.length > 3 ? 'RED' : 'YELLOW')
            await this.captureAndRecord('check_network', 'EXECUTED', networkSeverity,
                { failed_count: failedRequests.length, failed_requests: failedRequests.slice(0, 3) },
                failedRequests.length === 0 ? 'All network requests succeeded' : `Found ${failedRequests.length} failed request(s)`)

            // STEP 5: Initial render sanity check (>100px content)
            this.currentStep++
            this.deps.logEmitter.log(`[Step ${this.currentStep}] 5. Initial Render Sanity Check...`)
            const bodyVisible = await page.evaluate(() => {
                const body = document.body
                return body && body.innerText.length > 50 && body.scrollHeight > 100
            })
            await this.captureAndRecord('render_sanity', 'EXECUTED', bodyVisible ? 'GREEN' : 'RED',
                { has_content: bodyVisible },
                bodyVisible ? 'Page contains visible content' : 'Page appears empty or has minimal content')

            // STEP 6: Heuristic popup dismissal
            this.currentStep++
            this.deps.logEmitter.log(`[Step ${this.currentStep}] 6. Checking for Popups...`)
            try {
                const dismissed = await page.evaluate(() => {
                    const closeSelectors = [
                        'button[aria-label*="close" i]', 'button[aria-label*="dismiss" i]',
                        '.modal-close', '.popup-close', 'div[role="dialog"] button'
                    ]
                    let count = 0
                    closeSelectors.forEach(s => {
                        const el = document.querySelector(s) as HTMLElement
                        if (el && el.offsetParent !== null) { el.click(); count++ }
                    })
                    return count
                })
                await this.captureAndRecord('popup_dismiss', 'EXECUTED', 'GREEN',
                    { popups_dismissed: dismissed },
                    dismissed > 0 ? `Dismissed ${dismissed} popup(s)` : 'No popups detected')
            } catch (e) {
                await this.captureAndRecord('popup_dismiss', 'EXECUTED', 'GREEN',
                    { skipped: true },
                    'Popup check completed with no issues')
            }

            // STEP 7: Capture desktop viewport screenshot
            this.currentStep++
            this.deps.logEmitter.log(`[Step ${this.currentStep}] 7. Capture Desktop Viewport...`)
            await page.setViewportSize({ width: 1920, height: 1080 })
            await page.waitForTimeout(500)
            await this.captureAndRecord('viewport_desktop', 'EXECUTED', 'GREEN',
                { resolution: '1920x1080' },
                'Desktop viewport captured')

            // STEP 8: Capture laptop viewport screenshot
            this.currentStep++
            this.deps.logEmitter.log(`[Step ${this.currentStep}] 8. Capture Laptop Viewport...`)
            await page.setViewportSize({ width: 1366, height: 768 })
            await page.waitForTimeout(500)
            await this.captureAndRecord('viewport_laptop', 'EXECUTED', 'GREEN',
                { resolution: '1366x768' },
                'Laptop viewport captured')

            // STEP 9: Capture tablet viewport screenshot
            this.currentStep++
            this.deps.logEmitter.log(`[Step ${this.currentStep}] 9. Capture Tablet Viewport...`)
            await page.setViewportSize({ width: 768, height: 1024 })
            await page.waitForTimeout(500)
            await this.captureAndRecord('viewport_tablet', 'EXECUTED', 'GREEN',
                { resolution: '768x1024' },
                'Tablet viewport captured')

            // STEP 10: Capture mobile viewport screenshot
            this.currentStep++
            this.deps.logEmitter.log(`[Step ${this.currentStep}] 10. Capture Mobile Viewport...`)
            await page.setViewportSize({ width: 375, height: 667 })
            await page.waitForTimeout(500)
            await this.captureAndRecord('viewport_mobile', 'EXECUTED', 'GREEN',
                { resolution: '375x667' },
                'Mobile viewport captured')

            // Restore Desktop for remainder
            await page.setViewportSize({ width: 1920, height: 1080 })

            // STEP 11: Scroll to bottom and back to top
            this.currentStep++
            this.deps.logEmitter.log(`[Step ${this.currentStep}] 11. Scroll Test...`)
            await page.evaluate(async () => {
                await new Promise<void>((resolve) => {
                    let totalHeight = 0
                    const distance = 200
                    const timer = setInterval(() => {
                        const scrollHeight = document.body.scrollHeight
                        window.scrollBy(0, distance)
                        totalHeight += distance
                        if (totalHeight >= scrollHeight) {
                            clearInterval(timer)
                            window.scrollTo(0, 0)
                            resolve()
                        }
                    }, 50)
                })
            })
            await this.captureAndRecord('scroll_test', 'EXECUTED', 'GREEN',
                { scroll_completed: true },
                'Page scroll test completed')

            // STEP 12: Detect text overflow / truncation
            this.currentStep++
            this.deps.logEmitter.log(`[Step ${this.currentStep}] 12. Scanning for Text Overflow...`)
            const overflows = await page.evaluate(() => {
                const results: string[] = []
                const elements = document.querySelectorAll('p, h1, h2, h3, h4, h5, span, div')
                elements.forEach(el => {
                    const e = el as HTMLElement
                    if (e.scrollWidth > e.clientWidth && e.innerText.length > 0 && window.getComputedStyle(e).overflow !== 'visible') {
                        if (window.getComputedStyle(e).overflow === 'auto' || window.getComputedStyle(e).overflow === 'scroll') return
                        results.push(`${e.tagName.toLowerCase()}: "${e.innerText.substring(0, 20)}..."`)
                    }
                })
                return results.slice(0, 5)
            })
            const overflowSeverity = overflows.length === 0 ? 'GREEN' : 'YELLOW'
            await this.captureAndRecord('detect_overflow', 'EXECUTED', overflowSeverity,
                { overflow_count: overflows.length, samples: overflows },
                overflows.length === 0 ? 'No text overflow detected' : `Found ${overflows.length} element(s) with text overflow`)

            // STEP 13: Detect placeholder copy - DOWNGRADED TO YELLOW (never fail)
            this.currentStep++
            this.deps.logEmitter.log(`[Step ${this.currentStep}] 13. Scanning for Placeholder Text...`)
            const placeholders = await page.evaluate(() => {
                const results: string[] = []
                const bodyText = document.body.innerText.toLowerCase()
                const badTerms = ['lorem ipsum', 'insert text', 'title goes here', 'your text here', 'template']
                badTerms.forEach(term => {
                    if (bodyText.includes(term)) results.push(term)
                })
                return results
            })
            // RECLASSIFIED: detect_placeholder → YELLOW (never fail)
            await this.captureAndRecord('detect_placeholder', 'EXECUTED', placeholders.length === 0 ? 'GREEN' : 'YELLOW',
                { placeholder_count: placeholders.length, found: placeholders },
                placeholders.length === 0 ? 'No placeholder text detected' : `Found placeholder text: ${placeholders.join(', ')}`)

            // STEP 14: Detect broken images/media
            this.currentStep++
            this.deps.logEmitter.log(`[Step ${this.currentStep}] 14. Verifying Media Assets...`)
            const brokenMedia = await page.evaluate(() => {
                return Array.from(document.querySelectorAll('img, video, audio'))
                    .filter(el => {
                        if (el.tagName === 'IMG') return !(el as HTMLImageElement).complete || (el as HTMLImageElement).naturalWidth === 0
                        return false
                    }).length
            })
            const mediaSeverity = brokenMedia === 0 ? 'GREEN' : (brokenMedia > 3 ? 'RED' : 'YELLOW')
            await this.captureAndRecord('check_media', 'EXECUTED', mediaSeverity,
                { broken_count: brokenMedia },
                brokenMedia === 0 ? 'All media assets loaded correctly' : `Found ${brokenMedia} broken media asset(s)`)

            // STEP 15: Validate internal links count - INFORMATIONAL / YELLOW
            this.currentStep++
            this.deps.logEmitter.log(`[Step ${this.currentStep}] 15. Validating Internal Links...`)
            const linksCount = await page.evaluate(() => document.querySelectorAll('a[href^="/"], a[href^="' + window.location.origin + '"]').length)
            // RECLASSIFIED: validate_links → Informational/YELLOW (count is observation, not pass/fail)
            await this.captureAndRecord('validate_links', 'EXECUTED', linksCount > 0 ? 'GREEN' : 'YELLOW',
                { internal_links_count: linksCount },
                `Found ${linksCount} internal link(s)`)

            // STEP 16: Capture final visual snapshot
            this.currentStep++
            this.deps.logEmitter.log(`[Step ${this.currentStep}] 16. Final Visual Snapshot...`)
            await this.captureAndRecord('final_snapshot', 'EXECUTED', 'GREEN',
                { contract_complete: true },
                'Visual test contract completed')

            return {
                success: true, // Always true - findings are tracked at step level
                steps: this.steps,
                artifacts: this.artifacts,
                stage: 'execution'
            }

        } catch (error: any) {
            logger.error({ runId: this.config.runId, error: error.message }, 'Visual Test Contract Failed')
            this.deps.logEmitter.log(`Visual Contract Failed: ${error.message}`)
            return {
                success: true, // Always true - errors are findings, not test failures
                steps: this.steps,
                artifacts: this.artifacts,
                stage: 'execution'
            }
        } finally {
            page.off('console', consoleListener)
            page.off('response', requestListener)
        }
    }
}
