/**
 * God Mode Service
 * AI stuck detection, user intervention, and selector learning
 * 
 * When AI gets stuck after retries, this service:
 * 1. Detects the stuck state
 * 2. Pauses the test
 * 3. Waits for user to click the correct element
 * 4. Extracts the best selector from user's click
 * 5. Updates the action and resumes
 * 6. Logs the learning for future tests
 */

import { Page } from 'playwright'
import { LLMAction } from '../types'

export interface StuckDetection {
  isStuck: boolean
  reason: 'element_not_found' | 'selector_ambiguous' | 'element_not_clickable' | 'unclear_action' | 'timeout'
  attemptedAction: LLMAction
  attemptedSelector?: string
  error: string
  retryCount: number
  suggestedIntervention: string
}

export interface ElementProperties {
  tagName: string
  id?: string
  classes: string[]
  dataTestId?: string
  text?: string
  ariaLabel?: string
  role?: string
  name?: string
  type?: string
  placeholder?: string
  href?: string
}

export interface SelectorExtractionResult {
  element: ElementProperties
  bestSelector: string
  selectorPriority: 'id' | 'data-testid' | 'aria-label' | 'role' | 'name' | 'class' | 'text' | 'xpath'
  alternativeSelectors: string[]
  uniqueness: number  // How many elements match this selector (should be 1)
}

export interface InterventionLog {
  runId: string
  stepNumber: number
  timestamp: string
  
  // What AI tried
  aiAttempted: {
    action: string
    selector?: string
    target?: string
    error: string
    retryCount: number
  }
  
  // Why it failed
  failureReason: string
  
  // What user did
  userAction: {
    clickX: number
    clickY: number
    clickedElement: string
    elementType: string
  }
  
  // New selector learned
  learned: {
    oldSelector: string
    newSelector: string
    selectorType: string
    saved: boolean
  }
  
  // Time to resolve
  timeToResolve: number
}

export class GodModeService {
  private interventions: InterventionLog[] = []
  private stuckTimeout = 5000 // 5 seconds before considering stuck
  
  constructor() {}

  /**
   * Detect if AI is stuck
   * Called after retry attempts fail
   */
  detectStuck(
    action: LLMAction,
    error: Error,
    retryCount: number
  ): StuckDetection {
    const errorMsg = error.message.toLowerCase()
    
    let reason: StuckDetection['reason'] = 'unclear_action'
    let suggestedIntervention = 'Please click on the correct element to continue'
    
    // Element not found (most common)
    if (errorMsg.includes('not found') || 
        errorMsg.includes('no element') ||
        errorMsg.includes('unable to find') ||
        errorMsg.includes('could not find')) {
      reason = 'element_not_found'
      suggestedIntervention = `Element not found with selector: "${action.selector || action.target}". Please click on the correct element.`
    }
    
    // Selector ambiguous (multiple matches)
    else if (errorMsg.includes('multiple') || 
             errorMsg.includes('ambiguous') ||
             errorMsg.includes('more than one')) {
      reason = 'selector_ambiguous'
      suggestedIntervention = `Selector matches multiple elements. Please click on the specific element you want.`
    }
    
    // Element not clickable (covered, disabled, etc.)
    else if (errorMsg.includes('not clickable') || 
             errorMsg.includes('covered') || 
             errorMsg.includes('disabled') ||
             errorMsg.includes('intercepts pointer')) {
      reason = 'element_not_clickable'
      suggestedIntervention = `Element is not clickable (covered or disabled). Please click on the correct clickable element.`
    }
    
    // Timeout
    else if (errorMsg.includes('timeout') || 
             errorMsg.includes('exceeded') ||
             errorMsg.includes('waiting for')) {
      reason = 'timeout'
      suggestedIntervention = `Action timed out after ${this.stuckTimeout}ms. Please click on the element to continue.`
    }
    
    return {
      isStuck: retryCount >= 3, // Stuck after 3 retry attempts (IRL)
      reason,
      attemptedAction: action,
      attemptedSelector: action.selector || action.target,
      error: error.message,
      retryCount,
      suggestedIntervention
    }
  }

