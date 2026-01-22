/**
 * FindingsRecorder
 * Accumulates findings during test execution
 * Non-blocking: no finding stops test execution
 */

import { Finding, FindingSeverity, FindingsReport } from './types'

export class FindingsRecorder {
    private runId: string
    private url: string
    private findings: Finding[] = []

    constructor(runId: string, url: string) {
        this.runId = runId
        this.url = url
    }

    record(
        type: string,
        severity: FindingSeverity,
        message: string,
        details?: string,
        selector?: string,
        screenshotUrl?: string
    ): Finding {
        const finding: Finding = {
            id: Math.random().toString(36).substring(7),
            type,
            severity,
            message,
            details,
            selector,
            screenshotUrl,
            timestamp: new Date().toISOString(),
            blocking: false // Never blocks per product spec
        }
        this.findings.push(finding)
        return finding
    }

    recordCritical(type: string, message: string, details?: string): Finding {
        return this.record(type, 'critical', message, details)
    }

    recordMajor(type: string, message: string, details?: string): Finding {
        return this.record(type, 'major', message, details)
    }

    recordMinor(type: string, message: string, details?: string): Finding {
        return this.record(type, 'minor', message, details)
    }

    recordInfo(type: string, message: string, details?: string): Finding {
        return this.record(type, 'info', message, details)
    }

    getFindings(): Finding[] {
        return [...this.findings]
    }

    getCounts(): { critical: number; major: number; minor: number; info: number } {
        return {
            critical: this.findings.filter(f => f.severity === 'critical').length,
            major: this.findings.filter(f => f.severity === 'major').length,
            minor: this.findings.filter(f => f.severity === 'minor').length,
            info: this.findings.filter(f => f.severity === 'info').length
        }
    }

    generateReport(): FindingsReport {
        const counts = this.getCounts()
        return {
            runId: this.runId,
            url: this.url,
            totalFindings: this.findings.length,
            ...counts,
            findings: this.getFindings(),
            generatedAt: new Date().toISOString()
        }
    }

    clear(): void {
        this.findings = []
    }
}
