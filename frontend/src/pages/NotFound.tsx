import { Link } from 'react-router-dom'

export default function NotFound() {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        background: 'var(--io-surface-primary)',
        color: 'var(--io-text-secondary)',
        gap: '16px',
      }}
    >
      <span
        style={{
          fontSize: '72px',
          fontWeight: 700,
          color: 'var(--io-border)',
          lineHeight: 1,
        }}
      >
        404
      </span>
      <h1
        style={{
          margin: 0,
          fontSize: '20px',
          fontWeight: 600,
          color: 'var(--io-text-primary)',
        }}
      >
        Page Not Found
      </h1>
      <p style={{ margin: 0, fontSize: '14px' }}>
        The page you're looking for doesn't exist.
      </p>
      <Link
        to="/"
        style={{
          marginTop: '8px',
          padding: '8px 20px',
          borderRadius: 'var(--io-radius)',
          background: 'var(--io-accent)',
          color: '#fff',
          textDecoration: 'none',
          fontSize: '14px',
          fontWeight: 500,
        }}
      >
        Go Home
      </Link>
    </div>
  )
}
