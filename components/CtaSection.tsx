'use client'

import Link from 'next/link'

export function CtaSection() {
    return (
        <section style={{ padding: '5rem 0', background: 'linear-gradient(180deg, var(--bg-primary) 0%, var(--bg-secondary) 100%)' }}>
            <div className="container">
                <div className="glass-panel" style={{
                    padding: '5rem 2rem',
                    textAlign: 'center',
                    background: 'radial-gradient(circle at center, rgba(153, 27, 27, 0.1) 0%, rgba(255,255,255,0.8) 70%)',
                    border: '1px solid rgba(153, 27, 27, 0.1)',
                    maxWidth: '1000px',
                    margin: '0 auto'
                }}>
                    <h2 style={{ fontSize: '3rem', marginBottom: '1.5rem', color: 'var(--text-primary)' }}>
                        Ready to automate the chaos?
                    </h2>
                    <p style={{
                        fontSize: '1.25rem',
                        color: 'var(--text-secondary)',
                        maxWidth: '600px',
                        margin: '0 auto 3rem',
                        lineHeight: 1.6
                    }}>
                        Join 2,000+ developers trusting TestLattice for their critical testing infrastructure.
                    </p>

                    <div style={{ display: 'flex', justifyContent: 'center', gap: '1.5rem' }}>
                        <Link href="/signup" className="btn btn-primary btn-large">
                            Start for Free
                        </Link>
                        <Link href="/demo" className="btn btn-secondary btn-large">
                            Book a Demo
                        </Link>
                    </div>

                    <p style={{ marginTop: '2rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                        No credit card required. Free forever for individuals.
                    </p>
                </div>
            </div>
        </section>
    )
}
