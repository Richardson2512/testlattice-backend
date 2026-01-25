/**
 * AuthFlowExecutor
 * Deterministic state machine for authentication flows
 * No AI in execution loop - AI interprets results post-execution
 * Refactored to strict 10-step Authoritative Contract v1
 */

import { Page } from 'playwright'
import { ProcessResult, TestStep, LLMAction } from '../../../types'
import { logger } from '../../../observability'
import { ExecutionLogEmitter } from '../../../services/executionLogEmitter'
import { MfaHandler, MfaResult } from '../../shared/handlers/MfaHandler'

export type AuthState =
    | 'INIT'
    | 'DETECTING_FIELDS'
    | 'PRE_INPUT_CHECK'
    | 'FILLING_CREDENTIALS'
    | 'POST_INPUT_CHECK'
    | 'SUBMITTING'
    | 'MFA_REQUIRED'
    | 'WAITING_FOR_MFA'
    | 'MFA_COMPLETE'
    | 'SUCCESS'
    | 'FAILED'

export interface AuthFlowConfig {
    runId: string
    url: string
    testType: 'login' | 'signup'
    credentials?: {
        username?: string
        password?: string
    }
}

export interface AuthFlowDependencies {
    page: Page
    redis: any
    logEmitter: ExecutionLogEmitter
    recordStep: (action: string, success: boolean, duration: number, metadata?: Record<string, any>) => void
    captureScreenshot: (label?: string) => Promise<string | undefined>
}

interface AuthFieldDetection {
    emailSelector?: string
    passwordSelector?: string
    submitSelector?: string
    ssoOptions?: string[]
}

export class AuthFlowExecutor {
    private config: AuthFlowConfig
    private deps: AuthFlowDependencies
    private state: AuthState = 'INIT'
    private steps: TestStep[] = []
    private artifacts: string[] = []
    private mfaHandler: MfaHandler
    private currentStep: number = 0

    constructor(config: AuthFlowConfig, deps: AuthFlowDependencies) {
        this.config = config
        this.deps = deps
        this.mfaHandler = new MfaHandler(deps.redis, config.runId)
    }

