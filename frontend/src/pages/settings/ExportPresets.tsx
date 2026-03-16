import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import * as Dialog from '@radix-ui/react-dialog'
import { useNavigate } from 'react-router-dom'
import { reportsApi, type ExportPreset } from '../../api/reports'
import DataTable from '../../shared/components/DataTable'
import type { ColumnDef } from '../../shared/components/DataTable'
import { showToast } from '../../shared/components/Toast'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

// ---------------------------------------------------------------------------
// Confirm delete dialog
// ---------------------------------------------------------------------------

function ConfirmDeleteDialog({
  preset,
  open,
  onOpenChange,
  onConfirm,
}: {
  preset: ExportPreset | null
  open: boolean
  onOpenChange: (v: boolean) => void
  onConfirm: () => void
}) {
  if (!preset) return null
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 200 }} />
        <Dialog.Content
          aria-describedby={undefined}
          style={{
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%,-50%)',
            background: 'var(--io-surface-elevated)',
            border: '1px solid var(--io-border)',
            borderRadius: '10px',
            padding: '24px',
            width: '420px',
            maxWidth: '95vw',
            zIndex: 201,
            boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
          }}
        >
          <Dialog.Title style={{ margin: '0 0 12px', fontSize: '16px', fontWeight: 600, color: 'var(--io-text-primary)' }}>
            Delete Preset
          </Dialog.Title>
          <p style={{ margin: '0 0 24px', fontSize: '14px', color: 'var(--io-text-secondary)' }}>
            Are you sure you want to delete the preset <strong>"{preset.name}"</strong>? This cannot be undone.
          </p>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
            <Dialog.Close asChild>
              <button style={{
                padding: '7px 14px',
                background: 'transparent',
                border: '1px solid var(--io-border)',
                borderRadius: 'var(--io-radius)',
                color: 'var(--io-text-secondary)',
                fontSize: '13px',
                cursor: 'pointer',
              }}>
                Cancel
              </button>
            </Dialog.Close>
            <button
              onClick={() => { onConfirm(); onOpenChange(false) }}
              style={{
                padding: '7px 14px',
                background: 'transparent',
                border: '1px solid rgba(239,68,68,0.3)',
                borderRadius: 'var(--io-radius)',
                color: 'var(--io-danger)',
                fontSize: '13px',
                cursor: 'pointer',
              }}
            >
              Delete
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

// ---------------------------------------------------------------------------
// ExportPresets settings page
// ---------------------------------------------------------------------------

