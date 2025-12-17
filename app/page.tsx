import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function Home() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Redirect authenticated users to dashboard
  if (user) {
    redirect('/dashboard')
  }

  return (
    <main style={{ minHeight: '100vh', background: 'var(--bg-primary)' }}>
      {/* Hero Section */}
      <section style={{
        padding: '6rem 2rem 4rem',
        background: 'linear-gradient(135deg, var(--beige-50) 0%, var(--beige-100) 100%)',
        position: 'relative',
        overflow: 'hidden',
      }}>
        <div className="container" style={{ position: 'relative', zIndex: 1 }}>
          <div style={{
            maxWidth: '800px',
            margin: '0 auto',
            textAlign: 'center',
            animation: 'fadeIn 0.8s ease-out',
          }}>
            <div style={{
              display: 'inline-block',
              padding: '0.5rem 1.25rem',
              background: 'rgba(153, 27, 27, 0.1)',
              borderRadius: 'var(--radius-full)',
              marginBottom: '1.5rem',
              border: '1px solid rgba(153, 27, 27, 0.2)',
            }}>
              <span style={{ color: 'var(--maroon-800)', fontSize: '0.875rem', fontWeight: '500' }}>
                ✨ AI-Powered Test Automation
              </span>
            </div>
            
            <h1 style={{
              fontSize: 'clamp(2.5rem, 6vw, 4rem)',
              fontWeight: '700',
              marginBottom: '1.5rem',
              background: 'linear-gradient(135deg, var(--maroon-800) 0%, var(--maroon-600) 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              lineHeight: '1.1',
              letterSpacing: '-0.03em',
            }}>
              TestLattice
            </h1>
            
            <p style={{
              fontSize: 'clamp(1.125rem, 2vw, 1.5rem)',
              color: 'var(--text-secondary)',
              marginBottom: '2.5rem',
              lineHeight: '1.6',
              maxWidth: '600px',
              margin: '0 auto 2.5rem',
            }}>
              Autonomous AI-driven test automation platform for web applications. 
              Let AI handle your testing while you focus on building.
            </p>
            
            <div style={{
              display: 'flex',
              gap: '1rem',
              justifyContent: 'center',
              flexWrap: 'wrap',
              marginBottom: '3rem',
            }}>
              <Link
                href="/signup"
                className="btn btn-primary"
                style={{
                  padding: '1rem 2rem',
                  fontSize: '1.0625rem',
                  boxShadow: 'var(--shadow-lg)',
                }}
              >
                Get Started Free →
              </Link>
              <Link
                href="/login"
                className="btn btn-secondary"
                style={{
                  padding: '1rem 2rem',
                  fontSize: '1.0625rem',
                }}
              >
                Sign In
              </Link>
            </div>
          </div>
        </div>
        
        {/* Decorative Elements */}
        <div style={{
          position: 'absolute',
          top: '-50%',
          right: '-10%',
          width: '600px',
          height: '600px',
          background: 'radial-gradient(circle, rgba(153, 27, 27, 0.05) 0%, transparent 70%)',
          borderRadius: '50%',
          zIndex: 0,
        }} />
        <div style={{
          position: 'absolute',
          bottom: '-30%',
          left: '-5%',
          width: '400px',
          height: '400px',
          background: 'radial-gradient(circle, rgba(153, 27, 27, 0.03) 0%, transparent 70%)',
          borderRadius: '50%',
          zIndex: 0,
        }} />
      </section>

      {/* Features Section */}
      <section style={{
        padding: '5rem 2rem',
        background: 'var(--bg-secondary)',
      }}>
        <div className="container">
          <div style={{
            textAlign: 'center',
            marginBottom: '4rem',
          }}>
            <h2 style={{
              fontSize: 'clamp(2rem, 4vw, 2.75rem)',
              fontWeight: '600',
              marginBottom: '1rem',
              color: 'var(--text-primary)',
            }}>
              Powerful Features
            </h2>
            <p style={{
              fontSize: '1.125rem',
              color: 'var(--text-secondary)',
              maxWidth: '600px',
              margin: '0 auto',
            }}>
              Everything you need for comprehensive test automation
            </p>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '2rem',
            maxWidth: '1200px',
            margin: '0 auto',
          }}>
            {[
              {
                icon: '🤖',
                title: 'AI-Driven Execution',
                description: 'Autonomous test execution powered by advanced AI that learns and adapts to your application.',
              },
              {
                icon: '🌐',
                title: 'Web Application Testing',
                description: 'Comprehensive testing for web applications with unified workflows and reporting.',
              },
              {
                icon: '⚡',
                title: 'Real-Time Monitoring',
                description: 'Watch your tests run in real-time with live updates, screenshots, and detailed logs.',
              },
              {
                icon: '📦',
                title: 'Artifact Management',
                description: 'Comprehensive storage and viewing of screenshots, videos, logs, and test reports.',
              },
              {
                icon: '🔗',
                title: 'CI/CD Integration',
                description: 'Seamlessly integrate with your existing CI/CD pipelines and development workflows.',
              },
              {
                icon: '📊',
                title: 'Advanced Analytics',
                description: 'Get insights into test coverage, performance metrics, and regression detection.',
              },
            ].map((feature, index) => (
              <div
                key={index}
                className="card"
                style={{
                  padding: '2rem',
                  textAlign: 'center',
                  animation: `fadeIn 0.6s ease-out ${index * 0.1}s both`,
                }}
              >
                <div style={{
                  fontSize: '3rem',
                  marginBottom: '1rem',
                }}>
                  {feature.icon}
                </div>
                <h3 style={{
                  fontSize: '1.25rem',
                  fontWeight: '600',
                  marginBottom: '0.75rem',
                  color: 'var(--text-primary)',
                }}>
                  {feature.title}
                </h3>
                <p style={{
                  color: 'var(--text-secondary)',
                  lineHeight: '1.6',
                  fontSize: '0.9375rem',
                }}>
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section style={{
        padding: '5rem 2rem',
        background: 'linear-gradient(135deg, var(--maroon-800) 0%, var(--maroon-900) 100%)',
        color: 'var(--text-inverse)',
        position: 'relative',
        overflow: 'hidden',
      }}>
        <div className="container" style={{ position: 'relative', zIndex: 1 }}>
          <div style={{
            maxWidth: '700px',
            margin: '0 auto',
            textAlign: 'center',
          }}>
            <h2 style={{
              fontSize: 'clamp(2rem, 4vw, 2.75rem)',
              fontWeight: '600',
              marginBottom: '1rem',
              color: 'var(--text-inverse)',
            }}>
              Ready to Transform Your Testing?
            </h2>
            <p style={{
              fontSize: '1.125rem',
              marginBottom: '2.5rem',
              opacity: 0.95,
              lineHeight: '1.6',
            }}>
              Join thousands of developers who trust TestLattice for their test automation needs. 
              Start testing smarter, not harder.
            </p>
            <Link
              href="/signup"
              className="btn"
              style={{
                background: 'var(--bg-secondary)',
                color: 'var(--maroon-800)',
                padding: '1rem 2.5rem',
                fontSize: '1.0625rem',
                fontWeight: '600',
                boxShadow: 'var(--shadow-xl)',
              }}
            >
              Start Free Trial →
            </Link>
          </div>
        </div>
        
        {/* Decorative Pattern */}
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundImage: 'radial-gradient(circle at 2px 2px, rgba(255,255,255,0.05) 1px, transparent 0)',
          backgroundSize: '40px 40px',
          opacity: 0.5,
        }} />
      </section>
    </main>
  )
}

