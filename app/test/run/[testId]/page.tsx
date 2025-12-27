'use client'

import React, { useEffect, useState, useRef, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { api, TestRun, TestArtifact } from '../../../../lib/api'
import LiveStreamPlayer from '../../../../components/LiveStreamPlayer'
import { DiagnosisReport } from '@/components/DiagnosisReport'
import { filterStepsByBrowser, getBrowserDisplayName, aggregateBrowserRuns, type BrowserType } from '../../../../lib/browserResults'

// --- ICONS ---
const Icons = {
  Play: () => <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  Pause: () => <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  Stop: () => <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" /></svg>,
  Terminal: () => <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>,
  Eye: () => <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>,
  Code: () => <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg>
}

// --- COMPONENTS ---

const TestStepLog = ({ steps, showBrowserBadges = false }: { steps: any[], showBrowserBadges?: boolean }) => {
  const getStepBrowser = (step: any) => step.browser || step.environment?.browser

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}>
      {steps.map((step, i) => {
        const stepBrowser = getStepBrowser(step)
        const browserLabel = showBrowserBadges && stepBrowser ? `[${getBrowserDisplayName(stepBrowser)}]` : ''

        return (
          <div key={step.id || i} style={{
            display: 'flex', gap: '0.5rem', padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-sm)',
            background: step.success === false ? 'rgba(220, 38, 38, 0.08)' : 'transparent',
            borderLeft: `3px solid ${step.success === false ? 'var(--error)' : step.success === true ? 'var(--success)' : 'var(--beige-300)'}`
          }}>
            <div style={{ color: 'var(--text-muted)', minWidth: '20px', fontWeight: 600 }}>{i + 1}</div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                <div style={{ color: step.success === false ? 'var(--error)' : 'var(--text-primary)', fontWeight: 500 }}>{step.action}</div>
                {browserLabel && (
                  <span style={{
                    padding: '2px 6px',
                    borderRadius: '4px',
                    fontSize: '0.65rem',
                    fontWeight: 600,
                    background: 'rgba(59, 130, 246, 0.2)',
                    color: '#3b82f6',
                  }}>
                    {browserLabel}
                  </span>
                )}
              </div>
              {step.selector && <div style={{ color: 'var(--text-muted)', fontSize: '0.7rem', marginTop: '2px' }}>{step.selector}</div>}
              {step.value && <div style={{ color: 'var(--info)', fontSize: '0.7rem' }}>"{step.value}"</div>}
            </div>
            <div style={{ color: step.success ? 'var(--success)' : (step.success === false ? 'var(--error)' : 'var(--text-muted)') }}>
              {step.success ? '✓' : (step.success === false ? '✗' : '•')}
            </div>
          </div>
        )
      })}
      {steps.length === 0 && <div style={{ color: 'var(--text-muted)', fontStyle: 'italic', padding: '1rem' }}>Waiting for test to start...</div>}
    </div>
  )
}

