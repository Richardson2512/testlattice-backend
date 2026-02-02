/**
 * Cross-Origin Iframe Detector
 * 
 * Detects iframes that cross origin boundaries.
 * Cross-origin iframes cannot be automated and require special handling.
 */

import { Page } from 'playwright'
import { IframeDetection } from '../types'

// Known iframe patterns and their purposes
const IFRAME_PATTERNS = {
    payment: [
        'stripe.com',
        'js.stripe.com',
        'checkout.stripe.com',
        'paypal.com',
        'braintree-api.com',
        'braintreegateway.com',
        'square.com',
        'squareup.com',
        'checkout.razorpay.com',
        'paddle.com',
    ],
    auth: [
        'accounts.google.com',
        'login.microsoftonline.com',
        'github.com/login',
        'auth0.com',
        'okta.com',
        'onelogin.com',
        'facebook.com/plugins',
        'appleid.apple.com',
    ],
    embed: [
        'youtube.com',
        'vimeo.com',
        'twitter.com',
        'facebook.com',
        'instagram.com',
        'linkedin.com',
        'maps.google.com',
    ],
}

export async function detectCrossOriginIframes(page: Page): Promise<IframeDetection[]> {
    try {
        const currentUrl = new URL(await page.url())
        const currentOrigin = currentUrl.origin

        const iframes = await page.evaluate((origin: string) => {
            const frames = document.querySelectorAll('iframe')
            return Array.from(frames).map(iframe => {
                const src = iframe.src || iframe.getAttribute('data-src') || ''
                let iframeDomain = ''
                let isCrossOrigin = false

                try {
                    if (src && src.startsWith('http')) {
                        const iframeUrl = new URL(src)
                        iframeDomain = iframeUrl.origin
                        isCrossOrigin = iframeDomain !== origin
                    }
                } catch {
                    // Invalid URL, might be relative or empty
                }

                // Generate selector for the iframe
                const id = iframe.id ? `#${iframe.id}` : ''
                const name = iframe.name ? `[name="${iframe.name}"]` : ''
                const className = iframe.className ? `.${iframe.className.split(' ')[0]}` : ''
                const selector = `iframe${id || name || className || `[src*="${src.slice(0, 50)}"]`}`

                return {
                    url: src,
                    isCrossOrigin,
                    selector,
                }
            }).filter(f => f.url && f.isCrossOrigin)
        }, currentOrigin)

        // Determine purpose for each iframe
        return iframes.map(iframe => {
            let purpose: IframeDetection['purpose'] = 'unknown'

            for (const [type, patterns] of Object.entries(IFRAME_PATTERNS)) {
                if (patterns.some(pattern => iframe.url.includes(pattern))) {
                    purpose = type as IframeDetection['purpose']
                    break
                }
            }

            return {
                ...iframe,
                purpose,
            }
        })
    } catch (error) {
        console.error('Iframe detection error:', error)
        return []
    }
}
