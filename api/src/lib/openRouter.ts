/**
 * OpenRouter API Client
 * Handles LLM calls via OpenRouter for fix prompt generation
 */

interface OpenRouterMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

interface OpenRouterResponse {
  id: string
  choices: Array<{
    message: {
      role: string
      content: string
    }
    finish_reason: string
  }>
  usage: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
}

interface OpenRouterRequest {
  model: string
  messages: OpenRouterMessage[]
  temperature?: number
  max_tokens?: number
}

export class OpenRouterService {
  private apiKey: string
  private baseUrl = 'https://openrouter.ai/api/v1'

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.OPENROUTER_API_KEY || ''
    if (!this.apiKey) {
      console.warn('⚠️  OpenRouter API key not configured. Fix prompt generation will not work.')
    }
  }

  /**
   * Generate text using OpenRouter
   */
  async generate(
    model: string,
    systemPrompt: string,
    userPrompt: string,
    options?: {
      temperature?: number
      maxTokens?: number
    }
  ): Promise<{
    content: string
    usage: {
      promptTokens: number
      completionTokens: number
      totalTokens: number
    }
  }> {
    if (!this.apiKey) {
      throw new Error('OpenRouter API key not configured')
    }

    const messages: OpenRouterMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ]

    const requestBody: OpenRouterRequest = {
      model,
      messages,
      temperature: options?.temperature ?? 0.7,
      max_tokens: options?.maxTokens ?? 2000,
    }

    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
          'HTTP-Referer': process.env.APP_URL || 'https://rihario.dev',
          'X-Title': 'Rihario - AI Testing Platform',
        },
        body: JSON.stringify(requestBody),
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`OpenRouter API error: ${response.status} ${errorText}`)
      }

      const data = await response.json() as OpenRouterResponse

      if (!data.choices || data.choices.length === 0) {
        throw new Error('No response from OpenRouter')
      }

      return {
        content: data.choices[0].message.content,
        usage: {
          promptTokens: data.usage.prompt_tokens,
          completionTokens: data.usage.completion_tokens,
          totalTokens: data.usage.total_tokens,
        },
      }
    } catch (error: any) {
      throw new Error(`Failed to call OpenRouter: ${error.message}`)
    }
  }

  /**
   * Get available models (curated list for fix prompts)
   */
  static getAvailableModels(): Array<{
    id: string
    name: string
    provider: string
    recommended?: boolean
  }> {
    return [
      { id: 'openai/gpt-4-turbo', name: 'GPT-4 Turbo', provider: 'OpenAI', recommended: true },
      { id: 'openai/gpt-4', name: 'GPT-4', provider: 'OpenAI' },
      { id: 'anthropic/claude-3.5-sonnet', name: 'Claude 3.5 Sonnet', provider: 'Anthropic', recommended: true },
      { id: 'anthropic/claude-3-opus', name: 'Claude 3 Opus', provider: 'Anthropic' },
      { id: 'google/gemini-pro-1.5', name: 'Gemini Pro 1.5', provider: 'Google' },
      { id: 'deepseek/deepseek-chat', name: 'DeepSeek Chat', provider: 'DeepSeek' },
      { id: 'qwen/qwen-2.5-72b-instruct', name: 'Qwen 2.5 72B', provider: 'Qwen' },
    ]
  }

  /**
   * Get recommended model (default)
   */
  static getRecommendedModel(): string {
    return 'openai/gpt-4-turbo'
  }
}

