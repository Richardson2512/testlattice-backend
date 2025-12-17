'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createPortal } from 'react-dom'

interface GuestTestModalProps {
    isOpen: boolean
    onClose: () => void
}

export function GuestTestModal({ isOpen, onClose }: GuestTestModalProps) {
    const [url, setUrl] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [mounted, setMounted] = useState(false)
    const router = useRouter()

    useEffect(() => {
        setMounted(true)
        return () => setMounted(false)
    }, [])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!url) return

        setLoading(true)
        setError(null)

        try {
            const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/run/guest`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    url,
                    build: { type: 'web' },
                    profile: { device: 'CHROME_LATEST' }
                }),
            })

            const data = await response.json()

            if (!response.ok) {
                if (response.status === 429 || response.status === 403) {
                    setError(data.message || 'Limit reached. Please sign up to continue.')
                    return
                }
                throw new Error(data.error || 'Failed to start test')
            }

            // Redirect to guest test progress page
            router.push(`/guest/run/${data.runId}`)
        } catch (err: any) {
            setError(err.message || 'Something went wrong. Please try again.')
        } finally {
            setLoading(false)
        }
    }

    if (!isOpen || !mounted) return null

    return createPortal(
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
            onClick={onClose}
        >
            <div
                className="glass-panel"
                style={{
                    width: '100%',
                    maxWidth: '500px',
                    background: 'var(--bg-card)',
                    borderRadius: 'var(--radius-lg)',
                    padding: '2rem',
                    position: 'relative',
                    boxShadow: 'var(--shadow-xl)',
                    animation: 'scaleIn 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                }}
                onClick={(e) => e.stopPropagation()}
            >
                <button
                    onClick={onClose}
                    style={{
                        position: 'absolute',
                        top: '1rem',
                        right: '1rem',
                        background: 'none',
                        border: 'none',
                        fontSize: '1.5rem',
                        cursor: 'pointer',
                        color: 'var(--text-secondary)',
                    }}
                >
                    ×
                </button>

                <h2 style={{ marginBottom: '0.5rem', textAlign: 'center' }}>Start Instant Test</h2>
                <p style={{ textAlign: 'center', color: 'var(--text-secondary)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
                    Enter any URL to start an autonomous AI test run immediately.
                    <br />
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        (Guest Limit: 3 runs • Chrome Only • Single Page)
                    </span>
                </p>

                <form onSubmit={handleSubmit}>
                    <div style={{ marginBottom: '1.5rem' }}>
                        <input
                            type="url"
                            placeholder="https://example.com"
                            value={url}
                            onChange={(e) => setUrl(e.target.value)}
                            required
                            className="input"
                            style={{
                                width: '100%',
                                padding: '1rem',
                                fontSize: '1.1rem',
                                borderRadius: 'var(--radius-md)',
                                border: '2px solid var(--border-medium)',
                            }}
                            autoFocus
                        />
                    </div>

                    {error && (
                        <div style={{
                            padding: '0.75rem',
                            background: 'var(--maroon-50)',
                            color: 'var(--maroon-600)',
                            borderRadius: 'var(--radius-sm)',
                            marginBottom: '1rem',
                            fontSize: '0.9rem',
                            textAlign: 'center'
                        }}>
                            {error}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={loading}
                        className="btn btn-primary"
                        style={{
                            width: '100%',
                            padding: '1rem',
                            fontSize: '1.1rem',
                            opacity: loading ? 0.7 : 1,
                            cursor: loading ? 'not-allowed' : 'pointer'
                        }}
                    >
                        {loading ? 'Starting Agent...' : 'Run Analysis →'}
                    </button>
                </form>
                <style jsx>{`
                    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
                    @keyframes scaleIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
                `}</style>
            </div>
        </div>,
        document.body
    )
}
