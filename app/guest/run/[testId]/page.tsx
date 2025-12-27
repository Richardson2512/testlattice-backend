'use client'

import React, { useEffect, useState, useRef } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { api, TestRun } from '../../../../lib/api'
import LiveStreamPlayer from '../../../../components/LiveStreamPlayer'

// --- ICONS ---
const Icons = {
    Terminal: () => <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>,
    Globe: () => <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" /></svg>,
}

// --- ICONS ---
const StepIcons = {
    Thought: () => <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" opacity="0.6"><circle cx="12" cy="12" r="10" strokeWidth={2} /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 16v-4m0-4h.01" /></svg>,
    Browser: () => <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor"><rect x="3" y="3" width="18" height="18" rx="2" strokeWidth={2} /><path strokeWidth={2} d="M3 9h18" /></svg>,
    Click: () => <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" /></svg>,
    Type: () => <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>,
    Wait: () => <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor"><circle cx="12" cy="12" r="10" strokeWidth={2} /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6l4 2" /></svg>,
    Check: () => <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="#22c55e"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>,
    Error: () => <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="#ef4444"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>,
    Chevron: () => <svg width="10" height="10" fill="none" viewBox="0 0 24 24" stroke="currentColor" opacity="0.4"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>,
}

// --- STEP LOG COMPONENT (Antigravity Style) ---
const StepLog = ({ steps, status }: { steps: any[], status?: string }) => {
    const isRunning = status === 'RUNNING' || status === 'PENDING'

    const getStepIcon = (step: any) => {
        if (step.action === 'navigate') return <StepIcons.Browser />
        if (step.action === 'click') return <StepIcons.Click />
        if (step.action === 'type') return <StepIcons.Type />
        if (step.action === 'wait') return <StepIcons.Wait />
        if (step.action === 'preflight') return <StepIcons.Check />
        if (step.action === 'error') return <StepIcons.Error />
        return <StepIcons.Thought />
    }

    const getStepDescription = (step: any) => {
        if (step.action === 'navigate') {
            return `Opened URL in Browser`
        }
        if (step.action === 'click') {
            return `Clicking ${step.target || step.selector || 'element'}`
        }
        if (step.action === 'type') {
            return `Typed '${step.value || '...'}' in Browser`
        }
        if (step.action === 'preflight') {
            return 'Running preflight checks (cookies, popups)'
        }
        if (step.action === 'wait') {
            return `Wait for ${step.value || '1'}s`
        }
        return step.description || step.action
    }

    const getSubtitle = (step: any) => {
        if (step.action === 'navigate' && step.value) {
            return step.value
        }
        if (step.selector) {
            return step.selector
        }
        return null
    }

    const getDuration = (step: any, index: number, allSteps: any[]) => {
        if (index === 0) return null
        const prevStep = allSteps[index - 1]
        if (prevStep?.timestamp && step?.timestamp) {
            const diff = new Date(step.timestamp).getTime() - new Date(prevStep.timestamp).getTime()
            const seconds = Math.round(diff / 1000)
            return seconds < 1 ? '<1s' : `${seconds}s`
        }
        return '<1s'
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
            {steps.map((step, i) => (
                <React.Fragment key={i}>
                    {/* Thought indicator (timing between steps) */}
                    {i > 0 && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 8px', color: 'var(--text-muted)', fontSize: '12px' }}>
                            <StepIcons.Chevron />
                            <StepIcons.Thought />
                            <span>Thought for {getDuration(step, i, steps)}</span>
                        </div>
                    )}

                    {/* Main Step Entry */}
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '8px',
                        borderRadius: '6px',
                        background: step.success === false ? 'rgba(239, 68, 68, 0.1)' : 'transparent',
                        color: step.success === false ? '#ef4444' : 'var(--text-primary)',
                    }}>
                        <StepIcons.Chevron />
                        {getStepIcon(step)}
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            <span style={{ fontSize: '13px', fontWeight: 500 }}>{getStepDescription(step)}</span>
                            {getSubtitle(step) && (
                                <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'monospace', opacity: 0.7 }}>
                                    {getSubtitle(step)}
                                </span>
                            )}
                        </div>
                        {/* View button for clickable steps */}
                        {(step.action === 'click' || step.action === 'navigate' || step.action === 'type') && step.screenshotUrl && (
                            <button style={{
                                background: '#3b82f6',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                padding: '4px 10px',
                                fontSize: '11px',
                                fontWeight: 600,
                                cursor: 'pointer'
                            }}>View</button>
                        )}
                    </div>
                </React.Fragment>
            ))}

            {/* Initializing State */}
            {steps.length === 0 && isRunning && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px', color: 'var(--text-muted)', fontSize: '12px' }}>
                    <StepIcons.Chevron />
                    <StepIcons.Thought />
                    <span>Thought for &lt;1s</span>
                </div>
            )}

            {/* Processing State */}
            {isRunning && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px', color: 'var(--text-muted)', fontSize: '12px' }}>
                    <StepIcons.Chevron />
                    <div className="spinner" style={{ width: '14px', height: '14px', border: '2px solid var(--text-muted)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
                    <span style={{ fontStyle: 'italic' }}>Processing...</span>
                </div>
            )}
        </div>
    )
}

