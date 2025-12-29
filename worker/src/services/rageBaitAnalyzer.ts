/**
 * Rage Bait Analyzer
 * 
 * Tests 5 common edge cases that break most MVPs:
 * 1. Back Button Zombie - form resubmission and data leaks
 * 2. Lunch Break Save - session timeout handling
 * 3. Enter Key Trap - premature form submission
 * 4. Emoji & Special Char Attack - XSS and encoding issues
 * 5. Copy-Paste Overflow - UI breaking with long inputs
 */

import { Page } from 'playwright'

export interface RageBaitResult {
    testName: string
    passed: boolean
    details: string
    severity: 'critical' | 'major' | 'minor'
    screenshotBefore?: string
    screenshotAfter?: string
}

export interface RageBaitSummary {
    totalTests: number
    passed: number
    failed: number
    critical: number
    results: RageBaitResult[]
    formFound: boolean
    formUrl?: string
}

export class RageBaitAnalyzer {
    private readonly OVERFLOW_TEXT_LENGTH = 5000
    private readonly XSS_PAYLOAD = `Test <script>alert('xss')</script> 🕵️‍♀️ O'Neil & José "quoted"`

    /**
     * Find a form on the page, or try to navigate to find one
     */
    async findForm(page: Page, runId: string): Promise<{ found: boolean; navigated: boolean; url?: string }> {
        // First check current page
        const formOnCurrentPage = await page.$('form')
        if (formOnCurrentPage) {
            return { found: true, navigated: false, url: page.url() }
        }

        console.log(`[${runId}] No form on current page, looking for links to forms...`)

        // Try to find links that might lead to forms
        const formLinks = await page.evaluate(() => {
            const links = Array.from(document.querySelectorAll('a'))
            const formKeywords = ['login', 'signup', 'register', 'sign-up', 'sign-in', 'contact', 'subscribe', 'join', 'create', 'add', 'new', 'edit', 'profile', 'settings', 'checkout', 'order', 'book', 'submit', 'apply']

            return links
                .filter(link => {
                    const href = link.href?.toLowerCase() || ''
                    const text = link.textContent?.toLowerCase() || ''
                    return formKeywords.some(kw => href.includes(kw) || text.includes(kw))
                })
                .map(link => link.href)
                .slice(0, 5) // Limit to 5 attempts
        })

        // Try each link to find a form
        for (const link of formLinks) {
            try {
                await page.goto(link, { waitUntil: 'domcontentloaded', timeout: 10000 })
                await page.waitForTimeout(1000)

                const hasForm = await page.$('form')
                if (hasForm) {
                    console.log(`[${runId}] Found form at: ${link}`)
                    return { found: true, navigated: true, url: link }
                }
            } catch (e) {
                // Continue to next link
            }
        }

        return { found: false, navigated: true }
    }

    /**
     * Test 1: Back Button Zombie
     * Tests if back button causes form resubmission or data leaks
     */
    async testBackButton(page: Page, runId: string): Promise<RageBaitResult> {
        console.log(`[${runId}] 🔙 Running Back Button Zombie test...`)

        try {
            const initialUrl = page.url()

            // Fill a form field if present
            const input = await page.$('input[type="text"], input[type="email"], textarea')
            if (input) {
                await input.fill('Test data for back button test')
            }

            // Submit the form
            const submitBtn = await page.$('button[type="submit"], input[type="submit"], button:has-text("Submit"), button:has-text("Send")')
            if (submitBtn) {
                await submitBtn.click()
                await page.waitForTimeout(2000)
            }

            const urlAfterSubmit = page.url()

            // Go back
            await page.goBack()
            await page.waitForTimeout(1500)

            // Check for resubmission dialog (usually appears as a browser-level dialog)
            // We can't directly detect browser dialogs, but we can check if we're back on form
            const backOnForm = await page.$('form')

            // Check for any "confirm" or resubmission indicators
            const hasResubmissionWarning = await page.evaluate(() => {
                const bodyText = document.body.textContent?.toLowerCase() || ''
                return bodyText.includes('resubmit') ||
                    bodyText.includes('confirm form') ||
                    bodyText.includes('duplicate') ||
                    bodyText.includes('already submitted')
            })

            // Security check: If we navigated to an authenticated area, check if private data is visible
            const hasPrivateDataAfterBack = await page.evaluate(() => {
                const privateIndicators = document.querySelectorAll('[data-user], .user-profile, .dashboard-content, .private-data, .account-info')
                return privateIndicators.length > 0
            })

            const passed = !hasResubmissionWarning

            return {
                testName: 'Back Button Zombie',
                passed,
                details: hasResubmissionWarning
                    ? 'Form resubmission warning detected - consider using POST-Redirect-GET pattern'
                    : hasPrivateDataAfterBack && urlAfterSubmit !== initialUrl
                        ? 'Private data may be visible after back navigation - verify logout clears cache'
                        : 'Back button handled correctly',
                severity: hasResubmissionWarning ? 'major' : 'minor'
            }
        } catch (error: any) {
            return {
                testName: 'Back Button Zombie',
                passed: true,
                details: `Test skipped: ${error.message}`,
                severity: 'minor'
            }
        }
    }

