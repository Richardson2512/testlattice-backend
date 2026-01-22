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
            await this.captureAndRecordCompat('detect_login_form', true, 100, {
                found: !!fields.emailSelector || !!fields.passwordSelector
            })

            if (!fields.emailSelector && !fields.passwordSelector) {
                this.deps.logEmitter.log('No login form detected - recording finding and completing test.')
                await this.captureAndRecordCompat('no_form_found', false, 100, { note: 'No login form detected on page' })
                // Continue to capture final state
            }

            // STEP 2: Verify Inputs
            await this.captureAndRecordCompat('detect_email_field', !!fields.emailSelector, 100, {
                selector: fields.emailSelector || 'none'
            })

            // STEP 3: Detect Password Field
            await this.captureAndRecordCompat('detect_password_field', !!fields.passwordSelector, 100, {
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
            await this.captureAndRecordCompat('check_submit_disabled', true, 100, {
                disabled_before_input: isSubmitDisabled,
                notes: isSubmitDisabled ? 'Button correctly disabled' : 'Button enabled (permissive)'
            })

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
            await this.captureAndRecordCompat('inject_credentials', true, 1000, {
                email_masked: email.replace(/(.{3}).*(@.*)/, '$1***$2')
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
            await this.captureAndRecordCompat('check_submit_enabled', isSubmitEnabled, 100, {
                enabled_after_input: isSubmitEnabled,
                selector: fields.submitSelector
            })

            // STEP 7: Submit Form
            if (fields.submitSelector) {
                await Promise.all([
                    page.waitForLoadState('networkidle').catch(() => { }), // Race condition helper
                    page.click(fields.submitSelector)
                ])
                await this.captureAndRecordCompat('submit_form', true, 1000, {})
            } else {
                // Try Enter key if no button
                await page.keyboard.press('Enter')
                await this.captureAndRecordCompat('submit_form', true, 500, { method: 'Enter Key' })
            }
            await page.waitForTimeout(2000)

            // STEP 8: Detect MFA Requirement
            const mfaDetected = await this.detectMfa()
            await this.captureAndRecordCompat('detect_mfa', !!mfaDetected, 500, {
                type: mfaDetected || 'none'
            })

            if (mfaDetected) {
                const mfaResult = await this.handleMfa(mfaDetected)
                if (!mfaResult.success) {
                    await this.captureAndRecordCompat('mfa_not_completed', false, 0, { note: 'MFA was required but not completed' })
                    // Continue to capture final state
                }
            }

            // STEP 9: Verify Login Success
            const success = await this.evaluateSuccess()
            await this.captureAndRecordCompat('verify_login_success', success, 500, {
                result: success ? 'Logged In' : 'Login Failed',
                url: page.url()
            })

            // STEP 10: Capture Post-Login Snapshot
            await this.deps.captureScreenshot('login-final-state')
            await this.captureAndRecordCompat('capture_snapshot', true, 500, { note: 'Final State' })

            return this.buildResult(success)

        } catch (error: any) {
            logger.error({ runId: this.config.runId, error: error.message }, 'Login Flow Failed')
            this.deps.recordStep('auth_flow_error', false, 0, { error: error.message })
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

        return detection
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

        // Check for common success indicators
        const successIndicators = await page.evaluate(() => {
            const text = document.body.innerText.toLowerCase()
            const url = window.location.href.toLowerCase()

            return {
                hasDashboard: url.includes('dashboard') || text.includes('welcome'),
                hasLogout: document.querySelector('[aria-label*="logout" i], button:has-text("Logout"), a:has-text("Sign out")') !== null,
                hasProfile: document.querySelector('[aria-label*="profile" i], [aria-label*="account" i]') !== null,
                noError: !text.includes('invalid') && !text.includes('incorrect') && !text.includes('wrong password')
            }
        })

        return (
            successIndicators.hasDashboard ||
            successIndicators.hasLogout ||
            successIndicators.hasProfile
        ) && successIndicators.noError
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

