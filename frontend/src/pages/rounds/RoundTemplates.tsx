import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { roundsApi } from '../../api/rounds'
import { ExportButton } from '../../shared/components/ExportDialog'
import { PrintDialog } from './PrintDialog'

const TEMPLATE_COLUMNS = [
  { id: 'name', label: 'Name' },
  { id: 'description', label: 'Description' },
  { id: 'version', label: 'Version' },
  { id: 'is_active', label: 'Active' },
  { id: 'checkpoints', label: 'Checkpoints' },
]

export default function RoundTemplates() {
  const navigate = useNavigate()

  const { data, isLoading } = useQuery({
    queryKey: ['rounds', 'templates'],
    queryFn: () => roundsApi.listTemplates(),
  })

  const templates = data?.success ? data.data : []

  const btnStyle = (primary?: boolean): React.CSSProperties => ({
    padding: '6px 14px',
    background: primary ? 'var(--io-accent)' : 'none',
    border: primary ? 'none' : '1px solid var(--io-border)',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: primary ? 600 : 400,
    color: primary ? '#fff' : 'var(--io-text-secondary)',
    whiteSpace: 'nowrap',
  })

  return (
    <div style={{ padding: 'var(--io-space-6)', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: 'var(--io-text-primary)' }}>Round Templates</h2>
          <p style={{ margin: '4px 0 0', fontSize: '14px', color: 'var(--io-text-secondary)' }}>
            Equipment inspection checklist templates.
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <ExportButton
            module="rounds"
            entity="Round Templates"
            filteredRowCount={templates.length}
            totalRowCount={templates.length}
            availableColumns={TEMPLATE_COLUMNS}
            visibleColumns={TEMPLATE_COLUMNS.map((c) => c.id)}
          />
          <button style={btnStyle(true)} onClick={() => navigate('/rounds/templates/new/edit')}>
            + New Template
          </button>
        </div>
      </div>

      {isLoading ? (
        <div style={{ color: 'var(--io-text-muted)', fontSize: '14px' }}>Loading…</div>
      ) : templates.length === 0 ? (
        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--io-text-muted)', fontSize: '14px', background: 'var(--io-surface)', borderRadius: '8px', border: '1px solid var(--io-border)' }}>
          No templates yet. Create one to get started.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {templates.map((t) => (
            <div
              key={t.id}
              style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 16px', background: 'var(--io-surface)', border: '1px solid var(--io-border)', borderRadius: '8px' }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontWeight: 600, fontSize: '14px', color: 'var(--io-text-primary)' }}>{t.name}</span>
                  <span style={{ fontSize: '11px', padding: '1px 6px', borderRadius: '4px', background: t.is_active ? 'rgba(34,197,94,0.12)' : 'var(--io-surface-secondary)', color: t.is_active ? '#22c55e' : 'var(--io-text-muted)', fontWeight: 600 }}>
                    {t.is_active ? 'Active' : 'Inactive'}
                  </span>
                  <span style={{ fontSize: '11px', color: 'var(--io-text-muted)' }}>v{t.version}</span>
                </div>
                {t.description && (
                  <div style={{ fontSize: '12px', color: 'var(--io-text-muted)', marginTop: '2px' }}>{t.description}</div>
                )}
                <div style={{ fontSize: '12px', color: 'var(--io-text-muted)', marginTop: '2px' }}>
                  {t.checkpoints.length} checkpoint{t.checkpoints.length !== 1 ? 's' : ''}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <PrintDialog
                  preselectedTemplateId={t.id}
                  trigger={
                    <button style={btnStyle()}>Print</button>
                  }
                />
                <button style={btnStyle()} onClick={() => navigate(`/rounds/templates/${t.id}/edit`)}>Edit</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
