'use client'

import React, { useState } from 'react'

interface ShareButtonProps {
  testId: string
  testUrl?: string
}

export function ShareButton({ testId, testUrl }: ShareButtonProps) {
  const [copied, setCopied] = useState(false)

  const shareUrl = testUrl || (typeof window !== 'undefined' ? `${window.location.origin}/test/report/${testId}` : `/test/report/${testId}`)

  const handleShare = async () => {
    try {
      // Try native share API first (mobile)
      if (navigator.share) {
        await navigator.share({
          title: 'Test Results - TestLattice',
          text: 'Check out my test results!',
          url: shareUrl,
        })
        return
      }

      // Fallback to clipboard
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      // User cancelled or error occurred
      console.error('Share failed:', error)
    }
  }

  return (
    <button
      onClick={handleShare}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        padding: '0.5rem 1rem',
        backgroundColor: 'transparent',
        border: '1px solid rgba(255, 255, 255, 0.2)',
        borderRadius: 'var(--radius-md)',
        color: 'var(--text-primary)',
        cursor: 'pointer',
        fontSize: '0.875rem',
        transition: 'all 0.2s',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = 'transparent'
      }}
    >
      <span>{copied ? '✓' : '🔗'}</span>
      <span>{copied ? 'Copied!' : 'Share Results'}</span>
    </button>
  )
}

