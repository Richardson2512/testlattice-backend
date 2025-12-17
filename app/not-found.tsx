import Link from 'next/link'

export default function NotFound() {
  return (
    <div style={{
      padding: '2rem',
      maxWidth: '800px',
      margin: '0 auto',
      textAlign: 'center',
    }}>
      <h1 style={{ fontSize: '3rem', fontWeight: 'bold', marginBottom: '1rem' }}>
        404
      </h1>
      <h2 style={{ fontSize: '1.5rem', fontWeight: '600', marginBottom: '1rem' }}>
        Page Not Found
      </h2>
      <p style={{ marginBottom: '2rem', color: '#6b7280' }}>
        The page you're looking for doesn't exist.
      </p>
      <Link
        href="/"
        style={{
          display: 'inline-block',
          padding: '0.75rem 1.5rem',
          backgroundColor: '#3b82f6',
          color: 'white',
          textDecoration: 'none',
          borderRadius: '0.375rem',
          fontWeight: '500',
        }}
      >
        Go back home
      </Link>
    </div>
  )
}