export default function TestRunPage() {
  const params = useParams()
  const testId = params.testId as string
  const [testRun, setTestRun] = useState<TestRun | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'inspector' | 'console' | 'network'>('inspector')
  const [selectedBrowser, setSelectedBrowser] = useState<BrowserType | 'all'>('all')
  const wsRef = useRef<WebSocket | null>(null)

  // Aggregate browser results for multi-browser tests
  const aggregated = useMemo(() => {
    if (!testRun) return null
    return aggregateBrowserRuns(testRun)
  }, [testRun])

  const isMultiBrowser = aggregated && aggregated.selectedBrowsers.length > 1

  // Polling & Data Load
  useEffect(() => {
    loadData()
    const interval = setInterval(() => {
      if (testRun?.status === 'running' || testRun?.status === 'queued' || testRun?.status === 'diagnosing') {
        loadData()
      }
    }, 1000)
    return () => clearInterval(interval)
  }, [testId, testRun?.status])

  async function loadData() {
    try {
      const { testRun } = await api.getTestRun(testId)
      setTestRun(testRun)
    } catch (e) { console.error('Load failed', e); }
    finally { setLoading(false) }
  }

  // WebSocket
  useEffect(() => {
    if (!testRun || testRun.status !== 'running') return
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3001'
    const ws = new WebSocket(`${wsUrl}/ws/test-control?runId=${testId}`)
    ws.onopen = () => console.log('Test Run Connected')
    wsRef.current = ws
    return () => { ws.close(); wsRef.current = null; }
  }, [testId, testRun?.status])

  // Handlers
  const handleStop = async () => { if (confirm('Stop this test run?')) { await api.stopTestRun(testId); loadData(); } }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'var(--success)'
      case 'failed': return 'var(--error)'
      case 'running': return 'var(--info)'
      case 'queued': return 'var(--warning)'
      default: return 'var(--text-muted)'
    }
  }

  const getStatusBg = (status: string) => {
    switch (status) {
      case 'completed': return 'rgba(5, 150, 105, 0.1)'
      case 'failed': return 'rgba(220, 38, 38, 0.1)'
      case 'running': return 'rgba(37, 99, 235, 0.1)'
      case 'queued': return 'rgba(217, 119, 6, 0.1)'
      default: return 'var(--beige-100)'
    }
  }

  // Loading
  if (loading) return (
    <div style={{ background: 'var(--bg-primary)', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-primary)' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>◈</div>
        Loading Test Run...
      </div>
    </div>
  )

  // Show Diagnosis Report if in diagnosing state
  if (testRun?.status === 'diagnosing' || testRun?.status === 'waiting_approval') {
    return (
      <div style={{ background: 'var(--bg-primary)', minHeight: '100vh' }}>
        <DiagnosisReport
          diagnosis={testRun.diagnosis}
          testId={testId}
          onApprove={async () => { await api.approveTestRun(testId); loadData(); }}
          isApproving={false}
        />
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontFamily: 'var(--font-sans)', overflow: 'hidden' }}>

      {/* Header */}
      <header style={{
        height: '56px',
        borderBottom: '1px solid var(--border-light)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 1.25rem',
        background: 'var(--bg-card)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <Link href="/dashboard" style={{
            color: 'var(--primary)',
            textDecoration: 'none',
            fontSize: '0.9rem',
            fontWeight: 500,
            display: 'flex',
            alignItems: 'center',
            gap: '0.25rem',
          }}>
            ← Back
          </Link>
          <div style={{ width: '1px', height: '20px', background: 'var(--border-medium)' }} />
          <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>Test Run #{testId.slice(0, 8)}</div>
          <span style={{
            padding: '4px 12px',
            borderRadius: 'var(--radius-full)',
            fontSize: '0.75rem',
            fontWeight: 600,
            textTransform: 'uppercase',
            background: getStatusBg(testRun?.status || ''),
            color: getStatusColor(testRun?.status || ''),
          }}>
            {testRun?.status}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {testRun?.status === 'running' && (
            <>
              <button
                onClick={handleStop}
                style={{
                  background: 'var(--error)',
                  border: 'none',
                  padding: '6px 14px',
                  borderRadius: 'var(--radius-md)',
                  color: 'white',
                  cursor: 'pointer',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                }}
              >
                <Icons.Stop /> Stop Test
              </button>
            </>
          )}
        </div>
      </header>

      {/* Main Body */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* Left Panel: Step Logs */}
        <aside style={{
          width: '280px',
          borderRight: '1px solid var(--border-light)',
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--bg-card)',
        }}>
          <div style={{
            padding: '0.875rem 1rem',
            borderBottom: '1px solid var(--border-light)',
            fontSize: '0.8rem',
            fontWeight: 600,
            color: 'var(--text-secondary)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}>
            <Icons.Terminal /> Execution Log
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '0.75rem' }}>
            <TestStepLog
              steps={
                (selectedBrowser === 'all'
                  ? (testRun?.steps || [])
                  : filterStepsByBrowser(testRun?.steps || [], selectedBrowser)) || []
              }
              showBrowserBadges={!!(isMultiBrowser && selectedBrowser === 'all')}
            />
          </div>
        </aside>

        {/* Center Panel: Live Stream */}
        <main style={{
          flex: 1,
          background: 'var(--beige-900)',
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
        }}>
          {/* Virtual Browser Frame */}
          <div style={{
            background: 'linear-gradient(180deg, var(--beige-800) 0%, var(--beige-900) 100%)',
            padding: '0.5rem 1rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            borderBottom: '1px solid rgba(255,255,255,0.1)',
          }}>
            {/* Traffic Lights */}
            <div style={{ display: 'flex', gap: '6px' }}>
              <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#ff5f57' }} />
              <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#ffbd2e' }} />
              <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#28ca42' }} />
            </div>
            {/* URL Bar */}
            <div style={{
              flex: 1,
              background: 'rgba(255,255,255,0.1)',
              borderRadius: 'var(--radius-sm)',
              padding: '0.35rem 0.75rem',
              fontSize: '0.75rem',
              color: 'rgba(255,255,255,0.7)',
              fontFamily: 'var(--font-mono)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
              {testRun?.build?.url || 'about:blank'}
            </div>
            {/* LIVE Badge */}
            {testRun?.status === 'running' && (
              <div style={{
                background: 'var(--error)',
                color: 'white',
                padding: '2px 8px',
                borderRadius: 'var(--radius-sm)',
                fontSize: '0.65rem',
                fontWeight: 700,
                letterSpacing: '0.05em',
              }}>
                LIVE
              </div>
            )}
          </div>

          {/* Stream Content */}
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {testRun?.status === 'running' ? (
              <LiveStreamPlayer
                runId={testId}
                streamUrl={`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/tests/${testId}/stream`}
                onPause={() => api.pauseTestRun(testId)}
                onResume={() => api.resumeTestRun(testId)}
                isPaused={testRun.paused}
                currentStep={testRun.steps?.length || 0}
                style={{ width: '100%', height: '100%' }}
              />
            ) : (
              <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.6)' }}>
                <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>
                  {testRun?.status === 'completed' ? '✅' : testRun?.status === 'failed' ? '❌' : '🏁'}
                </div>
                <div style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '0.5rem' }}>
                  Test {testRun?.status === 'completed' ? 'Completed' : testRun?.status === 'failed' ? 'Failed' : 'Finished'}
                </div>
                {testRun?.steps && testRun.steps.length > 0 && testRun.steps[testRun.steps.length - 1].screenshotUrl && (
                  <img
                    src={testRun.steps[testRun.steps.length - 1].screenshotUrl!}
                    alt="Last state"
                    style={{ maxWidth: '50%', marginTop: '1.5rem', borderRadius: 'var(--radius-md)', border: '1px solid rgba(255,255,255,0.2)' }}
                  />
                )}
              </div>
            )}
          </div>
        </main>

        {/* Right Panel: Inspector */}
        <aside style={{
          width: '280px',
          borderLeft: '1px solid var(--border-light)',
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--bg-card)',
        }}>
          <div style={{ display: 'flex', borderBottom: '1px solid var(--border-light)' }}>
            <button
              onClick={() => setActiveTab('inspector')}
              style={{
                flex: 1,
                padding: '0.875rem',
                background: activeTab === 'inspector' ? 'var(--bg-primary)' : 'transparent',
                border: 'none',
                color: activeTab === 'inspector' ? 'var(--text-primary)' : 'var(--text-muted)',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: 'pointer',
                borderBottom: activeTab === 'inspector' ? '2px solid var(--primary)' : '2px solid transparent',
              }}
            >
              Inspector
            </button>
            <button
              onClick={() => setActiveTab('console')}
              style={{
                flex: 1,
                padding: '0.875rem',
                background: activeTab === 'console' ? 'var(--bg-primary)' : 'transparent',
                border: 'none',
                color: activeTab === 'console' ? 'var(--text-primary)' : 'var(--text-muted)',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: 'pointer',
                borderBottom: activeTab === 'console' ? '2px solid var(--primary)' : '2px solid transparent',
              }}
            >
              Console
            </button>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '1rem' }}>
            {activeTab === 'inspector' && (
              <div style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                <div style={{ marginBottom: '1.25rem' }}>
                  <div style={{ color: 'var(--text-muted)', marginBottom: '0.25rem', fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: 600 }}>Target URL</div>
                  <div style={{ wordBreak: 'break-all', fontSize: '0.8rem' }}>{testRun?.build?.url}</div>
                </div>
                <div style={{ marginBottom: '1.25rem' }}>
                  <div style={{ color: 'var(--text-muted)', marginBottom: '0.25rem', fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: 600 }}>Device</div>
                  <div style={{ fontSize: '0.85rem' }}>{testRun?.profile?.device || 'Desktop Chrome'}</div>
                </div>
                <div style={{ marginBottom: '1.25rem' }}>
                  <div style={{ color: 'var(--text-muted)', marginBottom: '0.25rem', fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: 600 }}>Steps Executed</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 700 }}>{testRun?.steps?.length || 0}</div>
                </div>
                <div style={{
                  padding: '1rem',
                  background: 'var(--beige-100)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px dashed var(--border-medium)',
                  textAlign: 'center',
                  color: 'var(--text-muted)',
                  fontSize: '0.8rem',
                }}>
                  Element inspection coming soon
                </div>
              </div>
            )}
            {activeTab === 'console' && (
              <div style={{ fontSize: '0.8rem', fontFamily: 'var(--font-mono)' }}>
                <div style={{ color: 'var(--text-muted)' }}>// Console logs will appear here</div>
              </div>
            )}
          </div>
        </aside>

      </div>

      {/* Footer Status Bar */}
      <footer style={{
        height: '28px',
        background: 'var(--primary)',
        color: 'var(--text-inverse)',
        fontSize: '0.7rem',
        display: 'flex',
        alignItems: 'center',
        padding: '0 1rem',
        justifyContent: 'space-between',
        fontWeight: 500,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <span>◈ Rihario</span>
          <span style={{ opacity: 0.7 }}>|</span>
          <span>Run ID: {testId.slice(0, 12)}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <span>WS: {wsRef.current ? '● Connected' : '○ Disconnected'}</span>
        </div>
      </footer>

    </div>
  )
}
