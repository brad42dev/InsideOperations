import React, { useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { expressionsApi, type SavedExpression } from '../../api/expressions'
import type { ExpressionAst, ExpressionContext } from '../../shared/types/expression'
import { ExpressionBuilder } from '../../shared/components/expression/ExpressionBuilder'
import { useAuthStore } from '../../store/auth'
import DataTable from '../../shared/components/DataTable'
import type { ColumnDef } from '../../shared/components/DataTable'

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const btnSecondary: React.CSSProperties = {
  padding: '6px 12px',
  background: 'transparent',
  color: 'var(--io-text-secondary)',
  border: '1px solid var(--io-border)',
  borderRadius: 'var(--io-radius)',
  fontSize: '12px',
  cursor: 'pointer',
}

const btnDanger: React.CSSProperties = {
  ...btnSecondary,
  color: 'var(--io-danger)',
  borderColor: 'rgba(239,68,68,0.3)',
}

// ---------------------------------------------------------------------------
// Context display names
// ---------------------------------------------------------------------------

const CONTEXT_LABELS: Record<ExpressionContext, string> = {
  point_config:       'Point Config',
  alarm_definition:   'Alarm',
  rounds_checkpoint:  'Rounds Checkpoint',
  log_segment:        'Log Segment',
  widget:             'Widget',
  forensics:          'Forensics',
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

// ---------------------------------------------------------------------------
// Edit dialog (wraps ExpressionBuilder without Radix Dialog — uses Portal)
// ---------------------------------------------------------------------------

function EditExpressionDialog({
  expression,
  open,
  onOpenChange,
  onSave,
}: {
  expression: SavedExpression | null
  open: boolean
  onOpenChange: (v: boolean) => void
  onSave: (id: string, ast: ExpressionAst) => void
}) {
  if (!expression) return null

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.65)',
            zIndex: 200,
          }}
        />
        <Dialog.Content
          style={{
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%,-50%)',
            background: 'var(--io-surface-elevated)',
            border: '1px solid var(--io-border)',
            borderRadius: '10px',
            padding: '24px',
            width: 'min(900px, 96vw)',
            maxHeight: '92vh',
            overflowY: 'auto',
            zIndex: 201,
            boxShadow: '0 24px 80px rgba(0,0,0,0.5)',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
          }}
          aria-describedby={undefined}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
            <Dialog.Title style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: 'var(--io-text-primary)' }}>
              Edit Expression — {expression.name}
            </Dialog.Title>
            <Dialog.Close asChild>
              <button
                style={{ background: 'none', border: 'none', color: 'var(--io-text-muted)', cursor: 'pointer', fontSize: '18px', lineHeight: 1 }}
                aria-label="Close"
              >
                ✕
              </button>
            </Dialog.Close>
          </div>

          <ExpressionBuilder
            context={expression.context}
            contextLabel={CONTEXT_LABELS[expression.context] ?? expression.context}
            initialExpression={expression.ast}
            onApply={(ast) => {
              onSave(expression.id, ast)
              onOpenChange(false)
            }}
            onCancel={() => onOpenChange(false)}
          />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

// ---------------------------------------------------------------------------
// Confirm delete dialog
// ---------------------------------------------------------------------------

