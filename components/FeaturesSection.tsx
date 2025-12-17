'use client'

import { useState } from 'react'
import Link from 'next/link'

interface Feature {
    id: string
    title: string
    description: string
    demoTitle: string
    demoContent: React.ReactNode
}

const features: Feature[] = [
    {
        id: 'healing',
        title: 'Self-Healing Tests',
        description: 'Selectors break. Our agents fix them automatically in real-time.',
        demoTitle: 'Live Healing in Action',
        demoContent: (
            <div className="glass-card" style={{ padding: '2rem', background: '#1e1e1e', color: '#fff', fontFamily: 'monospace' }}>
                <div style={{ color: '#ef4444' }}>✖ Error: Element "#submit-btn-v1" not found</div>
                <div style={{ margin: '1rem 0', color: '#fbbf24' }}>⚠ AI Detecting changes... Found button with new ID "#submit-btn-v2"</div>
                <div style={{ color: '#10b981' }}>✔ Auto-healed and clicked! (Confidence: 99.8%)</div>
            </div>
        )
    },
    {
        id: 'parallel',
        title: 'Parallel Execution',
        description: 'Run thousands of tests simultaneously on our cloud infrastructure.',
        demoTitle: '50x Faster Execution',
        demoContent: (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '0.5rem' }}>
                {Array.from({ length: 15 }).map((_, i) => (
                    <div key={i} style={{ aspectRatio: '16/9', background: '#e5e5e5', borderRadius: '4px', position: 'relative', overflow: 'hidden' }}>
                        <div style={{ position: 'absolute', top: 0, left: 0, height: '100%', width: '100%', background: '#10b981', opacity: 0.2, transform: 'scaleX(0)', animation: `load 2s infinite ${i * 0.1}s` }} />
                        <div style={{ position: 'center', fontSize: '0.6rem', padding: '0.25rem' }}>Spec #{i + 1}</div>
                    </div>
                ))}
                <style jsx>{`
          @keyframes load { 0% { transform: scaleX(0); transform-origin: left; } 50% { transform: scaleX(1); transform-origin: left; } 51% { transform: scaleX(1); transform-origin: right; } 100% { transform: scaleX(0); transform-origin: right; } }
        `}</style>
            </div>
        )
    },
    {
        id: 'visual',
        title: 'Visual Regression',
        description: 'Pixel-perfect diffing to catch UI bugs before they ship.',
        demoTitle: 'Pixel Diff View',
        demoContent: (
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                <div style={{ flex: 1, padding: '1rem', border: '1px solid #ddd', borderRadius: '8px' }}>
                    <div style={{ fontWeight: 'bold', marginBottom: '0.5rem' }}>Baseline</div>
                    <div style={{ width: '100px', height: '30px', background: '#3b82f6', borderRadius: '4px' }}></div>
                </div>
                <div>vs</div>
                <div style={{ flex: 1, padding: '1rem', border: '1px solid #ef4444', borderRadius: '8px', background: 'rgba(239, 68, 68, 0.05)' }}>
                    <div style={{ fontWeight: 'bold', marginBottom: '0.5rem', color: '#ef4444' }}>Diff Detected</div>
                    <div style={{ width: '100px', height: '30px', background: '#ef4444', borderRadius: '4px' }}></div>
                </div>
            </div>
        )
    },
    {
        id: 'cicd',
        title: 'CI/CD Native',
        description: 'Drop-in integration with GitHub Actions, GitLab CI, and CircleCI.',
        demoTitle: 'GitHub Actions Integration',
        demoContent: (
            <div className="glass-card" style={{ padding: '1.5rem', background: '#0d1117', color: '#c9d1d9', fontFamily: 'monospace', fontSize: '0.9rem' }}>
                <div>- name: Run TestLattice</div>
                <div style={{ paddingLeft: '1rem' }}>uses: testlattice/action@v1</div>
                <div style={{ paddingLeft: '1rem' }}>with:</div>
                <div style={{ paddingLeft: '2rem' }}>api-key: ${`{{ secrets.TL_KEY }}`}</div>
                <div style={{ paddingLeft: '2rem', color: '#10b981' }}>wait-for: true</div>
            </div>
        )
    },
    {
        id: 'analytics',
        title: 'Deep Analytics',
        description: 'Trace flakiness and performance regressions with detailed charts.',
        demoTitle: 'Performance Trends',
        demoContent: (
            <div style={{ height: '200px', display: 'flex', alignItems: 'flex-end', gap: '10px', padding: '1rem', background: '#fff', borderRadius: '8px', border: '1px solid #eee' }}>
                {[40, 60, 45, 70, 80, 75, 90].map((h, i) => (
                    <div key={i} style={{ flex: 1, height: `${h}%`, background: h > 85 ? '#10b981' : '#3b82f6', borderRadius: '4px 4px 0 0', position: 'relative' }}>
                        <div style={{ position: 'absolute', top: '-20px', left: '50%', transform: 'translateX(-50%)', fontSize: '0.7rem' }}>{h}ms</div>
                    </div>
                ))}
            </div>
        )
    },
    {
        id: 'video',
        title: 'Video Replay',
        description: 'Watch exactly what happened during every test run.',
        demoTitle: 'HD Session Replay',
        demoContent: (
            <div style={{ aspectRatio: '16/9', background: '#000', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
                <div style={{ width: '60px', height: '60px', borderRadius: '50%', border: '2px solid #fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    ▶
                </div>
            </div>
        )
    }
]

export function FeaturesSection() {
    const [activeFeature, setActiveFeature] = useState<Feature | null>(null)

    return (
        <>
            <div className="container">
                <div style={{ textAlign: 'center', marginBottom: '4rem' }}>
                    <h2 style={{ marginBottom: '1rem' }}>Engineered for Perfection</h2>
                    <p style={{ fontSize: '1.25rem', color: 'var(--text-secondary)', maxWidth: '600px', margin: '0 auto' }}>
                        Click any feature to see it in action.
                    </p>
                </div>

                <div className="grid-cols-3">
                    {features.map((f) => (
                        <button
                            key={f.id}
                            onClick={() => setActiveFeature(f)}
                            className="glass-card"
                            style={{
                                padding: '2rem',
                                textAlign: 'left',
                                cursor: 'pointer',
                                width: '100%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                background: 'var(--bg-card)',
                                border: '1px solid var(--border-medium)',
                                transition: 'all 0.2s',
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.transform = 'translateY(-4px)'
                                e.currentTarget.style.borderColor = 'var(--primary)'
                                e.currentTarget.style.boxShadow = 'var(--shadow-lg)'
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.transform = 'translateY(0)'
                                e.currentTarget.style.borderColor = 'var(--border-medium)'
                                e.currentTarget.style.boxShadow = 'var(--shadow-sm)'
                            }}
                        >
                            <div>
                                <h3 style={{ fontSize: '1.25rem', margin: 0, color: 'var(--text-primary)' }}>{f.title}</h3>
                                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.5rem' }}>{f.description}</p>
                            </div>
                            <span style={{ fontSize: '1.5rem', color: 'var(--primary)', opacity: 0.5 }}>→</span>
                        </button>
                    ))}
                </div>

                <div style={{ marginTop: '4rem', textAlign: 'center' }}>
                    <Link href="/features" className="btn btn-secondary btn-large">
                        Explore All Features
                    </Link>
                </div>
            </div>

            {/* Modal Backdrop */}
            {
                activeFeature && (
                    <div
                        style={{
                            position: 'fixed',
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            background: 'rgba(61, 54, 48, 0.4)',
                            backdropFilter: 'blur(8px)',
                            zIndex: 2000,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: '2rem',
                            animation: 'fadeIn 0.2s ease-out',
                        }}
                        onClick={() => setActiveFeature(null)}
                    >
                        {/* Modal Content */}
                        <div
                            className="glass-panel"
                            style={{
                                width: '100%',
                                maxWidth: '800px',
                                background: 'var(--bg-card)',
                                borderRadius: 'var(--radius-lg)',
                                padding: '0',
                                position: 'relative',
                                overflow: 'hidden',
                                boxShadow: 'var(--shadow-xl)',
                                animation: 'scaleIn 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                            }}
                            onClick={(e) => e.stopPropagation()}
                        >
                            {/* Modal Header */}
                            <div style={{
                                padding: '1.5rem 2rem',
                                borderBottom: '1px solid var(--border-light)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                background: 'var(--bg-primary)'
                            }}>
                                <div>
                                    <h3 style={{ margin: 0 }}>{activeFeature.demoTitle}</h3>
                                    <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-secondary)' }}>{activeFeature.title}</p>
                                </div>
                                <button
                                    onClick={() => setActiveFeature(null)}
                                    style={{
                                        background: 'none',
                                        border: 'none',
                                        fontSize: '1.5rem',
                                        cursor: 'pointer',
                                        color: 'var(--text-secondary)',
                                        padding: '0.5rem',
                                        lineHeight: 1
                                    }}
                                >
                                    ×
                                </button>
                            </div>

                            {/* Modal Body */}
                            <div style={{ padding: '2rem', minHeight: '300px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                                {activeFeature.demoContent}
                            </div>

                            {/* Modal Footer */}
                            <div style={{
                                padding: '1.5rem 2rem',
                                borderTop: '1px solid var(--border-light)',
                                background: 'var(--bg-primary)',
                                display: 'flex',
                                justifyContent: 'flex-end',
                                gap: '1rem'
                            }}>
                                <button onClick={() => setActiveFeature(null)} className="btn btn-secondary">
                                    Close Demo
                                </button>
                                <button className="btn btn-primary">
                                    Try {activeFeature.title} Now
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }
            <style jsx global>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes scaleIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
      `}</style>
        </>
    )
}
