'use client'

export function HowItWorksSection() {
    const steps = [
        {
            num: '01',
            title: 'Enter URL',
            desc: 'Just paste your website URL. No complex setup or installation required.',
            icon: '🔗'
        },
        {
            num: '02',
            title: 'AI Analysis',
            desc: 'Our autonomous agents crawl your site, identifying critical flows and edges.',
            icon: '🧠'
        },
        {
            num: '03',
            title: 'Instant Report',
            desc: 'Get a comprehensive report with visual diffs, accessibility scores, and bug lists.',
            icon: '📊'
        }
    ]

    return (
        <section style={{ padding: '5rem 0', background: 'var(--bg-primary)' }}>
            <div className="container">
                <div style={{ textAlign: 'center', marginBottom: '5rem' }}>
                    <h2 style={{ fontSize: '2.5rem', marginBottom: '1rem', color: 'var(--text-primary)' }}>
                        From URL to Insight in Minutes
                    </h2>
                    <p style={{ fontSize: '1.25rem', color: 'var(--text-secondary)', maxWidth: '600px', margin: '0 auto' }}>
                        Forget the weeks of boilerplate scaffolding. TestLattice is autonomous by design.
                    </p>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '3rem', position: 'relative' }}>
                    {/* Connecting Line (Desktop) */}
                    <div style={{
                        position: 'absolute',
                        top: '40px',
                        left: '15%',
                        right: '15%',
                        height: '2px',
                        background: 'linear-gradient(to right, var(--bg-tertiary), var(--accent-primary), var(--bg-tertiary))',
                        zIndex: 0
                    }} className="hide-mobile" />

                    {steps.map((step, i) => (
                        <div key={i} className="glass-card" style={{
                            padding: '3rem 2rem',
                            textAlign: 'center',
                            position: 'relative',
                            zIndex: 1,
                            backgroundColor: 'var(--bg-primary)', // Opaque to hide line behind
                            transition: 'transform 0.3s'
                        }}
                            onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-10px)'}
                            onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
                        >
                            <div style={{
                                width: '80px',
                                height: '80px',
                                margin: '0 auto 2rem',
                                background: 'var(--bg-tertiary)',
                                borderRadius: '50%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '2.5rem',
                                border: '1px solid var(--border-default)',
                                boxShadow: '0 10px 20px -5px rgba(0,0,0,0.1)'
                            }}>
                                {step.icon}
                            </div>
                            <div style={{
                                fontSize: '0.9rem',
                                color: 'var(--accent-primary)',
                                fontWeight: 700,
                                marginBottom: '0.5rem',
                                textTransform: 'uppercase',
                                letterSpacing: '0.1em'
                            }}>
                                Step {step.num}
                            </div>
                            <h3 style={{ fontSize: '1.5rem', marginBottom: '1rem', color: 'var(--text-primary)' }}>
                                {step.title}
                            </h3>
                            <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                                {step.desc}
                            </p>
                        </div>
                    ))}
                </div>
            </div>

            <style jsx>{`
                @media (max-width: 768px) {
                    .hide-mobile { display: none; }
                    .grid-cols-3 { grid-template-columns: 1fr; }
                }
            `}</style>
        </section>
    )
}
