/**
 * Authentication Flow Analyzer
 * 
 * Provides enhanced analysis for Login Flow and Sign-Up Flow tests.
 * Detects auth methods, UX issues, validation problems, and conversion friction.
 * 
 * Rules:
 * - Detection only, no bypassing of security
 * - No MFA/OTP completion
 * - No SSO provider clicking
 * - Safe rate-limit testing (≤3 attempts)
 */

import { Page } from 'playwright'
import { ExecutionLogEmitter, getExecutionLogEmitter } from './executionLogEmitter'

export interface AuthMethod {
  type: 'email_password' | 'username_password' | 'passwordless' | 'sso' | 'mfa'
  provider?: string // For SSO: 'google', 'github', 'apple', etc.
  selector?: string
  detected: boolean
}

export interface AuthUXIssue {
  type: 'infinite_loading' | 'disabled_submit' | 'page_reload_no_feedback' | 'error_no_highlight' | 'error_disappears_quickly' | 'error_not_associated'
  description: string
  severity: 'high' | 'medium' | 'low'
}

export interface PostLoginValidation {
  authCookiePresent: boolean
  authTokenPresent: boolean
  userUIVisible: boolean
  guestUIRemoved: boolean
  urlTransitioned: boolean
  validationPassed: boolean
  outcome: 'SUCCESS' | 'PARTIAL_SUCCESS' | 'FAILED'
  discrepancies: string[]
}

export interface RateLimitDetection {
  detected: boolean
  message?: string
  captchaAppeared: boolean
  lockoutMessage?: string
}

export interface SignupStep {
  stepNumber: number
  title?: string
  required: boolean
  completed: boolean
}

export interface VerificationHandoff {
  type: 'email' | 'otp' | 'magic_link' | 'sms' | 'none'
  required: boolean
  detected: boolean
  message?: string
}

export interface PasswordPolicy {
  minLength?: number
  maxLength?: number
  requiresUppercase: boolean
  requiresLowercase: boolean
  requiresNumbers: boolean
  requiresSpecialChars: boolean
  strengthMeterPresent: boolean
  inlineValidation: boolean
  submitTimeValidation: boolean
}

export interface PasswordUXIssue {
  type: 'vague_error' | 'no_inline_validation' | 'policy_not_visible' | 'error_resets_form'
  description: string
  severity: 'high' | 'medium' | 'low'
}

export interface ConversionBlocker {
  type: 'captcha_before_submit' | 'captcha_after_submit' | 'excessive_fields' | 'no_inline_validation' | 'error_resets_form'
  description: string
  severity: 'high' | 'medium' | 'low'
}

export interface AuthenticationFlowAnalysis {
  // Auth method detection
  authMethodsDetected: AuthMethod[]
  mfaDetected: boolean
  ssoProviders: string[]
  
  // UX issues
  authUxIssues: AuthUXIssue[]
  
  // Post-login validation
  postLoginValidation?: PostLoginValidation
  
  // Rate limit detection
  rateLimitDetection?: RateLimitDetection
  
  // Signup analysis
  signupStepsDetected?: SignupStep[]
  currentStepIndex?: number
  
  // Verification handoff
  verificationHandoff?: VerificationHandoff
  
  // Password policy
  passwordPolicySummary?: PasswordPolicy
  passwordUxIssues: PasswordUXIssue[]
  
  // Conversion friction
  conversionBlockers: ConversionBlocker[]
}

export class AuthenticationFlowAnalyzer {
  private logEmitter?: ExecutionLogEmitter
  private invalidAttemptCount: number = 0
  private readonly MAX_INVALID_ATTEMPTS = 3