export default function GuestTestRunPage() {
    const params = useParams()
    const testId = params.testId as string
    const [testRun, setTestRun] = useState<TestRun | null>(null)
    const [loading, setLoading] = useState(true)
    const wsRef = useRef<WebSocket | null>(null)
    const [lastFrame, setLastFrame] = useState<string | undefined>(undefined)

    // Polling & Data Load
    useEffect(() => {
        loadData()
        const interval = setInterval(() => {
            // Retry if test run doesn't exist yet (404) or if it's in an active state
            if (!testRun || (testRun?.status && ['running', 'queued', 'diagnosing', 'pending'].includes(testRun.status))) {
                loadData()
            }
        }, 3000)
        return () => clearInterval(interval)
    }, [testId, testRun?.status])

    async function loadData() {
        try {
            const { testRun } = await api.getTestRun(testId)
            setTestRun(testRun)
            setLoading(false)

            // If we have steps but no live frame, try to use the last step's screenshot as fallback
            if (testRun?.steps && testRun.steps.length > 0 && !lastFrame) {
                const lastStepWithScreenshot = [...testRun.steps].reverse().find(s => s.screenshotUrl)
                if (lastStepWithScreenshot?.screenshotUrl) {
                    console.log('[Guest Test] Using last step screenshot as fallback:', lastStepWithScreenshot.screenshotUrl)
                    setLastFrame(lastStepWithScreenshot.screenshotUrl)
                }
            }
        } catch (e: any) {
            console.error('Load failed', e)
            // If 404, test run might not exist yet - keep loading and retry
            if (e.message?.includes('404') || e.message?.includes('not found')) {
                // Don't set loading to false yet - will retry on next interval
                console.log(`[Guest Test] Test run ${testId} not found yet, will retry...`)
            } else {
                setLoading(false)
            }
        }
    }

    // WebSocket
    useEffect(() => {
        if (!testRun || testRun.status !== 'running') return
        const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3001'
        const ws = new WebSocket(`${wsUrl}/ws/test-control?runId=${testId}`)

        ws.onopen = () => console.log('Guest Stream Connected')

        ws.onmessage = (event) => {
            try {
                const msg = JSON.parse(event.data)
                if (msg.type === 'page_state' && msg.state?.screenshot) {
                    setLastFrame(msg.state.screenshot)
                }
                if (msg.type === 'test_step' && msg.step) {
                    setTestRun(prev => prev ? ({ ...prev, steps: [...(prev.steps || []), msg.step] }) : null)
                }
            } catch (e) {
                console.error('WS Parse Error', e)
            }
        }

        wsRef.current = ws
        return () => { ws.close(); wsRef.current = null; }
    }, [testId, testRun?.status])

    // Loading State
    if (loading) return (
        <div style={{
            height: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--bg-primary)',
            fontFamily: 'var(--font-sans)'
        }}>
            <div style={{ textAlign: 'center' }}>
                <div style={{ marginBottom: '16px', fontSize: '18px', fontWeight: 500, color: 'var(--text-primary)' }}>
                    Starting Visual Test...
                </div>
                <div style={{
                    width: '40px',
                    height: '40px',
                    border: '4px solid var(--beige-200)',
                    borderTopColor: 'var(--primary)',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite',
                    margin: '0 auto'
                }} />
            </div>
        </div>
    )

    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            height: '100vh',
            background: 'var(--bg-primary)',
            fontFamily: 'var(--font-sans)',
            overflow: 'hidden'
        }}>
            {/* Header */}
            <header style={{
                height: '64px',
                borderBottom: '1px solid var(--border-light)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0 24px',
                background: 'var(--bg-card)',
                boxShadow: 'var(--shadow-sm)'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <Link href="/" style={{
                        fontWeight: 700,
                        fontSize: '20px',
                        color: 'var(--text-primary)',
                        textDecoration: 'none',
                        letterSpacing: '-0.02em'
                    }}>
                        🧪 Rihario
                    </Link>
                    <div style={{ width: '1px', height: '24px', background: 'var(--beige-300)' }} />
                    <div style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
                        Visual Check
                    </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{
                        padding: '6px 12px',
                        borderRadius: 'var(--radius-full)',
                        fontSize: '11px',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        background: testRun?.status === 'running'
                            ? 'rgba(5, 150, 105, 0.1)'
                            : testRun?.status === 'completed'
                                ? 'rgba(5, 150, 105, 0.15)'
                                : 'var(--beige-200)',
                        color: testRun?.status === 'running' || testRun?.status === 'completed'
                            ? 'var(--success)'
                            : 'var(--text-muted)'
                    }}>
                        {testRun?.status === 'running' && '● '}{testRun?.status || 'UNKNOWN'}
                    </div>
                    {testRun?.status === 'completed' && (
                        <Link href="/signup" className="btn btn-primary" style={{
                            textDecoration: 'none',
                            fontSize: '13px',
                            padding: '8px 16px'
                        }}>
                            View Full Report →
                        </Link>
                    )}
                </div>
            </header>

            {/* Main Content */}
            <div style={{ flex: 1, display: 'flex', overflow: 'hidden', padding: '24px', gap: '24px' }}>

                {/* Left: Virtual Browser */}
                <div style={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    borderRadius: 'var(--radius-lg)',
                    overflow: 'hidden',
                    boxShadow: 'var(--shadow-lg)',
                    border: '1px solid var(--border-light)',
                    background: 'var(--bg-card)'
                }}>
                    {/* Browser Chrome - Title Bar */}
                    <div style={{
                        height: '40px',
                        background: 'linear-gradient(to bottom, var(--maroon-800), var(--maroon-900))',
                        display: 'flex',
                        alignItems: 'center',
                        padding: '0 12px',
                        gap: '8px'
                    }}>
                        {/* Traffic Lights */}
                        <div style={{ display: 'flex', gap: '6px' }}>
                            <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#ff5f57' }} />
                            <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#febc2e' }} />
                            <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#28c840' }} />
                        </div>

                        {/* Address Bar */}
                        <div style={{
                            flex: 1,
                            marginLeft: '12px',
                            background: 'rgba(255,255,255,0.15)',
                            borderRadius: 'var(--radius-sm)',
                            padding: '6px 12px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px'
                        }}>
                            <Icons.Globe />
                            <span style={{
                                fontSize: '12px',
                                color: 'rgba(255,255,255,0.9)',
                                fontFamily: 'var(--font-sans)',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap'
                            }}>
                                {testRun?.build?.url || 'Loading...'}
                            </span>
                        </div>
                    </div>

                    {/* Browser Content */}
                    <div style={{
                        flex: 1,
                        background: '#000',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                    }}>
                        {(testRun?.status === 'running' || testRun?.status === 'diagnosing' || testRun?.status === 'completed') ? (
                            <LiveStreamPlayer
                                runId={testId}
                                frameData={lastFrame}
                                currentStep={testRun?.steps?.length || 0}
                                totalSteps={testRun?.steps?.length || 0}
                                style={{ width: '100%', height: '100%' }}
                                minimal={true}
                            />
                        ) : (
                            <div style={{
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                gap: '16px',
                                color: 'var(--beige-500)'
                            }}>
                                <div style={{
                                    width: '32px',
                                    height: '32px',
                                    border: '3px solid var(--beige-400)',
                                    borderTopColor: 'var(--beige-200)',
                                    borderRadius: '50%',
                                    animation: 'spin 1s linear infinite'
                                }} />
                                <div style={{ fontSize: '14px' }}>Waiting for browser...</div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Right: Live Logs */}
                <div style={{
                    width: '380px',
                    display: 'flex',
                    flexDirection: 'column',
                    borderRadius: 'var(--radius-lg)',
                    overflow: 'hidden',
                    boxShadow: 'var(--shadow-md)',
                    border: '1px solid var(--border-light)',
                    background: 'var(--bg-card)'
                }}>
                    {/* Logs Header */}
                    <div style={{
                        padding: '16px',
                        borderBottom: '1px solid var(--border-light)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        background: 'var(--beige-100)',
                        fontWeight: 700,
                        fontSize: '13px',
                        color: 'var(--text-primary)',
                        letterSpacing: '-0.01em'
                    }}>
                        <Icons.Terminal />
                        <span>EXECUTION LOG</span>
                        <span style={{
                            marginLeft: 'auto',
                            background: 'var(--beige-200)',
                            padding: '2px 8px',
                            borderRadius: 'var(--radius-full)',
                            fontSize: '11px',
                            fontWeight: 600,
                            color: 'var(--text-muted)'
                        }}>
                            {testRun?.steps?.length || 0} steps
                        </span>
                    </div>

                    {/* Logs Content */}
                    <div style={{
                        flex: 1,
                        overflowY: 'auto',
                        padding: '16px',
                        background: 'var(--bg-card)'
                    }}>
                        <StepLog steps={testRun?.steps || []} status={testRun?.status} />
                    </div>
                </div>
            </div>

            {/* CSS for spin animation */}
            <style jsx>{`
                @keyframes spin {
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    )
}

