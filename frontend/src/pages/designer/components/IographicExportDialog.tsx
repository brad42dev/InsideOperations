/**
 * IographicExportDialog.tsx
 *
 * Simple dialog for exporting the current graphic as a .iographic package.
 * Collects optional description, then calls the export API and triggers download.
 */

import { useState } from 'react'
import { graphicsApi } from '../../../api/graphics'

interface IographicExportDialogProps {
  graphicId: string
  graphicName: string
  onClose: () => void
}

export default function IographicExportDialog({
  graphicId,
  graphicName,
  onClose,
}: IographicExportDialogProps) {
  const [description, setDescription] = useState('')
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleExport() {
    setExporting(true)
    setError(null)
    try {
      const blob = await graphicsApi.exportIographic(graphicId, description)
      // Build a safe filename from the graphic name
      const slug = graphicName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
      const filename = `${slug}.iographic`
      // Trigger download
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed')
    } finally {
      setExporting(false)
    }
  }

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 1100,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'rgba(0,0,0,0.6)',
    }}>
      <div style={{
        background: 'var(--io-surface-elevated)',
        border: '1px solid var(--io-border)',
        borderRadius: 'var(--io-radius)',
        padding: 24,
        width: 420,
        maxWidth: '90%',
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--io-text-primary)' }}>
            Export .iographic
          </div>
          <button
            onClick={onClose}
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--io-text-muted)', fontSize: 18, lineHeight: 1, padding: 2 }}
          >
            ×
          </button>
        </div>

        {/* Graphic info */}
        <div style={{
          background: 'var(--io-surface)',
          border: '1px solid var(--io-border)',
          borderRadius: 'var(--io-radius)',
          padding: '8px 12px',
          fontSize: 13,
          color: 'var(--io-text-secondary)',
        }}>
          <div style={{ fontWeight: 500, color: 'var(--io-text-primary)', marginBottom: 2 }}>{graphicName}</div>
          <div>Packages this graphic with its custom shapes and stencils.</div>
          <div style={{ marginTop: 4, color: 'var(--io-text-muted)', fontSize: 12 }}>
            Built-in shape library shapes are referenced by ID (not embedded).
          </div>
        </div>

        {/* Description */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label style={{ fontSize: 12, color: 'var(--io-text-secondary)', fontWeight: 500 }}>
            Description (optional)
          </label>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Brief description of this graphic package…"
            rows={3}
            style={{
              resize: 'vertical',
              background: 'var(--io-surface)',
              border: '1px solid var(--io-border)',
              borderRadius: 'var(--io-radius)',
              color: 'var(--io-text-primary)',
              fontSize: 13,
              padding: '6px 10px',
              fontFamily: 'inherit',
            }}
          />
        </div>

        {/* Error */}
        {error && (
          <div style={{ color: '#ef4444', fontSize: 12, padding: '6px 10px', background: 'rgba(239,68,68,0.1)', borderRadius: 4 }}>
            {error}
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{
              padding: '6px 16px',
              background: 'transparent',
              border: '1px solid var(--io-border)',
              borderRadius: 'var(--io-radius)',
              color: 'var(--io-text-secondary)',
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleExport}
            disabled={exporting}
            style={{
              padding: '6px 16px',
              background: 'var(--io-accent)',
              border: 'none',
              borderRadius: 'var(--io-radius)',
              color: '#09090b',
              fontSize: 13,
              fontWeight: 600,
              cursor: exporting ? 'not-allowed' : 'pointer',
              opacity: exporting ? 0.7 : 1,
            }}
          >
            {exporting ? 'Exporting…' : 'Export & Download'}
          </button>
        </div>
      </div>
    </div>
  )
}
