/**
 * Fix Prompt Generation Service
 * Converts test findings into high-quality debugging prompts for coding AIs
 */

import { TestRun } from '../types'
import { OpenRouterService } from '../lib/openRouter'
import { supabase } from '../lib/supabase'
import { getUserTier } from '../lib/tierSystem'

export interface FixPrompt {
  id: string
  testRunId: string
  userId?: string
  model: string
  prompt: string
  tokenUsage?: {
    inputTokens: number
    outputTokens: number
    totalTokens: number
  }
  createdAt: string
  updatedAt: string
}

export class FixPromptService {
  private openRouter: OpenRouterService

  constructor() {
    this.openRouter = new OpenRouterService()
  }

  /**
   * Validate user eligibility
   */
  async validateEligibility(userId?: string): Promise<{ eligible: boolean; reason?: string }> {
    if (!userId) {
      return { eligible: false, reason: 'Authentication required' }
    }

    const tier = await getUserTier(userId)
    const paidTiers: Array<'starter' | 'indie' | 'pro' | 'agency'> = ['starter', 'indie', 'pro', 'agency']

    if (!paidTiers.includes(tier as any)) {
      return { eligible: false, reason: 'Feature available only to paid users' }
    }

    return { eligible: true }
  }

  /**
   * Check if prompt already exists for test run
   */
  async getExistingPrompt(testRunId: string): Promise<FixPrompt | null> {
    try {
      const { data, error } = await supabase
        .from('fix_prompts')
        .select('*')
        .eq('test_run_id', testRunId)
        .single()

      if (error) {
        if (error.code === 'PGRST116') {
          return null // Not found
        }
        throw error
      }

      return data ? this.mapFromDb(data) : null
    } catch (error: any) {
      throw new Error(`Failed to get existing prompt: ${error.message}`)
    }
  }

  /**
   * Generate fix prompt from test run
   */
  async generatePrompt(
    testRun: TestRun,
    model: string,
    userId?: string
  ): Promise<FixPrompt> {
    // Validate eligibility
    const validation = await this.validateEligibility(userId)
    if (!validation.eligible) {
      throw new Error(validation.reason || 'Not eligible')
    }

    // Check if test is completed
    if (testRun.status !== 'completed' && testRun.status !== 'failed') {
      throw new Error('Test must be completed to generate fix prompt')
    }

    // Check if prompt already exists
    const existing = await this.getExistingPrompt(testRun.id)
    if (existing) {
      return existing
    }

    // Assemble prompt input from test data
    const promptInput = this.assemblePromptInput(testRun)

    // Generate prompt using OpenRouter
    const systemPrompt = this.getSystemPrompt()
    const userPrompt = this.buildUserPrompt(promptInput)

    const result = await this.openRouter.generate(model, systemPrompt, userPrompt, {
      temperature: 0.7,
      maxTokens: 2000,
    })

    // Store the generated prompt
    const fixPrompt: Omit<FixPrompt, 'id' | 'createdAt' | 'updatedAt'> = {
      testRunId: testRun.id,
      userId: userId || undefined,
      model,
      prompt: result.content,
      tokenUsage: {
        inputTokens: result.usage.promptTokens,
        outputTokens: result.usage.completionTokens,
        totalTokens: result.usage.totalTokens,
      },
    }

    const saved = await this.savePrompt(fixPrompt)
    return saved
  }

