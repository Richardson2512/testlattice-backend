/**
 * Learning Service - Intervention-to-Learning (ITL) Bridge
 * Transforms user interventions into reusable action templates
 * 
 * Features:
 * - Component hash generation from DOM fragments
 * - Semantic anchoring (visual, functional, structural)
 * - Heuristic storage and retrieval
 * - Similarity matching for component recognition
 */

import crypto from 'crypto'
import { Page } from 'playwright'
import { HeuristicRecord, SemanticAnchors, GodModeInteraction } from '../types'

export class LearningService {
  private apiUrl: string

  constructor(apiUrl: string = process.env.API_URL || 'https://Rihario-7ip77vn43-pricewises-projects.vercel.app') {
    this.apiUrl = apiUrl
  }

  /**
   * Generate component hash from DOM fragment
   * Uses stable attributes (id, data-testid, aria-label, text) to create hash
   */
  async generateComponentHash(
    page: Page,
    selector: string,
    coordinates?: { x: number; y: number }
  ): Promise<string> {
    // Extract DOM fragment around the target element
    const domFragment = await page.evaluate(
      ({ selector: sel, coordinates: coords }: { selector: string | null; coordinates: { x: number; y: number } | undefined }) => {
        let element: Element | null = null

        // Try to find element by selector first
        if (sel) {
          try {
            element = document.querySelector(sel) as Element
          } catch (e) {
            // Invalid selector, try coordinates
          }
        }

        // Fallback to coordinates if selector fails
        if (!element && coords) {
          element = document.elementFromPoint(coords.x, coords.y) as Element
        }

        if (!element) return ''

        // Extract stable attributes for hashing
        const stableData: any = {
          tag: element.tagName.toLowerCase(),
          id: element.id || null,
          testId: element.getAttribute('data-testid') || null,
          ariaLabel: element.getAttribute('aria-label') || null,
          name: (element as HTMLInputElement).name || null,
          type: (element as HTMLInputElement).type || null,
          text: element.textContent?.trim().substring(0, 100) || null, // First 100 chars
          classes: Array.from(element.classList).filter((c) => !c.includes('dynamic')).slice(0, 5), // Stable classes only
        }

        // Include parent context (2 levels up)
        let parent = element.parentElement
        let level = 0
        while (parent && level < 2) {
          const parentId = parent.id
          const parentTestId = parent.getAttribute('data-testid')
          if (parentId || parentTestId) {
            stableData[`parent${level}_id`] = parentId || null
            stableData[`parent${level}_testId`] = parentTestId || null
            level++
          }
          parent = parent.parentElement
        }

        return JSON.stringify(stableData, Object.keys(stableData).sort())
      },
      { selector: selector || null, coordinates }
    ) as any as string

    // Generate SHA-256 hash
    return crypto.createHash('sha256').update(domFragment).digest('hex')
  }

  /**
   * Extract semantic anchors from element
   * Step A: Semantic Anchoring
   */
  async extractSemanticAnchors(
    page: Page,
    selector: string,
    coordinates?: { x: number; y: number }
  ): Promise<SemanticAnchors> {
    const anchors: SemanticAnchors = {}

    // Extract anchors from DOM
    const extracted = await page.evaluate(
      ({ selector: sel, coordinates: coords }: { selector: string | null; coordinates: { x: number; y: number } | undefined }): { functional: string | null; structural: string | null } => {
        let element: Element | null = null

        if (sel) {
          try {
            element = document.querySelector(sel) as Element
          } catch (e) {
            // Invalid selector
          }
        }

        if (!element && coords) {
          element = document.elementFromPoint(coords.x, coords.y) as Element
        }

        if (!element) return { functional: null, structural: null }

        // Functional Anchor: Text/ARIA label
        const functional =
          element.getAttribute('aria-label') ||
          element.textContent?.trim() ||
          (element as HTMLInputElement).placeholder ||
          (element as HTMLInputElement).value ||
          null

        // Structural Anchor: Path from nearest stable parent
        const path: string[] = []
        let current: Element | null = element
        let depth = 0

        while (current && depth < 5) {
          const id = current.id
          const testId = current.getAttribute('data-testid')
          const tag = current.tagName.toLowerCase()

          if (id) {
            path.unshift(`#${id}`)
            break // Found stable parent with ID
          } else if (testId) {
            path.unshift(`[data-testid="${testId}"]`)
            break // Found stable parent with testId
          } else if (current === document.body) {
            break
          } else {
            // Use tag + nth-child as fallback
            const parent = current.parentElement
            if (parent) {
              const siblings = Array.from(parent.children)
              const index = siblings.indexOf(current)
              path.unshift(`${tag}:nth-child(${index + 1})`)
            }
          }

          current = current.parentElement
          depth++
        }

        const structural = path.length > 0 ? path.join(' > ') : (element.tagName.toLowerCase())

        return { functional, structural }
      },
      { selector: selector || null, coordinates }
    ) as any as { functional: string | null; structural: string | null }

    anchors.functionalAnchor = extracted.functional || undefined
    anchors.structuralAnchor = extracted.structural || undefined

    // Visual Anchor: Capture screenshot fragment (50x50px around element)
    try {
      const boundingBox = await page.locator(selector || `[data-coords="${coordinates?.x},${coordinates?.y}"]`).first().boundingBox()
      if (boundingBox) {
        const screenshot = await page.screenshot({
          type: 'png',
          clip: {
            x: Math.max(0, boundingBox.x - 25),
            y: Math.max(0, boundingBox.y - 25),
            width: Math.min(50, boundingBox.width + 50),
            height: Math.min(50, boundingBox.height + 50),
          },
        })
        anchors.visualAnchor = screenshot.toString('base64')
      }
    } catch (error) {
      // Screenshot capture failed, continue without visual anchor
      console.warn('[LearningService] Failed to capture visual anchor:', error)
    }

    return anchors
  }

