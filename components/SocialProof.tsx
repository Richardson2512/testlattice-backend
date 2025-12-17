'use client'

import React from 'react'

export function SocialProof() {
  // In production, fetch this from an API
  const stats = {
    users: 847,
    tests: 12450,
    period: 'this week',
  }

  return (
    <div style={{
      padding: '1rem',
      backgroundColor: 'rgba(0, 0, 0, 0.2)',
      borderRadius: 'var(--radius-lg)',
      marginBottom: '1.5rem',
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '1rem',
        flexWrap: 'wrap',
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '-0.5rem',
        }}>
          {/* Avatar placeholders */}
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                backgroundColor: `hsl(${i * 120}, 70%, 60%)`,
                border: '2px solid var(--bg-secondary)',
                marginLeft: i > 1 ? '-8px' : '0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                fontWeight: '600',
                fontSize: '0.75rem',
              }}
            >
              {String.fromCharCode(64 + i)}
            </div>
          ))}
        </div>
        <div>
          <p style={{
            margin: 0,
            fontSize: '0.875rem',
            color: 'var(--text-secondary)',
          }}>
            <strong style={{ color: 'var(--text-primary)' }}>{stats.users.toLocaleString()} developers</strong> tested their MVPs {stats.period}
          </p>
        </div>
      </div>
    </div>
  )
}

