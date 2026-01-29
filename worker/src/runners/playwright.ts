// Playwright runner using real Playwright API
import { chromium, firefox, webkit, Browser, Page, BrowserContext } from 'playwright'
import { TestProfile, LLMAction, DeviceProfile, ActionExecutionResult, SelfHealingInfo } from '../types'
import { validateUrlOrThrow } from '../utils/urlValidator'

/**
 * Device alias mapping for responsive testing
 * Maps friendly device names to viewport dimensions
 */
export const DEVICE_ALIASES: Record<string, { width: number; height: number }> = {
  'mobile': { width: 390, height: 844 },           // iPhone 12/13 standard
  'mobile-small': { width: 360, height: 640 },    // Android small devices
  'mobile-large': { width: 428, height: 926 },    // iPhone 14 Pro Max
  'tablet': { width: 768, height: 1024 },        // iPad portrait
  'tablet-landscape': { width: 1024, height: 768 }, // iPad landscape
  'tablet-small': { width: 640, height: 960 },    // Small tablet
  'desktop': { width: 1920, height: 1080 },      // Standard desktop
  'desktop-small': { width: 1280, height: 720 },  // Small desktop/laptop
  'desktop-large': { width: 2560, height: 1440 }, // Large desktop
  'ultrawide': { width: 3440, height: 1440 },     // Ultrawide monitor
}

export interface RunnerSession {
  id: string
  profile: TestProfile
  startedAt: string
  browser: Browser
  context: BrowserContext
  page: Page
  videoPath?: string // Path to video file
  tracingStarted?: boolean // Track if tracing was successfully started
}

interface HealingCandidate {
  selector: string
  strategy: SelfHealingInfo['strategy']
  note: string
  confidence: number
}

export class PlaywrightRunner {
  private gridUrl: string | null
  private sessions: Map<string, RunnerSession> = new Map()

  // Browser pool limit - each Chromium uses ~300MB RAM
  // At 20 sessions: ~6GB max memory, safe for most servers
  private readonly MAX_SESSIONS = parseInt(process.env.MAX_BROWSER_SESSIONS || '20', 10)

  constructor(gridUrl?: string) {
    // gridUrl is optional - if not provided, use Playwright directly
    this.gridUrl = gridUrl || null
  }