  /**
   * Create heuristic record from user interaction
   * Step B: The "Heuristic Upgrade"
   */
  async createHeuristicFromInteraction(
    interaction: GodModeInteraction,
    projectId: string,
    page: Page
  ): Promise<HeuristicRecord> {
    const { interaction: interactionData, metadata } = interaction

    // Generate component hash
    const componentHash = await this.generateComponentHash(
      page,
      interactionData.targetSelector || '',
      interactionData.coordinates
    )

    // Extract semantic anchors
    const anchors = await this.extractSemanticAnchors(
      page,
      interactionData.targetSelector || '',
      interactionData.coordinates
    )

    // Build heuristic record
    const heuristic: HeuristicRecord = {
      projectId,
      componentHash,
      userAction: {
        action: interactionData.type,
        selector: interactionData.targetSelector || '',
        value: interactionData.value,
        description: metadata.userIntent || `Manual ${interactionData.type} action`,
      },
      preCondition: metadata.preCondition,
      reliabilityScore: 1.0, // Human verified = 1.0
      visualAnchor: anchors.visualAnchor,
      functionalAnchor: anchors.functionalAnchor,
      structuralAnchor: anchors.structuralAnchor,
      domSnapshotBefore: interactionData.domSnapshotBefore,
      domSnapshotAfter: interactionData.domSnapshotAfter,
      runId: interaction.runId,
      stepId: interaction.stepId,
      usageCount: 0,
      successCount: 0,
    }

    return heuristic
  }

  /**
   * Store heuristic in database
   */
  async storeHeuristic(heuristic: HeuristicRecord): Promise<void> {
    try {
      const fetch = (await import('node-fetch')).default
      const response = await fetch(`${this.apiUrl}/api/heuristics`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(heuristic),
      })

      if (!response.ok) {
        const error = await response.text()
        throw new Error(`Failed to store heuristic: ${error}`)
      }

      console.log(`[LearningService] Stored heuristic for component hash: ${heuristic.componentHash.substring(0, 8)}...`)
    } catch (error: any) {
      console.error('[LearningService] Failed to store heuristic:', error.message)
      throw error
    }
  }

  /**
   * Retrieve learned action for component hash
   * Used in unifiedBrainService before calling AI
   */
  async retrieveLearnedAction(
    projectId: string,
    componentHash: string
  ): Promise<HeuristicRecord | null> {
    try {
      const fetch = (await import('node-fetch')).default
      const response = await fetch(
        `${this.apiUrl}/api/heuristics?projectId=${projectId}&componentHash=${componentHash}`
      )

      if (!response.ok) {
        return null
      }

      const data = await response.json()
      return data.heuristic || null
    } catch (error: any) {
      console.warn('[LearningService] Failed to retrieve learned action:', error.message)
      return null
    }
  }

  /**
   * Find similar components using similarity search
   * Uses component hash and semantic anchors for matching
   */
  async findSimilarComponents(
    projectId: string,
    componentHash: string,
    anchors: SemanticAnchors,
    threshold: number = 0.7
  ): Promise<HeuristicRecord[]> {
    try {
      const fetch = (await import('node-fetch')).default
      const response = await fetch(
        `${this.apiUrl}/api/heuristics/similar?projectId=${projectId}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            componentHash,
            anchors,
            threshold,
          }),
        }
      )

      if (!response.ok) {
        return []
      }

      const data = await response.json()
      return data.heuristics || []
    } catch (error: any) {
      console.warn('[LearningService] Failed to find similar components:', error.message)
      return []
    }
  }

  /**
   * Update heuristic usage statistics
   */
  async recordHeuristicUsage(
    heuristicId: string,
    success: boolean
  ): Promise<void> {
    try {
      const fetch = (await import('node-fetch')).default
      await fetch(`${this.apiUrl}/api/heuristics/${heuristicId}/usage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ success }),
      })
    } catch (error: any) {
      console.warn('[LearningService] Failed to record usage:', error.message)
      // Non-critical, don't throw
    }
  }
}

