'use client'

import React, { useState, useEffect } from 'react'

interface UrgencyTimerProps {
  expiresAt: string
  onExpired?: () => void
}

export function UrgencyTimer({ expiresAt, onExpired }: UrgencyTimerProps) {
  const [timeLeft, setTimeLeft] = useState<string>('')
  const [isExpired, setIsExpired] = useState(false)

  useEffect(() => {
    const updateTimer = () => {
      const now = new Date().getTime()
      const expiry = new Date(expiresAt).getTime()
      const difference = expiry - now

      if (difference <= 0) {
        setTimeLeft('Expired')
        setIsExpired(true)
        if (onExpired) {
          onExpired()
        }
        return
      }

      const hours = Math.floor(difference / (1000 * 60 * 60))
      const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60))
      const seconds = Math.floor((difference % (1000 * 60)) / 1000)

      if (hours > 0) {
        setTimeLeft(`${hours}h ${minutes}m`)
      } else if (minutes > 0) {
        setTimeLeft(`${minutes}m ${seconds}s`)
      } else {
        setTimeLeft(`${seconds}s`)
      }
    }

    updateTimer()
    const interval = setInterval(updateTimer, 1000)

    return () => clearInterval(interval)
  }, [expiresAt, onExpired])

  if (isExpired) {
    return (
      <div style={{
        padding: '0.75rem 1rem',
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        border: '1px solid rgba(239, 68, 68, 0.3)',
        borderRadius: 'var(--radius-md)',
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
      }}>
        <span style={{ fontSize: '1.25rem' }}>⏰</span>
        <p style={{
          margin: 0,
          fontSize: '0.875rem',
          color: '#ef4444',
          fontWeight: '600',
        }}>
          Results have expired
        </p>
      </div>
    )
  }

  const isUrgent = timeLeft.includes('m') && parseInt(timeLeft) < 60

  return (
    <div style={{
      padding: '0.75rem 1rem',
      backgroundColor: isUrgent ? 'rgba(239, 68, 68, 0.1)' : 'rgba(234, 179, 8, 0.1)',
      border: `1px solid ${isUrgent ? 'rgba(239, 68, 68, 0.3)' : 'rgba(234, 179, 8, 0.3)'}`,
      borderRadius: 'var(--radius-md)',
      display: 'flex',
      alignItems: 'center',
      gap: '0.5rem',
    }}>
      <span style={{ fontSize: '1.25rem' }}>⏰</span>
      <p style={{
        margin: 0,
        fontSize: '0.875rem',
        color: isUrgent ? '#ef4444' : '#eab308',
      }}>
        Results expire in <strong style={{ fontWeight: '700' }}>{timeLeft}</strong>
      </p>
    </div>
  )
}

