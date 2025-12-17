
import Link from 'next/link'
import { LandingHeader } from '@/components/LandingHeader'
import { CtaSection } from '@/components/CtaSection'
import { theme } from '@/lib/theme'
import Script from 'next/script'

export const metadata = {
    title: 'Why TestLattice? AI Testing for Indie Hackers | No Code Required',
    description: 'Discover why 1000+ indie hackers choose TestLattice for AI-powered testing. No coding required. God Mode intervention. Self-healing tests. Built for solo developers, not enterprises.',
}

export default function WhyTestLattice() {
    return (
        <main style={{ minHeight: '100vh', background: theme.bg.primary }}>
            <LandingHeader />

            <Script
                id="faq-schema"
                type="application/ld+json"
                dangerouslySetInnerHTML={{
                    __html: JSON.stringify({
                        "@context": "https://schema.org",
                        "@type": "FAQPage",
                        "mainEntity": [
                            {
                                "@type": "Question",
                                "name": "Why should I use TestLattice instead of Playwright or Cypress?",
                                "acceptedAnswer": {
                                    "@type": "Answer",
                                    "text": "TestLattice requires zero coding while Playwright and Cypress require you to write and maintain test scripts. TestLattice uses AI to generate tests automatically and includes God Mode for when AI gets stuck, achieving 95% success rate vs 60% with traditional tools."
                                }
                            },
                            {
                                "@type": "Question",
                                "name": "What is God Mode in TestLattice?",
                                "acceptedAnswer": {
                                    "@type": "Answer",
                                    "text": "God Mode is TestLattice's unique feature where you can intervene when AI gets stuck during testing. Instead of test failing, you see the live browser, click the correct element, and the AI learns and continues automatically. This patent-pending technology achieves 95% test success rate."
                                }
                            },
                            {
                                "@type": "Question",
                                "name": "Can TestLattice test my app without code?",
                                "acceptedAnswer": {
                                    "@type": "Answer",
                                    "text": "Yes. TestLattice uses AI (Llama 4 and Qwen) to analyze your pages and generate tests automatically. You describe what to test in plain English, and the AI handles all technical aspects including selectors, waits, and assertions."
                                }
                            },
                            {
                                "@type": "Question",
                                "name": "How much does TestLattice cost?",
                                "acceptedAnswer": {
                                    "@type": "Answer",
                                    "text": "TestLattice pricing starts at $19/month for Starter (50 tests), $49/month for Indie (200 tests with God Mode), and $99/month for Pro (600 tests with API access). All plans include comprehensive testing, cross-browser support, and no-code interface."
                                }
                            },
                            {
                                "@type": "Question",
                                "name": "Is TestLattice suitable for non-technical founders?",
                                "acceptedAnswer": {
                                    "@type": "Answer",
                                    "text": "Absolutely. TestLattice was designed for non-technical founders who built MVPs with no-code tools or AI assistance. The interface requires no coding knowledge, reports are in plain English, and God Mode lets you guide AI visually by clicking elements."
                                }
                            }
                        ]
                    })
                }}
            />

            {/* Hero Section */}
            <section style={{ paddingTop: '180px', paddingBottom: '80px', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
                <div className="container" style={{ position: 'relative', zIndex: 1, maxWidth: '900px' }}>
                    <h1 style={{ fontSize: '3.5rem', marginBottom: '1.5rem', lineHeight: 1.1 }}>
                        Why TestLattice? Because <span className="text-gradient">Testing Shouldn't Require a CS Degree.</span>
                    </h1>
                    <p style={{ fontSize: '1.25rem', color: theme.text.secondary, margin: '0 auto 2.5rem', lineHeight: 1.6 }}>
                        <strong style={{ color: theme.text.primary }}>Simple answer:</strong> TestLattice is the only AI testing platform built specifically for indie hackers, solo developers, and bootstrapped founders. No code. No setup nightmares. Just paste your URL and get comprehensive test results in minutes.
                    </p>
                    <div style={{ fontSize: '1.1rem', color: theme.text.secondary }}>
                        <strong>The real answer?</strong> Keep reading.
                    </div>
                </div>
            </section>

            {/* Content Container */}
            <div className="container" style={{ maxWidth: '900px', paddingBottom: '5rem' }}>

                {/* Table of Contents */}
                <div className="glass-card" style={{ padding: '2rem', marginBottom: '4rem', background: '#fff', borderRadius: '12px' }}>
                    <h3 style={{ marginBottom: '1rem' }}>Jump to your question:</h3>
                    <ul style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem 2rem', paddingLeft: '1.5rem' }}>
                        {[
                            { id: 'why-not-playwright', text: 'Why TestLattice vs Playwright?' },
                            { id: 'what-makes-different', text: 'What makes TestLattice different?' },
                            { id: 'why-ai-testing', text: 'Why do I need AI testing?' },
                            { id: 'save-time-money', text: 'How does it save time & money?' },
                            { id: 'god-mode', text: 'What is God Mode?' },
                            { id: 'no-code-testing', text: 'Does it really work without code?' },
                            { id: 'non-technical', text: 'Is it for non-technical founders?' },
                            { id: 'pricing', text: 'Why is it cheaper?' },
                            { id: 'comprehensive-testing', text: 'What can it test?' },
                            { id: 'trust', text: 'Why trust TestLattice?' },
                        ].map(item => (
                            <li key={item.id}>
                                <a href={`#${item.id}`} style={{ color: theme.accent.primary, textDecoration: 'underline' }}>{item.text}</a>
                            </li>
                        ))}
                    </ul>
                </div>

                {/* Section 1: The Core Problem */}
                <section style={{ marginBottom: '5rem' }}>
                    <h2 style={{ fontSize: '2.5rem', marginBottom: '1.5rem' }}>Why Do Indie Hackers Struggle with Testing?</h2>
                    <p style={{ fontSize: '1.1rem', lineHeight: 1.6, marginBottom: '1.5rem', color: theme.text.secondary }}>
                        <strong>Short answer:</strong> Because existing testing tools were built for QA teams at Google, not solo developers shipping MVPs from their bedroom.
                    </p>
                    <p style={{ fontSize: '1.1rem', lineHeight: 1.6, marginBottom: '1.5rem', color: theme.text.secondary }}>
                        You just spent 3 months building your product. You're exhausted. You're ready to launch. But <strong>you have no idea if it actually works.</strong>
                    </p>
                    <ul style={{ marginBottom: '2rem', paddingLeft: '1.5rem', color: theme.text.secondary, lineHeight: 1.8 }}>
                        <li>Does it work on Safari? (You only tested on Chrome)</li>
                        <li>Does it work on mobile? (You built it on a 27" monitor)</li>
                        <li>What happens when someone types <code>&lt;script&gt;alert('xss')&lt;/script&gt;</code>?</li>
                        <li>Are there console errors you never noticed?</li>
                    </ul>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
                        <div style={{ padding: '1.5rem', background: '#fee2e2', borderRadius: '8px', color: '#991b1b' }}>
                            <div style={{ fontWeight: 'bold', marginBottom: '0.5rem' }}>Traditional Solution</div>
                            Hire a QA engineer ($80K/year) or spend 2+ weeks learning Playwright.
                        </div>
                        <div style={{ padding: '1.5rem', background: '#d1fae5', borderRadius: '8px', color: '#065f46' }}>
                            <div style={{ fontWeight: 'bold', marginBottom: '0.5rem' }}>TestLattice Solution</div>
                            Paste your URL. Click test. Get results in 3 minutes.
                        </div>
                    </div>
                </section>

                <hr style={{ border: 0, borderTop: `1px solid ${theme.border.subtle}`, margin: '4rem 0' }} />

                {/* Section 2: vs Playwright */}
                <section id="why-not-playwright" style={{ marginBottom: '5rem' }}>
                    <h2 style={{ fontSize: '2.5rem', marginBottom: '1.5rem' }}>Why TestLattice Instead of Playwright?</h2>
                    <p style={{ fontSize: '1.1rem', lineHeight: 1.6, marginBottom: '2rem', color: theme.text.secondary }}>
                        <strong>Quick answer:</strong> Because Playwright requires coding. TestLattice doesn't.
                    </p>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', alignItems: 'start' }}>
                        <div className="glass-card" style={{ padding: '1.5rem', background: '#1e293b', color: '#e2e8f0' }}>
                            <h4 style={{ marginBottom: '1rem', color: '#f87171' }}>The Playwright Way</h4>
                            <pre style={{ overflowX: 'auto', background: '#0f172a', padding: '1rem', borderRadius: '6px', fontSize: '0.8rem' }}>
                                <code>
                                    {`test('login', async ({ page }) => {
    await page.goto('/login');
    await page.click('#btn-login'); // ❌ Breaks if ID changes
    await page.fill('input[name="email"]', 'user@test.com');
    await expect(page).toHaveURL('/dashboard');
});`}
                                </code>
                            </pre>
                            <ul style={{ marginTop: '1rem', fontSize: '0.9rem', color: '#cbd5e1' }}>
                                <li>❌ Requires coding knowledge</li>
                                <li>❌ Breaks when UI changes</li>
                                <li>❌ You maintain it forever</li>
                            </ul>
                        </div>

                        <div className="glass-card" style={{ padding: '1.5rem', background: '#fff' }}>
                            <h4 style={{ marginBottom: '1rem', color: '#10b981' }}>The TestLattice Way</h4>
                            <div style={{ padding: '1rem', background: '#f0fdf4', borderRadius: '6px', color: '#166534', fontStyle: 'italic', marginBottom: '1rem' }}>
                                "Test the login flow with valid credentials"
                            </div>
                            <div style={{ fontSize: '0.9rem', color: theme.text.secondary }}>
                                <strong>Result:</strong> AI figures out selectors, executes steps, and auto-heals if UI changes.
                            </div>
                            <ul style={{ marginTop: '1rem', fontSize: '0.9rem', color: theme.text.secondary }}>
                                <li>✅ Zero code required</li>
                                <li>✅ Self-healing AI agents</li>
                                <li>✅ Setup takes 10 minutes</li>
                            </ul>
                        </div>
                    </div>
                </section>

                <hr style={{ border: 0, borderTop: `1px solid ${theme.border.subtle}`, margin: '4rem 0' }} />

                {/* Section 3: Deep Dive on God Mode */}
                <section id="god-mode" style={{ marginBottom: '5rem' }}>
                    <h2 style={{ fontSize: '2.5rem', marginBottom: '1.5rem' }}>What is <span className="text-gradient">God Mode™?</span></h2>
                    <p style={{ fontSize: '1.1rem', lineHeight: 1.6, marginBottom: '2rem', color: theme.text.secondary }}>
                        AI isn't perfect. Sometimes it tries to click a button that's behind a popup. Sometimes it can't find a weirdly named input field.
                        <strong> In other tools, the test just fails. In TestLattice, you enter God Mode.</strong>
                    </p>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3rem', alignItems: 'center' }}>
                        <div>
                            <h3 style={{ marginBottom: '1rem' }}>How it works:</h3>
                            <ol style={{ paddingLeft: '1.5rem', color: theme.text.secondary, lineHeight: 1.8 }}>
                                <li style={{ marginBottom: '0.5rem' }}>The AI agent gets stuck and pauses execution.</li>
                                <li style={{ marginBottom: '0.5rem' }}>You receive an instant alert (Slack/Email).</li>
                                <li style={{ marginBottom: '0.5rem' }}>You open the <strong>Live Browser Session</strong>.</li>
                                <li style={{ marginBottom: '0.5rem' }}>You manually perform the action (e.g., click the button).</li>
                                <li style={{ marginBottom: '0.5rem' }}><strong>The AI learns from you.</strong> It records the selector and updates its strategy for next time.</li>
                            </ol>
                        </div>
                        <div className="glass-card" style={{ padding: '2rem', background: '#f8fafc', border: `1px solid ${theme.border.subtle}` }}>
                            <div style={{ marginBottom: '1rem', fontWeight: 'bold', color: theme.status.error.text }}>⚠️ AI Agent Stuck: Cannot find "Submit" button</div>
                            <div style={{ padding: '1rem', background: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '1rem' }}>
                                <div style={{ height: '12px', width: '60%', background: '#e2e8f0', marginBottom: '8px' }}></div>
                                <div style={{ height: '30px', width: '100px', background: theme.accent.primary, borderRadius: '4px', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem' }}>Submit Order</div>
                            </div>
                            <button style={{ width: '100%', padding: '0.75rem', background: theme.accent.primary, color: '#fff', borderRadius: '6px', border: 'none', fontWeight: 'bold' }}>
                                Enter God Mode & Fix It
                            </button>
                        </div>
                    </div>
                </section>

                <hr style={{ border: 0, borderTop: `1px solid ${theme.border.subtle}`, margin: '4rem 0' }} />

                {/* Section 4: Self-Healing & No Code Process */}
                <section id="no-code-testing" style={{ marginBottom: '5rem' }}>
                    <h2 style={{ fontSize: '2.5rem', marginBottom: '1.5rem' }}>How Does "No-Code" Testing Work?</h2>
                    <p style={{ fontSize: '1.1rem', lineHeight: 1.6, marginBottom: '2rem', color: theme.text.secondary }}>
                        It's a simple 4-step process that takes less than 5 minutes.
                    </p>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '2rem' }}>
                        {[
                            { step: '1', title: 'Connect Your App', desc: 'Paste your URL (localhost or production). We spin up a headless browser instantly.' },
                            { step: '2', title: 'AI Scans Your Site', desc: 'Our agents crawl your pages, identifying all interactive elements, forms, and navigation paths.' },
                            { step: '3', title: 'Describe Your Test', desc: 'Type in plain English: "User signs up with email test@example.com and verifies profile."' },
                            { step: '4', title: 'Run & Relax', desc: 'We execute the test across 50+ combinations of browsers and devices. You get a report.' }
                        ].map((item, i) => (
                            <div key={i} className="glass-card" style={{ padding: '1.5rem', background: '#fff' }}>
                                <div style={{ fontSize: '2rem', fontWeight: 'bold', color: theme.accent.primary, marginBottom: '0.5rem' }}>0{item.step}</div>
                                <h4 style={{ marginBottom: '0.5rem' }}>{item.title}</h4>
                                <p style={{ fontSize: '0.9rem', color: theme.text.secondary }}>{item.desc}</p>
                            </div>
                        ))}
                    </div>
                </section>

                <hr style={{ border: 0, borderTop: `1px solid ${theme.border.subtle}`, margin: '4rem 0' }} />

                {/* Section 5: For Non-Technical Founders */}
                <section id="non-technical" style={{ marginBottom: '5rem' }}>
                    <h2 style={{ fontSize: '2.5rem', marginBottom: '1.5rem' }}>Built for "Vibe Coding" Founders</h2>
                    <div style={{ padding: '2rem', background: 'linear-gradient(135deg, #eff6ff 0%, #fff 100%)', borderRadius: '16px', border: `1px solid ${theme.accent.blue}` }}>
                        <p style={{ fontSize: '1.2rem', lineHeight: 1.6, marginBottom: '1.5rem', color: theme.text.primary }}>
                            You used Cursor, Lovable, or v0 to build your App. You don't want to spend 3 days learning how to write E2E tests in TypeScript.
                        </p>
                        <p style={{ fontSize: '1.1rem', lineHeight: 1.6, color: theme.text.secondary }}>
                            TestLattice is the missing piece of the "Vibe Coding" stack. It allows you to maintain high quality assurance without ever touching a line of test code. Keep your momentum. Ship faster. Let AI handle the QA.
                        </p>
                    </div>
                </section>

                <hr style={{ border: 0, borderTop: `1px solid ${theme.border.subtle}`, margin: '4rem 0' }} />

                {/* Section 6: Pricing Philosophy */}
                <section id="pricing" style={{ marginBottom: '5rem' }}>
                    <h2 style={{ fontSize: '2.5rem', marginBottom: '1.5rem' }}>Why is it Cheaper? (The "Enterprise Tax")</h2>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3rem' }}>
                        <div>
                            <p style={{ fontSize: '1.1rem', lineHeight: 1.6, marginBottom: '1.5rem', color: theme.text.secondary }}>
                                Competitors like BrowserStack and mabl target Fortune 500 companies. They charge <strong>$500/month</strong> because they can. They include features you don't need (SSO, Audit Logs, dedicated support teams).
                            </p>
                            <p style={{ fontSize: '1.1rem', lineHeight: 1.6, color: theme.text.secondary }}>
                                <strong>We target Indie Hackers.</strong> We stripped out the enterprise bloat. We focused on pure testing power using efficient open-source LLMs (Llama, Qwen). This allows us to pass the savings to you.
                            </p>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1rem' }}>
                            <div style={{ padding: '1rem', background: '#f1f5f9', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', opacity: 0.7 }}>
                                <div>
                                    <div style={{ fontWeight: 'bold' }}>Typical Enterprise Tool</div>
                                    <div style={{ fontSize: '0.8rem' }}>Sales calls, annual contracts</div>
                                </div>
                                <div style={{ fontSize: '1.2rem', fontWeight: 'bold', textDecoration: 'line-through' }}>$500/mo</div>
                            </div>
                            <div style={{ padding: '1.5rem', background: '#d1fae5', borderRadius: '8px', border: '2px solid #10b981', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div>
                                    <div style={{ fontWeight: 'bold', color: '#065f46' }}>TestLattice Indie</div>
                                    <div style={{ fontSize: '0.8rem', color: '#065f46' }}>Self-serve, cancel anytime</div>
                                </div>
                                <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#065f46' }}>$49/mo</div>
                            </div>
                        </div>
                    </div>
                </section>

                <hr style={{ border: 0, borderTop: `1px solid ${theme.border.subtle}`, margin: '4rem 0' }} />

                {/* Section 7: ROI */}
                <section id="save-time-money" style={{ marginBottom: '5rem', padding: '3rem', background: theme.bg.secondary, borderRadius: '16px' }}>
                    <h2 style={{ textAlign: 'center', marginBottom: '2rem' }}>The ROI Calculation</h2>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '2rem', textAlign: 'center' }}>
                        <div>
                            <div style={{ fontSize: '3rem', fontWeight: 700, color: theme.accent.primary }}>15h</div>
                            <div>Hours saved per month</div>
                        </div>
                        <div>
                            <div style={{ fontSize: '3rem', fontWeight: 700, color: theme.accent.primary }}>$1.4K</div>
                            <div>Value of time saved</div>
                        </div>
                        <div>
                            <div style={{ fontSize: '3rem', fontWeight: 700, color: '#10b981' }}>2,900%</div>
                            <div>Return on Investment</div>
                        </div>
                    </div>
                    <p style={{ textAlign: 'center', marginTop: '2rem', color: theme.text.secondary }}>
                        Based on replacing 15 hours/month of manual testing with the $49 Indie plan.
                    </p>
                </section>

                <hr style={{ border: 0, borderTop: `1px solid ${theme.border.subtle}`, margin: '4rem 0' }} />

                {/* Section 8: Capabilities */}
                <section id="comprehensive-testing" style={{ marginBottom: '5rem' }}>
                    <h2 style={{ fontSize: '2.5rem', marginBottom: '2rem' }}>9 Types of Testing. Automatic.</h2>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.5rem' }}>
                        {[
                            { title: 'Functional', desc: 'Forms, buttons, user flows' },
                            { title: 'Visual', desc: 'Layout shifts, broken images, overflow' },
                            { title: 'Performance', desc: 'Core Web Vitals, load time' },
                            { title: 'Accessibility', desc: 'WCAG compliance, screen readers' },
                            { title: 'Security', desc: 'XSS, SQL Injection, CSRF' },
                            { title: 'SEO', desc: 'Meta tags, schema, headings' },
                            { title: 'Console Errors', desc: 'JS errors, 404 resources' },
                            { title: 'Network', desc: 'API failures, slow requests' },
                            { title: 'Cross-Browser', desc: 'Chrome, Safari, Firefox, Mobile' },

                        ].map((item, i) => (
                            <div key={i} className="glass-card" style={{ padding: '1.5rem', background: '#fff' }}>
                                <h4 style={{ marginBottom: '0.5rem' }}>{item.title}</h4>
                                <p style={{ fontSize: '0.9rem', color: theme.text.secondary }}>{item.desc}</p>
                            </div>
                        ))}
                    </div>
                </section>

                <hr style={{ border: 0, borderTop: `1px solid ${theme.border.subtle}`, margin: '4rem 0' }} />

                {/* Section 9: Trust & Social Proof */}
                <section id="trust" style={{ marginBottom: '5rem', textAlign: 'center' }}>
                    <h2 style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>Trusted by 1000+ Indie Hackers</h2>
                    <p style={{ fontSize: '1.1rem', color: theme.text.secondary, marginBottom: '3rem' }}>
                        From solo devs to YC startups, the new wave of builders use TestLattice.
                    </p>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '2rem' }}>
                        <div className="glass-card" style={{ padding: '2rem', background: '#fff', textAlign: 'left' }}>
                            <p style={{ fontStyle: 'italic', marginBottom: '1rem', color: theme.text.secondary }}>"I used to hate testing. Now I just write a sentence and it's done. God Mode saved me twice this week."</p>
                            <div style={{ fontWeight: 'bold' }}>- Sarah J., Founder of SaaSy</div>
                        </div>
                        <div className="glass-card" style={{ padding: '2rem', background: '#fff', textAlign: 'left' }}>
                            <p style={{ fontStyle: 'italic', marginBottom: '1rem', color: theme.text.secondary }}>"The pricing makes sense. BrowserStack was way too expensive for my side project."</p>
                            <div style={{ fontWeight: 'bold' }}>- Mike T., Indie Developer</div>
                        </div>
                        <div className="glass-card" style={{ padding: '2rem', background: '#fff', textAlign: 'left' }}>
                            <p style={{ fontStyle: 'italic', marginBottom: '1rem', color: theme.text.secondary }}>"Finally a testing tool that feels like it belongs in 2024. The AI actually understands my app."</p>
                            <div style={{ fontWeight: 'bold' }}>- Alex R., CTO @ StartupX</div>
                        </div>
                    </div>
                </section>

                <hr style={{ border: 0, borderTop: `1px solid ${theme.border.subtle}`, margin: '4rem 0' }} />

                {/* Section 10: Getting Started */}
                <section style={{ marginBottom: '5rem' }}>
                    <h2 style={{ fontSize: '2.5rem', marginBottom: '2rem', textAlign: 'center' }}>Start Testing in 3 Minutes</h2>
                    <div style={{ display: 'flex', justifyContent: 'center' }}>
                        <div style={{ maxWidth: '600px', width: '100%', padding: '2rem', background: '#fff', borderRadius: '12px', boxShadow: '0 4px 20px rgba(0,0,0,0.05)' }}>
                            <div style={{ display: 'flex', marginBottom: '1.5rem' }}>
                                <div style={{ marginRight: '1rem', fontWeight: 'bold', color: theme.accent.primary }}>0:00</div>
                                <div>Create Account (GitHub/Google)</div>
                            </div>
                            <div style={{ display: 'flex', marginBottom: '1.5rem' }}>
                                <div style={{ marginRight: '1rem', fontWeight: 'bold', color: theme.accent.primary }}>0:30</div>
                                <div>Add your Project URL</div>
                            </div>
                            <div style={{ display: 'flex', marginBottom: '1.5rem' }}>
                                <div style={{ marginRight: '1rem', fontWeight: 'bold', color: theme.accent.primary }}>0:45</div>
                                <div>AI Auto-Scans your site structure</div>
                            </div>
                            <div style={{ display: 'flex', marginBottom: '1.5rem' }}>
                                <div style={{ marginRight: '1rem', fontWeight: 'bold', color: theme.accent.primary }}>1:30</div>
                                <div>Write your first test prompt</div>
                            </div>
                            <div style={{ display: 'flex' }}>
                                <div style={{ marginRight: '1rem', fontWeight: 'bold', color: '#10b981' }}>3:00</div>
                                <div style={{ fontWeight: 'bold', color: '#10b981' }}>First Test Passed! 🚀</div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Section 11: Final CTA */}
                <CtaSection />

            </div>

            <footer style={{ padding: '4rem 0', textAlign: 'center', color: theme.text.secondary, fontSize: '0.9rem' }}>
                &copy; {new Date().getFullYear()} TestLattice. Defining Vibe Testing.
            </footer>
        </main>
    )
}

