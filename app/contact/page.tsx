'use client'

import { LandingHeader } from '@/components/LandingHeader'
import { Footer } from '@/components/Footer'

export default function ContactPage() {
    return (
        <main style={{ minHeight: '100vh', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontFamily: 'var(--font-sans)', overflowX: 'hidden' }}>
            <LandingHeader />

            <div className="container" style={{ padding: '160px 20px 100px', maxWidth: '1200px', margin: '0 auto' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '5rem', alignItems: 'start' }}>

                    {/* LEFT: Info & Context */}
                    <div className="animate-enter">
                        <div style={{ color: 'var(--maroon-700)', fontWeight: 'bold', letterSpacing: '0.1em', fontSize: '0.875rem', textTransform: 'uppercase', marginBottom: '1.25rem' }}>
                            Support & Partnership
                        </div>
                        <h1 style={{ fontSize: 'clamp(2.5rem, 5vw, 3.5rem)', fontWeight: '800', marginBottom: '1.5rem', lineHeight: 1.1, letterSpacing: '-0.02em' }}>
                            We’re here to <br /> <span className="text-gradient">help you ship.</span>
                        </h1>
                        <p style={{ fontSize: '1.125rem', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '3.5rem', maxWidth: '500px' }}>
                            Whether you have a question about pricing, need a technical deep-dive, or want to discuss enterprise features—our team is ready.
                        </p>

                        <div style={{ display: 'grid', gap: '2.5rem' }}>
                            <ContactInfoBlock
                                icon="📧"
                                title="Email Us"
                                desc="For general inquiries and technical support."
                                action="support@rihario.com"
                            />
                            <ContactInfoBlock
                                icon="💼"
                                title="Enterprise Sales"
                                desc="For high-volume custom contracts and volume pricing."
                                action="sales@rihario.com"
                            />
                            <ContactInfoBlock
                                icon="💬"
                                title="Community"
                                desc="Join our Discord for real-time help and discussions."
                                action="discord.gg/rihario"
                            />
                        </div>
                    </div>

                    {/* RIGHT: Form */}
                    <div className="animate-enter delay-100" style={{
                        padding: '2.5rem',
                        background: 'var(--bg-card)',
                        border: '1px solid var(--border-medium)',
                        borderRadius: 'var(--radius-xl)',
                        boxShadow: 'var(--shadow-lg)'
                    }}>
                        <h2 style={{ fontSize: '1.75rem', marginBottom: '1.5rem', letterSpacing: '-0.01em' }}>Send a message</h2>
                        <form style={{ display: 'grid', gap: '1.5rem' }}>

                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1.25rem' }}>
                                <FormInput label="First Name" placeholder="Jane" />
                                <FormInput label="Last Name" placeholder="Doe" />
                            </div>

                            <FormInput label="Work Email" placeholder="jane@company.com" type="email" />

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                <label style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Topic</label>
                                <select style={{
                                    padding: '0.75rem 0.875rem',
                                    background: 'var(--beige-50)',
                                    border: '1px solid var(--border-medium)',
                                    borderRadius: 'var(--radius-md)',
                                    color: 'var(--text-primary)',
                                    fontSize: '1rem',
                                    outline: 'none',
                                    cursor: 'pointer',
                                    width: '100%'
                                }}>
                                    <option>Technical Support</option>
                                    <option>Sales Inquiry</option>
                                    <option>Billing Question</option>
                                    <option>Feature Request</option>
                                    <option>Other</option>
                                </select>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                <label style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Message</label>
                                <textarea
                                    rows={4}
                                    placeholder="How can we help you?"
                                    style={{
                                        padding: '0.75rem 0.875rem',
                                        background: 'var(--beige-50)',
                                        border: '1px solid var(--border-medium)',
                                        borderRadius: 'var(--radius-md)',
                                        color: 'var(--text-primary)',
                                        fontSize: '1rem',
                                        resize: 'vertical',
                                        fontFamily: 'inherit',
                                        outline: 'none',
                                        width: '100%'
                                    }}
                                />
                            </div>

                            <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '0.25rem', padding: '0.875rem' }}>
                                Send Message
                            </button>

                            <p style={{ textAlign: 'center', fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                                Typically responds within 2 business hours.
                            </p>
                        </form>
                    </div>

                </div>
            </div>

            <Footer />

            <style jsx>{`
                .text-gradient {
                    background: linear-gradient(135deg, var(--maroon-900) 0%, var(--maroon-600) 100%);
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                }
            `}</style>
        </main>
    )
}

// Helpers
function ContactInfoBlock({ icon, title, desc, action }: { icon: string, title: string, desc: string, action: string }) {
    return (
        <div style={{ display: 'flex', gap: '1.25rem' }}>
            <div style={{
                width: '56px',
                height: '56px',
                background: 'var(--beige-200)',
                borderRadius: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.75rem',
                border: '1px solid var(--border-light)'
            }}>
                {icon}
            </div>
            <div>
                <h3 style={{ fontSize: '1.125rem', fontWeight: 700, marginBottom: '0.25rem' }}>{title}</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', marginBottom: '0.375rem', lineHeight: 1.5 }}>{desc}</p>
                <div style={{ color: 'var(--maroon-700)', fontWeight: 600 }}>{action}</div>
            </div>
        </div>
    )
}

function FormInput({ label, placeholder, type = 'text' }: { label: string, placeholder: string, type?: string }) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <label style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-secondary)' }}>{label}</label>
            <input
                type={type}
                placeholder={placeholder}
                style={{
                    padding: '0.75rem 0.875rem',
                    background: 'var(--beige-50)',
                    border: '1px solid var(--border-medium)',
                    borderRadius: 'var(--radius-md)',
                    color: 'var(--text-primary)',
                    fontSize: '1rem',
                    outline: 'none',
                    width: '100%'
                }}
            />
        </div>
    )
}
