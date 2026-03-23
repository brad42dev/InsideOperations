import { useEffect } from 'react'
import * as ToastPrimitive from '@radix-ui/react-toast'
import { create } from 'zustand'
import { uuidv4 } from '../../lib/uuid'

// ---------------------------------------------------------------------------
// Toast store — call showToast() from anywhere
// ---------------------------------------------------------------------------

export type ToastVariant = 'info' | 'success' | 'error' | 'warning'

export interface ToastItem {
  id: string
  title: string
  description?: string
  variant: ToastVariant
  action?: { label: string; onClick: () => void }
  duration?: number
}

interface ToastState {
  toasts: ToastItem[]
  show: (item: Omit<ToastItem, 'id'>) => void
  dismiss: (id: string) => void
}

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  show: (item) => {
    const id = uuidv4()
    set((s) => ({ toasts: [...s.toasts, { ...item, id }] }))
  },
  dismiss: (id) =>
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}))

export function showToast(item: Omit<ToastItem, 'id'>) {
  useToastStore.getState().show(item)
}

// ---------------------------------------------------------------------------
// Variant styles
// ---------------------------------------------------------------------------

function variantStyle(variant: ToastVariant): React.CSSProperties {
  switch (variant) {
    case 'success':
      return {
        borderLeft: '3px solid var(--io-success)',
        background: 'var(--io-surface-elevated)',
      }
    case 'error':
      return {
        borderLeft: '3px solid var(--io-danger)',
        background: 'var(--io-surface-elevated)',
      }
    case 'warning':
      return {
        borderLeft: '3px solid var(--io-warning)',
        background: 'var(--io-surface-elevated)',
      }
    default:
      return {
        borderLeft: '3px solid var(--io-accent)',
        background: 'var(--io-surface-elevated)',
      }
  }
}

// ---------------------------------------------------------------------------
// Single toast item
// ---------------------------------------------------------------------------

function ToastItem({ toast }: { toast: ToastItem }) {
  const { dismiss } = useToastStore()

  useEffect(() => {
    const duration = toast.duration ?? 5000
    // duration === 0 means "persist until manually dismissed" — no auto-dismiss timer
    if (duration === 0) return
    const timer = setTimeout(() => dismiss(toast.id), duration)
    return () => clearTimeout(timer)
  }, [toast.id, toast.duration, dismiss])

  return (
    <ToastPrimitive.Root
      open
      onOpenChange={(open) => {
        if (!open) dismiss(toast.id)
      }}
      style={{
        ...variantStyle(toast.variant),
        border: '1px solid var(--io-border)',
        borderRadius: 'var(--io-radius)',
        padding: '12px 14px',
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
        boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
        minWidth: '280px',
        maxWidth: '360px',
        pointerEvents: 'auto',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
        <ToastPrimitive.Title
          style={{
            fontSize: '13px',
            fontWeight: 600,
            color: 'var(--io-text-primary)',
            margin: 0,
          }}
        >
          {toast.title}
        </ToastPrimitive.Title>
        <ToastPrimitive.Close
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--io-text-muted)',
            cursor: 'pointer',
            fontSize: '14px',
            lineHeight: 1,
            padding: '0 2px',
            flexShrink: 0,
          }}
          aria-label="Dismiss"
        >
          ×
        </ToastPrimitive.Close>
      </div>
      {toast.description && (
        <ToastPrimitive.Description
          style={{
            fontSize: '12px',
            color: 'var(--io-text-secondary)',
            margin: 0,
            lineHeight: 1.4,
          }}
        >
          {toast.description}
        </ToastPrimitive.Description>
      )}
      {toast.action && (
        <ToastPrimitive.Action
          altText={toast.action.label}
          asChild
        >
          <button
            onClick={toast.action.onClick}
            style={{
              marginTop: '4px',
              padding: '4px 10px',
              background: 'var(--io-accent-subtle)',
              border: '1px solid var(--io-accent)',
              borderRadius: 'var(--io-radius)',
              color: 'var(--io-accent)',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              alignSelf: 'flex-start',
            }}
          >
            {toast.action.label}
          </button>
        </ToastPrimitive.Action>
      )}
    </ToastPrimitive.Root>
  )
}

// ---------------------------------------------------------------------------
// ToastViewport — mount once in AppShell or root
// ---------------------------------------------------------------------------

export default function ToastProvider() {
  const { toasts } = useToastStore()

  return (
    <ToastPrimitive.Provider swipeDirection="right">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} />
      ))}
      <ToastPrimitive.Viewport
        style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          zIndex: 9999,
          padding: 0,
          margin: 0,
          listStyle: 'none',
          outline: 'none',
          pointerEvents: 'none',
        }}
      />
    </ToastPrimitive.Provider>
  )
}
