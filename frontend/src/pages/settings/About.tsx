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
  { category: 'Frontend', items: ['React 18', 'TypeScript 5', 'Vite 5', 'Zustand 4', 'TanStack Query 5', 'TanStack Table 8'] },
  { category: 'UI', items: ['Radix UI Primitives', 'Tailwind CSS', 'CSS Custom Properties'] },
  { category: 'Charting', items: ['uPlot (time-series)', 'Apache ECharts (non-time-series)'] },
  { category: 'Editor', items: ['SVG.js (graphics designer)', 'Tiptap (operational log)', 'CodeMirror 6 (expression builder)'] },
  { category: 'Backend', items: ['Rust (stable)', 'Axum', 'Tokio', 'SQLx', 'tokio-tungstenite'] },
  { category: 'Auth', items: ['jsonwebtoken', 'Argon2', 'instant-acme (ACME/TLS)'] },
  { category: 'PDF / Export', items: ['Typst (typst-as-lib)', 'YARA-X (file scanning)'] },
  { category: 'Database', items: ['PostgreSQL 16', 'TimescaleDB 2.13'] },
  { category: 'Infrastructure', items: ['nginx (TLS termination)', 'systemd (process management)', 'Docker Compose (dev DB)'] },
]

interface OssEntry {
  name: string
  version: string
  license: string
  url: string
  use: string
}

// Representative sample — not exhaustive; full SBOM available on request
const OSS_DEPS: OssEntry[] = [
  { name: 'React', version: '18.x', license: 'MIT', url: 'https://github.com/facebook/react', use: 'UI framework' },
  { name: 'Vite', version: '5.x', license: 'MIT', url: 'https://github.com/vitejs/vite', use: 'Build tool' },
  { name: 'Zustand', version: '4.x', license: 'MIT', url: 'https://github.com/pmndrs/zustand', use: 'Client state management' },
  { name: 'TanStack Query', version: '5.x', license: 'MIT', url: 'https://github.com/TanStack/query', use: 'Server state management' },
  { name: 'TanStack Table', version: '8.x', license: 'MIT', url: 'https://github.com/TanStack/table', use: 'Virtual table component' },
  { name: 'Radix UI', version: '1.x', license: 'MIT', url: 'https://github.com/radix-ui/primitives', use: 'Accessible UI primitives' },
  { name: 'Tailwind CSS', version: '3.x', license: 'MIT', url: 'https://github.com/tailwindlabs/tailwindcss', use: 'Utility CSS framework' },
  { name: 'uPlot', version: '1.x', license: 'MIT', url: 'https://github.com/leeoniya/uPlot', use: 'Time-series charts' },
  { name: 'Apache ECharts', version: '5.x', license: 'Apache 2.0', url: 'https://github.com/apache/echarts', use: 'Non-time-series charts' },
  { name: 'SVG.js', version: '3.x', license: 'MIT', url: 'https://github.com/svgdotjs/svg.js', use: 'Graphics designer' },
  { name: 'Tiptap', version: '2.x', license: 'MIT', url: 'https://github.com/ueberdosis/tiptap', use: 'Rich-text log editor' },
  { name: 'date-fns', version: '3.x', license: 'MIT', url: 'https://github.com/date-fns/date-fns', use: 'Date formatting' },
  { name: 'Axum', version: '0.7.x', license: 'MIT', url: 'https://github.com/tokio-rs/axum', use: 'Rust HTTP framework' },
  { name: 'Tokio', version: '1.x', license: 'MIT', url: 'https://github.com/tokio-rs/tokio', use: 'Async runtime' },
  { name: 'SQLx', version: '0.7.x', license: 'MIT / Apache 2.0', url: 'https://github.com/launchbadge/sqlx', use: 'Async PostgreSQL driver' },
  { name: 'jsonwebtoken', version: '9.x', license: 'MIT', url: 'https://github.com/Keats/jsonwebtoken', use: 'JWT auth tokens' },
  { name: 'argon2', version: '0.5.x', license: 'MIT / Apache 2.0', url: 'https://github.com/RustCrypto/password-hashes', use: 'Password hashing' },
  { name: 'serde', version: '1.x', license: 'MIT / Apache 2.0', url: 'https://github.com/serde-rs/serde', use: 'Serialization' },
  { name: 'tracing', version: '0.1.x', license: 'MIT', url: 'https://github.com/tokio-rs/tracing', use: 'Structured logging' },
  { name: 'typst-as-lib', version: '0.x', license: 'MIT', url: 'https://github.com/tfachmann/typst-as-lib', use: 'PDF generation' },
  { name: 'instant-acme', version: '0.x', license: 'Apache 2.0', url: 'https://github.com/instant-labs/instant-acme', use: 'Automatic TLS (ACME)' },
  { name: 'yara-x', version: '0.x', license: 'BSD-3-Clause', url: 'https://github.com/VirusTotal/yara-x', use: 'File content scanning' },
  { name: 'prometheus', version: '0.x', license: 'Apache 2.0', url: 'https://github.com/tikv/rust-prometheus', use: 'Metrics export' },
]

