'use client'

import React, { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { api, TestRun } from '../../../../lib/api'
import { theme } from '../../../../lib/theme'

export default function GuestTestRunPage() {
    const params = useParams()
    const router = useRouter()
    const testId = params.testId as string
    const [testRun, setTestRun] = useState<TestRun | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    // Poll for updates
    useEffect(() => {
        let intervalId: NodeJS.Timeout

        const fetchRun = async () => {
            try {
                // Use the public GET endpoint
                const { testRun } = await api.getTestRun(testId)
                setTestRun(testRun)
                setLoading(false)

                // Stop polling if completed or failed
                if (['completed', 'failed', 'cancelled'].includes(testRun.status)) {
                    clearInterval(intervalId)
                }
            } catch (err: any) {
                console.error('Failed to fetch test run:', err)
                setError(err.message || 'Failed to load test run')
                setLoading(false)
                clearInterval(intervalId)
            }
        }

        fetchRun()
        intervalId = setInterval(fetchRun, 3000) // Poll every 3 seconds

        return () => clearInterval(intervalId)
    }, [testId])

    if (loading && !testRun) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: theme.bg.primary }}>
                <div style={{ textAlign: 'center' }}>
                    <div className="spinner" style={{
                        width: '40px', height: '40px', border: `3px solid ${theme.border.default}`,
                        borderTopColor: theme.accent.primary, borderRadius: '50%', animation: 'spin 1s linear infinite'
                    }} />
                    <p style={{ marginTop: '1rem', color: theme.text.secondary }}>Loading test run...</p>
                </div>
                <style jsx>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
        )
    }

    if (error) {
        return (
            <div style={{ padding: '2rem', textAlign: 'center', color: theme.status.error.text }}>
                <h1>Error</h1>
                <p>{error}</p>
                <Link href="/" className="btn btn-primary" style={{ marginTop: '1rem', display: 'inline-block' }}>Go Home</Link>
            </div>
        )
    }

    const isCompleted = testRun?.status === 'completed'
    const isFailed = testRun?.status === 'failed'
    const isRunning = ['running', 'diagnosing', 'queued', 'pending'].includes(testRun?.status || '')

    return (
        <div style={{ minHeight: '100vh', backgroundColor: theme.bg.primary, color: theme.text.primary, fontFamily: 'var(--font-sans)' }}>
            {/* Header */}
            <header style={{
                padding: '1rem 2rem',
                borderBottom: `1px solid ${theme.border.subtle}`,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: 'rgba(23, 23, 23, 0.8)',
                backdropFilter: 'blur(10px)',
                position: 'sticky',
                top: 0,
                zIndex: 10
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <Link href="/" style={{ fontSize: '1.25rem', fontWeight: '700', color: theme.text.primary, textDecoration: 'none' }}>
                        TestLattice
                    </Link>
                    <span style={{
                        padding: '0.25rem 0.75rem',
                        borderRadius: '999px',
                        background: theme.bg.tertiary,
                        fontSize: '0.75rem',
                        color: theme.text.secondary,
                        border: `1px solid ${theme.border.subtle}`
                    }}>
                        Guest Session
                    </span>
                </div>
                <Link href="/signup" className="btn btn-primary">
                    Sign Up to Save Results
                </Link>
            </header>

            <main style={{ maxWidth: '1000px', margin: '2rem auto', padding: '0 1rem' }}>
                {/* Status Card */}
                <div className="glass-panel" style={{ padding: '2rem', marginBottom: '2rem', textAlign: 'center' }}>
                    <h1 style={{ fontSize: '2rem', marginBottom: '1rem' }}>
                        {isRunning && 'Running AI Analysis...'}
                        {isCompleted && 'Analysis Complete'}
                        {isFailed && 'Analysis Failed'}
                    </h1>

                    <div style={{ display: 'flex', justifyContent: 'center', gap: '2rem', marginTop: '2rem' }}>
                        <StatusItem label="URL" value={testRun?.build.url || 'Unknown'} />
                        <StatusItem label="Status" value={testRun?.status?.toUpperCase()} color={
                            isCompleted ? theme.accent.green : isFailed ? theme.accent.red : theme.accent.blue
                        } />
                        <StatusItem label="Steps" value={testRun?.steps?.length?.toString() || '0'} />
                    </div>

                    {isRunning && (
                        <div style={{ marginTop: '2rem' }}>
                            <p style={{ color: theme.text.secondary, marginBottom: '1rem' }}>
                                Our agents are browsing your site looking for issues. This normally takes 1-2 minutes.
                            </p>
                            <div style={{
                                height: '4px',
                                background: theme.bg.tertiary,
                                borderRadius: '2px',
                                overflow: 'hidden',
                                maxWidth: '400px',
                                margin: '0 auto'
                            }}>
                                <div style={{
                                    height: '100%',
                                    background: theme.accent.primary,
                                    width: '100%',
                                    animation: 'progress 2s infinite ease-in-out',
                                    transformOrigin: 'left'
                                }} />
                            </div>
                        </div>
                    )}
                </div>

                {/* Results Preview (Blurred/Limited) */}
                {isCompleted && (
                    <div style={{ position: 'relative' }}>
                        <div style={{
                            filter: 'blur(4px)',
                            opacity: 0.6,
                            pointerEvents: 'none',
                            userSelect: 'none'
                        }}>
                            {/* Fake Report Content for Preview */}
                            <div className="glass-panel" style={{ padding: '2rem', marginBottom: '1rem' }}>
                                <h2 style={{ marginBottom: '1rem' }}>Executive Summary</h2>
                                <p>Found 5 critical accessibility issues and 2 performance bottlenecks.</p>
                                <div style={{ height: '200px', background: theme.bg.tertiary, marginTop: '1rem', borderRadius: theme.radius.md }} />
                            </div>
                            <div className="glass-panel" style={{ padding: '2rem' }}>
                                <h2 style={{ marginBottom: '1rem' }}>Detailed Steps</h2>
                                {[1, 2, 3].map(i => (
                                    <div key={i} style={{ padding: '1rem', borderBottom: `1px solid ${theme.border.subtle}` }}>
                                        <div style={{ width: '60%', height: '1rem', background: theme.bg.tertiary, marginBottom: '0.5rem' }} />
                                        <div style={{ width: '40%', height: '0.8rem', background: theme.bg.tertiary }} />
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* CTA Overlay */}
                        <div style={{
                            position: 'absolute',
                            top: '50%',
                            left: '50%',
                            transform: 'translate(-50%, -50%)',
                            textAlign: 'center',
                            width: '80%',
                            maxWidth: '500px'
                        }}>
                            <div className="glass-card" style={{
                                padding: '3rem',
                                background: 'rgba(23, 23, 23, 0.95)',
                                border: `1px solid ${theme.accent.primary}`,
                                boxShadow: `0 0 50px ${theme.accent.primary}20`
                            }}>
                                <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem', color: theme.text.primary }}>
                                    Unlock Your Full Report
                                </h2>
                                <p style={{ color: theme.text.secondary, marginBottom: '2rem' }}>
                                    Create a free account to view detailed insights, screenshots, and fix recommendations.
                                </p>
                                <Link href="/signup" className="btn btn-primary btn-large" style={{ width: '100%', display: 'block', textAlign: 'center' }}>
                                    Create Free Account →
                                </Link>
                                <p style={{ marginTop: '1rem', fontSize: '0.8rem', color: theme.text.muted }}>
                                    No credit card required • 30-day retention
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                <style jsx>{`
            @keyframes progress {
                0% { transform: scaleX(0); }
                50% { transform: scaleX(0.7); }
                100% { transform: scaleX(1); opacity: 0; }
            }
        `}</style>
            </main>
        </div>
    )
}

function StatusItem({ label, value, color }: { label: string, value: string, color?: string }) {
    return (
        <div>
            <div style={{ fontSize: '0.8rem', color: theme.text.secondary, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {label}
            </div>
            <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: color || theme.text.primary, marginTop: '0.25rem' }}>
                {value}
            </div>
        </div>
    )
}
