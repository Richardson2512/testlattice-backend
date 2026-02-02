/**
 * MFA/OTP Detector
 * 
 * Detects presence of multi-factor authentication or OTP inputs
 * that may require manual intervention or special handling.
 */

import { Page } from 'playwright'
import { MFADetection } from '../types'

const MFA_INDICATORS = {
    otp: [
        'input[name*="otp"]',
        'input[name*="code"]',
        'input[name*="token"]',
        'input[name*="verification"]',
        'input[autocomplete="one-time-code"]',
        'input[inputmode="numeric"][maxlength="6"]',
        'input[inputmode="numeric"][maxlength="4"]',
        '.otp-input',
        '[data-testid*="otp"]',
        '[data-testid*="code"]',
    ],
    text: [
        'verify your',
        'verification code',
        'enter the code',
        'enter code',
        'sent to your',
        'check your email',
        'check your phone',
        '2-factor',
        'two-factor',
        '2fa',
        'authenticator app',
        'security code',
    ],
    actions: [
        'button:has-text("Resend Code")',
        'button:has-text("Send SMS")',
        'a:has-text("Resend Code")',
        'a:has-text("Send SMS")',
    ]
}

export async function detectMFA(page: Page): Promise<MFADetection> {
    const indicators: string[] = []

    try {
        // Check for OTP input fields (MUST BE VISIBLE)
        for (const selector of MFA_INDICATORS.otp) {
            const elements = await page.$$(selector)
            for (const element of elements) {
                if (await element.isVisible().catch(() => false)) {
                    indicators.push(`Found visible OTP input: ${selector}`)
                    break // One is enough
                }
            }
        }

        // Check for MFA actions (Strong indicator)
        for (const selector of (MFA_INDICATORS as any).actions || []) {
            const element = await page.$(selector)
            if (element && await element.isVisible().catch(() => false)) {
                indicators.push(`Found MFA action: ${selector}`)
            }
        }

        // Check for MFA-related text content
        const pageText = await page.evaluate(() => {
            return document.body?.innerText?.toLowerCase() || ''
        })

        for (const text of MFA_INDICATORS.text) {
            // Basic text match (can be improved with context, but keeping it simple)
            if (pageText.includes(text.toLowerCase())) {
                indicators.push(`Found MFA text: "${text}"`)
            }
        }

        // Check for authenticator app QR codes
        const hasQRCode = await page.evaluate(() => {
            const images = document.querySelectorAll('img, canvas, svg')
            return Array.from(images).some(el => {
                const alt = el.getAttribute('alt')?.toLowerCase() || ''
                const src = el.getAttribute('src')?.toLowerCase() || ''
                // className can be SVGAnimatedString for SVG elements, so safely extract string
                const classAttr = el.getAttribute('class') || ''
                const className = classAttr.toLowerCase()
                return (
                    alt.includes('qr') ||
                    src.includes('qr') ||
                    className.includes('qr') ||
                    alt.includes('authenticator') ||
                    src.includes('totp')
                )
            })
        })

        if (hasQRCode) {
            indicators.push('Found possible authenticator QR code')
        }

        // Determine MFA type based on indicators
        let type: MFADetection['type'] = undefined
        if (indicators.length > 0) {
            if (indicators.some(i => i.includes('email'))) {
                type = 'email'
            } else if (indicators.some(i => i.includes('phone') || i.includes('sms'))) {
                type = 'sms'
            } else if (indicators.some(i => i.includes('authenticator') || i.includes('QR'))) {
                type = 'authenticator'
            } else if (indicators.some(i => i.includes('OTP') || i.includes('code'))) {
                type = 'otp'
            } else {
                type = 'unknown'
            }
        }

        return {
            detected: indicators.length > 0,
            type,
            indicators,
        }
    } catch (error) {
        console.error('MFA detection error:', error)
        return {
            detected: false,
            indicators: [],
        }
    }
}
