'use client'

import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { api, TestRun, TestArtifact } from '../../../../lib/api'
import Link from 'next/link'
import { theme } from '../../../../lib/theme'
import { KeyboardShortcuts } from '../../../../components/KeyboardShortcuts'
import LiveStreamPlayer from '../../../../components/LiveStreamPlayer'
import { LiveTestControl } from '../../../../components/LiveTestControl'

type DiagnosisEvent = {
  id: string
  label: string
  detail: string
  timestamp: string
}

type DiagnosisMilestoneState = {
  key: string
  label: string
  detail: string
  threshold: number
  triggered: boolean
}

const DIAGNOSIS_MILESTONES: Array<Omit<DiagnosisMilestoneState, 'triggered'>> = [
  {
    key: 'session',
    label: 'Initialize secure browser session',
    detail: 'Provisioning an isolated Playwright instance with trace recording.',
    threshold: 5,
  },
  {
    key: 'capture',
    label: 'Capture landing page snapshot',
    detail: 'Navigating to the provided URL and collecting DOM + screenshot artifacts.',
    threshold: 20,
  },
  {
    key: 'analysis',
    label: 'Analyze components & blockers',
    detail: 'AI analyzes the DOM to classify testable and risky elements.',
    threshold: 50,
  },
  {
    key: 'explore',
    label: 'Explore navigation targets',
    detail: 'Checking for additional views based on test mode.',
    threshold: 75,
  },
  {
    key: 'summary',
    label: 'Compile diagnosis summary',
    detail: 'Aggregating findings and recommendations for approval.',
    threshold: 90,
  },
]

const createDiagnosisMilestoneState = (): DiagnosisMilestoneState[] =>
  DIAGNOSIS_MILESTONES.map((milestone) => ({ ...milestone, triggered: false }))

interface DiagnosisIssue {
  id: number
  risk: 'Critical' | 'Major' | 'Minor' | 'Info'
  title: string
  description: string
  element: string
  type: string
  category: 'Security' | 'SEO' | 'Accessibility' | 'Performance' | 'Visual' | 'DOM' | 'Console' | 'Network' | 'Component' | 'Risk' | 'Other'
  page: string
  selector: string
  fix: string
  fixCode?: string
  isExpanded: boolean
  metadata?: Record<string, any> // For additional data like URLs, timestamps, etc.
}

