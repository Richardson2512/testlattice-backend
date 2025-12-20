// Viewport actions for Playwright
import { Page } from 'playwright'
import { LLMAction } from '../../../types'
import { DEVICE_ALIASES } from '../../playwright'

// Conditional logging
const DEBUG = process.env.DEBUG === 'true' || process.env.NODE_ENV === 'development'
const log = DEBUG ? console.log.bind(console) : () => {}

export class ViewportActions {
  /**
   * Set viewport to specific dimensions
   */
  async setViewport(page: Page, action: LLMAction): Promise<void> {
    if (!action.value) {
      throw new Error('Viewport dimensions required for setViewport action (format: "widthxheight")')
    }
    
    const viewportMatch = action.value.match(/(\d+)x(\d+)/)
    if (!viewportMatch) {
      throw new Error(`Invalid viewport format: ${action.value}. Expected format: "widthxheight" (e.g., "390x844")`)
    }
    
    const width = parseInt(viewportMatch[1], 10)
    const height = parseInt(viewportMatch[2], 10)
    
    if (width <= 0 || height <= 0 || width > 10000 || height > 10000) {
      throw new Error(`Invalid viewport dimensions: ${width}x${height}. Dimensions must be between 1 and 10000`)
    }
    
    log(`Playwright: Setting viewport to ${width}x${height}`)
    await page.setViewportSize({ width, height })
    
    // Wait for layout to stabilize after viewport change
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(500) // Additional wait for CSS transitions
  }

  /**
   * Set viewport using device alias
   */
  async setDevice(page: Page, action: LLMAction): Promise<void> {
    if (!action.value) {
      throw new Error('Device alias required for setDevice action (e.g., "mobile", "tablet", "desktop")')
    }
    
    const deviceAlias = action.value.toLowerCase().trim()
    const deviceDimensions = DEVICE_ALIASES[deviceAlias]
    
    if (!deviceDimensions) {
      const availableAliases = Object.keys(DEVICE_ALIASES).join(', ')
      throw new Error(`Unknown device alias: "${deviceAlias}". Available aliases: ${availableAliases}`)
    }
    
    log(`Playwright: Setting device to ${deviceAlias} (${deviceDimensions.width}x${deviceDimensions.height})`)
    await page.setViewportSize(deviceDimensions)
    
    // Wait for layout to stabilize after viewport change
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(500) // Additional wait for CSS transitions
  }

  /**
   * Change orientation by swapping width and height
   */
  async setOrientation(page: Page, action: LLMAction): Promise<void> {
    if (!action.value) {
      throw new Error('Orientation required for setOrientation action ("portrait" or "landscape")')
    }
    
    const orientation = action.value.toLowerCase().trim()
    if (orientation !== 'portrait' && orientation !== 'landscape') {
      throw new Error(`Invalid orientation: "${orientation}". Must be "portrait" or "landscape"`)
    }
    
    // Get current viewport size
    const currentViewport = page.viewportSize()
    if (!currentViewport) {
      throw new Error('Cannot change orientation: viewport size not available')
    }
    
    const currentWidth = currentViewport.width
    const currentHeight = currentViewport.height
    
    // Determine if we need to swap dimensions
    const isCurrentlyPortrait = currentHeight > currentWidth
    const shouldBePortrait = orientation === 'portrait'
    
    let newWidth = currentWidth
    let newHeight = currentHeight
    
    // Swap dimensions if orientation change is needed
    if (isCurrentlyPortrait !== shouldBePortrait) {
      newWidth = currentHeight
      newHeight = currentWidth
    }
    
    log(`Playwright: Setting orientation to ${orientation} (${newWidth}x${newHeight})`)
    await page.setViewportSize({ width: newWidth, height: newHeight })
    
    // Wait for layout to stabilize after orientation change
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(500)
  }
}

