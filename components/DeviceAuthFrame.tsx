'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { theme } from '@/lib/theme'

interface DeviceAuthFrameProps {
    children: React.ReactNode
    title: string
    subtitle?: string
    showMobile?: boolean
}

export function DeviceAuthFrame({ children, title, subtitle, showMobile = false }: DeviceAuthFrameProps) {
    const [typedText, setTypedText] = useState('')
    const fullText = "Verifying credentials via automated agent..."

    useEffect(() => {
        let i = 0
        const timer = setInterval(() => {
            if (i < fullText.length) {
                setTypedText(prev => prev + fullText.charAt(i))
                i++
            } else {
                clearInterval(timer)
            }
        }, 50)
        return () => clearInterval(timer)
    }, [])

    return (
        <div style={{
            minHeight: '100vh',
            background: theme.bg.primary,
            backgroundImage: `radial-gradient(circle at 10% 20%, ${theme.accent.redSubtle} 0%, transparent 20%), radial-gradient(circle at 90% 80%, ${theme.accent.redSubtle} 0%, transparent 20%)`,
            display: 'flex',
            position: 'relative',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '2rem',
            fontFamily: 'var(--font-inter)',
            color: theme.text.primary
        }}>
            {/* Home Link / Logo */}
            <div style={{ position: 'absolute', top: '2rem', left: '2rem' }}>
                <Link href="/" style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    textDecoration: 'none',
                    color: theme.text.primary,
                    fontWeight: 700,
                    fontSize: '1.25rem',
                    padding: '0.5rem 1rem',
                    borderRadius: theme.radius.full,
                    background: theme.bg.secondary,
                    boxShadow: theme.shadows.sm,
                    border: `1px solid ${theme.border.subtle}`
                }}>
                    <div style={{ width: '2rem', height: '2rem', background: `linear-gradient(135deg, ${theme.accent.primary} 0%, ${theme.accent.primaryDark} 100%)`, borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '1.2rem' }}>
                        TL
                    </div>
                    TestLattice
                </Link>
            </div>

            <div style={{ maxWidth: '1200px', width: '100%', display: 'flex', gap: '6rem', alignItems: 'center', justifyContent: 'center' }}>

                {/* Left Side: Testing Facts & Context */}
                {!showMobile && (
                    <div style={{ maxWidth: '450px' }} className="desktop-only">
                        <h3 style={{ fontSize: '2rem', fontWeight: 700, color: theme.text.primary, marginBottom: '1.5rem', lineHeight: 1.2 }}>
                            Did you know?
                        </h3>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                            <div style={{ display: 'flex', gap: '1rem' }}>
                                <div style={{ fontSize: '1.5rem', background: theme.accent.blueSubtle, width: '48px', height: '48px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: theme.accent.blue }}>⚡</div>
                                <div>
                                    <div style={{ color: theme.text.primary, fontWeight: 600, marginBottom: '0.25rem' }}>40% Faster Release Cycles</div>
                                    <p style={{ color: theme.text.secondary, fontSize: '0.9rem', lineHeight: 1.6 }}>Teams using autonomous agents for E2E testing ship features nearly twice as fast as those relying on manual QA.</p>
                                </div>
                            </div>

                            <div style={{ display: 'flex', gap: '1rem' }}>
                                <div style={{ fontSize: '1.5rem', background: theme.accent.greenSubtle, width: '48px', height: '48px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: theme.accent.green }}>🛡️</div>
                                <div>
                                    <div style={{ color: theme.text.primary, fontWeight: 600, marginBottom: '0.25rem' }}>Self-Healing Selectors</div>
                                    <p style={{ color: theme.text.secondary, fontSize: '0.9rem', lineHeight: 1.6 }}>TestLattice agents automatically adapt to DOM changes, reducing flaky test maintenance by over 85%.</p>
                                </div>
                            </div>

                            <div style={{ display: 'flex', gap: '1rem' }}>
                                <div style={{ fontSize: '1.5rem', background: theme.accent.yellowSubtle, width: '48px', height: '48px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: theme.accent.yellow }}>🌐</div>
                                <div>
                                    <div style={{ color: theme.text.primary, fontWeight: 600, marginBottom: '0.25rem' }}>Real Browser Environment</div>
                                    <p style={{ color: theme.text.secondary, fontSize: '0.9rem', lineHeight: 1.6 }}>Tests run in full-fledged virtualized browsers, not simulations. What you see here is exactly what your users experience.</p>
                                </div>
                            </div>
                        </div>

                        <div style={{ marginTop: '3rem', padding: '1rem', background: 'rgba(51, 65, 85, 0.05)', borderRadius: '8px', borderLeft: `4px solid ${theme.accent.primary}` }}>
                            <div style={{ color: theme.text.tertiary, fontSize: '0.85rem', marginBottom: '0.5rem', fontWeight: 600 }}>LIVE STATUS</div>
                            <div style={{ color: theme.text.secondary, fontFamily: 'monospace', fontSize: '0.9rem' }}>
                                &gt; {typedText}<span className="animate-pulse">_</span>
                            </div>
                        </div>
                    </div>
                )}

                {/* Right Side: Device Frame (Container for the Auth Form) */}
                {!showMobile ? (
                    /* Desktop Browser Frame */
                    <div style={{
                        width: '480px',
                        background: theme.bg.secondary,
                        borderRadius: '12px',
                        boxShadow: theme.shadows.xl,
                        overflow: 'hidden',
                        border: `1px solid ${theme.border.subtle}`
                    }}>
                        {/* Browser Toolbar */}
                        <div style={{ background: theme.bg.tertiary, padding: '0.75rem 1rem', display: 'flex', alignItems: 'center', gap: '0.75rem', borderBottom: `1px solid ${theme.border.subtle}` }}>
                            <div style={{ display: 'flex', gap: '0.4rem' }}>
                                <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#ef4444' }} />
                                <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#f59e0b' }} />
                                <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#10b981' }} />
                            </div>
                            <div style={{
                                flex: 1, background: theme.bg.secondary, borderRadius: '4px', height: '28px',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: '0.8rem', color: theme.text.tertiary, fontFamily: 'monospace'
                            }}>
                                🔒 secure-auth.testlattice.dev
                            </div>
                        </div>

                        {/* Content Area (The actual Form) */}
                        <div style={{ padding: '2.5rem', background: theme.bg.secondary }}>
                            <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                                <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🧪</div>
                                <h2 style={{ fontSize: '1.75rem', fontWeight: 700, color: theme.text.primary, marginBottom: '0.5rem' }}>{title}</h2>
                                {subtitle && <p style={{ color: theme.text.secondary }}>{subtitle}</p>}
                            </div>
                            {children}
                        </div>
                    </div>
                ) : (
                    /* Mobile Frame Placeholder */
                    <div style={{
                        width: '380px',
                        height: '700px',
                        background: '#000',
                        borderRadius: '40px',
                        boxShadow: theme.shadows.xl,
                        border: '12px solid #333',
                        overflow: 'hidden',
                        position: 'relative'
                    }}>
                        {/* Notch */}
                        <div style={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', width: '120px', height: '25px', background: '#333', borderRadius: '0 0 15px 15px', zIndex: 10 }} />

                        {/* Mobile Content */}
                        <div style={{ height: '100%', background: theme.bg.secondary, paddingTop: '4rem', paddingBottom: '2rem', paddingLeft: '1.5rem', paddingRight: '1.5rem', overflowY: 'auto' }}>
                            <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                                <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>🧪</div>
                                <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: theme.text.primary, marginBottom: '0.5rem' }}>{title}</h2>
                                {subtitle && <p style={{ color: theme.text.secondary, fontSize: '0.9rem' }}>{subtitle}</p>}
                            </div>
                            {children}
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
