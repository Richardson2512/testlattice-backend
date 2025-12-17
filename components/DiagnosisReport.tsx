'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { theme } from '../lib/theme'

// Types
export interface DiagnosisIssue {
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
    metadata?: Record<string, any>
}

// Helper Components
const getRiskIcon = (risk: string) => {
    const size = 16
    switch (risk) {
        case 'Critical':
            return <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" /></svg>
        case 'Major':
            return <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
        case 'Minor':
        case 'Info':
            return <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M12 16v-4" /><path d="M12 8h.01" /></svg>
        default:
            return null
    }
}

export function DiagnosisReport({ diagnosis, testId, onApprove, isApproving }: {
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

    const convertDiagnosisToIssues = useMemo((): DiagnosisIssue[] => {
        if (!diagnosis) return []
        const issues: DiagnosisIssue[] = []
        let idCounter = 1

        // Convert high risk areas
        if (diagnosis.highRiskAreas) {
            diagnosis.highRiskAreas.forEach((area: any) => {
                const riskMap: Record<string, 'Critical' | 'Major' | 'Minor' | 'Info'> = {
                    'critical': 'Critical', 'high': 'Major', 'medium': 'Minor', 'low': 'Info'
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

        // Convert comprehensive test results - Security issues
        if (diagnosis.comprehensiveTests?.security) {
            diagnosis.comprehensiveTests.security.forEach((security: any) => {
                const riskMap: Record<string, 'Critical' | 'Major' | 'Minor' | 'Info'> = {
                    'high': 'Critical', 'medium': 'Major', 'low': 'Minor'
                }
                issues.push({
                    id: idCounter++,
                    risk: riskMap[security.severity] || 'Major',
                    title: `Security: ${security.type?.toUpperCase()} - ${security.message}`,
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

        if (diagnosis.comprehensiveTests?.consoleErrors) {
            diagnosis.comprehensiveTests.consoleErrors
                .filter((err: any) => err.type === 'error' || err.type === 'warning')
                .forEach((err: any) => {
                    const riskMap: Record<string, 'Critical' | 'Major' | 'Minor' | 'Info'> = {
                        'error': 'Major', 'warning': 'Minor', 'info': 'Info'
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
                        fix: `Fix JavaScript ${err.type}`,
                        isExpanded: false
                    })
                })
        }

        // Fallback
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
        let filtered = [...convertDiagnosisToIssues]
        if (riskFilter) filtered = filtered.filter(issue => issue.risk === riskFilter)
        if (categoryFilter) filtered = filtered.filter(issue => issue.category === categoryFilter)
        if (searchTerm) {
            const term = searchTerm.toLowerCase()
            filtered = filtered.filter(issue =>
                issue.title.toLowerCase().includes(term) ||
                issue.description.toLowerCase().includes(term)
            )
        }
        filtered.forEach(item => item.isExpanded = false)
        setFilteredData(filtered)
    }, [searchTerm, riskFilter, categoryFilter, convertDiagnosisToIssues])

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
            default: return { bg: theme.bg.tertiary, color: theme.text.secondary, border: theme.border.default }
        }
    }

    // Summary Data Calculation
    const summaryData = useMemo(() => {
        const issues = convertDiagnosisToIssues
        const critical = issues.filter(i => i.risk === 'Critical').length
        const major = issues.filter(i => i.risk === 'Major').length
        const total = issues.length
        // Fake health score
        const healthScore = Math.max(0, 100 - (critical * 10) - (major * 5))
        return { healthScore, critical, major, total }
    }, [convertDiagnosisToIssues])

    return (
        <div style={{ marginBottom: theme.spacing.lg, padding: theme.spacing.lg, backgroundColor: theme.bg.primary, maxWidth: '1280px', margin: '0 auto', color: theme.text.primary }}>

            {/* Header */}
            <header style={{ marginBottom: theme.spacing.xl, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h1 style={{ fontSize: '1.875rem', fontWeight: 700, margin: 0 }}>Automated UI Diagnosis Report</h1>
                    <p style={{ color: theme.text.secondary, marginTop: '0.5rem' }}>Summary of high-risk and actionable findings.</p>
                </div>
                <button onClick={onApprove} disabled={isApproving} style={{ padding: '0.75rem 1.5rem', backgroundColor: theme.accent.blue, color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}>
                    {isApproving ? 'Starting...' : 'Approve & Start Test'}
                </button>
            </header>

            {/* Summary Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: theme.spacing.md, marginBottom: theme.spacing.xl }}>
                <div style={{ background: theme.bg.secondary, padding: '1.5rem', borderRadius: '12px' }}>
                    <div style={{ color: theme.text.secondary, fontSize: '0.9rem' }}>Health Score</div>
                    <div style={{ fontSize: '2rem', fontWeight: 700, color: summaryData.healthScore > 80 ? theme.accent.green : theme.accent.red }}>{summaryData.healthScore}%</div>
                </div>
                <div style={{ background: theme.bg.secondary, padding: '1.5rem', borderRadius: '12px' }}>
                    <div style={{ color: theme.text.secondary, fontSize: '0.9rem' }}>Critical Issues</div>
                    <div style={{ fontSize: '2rem', fontWeight: 700, color: theme.accent.red }}>{summaryData.critical}</div>
                </div>
                <div style={{ background: theme.bg.secondary, padding: '1.5rem', borderRadius: '12px' }}>
                    <div style={{ color: theme.text.secondary, fontSize: '0.9rem' }}>Major Issues</div>
                    <div style={{ fontSize: '2rem', fontWeight: 700, color: theme.accent.orange }}>{summaryData.major}</div>
                </div>
                <div style={{ background: theme.bg.secondary, padding: '1.5rem', borderRadius: '12px' }}>
                    <div style={{ color: theme.text.secondary, fontSize: '0.9rem' }}>Total Findings</div>
                    <div style={{ fontSize: '2rem', fontWeight: 700, color: theme.accent.blue }}>{summaryData.total}</div>
                </div>
            </div>

            {/* Filters */}
            <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
                <input
                    placeholder="Search issues..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    style={{ flex: 1, padding: '0.75rem', borderRadius: '8px', border: `1px solid ${theme.border.default}`, background: theme.bg.secondary, color: theme.text.primary }}
                />
                <select
                    value={riskFilter}
                    onChange={e => setRiskFilter(e.target.value)}
                    style={{ padding: '0.75rem', borderRadius: '8px', border: `1px solid ${theme.border.default}`, background: theme.bg.secondary, color: theme.text.primary }}
                >
                    <option value="">All Risks</option>
                    <option value="Critical">Critical</option>
                    <option value="Major">Major</option>
                    <option value="Minor">Minor</option>
                </select>
            </div>

            {/* Table */}
            <div style={{ background: theme.bg.secondary, borderRadius: '12px', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead style={{ background: theme.bg.tertiary, color: theme.text.secondary, fontSize: '0.8rem', textTransform: 'uppercase' }}>
                        <tr>
                            <th style={{ padding: '1rem', textAlign: 'left' }}>Risk</th>
                            <th style={{ padding: '1rem', textAlign: 'left' }}>Issue Title</th>
                            <th style={{ padding: '1rem', textAlign: 'left' }}>Category</th>
                            <th style={{ padding: '1rem', textAlign: 'left' }}>Fix</th>
                            <th style={{ padding: '1rem' }}></th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredData.map(issue => {
                            const style = getRiskClass(issue.risk)
                            return (
                                <React.Fragment key={issue.id}>
                                    <tr onClick={() => toggleDetails(issue.id)} style={{ cursor: 'pointer', borderBottom: `1px solid ${theme.border.subtle}` }}>
                                        <td style={{ padding: '1rem' }}>
                                            <span style={{ padding: '4px 8px', borderRadius: '12px', background: style.bg, color: style.color, fontSize: '0.75rem', fontWeight: 600 }}>
                                                {issue.risk}
                                            </span>
                                        </td>
                                        <td style={{ padding: '1rem', fontWeight: 600 }}>{issue.title}</td>
                                        <td style={{ padding: '1rem', color: theme.text.secondary }}>{issue.category}</td>
                                        <td style={{ padding: '1rem', color: theme.text.secondary, fontSize: '0.9rem' }}>{issue.fix}</td>
                                        <td style={{ padding: '1rem', textAlign: 'center' }}>{issue.isExpanded ? '▲' : '▼'}</td>
                                    </tr>
                                    {issue.isExpanded && (
                                        <tr style={{ background: theme.bg.tertiary }}>
                                            <td colSpan={5} style={{ padding: '1rem' }}>
                                                <div style={{ fontSize: '0.9rem', color: theme.text.secondary }}>
                                                    <strong>Description:</strong> {issue.description}<br /><br />
                                                    {issue.fixCode && (
                                                        <pre style={{ background: '#000', padding: '1rem', borderRadius: '8px', color: '#10b981', overflowX: 'auto' }}>
                                                            {issue.fixCode}
                                                        </pre>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </React.Fragment>
                            )
                        })}
                    </tbody>
                </table>
            </div>

        </div>
    )
}
