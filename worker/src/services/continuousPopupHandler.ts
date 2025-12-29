import { Page } from 'playwright'
import { getExecutionLogEmitter, ExecutionLogEmitter } from './executionLogEmitter'
import { getCookieStatus } from './cookieStatusTracker'

export interface ContinuousPopupResult {
    popupsDetected: number
    popupsDismissed: number
    errors: string[]
}

/**
 * Continuous Popup Handler
 * 
 * This service handles popups that appear DURING test execution (post-preflight).
 * It runs before each action to ensure the UI is not blocked.
 */
export class ContinuousPopupHandler {
    private logEmitter?: ExecutionLogEmitter

    /**
     * Check for and dismiss blocking popups
     */
    async checkAndDismissPopups(
        page: Page,
        currentUrl: string,
        runId: string,
        stepNumber: number
    ): Promise<ContinuousPopupResult> {
        this.logEmitter = getExecutionLogEmitter(runId, stepNumber)

        // INVARIANT: Only run if cookie handling is completed
        const cookieStatus = getCookieStatus(runId)
        if (cookieStatus !== 'COMPLETED') {
            return { popupsDetected: 0, popupsDismissed: 0, errors: [] }
        }

        const errors: string[] = []
        let popupsDismissed = 0

        try {
            // 1. Detect blocking popups
            const blockingPopups = await this.detectBlockingPopups(page)

            if (blockingPopups.length === 0) {
                return { popupsDetected: 0, popupsDismissed: 0, errors: [] }
            }

            this.logEmitter.log(`[ContinuousPopup] Detected ${blockingPopups.length} blocking popup(s)`, {
                url: currentUrl,
                popups: blockingPopups
            })

            // 2. Attempt dismissal for each detected popup
            for (const selector of blockingPopups) {
                try {
                    const dismissed = await this.tryDismissPopup(page, selector)
                    if (dismissed) {
                        popupsDismissed++
                        this.logEmitter.log(`[ContinuousPopup] Successfully dismissed popup: ${selector}`)
                    } else {
                        this.logEmitter.log(`[ContinuousPopup] Could not dismiss popup: ${selector}`)
                    }
                } catch (dismissError: any) {
                    const msg = `Failed to dismiss popup ${selector}: ${dismissError.message}`
                    errors.push(msg)
                    this.logEmitter.log(`[ContinuousPopup] ${msg}`)
                }
            }

            // Wait a bit if anything was dismissed to allow UI to settle
            if (popupsDismissed > 0) {
                await new Promise(resolve => setTimeout(resolve, 500))
            }

            return {
                popupsDetected: blockingPopups.length,
                popupsDismissed,
                errors
            }
        } catch (error: any) {
            const msg = `Error in continuous popup handling: ${error.message}`
            errors.push(msg)
            this.logEmitter.log(`[ContinuousPopup] ${msg}`)
            return {
                popupsDetected: 0,
                popupsDismissed: 0,
                errors
            }
        }
    }

    /**
     * Detect currently visible blocking popups
     */
    private async detectBlockingPopups(page: Page): Promise<string[]> {
        const popupSelectors = [
            '[role="dialog"]',
            '[aria-modal="true"]',
            '.modal',
            '.modal-backdrop',
            '.ReactModal__Overlay',
            '.chakra-modal__overlay',
            '.joyride-overlay',
            '.introjs-overlay',
            // Common ad/promo patterns that might be blocking
            '[id*="newsletter" i]',
            '[class*="newsletter" i]',
            '[id*="promo" i]',
            '[class*="promo" i]',
            '[id*="popup" i]',
            '[class*="popup" i]',
            '[id*="overlay" i]',
            '[class*="overlay" i]',
        ]

        const detected: string[] = []

        for (const selector of popupSelectors) {
            try {
                const locator = page.locator(selector).first()
                const isVisible = await locator.isVisible().catch(() => false)

                if (isVisible) {
                    // Verify it's not a cookie banner (should have been handled)
                    const text = await locator.textContent().catch(() => '')
                    const normalizedText = (text || '').toLowerCase()
                    const isCookie = normalizedText.includes('cookie') || normalizedText.includes('consent') || normalizedText.includes('gdpr')

                    if (!isCookie) {
                        detected.push(selector)
                    }
                }
            } catch {
                // Continue
            }
        }

        return detected
    }

    /**
     * Try multiple strategies to dismiss a popup
     */
    private async tryDismissPopup(page: Page, popupSelector: string): Promise<boolean> {
        try {
            // Strategy 1: Escape Key
            await page.keyboard.press('Escape')
            await new Promise(resolve => setTimeout(resolve, 300))
            if (!(await page.locator(popupSelector).isVisible().catch(() => false))) {
                return true
            }

            // Strategy 2: Common Close Buttons within the popup
            const closeButtons = [
                '[aria-label*="close" i]',
                '[aria-label*="dismiss" i]',
                'button:has-text("Close")',
                'button:has-text("×")',
                'button:has-text("X")',
                '.close-button',
                '.modal-close',
                '.btn-close',
                'button.close',
            ]

            for (const btnSelector of closeButtons) {
                try {
                    const btn = page.locator(`${popupSelector} ${btnSelector}`).first()
                    if (await btn.isVisible().catch(() => false)) {
                        await btn.click({ timeout: 1000 })
                        await new Promise(resolve => setTimeout(resolve, 300))
                        if (!(await page.locator(popupSelector).isVisible().catch(() => false))) {
                            return true
                        }
                    }
                } catch {
                    // Next button
                }
            }

            // Strategy 3: Click Backdrop (at 10,10)
            try {
                const backdrops = ['.modal-backdrop', '.modal-overlay', '.overlay', '[class*="backdrop"]', '[class*="overlay"]']
                for (const b of backdrops) {
                    const backdrop = page.locator(b).first()
                    if (await backdrop.isVisible().catch(() => false)) {
                        await backdrop.click({ position: { x: 10, y: 10 }, timeout: 1000 })
                        await new Promise(resolve => setTimeout(resolve, 300))
                        if (!(await page.locator(popupSelector).isVisible().catch(() => false))) {
                            return true
                        }
                    }
                }
            } catch {
                // Fail over
            }

            return false
        } catch {
            return false
        }
    }
}
