// Self-healing logic for Playwright actions
import { Page } from 'playwright'
import { LLMAction, SelfHealingInfo } from '../../../types'

interface HealingCandidate {
  selector: string
  strategy: SelfHealingInfo['strategy']
  note: string
}

export class SelfHealingService {
  /**
   * Apply self-healing to a click action
   */
  async applyClickSelfHealing(
    page: Page,
    action: LLMAction,
    performClick: (page: Page, selector: string, options?: { fromHealing?: boolean }) => Promise<void>
  ): Promise<SelfHealingInfo | null> {
    const originalSelector = action.selector
    if (!originalSelector) {
      return null
    }

    const candidates = this.buildHealingCandidates(action)
    const tried = new Set<string>()
    
    for (const candidate of candidates) {
      if (!candidate.selector || tried.has(candidate.selector)) {
        continue
      }
      tried.add(candidate.selector)
      try {
        await performClick(page, candidate.selector, { fromHealing: true })
        console.log(`Playwright: Self-healing succeeded via ${candidate.strategy} → ${candidate.selector}`)
        return {
          strategy: candidate.strategy,
          originalSelector,
          healedSelector: candidate.selector,
          note: candidate.note,
        }
      } catch {
        continue
      }
    }
    
    return null
  }

  /**
   * Build all healing candidates for an action
   */
  buildHealingCandidates(action: LLMAction): HealingCandidate[] {
    const selector = action.selector || ''
    const candidates: HealingCandidate[] = []
    
    candidates.push(...this.getLocatorFallbacks(selector))
    candidates.push(...this.buildTextHeuristics(action))
    candidates.push(...this.buildAttributeHeuristics(selector))
    candidates.push(...this.buildStructuralHeuristics(selector))
    
    return candidates
  }

  /**
   * Get locator fallbacks (e.g., convert :has-text to XPath)
   */
  private getLocatorFallbacks(selector: string): HealingCandidate[] {
    const fallbacks: HealingCandidate[] = []
    const hasTextRegex = /:has-text\((['"])(.+?)\1\)/
    const match = selector.match(hasTextRegex)
    if (match && match[2]) {
      const text = match[2]
      const escaped = text.replace(/"/g, '\\"')
      const xpath = `xpath=//*[contains(normalize-space(.), "${escaped}")]`
      fallbacks.push({
        selector: xpath,
        strategy: 'fallback',
        note: `Converted :has-text("${text}") selector to XPath text match`,
      })
    }
    return fallbacks
  }

  /**
   * Build text-based heuristics (match by visible text)
   */
  private buildTextHeuristics(action: LLMAction): HealingCandidate[] {
    const text = this.extractTextHint(action)
    if (!text) return []
    const escaped = text.replace(/"/g, '\\"')
    return [
      {
        selector: `xpath=//*[self::button or self::a or @role="button"][contains(normalize-space(.), "${escaped}")]`,
        strategy: 'text',
        note: `Matched by visible text "${text}"`,
      },
      {
        selector: `xpath=//*[contains(@aria-label, "${escaped}") or contains(@title, "${escaped}")]`,
        strategy: 'text',
        note: `Matched by aria-label/title containing "${text}"`,
      },
    ]
  }

  /**
   * Build attribute-based heuristics (match by ID/data-attr prefixes)
   */
  private buildAttributeHeuristics(selector: string): HealingCandidate[] {
    const candidates: HealingCandidate[] = []
    if (!selector) return candidates
    
    const tagMatch = selector.match(/^[a-zA-Z]+/)
    const tag = tagMatch ? tagMatch[0] : ''
    
    const idMatch = selector.match(/#([\w-]+)/)
    if (idMatch) {
      const rawId = idMatch[1]
      const stablePrefix = rawId.replace(/[\d_]+$/g, '')
      if (stablePrefix && stablePrefix.length >= 3 && stablePrefix !== rawId) {
        const healed = `${tag ? `${tag}` : ''}[id^="${stablePrefix}"]`
        candidates.push({
          selector: healed,
          strategy: 'attribute',
          note: `Used ID prefix "${stablePrefix}" to match dynamic IDs`,
        })
      }
    }
    
    const dataAttrMatch = selector.match(/\[(data-[^\]=]+)=["']?([^"' \]]+)["']?\]/)
    if (dataAttrMatch) {
      const attrName = dataAttrMatch[1]
      const attrValue = dataAttrMatch[2]
      const trimmed = attrValue.replace(/[\d_]+$/g, '')
      if (trimmed && trimmed.length >= 3 && trimmed !== attrValue) {
        candidates.push({
          selector: `[${attrName}^="${trimmed}"]`,
          strategy: 'attribute',
          note: `Used ${attrName} prefix "${trimmed}" to bypass dynamic suffixes`,
        })
      }
    }
    
    return candidates
  }

  /**
   * Build structural heuristics (remove dynamic parts, rely on structure)
   */
  private buildStructuralHeuristics(selector: string): HealingCandidate[] {
    if (!selector) return []
    const stripped = selector
      .replace(/#[\w-]+/g, '')
      .replace(/\[data-[^\]]+\]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
    
    if (!stripped || stripped === selector) {
      return []
    }
    
    return [{
      selector: stripped,
      strategy: 'position',
      note: 'Removed dynamic IDs and data attributes to rely on structural path',
    }]
  }

  /**
   * Extract text hint from action
   */
  private extractTextHint(action: LLMAction): string | null {
    const candidates = [
      action.target,
      this.extractQuotedText(action.description || ''),
      action.description,
    ].filter(Boolean) as string[]
    
    for (const candidate of candidates) {
      const cleaned = candidate.trim()
      if (cleaned && cleaned.length <= 60) {
        return cleaned
      }
    }
    
    return null
  }

  /**
   * Extract quoted text from description
   */
  private extractQuotedText(text: string): string | null {
    if (!text) return null
    const match = text.match(/["""''](.+?)["""'']/)
    return match?.[1] || null
  }
}

