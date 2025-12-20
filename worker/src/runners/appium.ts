import { remote } from 'webdriverio'
import { TestProfile, LLMAction, DeviceProfile, ActionExecutionResult } from '../types'
import { validateUrlOrThrow } from '../utils/urlValidator'

export interface MobileSession {
  id: string
  profile: TestProfile
  startedAt: string
  deviceId?: string
  driver?: any
}

export class AppiumRunner {
  private appiumUrl: string
  private sessions: Map<string, MobileSession> = new Map()

  constructor(appiumUrl: string) {
    this.appiumUrl = appiumUrl || 'http://localhost:4723'
  }

  /**
   * Reserve a device session
   * Creates a real Appium WebDriver session
   */
  async reserveSession(profile: TestProfile): Promise<MobileSession> {
    console.log('Appium: Reserving session for profile:', profile.device)

    const sessionId = `appium_${Date.now()}_${Math.random().toString(36).substr(2, 9)} `

    try {
      // Determine capabilities based on device profile
      const capabilities = this.getCapabilities(profile)

      // Connect to Appium server and create session
      const driver = await remote({
        hostname: this.getHostname(),
        port: this.getPort(),
        path: '/',
        capabilities,
        connectionRetryCount: 3,
        connectionRetryTimeout: 10000,
      } as any)

      const session: MobileSession = {
        id: sessionId,
        profile,
        startedAt: new Date().toISOString(),
        deviceId: capabilities['appium:udid'] || capabilities['appium:deviceName'] || 'unknown',
        driver,
      }

      this.sessions.set(sessionId, session)

      console.log('Appium: Session reserved:', sessionId, 'on device:', session.deviceId)

      return session
    } catch (error: any) {
      console.error('Appium: Failed to create session:', error.message)
      throw new Error(`Failed to create Appium session: ${error.message} `)
    }
  }

  /**
   * Get capabilities for device profile
   */
  private getCapabilities(profile: TestProfile): any {
    const baseCapabilities: any = {
      'appium:newCommandTimeout': 300,
      'appium:autoGrantPermissions': true,
    }

    if (profile.device === DeviceProfile.ANDROID_EMULATOR) {
      return {
        ...baseCapabilities,
        platformName: 'Android',
        'appium:automationName': 'UiAutomator2',
        'appium:deviceName': 'Android Emulator',
        'appium:platformVersion': '11.0', // Default, can be overridden
        'appium:app': profile.viewport ? undefined : undefined, // App path if provided
        'appium:noReset': false,
        'appium:fullReset': false,
      }
    } else if (profile.device === DeviceProfile.IOS_SIMULATOR) {
      return {
        ...baseCapabilities,
        platformName: 'iOS',
        'appium:automationName': 'XCUITest',
        'appium:deviceName': 'iPhone Simulator',
        'appium:platformVersion': '15.0', // Default, can be overridden
        'appium:app': profile.viewport ? undefined : undefined, // App path if provided
        'appium:noReset': false,
        'appium:fullReset': false,
      }
    } else {
      // Default to Android if unknown
      return {
        ...baseCapabilities,
        platformName: 'Android',
        'appium:automationName': 'UiAutomator2',
        'appium:deviceName': 'Android Device',
        'appium:platformVersion': '11.0',
      }
    }
  }

  /**
   * Parse hostname from Appium URL
   */
  private getHostname(): string {
    try {
      const url = new URL(this.appiumUrl)
      return url.hostname
    } catch {
      return 'localhost'
    }
  }

  /**
   * Parse port from Appium URL
   */
  private getPort(): number {
    try {
      const url = new URL(this.appiumUrl)
      return parseInt(url.port || '4723', 10)
    } catch {
      return 4723
    }
  }

  /**
   * Capture screenshot
   * Uses real Appium WebDriver API to capture screenshot
   */
  async captureScreenshot(sessionId: string): Promise<string> {
    const session = this.sessions.get(sessionId)
    if (!session || !session.driver) {
      throw new Error(`Session ${sessionId} not found or driver not initialized`)
    }

    console.log('Appium: Capturing screenshot for session:', sessionId)

    try {
      // Use WebDriverIO to capture screenshot
      const screenshot = await session.driver.takeScreenshot()
      return screenshot
    } catch (error: any) {
      console.error('Appium: Failed to capture screenshot:', error.message)
      throw new Error(`Failed to capture screenshot: ${error.message} `)
    }
  }

