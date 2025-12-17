'use client'

import { useState } from 'react'

interface CriticalPathResultsProps {
  result: {
    flowName: string
    success: boolean
    completedSteps: number
    totalSteps: number
    duration: number
    steps: Array<{
      stepNumber: number
      name: string
      success: boolean
      duration: number
      screenshot?: string
      error?: string
      stateValidation?: {
        type: string
        persisted: boolean
        details: string
      }
    }>
    statePersistence: {
      loginSessionPersists: boolean
      formDataPersists: boolean
      cartItemsPersist: boolean
      cookiesPersist: boolean
      localStoragePersists: boolean
    }
  }
}

export function CriticalPathResults({ result }: CriticalPathResultsProps) {
  const [expandedStep, setExpandedStep] = useState<number | null>(null)
  
  const formatDuration = (ms: number) => {
    return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`
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
        <span>🛒</span> {result.flowName}
      </h2>
      
      {/* Flow Summary */}
      <div style={{
        display: 'flex',
        gap: '1.5rem',
        padding: '1.5rem',
        background: result.success ? 'var(--success-bg)' : 'var(--error-bg)',
        borderRadius: 'var(--radius-lg)',
        border: `2px solid ${result.success ? 'var(--success)' : 'var(--error)'}`,
        marginBottom: '1.5rem'
      }}>
        <div>
          <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
            Status
          </div>
          <div style={{ 
            fontSize: '1.5rem', 
            fontWeight: '700', 
            color: result.success ? 'var(--success)' : 'var(--error)'
          }}>
            {result.success ? '✅ Passed' : '❌ Failed'}
          </div>
        </div>
        
        <div style={{ borderLeft: '1px solid var(--border-medium)', paddingLeft: '1.5rem' }}>
          <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
            Steps Completed
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: '700', color: 'var(--text-primary)' }}>
            {result.completedSteps} / {result.totalSteps}
          </div>
        </div>
        
        <div style={{ borderLeft: '1px solid var(--border-medium)', paddingLeft: '1.5rem' }}>
          <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
            Total Duration
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: '700', color: 'var(--text-primary)' }}>
            {formatDuration(result.duration)}
          </div>
        </div>
      </div>
      
      {/* Flow Steps */}
      <div style={{ marginBottom: '1.5rem' }}>
        <h3 style={{
          fontSize: '1.125rem',
          fontWeight: '600',
          color: 'var(--text-primary)',
          marginBottom: '1rem'
        }}>
          Flow Steps
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {result.steps.map((step) => (
            <div key={step.stepNumber} style={{
              background: 'var(--bg-card)',
              borderRadius: 'var(--radius-md)',
              border: `2px solid ${step.success ? 'var(--success)' : 'var(--error)'}`,
              overflow: 'hidden'
            }}>
              <div 
                onClick={() => setExpandedStep(expandedStep === step.stepNumber ? null : step.stepNumber)}
                style={{
                  padding: '1rem',
                  cursor: 'pointer',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  background: step.success ? 'var(--success-bg)' : 'var(--error-bg)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <div style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    background: step.success ? 'var(--success)' : 'var(--error)',
                    color: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: '700'
                  }}>
                    {step.stepNumber}
                  </div>
                  <div>
                    <div style={{ fontWeight: '600', color: 'var(--text-primary)' }}>
                      {step.name}
                    </div>
                    <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                      {formatDuration(step.duration)}
                      {step.stateValidation && ` • ${step.stateValidation.details}`}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ 
                    fontSize: '1.5rem',
                    color: step.success ? 'var(--success)' : 'var(--error)'
                  }}>
                    {step.success ? '✓' : '✗'}
                  </span>
                  <span style={{ color: 'var(--text-tertiary)' }}>
                    {expandedStep === step.stepNumber ? '▼' : '▶'}
                  </span>
                </div>
              </div>
              
              {/* Expanded Details */}
              {expandedStep === step.stepNumber && (
                <div style={{ padding: '1rem', borderTop: '1px solid var(--border-light)' }}>
                  {step.error && (
                    <div style={{
                      padding: '0.75rem',
                      background: 'var(--error-bg)',
                      borderRadius: 'var(--radius-sm)',
                      marginBottom: '1rem',
                      color: 'var(--error)'
                    }}>
                      <strong>Error:</strong> {step.error}
                    </div>
                  )}
                  
                  {step.stateValidation && (
                    <div style={{
                      padding: '0.75rem',
                      background: 'var(--bg-tertiary)',
                      borderRadius: 'var(--radius-sm)',
                      marginBottom: '1rem'
                    }}>
                      <div style={{ fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.25rem' }}>
                        State Validation: {step.stateValidation.type}
                      </div>
                      <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                        {step.stateValidation.details}
                      </div>
                    </div>
                  )}
                  
                  {step.screenshot && (
                    <img 
                      src={step.screenshot}
                      alt={`Step ${step.stepNumber} screenshot`}
                      style={{
                        width: '100%',
                        maxWidth: '600px',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--border-medium)'
                      }}
                    />
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
      
      {/* State Persistence Summary */}
      <div>
        <h3 style={{
          fontSize: '1.125rem',
          fontWeight: '600',
          color: 'var(--text-primary)',
          marginBottom: '1rem'
        }}>
          State Persistence Check
        </h3>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '1rem'
        }}>
          {Object.entries(result.statePersistence).map(([key, value]) => {
            const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())
            return (
              <div key={key} style={{
                padding: '1rem',
                background: value ? 'var(--success-bg)' : 'var(--error-bg)',
                borderRadius: 'var(--radius-md)',
                border: `1px solid ${value ? 'var(--success)' : 'var(--error)'}`,
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}>
                <span style={{ fontSize: '1.5rem' }}>
                  {value ? '✅' : '❌'}
                </span>
                <div>
                  <div style={{ fontSize: '0.875rem', fontWeight: '600', color: 'var(--text-primary)' }}>
                    {label}
                  </div>
                  <div style={{ 
                    fontSize: '0.75rem', 
                    color: value ? 'var(--success)' : 'var(--error)',
                    fontWeight: '600'
                  }}>
                    {value ? 'Persisted' : 'Not Found'}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

