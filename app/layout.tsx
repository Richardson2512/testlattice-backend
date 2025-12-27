import type { Metadata } from 'next'
import './globals.css'
import Navigation from './components/Navigation'
import { ErrorBoundary } from '../components/ErrorBoundary'
import { ScrollToTop } from '../components/ScrollToTop'
import { createClient } from '@/lib/supabase/server'
import { Analytics } from '@vercel/analytics/react'
import { SpeedInsights } from '@vercel/speed-insights/next'

export const metadata: Metadata = {
  title: {
    template: '%s | Rihario',
    default: 'Rihario - The Vibe Testing Platform',
  },
  description: 'The autonomous AI testing platform for Vibe Coding. Self-healing E2E tests, live browser control, and intelligent analytics.',
  keywords: ['vibe testing', 'ai testing', 'autonomous testing', 'playwright alternative', 'selenium alternative', 'test automation', 'self-healing tests'],
  authors: [{ name: 'Rihario Team' }],
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://testlattice.vercel.app',
    title: 'Rihario - The Vibe Testing Platform',
    description: 'Stop writing flaky scripts. Start Vibe Testing with autonomous AI agents.',
    siteName: 'Rihario',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Rihario - The Vibe Testing Platform',
    description: 'Stop writing flaky scripts. Start Vibe Testing with autonomous AI agents.',
  },
  icons: {
    icon: '/image/R-favicon.png',
    shortcut: '/image/R-favicon.png',
    apple: '/image/R-favicon.png',
  },
  alternates: {
    canonical: 'https://testlattice.vercel.app',
  },
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Check if user is authenticated
  let isAuthenticated = false
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    isAuthenticated = !!user
  } catch (error) {
    // If Supabase is not configured, assume not authenticated
    isAuthenticated = false
  }

  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body style={{ background: 'var(--bg-primary)' }}>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'SoftwareApplication',
              name: 'Rihario',
              applicationCategory: 'DeveloperApplication',
              operatingSystem: 'Any',
              offers: {
                '@type': 'Offer',
                price: '0',
                priceCurrency: 'USD',
              },
              description: 'Autonomous AI-driven test automation platform for modern web applications.',
            }),
          }}
        />
        <ErrorBoundary>
          {isAuthenticated && <Navigation />}
          <main
            style={{
              minHeight: '100vh',
              background: 'var(--bg-primary)',
              padding: 0,
              marginLeft: isAuthenticated ? 'var(--sidebar-width)' : '0',
              width: isAuthenticated ? 'calc(100% - var(--sidebar-width))' : '100%',
              transition: 'margin-left var(--transition-base), width var(--transition-base)',
            }}
          >
            {children}
          </main>
          <ScrollToTop />
        </ErrorBoundary>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  )
}

