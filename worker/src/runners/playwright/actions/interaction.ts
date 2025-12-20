// Interaction actions for Playwright (click, type, scroll)
import { Page } from 'playwright'
import { LLMAction, SelfHealingInfo } from '../../../types'

// Conditional logging
const DEBUG = process.env.DEBUG === 'true' || process.env.NODE_ENV === 'development'
const log = DEBUG ? console.log.bind(console) : () => { }
const logWarn = DEBUG ? console.warn.bind(console) : () => { }

export interface InteractionActionsDependencies {
  resolveBlockingOverlays: (page: Page) => Promise<boolean>
  tryClick: (page: Page, action: LLMAction) => Promise<SelfHealingInfo | null>
  logElementDebugInfo: (page: Page, selector: string) => Promise<void>
}

export class InteractionActions {
  constructor(private deps: InteractionActionsDependencies) { }

  /**
   * Click an element
   */
  async click(page: Page, action: LLMAction): Promise<SelfHealingInfo | null> {
    if (!action.selector) {
      throw new Error('Selector required for click action')
    }

    // Check for and dismiss popups/cookie banners before clicking
    await this.deps.resolveBlockingOverlays(page)

    log('Playwright: Clicking element:', action.selector)

    try {
      return await this.deps.tryClick(page, action)
    } catch (clickError: any) {
      // If click fails, try dismissing popups again and retry once
      const popupDismissed = await this.deps.resolveBlockingOverlays(page)
      if (popupDismissed) {
        try {
          await page.waitForTimeout(500)
          return await this.deps.tryClick(page, action)
        } catch (retryError: any) {
          await this.deps.logElementDebugInfo(page, action.selector)
          const { formatErrorForStep } = await import('../../../utils/errorFormatter')
          const formattedError = formatErrorForStep(retryError, { action: action.action, selector: action.selector })
          throw new Error(`Failed to click element ${action.selector}: ${formattedError}`)
        }
      } else {
        await this.deps.logElementDebugInfo(page, action.selector)
        const { formatErrorForStep } = await import('../../../utils/errorFormatter')
        const formattedError = formatErrorForStep(clickError, { action: action.action, selector: action.selector })
        throw new Error(`Failed to click element ${action.selector}: ${formattedError}`)
      }
    }
  }

  /**
   * Type into an input field
   */
  async type(page: Page, action: LLMAction): Promise<void> {
    if (!action.selector || !action.value) {
      throw new Error('Selector and value required for type action')
    }

    // Check for and dismiss popups/cookie banners before typing
    await this.deps.resolveBlockingOverlays(page)

    log('Playwright: Typing into element:', action.selector, 'value:', action.value)

    try {
      // Use locator API for better selector support
      const locator = page.locator(action.selector)
      await locator.waitFor({ state: 'visible', timeout: 10000 })

      // Show cursor at input field before typing
      try {
        const boundingBox = await locator.boundingBox()
        if (boundingBox) {
          const centerX = boundingBox.x + boundingBox.width / 2
          const centerY = boundingBox.y + boundingBox.height / 2

          // Show cursor at element center
          await page.evaluate(({ x, y }: { x: number; y: number }) => {
            if ((window as any).__playwrightShowCursor) {
              (window as any).__playwrightShowCursor(x, y)
            }
          }, { x: centerX, y: centerY })

          // Wait a bit to show cursor movement
          await page.waitForTimeout(200)
        }
      } catch (indicatorError) {
        // If showing indicators fails, continue with typing anyway
        if (DEBUG) logWarn('Failed to show type indicator:', indicatorError)
      }

      await locator.fill(action.value, { timeout: 10000 })

      // Hide cursor after typing
      try {
        await page.evaluate(() => {
          if ((window as any).__playwrightHideCursor) {
            (window as any).__playwrightHideCursor()
          }
        })
      } catch (hideError) {
        // Ignore hide errors
      }
    } catch (error: any) {
      // If type fails, try dismissing popups again and retry once
      const popupDismissed = await this.deps.resolveBlockingOverlays(page)
      if (popupDismissed) {
        try {
          await page.waitForTimeout(500)
          const locator = page.locator(action.selector)
          await locator.waitFor({ state: 'visible', timeout: 10000 })

          // Show cursor at input field before typing (retry)
          try {
            const boundingBox = await locator.boundingBox()
            if (boundingBox) {
              const centerX = boundingBox.x + boundingBox.width / 2
              const centerY = boundingBox.y + boundingBox.height / 2
              await page.evaluate(({ x, y }: { x: number; y: number }) => {
                if ((window as any).__playwrightShowCursor) {
                  (window as any).__playwrightShowCursor(x, y)
                }
              }, { x: centerX, y: centerY })
              await page.waitForTimeout(200)
            }
          } catch (indicatorError) {
            // Ignore indicator errors
          }

          await locator.fill(action.value, { timeout: 10000 })

          // Hide cursor after typing
          try {
            await page.evaluate(() => {
              if ((window as any).__playwrightHideCursor) {
                (window as any).__playwrightHideCursor()
              }
            })
          } catch (hideError) {
            // Ignore hide errors
          }
        } catch (retryError: any) {
          const { formatErrorForStep } = await import('../../../utils/errorFormatter')
          const formattedError = formatErrorForStep(retryError, { action: action.action, selector: action.selector })
          throw new Error(`Failed to type into element ${action.selector}: ${formattedError}`)
        }
      } else {
        const { formatErrorForStep } = await import('../../../utils/errorFormatter')
        const formattedError = formatErrorForStep(error, { action: action.action, selector: action.selector })
        throw new Error(`Failed to type into element ${action.selector}: ${formattedError}`)
      }
    }
  }

  /**
   * Scroll the page
   */
  async scroll(page: Page): Promise<void> {
    log('Playwright: Scrolling')
    await page.evaluate(() => {
      window.scrollBy(0, window.innerHeight)
    })
    await page.waitForTimeout(500) // Wait for scroll to complete
  }

  /**
   * Wait for a specified duration
   */
  async wait(page: Page, duration: number = 1000): Promise<void> {
    log('Playwright: Waiting')
    await page.waitForTimeout(duration)
  }
}

