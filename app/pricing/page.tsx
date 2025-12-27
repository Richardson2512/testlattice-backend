'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { LandingHeader } from '@/components/LandingHeader'
import { PRICING_TIERS, VISUAL_TEST_ADDONS, type PricingTier } from '@/lib/pricing'
import { useTierInfo } from '@/lib/hooks'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

export default function PricingPage() {
  const { data: tierInfo } = useTierInfo()

  // Map backend tier to pricing tier
  const tierMap: Record<string, PricingTier> = {
    'guest': 'free',
    'starter': 'starter',
    'indie': 'indie',
    'pro': 'pro',
    'agency': 'pro',
  }

  const currentTier = tierInfo ? (tierMap[tierInfo.tier] || 'free') : 'free'
  const tiers = Object.values(PRICING_TIERS)

  return (
    <main style={{
      minHeight: '100vh',
      background: 'var(--bg-primary)',
      color: 'var(--text-primary)',
      fontFamily: 'var(--font-sans)'
    }}>
      <LandingHeader />

      {/* Header Section */}
      <section style={{
        paddingTop: '120px',
        paddingBottom: '4rem',
        textAlign: 'center',
        background: 'linear-gradient(180deg, var(--bg-primary) 0%, var(--beige-100) 100%)'
      }}>
        <div className="container" style={{ maxWidth: '800px', margin: '0 auto', padding: '0 2rem' }}>
          <div style={{
            color: 'var(--primary)',
            fontWeight: 600,
            letterSpacing: '0.05em',
            fontSize: '0.875rem',
            textTransform: 'uppercase',
            marginBottom: '1rem'
          }}>
            Pricing & Plans
          </div>
          <h1 style={{
            fontSize: 'clamp(2.5rem, 5vw, 3.5rem)',
            fontWeight: 700,
            marginBottom: '1.5rem',
            lineHeight: 1.2,
            color: 'var(--text-primary)'
          }}>
            Choose Your <span className="text-gradient">Plan</span>
          </h1>
          <p style={{
            maxWidth: '600px',
            margin: '0 auto',
            fontSize: '1.125rem',
            color: 'var(--text-secondary)',
            lineHeight: 1.6
          }}>
            Transparent pricing for developers and solo founders. Upgrade anytime to unlock more features.
          </p>
        </div>
      </section>

      {/* Pricing Cards */}
      <section style={{ paddingBottom: '6rem' }}>
        <div className="container" style={{
          maxWidth: '1400px',
          margin: '0 auto',
          padding: '0 2rem',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '2rem',
          alignItems: 'stretch'
        }}>
          {tiers.map((tier) => (
            <PricingCard
              key={tier.id}
              tier={tier}
              isCurrentTier={tier.id === currentTier}
            />
          ))}
        </div>
      </section>

      {/* Add-Ons Section */}
      <section style={{
        padding: '4rem 0 6rem',
        background: 'var(--beige-100)'
      }}>
        <div className="container" style={{
          maxWidth: '1200px',
          margin: '0 auto',
          padding: '0 2rem'
        }}>
          <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
            <h2 style={{
              fontSize: '2rem',
              fontWeight: 700,
              marginBottom: '0.5rem',
              color: 'var(--text-primary)'
            }}>
              Visual Test Add-Ons
            </h2>
            <p style={{
              fontSize: '1rem',
              color: 'var(--text-secondary)',
              maxWidth: '600px',
              margin: '0 auto'
            }}>
              Need more visual tests? Add them to your plan. Add-ons reset monthly with your subscription.
            </p>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '1.5rem',
            maxWidth: '800px',
            margin: '0 auto'
          }}>
            {VISUAL_TEST_ADDONS.map((addon) => (
              <AddOnCard key={addon.id} addon={addon} />
            ))}
          </div>

          <div style={{
            marginTop: '2rem',
            padding: '1.5rem',
            background: 'var(--bg-card)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--border-light)',
            textAlign: 'center',
            maxWidth: '600px',
            margin: '2rem auto 0'
          }}>
            <p style={{
              fontSize: '0.875rem',
              color: 'var(--text-secondary)',
              margin: 0
            }}>
              <strong style={{ color: 'var(--text-primary)' }}>Note:</strong> Add-ons can only be purchased by Starter, Indie, or Pro users.
              Add-ons stack on top of your plan limits and reset monthly.
            </p>
          </div>
        </div>
      </section>
    </main>
  )
}

