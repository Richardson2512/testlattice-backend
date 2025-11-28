import axios from 'axios'

export interface VisionIssue {
  description: string
  severity: 'high' | 'medium' | 'low'
  suggestion?: string
}

interface VisionValidatorContext {
  url?: string
  goal?: string
}

export class VisionValidatorService {
  private apiKey: string
  private model: string
  private endpoint: string

  constructor(
    apiKey: string,
    model: string = process.env.VISION_MODEL || 'gpt-4-vision-preview',
    endpoint: string = process.env.VISION_MODEL_ENDPOINT || 'https://api.openai.com/v1/chat/completions'
  ) {
    this.apiKey = apiKey
    this.model = model
    this.endpoint = endpoint
  }

  async analyzeScreenshot(imageBase64: string, context?: VisionValidatorContext): Promise<VisionIssue[]> {
    try {
      const messages = [
        {
          role: 'system',
          content: 'You are a senior QA engineer specializing in visual layout validation. Analyze the provided screenshot for layout issues, overlaps, missing elements, or readability problems. Respond with JSON: {"issues":[{"severity":"high|medium|low","description":"...", "suggestion":"..."}]}'
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `Analyze this UI screenshot for visual/layout issues. Context URL: ${context?.url || 'unknown'} | Goal: ${context?.goal || 'General QA'}`
            },
            {
              type: 'image_url',
              image_url: {
                url: `data:image/png;base64,${imageBase64}`
              }
            }
          ]
        }
      ]

      const response = await axios.post(
        this.endpoint,
        {
          model: this.model,
          temperature: 0.2,
          response_format: { type: 'json_object' },
          messages,
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: 30000,
        }
      )

      const content = response.data.choices?.[0]?.message?.content
      if (!content) {
        return []
      }

      let parsed: any
      try {
        parsed = JSON.parse(content)
      } catch {
        return []
      }

      const issues: any[] = Array.isArray(parsed?.issues) ? parsed.issues : Array.isArray(parsed) ? parsed : []
      return issues
        .filter(issue => issue?.description)
        .map(issue => ({
          description: issue.description as string,
          severity: this.normalizedSeverity(issue.severity),
          suggestion: issue.suggestion,
        }))
    } catch (error: any) {
      console.warn('Vision validator error:', error.message)
      return []
    }
  }

  private normalizedSeverity(value?: string): 'high' | 'medium' | 'low' {
    if (!value) return 'medium'
    const severity = value.toLowerCase()
    if (severity.includes('high') || severity.includes('blocker')) return 'high'
    if (severity.includes('low')) return 'low'
    return 'medium'
  }
}


