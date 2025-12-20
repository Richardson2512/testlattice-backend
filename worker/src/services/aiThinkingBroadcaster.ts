// AI Thinking Broadcaster
// Emits lightweight "AI reasoning states" for real-time visibility

import Redis from 'ioredis'

export type AIThinkingState = 
  | 'analyzing_navigation'
  | 'looking_for_primary_cta'
  | 'attempting_alternative_selector'
  | 'synthesizing_context'
  | 'generating_action'
  | 'validating_element'
  | 'waiting_for_page_load'
  | 'checking_for_overlays'
  | 'exploring_page_structure'

export interface AIThinkingMessage {
  state: AIThinkingState
  message: string
  stepNumber: number
  timestamp: number
}

/**
 * AI Thinking Broadcaster
 * 
 * Philosophy: Help solo devs see what AI is doing internally
 * Non-verbose, real-time, optional
 */
export class AIThinkingBroadcaster {
  private redis: Redis

  constructor(redis: Redis) {
    this.redis = redis
  }

  /**
   * Broadcast AI thinking state
   */
  async broadcast(runId: string, state: AIThinkingState, stepNumber: number, context?: string): Promise<void> {
    try {
      const messages: Record<AIThinkingState, string> = {
        analyzing_navigation: 'Analyzing page navigation...',
        looking_for_primary_cta: 'Looking for primary call-to-action...',
        attempting_alternative_selector: 'Attempting alternative selector...',
        synthesizing_context: 'Synthesizing page context...',
        generating_action: 'Generating next action...',
        validating_element: 'Validating element visibility...',
        waiting_for_page_load: 'Waiting for page to load...',
        checking_for_overlays: 'Checking for popups or overlays...',
        exploring_page_structure: 'Exploring page structure...',
      }

      const message: AIThinkingMessage = {
        state,
        message: context || messages[state],
        stepNumber,
        timestamp: Date.now(),
      }

      await this.redis.publish(`test:${runId}:ai-thinking`, JSON.stringify(message))
    } catch (error: any) {
      // Non-blocking - don't fail if broadcast fails
      console.warn(`[AIThinkingBroadcaster] Failed to broadcast:`, error.message)
    }
  }
}

