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

