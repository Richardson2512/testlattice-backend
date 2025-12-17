import Link from 'next/link'
import { LandingHeader } from '@/components/LandingHeader'
import { InteractiveBrowserStack } from '@/components/InteractiveBrowserStack'

// SVG Logos for "Real" look
const Logos = {
    Jira: <svg viewBox="0 0 24 24" fill="#0052CC" width="32" height="32"><path d="M11.53 16.03l-7.79 6.24c-1.8 1.44-4.52.16-4.52-2.14V7.59c0-1.4 1.63-2.17 2.7-1.28l9.61 7.99v1.73zm1.25-6.05l7.79-6.25c1.8-1.44 4.52-.16 4.52 2.14v12.54c0 1.4-1.63 2.17-2.7 1.28l-9.61-7.98V10l-.01-.02zM12.78 2.2l-1.25-1.03C10.73.53 10.04.18 9.29.18H9.27c-.8 0-1.54.39-1.99 1.05L.86 11.23c-.76 1.13.05 2.65 1.41 2.65h.02c.4 0 .8-.15 1.1-.42l9.39-8.45V2.2z" /></svg>,
    Slack: <svg viewBox="0 0 24 24" fill="currentColor" width="32" height="32"><path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.52 2.52 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.52V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.522 2.521 2.527 2.527 0 0 1-2.522-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.522 2.522v6.312zM15.165 18.956a2.528 2.528 0 0 1 2.522 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.522-2.522v-2.52h2.522zM15.165 17.688a2.527 2.527 0 0 1-2.522-2.522 2.527 2.527 0 0 1 2.522-2.522h6.312A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.521h-6.312z" /></svg>,
    GitHub: <svg viewBox="0 0 24 24" fill="currentColor" width="32" height="32"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" /></svg>,
    Linear: <svg viewBox="0 0 24 24" fill="currentColor" width="32" height="32"><path d="M11.968 1.487a1.5 1.5 0 0 1 1.29 0l9.366 5.373a1.5 1.5 0 0 1 .74 1.366v10.126a1.5 1.5 0 0 1-.722 1.365l-9.366 5.4a1.5 1.5 0 0 1-1.5 0l-9.366-5.4a1.5 1.5 0 0 1-.722-1.366V6.155a1.5 1.5 0 0 1 .792-1.3l9.488-5.368ZM12 3.15 3.75 7.89v8.22L12 20.85l8.25-4.74V7.89L12 3.15Z" /></svg>,
    Chrome: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="40" height="40"><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="4" /><line x1="21.17" y1="8" x2="12" y2="8" /><line x1="3.95" y1="6.06" x2="8.54" y2="14" /><line x1="10.88" y1="21.94" x2="15.46" y2="14" /></svg>,
    Safari: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="40" height="40"><circle cx="12" cy="12" r="10" /><path d="M22 12A10 10 0 1 1 12 2a10 10 0 0 1 10 10Z" /><path d="m15.43 8.57-5.86 5.86" /><path d="m9.57 15.43 5.86-5.86" /><path d="M12 2v2" /><path d="M12 20v2" /><path d="M2 12h2" /><path d="M20 12h2" /></svg>,
    Firefox: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="40" height="40"><path d="M15.6 11.6a5.5 5.5 0 1 1-6-4.5" /><path d="M12 2a10 10 0 1 0 10 10" /></svg>
}

// Reusable Components
const SectionLabel = ({ text, color = 'var(--primary)' }: { text: string, color?: string }) => (
    <div style={{ color, fontWeight: 'bold', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '1rem', fontSize: '0.85rem' }}>
        {text}
    </div>
)

const CheckItem = ({ text }: { text: string }) => (
    <li style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', fontSize: '1rem' }}>
        <span style={{ color: 'var(--success)', fontSize: '1.25rem' }}>✓</span>
        <span dangerouslySetInnerHTML={{ __html: text }} />
    </li>
)

