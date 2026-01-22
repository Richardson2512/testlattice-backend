/**
 * Enhanced Testability Assessment Service
 * Detailed checks with confidence scoring and actionable recommendations
 */

import { Page } from 'playwright'
import { AccessibilityMapElement } from './accessibilityMap'
import { OverlayDetectionService, DetectedOverlay } from './overlayDetection'

export interface TestabilityCheck {
  hasBlocker: boolean
  hasWarning: boolean
  blockers: Array<{
    type: string
    message: string
    suggestion: string
  }>
  warnings: Array<{
    type: string
    message: string
    suggestion: string
  }>
  confidence: number // 0.0 - 1.0
}

export interface FlowAssessment {
  name: string
  description?: string
  canTest: boolean
  confidence: number
  blockers: Array<{
    type: string
    message: string
    suggestion: string
  }>
  warnings: Array<{
    type: string
    message: string
    suggestion: string
  }>
  elements: number[] // Indices into accessibility map
  rootCause?: RootCauseAnalysis // Enhanced: Root cause analysis
}

export interface TestabilityAssessment {
  testable: FlowAssessment[]
  highRisk: FlowAssessment[]
  nonTestable: FlowAssessment[]
  recommendations: Array<{
    type: 'ready' | 'risky' | 'blocked'
    priority: 'high' | 'medium' | 'low'
    message: string
    flows?: string[]
    details?: any
  }>
}

export interface RootCauseAnalysis {
  rootCause: string
  specificIssue: string
  actionableSteps: string[]
  blockingOverlay?: { type: string; selector: string; id?: string }
}

export class EnhancedTestabilityService {
  private confidenceHardStopThreshold: number
  private overlayDetection: OverlayDetectionService

  constructor(confidenceHardStopThreshold: number = 0.4) {
    this.confidenceHardStopThreshold = confidenceHardStopThreshold
    this.overlayDetection = new OverlayDetectionService()
  }

  /**
   * Assess testability of flows with detailed checks
   * Phase 1: Includes confidence hard stop to prevent hallucinations
   */
  async assessTestability(
    flows: Array<{
      name: string
      description?: string
      elements: number[]
      priority?: 'high' | 'medium' | 'low'
    }>,
    accessibilityMap: { elements: AccessibilityMapElement[] },
    page: Page,
    onLowConfidence?: (flow: FlowAssessment) => Promise<void> // Phase 1: Callback for hard stop
  ): Promise<TestabilityAssessment> {
    const assessment: TestabilityAssessment = {
      testable: [],
      highRisk: [],
      nonTestable: [],
      recommendations: [],
    }

    // Assess each flow
    for (const flow of flows) {
      const flowAssessment: FlowAssessment = {
        name: flow.name,
        description: flow.description,
        canTest: true,
        confidence: 1.0,
        blockers: [],
        warnings: [],
        elements: flow.elements,
      }

      // Check each element in flow
      for (const elementIndex of flow.elements) {
        const element = accessibilityMap.elements[elementIndex]
        if (!element) {
          flowAssessment.canTest = false
          flowAssessment.blockers.push({
            type: 'missing_element',
            message: `Element at index ${elementIndex} not found in accessibility map`,
            suggestion: 'Check if element exists on page',
          })
          flowAssessment.confidence = 0
          continue
        }

        const checks = await this.runTestabilityChecks(element, page)

        if (checks.hasBlocker) {
          flowAssessment.canTest = false
          flowAssessment.blockers.push(...checks.blockers)
          flowAssessment.confidence = 0
        }

        if (checks.hasWarning) {
          flowAssessment.confidence -= 0.2
          flowAssessment.warnings.push(...checks.warnings)
        } else {
          // Adjust confidence based on element confidence
          flowAssessment.confidence = (flowAssessment.confidence + checks.confidence) / 2
        }
      }

      // Phase 1: Confidence hard stop - prevent hallucinations (ENHANCED with root cause analysis)
      if (flowAssessment.confidence < this.confidenceHardStopThreshold && flowAssessment.canTest) {
        console.warn(`[EnhancedTestability] Hard stop: Flow "${flowAssessment.name}" has confidence ${flowAssessment.confidence.toFixed(2)} < ${this.confidenceHardStopThreshold}`)

        // Perform hybrid root cause analysis
        const firstElement = flow.elements.length > 0 ? accessibilityMap.elements[flow.elements[0]] : null
        let rootCause: RootCauseAnalysis | undefined

        if (firstElement) {
          rootCause = await this.analyzeLowConfidenceRootCause(
            firstElement,
            page,
            flowAssessment
          )

          flowAssessment.rootCause = rootCause
        }

        flowAssessment.canTest = false
        flowAssessment.blockers.push({
          type: 'low_confidence',
          message: rootCause?.specificIssue || `Testability confidence too low (${flowAssessment.confidence.toFixed(2)}). Test paused to prevent hallucinations.`,
          suggestion: rootCause?.actionableSteps.join('; ') || 'Review selectors, add data-testid attributes, or improve element identification',
        })

        // Trigger notification callback with enhanced context
        if (onLowConfidence) {
          await onLowConfidence(flowAssessment).catch(err => {
            console.error('[EnhancedTestability] Error in low confidence callback:', err)
          })
        }
      }

      // Categorize flow
      if (flowAssessment.canTest) {
        if (flowAssessment.confidence >= 0.7) {
          assessment.testable.push(flowAssessment)
        } else {
          assessment.highRisk.push(flowAssessment)
        }
      } else {
        assessment.nonTestable.push(flowAssessment)
      }
    }

    // Generate recommendations
    assessment.recommendations = this.generateRecommendations(assessment)

    return assessment
  }