  /**
   * Smart selector extraction from clicked element
   * Priority: id > data-testid > aria-label > role > name > class > text > xpath
   */
  async extractSelectorFromClick(
    page: Page,
    clickX: number,
    clickY: number
  ): Promise<SelectorExtractionResult> {
    const result = await page.evaluate(({ x, y }) => {
      // Get element at click coordinates
      const element = document.elementFromPoint(x, y)
      if (!element) {
        throw new Error('No element found at click coordinates')
      }

      // Extract element properties
      const props = {
        tagName: element.tagName.toLowerCase(),
        id: element.id || undefined,
        classes: Array.from(element.classList),
        dataTestId: element.getAttribute('data-testid') || 
                   element.getAttribute('data-test-id') ||
                   element.getAttribute('data-test') ||
                   undefined,
        text: element.textContent?.trim().substring(0, 50) || undefined,
        ariaLabel: element.getAttribute('aria-label') || undefined,
        role: element.getAttribute('role') || undefined,
        name: element.getAttribute('name') || undefined,
        type: element.getAttribute('type') || undefined,
        placeholder: element.getAttribute('placeholder') || undefined,
        href: element.getAttribute('href') || undefined
      }

      // Smart selector generation with priority order
      let bestSelector = ''
      let selectorPriority = 'xpath'
      const alternativeSelectors: string[] = []

      // Priority 1: ID (most stable and specific)
      if (props.id) {
        bestSelector = `#${props.id}`
        selectorPriority = 'id'
      }
      // Priority 2: data-testid (designed for testing)
      else if (props.dataTestId) {
        bestSelector = `[data-testid="${props.dataTestId}"]`
        selectorPriority = 'data-testid'
        
        // Alternative: with tag name for extra specificity
        alternativeSelectors.push(`${props.tagName}[data-testid="${props.dataTestId}"]`)
      }
      // Priority 3: aria-label (semantic and accessible)
      else if (props.ariaLabel) {
        bestSelector = `[aria-label="${props.ariaLabel}"]`
        selectorPriority = 'aria-label'
        
        // Alternative: with tag name
        alternativeSelectors.push(`${props.tagName}[aria-label="${props.ariaLabel}"]`)
      }
      // Priority 4: role (semantic HTML)
      else if (props.role && props.text) {
        bestSelector = `[role="${props.role}"]:has-text("${props.text}")`
        selectorPriority = 'role'
      }
      // Priority 5: name attribute (form elements)
      else if (props.name) {
        bestSelector = `[name="${props.name}"]`
        selectorPriority = 'name'
        
        // Alternative: with tag name
        alternativeSelectors.push(`${props.tagName}[name="${props.name}"]`)
      }
      // Priority 6: class (can be unstable)
      else if (props.classes.length > 0) {
        bestSelector = `.${props.classes[0]}`
        selectorPriority = 'class'
        
        // Alternative: with tag name for specificity
        alternativeSelectors.push(`${props.tagName}.${props.classes[0]}`)
        
        // Alternative: multiple classes
        if (props.classes.length > 1) {
          alternativeSelectors.push(`.${props.classes.join('.')}`)
        }
      }
      // Priority 7: text content (for buttons/links)
      else if (props.text && props.text.length < 30 && 
               (props.tagName === 'button' || props.tagName === 'a')) {
        bestSelector = `${props.tagName}:has-text("${props.text}")`
        selectorPriority = 'text'
      }
      // Priority 8: XPath (last resort)
      else {
        const getXPath = (el: Element): string => {
          if (el.id) return `id("${el.id}")`
          if (el === document.body) return '/html/body'
          
          let ix = 0
          const siblings = el.parentNode?.children || []
          for (let i = 0; i < siblings.length; i++) {
            const sibling = siblings[i]
            if (sibling === el) {
              return `${getXPath(el.parentElement!)}/${el.tagName.toLowerCase()}[${ix + 1}]`
            }
            if (sibling.tagName === el.tagName) ix++
          }
          return ''
        }
        bestSelector = getXPath(element)
        selectorPriority = 'xpath'
      }

      // Validate uniqueness - ensure selector matches only this element
      let uniqueness = 0
      try {
        uniqueness = document.querySelectorAll(bestSelector).length
        
        // If not unique, add :first-child or nth-child
        if (uniqueness > 1 && selectorPriority !== 'xpath') {
          const parent = element.parentElement
          if (parent) {
            const siblings = Array.from(parent.children)
            const index = siblings.indexOf(element)
            if (index >= 0) {
              bestSelector = `${bestSelector}:nth-child(${index + 1})`
              alternativeSelectors.push(bestSelector)
            }
          }
        }
      } catch (e) {
        uniqueness = -1 // Invalid selector
      }

      return {
        element: props,
        bestSelector,
        selectorPriority,
        alternativeSelectors,
        uniqueness
      }
    }, { x: clickX, y: clickY })

    return result as SelectorExtractionResult
  }

