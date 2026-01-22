/**
 * Shared Finding Types
 * Used across all processors for consistent result recording
 */

export type FindingSeverity = 'critical' | 'major' | 'minor' | 'info'

export interface Finding {
    id: string
    type: string
    severity: FindingSeverity
    message: string
    details?: string
    selector?: string
    screenshotUrl?: string
    timestamp: string
    blocking: boolean // Always false per product spec
}

export interface FindingsReport {
    runId: string
    url: string
    totalFindings: number
    critical: number
    major: number
    minor: number
    info: number
    findings: Finding[]
    generatedAt: string
}