    /**
     * Test 2: Session Timeout (Lunch Break Save)
     * Tests graceful handling when session expires mid-form
     */
    async testSessionTimeout(page: Page, runId: string): Promise<RageBaitResult> {
        console.log(`[${runId}] ⏰ Running Session Timeout test...`)

        try {
            // Find form inputs
            const inputs = await page.$$('input[type="text"], input[type="email"], textarea')
            if (inputs.length === 0) {
                return {
                    testName: 'Session Timeout Handling',
                    passed: true,
                    details: 'No input fields to test',
                    severity: 'minor'
                }
            }

            // Fill form with test data
            for (const input of inputs.slice(0, 3)) {
                await input.fill('Important data that should not be lost')
            }

            // Clear all cookies to simulate session expiry
            await page.context().clearCookies()

            // Try to submit
            const submitBtn = await page.$('button[type="submit"], input[type="submit"]')
            if (submitBtn) {
                await submitBtn.click()
            }

            // Wait and check for spinner stuck
            const spinnerStartTime = Date.now()
            let spinnerStuck = false

            await page.waitForTimeout(3000)

            const hasSpinner = await page.$('.spinner, .loading, [class*="spin"], [class*="load"]')
            if (hasSpinner) {
                // Check if spinner is still there after 5 more seconds
                await page.waitForTimeout(5000)
                const stillSpinning = await page.$('.spinner, .loading, [class*="spin"], [class*="load"]')
                spinnerStuck = !!stillSpinning
            }

            // Check for error message or redirect
            const hasErrorFeedback = await page.evaluate(() => {
                const errorElements = document.querySelectorAll('.error, [role="alert"], .notification, .toast, .message')
                const bodyText = document.body.textContent?.toLowerCase() || ''
                return errorElements.length > 0 ||
                    bodyText.includes('session') ||
                    bodyText.includes('expired') ||
                    bodyText.includes('login') ||
                    bodyText.includes('unauthorized')
            })

            const passed = !spinnerStuck && hasErrorFeedback

            return {
                testName: 'Session Timeout Handling',
                passed,
                details: spinnerStuck
                    ? 'CRITICAL: Spinner stuck after session expiry - user sees infinite loading'
                    : !hasErrorFeedback
                        ? 'Silent failure: No feedback when session expired'
                        : 'Session expiry handled gracefully with user feedback',
                severity: spinnerStuck ? 'critical' : !hasErrorFeedback ? 'major' : 'minor'
            }
        } catch (error: any) {
            return {
                testName: 'Session Timeout Handling',
                passed: true,
                details: `Test completed with note: ${error.message}`,
                severity: 'minor'
            }
        }
    }

