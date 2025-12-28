// Navigation actions for Playwright
import { Page } from 'playwright'
import { LLMAction } from '../../../types'
import { validateUrlOrThrow } from '../../../utils/urlValidator'

// Conditional logging
const DEBUG = process.env.DEBUG === 'true' || process.env.NODE_ENV === 'development'
const log = DEBUG ? console.log.bind(console) : () => {}
const logWarn = DEBUG ? console.warn.bind(console) : () => {}

export class NavigationActions {
  /**
   * Navigate to a URL with progressive fallback strategy
   * Tries: networkidle -> load -> domcontentloaded
   */
  async navigate(page: Page, action: LLMAction): Promise<void> {
    if (!action.value) {
      throw new Error('URL required for navigate action')
    }
    const url = action.value
    // SECURITY: Validate URL to prevent SSRF attacks
    validateUrlOrThrow(url)
    
    log('Playwright: Navigating to:', url)
    
    // Progressive fallback strategy: networkidle -> load -> domcontentloaded
    // Some sites are very slow or have continuous network activity
    let navigationSuccess = false
    const navigationTimeout = 90000 // 90 seconds for slow sites
    
    try {
      // Strategy 1: Try networkidle (most reliable, but strict)
      log('Playwright: Attempting navigation with networkidle strategy...')
      await page.goto(url, { 
        waitUntil: 'networkidle', 
        timeout: navigationTimeout
      })
      navigationSuccess = true
      log('Playwright: Navigation successful with networkidle')
    } catch (networkIdleError: any) {
      if (networkIdleError.message?.includes('Timeout') || networkIdleError.message?.includes('timeout')) {
        log('Playwright: networkidle timeout, trying with \'load\' strategy...')
        try {
          // Strategy 2: Try load (waits for load event)
          await page.goto(url, { 
            waitUntil: 'load', 
            timeout: navigationTimeout
          })
          navigationSuccess = true
          log('Playwright: Navigation successful with load strategy')
        } catch (loadError: any) {
          if (loadError.message?.includes('Timeout') || loadError.message?.includes('timeout')) {
            log('Playwright: load timeout, trying with \'domcontentloaded\' strategy (most lenient)...')
            try {
              // Strategy 3: Try domcontentloaded (most lenient, just waits for DOM)
              await page.goto(url, { 
                waitUntil: 'domcontentloaded', 
                timeout: navigationTimeout
              })
              navigationSuccess = true
              log('Playwright: Navigation successful with domcontentloaded strategy')
              // Give extra time for resources to load after DOM is ready
              await page.waitForTimeout(2000)
            } catch (domError: any) {
              // If all strategies fail, check if page actually loaded
              const currentUrl = page.url()
              if (currentUrl && currentUrl !== 'about:blank') {
                logWarn('Playwright: Navigation timeout, but page URL changed. Continuing...')
                await page.waitForTimeout(3000) // Give it more time
                navigationSuccess = true
              } else {
                throw new Error(`Navigation failed after all strategies. Last error: ${domError.message}`)
              }
            }
          } else {
            throw loadError
          }
        }
      } else {
        throw networkIdleError
      }
    }
    
    if (!navigationSuccess) {
      throw new Error('Navigation failed: All strategies exhausted')
    }
    
    // Wait for page to stabilize
    await page.waitForTimeout(500)
  }

  /**
   * Navigate back in browser history
   */
  async goBack(page: Page): Promise<void> {
    log('Playwright: Navigating back in browser history')
    
    try {
      await page.goBack({ waitUntil: 'load', timeout: 60000 })
      await page.waitForTimeout(500) // Wait for page to stabilize
      log('Playwright: Navigated back successfully')
    } catch (error: any) {
      const { formatErrorForStep } = await import('../../../utils/errorFormatter')
      const formattedError = formatErrorForStep(error, { action: 'goBack' })
      throw new Error(`Failed to navigate back: ${formattedError}`)
    }
  }

  /**
   * Navigate forward in browser history
   */
  async goForward(page: Page): Promise<void> {
    log('Playwright: Navigating forward in browser history')
    
    try {
      await page.goForward({ waitUntil: 'load', timeout: 60000 })
      await page.waitForTimeout(500) // Wait for page to stabilize
      log('Playwright: Navigated forward successfully')
    } catch (error: any) {
      const { formatErrorForStep } = await import('../../../utils/errorFormatter')
      const formattedError = formatErrorForStep(error, { action: 'goForward' })
      throw new Error(`Failed to navigate forward: ${formattedError}`)
    }
  }
}

