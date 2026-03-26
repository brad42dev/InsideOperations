/**
 * NotificationHistoryPanel — slide-in drawer showing recent toast history.
 *
 * Opened by pressing F8 (or via useToastStore.openNotifPanel()).
 * Dismissed via Escape, clicking the backdrop, or the close button.
 *
 * Spec reference: DD-32-019 (UAT: F8 key must open a visible notification history panel)
 */

import { useEffect, useRef } from 'react'
import { X, Bell, BellOff } from 'lucide-react'
import { useToastStore, type ToastHistoryItem, type ToastVariant } from './Toast'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function variantColor(variant: ToastVariant): string {
  switch (variant) {
    case 'success': return 'var(--io-success)'
    case 'error':   return 'var(--io-danger)'
    case 'warning': return 'var(--io-warning)'
    default:        return 'var(--io-accent)'
  }
}

function variantLabel(variant: ToastVariant): string {
  switch (variant) {
    case 'success': return 'Success'
    case 'error':   return 'Error'
    case 'warning': return 'Warning'
    default:        return 'Info'
  }
}

function formatTimestamp(ms: number): string {
  const d = new Date(ms)
  const now = new Date()
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  if (sameDay) {
    return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  }
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// ---------------------------------------------------------------------------
// Single history row
// ---------------------------------------------------------------------------

function HistoryRow({ item }: { item: ToastHistoryItem }) {
  return (
    <div
      style={{
        display: 'flex',
        gap: '10px',
        padding: '10px 16px',
        borderBottom: '1px solid var(--io-border-subtle)',
        alignItems: 'flex-start',
      }}
    >
      {/* Variant indicator dot */}
      <span
        aria-hidden="true"
        style={{
          marginTop: '4px',
          flexShrink: 0,
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          background: variantColor(item.variant),
        }}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            gap: '8px',
          }}
        >
          <span
            style={{
              fontSize: '13px',
              fontWeight: 600,
              color: 'var(--io-text-primary)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              flex: 1,
              minWidth: 0,
            }}
          >
            {item.title}
          </span>
          <span
            style={{
              fontSize: '11px',
              color: 'var(--io-text-muted)',
              flexShrink: 0,
              whiteSpace: 'nowrap',
            }}
          >
            {formatTimestamp(item.firedAt)}
          </span>
        </div>
        {item.description && (
          <p
            style={{
              margin: '2px 0 0',
              fontSize: '12px',
              color: 'var(--io-text-secondary)',
              lineHeight: 1.4,
            }}
          >
            {item.description}
          </p>
        )}
        <span
          style={{
            display: 'inline-block',
            marginTop: '4px',
            fontSize: '10px',
            fontWeight: 600,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            color: variantColor(item.variant),
          }}
        >
          {variantLabel(item.variant)}
        </span>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main panel
// ---------------------------------------------------------------------------

export default function NotificationHistoryPanel() {
  const { notifPanelOpen, closeNotifPanel, history, clearHistory } = useToastStore()
  const panelRef = useRef<HTMLDivElement>(null)

  // Escape key closes the panel
  useEffect(() => {
    if (!notifPanelOpen) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.stopPropagation()
        closeNotifPanel()
      }
    }
    document.addEventListener('keydown', onKeyDown, true) // capture so it runs before AppShell
    return () => document.removeEventListener('keydown', onKeyDown, true)
  }, [notifPanelOpen, closeNotifPanel])

  // Focus the panel when it opens so keyboard users land inside it
  useEffect(() => {
    if (notifPanelOpen && panelRef.current) {
      panelRef.current.focus()
    }
  }, [notifPanelOpen])

  if (!notifPanelOpen) return null

  return (
    <>
      {/* Backdrop — click outside closes the panel */}
      <div
        aria-hidden="true"
        onClick={closeNotifPanel}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 1100,
          background: 'rgba(0,0,0,0.25)',
        }}
      />

      {/* Drawer panel */}
      <div
        ref={panelRef}
        role="dialog"
        aria-label="Notifications (F8)"
        aria-modal="true"
        tabIndex={-1}
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width: '360px',
          maxWidth: '100vw',
          zIndex: 1101,
          background: 'var(--io-surface-overlay)',
          borderLeft: '1px solid var(--io-border-default)',
          boxShadow: 'var(--io-shadow-lg)',
          display: 'flex',
          flexDirection: 'column',
          outline: 'none',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '14px 16px',
            borderBottom: '1px solid var(--io-border-default)',
            flexShrink: 0,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              color: 'var(--io-text-primary)',
              fontWeight: 600,
              fontSize: '14px',
            }}
          >
            <Bell size={16} />
            <span>Notifications</span>
            <kbd
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                minWidth: '28px',
                height: '20px',
                padding: '0 5px',
                borderRadius: '4px',
                background: 'var(--io-surface-secondary)',
                border: '1px solid var(--io-border-subtle)',
                boxShadow: '0 1px 0 0 var(--io-border-subtle)',
                fontSize: '10px',
                fontFamily: 'var(--io-font-mono, ui-monospace, monospace)',
                color: 'var(--io-text-muted)',
                marginLeft: '2px',
              }}
            >
              F8
            </kbd>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            {history.length > 0 && (
              <button
                onClick={clearHistory}
                title="Clear notification history"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'none',
                  border: 'none',
                  borderRadius: '4px',
                  color: 'var(--io-text-muted)',
                  cursor: 'pointer',
                  padding: '4px 8px',
                  fontSize: '11px',
                  gap: '4px',
                }}
              >
                Clear all
              </button>
            )}
            <button
              onClick={closeNotifPanel}
              aria-label="Close notifications panel"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '28px',
                height: '28px',
                background: 'none',
                border: 'none',
                borderRadius: '4px',
                color: 'var(--io-text-muted)',
                cursor: 'pointer',
                padding: 0,
              }}
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Body — scrollable list or empty state */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {history.length === 0 ? (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                gap: '12px',
                color: 'var(--io-text-muted)',
                padding: '40px 24px',
                textAlign: 'center',
              }}
            >
              <BellOff size={32} style={{ opacity: 0.4 }} />
              <p style={{ margin: 0, fontSize: '13px' }}>No notifications</p>
              <p style={{ margin: 0, fontSize: '12px', color: 'var(--io-text-disabled)' }}>
                Notifications will appear here after they fire.
              </p>
            </div>
          ) : (
            <div>
              {history.map((item) => (
                <HistoryRow key={item.id} item={item} />
              ))}
            </div>
          )}
        </div>

        {/* Footer hint */}
        <div
          style={{
            padding: '8px 16px',
            borderTop: '1px solid var(--io-border-subtle)',
            fontSize: '11px',
            color: 'var(--io-text-disabled)',
            flexShrink: 0,
          }}
        >
          Press Esc to close
        </div>
      </div>
    </>
  )
}
