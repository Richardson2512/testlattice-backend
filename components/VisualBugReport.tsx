'use client'

interface VisualBug {
  type: string
  description: string
  severity: 'high' | 'medium' | 'low'
  screenshot?: string
  recommendation?: string
  selector?: string
  element?: string
  expectedValue?: string
  actualValue?: string
}

interface VisualBugReportProps {
  visualIssues: VisualBug[]
}

export function VisualBugReport({ visualIssues }: VisualBugReportProps) {
  if (!visualIssues || visualIssues.length === 0) {
    return (
      <div style={{
        padding: '2rem',
        background: 'var(--success-bg)',
        borderRadius: 'var(--radius-lg)',
        border: '2px solid var(--success)',
        textAlign: 'center',
        marginBottom: '2rem'
      }}>
        <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>✅</div>
        <div style={{ fontSize: '1.25rem', fontWeight: '600', color: 'var(--success)' }}>
          No Visual Bugs Detected!
        </div>
        <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
          Your application passed all visual checks
        </div>
      </div>
    )
  }
  
  const critical = visualIssues.filter(i => i.severity === 'high')
  const warnings = visualIssues.filter(i => i.severity === 'medium')
  const info = visualIssues.filter(i => i.severity === 'low')
  
  return (
    <div style={{
      background: 'var(--bg-secondary)',
      padding: '2rem',
      borderRadius: 'var(--radius-xl)',
      border: '1px solid var(--border-medium)',
      marginBottom: '2rem'
    }}>
      <h2 style={{
        fontSize: '1.5rem',
        fontWeight: '700',
        color: 'var(--text-primary)',
        marginBottom: '1rem',
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem'
      }}>
        <span>🎨</span> Visual Bug Report
      </h2>
      
      {/* Summary */}
      <div style={{
        display: 'flex',
        gap: '1rem',
        marginBottom: '1.5rem',
        padding: '1rem',
        background: 'var(--bg-tertiary)',
        borderRadius: 'var(--radius-md)'
      }}>
        <div>
          <span style={{ fontSize: '1.5rem', fontWeight: '700', color: 'var(--error)' }}>
            {critical.length}
          </span>
          <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}> Critical</span>
        </div>
        <div style={{ borderLeft: '1px solid var(--border-medium)', paddingLeft: '1rem' }}>
          <span style={{ fontSize: '1.5rem', fontWeight: '700', color: 'var(--warning)' }}>
            {warnings.length}
          </span>
          <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}> Warning</span>
        </div>
        <div style={{ borderLeft: '1px solid var(--border-medium)', paddingLeft: '1rem' }}>
          <span style={{ fontSize: '1.5rem', fontWeight: '700', color: 'var(--text-primary)' }}>
            {info.length}
          </span>
          <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}> Info</span>
        </div>
      </div>
      
      {/* Issues List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {visualIssues.map((issue, index) => (
          <div key={index} style={{
            padding: '1.5rem',
            background: 'var(--bg-card)',
            borderRadius: 'var(--radius-lg)',
            border: `2px solid ${
              issue.severity === 'high' ? 'var(--error)' :
              issue.severity === 'medium' ? 'var(--warning)' :
              'var(--border-light)'
            }`,
            boxShadow: 'var(--shadow-md)'
          }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '0.75rem' }}>
              <div style={{
                display: 'inline-block',
                padding: '0.25rem 0.75rem',
                borderRadius: 'var(--radius-full)',
                fontSize: '0.75rem',
                fontWeight: '600',
                background: issue.severity === 'high' ? 'var(--error-bg)' :
                           issue.severity === 'medium' ? 'var(--warning-bg)' :
                           'var(--bg-tertiary)',
                color: issue.severity === 'high' ? 'var(--error)' :
                       issue.severity === 'medium' ? 'var(--warning)' :
                       'var(--text-primary)'
              }}>
                {issue.severity === 'high' ? '🔴 CRITICAL' :
                 issue.severity === 'medium' ? '🟠 WARNING' :
                 '🔵 INFO'}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>
                {issue.type.replace(/-/g, ' ')}
              </div>
            </div>
            
            {/* Description */}
            <div style={{
              fontSize: '1.125rem',
              fontWeight: '600',
              color: 'var(--text-primary)',
              marginBottom: '0.5rem'
            }}>
              {issue.description}
            </div>
            
            {/* Element Info */}
            {(issue.selector || issue.element) && (
              <div style={{
                fontSize: '0.875rem',
                color: 'var(--text-secondary)',
                marginBottom: '0.75rem',
                fontFamily: 'monospace',
                background: 'var(--bg-tertiary)',
                padding: '0.5rem',
                borderRadius: 'var(--radius-sm)'
              }}>
                {issue.element && <div>Element: {issue.element}</div>}
                {issue.selector && <div>Selector: {issue.selector}</div>}
              </div>
            )}
            
            {/* Expected vs Actual */}
            {(issue.expectedValue || issue.actualValue) && (
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '1rem',
                marginBottom: '1rem'
              }}>
                {issue.expectedValue && (
                  <div style={{
                    padding: '0.75rem',
                    background: 'var(--success-bg)',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--success)'
                  }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
                      Expected
                    </div>
                    <div style={{ fontSize: '0.875rem', fontWeight: '600', color: 'var(--success)' }}>
                      {issue.expectedValue}
                    </div>
                  </div>
                )}
                {issue.actualValue && (
                  <div style={{
                    padding: '0.75rem',
                    background: 'var(--error-bg)',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--error)'
                  }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
                      Actual
                    </div>
                    <div style={{ fontSize: '0.875rem', fontWeight: '600', color: 'var(--error)' }}>
                      {issue.actualValue}
                    </div>
                  </div>
                )}
              </div>
            )}
            
            {/* Recommendation */}
            {issue.recommendation && (
              <div style={{
                marginTop: '1rem',
                padding: '1rem',
                background: 'var(--bg-tertiary)',
                borderRadius: 'var(--radius-md)',
                borderLeft: '3px solid var(--primary)'
              }}>
                <div style={{ fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.5rem', color: 'var(--text-primary)' }}>
                  💡 Suggested Fix:
                </div>
                <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                  {issue.recommendation}
                </div>
              </div>
            )}
            
            {/* Screenshot */}
            {issue.screenshot && (
              <div style={{ marginTop: '1rem' }}>
                <img 
                  src={issue.screenshot} 
                  alt="Visual bug screenshot"
                  style={{
                    width: '100%',
                    maxWidth: '600px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-medium)'
                  }}
                />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