export default function AboutPage() {
  return (
    <div style={{ maxWidth: '760px' }}>
      {/* Logo and title */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '32px',
        padding: '24px', background: 'var(--io-surface-secondary)',
        borderRadius: '12px', border: '1px solid var(--io-border)',
      }}>
        <div style={{
          width: '56px', height: '56px', borderRadius: '12px',
          background: 'var(--io-accent-subtle)', border: '1px solid var(--io-accent)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <span style={{ color: 'var(--io-accent)', fontSize: '18px', fontWeight: 700, letterSpacing: '-0.5px' }}>
            I/O
          </span>
        </div>
        <div>
          <h1 style={{ margin: '0 0 4px', fontSize: '20px', fontWeight: 700, color: 'var(--io-text-primary)' }}>
            Inside/Operations
          </h1>
          <div style={{ fontSize: '13px', color: 'var(--io-text-muted)' }}>
            Industrial Process Monitoring Platform
          </div>
        </div>
      </div>

      {/* Build info */}
      <div style={{
        marginBottom: '28px', display: 'grid', gridTemplateColumns: '1fr 1fr',
        gap: '1px', background: 'var(--io-border)', borderRadius: '8px',
        overflow: 'hidden', border: '1px solid var(--io-border)',
      }}>
        {[
          { label: 'Version', value: BUILD_INFO.version },
          { label: 'Build Date', value: BUILD_INFO.buildDate },
          { label: 'Phase', value: BUILD_INFO.phase },
          { label: 'License', value: 'Proprietary — Inside Operations LLC' },
        ].map((row) => (
          <div key={row.label} style={{ padding: '12px 16px', background: 'var(--io-surface-secondary)' }}>
            <div style={{
              fontSize: '11px', fontWeight: 600, color: 'var(--io-text-muted)',
              textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '4px',
            }}>
              {row.label}
            </div>
            <div style={{ fontSize: '13px', color: 'var(--io-text-primary)', fontWeight: 500 }}>
              {row.value}
            </div>
          </div>
        ))}
      </div>

      {/* Tech stack */}
      <h3 style={{
        margin: '0 0 12px', fontSize: '14px', fontWeight: 600,
        color: 'var(--io-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.08em',
      }}>
        Technology Stack
      </h3>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '32px' }}>
        {TECH_STACK.map((entry) => (
          <div key={entry.category} style={{
            display: 'flex', gap: '12px', padding: '12px 16px',
            background: 'var(--io-surface-secondary)', borderRadius: '8px',
            border: '1px solid var(--io-border)', alignItems: 'flex-start',
          }}>
            <div style={{
              fontSize: '12px', fontWeight: 600, color: 'var(--io-text-muted)',
              width: '90px', flexShrink: 0, paddingTop: '1px',
            }}>
              {entry.category}
            </div>
            <div style={{ fontSize: '13px', color: 'var(--io-text-secondary)', lineHeight: 1.6 }}>
              {entry.items.join(', ')}
            </div>
          </div>
        ))}
      </div>

      {/* OSS Licenses */}
      <h3 style={{
        margin: '0 0 8px', fontSize: '14px', fontWeight: 600,
        color: 'var(--io-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.08em',
      }}>
        Open Source Components
      </h3>
      <p style={{ margin: '0 0 12px', fontSize: '12px', color: 'var(--io-text-muted)', lineHeight: 1.6 }}>
        Inside/Operations uses open-source components. All are licensed under MIT, Apache 2.0,
        BSD, or ISC permitting royalty-free commercial use. No GPL or AGPL components are included.
        A full software bill of materials (SBOM) is available on request.
      </p>

      <div style={{
        border: '1px solid var(--io-border)', borderRadius: '8px', overflow: 'hidden',
        marginBottom: '24px',
      }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
          <thead>
            <tr style={{ background: 'var(--io-surface-secondary)', borderBottom: '1px solid var(--io-border)' }}>
              {['Component', 'Version', 'License', 'Use'].map((h) => (
                <th key={h} style={{
                  padding: '8px 12px', textAlign: 'left', fontWeight: 600,
                  color: 'var(--io-text-muted)', fontSize: '11px',
                  textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap',
                }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {OSS_DEPS.map((dep, i) => (
              <tr key={dep.name} style={{
                borderBottom: i < OSS_DEPS.length - 1 ? '1px solid var(--io-border-subtle, var(--io-border))' : 'none',
                background: i % 2 === 0 ? 'var(--io-surface-secondary)' : 'var(--io-surface-primary)',
              }}>
                <td style={{ padding: '7px 12px', color: 'var(--io-text-primary)', fontWeight: 500 }}>
                  {dep.name}
                </td>
                <td style={{ padding: '7px 12px', color: 'var(--io-text-muted)', fontFamily: 'var(--io-font-mono)', fontSize: '11px' }}>
                  {dep.version}
                </td>
                <td style={{ padding: '7px 12px', whiteSpace: 'nowrap' }}>
                  <span style={{
                    padding: '1px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: 600,
                    background: 'var(--io-surface-sunken)', color: 'var(--io-text-muted)',
                    border: '1px solid var(--io-border)',
                  }}>
                    {dep.license}
                  </span>
                </td>
                <td style={{ padding: '7px 12px', color: 'var(--io-text-secondary)' }}>
                  {dep.use}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p style={{ margin: '0 0 8px', fontSize: '12px', color: 'var(--io-text-muted)', lineHeight: 1.6 }}>
        The full Inside/Operations Software License Agreement governing your organization's rights
        is provided at installation time and is accessible to administrators under{' '}
        <span style={{ color: 'var(--io-text-secondary)' }}>Settings → EULA</span>.
        Contact <a href="mailto:legal@in-ops.com" style={{ color: 'var(--io-accent)' }}>legal@in-ops.com</a>{' '}
        for a copy.
      </p>
    </div>
  )
}
