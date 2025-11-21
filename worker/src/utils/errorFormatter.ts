/**
 * Error formatting utility
 * Provides natural language explanations and categorizes errors
 */

export type ErrorCategory = 'website' | 'platform'

export interface FormattedError {
  technical: string
  natural: string
  category: ErrorCategory
  categoryLabel: string
}

/**
 * Categorize and format errors with natural language explanations
 */
export function formatError(error: Error | string, context?: { action?: string; selector?: string }): FormattedError {
  const errorMessage = typeof error === 'string' ? error : error.message
  const lowerMessage = errorMessage.toLowerCase()

  // Website Issues - Problems with the website being tested
  if (
    lowerMessage.includes('not visible') ||
    lowerMessage.includes('is not visible') ||
    lowerMessage.includes('hidden') ||
    lowerMessage.includes('display:none') ||
    lowerMessage.includes('does not exist in dom') ||
    lowerMessage.includes('element not found') ||
    lowerMessage.includes('timeout waiting for') ||
    lowerMessage.includes('navigation timeout') ||
    lowerMessage.includes('net::err') ||
    lowerMessage.includes('page crashed') ||
    lowerMessage.includes('page.goto: net::err')
  ) {
    let natural = ''
    let categoryLabel = 'Website Issue'

    if (lowerMessage.includes('not visible') || lowerMessage.includes('hidden') || lowerMessage.includes('display:none')) {
      natural = `The website has a button or link that cannot be clicked because it's hidden or not displayed on the page. This usually means the website needs to be fixed - the element should be visible for users to interact with.`
      categoryLabel = 'Website Issue - Hidden Element'
    } else if (lowerMessage.includes('does not exist') || lowerMessage.includes('element not found')) {
      natural = `The website is missing an element that the test is trying to interact with. This indicates the website structure may have changed or the element was removed.`
      categoryLabel = 'Website Issue - Missing Element'
    } else if (lowerMessage.includes('timeout') || lowerMessage.includes('net::err')) {
      natural = `The website took too long to load or failed to respond. This could mean the website is slow, down, or having network issues.`
      categoryLabel = 'Website Issue - Loading Problem'
    } else if (lowerMessage.includes('crashed')) {
      natural = `The website page crashed or became unresponsive. This is a problem with the website itself, not the testing tool.`
      categoryLabel = 'Website Issue - Page Crash'
    } else {
      natural = `The website has an issue that prevented the test from completing. This is a problem with the website being tested, not the testing platform.`
    }

    return {
      technical: errorMessage,
      natural,
      category: 'website',
      categoryLabel,
    }
  }

  // Platform Issues - Problems with the testing tool/platform
  if (
    lowerMessage.includes('session') && lowerMessage.includes('not found') ||
    lowerMessage.includes('failed to capture screenshot') ||
    lowerMessage.includes('failed to connect') ||
    lowerMessage.includes('connection refused') ||
    lowerMessage.includes('browser disconnected') ||
    lowerMessage.includes('target closed') ||
    lowerMessage.includes('protocol error') ||
    lowerMessage.includes('too many errors') ||
    lowerMessage.includes('test failed')
  ) {
    let natural = ''
    let categoryLabel = 'Platform Issue'

    if (lowerMessage.includes('session') && lowerMessage.includes('not found')) {
      natural = `The testing tool lost connection to the browser. This is a technical issue with the testing platform, not your website.`
      categoryLabel = 'Platform Issue - Connection Lost'
    } else if (lowerMessage.includes('failed to capture screenshot')) {
      natural = `The testing tool couldn't take a screenshot. This is a technical issue with the testing platform.`
      categoryLabel = 'Platform Issue - Screenshot Failed'
    } else if (lowerMessage.includes('too many errors') || lowerMessage.includes('test failed')) {
      const errorCount = errorMessage.match(/\d+/)?.[0] || 'many'
      natural = `The test encountered ${errorCount} errors and had to stop. This could be due to website issues (like many hidden elements) or platform limitations. Check individual errors for details.`
      categoryLabel = 'Platform Issue - Too Many Errors'
    } else if (lowerMessage.includes('browser disconnected') || lowerMessage.includes('target closed')) {
      natural = `The browser connection was lost during testing. This is a technical issue with the testing platform, not your website.`
      categoryLabel = 'Platform Issue - Browser Disconnected'
    } else {
      natural = `The testing platform encountered a technical problem. This is not a problem with your website, but rather an issue with the testing tool itself.`
    }

    return {
      technical: errorMessage,
      natural,
      category: 'platform',
      categoryLabel,
    }
  }

  // Default - assume website issue if unclear
  return {
    technical: errorMessage,
    natural: `An error occurred during testing. The error message suggests there may be an issue with the website being tested, but it could also be a platform limitation. Please review the technical details for more information.`,
    category: 'website',
    categoryLabel: 'Website Issue - Unknown',
  }
}

/**
 * Format error for display in test steps
 */
export function formatErrorForStep(error: Error | string, context?: { action?: string; selector?: string }): string {
  const formatted = formatError(error, context)
  return `${formatted.technical}\n\n💡 ${formatted.natural}\n\n📋 Category: ${formatted.categoryLabel}`
}

/**
 * Format error for API responses
 */
export function formatErrorForAPI(error: Error | string, context?: { action?: string; selector?: string }): {
  error: string
  explanation: string
  category: ErrorCategory
  categoryLabel: string
} {
  const formatted = formatError(error, context)
  return {
    error: formatted.technical,
    explanation: formatted.natural,
    category: formatted.category,
    categoryLabel: formatted.categoryLabel,
  }
}

