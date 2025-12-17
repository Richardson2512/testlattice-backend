'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { User } from '@supabase/supabase-js'

type NavItem = {
  label: string
  href: string
  icon: string
  match?: string
  external?: boolean
}

const workspaceNav: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: '📊', match: '/dashboard' },
  { label: 'Create Test', href: '/dashboard#new-test', icon: '⚡', match: '/dashboard' },
  { label: 'Recent Runs', href: '/dashboard#runs', icon: '🧪', match: '/dashboard' },
  { label: 'Reports', href: '/dashboard#reports', icon: '📑', match: '/dashboard' },
]

const resourcesNav: NavItem[] = [
  { label: 'Home', href: '/', icon: '🏠', match: '/' },
  { label: 'Support', href: 'mailto:support@testlattice.dev', icon: '💬', external: true },
]

export default function Navigation() {
  const router = useRouter()
  const pathname = usePathname()
  const supabase = createClient()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [isCollapsed, setIsCollapsed] = useState(false)
  const expandedWidth = 260
  const collapsedWidth = 80
  const sidebarWidth = isCollapsed ? collapsedWidth : expandedWidth

  useEffect(() => {
    const getUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      setUser(user)
      setLoading(false)
    }

    getUser()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
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
    const match = item.match || item.href.split('#')[0]
    if (!match) return false
    if (match === '/') {
      return pathname === '/'
    }
    return pathname?.startsWith(match)
  }

  const baseNavItemStyle = (active: boolean) => ({
    display: 'flex',
    alignItems: 'center',
    gap: isCollapsed ? '0' : '0.75rem',
    padding: '0.65rem 0.85rem',
    borderRadius: 'var(--radius-md)',
    border: 'none',
    background: active ? 'var(--beige-100)' : 'transparent',
    color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
    fontWeight: active ? 600 : 500,
    fontSize: '0.95rem',
    width: '100%',
    transition: 'all var(--transition-fast)',
    cursor: 'pointer',
    textDecoration: 'none',
  })

  const collapsedLabelStyle = useMemo(
    () => ({
      display: isCollapsed ? 'none' : 'inline-flex',
      whiteSpace: 'nowrap' as const,
    }),
    [isCollapsed]
  )

  return (
    <aside
      style={{
        width: `${sidebarWidth}px`,
        background: 'var(--bg-secondary)',
        borderRight: '1px solid var(--border-light)',
        padding: '1.25rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '1.25rem',
        position: 'fixed',
        top: 0,
        left: 0,
        height: '100vh',
        overflowY: 'auto',
        overscrollBehavior: 'contain',
        transition: 'width var(--transition-base)',
        zIndex: 100,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: isCollapsed ? 'center' : 'space-between',
          gap: '0.5rem',
        }}
      >
        <Link
          href="/"
          style={{
            fontSize: '1.45rem',
            fontWeight: 700,
            textDecoration: 'none',
            background: 'linear-gradient(135deg, var(--maroon-800) 0%, var(--maroon-600) 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            letterSpacing: '-0.02em',
            display: 'inline-flex',
            justifyContent: isCollapsed ? 'center' : 'flex-start',
          }}
        >
          {isCollapsed ? 'TL' : 'TestLattice'}
        </Link>
        <button
          aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          onClick={() => setIsCollapsed((prev) => !prev)}
          style={{
            border: '1px solid var(--border-light)',
            borderRadius: 'var(--radius-full)',
            padding: '0.35rem',
            background: 'var(--bg-primary)',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <span style={{ fontSize: '0.85rem' }}>{isCollapsed ? '›' : '‹'}</span>
        </button>
      </div>

      <div>
        {!isCollapsed && (
          <p style={{ color: 'var(--text-tertiary)', fontSize: '0.75rem', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            Workspace
          </p>
        )}
        <div style={{ marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          {workspaceNav.map((item) => {
            const active = isActive(item)
            const content = (
              <>
                <span aria-hidden="true" style={{ fontSize: '1rem' }}>
                  {item.icon}
                </span>
                <span style={collapsedLabelStyle}>{item.label}</span>
              </>
            )
            return item.external ? (
              <a key={item.label} href={item.href} style={baseNavItemStyle(active)} target="_blank" rel="noreferrer">
                {content}
              </a>
            ) : (
              <Link key={item.label} href={item.href} style={baseNavItemStyle(active)}>
                {content}
              </Link>
            )
          })}
        </div>
      </div>

      <div>
        {!isCollapsed && (
          <p style={{ color: 'var(--text-tertiary)', fontSize: '0.75rem', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            Resources
          </p>
        )}
        <div style={{ marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          {resourcesNav.map((item) => {
            const active = isActive(item)
            const content = (
              <>
                <span aria-hidden="true" style={{ fontSize: '1rem' }}>
                  {item.icon}
                </span>
                <span style={collapsedLabelStyle}>{item.label}</span>
              </>
            )
            return item.external ? (
              <a key={item.label} href={item.href} style={baseNavItemStyle(active)} target="_blank" rel="noreferrer">
                {content}
              </a>
            ) : (
              <Link key={item.label} href={item.href} style={baseNavItemStyle(active)}>
                {content}
              </Link>
            )
          })}
        </div>
      </div>

      <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {user && !loading ? (
          <div
            style={{
              padding: '0.9rem',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--border-light)',
              background: 'var(--bg-primary)',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.65rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, var(--maroon-700) 0%, var(--maroon-800) 100%)',
                  color: 'white',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {user.email?.charAt(0).toUpperCase() || 'U'}
              </div>
              {!isCollapsed && (
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {user.email?.split('@')[0]}
                  </span>
                  <span
                    style={{
                      fontSize: '0.8rem',
                      color: 'var(--text-tertiary)',
                      maxWidth: '150px',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {user.email}
                  </span>
                </div>
              )}
            </div>
            {!isCollapsed && (
              <button
                onClick={handleSignOut}
                className="btn btn-ghost"
                style={{ width: '100%', fontSize: '0.85rem', padding: '0.5rem 0.75rem' }}
              >
                Sign out
              </button>
            )}
          </div>
        ) : loading ? (
          <div style={{ textAlign: isCollapsed ? 'center' : 'left', color: 'var(--text-tertiary)', fontSize: '0.85rem' }}>
            Loading profile…
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <Link href="/login" className="btn btn-ghost" style={{ fontSize: '0.85rem', padding: '0.55rem 0.75rem' }}>
              {isCollapsed ? '→' : 'Sign in'}
            </Link>
            <Link href="/signup" className="btn btn-primary" style={{ fontSize: '0.85rem', padding: '0.55rem 0.75rem' }}>
              {isCollapsed ? '+' : 'Create account'}
            </Link>
          </div>
        )}

        {!isCollapsed && (
          <div
            style={{
              border: '1px solid var(--border-light)',
              borderRadius: 'var(--radius-lg)',
              padding: '0.75rem',
              background: 'var(--beige-50)',
            }}
          >
            <p style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.2rem' }}>Need help?</p>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', marginBottom: '0.6rem' }}>
              Chat with the team or explore docs to get started faster.
            </p>
            <a
              href="mailto:support@testlattice.dev"
              className="btn btn-secondary"
              style={{ width: '100%', fontSize: '0.8rem', padding: '0.5rem 0.75rem' }}
            >
              Contact support
            </a>
          </div>
        )}
      </div>
    </aside>
  )
}
