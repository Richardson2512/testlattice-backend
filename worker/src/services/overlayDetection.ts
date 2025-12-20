/**
 * Overlay Detection Service
 * Detects blocking overlays and manages auto-dismiss preferences
 */

import { Page } from 'playwright'

export interface DetectedOverlay {
  type: 'cookie-banner' | 'modal' | 'popup' | 'overlay'
  selector: string
  id?: string
  zIndex: number
  canAutoDismiss: boolean // Based on type (cookie banners = true, modals = false)
}

export class OverlayDetectionService {
  /**
   * Detect blocking overlays for an element
   */
  async detectBlockingOverlays(
    page: Page,
    targetSelector: string
  ): Promise<DetectedOverlay[]> {
    return await page.evaluate((sel) => {
      const target = document.querySelector(sel) as HTMLElement
      if (!target) return []
      
      const targetRect = target.getBoundingClientRect()
      const targetZ = parseInt(window.getComputedStyle(target).zIndex) || 0
      
      const overlays: DetectedOverlay[] = []
      const allElements = document.querySelectorAll('*')
      
      allElements.forEach((el) => {
        if (el === target) return
        
        const style = window.getComputedStyle(el)
        const zIndex = parseInt(style.zIndex) || 0
        const rect = el.getBoundingClientRect()
        
        // Check overlap and z-index
        const overlaps = !(
          rect.right < targetRect.left ||
          rect.left > targetRect.right ||
          rect.bottom < targetRect.top ||
          rect.top > targetRect.bottom
        )
        
        if (overlaps && zIndex > targetZ && style.pointerEvents !== 'none') {
          const id = (el as HTMLElement).id
          const classes = Array.from(el.classList)
          const tagName = el.tagName.toLowerCase()
          
          // Determine overlay type and auto-dismiss capability
          let type: DetectedOverlay['type'] = 'overlay'
          let canAutoDismiss = false
          
          if (classes.some(c => c.includes('cookie') || c.includes('consent'))) {
            type = 'cookie-banner'
            canAutoDismiss = true
          } else if (tagName === 'dialog' || classes.some(c => c.includes('modal') || c.includes('dialog'))) {
            type = 'modal'
            canAutoDismiss = false // Don't auto-dismiss modals
          } else if (classes.some(c => c.includes('popup'))) {
            type = 'popup'
            canAutoDismiss = false
          }
          
          const selector = id ? `#${id}` : 
            classes.length > 0 ? `.${classes[0]}` : 
            tagName
          
          overlays.push({
            type,
            selector,
            id: id || undefined,
            zIndex,
            canAutoDismiss,
          })
        }
      })
      
      // Sort by z-index (highest first)
      return overlays.sort((a, b) => b.zIndex - a.zIndex)
    }, targetSelector)
  }
}