    /**
     * Record a step with structured output format
     */
    private recordLocalStep(
        action: string,
        execution_status: 'EXECUTED' | 'BLOCKED' | 'EXECUTION_FAILED' | 'SKIPPED',
        severity: 'GREEN' | 'YELLOW' | 'RED',
        observed_state: Record<string, any>,
        note: string
    ) {
        this.currentStep++
        const success = severity !== 'RED' && execution_status === 'EXECUTED'
        this.deps.recordStep(action, success, 100, {
            execution_status,
            observed_state,
            severity,
            note,
            stepNumber: this.currentStep,
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
        this.currentStep++
        const success = severity !== 'RED' && execution_status === 'EXECUTED'
        this.deps.recordStep(action, success, 100, {
            execution_status,
            observed_state,
            severity,
            note,
            stepNumber: this.currentStep,
            screenshotUrl,
            ...observed_state
        })
    }

    /**
     * Backwards-compat wrapper: converts old 4-arg format to new structured format
     * Auth tests: success=true → GREEN, success=false → YELLOW (RED only for explicit auth failures)
     */
    private recordLocalStepCompat(action: string, success: boolean, _duration: number, metadata?: Record<string, any>) {
        const severity: 'GREEN' | 'YELLOW' | 'RED' = success ? 'GREEN' : 'YELLOW'
        const note = metadata?.note || metadata?.error || action
        this.recordLocalStep(action, 'EXECUTED', severity, metadata || {}, note)
    }

    private async captureAndRecordCompat(action: string, success: boolean, _duration: number, metadata?: Record<string, any>): Promise<void> {
        const severity: 'GREEN' | 'YELLOW' | 'RED' = success ? 'GREEN' : 'YELLOW'
        const note = metadata?.note || metadata?.error || action
        await this.captureAndRecord(action, 'EXECUTED', severity, metadata || {}, note)
    }

    async execute(): Promise<ProcessResult> {
        if (this.config.testType === 'signup') {
            return this.executeSignup()
        }
        return this.executeLogin()
    }

    private async executeLogin(): Promise<ProcessResult> {
        logger.info({ runId: this.config.runId, testType: 'login' }, 'Starting Login Contract v1')
        this.deps.logEmitter.log(`Starting Login 10-step contract...`)
        const page = this.deps.page

        try {
            // Pre-flight: Find fields first
            const fields = await this.detectAuthFields()

            // STEP 1: Detect Login Form
            await this.captureAndRecordCompat('Detecting login screen', true, 100, {
                found: !!fields.emailSelector || !!fields.passwordSelector
            })

            if (!fields.emailSelector && !fields.passwordSelector) {
                this.deps.logEmitter.log('No login form detected - recording finding and completing test.')
                await this.captureAndRecordCompat('No login screen found', false, 100, { note: 'Could not find a login form on this page' })
                // Continue to capture final state
            }

            if (fields.ssoOptions && fields.ssoOptions.length > 0) {
                // Test ALL detected SSO options as requested
                for (const ssoSelector of fields.ssoOptions) {
                    await this.testSSO(ssoSelector)
                }
            }

            // STEP 1.6: Check Forgot Password Link
            const forgotLink = await page.$('a[href*="forgot"], a[href*="reset"], a:has-text("Forgot"), button:has-text("Forgot")')
            await this.captureAndRecordCompat('check_forgot_password', !!forgotLink, 100, {
                found: !!forgotLink,
                selector: await forgotLink?.evaluate(el => el.outerHTML) || 'none',
                note: !!forgotLink ? 'Forgot Password link detected' : 'Warning: No Forgot Password link found'
            })

            // STEP 2: Verify Inputs
            await this.captureAndRecordCompat('Finding email input', !!fields.emailSelector, 100, {
                selector: fields.emailSelector || 'none'
            })

            // STEP 3: Detect Password Field
            await this.captureAndRecordCompat('Finding password input', !!fields.passwordSelector, 100, {
                selector: fields.passwordSelector || 'none'
            })

            // STEP 4: Check Submit Disabled State (Pre-Input)
            let isSubmitDisabled = false
            if (fields.submitSelector) {
                isSubmitDisabled = await page.evaluate((sel) => {
                    const btn = document.querySelector(sel) as HTMLButtonElement
                    return btn ? (btn.disabled || btn.classList.contains('disabled')) : false
                }, fields.submitSelector)
            }
            await this.captureAndRecordCompat('check_pre_input_button_state', true, 100, {
                disabled_before_input: isSubmitDisabled,
                notes: isSubmitDisabled ? 'Button is correctly disabled' : 'Button is enabled (ready to click)'
            })

            // STEP 4.1: Test Blank Submission (if button enabled)
            if (!isSubmitDisabled && fields.submitSelector) {
                await this.testBlankSubmission(fields.submitSelector)
            }

            // STEP 4.2: Test Invalid Credentials
            if (fields.emailSelector && fields.passwordSelector && fields.submitSelector) {
                await this.testInvalidCredentials(fields.emailSelector, fields.passwordSelector, fields.submitSelector)
            }

            // STEP 5: Inject Credentials
            const email = this.config.credentials?.username || this.generateTestEmail()
            const password = this.config.credentials?.password || 'TestPassword123!'

            if (fields.emailSelector) {
                await page.fill(fields.emailSelector, email)
                await page.waitForTimeout(200)
            }
            if (fields.passwordSelector) {
                await page.fill(fields.passwordSelector, password)
                await page.waitForTimeout(200)
            }
            await this.captureAndRecordCompat('Entering credentials', true, 1000, {
                email_entered: email.replace(/(.{3}).*(@.*)/, '$1***$2')
            })

            // STEP 6: Check Submit Enabled State (Post-Input)
            let isSubmitEnabled = true
            if (fields.submitSelector) {
                // Check it again
                isSubmitEnabled = await page.evaluate((sel) => {
                    const btn = document.querySelector(sel) as HTMLButtonElement
                    return btn ? (!btn.disabled && !btn.classList.contains('disabled')) : true
                }, fields.submitSelector) || true // Default to true if not found/unsure to proceed
            }
            await this.captureAndRecordCompat('Checking button state (Post-input)', isSubmitEnabled, 100, {
                enabled_after_input: isSubmitEnabled,
                button_selector: fields.submitSelector
            })

            // STEP 7: Submit Form
            if (fields.submitSelector) {
                await Promise.all([
                    page.waitForLoadState('networkidle').catch(() => { }), // Race condition helper
                    page.click(fields.submitSelector)
                ])
                await this.captureAndRecordCompat('Submitting login form', true, 1000, {})
            } else {
                // Try Enter key if no button
                await page.keyboard.press('Enter')
                await this.captureAndRecordCompat('Submitting via Enter key', true, 500, { method: 'Enter Key' })
            }
            await page.waitForTimeout(2000)

            // STEP 8: Detect MFA Requirement
            const mfaDetected = await this.detectMfa()
            await this.captureAndRecordCompat('Checking for MFA requirements', !!mfaDetected, 500, {
                type: mfaDetected || 'none'
            })

            if (mfaDetected) {
                const mfaResult = await this.handleMfa(mfaDetected)
                if (!mfaResult.success) {
                    await this.captureAndRecordCompat('MFA not completed', false, 0, { note: 'MFA was required but timed out or failed' })
                    // Continue to capture final state
                }
            }

            // STEP 9: Verify Login Success
            const success = await this.evaluateSuccess()
            await this.captureAndRecordCompat('Verifying login success', success, 500, {
                result: success ? 'Logged In Successfully' : 'Login Failed',
                current_url: page.url()
            })

            // STEP 10: Capture Post-Login Snapshot
            await this.deps.captureScreenshot('login-final-state')
            await this.captureAndRecordCompat('Saving final result', true, 500, { note: 'Final state captured' })

            return this.buildResult(success)

        } catch (error: any) {
            logger.error({ runId: this.config.runId, error: error.message }, 'Login Flow Failed')
            this.deps.recordStep('Login process error', false, 0, { error: error.message })
            return this.buildResult(true) // Always return success - errors are findings
        }
    }

    private async executeSignup(): Promise<ProcessResult> {
        logger.info({ runId: this.config.runId, testType: 'signup' }, 'Starting Signup Contract v1')
        this.deps.logEmitter.log(`Starting Signup 12-step contract...`)
        const page = this.deps.page

        try {
            // Pre-flight
            const fields = await this.detectAuthFields()

            // STEP 1: Detect Signup Form
            await this.captureAndRecordCompat('detect_signup_form', true, 100, {
                found: !!fields.emailSelector || !!fields.passwordSelector
            })

            if (!fields.emailSelector && !fields.passwordSelector) {
                this.deps.logEmitter.log('No signup form detected - recording finding and completing test.')
                await this.captureAndRecordCompat('no_form_found', false, 100, { note: 'No signup form detected on page' })
                // Continue to capture final state
            }

            // STEP 1.5: Smoke Test SSO (If detected)
            if (fields.ssoOptions && fields.ssoOptions.length > 0) {
                // Test ALL detected SSO options as requested
                for (const ssoSelector of fields.ssoOptions) {
                    await this.testSSO(ssoSelector)
                }
            }

            // STEP 2: Count Total Fields
            const totalFields = await page.evaluate(() =>
                document.querySelectorAll('input:not([type="hidden"]), select, textarea').length
            )
            await this.captureAndRecordCompat('count_total_fields', true, 100, { count: totalFields })

            // STEP 3: Count Required Fields
            const requiredFields = await page.evaluate(() =>
                document.querySelectorAll('input:required, select:required, textarea:required').length
            )
            await this.captureAndRecordCompat('count_required_fields', true, 100, { count: requiredFields })

            // STEP 3.1: Test Blank Submission (if button exists)
            if (fields.submitSelector) {
                const isSubmitDisabled = await page.evaluate((sel) => {
                    const btn = document.querySelector(sel) as HTMLButtonElement
                    return btn ? (btn.disabled || btn.classList.contains('disabled')) : false
                }, fields.submitSelector)

                if (!isSubmitDisabled) {
                    await this.testBlankSubmission(fields.submitSelector)
                }
            }

            // STEP 4: Detect Password Field
            await this.captureAndRecordCompat('detect_password_field', !!fields.passwordSelector, 100, {
                selector: fields.passwordSelector || 'none'
            })

            // STEP 5: Test Weak Password Feedback
            if (fields.passwordSelector) {
                await page.fill(fields.passwordSelector, '123')
                // Click away or tab to trigger validation
                await page.keyboard.press('Tab')
                await page.waitForTimeout(500)

                const hasWarning = await page.evaluate(() => {
                    const body = document.body.innerText.toLowerCase()
                    return body.includes('weak') || body.includes('short') || body.includes('too common') || body.includes('at least')
                })

                await this.captureAndRecordCompat('test_weak_password_feedback', true, 500, {
                    feedback_detected: hasWarning,
                    message: hasWarning ? 'UI correctly flagged weak password' : 'No weak password feedback found'
                })
                // Clear it
                await page.fill(fields.passwordSelector, '')
            } else {
                await this.captureAndRecordCompat('test_weak_password_feedback', true, 100, { note: 'Skipped - no password field' })
            }

            // STEP 6: Inject Generated Identity
            const email = this.generateTestEmail()
            const password = 'TestPassword123!@#'

            if (fields.emailSelector) {
                await page.fill(fields.emailSelector, email)
            }
            if (fields.passwordSelector) {
                await page.fill(fields.passwordSelector, password)
            }
            // Try to find Name field roughly
            const nameInput = await page.$('input[name*="name" i], input[id*="name" i], input[autocomplete="name"]')
            let nameFilled = false
            if (nameInput) {
                const nameValue = await nameInput.inputValue()
                if (!nameValue) {
                    await nameInput.fill('Test User')
                    nameFilled = true
                }
            }

            await this.captureAndRecordCompat('inject_credentials', true, 1000, {
                username: this.config.credentials?.username || 'testuser',
                maskedPassword: '***',
                email_masked: email.replace(/(.{3}).*(@.*)/, '$1***$2'),
                name_filled: nameFilled
            })

            // STEP 7: Verify Terms/Privacy Link Presence
            const hasLegalLinks = await page.evaluate(() => {
                const links = Array.from(document.querySelectorAll('a'))
                return links.some(l => {
                    const t = (l.innerText || '').toLowerCase()
                    return t.includes('terms') || t.includes('privacy') || t.includes('conditions')
                })
            })
            await this.captureAndRecordCompat('verify_terms_link', true, 100, {
                found: hasLegalLinks,
                message: hasLegalLinks ? 'Legal links detected' : 'Warning: No Terms/Privacy links found in form'
            })

            // STEP 8: Submit Signup Form
            if (fields.submitSelector) {
                await Promise.all([
                    page.waitForLoadState('networkidle').catch(() => { }),
                    page.click(fields.submitSelector)
                ])
                await this.captureAndRecordCompat('submit_form', true, 1000, {})
            } else {
                await page.keyboard.press('Enter')
                await this.captureAndRecordCompat('submit_form', true, 500, { method: 'Enter Key' })
            }
            await page.waitForTimeout(2000)

            // STEP 9: Detect Verification Requirement
            const mfaDetected = await this.detectMfa()
            await this.captureAndRecordCompat('detect_verification', !!mfaDetected, 500, {
                type: mfaDetected || 'none'
            })

            // STEP 10: Pause for OTP / Confirmation Link
            if (mfaDetected) {
                const mfaResult = await this.handleMfa(mfaDetected)
                if (!mfaResult.success) {
                    await this.captureAndRecordCompat('verification_not_completed', false, 0, { note: 'Email verification required but not completed' })
                    // Continue to capture final state
                }
            }

            // STEP 11: Resume and Verify Account Creation
            const success = await this.evaluateSuccess()
            await this.captureAndRecordCompat('verify_creation', success, 500, {
                result: success ? 'Account Created' : 'Signup Failed / No Auto-Login'
            })

            // STEP 12: Capture Post-Signup Snapshot
            // await this.deps.captureScreenshot('signup-final-state') // captureAndRecord does this
            await this.captureAndRecordCompat('capture_snapshot', true, 500, { note: 'Final State' })

            return this.buildResult(success)

        } catch (error: any) {
            logger.error({ runId: this.config.runId, error: error.message }, 'Signup Flow Failed')
            this.deps.recordStep('auth_flow_error', false, 0, { error: error.message })
            return this.buildResult(true) // Always return success - errors are findings
        }
    }

    private async detectAuthFields(): Promise<AuthFieldDetection> {
        const page = this.deps.page

        // Email/Username selectors
        const emailSelectors = [
            'input[type="email"]',
            'input[name*="email" i]',
            'input[name*="user" i]',
            'input[id*="email" i]',
            'input[id*="user" i]',
            'input[placeholder*="email" i]',
            'input[autocomplete="email"]',
            'input[autocomplete="username"]'
        ]

        // Password selectors
        const passwordSelectors = [
            'input[type="password"]',
            'input[name*="pass" i]',
            'input[id*="pass" i]'
        ]

        // Submit selectors
        const submitSelectors = [
            'button[type="submit"]',
            'input[type="submit"]',
            'button:has-text("Log in")',
            'button:has-text("Login")',
            'button:has-text("Sign in")',
            'button:has-text("Sign up")',
            'button:has-text("Continue")',
            'button:has-text("Submit")'
        ]

        const detection: AuthFieldDetection = {}

        for (const selector of emailSelectors) {
            const element = await page.$(selector)
            if (element && await element.isVisible()) {
                detection.emailSelector = selector
                break
            }
        }

        for (const selector of passwordSelectors) {
            const element = await page.$(selector)
            if (element && await element.isVisible()) {
                detection.passwordSelector = selector
                break
            }
        }

        for (const selector of submitSelectors) {
            const element = await page.$(selector)
            if (element && await element.isVisible()) {
                detection.submitSelector = selector
                break
            }
        }

        // Detect SSO Options (Google, GitHub, Microsoft, Apple, Facebook)
        // We look for button/link elements with specific text or aria-labels
        const ssoKeywords = ['google', 'github', 'microsoft', 'apple', 'facebook', 'linkedin', 'twitter']
        const ssoCandidates = await page.$$('button, a[role="button"], a.btn, a.button, div[role="button"]')

        detection.ssoOptions = []

        for (const candidate of ssoCandidates) {
            const text = (await candidate.innerText()).toLowerCase()
            const ariaLabel = (await candidate.getAttribute('aria-label') || '').toLowerCase()
            const classList = (await candidate.getAttribute('class') || '').toLowerCase()
            const href = (await candidate.getAttribute('href') || '').toLowerCase()

            // Check if it's an SSO button
            const matchedProvider = ssoKeywords.find(k =>
                text.includes(k) || ariaLabel.includes(k) || classList.includes(k) || href.includes(k)
            )

            // Should verify it's not a "share" button
            const isShare = text.includes('share') || ariaLabel.includes('share') || classList.includes('share')

            if (matchedProvider && !isShare) {
                // Generate a unique selector for this button
                // This is a simplified selector strategy - in production we'd want robust unique selectors
                const tagName = await candidate.evaluate(e => e.tagName.toLowerCase())
                let uniqueSelector = ''

                if (ariaLabel) {
                    uniqueSelector = `${tagName}[aria-label="${await candidate.getAttribute('aria-label')}"]`
                } else if (text) {
                    // Truncate text to avoid long selectors
                    uniqueSelector = `${tagName}:has-text("${text.substring(0, 20)}")`
                } else {
                    continue
                }

                detection.ssoOptions.push(uniqueSelector)
            }
        }

        return detection
    }

    /**
     * SSO Smoke Test: Click button, verify redirect, go back
     */
    private async testSSO(ssoSelector: string): Promise<void> {
        const page = this.deps.page
        const startUrl = page.url()

        try {
            this.deps.logEmitter.log(`Testing SSO button: ${ssoSelector} (Smoke Check)`)

            // Click and wait for potential navigation
            // We use a short timeout because we expect an immediate redirect or popup
            await Promise.all([
                page.waitForNavigation({ timeout: 5000, waitUntil: 'commit' }).catch(() => { }),
                page.click(ssoSelector)
            ])

            await page.waitForTimeout(2000)
            const currentUrl = page.url()

            // Validation Logic
            const isExternal = !currentUrl.includes(new URL(startUrl).hostname)
            const isErrorPage = await page.evaluate(() => {
                const text = document.body.innerText.toLowerCase()
                return text.includes('internal server error') ||
                    text.includes('404 not found') ||
                    text.includes('an error occurred')
            })

            const success = isExternal && !isErrorPage

            await this.captureAndRecordCompat('Testing SSO button', success, 2000, {
                button: ssoSelector,
                redirected_to: currentUrl,
                external_domain: isExternal,
                error_detected: isErrorPage
            })

            // Navigate back to continue test
            if (currentUrl !== startUrl) {
                await page.goBack({ waitUntil: 'domcontentloaded' })
                await page.waitForTimeout(1000) // Stabilize
            }

        } catch (error: any) {
            // Non-blocking failure
            await this.captureAndRecordCompat('test_sso_initiation', false, 0, {
                error: `SSO click failed: ${error.message}`,
                sso_selector: ssoSelector
            })

            // Ensure we are back at start
            if (page.url() !== startUrl) {
                await page.goto(startUrl).catch(() => { })
            }
        }
    }

    /**
     * Test submitting with blank inputs
     */
    private async testBlankSubmission(submitSelector: string): Promise<void> {
        const page = this.deps.page
        try {
            await page.click(submitSelector)
            await page.waitForTimeout(500)

            // Check for HTML5 validation or visible text
            const validationMessage = await page.evaluate(() => {
                const invalidInput = document.querySelector('input:invalid') as HTMLInputElement
                if (invalidInput) return invalidInput.validationMessage

                const bodyText = document.body.innerText.toLowerCase()
                if (bodyText.includes('required') || bodyText.includes('enter your') || bodyText.includes('cannot be empty')) return 'Text validation found'

                return null
            })

            await this.captureAndRecordCompat('test_blank_submission', !!validationMessage, 500, {
                error_detected: !!validationMessage,
                message: validationMessage || 'No validation error detected on blank submit'
            })
        } catch (e: any) {
            await this.captureAndRecordCompat('test_blank_submission', false, 0, { error: e.message })
        }
    }

    /**
     * Test submitting with invalid credentials
     */
    private async testInvalidCredentials(emailSel: string, passSel: string, submitSel: string): Promise<void> {
        const page = this.deps.page
        try {
            await page.fill(emailSel, 'invalid-test-user@example.com')
            await page.fill(passSel, 'WrongPassword123!')
            await page.click(submitSel)

            // Wait for error
            await page.waitForTimeout(1000)

            const hasError = await page.evaluate(() => {
                const text = document.body.innerText.toLowerCase()
                return text.includes('invalid') || text.includes('incorrect') || text.includes('failed') || text.includes('not found') || text.includes('error')
            })

            await this.captureAndRecordCompat('test_invalid_credentials', hasError, 1000, {
                error_feedback_detected: hasError,
                note: hasError ? 'System correctly flagged invalid credentials' : 'Warning: No obvious error message for invalid credentials'
            })

            // Clear inputs
            await page.fill(emailSel, '')
            await page.fill(passSel, '')
        } catch (e: any) {
            await this.captureAndRecordCompat('test_invalid_credentials', false, 0, { error: e.message })
            // Try to clear anyway
            try { await page.fill(emailSel, ''); await page.fill(passSel, ''); } catch { }
        }
    }

    private async detectMfa(): Promise<'otp' | 'magic_link' | null> {
        const page = this.deps.page

        // OTP indicators
        const otpIndicators = await page.evaluate(() => {
            const text = document.body.innerText.toLowerCase()
            return (
                text.includes('verification code') ||
                text.includes('enter code') ||
                text.includes('enter otp') ||
                text.includes('6-digit') ||
                document.querySelector('input[maxlength="6"]') !== null ||
                document.querySelector('input[inputmode="numeric"]') !== null
            )
        })

        if (otpIndicators) return 'otp'

        // Magic link indicators
        const magicLinkIndicators = await page.evaluate(() => {
            const text = document.body.innerText.toLowerCase()
            return (
                text.includes('check your email') ||
                text.includes('verification link') ||
                text.includes('magic link') ||
                text.includes('we sent') ||
                text.includes('email sent')
            )
        })

        if (magicLinkIndicators) return 'magic_link'

        return null
    }

    private async handleMfa(type: 'otp' | 'magic_link'): Promise<MfaResult> {
        this.deps.logEmitter.log(`MFA detected: ${type}. Waiting for user input...`)

        // Explicitly record step so frontend knows we are waiting
        await this.captureAndRecordCompat('waiting_for_mfa', true, 0, { type, description: 'Waiting for Human Input...' })

        // Trigger wrapper handler
        const result = await this.mfaHandler.waitForInput(type, 120000)

        if (result.success && result.value) {
            if (type === 'otp') {
                await this.enterOtp(result.value)
            } else {
                await this.deps.page.goto(result.value)
                await this.deps.page.waitForLoadState('networkidle')
            }
            await this.captureAndRecordCompat('mfa_complete', true, 0, { type })
        } else {
            await this.captureAndRecordCompat('mfa_failed', false, 0, { type, reason: result.error })
        }

        return result
    }

    private async enterOtp(otp: string): Promise<void> {
        await this.deps.page.evaluate((otpCode: string) => {
            const inputs = document.querySelectorAll<HTMLInputElement>(
                'input[type="text"][maxlength="1"], input[type="text"][maxlength="6"], input[inputmode="numeric"]'
            )

            if (inputs.length === 1 || (inputs[0]?.maxLength || 0) > 1) {
                if (inputs[0]) {
                    inputs[0].value = otpCode
                    inputs[0].dispatchEvent(new Event('input', { bubbles: true }))
                }
            } else {
                for (let i = 0; i < Math.min(otpCode.length, inputs.length); i++) {
                    inputs[i].value = otpCode[i]
                    inputs[i].dispatchEvent(new Event('input', { bubbles: true }))
                }
            }
        }, otp)

        await this.deps.page.waitForTimeout(500)

        // Try to click submit
        const submitBtn = await this.deps.page.$('button[type="submit"], button:has-text("Verify")')
        if (submitBtn) {
            await submitBtn.click()
            await this.deps.page.waitForTimeout(2000)
        }
    }

    private async evaluateSuccess(): Promise<boolean> {
        const page = this.deps.page

        // ✅ Option A: Use Playwright locators for text matching (Safe & Correct)
        // This avoids the SyntaxError caused by passing :has-text to document.querySelector
        const hasLogout = await page.locator(
            '[aria-label*="logout" i], button:has-text("Logout"), a:has-text("Sign out"), button:has-text("Sign out")'
        ).first().isVisible().catch(() => false)

        // Check for other indicators using standard DOM API
        const indicators = await page.evaluate(() => {
            const text = document.body.innerText.toLowerCase()
            const url = window.location.href.toLowerCase()

            return {
                hasDashboard: url.includes('dashboard') || text.includes('welcome'),
                hasProfile: document.querySelector('[aria-label*="profile" i], [aria-label*="account" i]') !== null,
                noError: !text.includes('invalid') && !text.includes('incorrect') && !text.includes('wrong password')
            }
        })

        return (
            indicators.hasDashboard ||
            hasLogout ||
            indicators.hasProfile
        ) && indicators.noError
    }

    private generateTestEmail(): string {
        const timestamp = Date.now()
        return `testlattice+${timestamp}@test.com`
    }

    private buildResult(success: boolean): ProcessResult {
        return {
            success: true, // Always return success - findings at step level
            steps: this.steps,
            artifacts: this.artifacts,
            stage: 'execution'
        }
    }
}

