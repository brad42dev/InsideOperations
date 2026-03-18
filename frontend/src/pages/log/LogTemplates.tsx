import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { logsApi } from '../../api/logs'

export default function LogTemplates() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['log', 'templates', 'all'],
    queryFn: () => logsApi.listTemplates(),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => logsApi.deleteTemplate(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['log', 'templates'] }),
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
  })

  return (
    <div style={{ padding: 'var(--io-space-6)', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: 'var(--io-text-primary)' }}>Log Templates</h2>
          <p style={{ margin: '4px 0 0', fontSize: '14px', color: 'var(--io-text-secondary)' }}>
            Shift handover and operational report templates.
          </p>
        </div>
        <button style={btnStyle(true)} onClick={() => navigate('/log/templates/new/edit')}>
          + New Template
        </button>
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
                  {t.segment_ids.length} segment{t.segment_ids.length !== 1 ? 's' : ''}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button style={btnStyle()} onClick={() => navigate(`/log/templates/${t.id}/edit`)}>Edit</button>
                <button
                  style={{ ...btnStyle(), color: '#ef4444', borderColor: 'rgba(239,68,68,0.3)' }}
                  onClick={() => {
                    if (confirm(`Delete template "${t.name}"?`)) deleteMutation.mutate(t.id)
                  }}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
