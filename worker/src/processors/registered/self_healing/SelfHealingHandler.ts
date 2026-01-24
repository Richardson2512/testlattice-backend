/**
 * Self-Healing Handler
 * Handles selector healing logic for Registered tests
 * Checks in-memory maps and persisted healing memory to repair broken selectors
 */

import { LLMAction } from '../../../types'
import { SelfHealingMemoryService } from '../../../services/selfHealingMemory'
import { StorageService } from '../../../services/storage'
import { PlaywrightRunner } from '../../../runners/playwright'

export interface SelfHealingHandlerConfig {
    runId: string
    browserType: string
}

export class SelfHealingHandler {
    private config: SelfHealingHandlerConfig
    private selfHealingMemory: SelfHealingMemoryService | null = null
    private storageService: StorageService
    private playwrightRunner: PlaywrightRunner

    constructor(
        config: SelfHealingHandlerConfig,
        storageService: StorageService,
        playwrightRunner: PlaywrightRunner,
        selfHealingMemory?: SelfHealingMemoryService
    ) {
        this.config = config
        this.storageService = storageService
        this.playwrightRunner = playwrightRunner
        this.selfHealingMemory = selfHealingMemory || null
    }

    /**
     * Attempt to apply self-healing to an action before execution
     * Checks both in-memory map and persisted storage
     */
    async applyHealing(params: {
        action: LLMAction
        selectorHealingMap: Map<string, string>
        projectId?: string
        isMobile: boolean
        session: any
        currentUrl?: string
        stepNumber: number
    }): Promise<void> {
        const { action, selectorHealingMap, projectId, isMobile, session, currentUrl, stepNumber } = params
        const originalSelector = action.selector

        if (!originalSelector) {
            return
        }

        const { runId, browserType } = this.config

        // 1. Check in-memory healing map first
        if (selectorHealingMap.has(originalSelector)) {
            const healedSelector = selectorHealingMap.get(originalSelector)!
            action.selector = healedSelector
            // Log moved to caller or handled here? Handled here for consistency
            // console.log(`[${runId}] [${browserType.toUpperCase()}] Step ${stepNumber}: Using healed selector (memory): ${originalSelector} → ${healedSelector}`)
        }
        // 2. Check persisted healing memory
        else if (projectId && !isMobile && session.page) {
            try {
                if (!this.selfHealingMemory) {
                    // Lazy init if not passed in ctor
                    this.selfHealingMemory = new SelfHealingMemoryService((this.storageService as any).supabase)
                }

                const domSnapshot = await this.playwrightRunner.getDOMSnapshot(session.id).catch(() => '')
                const pageSignature = this.selfHealingMemory.generatePageSignature(currentUrl || '', domSnapshot)

                const healedSelector = await this.selfHealingMemory.getHealingMemory(
                    projectId,
                    pageSignature,
                    originalSelector
                )

                if (healedSelector) {
                    action.selector = healedSelector
                    selectorHealingMap.set(originalSelector, healedSelector)
                    console.log(`[${runId}] [${browserType.toUpperCase()}] Step ${stepNumber}: Using persisted healing memory: ${originalSelector} → ${healedSelector}`)
                }
            } catch (memoryError: any) {
                // Non-blocking - continue without memory lookup
                console.warn(`[${runId}] Failed to load healing memory:`, memoryError.message)
            }
        }

        if (action.selector !== originalSelector) {
            console.log(`[${runId}] [${browserType.toUpperCase()}] Step ${stepNumber}: Using healed selector: ${action.selector}`)
        }
    }

    /**
     * Persist successful healing to memory
     */
    async persistHealing(params: {
        projectId?: string
        isMobile: boolean
        session: any
        currentUrl?: string
        originalSelector: string
        healedSelector: string
    }): Promise<void> {
        const { projectId, isMobile, session, currentUrl, originalSelector, healedSelector } = params

        if (projectId && !isMobile && session.page) {
            try {
                if (!this.selfHealingMemory) {
                    this.selfHealingMemory = new SelfHealingMemoryService((this.storageService as any).supabase)
                }

                // Generate page signature
                const domSnapshot = await this.playwrightRunner.getDOMSnapshot(session.id).catch(() => '')
                const pageSignature = this.selfHealingMemory.generatePageSignature(currentUrl || '', domSnapshot)

                // Save healing memory
                await this.selfHealingMemory.saveHealingMemory(
                    projectId,
                    pageSignature,
                    originalSelector,
                    healedSelector
                )
            } catch (memoryError: any) {
                console.warn(`[${this.config.runId}] Failed to save healing memory:`, memoryError.message)
            }
        }
    }
}
