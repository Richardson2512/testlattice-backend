// Assertion actions for Playwright
import { Page } from 'playwright'
import { LLMAction } from '../../../types'

// Conditional logging
const DEBUG = process.env.DEBUG === 'true' || process.env.NODE_ENV === 'development'
const log = DEBUG ? console.log.bind(console) : () => {}

export class AssertionActions {
  /**
   * Assert various conditions on an element
   */
  async assert(page: Page, action: LLMAction): Promise<void> {
    if (!action.selector) {
      throw new Error('Selector required for assert action')
    }
    
    // Parse assertion type and expected value from action.value
    // Format: "type:expected" or just "type"
    const assertionParts = action.value?.split(':') || []
    const assertionType = assertionParts[0] || 'exists'
    const expectedValue = assertionParts.slice(1).join(':') || null
    
    log(`Playwright: Asserting ${assertionType} for element:`, action.selector, expectedValue ? `(expected: ${expectedValue})` : '')
    
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
          log('Playwright: Assertion passed - element exists')
          break
          
        case 'visible':
          const isVisible = await locator.first().isVisible()
          if (!isVisible) {
            throw new Error(`Element ${action.selector} is not visible`)
          }
          log('Playwright: Assertion passed - element is visible')
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
          log(`Playwright: Assertion passed - value matches: "${expectedValue}"`)
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
          log('Playwright: Assertion passed - error message detected')
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
          log(`Playwright: Assertion passed - state is "${expectedValue}"`)
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
          log(`Playwright: Assertion passed - option "${expectedValue}" is selected`)
          break
          
        case 'text':
          if (!expectedValue) {
            throw new Error('Expected text required for text assertion')
          }
          const elementText = await locator.first().textContent() || ''
          if (!elementText.toLowerCase().includes(expectedValue.toLowerCase())) {
            throw new Error(`Text assertion failed: expected to find "${expectedValue}", got "${elementText}"`)
          }
          log(`Playwright: Assertion passed - text contains "${expectedValue}"`)
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
          log('Playwright: Assertion passed - element info:', JSON.stringify(elementInfo, null, 2))
      }
      
    } catch (error: any) {
      console.error('Playwright: Assertion failed:', error.message)
      const { formatErrorForStep } = await import('../../../utils/errorFormatter')
      const formattedError = formatErrorForStep(error, { action: action.action, selector: action.selector })
      throw new Error(`Assertion failed for ${action.selector}: ${formattedError}`)
    }
  }
}

