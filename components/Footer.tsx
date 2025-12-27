'use client'

import Link from 'next/link'
import Image from 'next/image'

export function Footer() {
    return (
        <footer style={{ background: 'var(--maroon-900)', padding: '4rem 0 2rem', color: 'var(--text-inverse)' }}>
            <div className="container">
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '4rem', marginBottom: '4rem' }}>
                    <div style={{ gridColumn: 'span 1' }}>
                        <div style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-inverse)' }}>
                            <Image src="/image/R-logo.png" alt="Rihario Logo" width={32} height={32} style={{ objectFit: 'contain' }} /> Rihario
                        </div>
                        <p style={{ color: 'var(--beige-200)', fontSize: '0.9rem' }}>
                            Vibe testing for solo & indie developers. Feel confident before shipping.
                        </p>
                    </div>
                    <div>
                        <h4 style={{ fontSize: '0.9rem', marginBottom: '1rem', color: 'var(--text-inverse)' }}>Product</h4>
                        <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                            <li><Link href="/features" style={{ color: 'var(--beige-300)', textDecoration: 'none' }}>Features</Link></li>
                            <li><Link href="#" style={{ color: 'var(--beige-300)', textDecoration: 'none' }}>Integrations</Link></li>
                            <li><Link href="/pricing" style={{ color: 'var(--beige-300)', textDecoration: 'none' }}>Pricing</Link></li>
                        </ul>
                    </div>
                    <div>
                        <h4 style={{ fontSize: '0.9rem', marginBottom: '1rem', color: 'var(--text-inverse)' }}>Company</h4>
                        <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                            <li><Link href="/why-rihario" style={{ color: 'var(--beige-300)', textDecoration: 'none' }}>Why Rihario?</Link></li>
                            <li><Link href="#" style={{ color: 'var(--beige-300)', textDecoration: 'none' }}>Blog</Link></li>
                            <li><Link href="/contact" style={{ color: 'var(--beige-300)', textDecoration: 'none' }}>Contact Us</Link></li>
                        </ul>
                    </div>
                    <div>
                        <h4 style={{ fontSize: '0.9rem', marginBottom: '1rem', color: 'var(--text-inverse)' }}>Legal</h4>
                        <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                            <li><Link href="#" style={{ color: 'var(--beige-300)', textDecoration: 'none' }}>Privacy Policy</Link></li>
                            <li><Link href="#" style={{ color: 'var(--beige-300)', textDecoration: 'none' }}>Terms of Service</Link></li>
                        </ul>
                    </div>
                </div>
                <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '2rem', textAlign: 'center', color: 'var(--beige-400)', fontSize: '0.85rem' }}>
                    © {new Date().getFullYear()} Rihario Inc. All rights reserved.
                </div>
            </div>
        </footer>
    )
}
