'use client'

interface ResponsiveIssue {
  type: string
  description: string
  severity: 'high' | 'medium' | 'low'
  viewport?: string
  recommendation?: string
  selector?: string
  expectedValue?: string
  actualValue?: string
}

interface ResponsiveTestingResultsProps {
  visualIssues: ResponsiveIssue[]
}

export function ResponsiveTestingResults({ visualIssues }: ResponsiveTestingResultsProps) {
  // Filter for responsive-specific issues
  const responsiveIssues = visualIssues.filter(issue => 
    issue.type.includes('touch') ||
    issue.type.includes('mobile') ||
    issue.type.includes('spacing') ||
    issue.type.includes('typography') ||
    issue.type.includes('layout-shift') ||
    issue.viewport
  )
  
  if (responsiveIssues.length === 0) {
    return (
      <div style={{
        padding: '2rem',
        background: 'var(--success-bg)',
        borderRadius: 'var(--radius-lg)',
        border: '2px solid var(--success)',
        textAlign: 'center',
        marginBottom: '2rem'
      }}>
        <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>📱✅</div>
        <div style={{ fontSize: '1.25rem', fontWeight: '600', color: 'var(--success)' }}>
          All Responsive & Mobile Checks Passed!
        </div>
        <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
          Touch targets, text size, and layout breakpoints all look good
        </div>
      </div>
    )
  }
  
  // Categorize issues
  const touchTargetIssues = responsiveIssues.filter(i => i.type.includes('touch') || i.type === 'misaligned')
  const textIssues = responsiveIssues.filter(i => i.type.includes('typography'))
  const layoutIssues = responsiveIssues.filter(i => i.type.includes('layout') || i.type.includes('spacing'))
  
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
        <span>📱</span> Responsive & Mobile Testing
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
            {responsiveIssues.filter(i => i.severity === 'high').length}
          </span>
          <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}> Critical</span>
        </div>
        <div style={{ borderLeft: '1px solid var(--border-medium)', paddingLeft: '1rem' }}>
          <span style={{ fontSize: '1.5rem', fontWeight: '700', color: 'var(--warning)' }}>
            {responsiveIssues.filter(i => i.severity === 'medium').length}
          </span>
          <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}> Warning</span>
        </div>
        <div style={{ borderLeft: '1px solid var(--border-medium)', paddingLeft: '1rem' }}>
          <span style={{ fontSize: '1.5rem', fontWeight: '700', color: 'var(--text-primary)' }}>
            {responsiveIssues.length}
          </span>
          <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}> Total</span>
        </div>
      </div>
      
      {/* Touch Target Issues */}
      {touchTargetIssues.length > 0 && (
        <div style={{ marginBottom: '1.5rem' }}>
          <h3 style={{
            fontSize: '1rem',
            fontWeight: '600',
            color: 'var(--text-primary)',
            marginBottom: '0.75rem'
          }}>
            👆 Touch Target Issues ({touchTargetIssues.length})
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {touchTargetIssues.map((issue, index) => (
              <div key={index} style={{
                padding: '1rem',
                background: 'var(--bg-card)',
                borderRadius: 'var(--radius-md)',
                borderLeft: `3px solid ${issue.severity === 'high' ? 'var(--error)' : 'var(--warning)'}`
              }}>
                <div style={{ fontSize: '0.875rem', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
                  {issue.description}
                </div>
                {issue.expectedValue && issue.actualValue && (
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                    Expected: {issue.expectedValue} • Actual: {issue.actualValue}
                  </div>
                )}
                {issue.recommendation && (
                  <div style={{ 
                    fontSize: '0.75rem', 
                    color: 'var(--text-tertiary)',
                    marginTop: '0.5rem',
                    paddingTop: '0.5rem',
                    borderTop: '1px solid var(--border-light)'
                  }}>
                    💡 {issue.recommendation}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Text Size Issues */}
      {textIssues.length > 0 && (
        <div style={{ marginBottom: '1.5rem' }}>
          <h3 style={{
            fontSize: '1rem',
            fontWeight: '600',
            color: 'var(--text-primary)',
            marginBottom: '0.75rem'
          }}>
            📝 Text Size Issues ({textIssues.length})
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {textIssues.map((issue, index) => (
              <div key={index} style={{
                padding: '1rem',
                background: 'var(--bg-card)',
                borderRadius: 'var(--radius-md)',
                borderLeft: `3px solid var(--warning)`
              }}>
                <div style={{ fontSize: '0.875rem', fontWeight: '600', color: 'var(--text-primary)' }}>
                  {issue.description}
                </div>
                {issue.recommendation && (
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: '0.5rem' }}>
                    💡 {issue.recommendation}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Layout Issues */}
      {layoutIssues.length > 0 && (
        <div>
          <h3 style={{
            fontSize: '1rem',
            fontWeight: '600',
            color: 'var(--text-primary)',
            marginBottom: '0.75rem'
          }}>
            📐 Layout Issues ({layoutIssues.length})
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {layoutIssues.map((issue, index) => (
              <div key={index} style={{
                padding: '1rem',
                background: 'var(--bg-card)',
                borderRadius: 'var(--radius-md)',
                borderLeft: `3px solid ${issue.severity === 'high' ? 'var(--error)' : 'var(--warning)'}`
              }}>
                <div style={{ fontSize: '0.875rem', fontWeight: '600', color: 'var(--text-primary)' }}>
                  {issue.description}
                </div>
                {issue.viewport && (
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                    Viewport: {issue.viewport}
                  </div>
                )}
                {issue.recommendation && (
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: '0.5rem' }}>
                    💡 {issue.recommendation}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

