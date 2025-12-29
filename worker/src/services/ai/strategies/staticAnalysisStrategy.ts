
import { AIStrategy, StrategyTask, StrategyResult } from './types'

export class StaticAnalysisStrategy implements AIStrategy {
    name = 'StaticAnalysis (Regex/DOM)'

    canHandle(task: StrategyTask): boolean {
        // Can handle simple verification tasks or specific data extraction
        const goal = task.goal.toLowerCase()
        return (
            goal.includes('verify') ||
            goal.includes('check if') ||
            goal.includes('extract') ||
            goal.includes('analyze')
        )
    }

    estimateCost(task: StrategyTask): number {
        return 0 // Practically free
    }

    async execute(task: StrategyTask): Promise<StrategyResult> {
        const goal = task.goal.toLowerCase()

        const dom = (task.context as any).dom || (task.context.metadata as any).dom || ''

        try {
            // Case 1: Simple Existence Check ("Verify X is visible")
            if (goal.includes('verify') && (goal.includes('visible') || goal.includes('present'))) {
                // Extract what to check from the goal
                // "Verify 'Welcome User' is visible" -> "Welcome User"
                const match = goal.match(/verify ['"](.+?)['"] is (visible|present)/i)
                if (match) {
                    const targetText = match[1]
                    const exists = dom.toLowerCase().includes(targetText.toLowerCase())

                    return {
                        success: true,
                        confidence: exists ? 1.0 : 0.0, // High certainty
                        data: {
                            verified: exists,
                            details: exists ? `Found text "${targetText}" in DOM` : `Text "${targetText}" NOT found in DOM`
                        },
                        strategyUsed: this.name
                    }
                }
            }

            // Case 2: Error Message Extraction
            if (goal.includes('extract') && goal.includes('error')) {
                // Look for common error patterns
                // 1. role="alert"
                // 2. class="error"
                // 3. text containing "error" or "failed"

                // Simple regex scan for error-like content
                // <div class="error-toast">Invalid password</div>
                const errorRegex = /class="[^"]*error[^"]*"[^>]*>([^<]+)</i
                const match = dom.match(errorRegex)

                if (match) {
                    return {
                        success: true,
                        confidence: 0.9,
                        data: {
                            extracted: match[1].trim(),
                            type: 'error_message'
                        },
                        strategyUsed: this.name
                    }
                }
            }

            // Case 3: URL Check
            if (goal.includes('check url') || (goal.includes('verify') && goal.includes('url'))) {
                // Assuming URL is passed in context params or visible in DOM metadata (context injection needed)
                // For now, this is a placeholder for how specific checks would work
                // But since we fail open, it's safe to return "cannot handle" if we aren't 100% sure
            }

            // If we couldn't confidently solve it with regex, we return "success: false" to trigger fallback
            // Crucial: This is the "Fail Open" mechanism
            return {
                success: false, // Signal to Router: "I couldn't do it, send to the smart guy"
                confidence: 0,
                data: null,
                strategyUsed: this.name
            }

        } catch (e) {
            return {
                success: false,
                confidence: 0,
                data: null,
                strategyUsed: this.name
            }
        }
    }
}
