/**
 * Verification Service
 * Pre-execution selector validation with fallback selectors and test data generation
 */

import { Page, Locator } from 'playwright'
import { AccessibilityMapElement } from './accessibilityMap'
import { TestDataStore } from './testDataStore'

export interface VerifiedStep {
  order: number
  action: 'fill' | 'click' | 'select' | 'scroll' | 'wait'
  selector: string
  fallbackSelectors: string[]
  value: string | null
  description: string
  verified: boolean
  confidence: number
  warnings: Array<{ type: string; message: string; suggestion?: string }>
}

export interface VerificationResult {
  flow: string
  steps: VerifiedStep[]
  verified: boolean
  issues: Array<{
    step: number
    element: string
    issue: string
    severity: 'blocker' | 'warning'
  }>
  overallConfidence: number
}

export class VerificationService {
  /**
   * Verify test plan before execution
   * Validates selectors, checks element visibility, generates fallbacks
   */
  async verifyTestPlan(
    flows: Array<{
      name: string
      elements: number[] // Indices into accessibility map
      description?: string
    }>,
    accessibilityMap: { elements: AccessibilityMapElement[] },
    page: Page,
    testDataStore?: TestDataStore,
    userInstructions?: string
  ): Promise<VerificationResult[]> {
    const verifiedPlans: VerificationResult[] = []

    for (const flow of flows) {
      console.log(`Verifying flow: ${flow.name}...`)

      const verification: VerificationResult = {
        flow: flow.name,
        steps: [],
        verified: true,
        issues: [],
        overallConfidence: 1.0,
      }

      // Verify each step in the flow
      for (let i = 0; i < flow.elements.length; i++) {
        const elementIndex = flow.elements[i]
        const element = accessibilityMap.elements[elementIndex]

        if (!element) {
          verification.verified = false
          verification.issues.push({
            step: i + 1,
            element: `index ${elementIndex}`,
            issue: 'Element index out of bounds',
            severity: 'blocker',
          })
          continue
        }

        // Attempt to locate element
        try {
          const locator = page.locator(element.bestSelector)
          const count = await locator.count()

          if (count === 0) {
            verification.verified = false
            verification.issues.push({
              step: i + 1,
              element: element.bestSelector,
              issue: 'Element not found',
              severity: 'blocker',
            })
            verification.overallConfidence -= 0.3
            continue
          }

          // Check if visible and enabled
          const isVisible = await locator.first().isVisible().catch(() => false)
          const isEnabled = await locator.first().isEnabled().catch(() => true)

          if (!isVisible || !isEnabled) {
            verification.verified = false
            verification.issues.push({
              step: i + 1,
              element: element.bestSelector,
              issue: `Element ${!isVisible ? 'not visible' : 'disabled'}`,
              severity: 'blocker',
            })
            verification.overallConfidence -= 0.2
            continue
          }

          // Generate fallback selectors
          const fallbackSelectors = this.generateFallbackSelectors(element)

          // Determine action
          const action = this.determineAction(element)

          // Generate test data if needed (with stateful store and @fake pattern support)
          const value = action === 'fill' 
            ? this.generateTestData(element, testDataStore, userInstructions) 
            : null

          // Build verified step
          const step: VerifiedStep = {
            order: i + 1,
            action,
            selector: element.bestSelector,
            fallbackSelectors,
            value,
            description: this.generateStepDescription(element, flow),
            verified: true,
            confidence: this.calculateStepConfidence(element, isVisible, isEnabled),
            warnings: this.checkWarnings(element, isVisible, isEnabled),
          }

          verification.steps.push(step)

          // Adjust overall confidence based on step confidence
          verification.overallConfidence =
            (verification.overallConfidence + step.confidence) / 2
        } catch (error: any) {
          verification.verified = false
          verification.issues.push({
            step: i + 1,
            element: element.bestSelector,
            issue: error.message,
            severity: 'blocker',
          })
          verification.overallConfidence -= 0.3
        }
      }

      verifiedPlans.push(verification)
    }

    return verifiedPlans
  }

