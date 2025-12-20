// Form actions for Playwright (check, uncheck, select, submit)
import { Page } from 'playwright'
import { LLMAction } from '../../../types'

// Conditional logging
const DEBUG = process.env.DEBUG === 'true' || process.env.NODE_ENV === 'development'
const log = DEBUG ? console.log.bind(console) : () => {}

export class FormActions {
  /**
   * Check a checkbox or radio button
   */
  async check(page: Page, action: LLMAction): Promise<void> {
    if (!action.selector) {
      throw new Error('Selector required for check action')
    }
    
    log('Playwright: Checking checkbox:', action.selector)
    
    try {
      const locator = page.locator(action.selector)
      await locator.waitFor({ state: 'visible', timeout: 10000 })
      
      // Verify it's a checkbox or radio button
      const elementType = await locator.first().evaluate((el: any) => el.type)
      if (elementType !== 'checkbox' && elementType !== 'radio') {
        throw new Error(`Element ${action.selector} is not a checkbox or radio button (type: ${elementType})`)
      }
      
      // Check if already checked
      const isChecked = await locator.isChecked()
      if (!isChecked) {
        await locator.check({ timeout: 10000 })
        log('Playwright: Checkbox checked successfully')
      } else {
        log('Playwright: Checkbox already checked, skipping')
      }
    } catch (error: any) {
      const { formatErrorForStep } = await import('../../../utils/errorFormatter')
      const formattedError = formatErrorForStep(error, { action: action.action, selector: action.selector })
      throw new Error(`Failed to check element ${action.selector}: ${formattedError}`)
    }
  }

  /**
   * Uncheck a checkbox
   */
  async uncheck(page: Page, action: LLMAction): Promise<void> {
    if (!action.selector) {
      throw new Error('Selector required for uncheck action')
    }
    
    log('Playwright: Unchecking checkbox:', action.selector)
    
    try {
      const locator = page.locator(action.selector)
      await locator.waitFor({ state: 'visible', timeout: 10000 })
      
      // Verify it's a checkbox
      const elementType = await locator.first().evaluate((el: any) => el.type)
      if (elementType !== 'checkbox') {
        throw new Error(`Element ${action.selector} is not a checkbox (type: ${elementType})`)
      }
      
      // Check if already unchecked
      const isChecked = await locator.isChecked()
      if (isChecked) {
        await locator.uncheck({ timeout: 10000 })
        log('Playwright: Checkbox unchecked successfully')
      } else {
        log('Playwright: Checkbox already unchecked, skipping')
      }
    } catch (error: any) {
      const { formatErrorForStep } = await import('../../../utils/errorFormatter')
      const formattedError = formatErrorForStep(error, { action: action.action, selector: action.selector })
      throw new Error(`Failed to uncheck element ${action.selector}: ${formattedError}`)
    }
  }

  /**
   * Select an option from a dropdown
   */
  async select(page: Page, action: LLMAction): Promise<void> {
    if (!action.selector || !action.value) {
      throw new Error('Selector and value required for select action')
    }
    
    log('Playwright: Selecting option:', action.value, 'from:', action.selector)
    
    try {
      const locator = page.locator(action.selector)
      await locator.waitFor({ state: 'visible', timeout: 10000 })
      
      // Verify it's a select element
      const tagName = await locator.first().evaluate((el: any) => el.tagName)
      if (tagName.toLowerCase() !== 'select') {
        throw new Error(`Element ${action.selector} is not a select dropdown (tag: ${tagName})`)
      }
      
      // Try to select by value, label, or index
      try {
        await locator.selectOption(action.value, { timeout: 10000 })
        log('Playwright: Option selected successfully')
      } catch (selectError) {
        // If direct selection fails, try by label
        try {
          await locator.selectOption({ label: action.value }, { timeout: 10000 })
          log('Playwright: Option selected by label successfully')
        } catch (labelError) {
          // If label selection fails, try by index if value is a number
          if (!isNaN(Number(action.value))) {
            await locator.selectOption({ index: Number(action.value) }, { timeout: 10000 })
            log('Playwright: Option selected by index successfully')
          } else {
            throw selectError
          }
        }
      }
    } catch (error: any) {
      const { formatErrorForStep } = await import('../../../utils/errorFormatter')
      const formattedError = formatErrorForStep(error, { action: action.action, selector: action.selector })
      throw new Error(`Failed to select option ${action.value} from ${action.selector}: ${formattedError}`)
    }
  }

  /**
   * Submit a form
   */
  async submit(page: Page, action: LLMAction): Promise<void> {
    if (!action.selector) {
      throw new Error('Selector required for submit action')
    }
    
    log('Playwright: Submitting form via:', action.selector)
    
    try {
      const locator = page.locator(action.selector)
      await locator.waitFor({ state: 'visible', timeout: 10000 })
      
      // Try pressing Enter first (most reliable for forms)
      try {
        await locator.press('Enter', { timeout: 10000 })
        log('Playwright: Form submitted via Enter key')
      } catch (enterError) {
        // If Enter doesn't work, try clicking if it's a button
        try {
          await locator.click({ timeout: 10000 })
          log('Playwright: Form submitted via click')
        } catch (clickError) {
          // If clicking doesn't work, try evaluating form.submit()
          await page.evaluate((selector) => {
            const el = document.querySelector(selector)
            if (!el) throw new Error('Element not found')
            
            // Find the parent form
            let form = el.closest('form')
            if (!form && (el as any).tagName === 'FORM') {
              form = el as any
            }
            
            if (form) {
              (form as HTMLFormElement).submit()
            } else {
              throw new Error('No form found')
            }
          }, action.selector)
          log('Playwright: Form submitted via form.submit()')
        }
      }
      
      await page.waitForTimeout(1000) // Wait for submission to process
    } catch (error: any) {
      const { formatErrorForStep } = await import('../../../utils/errorFormatter')
      const formattedError = formatErrorForStep(error, { action: action.action, selector: action.selector })
      throw new Error(`Failed to submit form ${action.selector}: ${formattedError}`)
    }
  }
}