function ConfirmDeleteDialog({
  expression,
  open,
  onOpenChange,
  onConfirm,
}: {
  expression: SavedExpression | null
  open: boolean
  onOpenChange: (v: boolean) => void
  onConfirm: () => void
}) {
  if (!expression) return null
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 200 }} />
        <Dialog.Content
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
          aria-describedby={undefined}
        >
          <Dialog.Title style={{ margin: '0 0 12px', fontSize: '16px', fontWeight: 600, color: 'var(--io-text-primary)' }}>
            Delete Expression
          </Dialog.Title>
          <p style={{ margin: '0 0 24px', fontSize: '14px', color: 'var(--io-text-secondary)' }}>
            Are you sure you want to delete <strong>"{expression.name}"</strong>? This cannot be undone.
          </p>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
            <Dialog.Close asChild>
              <button style={btnSecondary}>Cancel</button>
            </Dialog.Close>
            <button
              style={btnDanger}
              onClick={() => {
                onConfirm()
                onOpenChange(false)
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
// Error banner
// ---------------------------------------------------------------------------

function ErrorBanner({ message }: { message: string }) {
  return (
    <div
      style={{
        background: 'rgba(239,68,68,0.1)',
        border: '1px solid rgba(239,68,68,0.3)',
        borderRadius: 'var(--io-radius)',
        padding: '10px 14px',
        color: 'var(--io-danger)',
        fontSize: '13px',
        marginBottom: '16px',
      }}
    >
      {message}
    </div>
  )
}

// ---------------------------------------------------------------------------
// ExpressionLibrary page
// ---------------------------------------------------------------------------

export default function ExpressionLibrary() {
  const queryClient = useQueryClient()
  const { user } = useAuthStore()
  const canManage = user?.permissions.includes('system:expression_manage') ?? false

  const [editExpr, setEditExpr] = useState<SavedExpression | null>(null)
  const [editOpen, setEditOpen] = useState(false)
  const [deleteExpr, setDeleteExpr] = useState<SavedExpression | null>(null)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [bannerError, setBannerError] = useState<string | null>(null)

  const query = useQuery({
    queryKey: ['expressions'],
    queryFn: async () => {
      const result = await expressionsApi.list()
      if (!result.success) throw new Error(result.error.message)
      return result.data.data as SavedExpression[]
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, ast }: { id: string; ast: ExpressionAst }) =>
      expressionsApi.update(id, { ast }),
    onSuccess: (result) => {
      if (!result.success) {
        setBannerError(result.error.message)
        return
      }
      queryClient.invalidateQueries({ queryKey: ['expressions'] })
    },
    onError: (err) => {
      setBannerError(err instanceof Error ? err.message : 'Update failed')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => expressionsApi.delete(id),
    onSuccess: (result) => {
      if (!result.success) {
        setBannerError(result.error.message)
        return
      }
      queryClient.invalidateQueries({ queryKey: ['expressions'] })
    },
    onError: (err) => {
      setBannerError(err instanceof Error ? err.message : 'Delete failed')
    },
  })

  const expressions = query.data ?? []

  const columns: ColumnDef<SavedExpression>[] = [
    {
      id: 'name',
      header: 'Name',
      accessorKey: 'name',
      sortable: true,
      minWidth: 160,
    },
    {
      id: 'description',
      header: 'Description',
      cell: (_val, row) => (
        <span style={{ color: 'var(--io-text-muted)', fontSize: '12px' }}>
          {row.description ?? '—'}
        </span>
      ),
      minWidth: 180,
    },
    {
      id: 'context',
      header: 'Context',
      cell: (_val, row) => (
        <span
          style={{
            display: 'inline-block',
            padding: '2px 8px',
            borderRadius: '100px',
            fontSize: '11px',
            fontWeight: 600,
            background: 'var(--io-accent-subtle)',
            color: 'var(--io-accent)',
          }}
        >
          {CONTEXT_LABELS[row.context] ?? row.context}
        </span>
      ),
      width: 140,
    },
    {
      id: 'is_shared',
      header: 'Shared',
      cell: (_val, row) => (
        <span style={{ fontSize: '12px', color: row.is_shared ? 'var(--io-success)' : 'var(--io-text-muted)' }}>
          {row.is_shared ? 'Yes' : 'No'}
        </span>
      ),
      width: 70,
    },
    {
      id: 'created_by',
      header: 'Created By',
      accessorKey: 'created_by',
      width: 120,
    },
    {
      id: 'updated_at',
      header: 'Updated',
      cell: (_val, row) => (
        <span style={{ fontSize: '12px', color: 'var(--io-text-muted)' }}>
          {formatDate(row.updated_at)}
        </span>
      ),
      width: 110,
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: (_val, row) => (
        <div style={{ display: 'flex', gap: '6px' }}>
          {canManage && (
            <>
              <button
                style={{
                  padding: '4px 10px',
                  background: 'transparent',
                  border: '1px solid var(--io-border)',
                  borderRadius: 'var(--io-radius)',
                  color: 'var(--io-text-secondary)',
                  fontSize: '12px',
                  cursor: 'pointer',
                }}
                onClick={(e) => {
                  e.stopPropagation()
                  setEditExpr(row)
                  setEditOpen(true)
                }}
              >
                Edit
              </button>
              <button
                style={{
                  padding: '4px 10px',
                  background: 'transparent',
                  border: '1px solid rgba(239,68,68,0.3)',
                  borderRadius: 'var(--io-radius)',
                  color: 'var(--io-danger)',
                  fontSize: '12px',
                  cursor: 'pointer',
                }}
                onClick={(e) => {
                  e.stopPropagation()
                  setDeleteExpr(row)
                  setDeleteOpen(true)
                }}
              >
                Delete
              </button>
            </>
          )}
          {!canManage && (
            <span style={{ fontSize: '12px', color: 'var(--io-text-muted)' }}>View only</span>
          )}
        </div>
      ),
      width: 160,
    },
  ]

  return (
    <div>
      {/* Page header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '20px',
        }}
      >
        <div>
          <h2 style={{ margin: '0 0 4px', fontSize: '18px', fontWeight: 600, color: 'var(--io-text-primary)' }}>
            Expression Library
          </h2>
          <p style={{ margin: 0, fontSize: '13px', color: 'var(--io-text-muted)' }}>
            Saved expressions for reuse across points, alarms, reports, and widgets
          </p>
        </div>
      </div>

      {bannerError && <ErrorBanner message={bannerError} />}

      {query.isError && (
        <ErrorBanner message={query.error instanceof Error ? query.error.message : 'Failed to load expressions'} />
      )}

      <DataTable<SavedExpression>
        data={expressions}
        columns={columns}
        height={520}
        rowHeight={40}
        loading={query.isLoading}
        emptyMessage="No saved expressions yet. Expressions are saved from the Expression Builder."
      />

      {/* Edit dialog */}
      <EditExpressionDialog
        expression={editExpr}
        open={editOpen}
        onOpenChange={setEditOpen}
        onSave={(id, ast) => {
          updateMutation.mutate({ id, ast })
        }}
      />

      {/* Delete confirm */}
      <ConfirmDeleteDialog
        expression={deleteExpr}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onConfirm={() => {
          if (deleteExpr) deleteMutation.mutate(deleteExpr.id)
        }}
      />
    </div>
  )
}