  /**
   * Analyze authentication methods present on the page
   */
  async detectAuthMethods(
    page: Page,
    runId: string,
    stepNumber: number
  ): Promise<{ authMethods: AuthMethod[]; mfaDetected: boolean; ssoProviders: string[] }> {
    this.logEmitter = getExecutionLogEmitter(runId, stepNumber)
    this.logEmitter.log('Starting authentication method detection', {})

    const authMethods: AuthMethod[] = []
    const ssoProviders: string[] = []
    let mfaDetected = false

    try {
      const analysis = await page.evaluate(() => {
        const methods: Array<{ type: string; provider?: string; selector?: string; detected: boolean }> = []
        const sso: string[] = []
        let mfa = false

        // Detect email + password login
        const emailField = document.querySelector('input[type="email"], input[name*="email" i], input[id*="email" i]')
        const passwordField = document.querySelector('input[type="password"]')
        if (emailField && passwordField) {
          methods.push({
            type: 'email_password',
            selector: emailField.id ? `#${emailField.id}` : `input[type="email"]`,
            detected: true,
          })
        }

        // Detect username + password login
        const usernameField = document.querySelector('input[type="text"][name*="user" i], input[type="text"][id*="user" i], input[name*="username" i]')
        if (usernameField && passwordField && !emailField) {
          methods.push({
            type: 'username_password',
            selector: usernameField.id ? `#${usernameField.id}` : `input[name*="user" i]`,
            detected: true,
          })
        }

        // Detect passwordless / magic link
        const magicLinkButton = Array.from(document.querySelectorAll('button, a')).find(el => {
          const text = el.textContent?.toLowerCase() || ''
          return text.includes('magic link') || text.includes('passwordless') || text.includes('email link')
        })
        if (magicLinkButton) {
          methods.push({
            type: 'passwordless',
            selector: magicLinkButton.id ? `#${magicLinkButton.id}` : 'button[data-magic-link]',
            detected: true,
          })
        }

        // Detect SSO providers
        const ssoButtons = Array.from(document.querySelectorAll('button, a')).filter(el => {
          const text = el.textContent?.toLowerCase() || ''
          const ariaLabel = el.getAttribute('aria-label')?.toLowerCase() || ''
          const className = el.className?.toLowerCase() || ''
          
          if (text.includes('google') || ariaLabel.includes('google') || className.includes('google')) {
            sso.push('google')
            return true
          }
          if (text.includes('github') || ariaLabel.includes('github') || className.includes('github')) {
            sso.push('github')
            return true
          }
          if (text.includes('apple') || ariaLabel.includes('apple') || className.includes('apple')) {
            sso.push('apple')
            return true
          }
          if (text.includes('microsoft') || ariaLabel.includes('microsoft') || className.includes('microsoft')) {
            sso.push('microsoft')
            return true
          }
          return false
        })

        if (sso.length > 0) {
          methods.push({
            type: 'sso',
            detected: true,
          })
        }

        // Detect MFA / OTP presence
        const otpField = document.querySelector('input[type="text"][name*="otp" i], input[type="text"][name*="code" i], input[type="text"][name*="mfa" i], input[inputmode="numeric"][maxlength="6"]')
        const mfaChallenge = Array.from(document.querySelectorAll('div, section')).find(el => {
          const text = el.textContent?.toLowerCase() || ''
          return text.includes('verification code') || text.includes('authenticator') || text.includes('two-factor')
        })
        
        if (otpField || mfaChallenge) {
          mfa = true
          methods.push({
            type: 'mfa',
            selector: otpField?.id ? `#${otpField.id}` : 'input[inputmode="numeric"]',
            detected: true,
          })
        }

        return { methods, sso, mfa }
      })

      authMethods.push(...analysis.methods.map(m => ({ ...m, type: m.type as AuthMethod['type'] })))
      ssoProviders.push(...analysis.sso)
      mfaDetected = analysis.mfa

      this.logEmitter.log(`Detected ${authMethods.length} authentication method(s)`, {
        methods: authMethods.map(m => m.type),
        ssoProviders,
        mfaDetected,
      })
    } catch (error: any) {
      this.logEmitter.log(`Error detecting auth methods: ${error.message}`, { error: error.message })
    }

    return { authMethods, mfaDetected, ssoProviders }
  }

