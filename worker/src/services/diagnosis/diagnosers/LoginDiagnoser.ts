/**
 * Login Diagnoser
 * 
 * Analyzes login/logout testability.
 * Detects password fields, login forms, MFA/CAPTCHA blockers.
 */

import { Page } from 'playwright'
import { IDiagnoser, TestTypeDiagnosis, CapabilityItem } from './IDiagnoser'

export class LoginDiagnoser implements IDiagnoser {
    readonly testType = 'login'
    readonly steps = [
        'Detecting password input fields',
        'Identifying login form',
        'Checking for MFA/CAPTCHA blockers',
        'Finding logout/session elements'
    ]

    async diagnose(page: Page): Promise<TestTypeDiagnosis> {
        const startTime = Date.now()
        const canTest: CapabilityItem[] = []
        const cannotTest: CapabilityItem[] = []

        try {
            // Check for password fields
            const passwordFields = await page.$$('input[type="password"]')
            if (passwordFields.length > 0) {
                canTest.push({
                    name: 'Password fields',
                    reason: 'Can test login with credentials',
                    elementCount: passwordFields.length
                })
            } else {
                cannotTest.push({
                    name: 'No password field',
                    reason: 'No login form detected on this page'
                })
            }

            // Check for email/username fields
            const usernameFields = await page.$$('input[type="email"], input[name*="email"], input[name*="user"], input[id*="email"], input[id*="user"]')
            if (usernameFields.length > 0) {
                canTest.push({
                    name: 'Username/Email fields',
                    reason: 'Can enter login credentials',
                    elementCount: usernameFields.length
                })
            }

            // Check for submit button
            const submitButtons = await page.$$('button[type="submit"], input[type="submit"], button:has-text("Log in"), button:has-text("Sign in")')
            if (submitButtons.length > 0) {
                canTest.push({
                    name: 'Login submit button',
                    reason: 'Can trigger form submission',
                    elementCount: submitButtons.length
                })
            }

            // Check for CAPTCHA (blocker)
            const captchaSelectors = [
                '.g-recaptcha',
                '.h-captcha',
                '[data-sitekey]',
                'iframe[src*="recaptcha"]',
                'iframe[src*="hcaptcha"]',
                '#cf-turnstile'
            ]
            for (const selector of captchaSelectors) {
                const captcha = await page.$(selector)
                if (captcha) {
                    cannotTest.push({
                        name: 'CAPTCHA detected',
                        selector,
                        reason: 'Cannot automate CAPTCHA verification'
                    })
                    break
                }
            }

            // Check for MFA indicators
            const mfaIndicators = await page.evaluate(() => {
                const pageText = document.body.innerText.toLowerCase()
                return {
                    hasMFA: pageText.includes('two-factor') ||
                        pageText.includes('2fa') ||
                        pageText.includes('verification code'),
                    hasOTP: pageText.includes('one-time password') ||
                        pageText.includes('otp')
                }
            })

            if (mfaIndicators.hasMFA || mfaIndicators.hasOTP) {
                cannotTest.push({
                    name: 'MFA/OTP detected',
                    reason: 'Two-factor authentication requires manual intervention'
                })
            }

            // Check for logout button
            const logoutButtons = await page.$$('a:has-text("Log out"), a:has-text("Sign out"), button:has-text("Log out"), button:has-text("Sign out"), [href*="logout"], [href*="signout"]')
            if (logoutButtons.length > 0) {
                canTest.push({
                    name: 'Logout elements',
                    reason: 'Can test logout functionality',
                    elementCount: logoutButtons.length
                })
            }

            // Check for OAuth buttons (external auth)
            const oauthButtons = await page.$$('button:has-text("Google"), button:has-text("Facebook"), button:has-text("GitHub"), [href*="oauth"]')
            if (oauthButtons.length > 0) {
                cannotTest.push({
                    name: 'OAuth/Social login',
                    reason: 'Third-party authentication cannot be automated',
                    elementCount: oauthButtons.length
                })
            }

        } catch (error: any) {
            // Convert technical errors to user-friendly messages
            cannotTest.push({
                name: 'Login Analysis Limitation',
                reason: 'Some login form elements could not be detected due to custom authentication implementations.'
            })
        }

        // Generate plain English narrative
        const hasCaptchaOrMFA = cannotTest.some(c => c.name.includes('CAPTCHA') || c.name.includes('MFA'))
        const hasLoginForm = canTest.some(c => c.name.includes('Password') || c.name.includes('Username'))
        const passed = hasLoginForm && !hasCaptchaOrMFA

        const narrative = {
            what: `The login functionality is being diagnosed to determine whether automated authentication testing is possible on this page.`,
            how: `The system identifies login form elements including username/email fields, password inputs, and submit buttons, while checking for authentication blockers.`,
            why: `Login failures directly block user access and are a common cause of churn and abandoned sessions.`,
            result: passed
                ? `Passed — Login form detected with ${canTest.length} testable elements and no blocking CAPTCHA or MFA.`
                : hasCaptchaOrMFA
                    ? `Failed — ${cannotTest.filter(c => c.name.includes('CAPTCHA') || c.name.includes('MFA')).map(c => c.name).join(' and ')} blocks automated login testing.`
                    : `Failed — No login form detected on this page.`,
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
