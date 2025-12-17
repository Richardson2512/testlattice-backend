'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function SignupPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const supabase = createClient()

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setMessage(null)

    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/dashboard`,
        },
      })

      if (error) throw error

      setMessage('Check your email to confirm your account!')
    } catch (error: any) {
      setError(error.message || 'Failed to sign up')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main style={{ 
      display: 'flex', 
      justifyContent: 'center', 
      alignItems: 'center', 
      minHeight: 'calc(100vh - 80px)',
      padding: '2rem',
      background: 'linear-gradient(135deg, var(--beige-50) 0%, var(--beige-100) 100%)',
      position: 'relative',
    }}>
      {/* Decorative Background Elements */}
      <div style={{
        position: 'absolute',
        top: '-20%',
        right: '-10%',
        width: '500px',
        height: '500px',
        background: 'radial-gradient(circle, rgba(153, 27, 27, 0.05) 0%, transparent 70%)',
        borderRadius: '50%',
        zIndex: 0,
      }} />
      <div style={{
        position: 'absolute',
        bottom: '-20%',
        left: '-10%',
        width: '400px',
        height: '400px',
        background: 'radial-gradient(circle, rgba(153, 27, 27, 0.03) 0%, transparent 70%)',
        borderRadius: '50%',
        zIndex: 0,
      }} />

      <div className="card" style={{
        width: '100%',
        maxWidth: '440px',
        padding: '3rem',
        position: 'relative',
        zIndex: 1,
        boxShadow: 'var(--shadow-xl)',
      }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '64px',
            height: '64px',
            borderRadius: 'var(--radius-full)',
            background: 'linear-gradient(135deg, var(--maroon-800) 0%, var(--maroon-600) 100%)',
            marginBottom: '1.5rem',
            boxShadow: 'var(--shadow-md)',
          }}>
            <span style={{ fontSize: '1.5rem' }}>🚀</span>
          </div>
          <h1 style={{ 
            fontSize: '2rem', 
            fontWeight: '700', 
            marginBottom: '0.5rem',
            color: 'var(--text-primary)',
          }}>
            Get Started
          </h1>
          <p style={{
            color: 'var(--text-secondary)',
            fontSize: '0.9375rem',
          }}>
            Create your TestLattice account
          </p>
        </div>

        {error && (
          <div style={{
            padding: '0.875rem 1rem',
            marginBottom: '1.5rem',
            backgroundColor: 'var(--error-light)',
            color: 'var(--error)',
            borderRadius: 'var(--radius-md)',
            fontSize: '0.875rem',
            border: '1px solid rgba(220, 38, 38, 0.2)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}>
            <span>⚠️</span>
            <span>{error}</span>
          </div>
        )}

        {message && (
          <div style={{
            padding: '0.875rem 1rem',
            marginBottom: '1.5rem',
            backgroundColor: 'var(--success-light)',
            color: 'var(--success)',
            borderRadius: 'var(--radius-md)',
            fontSize: '0.875rem',
            border: '1px solid rgba(16, 185, 129, 0.2)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}>
            <span>✅</span>
            <span>{message}</span>
          </div>
        )}

        <form onSubmit={handleSignup}>
          <div style={{ marginBottom: '1.25rem' }}>
            <label 
              htmlFor="email" 
              style={{ 
                display: 'block', 
                marginBottom: '0.5rem', 
                fontSize: '0.875rem', 
                fontWeight: '600',
                color: 'var(--text-primary)',
              }}
            >
              Email Address
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="input"
              placeholder="you@example.com"
            />
          </div>

          <div style={{ marginBottom: '2rem' }}>
            <label 
              htmlFor="password" 
              style={{ 
                display: 'block', 
                marginBottom: '0.5rem', 
                fontSize: '0.875rem', 
                fontWeight: '600',
                color: 'var(--text-primary)',
              }}
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="input"
              placeholder="Create a strong password"
            />
            <p style={{ 
              marginTop: '0.5rem', 
              fontSize: '0.8125rem', 
              color: 'var(--text-tertiary)',
            }}>
              Must be at least 6 characters
            </p>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn btn-primary"
            style={{
              width: '100%',
              padding: '0.875rem',
              fontSize: '1rem',
              fontWeight: '600',
              marginBottom: '1.5rem',
            }}
          >
            {loading ? 'Creating account...' : 'Create Account'}
          </button>
        </form>

        <p style={{ 
          marginTop: '1.5rem', 
          textAlign: 'center', 
          fontSize: '0.875rem', 
          color: 'var(--text-secondary)',
        }}>
          Already have an account?{' '}
          <Link 
            href="/login" 
            style={{ 
              color: 'var(--text-link)', 
              textDecoration: 'none',
              fontWeight: '600',
            }}
          >
            Sign in
          </Link>
        </p>
      </div>
    </main>
  )
}

