'use client'

import Link from 'next/link'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { User } from '@supabase/supabase-js'

export function LandingHeader() {
  const [user, setUser] = useState<User | null>(null)
  const [mounted, setMounted] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    setMounted(true)
    const getUser = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        setUser(user)
      } catch (error) {
        setUser(null)
      }
    }
    getUser()
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    const handleScroll = () => {
      if (typeof window !== 'undefined') {
        setScrolled(window.scrollY > 20)
      }
    }

    if (typeof window !== 'undefined') {
      window.addEventListener('scroll', handleScroll)
      handleScroll()
    }

    return () => {
      subscription.unsubscribe()
      if (typeof window !== 'undefined') {
        window.removeEventListener('scroll', handleScroll)
      }
    }
  }, [supabase])

  if (!mounted) return <header className="glass-panel" style={{ height: '70px', position: 'fixed', top: 0, width: '100%', zIndex: 100 }} />
  if (user) return null

  return (
    <header
      className={scrolled ? 'glass-panel' : ''}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 1000,
        transition: 'all 0.3s ease',
        background: scrolled ? 'var(--bg-glass-strong)' : 'transparent',
        borderBottom: scrolled ? '1px solid var(--border-light)' : 'none',
        padding: '0.5rem 0'
      }}
    >
      <nav className="container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '60px' }}>
        {/* Logo */}
        <Link href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span style={{ fontSize: '1.5rem' }}>🧪</span>
          <span className="text-gradient" style={{ fontSize: '1.25rem', fontWeight: 700 }}>TestLattice</span>
        </Link>

        {/* Navigation Links (Desktop) */}
        <div style={{ display: 'flex', gap: '2rem', alignItems: 'center' }} className="desktop-nav">

          {/* Features Dropdown */}
          <div className="nav-dropdown-trigger" style={{ position: 'relative', cursor: 'pointer' }}>
            <span style={{ color: 'var(--text-secondary)', fontWeight: 500, fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
              Features <span style={{ fontSize: '0.7rem' }}>▼</span>
            </span>
            <div className="nav-dropdown-content" style={{
              position: 'absolute',
              top: '100%',
              left: '-20px',
              width: '240px',
              background: '#fff',
              border: '1px solid var(--border-subtle)',
              borderRadius: '8px',
              boxShadow: '0 10px 30px -5px rgba(0,0,0,0.1)',
              padding: '0.5rem',
              display: 'none', // Controlled by CSS class usually, but for simplicity here strictly reliant on CSS hover in globals or standard styles
              opacity: 0,
              transform: 'translateY(10px)',
              transition: 'all 0.2s ease',
              pointerEvents: 'none'
            }}>
              {[
                { label: 'Self-Healing Tests', href: '/features#healing' },
                { label: 'Live Browser Control', href: '/features#browser' },
                { label: 'Smart Analytics', href: '/features#analytics' },
                { label: 'CI/CD Native', href: '/features#cicd' },
                { label: 'Mobile Testing', href: '/features#mobile' },
                { label: 'Parallel Execution', href: '/features#parallel' },
                { label: 'Visual Regression', href: '/features#visual' },
                { label: 'Video Replay', href: '/features#video' },
              ].map((item, i) => (
                <Link key={i} href={item.href} style={{
                  display: 'block', padding: '0.5rem 0.75rem',
                  borderRadius: '6px', textDecoration: 'none', color: 'var(--text-primary)',
                  transition: 'background 0.1s', fontSize: '0.9rem'
                }} className="dropdown-item">
                  {item.label}
                </Link>
              ))}
            </div>
          </div>

          {/* Resources Dropdown */}
          <div className="nav-dropdown-trigger" style={{ position: 'relative', cursor: 'pointer' }}>
            <span style={{ color: 'var(--text-secondary)', fontWeight: 500, fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
              Resources <span style={{ fontSize: '0.7rem' }}>▼</span>
            </span>
            <div className="nav-dropdown-content" style={{
              position: 'absolute',
              top: '100%',
              left: '-20px',
              width: '200px',
              background: '#fff',
              border: '1px solid var(--border-subtle)',
              borderRadius: '8px',
              boxShadow: '0 10px 30px -5px rgba(0,0,0,0.1)',
              padding: '0.5rem',
              opacity: 0,
              transform: 'translateY(10px)',
              transition: 'all 0.2s ease',
              pointerEvents: 'none'
            }}>
              <Link href="/docs" className="dropdown-item" style={{ display: 'block', padding: '0.5rem 0.75rem', borderRadius: '6px', color: 'var(--text-primary)', textDecoration: 'none' }}>Documentation</Link>
              <Link href="#" className="dropdown-item" style={{ display: 'block', padding: '0.5rem 0.75rem', borderRadius: '6px', color: 'var(--text-primary)', textDecoration: 'none' }}>Blog</Link>
              <Link href="#" className="dropdown-item" style={{ display: 'block', padding: '0.5rem 0.75rem', borderRadius: '6px', color: 'var(--text-primary)', textDecoration: 'none' }}>Community</Link>
            </div>
          </div>

          <Link href="/why-testlattice" className="btn-shine" style={{
            color: 'var(--maroon-800)', fontWeight: 600, fontSize: '0.95rem', textDecoration: 'none',
            padding: '0.5rem 1rem', background: 'var(--bg-tertiary)', borderRadius: '50px',
            border: '1px solid var(--accent-red-subtle)'
          }}>
            Why TestLattice?
          </Link>
        </div>

        {/* Auth Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <Link href="/login" className="btn btn-secondary" style={{ padding: '0.5rem 1.25rem', fontSize: '0.9rem' }}>
            Sign In
          </Link>
          <Link href="/signup" className="btn btn-primary" style={{ padding: '0.5rem 1.25rem', fontSize: '0.9rem' }}>
            Get Started
          </Link>
        </div>
      </nav>
      <style jsx>{`
        .nav-dropdown-trigger:hover .nav-dropdown-content {
            display: block !important;
            opacity: 1 !important;
            transform: translateY(0) !important;
            pointer-events: auto !important;
        }
        .dropdown-item:hover {
            background: var(--bg-tertiary);
        }
      `}</style>
    </header>
  )
}

