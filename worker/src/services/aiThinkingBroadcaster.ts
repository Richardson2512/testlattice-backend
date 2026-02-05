/**
 * AIThinkingBroadcaster - Broadcasts AI thinking state to frontend via WebSocket
 * Used to show "AI is thinking..." indicators during test execution
 */

export type AIThinkingState =
    | 'generating_action'
    | 'analyzing_screenshot'
    | 'healing_selector'
    | 'evaluating_step'
    | 'idle'

export class AIThinkingBroadcaster {
    private apiUrl: string

    constructor(apiUrl?: string) {
        this.apiUrl = apiUrl || process.env.API_URL || 'http://localhost:3001'
    }

    /**
     * Broadcast AI thinking state for a run
     * This notifies the frontend that AI is actively processing
     */
    async broadcast(runId: string, state: AIThinkingState, stepNumber?: number): Promise<void> {
        try {
            const fetch = (await import('node-fetch')).default
            await fetch(`${this.apiUrl}/api/tests/${runId}/ai-thinking`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    state,
                    stepNumber,
                    timestamp: new Date().toISOString()
                })
            }).catch(() => {
                // Ignore broadcast failures - non-critical
            })
        } catch {
            // Silent fail - broadcasting is informational only
        }
    }

    /**
     * Clear AI thinking state (set to idle)
     */
    async clear(runId: string): Promise<void> {
        await this.broadcast(runId, 'idle')
    }
}

// Singleton instance factory
let _instance: AIThinkingBroadcaster | null = null

export function getAIThinkingBroadcaster(): AIThinkingBroadcaster {
    if (!_instance) {
        _instance = new AIThinkingBroadcaster()
    }
    return _instance
}
