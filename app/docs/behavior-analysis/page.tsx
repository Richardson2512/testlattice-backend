import React from 'react'
import Link from 'next/link'

export const metadata = {
    title: 'Behavior Analysis Testing - Rihario Intelligence Engine',
    description: 'Evaluate the personality, compliance, and safety of your AI agents with Rihario\'s autonomous behavior analysis engine.',
}

export default function BehaviorAnalysisDocsPage() {
    return (
        <article>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '2rem' }}>
                <Link href="/docs" className="hover-text-primary" style={{ color: 'inherit', textDecoration: 'none' }}>Docs</Link>
                <span>/</span>
                <span style={{ color: 'var(--text-secondary)' }}>Behavior Analysis</span>
            </div>

            <h1 style={{
                fontSize: 'clamp(2.5rem, 5vw, 3.5rem)',
                fontWeight: 700,
                marginBottom: '1.5rem',
                lineHeight: 1.1,
                background: 'linear-gradient(90deg, var(--maroon-900), var(--maroon-700))',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent'
            }}>
                Behavior Analysis Testing
            </h1>

            <p style={{ fontSize: '1.25rem', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '3rem' }}>
                Go beyond functional correctness. The <strong>Rihario Intelligence Engine</strong> strictly evaluates the "soul" of your AI—testing for safety, compliance, and persona adherence under pressure.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem', marginBottom: '4rem' }}>
                <div className="glass-card" style={{ padding: '1.5rem' }}>
                    <h3 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.75rem', color: 'var(--primary)' }}>Safety & Compliance</h3>
                    <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                        Ensure your agent never leaks PII, gives medical advice, or violates regulatory standards, even when "jailbroken" by malicious users.
                    </p>
                </div>
                <div className="glass-card" style={{ padding: '1.5rem' }}>
                    <h3 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.75rem', color: 'var(--primary)' }}>Persona Adherence</h3>
                    <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                        Verify that your sales bot stays professional, your support agent remains empathetic, and your brand voice never breaks character.
                    </p>
                </div>
            </div>

            <h2 style={{ fontSize: '2rem', fontWeight: 700, marginTop: '4rem', marginBottom: '1.5rem', color: 'var(--text-primary)' }}>The Architecture of Autonomous Red-Teaming</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem', lineHeight: 1.6 }}>
                Rihario uses a scaffolded multi-model approach to "stress test" your AI. Instead of static prompts, we use dynamic agents to simulate diverse, adversarial user interactions.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', margin: '3rem 0' }}>
                {[
                    {
                        num: 1,
                        title: "The Architect",
                        desc: 'Analyzes your defined "Target Behavior" (e.g., "Must not become sycophantic") and scientifically generates test heuristics.'
                    },
                    {
                        num: 2,
                        title: "The Actor (Red Team)",
                        desc: 'Simulates thousands of conversation turns, trying different strategies (emotional manipulation, logical traps) to trigger a failure.'
                    },
                    {
                        num: 3,
                        title: "The Judge",
                        desc: 'Reads the full transcript and provides a high-fidelity score with cited evidence, eliminating human bias from the evaluation.'
                    }
                ].map((step, i) => (
                    <div key={i} style={{ display: 'flex', gap: '1.5rem', alignItems: 'flex-start' }}>
                        <div style={{
                            width: '3rem',
                            height: '3rem',
                            borderRadius: '50%',
                            background: 'var(--beige-200)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '1.25rem',
                            fontWeight: 700,
                            color: 'var(--maroon-900)',
                            flexShrink: 0
                        }}>{step.num}</div>
                        <div>
                            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.5rem' }}>{step.title}</h3>
                            <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                                {step.desc}
                            </p>
                        </div>
                    </div>
                ))}
            </div>

            <h2 style={{ fontSize: '2rem', fontWeight: 700, marginTop: '4rem', marginBottom: '1.5rem', color: 'var(--text-primary)' }}>Data Governance & Retention</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', lineHeight: 1.6 }}>
                Behavior analysis generates significant conversational data. To ensure privacy and cost-efficiency:
            </p>
            <ul style={{ listStyle: 'disc', paddingLeft: '1.5rem', color: 'var(--text-secondary)', marginBottom: '2rem', lineHeight: 1.6 }}>
                <li style={{ marginBottom: '0.5rem' }}><strong style={{ color: 'var(--text-primary)' }}>Sovereign Storage:</strong> All chat transcripts are stored in encrypted object storage (Wasabi), keeping your database lean.</li>
                <li><strong style={{ color: 'var(--text-primary)' }}>Retention Policies:</strong>
                    <ul style={{ listStyle: 'circle', paddingLeft: '1.5rem', marginTop: '0.5rem' }}>
                        <li style={{ marginBottom: '0.25rem' }}><strong style={{ color: 'var(--text-primary)' }}>Indie Tier:</strong> 90-day retention</li>
                        <li><strong style={{ color: 'var(--text-primary)' }}>Pro Tier:</strong> 365-day retention</li>
                    </ul>
                </li>
            </ul>

            <div style={{
                background: 'var(--beige-100)',
                borderRadius: 'var(--radius-lg)',
                padding: '2rem',
                marginTop: '3rem',
                textAlign: 'center'
            }}>
                <h3 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '1rem' }}>Ready to test the unseen?</h3>
                <p style={{ marginBottom: '1.5rem', color: 'var(--text-secondary)' }}>
                    Behavior Analysis is available as an add-on for Indie and Pro plans.
                </p>
                <Link href="/pricing" className="btn btn-primary" style={{
                    padding: '0.75rem 2rem'
                }}>
                    View Pricing
                </Link>
            </div>

        </article>
    )
}
