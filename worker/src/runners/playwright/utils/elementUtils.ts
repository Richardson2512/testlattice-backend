// Element utility functions for Playwright
import { Page } from 'playwright'

// Conditional logging
const DEBUG = process.env.DEBUG === 'true' || process.env.NODE_ENV === 'development'
const log = DEBUG ? console.log.bind(console) : () => {}

export class ElementUtils {
  /**
   * Log element debug info for troubleshooting
   */
  async logElementDebugInfo(page: Page, selector: string): Promise<void> {
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

  /**
   * Log link expectation (check if link click should navigate)
   */
  async logLinkExpectation(locator: ReturnType<Page['locator']>): Promise<void> {
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
}

