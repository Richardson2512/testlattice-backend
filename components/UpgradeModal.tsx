'use client'

import React from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { PRICING_TIERS, getNextTierForFeature, type PricingTier } from '@/lib/pricing'

interface UpgradeModalProps {
  isOpen: boolean
  onClose: () => void
  type: 'test-limit' | 'visual-test-limit' | 'locked-feature'
  feature?: string
  currentTier?: PricingTier
  recommendedTier?: PricingTier
}

export function UpgradeModal({
  isOpen,
  onClose,
  type,
  feature,
  currentTier = 'free',
  recommendedTier,
}: UpgradeModalProps) {
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  if (!isOpen || !mounted) return null

  const nextTier = recommendedTier || getNextTierForFeature(feature || '', currentTier) || 'starter'
  const tierInfo = PRICING_TIERS[nextTier]

  let title = ''
  let message = ''
  let primaryAction = 'Upgrade Plan'
  let secondaryAction: string | null = null

  switch (type) {
    case 'test-limit':
      title = "You've reached your monthly test limit"
      message = `You've used all ${PRICING_TIERS[currentTier].limits.totalTestsPerMonth} tests this month. Upgrade to continue testing.`
      break
    case 'visual-test-limit':
      title = 'Visual test limit reached'
      message = `You've used all ${PRICING_TIERS[currentTier].limits.maxVisualTests} visual tests this month.`
      primaryAction = 'Upgrade Plan'
      secondaryAction = 'Buy Visual Test Add-On'
      break
    case 'locked-feature':
      title = 'Feature Unavailable'
      const featureNames: Record<string, string> = {
        'mobile': 'Mobile Testing',
        'exports': 'Report Exports',
        'scheduled': 'Scheduled Tests',
        'multiple-projects': 'Multiple Projects',
        'unlimited-projects': 'Unlimited Projects',
      }
      const featureName = featureNames[feature || ''] || 'This Feature'
      message = `${featureName} is not available on your current plan. Upgrade to ${tierInfo.name} to unlock it.`
      break
  }

  return createPortal(
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(61, 54, 48, 0.5)',
        backdropFilter: 'blur(8px)',
        zIndex: 2000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem',
        animation: 'fadeIn 0.2s ease-out',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '520px',
          background: 'var(--bg-card)',
          borderRadius: 'var(--radius-lg)',
          padding: '2rem',
          position: 'relative',
          boxShadow: 'var(--shadow-lg)',
          animation: 'scaleIn 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '1rem',
            right: '1rem',
            background: 'none',
            border: 'none',
            fontSize: '1.5rem',
            cursor: 'pointer',
            color: 'var(--text-secondary)',
            width: '32px',
            height: '32px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 'var(--radius-sm)',
            transition: 'background 0.2s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'var(--beige-100)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'none'
          }}
        >
          ×
        </button>

        <div style={{ marginBottom: '1.5rem' }}>
          <h2 style={{
            fontSize: '1.5rem',
            fontWeight: 700,
            marginBottom: '0.75rem',
            color: 'var(--text-primary)'
          }}>
            {title}
          </h2>
          <p style={{
            fontSize: '1rem',
            color: 'var(--text-secondary)',
            lineHeight: 1.6,
            marginBottom: '1.5rem'
          }}>
            {message}
          </p>
        </div>

        {/* Recommended Tier Card */}
        <div style={{
          background: 'var(--beige-100)',
          borderRadius: 'var(--radius-md)',
          padding: '1.25rem',
          marginBottom: '1.5rem',
          border: '1px solid var(--border-light)'
        }}>
          <div style={{
            fontSize: '0.75rem',
            fontWeight: 600,
            color: 'var(--primary)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            marginBottom: '0.5rem'
          }}>
            Recommended Plan
          </div>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <div>
              <div style={{
                fontSize: '1.25rem',
                fontWeight: 700,
                color: 'var(--text-primary)',
                marginBottom: '0.25rem'
              }}>
                {tierInfo.name}
              </div>
              <div style={{
                fontSize: '0.875rem',
                color: 'var(--text-secondary)'
              }}>
                {tierInfo.priceLabel}/month
              </div>
            </div>
            <div style={{
              fontSize: '0.875rem',
              color: 'var(--text-secondary)'
            }}>
              {tierInfo.limits.totalTestsPerMonth} tests/mo
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{
          display: 'flex',
          gap: '0.75rem',
          flexDirection: secondaryAction ? 'column' : 'row'
        }}>
          <Link
            href="/pricing"
            style={{
              flex: 1,
              display: 'block',
              padding: '0.875rem 1.5rem',
              textAlign: 'center',
              background: 'var(--primary)',
              color: 'var(--text-inverse)',
              borderRadius: 'var(--radius-md)',
              fontWeight: 600,
              textDecoration: 'none',
              transition: 'all 0.2s ease',
              boxShadow: 'var(--shadow-md)',
            }}
            onClick={onClose}
          >
            {primaryAction}
          </Link>
          {secondaryAction && (
            <button
              onClick={() => {
                // TODO: Open add-on purchase modal
                alert('Add-on purchase - Coming soon!')
              }}
              style={{
                flex: 1,
                padding: '0.875rem 1.5rem',
                textAlign: 'center',
                background: 'transparent',
                border: '1px solid var(--border-medium)',
                color: 'var(--text-primary)',
                borderRadius: 'var(--radius-md)',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
            >
              {secondaryAction}
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}