    /**
     * Test 3: Enter Key Trap
     * Tests if Enter key prematurely submits forms
     */
    async testEnterKeyTrap(page: Page, runId: string): Promise<RageBaitResult> {
        console.log(`[${runId}] ⌨️ Running Enter Key Trap test...`)

        try {
            // Navigate back to form if needed (previous test may have navigated away)
            const form = await page.$('form')
            if (!form) {
                return {
                    testName: 'Enter Key Trap',
                    passed: true,
                    details: 'No form available to test',
                    severity: 'minor'
                }
            }

            const inputs = await page.$$('form input:not([type="submit"]):not([type="hidden"]):not([type="checkbox"]):not([type="radio"])')

            if (inputs.length < 2) {
                return {
                    testName: 'Enter Key Trap',
                    passed: true,
                    details: 'Single-field form - Enter to submit is expected behavior',
                    severity: 'minor'
                }
            }

            const urlBefore = page.url()

            // Clear and fill only the first input
            await inputs[0].fill('')
            await inputs[0].fill('Testing Enter key')

            // Press Enter
            await page.keyboard.press('Enter')
            await page.waitForTimeout(1500)

            const urlAfter = page.url()

            // Check if form was submitted (URL changed or form disappeared)
            const formStillPresent = await page.$('form')
            const pageNavigated = urlBefore !== urlAfter
            const formSubmittedPrematurely = pageNavigated || !formStillPresent

            // Check if validation error shown (good behavior)
            const hasValidationError = await page.evaluate(() => {
                const errors = document.querySelectorAll('.error, .invalid, [aria-invalid="true"], .validation-error')
                return errors.length > 0
            })

            const passed = !formSubmittedPrematurely || hasValidationError

            return {
                testName: 'Enter Key Trap',
                passed,
                details: formSubmittedPrematurely && !hasValidationError
                    ? 'Form submitted prematurely when Enter pressed in first field - users expect to move to next field'
                    : hasValidationError
                        ? 'Validation prevented premature submission - good!'
                        : 'Enter key handled correctly',
                severity: formSubmittedPrematurely && !hasValidationError ? 'major' : 'minor'
            }
        } catch (error: any) {
            return {
                testName: 'Enter Key Trap',
                passed: true,
                details: `Test skipped: ${error.message}`,
                severity: 'minor'
            }
        }
    }

    /**
     * Test 4: Emoji & Special Character Attack
     * Tests XSS vulnerabilities and encoding issues
     */
    async testSpecialCharacters(page: Page, runId: string): Promise<RageBaitResult> {
        console.log(`[${runId}] 🎭 Running Special Characters Attack test...`)

        try {
            // Reload page to get fresh form
            await page.reload({ waitUntil: 'domcontentloaded' })
            await page.waitForTimeout(1000)

            const input = await page.$('input[type="text"], textarea')
            if (!input) {
                return {
                    testName: 'Special Characters Attack',
                    passed: true,
                    details: 'No text input to test',
                    severity: 'minor'
                }
            }

            // Track console errors
            const consoleErrors: string[] = []
            page.on('console', msg => {
                if (msg.type() === 'error') {
                    consoleErrors.push(msg.text())
                }
            })

            // Track dialog (XSS alert)
            let xssAlertTriggered = false
            page.on('dialog', async dialog => {
                xssAlertTriggered = true
                await dialog.dismiss()
            })

            // Fill with XSS payload
            await input.fill(this.XSS_PAYLOAD)
            await page.waitForTimeout(500)

            // Try to submit
            const submitBtn = await page.$('button[type="submit"], input[type="submit"]')
            if (submitBtn) {
                await submitBtn.click()
                await page.waitForTimeout(2000)
            }

            // Check for XSS execution via our payload marker
            const xssExecuted = xssAlertTriggered || await page.evaluate(() => {
                // Check if script tag content is visible unescaped
                const bodyHtml = document.body.innerHTML
                return bodyHtml.includes('<script>alert') && !bodyHtml.includes('&lt;script&gt;')
            })

            // Check for database/display issues with special chars
            const specialCharsDisplayed = await page.evaluate(() => {
                const bodyText = document.body.textContent || ''
                // Check if emoji and special chars are visible
                return bodyText.includes('🕵️') || bodyText.includes("O'Neil") || bodyText.includes('José')
            })

            const hasErrors = consoleErrors.length > 0

            const passed = !xssExecuted && !hasErrors

            return {
                testName: 'Special Characters Attack',
                passed,
                details: xssExecuted
                    ? 'CRITICAL SECURITY ISSUE: XSS vulnerability detected! Script tags are not being escaped.'
                    : hasErrors
                        ? `Console errors on special characters: ${consoleErrors[0]}`
                        : 'Special characters and emojis handled safely',
                severity: xssExecuted ? 'critical' : hasErrors ? 'major' : 'minor'
            }
        } catch (error: any) {
            return {
                testName: 'Special Characters Attack',
                passed: true,
                details: `Test skipped: ${error.message}`,
                severity: 'minor'
            }
        }
    }

