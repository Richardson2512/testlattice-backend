// Report Generator - HTML generation for test reports
// Generates both simple and detailed reports with step data

import { TestRun, TestArtifact } from '../../types'

/**
 * Get test mode label
 */
function getModeLabel(testRun: TestRun): string {
    switch (testRun.options?.testMode) {
        case 'all':
            return 'All Pages Crawl'
        case 'multi':
            return 'Multi-page Flow'
        case 'monkey':
            return 'Monkey Explorer'
        default:
            return 'Single Flow'
    }
}

/**
 * Generate status badge class
 */
function getStatusClass(testRun: TestRun): string {
    if (testRun.status === 'completed') return 'status-completed'
    if (testRun.status === 'running') return testRun.paused ? 'status-paused' : 'status-running'
    return 'status-failed'
}

/**
 * Generate report HTML (works with partial steps) - for report-view endpoint
 */
export function generateReportHtml(
    runId: string,
    testRun: TestRun,
    steps: any[],
    apiBaseUrl: string,
    artifacts: TestArtifact[] = []
): string {
    const modeLabel = getModeLabel(testRun)
    const healingSteps = steps.filter((step) => step?.selfHealing)
    const videoArtifact = artifacts.find((artifact) => artifact.type === 'video')
    const videoUrl = videoArtifact?.url || testRun.artifactsUrl || ''

    return `
<!DOCTYPE html>
<html>
<head>
  <title>Test Report - ${runId}</title>
  <style>
    body { font-family: sans-serif; margin: 2rem; background-color: #f9fafb; color: #1f2937; }
    .container { background-color: #fff; border-radius: 0.5rem; box-shadow: 0 1px 3px rgba(0,0,0,0.1); padding: 2rem; max-width: 1200px; margin: 0 auto; }
    h1 { color: #111827; font-size: 2rem; margin-bottom: 1rem; }
    h2 { color: #374151; font-size: 1.5rem; margin-top: 1.5rem; margin-bottom: 1rem; border-bottom: 1px solid #e5e7eb; padding-bottom: 0.5rem; }
    .status-badge { display: inline-block; padding: 0.25rem 0.75rem; border-radius: 9999px; font-weight: 600; font-size: 0.875rem; }
    .status-completed { background-color: #dcfce7; color: #065f46; }
    .status-running { background-color: #dbeafe; color: #1e40af; }
    .status-failed { background-color: #fee2e2; color: #991b1b; }
    .status-paused { background-color: #fef3c7; color: #92400e; }
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1.5rem; }
    .info-item strong { display: block; color: #4b5563; font-size: 0.875rem; margin-bottom: 0.25rem; }
    .info-item span { font-size: 1rem; color: #1f2937; }
    .step { background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 0.375rem; padding: 1rem; margin-bottom: 1rem; }
    .step-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem; }
    .step-header h3 { margin: 0; font-size: 1.125rem; color: #1f2937; }
    .step-status { font-weight: 600; }
    .step-details { font-size: 0.875rem; color: #4b5563; }
    .artifact-link { display: inline-block; margin-top: 0.5rem; color: #3b82f6; text-decoration: none; font-weight: 500; }
    .partial-notice { background-color: #fef3c7; border: 1px solid #fbbf24; color: #92400e; padding: 1rem; border-radius: 0.375rem; margin-bottom: 1.5rem; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Test Report for Run: ${runId.substring(0, 8)}...</h1>
    <p class="status-badge ${getStatusClass(testRun)}">
      ${testRun.status.toUpperCase()}${testRun.paused ? ' (PAUSED)' : ''}
    </p>

    ${testRun.paused || steps.length < (testRun.options?.maxSteps || 10) ? `
    <div class="partial-notice">
      <strong>⚠️ Partial Report</strong>
      <p>This report contains data up to step ${steps.length} of ${testRun.options?.maxSteps || 10} maximum steps.${testRun.paused ? ' The test is currently paused.' : ' The test may still be running.'}</p>
    </div>
    ` : ''}

    <h2>Summary</h2>
    <div class="info-grid">
      <div class="info-item">
        <strong>Project ID</strong>
        <span>${testRun.projectId.substring(0, 8)}...</span>
      </div>
      <div class="info-item">
        <strong>Build URL</strong>
        <span>${testRun.build.url || 'N/A'}</span>
      </div>
      <div class="info-item">
        <strong>Device</strong>
        <span>${testRun.profile.device}</span>
      </div>
      <div class="info-item">
        <strong>Steps Completed</strong>
        <span>${steps.length} / ${testRun.options?.maxSteps || 10}</span>
      </div>
      <div class="info-item">
        <strong>Test Mode</strong>
        <span>${modeLabel}</span>
      </div>
      <div class="info-item">
        <strong>Started At</strong>
        <span>${testRun.startedAt ? new Date(testRun.startedAt).toLocaleString() : 'N/A'}</span>
      </div>
    </div>

    ${healingSteps.length ? `
    <h2>Self-Healing Suggestions (${healingSteps.length})</h2>
    <ul>
      ${healingSteps.map(step => `
        <li style="margin-bottom:0.5rem;">
          <strong>Step ${step.stepNumber}:</strong>
          Replaced <code>${step.selfHealing?.originalSelector || 'unknown'}</code> with
          <code>${step.selfHealing?.healedSelector}</code> (${step.selfHealing?.strategy} match).
          ${step.selfHealing?.note ? `<span>${step.selfHealing.note}</span>` : ''}
        </li>
      `).join('')}
    </ul>
    ` : ''}

    <h2>Full Video Recording</h2>
    ${videoUrl ? `
      <div style="background-color:#111827;border-radius:0.5rem;padding:1rem;margin-bottom:1.5rem;">
        <video controls style="width:100%;max-height:480px;background:#000;border-radius:0.5rem;" src="${videoUrl}">
          Your browser does not support the video tag.
        </video>
      </div>
    ` : `
      <div style="padding:1rem;border-radius:0.5rem;background-color:#fef3c7;border:1px solid #fcd34d;color:#92400e;margin-bottom:1.5rem;">
        Recording not available. The worker may still be processing the video or the upload failed.
      </div>
    `}

    <h2>Test Steps (${steps.length})</h2>
    ${steps.length === 0 ? '<p>No steps completed yet.</p>' : steps.map((step) => `
    <div class="step">
      <div class="step-header">
        <h3>Step ${step.stepNumber}: ${step.action}${step.target ? ` → ${step.target}` : ''}</h3>
        <span class="step-status ${step.success ? 'status-completed' : 'status-failed'}">
          ${step.success ? '✓ SUCCESS' : '✗ FAILED'}
        </span>
      </div>
      <div class="step-details">
        ${step.value ? `<p><strong>Value:</strong> ${step.value}</p>` : ''}
        <p><strong>Timestamp:</strong> ${new Date(step.timestamp).toLocaleString()}</p>
        ${step.error ? `<p style="color: #991b1b;"><strong>Error:</strong> ${step.error}</p>` : ''}
        ${step.screenshotUrl ? `<a href="${step.screenshotUrl}" target="_blank" class="artifact-link">View Screenshot →</a>` : ''}
      </div>
    </div>
    `).join('')}

    <h2>Statistics</h2>
    <div class="info-grid">
      <div class="info-item">
        <strong>Total Steps</strong>
        <span>${steps.length}</span>
      </div>
      <div class="info-item">
        <strong>Successful Steps</strong>
        <span>${steps.filter(s => s.success).length}</span>
      </div>
      <div class="info-item">
        <strong>Success Rate</strong>
        <span>${steps.length > 0 ? ((steps.filter(s => s.success).length / steps.length) * 100).toFixed(1) : 0}%</span>
      </div>
    </div>
  </div>
</body>
</html>
  `
}

