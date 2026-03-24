import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import { logsApi } from '../../api/logs'

export default function LogNew() {
  const navigate = useNavigate()
  const [selectedTemplateId, setSelectedTemplateId] = useState('')
  const [teamName, setTeamName] = useState('')
  const [error, setError] = useState<string | null>(null)

  const { data: templatesResult, isLoading } = useQuery({
    queryKey: ['log', 'templates', 'active'],
    queryFn: () => logsApi.listTemplates({ is_active: true }),
  })

  const templates = templatesResult?.success && Array.isArray(templatesResult.data) ? templatesResult.data : []

  const createMutation = useMutation({
    mutationFn: () =>
      logsApi.createInstance({
        template_id: selectedTemplateId,
        team_name: teamName.trim() || undefined,
      }),
    onSuccess: (result) => {
      if (!result.success) {
        setError(result.error.message)
        return
      }
      navigate(`/log/${result.data.id}`)
    },
    onError: (err: Error) => setError(err.message),
  })

  const containerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100%',
    padding: 'var(--io-space-6)',
    background: 'var(--io-bg)',
  }

  const cardStyle: React.CSSProperties = {
    background: 'var(--io-surface)',
    border: '1px solid var(--io-border)',
    borderRadius: '12px',
    padding: '32px',
    width: '100%',
    maxWidth: '520px',
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  }

  const labelStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    fontSize: '12px',
    fontWeight: 600,
    color: 'var(--io-text-secondary)',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  }

  const inputStyle: React.CSSProperties = {
    padding: '10px 12px',
    background: 'var(--io-surface-secondary)',
    border: '1px solid var(--io-border)',
    borderRadius: '6px',
    color: 'var(--io-text-primary)',
    fontSize: '14px',
    width: '100%',
    boxSizing: 'border-box',
  }

  return (
    <div style={containerStyle}>
      <div style={cardStyle}>
        <div>
          <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: 'var(--io-text-primary)' }}>
            New Log Entry
          </h2>
          <p style={{ margin: '6px 0 0', fontSize: '14px', color: 'var(--io-text-secondary)' }}>
            Select a template to start a new operational log entry.
          </p>
        </div>

        <label style={labelStyle}>
          Template *
          <select
            value={selectedTemplateId}
            onChange={(e) => setSelectedTemplateId(e.target.value)}
            style={inputStyle}
            disabled={isLoading}
          >
            <option value="">
              {isLoading ? 'Loading templates…' : '— Select a template —'}
            </option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>

        <label style={labelStyle}>
          Team / Crew Name (optional)
          <input
            value={teamName}
            onChange={(e) => setTeamName(e.target.value)}
            placeholder="e.g. Night shift A"
            style={inputStyle}
          />
        </label>

        {error && (
          <div style={{ padding: '10px 14px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '6px', fontSize: '13px', color: '#ef4444' }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
          <button
            onClick={() => navigate('/log')}
            style={{
              padding: '9px 18px',
              background: 'none',
              border: '1px solid var(--io-border)',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px',
              color: 'var(--io-text-secondary)',
            }}
          >
            Cancel
          </button>
          <button
            onClick={() => createMutation.mutate()}
            disabled={!selectedTemplateId || createMutation.isPending}
            style={{
              padding: '9px 18px',
              background: selectedTemplateId ? 'var(--io-accent)' : 'var(--io-surface-secondary)',
              border: 'none',
              borderRadius: '6px',
              cursor: selectedTemplateId ? 'pointer' : 'not-allowed',
              fontSize: '14px',
              fontWeight: 600,
              color: selectedTemplateId ? '#fff' : 'var(--io-text-muted)',
            }}
          >
            {createMutation.isPending ? 'Creating…' : 'Start Entry'}
          </button>
        </div>
      </div>
    </div>
  )
}
