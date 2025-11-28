import { VisionContext, VisionElement, LLMAction } from '../types'

export interface TestPattern {
  name: string
  pattern: (context: VisionContext) => boolean
  generateTests: (context: VisionContext, elements: VisionElement[]) => LLMAction[]
}

export class TestingStrategyService {
  private patterns: TestPattern[] = []

  constructor() {
    this.initializePatterns()
  }

  private initializePatterns() {
    // Login Form Pattern
    this.patterns.push({
      name: 'login-form',
      pattern: (context) => {
        const hasUsername = context.elements.some(e => 
          e.type === 'input' && 
          (e.inputType === 'text' || e.inputType === 'email') &&
          (e.name?.toLowerCase().includes('user') || 
           e.name?.toLowerCase().includes('email') ||
           e.ariaLabel?.toLowerCase().includes('user') ||
           e.ariaLabel?.toLowerCase().includes('email'))
        )
        const hasPassword = context.elements.some(e => 
          e.type === 'input' && 
          e.inputType === 'password'
        )
        const hasSubmit = context.elements.some(e => 
          (e.type === 'button' || e.type === 'input') &&
          (e.text?.toLowerCase().includes('login') ||
           e.text?.toLowerCase().includes('sign in') ||
           e.inputType === 'submit')
        )
        return hasUsername && hasPassword && hasSubmit
      },
      generateTests: (context, elements) => {
        const usernameField = elements.find(e => 
          e.type === 'input' && 
          (e.inputType === 'text' || e.inputType === 'email') &&
          (e.name?.toLowerCase().includes('user') || e.name?.toLowerCase().includes('email'))
        )
        const passwordField = elements.find(e => 
          e.type === 'input' && e.inputType === 'password'
        )
        const submitButton = elements.find(e => 
          (e.type === 'button' || e.type === 'input') &&
          (e.text?.toLowerCase().includes('login') || e.text?.toLowerCase().includes('sign in'))
        )

        if (!usernameField || !passwordField || !submitButton) return []

        return [
          // Happy path
          {
            action: 'type' as const,
            selector: usernameField.selector,
            value: 'test@example.com',
            description: 'Enter valid email in username field',
            confidence: 0.9
          },
          {
            action: 'type' as const,
            selector: passwordField.selector,
            value: 'TestPassword123',
            description: 'Enter valid password',
            confidence: 0.9
          },
          {
            action: 'click' as const,
            selector: submitButton.selector,
            description: 'Submit login form',
            confidence: 0.9
          },
          {
            action: 'assert' as const,
            selector: 'button:has-text("Logout"), button:has-text("Sign Out"), [data-testid*="user-menu"]',
            value: 'exists',
            description: 'Verify successful login (logout button or user menu appears)',
            confidence: 0.8
          },
          // Negative test - invalid credentials
          {
            action: 'type' as const,
            selector: usernameField.selector,
            value: 'invalid@example.com',
            description: 'Enter invalid email',
            confidence: 0.9
          },
          {
            action: 'type' as const,
            selector: passwordField.selector,
            value: 'WrongPassword',
            description: 'Enter wrong password',
            confidence: 0.9
          },
          {
            action: 'click' as const,
            selector: submitButton.selector,
            description: 'Attempt login with invalid credentials',
            confidence: 0.9
          },
          {
            action: 'assert' as const,
            selector: submitButton.selector,
            value: 'error',
            description: 'Verify error message appears for invalid credentials',
            confidence: 0.8
          }
        ]
      }
    })

    // Search Form Pattern
    this.patterns.push({
      name: 'search-form',
      pattern: (context) => {
        return context.elements.some(e => 
          e.type === 'input' && 
          (e.inputType === 'text' || e.inputType === 'search') &&
          (e.name?.toLowerCase().includes('search') ||
           e.ariaLabel?.toLowerCase().includes('search') ||
           e.text?.toLowerCase().includes('search'))
        )
      },
      generateTests: (context, elements) => {
        const searchInput = elements.find(e => 
          e.type === 'input' && 
          (e.inputType === 'text' || e.inputType === 'search') &&
          (e.name?.toLowerCase().includes('search') || e.ariaLabel?.toLowerCase().includes('search'))
        )
        const searchButton = elements.find(e => 
          e.type === 'button' && 
          (e.text?.toLowerCase().includes('search') || e.ariaLabel?.toLowerCase().includes('search'))
        )

        if (!searchInput) return []

        return [
          // Happy path
          {
            action: 'type' as const,
            selector: searchInput.selector,
            value: 'product',
            description: 'Enter search query',
            confidence: 0.9
          },
          ...(searchButton ? [{
            action: 'click' as const,
            selector: searchButton.selector,
            description: 'Submit search',
            confidence: 0.9
          }] : []),
          {
            action: 'assert' as const,
            selector: 'body',
            value: 'text:results',
            description: 'Verify search results appear or "no results" message',
            confidence: 0.7
          },
          // Empty search test
          {
            action: 'type' as const,
            selector: searchInput.selector,
            value: '',
            description: 'Clear search field',
            confidence: 0.9
          },
          ...(searchButton ? [{
            action: 'click' as const,
            selector: searchButton.selector,
            description: 'Submit empty search',
            confidence: 0.9
          }] : [])
        ]
      }
    })

    // Generic Form Pattern (with required fields)
    this.patterns.push({
      name: 'generic-form',
      pattern: (context) => {
        const inputs = context.elements.filter(e => e.type === 'input' && e.inputType !== 'hidden')
        const submitButtons = context.elements.filter(e => 
          (e.type === 'button' || e.type === 'input') &&
          (e.text?.toLowerCase().includes('submit') || e.inputType === 'submit')
        )
        return inputs.length >= 2 && submitButtons.length > 0
      },
      generateTests: (context, elements) => {
        const requiredInputs = elements.filter(e => 
          e.type === 'input' && 
          e.inputType !== 'hidden' &&
          e.isRequired // This will be set by enhanced element detection
        )
        const submitButton = elements.find(e => 
          (e.type === 'button' || e.type === 'input') &&
          (e.text?.toLowerCase().includes('submit') || e.inputType === 'submit')
        )

        if (requiredInputs.length === 0 || !submitButton) return []

        const tests: LLMAction[] = []
        
        // Test required field validation
        tests.push({
          action: 'click' as const,
          selector: submitButton.selector,
          description: 'Attempt to submit form with required fields blank',
          confidence: 0.9
        })
        tests.push({
          action: 'assert' as const,
          selector: requiredInputs[0].selector,
          value: 'error',
          description: 'Verify error message for required field',
          confidence: 0.8
        })

        // Test invalid input based on type
        requiredInputs.forEach(input => {
          if (input.inputType === 'email') {
            tests.push({
              action: 'type' as const,
              selector: input.selector,
              value: 'invalid-email',
              description: `Test invalid email format in ${input.name || 'email field'}`,
              confidence: 0.9
            })
            tests.push({
              action: 'assert' as const,
              selector: input.selector,
              value: 'error',
              description: 'Verify email validation error',
              confidence: 0.8
            })
          } else if (input.inputType === 'number') {
            tests.push({
              action: 'type' as const,
              selector: input.selector,
              value: 'abc',
              description: `Test invalid number format in ${input.name || 'number field'}`,
              confidence: 0.9
            })
            tests.push({
              action: 'assert' as const,
              selector: input.selector,
              value: 'error',
              description: 'Verify number validation error',
              confidence: 0.8
            })
          }
        })

        return tests
      }
    })
  }