/**
 * Generate detailed report HTML with issues, warnings, and recommendations
 */
export function generateDetailedReportHtml(
    runId: string,
    testRun: TestRun,
    steps: any[],
    issues: string[],
    warnings: string[],
    recommendations: string[],
    artifacts: TestArtifact[] = []
): string {
    const modeLabel = getModeLabel(testRun)
    const healingSteps = steps.filter(step => step?.selfHealing)
    const videoArtifact = artifacts.find((artifact) => artifact.type === 'video')
    const videoUrl = videoArtifact?.url || testRun.artifactsUrl || ''

    return `
<!DOCTYPE html>
<html>
<head>
  <title>Detailed Test Report - ${runId}</title>
  <style>
    body { font-family: sans-serif; margin: 2rem; background-color: #f9fafb; color: #1f2937; }
    .container { background-color: #fff; border-radius: 0.5rem; box-shadow: 0 1px 3px rgba(0,0,0,0.1); padding: 2rem; max-width: 1200px; margin: 0 auto; }
    h1 { color: #111827; font-size: 2rem; margin-bottom: 1rem; }
    h2 { color: #374151; font-size: 1.5rem; margin-top: 1.5rem; margin-bottom: 1rem; border-bottom: 1px solid #e5e7eb; padding-bottom: 0.5rem; }
    .status-badge { display: inline-block; padding: 0.25rem 0.75rem; border-radius: 9999px; font-weight: 600; font-size: 0.875rem; }
    .status-completed { background-color: #dcfce7; color: #065f46; }
    .status-failed { background-color: #fee2e2; color: #991b1b; }
    .issue { background-color: #fee2e2; border-left: 4px solid #ef4444; padding: 0.75rem; margin-bottom: 0.5rem; border-radius: 0.25rem; color: #991b1b; }
    .warning { background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 0.75rem; margin-bottom: 0.5rem; border-radius: 0.25rem; color: #92400e; }
    .recommendation { background-color: #dbeafe; border-left: 4px solid #3b82f6; padding: 0.75rem; margin-bottom: 0.5rem; border-radius: 0.25rem; color: #1e40af; }
    ul { list-style: none; padding: 0; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Detailed Test Report: ${runId.substring(0, 8)}...</h1>
    <p class="status-badge ${getStatusClass(testRun)}">
      ${testRun.status.toUpperCase()}${testRun.paused ? ' (PAUSED)' : ''}
    </p>

    <h2>Summary</h2>
    <p>Build URL: ${testRun.build?.url || 'N/A'} | Mode: ${modeLabel} | Steps: ${steps.length}</p>

    ${issues.length > 0 ? `
    <h2>Issues Detected (${issues.length})</h2>
    <ul>${issues.map(issue => `<li class="issue">⚠️ ${issue}</li>`).join('')}</ul>
    ` : ''}

    ${warnings.length > 0 ? `
    <h2>Warnings (${warnings.length})</h2>
    <ul>${warnings.map(warning => `<li class="warning">⚠️ ${warning}</li>`).join('')}</ul>
    ` : ''}

    ${recommendations.length > 0 ? `
    <h2>Recommendations (${recommendations.length})</h2>
    <ul>${recommendations.map(rec => `<li class="recommendation">💡 ${rec}</li>`).join('')}</ul>
    ` : ''}

    ${healingSteps.length ? `
    <h2>Self-Healing Applied (${healingSteps.length})</h2>
    <ul>${healingSteps.map(step => `
      <li class="recommendation">Step ${step.stepNumber}: ${step.selfHealing?.originalSelector} → ${step.selfHealing?.healedSelector}</li>
    `).join('')}</ul>
    ` : ''}

    <h2>Statistics</h2>
    <p>Total: ${steps.length} | Success: ${steps.filter(s => s.success).length} | Failed: ${steps.filter(s => !s.success).length} | Rate: ${steps.length > 0 ? ((steps.filter(s => s.success).length / steps.length) * 100).toFixed(1) : 0}%</p>
  </div>
</body>
</html>
  `
}
