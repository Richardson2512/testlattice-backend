/**
 * Signup Diagnoser
 * 
 * Analyzes signup/registration testability.
 * Detects registration forms, password rules, terms checkboxes.
 */

import { Page } from 'playwright'
import { IDiagnoser, TestTypeDiagnosis, CapabilityItem } from './IDiagnoser'

export class SignupDiagnoser implements IDiagnoser {
    readonly testType = 'signup'
    readonly steps = [
        'Detecting registration form',
        'Analyzing password strength rules',
        'Finding terms/consent checkboxes',
        'Checking email verification indicators',
        'Identifying CAPTCHA presence'
    ]

    async diagnose(page: Page): Promise<TestTypeDiagnosis> {
        const startTime = Date.now()
        const canTest: CapabilityItem[] = []
        const cannotTest: CapabilityItem[] = []

        try {
            // Check for signup form indicators
            const signupIndicators = await page.$$('[action*="signup"], [action*="register"], form:has(input[name*="password_confirm"]), form:has(input[name*="confirmPassword"])')
            if (signupIndicators.length > 0) {
                canTest.push({
                    name: 'Signup form detected',
                    reason: 'Can test registration flow',
                    elementCount: signupIndicators.length
                })
            }

            // Check for password confirmation field
            const confirmPasswordFields = await page.$$('input[name*="confirm"], input[name*="retype"], input[id*="confirm"], input[placeholder*="confirm"]')
            if (confirmPasswordFields.length > 0) {
                canTest.push({
                    name: 'Password confirmation',
                    reason: 'Can test password matching validation',
                    elementCount: confirmPasswordFields.length
                })
            }

            // Check for terms checkbox
            const termsCheckboxes = await page.$$('input[type="checkbox"][name*="terms"], input[type="checkbox"][name*="agree"], input[type="checkbox"][id*="terms"]')
            if (termsCheckboxes.length > 0) {
                canTest.push({
                    name: 'Terms/consent checkbox',
                    reason: 'Can test terms acceptance requirement',
                    elementCount: termsCheckboxes.length
                })
            }

            // Check for email field
            const emailFields = await page.$$('input[type="email"], input[name*="email"]')
            if (emailFields.length > 0) {
                canTest.push({
                    name: 'Email field',
                    reason: 'Can enter registration email',
                    elementCount: emailFields.length
                })
            }

            // Check for CAPTCHA
            const captchaElements = await page.$$('.g-recaptcha, .h-captcha, [data-sitekey], iframe[src*="recaptcha"], iframe[src*="hcaptcha"]')
            if (captchaElements.length > 0) {
                cannotTest.push({
                    name: 'CAPTCHA on signup',
                    reason: 'Cannot complete signup with CAPTCHA',
                    elementCount: captchaElements.length
                })
            }

            // Check for email verification warning
            const emailVerificationText = await page.evaluate(() => {
                const text = document.body.innerText.toLowerCase()
                return text.includes('verify your email') ||
                    text.includes('confirmation email') ||
                    text.includes('check your inbox')
            })
            if (emailVerificationText) {
                cannotTest.push({
                    name: 'Email verification required',
                    reason: 'Cannot access verification emails automatically'
                })
            }

            // Check for phone verification
            const phoneFields = await page.$$('input[type="tel"], input[name*="phone"], input[id*="phone"]')
            if (phoneFields.length > 0) {
                cannotTest.push({
                    name: 'Phone verification',
                    reason: 'Cannot receive SMS verification codes',
                    elementCount: phoneFields.length
                })
            }

            // Check for password requirements hint
            const passwordHints = await page.$$('[class*="password-hint"], [class*="password-requirement"], [id*="password-rules"]')
            if (passwordHints.length > 0) {
                canTest.push({
                    name: 'Password requirements',
                    reason: 'Can test password validation rules',
                    elementCount: passwordHints.length
                })
            }

        } catch (error: any) {
            // Convert technical errors to user-friendly messages
            cannotTest.push({
                name: 'Signup Analysis Limitation',
                reason: 'Some registration form elements could not be detected due to custom form implementations.'
            })
        }

        // Generate plain English narrative
        const hasCaptcha = cannotTest.some(c => c.name.includes('CAPTCHA'))
        const hasSignupForm = canTest.some(c => c.name.includes('Signup') || c.name.includes('Email'))
        const passed = hasSignupForm && !hasCaptcha

        const narrative = {
            what: `The signup/registration flow is being diagnosed to determine whether new user account creation can be automatically tested.`,
            how: `The system identifies registration form elements, password confirmation fields, terms checkboxes, and checks for verification blockers.`,
            why: `Broken signup flows directly prevent new user acquisition and are critical for business growth.`,
            result: passed
                ? `Passed — Registration form detected with ${canTest.length} testable elements.`
                : hasCaptcha
                    ? `Failed — CAPTCHA present on signup form blocks automated testing.`
                    : `Failed — No signup form detected on this page.`,
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
