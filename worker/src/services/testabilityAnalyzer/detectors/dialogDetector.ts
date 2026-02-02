/**
 * Native Dialog Detector
 * 
 * Detects presence of native browser dialogs (alert, confirm, prompt)
 * and beforeunload handlers that may interfere with automation.
 */

import { Page } from 'playwright'
import { DialogDetection, PageReadiness } from '../types'

export async function detectNativeDialogs(page: Page): Promise<DialogDetection> {
    try {
        const detection = await page.evaluate(() => {
            // Check if window.alert/confirm/prompt have been overridden
            const originalAlert = window.alert.toString().includes('[native code]')
            const originalConfirm = window.confirm.toString().includes('[native code]')
            const originalPrompt = window.prompt.toString().includes('[native code]')

            // Check for beforeunload handlers
            // @ts-ignore - accessing internal event handlers
            const hasBeforeUnload = typeof (window as any).onbeforeunload === 'function'

            // Look for patterns that suggest dialogs might be triggered
            const scripts = Array.from(document.querySelectorAll('script:not([src])'))
            let hasAlertCalls = false
            let hasConfirmCalls = false
            let hasPromptCalls = false

            for (const script of scripts) {
                const content = script.textContent || ''
                if (/\balert\s*\(/.test(content)) hasAlertCalls = true
                if (/\bconfirm\s*\(/.test(content)) hasConfirmCalls = true
                if (/\bprompt\s*\(/.test(content)) hasPromptCalls = true
            }

            return {
                hasAlertHandlers: !originalAlert || hasAlertCalls,
                hasConfirmHandlers: !originalConfirm || hasConfirmCalls,
                hasPromptHandlers: !originalPrompt || hasPromptCalls,
                hasBeforeUnload,
            }
        })

        return detection
    } catch (error) {
        console.error('Dialog detection error:', error)
        return {
            hasAlertHandlers: false,
            hasConfirmHandlers: false,
            hasPromptHandlers: false,
            hasBeforeUnload: false,
        }
    }
}

export async function checkPageReadiness(page: Page): Promise<PageReadiness> {
    const startTime = Date.now()
    const issues: string[] = []
    const overlaySelectors: string[] = []

    try {
        // Wait for network to be idle
        await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {
            issues.push('Network did not reach idle state within 5s')
        })

        const loadTime = Date.now() - startTime

        // Check for overlays/modals that might block interaction
        const overlays = await page.evaluate(() => {
            const overlayIndicators = [
                // Generic modal/overlay classes
                '.modal',
                '.overlay',
                '.popup',
                '.dialog',
                '[role="dialog"]',
                '[aria-modal="true"]',
                // Cookie consent
                '.cookie-banner',
                '.cookie-consent',
                '.cookies-modal',
                '#cookie-consent',
                '[class*="cookie"]',
                // GDPR
                '.gdpr',
                '[class*="gdpr"]',
                // Newsletter popups
                '.newsletter-popup',
                '.subscribe-modal',
                // Loading overlays
                '.loading-overlay',
                '.spinner-overlay',
                '[class*="loading"]',
            ]

            const found: string[] = []
            for (const selector of overlayIndicators) {
                const elements = Array.from(document.querySelectorAll(selector))
                for (const el of elements) {
                    const style = window.getComputedStyle(el)
                    const isVisible = (
                        style.display !== 'none' &&
                        style.visibility !== 'hidden' &&
                        style.opacity !== '0' &&
                        el.getBoundingClientRect().height > 0
                    )
                    if (isVisible) {
                        found.push(selector)
                        break
                    }
                }
            }
            return found
        })

        overlaySelectors.push(...overlays)

        if (overlays.length > 0) {
            issues.push(`Found ${overlays.length} visible overlay(s): ${overlays.join(', ')}`)
        }

        // Check for loading indicators still visible
        const hasVisibleLoader = await page.evaluate(() => {
            const loaders = document.querySelectorAll(
                '.loading, .spinner, [class*="skeleton"], [class*="shimmer"]'
            )
            return Array.from(loaders).some(el => {
                const style = window.getComputedStyle(el)
                return style.display !== 'none' && style.visibility !== 'hidden'
            })
        })

        if (hasVisibleLoader) {
            issues.push('Page still showing loading indicators')
        }

        return {
            isReady: issues.length === 0,
            issues,
            loadTime,
            hasOverlays: overlaySelectors.length > 0,
            overlaySelectors,
        }
    } catch (error) {
        console.error('Page readiness check error:', error)
        return {
            isReady: false,
            issues: ['Failed to check page readiness: ' + (error as Error).message],
            loadTime: Date.now() - startTime,
            hasOverlays: false,
            overlaySelectors: [],
        }
    }
}
