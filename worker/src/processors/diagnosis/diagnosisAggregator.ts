// Diagnosis aggregation helpers extracted from testProcessor.ts
import {
  DiagnosisResult,
  DiagnosisPageSummary,
  DiagnosisComponentInsight,
  DiagnosisIssueInsight,
} from '../../types'

export function buildDiagnosisPageSummary(params: {
  id: string
  label?: string
  url?: string
  action?: string
  title?: string
  screenshotUrl?: string
  screenshotUrls?: string[]
  diagnosis: DiagnosisResult
  errors?: string[]
  blockedSelectors?: string[]
}): DiagnosisPageSummary {
  const { diagnosis } = params
  return {
    id: params.id,
    label: params.label,
    url: params.url,
    action: params.action,
    title: params.title,
    screenshotUrl: params.screenshotUrl,
    screenshotUrls: params.screenshotUrls,
    summary: diagnosis?.summary || 'No summary available.',
    testableComponents: diagnosis?.testableComponents || [],
    nonTestableComponents: diagnosis?.nonTestableComponents || [],
    recommendedTests: diagnosis?.recommendedTests || [],
    errors: params.errors,
    blockedSelectors: params.blockedSelectors,
  }
}

export function mergeComponentInsights(list: DiagnosisComponentInsight[]): DiagnosisComponentInsight[] {
  const map = new Map<string, DiagnosisComponentInsight>()
  for (const item of list) {
    if (!item) continue
    const key = `${(item.name || '').toLowerCase()}|${item.selector || ''}`
    if (!map.has(key)) {
      map.set(key, item)
    }
  }
  return Array.from(map.values()).slice(0, 30)
}

export function mergeIssueInsights(list: DiagnosisIssueInsight[]): DiagnosisIssueInsight[] {
  const map = new Map<string, DiagnosisIssueInsight>()
  for (const item of list) {
    if (!item) continue
    const key = `${(item.name || '').toLowerCase()}|${(item.reason || '').toLowerCase()}`
    if (!map.has(key)) {
      map.set(key, item)
    }
  }
  return Array.from(map.values()).slice(0, 30)
}

export function mergeRecommendations(list: string[]): string[] {
  const seen = new Set<string>()
  const result: string[] = []
  for (const item of list) {
    if (!item) continue
    const key = item.trim().toLowerCase()
    if (!seen.has(key)) {
      seen.add(key)
      result.push(item)
    }
    if (result.length >= 30) break
  }
  return result
}

export function mergeBlockedSelectors(pages: DiagnosisPageSummary[]): string[] {
  const result: string[] = []
  const seen = new Set<string>()
  pages.forEach(page => {
    page.blockedSelectors?.forEach(selector => {
      if (selector && !seen.has(selector)) {
        seen.add(selector)
        result.push(selector)
      }
    })
  })
  return result.slice(0, 50)
}

export function aggregateDiagnosisPages(pages: DiagnosisPageSummary[]): DiagnosisResult {
  if (!pages.length) {
    return {
      summary: 'No views analyzed.',
      testableComponents: [],
      nonTestableComponents: [],
      recommendedTests: [],
      pages: [],
      blockedSelectors: [],
    }
  }

  const names = pages
    .map(page => page.label || page.title || page.url || page.id)
    .filter(Boolean) as string[]

  const highlight = names.slice(0, 3).join(', ')
  const summary =
    pages.length > 1
      ? `Explored ${pages.length} views${highlight ? ` (${highlight}${names.length > 3 ? '…' : ''})` : ''}.`
      : pages[0].summary

  return {
    screenshotUrl: pages[0].screenshotUrl,
    summary,
    testableComponents: mergeComponentInsights(
      pages.flatMap(p => p.testableComponents || [])
    ),
    nonTestableComponents: mergeIssueInsights(
      pages.flatMap(p => p.nonTestableComponents || [])
    ),
    recommendedTests: mergeRecommendations(
      pages.flatMap(p => p.recommendedTests || [])
    ),
    pages,
    blockedSelectors: mergeBlockedSelectors(pages),
  }
}