  /**
   * Determine action type based on element
   */
  private determineAction(element: AccessibilityMapElement): VerifiedStep['action'] {
    if (element.tagName === 'input' || element.tagName === 'textarea') {
      return 'fill'
    }
    if (element.tagName === 'select') {
      return 'select'
    }
    if (element.tagName === 'button' || element.role === 'button') {
      return 'click'
    }
    if (element.tagName === 'a') {
      return 'click'
    }
    return 'click' // default
  }

  /**
   * Generate fallback selectors in priority order
   */
  private generateFallbackSelectors(element: AccessibilityMapElement): string[] {
    const fallbacks: string[] = []

    // Priority order
    if (element.id) fallbacks.push(`#${element.id}`)
    if (element['data-testid']) fallbacks.push(`[data-testid="${element['data-testid']}"]`)
    if (element['aria-label']) fallbacks.push(`[aria-label="${element['aria-label']}"]`)
    if (element.name) fallbacks.push(`[name="${element.name}"]`)
    if (element.text && element.text.length < 50) {
      fallbacks.push(`text=${element.text}`)
    }
    if (element.classes.length > 0) {
      fallbacks.push(`.${element.classes[0]}`)
    }

    // Remove the best selector if it's in the fallbacks
    return fallbacks.filter((f) => f !== element.bestSelector)
  }

  /**
   * Generate appropriate test data based on input type
   * Phase 3: Supports @fake pattern matching and stateful data
   */
  private generateTestData(
    element: AccessibilityMapElement,
    testDataStore?: TestDataStore,
    userInstructions?: string
  ): string {
    // Phase 3: Check for @fake pattern in user instructions
    if (userInstructions) {
      const fakeData = this.extractFakeData(userInstructions, element, testDataStore)
      if (fakeData) {
        return fakeData
      }
    }

    // Phase 1: Use stateful test data store if available
    const inputType = element.inputType || element.type || 'text'
    const dataKey = `${inputType}_${element.name || element.placeholder || 'default'}`

    if (testDataStore) {
      return testDataStore.generateOrRetrieve(dataKey, () => {
        return this.generateFreshTestData(element, inputType)
      })
    }

    // Fallback to fresh generation if no store
    return this.generateFreshTestData(element, inputType)
  }

  /**
   * Generate fresh test data (no state)
   */
  private generateFreshTestData(element: AccessibilityMapElement, inputType: string): string {
    const dataGenerators: Record<string, () => string> = {
      email: () => {
        const timestamp = Date.now()
        return `test${timestamp}@Rihario.com`
      },
      password: () => 'SecurePass123!',
      text: () => element.placeholder || 'Test Input',
      tel: () => '+1234567890',
      url: () => 'https://example.com',
      number: () => '42',
      date: () => new Date().toISOString().split('T')[0],
      'datetime-local': () => new Date().toISOString().slice(0, 16),
      time: () => '12:00',
      search: () => 'test search query',
      color: () => '#000000',
      name: () => 'Test User',
      'first-name': () => 'John',
      'last-name': () => 'Doe',
      username: () => {
        const timestamp = Date.now()
        return `testuser${timestamp}`
      },
    }

    const generator = dataGenerators[inputType.toLowerCase()]

    if (generator) {
      return generator()
    }

    // Check for patterns or constraints
    if (element.pattern) {
      // Generate data matching pattern (simplified)
      return 'Test123'
    }

    if (element.minLength) {
      return 'A'.repeat(element.minLength)
    }

    return element.placeholder || 'Test Value'
  }

