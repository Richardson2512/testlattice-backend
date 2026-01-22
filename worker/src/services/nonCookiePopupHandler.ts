/**
 * Non-Cookie Popup Handler - Explicit system for handling non-cookie popups
 * 
 * This system handles popups that are NOT cookie consent banners:
 * - Newsletter modals
 * - Chat widgets
 * - Promotional popups
 * - Other blocking UI elements
 * 
 * RULES:
 * - Runs AFTER cookie handling completes
 * - Runs AT MOST once per page
 * - Does NOT guess or click arbitrarily
 * - Does NOT use page-level fallback
 * - Uses explicit detection only
 * - Logs all actions via ExecutionLogEmitter
 */

import { Page } from 'playwright'
import { getExecutionLogEmitter, ExecutionLogEmitter } from './executionLogEmitter'
import { getCookieStatus } from './cookieStatusTracker'

export type PopupType = 'newsletter' | 'chat' | 'promo' | 'unknown'
export type PopupBlockingStatus = 'NON_BLOCKING_UI' | 'BLOCKING_UI'

export interface DetectedPopup {
  type: PopupType
  selector: string
  blockingStatus: PopupBlockingStatus
  description: string
}

export interface NonCookiePopupResult {
  popupsDetected: DetectedPopup[]
  actionTaken: 'none' | 'logged' | 'reported'
}

export class NonCookiePopupHandler {
  private logEmitter?: ExecutionLogEmitter
  private pagesProcessed: Set<string> = new Set()

  /**
   * Handle non-cookie popups for a page
   * 
   * This runs AFTER cookie handling and detects non-cookie popups.
   * It does NOT automatically dismiss them - it reports them.
   */
  async handleNonCookiePopups(
    page: Page,
    currentUrl: string,
    runId: string,
    stepNumber: number
  ): Promise<NonCookiePopupResult> {
    // Initialize execution log emitter
    this.logEmitter = getExecutionLogEmitter(runId, stepNumber)

    // INVARIANT: Cookie handling must be completed before non-cookie popup handling
    // This check ensures we never handle cookies here
    const cookieStatus = getCookieStatus(runId)
    if (cookieStatus !== 'COMPLETED') {
      this.logEmitter.log('Cookie handling not yet completed, skipping non-cookie popup detection', {
        cookieStatus,
        url: currentUrl,
      })
      return { popupsDetected: [], actionTaken: 'none' }
    }

    // Run at most once per page
    if (this.pagesProcessed.has(currentUrl)) {
      this.logEmitter.log('Non-cookie popup handling already completed for this page', { url: currentUrl })
      return { popupsDetected: [], actionTaken: 'none' }
    }

    this.pagesProcessed.add(currentUrl)

    const detectedPopups: DetectedPopup[] = []

    try {
      // Detection criteria for non-cookie popups
      const popupSelectors = [
        // Dialogs and modals (explicit detection)
        '[role="dialog"]',
        '[aria-modal="true"]',
        '.modal',
        '.modal-backdrop',
        '.dialog',
        '.ReactModal__Overlay',
        '.chakra-modal__overlay',
        // Newsletter patterns
        '[id*="newsletter" i]',
        '[class*="newsletter" i]',
        '[id*="subscribe" i]',
        '[class*="subscribe" i]',
        // Chat widgets
        '[id*="chat" i]',
        '[class*="chat" i]',
        '[id*="intercom" i]',
        '[class*="intercom" i]',
        '[id*="zendesk" i]',
        '[class*="zendesk" i]',
        // Promotional popups
        '[id*="promo" i]',
        '[class*="promo" i]',
        '[id*="offer" i]',
        '[class*="offer" i]',
        '[id*="discount" i]',
        '[class*="discount" i]',
        // Generic popup patterns (but NOT cookie-related)
        '[id*="popup" i]',
        '[class*="popup" i]',
        '[id*="overlay" i]',
        '[class*="overlay" i]',
      ]

      this.logEmitter.log('Scanning for non-cookie popups', { url: currentUrl })

      // Check each selector
      for (const selector of popupSelectors) {
        try {
          const elements = page.locator(selector)
          const count = await elements.count()

          if (count === 0) continue

          for (let i = 0; i < count; i++) {
            const element = elements.nth(i)

            try {
              const isVisible = await element.isVisible().catch(() => false)
              if (!isVisible) continue

              // Skip if this looks like a cookie banner (should have been handled already)
              const elementText = await element.textContent().catch(() => '')
              const normalizedText = (elementText || '').trim().toLowerCase()
              const isCookieRelated = 
                normalizedText.includes('cookie') ||
                normalizedText.includes('consent') ||
                normalizedText.includes('gdpr') ||
                selector.toLowerCase().includes('cookie') ||
                selector.toLowerCase().includes('consent')

              if (isCookieRelated) {
                // This should have been handled by cookie handler - skip it
                continue
              }

              // Determine popup type
              const popupType = this.classifyPopupType(selector, normalizedText)

              // Check if it's blocking
              const blockingStatus = await this.determineBlockingStatus(page, element, selector)

              const detected: DetectedPopup = {
                type: popupType,
                selector,
                blockingStatus,
                description: elementText || `Popup detected via ${selector}`,
              }

              detectedPopups.push(detected)

              // Log detection
              this.logEmitter.log(`Detected non-cookie popup: ${popupType}`, {
                selector,
                blockingStatus,
                description: detected.description,
              })

              if (blockingStatus === 'BLOCKING_UI') {
                this.logEmitter.log('Popup blocks interaction, reporting as UI issue', {
                  type: popupType,
                  selector,
                })
              } else {
                this.logEmitter.log('Popup marked as non-blocking, continuing test', {
                  type: popupType,
                  selector,
                })
              }
            } catch (error: any) {
              // Continue to next element
              continue
            }
          }
        } catch (error: any) {
          // Continue to next selector
          continue
        }
      }

      // Report findings
      if (detectedPopups.length > 0) {
        const blockingCount = detectedPopups.filter(p => p.blockingStatus === 'BLOCKING_UI').length
        this.logEmitter.log(`Found ${detectedPopups.length} non-cookie popup(s), ${blockingCount} blocking`, {
          popups: detectedPopups.map(p => ({
            type: p.type,
            blockingStatus: p.blockingStatus,
            description: p.description,
          })),
        })

        return {
          popupsDetected: detectedPopups,
          actionTaken: blockingCount > 0 ? 'reported' : 'logged',
        }
      } else {
        this.logEmitter.log('No non-cookie popups detected')
        return {
          popupsDetected: [],
          actionTaken: 'none',
        }
      }
    } catch (error: any) {
      this.logEmitter.log('Error detecting non-cookie popups', { error: error.message })
      return {
        popupsDetected: [],
        actionTaken: 'none',
      }
    }
  }