  /**
   * Analyze UX issues after invalid credential attempts
   */
  async analyzeAuthUXIssues(
    page: Page,
    runId: string,
    stepNumber: number
  ): Promise<AuthUXIssue[]> {
    this.logEmitter = getExecutionLogEmitter(runId, stepNumber)
    this.logEmitter.log('Analyzing authentication UX issues', {})

    const issues: AuthUXIssue[] = []

    try {
      const analysis = await page.evaluate(() => {
        const foundIssues: Array<{ type: string; description: string; severity: string }> = []

        // Check for infinite loading spinner
        const spinner = document.querySelector('[class*="spinner" i], [class*="loading" i], [aria-busy="true"]')
        if (spinner) {
          foundIssues.push({
            type: 'infinite_loading',
            description: 'Loading spinner present after submit - may indicate infinite loading state',
            severity: 'high',
          })
        }

        // Check for disabled submit button
        const submitButton = document.querySelector('button[type="submit"], input[type="submit"], button:has-text("login" i), button:has-text("sign in" i)')
        if (submitButton && (submitButton as HTMLButtonElement).disabled) {
          foundIssues.push({
            type: 'disabled_submit',
            description: 'Submit button remains disabled after error - user cannot retry',
            severity: 'high',
          })
        }

        // Check for error messages without field highlight
        const errorMessages = Array.from(document.querySelectorAll('[class*="error" i], [role="alert"], .error-message'))
        const inputs = Array.from(document.querySelectorAll('input'))
        const hasErrorHighlight = inputs.some(input => {
          const style = window.getComputedStyle(input)
          return style.borderColor !== 'rgb(0, 0, 0)' || input.classList.toString().includes('error')
        })

        if (errorMessages.length > 0 && !hasErrorHighlight) {
          foundIssues.push({
            type: 'error_no_highlight',
            description: 'Error message present but input fields not highlighted',
            severity: 'medium',
          })
        }

        // Check for error messages not associated with inputs
        const errorNearInput = errorMessages.some(error => {
          const input = inputs.find(inp => {
            const rect1 = inp.getBoundingClientRect()
            const rect2 = (error as HTMLElement).getBoundingClientRect()
            return Math.abs(rect1.top - rect2.top) < 50
          })
          return !!input
        })

        if (errorMessages.length > 0 && !errorNearInput) {
          foundIssues.push({
            type: 'error_not_associated',
            description: 'Error message not positioned near affected input field',
            severity: 'medium',
          })
        }

        return foundIssues
      })

      issues.push(...analysis.map(i => ({
        ...i,
        type: i.type as AuthUXIssue['type'],
        severity: i.severity as AuthUXIssue['severity'],
      })))

      // Check for page reload with no feedback (requires timing check)
      const urlBefore = page.url()
      await page.waitForTimeout(2000)
      const urlAfter = page.url()
      if (urlBefore === urlAfter) {
        // Check if there's any feedback visible
        const hasFeedback = await page.evaluate(() => {
          return !!(
            document.querySelector('[class*="error" i], [role="alert"], [class*="success" i]') ||
            document.querySelector('input:invalid')
          )
        })
        if (!hasFeedback) {
          issues.push({
            type: 'page_reload_no_feedback',
            description: 'Page reloaded after submit but no error or success feedback visible',
            severity: 'high',
          })
        }
      }

      if (issues.length > 0) {
        this.logEmitter.log(`Detected ${issues.length} authentication UX issue(s)`, { issues })
      } else {
        this.logEmitter.log('No authentication UX issues detected', {})
      }
    } catch (error: any) {
      this.logEmitter.log(`Error analyzing auth UX issues: ${error.message}`, { error: error.message })
    }

    return issues
  }

  /**
   * Validate post-login success
   */
  async validatePostLoginSuccess(
    page: Page,
    urlBeforeLogin: string,
    runId: string,
    stepNumber: number
  ): Promise<PostLoginValidation> {
    this.logEmitter = getExecutionLogEmitter(runId, stepNumber)
    this.logEmitter.log('Validating post-login success', {})

    const discrepancies: string[] = []
    let authCookiePresent = false
    let authTokenPresent = false
    let userUIVisible = false
    let guestUIRemoved = false
    let urlTransitioned = false

    try {
      // Check for auth cookie
      const cookies = await page.context().cookies()
      authCookiePresent = cookies.some(c => 
        c.name.toLowerCase().includes('auth') ||
        c.name.toLowerCase().includes('token') ||
        c.name.toLowerCase().includes('session') ||
        c.name.toLowerCase().includes('jwt')
      )

      // Check for auth token in localStorage/sessionStorage
      authTokenPresent = await page.evaluate(() => {
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i)?.toLowerCase() || ''
          if (key.includes('auth') || key.includes('token') || key.includes('session')) {
            return true
          }
        }
        for (let i = 0; i < sessionStorage.length; i++) {
          const key = sessionStorage.key(i)?.toLowerCase() || ''
          if (key.includes('auth') || key.includes('token') || key.includes('session')) {
            return true
          }
        }
        return false
      })

