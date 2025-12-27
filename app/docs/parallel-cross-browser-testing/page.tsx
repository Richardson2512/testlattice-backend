import { DocsHero } from '@/components/docs/DocsHero'
import { OnThisPage } from '@/components/docs/OnThisPage'
import { Callout } from '@/components/docs/Callout'
import Link from 'next/link'

export default function ParallelCrossBrowserTestingPage() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
      <DocsHero
        title="Parallel Cross-Browser Testing"
        summary="Run the same test across multiple browsers simultaneously"
      />

      <div className="container" style={{ maxWidth: '900px', margin: '0 auto', padding: '3rem 2rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: '3rem' }}>
          <aside>
            <OnThisPage />
          </aside>

          <main style={{ fontSize: '1rem', lineHeight: 1.7 }}>
            <section id="what-is-it" style={{ marginBottom: '3rem' }}>
              <h2 style={{ fontSize: '2rem', fontWeight: 700, marginBottom: '1rem' }}>What is Parallel Cross-Browser Testing?</h2>
              <p style={{ marginBottom: '1.5rem', color: 'var(--text-secondary)' }}>
                Parallel cross-browser testing lets you run the <strong>same test</strong> across multiple browsers (Chrome, Firefox, Safari) at the same time. Instead of running your test once in Chrome, then again in Firefox, then again in Safari, you run it once and get results from all browsers simultaneously.
              </p>
              <p style={{ marginBottom: '1.5rem', color: 'var(--text-secondary)' }}>
                This is <strong>not</strong> load testing. This is <strong>not</strong> multiple different scenarios. This is the exact same test, executed in parallel across different browsers, so you can see how your application behaves consistently (or inconsistently) across the web.
              </p>
            </section>

            <section id="why-it-matters" style={{ marginBottom: '3rem' }}>
              <h2 style={{ fontSize: '2rem', fontWeight: 700, marginBottom: '1rem' }}>Why It Matters</h2>
              <p style={{ marginBottom: '1.5rem', color: 'var(--text-secondary)' }}>
                Different browsers render HTML, execute JavaScript, and handle CSS differently. A button that works perfectly in Chrome might be broken in Safari. A form that validates correctly in Firefox might fail silently in Chrome. Without cross-browser testing, you're shipping blind.
              </p>
              <p style={{ marginBottom: '1.5rem', color: 'var(--text-secondary)' }}>
                Parallel cross-browser testing gives you <strong>cross-browser confidence</strong>:
              </p>
              <ul style={{ marginLeft: '1.5rem', marginBottom: '1.5rem', color: 'var(--text-secondary)' }}>
                <li>See issues that only appear in specific browsers</li>
                <li>Verify consistent behavior across all major browsers</li>
                <li>Get results faster (parallel execution vs sequential)</li>
                <li>No need to re-run tests manually for each browser</li>
              </ul>
            </section>

            <section id="how-it-works" style={{ marginBottom: '3rem' }}>
              <h2 style={{ fontSize: '2rem', fontWeight: 700, marginBottom: '1rem' }}>How It Works</h2>
              <p style={{ marginBottom: '1.5rem', color: 'var(--text-secondary)' }}>
                When you enable parallel cross-browser testing:
              </p>
              <ol style={{ marginLeft: '1.5rem', marginBottom: '1.5rem', color: 'var(--text-secondary)' }}>
                <li style={{ marginBottom: '0.75rem' }}>You select which browsers to test (Chrome, Firefox, Safari)</li>
                <li style={{ marginBottom: '0.75rem' }}>Rihario creates separate jobs for each browser</li>
                <li style={{ marginBottom: '0.75rem' }}>Each browser runs the <strong>same test</strong> in parallel</li>
                <li style={{ marginBottom: '0.75rem' }}>You get separate results for each browser</li>
                <li style={{ marginBottom: '0.75rem' }}>Results are clearly labeled by browser (e.g., "Chrome results", "Firefox results")</li>
              </ol>
              <div style={{
                padding: '1.5rem',
                background: 'var(--beige-100)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-light)',
                marginBottom: '1.5rem'
              }}>
                <strong style={{ color: 'var(--text-primary)' }}>Example:</strong>
                <p style={{ marginTop: '0.5rem', color: 'var(--text-secondary)' }}>
                  You run a login flow test with Chrome, Firefox, and Safari selected. Rihario executes the same login steps in all three browsers simultaneously. You see three separate result sets, each showing how the login flow behaved in that specific browser.
                </p>
              </div>
            </section>

            <section id="tier-availability" style={{ marginBottom: '3rem' }}>
              <h2 style={{ fontSize: '2rem', fontWeight: 700, marginBottom: '1rem' }}>Tier Availability</h2>
              <div style={{ marginBottom: '1.5rem' }}>
                <h3 style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: '0.75rem' }}>Starter</h3>
                <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                  ❌ Not available. Starter tier supports single-browser testing only (Chrome).
                </p>
              </div>
              <div style={{ marginBottom: '1.5rem' }}>
                <h3 style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: '0.75rem' }}>Indie</h3>
                <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                  ✅ Available. Choose any 2 browsers to run in parallel (e.g., Chrome + Firefox, Chrome + Safari, Firefox + Safari).
                </p>
              </div>
              <div style={{ marginBottom: '1.5rem' }}>
                <h3 style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: '0.75rem' }}>Pro</h3>
                <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                  ✅ Available. Run all 3 browsers (Chrome, Firefox, Safari) in parallel for complete cross-browser coverage.
                </p>
              </div>
              <Callout type="info" title="Upgrade">
                <p style={{ margin: 0 }}>
                  Need parallel cross-browser testing? <Link href="/pricing" style={{ color: 'var(--primary)', textDecoration: 'underline' }}>Upgrade to Indie or Pro</Link> to unlock this feature.
                </p>
              </Callout>
            </section>

            <section id="faq" style={{ marginBottom: '3rem' }}>
              <h2 style={{ fontSize: '2rem', fontWeight: 700, marginBottom: '1rem' }}>Frequently Asked Questions</h2>

              <div style={{ marginBottom: '2rem' }}>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.5rem' }}>Why might Safari behave differently?</h3>
                <p style={{ color: 'var(--text-secondary)' }}>
                  Safari uses WebKit, a different rendering engine than Chrome (Blink) or Firefox (Gecko). This can cause differences in CSS rendering, JavaScript execution, and form handling. Safari also has stricter privacy and security policies that may affect how your application behaves.
                </p>
              </div>

              <div style={{ marginBottom: '2rem' }}>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.5rem' }}>Why might results differ between browsers?</h3>
                <p style={{ color: 'var(--text-secondary)' }}>
                  Different browsers have different implementations of web standards. A feature that works in Chrome might not work in Firefox due to:
                </p>
                <ul style={{ marginLeft: '1.5rem', marginTop: '0.5rem', color: 'var(--text-secondary)' }}>
                  <li>CSS property support differences</li>
                  <li>JavaScript API availability</li>
                  <li>Form validation behavior</li>
                  <li>Cookie and storage handling</li>
                  <li>Security policy enforcement</li>
                </ul>
              </div>

              <div style={{ marginBottom: '2rem' }}>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.5rem' }}>What happens if a browser is queued?</h3>
                <p style={{ color: 'var(--text-secondary)' }}>
                  If you're running multiple browsers in parallel and the queue is busy, some browsers may start immediately while others wait. The UI will show "X running · Y queued" so you know the status. Once a slot opens, the queued browser will start automatically.
                </p>
              </div>

              <div style={{ marginBottom: '2rem' }}>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.5rem' }}>Is this the same as load testing?</h3>
                <p style={{ color: 'var(--text-secondary)' }}>
                  No. Parallel cross-browser testing runs the same test across different browsers. Load testing runs many instances of the same test to measure performance under load. These are completely different use cases.
                </p>
              </div>

              <div style={{ marginBottom: '2rem' }}>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.5rem' }}>Can I run different tests in different browsers?</h3>
                <p style={{ color: 'var(--text-secondary)' }}>
                  No. Parallel cross-browser testing runs the <strong>same test</strong> across all selected browsers. If you need different tests for different browsers, you'll need to create separate test runs.
                </p>
              </div>
            </section>
          </main>
        </div>
      </div>
    </div>
  )
}

