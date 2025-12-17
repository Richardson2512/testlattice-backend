'use client'

import React from 'react'
import Link from 'next/link'
import { TestRun } from '@/lib/api'

interface ContextualCTAProps {
  testRun: TestRun
  issuesFound?: number
  criticalIssues?: number
  hitStepLimit?: boolean
  testCompleted?: boolean
}

export function ContextualCTA({ 
  testRun, 
  issuesFound = 0, 
  criticalIssues = 0,
  hitStepLimit = false,
  testCompleted = false 
}: ContextualCTAProps) {
  const isGuest = !!(testRun.guestSessionId || testRun.options?.isGuestRun)

  if (!isGuest) {
    return null
  }

  // CTA based on test outcome
  if (hitStepLimit) {
    return (
      <div style={{
        padding: '1.5rem',
        backgroundColor: 'rgba(234, 179, 8, 0.1)',
        border: '2px solid rgba(234, 179, 8, 0.3)',
        borderRadius: 'var(--radius-lg)',
        marginBottom: '1.5rem',
      }}>
        <h3 style={{
          fontSize: '1.25rem',
          fontWeight: '700',
          marginBottom: '0.75rem',
          color: '#eab308',
        }}>
          ⚠️ Step Limit Reached
        </h3>
        <p style={{
          fontSize: '0.9375rem',
          color: 'var(--text-secondary)',
          marginBottom: '1rem',
        }}>
          Your test stopped at {testRun.options?.maxSteps || 10} steps. Sign up for unlimited testing to continue.
        </p>
        <Link
          href="/signup"
          style={{
            display: 'inline-block',
            padding: '0.875rem 1.5rem',
            backgroundColor: '#eab308',
            color: '#000',
            textDecoration: 'none',
            borderRadius: 'var(--radius-md)',
            fontWeight: '600',
            fontSize: '0.9375rem',
            transition: 'all 0.2s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-2px)'
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(234, 179, 8, 0.4)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)'
            e.currentTarget.style.boxShadow = 'none'
          }}
        >
          Continue Testing - Sign Up Free →
        </Link>
      </div>
    )
  }

  if (criticalIssues > 0) {
    return (
      <div style={{
        padding: '1.5rem',
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        border: '2px solid rgba(239, 68, 68, 0.3)',
        borderRadius: 'var(--radius-lg)',
        marginBottom: '1.5rem',
      }}>
        <h3 style={{
          fontSize: '1.25rem',
          fontWeight: '700',
          marginBottom: '0.75rem',
          color: '#ef4444',
        }}>
          🚨 Critical Issues Found
        </h3>
        <p style={{
          fontSize: '0.9375rem',
          color: 'var(--text-secondary)',
          marginBottom: '1rem',
        }}>
          Found {criticalIssues} critical bug{criticalIssues !== 1 ? 's' : ''} that could lose you customers.
        </p>
        <Link
          href="/signup"
          style={{
            display: 'inline-block',
            padding: '0.875rem 1.5rem',
            backgroundColor: '#ef4444',
            color: '#fff',
            textDecoration: 'none',
            borderRadius: 'var(--radius-md)',
            fontWeight: '600',
            fontSize: '0.9375rem',
            transition: 'all 0.2s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-2px)'
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(239, 68, 68, 0.4)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)'
            e.currentTarget.style.boxShadow = 'none'
          }}
        >
          Fix Issues - Sign Up to See Details →
        </Link>
      </div>
    )
  }

  if (testCompleted && issuesFound > 0) {
    return (
      <div style={{
        padding: '1.5rem',
        backgroundColor: 'rgba(34, 197, 94, 0.1)',
        border: '2px solid rgba(34, 197, 94, 0.3)',
        borderRadius: 'var(--radius-lg)',
        marginBottom: '1.5rem',
      }}>
        <h3 style={{
          fontSize: '1.25rem',
          fontWeight: '700',
          marginBottom: '0.75rem',
          color: '#22c55e',
        }}>
          ✅ Test Complete!
        </h3>
        <p style={{
          fontSize: '0.9375rem',
          color: 'var(--text-secondary)',
          marginBottom: '1rem',
        }}>
          Found {issuesFound} issue{issuesFound !== 1 ? 's' : ''} in your site.
        </p>
        
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '0.5rem',
          marginBottom: '1rem',
          fontSize: '0.875rem',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span>✅</span>
            <span>Sign up to save these results</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span>✅</span>
            <span>Run unlimited tests on all your pages</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span>✅</span>
            <span>Use God Mode when AI gets stuck</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span>✅</span>
            <span>Get video recordings of every test</span>
          </div>
        </div>
        
        <Link
          href="/signup"
          style={{
            display: 'inline-block',
            padding: '0.875rem 1.5rem',
            backgroundColor: '#22c55e',
            color: '#fff',
            textDecoration: 'none',
            borderRadius: 'var(--radius-md)',
            fontWeight: '600',
            fontSize: '0.9375rem',
            width: '100%',
            textAlign: 'center',
            transition: 'all 0.2s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-2px)'
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(34, 197, 94, 0.4)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)'
            e.currentTarget.style.boxShadow = 'none'
          }}
        >
          Sign Up Free - No Credit Card →
        </Link>
        
        {testRun.expiresAt && (
          <p style={{
            fontSize: '0.75rem',
            textAlign: 'center',
            marginTop: '0.75rem',
            color: 'var(--text-secondary)',
            marginBottom: 0,
          }}>
            Results expire in {new Date(testRun.expiresAt).toLocaleString()}
          </p>
        )}
      </div>
    )
  }

  if (testCompleted && issuesFound === 0) {
    return (
      <div style={{
        padding: '1.5rem',
        backgroundColor: 'rgba(34, 197, 94, 0.1)',
        border: '2px solid rgba(34, 197, 94, 0.3)',
        borderRadius: 'var(--radius-lg)',
        marginBottom: '1.5rem',
      }}>
        <h3 style={{
          fontSize: '1.25rem',
          fontWeight: '700',
          marginBottom: '0.75rem',
          color: '#22c55e',
        }}>
          ✅ No Issues Found!
        </h3>
        <p style={{
          fontSize: '0.9375rem',
          color: 'var(--text-secondary)',
          marginBottom: '1rem',
        }}>
          Great job! Your site passed all tests. Sign up to test more pages and get comprehensive reports.
        </p>
        <Link
          href="/signup"
          style={{
            display: 'inline-block',
            padding: '0.875rem 1.5rem',
            backgroundColor: '#22c55e',
            color: '#fff',
            textDecoration: 'none',
            borderRadius: 'var(--radius-md)',
            fontWeight: '600',
            fontSize: '0.9375rem',
            width: '100%',
            textAlign: 'center',
          }}
        >
          Test More Pages - Sign Up Free →
        </Link>
      </div>
    )
  }

  // Default CTA (during test or unknown state)
  return (
    <div style={{
      padding: '1.5rem',
      backgroundColor: 'rgba(59, 130, 246, 0.1)',
      border: '2px solid rgba(59, 130, 246, 0.3)',
      borderRadius: 'var(--radius-lg)',
      marginBottom: '1.5rem',
    }}>
      <h3 style={{
        fontSize: '1.25rem',
        fontWeight: '700',
        marginBottom: '0.75rem',
        color: '#3b82f6',
      }}>
        ⚡ Quick Test Mode
      </h3>
      <p style={{
        fontSize: '0.9375rem',
        color: 'var(--text-secondary)',
        marginBottom: '1rem',
      }}>
        Testing limited to {testRun.options?.maxSteps || 10} steps. Sign up for unlimited testing.
      </p>
      <Link
        href="/signup"
        style={{
          display: 'inline-block',
          padding: '0.875rem 1.5rem',
          backgroundColor: '#3b82f6',
          color: '#fff',
          textDecoration: 'none',
          borderRadius: 'var(--radius-md)',
          fontWeight: '600',
          fontSize: '0.9375rem',
        }}
      >
        Sign Up for Unlimited Testing →
      </Link>
    </div>
  )
}

