const BUILD_INFO = {
  version: '0.4.0-dev',
  phase: 'Phase 4 — Frontend Shell & Settings Core',
  buildDate: '2026-03-15',
}

interface StackEntry {
  category: string
  items: string[]
}

const TECH_STACK: StackEntry[] = [
  {
    category: 'Frontend',
    items: ['React 18', 'TypeScript 5', 'Vite 5', 'Zustand 4', 'TanStack Query 5', 'TanStack Table 8'],
  },
  {
    category: 'UI',
    items: ['Radix UI Primitives', 'Tailwind CSS', 'CSS Custom Properties'],
  },
  {
    category: 'Charting',
    items: ['uPlot (time-series)', 'Apache ECharts (non-time-series)'],
  },
  {
    category: 'Backend',
    items: ['Rust (stable)', 'Axum', 'Tokio', 'SQLx', 'tokio-tungstenite'],
  },
  {
    category: 'Database',
    items: ['PostgreSQL 16', 'TimescaleDB 2.13'],
  },
  {
    category: 'Infrastructure',
    items: ['nginx (TLS termination)', 'systemd (process management)', 'Docker Compose (dev DB)'],
  },
]

export default function AboutPage() {
  return (
    <div style={{ maxWidth: '640px' }}>
      {/* Logo and title */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '20px',
          marginBottom: '32px',
          padding: '24px',
          background: 'var(--io-surface-secondary)',
          borderRadius: '12px',
          border: '1px solid var(--io-border)',
        }}
      >
        <div
          style={{
            width: '56px',
            height: '56px',
            borderRadius: '12px',
            background: 'var(--io-accent-subtle)',
            border: '1px solid var(--io-accent)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <span
            style={{
              color: 'var(--io-accent)',
              fontSize: '18px',
              fontWeight: 700,
              letterSpacing: '-0.5px',
            }}
          >
            I/O
          </span>
        </div>

        <div>
          <h1
            style={{
              margin: '0 0 4px',
              fontSize: '20px',
              fontWeight: 700,
              color: 'var(--io-text-primary)',
            }}
          >
            Inside/Operations
          </h1>
          <div style={{ fontSize: '13px', color: 'var(--io-text-muted)' }}>
            Industrial Process Monitoring Platform
          </div>
        </div>
      </div>

      {/* Build info */}
      <div
        style={{
          marginBottom: '28px',
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '1px',
          background: 'var(--io-border)',
          borderRadius: '8px',
          overflow: 'hidden',
          border: '1px solid var(--io-border)',
        }}
      >
        {[
          { label: 'Version', value: BUILD_INFO.version },
          { label: 'Build Date', value: BUILD_INFO.buildDate },
          { label: 'Phase', value: BUILD_INFO.phase },
          { label: 'License', value: 'Proprietary — see Terms of Use' },
        ].map((row) => (
          <div
            key={row.label}
            style={{
              padding: '12px 16px',
              background: 'var(--io-surface-secondary)',
            }}
          >
            <div
              style={{
                fontSize: '11px',
                fontWeight: 600,
                color: 'var(--io-text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                marginBottom: '4px',
              }}
            >
              {row.label}
            </div>
            <div style={{ fontSize: '13px', color: 'var(--io-text-primary)', fontWeight: 500 }}>
              {row.value}
            </div>
          </div>
        ))}
      </div>

      {/* Tech stack */}
      <h3
        style={{
          margin: '0 0 12px',
          fontSize: '14px',
          fontWeight: 600,
          color: 'var(--io-text-secondary)',
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
        }}
      >
        Technology Stack
      </h3>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {TECH_STACK.map((entry) => (
          <div
            key={entry.category}
            style={{
              display: 'flex',
              gap: '12px',
              padding: '12px 16px',
              background: 'var(--io-surface-secondary)',
              borderRadius: '8px',
              border: '1px solid var(--io-border)',
              alignItems: 'flex-start',
            }}
          >
            <div
              style={{
                fontSize: '12px',
                fontWeight: 600,
                color: 'var(--io-text-muted)',
                width: '90px',
                flexShrink: 0,
                paddingTop: '1px',
              }}
            >
              {entry.category}
            </div>
            <div style={{ fontSize: '13px', color: 'var(--io-text-secondary)', lineHeight: 1.6 }}>
              {entry.items.join(', ')}
            </div>
          </div>
        ))}
      </div>

      <p
        style={{
          marginTop: '24px',
          fontSize: '12px',
          color: 'var(--io-text-muted)',
          lineHeight: 1.6,
        }}
      >
        All third-party libraries used in this application are licensed under MIT, Apache 2.0, BSD,
        or ISC licenses permitting royalty-free commercial use. No GPL or AGPL components are
        included.
      </p>
      <p
        style={{
          marginTop: '12px',
          fontSize: '12px',
          color: 'var(--io-text-muted)',
          lineHeight: 1.6,
        }}
      >
        The full Inside/Operations Software License Agreement governing your organization's rights
        is provided separately at installation time. Contact{' '}
        <a href="mailto:legal@in-ops.com" style={{ color: 'var(--io-accent)' }}>legal@in-ops.com</a>{' '}
        for a copy.
      </p>
    </div>
  )
}
