/**
 * Login Analyzer
 * 
 * Analyzes a page's login capability - what will work, what might be flaky,
 * and what won't work for login testing.
 */

import { Page } from 'playwright'
import { TestTypeCapability, LightweightAccessibilityMap, CapabilityItem } from '../types'

const LOGIN_SELECTORS = {
    email: [
        'input[type="email"]',
        'input[name*="email"]',
        'input[id*="email"]',
        'input[autocomplete="email"]',
        'input[autocomplete="username"]',
        'input[name*="user"]',
        'input[id*="user"]',
    ],
    password: [
        'input[type="password"]',
        'input[name*="password"]',
        'input[id*="password"]',
        'input[autocomplete="current-password"]',
    ],
    submit: [
        'button[type="submit"]',
        'input[type="submit"]',
        'button:has-text("Log in")',
        'button:has-text("Login")',
        'button:has-text("Sign in")',
        'button:has-text("Submit")',
        '[data-testid*="login"]',
        '[data-testid*="submit"]',
    ],
    sso: [
        'button:has-text("Google")',
        'button:has-text("Facebook")',
        'button:has-text("GitHub")',
        'button:has-text("Microsoft")',
        'button:has-text("Apple")',
        'a[href*="oauth"]',
        'a[href*="auth"]',
        '[data-provider]',
    ],
    forgotPassword: [
        'a:has-text("Forgot")',
        'a:has-text("Reset")',
        'a[href*="forgot"]',
        'a[href*="reset"]',
    ],
}

export async function analyzeLoginCapability(
    page: Page,
    accessibilityMap: LightweightAccessibilityMap
): Promise<TestTypeCapability> {
    const testable: CapabilityItem[] = []
    const conditionallyTestable: CapabilityItem[] = []
    const notTestable: CapabilityItem[] = []
    const conditions: string[] = []
    const reasons: string[] = []

    try {
        // Check for email/username input
        for (const selector of LOGIN_SELECTORS.email) {
            const element = await page.$(selector)
            if (element) {
                const isVisible = await element.isVisible().catch(() => false)
                if (isVisible) {
                    testable.push({
                        name: 'Email/Username input',
                        selector,
                        reason: 'Standard input field detected',
                        elementType: 'input',
                    })
                    break
                }
            }
        }

        // Check for password input
        for (const selector of LOGIN_SELECTORS.password) {
            const element = await page.$(selector)
            if (element) {
                const isVisible = await element.isVisible().catch(() => false)
                if (isVisible) {
                    testable.push({
                        name: 'Password input',
                        selector,
                        reason: 'Standard password field detected',
                        elementType: 'input',
                    })
                    break
                }
            }
        }

        // Check for submit button
        for (const selector of LOGIN_SELECTORS.submit) {
            const element = await page.$(selector)
            if (element) {
                const isVisible = await element.isVisible().catch(() => false)
                if (isVisible) {
                    testable.push({
                        name: 'Submit button',
                        selector,
                        reason: 'Standard submit button detected',
                        elementType: 'button',
                    })
                    break
                }
            }
        }

        // Check for SSO buttons (conditionally testable - cross-origin)
        for (const selector of LOGIN_SELECTORS.sso) {
            const element = await page.$(selector)
            if (element) {
                const isVisible = await element.isVisible().catch(() => false)
                if (isVisible) {
                    const text = await element.textContent().catch(() => 'SSO')
                    conditionallyTestable.push({
                        name: `${text?.trim() || 'SSO'} login`,
                        selector,
                        reason: 'SSO involves cross-origin redirects',
                        elementType: 'button',
                    })
                    if (!conditions.includes('SSO flows may redirect to external domains')) {
                        conditions.push('SSO flows may redirect to external domains')
                    }
                }
            }
        }

        // Check for forgot password links
        for (const selector of LOGIN_SELECTORS.forgotPassword) {
            const element = await page.$(selector)
            if (element) {
                const isVisible = await element.isVisible().catch(() => false)
                if (isVisible) {
                    conditionallyTestable.push({
                        name: 'Forgot password link',
                        selector,
                        reason: 'Password reset typically requires email verification',
                        elementType: 'link',
                    })
                    if (!conditions.includes('Password reset requires email access')) {
                        conditions.push('Password reset requires email access')
                    }
                    break
                }
            }
        }

        // Determine confidence based on what we found
        const hasBasicLogin = testable.some(t => t.name.includes('Email')) &&
            testable.some(t => t.name.includes('Password')) &&
            testable.some(t => t.name.includes('Submit'))

        // If no login form found at all, this might not be a login page
        if (testable.length === 0 && conditionallyTestable.length === 0) {
            notTestable.push({
                name: 'Login form',
                reason: 'No login form elements detected on this page',
            })
            reasons.push('This does not appear to be a login page')
        }

        return {
            testType: 'login',
            testable: {
                elements: testable,
                confidence: hasBasicLogin ? 'high' : 'medium',
            },
            conditionallyTestable: {
                elements: conditionallyTestable,
                conditions,
                confidence: conditionallyTestable.length > 0 ? 'medium' : 'low',
            },
            notTestable: {
                elements: notTestable,
                reasons,
            },
        }
    } catch (error) {
        console.error('Login analysis error:', error)
        return {
            testType: 'login',
            testable: { elements: [], confidence: 'medium' },
            conditionallyTestable: { elements: [], conditions: [], confidence: 'low' },
            notTestable: { elements: [], reasons: ['Analysis failed: ' + (error as Error).message] },
        }
    }
}
