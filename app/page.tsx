import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { LandingHeader } from '@/components/LandingHeader'
import { FeaturesSection } from '@/components/FeaturesSection'
import { BehaviorAnalysisSection } from '@/components/features/BehaviorAnalysisSection'
import { GuestTestModalWrapper } from '@/components/GuestTestModalWrapper'
import { SocialProofSection } from '@/components/SocialProofSection'
import { HowItWorksSection } from '@/components/HowItWorksSection'
import { ComparisonSection } from '@/components/ComparisonSection'
import { FaqSection } from '@/components/FaqSection'
import { CtaSection } from '@/components/CtaSection'
import { FeatureCarousel } from '@/components/FeatureCarousel'
import { Footer } from '@/components/Footer'

export default async function Home() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user) {
    redirect('/dashboard')
  }

  return (
    <main style={{ minHeight: '100vh', background: 'var(--bg-primary)', overflowX: 'hidden' }}>
      <LandingHeader />

      {/* Hero Section */}
      <section style={{
        paddingTop: '140px',
        paddingBottom: '80px',
        position: 'relative',
        overflow: 'hidden'
      }}>
        {/* Background Gradients */}
        <div style={{
          position: 'absolute',
          top: '-20%',
          right: '-10%',
          width: '800px',
          height: '800px',
          background: 'radial-gradient(circle, rgba(153, 27, 27, 0.08) 0%, transparent 60%)',
          borderRadius: '50%',
          zIndex: 0,
          filter: 'blur(60px)'
        }} />
        <div style={{
          position: 'absolute',
          bottom: '-10%',
          left: '-5%',
          width: '600px',
          height: '600px',
          background: 'radial-gradient(circle, rgba(220, 38, 38, 0.05) 0%, transparent 60%)',
          borderRadius: '50%',
          zIndex: 0,
          filter: 'blur(60px)'
        }} />

        <div className="container" style={{ position: 'relative', zIndex: 1 }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '3rem',
            alignItems: 'center'
          }}>
            {/* Left Content */}
            <div className="animate-enter">
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                padding: '0.35rem 1rem',
                background: 'rgba(153, 27, 27, 0.08)',
                border: '1px solid rgba(153, 27, 27, 0.2)',
                borderRadius: 'var(--radius-full)',
                marginBottom: '1.5rem'
              }}>
                <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--maroon-800)' }}>
                  For Solo & Indie Developers
                </span>
              </div>

              <h1 style={{ marginBottom: '1.5rem', lineHeight: 1.1 }}>
                Feel Confident <br />
                <span className="text-gradient">Before Shipping</span>
              </h1>

              <p style={{
                fontSize: '1.25rem',
                color: 'var(--text-secondary)',
                marginBottom: '2.5rem',
                maxWidth: '540px',
                lineHeight: 1.6
              }}>
                Watch AI explore your app live. See if anything feels broken. No test suites. No code. Just confidence.
              </p>

              <GuestTestModalWrapper />

              <div style={{ marginTop: '2rem', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                Used by solo developers shipping fast
              </div>
            </div>

            {/* Right Visual - Mock Terminal/Browser */}
            <div className="animate-enter delay-200" style={{ position: 'relative' }}>
              <FeatureCarousel />
            </div>
          </div>
        </div>
      </section>

      {/* How it Works */}
      <HowItWorksSection />

      {/* Behavior Analysis Feature */}
      <BehaviorAnalysisSection />

      {/* Features Grid */}
      <section id="features" style={{ padding: '5rem 0', background: 'var(--bg-secondary)' }}>
        <FeaturesSection />
      </section>

      {/* Comparison */}
      <ComparisonSection />

      {/* FAQ */}
      <FaqSection />

      {/* Replaced Final CTA with Test Once Section */}
      <section style={{
        padding: '8rem 0',
        background: 'linear-gradient(180deg, var(--bg-primary) 0%, var(--bg-secondary) 100%)',
        position: 'relative',
        overflow: 'hidden'
      }}>
        <div className="container" style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 2rem', position: 'relative', zIndex: 1 }}>
          <div style={{ textAlign: 'center', maxWidth: '800px', margin: '0 auto' }}>
            <h2 style={{
              fontSize: 'clamp(2.5rem, 5vw, 3.5rem)',
              fontWeight: 700,
              marginBottom: '1.5rem',
              lineHeight: 1.2,
              color: 'var(--text-primary)'
            }}>
              Test Once. <span className="text-gradient">See Results Everywhere.</span>
            </h2>
            <p style={{
              fontSize: '1.25rem',
              color: 'var(--text-secondary)',
              marginBottom: '3rem',
              lineHeight: 1.6
            }}>
              Stop wasting time manually checking every browser. Run your tests across Chrome, Firefox, and Safari in parallel and ship with 100% confidence.
            </p>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '1.5rem',
              marginBottom: '4rem',
              maxWidth: '600px',
              margin: '0 auto 4rem'
            }}>
              {['Chrome', 'Firefox', 'Safari'].map((browser) => (
                <div key={browser} className="glass-card" style={{
                  padding: '1.5rem',
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border-light)',
                  borderRadius: 'var(--radius-lg)',
                  textAlign: 'center'
                }}>
                  <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>🌐</div>
                  <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{browser}</div>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', justifyContent: 'center', gap: '1.5rem' }}>
              <Link href="/signup" className="btn btn-primary btn-large">
                Start for Free
              </Link>
              <Link href="/pricing" className="btn btn-secondary btn-large">
                View Pricing
              </Link>
            </div>

            <p style={{ marginTop: '2.5rem', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
              Join 2,000+ developers shipping better code with Rihario.
            </p>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  )
}