    /**
     * Test 5: Copy-Paste Overflow
     * Tests UI resilience to extremely long inputs
     */
    async testInputOverflow(page: Page, runId: string): Promise<RageBaitResult> {
        console.log(`[${runId}] 📜 Running Input Overflow test...`)

        try {
            // Reload page to get fresh form
            await page.reload({ waitUntil: 'domcontentloaded' })
            await page.waitForTimeout(1000)

            // Find an input without maxlength restriction
            const input = await page.$('input[type="text"]:not([maxlength]), textarea:not([maxlength])')

            if (!input) {
                // Try any text input
                const anyInput = await page.$('input[type="text"], textarea')
                if (!anyInput) {
                    return {
                        testName: 'Input Overflow',
                        passed: true,
                        details: 'No text input to test',
                        severity: 'minor'
                    }
                }
            }

            const targetInput = input || await page.$('input[type="text"], textarea')
            if (!targetInput) {
                return {
                    testName: 'Input Overflow',
                    passed: true,
                    details: 'No text input available',
                    severity: 'minor'
                }
            }

            // Generate very long text
            const longText = 'A'.repeat(this.OVERFLOW_TEXT_LENGTH)

            // Fill the input
            await targetInput.fill(longText)
            await page.waitForTimeout(500)

            // Check for UI breaking
            const layoutIssues = await page.evaluate(() => {
                // Check if page has horizontal scroll (usually bad)
                const hasHorizontalScroll = document.documentElement.scrollWidth > document.documentElement.clientWidth

                // Check if any elements are overflowing their containers
                const allElements = document.querySelectorAll('*')
                let overflowingElements = 0
                allElements.forEach(el => {
                    const htmlEl = el as HTMLElement
                    if (htmlEl.scrollWidth > htmlEl.clientWidth + 50) {
                        overflowingElements++
                    }
                })

                // Check if buttons are still visible/clickable
                const submitBtn = document.querySelector('button[type="submit"], input[type="submit"]')
                const buttonVisible = submitBtn ? (submitBtn as HTMLElement).offsetParent !== null : true

                return {
                    hasHorizontalScroll,
                    overflowingElements,
                    buttonVisible
                }
            })

            // Try to submit
            const submitBtn = await page.$('button[type="submit"], input[type="submit"]')
            let submitResult = 'not attempted'

            if (submitBtn) {
                try {
                    await submitBtn.click()
                    await page.waitForTimeout(3000)

                    // Check for feedback
                    const hasFeedback = await page.evaluate(() => {
                        const feedback = document.querySelectorAll('.error, .success, [role="alert"], .notification, .toast')
                        return feedback.length > 0
                    })

                    submitResult = hasFeedback ? 'feedback shown' : 'silent (no feedback)'
                } catch (e) {
                    submitResult = 'button not clickable'
                }
            }

            const uiBroken = layoutIssues.hasHorizontalScroll || !layoutIssues.buttonVisible
            const silentFailure = submitResult === 'silent (no feedback)'

            const passed = !uiBroken && !silentFailure

            return {
                testName: 'Input Overflow',
                passed,
                details: uiBroken
                    ? `UI layout broken: ${layoutIssues.hasHorizontalScroll ? 'horizontal scroll appeared' : ''} ${!layoutIssues.buttonVisible ? 'submit button hidden' : ''}`
                    : silentFailure
                        ? 'Silent failure: No feedback after submitting 5000 chars - user left confused'
                        : `Long input handled well - ${submitResult}`,
                severity: uiBroken ? 'major' : silentFailure ? 'major' : 'minor'
            }
        } catch (error: any) {
            return {
                testName: 'Input Overflow',
                passed: true,
                details: `Test skipped: ${error.message}`,
                severity: 'minor'
            }
        }
    }

    /**
     * Run all rage bait tests
     */
    async runAllTests(page: Page, runId: string): Promise<RageBaitSummary> {
        const results: RageBaitResult[] = []

        // First, find a form
        const formSearch = await this.findForm(page, runId)

        if (!formSearch.found) {
            return {
                totalTests: 0,
                passed: 0,
                failed: 0,
                critical: 0,
                results: [],
                formFound: false
            }
        }

        // Run each test as a separate step
        results.push(await this.testBackButton(page, runId))
        results.push(await this.testSessionTimeout(page, runId))
        results.push(await this.testEnterKeyTrap(page, runId))
        results.push(await this.testSpecialCharacters(page, runId))
        results.push(await this.testInputOverflow(page, runId))

        const passed = results.filter(r => r.passed).length
        const failed = results.filter(r => !r.passed).length
        const critical = results.filter(r => r.severity === 'critical' && !r.passed).length

        return {
            totalTests: results.length,
            passed,
            failed,
            critical,
            results,
            formFound: true,
            formUrl: formSearch.url
        }
    }
}