  /**
   * Create updated action with new selector
   */
  createUpdatedAction(
    originalAction: LLMAction,
    newSelector: string,
    selectorType: string
  ): LLMAction {
    return {
      ...originalAction,
      selector: newSelector,
      description: `${originalAction.description} (God Mode: ${selectorType} selector)`,
      confidence: 1.0 // User-verified, highest confidence
    }
  }

  /**
   * Log intervention for learning
   */
  logIntervention(
    runId: string,
    stepNumber: number,
    stuckDetection: StuckDetection,
    extraction: SelectorExtractionResult,
    clickX: number,
    clickY: number,
    timeToResolve: number
  ): InterventionLog {
    const log: InterventionLog = {
      runId,
      stepNumber,
      timestamp: new Date().toISOString(),
      
      aiAttempted: {
        action: stuckDetection.attemptedAction.action,
        selector: stuckDetection.attemptedSelector,
        target: stuckDetection.attemptedAction.target,
        error: stuckDetection.error,
        retryCount: stuckDetection.retryCount
      },
      
      failureReason: stuckDetection.reason,
      
      userAction: {
        clickX,
        clickY,
        clickedElement: extraction.element.tagName + 
                       (extraction.element.id ? `#${extraction.element.id}` : '') +
                       (extraction.element.text ? ` (${extraction.element.text})` : ''),
        elementType: extraction.element.tagName
      },
      
      learned: {
        oldSelector: stuckDetection.attemptedSelector || 'unknown',
        newSelector: extraction.bestSelector,
        selectorType: extraction.selectorPriority,
        saved: true
      },
      
      timeToResolve
    }

    this.interventions.push(log)
    
    console.log(`[God Mode] Intervention logged:`)
    console.log(`  AI tried: ${log.aiAttempted.action} ${log.aiAttempted.selector}`)
    console.log(`  Failed: ${log.failureReason} (${log.aiAttempted.error})`)
    console.log(`  User clicked: ${log.userAction.clickedElement} at (${clickX}, ${clickY})`)
    console.log(`  Learned: ${log.learned.newSelector} (${log.learned.selectorType})`)
    console.log(`  Resolved in: ${timeToResolve}ms`)
    
    return log
  }

  /**
   * Get interventions for a run
   */
  getInterventions(runId: string): InterventionLog[] {
    return this.interventions.filter(i => i.runId === runId)
  }

  /**
   * Get all interventions
   */
  getAllInterventions(): InterventionLog[] {
    return this.interventions
  }

  /**
   * Reset interventions
   */
  reset(): void {
    this.interventions = []
  }

  /**
   * Get intervention statistics
   */
  getStats() {
    return {
      totalInterventions: this.interventions.length,
      byReason: {
        element_not_found: this.interventions.filter(i => i.failureReason === 'element_not_found').length,
        selector_ambiguous: this.interventions.filter(i => i.failureReason === 'selector_ambiguous').length,
        element_not_clickable: this.interventions.filter(i => i.failureReason === 'element_not_clickable').length,
        timeout: this.interventions.filter(i => i.failureReason === 'timeout').length,
        unclear_action: this.interventions.filter(i => i.failureReason === 'unclear_action').length
      },
      bySelectorType: {
        id: this.interventions.filter(i => i.learned.selectorType === 'id').length,
        dataTestId: this.interventions.filter(i => i.learned.selectorType === 'data-testid').length,
        ariaLabel: this.interventions.filter(i => i.learned.selectorType === 'aria-label').length,
        class: this.interventions.filter(i => i.learned.selectorType === 'class').length,
        text: this.interventions.filter(i => i.learned.selectorType === 'text').length,
        xpath: this.interventions.filter(i => i.learned.selectorType === 'xpath').length
      },
      averageTimeToResolve: this.interventions.length > 0
        ? Math.round(this.interventions.reduce((sum, i) => sum + i.timeToResolve, 0) / this.interventions.length)
        : 0
    }
  }
}

