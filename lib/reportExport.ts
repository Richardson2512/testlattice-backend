import { TestRun } from './api'

/**
 * Export report as PDF using browser's print functionality
 */
export function exportToPDF() {
  window.print()
}

/**
 * Generate shareable link for test report
 */
export function generateShareableLink(testId: string, isPublic: boolean = false): string {
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''
  return `${baseUrl}/api/tests/${testId}/report-view${isPublic ? '?public=true' : ''}`
}

/**
 * Copy shareable link to clipboard
 */
export async function copyShareLink(testId: string, isPublic: boolean = false): Promise<boolean> {
  try {
    const link = generateShareableLink(testId, isPublic)
    await navigator.clipboard.writeText(link)
    return true
  } catch (error) {
    console.error('Failed to copy link:', error)
    return false
  }
}

/**
 * Send report via webhook (Slack/Discord)
 */
export async function sendToWebhook(
  testRun: TestRun, 
  webhookUrl: string, 
  platform: 'slack' | 'discord'
): Promise<boolean> {
  try {
    const reportUrl = generateShareableLink(testRun.id, true)
    const passed = testRun.steps?.filter(s => s.success).length || 0
    const failed = testRun.steps?.filter(s => !s.success).length || 0
    const total = testRun.steps?.length || 0
    const successRate = total > 0 ? ((passed / total) * 100).toFixed(1) : '0'
    
    let payload: any
    
    if (platform === 'slack') {
      payload = {
        text: `Test Report Ready: ${testRun.build.url}`,
        blocks: [
          {
            type: 'header',
            text: {
              type: 'plain_text',
              text: testRun.status === 'completed' ? '✅ Test Run Completed' : '❌ Test Run Failed'
            }
          },
          {
            type: 'section',
            fields: [
              { type: 'mrkdwn', text: `*Test ID:*\n\`${testRun.id.substring(0, 8)}...\`` },
              { type: 'mrkdwn', text: `*Status:*\n${testRun.status.toUpperCase()}` },
              { type: 'mrkdwn', text: `*URL:*\n${testRun.build.url}` },
              { type: 'mrkdwn', text: `*Device:*\n${testRun.profile.device}` },
              { type: 'mrkdwn', text: `*Steps:*\n${passed}/${total} passed (${successRate}%)` },
              { type: 'mrkdwn', text: `*Duration:*\n${testRun.duration ? (testRun.duration / 1000).toFixed(1) + 's' : 'N/A'}` }
            ]
          },
          {
            type: 'actions',
            elements: [
              {
                type: 'button',
                text: { type: 'plain_text', text: '📊 View Full Report' },
                url: reportUrl,
                style: 'primary'
              }
            ]
          }
        ]
      }
    } else {
      // Discord
      payload = {
        embeds: [{
          title: testRun.status === 'completed' ? '✅ Test Run Completed' : '❌ Test Run Failed',
          description: `**URL:** ${testRun.build.url}\n**Device:** ${testRun.profile.device}`,
          color: testRun.status === 'completed' ? 0x10b981 : 0xef4444, // Green or Red
          fields: [
            { name: 'Test ID', value: `\`${testRun.id.substring(0, 8)}...\``, inline: true },
            { name: 'Status', value: testRun.status.toUpperCase(), inline: true },
            { name: 'Steps', value: `${passed}/${total} passed (${successRate}%)`, inline: true },
            { name: 'Duration', value: testRun.duration ? (testRun.duration / 1000).toFixed(1) + 's' : 'N/A', inline: true },
            { name: 'Report', value: `[View Full Report](${reportUrl})`, inline: false }
          ],
          timestamp: new Date().toISOString(),
          footer: {
            text: 'Rihario AI Testing Platform'
          }
        }]
      }
    }
    
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
    
    return response.ok
  } catch (error) {
    console.error('Failed to send webhook:', error)
    return false
  }
}

/**
 * Download complete test report as text file
 */
export function downloadReport(testRun: TestRun) {
  if (!testRun.steps) return
  
  const passed = testRun.steps.filter(s => s.success).length
  const failed = testRun.steps.filter(s => !s.success).length
  const successRate = testRun.steps.length > 0 
    ? ((passed / testRun.steps.length) * 100).toFixed(1) 
    : '0.0'
  
  const logContent = [
    '╔══════════════════════════════════════════════════════════════════╗',
    '║                    Rihario Test Report                       ║',
    '╚══════════════════════════════════════════════════════════════════╝',
    '',
    '📊 EXECUTIVE SUMMARY',
    '─────────────────────────────────────────────────────────────────',
    `Test ID:          ${testRun.id}`,
    `Status:           ${testRun.status.toUpperCase()}`,
    `URL Tested:       ${testRun.build.url}`,
    `Device:           ${testRun.profile.device}`,
    `Started:          ${testRun.startedAt ? new Date(testRun.startedAt).toLocaleString() : 'N/A'}`,
    `Completed:        ${testRun.completedAt ? new Date(testRun.completedAt).toLocaleString() : 'N/A'}`,
    `Duration:         ${testRun.duration ? (testRun.duration / 1000).toFixed(1) + 's' : 'N/A'}`,
    '',
    `Total Tests:      ${testRun.steps.length}`,
    `Passed:           ${passed} ✓`,
    `Failed:           ${failed} ✗`,
    `Success Rate:     ${successRate}%`,
    '',
    '📝 TEST STEPS',
    '─────────────────────────────────────────────────────────────────',
    '',
    ...testRun.steps.map(step => {
      const timestamp = new Date(step.timestamp).toLocaleTimeString()
      const status = step.success ? '✓' : '✗'
      const line = `[${timestamp}] Step ${step.stepNumber}: ${step.action}${step.target ? ` → ${step.target}` : ''} ${status}`
      
      if (step.error) {
        return line + `\n  Error: ${step.error}`
      }
      if (step.selfHealing) {
        return line + `\n  Self-healed: ${step.selfHealing.originalSelector} → ${step.selfHealing.healedSelector} (${step.selfHealing.strategy})`
      }
      return line
    }),
    '',
    '─────────────────────────────────────────────────────────────────',
    `Generated: ${new Date().toLocaleString()}`,
    'Powered by Rihario - AI Test Automation Platform',
  ].join('\n')
  
  const blob = new Blob([logContent], { type: 'text/plain; charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `Rihario-report-${testRun.id.substring(0, 8)}-${Date.now()}.txt`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

