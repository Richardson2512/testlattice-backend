export default function PricingPlansContent() {
  return (
    <article>
      <h1>Plans and Usage Limits Explained Simply</h1>

      <p style={{ fontSize: '1.125rem', color: 'var(--text-secondary)', marginBottom: '2rem', lineHeight: 1.7 }}>
        <strong>Rihario offers four plans: Free, Starter, Indie, and Pro.</strong> Plans differ by number of tests per month, visual test limits, and available features. Limits reset monthly. You can upgrade or downgrade anytime. Here's what each plan includes.
      </p>

      <h2>Free Plan</h2>

      <p>
        <strong>Cost:</strong> $0/month
      </p>

      <ul>
        <li><strong>5 tests per month</strong> - Basic explorations</li>
        <li><strong>No visual tests</strong> - Visual testing not available</li>
        <li><strong>Desktop browsers only</strong> - No mobile device testing</li>
        <li><strong>Basic features</strong> - Core exploration functionality</li>
        <li><strong>Public results</strong> - Results may be visible (if shared)</li>
      </ul>

      <p>
        <strong>Best for:</strong> Trying out Rihario, very occasional testing
      </p>

      <h2>Starter Plan</h2>

      <p>
        <strong>Cost:</strong> $19/month
      </p>

      <ul>
        <li><strong>50 tests per month</strong> - More frequent testing</li>
        <li><strong>10 visual tests per month</strong> - Limited visual testing</li>
        <li><strong>Desktop browsers only</strong> - No mobile device testing</li>
        <li><strong>All basic features</strong> - Full exploration capabilities</li>
        <li><strong>Private results</strong> - Results are private</li>
      </ul>

      <p>
        <strong>Best for:</strong> Solo developers, occasional testing
      </p>

      <h2>Indie Plan</h2>

      <p>
        <strong>Cost:</strong> $49/month (Recommended)
      </p>

      <ul>
        <li><strong>200 tests per month</strong> - Regular testing</li>
        <li><strong>50 visual tests per month</strong> - Good visual testing allowance</li>
        <li><strong>Mobile device testing</strong> - Test on mobile viewports</li>
        <li><strong>All features</strong> - Everything included</li>
        <li><strong>Private results</strong> - Results are private</li>
        <li><strong>Priority support</strong> - Faster response times</li>
      </ul>

      <p>
        <strong>Best for:</strong> Active solo developers, indie hackers shipping regularly
      </p>

      <h2>Pro Plan</h2>

      <p>
        <strong>Cost:</strong> $99/month
      </p>

      <ul>
        <li><strong>500 tests per month</strong> - Heavy testing</li>
        <li><strong>150 visual tests per month</strong> - Extensive visual testing</li>
        <li><strong>Mobile device testing</strong> - Test on mobile viewports</li>
        <li><strong>All features</strong> - Everything included</li>
        <li><strong>Export capabilities</strong> - Export results (add-on)</li>
        <li><strong>Priority support</strong> - Fastest response times</li>
      </ul>

      <p>
        <strong>Best for:</strong> Power users, agencies, heavy testing needs
      </p>

      <h2>Usage Limits</h2>

      <h3>Monthly Reset</h3>

      <p>
        Limits reset monthly:
      </p>

      <ul>
        <li><strong>Resets on billing date</strong> - When your subscription renews</li>
        <li><strong>Unused tests don't roll over</strong> - Use them or lose them</li>
        <li><strong>Can upgrade mid-month</strong> - Get higher limits immediately</li>
      </ul>

      <h3>What Counts as a Test</h3>

      <ul>
        <li><strong>Each exploration</strong> - One URL = one test</li>
        <li><strong>Regardless of duration</strong> - Quick or long, still one test</li>
        <li><strong>Regardless of outcome</strong> - Success or failure, still counts</li>
      </ul>

      <h3>What Counts as a Visual Test</h3>

      <ul>
        <li><strong>Visual issue detection</strong> - Visual testing enabled</li>
        <li><strong>Visual comparisons</strong> - Detailed visual analysis</li>
        <li><strong>Cross-browser visual checks</strong> - Visual testing across browsers</li>
      </ul>

      <h2>Features by Plan</h2>

      <div style={{
        background: 'var(--beige-100)',
        padding: '1.5rem',
        borderRadius: 'var(--radius-md)',
        marginTop: '2rem',
        marginBottom: '2rem',
        overflowX: 'auto',
      }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', padding: '0.75rem', borderBottom: '2px solid var(--border-medium)' }}>Feature</th>
              <th style={{ textAlign: 'left', padding: '0.75rem', borderBottom: '2px solid var(--border-medium)' }}>Free</th>
              <th style={{ textAlign: 'left', padding: '0.75rem', borderBottom: '2px solid var(--border-medium)' }}>Starter</th>
              <th style={{ textAlign: 'left', padding: '0.75rem', borderBottom: '2px solid var(--border-medium)' }}>Indie</th>
              <th style={{ textAlign: 'left', padding: '0.75rem', borderBottom: '2px solid var(--border-medium)' }}>Pro</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={{ padding: '0.75rem', borderBottom: '1px solid var(--border-light)', fontWeight: 600 }}>Tests/month</td>
              <td style={{ padding: '0.75rem', borderBottom: '1px solid var(--border-light)' }}>5</td>
              <td style={{ padding: '0.75rem', borderBottom: '1px solid var(--border-light)' }}>50</td>
              <td style={{ padding: '0.75rem', borderBottom: '1px solid var(--border-light)' }}>200</td>
              <td style={{ padding: '0.75rem', borderBottom: '1px solid var(--border-light)' }}>500</td>
            </tr>
            <tr>
              <td style={{ padding: '0.75rem', borderBottom: '1px solid var(--border-light)', fontWeight: 600 }}>Visual tests/month</td>
              <td style={{ padding: '0.75rem', borderBottom: '1px solid var(--border-light)' }}>0</td>
              <td style={{ padding: '0.75rem', borderBottom: '1px solid var(--border-light)' }}>10</td>
              <td style={{ padding: '0.75rem', borderBottom: '1px solid var(--border-light)' }}>50</td>
              <td style={{ padding: '0.75rem', borderBottom: '1px solid var(--border-light)' }}>150</td>
            </tr>
            <tr>
              <td style={{ padding: '0.75rem', borderBottom: '1px solid var(--border-light)', fontWeight: 600 }}>Mobile testing</td>
              <td style={{ padding: '0.75rem', borderBottom: '1px solid var(--border-light)' }}>❌</td>
              <td style={{ padding: '0.75rem', borderBottom: '1px solid var(--border-light)' }}>❌</td>
              <td style={{ padding: '0.75rem', borderBottom: '1px solid var(--border-light)' }}>✅</td>
              <td style={{ padding: '0.75rem', borderBottom: '1px solid var(--border-light)' }}>✅</td>
            </tr>
            <tr>
              <td style={{ padding: '0.75rem', fontWeight: 600 }}>Export results</td>
              <td style={{ padding: '0.75rem' }}>❌</td>
              <td style={{ padding: '0.75rem' }}>❌</td>
              <td style={{ padding: '0.75rem' }}>❌</td>
              <td style={{ padding: '0.75rem' }}>Add-on</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h2>Add-Ons</h2>

      <p>
        Additional features available as add-ons:
      </p>

      <ul>
        <li><strong>Additional tests</strong> - Buy more tests beyond plan limits</li>
        <li><strong>Additional visual tests</strong> - Buy more visual tests</li>
        <li><strong>Result exports</strong> - Export test results (Pro plan)</li>
      </ul>

      <p>
        See <a href="/docs/upgrading-downgrading">Upgrading, Downgrading, and Add-Ons</a> for details.
      </p>

      <h2>Choosing a Plan</h2>

      <ul>
        <li><strong>Start with Free</strong> - Try it out, see if it works for you</li>
        <li><strong>Upgrade when needed</strong> - Move up when you need more tests</li>
        <li><strong>Downgrade anytime</strong> - No long-term commitments</li>
        <li><strong>Add-ons available</strong> - Supplement plan limits with add-ons</li>
      </ul>

      <h2>Next Steps</h2>

      <ul>
        <li><a href="/pricing">View pricing page</a></li>
        <li><a href="/docs/hitting-limits">Learn what happens when you hit limits</a></li>
        <li><a href="/docs/upgrading-downgrading">See how to upgrade or downgrade</a></li>
      </ul>
    </article>
  )
}

