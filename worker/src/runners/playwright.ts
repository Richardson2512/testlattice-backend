// Playwright runner using real Playwright API
import { chromium, firefox, webkit, Browser, Page, BrowserContext } from 'playwright'
import { TestProfile, LLMAction, DeviceProfile, ActionExecutionResult, SelfHealingInfo } from '../types'

// Import action modules
import { NavigationActions } from './playwright/actions/navigation'
import { InteractionActions } from './playwright/actions/interaction'
import { FormActions } from './playwright/actions/formActions'
import { AssertionActions } from './playwright/actions/assertions'
import { ViewportActions } from './playwright/actions/viewportActions'

// Import utility modules
import { OverlayResolver } from './playwright/utils/overlayResolver'
import { ElementUtils } from './playwright/utils/elementUtils'
import { SelfHealingService } from './playwright/healing/selfHealing'

// Conditional logging - only log in development or when DEBUG is enabled
const DEBUG = process.env.DEBUG === 'true' || process.env.NODE_ENV === 'development'
const log = DEBUG ? console.log.bind(console) : () => {}
const logError = console.error.bind(console) // Always log errors
const logWarn = DEBUG ? console.warn.bind(console) : () => {}

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

export class PlaywrightRunner {
  private gridUrl: string | null
  private sessions: Map<string, RunnerSession> = new Map()
  
  // Action modules
  private navigationActions: NavigationActions
  private interactionActions: InteractionActions
  private formActions: FormActions
  private assertionActions: AssertionActions
  private viewportActions: ViewportActions
  
  // Utility modules
  private overlayResolver: OverlayResolver
  private elementUtils: ElementUtils
  private selfHealingService: SelfHealingService

  constructor(gridUrl?: string) {
    // gridUrl is optional - if not provided, use Playwright directly
    this.gridUrl = gridUrl || null
    
    // Initialize utility modules
    this.overlayResolver = new OverlayResolver()
    this.elementUtils = new ElementUtils()
    this.selfHealingService = new SelfHealingService()
    
    // Initialize action modules with dependencies
    this.interactionActions = new InteractionActions({
      resolveBlockingOverlays: (page: Page) => this.overlayResolver.resolveBlockingOverlays(page),
      tryClick: (page: Page, action: LLMAction) => this.tryClick(page, action),
      logElementDebugInfo: (page: Page, selector: string) => this.elementUtils.logElementDebugInfo(page, selector),
    })
    
    this.navigationActions = new NavigationActions()
    this.formActions = new FormActions()
    this.assertionActions = new AssertionActions()
    this.viewportActions = new ViewportActions()
  }