      // Check for user-specific UI
      userUIVisible = await page.evaluate(() => {
        const userIndicators = [
          'button:has-text("logout" i)',
          'button:has-text("sign out" i)',
          '[data-testid*="user-menu" i]',
          '[class*="user-menu" i]',
          '[class*="avatar" i]',
          '[class*="profile" i]',
          'img[alt*="user" i]',
          'img[alt*="avatar" i]',
        ]
        return userIndicators.some(selector => document.querySelector(selector) !== null)
      })

      // Check if guest-only UI is removed
      guestUIRemoved = await page.evaluate(() => {
        const guestIndicators = [
          'button:has-text("login" i)',
          'button:has-text("sign in" i)',
          'a:has-text("login" i)',
          'a:has-text("sign in" i)',
        ]
        return !guestIndicators.some(selector => {
          const el = document.querySelector(selector)
          return el && window.getComputedStyle(el).display !== 'none'
        })
      })

      // Check URL transition
      const currentUrl = page.url()
      urlTransitioned = currentUrl !== urlBeforeLogin && (
        currentUrl.includes('/dashboard') ||
        currentUrl.includes('/home') ||
        currentUrl.includes('/profile') ||
        currentUrl.includes('/account') ||
        !currentUrl.includes('/login') &&
        !currentUrl.includes('/signin')
      )

      // Determine validation outcome
      const validations = [authCookiePresent, authTokenPresent, userUIVisible, guestUIRemoved, urlTransitioned]
      const passedCount = validations.filter(Boolean).length
      const validationPassed = passedCount >= 2

      if (!validationPassed) {
        if (!authCookiePresent && !authTokenPresent) {
          discrepancies.push('No authentication cookie or token found')
        }
        if (!userUIVisible) {
          discrepancies.push('User-specific UI not visible')
        }
        if (!guestUIRemoved) {
          discrepancies.push('Guest-only UI still visible')
        }
        if (!urlTransitioned) {
          discrepancies.push('URL did not transition to authenticated route')
        }
      }

      const outcome = validationPassed ? 'SUCCESS' : (passedCount >= 1 ? 'PARTIAL_SUCCESS' : 'FAILED')

