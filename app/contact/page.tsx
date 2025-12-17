'use client'

import { LandingHeader } from '@/components/LandingHeader'

const COLORS = {
    primary: '#b91c1c', // maroon-700
    bg: '#0f172a',      // slate-900
    bgPanel: '#1e293b', // slate-800
    text: '#f8fafc',    // slate-50
    textMuted: '#94a3b8', // slate-400
    border: '#334155'   // slate-700
}

export default function ContactPage() {
    return (
        <main style={{ minHeight: '100vh', background: COLORS.bg, color: COLORS.text, fontFamily: 'var(--font-inter)' }}>
            <LandingHeader />

            <div className="container" style={{ padding: '120px 20px 80px', maxWidth: '1200px', margin: '0 auto' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4rem', alignItems: 'center' }}>

                    {/* LEFT: Info & Context */}
                    <div>
                        <div style={{ color: COLORS.primary, fontWeight: 'bold', letterSpacing: '2px', fontSize: '0.85rem', textTransform: 'uppercase', marginBottom: '1rem' }}>
                            GLOBAL SUPPORT
                        </div>
                        <h1 style={{ fontSize: '3rem', fontWeight: '800', marginBottom: '1.5rem', lineHeight: 1.1 }}>
                            We’re here to <br /> <span className="text-gradient">help you ship.</span>
                        </h1>
                        <p style={{ fontSize: '1.1rem', color: COLORS.textMuted, lineHeight: 1.6, marginBottom: '3rem' }}>
                            Whether you have a question about pricing, need a custom enterprise plan, or found a bug in the matrix—our team is ready to assist.
                        </p>

                        <div style={{ display: 'grid', gap: '2rem' }}>
                            <ContactInfoBlock
                                icon="📧"
                                title="Email Us"
                                desc="For general inquiries and support."
                                action="support@testlattice.com"
                            />
                            <ContactInfoBlock
                                icon="💼"
                                title="Enterprise Sales"
                                desc="For high-volume custom contracts."
                                action="sales@testlattice.com"
                            />
                            <ContactInfoBlock
                                icon="💬"
                                title="Community"
                                desc="Join our Discord for real-time help."
                                action="discord.gg/testlattice"
                            />
                        </div>
                    </div>

                    {/* RIGHT: Form */}
                    <div className="glass-panel" style={{ padding: '3rem', background: COLORS.bgPanel, border: `1px solid ${COLORS.border}`, borderRadius: '16px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }}>
                        <h2 style={{ fontSize: '1.5rem', marginBottom: '2rem' }}>Send a request</h2>
                        <form style={{ display: 'grid', gap: '1.5rem' }}>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                                <FormInput label="First Name" placeholder="Jane" />
                                <FormInput label="Last Name" placeholder="Doe" />
                            </div>

                            <FormInput label="Work Email" placeholder="jane@company.com" type="email" />

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                <label style={{ fontSize: '0.9rem', fontWeight: 500, color: COLORS.textMuted }}>Subject</label>
                                <select style={{
                                    padding: '0.75rem', background: '#0f172a', border: `1px solid ${COLORS.border}`,
                                    borderRadius: '6px', color: '#fff', fontSize: '1rem'
                                }}>
                                    <option>Sales Inquiry</option>
                                    <option>Technical Support</option>
                                    <option>Bug Report</option>
                                    <option>Other</option>
                                </select>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                <label style={{ fontSize: '0.9rem', fontWeight: 500, color: COLORS.textMuted }}>Message</label>
                                <textarea
                                    rows={4}
                                    placeholder="Tell us more about your needs..."
                                    style={{
                                        padding: '0.75rem', background: '#0f172a', border: `1px solid ${COLORS.border}`,
                                        borderRadius: '6px', color: '#fff', fontSize: '1rem', resize: 'vertical', fontFamily: 'inherit'
                                    }}
                                />
                            </div>

                            <button type="submit" style={{
                                marginTop: '1rem', padding: '1rem', background: COLORS.primary, color: '#fff',
                                border: 'none', borderRadius: '6px', fontWeight: 600, fontSize: '1rem', cursor: 'pointer',
                                transition: 'filter 0.2s'
                            }}>
                                Send Message
                            </button>

                        </form>
                    </div>

                </div>
            </div>
        </main>
    )
}

// Helpers
function ContactInfoBlock({ icon, title, desc, action }: { icon: string, title: string, desc: string, action: string }) {
    return (
        <div style={{ display: 'flex', gap: '1rem' }}>
            <div style={{
                width: '48px', height: '48px', background: 'rgba(255,255,255,0.05)', borderRadius: '10px',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem'
            }}>
                {icon}
            </div>
            <div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '0.25rem' }}>{title}</h3>
                <p style={{ color: COLORS.textMuted, fontSize: '0.9rem', marginBottom: '0.25rem' }}>{desc}</p>
                <div style={{ color: COLORS.primary, fontWeight: 500 }}>{action}</div>
            </div>
        </div>
    )
}

function FormInput({ label, placeholder, type = 'text' }: { label: string, placeholder: string, type?: string }) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <label style={{ fontSize: '0.9rem', fontWeight: 500, color: COLORS.textMuted }}>{label}</label>
            <input
                type={type}
                placeholder={placeholder}
                style={{
                    padding: '0.75rem', background: '#0f172a', border: `1px solid ${COLORS.border}`,
                    borderRadius: '6px', color: '#fff', fontSize: '1rem'
                }}
            />
        </div>
    )
}
