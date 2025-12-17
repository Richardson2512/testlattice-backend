'use client'

import React from 'react'
import { TestRun } from '@/lib/api'

interface GuestProgressIndicatorProps {
  testRun: TestRun
  currentStep: number
}

export function GuestProgressIndicator({ testRun, currentStep }: GuestProgressIndicatorProps) {
  const isGuest = !!(testRun.guestSessionId || testRun.options?.isGuestRun)
  const maxSteps = testRun.options?.maxSteps || 10
  const stepsRemaining = maxSteps - currentStep
  const progress = (currentStep / maxSteps) * 100
  const isWarning = stepsRemaining <= 2

  if (!isGuest) {
    return null
  }

  return (
    <div style={{
      padding: '1rem',
      backgroundColor: isWarning ? 'rgba(239, 68, 68, 0.1)' : 'rgba(59, 130, 246, 0.1)',
      border: `2px solid ${isWarning ? 'rgba(239, 68, 68, 0.3)' : 'rgba(59, 130, 246, 0.3)'}`,
      borderRadius: 'var(--radius-lg)',
      marginBottom: '1.5rem',
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '0.75rem',
      }}>
        <div>
          <h3 style={{
            fontSize: '1rem',
            fontWeight: '600',
            marginBottom: '0.25rem',
            color: isWarning ? '#ef4444' : '#3b82f6',
          }}>
            {isWarning ? '⚠️ Step Limit Approaching' : '⚡ Quick Test Mode'}
          </h3>
          <p style={{
            fontSize: '0.875rem',
            color: 'var(--text-secondary)',
            margin: 0,
          }}>
            {isWarning 
              ? `${stepsRemaining} step${stepsRemaining !== 1 ? 's' : ''} remaining`
              : `Limited to ${maxSteps} steps for quick testing`
            }
          </p>
        </div>
        <div style={{
          textAlign: 'right',
        }}>
          <div style={{
            fontSize: '1.5rem',
            fontWeight: '700',
            color: isWarning ? '#ef4444' : '#3b82f6',
          }}>
            {currentStep}/{maxSteps}
          </div>
          <div style={{
            fontSize: '0.75rem',
            color: 'var(--text-secondary)',
          }}>
            steps
          </div>
        </div>
      </div>
      
      {/* Progress bar */}
      <div style={{
        width: '100%',
        height: '8px',
        backgroundColor: 'rgba(0, 0, 0, 0.1)',
        borderRadius: '4px',
        overflow: 'hidden',
      }}>
        <div style={{
          width: `${progress}%`,
          height: '100%',
          backgroundColor: isWarning ? '#ef4444' : '#3b82f6',
          transition: 'width 0.3s ease',
        }} />
      </div>
      
      {isWarning && (
        <div style={{
          marginTop: '0.75rem',
          padding: '0.75rem',
          backgroundColor: 'rgba(239, 68, 68, 0.1)',
          borderRadius: 'var(--radius-md)',
        }}>
          <p style={{
            fontSize: '0.875rem',
            color: '#ef4444',
            margin: 0,
          }}>
            <Link href="/signup" style={{ color: '#ef4444', textDecoration: 'underline' }}>
              Sign up for unlimited testing
            </Link> to continue beyond {maxSteps} steps
          </p>
        </div>
      )}
    </div>
  )
}

import Link from 'next/link'