  /**
   * Run detailed testability checks on an element
   */
  private async runTestabilityChecks(
    element: AccessibilityMapElement,
    page: Page
  ): Promise<TestabilityCheck> {
    const checks: TestabilityCheck = {
      hasBlocker: false,
      hasWarning: false,
      blockers: [],
      warnings: [],
      confidence: 1.0,
    }

    // Check 1: Selector validity
    try {
      const locator = page.locator(element.bestSelector)
      const count = await locator.count()

      if (count === 0) {
        checks.hasBlocker = true
        checks.blockers.push({
          type: 'invalid_selector',
          message: `Selector "${element.bestSelector}" doesn't match any element`,
          suggestion: 'Try alternative selectors or update page structure',
        })
        checks.confidence = 0
        return checks
      }
    } catch (error: any) {
      checks.hasBlocker = true
      checks.blockers.push({
        type: 'selector_error',
        message: `Selector "${element.bestSelector}" caused error: ${error.message}`,
        suggestion: 'Fix selector syntax or element structure',
      })
      checks.confidence = 0
      return checks
    }

    // Check 2: Element size
    if (element.position.width < 10 || element.position.height < 10) {
      checks.hasWarning = true
      checks.warnings.push({
        type: 'too_small',
        message: `Element is very small (${element.position.width}x${element.position.height}px)`,
        suggestion: 'Might be hard to interact with, especially on mobile',
      })
      checks.confidence -= 0.1
    }

    // Check 3: Element identification strength
    if (!element.id && !element['data-testid'] && !element['aria-label'] && !element.text) {
      checks.hasWarning = true
      checks.warnings.push({
        type: 'weak_identification',
        message: 'Element lacks strong identifiers (no ID, data-testid, or aria-label)',
        suggestion: 'Add data-testid attribute for reliable testing',
      })
      checks.confidence -= 0.2
    }

    // Check 4: Dynamic content detection
    if (element.classes.some((c) => c.includes('loading') || c.includes('skeleton'))) {
      checks.hasWarning = true
      checks.warnings.push({
        type: 'dynamic_content',
        message: 'Element appears to be dynamically loaded',
        suggestion: 'Will need wait strategies for reliable testing',
      })
      checks.confidence -= 0.15
    }

    // Check 5: Form validation patterns
    if (element.tagName === 'input' && element.inputType === 'email') {
      const hasValidation = await page.evaluate(
        (sel) => {
          const el = document.querySelector(sel) as HTMLInputElement
          return el?.hasAttribute('required') || el?.hasAttribute('pattern')
        },
        element.bestSelector
      )

      if (!hasValidation) {
        checks.hasWarning = true
        checks.warnings.push({
          type: 'missing_validation',
          message: 'Email input lacks validation attributes',
          suggestion: 'May not show validation errors as expected',
        })
        checks.confidence -= 0.1
      }
    }

    // Check 6: Element visibility and interactability
    try {
      const locator = page.locator(element.bestSelector)
      const isVisible = await locator.first().isVisible().catch(() => false)
      const isEnabled = await locator.first().isEnabled().catch(() => true)

      if (!isVisible) {
        checks.hasBlocker = true
        checks.blockers.push({
          type: 'not_visible',
          message: 'Element is not visible on page',
          suggestion: 'Element may be hidden or outside viewport',
        })
        checks.confidence = 0
      }

      if (!isEnabled) {
        checks.hasWarning = true
        checks.warnings.push({
          type: 'disabled',
          message: 'Element is disabled',
          suggestion: 'Element may need to be enabled before interaction',
        })
        checks.confidence -= 0.3
      }
    } catch (error: any) {
      checks.hasWarning = true
      checks.warnings.push({
        type: 'interaction_check_failed',
        message: `Failed to check element interactability: ${error.message}`,
        suggestion: 'Element may not be ready for interaction',
      })
      checks.confidence -= 0.1
    }

    // Clamp confidence to 0.0 - 1.0
    checks.confidence = Math.max(0.0, Math.min(1.0, checks.confidence))

    return checks
  }

