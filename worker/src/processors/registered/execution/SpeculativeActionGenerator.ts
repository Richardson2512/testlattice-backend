/**
 * SpeculativeActionGenerator
 * Generates speculative actions for login flows and monkey testing
 * Extracted from testProcessor.ts
 */

import { VisionContext, VisionElement, LLMAction } from '../../../types'
import * as testProcessorUtils from '../../../utils/testProcessorUtils'

// ============================================================================
// Configuration
// ============================================================================

export interface SpeculativeActionConfig {
    defaultCredentials: {
        username: string
        password: string
    }
}

const DEFAULT_CONFIG: SpeculativeActionConfig = {
    defaultCredentials: {
        username: 'demo@example.com',
        password: 'DemoPass123!'
    }
}

// ============================================================================
// SpeculativeActionGenerator Class
// ============================================================================

export class SpeculativeActionGenerator {
    private config: SpeculativeActionConfig
    private speculativeFlowCache: Set<string> = new Set()

    constructor(config?: Partial<SpeculativeActionConfig>) {
        this.config = { ...DEFAULT_CONFIG, ...config }
    }

    /**
     * Generate speculative actions based on the current context
     * Returns actions for login flow if detected
     */
    generateSpeculativeActions(
        context: VisionContext,
        history: Array<{ action: LLMAction; timestamp: string }>
    ): LLMAction[] {
        // Try to build login flow
        const loginFlow = this.buildLoginFlow(context, history)
        if (loginFlow.length > 0) {
            return loginFlow
        }

        return []
    }

    /**
     * Build a login flow from detected form elements
     */
    buildLoginFlow(
        context: VisionContext,
        history: Array<{ action: LLMAction; timestamp: string }>
    ): LLMAction[] {
        const elements = context.elements

        const emailField = elements.find(e =>
            !e.isHidden &&
            e.type === 'input' &&
            e.selector &&
            this.isEmailElement(e)
        )

        const passwordField = elements.find(e =>
            !e.isHidden &&
            e.type === 'input' &&
            e.selector &&
            this.isPasswordElement(e)
        )

        const submitButton = elements.find(e =>
            !e.isHidden &&
            e.selector &&
            (e.type === 'button' || e.role === 'button') &&
            this.isSubmitElement(e)
        )

        if (!emailField || !passwordField || !submitButton) {
            return []
        }

        // Avoid repeating the same speculative flow
        const signature = `${emailField.selector}|${passwordField.selector}|${submitButton.selector}`
        if (this.speculativeFlowCache.has(signature)) {
            return []
        }

        // Skip if we've already typed into these fields or clicked submit
        if (
            this.hasPerformedAction(history, emailField.selector!, 'type') &&
            this.hasPerformedAction(history, passwordField.selector!, 'type')
        ) {
            return []
        }

        if (this.hasPerformedAction(history, submitButton.selector!, 'click')) {
            return []
        }

        this.speculativeFlowCache.add(signature)

        const credentials = this.config.defaultCredentials

        const actions: LLMAction[] = [
            {
                action: 'type',
                selector: emailField.selector!,
                value: credentials.username,
                description: 'Fill login email/username field',
                confidence: 0.92,
            },
            {
                action: 'type',
                selector: passwordField.selector!,
                value: credentials.password,
                description: 'Fill login password field',
                confidence: 0.92,
            },
            {
                action: 'click',
                selector: submitButton.selector!,
                description: submitButton.text
                    ? `Submit login form via "${submitButton.text}"`
                    : 'Submit login form',
                confidence: 0.95,
            },
        ]

        return actions
    }

    /**
     * Generate a random "monkey" action for exploratory testing
     */
    generateMonkeyAction(
        context: VisionContext,
        visitedSelectors: Set<string>,
        stepNumber: number
    ): LLMAction {
        const interactiveElements = (context.elements || []).filter((element) =>
            element.selector &&
            !element.isHidden &&
            (
                element.role === 'button' ||
                element.type === 'button' ||
                element.href ||
                (element.inputType && element.inputType !== 'hidden') ||
                (element.text && element.text.trim().length > 0)
            )
        )

        const unvisited = interactiveElements.filter(e => e.selector && !visitedSelectors.has(e.selector))
        const sourcePool = unvisited.length > 0 ? unvisited : interactiveElements

        if (sourcePool.length > 0 && Math.random() > 0.3) {
            const pick = sourcePool[Math.floor(Math.random() * sourcePool.length)]
            return {
                action: 'click',
                selector: pick.selector || undefined,
                target: pick.text || pick.role || pick.type || 'interactive element',
                description: `Monkey click on ${pick.text || pick.role || pick.type || 'element'} (step ${stepNumber})`,
                confidence: 0.45,
            }
        }

        if (Math.random() > 0.5) {
            return {
                action: 'scroll',
                description: 'Monkey scrolls to reveal more content',
                confidence: 0.6,
            }
        }

        return {
            action: 'wait',
            description: 'Monkey pauses briefly to observe page state',
            confidence: 0.4,
        }
    }

    // ============================================================================
    // Element Detection Helpers
    // ============================================================================

    private isEmailElement(element: VisionElement): boolean {
        return testProcessorUtils.isEmailElement(element)
    }

    private isPasswordElement(element: VisionElement): boolean {
        return testProcessorUtils.isPasswordElement(element)
    }

    private isSubmitElement(element: VisionElement): boolean {
        return testProcessorUtils.isSubmitElement(element)
    }

    private hasPerformedAction(
        history: Array<{ action: LLMAction; timestamp: string }>,
        selector: string,
        actionName: string
    ): boolean {
        return history.some(entry =>
            entry.action.action === actionName &&
            entry.action.selector === selector
        )
    }

    /**
     * Reset the speculative flow cache
     */
    resetCache(): void {
        this.speculativeFlowCache.clear()
    }
}

// Export singleton factory for convenience
export function createSpeculativeActionGenerator(
    config?: Partial<SpeculativeActionConfig>
): SpeculativeActionGenerator {
    return new SpeculativeActionGenerator(config)
}
