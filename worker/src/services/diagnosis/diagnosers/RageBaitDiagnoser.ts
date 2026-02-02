/**
 * Rage Bait Diagnoser
 * 
 * Analyzes edge case / "rage bait" testability.
 * These are common scenarios that break MVPs:
 * - Back button behavior
 * - Session timeout
 * - Enter key submission
 * - Special character handling
 * - Input overflow
 */

import { Page } from 'playwright'
import { IDiagnoser, TestTypeDiagnosis, CapabilityItem } from './IDiagnoser'

export class RageBaitDiagnoser implements IDiagnoser {
    readonly testType = 'rage_bait'
    readonly steps = [
        'Checking back button behavior',
        'Detecting session timeout handling',
        'Testing Enter key submission',
        'Analyzing special character handling',
        'Checking input overflow protection'
    ]

    async diagnose(page: Page): Promise<TestTypeDiagnosis> {
        const startTime = Date.now()
        const canTest: CapabilityItem[] = []
        const cannotTest: CapabilityItem[] = []

        try {
            // Check for history manipulation
            const hasHistoryAPI = await page.evaluate(() => {
                return typeof window.history.pushState === 'function'
            })
            if (hasHistoryAPI) {
                canTest.push({
                    name: 'Browser history',
                    reason: 'Can test back button behavior'
                })
            }

            // Check for beforeunload handler
            const hasBeforeUnload = await page.evaluate(() => {
                return typeof (window as any).onbeforeunload === 'function' ||
                    document.querySelectorAll('[onbeforeunload]').length > 0
            })
            if (hasBeforeUnload) {
                canTest.push({
                    name: 'Leave page warning',
                    reason: 'Can test unsaved changes dialog'
                })
            }

            // Check for session storage usage
            const hasSessionStorage = await page.evaluate(() => {
                try {
                    return sessionStorage.length > 0 || localStorage.length > 0
                } catch {
                    return false
                }
            })
            if (hasSessionStorage) {
                canTest.push({
                    name: 'Session/Local storage',
                    reason: 'Can test data persistence across navigation'
                })
            }

            // Check for forms (Enter key testing)
            const forms = await page.$$('form')
            if (forms.length > 0) {
                canTest.push({
                    name: 'Enter key submission',
                    reason: 'Can test form submission via Enter key',
                    elementCount: forms.length
                })
            }

            // Check for text inputs (special character testing)
            const textInputs = await page.$$('input[type="text"], input:not([type]), textarea')
            if (textInputs.length > 0) {
                canTest.push({
                    name: 'Special character handling',
                    reason: 'Can test <script>, quotes, unicode, SQL injection chars',
                    elementCount: textInputs.length
                })
                canTest.push({
                    name: 'Input overflow',
                    reason: 'Can test very long input handling',
                    elementCount: textInputs.length
                })
            }

            // Check for number inputs (boundary testing)
            const numberInputs = await page.$$('input[type="number"]')
            if (numberInputs.length > 0) {
                canTest.push({
                    name: 'Number boundary testing',
                    reason: 'Can test negative, zero, max values',
                    elementCount: numberInputs.length
                })
            }

            // Check for modals that might trap focus
            const modals = await page.$$('[role="dialog"], .modal, [class*="modal"]')
            if (modals.length > 0) {
                canTest.push({
                    name: 'Modal escape behavior',
                    reason: 'Can test Escape key and overlay click',
                    elementCount: modals.length
                })
            }

            // Check for infinite scroll
            const hasInfiniteScroll = await page.evaluate(() => {
                const pageText = document.body.innerHTML.toLowerCase()
                return pageText.includes('infinite-scroll') ||
                    pageText.includes('load-more') ||
                    pageText.includes('lazy-load')
            })
            if (hasInfiniteScroll) {
                canTest.push({
                    name: 'Infinite scroll',
                    reason: 'Can test continuous loading behavior'
                })
            }

            // Check for timeout/countdown indicators
            const timeoutIndicators = await page.$$('[class*="timeout"], [class*="countdown"], [id*="session"]')
            if (timeoutIndicators.length > 0) {
                canTest.push({
                    name: 'Session timeout UI',
                    reason: 'Can test timeout warning behavior',
                    elementCount: timeoutIndicators.length
                })
            }

            // Check for copy-paste handlers
            const copyProtected = await page.evaluate(() => {
                const style = document.body.style
                return style.userSelect === 'none' ||
                    style.webkitUserSelect === 'none'
            })
            if (copyProtected) {
                canTest.push({
                    name: 'Copy protection',
                    reason: 'Can test copy-paste restrictions'
                })
            }

            // Check for right-click handlers
            const hasContextMenu = await page.evaluate(() => {
                return typeof document.oncontextmenu === 'function'
            })
            if (hasContextMenu) {
                canTest.push({
                    name: 'Right-click handling',
                    reason: 'Can test custom context menu behavior'
                })
            }

            // WebSocket connections (session management)
            const hasWebSocket = await page.evaluate(() => {
                return typeof WebSocket !== 'undefined'
            })
            if (hasWebSocket) {
                cannotTest.push({
                    name: 'WebSocket sessions',
                    reason: 'Cannot simulate server-side session expiry'
                })
            }

        } catch (error: any) {
            // Convert technical errors to user-friendly messages
            cannotTest.push({
                name: 'Edge Case Analysis Limitation',
                reason: 'Some edge case scenarios could not be simulated due to browser security restrictions.'
            })
        }

        // Generate plain English narrative
        const passed = canTest.length > cannotTest.length
        const narrative = {
            what: `Edge case behavior is being diagnosed, including back button handling, session timeout, special character injection, and input overflow protection.`,
            how: `The system probes ${canTest.length} potential failure points common in MVP applications, testing browser history, form submission, and data persistence.`,
            why: `Edge case failures are the most common source of user rage and negative reviews for new applications.`,
            result: passed
                ? `Passed — ${canTest.length} edge case scenarios can be tested to prevent user frustration.`
                : `Failed — ${cannotTest.length} edge cases cannot be fully tested: ${cannotTest.map(c => c.name).join(', ')}.`,
            passed
        }

        return {
            testType: this.testType,
            steps: this.steps,
            canTest,
            cannotTest,
            duration: Date.now() - startTime,
            narrative
        }
    }
}