function PricingCard({ tier, isCurrentTier }: { tier: typeof PRICING_TIERS[PricingTier], isCurrentTier: boolean }) {
  const [isLoading, setIsLoading] = useState(false)

  const handleCheckout = async () => {
    if (isCurrentTier || !tier.polarProductId) return

    setIsLoading(true)
    try {
      const response = await fetch(`${API_URL}/api/billing/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: tier.polarProductId,
          tier: tier.id,
        }),
      })

      const data = await response.json()
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl
      } else {
        console.error('No checkout URL returned')
        alert('Failed to start checkout. Please try again.')
      }
    } catch (error) {
      console.error('Checkout error:', error)
      alert('Failed to start checkout. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  // Free tier goes to signup, paid tiers use checkout
  const isFreeGetStarted = tier.id === 'free' && !isCurrentTier
  return (
    <div
      className="glass-card"
      style={{
        padding: '2rem',
        background: tier.popular
          ? 'linear-gradient(135deg, var(--bg-card) 0%, var(--beige-100) 100%)'
          : 'var(--bg-card)',
        border: tier.popular
          ? `2px solid var(--primary)`
          : '1px solid var(--border-light)',
        borderRadius: 'var(--radius-lg)',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        transform: tier.popular ? 'scale(1.05)' : 'scale(1)',
        boxShadow: tier.popular
          ? 'var(--shadow-lg)'
          : 'var(--shadow-sm)',
        transition: 'all 0.3s ease',
      }}
    >
      {tier.popular && (
        <div style={{
          position: 'absolute',
          top: '-12px',
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'var(--primary)',
          color: 'var(--text-inverse)',
          fontSize: '0.75rem',
          fontWeight: 700,
          padding: '0.375rem 1rem',
          borderRadius: 'var(--radius-full)',
          letterSpacing: '0.05em',
          textTransform: 'uppercase',
          boxShadow: 'var(--shadow-md)'
        }}>
          Most Popular
        </div>
      )}

      {isCurrentTier && !tier.popular && (
        <div style={{
          position: 'absolute',
          top: '-12px',
          right: '1rem',
          background: 'var(--success)',
          color: 'var(--text-inverse)',
          fontSize: '0.75rem',
          fontWeight: 600,
          padding: '0.375rem 0.75rem',
          borderRadius: 'var(--radius-full)',
        }}>
          Current Plan
        </div>
      )}

      <div style={{ marginBottom: '1.5rem' }}>
        <h3 style={{
          fontSize: '1.5rem',
          fontWeight: 700,
          marginBottom: '0.5rem',
          color: 'var(--text-primary)'
        }}>
          {tier.name}
        </h3>
        <p style={{
          fontSize: '0.875rem',
          color: 'var(--text-secondary)',
          marginBottom: '1.5rem'
        }}>
          {tier.description}
        </p>
        <div style={{
          fontSize: '3rem',
          fontWeight: 700,
          lineHeight: 1,
          color: 'var(--text-primary)',
          marginBottom: '0.5rem'
        }}>
          {tier.priceLabel}
          <span style={{
            fontSize: '1rem',
            color: 'var(--text-secondary)',
            fontWeight: 400
          }}>
            /mo
          </span>
        </div>
      </div>

      {/* CTA Button - Link for free tier, button for paid tiers */}
      {isFreeGetStarted ? (
        <Link
          href="/signup"
          style={{
            display: 'block',
            width: '100%',
            padding: '0.875rem 1.5rem',
            textAlign: 'center',
            background: 'var(--beige-300)',
            color: 'var(--text-primary)',
            borderRadius: 'var(--radius-md)',
            fontWeight: 600,
            textDecoration: 'none',
            transition: 'all 0.2s ease',
            marginBottom: '2rem',
          }}
        >
          {tier.cta}
        </Link>
      ) : (
        <button
          onClick={handleCheckout}
          disabled={isCurrentTier || isLoading}
          style={{
            display: 'block',
            width: '100%',
            padding: '0.875rem 1.5rem',
            textAlign: 'center',
            background: isCurrentTier
              ? 'var(--beige-200)'
              : tier.popular
                ? 'var(--primary)'
                : 'var(--beige-300)',
            color: isCurrentTier
              ? 'var(--text-secondary)'
              : tier.popular
                ? 'var(--text-inverse)'
                : 'var(--text-primary)',
            borderRadius: 'var(--radius-md)',
            fontWeight: 600,
            border: 'none',
            transition: 'all 0.2s ease',
            marginBottom: '2rem',
            cursor: isCurrentTier || isLoading ? 'default' : 'pointer',
            opacity: isLoading ? 0.7 : 1,
            boxShadow: tier.popular && !isCurrentTier ? 'var(--shadow-md)' : 'none',
          }}
        >
          {isLoading ? 'Loading...' : isCurrentTier ? 'Current Plan' : tier.cta}
        </button>
      )}

      <ul style={{
        listStyle: 'none',
        padding: 0,
        margin: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: '0.75rem',
        flex: 1
      }}>
        {tier.features.map((feature, idx) => (
          <li
            key={idx}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '0.75rem',
              fontSize: '0.875rem',
              color: 'var(--text-secondary)'
            }}
          >
            <span style={{
              color: 'var(--success)',
              fontSize: '1rem',
              flexShrink: 0,
              marginTop: '0.125rem'
            }}>
              ✓
            </span>
            <span>{feature}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function AddOnCard({ addon }: { addon: typeof VISUAL_TEST_ADDONS[0] }) {
  return (
    <div
      className="glass-card"
      style={{
        padding: '1.5rem',
        background: 'var(--bg-card)',
        border: '1px solid var(--border-light)',
        borderRadius: 'var(--radius-lg)',
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem'
      }}
    >
      <div>
        <h4 style={{
          fontSize: '1.125rem',
          fontWeight: 600,
          marginBottom: '0.25rem',
          color: 'var(--text-primary)'
        }}>
          {addon.name}
        </h4>
        <p style={{
          fontSize: '0.875rem',
          color: 'var(--text-secondary)',
          marginBottom: '1rem'
        }}>
          {addon.description}
        </p>
        <div style={{
          fontSize: '2rem',
          fontWeight: 700,
          color: 'var(--text-primary)'
        }}>
          {addon.priceLabel}
          <span style={{
            fontSize: '0.875rem',
            color: 'var(--text-secondary)',
            fontWeight: 400
          }}>
            /mo
          </span>
        </div>
      </div>

      <button
        style={{
          width: '100%',
          padding: '0.75rem 1.5rem',
          textAlign: 'center',
          background: 'var(--beige-300)',
          color: 'var(--text-primary)',
          border: 'none',
          borderRadius: 'var(--radius-md)',
          fontWeight: 600,
          cursor: 'pointer',
          transition: 'all 0.2s ease',
        }}
        onClick={() => {
          // TODO: Implement add-on purchase flow
          alert(`Add-on purchase for ${addon.name} - Coming soon!`)
        }}
      >
        Buy Add-On
      </button>
    </div>
  )
}