  /**
   * Generate actionable recommendations
   */
  private generateRecommendations(
    assessment: TestabilityAssessment
  ): Array<{
    type: 'ready' | 'risky' | 'blocked'
    priority: 'high' | 'medium' | 'low'
    message: string
    flows?: string[]
    details?: any
  }> {
    const recommendations: typeof assessment.recommendations = []

    // Recommendation 1: Ready to test
    if (assessment.testable.length > 0) {
      recommendations.push({
        type: 'ready',
        priority: 'high',
        message: `${assessment.testable.length} flow(s) are ready to test`,
        flows: assessment.testable.map((f) => f.name),
      })
    }

    // Recommendation 2: High-risk flows
    if (assessment.highRisk.length > 0) {
      recommendations.push({
        type: 'risky',
        priority: 'medium',
        message: `${assessment.highRisk.length} flow(s) have reliability concerns`,
        flows: assessment.highRisk.map((f) => f.name),
        details: {
          flows: assessment.highRisk.map((f) => ({
            name: f.name,
            confidence: f.confidence,
            warnings: f.warnings,
          })),
        },
      })
    }

    // Recommendation 3: Non-testable flows
    if (assessment.nonTestable.length > 0) {
      recommendations.push({
        type: 'blocked',
        priority: 'high',
        message: `${assessment.nonTestable.length} flow(s) cannot be tested`,
        flows: assessment.nonTestable.map((f) => f.name),
        details: {
          suggestion: 'Fix blockers before running tests',
        },
      })
    }

    return recommendations
  }

  /**
   * Hybrid Root Cause Analysis
   * Lightweight checks on every step, deep analysis when confidence < 0.5 or action fails
   */
  private async analyzeLowConfidenceRootCause(
    element: AccessibilityMapElement,
    page: Page,
    flowAssessment: FlowAssessment
  ): Promise<RootCauseAnalysis> {
    // Lightweight checks (always performed)
    const lightweightChecks = await this.performLightweightChecks(element, page)

    // If confidence is low or action failed, perform deep analysis
    const needsDeepAnalysis = flowAssessment.confidence < 0.5 || lightweightChecks.hasBlocker

    let deepAnalysis: any = null
    if (needsDeepAnalysis) {
      deepAnalysis = await this.performDeepAnalysis(element, page)
    }

    return this.synthesizeRootCause(lightweightChecks, deepAnalysis, element, flowAssessment)
  }

  /**
   * Lightweight checks (fast, performed on every step)
   */
  private async performLightweightChecks(
    element: AccessibilityMapElement,
    page: Page
  ): Promise<{
    isVisible: boolean
    isEnabled: boolean
    hasBlocker: boolean
    visibilityReason?: string
  }> {
    try {
      const locator = page.locator(element.bestSelector)
      const isVisible = await locator.first().isVisible().catch(() => false)
      const isEnabled = await locator.first().isEnabled().catch(() => true)

      let visibilityReason: string | undefined
      if (!isVisible) {
        // Quick check: is it off-screen?
        const boundingBox = await locator.first().boundingBox().catch(() => null)
        if (boundingBox) {
          const viewport = page.viewportSize()
          if (viewport) {
            if (boundingBox.y + boundingBox.height < 0) {
              visibilityReason = 'element is above viewport (scrolled up)'
            } else if (boundingBox.y > viewport.height) {
              visibilityReason = 'element is below viewport (needs scroll)'
            } else if (boundingBox.x + boundingBox.width < 0 || boundingBox.x > viewport.width) {
              visibilityReason = 'element is outside viewport horizontally'
            } else {
              visibilityReason = 'element is hidden (display: none or visibility: hidden)'
            }
          }
        } else {
          visibilityReason = 'element not found in DOM'
        }
      }

      return {
        isVisible,
        isEnabled,
        hasBlocker: !isVisible || !isEnabled,
        visibilityReason,
      }
    } catch (error: any) {
      return {
        isVisible: false,
        isEnabled: false,
        hasBlocker: true,
        visibilityReason: `error checking element: ${error.message}`,
      }
    }
  }