  /**
   * Assemble prompt input from test run data
   */
  private assemblePromptInput(testRun: TestRun): {
    appType?: string
    pageUrls: string[]
    testIntent?: string
    whatHappened: string
    failedSteps: Array<{
      stepNumber: number
      action: string
      target?: string
      error?: string
      screenshotUrl?: string
    }>
    evidence: {
      consoleErrors: string[]
      networkFailures: Array<{ url: string; status: number; error?: string }>
      screenshotUrls: string[]
      domObservations: string[]
    }
    userImpact: string
  } {
    const steps = testRun.steps || []
    const failedSteps = steps.filter(s => !s.success)

    // Extract console errors from diagnosis
    const consoleErrors: string[] = []
    if (testRun.diagnosis?.comprehensiveTests?.consoleErrors) {
      testRun.diagnosis.comprehensiveTests.consoleErrors.forEach(err => {
        consoleErrors.push(`${err.type.toUpperCase()}: ${err.message}${err.source ? ` (${err.source}:${err.line})` : ''}`)
      })
    }

    // Extract network failures
    const networkFailures: Array<{ url: string; status: number; error?: string }> = []
    if (testRun.diagnosis?.comprehensiveTests?.networkErrors) {
      testRun.diagnosis.comprehensiveTests.networkErrors.forEach(err => {
        if (err.failed) {
          networkFailures.push({
            url: err.url,
            status: err.status,
            error: err.errorText,
          })
        }
      })
    }

    // Collect screenshot URLs
    const screenshotUrls = steps
      .filter(s => s.screenshotUrl)
      .map(s => s.screenshotUrl!)
      .filter((url, index, self) => self.indexOf(url) === index) // Unique

    // Extract DOM observations from failed steps
    const domObservations: string[] = []
    failedSteps.forEach(step => {
      if (step.target) {
        domObservations.push(`Step ${step.stepNumber}: Tried to interact with "${step.target}"`)
      }
      if (step.error) {
        domObservations.push(`Step ${step.stepNumber}: ${step.error}`)
      }
    })

    // Determine user impact
    const userImpact = failedSteps.length > 0
      ? `Users would experience ${failedSteps.length} failure(s) during the test flow. The most critical issue appears to be: ${failedSteps[0]?.error || failedSteps[0]?.action || 'Unknown error'}.`
      : 'No critical failures detected, but issues were found during exploration.'

    // Build what happened description
    const whatHappened = failedSteps.length > 0
      ? `The AI attempted to ${failedSteps.map(s => s.action).join(', ')} but encountered ${failedSteps.length} failure(s).`
      : 'The AI completed exploration but detected potential issues.'

    return {
      appType: testRun.build.type === 'web' ? 'Web Application' : undefined,
      pageUrls: testRun.build.url ? [testRun.build.url] : [],
      testIntent: testRun.options?.testMode || 'exploratory testing',
      whatHappened,
      failedSteps: failedSteps.map(s => ({
        stepNumber: s.stepNumber,
        action: s.action,
        target: s.target,
        error: s.error,
        screenshotUrl: s.screenshotUrl,
      })),
      evidence: {
        consoleErrors,
        networkFailures,
        screenshotUrls,
        domObservations,
      },
      userImpact,
    }
  }

  /**
   * Get system prompt for fix prompt generation
   */
  private getSystemPrompt(): string {
    return `You are a helpful assistant that generates debugging prompts for coding AIs (like Cursor, ChatGPT, or GitHub Copilot).

Your task is to create a clear, structured prompt that helps a coding AI understand a frontend testing issue and suggest fixes.

The prompt should:
1. Be honest and non-absolute (no "guaranteed fix" language)
2. Include context about what happened
3. Present evidence clearly
4. Explain user impact
5. Suggest likely causes (marked as hypotheses)
6. Request help in a way that encourages reasoning, not blind code output

Do NOT:
- Promise fixes
- Access repositories
- Execute code
- Modify files automatically

Output ONLY the debugging prompt text, ready to be pasted into a coding AI.`
  }

