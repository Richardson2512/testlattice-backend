'use client'

import React from 'react'
import Link from 'next/link'
import { getNextTierForFeature, PRICING_TIERS, type PricingTier } from '@/lib/pricing'

interface UpgradeBannerProps {
  feature: string
  currentTier: PricingTier
  onDismiss?: () => void
  variant?: 'inline' | 'tooltip'
}

const featureNames: Record<string, string> = {
  'mobile': 'Mobile Testing',
  'exports': 'Report Exports',
  'scheduled': 'Scheduled Tests',
  'multiple-projects': 'Multiple Projects',
  'unlimited-projects': 'Unlimited Projects',
}

export function UpgradeBanner({
  feature,
  currentTier,
  onDismiss,
  variant = 'inline',
}: UpgradeBannerProps) {
  const nextTier = getNextTierForFeature(feature, currentTier)
  if (!nextTier) return null

  const tierInfo = PRICING_TIERS[nextTier]
  const featureName = featureNames[feature] || 'This Feature'

  if (variant === 'tooltip') {
    return (
      <div style={{
        position: 'absolute',
        top: '100%',
        left: 0,
        marginTop: '0.5rem',
        padding: '0.75rem 1rem',
        background: 'var(--bg-card)',
        border: '1px solid var(--border-light)',
        borderRadius: 'var(--radius-md)',
        boxShadow: 'var(--shadow-lg)',
        zIndex: 1000,
        minWidth: '280px',
        fontSize: '0.875rem',
      }}>
        <div style={{
          color: 'var(--text-primary)',
          fontWeight: 600,
          marginBottom: '0.5rem'
        }}>
          {featureName} is locked
        </div>
        <div style={{
          color: 'var(--text-secondary)',
          marginBottom: '0.75rem',
          fontSize: '0.8125rem',
          lineHeight: 1.5
        }}>
          Upgrade to <strong>{tierInfo.name}</strong> to unlock this feature.
        </div>
        <Link
          href="/pricing"
          style={{
            display: 'inline-block',
            padding: '0.5rem 1rem',
            background: 'var(--primary)',
            color: 'var(--text-inverse)',
            borderRadius: 'var(--radius-sm)',
            fontWeight: 600,
            textDecoration: 'none',
            fontSize: '0.8125rem',
            transition: 'all 0.2s ease',
          }}
        >
          Upgrade
        </Link>
      </div>
    )
  }

  return (
    <div style={{
      padding: '1rem 1.25rem',
      background: 'var(--beige-100)',
      border: '1px solid var(--border-light)',
      borderRadius: 'var(--radius-md)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '1rem',
      marginBottom: '1rem',
    }}>
      <div style={{ flex: 1 }}>
        <div style={{
          fontSize: '0.875rem',
          fontWeight: 600,
          color: 'var(--text-primary)',
          marginBottom: '0.25rem'
        }}>
          {featureName} is not available on your plan
        </div>
        <div style={{
          fontSize: '0.8125rem',
          color: 'var(--text-secondary)'
        }}>
          Upgrade to <strong>{tierInfo.name}</strong> ({tierInfo.priceLabel}/mo) to unlock this feature.
        </div>
      </div>
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
        <Link
          href="/pricing"
          style={{
            padding: '0.625rem 1.25rem',
            background: 'var(--primary)',
            color: 'var(--text-inverse)',
            borderRadius: 'var(--radius-md)',
            fontWeight: 600,
            textDecoration: 'none',
            fontSize: '0.875rem',
            transition: 'all 0.2s ease',
            whiteSpace: 'nowrap',
          }}
        >
          Upgrade
        </Link>
        {onDismiss && (
          <button
            onClick={onDismiss}
            style={{
              background: 'transparent',
              border: 'none',
              fontSize: '1.25rem',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              padding: '0.25rem',
              lineHeight: 1,
            }}
          >
            ×
          </button>
        )}
      </div>
    </div>
  )
}

