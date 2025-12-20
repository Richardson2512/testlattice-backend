// Self-Healing Memory Service
// Persists successful selector healings per project

import { SupabaseClient } from '@supabase/supabase-js'

export interface HealingMemory {
  id?: string
  projectId: string
  pageSignature: string // URL + DOM hash
  originalSelector: string
  healedSelector: string
  successCount: number
  lastUsedAt: string
  createdAt: string
}

/**
 * Self-Healing Memory Service
 * 
 * Philosophy: Remember successful healings per project
 * No global learning, no cross-project reuse
 */
export class SelfHealingMemoryService {
  private supabase: SupabaseClient

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase
  }

  /**
   * Get healing memory for a selector on a specific page
   */
  async getHealingMemory(
    projectId: string,
    pageSignature: string,
    originalSelector: string
  ): Promise<string | null> {
    try {
      const { data, error } = await this.supabase
        .from('selector_healing_memory')
        .select('healedSelector, successCount')
        .eq('projectId', projectId)
        .eq('pageSignature', pageSignature)
        .eq('originalSelector', originalSelector)
        .order('successCount', { ascending: false })
        .limit(1)
        .single()

      if (error || !data) {
        return null
      }

      // Only return if it has been successful at least once
      if (data.successCount > 0) {
        return data.healedSelector
      }

      return null
    } catch (error: any) {
      console.warn(`[SelfHealingMemory] Failed to get healing memory:`, error.message)
      return null
    }
  }

  /**
   * Save successful healing
   */
  async saveHealingMemory(
    projectId: string,
    pageSignature: string,
    originalSelector: string,
    healedSelector: string
  ): Promise<void> {
    try {
      // Check if memory already exists
      const { data: existing } = await this.supabase
        .from('selector_healing_memory')
        .select('id, successCount')
        .eq('projectId', projectId)
        .eq('pageSignature', pageSignature)
        .eq('originalSelector', originalSelector)
        .eq('healedSelector', healedSelector)
        .single()

      if (existing) {
        // Update success count
        await this.supabase
          .from('selector_healing_memory')
          .update({
            successCount: existing.successCount + 1,
            lastUsedAt: new Date().toISOString(),
          })
          .eq('id', existing.id)
      } else {
        // Insert new memory
        await this.supabase
          .from('selector_healing_memory')
          .insert({
            projectId,
            pageSignature,
            originalSelector,
            healedSelector,
            successCount: 1,
            lastUsedAt: new Date().toISOString(),
            createdAt: new Date().toISOString(),
          })
      }
    } catch (error: any) {
      // Non-blocking - don't fail if memory save fails
      console.warn(`[SelfHealingMemory] Failed to save healing memory:`, error.message)
    }
  }

  /**
   * Generate page signature (URL + DOM hash)
   */
  generatePageSignature(url: string, domSnapshot: string): string {
    const crypto = require('crypto')
    const hash = crypto.createHash('md5').update(domSnapshot.substring(0, 1000)).digest('hex')
    return `${url}:${hash.substring(0, 8)}`
  }
}

