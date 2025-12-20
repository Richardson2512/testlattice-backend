/**
 * Layout Shift Detection Utility
 * Detects visual layout shifts using Performance Observer API
 * Phase 3: Layout shift detection for GPT-4o optimization
 */

export interface LayoutShift {
  value: number // Cumulative Layout Shift (CLS) score
  sources: Array<{
    node?: string
    previousRect: { x: number; y: number; width: number; height: number }
    currentRect: { x: number; y: number; width: number; height: number }
  }>
  timestamp: number
}

/**
 * Detect layout shifts in browser
 * Returns cumulative layout shift score and shift details
 * Runs in browser context via page.evaluate()
 */
export function detectLayoutShifts(): {
  clsScore: number
  shiftCount: number
  shifts: LayoutShift[]
  detected: boolean
} {
  const shifts: LayoutShift[] = []
  let clsScore = 0

  // Use Performance Observer if available
  if (typeof PerformanceObserver !== 'undefined') {
    try {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.entryType === 'layout-shift' && !(entry as any).hadRecentInput) {
            const layoutShift = entry as PerformanceEntry & {
              value: number
              sources: Array<{
                node?: Node
                previousRect: DOMRectReadOnly
                currentRect: DOMRectReadOnly
              }>
            }

            const shift: LayoutShift = {
              value: layoutShift.value,
              sources: layoutShift.sources.map((source) => ({
                node: source.node ? (source.node as Element).tagName : undefined,
                previousRect: {
                  x: source.previousRect.x,
                  y: source.previousRect.y,
                  width: source.previousRect.width,
                  height: source.previousRect.height,
                },
                currentRect: {
                  x: source.currentRect.x,
                  y: source.currentRect.y,
                  width: source.currentRect.width,
                  height: source.currentRect.height,
                },
              })),
              timestamp: entry.startTime,
            }

            shifts.push(shift)
            clsScore += layoutShift.value
          }
        }
      })

      observer.observe({ entryTypes: ['layout-shift'] })

      // Wait a bit to collect shifts
      // Note: In real usage, this would be called after page load/action
      setTimeout(() => {
        observer.disconnect()
      }, 1000)
    } catch (error) {
      // Performance Observer not supported or error
      console.warn('Layout shift detection not available:', error)
    }
  }

  // Threshold: CLS score > 0.1 indicates noticeable layout shift
  const detected = clsScore > 0.1

  return {
    clsScore,
    shiftCount: shifts.length,
    shifts,
    detected,
  }
}

/**
 * Check for layout shifts after action
 * Simplified version that can be called after page actions
 */
export async function checkLayoutShift(): Promise<boolean> {
  // Simple heuristic: Check if viewport dimensions changed
  // or if key elements moved
  const initialViewport = {
    width: window.innerWidth,
    height: window.innerHeight,
  }

  // Wait a bit for layout to settle
  return new Promise<boolean>((resolve) => {
    setTimeout(() => {
      const currentViewport = {
        width: window.innerWidth,
        height: window.innerHeight,
      }

      // Viewport size change indicates potential layout shift
      const viewportChanged =
        initialViewport.width !== currentViewport.width ||
        initialViewport.height !== currentViewport.height

      // Check for scroll position change (indicates content shift)
      const scrollChanged = window.scrollY > 0 || window.scrollX > 0

      resolve(viewportChanged || scrollChanged)
    }, 100)
  })
}

