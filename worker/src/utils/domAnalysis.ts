/**
 * DOM Analysis Utilities
 * Provides deterministic metrics for fallback decision-making
 */

export interface DOMAnalysisResult {
  maxDepth: number
  hasShadowDOM: boolean
  shadowDOMCount: number
  totalElements: number
  interactiveElements: number
  complexityScore: number // 0-1 scale
}

/**
 * Analyze DOM structure for complexity metrics
 * Runs in browser context via page.evaluate()
 */
export function analyzeDOMStructure(): DOMAnalysisResult {
  let maxDepth = 0
  let shadowDOMCount = 0
  let totalElements = 0
  let interactiveElements = 0

  // Calculate max depth
  function calculateDepth(node: Node, currentDepth: number = 0): void {
    if (node.nodeType === Node.ELEMENT_NODE) {
      totalElements++
      maxDepth = Math.max(maxDepth, currentDepth)

      const element = node as Element

      // Check for Shadow DOM
      if (element.shadowRoot) {
        shadowDOMCount++
        // Traverse shadow DOM
        calculateDepth(element.shadowRoot, currentDepth + 1)
      }

      // Count interactive elements
      const tagName = element.tagName.toLowerCase()
      if (
        tagName === 'button' ||
        tagName === 'a' ||
        tagName === 'input' ||
        tagName === 'select' ||
        tagName === 'textarea' ||
        element.hasAttribute('onclick') ||
        element.getAttribute('role') === 'button' ||
        element.getAttribute('role') === 'link'
      ) {
        interactiveElements++
      }

      // Traverse children
      for (let i = 0; i < element.children.length; i++) {
        calculateDepth(element.children[i], currentDepth + 1)
      }
    }
  }

  // Start from document body
  if (document.body) {
    calculateDepth(document.body, 0)
  }

  // Calculate complexity score (0-1)
  // Factors: depth (>15 = high), shadow DOM presence, element density
  const depthScore = Math.min(maxDepth / 20, 1) // Normalize to 0-1, >15 = 0.75+
  const shadowScore = shadowDOMCount > 0 ? 0.5 : 0
  const densityScore = Math.min(totalElements / 500, 1) // Normalize to 0-1
  const complexityScore = Math.min((depthScore * 0.4 + shadowScore * 0.4 + densityScore * 0.2), 1)

  return {
    maxDepth,
    hasShadowDOM: shadowDOMCount > 0,
    shadowDOMCount,
    totalElements,
    interactiveElements,
    complexityScore,
  }
}

/**
 * Check if selector exists in DOM (deterministic action failure detection)
 * Returns true if selector matches at least one element
 */
export function selectorExists(selector: string): boolean {
  try {
    const elements = document.querySelectorAll(selector)
    return elements.length > 0
  } catch {
    // Invalid selector syntax
    return false
  }
}

/**
 * Get selector validation result with details
 */
export function validateSelector(selector: string): {
  exists: boolean
  count: number
  visible: number
  error?: string
} {
  try {
    const elements = document.querySelectorAll(selector)
    const visible = Array.from(elements).filter((el) => {
      const style = window.getComputedStyle(el as Element)
      return (
        style.display !== 'none' &&
        style.visibility !== 'hidden' &&
        parseFloat(style.opacity) > 0
      )
    }).length

    return {
      exists: elements.length > 0,
      count: elements.length,
      visible,
    }
  } catch (error: any) {
    return {
      exists: false,
      count: 0,
      visible: 0,
      error: error.message,
    }
  }
}

