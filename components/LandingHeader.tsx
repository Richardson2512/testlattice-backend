'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { User } from '@supabase/supabase-js'
import { NAV_ITEMS } from '@/lib/navigation-config'

export function LandingHeader() {
  const [user, setUser] = useState<User | null>(null)
  const [mounted, setMounted] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null)
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
          <Image src="/image/R-logo.png" alt="Rihario Logo" width={32} height={32} style={{ objectFit: 'contain' }} />
          <span className="text-gradient" style={{ fontSize: '1.25rem', fontWeight: 700 }}>Rihario</span>
        </Link>

        {/* Navigation Links (Desktop) */}
        <div style={{ display: 'flex', gap: '2rem', alignItems: 'center' }} className="desktop-nav">

          {/* Features Dropdown */}
          <div
            className="nav-dropdown-trigger"
            style={{ position: 'relative', cursor: 'pointer', padding: '10px 0' }}
            onMouseEnter={() => setActiveDropdown('features')}
            onMouseLeave={() => setActiveDropdown(null)}
          >
            <span style={{ color: 'var(--text-secondary)', fontWeight: 500, fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
              Features <span style={{ fontSize: '0.7rem' }}>▼</span>
            </span>
            <div className="nav-dropdown-content" style={{
              position: 'absolute',
              top: '100%',
              left: '-1rem',
              background: 'var(--bg-glass)',
              backdropFilter: 'blur(12px)',
              border: '1px solid var(--border-light)',
              borderRadius: 'var(--radius-lg)',
              padding: '0.5rem',
              minWidth: '220px',
              boxShadow: 'var(--shadow-glass)',
              display: activeDropdown === 'features' ? 'block' : 'none',
              zIndex: 100
            }}>
              {NAV_ITEMS.features.map((item) => (
                <Link
                  key={item.name}
                  href={item.href}
                  className="dropdown-item"
                  style={{
                    padding: '0.5rem 0.75rem',
                    borderRadius: '6px',
                    color: 'var(--text-primary)',
                    textDecoration: 'none',
                    fontSize: '0.9rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}
                >
                  {item.name}
                  {(item as any).isNew && (
                    <span style={{ fontSize: '0.6rem', background: 'var(--maroon-100)', color: 'var(--maroon-900)', padding: '2px 6px', borderRadius: '4px', fontWeight: 700 }}>NEW</span>
                  )}
                </Link>
              ))}
            </div>
          </div>

          {/* Resources Dropdown */}
          <div
            className="nav-dropdown-trigger"
            style={{ position: 'relative', cursor: 'pointer', padding: '10px 0' }}
            onMouseEnter={() => setActiveDropdown('resources')}
            onMouseLeave={() => setActiveDropdown(null)}
          >
            <span style={{ color: 'var(--text-secondary)', fontWeight: 500, fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
              Resources <span style={{ fontSize: '0.7rem' }}>▼</span>
            </span>
            <div className="nav-dropdown-content" style={{
              position: 'absolute',
              top: '100%',
              left: '-1rem',
              background: 'var(--bg-glass)',
              backdropFilter: 'blur(12px)',
              border: '1px solid var(--border-light)',
              borderRadius: 'var(--radius-lg)',
              padding: '0.5rem',
              minWidth: '180px',
              boxShadow: 'var(--shadow-glass)',
              display: activeDropdown === 'resources' ? 'block' : 'none',
              zIndex: 100
            }}>
              {NAV_ITEMS.resources.map((item) => (
                <Link key={item.name} href={item.href} className="dropdown-item" style={{ display: 'block', padding: '0.5rem 0.75rem', borderRadius: '6px', color: 'var(--text-primary)', textDecoration: 'none' }}>{item.name}</Link>
              ))}
            </div>
          </div>

          <Link href="/pricing" style={{
            color: 'var(--text-secondary)', fontWeight: 500, fontSize: '0.95rem', textDecoration: 'none'
          }}>
            Pricing
          </Link>
          <Link href="/why-rihario" style={{
            color: 'var(--maroon-800)', fontWeight: 600, fontSize: '0.95rem', textDecoration: 'none',
            padding: '0.5rem 1rem', background: 'var(--bg-tertiary)', borderRadius: '50px',
            border: '1px solid var(--accent-red-subtle)'
          }}>
            Why Rihario?
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
        .dropdown-item:hover {
            background: var(--bg-tertiary);
        }
      `}</style>
    </header>
  )
}