function DiagnosisReport({ diagnosis, testId, onApprove, isApproving }: { 
  diagnosis: any, 
  testId: string, 
  onApprove: () => void, 
  isApproving: boolean 
}) {
  const [filteredData, setFilteredData] = useState<DiagnosisIssue[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [riskFilter, setRiskFilter] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 1024)
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // Convert diagnosis data to issues format
  const convertDiagnosisToIssues = useMemo((): DiagnosisIssue[] => {
    const issues: DiagnosisIssue[] = []
    let idCounter = 1

    // Convert high risk areas
    if (diagnosis.highRiskAreas) {
      diagnosis.highRiskAreas.forEach((area: any) => {
        const riskMap: Record<string, 'Critical' | 'Major' | 'Minor' | 'Info'> = {
          'critical': 'Critical',
          'high': 'Major',
          'medium': 'Minor',
          'low': 'Info'
        }
        issues.push({
          id: idCounter++,
          risk: riskMap[area.riskLevel] || 'Info',
          title: area.name,
          description: area.description,
          element: area.name,
          type: area.type?.replace(/_/g, ' ') || 'Unknown',
          category: 'Risk',
          page: diagnosis.pages?.[0]?.label || 'Unknown Page',
          selector: area.selector || 'N/A',
          fix: area.requiresManualIntervention ? `Manual intervention required: ${area.reason}` : 'Review and address the risk area',
          fixCode: area.selector ? `/* Selector: ${area.selector} */` : undefined,
          isExpanded: false
        })
      })
    }

    // Convert non-testable components
    if (diagnosis.nonTestableComponents) {
      diagnosis.nonTestableComponents.forEach((component: any) => {
        issues.push({
          id: idCounter++,
          risk: 'Major',
          title: `Non-testable: ${component.name}`,
          description: component.reason,
          element: component.name,
          type: 'Component',
          category: 'Component',
          page: diagnosis.pages?.[0]?.label || 'Unknown Page',
          selector: 'N/A',
          fix: 'Review component and make it testable or mark for manual testing',
          isExpanded: false
        })
      })
    }

    // Convert comprehensive test results - Security issues
    if (diagnosis.comprehensiveTests?.security) {
      diagnosis.comprehensiveTests.security.forEach((security: any) => {
        const riskMap: Record<string, 'Critical' | 'Major' | 'Minor' | 'Info'> = {
          'high': 'Critical',
          'medium': 'Major',
          'low': 'Minor'
        }
        issues.push({
          id: idCounter++,
          risk: riskMap[security.severity] || 'Major',
          title: `Security: ${security.type.toUpperCase()} - ${security.message}`,
          description: security.message,
          element: security.element || 'Security',
          type: 'Security',
          category: 'Security',
          page: 'All Pages',
          selector: security.selector || security.url || 'N/A',
          fix: security.fix || 'Review security configuration',
          fixCode: security.url ? `/* URL: ${security.url} */` : undefined,
          isExpanded: false,
          metadata: { url: security.url, securityType: security.type }
        })
      })
    }

    // Convert comprehensive test results - SEO issues
    if (diagnosis.comprehensiveTests?.seo) {
      diagnosis.comprehensiveTests.seo.forEach((seo: any) => {
        const riskMap: Record<string, 'Critical' | 'Major' | 'Minor' | 'Info'> = {
          'high': 'Major',
          'medium': 'Minor',
          'low': 'Info'
        }
        issues.push({
          id: idCounter++,
          risk: riskMap[seo.severity] || 'Minor',
          title: `SEO: ${seo.type.replace(/-/g, ' ')}`,
          description: seo.message,
          element: seo.element || 'SEO',
          type: 'SEO',
          category: 'SEO',
          page: 'All Pages',
          selector: 'N/A',
          fix: seo.fix || 'Improve SEO metadata',
          isExpanded: false
        })
      })
    }

    // Convert comprehensive test results - All Accessibility issues
    if (diagnosis.comprehensiveTests?.accessibility) {
      diagnosis.comprehensiveTests.accessibility.forEach((acc: any) => {
        const riskMap: Record<string, 'Critical' | 'Major' | 'Minor' | 'Info'> = {
          'critical': 'Critical',
          'serious': 'Major',
          'moderate': 'Minor',
          'minor': 'Info'
        }
        issues.push({
          id: idCounter++,
          risk: riskMap[acc.impact] || 'Minor',
          title: `Accessibility: ${acc.message}`,
          description: acc.message,
          element: acc.element || 'Element',
          type: 'Accessibility',
          category: 'Accessibility',
          page: 'All Pages',
          selector: acc.selector || 'N/A',
          fix: acc.fix || 'Improve accessibility',
          isExpanded: false
        })
      })
    }

    // Convert comprehensive test results - Console errors
    if (diagnosis.comprehensiveTests?.consoleErrors) {
      diagnosis.comprehensiveTests.consoleErrors
        .filter((err: any) => err.type === 'error' || err.type === 'warning')
        .forEach((err: any) => {
          const riskMap: Record<string, 'Critical' | 'Major' | 'Minor' | 'Info'> = {
            'error': 'Major',
            'warning': 'Minor',
            'info': 'Info'
          }
          issues.push({
            id: idCounter++,
            risk: riskMap[err.type] || 'Info',
            title: `Console ${err.type}: ${err.message.substring(0, 60)}${err.message.length > 60 ? '...' : ''}`,
            description: err.message,
            element: 'Console',
            type: 'Console Error',
            category: 'Console',
            page: err.source ? new URL(err.source).pathname : 'All Pages',
            selector: err.source || 'N/A',
            fix: `Fix JavaScript ${err.type} in ${err.source || 'unknown source'}`,
            fixCode: err.source && err.line ? `// ${err.source}:${err.line}:${err.column || 0}\n// ${err.message}` : undefined,
            isExpanded: false,
            metadata: { source: err.source, line: err.line, column: err.column, timestamp: err.timestamp }
          })
        })
    }

    // Convert comprehensive test results - Network errors
    if (diagnosis.comprehensiveTests?.networkErrors) {
      diagnosis.comprehensiveTests.networkErrors.forEach((netErr: any) => {
        const riskMap: Record<number, 'Critical' | 'Major' | 'Minor' | 'Info'> = {
          500: 'Critical',
          502: 'Critical',
          503: 'Critical',
          504: 'Critical',
          400: 'Major',
          401: 'Major',
          403: 'Major',
          404: 'Minor',
          0: 'Major' // Failed requests
        }
        const statusRisk = netErr.status >= 500 ? 'Critical' : netErr.status >= 400 ? 'Major' : 'Minor'
        issues.push({
          id: idCounter++,
          risk: riskMap[netErr.status] || statusRisk,
          title: `Network Error: ${netErr.method} ${netErr.status} - ${netErr.url.substring(0, 50)}${netErr.url.length > 50 ? '...' : ''}`,
          description: netErr.errorText || netErr.statusText || `Failed ${netErr.method} request`,
          element: 'Network',
          type: 'Network Error',
          category: 'Network',
          page: new URL(netErr.url).pathname || 'All Pages',
          selector: netErr.url,
          fix: `Fix network request: ${netErr.url}`,
          fixCode: `// ${netErr.method} ${netErr.url}\n// Status: ${netErr.status} ${netErr.statusText}`,
          isExpanded: false,
          metadata: { url: netErr.url, method: netErr.method, status: netErr.status, resourceType: netErr.resourceType, timestamp: netErr.timestamp }
        })
      })
    }

    // Convert comprehensive test results - Visual issues
    if (diagnosis.comprehensiveTests?.visualIssues) {
      diagnosis.comprehensiveTests.visualIssues.forEach((visual: any) => {
        const riskMap: Record<string, 'Critical' | 'Major' | 'Minor' | 'Info'> = {
          'high': 'Major',
          'medium': 'Minor',
          'low': 'Info'
        }
        issues.push({
          id: idCounter++,
          risk: riskMap[visual.severity] || 'Minor',
          title: `Visual Issue: ${visual.type.replace(/-/g, ' ')}`,
          description: visual.description,
          element: visual.element || 'Visual',
          type: 'Visual Issue',
          category: 'Visual',
          page: 'All Pages',
          selector: visual.selector || 'N/A',
          fix: visual.recommendation || visual.expectedValue ? `Expected: ${visual.expectedValue}, Actual: ${visual.actualValue}` : 'Fix visual issue',
          fixCode: visual.recommendation || undefined,
          isExpanded: false,
          metadata: { visualType: visual.type, expectedValue: visual.expectedValue, actualValue: visual.actualValue }
        })
      })
    }

    // Convert comprehensive test results - DOM Health issues
    if (diagnosis.comprehensiveTests?.domHealth) {
      const domHealth = diagnosis.comprehensiveTests.domHealth
      
      // Missing alt text
      domHealth.missingAltText?.forEach((item: any) => {
        issues.push({
          id: idCounter++,
          risk: 'Minor',
          title: 'Missing Alt Text',
          description: `Image at ${item.selector} is missing alt text`,
          element: item.element,
          type: 'DOM Health',
          category: 'DOM',
          page: 'All Pages',
          selector: item.selector,
          fix: `Add alt attribute to image: <img src="..." alt="description">`,
          isExpanded: false
        })
      })

      // Missing labels
      domHealth.missingLabels?.forEach((item: any) => {
        issues.push({
          id: idCounter++,
          risk: 'Major',
          title: 'Missing Form Label',
          description: `Form input at ${item.selector} is missing a label`,
          element: item.element,
          type: 'DOM Health',
          category: 'DOM',
          page: 'All Pages',
          selector: item.selector,
          fix: `Add label element or aria-label to ${item.selector}`,
          isExpanded: false
        })
      })

      // Hidden elements
      domHealth.hiddenElements?.forEach((item: any) => {
        issues.push({
          id: idCounter++,
          risk: 'Info',
          title: 'Hidden Element',
          description: `Element at ${item.selector} is hidden: ${item.reason}`,
          element: item.element,
          type: 'DOM Health',
          category: 'DOM',
          page: 'All Pages',
          selector: item.selector,
          fix: `Review hidden element: ${item.reason}`,
          isExpanded: false,
          metadata: { reason: item.reason }
        })
      })
    }

    // Convert testable components (as positive findings)
    if (diagnosis.testableComponents) {
      diagnosis.testableComponents.forEach((component: any) => {
        const testabilityRisk: Record<string, 'Critical' | 'Major' | 'Minor' | 'Info'> = {
          'high': 'Info',
          'medium': 'Info',
          'low': 'Minor'
        }
        issues.push({
          id: idCounter++,
          risk: testabilityRisk[component.testability] || 'Info',
          title: `Testable Component: ${component.name}`,
          description: component.description,
          element: component.name,
          type: 'Component',
          category: 'Component',
          page: diagnosis.pages?.[0]?.label || 'Unknown Page',
          selector: component.selector,
          fix: `Component is ${component.testability} testability - can be used for automation`,
          isExpanded: false,
          metadata: { testability: component.testability }
        })
      })
    }

    // Convert recommended tests
    if (diagnosis.recommendedTests && diagnosis.recommendedTests.length > 0) {
      diagnosis.recommendedTests.forEach((test: string) => {
        issues.push({
          id: idCounter++,
          risk: 'Info',
          title: `Recommended Test: ${test.substring(0, 60)}${test.length > 60 ? '...' : ''}`,
          description: test,
          element: 'Test Recommendation',
          type: 'Recommendation',
          category: 'Other',
          page: 'All Pages',
          selector: 'N/A',
          fix: 'Consider implementing this test scenario',
          isExpanded: false
        })
      })
    }

    // Convert blocked selectors
    if (diagnosis.blockedSelectors && diagnosis.blockedSelectors.length > 0) {
      diagnosis.blockedSelectors.forEach((selector: string) => {
        issues.push({
          id: idCounter++,
          risk: 'Major',
          title: `Blocked Selector: ${selector}`,
          description: `This selector will be avoided during test execution due to reliability issues`,
          element: 'Selector',
          type: 'Blocked Selector',
          category: 'Component',
          page: 'All Pages',
          selector: selector,
          fix: 'Improve selector reliability or use alternative selector',
          isExpanded: false
        })
      })
    }

    // Convert third-party dependencies
    if (diagnosis.comprehensiveTests?.thirdPartyDependencies) {
      diagnosis.comprehensiveTests.thirdPartyDependencies.forEach((dep: any) => {
        const riskMap: Record<string, 'Critical' | 'Major' | 'Minor' | 'Info'> = {
          'high': 'Major',
          'medium': 'Minor',
          'low': 'Info'
        }
        issues.push({
          id: idCounter++,
          risk: riskMap[dep.privacyRisk] || 'Info',
          title: `Third-Party: ${dep.domain} (${dep.type})`,
          description: `${dep.description}. Privacy risk: ${dep.privacyRisk}`,
          element: dep.domain,
          type: 'Third-Party',
          category: 'Other',
          page: 'All Pages',
          selector: dep.domain,
          fix: `Review third-party dependency: ${dep.domain}`,
          fixCode: dep.scripts.length > 0 ? `// Scripts:\n${dep.scripts.map((s: string) => `// ${s}`).join('\n')}` : undefined,
          isExpanded: false,
          metadata: { domain: dep.domain, type: dep.type, privacyRisk: dep.privacyRisk, scripts: dep.scripts }
        })
      })
    }

    // If no issues, add a placeholder
    if (issues.length === 0) {
      issues.push({
        id: idCounter++,
        risk: 'Info',
        title: 'No issues detected',
        description: 'The diagnosis found no critical issues. You can proceed with testing.',
        element: 'System',
        type: 'Info',
        category: 'Other',
        page: 'All Pages',
        selector: 'N/A',
        fix: 'No action required',
        isExpanded: false
      })
    }

    return issues
  }, [diagnosis])

  useEffect(() => {
    applyFilters()
  }, [searchTerm, riskFilter, categoryFilter, convertDiagnosisToIssues])

  const applyFilters = () => {
    let filtered = [...convertDiagnosisToIssues]
    
    if (riskFilter) {
      filtered = filtered.filter(issue => issue.risk === riskFilter)
    }
    
    if (categoryFilter) {
      filtered = filtered.filter(issue => issue.category === categoryFilter)
    }
    
    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      filtered = filtered.filter(issue =>
        issue.title.toLowerCase().includes(term) ||
        issue.description.toLowerCase().includes(term) ||
        issue.element.toLowerCase().includes(term) ||
        issue.page.toLowerCase().includes(term) ||
        issue.selector.toLowerCase().includes(term) ||
        issue.type.toLowerCase().includes(term)
      )
    }

    // Reset expansion states
    filtered.forEach(item => item.isExpanded = false)
    setFilteredData(filtered)
  }

  const toggleDetails = (id: number) => {
    setFilteredData(prev => prev.map(issue => 
      issue.id === id ? { ...issue, isExpanded: !issue.isExpanded } : issue
    ))
  }

  const getRiskClass = (risk: string) => {
    switch (risk) {
      case 'Critical': return { bg: theme.status.error.bg, color: theme.status.error.text, border: theme.status.error.border }
      case 'Major': return { bg: theme.status.warning.bg, color: theme.status.warning.text, border: theme.status.warning.border }
      case 'Minor': return { bg: theme.status.info.bg, color: theme.status.info.text, border: theme.status.info.border }
      case 'Info': return { bg: theme.bg.tertiary, color: theme.text.secondary, border: theme.border.default }
      default: return { bg: theme.bg.tertiary, color: theme.text.secondary, border: theme.border.default }
    }
  }

  const getRiskIcon = (risk: string) => {
    const size = 16
    switch (risk) {
      case 'Critical':
        return <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
      case 'Major':
        return <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
      case 'Minor':
      case 'Info':
        return <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
      default:
        return null
    }
  }

  const summaryData = useMemo(() => {
    const counts = convertDiagnosisToIssues.reduce((acc, issue) => {
      acc[issue.risk] = (acc[issue.risk] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    const totalIssues = convertDiagnosisToIssues.length
    const criticalAndMajor = (counts['Critical'] || 0) + (counts['Major'] || 0)
    
    // Use WCAG score if available, otherwise calculate health score
    const wcagScore = diagnosis.comprehensiveTests?.wcagScore?.score
    const healthScore = wcagScore !== undefined 
      ? wcagScore 
      : (totalIssues > 0 ? Math.round(((totalIssues - criticalAndMajor) / totalIssues) * 100) : 100)

    return {
      healthScore,
      critical: counts['Critical'] || 0,
      major: counts['Major'] || 0,
      total: totalIssues,
      wcagLevel: diagnosis.comprehensiveTests?.wcagScore?.level || null,
      securityCount: diagnosis.comprehensiveTests?.security?.length || 0,
      seoCount: diagnosis.comprehensiveTests?.seo?.length || 0,
      thirdPartyCount: diagnosis.comprehensiveTests?.thirdPartyDependencies?.length || 0,
      consoleErrorCount: diagnosis.comprehensiveTests?.consoleErrors?.filter((e: any) => e.type === 'error' || e.type === 'warning').length || 0,
      networkErrorCount: diagnosis.comprehensiveTests?.networkErrors?.length || 0,
      visualIssueCount: diagnosis.comprehensiveTests?.visualIssues?.length || 0,
      domHealthCount: (diagnosis.comprehensiveTests?.domHealth?.missingAltText?.length || 0) +
                     (diagnosis.comprehensiveTests?.domHealth?.missingLabels?.length || 0) +
                     (diagnosis.comprehensiveTests?.domHealth?.hiddenElements?.length || 0),
      accessibilityCount: diagnosis.comprehensiveTests?.accessibility?.length || 0,
      testableComponentsCount: diagnosis.testableComponents?.length || 0,
      performance: diagnosis.comprehensiveTests?.performance
    }
  }, [convertDiagnosisToIssues, diagnosis])

  return (
    <div style={{
      marginBottom: theme.spacing.lg,
      padding: theme.spacing.lg,
      backgroundColor: theme.bg.primary,
      maxWidth: '1280px',
      margin: '0 auto',
    }}>
      {/* Header */}
      <header style={{ marginBottom: theme.spacing.xl }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: theme.spacing.md }}>
          <div>
            <h1 style={{
              fontSize: '1.875rem',
              fontWeight: '700',
              color: theme.text.primary,
              borderBottom: `2px solid ${theme.border.default}`,
              paddingBottom: theme.spacing.sm,
              margin: 0,
            }}>
              Automated UI Diagnosis Report
            </h1>
            <p style={{ color: theme.text.secondary, marginTop: theme.spacing.xs, margin: 0 }}>
              Summary of high-risk and actionable findings from the last test run.
            </p>
          </div>
          <button
            onClick={onApprove}
            disabled={isApproving}
            style={{
              padding: `${theme.spacing.sm} ${theme.spacing.lg}`,
              backgroundColor: theme.accent.blue,
              color: theme.text.inverse,
              border: 'none',
              borderRadius: theme.radius.md,
              cursor: isApproving ? 'not-allowed' : 'pointer',
              fontWeight: 600,
              boxShadow: theme.shadows.lg,
              opacity: isApproving ? 0.6 : 1,
            }}
          >
            {isApproving ? 'Starting…' : 'Approve & Start Test'}
          </button>
        </div>
      </header>

      {/* Summary Dashboard Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: theme.spacing.md,
        marginBottom: theme.spacing.xl,
      }}>
        {[
          { 
            title: summaryData.wcagLevel ? `WCAG ${summaryData.wcagLevel} Score` : 'Health Score', 
            value: `${summaryData.healthScore}%`, 
            color: summaryData.healthScore > 75 ? theme.accent.green : (summaryData.healthScore > 50 ? theme.accent.yellow : theme.accent.red),
            subtitle: summaryData.wcagLevel ? `Level ${summaryData.wcagLevel}` : undefined
          },
          { title: 'Critical Issues', value: summaryData.critical, color: theme.accent.red },
          { title: 'Major Issues', value: summaryData.major, color: theme.accent.orange },
          { title: 'Total Findings', value: summaryData.total, color: theme.accent.blue },
          ...(summaryData.consoleErrorCount > 0 ? [{ title: 'Console Errors', value: summaryData.consoleErrorCount, color: theme.accent.red }] : []),
          ...(summaryData.networkErrorCount > 0 ? [{ title: 'Network Errors', value: summaryData.networkErrorCount, color: theme.accent.orange }] : []),
          ...(summaryData.visualIssueCount > 0 ? [{ title: 'Visual Issues', value: summaryData.visualIssueCount, color: theme.accent.yellow }] : []),
          ...(summaryData.domHealthCount > 0 ? [{ title: 'DOM Issues', value: summaryData.domHealthCount, color: theme.accent.blue }] : []),
          ...(summaryData.accessibilityCount > 0 ? [{ title: 'Accessibility', value: summaryData.accessibilityCount, color: theme.accent.purple || theme.accent.blue }] : []),
          ...(summaryData.securityCount > 0 ? [{ title: 'Security', value: summaryData.securityCount, color: theme.accent.red }] : []),
          ...(summaryData.seoCount > 0 ? [{ title: 'SEO Issues', value: summaryData.seoCount, color: theme.accent.yellow }] : []),
        ].map((item, idx) => (
          <div key={idx} style={{
            backgroundColor: theme.bg.secondary,
            padding: theme.spacing.lg,
            borderRadius: theme.radius.xl,
            boxShadow: theme.shadows.lg,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            transition: 'box-shadow 0.2s',
          }}
          onMouseEnter={(e) => e.currentTarget.style.boxShadow = theme.shadows.xl}
          onMouseLeave={(e) => e.currentTarget.style.boxShadow = theme.shadows.lg}
          >
            <div>
              <p style={{ fontSize: '0.875rem', fontWeight: '500', color: theme.text.secondary, margin: 0 }}>
                {item.title}
              </p>
              <p style={{ marginTop: theme.spacing.xs, fontSize: '1.875rem', fontWeight: '700', color: item.color, margin: 0 }}>
                {item.value}
              </p>
              {item.subtitle && (
                <p style={{ marginTop: theme.spacing.xs, fontSize: '0.75rem', color: theme.text.tertiary, margin: 0 }}>
                  {item.subtitle}
                </p>
              )}
            </div>
            <div style={{
              padding: theme.spacing.md,
              borderRadius: theme.radius.full,
              backgroundColor: theme.bg.tertiary,
              color: item.color,
            }}>
              {getRiskIcon('Info')}
            </div>
          </div>
        ))}
      </div>

      {/* Performance Metrics Section */}
      {summaryData.performance && (
        <div style={{
          marginBottom: theme.spacing.xl,
          padding: theme.spacing.lg,
          backgroundColor: theme.bg.secondary,
          borderRadius: theme.radius.xl,
          boxShadow: theme.shadows.lg,
        }}>
          <h2 style={{
            fontSize: '1.25rem',
            fontWeight: '600',
            color: theme.text.primary,
            marginBottom: theme.spacing.md,
            margin: 0,
          }}>
            Performance Metrics
          </h2>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: theme.spacing.md,
            marginTop: theme.spacing.md,
          }}>
            {summaryData.performance.pageLoadTime > 0 && (
              <div>
                <p style={{ fontSize: '0.875rem', color: theme.text.secondary, margin: 0 }}>Page Load Time</p>
                <p style={{ fontSize: '1.5rem', fontWeight: '700', color: theme.accent.blue, margin: theme.spacing.xs + ' 0 0 0' }}>
                  {Math.round(summaryData.performance.pageLoadTime)}ms
                </p>
              </div>
            )}
            {summaryData.performance.largestContentfulPaint && (
              <div>
                <p style={{ fontSize: '0.875rem', color: theme.text.secondary, margin: 0 }}>LCP (Largest Contentful Paint)</p>
                <p style={{ fontSize: '1.5rem', fontWeight: '700', color: summaryData.performance.largestContentfulPaint < 2500 ? theme.accent.green : theme.accent.yellow, margin: theme.spacing.xs + ' 0 0 0' }}>
                  {Math.round(summaryData.performance.largestContentfulPaint)}ms
                </p>
                <p style={{ fontSize: '0.75rem', color: theme.text.tertiary, margin: theme.spacing.xs + ' 0 0 0' }}>
                  {summaryData.performance.largestContentfulPaint < 2500 ? 'Good' : summaryData.performance.largestContentfulPaint < 4000 ? 'Needs Improvement' : 'Poor'}
                </p>
              </div>
            )}
            {summaryData.performance.cumulativeLayoutShift !== undefined && (
              <div>
                <p style={{ fontSize: '0.875rem', color: theme.text.secondary, margin: 0 }}>CLS (Cumulative Layout Shift)</p>
                <p style={{ fontSize: '1.5rem', fontWeight: '700', color: summaryData.performance.cumulativeLayoutShift < 0.1 ? theme.accent.green : theme.accent.yellow, margin: theme.spacing.xs + ' 0 0 0' }}>
                  {summaryData.performance.cumulativeLayoutShift.toFixed(3)}
                </p>
                <p style={{ fontSize: '0.75rem', color: theme.text.tertiary, margin: theme.spacing.xs + ' 0 0 0' }}>
                  {summaryData.performance.cumulativeLayoutShift < 0.1 ? 'Good' : summaryData.performance.cumulativeLayoutShift < 0.25 ? 'Needs Improvement' : 'Poor'}
                </p>
              </div>
            )}
            {summaryData.performance.firstInputDelay && (
              <div>
                <p style={{ fontSize: '0.875rem', color: theme.text.secondary, margin: 0 }}>FID (First Input Delay)</p>
                <p style={{ fontSize: '1.5rem', fontWeight: '700', color: summaryData.performance.firstInputDelay < 100 ? theme.accent.green : theme.accent.yellow, margin: theme.spacing.xs + ' 0 0 0' }}>
                  {Math.round(summaryData.performance.firstInputDelay)}ms
                </p>
                <p style={{ fontSize: '0.75rem', color: theme.text.tertiary, margin: theme.spacing.xs + ' 0 0 0' }}>
                  {summaryData.performance.firstInputDelay < 100 ? 'Good' : summaryData.performance.firstInputDelay < 300 ? 'Needs Improvement' : 'Poor'}
                </p>
              </div>
            )}
            {summaryData.performance.totalPageSize && (
              <div>
                <p style={{ fontSize: '0.875rem', color: theme.text.secondary, margin: 0 }}>Total Page Size</p>
                <p style={{ fontSize: '1.5rem', fontWeight: '700', color: theme.accent.blue, margin: theme.spacing.xs + ' 0 0 0' }}>
                  {(summaryData.performance.totalPageSize / 1024 / 1024).toFixed(2)}MB
                </p>
              </div>
            )}
            {summaryData.performance.slowResources && summaryData.performance.slowResources.length > 0 && (
              <div>
                <p style={{ fontSize: '0.875rem', color: theme.text.secondary, margin: 0 }}>Slow Resources</p>
                <p style={{ fontSize: '1.5rem', fontWeight: '700', color: theme.accent.orange, margin: theme.spacing.xs + ' 0 0 0' }}>
                  {summaryData.performance.slowResources.length}
                </p>
                <p style={{ fontSize: '0.75rem', color: theme.text.tertiary, margin: theme.spacing.xs + ' 0 0 0' }}>
                  Resources &gt;1s or &gt;500KB
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div style={{
        marginBottom: theme.spacing.lg,
        display: 'flex',
        flexDirection: isMobile ? 'column' : 'row',
        gap: theme.spacing.md,
      }}>
        <input
          type="text"
          placeholder="Search issues, elements, or pages..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{
            flex: 1,
            padding: theme.spacing.md,
            border: `1px solid ${theme.border.default}`,
            borderRadius: theme.radius.lg,
            boxShadow: theme.shadows.sm,
            fontSize: '0.875rem',
            color: theme.text.primary,
            backgroundColor: theme.bg.secondary,
          }}
          onFocus={(e) => {
            e.target.style.borderColor = theme.accent.primary
            e.target.style.outline = `2px solid ${theme.accent.primary}33`
          }}
          onBlur={(e) => {
            e.target.style.borderColor = theme.border.default
            e.target.style.outline = 'none'
          }}
        />
        <select
          value={riskFilter}
          onChange={(e) => setRiskFilter(e.target.value)}
          style={{
            padding: theme.spacing.md,
            border: `1px solid ${theme.border.default}`,
            borderRadius: theme.radius.lg,
            boxShadow: theme.shadows.sm,
            fontSize: '0.875rem',
            color: theme.text.primary,
            backgroundColor: theme.bg.secondary,
            minWidth: isMobile ? '100%' : '180px',
          }}
          onFocus={(e) => {
            e.target.style.borderColor = theme.accent.primary
            e.target.style.outline = `2px solid ${theme.accent.primary}33`
          }}
          onBlur={(e) => {
            e.target.style.borderColor = theme.border.default
            e.target.style.outline = 'none'
          }}
        >
          <option value="">All Risk Types</option>
          <option value="Critical">Critical</option>
          <option value="Major">Major</option>
          <option value="Minor">Minor</option>
          <option value="Info">Info</option>
        </select>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          style={{
            padding: theme.spacing.md,
            border: `1px solid ${theme.border.default}`,
            borderRadius: theme.radius.lg,
            boxShadow: theme.shadows.sm,
            fontSize: '0.875rem',
            color: theme.text.primary,
            backgroundColor: theme.bg.secondary,
            minWidth: isMobile ? '100%' : '200px',
          }}
          onFocus={(e) => {
            e.target.style.borderColor = theme.accent.primary
            e.target.style.outline = `2px solid ${theme.accent.primary}33`
          }}
          onBlur={(e) => {
            e.target.style.borderColor = theme.border.default
            e.target.style.outline = 'none'
          }}
        >
          <option value="">All Categories</option>
          <option value="Security">Security</option>
          <option value="SEO">SEO</option>
          <option value="Accessibility">Accessibility</option>
          <option value="Performance">Performance</option>
          <option value="Visual">Visual</option>
          <option value="DOM">DOM</option>
          <option value="Console">Console</option>
          <option value="Network">Network</option>
          <option value="Component">Component</option>
          <option value="Risk">Risk</option>
          <option value="Other">Other</option>
        </select>
      </div>

      {/* Results Table (Desktop View) */}
      <div style={{ display: !isMobile ? 'block' : 'none' }}>
        <div style={{
          backgroundColor: theme.bg.secondary,
          borderRadius: theme.radius.xl,
          boxShadow: theme.shadows.lg,
          overflow: 'hidden',
        }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead style={{ backgroundColor: theme.bg.tertiary }}>
              <tr>
                <th style={{ padding: theme.spacing.md, textAlign: 'left', fontSize: '0.75rem', fontWeight: '500', color: theme.text.secondary, textTransform: 'uppercase', width: '8.33%' }}>Risk</th>
                <th style={{ padding: theme.spacing.md, textAlign: 'left', fontSize: '0.75rem', fontWeight: '500', color: theme.text.secondary, textTransform: 'uppercase', width: '33.33%' }}>Issue Title / Description</th>
                <th style={{ padding: theme.spacing.md, textAlign: 'left', fontSize: '0.75rem', fontWeight: '500', color: theme.text.secondary, textTransform: 'uppercase', width: '25%' }}>Element Type / Page</th>
                <th style={{ padding: theme.spacing.md, textAlign: 'left', fontSize: '0.75rem', fontWeight: '500', color: theme.text.secondary, textTransform: 'uppercase', width: '25%' }}>Recommended Fix</th>
                <th style={{ padding: theme.spacing.md, width: '8.33%' }}></th>
              </tr>
            </thead>
            <tbody>
              {filteredData.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: theme.spacing.xl, color: theme.text.secondary }}>
                    No issues found matching your criteria. Great job!
                  </td>
                </tr>
              ) : (
                filteredData.map((issue) => {
                  const riskStyle = getRiskClass(issue.risk)
                  return (
                    <React.Fragment key={issue.id}>
                      <tr
                        style={{
                          cursor: 'pointer',
                          borderBottom: `1px solid ${theme.border.subtle}`,
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = theme.bg.tertiary}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                        onClick={() => toggleDetails(issue.id)}
                      >
                        <td style={{ padding: theme.spacing.md, whiteSpace: 'nowrap' }}>
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            padding: `${theme.spacing.xs} ${theme.spacing.sm}`,
                            fontSize: '0.75rem',
                            fontWeight: '500',
                            borderRadius: theme.radius.full,
                            backgroundColor: riskStyle.bg,
                            color: riskStyle.color,
                            border: `1px solid ${riskStyle.border}`,
                          }}>
                            <span style={{ marginRight: theme.spacing.xs, display: 'flex', alignItems: 'center' }}>
                              {getRiskIcon(issue.risk)}
                            </span>
                            {issue.risk}
                          </span>
                        </td>
                        <td style={{ padding: theme.spacing.md }}>
                          <div style={{ fontWeight: '600', color: theme.text.primary }}>{issue.title}</div>
                          <div style={{ fontSize: '0.875rem', color: theme.text.secondary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {issue.description}
                          </div>
                        </td>
                        <td style={{ padding: theme.spacing.md, whiteSpace: 'nowrap', fontSize: '0.875rem', color: theme.text.secondary }}>
                          <div>
                            <span style={{ fontWeight: '500' }}>{issue.type}</span>
                            {issue.category && <span style={{ color: theme.text.tertiary, marginLeft: theme.spacing.xs, fontSize: '0.75rem' }}>({issue.category})</span>}
                          </div>
                          <div style={{ marginTop: theme.spacing.xs, color: theme.text.tertiary, fontSize: '0.75rem' }}>{issue.page}</div>
                        </td>
                        <td style={{ padding: theme.spacing.md, fontSize: '0.875rem', color: theme.text.secondary }}>
                          {issue.fix}
                        </td>
                        <td style={{ padding: theme.spacing.md, whiteSpace: 'nowrap', textAlign: 'right' }}>
                          <div style={{
                            transform: issue.isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                            transition: 'transform 0.3s',
                            display: 'inline-block',
                          }}>
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="m6 9 6 6 6-6"/>
                            </svg>
                          </div>
                        </td>
                      </tr>
                      {issue.isExpanded && (
                        <tr>
                          <td colSpan={5} style={{ padding: theme.spacing.md, backgroundColor: theme.bg.tertiary, borderTop: `1px solid ${theme.border.default}` }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.md, fontSize: '0.875rem', color: theme.text.secondary }}>
                              <div>
                                <h4 style={{ fontWeight: '600', color: theme.text.primary, marginBottom: theme.spacing.xs, margin: 0 }}>Detailed Failure Reason:</h4>
                                <p style={{ margin: 0 }}>{issue.description}</p>
                              </div>
                              <div>
                                <h4 style={{ fontWeight: '600', color: theme.text.primary, marginBottom: theme.spacing.xs, margin: 0 }}>Technical Selector:</h4>
                                <code style={{
                                  display: 'block',
                                  padding: theme.spacing.sm,
                                  backgroundColor: theme.bg.secondary,
                                  borderRadius: theme.radius.md,
                                  overflowX: 'auto',
                                  fontFamily: 'monospace',
                                  fontSize: '0.75rem',
                                }}>
                                  {issue.selector}
                                </code>
                              </div>
                              {issue.metadata && Object.keys(issue.metadata).length > 0 && (
                                <div>
                                  <h4 style={{ fontWeight: '600', color: theme.text.primary, marginBottom: theme.spacing.xs, margin: 0 }}>Additional Details:</h4>
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.xs, fontSize: '0.875rem' }}>
                                    {issue.metadata.url && <div><strong>URL:</strong> <code style={{ backgroundColor: theme.bg.secondary, padding: '2px 4px', borderRadius: theme.radius.sm }}>{issue.metadata.url}</code></div>}
                                    {issue.metadata.source && <div><strong>Source:</strong> {issue.metadata.source}:{issue.metadata.line}:{issue.metadata.column}</div>}
                                    {issue.metadata.timestamp && <div><strong>Time:</strong> {new Date(issue.metadata.timestamp).toLocaleString()}</div>}
                                    {issue.metadata.method && <div><strong>Method:</strong> {issue.metadata.method}</div>}
                                    {issue.metadata.status && <div><strong>Status:</strong> {issue.metadata.status}</div>}
                                    {issue.metadata.domain && <div><strong>Domain:</strong> {issue.metadata.domain}</div>}
                                    {issue.metadata.type && <div><strong>Type:</strong> {issue.metadata.type}</div>}
                                    {issue.metadata.testability && <div><strong>Testability:</strong> {issue.metadata.testability}</div>}
                                    {issue.metadata.scripts && issue.metadata.scripts.length > 0 && (
                                      <div>
                                        <strong>Scripts:</strong>
                                        <ul style={{ margin: theme.spacing.xs + ' 0 0 ' + theme.spacing.md, padding: 0 }}>
                                          {issue.metadata.scripts.slice(0, 3).map((script: string, idx: number) => (
                                            <li key={idx} style={{ fontSize: '0.75rem', fontFamily: 'monospace' }}>{script}</li>
                                          ))}
                                        </ul>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )}
                              {issue.fixCode && (
                                <div>
                                  <h4 style={{ fontWeight: '600', color: theme.text.primary, marginBottom: theme.spacing.xs, margin: 0 }}>Code Suggestion:</h4>
                                  <pre style={{
                                    padding: theme.spacing.md,
                                    backgroundColor: theme.text.primary,
                                    color: '#86efac',
                                    borderRadius: theme.radius.md,
                                    overflowX: 'auto',
                                    whiteSpace: 'pre-wrap',
                                    fontSize: '0.75rem',
                                    margin: 0,
                                  }}>
                                    {issue.fixCode}
                                  </pre>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Results List (Mobile/Tablet View) */}
      <div style={{ display: isMobile ? 'block' : 'none' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.md }}>
          {filteredData.length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: theme.spacing.xl,
              color: theme.text.secondary,
              backgroundColor: theme.bg.secondary,
              borderRadius: theme.radius.xl,
              boxShadow: theme.shadows.lg,
            }}>
              No issues found matching your criteria. Great job!
            </div>
          ) : (
            filteredData.map((issue) => {
              const riskStyle = getRiskClass(issue.risk)
              return (
                <div
                  key={issue.id}
                  style={{
                    backgroundColor: theme.bg.secondary,
                    borderRadius: theme.radius.xl,
                    boxShadow: theme.shadows.lg,
                    padding: theme.spacing.md,
                    cursor: 'pointer',
                  }}
                  onClick={() => toggleDetails(issue.id)}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: theme.spacing.sm }}>
                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      padding: `${theme.spacing.xs} ${theme.spacing.sm}`,
                      fontSize: '0.75rem',
                      fontWeight: '500',
                      borderRadius: theme.radius.full,
                      backgroundColor: riskStyle.bg,
                      color: riskStyle.color,
                      border: `1px solid ${riskStyle.border}`,
                    }}>
                      <span style={{ marginRight: theme.spacing.xs, display: 'flex', alignItems: 'center' }}>
                        {getRiskIcon(issue.risk)}
                      </span>
                      {issue.risk}
                    </span>
                    <div style={{
                      transform: issue.isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                      transition: 'transform 0.3s',
                    }}>
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="m6 9 6 6 6-6"/>
                      </svg>
                    </div>
                  </div>
                  <div style={{ fontWeight: '600', fontSize: '1.125rem', color: theme.text.primary, marginBottom: theme.spacing.xs }}>
                    {issue.title}
                  </div>
                  <div style={{ fontSize: '0.875rem', color: theme.text.secondary, marginBottom: theme.spacing.sm }}>
                    {issue.fix}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: theme.text.tertiary }}>
                    <span style={{ fontWeight: '500' }}>{issue.type}</span> on {issue.page}
                  </div>
                  {issue.isExpanded && (
                    <div style={{ marginTop: theme.spacing.md }}>
                      <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: theme.spacing.sm,
                        fontSize: '0.875rem',
                        color: theme.text.secondary,
                        padding: theme.spacing.md,
                        backgroundColor: theme.bg.tertiary,
                        borderRadius: theme.radius.lg,
                      }}>
                        <div>
                          <h4 style={{ fontWeight: '600', color: theme.text.primary, marginBottom: theme.spacing.xs, margin: 0 }}>Reason:</h4>
                          <p style={{ fontSize: '0.875rem', margin: 0 }}>{issue.description}</p>
                        </div>
                        <div>
                          <h4 style={{ fontWeight: '600', color: theme.text.primary, marginBottom: theme.spacing.xs, margin: 0 }}>Selector:</h4>
                          <code style={{
                            display: 'block',
                            fontSize: '0.75rem',
                            padding: theme.spacing.xs,
                            backgroundColor: theme.bg.secondary,
                            borderRadius: theme.radius.md,
                            overflowX: 'auto',
                            fontFamily: 'monospace',
                          }}>
                            {issue.selector}
                          </code>
                        </div>
                        {issue.fixCode && (
                          <div>
                            <h4 style={{ fontWeight: '600', color: theme.text.primary, marginBottom: theme.spacing.xs, margin: 0 }}>Code:</h4>
                            <pre style={{
                              padding: theme.spacing.sm,
                              fontSize: '0.75rem',
                              backgroundColor: theme.text.primary,
                              color: '#86efac',
                              borderRadius: theme.radius.md,
                              overflowX: 'auto',
                              whiteSpace: 'pre-wrap',
                              margin: 0,
                            }}>
                              {issue.fixCode}
                            </pre>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}

export default function TestRunPage() {
  const params = useParams()
  const router = useRouter()
  const testId = params.testId as string
  const [testRun, setTestRun] = useState<TestRun | null>(null)
  const [artifacts, setArtifacts] = useState<TestArtifact[]>([])
  const [loading, setLoading] = useState(true)
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [isPausing, setIsPausing] = useState(false)
  const [isResuming, setIsResuming] = useState(false)
  const [isStopping, setIsStopping] = useState(false)
  const [isApproving, setIsApproving] = useState(false)
  const [currentScreenshot, setCurrentScreenshot] = useState<string | null>(null)
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [streamUrl, setStreamUrl] = useState<string | null>(null)
  const [livekitUrl, setLivekitUrl] = useState<string | undefined>(undefined)
  const [livekitToken, setLivekitToken] = useState<string | undefined>(undefined)
  const [showLiveControl, setShowLiveControl] = useState(false)
  const [hoveredStepId, setHoveredStepId] = useState<string | null>(null)
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(['current']))
  const diagnosisSoundPlayedRef = useRef(false)
  const notificationPermissionRequestedRef = useRef(false)
  const [diagnosisProgress, setDiagnosisProgress] = useState(0)
  const [diagnosisEvents, setDiagnosisEvents] = useState<DiagnosisEvent[]>([])
  const [isDiagnosisModalDismissed, setIsDiagnosisModalDismissed] = useState(false)
  const diagnosisMilestonesRef = useRef<DiagnosisMilestoneState[]>(createDiagnosisMilestoneState())
  const [isCancellingRun, setIsCancellingRun] = useState(false)

  // Compute derived values (must be before early returns per Rules of Hooks)
  const steps = testRun?.steps || []
  const errors = steps.filter(s => !s.success)
  const latestScreenshot = currentScreenshot || (steps.length > 0 ? steps[steps.length - 1]?.screenshotUrl || null : null)
  const completedVideoUrl = videoUrl && testRun && (testRun.status === 'completed' || testRun.status === 'failed' || testRun.status === 'cancelled')
  const isDiagnosing = testRun?.status === 'diagnosing'
  const isActiveRun = isDiagnosing || testRun?.status === 'running'
  const isWaitingApproval = testRun?.status === 'waiting_approval'
  const diagnosis = testRun?.diagnosis
  const activeDiagnosisStageIndex = useMemo(() => {
    let idx = 0
    DIAGNOSIS_MILESTONES.forEach((stage, stageIdx) => {
      if (diagnosisProgress >= stage.threshold) {
        idx = stageIdx
      }
    })
    return idx
  }, [diagnosisProgress])

  const playDiagnosisReadySound = useCallback(() => {
    if (typeof window === 'undefined') return
    try {
      const AudioContextClass = (window.AudioContext || (window as any).webkitAudioContext)
      if (!AudioContextClass) return
      const audioCtx = new AudioContextClass()
      const oscillator = audioCtx.createOscillator()
      const gainNode = audioCtx.createGain()
      oscillator.type = 'sine'
      oscillator.frequency.setValueAtTime(880, audioCtx.currentTime)
      gainNode.gain.setValueAtTime(0.001, audioCtx.currentTime)
      gainNode.gain.exponentialRampToValueAtTime(0.2, audioCtx.currentTime + 0.02)
      gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.6)
      oscillator.connect(gainNode)
      gainNode.connect(audioCtx.destination)
      oscillator.start()
      oscillator.stop(audioCtx.currentTime + 0.6)
    } catch (error) {
      console.warn('Failed to play diagnosis notification sound:', error)
    }
  }, [])

  const triggerDiagnosisNotification = useCallback(() => {
    if (typeof window === 'undefined' || typeof Notification === 'undefined') {
      return
    }
    if (Notification.permission === 'granted') {
      new Notification('Diagnosis ready for review', {
        body: 'The AI triage is complete. Review and approve to start testing.',
      })
      return
    }
    if (Notification.permission === 'default' && !notificationPermissionRequestedRef.current) {
      notificationPermissionRequestedRef.current = true
      Notification.requestPermission().then((permission) => {
        if (permission === 'granted') {
          new Notification('Diagnosis ready for review', {
            body: 'The AI triage is complete. Review and approve to start testing.',
          })
        }
      }).catch(() => {})
    }
  }, [])

  // Group steps for progressive disclosure (useMemo must be before early returns)
  const stepGroups = useMemo(() => {
    const groups: Record<string, typeof steps> = {}
    steps.forEach((step) => {
      const key = step.action === 'navigate' ? `Page: ${step.value || 'Unknown'}` : 'Interactions'
      if (!groups[key]) groups[key] = []
      groups[key].push(step)
    })
    return groups
  }, [steps])

  useEffect(() => {
    loadData()
    
    if (autoRefresh) {
      // Poll faster during diagnosis (500ms) to catch rapid progress updates
      // Poll slower during test execution (1000ms) to reduce API load
      const pollInterval = isDiagnosing ? 500 : 1000
      
      const interval = setInterval(() => {
        if (testRun && (testRun.status === 'running' || testRun.status === 'queued' || testRun.status === 'diagnosing')) {
          loadData()
          // Update current screenshot for live view
          if (testRun.steps && testRun.steps.length > 0) {
            const latestStep = testRun.steps[testRun.steps.length - 1]
            if (latestStep.screenshotUrl) {
              setCurrentScreenshot(latestStep.screenshotUrl)
            }
          }
        }
      }, pollInterval)
      
      return () => clearInterval(interval)
    }
  }, [testId, autoRefresh, testRun?.status, isDiagnosing])

  useEffect(() => {
    if (isWaitingApproval && !diagnosisSoundPlayedRef.current) {
      diagnosisSoundPlayedRef.current = true
      playDiagnosisReadySound()
      triggerDiagnosisNotification()
    } else if (!isWaitingApproval) {
      diagnosisSoundPlayedRef.current = false
    }
  }, [isWaitingApproval, playDiagnosisReadySound, triggerDiagnosisNotification])

  // Use real progress from backend if available
  useEffect(() => {
    if (isDiagnosing || isWaitingApproval) {
      // Use real progress from backend
      const backendProgress = testRun?.diagnosisProgress?.percent
      if (typeof backendProgress === 'number') {
        setDiagnosisProgress(backendProgress)
      } else if (isWaitingApproval) {
        // Diagnosis complete, show 100%
        setDiagnosisProgress(100)
      } else if (isDiagnosing) {
        // No backend progress yet, show initial state
        if (diagnosisProgress === 0) {
          setDiagnosisProgress(5) // Start at 5%
        }
      }
    } else {
      // Not diagnosing, reset
      setDiagnosisProgress(0)
    }
  }, [isDiagnosing, isWaitingApproval, testRun?.diagnosisProgress?.percent])
  useEffect(() => {
    if (isDiagnosing) {
      diagnosisMilestonesRef.current = createDiagnosisMilestoneState()
      setDiagnosisEvents([])
      setIsDiagnosisModalDismissed(false)
    }
  }, [isDiagnosing])

  useEffect(() => {
    if (!isDiagnosing) return
    const newEvents: DiagnosisEvent[] = []
    diagnosisMilestonesRef.current.forEach((milestone) => {
      if (!milestone.triggered && diagnosisProgress >= milestone.threshold) {
        milestone.triggered = true
        newEvents.push({
          id: `${milestone.key}-${Date.now()}`,
          label: milestone.label,
          detail: milestone.detail,
          timestamp: new Date().toLocaleTimeString(),
        })
      }
    })
    if (newEvents.length > 0) {
      setDiagnosisEvents((prev) => [...prev, ...newEvents])
    }
  }, [diagnosisProgress, isDiagnosing])

  useEffect(() => {
    if (typeof document === 'undefined') return
    if (isDiagnosing && !isDiagnosisModalDismissed) {
      const originalOverflow = document.body.style.overflow
      document.body.style.overflow = 'hidden'
      return () => {
        document.body.style.overflow = originalOverflow
      }
    }
  }, [isDiagnosing, isDiagnosisModalDismissed])

  // Keyboard shortcuts (must be before early returns)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Space to pause/resume (only if not in input field)
      if (e.code === 'Space' && (e.target as HTMLElement).tagName !== 'INPUT' && (e.target as HTMLElement).tagName !== 'TEXTAREA') {
        e.preventDefault()
        if (testRun?.status === 'running') {
          if (testRun.paused) {
            handleResume()
          } else {
            handlePause()
          }
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [testRun])

  async function loadData() {
    try {
      const response = await api.getTestRun(testId)
      setTestRun(response.testRun)
      setArtifacts(response.artifacts)
      
      const videoArtifact = response.artifacts.find((artifact) => artifact.type === 'video')
      setVideoUrl(videoArtifact?.url || response.testRun.artifactsUrl || null)
      
      // Stop auto-refresh if completed or failed
      if (response.testRun.status === 'completed' || response.testRun.status === 'failed') {
        setAutoRefresh(false)
      }
    } catch (error) {
      console.error('Failed to load test run:', error)
    } finally {
      setLoading(false)
    }
  }

  // Early returns AFTER all hooks
  if (loading) {
    return <div style={{ padding: '2rem', textAlign: 'center' }}>Loading...</div>
  }

  if (!testRun) {
    return <div style={{ padding: '2rem', textAlign: 'center' }}>Test run not found</div>
  }

  const toggleGroup = (groupName: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev)
      if (next.has(groupName)) {
        next.delete(groupName)
      } else {
        next.add(groupName)
      }
      return next
    })
  }

  const handlePause = async () => {
    setIsPausing(true)
    try {
      const result = await api.pauseTestRun(testId)
      if (result.success) {
        await loadData()
      } else {
        alert('Failed to pause test run. Please try again.')
      }
    } catch (error: any) {
      console.error('Pause error:', error)
      alert(`Failed to pause: ${error.message || 'Unknown error. Check console for details.'}`)
    } finally {
      setIsPausing(false)
    }
  }

  const handleResume = async () => {
    setIsResuming(true)
    try {
      const result = await api.resumeTestRun(testId)
      if (result.success) {
        await loadData()
      } else {
        alert('Failed to resume test run. Please try again.')
      }
    } catch (error: any) {
      console.error('Resume error:', error)
      alert(`Failed to resume: ${error.message || 'Unknown error. Check console for details.'}`)
    } finally {
      setIsResuming(false)
    }
  }

  const handleApprove = async () => {
    if (!isWaitingApproval) return
    setIsApproving(true)
    try {
      const result = await api.approveTestRun(testId)
      if (result.success) {
        await loadData()
        setAutoRefresh(true)
      } else {
        alert('Failed to start test. Please try again.')
      }
    } catch (error: any) {
      console.error('Approve error:', error)
      alert(`Failed to start test: ${error.message || 'Unknown error. Check console for details.'}`)
    } finally {
      setIsApproving(false)
    }
  }

  const handleCancelRun = async () => {
    if (!confirm('Cancel this test run? This will stop the current diagnosis.')) return
    setIsCancellingRun(true)
    try {
      const result = await api.cancelTestRun(testId)
      if (!result.success) {
        alert('Failed to cancel test run. Please try again.')
        return
      }
      await loadData()
    } catch (error: any) {
      console.error('Cancel error:', error)
      alert(`Failed to cancel test run: ${error.message || 'Unknown error. Check console for details.'}`)
    } finally {
      setIsCancellingRun(false)
    }
  }

  return (
    <div style={{ 
      padding: theme.spacing.md, 
      height: 'calc(100vh - 80px)', 
      display: 'flex', 
      flexDirection: 'column',
      backgroundColor: theme.bg.primary,
      color: theme.text.primary,
    }}>
      <KeyboardShortcuts />
      
      {/* Header */}
      <div style={{ marginBottom: theme.spacing.md, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          {!isActiveRun && (
            <Link
              href="/dashboard"
              style={{
                color: theme.accent.primary,
                textDecoration: 'none',
                fontSize: '0.875rem',
                fontWeight: '500',
              }}
            >
              ← Back to Dashboard
            </Link>
          )}
          <h1 style={{ 
            fontSize: '1.5rem', 
            fontWeight: 'bold', 
            marginTop: theme.spacing.sm,
            color: theme.accent.primary,
          }}>
            Test Run: {testId.substring(0, 8)}...
          </h1>
        </div>
        {(testRun.status === 'completed' || testRun.status === 'failed') && (
          <button
            onClick={() => router.push(`/test/report/${testId}`)}
            style={{
              padding: `${theme.spacing.sm} ${theme.spacing.md}`,
              backgroundColor: theme.accent.blue,
              color: theme.text.inverse,
              border: 'none',
              borderRadius: theme.radius.md,
              cursor: 'pointer',
              fontWeight: '500',
            }}
          >
            View Report →
          </button>
        )}
      </div>

      {isDiagnosing && (
        <>
          {!isDiagnosisModalDismissed ? (
            <div
              style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(61, 54, 48, 0.75)', // Beige overlay matching theme
                zIndex: 1000,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: theme.spacing.lg,
              }}
            >
              <div
                role="dialog"
                aria-modal="true"
                aria-label="Running UI Diagnosis"
                style={{
                  width: 'min(980px, 96vw)',
                  maxHeight: '90vh',
                  background: theme.bg.primary,
                  borderRadius: theme.radius.lg,
                  border: `1px solid ${theme.border.emphasis}`,
                  boxShadow: theme.shadows.lg,
                  padding: theme.spacing.xl,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: theme.spacing.lg,
                  overflow: 'hidden',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: theme.spacing.md }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.sm }}>
                      <div style={{
                        width: '12px',
                        height: '12px',
                        borderRadius: '50%',
                        background: theme.accent.blue,
                        boxShadow: `0 0 12px ${theme.accent.blue}`,
                      }} />
                      <p style={{ margin: 0, fontSize: '0.85rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: theme.text.tertiary }}>
                        Pre-test checkpoint
                      </p>
                    </div>
                    <h2 style={{ margin: `${theme.spacing.xs} 0`, color: theme.text.primary }}>
                      Running UI Diagnosis
                    </h2>
                    <p style={{ margin: 0, color: theme.text.secondary }}>
                      Mapping the site before executing your test plan. Feel free to keep this open or minimize it while we work.
                    </p>
                    {testRun.paused && (
                      <p style={{ margin: `${theme.spacing.xs} 0 0`, color: theme.status.warning.text, fontWeight: 600 }}>
                        Diagnosis paused — resume when you&apos;re ready.
                      </p>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: theme.spacing.sm, alignItems: 'center' }}>
                    {testRun.paused ? (
                      <button
                        onClick={handleResume}
                        disabled={isResuming}
                        style={{
                          padding: `${theme.spacing.xs} ${theme.spacing.md}`,
                          background: theme.accent.green,
                          color: theme.text.inverse,
                          border: 'none',
                          borderRadius: theme.radius.full,
                          cursor: isResuming ? 'not-allowed' : 'pointer',
                          fontWeight: 600,
                        }}
                      >
                        {isResuming ? 'Resuming…' : 'Resume diagnosis'}
                      </button>
                    ) : (
                      <button
                        onClick={handlePause}
                        disabled={isPausing}
                        style={{
                          padding: `${theme.spacing.xs} ${theme.spacing.md}`,
                          background: theme.status.paused.border,
                          color: theme.text.inverse,
                          border: 'none',
                          borderRadius: theme.radius.full,
                          cursor: isPausing ? 'not-allowed' : 'pointer',
                          fontWeight: 600,
                        }}
                      >
                        {isPausing ? 'Pausing…' : 'Pause diagnosis'}
                      </button>
                    )}
                    <button
                      onClick={handleCancelRun}
                      disabled={isCancellingRun}
                      style={{
                        padding: `${theme.spacing.xs} ${theme.spacing.md}`,
                        background: theme.status.error.border,
                        color: theme.text.inverse,
                        border: 'none',
                        borderRadius: theme.radius.full,
                        cursor: isCancellingRun ? 'not-allowed' : 'pointer',
                        fontWeight: 600,
                      }}
                    >
                      {isCancellingRun ? 'Cancelling…' : 'Cancel run'}
                    </button>
                    <button
                      onClick={() => setIsDiagnosisModalDismissed(true)}
                      style={{
                        background: 'transparent',
                        color: theme.text.secondary,
                        border: `1px solid ${theme.border.default}`,
                        borderRadius: theme.radius.full,
                        padding: `${theme.spacing.xs} ${theme.spacing.sm}`,
                        cursor: 'pointer',
                      }}
                      aria-label="Hide diagnosis progress"
                    >
                      Hide
                    </button>
                  </div>
                </div>

                <div>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    color: theme.text.secondary,
                    fontSize: '0.9rem',
                    marginBottom: theme.spacing.xs,
                  }}>
                    <span>Progress</span>
                    <span>{Math.round(diagnosisProgress)}%</span>
                  </div>
                  <div style={{
                    width: '100%',
                    height: '12px',
                    borderRadius: theme.radius.full,
                    backgroundColor: theme.bg.secondary,
                    border: `1px solid ${theme.border.subtle}`,
                    overflow: 'hidden',
                  }}>
                    <div
                      style={{
                        width: `${diagnosisProgress}%`,
                        height: '100%',
                        backgroundImage: `linear-gradient(90deg, ${theme.accent.blue}, ${theme.accent.purple})`,
                        transition: 'width 0.4s ease',
                      }}
                    />
                  </div>
                  {/* Real-time step indicator from backend */}
                  {testRun?.diagnosisProgress && (
                    <div style={{
                      marginTop: theme.spacing.sm,
                      padding: theme.spacing.sm,
                      background: theme.bg.secondary,
                      borderRadius: theme.radius.md,
                      border: `1px solid ${theme.border.subtle}`,
                    }}>
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: theme.spacing.xs,
                      }}>
                        <span style={{ 
                          color: theme.accent.blue, 
                          fontWeight: 600,
                          fontSize: '0.85rem',
                        }}>
                          Step {testRun.diagnosisProgress.step}/{testRun.diagnosisProgress.totalSteps}
                        </span>
                        <span style={{ 
                          color: theme.text.tertiary, 
                          fontSize: '0.75rem',
                        }}>
                          {testRun.diagnosisProgress.subStep}/{testRun.diagnosisProgress.totalSubSteps}
                        </span>
                      </div>
                      <div style={{ 
                        color: theme.text.primary, 
                        fontWeight: 500,
                        fontSize: '0.9rem',
                      }}>
                        {testRun.diagnosisProgress.stepLabel}
                      </div>
                      {testRun.diagnosisProgress.subStepLabel && (
                        <div style={{ 
                          color: theme.text.secondary, 
                          fontSize: '0.8rem',
                          marginTop: '2px',
                        }}>
                          {testRun.diagnosisProgress.subStepLabel}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: theme.spacing.xl, flex: 1, minHeight: '260px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.md }}>
                    {DIAGNOSIS_MILESTONES.map((stage, index) => {
                      const reached = diagnosisProgress >= stage.threshold
                      const isActive = index === activeDiagnosisStageIndex && !reached
                      return (
                        <div key={stage.key} style={{ display: 'flex', gap: theme.spacing.sm }}>
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                            <div style={{
                              width: '14px',
                              height: '14px',
                              borderRadius: '50%',
                              background: reached ? theme.accent.blue : (isActive ? theme.accent.purple : theme.bg.secondary),
                              border: `2px solid ${reached ? theme.accent.blue : theme.border.subtle}`,
                              boxShadow: reached ? `0 0 12px ${theme.accent.blue}` : 'none',
                              transition: 'all 0.3s ease',
                            }} />
                            {index < DIAGNOSIS_MILESTONES.length - 1 && (
                              <div style={{
                                width: '2px',
                                flex: 1,
                                background: reached ? theme.accent.blue : theme.border.subtle,
                                marginTop: theme.spacing.xs,
                              }} />
                            )}
                          </div>
                          <div>
                            <p style={{ margin: 0, fontWeight: 600, color: reached ? theme.text.primary : theme.text.secondary }}>
                              {stage.label}
                            </p>
                            <p style={{ margin: `${theme.spacing.xs} 0 0`, fontSize: '0.8rem', color: theme.text.tertiary }}>
                              {stage.detail}
                            </p>
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  <div style={{
                    border: `1px solid ${theme.border.default}`,
                    borderRadius: theme.radius.lg,
                    padding: theme.spacing.md,
                    background: theme.bg.secondary,
                    display: 'flex',
                    flexDirection: 'column',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: theme.spacing.sm }}>
                      <h3 style={{ margin: 0, fontSize: '1rem', color: theme.text.primary }}>Live Activity</h3>
                      <span style={{ fontSize: '0.8rem', color: theme.text.tertiary }}>
                        {diagnosisEvents.length === 0 ? 'Waiting for events…' : `${diagnosisEvents.length} updates`}
                      </span>
                    </div>
                    <div style={{ flex: 1, overflowY: 'auto', paddingRight: theme.spacing.sm }}>
                      {diagnosisEvents.length === 0 ? (
                        <div style={{ color: theme.text.secondary, fontSize: '0.9rem' }}>
                          Preparing browser session and awaiting first milestone…
                        </div>
                      ) : (
                        diagnosisEvents.map((event) => (
                          <div
                            key={event.id}
                            style={{
                              padding: theme.spacing.sm,
                              borderRadius: theme.radius.md,
                              background: theme.bg.primary,
                              border: `1px solid ${theme.border.subtle}`,
                              marginBottom: theme.spacing.sm,
                            }}
                          >
                            <div style={{ fontSize: '0.75rem', color: theme.text.tertiary }}>
                              {event.timestamp}
                            </div>
                            <div style={{ fontWeight: 600, color: theme.text.primary }}>
                              {event.label}
                            </div>
                            <div style={{ fontSize: '0.85rem', color: theme.text.secondary }}>
                              {event.detail}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div style={{
              position: 'fixed',
              bottom: theme.spacing.lg,
              right: theme.spacing.lg,
              background: theme.bg.secondary,
              border: `1px solid ${theme.border.default}`,
              borderRadius: theme.radius.full,
              padding: `${theme.spacing.xs} ${theme.spacing.md}`,
              display: 'flex',
              alignItems: 'center',
              gap: theme.spacing.sm,
              boxShadow: theme.shadows.lg,
              zIndex: 900,
            }}>
              <span style={{ color: theme.text.secondary }}>Diagnosis running in background…</span>
              <div style={{ display: 'flex', gap: theme.spacing.xs }}>
                <button
                  onClick={() => setIsDiagnosisModalDismissed(false)}
                  style={{
                    background: theme.accent.blue,
                    color: theme.text.inverse,
                    border: 'none',
                    borderRadius: theme.radius.full,
                    padding: `${theme.spacing.xs} ${theme.spacing.md}`,
                    cursor: 'pointer',
                    fontWeight: 600,
                  }}
                >
                  View progress
                </button>
                <button
                  onClick={handleCancelRun}
                  disabled={isCancellingRun}
                  style={{
                    background: theme.status.error.border,
                    color: theme.text.inverse,
                    border: 'none',
                    borderRadius: theme.radius.full,
                    padding: `${theme.spacing.xs} ${theme.spacing.md}`,
                    cursor: isCancellingRun ? 'not-allowed' : 'pointer',
                    fontWeight: 600,
                  }}
                >
                  {isCancellingRun ? 'Cancelling…' : 'Cancel'}
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {isWaitingApproval && diagnosis && <DiagnosisReport diagnosis={diagnosis} testId={testId} onApprove={handleApprove} isApproving={isApproving} />}

      {!isWaitingApproval ? (
        <div>
          {/* 3-Column Layout */}
          <div style={{ 
        display: 'grid', 
        gridTemplateColumns: '300px 1fr 350px', 
        gap: theme.spacing.md, 
        flex: 1,
        overflow: 'hidden',
        marginBottom: testRun.status === 'running' ? '80px' : '0', // Space for floating action bar
      }}>
        {/* Left: Live Logs with Hover Sync */}
        <div style={{
          backgroundColor: theme.bg.secondary,
          borderRadius: theme.radius.lg,
          padding: theme.spacing.md,
          overflowY: 'auto',
          color: theme.text.primary,
          fontFamily: 'monospace',
          fontSize: '0.875rem',
          border: `1px solid ${theme.border.default}`,
        }}>
          <h3 style={{ 
            marginTop: 0, 
            marginBottom: theme.spacing.md, 
            fontSize: '1rem', 
            fontWeight: '600',
            color: theme.text.primary,
          }}>
            Live Logs
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.sm }}>
            {steps.length === 0 ? (
              <div style={{ color: theme.text.tertiary }}>
                {testRun.status === 'queued' ? 'Waiting to start...' : 'Test is starting...'}
              </div>
            ) : (
              steps.map((step) => (
                <div
                  key={step.id}
                  onMouseEnter={() => setHoveredStepId(step.id)}
                  onMouseLeave={() => setHoveredStepId(null)}
                  onClick={() => {
                    if (step.screenshotUrl) {
                      setCurrentScreenshot(step.screenshotUrl)
                    }
                  }}
                  style={{
                    padding: theme.spacing.sm,
                    backgroundColor: step.success ? theme.status.success.bg : theme.status.error.bg,
                    borderRadius: theme.radius.md,
                    borderLeft: `3px solid ${step.success ? theme.status.success.border : theme.status.error.border}`,
                    cursor: 'pointer',
                    transform: hoveredStepId === step.id ? 'scale(1.02)' : 'scale(1)',
                    transition: `all ${theme.transitions.fast}`,
                    boxShadow: hoveredStepId === step.id ? theme.shadows.md : 'none',
                  }}
                >
                  <div style={{ 
                    color: step.success ? theme.status.success.text : theme.status.error.text, 
                    fontWeight: '600',
                  }}>
                    [{new Date(step.timestamp).toLocaleTimeString()}]
                  </div>
                  <div style={{ marginTop: theme.spacing.xs, color: theme.text.secondary }}>
                    Step {step.stepNumber}: {step.action}
                    {step.target && ` → ${step.target}`}
                  </div>
                  {step.error && (
                    <div style={{ 
                      color: theme.status.error.text, 
                      marginTop: theme.spacing.xs, 
                      fontSize: '0.75rem',
                    }}>
                      Error: {step.error}
                    </div>
                  )}
                </div>
              ))
            )}
            {testRun.status === 'running' && !testRun.paused && (
              <div style={{ color: theme.text.tertiary, fontStyle: 'italic' }}>
                Running...
              </div>
            )}
            {testRun.paused && (
              <div style={{ 
                color: theme.status.paused.text, 
                fontWeight: '600',
                padding: theme.spacing.sm,
                backgroundColor: theme.status.paused.bg,
                borderRadius: theme.radius.md,
              }}>
                ⏸ PAUSED
              </div>
            )}
          </div>
        </div>

        {/* Center: Live Video Stream */}
        <div style={{
          backgroundColor: theme.bg.primary,
          borderRadius: theme.radius.lg,
          padding: theme.spacing.md,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          border: `1px solid ${theme.border.default}`,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: theme.spacing.md }}>
            <h3 style={{ 
              marginTop: 0, 
              marginBottom: 0, 
              fontSize: '1rem', 
              fontWeight: '600',
              color: theme.text.primary,
            }}>
              Live Browser View
              {testRun.status === 'running' && (
                <span style={{ 
                  fontSize: '0.875rem', 
                  color: theme.text.secondary, 
                  marginLeft: theme.spacing.sm, 
                  fontWeight: 'normal',
                }}>
                  {testRun.paused ? '⏸ Paused' : '▶ Live'}
                </span>
              )}
            </h3>
            {testRun.status === 'running' && (
              <button
                onClick={() => setShowLiveControl(!showLiveControl)}
                style={{
                  padding: `${theme.spacing.xs} ${theme.spacing.sm}`,
                  fontSize: '0.875rem',
                  backgroundColor: showLiveControl ? theme.status.info.bg : theme.bg.secondary,
                  color: showLiveControl ? theme.status.info.text : theme.text.primary,
                  border: `1px solid ${theme.border.default}`,
                  borderRadius: theme.radius.sm,
                  cursor: 'pointer',
                }}
              >
                {showLiveControl ? '✕ Close Control' : '🎮 Live Control'}
              </button>
            )}
          </div>
          {showLiveControl && testRun.status === 'running' && (
            <div style={{ marginBottom: theme.spacing.md }}>
              <LiveTestControl testRunId={testId} onClose={() => setShowLiveControl(false)} />
            </div>
          )}
          <div style={{
            flex: 1,
            backgroundColor: theme.bg.secondary,
            borderRadius: theme.radius.md,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
            overflow: 'hidden',
            border: `1px solid ${theme.border.subtle}`,
            minHeight: '400px',
          }}>
            {/* Live Stream Player (when test is running and stream is available) */}
            {testRun.status === 'running' && streamUrl ? (
              <LiveStreamPlayer
                runId={testId}
                streamUrl={streamUrl}
                livekitUrl={livekitUrl}
                livekitToken={livekitToken}
                onPause={handlePause}
                onResume={handleResume}
                onStepOverride={async (action) => {
                  try {
                    await api.injectManualAction(testId, {
                      action: action.type as any,
                      selector: action.selector,
                      value: action.value,
                      description: `Manual override: ${action.type} ${action.selector || action.value || ''}`,
                    })
                  } catch (error: any) {
                    alert(`Failed to inject action: ${error.message}`)
                  }
                }}
                onInstructionUpdate={async (instructions) => {
                  try {
                    // Update test instructions via API
                    await api.updateInstructions(testId, instructions)
                  } catch (error: any) {
                    alert(`Failed to update instructions: ${error.message}`)
                  }
                }}
                isPaused={testRun.paused || false}
                currentStep={steps.length}
                totalSteps={testRun.steps?.length || 0}
              />
            ) : completedVideoUrl ? (
              <video
                src={videoUrl || undefined}
                controls
                poster={latestScreenshot || undefined}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'contain',
                  backgroundColor: theme.bg.primary,
                }}
              >
                Your browser does not support the video tag.
              </video>
            ) : latestScreenshot ? (
              <img
                src={latestScreenshot}
                alt="Live browser view"
                style={{
                  maxWidth: '100%',
                  maxHeight: '100%',
                  objectFit: 'contain',
                }}
              />
            ) : (
              <div style={{ color: theme.text.tertiary, textAlign: 'center' }}>
                <div style={{ fontSize: '3rem', marginBottom: theme.spacing.md }}>📱</div>
                <div>Waiting for browser view...</div>
                {testRun.status === 'running' && !streamUrl && (
                  <div style={{ fontSize: '0.875rem', marginTop: theme.spacing.sm, color: theme.text.secondary }}>
                    Live streaming will start automatically...
                  </div>
                )}
              </div>
            )}
            {completedVideoUrl && (
              <div style={{
                position: 'absolute',
                bottom: theme.spacing.md,
                right: theme.spacing.md,
                backgroundColor: theme.bg.overlay,
                color: theme.text.primary,
                padding: `${theme.spacing.sm} ${theme.spacing.md}`,
                borderRadius: theme.radius.full,
                fontSize: '0.75rem',
                border: `1px solid ${theme.border.default}`,
              }}>
                ▶ Playback (recorded)
              </div>
            )}
          </div>
        </div>

        {/* Right: Steps + Errors Panel with Progressive Disclosure */}
        <div style={{
          backgroundColor: theme.bg.secondary,
          borderRadius: theme.radius.lg,
          padding: theme.spacing.md,
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          border: `1px solid ${theme.border.default}`,
        }}>
          <h3 style={{ 
            marginTop: 0, 
            marginBottom: theme.spacing.md, 
            fontSize: '1rem', 
            fontWeight: '600',
            color: theme.text.primary,
          }}>
            Steps & Errors
          </h3>
          
          {/* Progress */}
          <div style={{ 
            marginBottom: theme.spacing.md, 
            padding: theme.spacing.md, 
            backgroundColor: theme.bg.tertiary, 
            borderRadius: theme.radius.md,
            border: `1px solid ${theme.border.subtle}`,
          }}>
            <div style={{ 
              fontSize: '0.875rem', 
              color: theme.text.secondary, 
              marginBottom: theme.spacing.xs,
            }}>
              Progress: {testRun.currentStep || steps.length} / {testRun.options?.maxSteps || 10}
            </div>
            <div style={{
              width: '100%',
              height: '8px',
              backgroundColor: theme.bg.primary,
              borderRadius: theme.radius.sm,
              overflow: 'hidden',
              border: `1px solid ${theme.border.subtle}`,
            }}>
              <div style={{
                width: `${((testRun.currentStep || steps.length) / (testRun.options?.maxSteps || 10)) * 100}%`,
                height: '100%',
                backgroundColor: testRun.status === 'completed' ? theme.accent.green : theme.accent.blue,
                transition: `width ${theme.transitions.normal}`,
              }} />
            </div>
          </div>

          {/* Steps List with Progressive Disclosure */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: theme.spacing.sm }}>
            {Object.entries(stepGroups).length > 3 ? (
              // Use accordion for many steps
              Object.entries(stepGroups).map(([groupName, groupSteps]) => (
                <div key={groupName}>
                  <div
                    onClick={() => toggleGroup(groupName)}
                    style={{
                      padding: theme.spacing.sm,
                      backgroundColor: theme.bg.tertiary,
                      borderRadius: theme.radius.md,
                      cursor: 'pointer',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      border: `1px solid ${theme.border.default}`,
                      transition: `all ${theme.transitions.fast}`,
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = theme.bg.primary
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = theme.bg.tertiary
                    }}
                  >
                    <span style={{ 
                      fontSize: '0.875rem', 
                      fontWeight: '600', 
                      color: theme.text.primary,
                    }}>
                      {expandedGroups.has(groupName) ? '▼' : '▶'} {groupName} ({groupSteps.length})
                    </span>
                    <span style={{ 
                      fontSize: '0.75rem', 
                      color: theme.text.tertiary,
                    }}>
                      {groupSteps.filter(s => s.success).length}/{groupSteps.length} passed
                    </span>
                  </div>
                  {expandedGroups.has(groupName) && (
                    <div style={{ 
                      marginTop: theme.spacing.xs, 
                      display: 'flex', 
                      flexDirection: 'column', 
                      gap: theme.spacing.xs,
                    }}>
                      {groupSteps.map((step) => (
                        <div
                          key={step.id}
                          style={{
                            padding: theme.spacing.sm,
                            backgroundColor: theme.bg.tertiary,
                            borderRadius: theme.radius.md,
                            border: `1px solid ${step.success ? theme.status.success.border : theme.status.error.border}`,
                            cursor: 'pointer',
                          }}
                          onClick={() => {
                            if (step.screenshotUrl) {
                              setCurrentScreenshot(step.screenshotUrl)
                            }
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: theme.spacing.xs }}>
                            <div style={{ 
                              fontWeight: '600', 
                              fontSize: '0.875rem', 
                              color: theme.text.primary,
                            }}>
                              Step {step.stepNumber}: {step.action}
                            </div>
                            <span style={{
                              fontSize: '0.75rem',
                              color: step.success ? theme.status.success.text : theme.status.error.text,
                              fontWeight: '600',
                            }}>
                              {step.success ? '✓' : '✗'}
                            </span>
                          </div>
                          {step.target && (
                            <div style={{ fontSize: '0.75rem', color: theme.text.secondary }}>
                              → {step.target}
                            </div>
                          )}
                          {step.error && (
                            <div style={{ 
                              fontSize: '0.75rem', 
                              color: theme.status.error.text, 
                              marginTop: theme.spacing.xs,
                            }}>
                              Error: {step.error}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))
            ) : (
              // Show all steps if not many
              steps.map((step) => (
                <div
                  key={step.id}
                  style={{
                    padding: theme.spacing.sm,
                    backgroundColor: theme.bg.tertiary,
                    borderRadius: theme.radius.md,
                    border: `1px solid ${step.success ? theme.status.success.border : theme.status.error.border}`,
                    cursor: 'pointer',
                  }}
                  onClick={() => {
                    if (step.screenshotUrl) {
                      setCurrentScreenshot(step.screenshotUrl)
                    }
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: theme.spacing.xs }}>
                    <div style={{ 
                      fontWeight: '600', 
                      fontSize: '0.875rem',
                      color: theme.text.primary,
                    }}>
                      Step {step.stepNumber}: {step.action}
                    </div>
                    <span style={{
                      fontSize: '0.75rem',
                      color: step.success ? theme.status.success.text : theme.status.error.text,
                      fontWeight: '600',
                    }}>
                      {step.success ? '✓' : '✗'}
                    </span>
                  </div>
                  {step.target && (
                    <div style={{ fontSize: '0.75rem', color: theme.text.secondary }}>
                      → {step.target}
                    </div>
                  )}
                  {step.error && (
                    <div style={{ 
                      fontSize: '0.75rem', 
                      color: theme.status.error.text, 
                      marginTop: theme.spacing.xs,
                    }}>
                      Error: {step.error}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Errors Summary */}
          {errors.length > 0 && (
            <div style={{ 
              marginTop: theme.spacing.md, 
              padding: theme.spacing.md, 
              backgroundColor: theme.status.error.bg, 
              borderRadius: theme.radius.md,
              border: `1px solid ${theme.status.error.border}`,
            }}>
              <div style={{ 
                fontWeight: '600', 
                color: theme.status.error.text, 
                marginBottom: theme.spacing.sm,
              }}>
                Errors ({errors.length})
              </div>
              {errors.map((error) => (
                <div key={error.id} style={{ 
                  fontSize: '0.75rem', 
                  color: theme.status.error.text, 
                  marginBottom: theme.spacing.xs,
                }}>
                  Step {error.stepNumber}: {error.error}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      
      {/* Context-Aware Floating Action Bar */}
      {testRun.status === 'running' && (
        <div key="floating-action-bar" style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          backgroundColor: testRun.paused 
            ? theme.status.paused.border
            : theme.status.info.border,
          backdropFilter: 'blur(10px)',
          borderTop: `2px solid ${testRun.paused ? theme.status.paused.border : theme.status.info.border}`,
          padding: `${theme.spacing.md} ${theme.spacing.xl}`,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          zIndex: 100,
          transition: `all ${theme.transitions.normal}`,
          boxShadow: theme.shadows.xl,
        }}>
          {/* LEFT: Test state indicator */}
          <div style={{ display: 'flex', gap: theme.spacing.md, alignItems: 'center' }}>
            {testRun.paused ? (
              <>
                <div style={{ 
                  width: '12px', 
                  height: '12px', 
                  borderRadius: '50%', 
                  backgroundColor: '#fff',
                  animation: 'pulse 2s infinite',
                }} />
                <span style={{ 
                  fontSize: '1rem', 
                  fontWeight: '600', 
                  color: '#fff',
                }}>
                  ⏸ Test Paused - Awaiting Human Input
                </span>
              </>
            ) : (
              <>
                <div style={{ 
                  width: '12px', 
                  height: '12px', 
                  borderRadius: '50%', 
                  backgroundColor: '#fff',
                  animation: 'pulse 1s infinite',
                }} />
                <span style={{ 
                  fontSize: '1rem', 
                  fontWeight: '600', 
                  color: '#fff',
                }}>
                  ▶ Test Running - Step {testRun.currentStep || steps.length}/{testRun.options?.maxSteps || 10}
                </span>
              </>
            )}
          </div>

          {/* RIGHT: Context-aware actions */}
          <div style={{ display: 'flex', gap: theme.spacing.sm }}>
            {testRun.paused ? (
              <button
                onClick={handleResume}
                disabled={isResuming}
                style={{
                  padding: `${theme.spacing.sm} ${theme.spacing.lg}`,
                  backgroundColor: theme.accent.green,
                  color: theme.text.inverse,
                  border: 'none',
                  borderRadius: theme.radius.md,
                  cursor: isResuming ? 'not-allowed' : 'pointer',
                  fontWeight: '600',
                  fontSize: '1rem',
                  transition: `all ${theme.transitions.fast}`,
                  opacity: isResuming ? 0.7 : 1,
                }}
              >
                {isResuming ? 'Resuming...' : '▶ Resume Test'}
              </button>
            ) : (
              <button
                onClick={handlePause}
                disabled={isPausing}
                style={{
                  padding: `${theme.spacing.sm} ${theme.spacing.lg}`,
                  backgroundColor: theme.status.paused.border,
                  color: theme.text.inverse,
                  border: 'none',
                  borderRadius: theme.radius.md,
                  cursor: isPausing ? 'not-allowed' : 'pointer',
                  fontWeight: '600',
                  fontSize: '1rem',
                  transition: `all ${theme.transitions.fast}`,
                  opacity: isPausing ? 0.7 : 1,
                }}
              >
                {isPausing ? 'Pausing...' : '⏸ Pause'}
              </button>
            )}
            <button
              onClick={async () => {
                if (!confirm('Stop this test? A partial report will be generated.')) return
                setIsStopping(true)
                try {
                  const result = await api.stopTestRun(testId)
                  alert(result.message)
                  await loadData()
                  setTimeout(() => {
                    router.push(`/test/report/${testId}`)
                  }, 1000)
                } catch (error: any) {
                  alert(`Failed to stop: ${error.message}`)
                } finally {
                  setIsStopping(false)
                }
              }}
              disabled={isStopping}
              style={{
                padding: `${theme.spacing.sm} ${theme.spacing.lg}`,
                backgroundColor: theme.status.error.border,
                color: theme.text.inverse,
                border: 'none',
                borderRadius: theme.radius.md,
                cursor: isStopping ? 'not-allowed' : 'pointer',
                fontWeight: '600',
                fontSize: '1rem',
                transition: `all ${theme.transitions.fast}`,
                opacity: isStopping ? 0.7 : 1,
              }}
            >
              {isStopping ? 'Stopping...' : '⏹ Stop Test'}
            </button>
          </div>
        </div>
        )}
        </div>
      ) : null}
    </div>
  )
}

