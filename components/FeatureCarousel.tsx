'use client'

import React, { useState, useEffect } from 'react'
import { theme } from '@/lib/theme'

interface FeatureSlide {
    id: string
    title: string
    status: string
    icon: string
    color: string
    content: React.ReactNode
}

const features: FeatureSlide[] = [
    {
        id: 'healing',
        title: 'Self-Healing Engine',
        status: 'Active',
        icon: '🛡️',
        color: '#10b981', // green
        content: (
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem', display: 'flex', flexDirection: 'column', height: '100%' }}>
                <div style={{ color: 'var(--text-muted)', marginBottom: '0.5rem' }}>$ npx testlattice run</div>
                <div style={{ color: 'var(--success)', marginBottom: '0.25rem' }}>✓ Initializing AI Agent...</div>

                {/* Standard Steps */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: '0.5rem 0', padding: '0.75rem', background: 'rgba(16, 185, 129, 0.1)', borderRadius: '6px', borderLeft: '3px solid var(--success)' }}>
                    <span style={{ color: 'var(--success)' }}>✔</span>
                    <span>Login Flow Verified (1.2s)</span>
                </div>

                {/* Error & Healing Block */}
                <div style={{ marginTop: '1rem', padding: '1rem', background: 'rgba(239, 68, 68, 0.05)', borderRadius: '8px', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                    <div style={{ color: '#ef4444', marginBottom: '0.5rem' }}>⚠ ElementNotInteractable: #submit-btn</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: theme.accent.primary }}>
                        <span style={{ width: '8px', height: '8px', background: 'currentColor', borderRadius: '50%', display: 'inline-block' }} className="animate-pulse" />
                        AI Analysis: "Button ID changed to #btn-submit-v2"
                    </div>
                    <div style={{ marginTop: '0.5rem', paddingLeft: '1rem', borderLeft: '2px solid #ef4444', color: 'var(--text-muted)' }}>
                        <div>→ Scan DOM tree...</div>
                        <div>→ Match text "Submit"...</div>
                        <div>→ Re-target & Click</div>
                    </div>
                </div>

                <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem', background: 'rgba(16, 185, 129, 0.1)', borderRadius: '6px', borderLeft: '3px solid var(--success)' }}>
                    <span style={{ color: 'var(--success)' }}>✔</span>
                    <span>Test Completed (Self-Healed)</span>
                </div>
            </div>
        )
    },
    {
        id: 'browser',
        title: 'Live Browser Control',
        status: 'Connected',
        icon: '🌐',
        color: '#3b82f6', // blue
        content: (
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem', display: 'flex', flexDirection: 'column', height: '100%' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem', borderBottom: `1px solid ${theme.border.subtle}`, paddingBottom: '0.5rem' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Session ID: 8f2-a9c</span>
                    <span style={{ color: '#3b82f6' }}>● Live (God Mode)</span>
                </div>

                {/* Mock Page Content */}
                <div style={{ background: theme.bg.tertiary, borderRadius: '6px', padding: '1.5rem', border: `1px solid ${theme.border.subtle}`, flex: 1, position: 'relative' }}>
                    <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
                        <div style={{ height: '32px', width: '32px', background: '#e2e8f0', borderRadius: '50%' }} />
                        <div style={{ height: '12px', width: '40%', background: '#e2e8f0', borderRadius: '4px', marginTop: '10px' }} />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                        <div style={{ height: '80px', background: '#fff', borderRadius: '4px', border: '1px solid #e2e8f0' }} />
                        <div style={{ height: '80px', background: '#fff', borderRadius: '4px', border: '1px solid #e2e8f0' }} />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'center' }}>
                        <div style={{ padding: '0.5rem 2rem', background: '#3b82f6', color: '#fff', borderRadius: '6px', fontSize: '0.8rem', boxShadow: '0 4px 6px -1px rgba(59, 130, 246, 0.4)' }}>
                            Confirm Action
                        </div>
                    </div>
                    {/* Cursor Overlay */}
                    <div style={{ position: 'absolute', bottom: '40%', right: '40%', fontSize: '1.5rem', color: theme.text.primary, transform: 'translate(50%, 50%)', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))' }}>
                        👆
                        <div style={{ position: 'absolute', top: '100%', left: '50%', background: '#1e293b', color: '#fff', padding: '0.25rem 0.5rem', borderRadius: '4px', fontSize: '0.7rem', whiteSpace: 'nowrap' }}>
                            Richard (Admin)
                        </div>
                    </div>
                </div>

                {/* Mock DevTools / Console */}
                <div style={{ marginTop: '1rem', height: '120px', background: '#1e293b', borderRadius: '6px', color: '#94a3b8', fontSize: '0.75rem', padding: '0.75rem', overflow: 'hidden' }}>
                    <div style={{ display: 'flex', gap: '1rem', borderBottom: '1px solid #334155', paddingBottom: '0.25rem', marginBottom: '0.5rem', color: '#cbd5e1' }}>
                        <span>Console</span>
                        <span>Network</span>
                        <span>Elements</span>
                    </div>
                    <div>&gt; Waiting for selector ".confirm-btn"...</div>
                    <div style={{ color: '#60a5fa' }}>&lt; Found element in 0.05s</div>
                    <div>&gt; Click initiated by user "Richard"</div>
                    <div style={{ color: '#10b981' }}>&lt; Action successful. Navigation to /dashboard detected.</div>
                </div>
            </div>
        )
    },
    {
        id: 'analytics',
        title: 'Smart Analytics',
        status: 'Analyzing',
        icon: '📊',
        color: '#f59e0b', // orange
        content: (
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem', display: 'flex', flexDirection: 'column', height: '100%' }}>
                {/* Stats Row */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                    <div style={{ padding: '1rem', background: 'rgba(16, 185, 129, 0.1)', borderRadius: '8px', textAlign: 'center' }}>
                        <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#10b981' }}>99.2%</div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Success Rate</div>
                    </div>
                    <div style={{ padding: '1rem', background: 'rgba(59, 130, 246, 0.1)', borderRadius: '8px', textAlign: 'center' }}>
                        <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#3b82f6' }}>-42ms</div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Latency Diff</div>
                    </div>
                    <div style={{ padding: '1rem', background: 'rgba(249, 115, 22, 0.1)', borderRadius: '8px', textAlign: 'center' }}>
                        <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#f97316' }}>0.01%</div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Flakiness</div>
                    </div>
                </div>

                {/* Chart */}
                <div style={{ marginBottom: '1.5rem', flex: 1 }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Duration Trend (Last 7 Days)</div>
                    <div style={{ height: '120px', display: 'flex', alignItems: 'flex-end', gap: '4px', justifyContent: 'space-between', paddingBottom: '1rem', borderBottom: '1px solid var(--border-light)' }}>
                        {[40, 65, 45, 80, 55, 90, 70, 85, 60, 75, 50, 95].map((h, i) => (
                            <div key={i} style={{ width: '6%', height: `${h}%`, background: i === 5 ? '#f59e0b' : theme.border.emphasis, borderRadius: '2px 2px 0 0', opacity: 0.8, position: 'relative' }}>
                                {i === 5 && <div style={{ position: 'absolute', top: -20, left: '50%', transform: 'translateX(-50%)', fontSize: '0.6rem', color: '#f59e0b' }}>Spike</div>}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Insights List */}
                <div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Key Insights</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.8rem' }}>
                            <span style={{ color: '#ef4444' }}>●</span>
                            <span>Checkout flow is 200ms slower on Safari</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.8rem' }}>
                            <span style={{ color: '#f59e0b' }}>●</span>
                            <span>Login API has 0.5% flakiness at 9AM EST</span>
                        </div>
                    </div>
                </div>
            </div>
        )
    },
    {
        id: 'cicd',
        title: 'CI/CD Pipeline',
        status: 'Integrated',
        icon: '🚀',
        color: '#8b5cf6', // purple
        content: (
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem', height: '100%', display: 'flex', flexDirection: 'column' }}>
                {/* YAML Config */}
                <div style={{ marginBottom: '1.5rem', padding: '1rem', background: theme.bg.tertiary, borderRadius: '6px', border: `1px solid ${theme.border.subtle}` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>.github/workflows/test.yml</div>
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>YAML</div>
                    </div>
                    <div style={{ color: '#ec4899', marginBottom: '0.25rem' }}>on: [push, pull_request]</div>
                    <div style={{ color: '#8b5cf6', paddingLeft: '1rem', marginBottom: '0.25rem' }}>jobs:</div>
                    <div style={{ color: '#3b82f6', paddingLeft: '2rem', marginBottom: '0.25rem' }}>test-lattice:</div>
                    <div style={{ paddingLeft: '3rem', color: 'var(--text-primary)' }}>runs-on: ubuntu-latest</div>
                    <div style={{ paddingLeft: '3rem', color: 'var(--text-primary)' }}>steps:</div>
                    <div style={{ paddingLeft: '4rem', color: '#10b981' }}>- uses: testlattice/action@v2</div>
                </div>

                {/* Pipeline Status */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '1rem' }}>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.75rem', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '6px' }}>
                        <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#10b981' }} />
                        <div style={{ flex: 1 }}>
                            <div style={{ fontSize: '0.8rem', fontWeight: 600 }}>Build #4289</div>
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>feat: update cart logic</div>
                        </div>
                        <div style={{ fontSize: '0.8rem', color: '#10b981' }}>Passed</div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.75rem', background: '#fff', border: '1px solid #3b82f6', borderRadius: '6px', boxShadow: '0 4px 6px -1px rgba(59, 130, 246, 0.1)' }}>
                        <div style={{ position: 'relative', width: '12px', height: '12px' }}>
                            <span style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: '#3b82f6', opacity: 0.3 }} className="animate-pulse" />
                            <span style={{ position: 'absolute', inset: '25%', borderRadius: '50%', background: '#3b82f6' }} />
                        </div>
                        <div style={{ flex: 1 }}>
                            <div style={{ fontSize: '0.8rem', fontWeight: 600 }}>E2E Tests (TestLattice)</div>
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Running 245 tests...</div>
                        </div>
                        <div style={{ fontSize: '0.8rem', color: '#3b82f6' }}>14s</div>
                    </div>
                </div>

                <div style={{ marginTop: 'auto', textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Continuous integration enabled on 3 branches
                </div>
            </div>
        )
    },
    {
        id: 'mobile',
        title: 'Mobile Testing',
        status: 'Emulated',
        icon: '📱',
        color: '#ef4444', // red
        content: (
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                <div style={{ flex: 1, display: 'flex', justifyContent: 'center', gap: '2rem', alignItems: 'flex-end', paddingBottom: '1rem' }}>
                    {/* iPhone (Left) */}
                    <div style={{
                        width: '140px',
                        height: '95%',
                        border: '5px solid #334155',
                        borderRadius: '20px',
                        background: '#fff',
                        position: 'relative',
                        overflow: 'hidden',
                        boxShadow: '-15px 15px 30px rgba(0,0,0,0.15)',
                        transform: 'rotate(-5deg) translateY(5px)',
                        zIndex: 1
                    }}>
                        {/* Notch */}
                        <div style={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', width: '50px', height: '14px', background: '#334155', borderRadius: '0 0 8px 8px', zIndex: 5 }} />

                        {/* Content */}
                        <div style={{ padding: '2rem 0.75rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', height: '100%' }}>
                            <div style={{ height: '50px', background: '#f1f5f9', borderRadius: '4px' }} />
                            <div style={{ height: '10px', width: '60%', background: '#cbd5e1', borderRadius: '2px' }} />
                            <div style={{ height: '60px', width: '100%', background: '#e2e8f0', borderRadius: '4px', marginTop: '1rem' }} />
                            <div style={{ marginTop: 'auto', textAlign: 'center' }}>
                                <div style={{ width: '40px', height: '4px', background: '#94a3b8', borderRadius: '2px', margin: '0 auto' }} />
                            </div>
                        </div>
                    </div>

                    {/* Samsung (Right) */}
                    <div style={{
                        width: '145px',
                        height: '100%',
                        border: '4px solid #1e293b',
                        borderRadius: '12px',
                        background: '#fff',
                        position: 'relative',
                        overflow: 'hidden',
                        boxShadow: '0 15px 30px rgba(0,0,0,0.2)',
                        transform: 'rotate(5deg)',
                        zIndex: 2
                    }}>
                        {/* Punch-hole Camera */}
                        <div style={{ position: 'absolute', top: '10px', left: '50%', transform: 'translateX(-50%)', width: '10px', height: '10px', background: '#1e293b', borderRadius: '50%', zIndex: 5 }} />

                        {/* Content */}
                        <div style={{ padding: '2rem 0.75rem 0.75rem', display: 'flex', flexDirection: 'column', gap: '0.6rem', height: '100%' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                                <div style={{ height: '40px', background: '#e2e8f0', borderRadius: '4px' }} />
                                <div style={{ height: '40px', background: '#e2e8f0', borderRadius: '4px' }} />
                            </div>
                            <div style={{ height: '10px', width: '80%', background: '#cbd5e1', borderRadius: '2px', marginTop: '0.5rem' }} />
                            <div style={{ height: '8px', width: '50%', background: '#e2e8f0', borderRadius: '2px' }} />

                            {/* App Grid */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px', marginTop: '1rem' }}>
                                {[...Array(6)].map((_, i) => <div key={i} style={{ aspectRatio: '1', background: '#f1f5f9', borderRadius: '6px' }} />)}
                            </div>

                            <div style={{ marginTop: 'auto', textAlign: 'center' }}>
                                <div style={{ display: 'inline-block', padding: '0.2rem 0.5rem', background: '#ef4444', color: '#fff', fontSize: '0.6rem', borderRadius: '3px' }}>TESTING</div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Mobile Status Bar */}
                <div style={{ marginTop: '1rem', padding: '0.75rem', background: 'rgba(51, 65, 85, 0.05)', borderRadius: '6px', fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between' }}>
                    <span>Running on Device Farm (US-East)</span>
                    <span style={{ color: '#10b981' }}>● 2 Devices Active</span>
                </div>
            </div>
        )
    }
]

export function FeatureCarousel() {
    const [currentIndex, setCurrentIndex] = useState(0)
    const [isPaused, setIsPaused] = useState(false)

    // Auto-rotate every 3 seconds
    useEffect(() => {
        if (isPaused) return

        const interval = setInterval(() => {
            setCurrentIndex((prev) => (prev + 1) % features.length)
        }, 3000)

        return () => clearInterval(interval)
    }, [isPaused])

    const goToNext = () => {
        setCurrentIndex((prev) => (prev + 1) % features.length)
        setIsPaused(true) // Pause on interaction
        setTimeout(() => setIsPaused(false), 5000) // Resume after 5s
    }

    const goToPrev = () => {
        setCurrentIndex((prev) => (prev - 1 + features.length) % features.length)
        setIsPaused(true)
        setTimeout(() => setIsPaused(false), 5000)
    }

    const currentFeature = features[currentIndex]

    return (
        <div style={{ position: 'relative' }}>
            {/* Main Card */}
            <div className="glass-card" style={{
                padding: '1.5rem',
                background: 'rgba(255, 255, 255, 0.8)',
                border: `1px solid ${theme.border.subtle}`,
                boxShadow: theme.shadows.lg,
                height: '550px', // Fixed height to prevent layout shifts
                display: 'flex',
                flexDirection: 'column',
                transition: 'all 0.3s ease-in-out',
                position: 'relative' // Ensure positioning context
            }}>
                {/* Browser Toolbar / Header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem', paddingBottom: '1rem', borderBottom: `1px solid ${theme.border.subtle}` }}>
                    <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#ef4444' }} />
                    <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#f59e0b' }} />
                    <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#10b981' }} />
                    <div style={{
                        flex: 1,
                        marginLeft: '1rem',
                        background: theme.bg.primary,
                        height: '24px',
                        borderRadius: '4px',
                        display: 'flex',
                        alignItems: 'center',
                        padding: '0 0.75rem',
                        fontSize: '0.75rem',
                        color: 'var(--text-muted)',
                        fontFamily: 'monospace'
                    }}>
                        testlattice.dev/demo/{currentFeature.id}
                    </div>
                </div>

                {/* Dynamic Content */}
                <div key={currentFeature.id} className="animate-enter" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                    {currentFeature.content}
                </div>

                {/* Navigation Dots (Manual Control) */}
                <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', marginTop: '1.5rem' }}>
                    {features.map((_, idx) => (
                        <button
                            key={idx}
                            onClick={() => { setCurrentIndex(idx); setIsPaused(true); setTimeout(() => setIsPaused(false), 5000); }}
                            style={{
                                width: '8px',
                                height: '8px',
                                borderRadius: '50%',
                                background: idx === currentIndex ? theme.accent.primary : theme.border.default,
                                border: 'none',
                                cursor: 'pointer',
                                padding: 0,
                                transition: 'all 0.2s'
                            }}
                        />
                    ))}
                </div>

                {/* Left/Right Arrow Areas for "Removing Grid" (Swipe simulation) */}
                {/* Left/Right Click Areas for "Swipe" simulation (Invisible) */}
                <div
                    onClick={goToPrev}
                    style={{
                        position: 'absolute', top: 0, left: 0, bottom: 0, width: '60px',
                        cursor: 'pointer', zIndex: 10
                    }}
                />
                <div
                    onClick={goToNext}
                    style={{
                        position: 'absolute', top: 0, right: 0, bottom: 0, width: '60px',
                        cursor: 'pointer', zIndex: 10
                    }}
                />

            </div>

            {/* Floating Badge (Dynamic) */}
            <div className="glass-panel" style={{
                position: 'absolute',
                top: '-20px',
                right: '-20px',
                padding: '0.75rem 1.25rem',
                borderRadius: theme.radius.lg,
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                zIndex: 2,
                background: 'rgba(255, 255, 255, 0.95)',
                boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)',
                transition: 'all 0.3s ease'
            }}>
                <div style={{ fontSize: '1.5rem' }}>{currentFeature.icon}</div>
                <div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
                        {currentFeature.title}
                    </div>
                    <div style={{ fontSize: '1rem', fontWeight: 700, color: currentFeature.color }}>
                        {currentFeature.status}
                    </div>
                </div>
            </div>
        </div>
    )
}
