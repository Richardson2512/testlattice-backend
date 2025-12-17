'use client'

import { useEffect, useState, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { api, TestRun, TestArtifact } from '../../../../lib/api'
import Link from 'next/link'
import { IronManHUD } from '../../../../components/IronManHUD'
import { TraceViewer } from '../../../../components/TraceViewer'
import { theme } from '../../../../lib/theme'
import { KeyboardShortcuts } from '../../../../components/KeyboardShortcuts'
import { ErrorBoundary, TestRunErrorFallback } from '../../../../components/ErrorBoundary'
import VideoPlayer from '../../../../components/VideoPlayer'
import VirtualDisplay from '../../../../components/VirtualDisplay'
import { VisualDiff } from '../../../../components/VisualDiff'

export default function TestReportPage() {
  const params = useParams()
  const router = useRouter()
  const testId = params.testId as string
  const [testRun, setTestRun] = useState<TestRun | null>(null)
  const [artifacts, setArtifacts] = useState<TestArtifact[]>([])
  const [loading, setLoading] = useState(true)
  const [aiInsights, setAiInsights] = useState<any>(null)
  const [showAllElements, setShowAllElements] = useState(false)
  const [screenshotFilter, setScreenshotFilter] = useState<'all' | 'errors' | 'interactions' | 'pages'>('all')
  const [activeTab, setActiveTab] = useState<'insights' | 'video' | 'steps' | 'logs' | 'replay'>('insights')
  const [selectedStep, setSelectedStep] = useState<number | undefined>(undefined)
  const [baselineScreenshots, setBaselineScreenshots] = useState<Map<number, string>>(new Map())

  useEffect(() => {
    loadData()
  }, [testId])

  async function loadData() {
    try {
      const response = await api.getTestRun(testId)
      setTestRun(response.testRun)
      setArtifacts(response.artifacts)
      
      // Generate AI insights from steps
      if (response.testRun.steps) {
        generateAIInsights(response.testRun.steps)
        
        // Load baseline screenshots for visual diff steps
        const baselinePromises = response.testRun.steps
          .filter(step => step.visualDiff?.baselineRunId)
          .map(async (step) => {
            try {
              const baselineData = await api.getBaselineScreenshot(
                step.visualDiff!.baselineRunId!,
                step.stepNumber
              )
              setBaselineScreenshots(prev => new Map(prev).set(step.stepNumber, baselineData.screenshotUrl))
            } catch (error) {
              console.warn(`Failed to load baseline for step ${step.stepNumber}:`, error)
            }
          })
        
        await Promise.all(baselinePromises)
      }
    } catch (error) {
      console.error('Failed to load test run:', error)
    } finally {
      setLoading(false)
    }
  }

  function generateAIInsights(steps: any[]) {
    // Analyze steps to generate insights
    const errors = steps.filter(s => !s.success)
    const issues: string[] = []
    const warnings: string[] = []

    // Check for errors
    if (errors.length > 0) {
      issues.push(`${errors.length} step(s) failed during execution`)
      errors.forEach(error => {
        if (error.error) {
          issues.push(`Step ${error.stepNumber}: ${error.error}`)
        }
      })
    }

    // Check for navigation issues
    const navigationSteps = steps.filter(s => s.action === 'navigate')
    if (navigationSteps.length === 0 && steps.length > 0) {
      warnings.push('No navigation steps detected - test may not have started properly')
    }

    // Check for interaction issues
    const interactionSteps = steps.filter(s => ['click', 'type'].includes(s.action))
    if (interactionSteps.length === 0 && steps.length > 3) {
      warnings.push('Limited user interactions detected - test may be incomplete')
    }

    // Check for visual issues (placeholder - would use AI in production)
    if (steps.length < (testRun?.options?.maxSteps || 10)) {
      warnings.push('Test completed with fewer steps than expected - may indicate early termination')
    }

    setAiInsights({
      issues,
      warnings,
      recommendations: [
        ...(errors.length > 0 ? ['Review failed steps and fix underlying issues'] : []),
        ...(steps.length < 5 ? ['Consider adding more test steps for better coverage'] : []),
        'Review screenshots to verify visual correctness',
        'Check console logs for JavaScript errors',
      ],
    })
  }

  const steps = testRun?.steps || []

  // Smart filtering for screenshots (must run every render to keep hook order stable)
  const filteredSteps = useMemo(() => {
    const stepsWithScreenshots = steps.filter(s => s.screenshotUrl)
    switch (screenshotFilter) {
      case 'errors':
        return stepsWithScreenshots.filter(s => !s.success)
      case 'interactions':
        return stepsWithScreenshots.filter(s => ['click', 'type', 'scroll'].includes(s.action))
      case 'pages':
        return stepsWithScreenshots.filter(s => s.action === 'navigate')
      default:
        return stepsWithScreenshots
    }
  }, [steps, screenshotFilter])

  if (loading) {
    return <div style={{ padding: '2rem', textAlign: 'center' }}>Loading...</div>
  }

  if (!testRun) {
    return <div style={{ padding: '2rem', textAlign: 'center' }}>Test run not found</div>
  }

  const videoArtifact = artifacts.find(a => a.type === 'video')
  const traceArtifact = artifacts.find(a => a.type === 'trace')
  const videoUrl = videoArtifact?.url || testRun.artifactsUrl || ''
  // FALLBACK: Check artifact first, then test run, then empty
  // Filter out invalid local: paths
  const rawTraceUrl = traceArtifact?.url || testRun.traceUrl || ''
  const traceUrl = rawTraceUrl && !rawTraceUrl.startsWith('local:') && (rawTraceUrl.startsWith('http://') || rawTraceUrl.startsWith('https://'))
    ? rawTraceUrl
    : ''

  // Action buttons component (reusable)
  const ActionButtons = () => (
    <div style={{ display: 'flex', gap: theme.spacing.sm }}>
      <button
        onClick={() => router.push(`/test/run/${testId}`)}
        style={{
          padding: `${theme.spacing.xs} ${theme.spacing.md}`,
          backgroundColor: theme.accent.blue,
          color: theme.text.inverse,
          border: 'none',
          borderRadius: theme.radius.md,
          cursor: 'pointer',
          fontSize: '0.875rem',
          fontWeight: '500',
          transition: `all ${theme.transitions.fast}`,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'translateY(-2px)'
          e.currentTarget.style.boxShadow = theme.shadows.md
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'translateY(0)'
          e.currentTarget.style.boxShadow = 'none'
        }}
      >
        🔄 Re-run Test
      </button>
      <button
        onClick={async (event) => {
          const button = event.currentTarget as HTMLButtonElement
          const originalText = button.textContent
          button.disabled = true
          if (button.textContent) button.textContent = 'Downloading...'
          button.style.opacity = '0.6'
          button.style.cursor = 'not-allowed'
          
          try {
            await api.downloadReport(testId)
          } catch (error: any) {
            alert(`Failed to download report: ${error.message}`)
          } finally {
            button.disabled = false
            if (button.textContent) button.textContent = originalText || '📥 Download Report'
            button.style.opacity = '1'
            button.style.cursor = 'pointer'
          }
        }}
        style={{
          padding: `${theme.spacing.xs} ${theme.spacing.md}`,
          backgroundColor: theme.accent.green,
          color: theme.text.inverse,
          border: 'none',
          borderRadius: theme.radius.md,
          cursor: 'pointer',
          fontSize: '0.875rem',
          fontWeight: '500',
          transition: `all ${theme.transitions.fast}`,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'translateY(-2px)'
          e.currentTarget.style.boxShadow = theme.shadows.md
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'translateY(0)'
          e.currentTarget.style.boxShadow = 'none'
        }}
      >
        📥 Download Report
      </button>
    </div>
  )

  return (
    <ErrorBoundary fallback={<TestRunErrorFallback />}>
      <div style={{
        padding: theme.spacing.xl,
        maxWidth: '1400px',
        margin: '0 auto',
        backgroundColor: theme.bg.primary,
        minHeight: '100vh',
        color: theme.text.primary,
      }}>
      <KeyboardShortcuts />
      
      <div style={{ marginBottom: theme.spacing.xl }}>
        <Link
          href="/dashboard"
          style={{
            color: theme.accent.blue,
            textDecoration: 'none',
            marginBottom: theme.spacing.md,
            display: 'inline-block',
          }}
        >
          ← Back to Dashboard
        </Link>
      </div>

      <h1 style={{ 
        fontSize: '2rem', 
        fontWeight: 'bold', 
        marginBottom: theme.spacing.xl,
        color: theme.text.primary,
      }}>
        Test Report: {testId.substring(0, 8)}...
      </h1>

      {/* Test Summary */}
      <div style={{
        backgroundColor: theme.bg.secondary,
        borderRadius: theme.radius.lg,
        padding: theme.spacing.xl,
        marginBottom: theme.spacing.xl,
        border: `1px solid ${theme.border.default}`,
      }}>
        <h2 style={{ 
          fontSize: '1.5rem', 
          fontWeight: '600', 
          marginBottom: theme.spacing.md,
          color: theme.text.primary,
        }}>Test Summary</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: theme.spacing.md }}>
          <div>
            <div style={{ 
              fontSize: '0.875rem', 
              color: theme.text.secondary, 
              marginBottom: theme.spacing.xs,
            }}>Status</div>
            <div style={{
              display: 'inline-block',
              padding: `${theme.spacing.xs} ${theme.spacing.sm}`,
              borderRadius: theme.radius.md,
              fontSize: '0.875rem',
              fontWeight: '600',
              backgroundColor: testRun.status === 'completed' 
                ? theme.status.success.bg 
                : testRun.status === 'failed' 
                  ? theme.status.error.bg 
                  : theme.status.info.bg,
              color: testRun.status === 'completed' 
                ? theme.status.success.text 
                : testRun.status === 'failed' 
                  ? theme.status.error.text 
                  : theme.status.info.text,
              border: `1px solid ${
                testRun.status === 'completed' 
                  ? theme.status.success.border 
                  : testRun.status === 'failed' 
                    ? theme.status.error.border 
                    : theme.status.info.border
              }`,
            }}>
              {testRun.status.toUpperCase()}
              {testRun.paused && ' (PARTIAL)'}
            </div>
          </div>
          <div>
            <div style={{ 
              fontSize: '0.875rem', 
              color: theme.text.secondary, 
              marginBottom: theme.spacing.xs,
            }}>Total Steps</div>
            <div style={{ 
              fontSize: '1.25rem', 
              fontWeight: '600',
              color: theme.text.primary,
            }}>{steps.length}</div>
          </div>
          <div>
            <div style={{ 
              fontSize: '0.875rem', 
              color: theme.text.secondary, 
              marginBottom: theme.spacing.xs,
            }}>Successful Steps</div>
            <div style={{ 
              fontSize: '1.25rem', 
              fontWeight: '600', 
              color: theme.accent.green,
            }}>
              {steps.filter(s => s.success).length}
            </div>
          </div>
          <div>
            <div style={{ 
              fontSize: '0.875rem', 
              color: theme.text.secondary, 
              marginBottom: theme.spacing.xs,
            }}>Failed Steps</div>
            <div style={{ 
              fontSize: '1.25rem', 
              fontWeight: '600', 
              color: theme.accent.red,
            }}>
              {steps.filter(s => !s.success).length}
            </div>
          </div>
          <div>
            <div style={{ 
              fontSize: '0.875rem', 
              color: theme.text.secondary, 
              marginBottom: theme.spacing.xs,
            }}>Pages Tested</div>
            <div style={{ 
              fontSize: '1.25rem', 
              fontWeight: '600',
              color: theme.text.primary,
            }}>
              {new Set(steps.filter(s => s.action === 'navigate').map(s => s.value)).size || 1}
            </div>
          </div>
          {testRun.duration && (
            <div>
              <div style={{ 
                fontSize: '0.875rem', 
                color: theme.text.secondary, 
                marginBottom: theme.spacing.xs,
              }}>Duration</div>
              <div style={{ 
                fontSize: '1.25rem', 
                fontWeight: '600',
                color: theme.text.primary,
              }}>
                {(testRun.duration / 1000).toFixed(1)}s
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Tab Navigation */}
      <div style={{
        display: 'flex',
        gap: theme.spacing.sm,
        marginBottom: theme.spacing.xl,
        borderBottom: `2px solid ${theme.border.default}`,
        paddingBottom: theme.spacing.sm,
      }}>
        <button
          onClick={() => setActiveTab('insights')}
          style={{
            padding: `${theme.spacing.sm} ${theme.spacing.lg}`,
            backgroundColor: activeTab === 'insights' ? theme.accent.blue : 'transparent',
            color: activeTab === 'insights' ? theme.text.inverse : theme.text.secondary,
            border: 'none',
            borderRadius: `${theme.radius.md} ${theme.radius.md} 0 0`,
            cursor: 'pointer',
            fontSize: '0.875rem',
            fontWeight: '500',
            transition: `all ${theme.transitions.fast}`,
            borderBottom: activeTab === 'insights' ? `2px solid ${theme.accent.blue}` : '2px solid transparent',
            marginBottom: activeTab === 'insights' ? '-2px' : '0',
          }}
        >
          🤖 AI Insights
        </button>
        <button
          onClick={() => setActiveTab('video')}
          style={{
            padding: `${theme.spacing.sm} ${theme.spacing.lg}`,
            backgroundColor: activeTab === 'video' ? theme.accent.blue : 'transparent',
            color: activeTab === 'video' ? theme.text.inverse : theme.text.secondary,
            border: 'none',
            borderRadius: `${theme.radius.md} ${theme.radius.md} 0 0`,
            cursor: 'pointer',
            fontSize: '0.875rem',
            fontWeight: '500',
            transition: `all ${theme.transitions.fast}`,
            borderBottom: activeTab === 'video' ? `2px solid ${theme.accent.blue}` : '2px solid transparent',
            marginBottom: activeTab === 'video' ? '-2px' : '0',
          }}
        >
          📹 Video Recording
        </button>
        <button
          onClick={() => setActiveTab('steps')}
          style={{
            padding: `${theme.spacing.sm} ${theme.spacing.lg}`,
            backgroundColor: activeTab === 'steps' ? theme.accent.blue : 'transparent',
            color: activeTab === 'steps' ? theme.text.inverse : theme.text.secondary,
            border: 'none',
            borderRadius: `${theme.radius.md} ${theme.radius.md} 0 0`,
            cursor: 'pointer',
            fontSize: '0.875rem',
            fontWeight: '500',
            transition: `all ${theme.transitions.fast}`,
            borderBottom: activeTab === 'steps' ? `2px solid ${theme.accent.blue}` : '2px solid transparent',
            marginBottom: activeTab === 'steps' ? '-2px' : '0',
          }}
        >
          🎯 Visual Test Steps
        </button>
        <button
          onClick={() => setActiveTab('logs')}
          style={{
            padding: `${theme.spacing.sm} ${theme.spacing.lg}`,
            backgroundColor: activeTab === 'logs' ? theme.accent.blue : 'transparent',
            color: activeTab === 'logs' ? theme.text.inverse : theme.text.secondary,
            border: 'none',
            borderRadius: `${theme.radius.md} ${theme.radius.md} 0 0`,
            cursor: 'pointer',
            fontSize: '0.875rem',
            fontWeight: '500',
            transition: `all ${theme.transitions.fast}`,
            borderBottom: activeTab === 'logs' ? `2px solid ${theme.accent.blue}` : '2px solid transparent',
            marginBottom: activeTab === 'logs' ? '-2px' : '0',
          }}
        >
          📋 Test Logs
        </button>
        <button
          onClick={() => setActiveTab('replay')}
          style={{
            padding: `${theme.spacing.sm} ${theme.spacing.lg}`,
            backgroundColor: activeTab === 'replay' ? theme.accent.blue : 'transparent',
            color: activeTab === 'replay' ? theme.text.inverse : theme.text.secondary,
            border: 'none',
            borderRadius: `${theme.radius.md} ${theme.radius.md} 0 0`,
            cursor: 'pointer',
            fontSize: '0.875rem',
            fontWeight: '500',
            transition: `all ${theme.transitions.fast}`,
            borderBottom: activeTab === 'replay' ? `2px solid ${theme.accent.blue}` : '2px solid transparent',
            marginBottom: activeTab === 'replay' ? '-2px' : '0',
          }}
        >
          ▶️ Step Replay
        </button>
      </div>

      {/* Tab Content Container */}
      <div style={{
        backgroundColor: theme.bg.secondary,
        borderRadius: theme.radius.lg,
        padding: theme.spacing.xl,
        border: `1px solid ${theme.border.default}`,
        minHeight: '400px',
      }}>
        {/* Action Buttons - Always Visible */}
        <div style={{
          display: 'flex',
          justifyContent: 'flex-end',
          gap: theme.spacing.sm,
          marginBottom: theme.spacing.xl,
          paddingBottom: theme.spacing.md,
          borderBottom: `1px solid ${theme.border.default}`,
        }}>
          <ActionButtons />
        </div>

        {/* AI Insights Tab */}
        {activeTab === 'insights' && (
          <div>
            <h2 style={{ 
              fontSize: '1.5rem', 
              fontWeight: '600', 
              marginBottom: theme.spacing.md,
              color: theme.text.primary,
            }}>🤖 AI Insights</h2>
        
        {aiInsights ? (
          <>
          {aiInsights.issues.length > 0 && (
            <div style={{ marginBottom: theme.spacing.md }}>
              <h3 style={{ 
                fontSize: '1rem', 
                fontWeight: '600', 
                color: theme.status.error.text, 
                marginBottom: theme.spacing.sm,
              }}>
                Issues Detected
              </h3>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {aiInsights.issues.map((issue: string, idx: number) => (
                  <li key={idx} style={{
                    padding: theme.spacing.sm,
                    backgroundColor: theme.status.error.bg,
                    borderRadius: theme.radius.md,
                    marginBottom: theme.spacing.xs,
                    color: theme.status.error.text,
                    border: `1px solid ${theme.status.error.border}`,
                  }}>
                    ⚠️ {issue}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {aiInsights.warnings.length > 0 && (
            <div style={{ marginBottom: theme.spacing.md }}>
              <h3 style={{ 
                fontSize: '1rem', 
                fontWeight: '600', 
                color: theme.status.warning.text, 
                marginBottom: theme.spacing.sm,
              }}>
                Warnings
              </h3>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {aiInsights.warnings.map((warning: string, idx: number) => (
                  <li key={idx} style={{
                    padding: theme.spacing.sm,
                    backgroundColor: theme.status.warning.bg,
                    borderRadius: theme.radius.md,
                    marginBottom: theme.spacing.xs,
                    color: theme.status.warning.text,
                    border: `1px solid ${theme.status.warning.border}`,
                  }}>
                    ⚠️ {warning}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {aiInsights.recommendations.length > 0 && (
            <div>
              <h3 style={{ 
                fontSize: '1rem', 
                fontWeight: '600', 
                color: theme.status.info.text, 
                marginBottom: theme.spacing.sm,
              }}>
                Recommendations
              </h3>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {aiInsights.recommendations.map((rec: string, idx: number) => (
                  <li key={idx} style={{
                    padding: theme.spacing.sm,
                    backgroundColor: theme.status.info.bg,
                    borderRadius: theme.radius.md,
                    marginBottom: theme.spacing.xs,
                    color: theme.status.info.text,
                    border: `1px solid ${theme.status.info.border}`,
                  }}>
                    💡 {rec}
                  </li>
                ))}
              </ul>
            </div>
          )}
          </>
        ) : (
          <div style={{ 
            padding: theme.spacing.xl, 
            textAlign: 'center', 
            color: theme.text.tertiary 
          }}>
            <div style={{ fontSize: '2rem', marginBottom: theme.spacing.sm }}>🤖</div>
            <p>AI insights are being generated...</p>
          </div>
        )}
          </div>
        )}

        {/* Video Recording Tab */}
        {activeTab === 'video' && (
          <div>
            <h2 style={{ 
              fontSize: '1.5rem', 
              fontWeight: '600', 
              marginBottom: theme.spacing.md,
              color: theme.text.primary,
            }}>📹 Full Video Recording</h2>
            
            {videoUrl ? (
          <>
            <VideoPlayer 
              videoUrl={videoUrl} 
              title={`Test Run ${testId.substring(0, 8)}`} 
            />
            {!videoArtifact && testRun.artifactsUrl && (
              <div style={{ 
                padding: theme.spacing.sm, 
                fontSize: '0.875rem', 
                color: theme.text.secondary,
                marginTop: theme.spacing.sm,
              }}>
                Video is coming directly from the latest artifacts URL.
              </div>
            )}
            
            {/* Time-Travel Debugger (Playwright Trace) */}
            {traceUrl && (
              <div style={{ marginTop: theme.spacing.lg }}>
                <h3 style={{ 
                  fontSize: '1.25rem', 
                  fontWeight: '600', 
                  marginBottom: theme.spacing.md,
                  color: theme.text.primary,
                }}>⏱️ Time-Travel Debugger</h3>
                <TraceViewer traceUrl={traceUrl} />
              </div>
            )}
          </>
        ) : (
          <div style={{ 
            padding: theme.spacing.xl, 
            textAlign: 'center', 
            color: theme.text.tertiary,
            backgroundColor: theme.bg.tertiary,
            borderRadius: theme.radius.md,
            border: `1px solid ${theme.border.default}`,
          }}>
            <div style={{ fontSize: '2rem', marginBottom: theme.spacing.sm }}>📹</div>
            <p>Video recording is not available for this test run.</p>
          </div>
        )}
          </div>
        )}

        {/* Visual Test Steps Tab */}
        {activeTab === 'steps' && (
          <div>
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center', 
              marginBottom: theme.spacing.md,
              flexWrap: 'wrap',
              gap: theme.spacing.md,
            }}>
              <h2 style={{ 
                fontSize: '1.5rem', 
                fontWeight: '600', 
                margin: 0,
                color: theme.text.primary,
              }}>
                🎯 Visual Test Steps ({filteredSteps.length})
              </h2>
              <label style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: theme.spacing.sm, 
                fontSize: '0.875rem', 
                color: theme.text.secondary, 
                cursor: 'pointer',
              }}>
                <input
                  type="checkbox"
                  checked={showAllElements}
                  onChange={(e) => setShowAllElements(e.target.checked)}
                  style={{ cursor: 'pointer' }}
                />
                Show all elements (Iron Man mode)
              </label>
            </div>
          
          {/* Filter Pills */}
          <div style={{
            display: 'flex',
            gap: theme.spacing.sm,
            marginBottom: theme.spacing.md,
            flexWrap: 'wrap',
          }}>
            {(['all', 'errors', 'interactions', 'pages'] as const).map((filter) => (
              <button
                key={filter}
                onClick={() => setScreenshotFilter(filter)}
                style={{
                  padding: `${theme.spacing.xs} ${theme.spacing.md}`,
                  borderRadius: theme.radius.full,
                  border: `1px solid ${screenshotFilter === filter ? theme.accent.blue : theme.border.default}`,
                  backgroundColor: screenshotFilter === filter ? theme.accent.blueSubtle : theme.bg.tertiary,
                  color: screenshotFilter === filter ? theme.accent.blue : theme.text.secondary,
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  cursor: 'pointer',
                  transition: `all ${theme.transitions.fast}`,
                }}
                onMouseEnter={(e) => {
                  if (screenshotFilter !== filter) {
                    e.currentTarget.style.borderColor = theme.border.emphasis
                  }
                }}
                onMouseLeave={(e) => {
                  if (screenshotFilter !== filter) {
                    e.currentTarget.style.borderColor = theme.border.default
                  }
                }}
              >
                {filter === 'all' && `All (${steps.filter(s => s.screenshotUrl).length})`}
                {filter === 'errors' && `Errors Only (${steps.filter(s => s.screenshotUrl && !s.success).length})`}
                {filter === 'interactions' && `Interactions (${steps.filter(s => s.screenshotUrl && ['click', 'type', 'scroll'].includes(s.action)).length})`}
                {filter === 'pages' && `Page Loads (${steps.filter(s => s.screenshotUrl && s.action === 'navigate').length})`}
              </button>
            ))}
          </div>
          
          <p style={{ 
            fontSize: '0.875rem', 
            color: theme.text.secondary, 
            marginBottom: theme.spacing.md,
          }}>
            Interactive visual annotations show exactly what the AI analyzed and interacted with. 
            Green = clicked, Blue = typed, Purple = self-healed, Yellow = analyzed, Red = failed.
          </p>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(600px, 1fr))',
            gap: theme.spacing.xl,
          }}>
            {filteredSteps.map((step, idx) => (
              <div key={idx} style={{
                border: `2px solid ${theme.border.default}`,
                borderRadius: theme.radius.lg,
                overflow: 'hidden',
                backgroundColor: theme.bg.tertiary,
              }}>
                <div style={{
                  padding: theme.spacing.sm,
                  borderBottom: `1px solid ${theme.border.default}`,
                  backgroundColor: step.success ? theme.status.success.bg : theme.status.error.bg,
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{
                      fontSize: '0.875rem',
                      fontWeight: '600',
                      color: step.success ? theme.status.success.text : theme.status.error.text,
                    }}>
                      {step.success ? '✓' : '✗'} Step {step.stepNumber}
                    </span>
                    <span style={{
                      fontSize: '0.75rem',
                      padding: `${theme.spacing.xs} ${theme.spacing.sm}`,
                      borderRadius: theme.radius.full,
                      backgroundColor: step.mode === 'speculative' 
                        ? theme.accent.blueSubtle 
                        : step.mode === 'monkey' 
                          ? theme.accent.yellowSubtle 
                          : theme.bg.primary,
                      color: step.mode === 'speculative' 
                        ? theme.accent.blue 
                        : step.mode === 'monkey' 
                          ? theme.accent.yellow 
                          : theme.text.secondary,
                      border: `1px solid ${
                        step.mode === 'speculative' 
                          ? theme.accent.blue 
                          : step.mode === 'monkey' 
                            ? theme.accent.yellow 
                            : theme.border.default
                      }`,
                    }}>
                      {step.mode === 'speculative' ? '⚡ Speculative' : step.mode === 'monkey' ? '🐵 Monkey' : '🤖 LLM'}
                    </span>
                  </div>
                  <div style={{ 
                    fontSize: '0.875rem', 
                    color: theme.text.primary, 
                    marginTop: theme.spacing.xs,
                  }}>
                    <strong>{step.action}</strong> {step.target && `→ ${step.target}`}
                  </div>
                  {step.selfHealing && (
                    <div style={{
                      fontSize: '0.75rem',
                      color: theme.accent.purple,
                      marginTop: theme.spacing.xs,
                      padding: `${theme.spacing.xs} ${theme.spacing.sm}`,
                      backgroundColor: theme.accent.purpleSubtle,
                      borderRadius: theme.radius.md,
                      border: `1px solid ${theme.accent.purple}`,
                    }}>
                      🔧 Self-healed: {step.selfHealing.strategy}
                    </div>
                  )}
                </div>
                <div style={{ 
                  position: 'relative',
                  width: '100%',
                  paddingBottom: '56.25%', // 16:9 aspect ratio (landscape)
                  backgroundColor: theme.bg.primary,
                  overflow: 'hidden',
                }}>
                  {step.elementBounds || step.targetElementBounds ? (
                    <div style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                      <div style={{
                        width: '100%',
                        height: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}>
                        <IronManHUD
                          screenshotUrl={step.screenshotUrl!}
                          elementBounds={step.elementBounds}
                          targetElementBounds={step.targetElementBounds}
                          showAll={showAllElements}
                          className="w-full h-full"
                        />
                      </div>
                    </div>
                  ) : (
                    <img
                      src={step.screenshotUrl!}
                      alt={`Screenshot ${step.stepNumber}`}
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: '100%',
                        objectFit: 'contain',
                        display: 'block',
                      }}
                    />
                  )}
                </div>
                {step.error && (
                  <div style={{
                    padding: theme.spacing.sm,
                    backgroundColor: theme.status.error.bg,
                    borderTop: `1px solid ${theme.status.error.border}`,
                    fontSize: '0.75rem',
                    color: theme.status.error.text,
                    fontFamily: 'monospace',
                    whiteSpace: 'pre-wrap',
                  }}>
                    {step.error}
                  </div>
                )}
                
                {/* Visual Diff Display */}
                {step.visualDiff && (
                  <div style={{
                    marginTop: theme.spacing.md,
                    padding: theme.spacing.md,
                    backgroundColor: theme.bg.secondary,
                    borderRadius: theme.radius.md,
                    border: `1px solid ${theme.border.default}`,
                  }}>
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: theme.spacing.sm,
                    }}>
                      <h4 style={{
                        fontSize: '0.875rem',
                        fontWeight: '600',
                        color: theme.text.primary,
                        margin: 0,
                      }}>
                        🔍 Visual Regression Comparison
                      </h4>
                      <span style={{
                        fontSize: '0.75rem',
                        padding: `${theme.spacing.xs} ${theme.spacing.sm}`,
                        borderRadius: theme.radius.full,
                        backgroundColor: step.visualDiff.hasDifference 
                          ? (step.visualDiff.diffPercentage > (step.visualDiff.threshold || 1.0) 
                              ? theme.status.error.bg 
                              : theme.status.warning.bg)
                          : theme.status.success.bg,
                        color: step.visualDiff.hasDifference 
                          ? (step.visualDiff.diffPercentage > (step.visualDiff.threshold || 1.0) 
                              ? theme.status.error.text 
                              : theme.status.warning.text)
                          : theme.status.success.text,
                        fontWeight: '600',
                      }}>
                        {step.visualDiff.diffPercentage.toFixed(2)}% difference
                      </span>
                    </div>
                    {baselineScreenshots.has(step.stepNumber) ? (
                      <VisualDiff
                        baselineUrl={baselineScreenshots.get(step.stepNumber)!}
                        currentUrl={step.screenshotUrl || ''}
                        diffUrl={step.visualDiff.diffImageUrl}
                        diffPercentage={step.visualDiff.diffPercentage}
                        mismatchedPixels={Math.round((step.visualDiff.diffPercentage / 100) * 1920 * 1080)}
                        totalPixels={1920 * 1080}
                        onApproveBaseline={async () => {
                          try {
                            await api.approveBaseline(testId, step.stepNumber)
                            alert('Baseline approved successfully! This run will now be used as the baseline for future comparisons.')
                            await loadData()
                          } catch (error: any) {
                            alert(`Failed to approve baseline: ${error.message}`)
                          }
                        }}
                      />
                    ) : (
                      <div style={{
                        padding: theme.spacing.md,
                        backgroundColor: theme.bg.tertiary,
                        borderRadius: theme.radius.md,
                        color: theme.text.secondary,
                        fontSize: '0.875rem',
                      }}>
                        {step.visualDiff.baselineRunId 
                          ? 'Loading baseline screenshot...'
                          : 'No baseline available. This will become the baseline for future comparisons.'}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
          
          {filteredSteps.length === 0 && (
            <div style={{
              padding: theme.spacing['2xl'],
              textAlign: 'center',
              color: theme.text.tertiary,
            }}>
              <div style={{ fontSize: '3rem', marginBottom: theme.spacing.md }}>🔍</div>
              <p>No steps match the selected filter</p>
            </div>
          )}
          </div>
        )}

        {/* Test Logs Tab */}
        {activeTab === 'logs' && (
          <div>
            <h2 style={{ 
              fontSize: '1.5rem', 
              fontWeight: '600', 
              marginBottom: theme.spacing.md,
              color: theme.text.primary,
            }}>📋 Test Logs</h2>
            <div style={{
              backgroundColor: theme.bg.tertiary,
              borderRadius: theme.radius.md,
              padding: theme.spacing.md,
              fontFamily: 'monospace',
              fontSize: '0.875rem',
              color: theme.text.primary,
              maxHeight: '400px',
              overflowY: 'auto',
              border: `1px solid ${theme.border.default}`,
            }}>
              {steps.length === 0 ? (
                <div style={{ color: theme.text.tertiary }}>No logs available</div>
              ) : (
                steps.map((step) => (
                  <div
                    key={step.id}
                    style={{
                      marginBottom: theme.spacing.sm,
                      padding: theme.spacing.sm,
                      backgroundColor: step.success ? theme.status.success.bg : theme.status.error.bg,
                      borderRadius: theme.radius.md,
                      borderLeft: `3px solid ${step.success ? theme.status.success.border : theme.status.error.border}`,
                    }}
                  >
                    <div style={{ 
                      color: step.success ? theme.status.success.text : theme.status.error.text,
                    }}>
                      [{new Date(step.timestamp).toLocaleString()}]
                    </div>
                    <div style={{ marginTop: theme.spacing.xs, color: theme.text.primary }}>
                      Step {step.stepNumber}: {step.action}
                      {step.target && ` → ${step.target}`}
                      {step.value && ` (${step.value})`}
                    </div>
                    {step.error && (
                      <div style={{ 
                        color: theme.status.error.text, 
                        marginTop: theme.spacing.xs,
                      }}>
                        ERROR: {step.error}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Step Replay Tab */}
        {activeTab === 'replay' && (
          <div>
            <h2 style={{ 
              fontSize: '1.5rem', 
              fontWeight: '600', 
              marginBottom: theme.spacing.md,
              color: theme.text.primary,
            }}>▶️ Step-by-Step Replay</h2>
            {steps.length > 0 ? (
              <VirtualDisplay 
                steps={steps.map(s => ({
                  id: s.id,
                  stepNumber: s.stepNumber,
                  action: s.action,
                  target: s.target,
                  value: s.value,
                  timestamp: s.timestamp,
                  screenshotUrl: s.screenshotUrl,
                  success: s.success,
                }))} 
                currentStep={selectedStep}
              />
            ) : (
              <div style={{ 
                padding: theme.spacing.xl, 
                textAlign: 'center', 
                color: theme.text.tertiary,
                backgroundColor: theme.bg.tertiary,
                borderRadius: theme.radius.md,
                border: `1px solid ${theme.border.default}`,
              }}>
                <div style={{ fontSize: '2rem', marginBottom: theme.spacing.sm }}>▶️</div>
                <p>No steps available for replay.</p>
              </div>
            )}
          </div>
        )}

        {/* Visual Diff Section - Show when visualDiff option is enabled */}
        {testRun?.options?.visualDiff && (
          <div style={{ marginTop: theme.spacing.xl }}>
            <h2 style={{ 
              fontSize: '1.5rem', 
              fontWeight: '600', 
              marginBottom: theme.spacing.md,
              color: theme.text.primary,
            }}>🔍 Visual Regression Comparison</h2>
            <div style={{
              padding: theme.spacing.md,
              backgroundColor: theme.bg.tertiary,
              borderRadius: theme.radius.md,
              border: `1px solid ${theme.border.default}`,
            }}>
              {steps.filter(s => s.visualDiff).length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.lg }}>
                  {steps
                    .filter(s => s.visualDiff)
                    .map((step) => {
                      const visualDiff = step.visualDiff!
                      // Estimate pixel counts (would need actual image dimensions for precise calculation)
                      const estimatedTotalPixels = 1920 * 1080 // Assume standard screenshot size
                      const mismatchedPixels = Math.round((visualDiff.diffPercentage / 100) * estimatedTotalPixels)
                      
                      return (
                        <div key={step.id} style={{
                          border: `1px solid ${theme.border.default}`,
                          borderRadius: theme.radius.md,
                          padding: theme.spacing.md,
                          backgroundColor: theme.bg.primary,
                        }}>
                          <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            marginBottom: theme.spacing.md,
                          }}>
                            <h3 style={{
                              fontSize: '1rem',
                              fontWeight: '600',
                              color: theme.text.primary,
                              margin: 0,
                            }}>
                              Step {step.stepNumber}: {step.action}
                            </h3>
                            <span style={{
                              fontSize: '0.75rem',
                              padding: `${theme.spacing.xs} ${theme.spacing.sm}`,
                              borderRadius: theme.radius.full,
                              backgroundColor: visualDiff.hasDifference 
                                ? (visualDiff.diffPercentage > (visualDiff.threshold || 1.0) 
                                    ? theme.status.error.bg 
                                    : theme.status.warning.bg)
                                : theme.status.success.bg,
                              color: visualDiff.hasDifference 
                                ? (visualDiff.diffPercentage > (visualDiff.threshold || 1.0) 
                                    ? theme.status.error.text 
                                    : theme.status.warning.text)
                                : theme.status.success.text,
                              fontWeight: '600',
                            }}>
                              {visualDiff.diffPercentage.toFixed(2)}% difference
                            </span>
                          </div>
                          <VisualDiff
                            baselineUrl={step.screenshotUrl || ''} // Will need to fetch actual baseline
                            currentUrl={step.screenshotUrl || ''}
                            diffUrl={visualDiff.diffImageUrl}
                            diffPercentage={visualDiff.diffPercentage}
                            mismatchedPixels={mismatchedPixels}
                            totalPixels={estimatedTotalPixels}
                            onApproveBaseline={async () => {
                              try {
                                await api.approveBaseline(testId, step.stepNumber)
                                alert('Baseline approved successfully!')
                                await loadData()
                              } catch (error: any) {
                                alert(`Failed to approve baseline: ${error.message}`)
                              }
                            }}
                          />
                        </div>
                      )
                    })}
                </div>
              ) : (
                <p style={{ color: theme.text.secondary, marginBottom: theme.spacing.md }}>
                  Visual diff feature is enabled. Baseline comparison will be available once baseline screenshots are stored.
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
    </ErrorBoundary>
  )
}

