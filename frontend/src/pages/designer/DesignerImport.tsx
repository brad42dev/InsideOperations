import { useNavigate } from 'react-router-dom'

export default function DesignerImport() {
  const navigate = useNavigate()

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: 'var(--io-surface-primary)',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          padding: '0 20px',
          height: '48px',
          flexShrink: 0,
          background: 'var(--io-surface)',
          borderBottom: '1px solid var(--io-border)',
        }}
      >
        <button
          onClick={() => navigate('/designer')}
          style={{ background: 'none', border: 'none', color: 'var(--io-text-muted)', cursor: 'pointer', fontSize: '13px', padding: '4px 0' }}
        >
          ← Designer
        </button>
        <span style={{ color: 'var(--io-border)' }}>/</span>
        <span style={{ fontSize: '15px', fontWeight: 600, color: 'var(--io-text-primary)' }}>
          Import Graphics
        </span>
      </div>

      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 16,
          color: 'var(--io-text-muted)',
        }}
      >
        <p style={{ margin: 0, fontSize: 15, fontWeight: 500, color: 'var(--io-text-primary)' }}>
          Import — Coming Soon
        </p>
        <p style={{ margin: 0, fontSize: 13 }}>
          Graphics import will be available after the redesign is complete.
        </p>
      </div>
    </div>
  )
}
