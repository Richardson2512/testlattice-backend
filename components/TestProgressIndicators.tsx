'use client'

import { useState, useEffect } from 'react'

interface TestProgressIndicatorsProps {
  currentStep: number
  totalSteps: number
  startedAt?: string
  estimatedDuration?: number
  status: string
  paused?: boolean
  currentAction?: string
}

export function TestProgressIndicators({
  currentStep,
  totalSteps,
  startedAt,
  estimatedDuration,
  status,
  paused,
  currentAction
}: TestProgressIndicatorsProps) {
  const [elapsed, setElapsed] = useState(0)
  
  useEffect(() => {
    if (!startedAt || status !== 'running' || paused) return
    
    const interval = setInterval(() => {
      const start = new Date(startedAt).getTime()
      const now = Date.now()
      setElapsed(now - start)
    }, 1000)
    
    return () => clearInterval(interval)
  }, [startedAt, status, paused])
  
  // Calculate estimated time remaining
  const avgTimePerStep = elapsed / Math.max(currentStep, 1)
  const remainingSteps = Math.max(totalSteps - currentStep, 0)
  const estimatedRemaining = avgTimePerStep * remainingSteps
  
  // Format time (MM:SS)
  const formatTime = (ms: number) => {
    const seconds = Math.floor(ms / 1000)
    const minutes = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }
  
  const progressPercent = totalSteps > 0 ? (currentStep / totalSteps) * 100 : 0
  
  return (
    <div style={{
      display: 'flex',
      gap: '1.5rem',
      padding: '1rem',
      background: 'var(--bg-secondary)',
      borderRadius: 'var(--radius-lg)',
      border: '1px solid var(--border-medium)',
      alignItems: 'center',
      flexWrap: 'wrap'
    }}>
      {/* Overall Progress */}
      <div style={{ flex: 1, minWidth: '200px' }}>
        <div style={{ 
          fontSize: '0.875rem',
          color: 'var(--text-secondary)',
          marginBottom: '0.25rem',
          fontWeight: '500'
        }}>
          Overall Progress
        </div>
        <div style={{ 
          fontSize: '1.25rem',
          fontWeight: '700',
          color: 'var(--text-primary)'
        }}>
          Step {currentStep} of {totalSteps}
        </div>
        <div style={{
          marginTop: '0.5rem',
          height: '8px',
          background: 'var(--bg-tertiary)',
          borderRadius: '999px',
          overflow: 'hidden'
        }}>
          <div style={{
            width: `${Math.min(progressPercent, 100)}%`,
            height: '100%',
            background: paused ? 'var(--warning)' : 
                       status === 'completed' ? 'var(--success)' :
                       'var(--primary)',
            transition: 'width 0.3s ease'
          }}/>
        </div>
        <div style={{
          fontSize: '0.75rem',
          color: 'var(--text-tertiary)',
          marginTop: '0.25rem'
        }}>
          {Math.round(progressPercent)}% complete
        </div>
      </div>
      
      {/* Time Elapsed */}
      <div style={{ minWidth: '120px' }}>
        <div style={{ 
          fontSize: '0.875rem',
          color: 'var(--text-secondary)',
          marginBottom: '0.25rem',
          fontWeight: '500'
        }}>
          Time Elapsed
        </div>
        <div style={{ 
          fontSize: '1.5rem',
          fontWeight: '700',
          color: 'var(--primary)',
          fontFamily: 'monospace'
        }}>
          {formatTime(elapsed)}
        </div>
      </div>
      
      {/* Estimated Time Remaining */}
      {status === 'running' && !paused && remainingSteps > 0 && currentStep > 0 && (
        <div style={{ minWidth: '120px' }}>
          <div style={{ 
            fontSize: '0.875rem',
            color: 'var(--text-secondary)',
            marginBottom: '0.25rem',
            fontWeight: '500'
          }}>
            Est. Remaining
          </div>
          <div style={{ 
            fontSize: '1.5rem',
            fontWeight: '700',
            color: 'var(--text-tertiary)',
            fontFamily: 'monospace'
          }}>
            ~{formatTime(estimatedRemaining)}
          </div>
        </div>
      )}
      
      {/* Current Action */}
      {status === 'running' && !paused && currentAction && (
        <div style={{ flex: 1, minWidth: '200px' }}>
          <div style={{ 
            fontSize: '0.875rem',
            color: 'var(--text-secondary)',
            marginBottom: '0.25rem',
            fontWeight: '500'
          }}>
            Current Action
          </div>
          <div style={{ 
            fontSize: '1rem',
            fontWeight: '600',
            color: 'var(--text-primary)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}>
            <span style={{ 
              display: 'inline-block',
              animation: 'spin 1s linear infinite'
            }}>⏳</span>
            <span>{currentAction}</span>
          </div>
        </div>
      )}
      
      {/* Paused Status */}
      {paused && (
        <div style={{
          padding: '0.5rem 1rem',
          background: 'var(--warning-bg)',
          color: 'var(--warning)',
          borderRadius: 'var(--radius-md)',
          fontWeight: '600',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}>
          <span>⏸️</span>
          <span>Test Paused</span>
        </div>
      )}
    </div>
  )
}

