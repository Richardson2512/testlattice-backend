import type { Metadata } from 'next'
import './globals.css'
import Navigation from './components/Navigation'
import { ErrorBoundary } from '../components/ErrorBoundary'

export const metadata: Metadata = {
  title: 'TestLattice - AI-Powered Test Automation',
  description: 'Autonomous AI-driven test automation platform',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body style={{ background: 'var(--bg-primary)' }}>
        <ErrorBoundary>
          <Navigation />
          <main
            style={{
              minHeight: '100vh',
              background: 'var(--bg-primary)',
              padding: 0,
              marginLeft: 'var(--sidebar-width)',
              width: 'calc(100% - var(--sidebar-width))',
              transition: 'margin-left var(--transition-base), width var(--transition-base)',
            }}
          >
            {children}
          </main>
        </ErrorBoundary>
      </body>
    </html>
  )
}

