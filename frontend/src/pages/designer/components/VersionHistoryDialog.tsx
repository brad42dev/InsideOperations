import React from 'react'

interface VersionEntry {
  id: string
  version: number
  type: 'published' | 'draft'
  author: string
  timestamp: string
  isCurrent?: boolean
}

interface VersionHistoryDialogProps {
  open: boolean
  onClose: () => void
  graphicId: string | null
  onPreview: (versionId: string) => void
  onRestore: (versionId: string) => void
}

// Stub: graphicsApi.getVersions not yet available, return mock empty
async function fetchVersions(_graphicId: string): Promise<{ success: true; data: VersionEntry[] }> {
  return { success: true, data: [] }
}

const panelStyle: React.CSSProperties = {
  position: 'fixed',
  top: 0,
  right: 0,
  bottom: 0,
  width: '320px',
  maxWidth: '100vw',
  zIndex: 1050,
  background: 'var(--io-surface-elevated)',
  borderLeft: '1px solid var(--io-border)',
  display: 'flex',
  flexDirection: 'column',
  boxShadow: '-4px 0 16px rgba(0,0,0,0.15)',
}

const headerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '12px 16px',
  borderBottom: '1px solid var(--io-border)',
  fontWeight: 600,
  fontSize: '14px',
  color: 'var(--io-text-primary)',
}

const sectionLabel: React.CSSProperties = {
  fontSize: '10px',
  fontWeight: 700,
  color: 'var(--io-text-muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  padding: '12px 16px 4px',
}

const entryStyle: React.CSSProperties = {
  padding: '10px 16px',
  borderBottom: '1px solid var(--io-border-subtle)',
  fontSize: '12px',
}

const smallBtnStyle: React.CSSProperties = {
  padding: '3px 8px',
  fontSize: '11px',
  borderRadius: 'var(--io-radius)',
  border: '1px solid var(--io-border)',
  background: 'transparent',
  color: 'var(--io-text-secondary)',
  cursor: 'pointer',
}

export default function VersionHistoryDialog({
  open,
  onClose,
  graphicId,
  onPreview,
  onRestore,
}: VersionHistoryDialogProps) {
  const [versions, setVersions] = React.useState<VersionEntry[]>([])
  const [loading, setLoading] = React.useState(false)

  React.useEffect(() => {
    if (!open || !graphicId) return
    setLoading(true)
    fetchVersions(graphicId)
      .then((r) => { if (r.success) setVersions(r.data) })
      .finally(() => setLoading(false))
  }, [open, graphicId])

  if (!open) return null

  const published = versions.filter((v) => v.type === 'published')
  const drafts = versions.filter((v) => v.type === 'draft')

  return (
    <>
      {/* Backdrop */}
      <div
        style={{ position: 'fixed', inset: 0, zIndex: 1049, background: 'rgba(0,0,0,0.2)' }}
        onClick={onClose}
      />
      <div style={panelStyle}>
        <div style={headerStyle}>
          <span>Version History</span>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--io-text-muted)', fontSize: '16px', lineHeight: 1 }}
          >
            {'\u00D7'}
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto' }}>
          {loading && (
            <div style={{ padding: '24px 16px', color: 'var(--io-text-muted)', fontSize: '12px', textAlign: 'center' }}>
              Loading versions...
            </div>
          )}

          {!loading && versions.length === 0 && (
            <div style={{ padding: '24px 16px', color: 'var(--io-text-muted)', fontSize: '12px', textAlign: 'center' }}>
              No version history available yet.
            </div>
          )}

          {published.length > 0 && (
            <>
              <div style={sectionLabel}>Published Versions</div>
              {published.map((v) => (
                <div key={v.id} style={entryStyle}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                    <span style={{ fontWeight: 600, color: 'var(--io-text-primary)' }}>v{v.version}</span>
                    <span style={{ color: 'var(--io-text-muted)' }}>{v.author}</span>
                    <span style={{ color: 'var(--io-text-muted)', marginLeft: 'auto', fontSize: '11px' }}>
                      {v.timestamp}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button style={smallBtnStyle} onClick={() => onPreview(v.id)}>Preview</button>
                    <button style={smallBtnStyle} onClick={() => onRestore(v.id)}>Restore</button>
                  </div>
                </div>
              ))}
            </>
          )}

          {drafts.length > 0 && (
            <>
              <div style={sectionLabel}>Drafts (rolling 10)</div>
              {drafts.map((v) => (
                <div key={v.id} style={entryStyle}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                    <span style={{ fontWeight: v.isCurrent ? 600 : 400, color: 'var(--io-text-primary)' }}>
                      Draft {v.version}{v.isCurrent ? ' (current)' : ''}
                    </span>
                    <span style={{ color: 'var(--io-text-muted)', marginLeft: 'auto', fontSize: '11px' }}>
                      {v.timestamp}
                    </span>
                  </div>
                  {!v.isCurrent && (
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button style={smallBtnStyle} onClick={() => onPreview(v.id)}>Preview</button>
                      <button style={smallBtnStyle} onClick={() => onRestore(v.id)}>Restore</button>
                    </div>
                  )}
                </div>
              ))}
            </>
          )}
        </div>

        <div style={{ padding: '10px 16px', borderTop: '1px solid var(--io-border)' }}>
          <button
            onClick={onClose}
            style={{
              width: '100%',
              padding: '6px 12px',
              fontSize: '12px',
              borderRadius: 'var(--io-radius)',
              border: '1px solid var(--io-border)',
              background: 'transparent',
              color: 'var(--io-text-secondary)',
              cursor: 'pointer',
            }}
          >
            Close
          </button>
        </div>
      </div>
    </>
  )
}
