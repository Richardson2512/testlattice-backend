'use client'

export function SocialProofSection() {
    const brands = [
        { name: 'Acme Corp', opacity: 0.7 },
        { name: 'Globex', opacity: 0.6 },
        { name: 'Soylent', opacity: 0.8 },
        { name: 'Initech', opacity: 0.65 },
        { name: 'Umbrella', opacity: 0.75 },
        { name: 'Cyberdyne', opacity: 0.7 },
    ]

    return (
        <div style={{
            padding: '3rem 0',
            borderBottom: '1px solid var(--border-subtle)',
            background: 'rgba(255,255,255,0.3)',
            backdropFilter: 'blur(10px)'
        }}>
            <div className="container" style={{ textAlign: 'center' }}>
                <p style={{
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    color: 'var(--text-muted)',
                    letterSpacing: '0.05em',
                    textTransform: 'uppercase',
                    marginBottom: '2rem'
                }}>
                    TRUSTED BY INNOVATIVE ENGINEERING TEAMS
                </p>
                <div style={{
                    display: 'flex',
                    justifyContent: 'center',
                    gap: '4rem',
                    flexWrap: 'wrap',
                    alignItems: 'center'
                }}>
                    {brands.map((brand, i) => (
                        <div key={i} style={{
                            fontSize: '1.25rem',
                            fontWeight: 700,
                            color: 'var(--text-secondary)',
                            opacity: brand.opacity,
                            filter: 'grayscale(1)',
                            transition: 'all 0.3s'
                        }}
                            onMouseEnter={e => {
                                e.currentTarget.style.filter = 'grayscale(0)'
                                e.currentTarget.style.color = 'var(--text-primary)'
                                e.currentTarget.style.opacity = '1'
                            }}
                            onMouseLeave={e => {
                                e.currentTarget.style.filter = 'grayscale(1)'
                                e.currentTarget.style.color = 'var(--text-secondary)'
                                e.currentTarget.style.opacity = String(brand.opacity)
                            }}>
                            {brand.name}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}