  /**
   * Reserve a browser session
   * Creates a real Playwright browser instance
   */
  async reserveSession(profile: TestProfile): Promise<RunnerSession> {
    // Pool limit check - prevent OOM from too many browsers
    if (this.sessions.size >= this.MAX_SESSIONS) {
      throw new Error(`Browser pool exhausted: ${this.sessions.size}/${this.MAX_SESSIONS} sessions active. Try again later.`)
    }

    console.log(`Playwright: Reserving session for profile: ${profile.device} (${this.sessions.size + 1}/${this.MAX_SESSIONS})`)

    const sessionId = `playwright_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`


    // Determine browser type from device profile
    let browserType = chromium // Default to Chromium
    if (profile.device === DeviceProfile.FIREFOX_LATEST) {
      browserType = firefox
    } else if (profile.device === DeviceProfile.SAFARI_LATEST) {
      browserType = webkit
    }

    // Launch browser (headless by default for automation)
    const browser = await browserType.launch({
      headless: true,
    })

    // Create browser context with viewport settings, video recording, and trace
    const contextOptions: any = {
      viewport: profile.viewport || { width: 1280, height: 720 },
      recordVideo: {
        dir: './videos/', // Video will be saved here
        size: profile.viewport || { width: 1280, height: 720 },
      },
    }

    const context = await browser.newContext(contextOptions)

    // Start trace recording (Time-Travel Debugger feature)
    // RE-ENABLED: Tracing enabled with Wasabi storage support
    let tracingStarted = false
    // Enable tracing if requested in profile (Paid users) OR if globally enabled via env
    const enableTracing = profile.enableTrace === true || process.env.ENABLE_TRACING === 'true'
    if (enableTracing) {
      try {
        await context.tracing.start({
          screenshots: true,
          snapshots: true,
          sources: true,
        })
        tracingStarted = true
        console.log('Playwright: Tracing started successfully')
      } catch (traceStartError: any) {
        console.error('Playwright: Failed to start tracing:', traceStartError.message)
        // Continue without tracing - don't fail session creation
        // Tracing is optional for test execution
      }
    }

    const page = await context.newPage()

    // Capture browser console logs
    page.on('console', msg => {
      const type = msg.type()
      const text = msg.text()
      // Filter out noisy logs if needed
      if (!text.includes('[HMR]') && !text.includes('[WDS]')) {
        console.log(`[Browser Console] [${type}] ${text}`)
      }
    })

    // Inject visual cursor and click indicator script for video recording
    await page.addInitScript(() => {
      // Create cursor element
      const cursor = document.createElement('div')
      cursor.id = '__playwright_cursor__'
      cursor.style.cssText = `
        position: fixed;
        width: 20px;
        height: 20px;
        border: 2px solid #0075FF;
        border-radius: 50%;
        background: rgba(0, 117, 255, 0.3);
        pointer-events: none;
        z-index: 999999;
        transform: translate(-50%, -50%);
        display: none;
        transition: opacity 0.2s;
      `
      document.body.appendChild(cursor)

      // Create click ripple effect element
      const ripple = document.createElement('div')
      ripple.id = '__playwright_ripple__'
      ripple.style.cssText = `
        position: fixed;
        width: 40px;
        height: 40px;
        border: 3px solid #0075FF;
        border-radius: 50%;
        pointer-events: none;
        z-index: 999998;
        transform: translate(-50%, -50%);
        display: none;
        opacity: 0.8;
      `
      document.body.appendChild(ripple)

      // Create status bubble element (like "Standing by", "Clicking...")
      const statusBubble = document.createElement('div')
      statusBubble.id = '__playwright_status__'
      statusBubble.style.cssText = `
        position: fixed;
        padding: 6px 12px;
        background: rgba(0, 0, 0, 0.75);
        color: #fff;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 12px;
        font-weight: 500;
        border-radius: 16px;
        pointer-events: none;
        z-index: 999997;
        display: none;
        white-space: nowrap;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        backdrop-filter: blur(4px);
      `
      document.body.appendChild(statusBubble)

      // Store current cursor position for smooth animations
      let currentX = 0
      let currentY = 0
      let statusHideTimeout: any = null

        // Expose functions to show cursor and click
        ; (window as any).__playwrightShowCursor = (x: number, y: number, smooth: boolean = false) => {
          currentX = x
          currentY = y

          if (smooth && cursor.style.display !== 'none') {
            // Phase 3: Cubic-Bezier easing for human-like movement
            cursor.style.transition = 'left 0.3s cubic-bezier(0.4, 0, 0.2, 1), top 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
            statusBubble.style.transition = 'left 0.3s cubic-bezier(0.4, 0, 0.2, 1), top 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
          } else {
            cursor.style.transition = 'opacity 0.2s'
            statusBubble.style.transition = 'opacity 0.2s'
          }

          cursor.style.left = x + 'px'
          cursor.style.top = y + 'px'
          cursor.style.display = 'block'
          cursor.style.opacity = '1'

          // Position status bubble below and to the right of cursor
          statusBubble.style.left = (x + 25) + 'px'
          statusBubble.style.top = (y + 25) + 'px'
        }

        ; (window as any).__playwrightHideCursor = () => {
          cursor.style.transition = 'opacity 0.2s'
          cursor.style.opacity = '0'
          statusBubble.style.opacity = '0'
          setTimeout(() => {
            cursor.style.display = 'none'
            statusBubble.style.display = 'none'
          }, 200)
        }

        ; (window as any).__playwrightShowClick = (x: number, y: number) => {
          ripple.style.left = x + 'px'
          ripple.style.top = y + 'px'
          ripple.style.display = 'block'
          ripple.style.width = '40px'
          ripple.style.height = '40px'
          ripple.style.opacity = '0.8'
          ripple.style.transition = 'all 0.4s ease-out'

          // Animate ripple expansion
          requestAnimationFrame(() => {
            ripple.style.width = '80px'
            ripple.style.height = '80px'
            ripple.style.opacity = '0'
          })

          setTimeout(() => {
            ripple.style.display = 'none'
          }, 400)
        }

        // Expose function to get current cursor position
        ; (window as any).__playwrightGetCursorPosition = () => {
          return { x: currentX, y: currentY }
        }

        // NEW: Show status text near cursor
        ; (window as any).__playwrightShowStatus = (text: string, duration: number = 2000) => {
          if (statusHideTimeout) {
            clearTimeout(statusHideTimeout)
          }

          statusBubble.textContent = text
          statusBubble.style.display = 'block'
          statusBubble.style.opacity = '1'

          // Auto-hide after duration (0 = persistent until hidden)
          if (duration > 0) {
            statusHideTimeout = setTimeout(() => {
              statusBubble.style.transition = 'opacity 0.3s'
              statusBubble.style.opacity = '0'
              setTimeout(() => {
                statusBubble.style.display = 'none'
              }, 300)
            }, duration)
          }
        }

        // NEW: Hide status bubble
        ; (window as any).__playwrightHideStatus = () => {
          if (statusHideTimeout) {
            clearTimeout(statusHideTimeout)
          }
          statusBubble.style.transition = 'opacity 0.2s'
          statusBubble.style.opacity = '0'
          setTimeout(() => {
            statusBubble.style.display = 'none'
          }, 200)
        }
    })

    // SECURITY: Network-layer request interception to prevent SSRF via redirects/DNS rebinding
    // This catches attacks that bypass initial URL validation:
    // 1. HTTP redirects (301/302) to localhost/private IPs
    // 2. DNS rebinding (DNS changes after validation)
    // 3. JavaScript-initiated requests to internal endpoints
    await page.route('**/*', async (route) => {
      const request = route.request()
      const requestUrl = request.url()
      const resourceType = request.resourceType()

      try {
        // Re-validate EVERY request at network layer (not just initial navigation)
        const { safe, reason } = await import('../utils/urlValidator').then(m => m.isUrlSafe(requestUrl))

        if (!safe) {
          console.warn(`[SECURITY] Blocked dangerous request to: ${requestUrl}`)
          console.warn(`[SECURITY] Reason: ${reason}`)
          console.warn(`[SECURITY] Type: ${resourceType}, Method: ${request.method()}`)

          // Abort the request to prevent SSRF
          await route.abort('blockedbyclient')
          return
        }

        // OPTIMIZATION: Block unnecessary resources to speed up tests (optional)
        // This reduces bandwidth and improves test performance
        const { config } = await import('../config/env')
        if (config.worker.blockUnnecessaryResources) {
          const blockList = [
            'image',      // Images (screenshots capture these anyway)
            'font',       // Web fonts
            'media',      // Audio/video
            'stylesheet', // CSS (we're testing functionality, not styling)
          ]

          // Block analytics and ads by domain pattern
          const adDomains = [
            'google-analytics.com',
            'googletagmanager.com',
            'facebook.com/tr',
            'doubleclick.net',
            'hotjar.com',
            'mixpanel.com',
            'segment.com',
            'amplitude.com',
          ]

          if (blockList.includes(resourceType) || adDomains.some(domain => requestUrl.includes(domain))) {
            await route.abort('blockedbyclient')
            return
          }
        }

        // Allow safe requests to continue
        await route.continue()
      } catch (error: any) {
        console.error(`[SECURITY] Error validating request to ${requestUrl}:`, error.message)
        // Fail closed - block on validation errors
        await route.abort('failed')
      }
    })

    // Note: Video path will be available after context closes
    // We'll store the session ID to retrieve it later

    const session: RunnerSession = {
      id: sessionId,
      profile,
      startedAt: new Date().toISOString(),
      browser,
      context,
      page,
      tracingStarted,
    }

    this.sessions.set(sessionId, session)

    console.log('Playwright: Session reserved:', sessionId, 'Browser:', profile.device)
    console.log('Playwright: Network-layer SSRF protection enabled for session:', sessionId)

    return session
  }

  /**
   * Capture screenshot
   * Uses real Playwright API to capture screenshot
   */
  async captureScreenshot(sessionId: string, fullPage: boolean = false): Promise<string> {
    const session = this.sessions.get(sessionId)
    if (!session) {
      throw new Error(`Session ${sessionId} not found`)
    }

    console.log('Playwright: Capturing screenshot for session:', sessionId, fullPage ? '(full page)' : '(viewport)')

    try {
      let screenshotBase64: string
      try {
        const buffer = await session.page.screenshot({ fullPage: fullPage })
        screenshotBase64 = buffer.toString('base64')
      } catch (error) {
        console.error('Playwright: Failed to capture screenshot:', error)
        throw new Error(`Failed to capture screenshot: ${error}`)
      }

      return screenshotBase64
    } catch (error: any) {
      console.error('Playwright: Failed to capture screenshot:', error.message)
      throw new Error(`Failed to capture screenshot: ${error.message}`)
    }
  }

