'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { User } from '@supabase/supabase-js'

type NavItem = {
  id: string
  label: string
  href: string
  icon: string
  disabled?: boolean
}

const bottomNav: NavItem[] = [
  { id: 'pricing', label: 'Pricing', href: '/pricing', icon: '💰' },
]

export default function Navigation() {
  const router = useRouter()
  const pathname = usePathname()
  const supabase = createClient()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [userTier, setUserTier] = useState<string>('free')
  const expandedWidth = 280
  const collapsedWidth = 72
  const sidebarWidth = isCollapsed ? collapsedWidth : expandedWidth

  // Build nav items dynamically based on admin status
  const mainNav: NavItem[] = useMemo(() => {
    const items: NavItem[] = [
      { id: 'dashboard', label: 'Dashboard', href: '/dashboard', icon: '📊' },
      { id: 'runs', label: 'Test Runs', href: '/runs', icon: '🔬' },
      { id: 'projects', label: 'Projects', href: '#', icon: '📁', disabled: true },
      { id: 'profile', label: 'Profile', href: '/profile', icon: '👤' },
    ]

    // Add admin link if user is admin
    if (isAdmin) {
      items.push({ id: 'admin', label: 'Admin', href: '/admin', icon: '🛡️' })
    }

    return items
  }, [isAdmin])

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)
      // Check if user has admin role
      if (user) {
        const userIsAdmin = user.app_metadata?.role === 'admin' || user.user_metadata?.role === 'admin'
        setIsAdmin(userIsAdmin)

        // Fetch user's subscription tier
        try {
          const { data: { session } } = await supabase.auth.getSession()
          if (session?.access_token) {
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
            const res = await fetch(`${apiUrl}/api/billing/subscription`, {
              headers: { Authorization: `Bearer ${session.access_token}` },
            })
            if (res.ok) {
              const data = await res.json()
              setUserTier(data.subscription?.tier || 'free')
            }
          }
        } catch (err) {
          console.warn('Failed to fetch subscription:', err)
        }
      }
      setLoading(false)
    }
    getUser()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [supabase])

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 1024
      setIsCollapsed(mobile)
    }
    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.style.setProperty('--sidebar-width', `${sidebarWidth}px`)
    }
  }, [sidebarWidth])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const isActive = (item: NavItem) => {
    if (item.disabled) return false
    if (item.href === '/dashboard') return pathname?.startsWith('/dashboard')
    return pathname === item.href
  }

  return (
    <aside
      style={{
        width: `${sidebarWidth}px`,
        background: 'var(--bg-card)',
        borderRight: '1px solid var(--border-light)',
        display: 'flex',
        flexDirection: 'column',
        position: 'fixed',
        top: 0,
        left: 0,
        height: '100vh',
        overflowY: 'auto',
        transition: 'width 0.2s ease',
        zIndex: 100,
      }}
    >
      {/* Logo */}
      <div style={{
        padding: isCollapsed ? '1.25rem 0.75rem' : '1.25rem',
        borderBottom: '1px solid var(--border-light)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: isCollapsed ? 'center' : 'space-between',
      }}>
        <Link href="/" style={{
          fontSize: isCollapsed ? '1.25rem' : '1.15rem',
          fontWeight: 700,
          color: 'var(--primary)',
          textDecoration: 'none',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
        }}>
          <Image src="/image/R-logo.png" alt="Rihario Logo" width={24} height={24} style={{ objectFit: 'contain' }} />
          {!isCollapsed && 'Rihario'}
        </Link>
        {!isCollapsed && (
          <button
            onClick={() => setIsCollapsed(true)}
            style={{
              border: '1px solid var(--border-light)',
              borderRadius: 'var(--radius-full)',
              padding: '0.3rem',
              background: 'var(--bg-primary)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '0.75rem',
              color: 'var(--text-muted)',
            }}
          >
            ‹
          </button>
        )}
        {isCollapsed && (
          <button
            onClick={() => setIsCollapsed(false)}
            style={{
              position: 'absolute',
              right: '-12px',
              top: '20px',
              border: '1px solid var(--border-light)',
              borderRadius: 'var(--radius-full)',
              padding: '0.25rem 0.35rem',
              background: 'var(--bg-card)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '0.7rem',
              color: 'var(--text-muted)',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            ›
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav style={{ flex: 1, padding: isCollapsed ? '0.75rem 0.5rem' : '1rem 0.75rem' }}>
        {!isCollapsed && (
          <p style={{ color: 'var(--text-muted)', fontSize: '0.7rem', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '0.5rem', paddingLeft: '0.75rem' }}>
            Menu
          </p>
        )}
        {mainNav.map(item => {
          const active = isActive(item)

          if (item.disabled) {
            return (
              <div
                key={item.id}
                title={isCollapsed ? `${item.label} (Coming Soon)` : undefined}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: isCollapsed ? 0 : '0.75rem',
                  padding: isCollapsed ? '0.65rem' : '0.65rem 0.85rem',
                  borderRadius: 'var(--radius-md)',
                  marginBottom: '0.25rem',
                  fontSize: '0.9rem',
                  fontWeight: 500,
                  color: 'var(--text-muted)',
                  background: 'transparent',
                  cursor: 'not-allowed',
                  opacity: 0.5,
                  justifyContent: isCollapsed ? 'center' : 'flex-start',
                }}
              >
                <span style={{ fontSize: '1rem' }}>{item.icon}</span>
                {!isCollapsed && (
                  <>
                    <span style={{ flex: 1 }}>{item.label}</span>
                    <span style={{ fontSize: '0.6rem', background: 'var(--beige-200)', padding: '2px 6px', borderRadius: '4px', color: 'var(--text-muted)' }}>Soon</span>
                  </>
                )}
              </div>
            )
          }

          return (
            <Link
              key={item.id}
              href={item.href}
              title={isCollapsed ? item.label : undefined}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: isCollapsed ? 0 : '0.75rem',
                padding: isCollapsed ? '0.65rem' : '0.65rem 0.85rem',
                borderRadius: 'var(--radius-md)',
                marginBottom: '0.25rem',
                textDecoration: 'none',
                fontSize: '0.9rem',
                fontWeight: active ? 600 : 500,
                color: active ? 'var(--primary)' : 'var(--text-secondary)',
                background: active ? 'rgba(92, 15, 15, 0.08)' : 'transparent',
                transition: 'all 0.15s ease',
                justifyContent: isCollapsed ? 'center' : 'flex-start',
              }}
            >
              <span style={{ fontSize: '1rem' }}>{item.icon}</span>
              {!isCollapsed && <span>{item.label}</span>}
            </Link>
          )
        })}
      </nav>

      {/* Bottom Navigation - Pricing */}
      <nav style={{ padding: isCollapsed ? '0.75rem 0.5rem' : '1rem 0.75rem', borderTop: '1px solid var(--border-light)' }}>
        {!isCollapsed && (
          <p style={{ color: 'var(--text-muted)', fontSize: '0.7rem', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '0.5rem', paddingLeft: '0.75rem' }}>
            Account
          </p>
        )}
        {bottomNav.map(item => {
          const active = isActive(item)

          return (
            <Link
              key={item.id}
              href={item.href}
              title={isCollapsed ? item.label : undefined}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: isCollapsed ? 0 : '0.75rem',
                padding: isCollapsed ? '0.65rem' : '0.65rem 0.85rem',
                borderRadius: 'var(--radius-md)',
                marginBottom: '0.25rem',
                textDecoration: 'none',
                fontSize: '0.9rem',
                fontWeight: active ? 600 : 500,
                color: active ? 'var(--primary)' : 'var(--text-secondary)',
                background: active ? 'rgba(92, 15, 15, 0.08)' : 'transparent',
                transition: 'all 0.15s ease',
                justifyContent: isCollapsed ? 'center' : 'flex-start',
              }}
            >
              <span style={{ fontSize: '1rem' }}>{item.icon}</span>
              {!isCollapsed && <span>{item.label}</span>}
            </Link>
          )
        })}
      </nav>

      {/* User Section */}
      <div style={{
        padding: isCollapsed ? '0.75rem' : '1rem',
        borderTop: '1px solid var(--border-light)',
      }}>
        {user && !loading ? (
          <div style={{
            padding: isCollapsed ? '0.5rem' : '0.75rem',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-light)',
            background: 'var(--bg-primary)',
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.65rem',
              justifyContent: isCollapsed ? 'center' : 'flex-start',
            }}>
              <div style={{
                width: '32px',
                height: '32px',
                borderRadius: 'var(--radius-full)',
                background: 'linear-gradient(135deg, var(--primary) 0%, var(--maroon-700) 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                fontWeight: 600,
                fontSize: '0.8rem',
                flexShrink: 0,
              }}>
                {user.email?.charAt(0).toUpperCase() || 'U'}
              </div>
              {!isCollapsed && (
                <div style={{ overflow: 'hidden' }}>
                  <div style={{
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    color: 'var(--text-primary)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>
                    {user.email?.split('@')[0]}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'capitalize' }}>{userTier} Plan</div>
                </div>
              )}
            </div>
            {!isCollapsed && (
              <button
                onClick={handleSignOut}
                style={{
                  width: '100%',
                  marginTop: '0.5rem',
                  padding: '0.4rem',
                  background: 'transparent',
                  border: '1px solid var(--border-medium)',
                  borderRadius: 'var(--radius-sm)',
                  color: 'var(--text-secondary)',
                  fontSize: '0.75rem',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                Sign Out
              </button>
            )}
          </div>
        ) : loading ? (
          <div style={{
            textAlign: 'center',
            color: 'var(--text-muted)',
            fontSize: '0.8rem',
            padding: '1rem',
          }}>
            Loading...
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <Link
              href="/login"
              style={{
                display: 'block',
                textAlign: 'center',
                padding: '0.5rem',
                background: 'transparent',
                border: '1px solid var(--border-medium)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--text-primary)',
                fontSize: '0.85rem',
                textDecoration: 'none',
              }}
            >
              {isCollapsed ? '→' : 'Sign In'}
            </Link>
          </div>
        )}
      </div>
    </aside>
  )
}
