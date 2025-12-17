'use client'

import { useState } from 'react'
import { api } from '@/lib/api'
import { validateTestUrl } from '@/lib/urlValidator'
import { useRouter } from 'next/navigation'

export function TryNowSection() {
  const [url, setUrl] = useState('')
  const [email, setEmail] = useState('')
  const [showEmail, setShowEmail] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    // Client-side validation
    const validation = validateTestUrl(url)
    if (!validation.valid) {
      setError(validation.error || 'Invalid URL')
      return
    }

    setLoading(true)

    try {
      const result = await api.createGuestTestRun({ 
        url,
        email: email.trim() || undefined // Optional email
      })
      
      // Redirect to test run page
      router.push(`/test/run/${result.runId}`)
    } catch (err: any) {
      console.error('Failed to create guest test:', err)
      
      if (err.message?.includes('Rate limit')) {
        setError('You\'ve reached the limit of 1 free test per 24 hours. Sign up for unlimited tests!')
      } else if (err.message?.includes('Invalid URL')) {
        setError(err.message)
      } else if (err.message?.includes('Cannot connect to API server')) {
        setError('API server is not running. Please start the backend API server on port 3001.')
      } else {
        setError(err.message || 'Failed to start test. Please try again or sign up for full access.')
      }
      setLoading(false)
    }
  }

  return (
    <div>
      <h3 style={{
        fontSize: '1.25rem',
        fontWeight: '600',
        marginBottom: '0.75rem',
        color: 'var(--maroon-800)',
        textAlign: 'center',
      }}>
        🚀 Try It Now - No Signup Required
      </h3>
      <p style={{
        fontSize: '0.875rem',
        color: 'var(--text-secondary)',
        marginBottom: '1.5rem',
        textAlign: 'center',
      }}>
        Test any public website in 2 minutes. Results expire in 24 hours.
      </p>
      
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div style={{ display: 'flex', gap: '0.5rem', flexDirection: 'column' }}>
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com"
            disabled={loading}
            style={{
              padding: '0.875rem 1rem',
              fontSize: '1rem',
              border: `2px solid ${error ? '#ef4444' : 'rgba(153, 27, 27, 0.2)'}`,
              borderRadius: 'var(--radius-md)',
              backgroundColor: '#fff',
              color: 'var(--text-primary)',
              width: '100%',
            }}
          />
          {showEmail && (
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com (optional)"
              disabled={loading}
              style={{
                padding: '0.875rem 1rem',
                fontSize: '0.875rem',
                border: '1px solid rgba(153, 27, 27, 0.2)',
                borderRadius: 'var(--radius-md)',
                backgroundColor: '#fff',
                color: 'var(--text-primary)',
                width: '100%',
              }}
            />
          )}
          {error && (
            <div style={{
              padding: '0.75rem',
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: 'var(--radius-md)',
              color: '#ef4444',
              fontSize: '0.875rem',
            }}>
              {error}
            </div>
          )}
        </div>
        
        <button
          type="submit"
          disabled={loading || !url.trim()}
          style={{
            padding: '0.875rem 1.5rem',
            fontSize: '1rem',
            fontWeight: '600',
            backgroundColor: loading ? 'var(--maroon-400)' : 'var(--maroon-600)',
            color: '#fff',
            border: 'none',
            borderRadius: 'var(--radius-md)',
            cursor: loading || !url.trim() ? 'not-allowed' : 'pointer',
            opacity: loading || !url.trim() ? 0.6 : 1,
            transition: 'all 0.2s',
          }}
        >
          {loading ? 'Starting Test...' : 'Test Now →'}
        </button>
        
        {!showEmail && (
          <button
            type="button"
            onClick={() => setShowEmail(true)}
            style={{
              padding: '0.5rem',
              fontSize: '0.75rem',
              color: 'var(--text-secondary)',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              textDecoration: 'underline',
            }}
          >
            + Add email for results (optional)
          </button>
        )}
      </form>
      
      <p style={{
        fontSize: '0.75rem',
        color: 'var(--text-secondary)',
        marginTop: '1rem',
        textAlign: 'center',
        opacity: 0.8,
      }}>
        ⚡ Quick test • No diagnosis • Results in ~2 minutes
      </p>
    </div>
  )
}

