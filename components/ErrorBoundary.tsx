'use client'

import React from 'react'
import { theme } from '../lib/theme'

interface ErrorBoundaryProps {
  children: React.ReactNode
  fallback?: React.ReactNode
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
  errorInfo: React.ErrorInfo | null
}

/**
 * Error Boundary Component
 * Catches React errors and displays a fallback UI
 * 
 * Usage:
 * <ErrorBoundary fallback={<CustomErrorUI />}>
 *   <YourComponent />
 * </ErrorBoundary>
 */
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    }
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    // Update state so the next render will show the fallback UI
    return {
      hasError: true,
      error,
    }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log error to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error('ErrorBoundary caught an error:', error, errorInfo)
    }

    // Update state with error info
    this.setState({
      errorInfo,
    })

    // Call optional error handler
    if (this.props.onError) {
      this.props.onError(error, errorInfo)
    }

    // Send error to monitoring service (Sentry) if available
    if (typeof window !== 'undefined' && (window as any).Sentry) {
      try {
        (window as any).Sentry.captureException(error, {
          contexts: {
            react: {
              componentStack: errorInfo.componentStack,
            },
          },
        })
      } catch (sentryError) {
        // Silently fail if Sentry is not properly configured
        console.warn('Failed to send error to Sentry:', sentryError)
      }
    }
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    })
  }

  render() {
    if (this.state.hasError) {
      // Render custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback
      }

      // Default error UI
      return (
        <div
          style={{
            padding: theme.spacing['2xl'],
            backgroundColor: theme.bg.secondary,
            border: `1px solid ${theme.border.default}`,
            borderRadius: theme.radius.lg,
            textAlign: 'center',
            maxWidth: '600px',
            margin: '0 auto',
          }}
        >
          <div
            style={{
              fontSize: '3rem',
              marginBottom: theme.spacing.lg,
            }}
          >
            ⚠️
          </div>
          
          <h2
            style={{
              color: theme.text.primary,
              marginBottom: theme.spacing.md,
              fontSize: '1.5rem',
            }}
          >
            Something went wrong
          </h2>
          
          <p
            style={{
              color: theme.text.secondary,
              marginBottom: theme.spacing.lg,
            }}
          >
            An unexpected error occurred. Please try refreshing the page.
          </p>

          {process.env.NODE_ENV === 'development' && this.state.error && (
            <details
              style={{
                marginTop: theme.spacing.lg,
                padding: theme.spacing.md,
                backgroundColor: theme.bg.tertiary,
                borderRadius: theme.radius.md,
                textAlign: 'left',
                maxHeight: '300px',
                overflow: 'auto',
              }}
            >
              <summary
                style={{
                  cursor: 'pointer',
                  color: theme.accent.red,
                  marginBottom: theme.spacing.sm,
                  fontWeight: 'bold',
                }}
              >
                Error Details (Development Only)
              </summary>
              
              <pre
                style={{
                  color: theme.text.primary,
                  fontSize: '0.875rem',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                }}
              >
                {this.state.error.toString()}
                {this.state.errorInfo?.componentStack}
              </pre>
            </details>
          )}

          <div
            style={{
              display: 'flex',
              gap: theme.spacing.md,
              justifyContent: 'center',
              marginTop: theme.spacing.xl,
            }}
          >
            <button
              onClick={this.handleReset}
              style={{
                padding: `${theme.spacing.sm} ${theme.spacing.lg}`,
                backgroundColor: theme.accent.blue,
                color: theme.text.inverse,
                border: 'none',
                borderRadius: theme.radius.md,
                cursor: 'pointer',
                fontSize: '1rem',
              }}
            >
              Try Again
            </button>
            
            <button
              onClick={() => window.location.reload()}
              style={{
                padding: `${theme.spacing.sm} ${theme.spacing.lg}`,
                backgroundColor: theme.bg.tertiary,
                color: theme.text.primary,
                border: `1px solid ${theme.border.default}`,
                borderRadius: theme.radius.md,
                cursor: 'pointer',
                fontSize: '1rem',
              }}
            >
              Refresh Page
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

/**
 * Specialized Error Fallback for Test Pages
 */
export function TestRunErrorFallback() {
  return (
    <div
      style={{
        padding: theme.spacing['2xl'],
        textAlign: 'center',
      }}
    >
      <div style={{ fontSize: '3rem', marginBottom: theme.spacing.lg }}>🔴</div>
      <h2 style={{ color: theme.text.primary, marginBottom: theme.spacing.md }}>
        Test Run Failed to Load
      </h2>
      <p style={{ color: theme.text.secondary, marginBottom: theme.spacing.lg }}>
        We encountered an error while loading this test run.
      </p>
      <button
        onClick={() => window.location.reload()}
        style={{
          padding: `${theme.spacing.sm} ${theme.spacing.xl}`,
                backgroundColor: theme.accent.blue,
                color: theme.text.inverse,
          border: 'none',
          borderRadius: theme.radius.md,
          cursor: 'pointer',
          fontSize: '1rem',
        }}
      >
        Reload Test
      </button>
    </div>
  )
}

