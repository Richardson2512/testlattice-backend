'use client'

interface ErrorHandlingResultsProps {
  diagnosis?: {
    comprehensiveTests?: {
      consoleErrors: Array<{ type: string; message: string; source?: string }>
      networkErrors: Array<{ url: string; status: number; errorText?: string }>
      visualIssues: Array<{ type: string; description: string; severity: string }>
    }
  }
}

export function ErrorHandlingResults({ diagnosis }: ErrorHandlingResultsProps) {
  if (!diagnosis?.comprehensiveTests) return null
  
  const { consoleErrors, networkErrors, visualIssues } = diagnosis.comprehensiveTests
  
  // Filter error handling specific issues
  const promiseRejections = visualIssues?.filter(i => i.type === 'unhandled-promise-rejection') || []
  const jsErrors = consoleErrors?.filter(e => e.type === 'error') || []
  const corsErrors = networkErrors?.filter(e => e.errorText?.toLowerCase().includes('cors')) || []
  const asset404s = networkErrors?.filter(e => e.status === 404) || []
  const stackTraceIssues = visualIssues?.filter(i => i.type === 'stack-trace-exposed') || []
  const stuckLoadingIssues = visualIssues?.filter(i => i.type === 'stuck-loading-state') || []
  
  const totalIssues = promiseRejections.length + jsErrors.length + corsErrors.length + 
                      asset404s.length + stackTraceIssues.length + stuckLoadingIssues.length
  
  if (totalIssues === 0) {
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
          No Error Handling Issues!
        </div>
        <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
          No unhandled errors, CORS issues, or broken assets detected
        </div>
      </div>
    )
  }
  
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
        <span>🚨</span> Error Handling Report
      </h2>
      
      {/* Summary Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
        gap: '1rem',
        marginBottom: '1.5rem'
      }}>
        <div style={{
          padding: '1rem',
          background: promiseRejections.length > 0 ? 'var(--error-bg)' : 'var(--success-bg)',
          borderRadius: 'var(--radius-md)',
          border: `1px solid ${promiseRejections.length > 0 ? 'var(--error)' : 'var(--success)'}`,
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '2rem', fontWeight: '700', color: promiseRejections.length > 0 ? 'var(--error)' : 'var(--success)' }}>
            {promiseRejections.length}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            Promise Rejections
          </div>
        </div>
        
        <div style={{
          padding: '1rem',
          background: jsErrors.length > 0 ? 'var(--error-bg)' : 'var(--success-bg)',
          borderRadius: 'var(--radius-md)',
          border: `1px solid ${jsErrors.length > 0 ? 'var(--error)' : 'var(--success)'}`,
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '2rem', fontWeight: '700', color: jsErrors.length > 0 ? 'var(--error)' : 'var(--success)' }}>
            {jsErrors.length}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            JS Errors
          </div>
        </div>
        
        <div style={{
          padding: '1rem',
          background: corsErrors.length > 0 ? 'var(--error-bg)' : 'var(--success-bg)',
          borderRadius: 'var(--radius-md)',
          border: `1px solid ${corsErrors.length > 0 ? 'var(--error)' : 'var(--success)'}`,
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '2rem', fontWeight: '700', color: corsErrors.length > 0 ? 'var(--error)' : 'var(--success)' }}>
            {corsErrors.length}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            CORS Errors
          </div>
        </div>
        
        <div style={{
          padding: '1rem',
          background: asset404s.length > 0 ? 'var(--warning-bg)' : 'var(--success-bg)',
          borderRadius: 'var(--radius-md)',
          border: `1px solid ${asset404s.length > 0 ? 'var(--warning)' : 'var(--success)'}`,
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '2rem', fontWeight: '700', color: asset404s.length > 0 ? 'var(--warning)' : 'var(--success)' }}>
            {asset404s.length}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            Asset 404s
          </div>
        </div>
        
        <div style={{
          padding: '1rem',
          background: stackTraceIssues.length > 0 ? 'var(--error-bg)' : 'var(--success-bg)',
          borderRadius: 'var(--radius-md)',
          border: `1px solid ${stackTraceIssues.length > 0 ? 'var(--error)' : 'var(--success)'}`,
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '2rem', fontWeight: '700', color: stackTraceIssues.length > 0 ? 'var(--error)' : 'var(--success)' }}>
            {stackTraceIssues.length}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            Stack Traces
          </div>
        </div>
      </div>
      
      {/* Issues by Category */}
      {promiseRejections.length > 0 && (
        <div style={{ marginBottom: '1.5rem' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: '600', marginBottom: '0.75rem', color: 'var(--text-primary)' }}>
            ⚠️ Unhandled Promise Rejections
          </h3>
          {promiseRejections.map((issue, index) => (
            <div key={index} style={{
              padding: '1rem',
              background: 'var(--error-bg)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--error)',
              marginBottom: '0.5rem'
            }}>
              <div style={{ fontSize: '0.875rem', color: 'var(--error)', fontWeight: '600' }}>
                {issue.description}
              </div>
              {issue.recommendation && (
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
                  💡 {issue.recommendation}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      
      {corsErrors.length > 0 && (
        <div style={{ marginBottom: '1.5rem' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: '600', marginBottom: '0.75rem', color: 'var(--text-primary)' }}>
            🌐 CORS Errors
          </h3>
          {corsErrors.map((error, index) => (
            <div key={index} style={{
              padding: '1rem',
              background: 'var(--error-bg)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--error)',
              marginBottom: '0.5rem'
            }}>
              <div style={{ fontSize: '0.875rem', color: 'var(--error)', fontFamily: 'monospace' }}>
                {error.url}
              </div>
              {error.errorText && (
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                  {error.errorText}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      
      {asset404s.length > 0 && (
        <div>
          <h3 style={{ fontSize: '1rem', fontWeight: '600', marginBottom: '0.75rem', color: 'var(--text-primary)' }}>
            🔗 Missing Assets (404)
          </h3>
          {asset404s.slice(0, 10).map((error, index) => (
            <div key={index} style={{
              padding: '0.75rem',
              background: 'var(--warning-bg)',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--warning)',
              marginBottom: '0.5rem',
              fontSize: '0.75rem',
              fontFamily: 'monospace',
              color: 'var(--text-primary)'
            }}>
              {error.url}
            </div>
          ))}
          {asset404s.length > 10 && (
            <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: '0.5rem' }}>
              +{asset404s.length - 10} more...
            </div>
          )}
        </div>
      )}
    </div>
  )
}