  /**
   * Detect test patterns in the current context
   */
  detectPatterns(context: VisionContext): TestPattern[] {
    return this.patterns.filter(pattern => pattern.pattern(context))
  }

  /**
   * Generate test actions for detected patterns
   */
  generateTestActions(context: VisionContext): LLMAction[] {
    const detectedPatterns = this.detectPatterns(context)
    const allActions: LLMAction[] = []

    for (const pattern of detectedPatterns) {
      const actions = pattern.generateTests(context, context.elements)
      allActions.push(...actions)
    }

    return allActions
  }

  /**
   * Get testing recommendations based on detected elements
   */
  getRecommendations(context: VisionContext): string[] {
    const recommendations: string[] = []
    const detectedPatterns = this.detectPatterns(context)

    if (detectedPatterns.some(p => p.name === 'login-form')) {
      recommendations.push('Login form detected - test valid/invalid credentials, error handling')
    }
    if (detectedPatterns.some(p => p.name === 'search-form')) {
      recommendations.push('Search form detected - test query submission, empty search, no results state')
    }
    if (detectedPatterns.some(p => p.name === 'generic-form')) {
      recommendations.push('Form detected - test required fields, validation, happy path')
    }

    const hasCheckboxes = context.elements.some(e => e.type === 'input' && e.inputType === 'checkbox')
    if (hasCheckboxes) {
      recommendations.push('Checkboxes detected - verify state changes after clicking')
    }

    const hasDropdowns = context.elements.some(e => e.type === 'select')
    if (hasDropdowns) {
      recommendations.push('Dropdowns detected - verify option selection and state updates')
    }

    return recommendations
  }
}