  /**
   * Reserve a browser session
   * Creates a real Playwright browser instance
   */
  async reserveSession(profile: TestProfile): Promise<RunnerSession> {
    log('Playwright: Reserving session for profile:', profile.device)
    
    const sessionId = `playwright_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    
    // Determine browser type, viewport, and mobile settings from device profile
    let browserType = chromium // Default to Chromium
    let viewport = profile.viewport || { width: 1280, height: 720 }
    let isMobile = false
    let hasTouch = false
    let userAgent: string | undefined = undefined
    
    switch (profile.device) {
      case DeviceProfile.CHROME_LATEST:
        browserType = chromium
        viewport = profile.viewport || { width: 1920, height: 1080 }
        break
        
      case DeviceProfile.FIREFOX_LATEST:
        browserType = firefox
        viewport = profile.viewport || { width: 1920, height: 1080 }
        break
        
      case DeviceProfile.SAFARI_LATEST:
        browserType = webkit
        viewport = profile.viewport || { width: 1440, height: 900 }
        break
        
      case DeviceProfile.MOBILE_CHROME:
        browserType = chromium
        viewport = profile.viewport || { width: 390, height: 844 }  // iPhone 12
        isMobile = true
        hasTouch = true
        userAgent = 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36'
        break
        
      case DeviceProfile.MOBILE_SAFARI:
        browserType = webkit
        viewport = profile.viewport || { width: 390, height: 844 }  // iPhone 12
        isMobile = true
        hasTouch = true
        userAgent = 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1'
        break
        
      case DeviceProfile.MOBILE_CHROME_ANDROID:
        browserType = chromium
        viewport = profile.viewport || { width: 360, height: 640 }  // Android
        isMobile = true
        hasTouch = true
        userAgent = 'Mozilla/5.0 (Linux; Android 11) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36'
        break
        
      default:
        // Fallback to chromium for unknown profiles
        browserType = chromium
        viewport = profile.viewport || { width: 1280, height: 720 }
    }
    
    log('Playwright: Browser config:', {
      type: browserType === chromium ? 'chromium' : browserType === firefox ? 'firefox' : 'webkit',
      viewport,
      isMobile,
      hasTouch
    })
    
    // Launch browser (headless by default for automation)
    const browser = await browserType.launch({
      headless: true,
    })
    
    // Create browser context with viewport settings, video recording, trace, and mobile settings
    const contextOptions: any = {
      viewport,
      isMobile,
      hasTouch,
      recordVideo: {
        dir: './videos/', // Video will be saved here
        size: viewport,
      },
    }
    
    // Add user agent for mobile devices
    if (userAgent) {
      contextOptions.userAgent = userAgent
    }
    
    const context = await browser.newContext(contextOptions)
    
    // Start trace recording (Time-Travel Debugger feature)
    // This records all actions, network requests, console logs, and DOM snapshots
    let tracingStarted = false
    try {
      await context.tracing.start({
        screenshots: true,
        snapshots: true,
        sources: true,
      })
      tracingStarted = true
      log('Playwright: Tracing started successfully')
    } catch (traceStartError: any) {
      logError('Playwright: Failed to start tracing:', traceStartError.message)
      // Continue without tracing - don't fail session creation
      // Tracing is optional for test execution
    }
    
    const page = await context.newPage()
    
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
      
      // Expose functions to show cursor and click
      ;(window as any).__playwrightShowCursor = (x: number, y: number) => {
        cursor.style.left = x + 'px'
        cursor.style.top = y + 'px'
        cursor.style.display = 'block'
        cursor.style.opacity = '1'
      }
      
      ;(window as any).__playwrightHideCursor = () => {
        cursor.style.opacity = '0'
        setTimeout(() => {
          cursor.style.display = 'none'
        }, 200)
      }
      
      ;(window as any).__playwrightShowClick = (x: number, y: number) => {
        ripple.style.left = x + 'px'
        ripple.style.top = y + 'px'
        ripple.style.display = 'block'
        ripple.style.width = '40px'
        ripple.style.height = '40px'
        ripple.style.opacity = '0.8'
        ripple.style.transition = 'all 0.4s ease-out'
        
        // Animate ripple
        setTimeout(() => {
          ripple.style.width = '80px'
          ripple.style.height = '80px'
          ripple.style.opacity = '0'
        }, 10)
        
        setTimeout(() => {
          ripple.style.display = 'none'
        }, 400)
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
          logWarn(`[SECURITY] Blocked dangerous request to: ${requestUrl}`)
          logWarn(`[SECURITY] Reason: ${reason}`)
          logWarn(`[SECURITY] Type: ${resourceType}, Method: ${request.method()}`)
          
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
        logError(`[SECURITY] Error validating request to ${requestUrl}:`, error.message)
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
    
    log('Playwright: Session reserved:', sessionId, 'Browser:', profile.device)
    log('Playwright: Network-layer SSRF protection enabled for session:', sessionId)
    
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
    
    log('Playwright: Capturing screenshot for session:', sessionId, fullPage ? '(full page)' : '(viewport)')
    
    try {
      // Capture screenshot as base64
      const screenshot = await session.page.screenshot({
        type: 'png',
        fullPage: fullPage,
      })
      
      // Convert Buffer to base64 string
      return screenshot.toString('base64')
    } catch (error: any) {
      logError('Playwright: Failed to capture screenshot:', error.message)
      throw new Error(`Failed to capture screenshot: ${error.message}`)
    }
  }

  /**
   * Capture screenshot of a specific element
   * Uses element bounds to crop to exact element dimensions
   */
  async captureElementScreenshot(sessionId: string, selector: string): Promise<string> {
    const session = this.sessions.get(sessionId)
    if (!session) {
      throw new Error(`Session ${sessionId} not found`)
    }
    
    log('Playwright: Capturing element screenshot for:', selector)
    
    try {
      const locator = session.page.locator(selector)
      
      // Wait for element to be visible
      await locator.waitFor({ state: 'visible', timeout: 10000 })
      
      // Capture screenshot of the specific element
      const screenshot = await locator.screenshot({
        type: 'png',
      })
      
      log('Playwright: Element screenshot captured successfully')
      // Convert Buffer to base64 string
      return screenshot.toString('base64')
    } catch (error: any) {
      logError('Playwright: Failed to capture element screenshot:', error.message)
      throw new Error(`Failed to capture element screenshot for ${selector}: ${error.message}`)
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
      logError('Playwright: Failed to get page dimensions:', error.message)
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
      logError('Playwright: Failed to scroll to position:', error.message)
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
  async executeAction(sessionId: string, action: LLMAction): Promise<ActionExecutionResult | void> {
    const session = this.sessions.get(sessionId)
    if (!session) {
      throw new Error(`Session ${sessionId} not found`)
    }
    
    log('Playwright: Executing action:', action.action, action.target)
    
    const { page } = session
    
    try {
      let healingMeta: SelfHealingInfo | null = null
      switch (action.action) {
        case 'click':
          healingMeta = await this.interactionActions.click(page, action)
          break
          
        case 'type':
          await this.interactionActions.type(page, action)
          break
          
        case 'scroll':
          await this.interactionActions.scroll(page)
          break
          
        case 'wait':
          await this.interactionActions.wait(page, 1000)
          break
          
        case 'navigate':
          await this.navigationActions.navigate(page, action)
          break
          
        case 'check':
          await this.formActions.check(page, action)
          break
          
        case 'uncheck':
          await this.formActions.uncheck(page, action)
          break
          
        case 'select':
          await this.formActions.select(page, action)
          break
          
        case 'goBack':
          await this.navigationActions.goBack(page)
          break
          
        case 'goForward':
          await this.navigationActions.goForward(page)
          break
          
        case 'submit':
          await this.formActions.submit(page, action)
          break
          
        case 'assert':
          await this.assertionActions.assert(page, action)
          break
          
        case 'setViewport':
          await this.viewportActions.setViewport(page, action)
          break
          
        case 'setDevice':
          await this.viewportActions.setDevice(page, action)
          break
          
        case 'setOrientation':
          await this.viewportActions.setOrientation(page, action)
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
   * Called proactively before each action to prevent popups from blocking tests
   */
  async checkAndDismissOverlays(sessionId: string): Promise<boolean> {
    const session = this.sessions.get(sessionId)
    if (!session?.page) {
      return false
    }

    try {
      return await this.overlayResolver.resolveBlockingOverlays(session.page)
    } catch (error: any) {
      if (DEBUG) logWarn(`Playwright: Error checking overlays: ${error.message}`)
      return false
    }
  }

  private async tryClick(page: Page, action: LLMAction): Promise<SelfHealingInfo | null> {
    if (!action.selector) {
      throw new Error('Selector required for click action')
    }
    try {
      await this.performClick(page, action.selector)
      return null
    } catch (primaryError: any) {
      const healing = await this.selfHealingService.applyClickSelfHealing(
        page,
        action,
        (p: Page, selector: string, options?: { fromHealing?: boolean }) => this.performClick(p, selector, options)
      )
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
        
        log('Playwright: Click failed. Element info:', JSON.stringify(elementInfo))
        throw new Error(`Element ${selector} is not visible (may be hidden or off-screen)`)
      }
    }
    await ensureVisible()
    
    await locator.waitFor({ state: 'visible', timeout: 10000 })
    
    // Show cursor and click indicator before clicking
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
        
        // Show click animation
        await page.evaluate(({ x, y }: { x: number; y: number }) => {
          if ((window as any).__playwrightShowClick) {
            (window as any).__playwrightShowClick(x, y)
          }
        }, { x: centerX, y: centerY })
        
        // Wait for click animation
        await page.waitForTimeout(100)
      }
    } catch (indicatorError) {
      // If showing indicators fails, continue with click anyway
      if (DEBUG) logWarn('Failed to show click indicator:', indicatorError)
    }
    
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
      if (!options.fromHealing && this.isPointerInterceptionError(error)) {
        const resolved = await this.overlayResolver.resolveBlockingOverlays(page)
        if (resolved) {
          console.log(`Playwright: Blocking overlay dismissed while clicking ${selector}, retrying click...`)
          await locator.click({ timeout: 10000, force: false })
        } else {
          console.warn(`Playwright: Unable to resolve blocking overlay for ${selector}`)
          throw error
        }
      } else {
        throw error
      }
    }
    await page.waitForLoadState('networkidle', { timeout: 5000 }).catch((err) => {
      if (DEBUG) logWarn('Non-critical: networkidle timeout:', err.message)
    })
    const afterUrl = page.url()
    
    if (!options.fromHealing && beforeUrl === afterUrl) {
      await this.elementUtils.logLinkExpectation(locator)
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

  // Note: resolveBlockingOverlays, applyClickSelfHealing, and related methods
  // have been moved to separate modules (OverlayResolver, SelfHealingService, ElementUtils)

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
      // Check if context is closed by trying to access a property (will throw if closed)
      let contextIsOpen = true
      try {
        // Try to access a property to check if context is still open
        void session.context.pages()
      } catch {
        contextIsOpen = false
      }
      
      if (session.tracingStarted && contextIsOpen) {
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
            traceSuccess = true
            console.log('Playwright: Trace saved successfully:', tracePath)
          } else {
            console.warn('Playwright: Trace file not found after stop, may have failed')
          }
        } catch (traceError: any) {
          console.error('Playwright: Failed to save trace:', traceError.message)
        }
      }
      
      // Close context (this finalizes the video)
      await session.context.close()
      
      // Get video path after context closes
      let videoPath: string | null = null
      if (video) {
        try {
          videoPath = await video.path()
          console.log('Playwright: Video saved:', videoPath)
        } catch (videoError: any) {
          console.warn('Playwright: Failed to get video path:', videoError.message)
        }
      }
      
      // Close browser
      await session.browser.close()
      
      // Remove session from map
      this.sessions.delete(sessionId)
      
      console.log('Playwright: Session released:', sessionId)
      
      return {
        videoPath,
        tracePath: traceSuccess ? finalTracePath : null,
      }
    } catch (error: any) {
      console.error('Playwright: Error releasing session:', error.message)
      
      // Try to clean up even if there was an error
      try {
        // Check if context is still open before trying to close
        let contextIsOpen = true
        try {
          void session.context.pages()
        } catch {
          contextIsOpen = false
        }
        
        if (session.context && contextIsOpen) {
          await session.context.close()
        }
        if (session.browser && session.browser.isConnected()) {
          await session.browser.close()
        }
      } catch (cleanupError) {
        // Ignore cleanup errors
      }
      
      this.sessions.delete(sessionId)
      
      return { videoPath: null, tracePath: null }
    }
  }
}