  /**
   * Build user prompt for OpenRouter
   */
  private buildUserPrompt(input: ReturnType<typeof this.assemblePromptInput>): string {
    const sections: string[] = []

    // Context
    sections.push('## Context')
    if (input.appType) {
      sections.push(`App Type: ${input.appType}`)
    }
    if (input.pageUrls.length > 0) {
      sections.push(`Page URL(s): ${input.pageUrls.join(', ')}`)
    }
    if (input.testIntent) {
      sections.push(`Test Intent: ${input.testIntent}`)
    }

    // What Happened
    sections.push('\n## What Happened')
    sections.push(input.whatHappened)
    if (input.failedSteps.length > 0) {
      sections.push('\nFailed Steps:')
      input.failedSteps.forEach(step => {
        sections.push(`- Step ${step.stepNumber}: ${step.action}${step.target ? ` on "${step.target}"` : ''}${step.error ? ` - Error: ${step.error}` : ''}`)
      })
    }

    // Evidence
    sections.push('\n## Evidence')
    if (input.evidence.consoleErrors.length > 0) {
      sections.push('\nConsole Errors:')
      input.evidence.consoleErrors.forEach(err => {
        sections.push(`- ${err}`)
      })
    }
    if (input.evidence.networkFailures.length > 0) {
      sections.push('\nNetwork Failures:')
      input.evidence.networkFailures.forEach(failure => {
        sections.push(`- ${failure.url}: ${failure.status}${failure.error ? ` - ${failure.error}` : ''}`)
      })
    }
    if (input.evidence.screenshotUrls.length > 0) {
      sections.push(`\nScreenshots: ${input.evidence.screenshotUrls.length} screenshot(s) captured during testing`)
    }
    if (input.evidence.domObservations.length > 0) {
      sections.push('\nDOM Observations:')
      input.evidence.domObservations.forEach(obs => {
        sections.push(`- ${obs}`)
      })
    }

    // User Impact
    sections.push('\n## User Impact')
    sections.push(input.userImpact)

    // Likely Causes
    sections.push('\n## Likely Causes (Hypotheses)')
    sections.push('Based on the evidence above, possible causes might include:')
    sections.push('- Selector issues (element not found or changed)')
    sections.push('- Timing issues (element not ready when accessed)')
    sections.push('- State management problems')
    sections.push('- Network/API failures')
    sections.push('- JavaScript errors preventing interaction')
    sections.push('\n(These are hypotheses - actual cause may differ)')

    // Request for Help
    sections.push('\n## Request for Help')
    sections.push('Can you help me debug this issue? Please:')
    sections.push('1. Analyze the evidence and suggest likely root causes')
    sections.push('2. Provide code fixes or suggestions (if applicable)')
    sections.push('3. Explain your reasoning')
    sections.push('4. Note any assumptions you\'re making')

    return sections.join('\n')
  }

  /**
   * Save prompt to database
   */
  private async savePrompt(
    prompt: Omit<FixPrompt, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<FixPrompt> {
    const now = new Date().toISOString()

    const { data, error } = await supabase
      .from('fix_prompts')
      .insert({
        test_run_id: prompt.testRunId,
        user_id: prompt.userId || null,
        model: prompt.model,
        prompt: prompt.prompt,
        token_usage: prompt.tokenUsage ? {
          inputTokens: prompt.tokenUsage.inputTokens,
          outputTokens: prompt.tokenUsage.outputTokens,
          totalTokens: prompt.tokenUsage.totalTokens,
        } : null,
        created_at: now,
        updated_at: now,
      })
      .select()
      .single()

    if (error) {
      throw new Error(`Failed to save fix prompt: ${error.message}`)
    }

    return this.mapFromDb(data)
  }

  /**
   * Map database row to FixPrompt
   */
  private mapFromDb(row: any): FixPrompt {
    return {
      id: row.id,
      testRunId: row.test_run_id,
      userId: row.user_id || undefined,
      model: row.model,
      prompt: row.prompt,
      tokenUsage: row.token_usage ? {
        inputTokens: row.token_usage.inputTokens || row.token_usage.input_tokens || row.token_usage.prompt_tokens || 0,
        outputTokens: row.token_usage.outputTokens || row.token_usage.output_tokens || row.token_usage.completion_tokens || 0,
        totalTokens: row.token_usage.totalTokens || row.token_usage.total_tokens || 0,
      } : undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }
  }
}