  /**
   * Phase 3: Enhanced @fake pattern extraction with sequential support
   * Supports: @fake user_1, @fake user_1.email, @fake email_1, etc.
   */
  private extractFakeData(
    userInstructions: string,
    element: AccessibilityMapElement,
    testDataStore?: TestDataStore
  ): string | null {
    const instruction = userInstructions.toLowerCase()
    
    // Pattern 1: Sequential user bundles (@fake user_1, @fake user_2, @fake user_1.email)
    const userBundlePattern = /@fake\s+user[_\s](\d+)(?:\.(\w+))?/i
    const userMatch = userInstructions.match(userBundlePattern)
    
    if (userMatch && testDataStore) {
      const [, indexStr, field] = userMatch
      const index = parseInt(indexStr, 10)
      
      if (field) {
        // Specific field: @fake user_1.email
        const fieldValue = testDataStore.getUserBundleField(index, field as keyof import('./testDataStore').UserBundle)
        if (fieldValue) return fieldValue
      } else {
        // Auto-detect field based on element type: @fake user_1
        const inputType = (element.inputType || element.type || '').toLowerCase()
        const bundle = testDataStore.generateOrRetrieveUserBundle(index)
        
        if (inputType === 'email') return bundle.email
        if (inputType === 'password') return bundle.password || 'SecurePass123!'
        if (inputType === 'text' && element.name?.toLowerCase().includes('name')) return bundle.name
        if (inputType === 'text' && element.name?.toLowerCase().includes('username')) return bundle.username
        if (inputType === 'tel' || inputType === 'phone') return bundle.phone || '+1234567890'
        
        // Default: return email for text inputs
        if (inputType === 'text') return bundle.email
        
        return bundle.email // Fallback
      }
    }
    
    // Pattern 2: Sequential individual fields (@fake email_1, @fake email_2)
    const sequentialPattern = /@fake\s+(\w+)[_\s](\d+)/i
    const seqMatch = userInstructions.match(sequentialPattern)
    
    if (seqMatch && testDataStore) {
      const [, type, indexStr] = seqMatch
      const index = parseInt(indexStr, 10)
      const key = `${type}_${index}`
      
      return testDataStore.generateOrRetrieve(key, () => {
        return this.generateSequentialData(type, index)
      })
    }
    
    // Pattern 3: Existing patterns (@fake email, @fake password, etc.)
    const fakePatterns: Array<{ pattern: RegExp; type: string; generator: () => string }> = [
      { pattern: /@fake\s+email|use\s+@fake\s+email/i, type: 'email', generator: () => {
        const key = 'email'
        if (testDataStore) {
          return testDataStore.generateOrRetrieve(key, () => {
            const timestamp = Date.now()
            return `test${timestamp}@Rihario.com`
          })
        }
        const timestamp = Date.now()
        return `test${timestamp}@Rihario.com`
      }},
      { pattern: /@fake\s+password|use\s+@fake\s+password/i, type: 'password', generator: () => {
        const key = 'password'
        if (testDataStore) {
          return testDataStore.generateOrRetrieve(key, () => 'SecurePass123!')
        }
        return 'SecurePass123!'
      }},
      { pattern: /@fake\s+name|use\s+@fake\s+name/i, type: 'name', generator: () => {
        const key = 'name'
        if (testDataStore) {
          return testDataStore.generateOrRetrieve(key, () => 'Test User')
        }
        return 'Test User'
      }},
      { pattern: /@fake\s+phone|use\s+@fake\s+phone/i, type: 'phone', generator: () => {
        const key = 'phone'
        if (testDataStore) {
          return testDataStore.generateOrRetrieve(key, () => '+1234567890')
        }
        return '+1234567890'
      }},
      { pattern: /@fake\s+username|use\s+@fake\s+username/i, type: 'username', generator: () => {
        const key = 'username'
        if (testDataStore) {
          return testDataStore.generateOrRetrieve(key, () => {
            const timestamp = Date.now()
            return `testuser${timestamp}`
          })
        }
        const timestamp = Date.now()
        return `testuser${timestamp}`
      }},
    ]

    // Check if instruction matches any @fake pattern
    for (const { pattern, generator } of fakePatterns) {
      if (pattern.test(instruction)) {
        return generator()
      }
    }

    // Check if element type matches common patterns
    const inputType = (element.inputType || element.type || '').toLowerCase()
    if (inputType === 'email' && instruction.includes('@fake')) {
      return fakePatterns[0].generator()
    }
    if (inputType === 'password' && instruction.includes('@fake')) {
      return fakePatterns[1].generator()
    }

    return null
  }

