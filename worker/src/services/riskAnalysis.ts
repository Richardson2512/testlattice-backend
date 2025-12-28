/**
 * Risk Analysis Service
 * Identifies potential issues and pre-plans mitigation strategies
 */

import { Page } from 'playwright'
import { VerifiedStep } from './verificationService'

export interface Risk {
  step: number
  risk: string
  severity: 'low' | 'medium' | 'high'
  mitigation: string
  strategy?: string
  timeout?: number
}

export interface RiskAnalysis {
  low: Risk[]
  medium: Risk[]
  high: Risk[]
  mitigations: Array<{
    step: number
    strategy: string
    selectors?: string[]
    timeout?: number
  }>
}

export class RiskAnalysisService {
  /**
   * Analyze risks for verified test plan
   */
  async analyzeRisks(
    verifiedPlan: Array<{ steps: VerifiedStep[] }>,
    page: Page
  ): Promise<RiskAnalysis> {
    const risks: RiskAnalysis = {
      low: [],
      medium: [],
      high: [],
      mitigations: [],
    }

    for (const plan of verifiedPlan) {
      for (const step of plan.steps) {
        // Risk 1: Dynamic content
        const isDynamic = await page.evaluate(
          (sel) => {
            const el = document.querySelector(sel)
            if (!el) return false
            return (
              el.classList.contains('loading') ||
              el.closest('[data-dynamic]') !== null ||
              el.getAttribute('data-loading') !== null ||
              el.classList.contains('skeleton') ||
              el.classList.contains('lazy-load')
            )
          },
          step.selector
        )

        if (isDynamic) {
          risks.medium.push({
            step: step.order,
            risk: 'Dynamic content may not be ready when action executes',
            severity: 'medium',
            mitigation: 'Add waitForLoadState("networkidle") before action',
          })

          risks.mitigations.push({
            step: step.order,
            strategy: 'wait_for_network_idle',
            timeout: 10000,
          })
        }

        // Risk 2: Weak selectors (no fallbacks)
        if (step.fallbackSelectors.length < 2) {
          risks.high.push({
            step: step.order,
            risk: 'Selector has no fallbacks (brittle)',
            severity: 'high',
            mitigation: 'Use multiple selector strategies with retry logic',
          })

          risks.mitigations.push({
            step: step.order,
            strategy: 'multi_selector_retry',
            selectors: [step.selector, ...step.fallbackSelectors],
          })
        }

        // Risk 3: Form submission timing
        if (step.action === 'click' && step.selector.includes('submit')) {
          risks.medium.push({
            step: step.order,
            risk: 'Form submission may navigate before assertion',
            severity: 'medium',
            mitigation: 'Wait for navigation or response before continuing',
          })

          risks.mitigations.push({
            step: step.order,
            strategy: 'wait_for_navigation',
            timeout: 30000,
          })
        }

        // Risk 4: Small element size
        if (step.warnings.some((w) => w.type === 'too_small')) {
          risks.low.push({
            step: step.order,
            risk: 'Element is very small, may be hard to click',
            severity: 'low',
            mitigation: 'Ensure element is scrolled into view and visible',
          })
        }

        // Risk 5: Low confidence score
        if (step.confidence < 0.5) {
          risks.high.push({
            step: step.order,
            risk: `Low confidence score (${step.confidence.toFixed(2)}) indicates unreliable selector`,
            severity: 'high',
            mitigation: 'Review selector and add stronger identifiers',
          })
        }

        // Risk 6: Input validation patterns
        if (step.action === 'fill') {
          const hasValidation = await page.evaluate(
            (sel) => {
              const el = document.querySelector(sel) as HTMLInputElement
              return (
                el?.hasAttribute('required') ||
                el?.hasAttribute('pattern') ||
                el?.type === 'email' ||
                el?.type === 'url'
              )
            },
            step.selector
          )

          if (hasValidation && !step.value) {
            risks.medium.push({
              step: step.order,
              risk: 'Input has validation but test data may not match pattern',
              severity: 'medium',
              mitigation: 'Ensure test data matches input validation requirements',
            })
          }
        }
      }
    }

    return risks
  }

  /**
   * Generate mitigation strategies for risks
   */
  generateMitigationStrategies(risks: RiskAnalysis): Array<{
    step: number
    strategies: string[]
    priority: 'high' | 'medium' | 'low'
  }> {
    const mitigations: Array<{
      step: number
      strategies: string[]
      priority: 'high' | 'medium' | 'low'
    }> = []

    // Group by step
    const stepRisks = new Map<number, Risk[]>()

    ;[...risks.high, ...risks.medium, ...risks.low].forEach((risk) => {
      if (!stepRisks.has(risk.step)) {
        stepRisks.set(risk.step, [])
      }
      stepRisks.get(risk.step)!.push(risk)
    })

    stepRisks.forEach((stepRiskList, step) => {
      const strategies: string[] = []
      let priority: 'high' | 'medium' | 'low' = 'low'

      stepRiskList.forEach((risk) => {
        if (risk.severity === 'high') priority = 'high'
        else if (risk.severity === 'medium' && priority !== 'high') priority = 'medium'

        strategies.push(risk.mitigation)
      })

      mitigations.push({
        step,
        strategies: [...new Set(strategies)], // Remove duplicates
        priority,
      })
    })

    return mitigations
  }
}