  /**
   * Execute action
   * Uses real Appium WebDriver API to execute actions
   */
  async executeAction(sessionId: string, action: LLMAction): Promise<ActionExecutionResult | void> {
    const session = this.sessions.get(sessionId)
    if (!session || !session.driver) {
      throw new Error(`Session ${sessionId} not found or driver not initialized`)
    }

    console.log('Appium: Executing action:', action.action, action.target)

    const { driver } = session

    try {
      switch (action.action) {
        case 'click':
          if (!action.selector) {
            throw new Error('Selector required for click action')
          }
          console.log('Appium: Tapping element:', action.selector)
          // Try different selector strategies
          const clickElement = await this.findElement(driver, action.selector)
          await clickElement.click()
          // Wait a bit after click for UI to update
          await driver.pause(500)
          break

        case 'type':
          if (!action.selector || !action.value) {
            throw new Error('Selector and value required for type action')
          }
          console.log('Appium: Typing into element:', action.selector, 'value:', action.value)
          const typeElement = await this.findElement(driver, action.selector)
          await typeElement.clearValue()
          await typeElement.setValue(action.value)
          break

        case 'scroll':
          console.log('Appium: Scrolling')
          // Scroll down using swipe gesture
          const windowSize = await driver.getWindowSize()
          const startX = windowSize.width / 2
          const startY = windowSize.height * 0.8
          const endY = windowSize.height * 0.2
          await driver.touchAction([
            { action: 'press', x: startX, y: startY },
            { action: 'wait', ms: 500 },
            { action: 'moveTo', x: startX, y: endY },
            { action: 'release' }
          ])
          await driver.pause(500)
          break

        case 'navigate':
          if (!action.value) {
            throw new Error('URL required for navigate action')
          }
          console.log('Appium: Navigating to:', action.value)
          // For mobile apps, navigation might mean launching an activity or deep link
          // For web apps on mobile, use getUrl
          if (action.value.startsWith('http://') || action.value.startsWith('https://')) {
            // SECURITY: Validate URL to prevent SSRF attacks
            // Block localhost, private IPs, and cloud metadata endpoints
            validateUrlOrThrow(action.value)

            await driver.url(action.value)
          } else {
            // Assume it's an app activity or deep link (no URL validation needed for app IDs)
            await driver.execute('mobile: activateApp', { appId: action.value })
          }
          await driver.pause(1000)
          break

        case 'wait':
          console.log('Appium: Waiting')
          await driver.pause(1000)
          break

        case 'assert':
          // For assert actions, check if element exists
          if (action.selector) {
            const assertElement = await this.findElement(driver, action.selector)
            if (!assertElement) {
              throw new Error(`Assertion failed: element not found: ${action.selector} `)
            }
            console.log('Appium: Assertion passed - element found:', action.selector)
          }
          break

        default:
          console.warn('Appium: Unknown action:', action.action)
      }
      return
    } catch (error: any) {
      console.error('Appium: Action execution failed:', error.message)
      const { formatErrorForStep } = await import('../utils/errorFormatter')
      const formattedError = formatErrorForStep(error, { action: action.action, selector: action.selector })
      throw new Error(`Failed to execute action ${action.action}: ${formattedError} `)
    }
  }

  /**
   * Find element using various selector strategies
   */
  private async findElement(driver: any, selector: string): Promise<any> {
    // Try different selector strategies
    const strategies = [
      // ID selector
      () => driver.$(`#${selector} `),
      // Resource ID (Android)
      () => driver.$(`android = new UiSelector().resourceId("${selector}")`),
      // Accessibility ID
      () => driver.$(`~${selector} `),
      // XPath
      () => driver.$(`//*[@resource-id="${selector}"]`),
      // Class name
      () => driver.$(`.${selector}`),
      // Direct selector (if it's already a valid selector)
      () => driver.$(selector),
    ]

    for (const strategy of strategies) {
      try {
        const element = await strategy()
        if (await element.isExisting()) {
          return element
        }
      } catch {
        // Try next strategy
        continue
      }
    }

    throw new Error(`Element not found with selector: ${selector}`)
  }

  /**
   * Get current URL
   */
  async getCurrentUrl(sessionId: string): Promise<string> {
    const session = this.sessions.get(sessionId)
    if (!session || !session.driver) {
      throw new Error(`Session ${sessionId} not found or driver not initialized`)
    }

    try {
      return await session.driver.getUrl()
    } catch (error: any) {
      console.warn('Appium: Failed to get URL:', error.message)
      return ''
    }
  }

  /**
   * Get page source (mobile equivalent of DOM snapshot)
   * Uses real Appium WebDriver API to get page source
   */
  async getPageSource(sessionId: string): Promise<string> {
    const session = this.sessions.get(sessionId)
    if (!session || !session.driver) {
      throw new Error(`Session ${sessionId} not found or driver not initialized`)
    }

    console.log('Appium: Getting page source for session:', sessionId)

    try {
      // Get page source (XML for Android, XML for iOS)
      const pageSource = await session.driver.getPageSource()
      return pageSource
    } catch (error: any) {
      console.error('Appium: Failed to get page source:', error.message)
      throw new Error(`Failed to get page source: ${error.message}`)
    }
  }

  /**
   * Release session
   * Closes app and releases resources
   */
  async releaseSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId)
    if (!session) {
      console.warn('Appium: Session not found:', sessionId)
      return
    }

    console.log('Appium: Releasing session:', sessionId)

    try {
      if (session.driver) {
        // Close the session
        await session.driver.deleteSession()
      }

      this.sessions.delete(sessionId)
      console.log('Appium: Session released:', sessionId)
    } catch (error: any) {
      console.error('Appium: Error releasing session:', error.message)
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
