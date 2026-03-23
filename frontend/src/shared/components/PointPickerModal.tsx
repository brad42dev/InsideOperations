/**
 * PointPickerModal — modal wrapper around the shared PointPicker component.
 *
 * Renders the full Browse / Search / Favorites / Recent tabbed picker inside a
 * Radix Dialog. Designed for single-select use-cases such as the Dashboard
 * widget config panel.
 *
 * Usage:
 *   <PointPickerModal
 *     open={open}
 *     onClose={() => setOpen(false)}
 *     onSelect={(pointId) => handleSelect(pointId)}
 *     currentPointId={cfg.metric}          // optional — highlights current selection
 *   />
 */

import * as Dialog from '@radix-ui/react-dialog'
import { useState } from 'react'
import PointPicker from './PointPicker'

export interface PointPickerModalProps {
  open: boolean
  onClose: () => void
  /** Called with the selected point ID when the user confirms */
  onSelect: (pointId: string) => void
  /** Current point ID to pre-select */
  currentPointId?: string
  /** Optional dialog title override */
  title?: string
}

export function PointPickerModal({
  open,
  onClose,
  onSelect,
  currentPointId,
  title = 'Select Point',
}: PointPickerModalProps) {
  const [selected, setSelected] = useState<string[]>(
    currentPointId ? [currentPointId] : [],
  )

  function handleConfirm() {
    if (selected.length > 0) {
      onSelect(selected[0])
    }
    onClose()
  }

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(v) => {
        if (!v) onClose()
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.55)',
            zIndex: 300,
          }}
        />
        <Dialog.Content
          style={{
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            background: 'var(--io-surface-elevated)',
            border: '1px solid var(--io-border)',
            borderRadius: 'var(--io-radius)',
            width: 'min(760px, 96vw)',
            maxHeight: '80vh',
            display: 'flex',
            flexDirection: 'column',
            zIndex: 301,
            boxShadow: '0 16px 60px rgba(0,0,0,0.45)',
            overflow: 'hidden',
          }}
          aria-describedby={undefined}
        >
          {/* Header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 16px',
              borderBottom: '1px solid var(--io-border)',
              flexShrink: 0,
            }}
          >
            <Dialog.Title
              style={{
                margin: 0,
                fontSize: '14px',
                fontWeight: 600,
                color: 'var(--io-text-primary)',
              }}
            >
              {title}
            </Dialog.Title>
            <Dialog.Close asChild>
              <button
                onClick={onClose}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--io-text-muted)',
                  cursor: 'pointer',
                  fontSize: '18px',
                  lineHeight: 1,
                  padding: '2px 6px',
                }}
                aria-label="Close"
              >
                &#x2715;
              </button>
            </Dialog.Close>
          </div>

          {/* Picker body */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>
            <PointPicker
              selected={selected}
              onChange={setSelected}
              singleSelect
            />
          </div>

          {/* Footer */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: '8px',
              padding: '10px 16px',
              borderTop: '1px solid var(--io-border)',
              flexShrink: 0,
            }}
          >
            <button
              onClick={onClose}
              style={{
                padding: '6px 14px',
                fontSize: '13px',
                cursor: 'pointer',
                borderRadius: 'var(--io-radius)',
                border: '1px solid var(--io-border)',
                background: 'transparent',
                color: 'var(--io-text-secondary)',
              }}
            >
              Cancel
            </button>
            <button
              disabled={selected.length === 0}
              onClick={handleConfirm}
              style={{
                padding: '6px 14px',
                fontSize: '13px',
                cursor: selected.length > 0 ? 'pointer' : 'not-allowed',
                borderRadius: 'var(--io-radius)',
                border: 'none',
                background: 'var(--io-accent)',
                color: '#09090b',
                fontWeight: 600,
                opacity: selected.length > 0 ? 1 : 0.5,
              }}
            >
              Select
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
