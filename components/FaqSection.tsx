'use client'

import { useState } from 'react'

export function FaqSection() {
    const [openIndex, setOpenIndex] = useState<number | null>(0)

    const faqs = [
        {
            q: "How does the AI navigate my site safely?",
            a: "We use read-only guest profiles by default and execute in isolated, sandboxed containers. You can whitelist our IPs or run via our secure tunnel."
        },
        {
            q: "Do I need to install anything?",
            a: "No. TestLattice is entirely cloud-based. You just provide the URL. For local testing, we offer a CLI tunnel."
        },
        {
            q: "Can it test behind login screens?",
            a: "Yes. You can afford secure credentials in your project settings. Our agents handle authentication flows, 2FA (TOTP), and magic links."
        },
        {
            q: "How expensive is it compared to manual QA?",
            a: "Typical teams save 70% on QA costs. Our agents work 24/7 for a fraction of the cost of a manual tester's hourly rate."
        }
    ]

    return (
        <section style={{ padding: '5rem 0', background: 'var(--bg-primary)' }}>
            <div className="container" style={{ maxWidth: '800px' }}>
                <h2 style={{ fontSize: '2.5rem', marginBottom: '3rem', textAlign: 'center' }}>
                    Frequently Asked Questions
                </h2>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {faqs.map((faq, i) => (
                        <div key={i} className="glass-card" style={{
                            padding: '0',
                            overflow: 'hidden',
                            cursor: 'pointer',
                            background: openIndex === i ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.4)',
                            transition: 'all 0.3s'
                        }}
                            onClick={() => setOpenIndex(active => active === i ? null : i)}
                        >
                            <div style={{
                                padding: '1.5rem 2rem',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                fontWeight: 600,
                                fontSize: '1.1rem'
                            }}>
                                {faq.q}
                                <span style={{
                                    transform: openIndex === i ? 'rotate(180deg)' : 'rotate(0)',
                                    transition: 'transform 0.3s',
                                    color: 'var(--text-muted)'
                                }}>▼</span>
                            </div>

                            <div style={{
                                height: openIndex === i ? 'auto' : 0,
                                overflow: 'hidden',
                                transition: 'height 0.3s ease-in-out'
                            }}>
                                <div style={{
                                    padding: '0 2rem 2rem',
                                    color: 'var(--text-secondary)',
                                    lineHeight: '1.6',
                                    borderTop: openIndex === i ? '1px solid var(--border-subtle)' : 'none'
                                }}>
                                    <div style={{ paddingTop: '1rem' }}>{faq.a}</div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    )
}