export default function ExportPresets() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [deletePreset, setDeletePreset] = useState<ExportPreset | null>(null)
  const [deleteOpen, setDeleteOpen] = useState(false)

  // We need to fetch presets across all templates.
  // The API is per-template, so we first fetch all templates, then their presets.
  const templatesQuery = useQuery({
    queryKey: ['export-preset-templates'],
    queryFn: async () => {
      const result = await reportsApi.listTemplates({ limit: 200 })
      if (!result.success) throw new Error(result.error.message)
      return result.data.data
    },
  })

  // Fetch presets for each template and flatten
  const presetsQuery = useQuery({
    queryKey: ['all-export-presets', templatesQuery.data?.map((t) => t.id)],
    queryFn: async () => {
      const templates = templatesQuery.data ?? []
      const allPresets: ExportPreset[] = []
      await Promise.all(
        templates.map(async (template) => {
          const result = await reportsApi.listPresets(template.id)
          if (result.success) {
            result.data.forEach((preset) => {
              allPresets.push({
                ...preset,
                template_name: template.name,
              })
            })
          }
        }),
      )
      return allPresets
    },
    enabled: (templatesQuery.data?.length ?? 0) > 0,
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => reportsApi.deletePreset(id),
    onSuccess: (result) => {
      if (!result.success) {
        showToast({ title: 'Failed to delete preset', description: result.error.message, variant: 'error' })
        return
      }
      queryClient.invalidateQueries({ queryKey: ['all-export-presets'] })
      showToast({ title: 'Preset deleted', variant: 'success' })
    },
    onError: (err) => {
      showToast({
        title: 'Failed to delete preset',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'error',
      })
    },
  })

  const handleLoad = (preset: ExportPreset) => {
    // Navigate to reports module with the template selected
    // We store the preset intent in sessionStorage for the Reports page to pick up
    try {
      sessionStorage.setItem('reports_load_preset', JSON.stringify({
        template_id: preset.template_id,
        preset_id: preset.id,
        params: preset.params,
      }))
    } catch {
      // ignore storage errors
    }
    navigate('/reports')
  }

  const presets: ExportPreset[] = presetsQuery.data ?? []

  const isLoading = templatesQuery.isLoading || presetsQuery.isLoading

  const columns: ColumnDef<ExportPreset>[] = [
    {
      id: 'template_name',
      header: 'Report',
      cell: (_val, row) => (
        <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--io-text-primary)' }}>
          {row.template_name ?? '—'}
        </span>
      ),
      minWidth: 180,
      sortable: true,
    },
    {
      id: 'name',
      header: 'Preset Name',
      cell: (_val, row) => (
        <span style={{ fontSize: '13px', color: 'var(--io-text-secondary)' }}>
          {row.name}
        </span>
      ),
      minWidth: 160,
      sortable: true,
    },
    {
      id: 'created_at',
      header: 'Created',
      cell: (_val, row) => (
        <span style={{ fontSize: '12px', color: 'var(--io-text-muted)' }}>
          {formatDate(row.created_at)}
        </span>
      ),
      width: 120,
      sortable: true,
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: (_val, row) => (
        <div style={{ display: 'flex', gap: '6px' }}>
          <button
            onClick={(e) => {
              e.stopPropagation()
              handleLoad(row)
            }}
            style={{
              padding: '3px 9px',
              background: 'var(--io-accent-subtle)',
              border: '1px solid var(--io-accent)',
              borderRadius: 'var(--io-radius)',
              color: 'var(--io-accent)',
              fontSize: '11px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Load
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation()
              setDeletePreset(row)
              setDeleteOpen(true)
            }}
            style={{
              padding: '3px 9px',
              background: 'transparent',
              border: '1px solid rgba(239,68,68,0.3)',
              borderRadius: 'var(--io-radius)',
              color: 'var(--io-danger)',
              fontSize: '11px',
              cursor: 'pointer',
            }}
          >
            Delete
          </button>
        </div>
      ),
      width: 150,
    },
  ]

  return (
    <div>
      <div style={{ marginBottom: '20px' }}>
        <h2 style={{ margin: '0 0 4px', fontSize: '18px', fontWeight: 600, color: 'var(--io-text-primary)' }}>
          Export Presets
        </h2>
        <p style={{ margin: 0, fontSize: '13px', color: 'var(--io-text-muted)' }}>
          Your saved report parameter presets. Use "Load" to open a report with pre-filled settings.
        </p>
      </div>

      {(templatesQuery.isError || presetsQuery.isError) && (
        <div style={{
          padding: '12px 16px',
          background: 'rgba(239,68,68,0.1)',
          border: '1px solid rgba(239,68,68,0.3)',
          borderRadius: 'var(--io-radius)',
          color: 'var(--io-danger)',
          fontSize: '13px',
          marginBottom: '16px',
        }}>
          Failed to load presets.
        </div>
      )}

      <DataTable<ExportPreset>
        data={presets}
        columns={columns}
        height={480}
        rowHeight={40}
        loading={isLoading}
        emptyMessage="No export presets saved yet. Save a preset from the Reports module configuration panel."
      />

      <ConfirmDeleteDialog
        preset={deletePreset}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onConfirm={() => {
          if (deletePreset) deleteMutation.mutate(deletePreset.id)
        }}
      />
    </div>
  )
}
