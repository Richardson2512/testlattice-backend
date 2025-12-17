'use client'

import { useEffect, useState } from 'react'
import { theme } from '../lib/theme'

/**
 * Keyboard Shortcuts Overlay
 * Press '?' to show/hide
 */
export function KeyboardShortcuts() {
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Show/hide with '?' key
      if (e.key === '?' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault()
        setIsVisible(prev => !prev)
      }
      // Hide with Escape
      if (e.key === 'Escape' && isVisible) {
        setIsVisible(false)
      }
    }

    window.addEventListener('keydown', handleKeyPress)
    return () => window.removeEventListener('keydown', handleKeyPress)
  }, [isVisible])

  if (!isVisible) {
    return (
      <button
        onClick={() => setIsVisible(true)}
        style={{
          position: 'fixed',
          bottom: theme.spacing.lg,
          right: theme.spacing.lg,
          width: '40px',
          height: '40px',
          borderRadius: theme.radius.full,
          backgroundColor: theme.bg.tertiary,
          border: `1px solid ${theme.border.default}`,
          color: theme.text.secondary,
          fontSize: '1.25rem',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: theme.shadows.lg,
          zIndex: 999,
          transition: `all ${theme.transitions.fast}`,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = theme.bg.secondary
          e.currentTarget.style.transform = 'scale(1.1)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = theme.bg.tertiary
          e.currentTarget.style.transform = 'scale(1)'
        }}
      >
        ?
      </button>
    )
  }

  const shortcuts = [
    { key: '?', description: 'Show/hide keyboard shortcuts' },
    { key: 'Esc', description: 'Close modals and overlays' },
    { key: 'Space', description: 'Pause/Resume test (when running)' },
    { key: 'Space (hold)', description: 'Flicker mode in visual diff' },
    { key: 'G + D', description: 'Go to Dashboard' },
    { key: 'G + R', description: 'Go to current test Run' },
    { key: 'G + T', description: 'Go to test Report' },
    { key: 'H', description: 'Toggle "Show all elements" in Iron Man HUD' },
    { key: 'F', description: 'Toggle fullscreen in video player' },
    { key: '←/→', description: 'Navigate between steps' },
    { key: 'Cmd/Ctrl + K', description: 'Focus search (coming soon)' },
  ]

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: theme.bg.overlay,
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: theme.spacing.lg,
      }}
      onClick={() => setIsVisible(false)}
    >
      <div
        style={{
          backgroundColor: theme.bg.secondary,
          borderRadius: theme.radius.xl,
          padding: theme.spacing['2xl'],
          maxWidth: '600px',
          width: '100%',
          maxHeight: '80vh',
          overflowY: 'auto',
          boxShadow: theme.shadows.xl,
          border: `1px solid ${theme.border.default}`,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: theme.spacing.xl,
        }}>
          <h2 style={{
            fontSize: '1.5rem',
            fontWeight: '700',
            color: theme.text.primary,
            margin: 0,
          }}>
            ⌨️ Keyboard Shortcuts
          </h2>
          <button
            onClick={() => setIsVisible(false)}
            style={{
              background: 'transparent',
              border: 'none',
              fontSize: '1.5rem',
              cursor: 'pointer',
              color: theme.text.secondary,
              padding: theme.spacing.xs,
              lineHeight: 1,
            }}
          >
            ✕
          </button>
        </div>

        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: theme.spacing.sm,
        }}>
          {shortcuts.map((shortcut, idx) => (
            <div
              key={idx}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: theme.spacing.md,
                backgroundColor: theme.bg.tertiary,
                borderRadius: theme.radius.md,
                border: `1px solid ${theme.border.subtle}`,
              }}
            >
              <kbd
                style={{
                  padding: `${theme.spacing.xs} ${theme.spacing.sm}`,
                  backgroundColor: theme.bg.primary,
                  border: `1px solid ${theme.border.default}`,
                  borderRadius: theme.radius.sm,
                  fontFamily: 'monospace',
                  fontSize: '0.875rem',
                  color: theme.text.primary,
                  fontWeight: '600',
                  minWidth: '80px',
                  textAlign: 'center',
                }}
              >
                {shortcut.key}
              </kbd>
              <span style={{
                fontSize: '0.875rem',
                color: theme.text.secondary,
                flex: 1,
                marginLeft: theme.spacing.lg,
              }}>
                {shortcut.description}
              </span>
            </div>
          ))}
        </div>

        <div style={{
          marginTop: theme.spacing.xl,
          padding: theme.spacing.md,
          backgroundColor: theme.status.info.bg,
          border: `1px solid ${theme.status.info.border}`,
          borderRadius: theme.radius.md,
          fontSize: '0.875rem',
          color: theme.status.info.text,
        }}>
          <strong>💡 Pro Tip:</strong> Most shortcuts work context-aware. For example, Space only
          pauses/resumes when viewing a running test.
        </div>
      </div>
    </div>
  )
}

