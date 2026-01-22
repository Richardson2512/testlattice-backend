// Self-Healing Module - Selector recovery strategies
// When a selector fails, tries alternative strategies to find the element

import { Page } from 'playwright'
import { LLMAction, SelfHealingInfo } from '../../types'
interface HealingCandidate {
    selector: string
    strategy: SelfHealingInfo['strategy']
    note: string
    confidence: number
}

export class SelfHealing {
    /**
     * Apply click self-healing by trying multiple strategies
     */
    async applyClickSelfHealing(
        page: Page,
        action: LLMAction,
        performClick: (page: Page, selector: string, options?: { fromHealing?: boolean }) => Promise<void>
    ): Promise<SelfHealingInfo | null> {
        const originalSelector = action.selector
        const candidates = this.buildHealingCandidates(action)
        const tried = new Set<string>()

        for (const candidate of candidates) {
            if (!candidate.selector || tried.has(candidate.selector)) {
                continue
            }
            tried.add(candidate.selector)
            try {
                await performClick(page, candidate.selector, { fromHealing: true })
                console.log(`SelfHealing: Succeeded via ${candidate.strategy} → ${candidate.selector}`)
                return {
                    strategy: candidate.strategy,
                    originalSelector,
                    healedSelector: candidate.selector,
                    note: candidate.note,
                    confidence: candidate.confidence,
                }
            } catch {
                continue
            }
        }

        return null
    }

    /**
     * Build all healing candidates from different strategies
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
     * Fallback strategies for :has-text selectors
     */
    getLocatorFallbacks(selector: string): HealingCandidate[] {
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
                confidence: 0.95,
            })
        }
        return fallbacks
    }

    /**
     * Text-based heuristics for finding elements
     */
    buildTextHeuristics(action: LLMAction): HealingCandidate[] {
        const text = this.extractTextHint(action)
        if (!text) return []
        const escaped = text.replace(/"/g, '\\"')
        return [
            {
                selector: `xpath=//*[self::button or self::a or @role="button"][contains(normalize-space(.), "${escaped}")]`,
                strategy: 'text',
                note: `Matched by visible text "${text}"`,
                confidence: 0.9,
            },
            {
                selector: `xpath=//*[contains(@aria-label, "${escaped}") or contains(@title, "${escaped}")]`,
                strategy: 'text',
                note: `Matched by aria-label/title containing "${text}"`,
                confidence: 0.9,
            },
        ]
    }

    /**
     * Attribute-based heuristics for finding elements
     */
    buildAttributeHeuristics(selector: string): HealingCandidate[] {
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
                    confidence: 0.8,
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
                    confidence: 0.8,
                })
            }
        }

        return candidates
    }

    /**
     * Structural heuristics based on DOM structure
     */
    buildStructuralHeuristics(selector: string): HealingCandidate[] {
        if (!selector) return []
        const stripped = selector
            .replace(/#[\w-]+/g, '')
            .replace(/\[data-[^\]]+\]/g, '')
            .replace(/\s+/g, ' ')
            .trim()

        if (stripped && stripped !== selector) {
            return [
                {
                    selector: stripped,
                    strategy: 'position',
                    note: 'Stripped dynamic attributes, kept structural selectors',
                    confidence: 0.5,
                },
            ]
        }
        return []
    }

    /**
     * Extract text hint from action for matching
     */
    private extractTextHint(action: LLMAction): string | undefined {
        if (action.target) return action.target

        const selector = action.selector || ''
        const hasTextMatch = selector.match(/:has-text\((['"])(.+?)\1\)/)
        if (hasTextMatch) return hasTextMatch[2]

        const textMatch = selector.match(/text=["']?(.+?)["']?$/)
        if (textMatch) return textMatch[1]

        return undefined
    }
}
