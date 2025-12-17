'use client'

import { PerformanceMetrics } from '@/lib/api'

interface PerformanceMetricsDisplayProps {
  metrics?: PerformanceMetrics
}

export function PerformanceMetricsDisplay({ metrics }: PerformanceMetricsDisplayProps) {
  if (!metrics) {
    return (
      <div style={{
        padding: '2rem',
        background: 'var(--bg-tertiary)',
        borderRadius: 'var(--radius-lg)',
        textAlign: 'center',
        color: 'var(--text-tertiary)'
      }}>
        No performance metrics available
      </div>
    )
  }
  
  const formatTime = (ms?: number) => {
    if (!ms) return 'N/A'
    return ms < 1000 ? `${ms.toFixed(0)}ms` : `${(ms / 1000).toFixed(2)}s`
  }
  
  const formatSize = (bytes?: number) => {
    if (!bytes) return 'N/A'
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }
  
  const getScoreColor = (score?: number) => {
    if (!score) return 'var(--text-tertiary)'
    if (score >= 90) return 'var(--success)'
    if (score >= 50) return 'var(--warning)'
    return 'var(--error)'
  }
  
  const getCWVColor = (metric: number | undefined, thresholds: { good: number; needsWork: number }) => {
    if (!metric) return 'var(--text-tertiary)'
    if (metric <= thresholds.good) return 'var(--success)'
    if (metric <= thresholds.needsWork) return 'var(--warning)'
    return 'var(--error)'
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
        marginBottom: '1.5rem',
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem'
      }}>
        <span>⚡</span> Performance Metrics
      </h2>
      
      {/* Core Web Vitals */}
      <div style={{ marginBottom: '2rem' }}>
        <h3 style={{
          fontSize: '1.125rem',
          fontWeight: '600',
          color: 'var(--text-primary)',
          marginBottom: '1rem'
        }}>
          Core Web Vitals
        </h3>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '1rem'
        }}>
          <div style={{
            padding: '1rem',
            background: 'var(--bg-tertiary)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-light)'
          }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
              Page Load Time
            </div>
            <div style={{ fontSize: '1.5rem', fontWeight: '700', color: 'var(--text-primary)' }}>
              {formatTime(metrics.pageLoadTime)}
            </div>
          </div>
          
          <div style={{
            padding: '1rem',
            background: 'var(--bg-tertiary)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-light)'
          }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
              Largest Contentful Paint (LCP)
            </div>
            <div style={{ 
              fontSize: '1.5rem', 
              fontWeight: '700',
              color: getCWVColor(metrics.largestContentfulPaint, { good: 2500, needsWork: 4000 })
            }}>
              {formatTime(metrics.largestContentfulPaint)}
            </div>
            <div style={{ fontSize: '0.625rem', color: 'var(--text-tertiary)', marginTop: '0.25rem' }}>
              Good: &lt;2.5s, Needs work: &lt;4s
            </div>
          </div>
          
          <div style={{
            padding: '1rem',
            background: 'var(--bg-tertiary)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-light)'
          }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
              Time to Interactive (TTI)
            </div>
            <div style={{ fontSize: '1.5rem', fontWeight: '700', color: 'var(--text-primary)' }}>
              {formatTime(metrics.timeToInteractive)}
            </div>
          </div>
          
          <div style={{
            padding: '1rem',
            background: 'var(--bg-tertiary)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-light)'
          }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
              Cumulative Layout Shift (CLS)
            </div>
            <div style={{ 
              fontSize: '1.5rem', 
              fontWeight: '700',
              color: getCWVColor(metrics.cumulativeLayoutShift, { good: 0.1, needsWork: 0.25 })
            }}>
              {metrics.cumulativeLayoutShift?.toFixed(3) || 'N/A'}
            </div>
            <div style={{ fontSize: '0.625rem', color: 'var(--text-tertiary)', marginTop: '0.25rem' }}>
              Good: &lt;0.1, Needs work: &lt;0.25
            </div>
          </div>
          
          <div style={{
            padding: '1rem',
            background: 'var(--bg-tertiary)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-light)'
          }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
              First Contentful Paint (FCP)
            </div>
            <div style={{ fontSize: '1.5rem', fontWeight: '700', color: 'var(--text-primary)' }}>
              {formatTime(metrics.firstContentfulPaint)}
            </div>
          </div>
          
          <div style={{
            padding: '1rem',
            background: 'var(--bg-tertiary)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-light)'
          }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
              Total Blocking Time (TBT)
            </div>
            <div style={{ fontSize: '1.5rem', fontWeight: '700', color: 'var(--text-primary)' }}>
              {formatTime(metrics.totalBlockingTime)}
            </div>
          </div>
        </div>
      </div>
      
      {/* Resource Analysis */}
      <div>
        <h3 style={{
          fontSize: '1.125rem',
          fontWeight: '600',
          color: 'var(--text-primary)',
          marginBottom: '1rem'
        }}>
          Resource Analysis
        </h3>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
          gap: '1rem'
        }}>
          <div style={{
            padding: '1rem',
            background: 'var(--bg-tertiary)',
            borderRadius: 'var(--radius-md)'
          }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Total Size</div>
            <div style={{ fontSize: '1.25rem', fontWeight: '700', color: 'var(--text-primary)' }}>
              {formatSize(metrics.totalPageSize)}
            </div>
          </div>
          <div style={{
            padding: '1rem',
            background: 'var(--bg-tertiary)',
            borderRadius: 'var(--radius-md)'
          }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>JavaScript</div>
            <div style={{ fontSize: '1.25rem', fontWeight: '700', color: 'var(--text-primary)' }}>
              {formatSize(metrics.jsBundleSize)}
            </div>
          </div>
          <div style={{
            padding: '1rem',
            background: 'var(--bg-tertiary)',
            borderRadius: 'var(--radius-md)'
          }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>CSS</div>
            <div style={{ fontSize: '1.25rem', fontWeight: '700', color: 'var(--text-primary)' }}>
              {formatSize(metrics.cssSize)}
            </div>
          </div>
          <div style={{
            padding: '1rem',
            background: 'var(--bg-tertiary)',
            borderRadius: 'var(--radius-md)'
          }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Images</div>
            <div style={{ fontSize: '1.25rem', fontWeight: '700', color: 'var(--text-primary)' }}>
              {formatSize(metrics.imageSize)}
            </div>
          </div>
        </div>
      </div>
      
      {/* Slow Resources Warning */}
      {metrics.slowResources && metrics.slowResources.length > 0 && (
        <div style={{
          marginTop: '1.5rem',
          padding: '1rem',
          background: 'var(--warning-bg)',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--warning)'
        }}>
          <div style={{ fontWeight: '600', color: 'var(--warning)', marginBottom: '0.5rem' }}>
            ⚠️ {metrics.slowResources.length} Slow Resource(s) Detected
          </div>
          <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
            Resources taking &gt;1s to load or &gt;500KB in size
          </div>
        </div>
      )}
    </div>
  )
}

