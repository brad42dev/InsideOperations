import { useRef, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { recognitionApi, type ModelInfo } from '../../api/recognition'
import { showToast } from '../../shared/components/Toast'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`
}

function StatusPill({ active, label }: { active: boolean; label: string }) {
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '2px 8px',
        borderRadius: '999px',
        fontSize: '11px',
        fontWeight: 600,
        background: active ? 'var(--io-success-subtle)' : 'var(--io-surface-tertiary)',
        color: active ? 'var(--io-success)' : 'var(--io-text-muted)',
      }}
    >
      {label}
    </span>
  )
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        background: 'var(--io-surface)',
        border: '1px solid var(--io-border)',
        borderRadius: 'var(--io-radius-lg)',
        marginBottom: '24px',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          padding: '14px 20px',
          borderBottom: '1px solid var(--io-border)',
          fontWeight: 600,
          fontSize: '14px',
          color: 'var(--io-text-primary)',
        }}
      >
        {title}
      </div>
      <div style={{ padding: '20px' }}>{children}</div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Service Status Card
// ---------------------------------------------------------------------------

function ServiceStatusCard() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['recognition', 'status'],
    queryFn: async () => {
      const r = await recognitionApi.getStatus()
      if (!r.success) throw new Error(r.error.message)
      return r.data
    },
    refetchInterval: 10_000,
  })

  return (
    <SectionCard title="Service Status">
      {isLoading && (
        <p style={{ color: 'var(--io-text-muted)', fontSize: '13px' }}>Loading status…</p>
      )}
      {isError && (
        <p style={{ color: 'var(--io-danger)', fontSize: '13px' }}>
          Could not reach recognition service.
        </p>
      )}
      {data && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
            gap: '16px',
          }}
        >
          <StatItem label="Models Loaded" value={`${data.models_loaded} / ${data.models_total}`} />
          <StatItem
            label="PID Model"
            value={data.pid_model ?? '—'}
            subtext={data.pid_model ? 'loaded' : 'not loaded'}
          />
          <StatItem
            label="DCS Model"
            value={data.dcs_model ?? '—'}
            subtext={data.dcs_model ? 'loaded' : 'not loaded'}
          />
          <div>
            <div style={{ fontSize: '11px', color: 'var(--io-text-muted)', marginBottom: '4px' }}>
              ONNX Runtime
            </div>
            <StatusPill active={data.onnx_available} label={data.onnx_available ? 'Available' : 'Deferred'} />
          </div>
        </div>
      )}
    </SectionCard>
  )
}

function StatItem({ label, value, subtext }: { label: string; value: string; subtext?: string }) {
  return (
    <div>
      <div style={{ fontSize: '11px', color: 'var(--io-text-muted)', marginBottom: '4px' }}>
        {label}
      </div>
      <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--io-text-primary)' }}>
        {value}
      </div>
      {subtext && (
        <div style={{ fontSize: '11px', color: 'var(--io-text-muted)', marginTop: '2px' }}>
          {subtext}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Models Table
// ---------------------------------------------------------------------------

function ModelsSection() {
  const qc = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploadDomain, setUploadDomain] = useState<'pid' | 'dcs'>('pid')
  const [uploading, setUploading] = useState(false)

  const { data: models, isLoading } = useQuery({
    queryKey: ['recognition', 'models'],
    queryFn: async () => {
      const r = await recognitionApi.listModels()
      if (!r.success) throw new Error(r.error.message)
      return r.data
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => recognitionApi.deleteModel(id),
    onSuccess: (result) => {
      if (!result.success) {
        showToast({ title: result.error.message, variant: 'error' })
        return
      }
      qc.invalidateQueries({ queryKey: ['recognition', 'models'] })
      qc.invalidateQueries({ queryKey: ['recognition', 'status'] })
      showToast({ title: 'Model removed', variant: 'success' })
    },
  })

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const result = await recognitionApi.uploadModel(file, uploadDomain)
      if (result.success) {
        qc.invalidateQueries({ queryKey: ['recognition', 'models'] })
        qc.invalidateQueries({ queryKey: ['recognition', 'status'] })
        showToast({ title: `Model "${file.name}" uploaded`, variant: 'success' })
      } else {
        showToast({ title: result.error.message, variant: 'error' })
      }
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  return (
    <SectionCard title="Loaded Models">
      {/* Upload controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
        <select
          value={uploadDomain}
          onChange={(e) => setUploadDomain(e.target.value as 'pid' | 'dcs')}
          style={{
            padding: '6px 10px',
            borderRadius: 'var(--io-radius)',
            border: '1px solid var(--io-border)',
            background: 'var(--io-surface-secondary)',
            color: 'var(--io-text-primary)',
            fontSize: '13px',
          }}
        >
          <option value="pid">P&ID</option>
          <option value="dcs">DCS</option>
        </select>
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          style={{
            padding: '6px 14px',
            borderRadius: 'var(--io-radius)',
            border: '1px solid var(--io-border)',
            background: 'var(--io-accent)',
            color: '#fff',
            fontSize: '13px',
            fontWeight: 600,
            cursor: uploading ? 'not-allowed' : 'pointer',
            opacity: uploading ? 0.6 : 1,
          }}
        >
          {uploading ? 'Uploading…' : 'Upload .iomodel'}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".iomodel"
          onChange={handleFileChange}
          style={{ display: 'none' }}
        />
        <span style={{ fontSize: '12px', color: 'var(--io-text-muted)' }}>
          Select domain, then upload a .iomodel package from SymBA
        </span>
      </div>

      {/* Models table */}
      {isLoading && (
        <p style={{ fontSize: '13px', color: 'var(--io-text-muted)' }}>Loading…</p>
      )}
      {!isLoading && (!models || models.length === 0) && (
        <p style={{ fontSize: '13px', color: 'var(--io-text-muted)' }}>
          No models uploaded. Upload a .iomodel file to get started.
        </p>
      )}
      {models && models.length > 0 && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr>
                {['Domain', 'Filename', 'Version', 'Classes', 'Size', 'Loaded', 'Uploaded', ''].map(
                  (h) => (
                    <th
                      key={h}
                      style={{
                        textAlign: 'left',
                        padding: '6px 12px',
                        borderBottom: '1px solid var(--io-border)',
                        color: 'var(--io-text-muted)',
                        fontWeight: 600,
                        fontSize: '11px',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {h}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody>
              {models.map((m: ModelInfo) => (
                <tr
                  key={m.id}
                  style={{ borderBottom: '1px solid var(--io-border-subtle)' }}
                >
                  <td style={{ padding: '8px 12px', fontWeight: 600, color: 'var(--io-text-primary)' }}>
                    {m.domain.toUpperCase()}
                  </td>
                  <td style={{ padding: '8px 12px', color: 'var(--io-text-secondary)', fontFamily: 'monospace', fontSize: '12px' }}>
                    {m.filename}
                  </td>
                  <td style={{ padding: '8px 12px', color: 'var(--io-text-secondary)' }}>
                    {m.version}
                  </td>
                  <td style={{ padding: '8px 12px', color: 'var(--io-text-secondary)' }}>
                    {m.class_count}
                  </td>
                  <td style={{ padding: '8px 12px', color: 'var(--io-text-secondary)', whiteSpace: 'nowrap' }}>
                    {formatBytes(m.file_size_bytes)}
                  </td>
                  <td style={{ padding: '8px 12px' }}>
                    <StatusPill active={m.loaded} label={m.loaded ? 'Yes' : 'No'} />
                  </td>
                  <td style={{ padding: '8px 12px', color: 'var(--io-text-muted)', whiteSpace: 'nowrap', fontSize: '12px' }}>
                    {new Date(m.uploaded_at).toLocaleString()}
                  </td>
                  <td style={{ padding: '8px 12px' }}>
                    <button
                      onClick={() => deleteMutation.mutate(m.id)}
                      disabled={deleteMutation.isPending}
                      style={{
                        padding: '3px 10px',
                        borderRadius: 'var(--io-radius)',
                        border: '1px solid var(--io-danger)',
                        background: 'transparent',
                        color: 'var(--io-danger)',
                        fontSize: '12px',
                        cursor: 'pointer',
                      }}
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </SectionCard>
  )
}

// ---------------------------------------------------------------------------
// Gap Reports Section
// ---------------------------------------------------------------------------

function GapReportsSection() {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [lastImported, setLastImported] = useState<string | null>(null)

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const result = await recognitionApi.uploadGapReport(file)
      if (result.success) {
        setLastImported(result.data.filename)
        showToast({ title: `Gap report "${result.data.filename}" imported`, variant: 'success' })
      } else {
        showToast({ title: result.error.message, variant: 'error' })
      }
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  return (
    <SectionCard title="Gap Reports">
      <p style={{ fontSize: '13px', color: 'var(--io-text-secondary)', marginBottom: '16px' }}>
        Import .iogap files generated by SymBA to track unrecognised symbols and gaps
        in the P&ID or DCS model coverage.
      </p>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          style={{
            padding: '6px 14px',
            borderRadius: 'var(--io-radius)',
            border: '1px solid var(--io-border)',
            background: 'var(--io-accent)',
            color: '#fff',
            fontSize: '13px',
            fontWeight: 600,
            cursor: uploading ? 'not-allowed' : 'pointer',
            opacity: uploading ? 0.6 : 1,
          }}
        >
          {uploading ? 'Importing…' : 'Import .iogap'}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".iogap"
          onChange={handleFileChange}
          style={{ display: 'none' }}
        />
        {lastImported && (
          <span style={{ fontSize: '12px', color: 'var(--io-success)' }}>
            Last imported: {lastImported}
          </span>
        )}
      </div>
    </SectionCard>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function RecognitionPage() {
  return (
    <div>
      <h1
        style={{
          fontSize: '20px',
          fontWeight: 700,
          color: 'var(--io-text-primary)',
          marginBottom: '4px',
        }}
      >
        Recognition
      </h1>
      <p
        style={{
          fontSize: '13px',
          color: 'var(--io-text-muted)',
          marginBottom: '24px',
        }}
      >
        Manage P&ID and DCS symbol recognition models and gap reports.
        Full ONNX inference is enabled when .iomodel packages are loaded.
      </p>

      <ServiceStatusCard />
      <ModelsSection />
      <GapReportsSection />
    </div>
  )
}
