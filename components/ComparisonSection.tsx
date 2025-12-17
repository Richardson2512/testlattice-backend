'use client'

export function ComparisonSection() {
    return (
        <section style={{ padding: '5rem 0', background: 'var(--bg-secondary)' }}>
            <div className="container">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '4rem', alignItems: 'center' }}>
                    <div>
                        <h2 style={{ fontSize: '2.5rem', marginBottom: '1.5rem', lineHeight: 1.1 }}>
                            Stop Maintaining <br />
                            <span style={{ color: 'var(--maroon-500)' }}>Brittle Scripts</span>
                        </h2>
                        <p style={{ fontSize: '1.1rem', color: 'var(--text-secondary)', marginBottom: '2rem', lineHeight: 1.6 }}>
                            Traditional testing frameworks require improved selectors every time a class name changes.
                            TestLattice uses semantic understanding to find elements like a human would.
                        </p>
                        <button className="btn btn-outline">Read the Technology Whitepaper</button>
                    </div>

                    <div className="glass-panel" style={{ padding: '0', overflow: 'hidden' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
                            {/* Old Way */}
                            <div style={{ padding: '2rem', background: 'var(--bg-tertiary)', borderRight: '1px solid var(--border-default)' }}>
                                <h3 style={{ fontSize: '1.25rem', marginBottom: '1.5rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <span>❌</span> Old Way
                                </h3>
                                <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                    <li style={{ color: 'var(--text-secondary)', display: 'flex', gap: '0.75rem' }}>
                                        <span style={{ color: 'var(--text-muted)' }}>•</span> Hardcoded CSS Selectors
                                    </li>
                                    <li style={{ color: 'var(--text-secondary)', display: 'flex', gap: '0.75rem' }}>
                                        <span style={{ color: 'var(--text-muted)' }}>•</span> Manually written waits
                                    </li>
                                    <li style={{ color: 'var(--text-secondary)', display: 'flex', gap: '0.75rem' }}>
                                        <span style={{ color: 'var(--text-muted)' }}>•</span> Flaky execution
                                    </li>
                                    <li style={{ color: 'var(--text-secondary)', display: 'flex', gap: '0.75rem' }}>
                                        <span style={{ color: 'var(--text-muted)' }}>•</span> Minutes per test to write
                                    </li>
                                </ul>
                            </div>

                            {/* New Way */}
                            <div style={{ padding: '2rem', background: 'rgba(16, 185, 129, 0.05)' }}>
                                <h3 style={{ fontSize: '1.25rem', marginBottom: '1.5rem', color: 'var(--accent-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <span>⚡</span> TestLattice
                                </h3>
                                <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                    <li style={{ color: 'var(--text-primary)', fontWeight: 500, display: 'flex', gap: '0.75rem' }}>
                                        <span style={{ color: 'var(--accent-primary)' }}>✓</span> Semantic Visual Selectors
                                    </li>
                                    <li style={{ color: 'var(--text-primary)', fontWeight: 500, display: 'flex', gap: '0.75rem' }}>
                                        <span style={{ color: 'var(--accent-primary)' }}>✓</span> Auto-healing Logic
                                    </li>
                                    <li style={{ color: 'var(--text-primary)', fontWeight: 500, display: 'flex', gap: '0.75rem' }}>
                                        <span style={{ color: 'var(--accent-primary)' }}>✓</span> 99.9% Reliable
                                    </li>
                                    <li style={{ color: 'var(--text-primary)', fontWeight: 500, display: 'flex', gap: '0.75rem' }}>
                                        <span style={{ color: 'var(--accent-primary)' }}>✓</span> Zero auth time
                                    </li>
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    )
}
