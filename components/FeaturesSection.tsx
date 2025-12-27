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
        id: 'live-explore',
        title: 'Live Exploration',
        description: 'Watch AI explore your app in real-time. See what it finds as it happens.',
        demoTitle: 'Live Browser Session',
        demoContent: (
            <div className="glass-card" style={{ padding: '2rem', background: '#1e1e1e', color: '#fff', fontFamily: 'monospace' }}>
                <div style={{ color: '#10b981' }}>✓ Exploring homepage...</div>
                <div style={{ margin: '1rem 0', color: '#3b82f6' }}>→ Clicked "Sign Up" button</div>
                <div style={{ color: '#fbbf24' }}>⚠ Checking form fields...</div>
                <div style={{ color: '#10b981' }}>✓ Form looks good. Continuing...</div>
                <div style={{ marginTop: '1rem', color: '#94a3b8', fontSize: '0.9rem' }}>Live • Watching in real-time</div>
            </div>
        )
    },
    {
        id: 'visual-checks',
        title: 'Visual Checks',
        description: 'Automatically detects broken layouts, errors, and things that look wrong.',
        demoTitle: 'Automatic Issue Detection',
        demoContent: (
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                <div style={{ flex: 1, padding: '1rem', border: '1px solid var(--border-light)', borderRadius: '8px' }}>
                    <div style={{ fontWeight: 'bold', marginBottom: '0.5rem' }}>What you see</div>
                    <div style={{ width: '100%', height: '80px', background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
                        Looks good ✓
                    </div>
                </div>
                <div style={{ fontSize: '1.5rem' }}>→</div>
                <div style={{ flex: 1, padding: '1rem', border: '1px solid var(--error)', borderRadius: '8px', background: 'rgba(220, 38, 38, 0.05)' }}>
                    <div style={{ fontWeight: 'bold', marginBottom: '0.5rem', color: 'var(--error)' }}>Issue detected</div>
                    <div style={{ width: '100%', height: '80px', background: '#ef4444', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', position: 'relative' }}>
                        <div style={{ position: 'absolute', top: '-5px', right: '-5px', background: '#fff', borderRadius: '50%', width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', color: '#ef4444', fontWeight: 'bold' }}>!</div>
                        Layout broken
                    </div>
                </div>
            </div>
        )
    },
    {
        id: 'flow-exploration',
        title: 'Flow Exploration',
        description: 'AI follows natural user flows and checks if key paths work smoothly.',
        demoTitle: 'Exploring User Flows',
        demoContent: (
            <div style={{ padding: '1.5rem', background: 'var(--bg-card)', borderRadius: '8px', border: '1px solid var(--border-light)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
                    <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--primary)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>1</div>
                    <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600 }}>Homepage → Product Page</div>
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>✓ Checked links and navigation</div>
                    </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
                    <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--primary)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>2</div>
                    <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600 }}>Add to Cart → Checkout</div>
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>✓ Verified form and payment flow</div>
                    </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--success)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>✓</div>
                    <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600 }}>All flows working</div>
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>No issues found</div>
                    </div>
                </div>
            </div>
        )
    },
    {
        id: 'ai-behavior-analysis',
        title: 'AI Behavior Analysis',
        description: 'Understand how users really interact with your app. AI analyzes click patterns, navigation flows, and engagement metrics.',
        demoTitle: 'Behavioral Insights',
        demoContent: (
            <div style={{ padding: '1.5rem', background: 'var(--bg-card)', borderRadius: '8px', border: '1px solid var(--border-light)' }}>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginBottom: '1rem' }}>
                    <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>Engagement Score</div>
                        <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--primary)' }}>92/100</div>
                    </div>
                    <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>Frustration Signals</div>
                        <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--success)' }}>0 detected</div>
                    </div>
                </div>
                <div style={{ background: 'var(--bg-secondary)', padding: '1rem', borderRadius: '6px' }}>
                    <div style={{ fontWeight: 600, marginBottom: '0.5rem', fontSize: '0.9rem' }}> AI Insight:</div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                        "Users spend 40% more time on the pricing page when they come from the 'Features' section compared to direct traffic."
                    </div>
                </div>
            </div>
        )
    },
    {
        id: 'human-control',
        title: 'Human-in-the-Loop',
        description: 'Pause anytime, take control, guide the AI, then resume. It\'s like pair programming.',
        demoTitle: 'Interactive Control',
        demoContent: (
            <div className="glass-card" style={{ padding: '2rem', background: '#1e1e1e', color: '#fff', fontFamily: 'monospace' }}>
                <div style={{ color: '#94a3b8' }}>AI exploring...</div>
                <div style={{ margin: '1rem 0', padding: '1rem', background: 'rgba(59, 130, 246, 0.1)', borderRadius: '4px', border: '1px solid #3b82f6' }}>
                    <div style={{ color: '#3b82f6', fontWeight: 'bold', marginBottom: '0.5rem' }}>⏸ Paused by you</div>
                    <div style={{ fontSize: '0.9rem' }}>Take control to guide the exploration</div>
                </div>
                <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem' }}>
                    <button style={{ padding: '0.5rem 1rem', background: '#10b981', border: 'none', borderRadius: '4px', color: '#fff', cursor: 'pointer' }}>▶ Resume</button>
                    <button style={{ padding: '0.5rem 1rem', background: 'transparent', border: '1px solid #fff', borderRadius: '4px', color: '#fff', cursor: 'pointer' }}>✏️ Guide</button>
                </div>
            </div>
        )
    },
    {
        id: 'issue-detection',
        title: 'Issue Detection',
        description: 'Catches console errors, broken links, slow pages, and obvious problems automatically.',
        demoTitle: 'Automatic Problem Detection',
        demoContent: (
            <div style={{ padding: '1.5rem', background: 'var(--bg-card)', borderRadius: '8px', border: '1px solid var(--border-light)' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', marginBottom: '1rem', paddingBottom: '1rem', borderBottom: '1px solid var(--border-light)' }}>
                    <div style={{ color: 'var(--error)', fontSize: '1.2rem' }}>⚠</div>
                    <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>Console Error</div>
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>Uncaught TypeError: Cannot read property...</div>
                    </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                    <div style={{ color: 'var(--warning)', fontSize: '1.2rem' }}>⚡</div>
                    <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>Slow Page Load</div>
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Took 4.2s to load (threshold: 2s)</div>
                    </div>
                </div>
            </div>
        )
    },
    {
        id: 'replay',
        title: 'Simple Replay',
        description: 'Watch a video replay of what happened. See screenshots at key moments.',
        demoTitle: 'Video & Screenshot Replay',
        demoContent: (
            <div style={{ aspectRatio: '16/9', background: '#000', borderRadius: '8px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#fff', position: 'relative', overflow: 'hidden' }}>
                <div style={{ width: '60px', height: '60px', borderRadius: '50%', border: '2px solid #fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', marginBottom: '1rem' }}>
                    ▶
                </div>
                <div style={{ fontSize: '0.9rem', color: '#94a3b8' }}>Watch replay</div>
                <div style={{ position: 'absolute', bottom: '1rem', right: '1rem', display: 'flex', gap: '0.5rem' }}>
                    {[1, 2, 3].map(i => (
                        <div key={i} style={{ width: '60px', height: '40px', background: '#1e1e1e', borderRadius: '4px', border: '1px solid #333' }}></div>
                    ))}
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
                    <h2 style={{ marginBottom: '1rem' }}>Built for Solo Developers</h2>
                    <p style={{ fontSize: '1.25rem', color: 'var(--text-secondary)', maxWidth: '600px', margin: '0 auto' }}>
                        Click any feature to see how it works. No test suites. No code. Just confidence.
                    </p>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem', marginBottom: '3rem' }}>
                    {features.map((feature) => (
                        <div
                            key={feature.id}
                            className="glass-card"
                            onClick={() => setActiveFeature(feature)}
                            style={{
                                padding: '1.5rem',
                                cursor: 'pointer',
                                transition: 'all 0.2s ease',
                                border: activeFeature?.id === feature.id ? '2px solid var(--primary)' : '1px solid var(--border-light)',
                                transform: activeFeature?.id === feature.id ? 'translateY(-4px)' : 'none',
                            }}
                        >
                            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.5rem', color: 'var(--text-primary)' }}>
                                {feature.title}
                            </h3>
                            <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: 1.6 }}>
                                {feature.description}
                            </p>
                        </div>
                    ))}
                </div>
            </div>

            {/* Modal Backdrop */}
            {activeFeature && (
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
                            maxWidth: '800px',
                            width: '100%',
                            background: 'var(--bg-card)',
                            borderRadius: 'var(--radius-lg)',
                            padding: '2.5rem',
                            boxShadow: 'var(--shadow-lg)',
                            animation: 'scaleIn 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                            maxHeight: '90vh',
                            overflowY: 'auto',
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
                            <div>
                                <h2 style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: '0.5rem', color: 'var(--text-primary)' }}>
                                    {activeFeature.title}
                                </h2>
                                <p style={{ color: 'var(--text-secondary)', fontSize: '1rem' }}>
                                    {activeFeature.description}
                                </p>
                            </div>
                            <button
                                onClick={() => setActiveFeature(null)}
                                style={{
                                    background: 'transparent',
                                    border: 'none',
                                    fontSize: '1.5rem',
                                    cursor: 'pointer',
                                    color: 'var(--text-secondary)',
                                    width: '32px',
                                    height: '32px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    borderRadius: 'var(--radius-sm)',
                                    transition: 'background 0.2s ease',
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.background = 'var(--beige-100)'
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.background = 'transparent'
                                }}
                            >
                                ×
                            </button>
                        </div>

                        <div style={{ marginBottom: '1.5rem' }}>
                            <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                {activeFeature.demoTitle}
                            </div>
                            <div>{activeFeature.demoContent}</div>
                        </div>

                        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                            <Link
                                href="/signup"
                                className="btn btn-primary"
                                onClick={() => setActiveFeature(null)}
                            >
                                Try It Now
                            </Link>
                        </div>
                    </div>
                </div>
            )}
        </>
    )
}