export default function FeaturesPage() {
    return (
        <main style={{ minHeight: '100vh', background: 'var(--bg-primary)', overflowX: 'hidden' }}>
            <LandingHeader />

            {/* Hero */}
            <section style={{ paddingTop: '160px', paddingBottom: '60px', textAlign: 'center' }}>
                <div className="container">
                    <h1 style={{ marginBottom: '1.5rem', fontSize: '3.5rem', lineHeight: 1.1 }}>
                        The Complete <span className="text-gradient">Intelligence Suite</span>
                    </h1>
                    <p style={{ fontSize: '1.25rem', color: 'var(--text-secondary)', maxWidth: '700px', margin: '0 auto 1.5rem', lineHeight: 1.6 }}>
                        Everything you need to ship confident, bug-free web applications. From autonomous healing to pixel-perfect visual regression.
                    </p>
                </div>
            </section>

            {/* 1. GOD MODE (Differentiator) */}
            <section style={{ padding: '0 0 6rem' }}>
                <div className="container">
                    <div className="glass-panel" style={{ padding: '0', overflow: 'hidden', border: '1px solid var(--primary)', boxShadow: '0 0 40px rgba(185, 28, 28, 0.1)' }}>
                        <div style={{ padding: '4rem', textAlign: 'center', background: 'var(--bg-secondary)' }}>
                            <SectionLabel text="EXCLUSIVE FEATURE" color="var(--primary)" />
                            <h2 style={{ fontSize: '3rem', marginBottom: '1.5rem' }}>God Mode Virtual Browser</h2>
                            <p style={{ maxWidth: '700px', margin: '0 auto 3rem', color: 'var(--text-secondary)', fontSize: '1.1rem' }}>
                                Take control. Watch your tests run live in a high-performance virtual browser. Intervene, debug, and fix selectors in real-time without leaving your dashboard.
                            </p>

                            {/* Virtual Browser Visual */}
                            <div style={{
                                maxWidth: '1000px', margin: '0 auto', background: '#111', borderRadius: '12px 12px 0 0',
                                border: '1px solid #333', boxShadow: '0 20px 60px rgba(0,0,0,0.4)', overflow: 'hidden'
                            }}>
                                {/* Browser Toolbar */}
                                <div style={{
                                    height: '40px', background: '#222', borderBottom: '1px solid #333', display: 'flex',
                                    alignItems: 'center', padding: '0 1rem', gap: '1rem'
                                }}>
                                    <div style={{ display: 'flex', gap: '6px' }}>
                                        <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#ff5f56' }} />
                                        <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#ffbd2e' }} />
                                        <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#27c93f' }} />
                                    </div>
                                    <div style={{
                                        flex: 1, height: '26px', background: '#000', borderRadius: '4px', display: 'flex',
                                        alignItems: 'center', justifyContent: 'center', color: '#666', fontSize: '0.8rem', fontFamily: 'monospace'
                                    }}>
                                        🔒 test-lattice-cloud-runner-v2.us-east-1.internal
                                    </div>
                                </div>
                                {/* Browser Content */}
                                <div style={{ height: '400px', position: 'relative', background: '#fff' }}>
                                    {/* Webpage Content */}
                                    <div style={{ padding: '2rem' }}>
                                        <div style={{ width: '150px', height: '30px', background: '#eee', marginBottom: '2rem' }} />
                                        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '2rem' }}>
                                            <div>
                                                <div style={{ height: '20px', background: '#f5f5f5', marginBottom: '1rem', width: '80%' }} />
                                                <div style={{ height: '20px', background: '#f5f5f5', marginBottom: '1rem' }} />
                                                <div style={{ height: '20px', background: '#f5f5f5', marginBottom: '1rem', width: '60%' }} />
                                                <div style={{ width: '120px', height: '40px', background: 'var(--primary)', borderRadius: '4px', marginTop: '2rem', opacity: 0.8 }} />
                                            </div>
                                            <div style={{ height: '200px', background: '#f9f9f9', borderRadius: '8px' }} />
                                        </div>
                                    </div>
                                    {/* Cursor Overlay */}
                                    <div style={{
                                        position: 'absolute', top: '50%', left: '40%',
                                        padding: '0.5rem 1rem', background: 'var(--success)', color: '#000', borderRadius: '20px',
                                        fontSize: '0.8rem', fontWeight: 'bold', boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                                        transform: 'translate(-50%, -50%)', zIndex: 10
                                    }}>
                                        AI Agent Generating Input...
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* 2. Intelligence Engine */}
            <section style={{ padding: '4rem 0' }}>
                <div className="container">
                    <div className="glass-panel" style={{ padding: '0', overflow: 'hidden' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', alignItems: 'center' }}>
                            <div style={{ padding: '4rem' }}>
                                <SectionLabel text="AUTONOMOUS HEALING" />
                                <h2 style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>Intelligence Engine</h2>
                                <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '2rem', fontSize: '1.1rem' }}>
                                    Your tests shouldn't break just because a CSS class changed. TestLattice uses a proprietary multimodal Large Action Model (LAM) to understand the semantic meaning of your UI.
                                </p>
                                <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                    <CheckItem text="<strong>Self-Healing:</strong> Automatically fixes broken selectors in < 50ms." />
                                    <CheckItem text="<strong>Adapts to Change:</strong> Understands 'Submit' even if the ID changes." />
                                    <CheckItem text="<strong>Confidence Score:</strong> Detailed logic for every AI decision." />
                                </ul>
                            </div>
                            <div style={{
                                height: '100%', minHeight: '500px', background: '#0f172a',
                                display: 'flex', alignItems: 'center', justifyContent: 'center'
                            }}>
                                <div style={{ fontFamily: 'monospace', color: 'var(--success)', background: 'rgba(0,0,0,0.3)', padding: '2rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)' }}>
                                    <div style={{ opacity: 0.5 }}>&gt; Locating #submit-btn... ❌ Not Found</div>
                                    <div style={{ margin: '1rem 0', color: '#fbbf24' }}>&gt; AI Analysis: Feature detected as 'Checkout Button'</div>
                                    <div style={{ color: '#fff' }}>&gt; Target updated to [data-testid="checkout-v2"]</div>
                                    <div style={{ color: 'var(--success)', marginTop: '0.5rem' }}>&gt; Click successful (99.8% confidence)</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* 3. Deep Insights (Reports) */}
            <section style={{ padding: '4rem 0' }}>
                <div className="container">
                    <div className="glass-panel" style={{ padding: '0', overflow: 'hidden' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', alignItems: 'center', direction: 'rtl' }}>
                            <div style={{ padding: '4rem', direction: 'ltr' }}>
                                <SectionLabel text="REPORTING & ANALYTICS" />
                                <h2 style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>Deep Insights</h2>
                                <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '2rem', fontSize: '1.1rem' }}>
                                    Stop guessing why your tests failed. Get instant visual diffs, trace logs, and video replays for every single run.
                                </p>
                                <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                    <CheckItem text="<strong>Video Replay:</strong> Watch the exact moment of failure." />
                                    <CheckItem text="<strong>Network Traces:</strong> HAR logs to debug API latency." />
                                    <CheckItem text="<strong>Flake Detection:</strong> Identify unstable tests over time." />
                                </ul>
                            </div>
                            <div style={{
                                height: '100%', minHeight: '500px', background: '#f8fafc',
                                display: 'flex', alignItems: 'center', justifyContent: 'center'
                            }}>
                                {/* Analytics Mockup */}
                                <div style={{ width: '80%', background: '#fff', borderRadius: '12px', boxShadow: '0 20px 40px rgba(0,0,0,0.1)', overflow: 'hidden', border: '1px solid #e2e8f0' }}>
                                    <div style={{ padding: '1.5rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between' }}>
                                        <div style={{ fontWeight: 'bold' }}>Test Run #8291</div>
                                        <div style={{ color: '#dc2626', background: '#fee2e2', padding: '2px 8px', borderRadius: '4px', fontSize: '0.8rem' }}>Failed</div>
                                    </div>
                                    <div style={{ padding: '2rem', display: 'flex', gap: '1rem', alignItems: 'flex-end', height: '200px' }}>
                                        {[60, 80, 40, 90, 30, 85, 45].map((h, i) => (
                                            <div key={i} style={{ flex: 1, height: `${h}%`, background: h < 50 ? '#ef4444' : '#10b981', borderRadius: '4px 4px 0 0', opacity: 0.8 }} />
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* 4. Cross-Platform Browser Universe */}
            <section style={{ padding: '4rem 0' }}>
                <div className="container">
                    <div style={{ textAlign: 'center', marginBottom: '4rem' }}>
                        <SectionLabel text="DEVICE MULTIVERSE" />
                        <h2 style={{ fontSize: '2.5rem' }}>Test Everywhere</h2>
                        <p style={{ color: 'var(--text-secondary)', maxWidth: '600px', margin: '1rem auto 0' }}>Real desktop browsers, high-fidelity mobile emulation.</p>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
                        {/* Desktop Browsers */}
                        <div className="glass-panel" style={{ padding: '3rem' }}>
                            <h3 style={{ marginBottom: '2rem', fontSize: '1.5rem' }}>Desktop Browsers</h3>
                            <InteractiveBrowserStack />
                        </div>

                        {/* Mobile Devices with Real UI */}
                        <div className="glass-panel" style={{ padding: '3rem' }}>
                            <h3 style={{ marginBottom: '2rem', fontSize: '1.5rem', textAlign: 'center' }}>Mobile Device Browsers</h3>
                            <div style={{ display: 'flex', justifyContent: 'center', gap: '2rem', alignItems: 'center' }}>
                                {/* iPhone with Safari UI */}
                                <div style={{ width: '160px', height: '320px', background: '#000', borderRadius: '24px', border: '6px solid #1c1c1e', overflow: 'hidden', position: 'relative' }}>
                                    <div style={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', width: '30%', height: '15px', background: '#1c1c1e', borderRadius: '0 0 8px 8px', zIndex: 10 }} />
                                    <div style={{ background: '#fff', width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
                                        <div style={{ flex: 1, background: '#f2f2f7', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8e8e93' }}>Web Content</div>
                                        <div style={{ height: '44px', background: '#f9f9f9', borderTop: '1px solid #d1d1d6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', color: '#007aff' }}>
                                            <div style={{ background: '#e3e3e8', padding: '4px 12px', borderRadius: '8px', color: '#000', width: '80%', textAlign: 'center' }}>apple.com</div>
                                        </div>
                                        <div style={{ height: '20px', background: '#fff' }} /> {/* Home indicator area */}
                                    </div>
                                </div>

                                {/* Samsung with Chrome UI */}
                                <div style={{ width: '170px', height: '330px', background: '#000', borderRadius: '4px', border: '2px solid #333', overflow: 'hidden' }}>
                                    <div style={{ background: '#fff', width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
                                        <div style={{ height: '40px', background: '#f1f3f4', borderBottom: '1px solid #dadce0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem' }}>
                                            <div style={{ background: '#fff', padding: '4px 12px', borderRadius: '20px', color: '#202124', width: '80%', textAlign: 'left', boxShadow: '0 1px 2px rgba(0,0,0,0.1)' }}>google.com</div>
                                        </div>
                                        <div style={{ flex: 1, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#5f6368' }}>Web Content</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* 5. Integrations Row */}
            <section style={{ padding: '4rem 0', borderTop: '1px solid var(--border-light)', borderBottom: '1px solid var(--border-light)', background: '#fff' }}>
                <div className="container" style={{ textAlign: 'center' }}>
                    <SectionLabel text="TRUSTED ECOSYSTEM" color="#666" />
                    <div style={{
                        display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '4rem', flexWrap: 'wrap',
                        opacity: 0.8, filter: 'grayscale(100%)', transition: 'filter 0.3s'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600, fontSize: '1.25rem' }}>{Logos.Jira} Jira</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600, fontSize: '1.25rem' }}>{Logos.Slack} Slack</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600, fontSize: '1.25rem' }}>{Logos.Linear} Linear</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600, fontSize: '1.25rem' }}>{Logos.GitHub} GitHub</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600, fontSize: '1.25rem' }}>GitLab</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600, fontSize: '1.25rem' }}>CircleCI</div>
                    </div>
                </div>
            </section>

            {/* 6. Enterprise Security */}
            <section style={{ padding: '6rem 0' }}>
                <div className="container">
                    <div style={{ textAlign: 'center', marginBottom: '4rem' }}>
                        <h2 style={{ fontSize: '2.5rem' }}>Enterprise Grade Security</h2>
                        <p style={{ color: 'var(--text-secondary)' }}>Review our compliance reports anytime.</p>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'center', gap: '2rem', flexWrap: 'wrap' }}>
                        {['SOC2 Ready', 'HIPAA Ready', 'GDPR Ready', 'ISO Ready'].map((badge, i) => (
                            <div key={i} style={{
                                width: '200px', height: '140px', border: '1px solid #d1d5db', borderRadius: '4px',
                                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                                background: '#fff', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                            }}>
                                <div style={{
                                    width: '50px', height: '50px', background: '#f3f4f6', borderRadius: '50%', marginBottom: '1rem',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem'
                                }}>
                                    🛡️
                                </div>
                                <div style={{ fontWeight: 'bold', color: '#374151' }}>{badge}</div>
                                <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: '0.25rem' }}>Compliance Ready</div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer style={{ background: 'var(--beige-100)', padding: '4rem 0 2rem' }}>
                <div className="container">
                    <div style={{ borderTop: '1px solid var(--border-medium)', paddingTop: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                        © {new Date().getFullYear()} TestLattice Inc. All rights reserved.
                    </div>
                </div>
            </footer>
        </main>
    )
}
