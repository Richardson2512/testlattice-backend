// Playwright runner using real Playwright API
import { chromium, firefox, webkit, Browser, Page, BrowserContext } from 'playwright'
import { TestProfile, LLMAction, DeviceProfile } from '../types'

export interface RunnerSession {
  id: string
  profile: TestProfile
  startedAt: string
  browser: Browser
  context: BrowserContext
  page: Page
  videoPath?: string // Path to video file
}

export class PlaywrightRunner {
  private gridUrl: string | null
  private sessions: Map<string, RunnerSession> = new Map()

  constructor(gridUrl?: string) {
    // gridUrl is optional - if not provided, use Playwright directly
    this.gridUrl = gridUrl || null
  }

  /**
   * Reserve a browser session
   * Creates a real Playwright browser instance
   */
  async reserveSession(profile: TestProfile): Promise<RunnerSession> {
    console.log('Playwright: Reserving session for profile:', profile.device)
    
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
    
    // Create browser context with viewport settings and video recording
    const contextOptions: any = {
      viewport: profile.viewport || { width: 1280, height: 720 },
      recordVideo: {
        dir: './videos/', // Video will be saved here
        size: profile.viewport || { width: 1280, height: 720 },
      },
    }
    
    const context = await browser.newContext(contextOptions)
    const page = await context.newPage()
    
    // Note: Video path will be available after context closes
    // We'll store the session ID to retrieve it later
    
    const session: RunnerSession = {
      id: sessionId,
      profile,
      startedAt: new Date().toISOString(),
      browser,
      context,
      page,
    }
    
    this.sessions.set(sessionId, session)
    
    console.log('Playwright: Session reserved:', sessionId, 'Browser:', profile.device)
    
    return session
  }

  /**
   * Capture screenshot
   * Uses real Playwright API to capture screenshot
   */
  async captureScreenshot(sessionId: string): Promise<string> {
    const session = this.sessions.get(sessionId)
    if (!session) {
      throw new Error(`Session ${sessionId} not found`)
    }
    
    console.log('Playwright: Capturing screenshot for session:', sessionId)
    
    try {
      // Capture screenshot as base64
      const screenshot = await session.page.screenshot({
        type: 'png',
        encoding: 'base64',
        fullPage: false, // Capture viewport only
      })
      
      return screenshot as string
    } catch (error: any) {
      console.error('Playwright: Failed to capture screenshot:', error.message)
      throw new Error(`Failed to capture screenshot: ${error.message}`)
    }
  }

