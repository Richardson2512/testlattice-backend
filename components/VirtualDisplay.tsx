'use client'

import { useState, useEffect, useRef } from 'react'
import { theme } from '../lib/theme'

interface TestStep {
  id: string
  stepNumber: number
  action: string
  target?: string
  value?: string
  timestamp: string
  screenshotUrl?: string
  success: boolean
}

interface VirtualDisplayProps {
  steps: TestStep[]
  currentStep?: number
}

export default function VirtualDisplay({ steps, currentStep }: VirtualDisplayProps) {
  // Use currentStep if provided, otherwise default to last step
  const activeStepNumber = currentStep || steps.length || 1
  const [selectedStep, setSelectedStep] = useState(activeStepNumber)
  const activeStep = steps.find(s => s.stepNumber === selectedStep) || steps[0]
  const autoPlayIntervalRef = useRef<NodeJS.Timeout | null>(null)
  
  // Update selected step when currentStep changes (for live updates)
  useEffect(() => {
    if (currentStep && currentStep !== selectedStep) {
      setSelectedStep(currentStep)
    }
  }, [currentStep, selectedStep])

  // Auto-play functionality
  const [isPlaying, setIsPlaying] = useState(false)
  
  useEffect(() => {
    if (isPlaying && steps.length > 0) {
      autoPlayIntervalRef.current = setInterval(() => {
        setSelectedStep(prev => {
          const next = prev + 1
          if (next > steps.length) {
            setIsPlaying(false)
            return prev
          }
          return next
        })
      }, 1000) // 1 second per step
    } else {
      if (autoPlayIntervalRef.current) {
        clearInterval(autoPlayIntervalRef.current)
        autoPlayIntervalRef.current = null
      }
    }
    
    return () => {
      if (autoPlayIntervalRef.current) {
        clearInterval(autoPlayIntervalRef.current)
      }
    }
  }, [isPlaying, steps.length])

  if (!activeStep || steps.length === 0) {
    return (
      <div style={{
        padding: theme.spacing.xl,
        textAlign: 'center',
        color: theme.text.tertiary,
        backgroundColor: theme.bg.tertiary,
        borderRadius: theme.radius.md,
        border: `1px solid ${theme.border.default}`,
      }}>
        <div style={{ fontSize: '2rem', marginBottom: theme.spacing.sm }}>▶️</div>
        <p>No steps available for replay.</p>
      </div>
    )
  }

  return (
    <div style={{
      backgroundColor: theme.bg.secondary,
      borderRadius: theme.radius.lg,
      padding: theme.spacing.xl,
      border: `1px solid ${theme.border.default}`,
    }}>
      {/* Controls */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: theme.spacing.md,
        flexWrap: 'wrap',
        gap: theme.spacing.sm,
      }}>
        <div style={{ display: 'flex', gap: theme.spacing.sm, alignItems: 'center' }}>
          <button
            onClick={() => {
              setIsPlaying(!isPlaying)
              if (!isPlaying && selectedStep >= steps.length) {
                setSelectedStep(1)
              }
            }}
            style={{
              padding: `${theme.spacing.sm} ${theme.spacing.lg}`,
              backgroundColor: isPlaying ? theme.accent.red : theme.accent.blue,
              color: theme.text.inverse,
              border: 'none',
              borderRadius: theme.radius.md,
              cursor: 'pointer',
              fontSize: '0.875rem',
              fontWeight: '500',
            }}
          >
            {isPlaying ? '⏸️ Pause' : '▶️ Play'}
          </button>
          <button
            onClick={() => {
              setIsPlaying(false)
              setSelectedStep(Math.max(1, selectedStep - 1))
            }}
            disabled={selectedStep <= 1}
            style={{
              padding: `${theme.spacing.sm} ${theme.spacing.lg}`,
              backgroundColor: selectedStep <= 1 ? theme.bg.tertiary : theme.accent.blue,
              color: selectedStep <= 1 ? theme.text.tertiary : theme.text.inverse,
              border: 'none',
              borderRadius: theme.radius.md,
              cursor: selectedStep <= 1 ? 'not-allowed' : 'pointer',
              fontSize: '0.875rem',
              fontWeight: '500',
            }}
          >
            ⏮️ Previous
          </button>
          <button
            onClick={() => {
              setIsPlaying(false)
              setSelectedStep(Math.min(steps.length, selectedStep + 1))
            }}
            disabled={selectedStep >= steps.length}
            style={{
              padding: `${theme.spacing.sm} ${theme.spacing.lg}`,
              backgroundColor: selectedStep >= steps.length ? theme.bg.tertiary : theme.accent.blue,
              color: selectedStep >= steps.length ? theme.text.tertiary : theme.text.inverse,
              border: 'none',
              borderRadius: theme.radius.md,
              cursor: selectedStep >= steps.length ? 'not-allowed' : 'pointer',
              fontSize: '0.875rem',
              fontWeight: '500',
            }}
          >
            ⏭️ Next
          </button>
        </div>
        <div style={{
          fontSize: '0.875rem',
          color: theme.text.secondary,
        }}>
          Step {selectedStep} of {steps.length}
        </div>
      </div>

      {/* Step Info */}
      <div style={{
        backgroundColor: theme.bg.primary,
        borderRadius: theme.radius.md,
        padding: theme.spacing.md,
        marginBottom: theme.spacing.md,
        border: `1px solid ${theme.border.default}`,
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: theme.spacing.sm,
        }}>
          <div style={{
            fontSize: '1rem',
            fontWeight: '600',
            color: theme.text.primary,
          }}>
            Step {activeStep.stepNumber}: {activeStep.action}
          </div>
          <div style={{
            padding: `${theme.spacing.xs} ${theme.spacing.sm}`,
            borderRadius: theme.radius.md,
            fontSize: '0.75rem',
            fontWeight: '600',
            backgroundColor: activeStep.success ? theme.status.success.bg : theme.status.error.bg,
            color: activeStep.success ? theme.status.success.text : theme.status.error.text,
          }}>
            {activeStep.success ? '✓ Success' : '✗ Failed'}
          </div>
        </div>
        {activeStep.target && (
          <div style={{
            fontSize: '0.875rem',
            color: theme.text.secondary,
            marginBottom: theme.spacing.xs,
          }}>
            Target: <code style={{
              backgroundColor: theme.bg.tertiary,
              padding: '2px 6px',
              borderRadius: theme.radius.sm,
              fontFamily: 'monospace',
            }}>{activeStep.target}</code>
          </div>
        )}
        {activeStep.value && (
          <div style={{
            fontSize: '0.875rem',
            color: theme.text.secondary,
          }}>
            Value: <code style={{
              backgroundColor: theme.bg.tertiary,
              padding: '2px 6px',
              borderRadius: theme.radius.sm,
              fontFamily: 'monospace',
            }}>{activeStep.value}</code>
          </div>
        )}
        <div style={{
          fontSize: '0.75rem',
          color: theme.text.tertiary,
          marginTop: theme.spacing.sm,
        }}>
          {new Date(activeStep.timestamp).toLocaleString()}
        </div>
      </div>

      {/* Screenshot Display */}
      {activeStep.screenshotUrl ? (
        <div style={{
          position: 'relative',
          width: '100%',
          backgroundColor: theme.bg.primary,
          borderRadius: theme.radius.md,
          overflow: 'hidden',
          border: `1px solid ${theme.border.default}`,
        }}>
          <div style={{
            paddingBottom: '56.25%', // 16:9 aspect ratio
            position: 'relative',
          }}>
            <img
              src={activeStep.screenshotUrl}
              alt={`Step ${activeStep.stepNumber} screenshot`}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                objectFit: 'contain',
              }}
            />
          </div>
        </div>
      ) : (
        <div style={{
          padding: theme.spacing.xl,
          textAlign: 'center',
          color: theme.text.tertiary,
          backgroundColor: theme.bg.tertiary,
          borderRadius: theme.radius.md,
          border: `1px solid ${theme.border.default}`,
        }}>
          <div style={{ fontSize: '2rem', marginBottom: theme.spacing.sm }}>📸</div>
          <p>No screenshot available for this step.</p>
        </div>
      )}

      {/* Progress Bar */}
      <div style={{
        marginTop: theme.spacing.md,
        width: '100%',
        height: '8px',
        backgroundColor: theme.bg.tertiary,
        borderRadius: theme.radius.full,
        overflow: 'hidden',
      }}>
        <div style={{
          width: `${(selectedStep / steps.length) * 100}%`,
          height: '100%',
          backgroundColor: theme.accent.blue,
          transition: 'width 0.3s ease',
        }} />
      </div>
    </div>
  )
}