  /**
   * Get page dimensions (viewport and document height)
   */
  async getPageDimensions(sessionId: string): Promise<{ viewportHeight: number; documentHeight: number }> {
    const session = this.sessions.get(sessionId)
    if (!session) {
      throw new Error(`Session ${sessionId} not found`)
    }

    try {
      const dimensions = await session.page.evaluate(() => {
        return {
          viewportHeight: window.innerHeight,
          documentHeight: Math.max(
            document.body.scrollHeight,
            document.body.offsetHeight,
            document.documentElement.clientHeight,
            document.documentElement.scrollHeight,
            document.documentElement.offsetHeight
          ),
        }
      })

      return dimensions
    } catch (error: any) {
      console.error('Playwright: Failed to get page dimensions:', error.message)
      throw new Error(`Failed to get page dimensions: ${error.message}`)
    }
  }

  /**
   * Scroll to a specific position on the page
   */
  async scrollToPosition(sessionId: string, y: number): Promise<void> {
    const session = this.sessions.get(sessionId)
    if (!session) {
      throw new Error(`Session ${sessionId} not found`)
    }

    try {
      await session.page.evaluate((scrollY) => {
        window.scrollTo(0, scrollY)
      }, y)

      // Wait for scroll to complete and any lazy-loaded content
      await session.page.waitForTimeout(500)
    } catch (error: any) {
      console.error('Playwright: Failed to scroll to position:', error.message)
      throw new Error(`Failed to scroll to position: ${error.message}`)
    }
  }

  /**
   * Scroll to top of page
   */
  async scrollToTop(sessionId: string): Promise<void> {
    await this.scrollToPosition(sessionId, 0)
  }

