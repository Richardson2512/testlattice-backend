// Utility functions for formatting test data

import { DeviceProfile, ActionType } from './api'

export function formatActionType(action: string): { label: string; icon: string; color: string } {
  const actionMap: Record<string, { label: string; icon: string; color: string }> = {
    // Existing actions
    'click': { label: 'Click', icon: '👆', color: 'blue' },
    'type': { label: 'Type', icon: '⌨️', color: 'green' },
    'scroll': { label: 'Scroll', icon: '📜', color: 'gray' },
    'navigate': { label: 'Navigate', icon: '🧭', color: 'purple' },
    'wait': { label: 'Wait', icon: '⏱️', color: 'yellow' },
    'assert': { label: 'Assert', icon: '✓', color: 'teal' },
    'complete': { label: 'Complete', icon: '🎉', color: 'green' },
    
    // NEW: Form actions
    'check': { label: 'Check', icon: '☑️', color: 'green' },
    'uncheck': { label: 'Uncheck', icon: '☐', color: 'gray' },
    'select': { label: 'Select', icon: '📋', color: 'blue' },
    'submit': { label: 'Submit', icon: '📤', color: 'purple' },
    
    // NEW: Navigation actions
    'goBack': { label: 'Back', icon: '⬅️', color: 'orange' },
    'goForward': { label: 'Forward', icon: '➡️', color: 'orange' },
  }
  
  return actionMap[action] || { label: action, icon: '❓', color: 'gray' }
}

export function getDeviceInfo(device: string): {
  name: string
  icon: string
  viewport: string
  description: string
  isMobile: boolean
} {
  const deviceMap: Record<string, any> = {
    [DeviceProfile.CHROME_LATEST]: {
      name: 'Chrome Desktop',
      icon: '🌐',
      viewport: '1920×1080',
      description: 'Latest Chrome on desktop',
      isMobile: false
    },
    [DeviceProfile.FIREFOX_LATEST]: {
      name: 'Firefox Desktop',
      icon: '🦊',
      viewport: '1920×1080',
      description: 'Latest Firefox on desktop',
      isMobile: false
    },
    [DeviceProfile.SAFARI_LATEST]: {
      name: 'Safari Desktop',
      icon: '🧭',
      viewport: '1440×900',
      description: 'Latest Safari on macOS',
      isMobile: false
    },
    // NEW: Mobile devices
    [DeviceProfile.MOBILE_CHROME]: {
      name: 'Mobile Chrome',
      icon: '📱',
      viewport: '390×844',
      description: 'iPhone 12 viewport with Chrome',
      isMobile: true
    },
    [DeviceProfile.MOBILE_SAFARI]: {
      name: 'Mobile Safari',
      icon: '📱',
      viewport: '390×844',
      description: 'iPhone 12 viewport with Safari',
      isMobile: true
    },
    [DeviceProfile.MOBILE_CHROME_ANDROID]: {
      name: 'Mobile Chrome (Android)',
      icon: '🤖',
      viewport: '360×640',
      description: 'Android viewport with Chrome',
      isMobile: true
    },
  }
  
  return deviceMap[device] || {
    name: device,
    icon: '❓',
    viewport: 'Unknown',
    description: '',
    isMobile: false
  }
}

export function getBrowserName(browser: string): string {
  switch (browser) {
    case 'chromium': return 'Chrome'
    case 'firefox': return 'Firefox'
    case 'webkit': return 'Safari'
    default: return browser
  }
}

export function getBrowserIcon(browser: string): string {
  switch (browser) {
    case 'chromium': return '🌐'
    case 'firefox': return '🦊'
    case 'webkit': return '🧭'
    default: return '🌐'
  }
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  const minutes = Math.floor(ms / 60000)
  const seconds = Math.floor((ms % 60000) / 1000)
  return `${minutes}m ${seconds}s`
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

