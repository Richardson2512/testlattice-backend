/**
 * CAPTCHA Detector
 * 
 * Detects presence of CAPTCHA challenges that will block automated testing.
 * Supports: reCAPTCHA v2/v3, hCaptcha, Cloudflare Turnstile, FunCaptcha
 */

import { Page } from 'playwright'
import { CaptchaDetection } from '../types'

const CAPTCHA_SELECTORS = {
    recaptcha: [
        '.g-recaptcha',
        '[data-sitekey]',
        'iframe[src*="recaptcha"]',
        '#g-recaptcha-response',
        '.grecaptcha-badge',
    ],
    hcaptcha: [
        '.h-captcha',
        'iframe[src*="hcaptcha"]',
        '[data-hcaptcha-sitekey]',
    ],
    cloudflare: [
        '.cf-turnstile',
        'iframe[src*="challenges.cloudflare"]',
        '[data-turnstile-sitekey]',
    ],
    funcaptcha: [
        '#FunCaptcha',
        'iframe[src*="funcaptcha"]',
        '[data-pkey]',
    ],
    aws: [
        '#aws-waf-captcha',
        '#aws-waf-verify',
        '[id*="aws-waf"]',
    ],
}

const CAPTCHA_TEXTS = [
    'verify you are human',
    'verify that you are a human',
    'please verify you are a human',
    'i am human',
    "i'm not a robot",
    'complete the security check',
    'security check',
    'solve this puzzle',
]

export async function detectCaptcha(page: Page): Promise<CaptchaDetection> {
    try {
        // Check for each type of CAPTCHA via selectors
        for (const [type, selectors] of Object.entries(CAPTCHA_SELECTORS)) {
            for (const selector of selectors) {
                const element = await page.$(selector)
                if (element) {
                    const isVisible = await element.isVisible().catch(() => false)
                    if (isVisible) {
                        return {
                            detected: true,
                            type: type as CaptchaDetection['type'],
                            selector,
                            location: await page.url(),
                        }
                    }
                }
            }
        }

        // Check for CAPTCHA-related scripts
        const hasCaptchaScript = await page.evaluate(() => {
            const scripts = Array.from(document.querySelectorAll('script[src]'))
            return scripts.some(script => {
                const src = script.getAttribute('src') || ''
                return (
                    src.includes('recaptcha') ||
                    src.includes('hcaptcha') ||
                    src.includes('challenges.cloudflare') ||
                    src.includes('funcaptcha') ||
                    src.includes('captcha') ||
                    src.includes('bot-detection')
                )
            })
        })

        if (hasCaptchaScript) {
            // If script is present, check if we also see suspicious text overlay/modal
            // Sometimes scripts are loaded but not active challenge
            const pageText = await page.evaluate(() => document.body.innerText.toLowerCase())
            const hasSuspiciousText = CAPTCHA_TEXTS.some(text => pageText.includes(text))

            if (hasSuspiciousText) {
                return {
                    detected: true,
                    type: 'unknown',
                    location: await page.url(),
                }
            }
        }

        // Fallback: Text-only check (strong indicator if combined with no inputs or specific layout, but simplified here)
        // We only return true if we are VERY confident, to avoid false positives on blog posts discussing captchas
        const pageText = await page.evaluate(() => {
            // Get text only from visible elements, ideally centered or modal
            // Simplified to body text for now
            return document.body.innerText.toLowerCase()
        })

        // Stricter text check: exact phrases that usually imply a wall
        if (pageText.includes('verify you are human') || pageText.includes('security check')) {
            return {
                detected: true,
                type: 'unknown',
                location: await page.url(),
            }
        }



        return { detected: false }
    } catch (error) {
        console.error('CAPTCHA detection error:', error)
        return { detected: false }
    }
}