  /**
   * Execute action
   * Uses real Playwright API to execute actions
   */
  async executeAction(sessionId: string, action: LLMAction, options?: { timeout?: number, waitUntil?: 'load' | 'domcontentloaded' | 'networkidle' }): Promise<ActionExecutionResult | void> {
    const session = this.sessions.get(sessionId)
    if (!session) {
      throw new Error(`Session ${sessionId} not found`)
    }

    console.log('Playwright: Executing action:', action.action, action.target)

    const { page } = session

    try {
      let healingMeta: SelfHealingInfo | null = null
      switch (action.action) {
        // ... (click/type/scroll cases remain same)

        case 'click':
          if (!action.selector) throw new Error('Selector required for click action')
          console.log('Playwright: Clicking element:', action.selector)
          try {
            healingMeta = await this.tryClick(page, action)
          } catch (clickError: any) {
            await this.logElementDebugInfo(page, action.selector)
            const { formatErrorForStep } = await import('../utils/errorFormatter')
            const formattedError = formatErrorForStep(clickError, { action: action.action, selector: action.selector })
            throw new Error(`Failed to click element ${action.selector}: ${formattedError}`)
          }
          break

        case 'type':
          // ... (keep existing type logic)
          if (!action.selector || !action.value) throw new Error('Selector and value required for type action')
          console.log('Playwright: Typing into element:', action.selector, 'value:', action.value)
          try {
            const locator = page.locator(action.selector)
            await locator.waitFor({ state: 'visible', timeout: 10000 })
            try {
              const boundingBox = await locator.boundingBox()
              if (boundingBox) {
                const centerX = boundingBox.x + boundingBox.width / 2
                const centerY = boundingBox.y + boundingBox.height / 2
                await page.evaluate(({ x, y }) => {
                  if ((window as any).__playwrightShowCursor) (window as any).__playwrightShowCursor(x, y)
                }, { x: centerX, y: centerY })
                await page.waitForTimeout(200)
              }
            } catch (indicatorError) { console.warn('Failed to show type indicator:', indicatorError) }
            await locator.fill(action.value, { timeout: 10000 })
            try {
              await page.evaluate(() => {
                if ((window as any).__playwrightHideCursor) (window as any).__playwrightHideCursor()
              })
            } catch (hideError) { }
          } catch (error: any) {
            const { formatErrorForStep } = await import('../utils/errorFormatter')
            const formattedError = formatErrorForStep(error, { action: action.action, selector: action.selector })
            throw new Error(`Failed to type into element ${action.selector}: ${formattedError}`)
          }
          break

        case 'scroll':
          console.log('Playwright: Scrolling')
          await page.evaluate(() => { window.scrollBy(0, window.innerHeight) })
          await page.waitForTimeout(500)
          break

        case 'navigate':
          if (!action.value) {
            throw new Error('URL required for navigate action')
          }

          // SECURITY: Validate URL to prevent SSRF attacks
          validateUrlOrThrow(action.value)

          console.log('Playwright: Navigating to:', action.value)
          // Use provided options or defaults
          const timeout = options?.timeout || 30000
          const waitUntil = options?.waitUntil || 'load'

          try {
            await page.goto(action.value, { waitUntil, timeout })
          } catch (navError: any) {
            // If 'load' times out, try with 'domcontentloaded' as fallback (unless overridden)
            if (navError.message?.includes('timeout') && !options?.waitUntil) {
              console.warn('Playwright: Load timeout, retrying with domcontentloaded')
              await page.goto(action.value, { waitUntil: 'domcontentloaded', timeout: 15000 })
            } else {
              throw navError
            }
          }

          // Note: Cookie banner detection is handled in testProcessor after navigation
          await page.waitForTimeout(1000)
          break

        case 'wait':
          console.log('Playwright: Waiting')
          await page.waitForTimeout(1000)
          break

        case 'assert':
          // Enhanced assert action with multiple assertion types
          if (!action.selector) {
            throw new Error('Selector required for assert action')
          }

          // Parse assertion type and expected value from action.value
          // Format: "type:expected" or just "type"
          const assertionParts = action.value?.split(':') || []
          const assertionType = assertionParts[0] || 'exists'
          const expectedValue = assertionParts.slice(1).join(':') || null

          console.log(`Playwright: Asserting ${assertionType} for element:`, action.selector, expectedValue ? `(expected: ${expectedValue})` : '')

          try {
            const locator = page.locator(action.selector)
            await locator.waitFor({ state: 'attached', timeout: 10000 })

            switch (assertionType) {
              case 'exists':
                // Verify element exists (already done by waitFor above)
                const exists = await locator.count() > 0
                if (!exists) {
                  throw new Error(`Element ${action.selector} does not exist in DOM`)
                }
                console.log('Playwright: Assertion passed - element exists')
                break

              case 'visible':
                const isVisible = await locator.first().isVisible()
                if (!isVisible) {
                  throw new Error(`Element ${action.selector} is not visible`)
                }
                console.log('Playwright: Assertion passed - element is visible')
                break

              case 'value':
                if (!expectedValue) {
                  throw new Error('Expected value required for value assertion')
                }
                const actualValue = await locator.first().evaluate((el: any) => {
                  if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT') {
                    return el.value || ''
                  }
                  return el.textContent?.trim() || ''
                })
                if (actualValue !== expectedValue) {
                  throw new Error(`Value assertion failed: expected "${expectedValue}", got "${actualValue}"`)
                }
                console.log(`Playwright: Assertion passed - value matches: "${expectedValue}"`)
                break

              case 'error':
                // Look for error messages - check for common error patterns
                const errorFound = await page.evaluate((selector) => {
                  const el = document.querySelector(selector)
                  if (!el) return false

                  // Check if element itself contains error text
                  const text = el.textContent?.toLowerCase() || ''
                  const hasErrorKeywords = text.includes('error') ||
                    text.includes('invalid') ||
                    text.includes('required') ||
                    text.includes('incorrect') ||
                    text.includes('failed')

                  // Check for error classes
                  const hasErrorClass = el.classList.toString().toLowerCase().includes('error') ||
                    el.classList.toString().toLowerCase().includes('invalid')

                  // Check aria-invalid
                  const ariaInvalid = el.getAttribute('aria-invalid') === 'true'

                  // Check for nearby error messages (common pattern: error message after input)
                  const parent = el.parentElement
                  if (parent) {
                    const siblings = Array.from(parent.children)
                    const errorSibling = siblings.find(sib => {
                      const sibText = sib.textContent?.toLowerCase() || ''
                      const sibClass = sib.classList.toString().toLowerCase()
                      return (sibText.includes('error') || sibText.includes('invalid') || sibText.includes('required')) ||
                        (sibClass.includes('error') || sibClass.includes('invalid'))
                    })
                    if (errorSibling) return true
                  }

                  return hasErrorKeywords || hasErrorClass || ariaInvalid
                }, action.selector)

                if (!errorFound) {
                  throw new Error(`Error assertion failed: No error message found for ${action.selector}`)
                }
                console.log('Playwright: Assertion passed - error message detected')
                break

              case 'state':
                if (!expectedValue) {
                  throw new Error('Expected state required (e.g., "checked" or "unchecked")')
                }
                const actualState = await locator.first().evaluate((el: any) => {
                  if (el.type === 'checkbox' || el.type === 'radio') {
                    return el.checked ? 'checked' : 'unchecked'
                  }
                  return null
                })
                if (actualState !== expectedValue) {
                  throw new Error(`State assertion failed: expected "${expectedValue}", got "${actualState}"`)
                }
                console.log(`Playwright: Assertion passed - state is "${expectedValue}"`)
                break

              case 'selected':
                if (!expectedValue) {
                  throw new Error('Expected option value required for selected assertion')
                }
                const selectedValue = await locator.first().evaluate((el: any) => {
                  if (el.tagName === 'SELECT') {
                    return el.options[el.selectedIndex]?.value || el.options[el.selectedIndex]?.text || ''
                  }
                  return null
                })
                if (selectedValue !== expectedValue && !selectedValue?.includes(expectedValue)) {
                  throw new Error(`Selected assertion failed: expected "${expectedValue}", got "${selectedValue}"`)
                }
                console.log(`Playwright: Assertion passed - option "${expectedValue}" is selected`)
                break

              case 'text':
                if (!expectedValue) {
                  throw new Error('Expected text required for text assertion')
                }
                const elementText = await locator.first().textContent() || ''
                if (!elementText.toLowerCase().includes(expectedValue.toLowerCase())) {
                  throw new Error(`Text assertion failed: expected to find "${expectedValue}", got "${elementText}"`)
                }
                console.log(`Playwright: Assertion passed - text contains "${expectedValue}"`)
                break

              default:
                // Fallback to basic existence check
                const elementInfo = await locator.first().evaluate((el) => {
                  const rect = el.getBoundingClientRect()
                  const style = window.getComputedStyle(el)
                  const tagName = el.tagName.toLowerCase()

                  let value: string | null = null
                  if (tagName === 'input' || tagName === 'textarea' || tagName === 'select') {
                    value = (el as HTMLInputElement).value || null
                  } else {
                    value = el.textContent?.trim() || null
                  }

                  return {
                    exists: true,
                    tagName,
                    value,
                    type: (el as HTMLInputElement).type || null,
                    isVisible: style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0',
                  }
                }).catch(() => ({ exists: false }))

                if (!elementInfo.exists) {
                  throw new Error(`Element ${action.selector} does not exist in DOM`)
                }
                console.log('Playwright: Assertion passed - element info:', JSON.stringify(elementInfo, null, 2))
            }

          } catch (error: any) {
            console.error('Playwright: Assertion failed:', error.message)
            const { formatErrorForStep } = await import('../utils/errorFormatter')
            const formattedError = formatErrorForStep(error, { action: action.action, selector: action.selector })
            throw new Error(`Assertion failed for ${action.selector}: ${formattedError}`)
          }
          break

        case 'setViewport':
          // Set viewport to specific dimensions
          // Value format: "widthxheight" (e.g., "390x844")
          if (!action.value) {
            throw new Error('Viewport dimensions required for setViewport action (format: "widthxheight")')
          }

          const viewportMatch = action.value.match(/(\d+)x(\d+)/)
          if (!viewportMatch) {
            throw new Error(`Invalid viewport format: ${action.value}. Expected format: "widthxheight" (e.g., "390x844")`)
          }

          const width = parseInt(viewportMatch[1], 10)
          const height = parseInt(viewportMatch[2], 10)

          if (width <= 0 || height <= 0 || width > 10000 || height > 10000) {
            throw new Error(`Invalid viewport dimensions: ${width}x${height}. Dimensions must be between 1 and 10000`)
          }

          console.log(`Playwright: Setting viewport to ${width}x${height}`)
          await page.setViewportSize({ width, height })

          // Wait for layout to stabilize after viewport change
          await page.waitForLoadState('networkidle')
          await page.waitForTimeout(500) // Additional wait for CSS transitions
          break

        case 'setDevice':
          // Set viewport using device alias (e.g., "mobile", "tablet", "desktop")
          if (!action.value) {
            throw new Error('Device alias required for setDevice action (e.g., "mobile", "tablet", "desktop")')
          }

          const deviceAlias = action.value.toLowerCase().trim()
          const deviceDimensions = DEVICE_ALIASES[deviceAlias]

          if (!deviceDimensions) {
            const availableAliases = Object.keys(DEVICE_ALIASES).join(', ')
            throw new Error(`Unknown device alias: "${deviceAlias}". Available aliases: ${availableAliases}`)
          }

          console.log(`Playwright: Setting device to ${deviceAlias} (${deviceDimensions.width}x${deviceDimensions.height})`)
          await page.setViewportSize(deviceDimensions)

          // Wait for layout to stabilize after viewport change
          await page.waitForLoadState('networkidle')
          await page.waitForTimeout(500) // Additional wait for CSS transitions
          break

        case 'setOrientation':
          // Change orientation by swapping width and height
          // Value should be "portrait" or "landscape"
          if (!action.value) {
            throw new Error('Orientation required for setOrientation action ("portrait" or "landscape")')
          }

          const orientation = action.value.toLowerCase().trim()
          if (orientation !== 'portrait' && orientation !== 'landscape') {
            throw new Error(`Invalid orientation: "${orientation}". Must be "portrait" or "landscape"`)
          }

          // Get current viewport size
          const currentViewport = page.viewportSize()
          if (!currentViewport) {
            throw new Error('Cannot change orientation: viewport size not available')
          }

          const currentWidth = currentViewport.width
          const currentHeight = currentViewport.height

          // Determine if we need to swap dimensions
          const isCurrentlyPortrait = currentHeight > currentWidth
          const shouldBePortrait = orientation === 'portrait'

          let newWidth = currentWidth
          let newHeight = currentHeight

          // Swap dimensions if orientation change is needed
          if (isCurrentlyPortrait !== shouldBePortrait) {
            newWidth = currentHeight
            newHeight = currentWidth
          }

          console.log(`Playwright: Setting orientation to ${orientation} (${newWidth}x${newHeight})`)
          await page.setViewportSize({ width: newWidth, height: newHeight })

          // Wait for layout to stabilize after orientation change
          await page.waitForLoadState('networkidle')
          await page.waitForTimeout(500) // Additional wait for CSS transitions
          break

        default:
          console.warn('Playwright: Unknown action:', action.action)
      }

      if (healingMeta) {
        return { healing: healingMeta }
      }
      return
    } catch (error: any) {
      console.error('Playwright: Action execution failed:', error.message)
      const { formatErrorForStep } = await import('../utils/errorFormatter')
      const formattedError = formatErrorForStep(error, { action: action.action, selector: action.selector })
      throw new Error(`Failed to execute action ${action.action}: ${formattedError}`)
    }
  }

  /**
   * Get current URL
   */
  async getCurrentUrl(sessionId: string): Promise<string> {
    const session = this.sessions.get(sessionId)
    if (!session) {
      throw new Error(`Session ${sessionId} not found`)
    }

    return session.page.url()
  }

  /**
   * Get session (for comprehensive testing access)
   */
  getSession(sessionId: string): RunnerSession | undefined {
    return this.sessions.get(sessionId)
  }

  /**
   * Check for and dismiss blocking overlays (popups, modals)
   * 
   * DEPRECATED: This method contained cookie bypass logic and has been removed.
   * Cookie handling is now exclusively handled by CookieBannerHandler.
   * Non-cookie popups are handled by NonCookiePopupHandler.
   * 
   * This method is kept for backward compatibility but always returns false.
   */
  async checkAndDismissOverlays(sessionId: string): Promise<boolean> {
    // Cookie handling bypass removed - always return false
    // Cookie handling must go through CookieBannerHandler
    // Non-cookie popups must go through NonCookiePopupHandler
    return false
  }

  private async tryClick(page: Page, action: LLMAction): Promise<SelfHealingInfo | null> {
    if (!action.selector) {
      throw new Error('Selector required for click action')
    }
    try {
      await this.performClick(page, action.selector)
      return null
    } catch (primaryError: any) {
      const healing = await this.applyClickSelfHealing(page, action)
      if (healing) {
        return healing
      }
      throw primaryError
    }
  }

  private async performClick(page: Page, selector: string, options: { fromHealing?: boolean } = {}): Promise<void> {
    const locator = page.locator(selector)

    await locator.waitFor({ state: 'attached', timeout: 10000 }).catch(() => {
      throw new Error(`Element ${selector} not found in DOM`)
    })

    const ensureVisible = async () => {
      const visible = await locator.isVisible().catch(() => false)
      if (visible) return

      // Try to scroll element into view
      try {
        await locator.scrollIntoViewIfNeeded({ timeout: 5000 })
        await page.waitForTimeout(500) // Wait a bit longer for animations
      } catch (scrollError) {
        // If scroll fails, try manual scroll
        try {
          const box = await locator.boundingBox()
          if (box) {
            await page.evaluate(({ x, y, width, height }) => {
              window.scrollTo({
                left: x + width / 2,
                top: y + height / 2,
                behavior: 'smooth'
              })
            }, box)
            await page.waitForTimeout(500)
          }
        } catch (manualScrollError) {
          // Ignore manual scroll errors
        }
      }

      // Check visibility again after scroll
      const visibleAfterScroll = await locator.isVisible().catch(() => false)
      if (!visibleAfterScroll) {
        // Get element info for better error message
        const elementInfo = await page.evaluate((sel) => {
          const el = document.querySelector(sel)
          if (!el) return { exists: false, visible: false, enabled: false }
          const style = window.getComputedStyle(el)
          const rect = el.getBoundingClientRect()
          return {
            exists: true,
            visible: style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0' && rect.width > 0 && rect.height > 0,
            enabled: !(el as HTMLElement).hasAttribute('disabled'),
            tagName: el.tagName,
            text: (el.textContent || '').substring(0, 50),
            classes: el.className || '',
            id: el.id || ''
          }
        }, selector).catch(() => ({ exists: false, visible: false, enabled: false }))

        console.log('Playwright: Click failed. Element info:', JSON.stringify(elementInfo))
        throw new Error(`Element ${selector} is not visible (may be hidden or off-screen)`)
      }
    }
    await ensureVisible()

    await locator.waitFor({ state: 'visible', timeout: 10000 })

    // Show cursor movement and click indicator before clicking
    try {
      const boundingBox = await locator.boundingBox()
      if (boundingBox) {
        const centerX = boundingBox.x + boundingBox.width / 2
        const centerY = boundingBox.y + boundingBox.height / 2

        // Get current cursor position (if any) for smooth animation
        const currentCursor = await page.evaluate(() => {
          const cursor = document.getElementById('__playwright_cursor__')
          if (cursor && cursor.style.display !== 'none') {
            const left = parseFloat(cursor.style.left) || 0
            const top = parseFloat(cursor.style.top) || 0
            return { x: left, y: top }
          }
          return null
        })

        // Phase 3: Animate cursor movement with Cubic-Bezier easing (human-like)
        if (currentCursor) {
          // Calculate distance for variable duration
          const distance = Math.sqrt(
            Math.pow(centerX - currentCursor.x, 2) +
            Math.pow(centerY - currentCursor.y, 2)
          )
          const duration = Math.min(300 + (distance * 0.1), 800) // 300-800ms based on distance

          // Phase 3: Smooth cursor movement with Cubic-Bezier easing
          await page.evaluate(({ from, to, dur }) => {
            const cursor = document.getElementById('__playwright_cursor__')
            if (!cursor || !(window as any).__playwrightShowCursor) return

            // Phase 3: Use Cubic-Bezier easing (ease-in-out for natural movement)
            cursor.style.transition = `left ${dur}ms cubic-bezier(0.4, 0, 0.2, 1), top ${dur}ms cubic-bezier(0.4, 0, 0.2, 1)`
              ; (window as any).__playwrightShowCursor(to.x, to.y, true)
          }, { from: currentCursor, to: { x: centerX, y: centerY }, dur: duration })

          // Wait for animation to complete
          await page.waitForTimeout(duration + 50)
        } else {
          // Show cursor at element center directly
          await page.evaluate(({ x, y }) => {
            if ((window as any).__playwrightShowCursor) {
              (window as any).__playwrightShowCursor(x, y)
            }
          }, { x: centerX, y: centerY })

          // Wait a bit to show cursor
          await page.waitForTimeout(200)
        }

        // Show click ripple effect
        await page.evaluate(({ x, y }) => {
          if ((window as any).__playwrightShowClick) {
            (window as any).__playwrightShowClick(x, y)
          }
          // Show "Clicking..." status
          if ((window as any).__playwrightShowStatus) {
            (window as any).__playwrightShowStatus('Clicking...', 1500)
          }
        }, { x: centerX, y: centerY })

        // Wait for click animation
        await page.waitForTimeout(100)
      }
    } catch (indicatorError) {
      // If showing indicators fails, continue with click anyway
      console.warn('Failed to show click indicator:', indicatorError)
    }

    // Perform the actual click
    const beforeUrl = page.url()
    try {
      await locator.click({ timeout: 10000, force: false })

      // Hide cursor after click
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
      // Cookie handling bypass removed - no automatic overlay dismissal
      // If pointer interception error, it's likely a real element issue, not a popup
      throw error
    }
    await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => { })
    const afterUrl = page.url()

    // Hide cursor after successful click
    try {
      await page.evaluate(() => {
        if ((window as any).__playwrightHideCursor) {
          ; (window as any).__playwrightHideCursor()
        }
      })
    } catch (hideError) {
      // Ignore hide errors
    }

    if (!options.fromHealing && beforeUrl === afterUrl) {
      await this.logLinkExpectation(locator)
    }
  }

  private isPointerInterceptionError(error: any): boolean {
    const message = typeof error?.message === 'string' ? error.message : ''
    if (!message) return false
    return (
      message.includes('intercepts pointer events') ||
      message.includes('Another element would receive the click') ||
      message.includes('Element is not visible')
    )
  }

  /**
   * DEPRECATED: resolveBlockingOverlays removed
   * 
   * This method contained cookie bypass logic and has been completely removed.
   * Cookie handling is now exclusively handled by CookieBannerHandler.
   * Non-cookie popups are handled by NonCookiePopupHandler.
   * 
   * This stub exists only to prevent compilation errors from legacy call sites.
   * All call sites should be updated to remove calls to this method.
   */
  private async resolveBlockingOverlays(page: Page): Promise<boolean> {
    // Cookie handling bypass removed - always return false
    // Cookie handling must go through CookieBannerHandler
    // Non-cookie popups must go through NonCookiePopupHandler
    return false
  }

  private async applyClickSelfHealing(page: Page, action: LLMAction): Promise<SelfHealingInfo | null> {
    const originalSelector = action.selector
    const candidates = this.buildHealingCandidates(action)
    const tried = new Set<string>()

    for (const candidate of candidates) {
      if (!candidate.selector || tried.has(candidate.selector)) {
        continue
      }
      tried.add(candidate.selector)
      try {
        await this.performClick(page, candidate.selector, { fromHealing: true })
        console.log(`Playwright: Self-healing succeeded via ${candidate.strategy} → ${candidate.selector}`)
        return {
          strategy: candidate.strategy,
          originalSelector,
          healedSelector: candidate.selector,
          note: candidate.note,
          confidence: candidate.confidence,
        }
      } catch {
        continue
      }
    }

    return null
  }

  private buildHealingCandidates(action: LLMAction): HealingCandidate[] {
    const selector = action.selector || ''
    const candidates: HealingCandidate[] = []

    candidates.push(...this.getLocatorFallbacks(selector))
    candidates.push(...this.buildTextHeuristics(action))
    candidates.push(...this.buildAttributeHeuristics(selector))
    candidates.push(...this.buildStructuralHeuristics(selector))

    return candidates
  }

  private getLocatorFallbacks(selector: string): HealingCandidate[] {
    const fallbacks: HealingCandidate[] = []
    const hasTextRegex = /:has-text\((['"])(.+?)\1\)/
    const match = selector.match(hasTextRegex)
    if (match && match[2]) {
      const text = match[2]
      const escaped = text.replace(/"/g, '\\"')
      const xpath = `xpath=//*[contains(normalize-space(.), "${escaped}")]`
      fallbacks.push({
        selector: xpath,
        strategy: 'fallback',
        note: `Converted :has-text("${text}") selector to XPath text match`,
        confidence: 0.95,
      })
    }
    return fallbacks
  }

  private buildTextHeuristics(action: LLMAction): HealingCandidate[] {
    const text = this.extractTextHint(action)
    if (!text) return []
    const escaped = text.replace(/"/g, '\\"')
    return [
      {
        selector: `xpath=//*[self::button or self::a or @role="button"][contains(normalize-space(.), "${escaped}")]`,
        strategy: 'text',
        note: `Matched by visible text "${text}"`,
        confidence: 0.9,
      },
      {
        selector: `xpath=//*[contains(@aria-label, "${escaped}") or contains(@title, "${escaped}")]`,
        strategy: 'text',
        note: `Matched by aria-label/title containing "${text}"`,
        confidence: 0.9,
      },
    ]
  }

  private buildAttributeHeuristics(selector: string): HealingCandidate[] {
    const candidates: HealingCandidate[] = []
    if (!selector) return candidates

    const tagMatch = selector.match(/^[a-zA-Z]+/)
    const tag = tagMatch ? tagMatch[0] : ''

    const idMatch = selector.match(/#([\w-]+)/)
    if (idMatch) {
      const rawId = idMatch[1]
      const stablePrefix = rawId.replace(/[\d_]+$/g, '')
      if (stablePrefix && stablePrefix.length >= 3 && stablePrefix !== rawId) {
        const healed = `${tag ? `${tag}` : ''}[id^="${stablePrefix}"]`
        candidates.push({
          selector: healed,
          strategy: 'attribute',
          note: `Used ID prefix "${stablePrefix}" to match dynamic IDs`,
          confidence: 0.8,
        })
      }
    }

    const dataAttrMatch = selector.match(/\[(data-[^\]=]+)=["']?([^"' \]]+)["']?\]/)
    if (dataAttrMatch) {
      const attrName = dataAttrMatch[1]
      const attrValue = dataAttrMatch[2]
      const trimmed = attrValue.replace(/[\d_]+$/g, '')
      if (trimmed && trimmed.length >= 3 && trimmed !== attrValue) {
        candidates.push({
          selector: `[${attrName}^="${trimmed}"]`,
          strategy: 'attribute',
          note: `Used ${attrName} prefix "${trimmed}" to bypass dynamic suffixes`,
          confidence: 0.8,
        })
      }
    }

    return candidates
  }

  private buildStructuralHeuristics(selector: string): HealingCandidate[] {
    if (!selector) return []
    const stripped = selector
      .replace(/#[\w-]+/g, '')
      .replace(/\[data-[^\]]+\]/g, '')
      .replace(/\s+/g, ' ')
      .trim()

    if (!stripped || stripped === selector) {
      return []
    }

    return [{
      selector: stripped,
      strategy: 'position',
      note: 'Removed dynamic IDs and data attributes to rely on structural path',
      confidence: 0.5,
    }]
  }

  private extractTextHint(action: LLMAction): string | null {
    const candidates = [
      action.target,
      this.extractQuotedText(action.description || ''),
      action.description,
    ].filter(Boolean) as string[]

    for (const candidate of candidates) {
      const cleaned = candidate.trim()
      if (cleaned && cleaned.length <= 60) {
        return cleaned
      }
    }

    return null
  }

  private extractQuotedText(text: string): string | null {
    if (!text) return null
    const match = text.match(/["“”'‘’](.+?)["“”'‘’]/)
    return match?.[1] || null
  }

  private async logElementDebugInfo(page: Page, selector: string): Promise<void> {
    try {
      const locator = page.locator(selector)
      const exists = await locator.count().then(count => count > 0).catch(() => false)
      const visible = exists ? await locator.isVisible().catch(() => false) : false
      const enabled = exists ? await locator.isEnabled().catch(() => false) : false
      let details: any = {}
      if (exists) {
        details = await locator.first().evaluate((el) => ({
          tagName: el.tagName,
          text: el.textContent?.trim().substring(0, 80),
          classes: el.className,
          id: el.id,
        })).catch(() => ({}))
      }
      console.error('Playwright: Click failed. Element info:', JSON.stringify({ exists, visible, enabled, ...details }))
    } catch (infoError: any) {
      console.error('Playwright: Could not get element info:', infoError.message)
    }
  }

  private async logLinkExpectation(locator: ReturnType<Page['locator']>): Promise<void> {
    try {
      const tagName = await locator.evaluate((el) => el.tagName.toLowerCase()).catch(() => null)
      if (tagName === 'a') {
        const href = await locator.evaluate((el: HTMLAnchorElement) => el.href).catch(() => null)
        if (href && !href.startsWith('#')) {
          console.log(`Playwright: Link clicked but URL didn't change. Expected redirect to: ${href}`)
        }
      }
    } catch {
      // ignore
    }
  }

  /**
   * Get DOM snapshot
   * Uses real Playwright API to get page HTML
   */
  async getDOMSnapshot(sessionId: string): Promise<string> {
    const session = this.sessions.get(sessionId)
    if (!session) {
      throw new Error(`Session ${sessionId} not found`)
    }

    console.log('Playwright: Getting DOM snapshot for session:', sessionId)

    try {
      // Get the full HTML content of the page
      const html = await session.page.content()
      return html
    } catch (error: any) {
      console.error('Playwright: Failed to get DOM snapshot:', error.message)
      throw new Error(`Failed to get DOM snapshot: ${error.message}`)
    }
  }

  /**
   * Get video file path (video is finalized when context closes)
   * Note: This should be called after releaseSession
   */
  async getVideoPath(sessionId: string): Promise<string | null> {
    // Video path is only available after context closes
    // We'll get it from the page.video() after closing
    return null // Will be handled in releaseSession
  }

  /**
   * Release session and finalize video and trace
   * Closes browser and releases resources
   */
  async releaseSession(sessionId: string): Promise<{ videoPath: string | null; tracePath: string | null }> {
    const session = this.sessions.get(sessionId)
    if (!session) {
      console.warn('Playwright: Session not found:', sessionId)
      return { videoPath: null, tracePath: null }
    }

    console.log('Playwright: Releasing session:', sessionId)

    try {
      // Get video object before closing
      const video = session.page.video()

      // Stop and save trace (Time-Travel Debugger)
      const tracePath = `./traces/trace_${sessionId}_${Date.now()}.zip`
      let traceSuccess = false
      let finalTracePath = tracePath

      // Only attempt to save trace if tracing was started and context is still valid
      if (session.tracingStarted) {
        try {
          const fs = require('fs')
          const path = require('path')
          const zlib = require('zlib')
          const { pipeline } = require('stream/promises')

          // Ensure traces directory exists
          const tracesDir = path.dirname(tracePath)
          if (!fs.existsSync(tracesDir)) {
            fs.mkdirSync(tracesDir, { recursive: true })
          }

          // Save trace - tracing.stop() is async and writes the file
          await session.context.tracing.stop({ path: tracePath })

          // Wait a bit for file to be written (tracing.stop() is async)
          let retries = 10
          while (retries > 0 && !fs.existsSync(tracePath)) {
            await new Promise(resolve => setTimeout(resolve, 100))
            retries--
          }

          if (fs.existsSync(tracePath)) {
            // Additional compression with gzip (level 9)
            // Playwright's trace.zip is already compressed, but gzip can reduce it further
            const compressedPath = `${tracePath}.gz`

            try {
              const gzip = zlib.createGzip({ level: 9 })
              const source = fs.createReadStream(tracePath)
              const destination = fs.createWriteStream(compressedPath)

              await pipeline(source, gzip, destination)

              // Verify compressed file exists
              if (fs.existsSync(compressedPath)) {
                const originalSize = fs.statSync(tracePath).size
                const compressedSize = fs.statSync(compressedPath).size
                const savings = ((1 - compressedSize / originalSize) * 100).toFixed(1)

                console.log(`Playwright: Trace compressed: ${(originalSize / 1024 / 1024).toFixed(2)}MB → ${(compressedSize / 1024 / 1024).toFixed(2)}MB (${savings}% reduction)`)

                // Delete original uncompressed file
                fs.unlinkSync(tracePath)

                finalTracePath = compressedPath
                traceSuccess = true
              }
            } catch (compressionError: any) {
              console.error('Playwright: Failed to compress trace:', compressionError.message)
              // Fall back to uncompressed trace
              traceSuccess = true
              finalTracePath = tracePath
            }
          }

          if (traceSuccess) {
            console.log('Playwright: Trace saved:', finalTracePath)
          } else {
            console.warn('Playwright: Trace file not found after tracing.stop()')
          }
        } catch (error: any) {
          // Check what type of error occurred
          if (error.message?.includes('closed')) {
            console.error('Playwright: Context already closed, cannot save trace')
          } else if (!session.tracingStarted) {
            console.error('Playwright: Tracing was never started')
          } else {
            console.error('Playwright: Failed to save trace:', error.message)
            if (error.stack) {
              console.error('Playwright: Trace error stack:', error.stack)
            }
          }
          traceSuccess = false
        }
      } else {
        if (!session.tracingStarted) {
          console.warn('Playwright: Tracing was not started, skipping trace save')
        }
        traceSuccess = false
      }

      // Close page first
      await session.page.close().catch(() => { })

      // Close context - this finalizes the video
      await session.context.close().catch(() => { })

      // Get video path after context closes (video is finalized)
      let videoPath: string | null = null
      if (video) {
        try {
          videoPath = await video.path()
          console.log('Playwright: Video path:', videoPath)
        } catch (error: any) {
          console.error('Playwright: Failed to get video path:', error.message)
        }
      }

      // Close browser
      await session.browser.close().catch(() => { })

      this.sessions.delete(sessionId)
      console.log('Playwright: Session released:', sessionId)

      // Return video and trace paths if available
      return {
        videoPath,
        tracePath: traceSuccess ? finalTracePath : null
      }
    } catch (error: any) {
      console.error('Playwright: Error releasing session:', error.message)
      // Still remove from map even if close fails
      this.sessions.delete(sessionId)
      throw error
    }
  }

  /**
   * Check if session exists
   */
  hasSession(sessionId: string): boolean {
    return this.sessions.has(sessionId)
  }

  /**
   * Capture element bounding boxes for visual annotations (Iron Man HUD)
   * Returns coordinates of all interactive elements on the page
   */
  async captureElementBounds(sessionId: string): Promise<Array<{
    selector: string
    bounds: { x: number; y: number; width: number; height: number }
    type: string
    text?: string
    interactionType?: 'clicked' | 'typed' | 'analyzed' | 'failed' | 'healed'
  }>> {
    const session = this.sessions.get(sessionId)
    if (!session) {
      throw new Error('Session not found')
    }

    try {
      // Extract all interactive elements with their bounding boxes
      // Unified approach with shared inline selector generation pattern
      const elementsWithBounds = await session.page.evaluate(() => {
        const result: Array<{
          selector: string
          bounds: { x: number; y: number; width: number; height: number }
          type: string
          text?: string
        }> = []

        // Unified element processing with fully inlined selector generation
        // Priority: id > data-testid > data-id > name > className > defaultTag
        // Element type configurations (no functions to avoid serialization issues)
        const elementConfigs = [
          { selector: 'button', type: 'button', hasName: false },
          { selector: 'a', type: 'link', hasName: false },
          { selector: 'input:not([type="hidden"])', type: 'input', hasName: true },
          { selector: 'textarea', type: 'textarea', hasName: true },
          { selector: 'select', type: 'select', hasName: true }
        ]

        // Process all element types in unified loop
        for (let configIdx = 0; configIdx < elementConfigs.length; configIdx++) {
          const config = elementConfigs[configIdx]
          const elements = document.querySelectorAll(config.selector)

          for (let i = 0; i < elements.length; i++) {
            const el = elements[i]
            const rect = el.getBoundingClientRect()

            if (rect.width > 0 && rect.height > 0) {
              // Fully inlined selector generation (no function calls)
              let selector = ''
              if (el.id) {
                selector = '#' + el.id
              } else {
                const testId = el.getAttribute('data-testid')
                if (testId) {
                  selector = '[data-testid="' + testId + '"]'
                } else {
                  const dataId = el.getAttribute('data-id')
                  if (dataId) {
                    selector = '[data-id="' + dataId + '"]'
                  } else {
                    const name = el.getAttribute('name')
                    if (name) {
                      selector = '[name="' + name + '"]'
                    } else {
                      const className = el.className
                      if (className && typeof className === 'string') {
                        const classes = className.trim().split(/\s+/)
                        if (classes.length > 0 && classes[0].length > 0) {
                          selector = '.' + classes[0]
                        }
                      }
                      if (!selector) {
                        selector = config.type
                      }
                    }
                  }
                }
              }

              // Extract text based on element type (fully inlined)
              let text: string | undefined = undefined
              if (config.type === 'button' || config.type === 'link') {
                const textContent = (el as HTMLElement).textContent
                if (textContent) {
                  text = textContent.trim().substring(0, 50)
                }
              } else if (config.type === 'input') {
                const input = el as HTMLInputElement
                text = input.placeholder || input.name || input.type
              } else if (config.type === 'textarea') {
                const textarea = el as HTMLTextAreaElement
                text = textarea.placeholder || textarea.name
              } else if (config.type === 'select') {
                const select = el as HTMLSelectElement
                text = select.getAttribute('aria-label') || select.name || undefined
              }

              result.push({
                selector,
                bounds: {
                  x: Math.round(rect.x),
                  y: Math.round(rect.y),
                  width: Math.round(rect.width),
                  height: Math.round(rect.height)
                },
                type: config.type,
                text
              })
            }
          }
        }

        return result
      })

      console.log(`Playwright: Captured ${elementsWithBounds.length} element bounds`)
      return elementsWithBounds
    } catch (error: any) {
      console.error('Playwright: Failed to capture element bounds:', error.message)
      return []
    }
  }
}

