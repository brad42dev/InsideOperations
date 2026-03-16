import * as Dialog from '@radix-ui/react-dialog'
import { ExpressionBuilder, type ExpressionBuilderProps } from './ExpressionBuilder'

export interface ExpressionBuilderModalProps extends ExpressionBuilderProps {
  open: boolean
}

export function ExpressionBuilderModal({
  open,
  onCancel,
  ...builderProps
}: ExpressionBuilderModalProps) {
  return (
    <Dialog.Root open={open} onOpenChange={(v) => { if (!v) onCancel() }}>
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
            transform: 'translate(-50%, -50%)',
            background: 'var(--io-surface-elevated)',
            border: '1px solid var(--io-border)',
            borderRadius: '10px',
            padding: '24px',
            width: 'min(900px, 96vw)',
            maxHeight: '90vh',
            overflowY: 'auto',
            zIndex: 201,
            boxShadow: '0 24px 80px rgba(0,0,0,0.5)',
            display: 'flex',
            flexDirection: 'column',
          }}
          aria-describedby={undefined}
        >
          {/* Header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '20px',
              flexShrink: 0,
            }}
          >
            <Dialog.Title
              style={{
                margin: 0,
                fontSize: '16px',
                fontWeight: 600,
                color: 'var(--io-text-primary)',
              }}
            >
              Expression Builder — {builderProps.contextLabel}
            </Dialog.Title>
            <Dialog.Close asChild>
              <button
                onClick={onCancel}
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
                ✕
              </button>
            </Dialog.Close>
          </div>

          {/* Builder content */}
          <div style={{ flex: 1, minHeight: 0 }}>
            <ExpressionBuilder
              {...builderProps}
              onCancel={onCancel}
            />
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
