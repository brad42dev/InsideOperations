import { useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { reportsApi, type ReportTemplate } from '../../api/reports'
import { useAuthStore } from '../../store/auth'
import { showToast } from '../../shared/components/Toast'

// ---------------------------------------------------------------------------
// Cron presets for self-subscribe
// ---------------------------------------------------------------------------

const FREQ_OPTIONS = [
  { label: 'Daily at 6:00 AM', cron: '0 6 * * *' },
  { label: 'Daily at midnight', cron: '0 0 * * *' },
  { label: 'Weekly (Monday 6:00 AM)', cron: '0 6 * * 1' },
  { label: 'Monthly (1st at 6:00 AM)', cron: '0 6 1 * *' },
]

const FORMAT_OPTIONS = ['pdf', 'html', 'csv', 'xlsx'] as const
type Format = typeof FORMAT_OPTIONS[number]

// ---------------------------------------------------------------------------
// Overlay / modal styles
// ---------------------------------------------------------------------------

const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,0.5)',
  zIndex: 1000,
}

const contentStyle: React.CSSProperties = {
  position: 'fixed',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  background: 'var(--io-surface-elevated)',
  border: '1px solid var(--io-border)',
  borderRadius: '10px',
  padding: '24px',
  width: '420px',
  maxWidth: '95vw',
  zIndex: 1001,
  display: 'flex',
  flexDirection: 'column',
  gap: '16px',
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '12px',
  fontWeight: 600,
  color: 'var(--io-text-secondary)',
  marginBottom: '4px',
}

const selectStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 10px',
  background: 'var(--io-surface-secondary)',
  border: '1px solid var(--io-border)',
  borderRadius: '6px',
  color: 'var(--io-text-primary)',
  fontSize: '13px',
}

const btnPrimary: React.CSSProperties = {
  flex: 1,
  padding: '9px 0',
  background: 'var(--io-accent)',
  border: 'none',
  borderRadius: '6px',
  color: '#fff',
  fontWeight: 600,
  fontSize: '13px',
  cursor: 'pointer',
}

const btnSecondary: React.CSSProperties = {
  flex: 1,
  padding: '9px 0',
  background: 'transparent',
  border: '1px solid var(--io-border)',
  borderRadius: '6px',
  color: 'var(--io-text-secondary)',
  fontWeight: 500,
  fontSize: '13px',
  cursor: 'pointer',
}

// ---------------------------------------------------------------------------
// SubscribeDialog
// ---------------------------------------------------------------------------

interface SubscribeDialogProps {
  template: ReportTemplate
  open: boolean
  onOpenChange: (open: boolean) => void
}

export default function SubscribeDialog({ template, open, onOpenChange }: SubscribeDialogProps) {
  const userId = useAuthStore((s) => s.user?.id)
  const qc = useQueryClient()

  const [frequency, setFrequency] = useState(FREQ_OPTIONS[0].cron)
  const [format, setFormat] = useState<Format>('pdf')
  const [emailDelivery, setEmailDelivery] = useState(true)

  const createSchedule = useMutation({
    mutationFn: () =>
      reportsApi.createSchedule({
        template_id: template.id,
        name: `${template.name} — personal subscription`,
        cron_expression: frequency,
        format,
        params: {},
        recipient_user_ids: userId ? [userId] : [],
        recipient_emails: [],
        enabled: true,
      }),
    onSuccess: (result) => {
      if (result.success) {
        showToast({ title: 'Subscribed', description: `You'll receive "${template.name}" on schedule.`, variant: 'success' })
        void qc.invalidateQueries({ queryKey: ['reports', 'schedules'] })
        onOpenChange(false)
      } else {
        showToast({ title: 'Subscription failed', description: 'Could not create schedule.', variant: 'error' })
      }
    },
    onError: () => {
      showToast({ title: 'Subscription failed', description: 'Network error.', variant: 'error' })
    },
  })

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay style={overlayStyle} />
        <Dialog.Content style={contentStyle}>
          <Dialog.Title style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: 'var(--io-text-primary)' }}>
            Subscribe to Report
          </Dialog.Title>
          <p style={{ margin: 0, fontSize: '13px', color: 'var(--io-text-muted)' }}>
            {template.name} — delivered to your account on a recurring schedule.
          </p>

          {/* Frequency */}
          <div>
            <label style={labelStyle}>Frequency</label>
            <select value={frequency} onChange={(e) => setFrequency(e.target.value)} style={selectStyle}>
              {FREQ_OPTIONS.map((o) => (
                <option key={o.cron} value={o.cron}>{o.label}</option>
              ))}
            </select>
          </div>

          {/* Format */}
          <div>
            <label style={labelStyle}>Format</label>
            <select value={format} onChange={(e) => setFormat(e.target.value as Format)} style={selectStyle}>
              {FORMAT_OPTIONS.map((f) => (
                <option key={f} value={f}>{f.toUpperCase()}</option>
              ))}
            </select>
          </div>

          {/* Delivery */}
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--io-text-primary)', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={emailDelivery}
              onChange={(e) => setEmailDelivery(e.target.checked)}
              style={{ width: '16px', height: '16px' }}
            />
            Send email notification when report is ready
          </label>

          {/* Actions */}
          <div style={{ display: 'flex', gap: '8px' }}>
            <button style={btnSecondary} onClick={() => onOpenChange(false)}>
              Cancel
            </button>
            <button
              style={{ ...btnPrimary, opacity: createSchedule.isPending ? 0.6 : 1 }}
              disabled={createSchedule.isPending}
              onClick={() => createSchedule.mutate()}
            >
              {createSchedule.isPending ? 'Subscribing…' : 'Subscribe'}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
