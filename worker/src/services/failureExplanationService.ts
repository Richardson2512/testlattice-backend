// Failure Explanation Service
// Generates AI-powered "why did this fail?" explanations for solo devs

import { ModelClient } from './unifiedBrain/ModelClient'
import { UnifiedBrainService } from './unifiedBrainService'
import { TestStep, LLMAction } from '../types'
import { buildBoundedPrompt, TOKEN_BUDGETS } from './unifiedBrain/tokenBudget'

export interface FailureExplanation {
  why: string // Plain English: why the failure likely happened
  userExperience: string // What a real user would experience
  suggestion: string // One actionable suggestion
  confidence: 'high' | 'medium' | 'low'
}

export interface FailureContext {
  domSnapshot: string
  screenshotBase64?: string
  consoleErrors: Array<{ type: string; message: string; timestamp: string }>
  networkErrors: Array<{ url: string; status: number; timestamp: string }>
  actionHistory: Array<{ action: LLMAction; timestamp: string }>
  failedAction: LLMAction
  errorMessage: string
  stepNumber: number
}

/**
 * Failure Explanation Service
 * 
 * Philosophy: Help solo devs understand "why" failures happen, not just "what"
 * Tone: Conversational, helpful, not technical jargon
 */
export class FailureExplanationService {
  private modelClient: ModelClient

  constructor(unifiedBrain: UnifiedBrainService) {
    this.modelClient = (unifiedBrain as any).modelClient
    if (!this.modelClient) {
      throw new Error('FailureExplanationService: UnifiedBrainService modelClient not available')
    }
  }

  /**
   * Generate AI explanation for why a step failed
   */
  async explainFailure(context: FailureContext): Promise<FailureExplanation> {
    try {
      // Build concise context for AI
      const recentActions = context.actionHistory.slice(-5).map((h, idx) => {
        return `${idx + 1}. ${h.action.action} ${h.action.target || h.action.selector || ''}`
      }).join('\n')

      const consoleErrorSummary = context.consoleErrors.slice(-3).map(e =>
        `${e.type}: ${e.message.substring(0, 100)}`
      ).join('\n') || 'No console errors'

      const networkErrorSummary = context.networkErrors.slice(-3).map(e =>
        `${e.status} ${e.url.substring(0, 60)}`
      ).join('\n') || 'No network errors'

      // Extract DOM snippet around failed element (if selector exists)
      let domSnippet = 'DOM context unavailable'
      if (context.failedAction.selector) {
        try {
          // Try to find element in DOM snapshot
          const selectorMatch = context.domSnapshot.match(
            new RegExp(`[^<]*<[^>]*${context.failedAction.selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[^>]*>.*?</[^>]*>`, 'i')
          )
          if (selectorMatch) {
            domSnippet = selectorMatch[0].substring(0, 300)
          }
        } catch {
          // Fallback to generic
          domSnippet = 'Element selector: ' + context.failedAction.selector
        }
      }

      const basePrompt = `A test step failed. Help a solo developer understand why.

Failed Action: ${context.failedAction.action} ${context.failedAction.target || context.failedAction.selector || ''}
Error: ${context.errorMessage}
Step Number: ${context.stepNumber}

Provide a short, plain-English explanation:
1. WHY the failure likely happened (one sentence)
2. What a real user would experience (one sentence)
3. One actionable suggestion (one sentence)

Tone: Conversational, helpful. No technical jargon. Write like you're explaining to a friend.

Return JSON:
{
  "why": "The button you're trying to click is hidden because...",
  "userExperience": "A real user would see...",
  "suggestion": "Check if the element should be visible, or...",
  "confidence": "high|medium|low"
}`

      const systemPrompt = `You are a helpful debugging assistant for solo developers. Explain test failures in plain English. Be concise, actionable, and friendly. No enterprise jargon.`

      // Build prompt with token budget enforcement
      const prompt = buildBoundedPrompt(basePrompt, {
        history: `Recent Actions (last 5):\n${recentActions}\n\nConsole Errors:\n${consoleErrorSummary}\n\nNetwork Errors:\n${networkErrorSummary}\n\nDOM Context:\n${domSnippet.substring(0, 300)}`,
      }, TOKEN_BUDGETS.errorAnalysis)

      const result = await this.modelClient.call(
        prompt,
        systemPrompt,
        'analyze'
      )

      const parsed = JSON.parse(result.content)

      return {
        why: parsed.why || 'Unable to determine root cause',
        userExperience: parsed.userExperience || 'The action could not be completed',
        suggestion: parsed.suggestion || 'Review the error details and try again',
        confidence: parsed.confidence || 'medium',
      }
    } catch (error: any) {
      console.warn(`[FailureExplanationService] AI explanation failed:`, error.message)

      // Fallback: Generate basic explanation from error message
      return this.generateFallbackExplanation(context.errorMessage, context.failedAction)
    }
  }

  /**
   * Generate fallback explanation when AI fails
   */
  private generateFallbackExplanation(errorMessage: string, action: LLMAction): FailureExplanation {
    const lowerError = errorMessage.toLowerCase()

    if (lowerError.includes('not visible') || lowerError.includes('hidden')) {
      return {
        why: `The ${action.target || 'element'} you're trying to interact with is hidden or not displayed on the page.`,
        userExperience: 'A real user would not be able to see or click this element.',
        suggestion: 'Check if the element should be visible at this point, or if there\'s a loading state that needs to complete first.',
        confidence: 'high',
      }
    }

    if (lowerError.includes('not found') || lowerError.includes('does not exist')) {
      return {
        why: `The ${action.target || 'element'} doesn't exist on the page anymore, or the selector is incorrect.`,
        userExperience: 'A real user would not see this element on the page.',
        suggestion: 'The page structure may have changed, or the element was removed. Check the current page state.',
        confidence: 'high',
      }
    }

    if (lowerError.includes('timeout')) {
      return {
        why: 'The page or element took too long to respond.',
        userExperience: 'A real user would experience slow loading or the page might appear stuck.',
        suggestion: 'The website may be slow or having network issues. Try again, or check if the site is responding.',
        confidence: 'medium',
      }
    }

    // Generic fallback
    return {
      why: `The action failed: ${errorMessage.substring(0, 100)}`,
      userExperience: 'The interaction could not be completed.',
      suggestion: 'Review the error details and check the current page state.',
      confidence: 'low',
    }
  }
}