  /**
   * Deep analysis (slower, only when needed)
   */
  private async performDeepAnalysis(
    element: AccessibilityMapElement,
    page: Page
  ): Promise<{
    blockingOverlay?: DetectedOverlay
    ambiguousSelector?: { count: number; selectors: string[] }
  }> {
    const result: any = {}

    // Deep check 1: Detect blocking overlays
    try {
      const overlays = await this.overlayDetection.detectBlockingOverlays(page, element.bestSelector)
      if (overlays.length > 0) {
        result.blockingOverlay = overlays[0] // Highest z-index overlay
      }
    } catch (error: any) {
      console.warn('[EnhancedTestability] Failed to detect overlays:', error.message)
    }

    // Deep check 2: Ambiguous selector (multiple matches)
    try {
      const selectorCount = await page.locator(element.bestSelector).count()
      if (selectorCount > 1) {
        const selectors = await page.evaluate((sel) => {
          const elements = document.querySelectorAll(sel)
          return Array.from(elements).map((el) => {
            const id = (el as HTMLElement).id
            const testId = el.getAttribute('data-testid')
            return id ? `#${id}` : testId ? `[data-testid="${testId}"]` : el.tagName.toLowerCase()
          })
        }, element.bestSelector)

        result.ambiguousSelector = {
          count: selectorCount,
          selectors: selectors.slice(0, 5), // Limit to 5
        }
      }
    } catch (error: any) {
      // Ignore selector count errors
    }

    return result
  }

  /**
   * Synthesize root cause from lightweight and deep analysis
   */
  private synthesizeRootCause(
    lightweight: any,
    deep: any,
    element: AccessibilityMapElement,
    flowAssessment: FlowAssessment
  ): RootCauseAnalysis {
    const elementName = element.text || element.placeholder || element['aria-label'] || element.bestSelector

    // Priority 1: Blocking overlay (from deep analysis)
    if (deep?.blockingOverlay) {
      const overlay = deep.blockingOverlay
      return {
        rootCause: 'blocked_by_overlay',
        specificIssue: `I can't see "${elementName}" because a ${overlay.type} (${overlay.id || overlay.selector}) is blocking it with z-index ${overlay.zIndex}`,
        actionableSteps: [
          `Dismiss the ${overlay.type} before testing this element`,
          `Add pre-test step to handle ${overlay.type}`,
          `Check if ${overlay.type} can be auto-dismissed (I can ask you to enable this)`,
        ],
        blockingOverlay: {
          type: overlay.type,
          selector: overlay.selector,
          id: overlay.id,
        },
      }
    }

    // Priority 2: Visibility issue (from lightweight)
    if (!lightweight.isVisible && lightweight.visibilityReason) {
      return {
        rootCause: 'visibility_issue',
        specificIssue: `"${elementName}" is not visible: ${lightweight.visibilityReason}`,
        actionableSteps: [
          lightweight.visibilityReason.includes('viewport')
            ? 'Scroll to element before interacting'
            : 'Check if element is hidden by CSS or JavaScript',
          'Ensure element is rendered before test execution',
          'Add wait condition for element visibility',
        ],
      }
    }

    // Priority 3: Ambiguous selector (from deep analysis)
    if (deep?.ambiguousSelector) {
      return {
        rootCause: 'ambiguous_selector',
        specificIssue: `Multiple elements (${deep.ambiguousSelector.count}) match "${element.bestSelector}"`,
        actionableSteps: [
          'Add data-testid attribute to target element',
          'Use more specific selector (e.g., include parent context)',
          'Consider using text content + selector combination',
        ],
      }
    }

    // Priority 4: Weak identification
    if (!element.id && !element['data-testid'] && !element['aria-label']) {
      return {
        rootCause: 'weak_identification',
        specificIssue: `"${elementName}" lacks strong identifiers (no ID, data-testid, or aria-label)`,
        actionableSteps: [
          'Add data-testid attribute for reliable testing',
          'Use more descriptive aria-label',
          'Consider using text content matching as fallback',
        ],
      }
    }

    // Fallback: Generic low confidence
    return {
      rootCause: 'low_confidence',
      specificIssue: `"${elementName}" has low testability confidence (${flowAssessment.confidence.toFixed(2)})`,
      actionableSteps: flowAssessment.blockers.map((b) => b.suggestion),
    }
  }
}

