// Overlay resolver for Playwright (cookie banners, modals, popups)
import { Page } from 'playwright'

// Conditional logging
const DEBUG = process.env.DEBUG === 'true' || process.env.NODE_ENV === 'development'
const log = DEBUG ? console.log.bind(console) : () => {}
const logWarn = DEBUG ? console.warn.bind(console) : () => {}

export class OverlayResolver {
  /**
   * Resolve blocking overlays (cookie banners, modals, popups)
   */
  async resolveBlockingOverlays(page: Page): Promise<boolean> {
    let dismissed = false
    
    // Step 1: Find cookie banner by looking for cookie-related text
    try {
      const cookieTextSelectors = [
        ':has-text("THIS WEBSITE USES COOKIES")',
        ':has-text("Accept All Cookies")',
        ':has-text("This website uses cookies")',
      ]
      
      let cookieBannerContainer: any = null
      
      for (const textSelector of cookieTextSelectors) {
        try {
          const textElement = page.locator(textSelector).first()
          const count = await textElement.count()
          if (count > 0) {
            const isVisible = await textElement.isVisible().catch(() => false)
            if (isVisible) {
              // Find the banner container using XPath
              cookieBannerContainer = textElement.locator('xpath=ancestor::*[contains(@class, "cookie") or contains(@id, "cookie") or contains(@class, "consent") or contains(@id, "consent") or contains(@class, "banner") or contains(@style, "position: fixed") or contains(@style, "position:absolute")][1]').first()
              
              const containerCount = await cookieBannerContainer.count().catch(() => 0)
              if (containerCount === 0) {
                // Use evaluate to find the container
                const marker = await textElement.evaluate((el) => {
                  let current: any = el
                  let bestContainer: any = null
                  let maxScore = 0
                  
                  for (let i = 0; i < 15 && current && current !== document.body; i++) {
                    const style = window.getComputedStyle(current)
                    const rect = current.getBoundingClientRect()
                    const classes = String(current.className || '').toLowerCase()
                    const id = String(current.id || '').toLowerCase()
                    
                    let score = 0
                    if (style.position === 'fixed' || style.position === 'absolute') score += 10
                    if (classes.includes('cookie') || classes.includes('consent') || classes.includes('banner')) score += 20
                    if (id.includes('cookie') || id.includes('consent')) score += 20
                    if (rect.bottom > window.innerHeight * 0.7) score += 10
                    if (rect.width > window.innerWidth * 0.3 && rect.height > 50) score += 10
                    
                    if (score > maxScore) {
                      maxScore = score
                      bestContainer = current
                    }
                    
                    current = current.parentElement
                  }
                  
                  if (bestContainer) {
                    const uniqueMarker = `cookie-banner-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
                    bestContainer.setAttribute('data-cookie-banner-marker', uniqueMarker)
                    return uniqueMarker
                  }
                  return null
                }).catch(() => null)
                
                if (marker) {
                  cookieBannerContainer = page.locator(`[data-cookie-banner-marker="${marker}"]`).first()
                  const markerCount = await cookieBannerContainer.count().catch(() => 0)
                  if (markerCount > 0) {
                    console.log('Playwright: Found cookie banner container (evaluate method)')
                  }
                }
              } else {
                console.log('Playwright: Found cookie banner container (XPath method)')
              }
              
              if (cookieBannerContainer && (await cookieBannerContainer.count().catch(() => 0)) > 0) {
                break
              }
            }
          }
        } catch {
          continue
        }
      }
      
      // Step 2: If we found the banner container, find ALL buttons within it
      if (cookieBannerContainer && (await cookieBannerContainer.count().catch(() => 0)) > 0) {
        const isVisible = await cookieBannerContainer.isVisible().catch(() => false)
        if (isVisible) {
          console.log('Playwright: Cookie banner visible, searching for buttons inside...')
          
          const allClickableElements = cookieBannerContainer.locator('button, [role="button"], a, [onclick], [data-action], [data-dismiss]')
          const elementCount = await allClickableElements.count().catch(() => 0)
          
          console.log(`Playwright: Found ${elementCount} clickable elements in cookie banner`)
          
          for (let i = 0; i < elementCount; i++) {
            try {
              const element = allClickableElements.nth(i)
              const isElementVisible = await element.isVisible().catch(() => false)
              if (!isElementVisible) continue
              
              const elementText = await element.textContent().catch(() => '')
              const normalizedText = (elementText || '').trim().toLowerCase()
              
              const isAcceptButton = 
                normalizedText.includes('accept all cookies') ||
                normalizedText.includes('accept all') ||
                normalizedText.includes('accept cookies') ||
                (normalizedText.includes('accept') && normalizedText.length < 30) ||
                normalizedText.includes('agree') ||
                normalizedText === 'ok' ||
                normalizedText === 'got it' ||
                normalizedText === 'continue'
              
              if (isAcceptButton) {
                console.log(`Playwright: Found potential accept button: "${elementText}"`)
                
                await element.scrollIntoViewIfNeeded({ timeout: 2000 }).catch(() => {})
                await page.waitForTimeout(500)
                
                try {
                  await element.click({ timeout: 3000, force: false })
                } catch {
                  await element.click({ timeout: 3000, force: true })
                }
                
                await page.waitForTimeout(2000)
                
                const bannerStillVisible = await cookieBannerContainer.isVisible({ timeout: 1000 }).catch(() => true)
                if (!bannerStillVisible) {
                  console.log(`Playwright: ✅ Successfully dismissed cookie banner`)
                  return true
                }
              }
            } catch {
              continue
            }
          }
        }
      }
    } catch (error: any) {
      console.warn('Playwright: Cookie banner detection failed:', error.message)
    }
    
    // Expanded overlay selectors
    const overlaySelectors = [
      '[role="dialog"]',
      '[aria-modal="true"]',
      '[data-overlay]',
      '.modal',
      '.modal-backdrop',
      '[id*="cookie" i]',
      '[class*="cookie" i]',
      '[id*="consent" i]',
      '[class*="consent" i]',
      '[style*="position: fixed"][style*="bottom"]',
      '[style*="position:fixed"][style*="bottom"]',
    ]

    const closeButtonSelectors = [
      'button:has-text("Close")',
      'button:has-text("Dismiss")',
      'button:has-text("Accept All Cookies")',
      'button:has-text("Accept All")',
      'button:has-text("Accept")',
      '[role="button"]:has-text("Accept All Cookies")',
      'a:has-text("Accept All Cookies")',
      'button[aria-label*="close" i]',
      'button[aria-label*="accept" i]',
      '.close',
      '.close-button',
    ]

    // Check all overlay selectors
    for (const selector of overlaySelectors) {
      try {
        const overlays = page.locator(selector)
        const count = await overlays.count()
        
        if (count === 0) continue
        
        for (let i = 0; i < count; i++) {
          const overlay = overlays.nth(i)
          
          try {
            const isVisible = await overlay.isVisible().catch(() => false)
            if (!isVisible) continue
            
            const zIndex = await overlay.evaluate((el) => {
              const style = window.getComputedStyle(el)
              return parseInt(style.zIndex) || 0
            }).catch(() => 0)
            
            const boundingBox = await overlay.boundingBox().catch(() => null)
            if (!boundingBox) continue
            
            const viewportSize = page.viewportSize()
            if (!viewportSize) continue
            
            const coverage = (boundingBox.width * boundingBox.height) / (viewportSize.width * viewportSize.height)
            const isAtBottom = boundingBox.y + boundingBox.height > viewportSize.height * 0.7
            const isCookieRelated = selector.toLowerCase().includes('cookie') || 
                                   selector.toLowerCase().includes('consent')
            const isBlocking = zIndex >= 1000 || 
                              coverage > 0.15 || 
                              isCookieRelated ||
                              (isAtBottom && (zIndex > 0 || coverage > 0.05))
            
            if (!isBlocking) continue
            
            console.log(`Playwright: Detected blocking overlay. Attempting to dismiss...`)
            
            // Try close buttons
            for (const closeSelector of closeButtonSelectors) {
              try {
                const closeButton = overlay.locator(closeSelector).first()
                if ((await closeButton.count()) > 0 && (await closeButton.isVisible())) {
                  await closeButton.click({ timeout: 2000, force: true })
                  await page.waitForTimeout(800)
                  
                  const stillVisible = await overlay.isVisible().catch(() => false)
                  if (!stillVisible) {
                    console.log(`Playwright: Successfully dismissed overlay`)
                    dismissed = true
                    break
                  }
                }
              } catch {
                continue
              }
            }
          } catch {
            continue
          }
        }
      } catch {
        continue
      }
    }

    // Last resort: Try Escape key
    if (!dismissed) {
      try {
        await page.keyboard.press('Escape')
        await page.waitForTimeout(800)
        dismissed = true
      } catch {
        // ignore
      }
    }

    return dismissed
  }
}

