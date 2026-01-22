// Pure utility functions extracted from testProcessor.ts
// These functions have no side effects, no Playwright usage, no network calls, no state mutation

import { VisionElement, LLMAction } from '../types'
import { config } from '../config/env'

export function normalizeUrl(url?: string | null): string {
  if (!url) {
    return ''
  }
  try {
    const instance = new URL(url)
    instance.hash = ''
    return instance.toString().replace(/\/$/, '')
  } catch {
    return url
  }
}

export function resolveUrl(baseUrl: string, href: string): string | null {
  try {
    return new URL(href, baseUrl).toString()
  } catch {
    return null
  }
}

export function safeOrigin(url: string): string {
  try {
    return new URL(url).origin
  } catch {
    return ''
  }
}

export function isEmailElement(element: VisionElement): boolean {
  const inputType = element.inputType?.toLowerCase()
  if (inputType === 'email') return true

  const text = (element.text || element.name || element.ariaLabel || '').toLowerCase()
  const selector = (element.selector || '').toLowerCase()
  return ['email', 'username', 'user', 'login'].some(keyword =>
    text.includes(keyword) || selector.includes(keyword)
  )
}

export function isPasswordElement(element: VisionElement): boolean {
  const inputType = element.inputType?.toLowerCase()
  if (inputType === 'password') return true

  const text = (element.text || element.name || element.ariaLabel || '').toLowerCase()
  const selector = (element.selector || '').toLowerCase()
  return ['password', 'passcode', 'pin'].some(keyword =>
    text.includes(keyword) || selector.includes(keyword)
  )
}

export function isSubmitElement(element: VisionElement): boolean {
  const text = (element.text || element.name || element.ariaLabel || '').toLowerCase()
  const selector = (element.selector || '').toLowerCase()
  return ['login', 'log in', 'sign in', 'submit', 'continue', 'next'].some(keyword =>
    text.includes(keyword) || selector.includes(keyword)
  )
}

export function hasPerformedAction(
  history: Array<{ action: LLMAction; timestamp: string }>,
  selector: string,
  actionName: string
): boolean {
  if (!selector) return false
  return history.some(h => h.action.selector === selector && h.action.action === actionName)
}

export function getLoginCredentials(): { username: string; password: string } {
  return {
    username: config.heuristics.loginUsername,
    password: config.heuristics.loginPassword,
  }
}

export async function delay(ms: number): Promise<void> {
  if (ms <= 0) {
    return
  }
  await new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Check if a URL is safe for diagnosis crawling
 * Pure utility function - no side effects
 */
export function isSafeDiagnosisLink(url: string, baseOrigin: string, label?: string): boolean {
  if (!url) {
    return false
  }

  try {
    const parsed = new URL(url)
    if (parsed.origin !== baseOrigin) {
      return false
    }
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return false
    }
    const text = (label || '').toLowerCase()
    const disallowed = ['logout', 'sign out', 'delete', 'remove', 'cart', 'checkout', 'payment', 'admin']
    if (disallowed.some(term => text.includes(term))) {
      return false
    }
    if (parsed.hash && (!parsed.pathname || parsed.pathname === '/')) {
      return false
    }
    return true
  } catch {
    return false
  }
}

/**
 * Extract candidate links for diagnosis crawling from VisionContext
 * Pure utility function - no side effects
 */
export function extractDiagnosisLinks(
  context: { elements: VisionElement[] },
  baseUrl: string,
  visitedUrls: Set<string>,
  limit: number
): Array<{ selector: string; url: string; label?: string }> {
  const candidates: Array<{ selector: string; url: string; label?: string }> = []
  const origin = safeOrigin(baseUrl)

  for (const element of context.elements) {
    if (!element?.selector) {
      continue
    }

    if (candidates.length >= limit) {
      break
    }

    if (element.type !== 'link' && element.role !== 'link' && element.type !== 'button' && element.role !== 'button') {
      continue
    }

    if (!element.href) {
      continue
    }

    const absoluteUrl = resolveUrl(baseUrl, element.href)
    if (!absoluteUrl) {
      continue
    }

    if (!isSafeDiagnosisLink(absoluteUrl, origin, element.text)) {
      continue
    }

    const normalized = normalizeUrl(absoluteUrl)
    if (visitedUrls.has(normalized)) {
      continue
    }

    const label = (element.text || element.ariaLabel || element.name || '').trim()
    candidates.push({
      selector: element.selector,
      url: absoluteUrl,
      label: label || undefined,
    })
  }

  return candidates.slice(0, limit)
}

/**
 * Check if an error message indicates the selector should be blocked
 * Pure utility function - no side effects
 */
export function shouldBlockSelectorFromError(message?: string): boolean {
  if (!message) return false
  const normalized = message.toLowerCase()
  return (
    normalized.includes('not found in dom') ||
    normalized.includes('is not visible') ||
    normalized.includes('not interactable') ||
    normalized.includes('timed out waiting for') ||
    normalized.includes('detached from document') ||
    normalized.includes('failed to click element')
  )
}

/**
 * Create a selector blocker with internal state management
 * Factory function for use in testProcessor.ts
 */
export function createSelectorBlocker() {
  const blockedSelectors = new Set<string>()
  const blockedSelectorReasons = new Map<string, string>()

  return {
    register: (selector: string | null | undefined, reason: string = 'unknown') => {
      if (!selector) return
      if (!blockedSelectors.has(selector)) {
        blockedSelectors.add(selector)
        blockedSelectorReasons.set(selector, reason)
      }
    },
    isBlocked: (selector: string | null | undefined): boolean => {
      if (!selector) return false
      return blockedSelectors.has(selector)
    },
    shouldBlockFromError: shouldBlockSelectorFromError,
    getBlockedSelectors: () => blockedSelectors,
    getReasons: () => blockedSelectorReasons,
  }
}

