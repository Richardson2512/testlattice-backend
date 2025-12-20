// Token Budget Management
// Enforces per-call token limits to prevent uncontrolled growth

/**
 * Token budgets per call type (approximate, conservative estimates)
 * These are input token limits to ensure we stay within model context windows
 */
export const TOKEN_BUDGETS = {
    // Planning and diagnosis calls (can use more tokens)
    planning: 3000,
    diagnosis: 3000,
    testability: 2500,
    
    // Step execution calls (most common, needs to be efficient)
    action: 2000,
    step: 2000,
    
    // Cookie banner detection (should be quick)
    cookieBanner: 1500,
    
    // Error analysis and healing
    errorAnalysis: 2000,
    healing: 2000,
    
    // Context synthesis
    synthesis: 2500,
    
    // Final summary
    summary: 2000,
} as const

/**
 * Estimate token count (rough approximation: 1 token ≈ 4 characters)
 */
export function estimateTokens(text: string): number {
    return Math.ceil(text.length / 4)
}

/**
 * Prune DOM snapshot to reduce token usage
 * Removes:
 * - Script tags and their content
 * - Style tags and their content
 * - Comments
 * - Invisible/hidden elements (already filtered by DOMParser, but double-check)
 * - Excessive whitespace
 */
export function pruneDOM(domSnapshot: string, maxLength: number): string {
    let pruned = domSnapshot
    
    // Remove script tags and content
    pruned = pruned.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    
    // Remove style tags and content
    pruned = pruned.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    
    // Remove HTML comments
    pruned = pruned.replace(/<!--[\s\S]*?-->/g, '')
    
    // Remove excessive whitespace (keep single spaces)
    pruned = pruned.replace(/\s+/g, ' ')
    
    // Truncate if still too long (deterministic: from start)
    if (pruned.length > maxLength) {
        pruned = pruned.substring(0, maxLength)
        // Try to end at a tag boundary if possible
        const lastTag = pruned.lastIndexOf('>')
        if (lastTag > maxLength * 0.9) {
            pruned = pruned.substring(0, lastTag + 1)
        }
    }
    
    return pruned
}

/**
 * Limit history context to recent steps
 */
export function limitHistory<T>(history: T[], maxItems: number): T[] {
    return history.slice(-maxItems)
}

/**
 * Truncate text deterministically to fit token budget
 * Preserves start of text (most important context)
 */
export function truncateToTokenBudget(text: string, maxTokens: number): string {
    const maxChars = maxTokens * 4 // Conservative: 4 chars per token
    if (text.length <= maxChars) {
        return text
    }
    
    // Truncate from start, preserving end (most recent context)
    return text.substring(text.length - maxChars)
}

/**
 * Build prompt with token budget enforcement
 */
export function buildBoundedPrompt(
    basePrompt: string,
    context: {
        domSnapshot?: string
        history?: string
        goal?: string
        elements?: string
    },
    budget: number
): string {
    // Reserve tokens for base prompt and structure
    const baseTokens = estimateTokens(basePrompt)
    const reservedTokens = baseTokens + 200 // Reserve for JSON structure, instructions
    const availableTokens = budget - reservedTokens
    
    if (availableTokens < 100) {
        throw new Error(`Token budget too small: ${budget} tokens. Base prompt requires ${baseTokens} tokens.`)
    }
    
    let prompt = basePrompt + '\n\n'
    
    // Allocate tokens to context parts (prioritize goal and elements)
    const goalTokens = context.goal ? Math.min(estimateTokens(context.goal), 200) : 0
    const elementsTokens = context.elements ? Math.min(estimateTokens(context.elements), availableTokens * 0.5) : 0
    const historyTokens = context.history ? Math.min(estimateTokens(context.history), availableTokens * 0.2) : 0
    const domTokens = availableTokens - goalTokens - elementsTokens - historyTokens
    
    if (context.goal) {
        prompt += `Goal: ${context.goal}\n\n`
    }
    
    if (context.elements) {
        const elementsText = truncateToTokenBudget(context.elements, Math.floor(elementsTokens))
        prompt += `Available Elements:\n${elementsText}\n\n`
    }
    
    if (context.history) {
        const historyText = truncateToTokenBudget(context.history, Math.floor(historyTokens))
        prompt += `Recent Actions:\n${historyText}\n\n`
    }
    
    if (context.domSnapshot && domTokens > 100) {
        const maxDomChars = Math.floor(domTokens * 4)
        const prunedDOM = pruneDOM(context.domSnapshot, maxDomChars)
        prompt += `DOM Snapshot (pruned):\n${prunedDOM.substring(0, maxDomChars)}\n\n`
    }
    
    return prompt
}