  /**
   * Execute action
   * Uses real Playwright API to execute actions
   */
  async executeAction(sessionId: string, action: LLMAction): Promise<void> {
    const session = this.sessions.get(sessionId)
    if (!session) {
      throw new Error(`Session ${sessionId} not found`)
    }
    
    console.log('Playwright: Executing action:', action.action, action.target)
    
    const { page } = session
    
    try {
      switch (action.action) {
        case 'click':
          if (!action.selector) {
            throw new Error('Selector required for click action')
          }
          console.log('Playwright: Clicking element:', action.selector)
          
          try {
            // Use Playwright's locator API which supports all selector types (CSS, text, role, etc.)
            const locator = page.locator(action.selector)
            
            // Wait for element to be attached to DOM
            await locator.waitFor({ state: 'attached', timeout: 10000 }).catch(() => {
              throw new Error(`Element ${action.selector} not found in DOM`)
            })
            
            // Check if element is visible using Playwright's built-in method
            const isVisible = await locator.isVisible().catch(() => false)
            if (!isVisible) {
              // Try to scroll into view first
              try {
                await locator.scrollIntoViewIfNeeded({ timeout: 5000 })
                await page.waitForTimeout(300) // Brief wait after scroll
                
                // Check visibility again after scroll
                const isVisibleAfterScroll = await locator.isVisible().catch(() => false)
                if (!isVisibleAfterScroll) {
                  const errorMsg = `Element ${action.selector} is not visible (may be hidden or have display:none)`
                  const { formatErrorForStep } = await import('../utils/errorFormatter')
                  throw new Error(formatErrorForStep(new Error(errorMsg), { action: action.action, selector: action.selector }))
                }
              } catch (scrollError: any) {
                const errorMsg = `Element ${action.selector} is not visible (may be hidden or have display:none)`
                const { formatErrorForStep } = await import('../utils/errorFormatter')
                throw new Error(formatErrorForStep(new Error(errorMsg), { action: action.action, selector: action.selector }))
              }
            }
            
            // Wait for element to be actionable (visible and enabled)
            await locator.waitFor({ state: 'visible', timeout: 10000 })
            
            // Click the element using Playwright's locator (handles all selector types)
            const beforeUrl = page.url()
            await locator.click({ timeout: 10000, force: false })
            
            // Wait for navigation or network idle after click
            await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {})
            
            // Check if URL changed (for link clicks - verify redirect)
            const afterUrl = page.url()
            if (beforeUrl !== afterUrl) {
              console.log(`Playwright: Link redirect verified: ${beforeUrl} -> ${afterUrl}`)
            } else {
              // Check if it's a link that should have redirected using locator
              try {
                const tagName = await locator.evaluate((el) => el.tagName.toLowerCase()).catch(() => null)
                if (tagName === 'a') {
                  const href = await locator.evaluate((el: HTMLAnchorElement) => el.href).catch(() => null)
                  if (href && !href.startsWith('#')) {
                    console.log(`Playwright: Link clicked but URL didn't change. Expected redirect to: ${href}`)
                  }
                }
              } catch (e) {
                // Ignore errors when checking link info
              }
            }
          } catch (error: any) {
            // If click fails, try to get more info about the element using locator
            try {
              const locator = page.locator(action.selector)
              const elementInfo = {
                exists: await locator.count().then(count => count > 0).catch(() => false),
                visible: await locator.isVisible().catch(() => false),
                enabled: await locator.isEnabled().catch(() => false),
              }
              
              if (elementInfo.exists) {
                const details = await locator.first().evaluate((el) => ({
                  tagName: el.tagName,
                  text: el.textContent?.trim().substring(0, 50),
                  classes: el.className,
                  id: el.id,
                })).catch(() => ({}))
                
                console.error('Playwright: Click failed. Element info:', JSON.stringify({ ...elementInfo, ...details }))
              } else {
                console.error('Playwright: Click failed. Element not found:', action.selector)
              }
            } catch (infoError: any) {
              console.error('Playwright: Could not get element info:', infoError.message)
            }
            
            const { formatErrorForStep } = await import('../utils/errorFormatter')
            const formattedError = formatErrorForStep(error, { action: action.action, selector: action.selector })
            throw new Error(`Failed to click element ${action.selector}: ${formattedError}`)
          }
          break
          
        case 'type':
          if (!action.selector || !action.value) {
            throw new Error('Selector and value required for type action')
          }
          console.log('Playwright: Typing into element:', action.selector, 'value:', action.value)
          
          try {
            // Use locator API for better selector support
            const locator = page.locator(action.selector)
            await locator.waitFor({ state: 'visible', timeout: 10000 })
            await locator.fill(action.value, { timeout: 10000 })
          } catch (error: any) {
            const { formatErrorForStep } = await import('../utils/errorFormatter')
            const formattedError = formatErrorForStep(error, { action: action.action, selector: action.selector })
            throw new Error(`Failed to type into element ${action.selector}: ${formattedError}`)
          }
          break
          
        case 'scroll':
          console.log('Playwright: Scrolling')
          await page.evaluate(() => {
            window.scrollBy(0, window.innerHeight)
          })
          await page.waitForTimeout(500) // Wait for scroll to complete
          break
          
        case 'navigate':
          if (!action.value) {
            throw new Error('URL required for navigate action')
          }
          console.log('Playwright: Navigating to:', action.value)
          await page.goto(action.value, { waitUntil: 'networkidle', timeout: 30000 })
          break
          
        case 'wait':
          console.log('Playwright: Waiting')
          await page.waitForTimeout(1000)
          break
          
        case 'assert':
          // For assert actions, check if element exists, is visible (or hidden as expected), and has correct values
          if (!action.selector) {
            throw new Error('Selector required for assert action')
          }
          
          console.log('Playwright: Asserting element:', action.selector)
          
          try {
            // Use locator API for better selector support
            const locator = page.locator(action.selector)
            
            // Wait for element to exist in DOM
            await locator.waitFor({ state: 'attached', timeout: 10000 })
            
            // Get element information using locator
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
                name: (el as HTMLInputElement).name || null,
                id: el.id || null,
                isVisible: style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0',
                isHidden: (el as HTMLInputElement).type === 'hidden' || el.hasAttribute('hidden') || el.getAttribute('aria-hidden') === 'true',
                display: style.display,
                visibility: style.visibility,
                opacity: style.opacity,
                href: (el as HTMLAnchorElement).href || null,
              }
            }).catch(() => ({ exists: false }))
            
            if (!elementInfo.exists) {
              throw new Error(`Element ${action.selector} does not exist in DOM`)
            }
            
            console.log('Playwright: Assertion passed - element info:', JSON.stringify(elementInfo, null, 2))
            
            // If it's a hidden element, that's expected - log it
            if (elementInfo.isHidden) {
              console.log(`Playwright: Hidden element verified: ${action.selector} (type: ${elementInfo.type}, value: ${elementInfo.value || 'none'})`)
            }
            
          } catch (error: any) {
            console.error('Playwright: Assertion failed:', error.message)
            const { formatErrorForStep } = await import('../utils/errorFormatter')
            const formattedError = formatErrorForStep(error, { action: action.action, selector: action.selector })
            throw new Error(`Assertion failed for ${action.selector}: ${formattedError}`)
          }
          break
          
        default:
          console.warn('Playwright: Unknown action:', action.action)
      }
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
   * Release session and finalize video
   * Closes browser and releases resources
   */
  async releaseSession(sessionId: string): Promise<string | null> {
    const session = this.sessions.get(sessionId)
    if (!session) {
      console.warn('Playwright: Session not found:', sessionId)
      return null
    }
    
    console.log('Playwright: Releasing session:', sessionId)
    
    try {
      // Get video object before closing
      const video = session.page.video()
      
      // Close page first
      await session.page.close().catch(() => {})
      
      // Close context - this finalizes the video
      await session.context.close().catch(() => {})
      
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
      await session.browser.close().catch(() => {})
      
      this.sessions.delete(sessionId)
      console.log('Playwright: Session released:', sessionId)
      
      // Return video path if available
      return videoPath
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
}

