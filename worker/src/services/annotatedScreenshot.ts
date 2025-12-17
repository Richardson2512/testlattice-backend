/**
 * Annotated Screenshot Service
 * Phase 2: Creates screenshots with visual markers [1], [2], [3] using Canvas overlay
 * No DOM impact - uses server-side image manipulation
 */

import { Page } from 'playwright'
import { AccessibilityMapElement } from './accessibilityMap'
import sharp from 'sharp'

export class AnnotatedScreenshotService {
  /**
   * Phase 2: Create annotated screenshot with numbered markers using Canvas overlay
   * No DOM injection - zero layout impact
   */
  async createAnnotatedScreenshot(
    page: Page,
    accessibilityMap: { elements: AccessibilityMapElement[] }
  ): Promise<Buffer> {
    // Take base screenshot (no DOM manipulation)
    const baseScreenshot = await page.screenshot({
      type: 'png',
      fullPage: false, // Only visible viewport for diagnosis
    })

    // Phase 2: Use sharp to draw annotations on Canvas (server-side)
    const image = sharp(baseScreenshot)
    const metadata = await image.metadata()
    const width = metadata.width || 1280
    const height = metadata.height || 720

    // Create SVG overlay with annotations
    const svgOverlay = this.createSVGOverlay(accessibilityMap.elements, width, height)

    // Composite SVG overlay onto screenshot
    const annotatedScreenshot = await image
      .composite([
        {
          input: Buffer.from(svgOverlay),
          top: 0,
          left: 0,
        },
      ])
      .png()
      .toBuffer()

    return annotatedScreenshot
  }

  /**
   * Phase 2: Create SVG overlay for annotations (no DOM impact)
   */
  private createSVGOverlay(
    elements: AccessibilityMapElement[],
    width: number,
    height: number
  ): string {
    const markers = elements
      .map((el, index) => {
        const x = el.position.x
        const y = el.position.y
        const w = el.position.width
        const h = el.position.height
        const num = index + 1

        // Green border rectangle
        const rect = `<rect x="${x}" y="${y}" width="${w}" height="${h}" 
          fill="none" stroke="#00ff00" stroke-width="2" opacity="0.8"/>`

        // Numbered label background
        const labelBg = `<rect x="${x}" y="${y - 20}" width="30" height="20" 
          fill="#00ff00" opacity="0.9"/>`

        // Numbered label text
        const labelText = `<text x="${x + 15}" y="${y - 5}" 
          font-family="monospace" font-size="12" font-weight="bold" 
          fill="#000" text-anchor="middle">[${num}]</text>`

        return `${rect}${labelBg}${labelText}`
      })
      .join('\n')

    return `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      ${markers}
    </svg>`
  }

  /**
   * Create annotated screenshot with element reference map
   * Returns both screenshot and element reference map for AI
   */
  async createAnnotatedScreenshotWithMap(
    page: Page,
    accessibilityMap: { elements: AccessibilityMapElement[] }
  ): Promise<{
    screenshot: Buffer
    elementMap: Array<{
      index: number
      selector: string
      description: string
      position: { x: number; y: number; width: number; height: number }
    }>
  }> {
    const screenshot = await this.createAnnotatedScreenshot(page, accessibilityMap)

    // Create element reference map
    const elementMap = accessibilityMap.elements.map((el, index) => ({
      index: index + 1,
      selector: el.bestSelector,
      description: el.text || el.placeholder || el['aria-label'] || el.tagName,
      position: el.position,
    }))

    return {
      screenshot,
      elementMap,
    }
  }
}