  /**
   * Classify popup type based on selector and text
   */
  private classifyPopupType(selector: string, text: string): PopupType {
    const lowerSelector = selector.toLowerCase()
    const lowerText = text.toLowerCase()

    if (
      lowerSelector.includes('newsletter') ||
      lowerSelector.includes('subscribe') ||
      lowerText.includes('newsletter') ||
      lowerText.includes('subscribe') ||
      lowerText.includes('email')
    ) {
      return 'newsletter'
    }

    if (
      lowerSelector.includes('chat') ||
      lowerSelector.includes('intercom') ||
      lowerSelector.includes('zendesk') ||
      lowerText.includes('chat') ||
      lowerText.includes('message us')
    ) {
      return 'chat'
    }

    if (
      lowerSelector.includes('promo') ||
      lowerSelector.includes('offer') ||
      lowerSelector.includes('discount') ||
      lowerText.includes('promo') ||
      lowerText.includes('offer') ||
      lowerText.includes('discount') ||
      lowerText.includes('sale')
    ) {
      return 'promo'
    }

    return 'unknown'
  }

  /**
   * Determine if popup is blocking navigation or forms
   */
  private async determineBlockingStatus(
    page: Page,
    element: any,
    selector: string
  ): Promise<PopupBlockingStatus> {
    try {
      // Check z-index
      const zIndex = await element.evaluate((el: any) => {
        const style = window.getComputedStyle(el)
        return parseInt(style.zIndex) || 0
      }).catch(() => 0)

      // Check coverage
      const boundingBox = await element.boundingBox().catch(() => null)
      if (!boundingBox) return 'NON_BLOCKING_UI'

      const viewportSize = page.viewportSize()
      if (!viewportSize) return 'NON_BLOCKING_UI'

      const coverage = (boundingBox.width * boundingBox.height) / (viewportSize.width * viewportSize.height)

      // Check if it's a modal
      const isModal = 
        selector.includes('[role="dialog"]') ||
        selector.includes('[aria-modal="true"]') ||
        selector.includes('.modal')

      // Blocking if:
      // - High z-index (>= 1000)
      // - Covers significant portion (>15%)
      // - Is a modal
      const isBlocking = zIndex >= 1000 || coverage > 0.15 || isModal

      return isBlocking ? 'BLOCKING_UI' : 'NON_BLOCKING_UI'
    } catch {
      return 'NON_BLOCKING_UI'
    }
  }

  /**
   * Reset handler for new test run
   */
  reset(): void {
    this.pagesProcessed.clear()
  }
}