      this.logEmitter.log(`Post-login validation: ${outcome}`, {
        authCookiePresent,
        authTokenPresent,
        userUIVisible,
        guestUIRemoved,
        urlTransitioned,
        passedCount,
        discrepancies,
      })
    } catch (error: any) {
      this.logEmitter.log(`Error validating post-login success: ${error.message}`, { error: error.message })
      return {
        authCookiePresent: false,
        authTokenPresent: false,
        userUIVisible: false,
        guestUIRemoved: false,
        urlTransitioned: false,
        validationPassed: false,
        outcome: 'FAILED',
        discrepancies: [`Validation error: ${error.message}`],
      }
    }

    return {
      authCookiePresent,
      authTokenPresent,
      userUIVisible,
      guestUIRemoved,
      urlTransitioned,
      validationPassed: [authCookiePresent, authTokenPresent, userUIVisible, guestUIRemoved, urlTransitioned].filter(Boolean).length >= 2,
      outcome: [authCookiePresent, authTokenPresent, userUIVisible, guestUIRemoved, urlTransitioned].filter(Boolean).length >= 2
        ? 'SUCCESS'
        : [authCookiePresent, authTokenPresent, userUIVisible, guestUIRemoved, urlTransitioned].filter(Boolean).length >= 1
          ? 'PARTIAL_SUCCESS'
          : 'FAILED',
      discrepancies,
    }
  }

  /**
   * Detect rate limits and lockouts (safe - stops after detection)
   */
  async detectRateLimit(
    page: Page,
    runId: string,
    stepNumber: number
  ): Promise<RateLimitDetection> {
    this.logEmitter = getExecutionLogEmitter(runId, stepNumber)
    
    this.invalidAttemptCount++
    if (this.invalidAttemptCount > this.MAX_INVALID_ATTEMPTS) {
      this.logEmitter.log('Maximum invalid attempts reached, stopping rate limit testing', {
        attempts: this.invalidAttemptCount,
      })
      return { detected: true, captchaAppeared: false }
    }

    this.logEmitter.log('Checking for rate limits and lockouts', { attemptCount: this.invalidAttemptCount })

    try {
      const detection = await page.evaluate(() => {
        const bodyText = document.body.textContent?.toLowerCase() || ''
        const hasLockoutMessage = 
          bodyText.includes('too many attempts') ||
          bodyText.includes('account locked') ||
          bodyText.includes('temporarily locked') ||
          bodyText.includes('rate limit') ||
          bodyText.includes('try again later')

        const captcha = document.querySelector('[class*="captcha" i], [id*="captcha" i], iframe[src*="recaptcha"], iframe[src*="hcaptcha"]')

        return {
          detected: hasLockoutMessage || !!captcha,
          message: hasLockoutMessage ? 'Rate limit or lockout message detected' : undefined,
          captchaAppeared: !!captcha,
          lockoutMessage: hasLockoutMessage ? bodyText.match(/(too many|locked|rate limit|try again)[^.]*/i)?.[0] : undefined,
        }
      })

      if (detection.detected) {
        this.logEmitter.log('Rate limit or lockout detected - stopping further attempts', detection)
      }

      return detection
    } catch (error: any) {
      this.logEmitter.log(`Error detecting rate limit: ${error.message}`, { error: error.message })
      return { detected: false, captchaAppeared: false }
    }
  }

  /**
   * Analyze signup steps and progress
   */
  async analyzeSignupSteps(
    page: Page,
    runId: string,
    stepNumber: number
  ): Promise<{ steps: SignupStep[]; currentStepIndex: number }> {
    this.logEmitter = getExecutionLogEmitter(runId, stepNumber)
    this.logEmitter.log('Analyzing signup steps', {})

    try {
      const analysis = await page.evaluate(() => {
        const steps: Array<{ stepNumber: number; title?: string; required: boolean; completed: boolean }> = []
        
        // Look for step indicators
        const stepIndicators = Array.from(document.querySelectorAll('[class*="step" i], [data-step], [aria-label*="step" i]'))
        const progressBars = Array.from(document.querySelectorAll('[class*="progress" i], [role="progressbar"]'))
        
        stepIndicators.forEach((indicator, idx) => {
          const text = indicator.textContent || ''
          const isActive = indicator.classList.toString().includes('active') || indicator.getAttribute('aria-current') === 'true'
          const isCompleted = indicator.classList.toString().includes('complete') || indicator.classList.toString().includes('done')
          
          steps.push({
            stepNumber: idx + 1,
            title: text.trim() || undefined,
            required: !indicator.classList.toString().includes('optional'),
            completed: isCompleted || (isActive && idx > 0),
          })
        })

        // If no step indicators, check for multi-step form structure
        if (steps.length === 0) {
          const forms = Array.from(document.querySelectorAll('form'))
          const hasMultipleSections = forms.some(form => {
            const sections = form.querySelectorAll('fieldset, [class*="section" i], [class*="step" i]')
            return sections.length > 1
          })
          
          if (hasMultipleSections) {
            steps.push({
              stepNumber: 1,
              required: true,
              completed: false,
            })
          }
        }

        const currentStep = steps.findIndex(s => !s.completed && (s.required || steps.filter(st => !st.completed).length === 1))
        return { steps, currentStepIndex: currentStep >= 0 ? currentStep : 0 }
      })

      this.logEmitter.log(`Detected ${analysis.steps.length} signup step(s)`, {
        steps: analysis.steps,
        currentStepIndex: analysis.currentStepIndex,
      })

      return analysis
    } catch (error: any) {
      this.logEmitter.log(`Error analyzing signup steps: ${error.message}`, { error: error.message })
      return { steps: [], currentStepIndex: 0 }
    }
  }

  /**
   * Detect verification handoff requirements
   */
  async detectVerificationHandoff(
    page: Page,
    runId: string,
    stepNumber: number
  ): Promise<VerificationHandoff> {
    this.logEmitter = getExecutionLogEmitter(runId, stepNumber)
    this.logEmitter.log('Detecting verification handoff requirements', {})

    try {
      const detection = await page.evaluate(() => {
        const bodyText = document.body.textContent?.toLowerCase() || ''
        
        // Check for "check your email" screens
        const emailVerification = 
          bodyText.includes('check your email') ||
          bodyText.includes('verify your email') ||
          bodyText.includes('confirmation email')

        // Check for OTP input fields
        const otpField = document.querySelector('input[type="text"][name*="otp" i], input[type="text"][name*="code" i], input[inputmode="numeric"][maxlength="6"]')

        // Check for magic link instructions
        const magicLink = 
          bodyText.includes('magic link') ||
          bodyText.includes('email link') ||
          bodyText.includes('click the link')

        // Check for SMS verification
        const smsVerification = 
          bodyText.includes('sms') ||
          bodyText.includes('text message') ||
          bodyText.includes('phone verification')

        let type: 'email' | 'otp' | 'magic_link' | 'sms' | 'none' = 'none'
        if (emailVerification || magicLink) {
          type = magicLink ? 'magic_link' : 'email'
        } else if (otpField) {
          type = 'otp'
        } else if (smsVerification) {
          type = 'sms'
        }

        const required = type !== 'none'
        const message = required ? bodyText.match(/(check|verify|confirm|click)[^.]{0,100}/i)?.[0] : undefined

        return { type, required, detected: required, message }
      })

      if (detection.detected) {
        this.logEmitter.log(`Verification handoff detected: ${detection.type}`, detection)
      } else {
        this.logEmitter.log('No verification handoff detected', {})
      }

      return detection
    } catch (error: any) {
      this.logEmitter.log(`Error detecting verification handoff: ${error.message}`, { error: error.message })
      return { type: 'none', required: false, detected: false }
    }
  }

  /**
   * Analyze password policy and UX
   */
  async analyzePasswordPolicy(
    page: Page,
    runId: string,
    stepNumber: number
  ): Promise<{ policy: PasswordPolicy; issues: PasswordUXIssue[] }> {
    this.logEmitter = getExecutionLogEmitter(runId, stepNumber)
    this.logEmitter.log('Analyzing password policy and UX', {})

    try {
      const analysis = await page.evaluate(() => {
        const passwordField = document.querySelector('input[type="password"]') as HTMLInputElement
        if (!passwordField) {
          return { policy: null, issues: [] }
        }

        const policy: any = {
          requiresUppercase: false,
          requiresLowercase: false,
          requiresNumbers: false,
          requiresSpecialChars: false,
          strengthMeterPresent: false,
          inlineValidation: false,
          submitTimeValidation: false,
        }

        const issues: Array<{ type: string; description: string; severity: string }> = []

        // Check min/max length
        if (passwordField.minLength) {
          policy.minLength = passwordField.minLength
        }
        if (passwordField.maxLength) {
          policy.maxLength = passwordField.maxLength
        }

        // Check for pattern attribute
        const pattern = passwordField.pattern
        if (pattern) {
          policy.requiresUppercase = /[A-Z]/.test(pattern)
          policy.requiresLowercase = /[a-z]/.test(pattern)
          policy.requiresNumbers = /\d/.test(pattern)
          policy.requiresSpecialChars = /[^A-Za-z0-9]/.test(pattern)
        }

        // Check for password policy hints (case-insensitive matching)
        const allElements = Array.from(document.querySelectorAll('[class]'))
        const hints = allElements.filter(el => {
          const className = el.className?.toLowerCase() || ''
          return className.includes('password') || className.includes('policy') || className.includes('requirement')
        })
        const hintText = hints.map(h => h.textContent?.toLowerCase() || '').join(' ')
        
        if (hintText.includes('uppercase') || hintText.includes('capital')) {
          policy.requiresUppercase = true
        }
        if (hintText.includes('lowercase') || hintText.includes('small')) {
          policy.requiresLowercase = true
        }
        if (hintText.includes('number') || hintText.includes('digit')) {
          policy.requiresNumbers = true
        }
        if (hintText.includes('special') || hintText.includes('symbol') || hintText.includes('character')) {
          policy.requiresSpecialChars = true
        }

        // Check for strength meter
        policy.strengthMeterPresent = !!document.querySelector('[class*="strength" i], [class*="meter" i], [role="progressbar"][aria-label*="password" i]')

        // Check for inline validation
        policy.inlineValidation = passwordField.hasAttribute('oninput') || 
          passwordField.hasAttribute('onchange') ||
          !!passwordField.closest('form')?.querySelector('[class*="validation" i]')

        // Check for vague error messages
        const errorMessages = Array.from(document.querySelectorAll('[class*="error" i], [role="alert"]'))
        const hasVagueError = errorMessages.some(err => {
          const text = err.textContent?.toLowerCase() || ''
          return text.includes('invalid') && !text.includes('must') && !text.includes('should')
        })

        if (hasVagueError) {
          issues.push({
            type: 'vague_error',
            description: 'Password error message is vague and not actionable',
            severity: 'high',
          })
        }

        // Check if policy is not visible
        if (!hints.length && !policy.strengthMeterPresent) {
          issues.push({
            type: 'policy_not_visible',
            description: 'Password policy requirements not visible to user',
            severity: 'medium',
          })
        }

        // Check for no inline validation
        if (!policy.inlineValidation) {
          issues.push({
            type: 'no_inline_validation',
            description: 'No inline password validation - user only learns requirements on submit',
            severity: 'medium',
          })
        }

        return { policy, issues }
      })

      const passwordUxIssues: PasswordUXIssue[] = analysis.issues.map(i => ({
        ...i,
        type: i.type as PasswordUXIssue['type'],
        severity: i.severity as PasswordUXIssue['severity'],
      }))

      this.logEmitter.log('Password policy analysis complete', {
        policy: analysis.policy,
        issuesCount: passwordUxIssues.length,
      })

      return {
        policy: analysis.policy || {
          requiresUppercase: false,
          requiresLowercase: false,
          requiresNumbers: false,
          requiresSpecialChars: false,
          strengthMeterPresent: false,
          inlineValidation: false,
          submitTimeValidation: true,
        },
        issues: passwordUxIssues,
      }
    } catch (error: any) {
      this.logEmitter.log(`Error analyzing password policy: ${error.message}`, { error: error.message })
      return {
        policy: {
          requiresUppercase: false,
          requiresLowercase: false,
          requiresNumbers: false,
          requiresSpecialChars: false,
          strengthMeterPresent: false,
          inlineValidation: false,
          submitTimeValidation: true,
        },
        issues: [],
      }
    }
  }

  /**
   * Detect conversion friction signals
   */
  async detectConversionBlockers(
    page: Page,
    runId: string,
    stepNumber: number
  ): Promise<ConversionBlocker[]> {
    this.logEmitter = getExecutionLogEmitter(runId, stepNumber)
    this.logEmitter.log('Detecting conversion friction signals', {})

    const blockers: ConversionBlocker[] = []

    try {
      const detection = await page.evaluate(() => {
        const blockers: Array<{ type: string; description: string; severity: string }> = []

        // Check for CAPTCHA before submit
        const captchaBefore = document.querySelector('[class*="captcha" i], [id*="captcha" i], iframe[src*="recaptcha"], iframe[src*="hcaptcha"]')
        if (captchaBefore) {
          blockers.push({
            type: 'captcha_before_submit',
            description: 'CAPTCHA present before form submission - may reduce conversion',
            severity: 'medium',
          })
        }

        // Check for excessive required fields
        const requiredFields = Array.from(document.querySelectorAll('input[required], select[required], textarea[required]'))
        if (requiredFields.length > 8) {
          blockers.push({
            type: 'excessive_fields',
            description: `Too many required fields (${requiredFields.length}) - may reduce conversion`,
            severity: 'high',
          })
        }

        // Check for no inline validation
        const form = document.querySelector('form')
        if (form) {
          const hasInlineValidation = Array.from(form.querySelectorAll('input')).some(input => {
            return input.hasAttribute('oninput') || input.hasAttribute('onchange')
          })
          if (!hasInlineValidation) {
            blockers.push({
              type: 'no_inline_validation',
              description: 'No inline validation - users only learn errors on submit',
              severity: 'medium',
            })
          }
        }

        return blockers
      })

      blockers.push(...detection.map(b => ({
        ...b,
        type: b.type as ConversionBlocker['type'],
        severity: b.severity as ConversionBlocker['severity'],
      })))

      // Check for CAPTCHA after submit (requires form state tracking)
      // This would need to be called after a submit attempt

      // Check for error resets entire form (requires form state tracking)
      // This would need to be called after a submit attempt with errors

      if (blockers.length > 0) {
        this.logEmitter.log(`Detected ${blockers.length} conversion blocker(s)`, { blockers })
      } else {
        this.logEmitter.log('No conversion blockers detected', {})
      }
    } catch (error: any) {
      this.logEmitter.log(`Error detecting conversion blockers: ${error.message}`, { error: error.message })
    }

    return blockers
  }

  /**
   * Reset analyzer state for new test run
   */
  reset(): void {
    this.invalidAttemptCount = 0
  }
}