  /**
   * Generate sequential data for indexed patterns
   */
  private generateSequentialData(type: string, index: number): string {
    const generators: Record<string, (idx: number) => string> = {
      email: (idx) => {
        const timestamp = Date.now()
        return `user${idx}_${timestamp}@Rihario.com`
      },
      password: () => 'SecurePass123!',
      name: (idx) => `User ${idx}`,
      username: (idx) => {
        const timestamp = Date.now()
        return `user_${idx}_${timestamp}`
      },
      phone: (idx) => `+1${2000000000 + idx}`,
    }
    
    const generator = generators[type.toLowerCase()]
    return generator ? generator(index) : `test_${type}_${index}`
  }

  /**
   * Generate human-readable step description
   */
  private generateStepDescription(
    element: AccessibilityMapElement,
    flow: { name: string; description?: string }
  ): string {
    const actionVerbs: Record<string, string> = {
      fill: 'Enter',
      click: 'Click',
      select: 'Select',
      scroll: 'Scroll',
      wait: 'Wait',
    }

    const action = this.determineAction(element)
    const target =
      element.text || element.placeholder || element['aria-label'] || element.tagName

    return `${actionVerbs[action]} ${target}`
  }

  /**
   * Calculate confidence score for a step (0.0 - 1.0)
   */
  private calculateStepConfidence(
    element: AccessibilityMapElement,
    isVisible: boolean,
    isEnabled: boolean
  ): number {
    let confidence = 1.0

    // Strong identifiers increase confidence
    if (element.id) confidence += 0.1
    if (element['data-testid']) confidence += 0.1
    if (element['aria-label']) confidence += 0.05

    // Weak identifiers decrease confidence
    if (!element.id && !element['data-testid'] && !element['aria-label']) {
      confidence -= 0.2
    }

    // Small elements are less reliable
    if (element.position.width < 10 || element.position.height < 10) {
      confidence -= 0.1
    }

    // Visibility and enabled state
    if (!isVisible) confidence -= 0.5
    if (!isEnabled) confidence -= 0.3

    // Clamp to 0.0 - 1.0
    return Math.max(0.0, Math.min(1.0, confidence))
  }

  /**
   * Check for warnings on element
   */
  private checkWarnings(
    element: AccessibilityMapElement,
    isVisible: boolean,
    isEnabled: boolean
  ): Array<{ type: string; message: string; suggestion?: string }> {
    const warnings: Array<{ type: string; message: string; suggestion?: string }> = []

    // Small element warning
    if (element.position.width < 10 || element.position.height < 10) {
      warnings.push({
        type: 'too_small',
        message: `Element is very small (${element.position.width}x${element.position.height}px)`,
        suggestion: 'Might be hard to interact with, especially on mobile',
      })
    }

    // Weak identification warning
    if (!element.id && !element['data-testid'] && !element['aria-label'] && !element.text) {
      warnings.push({
        type: 'weak_identification',
        message: 'Element lacks strong identifiers (no ID, data-testid, or aria-label)',
        suggestion: 'Add data-testid attribute for reliable testing',
      })
    }

    // Missing validation warning (for inputs)
    if (element.tagName === 'input' && element.inputType === 'email') {
      if (!element.isRequired && !element.pattern) {
        warnings.push({
          type: 'missing_validation',
          message: 'Email input lacks validation attributes',
          suggestion: 'May not show validation errors as expected',
        })
      }
    }

    return warnings
  }
}

