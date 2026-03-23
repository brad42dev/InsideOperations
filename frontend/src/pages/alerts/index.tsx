import { useState, useCallback, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import * as ContextMenuPrimitive from '@radix-ui/react-context-menu'
import { usePermission } from '../../shared/hooks/usePermission'
import { wsManager } from '../../shared/hooks/useWebSocket'
import { exportsApi, type ExportFormat } from '../../api/exports'
import {
  notificationsApi,
  type NotificationTemplate,
  type NotificationGroup,
  type NotificationMessage,
  type NotificationSeverity,
  type NotificationChannel,
  type SendNotificationPayload,
  type CreateTemplatePayload,
  type CreateGroupPayload,
  type UpdateGroupPayload,
  type TemplateVariable,
} from '../../api/notifications'

// ---------------------------------------------------------------------------
// Severity colours
// ---------------------------------------------------------------------------

const SEVERITY_COLORS: Record<NotificationSeverity, { bg: string; text: string; border: string }> = {
  emergency: { bg: 'rgba(239,68,68,0.15)', text: '#ef4444', border: '#ef4444' },
  critical:  { bg: 'rgba(249,115,22,0.15)', text: '#f97316', border: '#f97316' },
  warning:   { bg: 'rgba(234,179,8,0.15)', text: '#eab308', border: '#eab308' },
  info:      { bg: 'rgba(74,158,255,0.15)', text: '#4a9eff', border: '#4a9eff' },
}

// ALL_CHANNELS is no longer a compile-time constant — enabled channels are
// loaded from the Alert Service config at runtime via getEnabledChannels().
// The fallback below is used only while the query is loading or if it fails.
const FALLBACK_CHANNELS: NotificationChannel[] = ['websocket']

// ---------------------------------------------------------------------------
// Export helpers (shared by HistoryPanel)
// ---------------------------------------------------------------------------

const HISTORY_EXPORT_FORMATS: { label: string; fmt: ExportFormat }[] = [
  { label: 'CSV',     fmt: 'csv'     },
  { label: 'XLSX',    fmt: 'xlsx'    },
  { label: 'JSON',    fmt: 'json'    },
  { label: 'PDF',     fmt: 'pdf'     },
  { label: 'Parquet', fmt: 'parquet' },
  { label: 'HTML',    fmt: 'html'    },
]

function historyExportFilename(format: ExportFormat): string {
  const now = new Date()
  const date = now.toISOString().slice(0, 10)
  const time = now.toTimeString().slice(0, 5).replace(':', '')
  return `alerts_history_${date}_${time}.${format}`
}

// ---------------------------------------------------------------------------
// Severity badge
// ---------------------------------------------------------------------------

function SeverityBadge({ severity }: { severity: NotificationSeverity }) {
  const c = SEVERITY_COLORS[severity] ?? SEVERITY_COLORS.info
  return (
    <span
      style={{
        fontSize: '11px',
        fontWeight: 700,
        letterSpacing: '0.05em',
        textTransform: 'uppercase',
        padding: '2px 8px',
        borderRadius: '100px',
        background: c.bg,
        color: c.text,
        border: `1px solid ${c.border}`,
      }}
    >
      {severity}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Channel chips
// ---------------------------------------------------------------------------

function ChannelChips({ channels }: { channels: string[] }) {
  return (
    <span style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
      {channels.map((ch) => (
        <span
          key={ch}
          style={{
            fontSize: '10px',
            padding: '1px 6px',
            borderRadius: 4,
            background: 'var(--io-surface-secondary)',
            color: 'var(--io-text-muted)',
            border: '1px solid var(--io-border)',
          }}
        >
          {ch}
        </span>
      ))}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Confirm dialog for emergency sends
// ---------------------------------------------------------------------------

function ConfirmDialog({
  title,
  message,
  onConfirm,
  onCancel,
}: {
  title: string
  message: string
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
    >
      <div
        style={{
          background: 'var(--io-surface)',
          border: '1px solid var(--io-border)',
          borderRadius: 8,
          padding: 24,
          width: 400,
          maxWidth: '90vw',
        }}
      >
        <h3 style={{ margin: '0 0 8px', color: '#ef4444', fontSize: 16 }}>{title}</h3>
        <p style={{ margin: '0 0 20px', color: 'var(--io-text-secondary)', fontSize: 14 }}>{message}</p>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button
            onClick={onCancel}
            style={{
              padding: '8px 16px',
              borderRadius: 6,
              border: '1px solid var(--io-border)',
              background: 'transparent',
              color: 'var(--io-text)',
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            style={{
              padding: '8px 16px',
              borderRadius: 6,
              border: 'none',
              background: '#ef4444',
              color: '#fff',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Send Emergency Alert
          </button>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// ConfirmDeleteDialog — generic delete confirmation modal
// ---------------------------------------------------------------------------

function ConfirmDeleteDialog({
  title,
  message,
  onConfirm,
  onCancel,
}: {
  title: string
  message: string
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2000,
      }}
    >
      <div
        style={{
          background: 'var(--io-surface)',
          border: '1px solid var(--io-border)',
          borderRadius: 8,
          padding: 24,
          width: 400,
          maxWidth: '90vw',
        }}
      >
        <h3 style={{ margin: '0 0 8px', color: '#ef4444', fontSize: 16 }}>{title}</h3>
        <p style={{ margin: '0 0 20px', color: 'var(--io-text-secondary)', fontSize: 14 }}>{message}</p>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button
            onClick={onCancel}
            style={{
              padding: '8px 16px',
              borderRadius: 6,
              border: '1px solid var(--io-border)',
              background: 'transparent',
              color: 'var(--io-text)',
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            style={{
              padding: '8px 16px',
              borderRadius: 6,
              border: 'none',
              background: '#ef4444',
              color: '#fff',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Shared context menu styles
// ---------------------------------------------------------------------------

const ctxMenuContentStyle: React.CSSProperties = {
  background: 'var(--io-surface-elevated)',
  border: '1px solid var(--io-border)',
  borderRadius: 'var(--io-radius, 6px)',
  boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
  minWidth: 200,
  paddingTop: 4,
  paddingBottom: 4,
  zIndex: 2000,
  animation: 'io-context-menu-in 0.08s ease',
}

const ctxMenuItemStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  padding: '6px 14px',
  fontSize: 13,
  color: 'var(--io-text-primary)',
  cursor: 'pointer',
  userSelect: 'none',
  outline: 'none',
  background: 'transparent',
  border: 'none',
  width: '100%',
  textAlign: 'left',
  borderRadius: 0,
  gap: 8,
}

const ctxMenuItemDestructiveStyle: React.CSSProperties = {
  ...ctxMenuItemStyle,
  color: '#ef4444',
}

const ctxMenuItemDisabledStyle: React.CSSProperties = {
  ...ctxMenuItemDestructiveStyle,
  opacity: 0.4,
  cursor: 'default',
}

const ctxMenuSeparatorStyle: React.CSSProperties = {
  height: 1,
  background: 'var(--io-border)',
  margin: '3px 0',
}

// ---------------------------------------------------------------------------
// Send Alert Panel
// ---------------------------------------------------------------------------

function SendAlertPanel() {
  const qc = useQueryClient()
  const canSendEmergency = usePermission('alerts:send_emergency')

  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('')
  const [severity, setSeverity] = useState<NotificationSeverity>('info')
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [channels, setChannels] = useState<NotificationChannel[]>(['websocket'])
  const [recipientMode, setRecipientMode] = useState<'all' | 'group' | 'individuals'>('all')
  const [selectedGroupId, setSelectedGroupId] = useState<string>('')
  const [variableValues, setVariableValues] = useState<Record<string, string>>({})
  const [showConfirm, setShowConfirm] = useState(false)

  const { data: templatesResult } = useQuery({
    queryKey: ['notification-templates', { enabled: true }],
    queryFn: () => notificationsApi.listTemplates({ enabled: true }),
  })

  const { data: groupsResult } = useQuery({
    queryKey: ['notification-groups'],
    queryFn: () => notificationsApi.listGroups(),
  })

  const { data: enabledChannelsResult } = useQuery({
    queryKey: ['notification-channels-enabled'],
    queryFn: () => notificationsApi.getEnabledChannels(),
    // Channel config changes rarely — cache for 5 minutes
    staleTime: 5 * 60 * 1000,
  })

  const templates: NotificationTemplate[] = (templatesResult?.success && templatesResult.data) ? templatesResult.data : []
  const groups: NotificationGroup[] = (groupsResult?.success && groupsResult.data) ? groupsResult.data : []
  // Enabled channels from config — fall back to websocket-only if API fails or is loading
  const enabledChannels: NotificationChannel[] =
    (enabledChannelsResult?.success && enabledChannelsResult.data && enabledChannelsResult.data.length > 0)
      ? enabledChannelsResult.data
      : FALLBACK_CHANNELS

  const selectedTemplate = templates.find((t) => t.id === selectedTemplateId) ?? null

  const substituteVars = useCallback(
    (tpl: string) =>
      Object.entries(variableValues).reduce(
        (acc, [k, v]) => acc.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), v),
        tpl,
      ),
    [variableValues],
  )

  const previewTitle = selectedTemplate ? substituteVars(selectedTemplate.title_template) : title
  const previewBody = selectedTemplate ? substituteVars(selectedTemplate.body_template) : body

  const sendMutation = useMutation({
    mutationFn: (payload: SendNotificationPayload) => notificationsApi.sendNotification(payload),
    onSuccess: (result) => {
      if (result.success) {
        qc.invalidateQueries({ queryKey: ['notification-messages'] })
        qc.invalidateQueries({ queryKey: ['notification-active'] })
        // Reset form
        setSelectedTemplateId('')
        setSeverity('info')
        setTitle('')
        setBody('')
        setChannels(['websocket'])
        setVariableValues({})
        setRecipientMode('all')
        setSelectedGroupId('')
      }
    },
  })

  const sendEmergencyMutation = useMutation({
    mutationFn: (payload: SendNotificationPayload) => notificationsApi.sendEmergency(payload),
    onSuccess: (result) => {
      if (result.success) {
        qc.invalidateQueries({ queryKey: ['notification-messages'] })
        qc.invalidateQueries({ queryKey: ['notification-active'] })
        // Reset form
        setSelectedTemplateId('')
        setSeverity('info')
        setTitle('')
        setBody('')
        setChannels(['websocket'])
        setVariableValues({})
        setRecipientMode('all')
        setSelectedGroupId('')
      }
    },
  })

  const handleSend = () => {
    if (severity === 'emergency') {
      setShowConfirm(true)
    } else {
      doSend()
    }
  }

  const hasUnfilledRequired = selectedTemplate
    ? selectedTemplate.variables.some((v: TemplateVariable) => v.required && !variableValues[v.name]?.trim())
    : false

  const doSend = () => {
    setShowConfirm(false)
    if (hasUnfilledRequired) return
    const payload: SendNotificationPayload = {
      template_id: selectedTemplateId || undefined,
      severity,
      title: selectedTemplate ? undefined : title || undefined,
      body: selectedTemplate ? undefined : body || undefined,
      channels,
      group_id: recipientMode === 'group' ? selectedGroupId || undefined : undefined,
      variables: Object.keys(variableValues).length > 0 ? variableValues : undefined,
    }
    if (severity === 'emergency') {
      sendEmergencyMutation.mutate(payload)
    } else {
      sendMutation.mutate(payload)
    }
  }

  const toggleChannel = (ch: NotificationChannel) => {
    setChannels((prev) =>
      prev.includes(ch) ? prev.filter((c) => c !== ch) : [...prev, ch],
    )
  }

  const handleTemplateSelect = (id: string) => {
    setSelectedTemplateId(id)
    const tpl = templates.find((t) => t.id === id)
    if (tpl) {
      setSeverity(tpl.severity)
      // Filter template channels to only include channels enabled in the
      // Alert Service config. If none survive the filter, fall back to websocket.
      const filteredChannels = tpl.channels.filter((ch) => enabledChannels.includes(ch))
      setChannels(filteredChannels.length > 0 ? filteredChannels : ['websocket'])
      const initVars: Record<string, string> = {}
      tpl.variables.forEach((v) => { initVars[v.name] = v.default_value ?? '' })
      setVariableValues(initVars)
    } else {
      setVariableValues({})
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '8px 10px',
    borderRadius: 6,
    border: '1px solid var(--io-border)',
    background: 'var(--io-surface-secondary)',
    color: 'var(--io-text)',
    fontSize: 14,
    boxSizing: 'border-box',
  }

  const labelStyle: React.CSSProperties = {
    fontSize: 12,
    fontWeight: 600,
    color: 'var(--io-text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    display: 'block',
    marginBottom: 4,
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, alignItems: 'start' }}>
      {showConfirm && (
        <ConfirmDialog
          title="Send Emergency Alert?"
          message={`You are about to send an EMERGENCY alert to ${recipientMode === 'all' ? 'all users' : recipientMode === 'group' ? 'the selected group' : 'selected individuals'}. This cannot be undone. Are you sure?`}
          onConfirm={doSend}
          onCancel={() => setShowConfirm(false)}
        />
      )}

      {/* Left column: form */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Template selector */}
        <div>
          <label style={labelStyle}>Template (optional)</label>
          <select
            value={selectedTemplateId}
            onChange={(e) => handleTemplateSelect(e.target.value)}
            style={inputStyle}
          >
            <option value="">— Ad-hoc notification —</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.is_system ? '* ' : ''}{t.name} ({t.severity})
              </option>
            ))}
          </select>
        </div>

        {/* Severity */}
        <div>
          <label style={labelStyle}>Severity</label>
          <div style={{ display: 'flex', gap: 8 }}>
            {(['emergency', 'critical', 'warning', 'info'] as NotificationSeverity[])
              .filter((s) => s !== 'emergency' || canSendEmergency)
              .map((s) => {
                const c = SEVERITY_COLORS[s]
                const isSelected = severity === s
                return (
                  <button
                    key={s}
                    onClick={() => setSeverity(s)}
                    style={{
                      flex: 1,
                      padding: '6px 0',
                      borderRadius: 6,
                      border: `1px solid ${isSelected ? c.border : 'var(--io-border)'}`,
                      background: isSelected ? c.bg : 'var(--io-surface-secondary)',
                      color: isSelected ? c.text : 'var(--io-text-muted)',
                      fontWeight: isSelected ? 700 : 400,
                      fontSize: 12,
                      cursor: 'pointer',
                      textTransform: 'capitalize',
                    }}
                  >
                    {s}
                  </button>
                )
              })}
          </div>
        </div>

        {/* Title / body (only for ad-hoc) */}
        {!selectedTemplate && (
          <>
            <div>
              <label style={labelStyle}>Title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Alert title..."
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Message</label>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Alert message body..."
                rows={4}
                style={{ ...inputStyle, resize: 'vertical' }}
              />
            </div>
          </>
        )}

        {/* Variable inputs */}
        {selectedTemplate && selectedTemplate.variables.length > 0 && (
          <div>
            <label style={labelStyle}>Template Variables</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {selectedTemplate.variables.map((v: TemplateVariable) => (
                <div key={v.name}>
                  <label style={{ ...labelStyle, textTransform: 'none', fontSize: 11 }}>
                    {v.label}{v.required && <span style={{ color: '#ef4444', marginLeft: 2 }}>*</span>}
                  </label>
                  <input
                    type="text"
                    value={variableValues[v.name] ?? ''}
                    onChange={(e) =>
                      setVariableValues((prev) => ({ ...prev, [v.name]: e.target.value }))
                    }
                    placeholder={`Enter value for ${v.label}`}
                    style={inputStyle}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Channels — list is driven by Alert Service config, not hardcoded */}
        <div>
          <label style={labelStyle}>Channels</label>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {enabledChannels.map((ch) => {
              const checked = channels.includes(ch)
              return (
                <label
                  key={ch}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    fontSize: 13,
                    cursor: 'pointer',
                    color: checked ? 'var(--io-text)' : 'var(--io-text-muted)',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleChannel(ch)}
                  />
                  {ch}
                </label>
              )
            })}
          </div>
        </div>

        {/* Recipients */}
        <div>
          <label style={labelStyle}>Recipients</label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {(['all', 'group'] as const).map((mode) => (
              <label
                key={mode}
                style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}
              >
                <input
                  type="radio"
                  name="recipientMode"
                  value={mode}
                  checked={recipientMode === mode}
                  onChange={() => setRecipientMode(mode)}
                />
                {mode === 'all' ? 'All active users' : 'Notification group'}
              </label>
            ))}
            {recipientMode === 'group' && (
              <select
                value={selectedGroupId}
                onChange={(e) => setSelectedGroupId(e.target.value)}
                style={{ ...inputStyle, marginTop: 4 }}
              >
                <option value="">— Select group —</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name} ({g.member_count ?? 0} members)
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        {/* Send button */}
        {(() => {
          const activeMutation = severity === 'emergency' ? sendEmergencyMutation : sendMutation
          return (
            <>
              <button
                onClick={handleSend}
                disabled={activeMutation.isPending || channels.length === 0 || hasUnfilledRequired}
                style={{
                  padding: '10px 20px',
                  borderRadius: 6,
                  border: `1px solid ${SEVERITY_COLORS[severity].border}`,
                  background: SEVERITY_COLORS[severity].bg,
                  color: SEVERITY_COLORS[severity].text,
                  fontWeight: 700,
                  fontSize: 14,
                  cursor: activeMutation.isPending ? 'not-allowed' : 'pointer',
                  opacity: activeMutation.isPending ? 0.6 : 1,
                } as React.CSSProperties}
              >
                {activeMutation.isPending ? 'Sending…' : `Send ${severity.charAt(0).toUpperCase() + severity.slice(1)} Alert`}
              </button>

              {activeMutation.isSuccess && activeMutation.data?.success && (
                <p style={{ color: '#22c55e', fontSize: 13, margin: 0 }}>
                  Alert sent to {activeMutation.data.data.recipient_count} recipient(s).
                </p>
              )}
              {activeMutation.isSuccess && !activeMutation.data?.success && (
                <p style={{ color: '#ef4444', fontSize: 13, margin: 0 }}>
                  {(activeMutation.data as { error?: { message?: string } }).error?.message ?? 'Send failed.'}
                </p>
              )}
            </>
          )
        })()}
      </div>

      {/* Right column: live preview */}
      <div
        style={{
          background: 'var(--io-surface-secondary)',
          border: `1px solid ${SEVERITY_COLORS[severity].border}`,
          borderRadius: 8,
          padding: 16,
          position: 'sticky',
          top: 16,
        }}
      >
        <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--io-text-muted)', margin: '0 0 12px' }}>
          Preview
        </p>
        <div style={{ marginBottom: 8 }}>
          <SeverityBadge severity={severity} />
        </div>
        <h4 style={{ margin: '8px 0 4px', fontSize: 15, color: 'var(--io-text)' }}>
          {previewTitle || <span style={{ color: 'var(--io-text-muted)' }}>Alert title will appear here</span>}
        </h4>
        <p style={{ margin: '0 0 12px', fontSize: 13, color: 'var(--io-text-secondary)', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
          {previewBody || <span style={{ color: 'var(--io-text-muted)' }}>Alert body will appear here</span>}
        </p>
        <ChannelChips channels={channels} />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Active alerts panel (last 24h, emergency + critical)
// ---------------------------------------------------------------------------

function ActiveAlertsPanel() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const canSend = usePermission('alerts:send')
  const [cancelConfirmId, setCancelConfirmId] = useState<string | null>(null)

  const { data: activeResult, isLoading } = useQuery({
    queryKey: ['notification-active'],
    queryFn: () => notificationsApi.getActive(),
    // Fallback polling — WS subscription below handles real-time updates.
    refetchInterval: 120_000,
  })

  // Subscribe to delivery status changes via WebSocket for real-time updates.
  useEffect(() => {
    return wsManager.onNotificationStatusChanged(() => {
      void qc.invalidateQueries({ queryKey: ['notification-active'] })
    })
  }, [qc])

  const resolveMutation = useMutation({
    mutationFn: (id: string) => notificationsApi.resolveMessage(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notification-active'] })
    },
  })

  const cancelMutation = useMutation({
    mutationFn: (id: string) => notificationsApi.cancelMessage(id),
    onSuccess: () => {
      setCancelConfirmId(null)
      qc.invalidateQueries({ queryKey: ['notification-active'] })
    },
  })

  const messages: NotificationMessage[] = (activeResult?.success && activeResult.data) ? activeResult.data : []

  if (isLoading) {
    return <p style={{ color: 'var(--io-text-muted)', fontSize: 14 }}>Loading active alerts…</p>
  }

  if (messages.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--io-text-muted)' }}>
        <p style={{ fontSize: 32, margin: '0 0 8px' }}>✓</p>
        <p style={{ fontSize: 14 }}>No active emergency or critical alerts in the last 24 hours.</p>
      </div>
    )
  }

  const cancelTarget = cancelConfirmId ? messages.find((m) => m.id === cancelConfirmId) : null

  return (
    <>
      {cancelConfirmId && cancelTarget && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
        >
          <div
            style={{
              background: 'var(--io-surface)',
              border: '1px solid var(--io-border)',
              borderRadius: 8,
              padding: 24,
              width: 400,
              maxWidth: '90vw',
            }}
          >
            <h3 style={{ margin: '0 0 8px', color: '#ef4444', fontSize: 16 }}>Cancel Alert</h3>
            <p style={{ margin: '0 0 4px', fontSize: 14, color: 'var(--io-text)', fontWeight: 600 }}>{cancelTarget.title}</p>
            <p style={{ margin: '0 0 20px', color: 'var(--io-text-secondary)', fontSize: 14 }}>
              This will stop any escalation and remove the alert from the active list. This cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setCancelConfirmId(null)}
                style={{
                  padding: '8px 16px',
                  borderRadius: 6,
                  border: '1px solid var(--io-border)',
                  background: 'transparent',
                  color: 'var(--io-text)',
                  cursor: 'pointer',
                }}
              >
                Keep Active
              </button>
              <button
                onClick={() => cancelMutation.mutate(cancelConfirmId)}
                disabled={cancelMutation.isPending}
                style={{
                  padding: '8px 16px',
                  borderRadius: 6,
                  border: 'none',
                  background: '#ef4444',
                  color: '#fff',
                  fontWeight: 700,
                  cursor: cancelMutation.isPending ? 'not-allowed' : 'pointer',
                  opacity: cancelMutation.isPending ? 0.7 : 1,
                }}
              >
                {cancelMutation.isPending ? 'Cancelling…' : 'Cancel Alert'}
              </button>
            </div>
          </div>
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {messages.map((msg) => {
          const c = SEVERITY_COLORS[msg.severity as NotificationSeverity] ?? SEVERITY_COLORS.info
          const isResolving = resolveMutation.isPending && resolveMutation.variables === msg.id
          return (
            <div
              key={msg.id}
              style={{
                background: c.bg,
                border: `1px solid ${c.border}`,
                borderRadius: 8,
                padding: 16,
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                gap: 16,
              }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <SeverityBadge severity={msg.severity as NotificationSeverity} />
                  <span style={{ fontSize: 12, color: 'var(--io-text-muted)' }}>
                    {new Date(msg.sent_at).toLocaleString()} by {msg.sent_by_name ?? msg.sent_by}
                  </span>
                </div>
                <h4 style={{ margin: '0 0 4px', fontSize: 14, color: 'var(--io-text)' }}>{msg.title}</h4>
                <p style={{ margin: '0 0 8px', fontSize: 13, color: 'var(--io-text-secondary)' }}>{msg.body}</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <ChannelChips channels={msg.channels} />
                  <span style={{ fontSize: 12, color: 'var(--io-text-muted)' }}>
                    {msg.recipient_count} recipient{msg.recipient_count !== 1 ? 's' : ''}
                  </span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6, flexShrink: 0, alignItems: 'flex-start' }}>
                <button
                  onClick={() => navigate(`/alerts/muster/${msg.id}`)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: 6,
                    border: `1px solid ${c.border}`,
                    background: 'transparent',
                    color: c.text,
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  Muster
                </button>
                {canSend && (
                  <>
                    <button
                      onClick={() => resolveMutation.mutate(msg.id)}
                      disabled={isResolving}
                      style={{
                        padding: '6px 12px',
                        borderRadius: 6,
                        border: '1px solid var(--io-border)',
                        background: 'transparent',
                        color: 'var(--io-text)',
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: isResolving ? 'not-allowed' : 'pointer',
                        whiteSpace: 'nowrap',
                        opacity: isResolving ? 0.6 : 1,
                      }}
                    >
                      {isResolving ? 'Resolving…' : 'Mark Resolved'}
                    </button>
                    <button
                      onClick={() => setCancelConfirmId(msg.id)}
                      style={{
                        padding: '6px 12px',
                        borderRadius: 6,
                        border: '1px solid #ef4444',
                        background: 'transparent',
                        color: '#ef4444',
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      Cancel
                    </button>
                  </>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </>
  )
}

// ---------------------------------------------------------------------------
// History panel
// ---------------------------------------------------------------------------

function HistoryPanel() {
  const [page, setPage] = useState(1)
  const [severity, setSeverity] = useState<NotificationSeverity | ''>('')
  const [exportDropdownOpen, setExportDropdownOpen] = useState(false)
  const [exportNotice, setExportNotice] = useState<string | null>(null)
  const canExport = usePermission('alerts:export')

  const { data: result, isLoading } = useQuery({
    queryKey: ['notification-messages', { page, severity: severity || undefined }],
    queryFn: () =>
      notificationsApi.listMessages({
        page,
        limit: 25,
        severity: severity ? (severity as NotificationSeverity) : undefined,
      }),
  })

  // The backend returns a paginated envelope: { success, data: NotificationMessage[], pagination }
  // The API client detects the pagination field and wraps the payload as PaginatedResult:
  // { data: NotificationMessage[], pagination: { total, pages, ... } }
  // So result.data is that PaginatedResult object, not the raw array.
  type HistoryData = { data: NotificationMessage[]; pagination: { total: number; pages: number } }
  const pagedData = (result?.success && result.data) ? (result.data as unknown as HistoryData) : null
  const messages: NotificationMessage[] = Array.isArray(pagedData?.data) ? pagedData.data : []
  const pagination = pagedData?.pagination

  const handleExport = useCallback(async (format: ExportFormat) => {
    setExportDropdownOpen(false)
    setExportNotice(null)
    const filters: Record<string, unknown> = {}
    if (severity) filters['severity'] = severity
    try {
      const exportResult = await exportsApi.create({
        module: 'alerts',
        entity: 'history',
        format,
        scope: 'filtered',
        columns: ['severity', 'title', 'channels', 'recipient_count', 'sent_by', 'sent_at'],
        filters,
      })
      if (exportResult.type === 'download') {
        exportsApi.triggerDownload(exportResult.blob, historyExportFilename(format))
      } else if (exportResult.type === 'queued') {
        setExportNotice(`Export queued (job ${exportResult.job.job_id}). You will be notified when it is ready.`)
      }
    } catch (err) {
      setExportNotice(err instanceof Error ? err.message : 'Export failed')
    }
  }, [severity])

  const thStyle: React.CSSProperties = {
    textAlign: 'left',
    padding: '8px 12px',
    fontSize: 11,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    color: 'var(--io-text-muted)',
    borderBottom: '1px solid var(--io-border)',
    whiteSpace: 'nowrap',
  }

  const tdStyle: React.CSSProperties = {
    padding: '10px 12px',
    fontSize: 13,
    borderBottom: '1px solid var(--io-border)',
    color: 'var(--io-text)',
    verticalAlign: 'middle',
  }

  return (
    <div>
      {/* Filters + Export */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <label style={{ fontSize: 13, color: 'var(--io-text-muted)' }}>Severity:</label>
          <select
            value={severity}
            onChange={(e) => { setSeverity(e.target.value as NotificationSeverity | ''); setPage(1) }}
            style={{
              padding: '6px 10px',
              borderRadius: 6,
              border: '1px solid var(--io-border)',
              background: 'var(--io-surface-secondary)',
              color: 'var(--io-text)',
              fontSize: 13,
            }}
          >
            <option value="">All severities</option>
            <option value="emergency">Emergency</option>
            <option value="critical">Critical</option>
            <option value="warning">Warning</option>
            <option value="info">Info</option>
          </select>
        </div>

        {canExport && (
          <div style={{ position: 'relative', display: 'inline-flex' }}>
            <button
              onClick={() => setExportDropdownOpen((v) => !v)}
              title="Export alert history"
              style={{
                background: 'transparent',
                border: '1px solid var(--io-border)',
                borderRadius: 6,
                padding: '6px 12px',
                cursor: 'pointer',
                fontSize: 13,
                color: 'var(--io-text)',
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                whiteSpace: 'nowrap',
              }}
            >
              Export
              <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
                <polygon points="2,3 8,3 5,7" />
              </svg>
            </button>
            {exportDropdownOpen && (
              <>
                <div
                  style={{ position: 'fixed', inset: 0, zIndex: 999 }}
                  onClick={() => setExportDropdownOpen(false)}
                />
                <div style={{
                  position: 'absolute', top: '100%', right: 0, zIndex: 1000,
                  background: 'var(--io-surface-elevated)', border: '1px solid var(--io-border)',
                  borderRadius: 6, boxShadow: '0 8px 24px rgba(0,0,0,0.3)', overflow: 'hidden',
                  minWidth: 140, marginTop: 4,
                }}>
                  {HISTORY_EXPORT_FORMATS.map(({ label, fmt }) => (
                    <button
                      key={fmt}
                      onClick={() => { void handleExport(fmt) }}
                      style={{
                        display: 'block', width: '100%', padding: '8px 14px',
                        background: 'none', border: 'none', textAlign: 'left',
                        cursor: 'pointer', fontSize: 13, color: 'var(--io-text)',
                      }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--io-surface-secondary)' }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'none' }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {exportNotice && (
        <div style={{
          marginBottom: 12, padding: '8px 12px', borderRadius: 6,
          background: 'rgba(74,158,255,0.1)', border: '1px solid var(--io-accent)',
          color: 'var(--io-text-secondary)', fontSize: 13,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <span>{exportNotice}</span>
          <button
            onClick={() => setExportNotice(null)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--io-text-muted)', fontSize: 16, lineHeight: 1 }}
          >
            ×
          </button>
        </div>
      )}

      {isLoading ? (
        <p style={{ color: 'var(--io-text-muted)', fontSize: 14 }}>Loading…</p>
      ) : messages.length === 0 ? (
        <p style={{ color: 'var(--io-text-muted)', fontSize: 14 }}>No messages found.</p>
      ) : (
        <>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={thStyle}>Severity</th>
                  <th style={thStyle}>Title</th>
                  <th style={thStyle}>Channels</th>
                  <th style={thStyle}>Recipients</th>
                  <th style={thStyle}>Sent By</th>
                  <th style={thStyle}>Sent At</th>
                </tr>
              </thead>
              <tbody>
                {messages.map((msg) => (
                  <tr
                    key={msg.id}
                    style={{ cursor: 'default' }}
                    onMouseEnter={(e) => ((e.currentTarget as HTMLTableRowElement).style.background = 'var(--io-surface-secondary)')}
                    onMouseLeave={(e) => ((e.currentTarget as HTMLTableRowElement).style.background = 'transparent')}
                  >
                    <td style={tdStyle}>
                      <SeverityBadge severity={msg.severity as NotificationSeverity} />
                    </td>
                    <td style={{ ...tdStyle, maxWidth: 280 }}>
                      <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {msg.title}
                      </span>
                    </td>
                    <td style={tdStyle}>
                      <ChannelChips channels={msg.channels} />
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}>{msg.recipient_count}</td>
                    <td style={tdStyle}>{msg.sent_by_name ?? msg.sent_by}</td>
                    <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>
                      {new Date(msg.sent_at).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {pagination && pagination.pages > 1 && (
            <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'flex-end', alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: 'var(--io-text-muted)' }}>
                Page {page} of {pagination.pages} ({pagination.total} total)
              </span>
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                style={{
                  padding: '4px 10px',
                  borderRadius: 4,
                  border: '1px solid var(--io-border)',
                  background: 'var(--io-surface-secondary)',
                  color: 'var(--io-text)',
                  cursor: page === 1 ? 'not-allowed' : 'pointer',
                  opacity: page === 1 ? 0.4 : 1,
                  fontSize: 12,
                }}
              >
                Previous
              </button>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={page >= pagination.pages}
                style={{
                  padding: '4px 10px',
                  borderRadius: 4,
                  border: '1px solid var(--io-border)',
                  background: 'var(--io-surface-secondary)',
                  color: 'var(--io-text)',
                  cursor: page >= pagination.pages ? 'not-allowed' : 'pointer',
                  opacity: page >= pagination.pages ? 0.4 : 1,
                  fontSize: 12,
                }}
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Templates management panel
// ---------------------------------------------------------------------------

function TemplatesPanel() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [showCreate, setShowCreate] = useState(false)
  const [createForm, setCreateForm] = useState<Partial<CreateTemplatePayload>>({})
  const [varDefs, setVarDefs] = useState<TemplateVariable[]>([])
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [testSendPendingId, setTestSendPendingId] = useState<string | null>(null)

  const { data: result, isLoading } = useQuery({
    queryKey: ['notification-templates'],
    queryFn: () => notificationsApi.listTemplates(),
  })

  const templates: NotificationTemplate[] = (result?.success && result.data) ? result.data : []
  const deleteTarget = deleteConfirmId ? templates.find((t) => t.id === deleteConfirmId) : null

  const createMutation = useMutation({
    mutationFn: (payload: CreateTemplatePayload) => notificationsApi.createTemplate(payload),
    onSuccess: (res) => {
      if (res.success) {
        qc.invalidateQueries({ queryKey: ['notification-templates'] })
        setShowCreate(false)
        setCreateForm({})
        setVarDefs([])
      }
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => notificationsApi.deleteTemplate(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notification-templates'] })
      setDeleteConfirmId(null)
    },
  })

  const duplicateMutation = useMutation({
    mutationFn: (tpl: NotificationTemplate) =>
      notificationsApi.createTemplate({
        name: `${tpl.name} (Copy)`,
        category: tpl.category,
        severity: tpl.severity,
        title_template: tpl.title_template,
        body_template: tpl.body_template,
        channels: tpl.channels,
        variables: tpl.variables,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notification-templates'] }),
  })

  const testSendMutation = useMutation({
    mutationFn: (templateId: string) =>
      notificationsApi.sendNotification({ template_id: templateId }),
    onSuccess: () => {
      setTestSendPendingId(null)
      qc.invalidateQueries({ queryKey: ['notification-messages'] })
      qc.invalidateQueries({ queryKey: ['notification-active'] })
    },
    onError: () => setTestSendPendingId(null),
  })

  const toggleMutation = useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) =>
      notificationsApi.updateTemplate(id, { enabled }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notification-templates'] }),
  })

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '7px 10px',
    borderRadius: 6,
    border: '1px solid var(--io-border)',
    background: 'var(--io-surface-secondary)',
    color: 'var(--io-text)',
    fontSize: 13,
    boxSizing: 'border-box',
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h3 style={{ margin: 0, fontSize: 15 }}>Notification Templates</h3>
        <button
          onClick={() => setShowCreate(true)}
          style={{
            padding: '6px 14px',
            borderRadius: 6,
            border: '1px solid var(--io-accent)',
            background: 'var(--io-accent-subtle, rgba(74,158,255,0.15))',
            color: 'var(--io-accent, #4a9eff)',
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          + New Template
        </button>
      </div>

      {showCreate && (
        <div
          style={{
            background: 'var(--io-surface-secondary)',
            border: '1px solid var(--io-border)',
            borderRadius: 8,
            padding: 16,
            marginBottom: 16,
          }}
        >
          <h4 style={{ margin: '0 0 12px', fontSize: 14 }}>Create Template</h4>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
            <input
              placeholder="Template name *"
              value={createForm.name ?? ''}
              onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))}
              style={inputStyle}
            />
            <select
              value={createForm.severity ?? 'info'}
              onChange={(e) => setCreateForm((f) => ({ ...f, severity: e.target.value as NotificationSeverity }))}
              style={inputStyle}
            >
              <option value="emergency">Emergency</option>
              <option value="critical">Critical</option>
              <option value="warning">Warning</option>
              <option value="info">Info</option>
            </select>
            <input
              placeholder="Title template (use {{variable}})"
              value={createForm.title_template ?? ''}
              onChange={(e) => setCreateForm((f) => ({ ...f, title_template: e.target.value }))}
              style={{ ...inputStyle, gridColumn: '1 / -1' }}
            />
            <textarea
              placeholder="Body template (use {{variable}})"
              value={createForm.body_template ?? ''}
              onChange={(e) => setCreateForm((f) => ({ ...f, body_template: e.target.value }))}
              rows={3}
              style={{ ...inputStyle, gridColumn: '1 / -1', resize: 'vertical' }}
            />
          </div>
            {/* Variable definitions */}
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--io-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
              Variables
            </div>
            {varDefs.map((vd, idx) => (
              <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto auto auto', gap: 6, marginBottom: 6, alignItems: 'center' }}>
                <input
                  placeholder="name (e.g. location)"
                  value={vd.name}
                  onChange={(e) => setVarDefs((prev) => prev.map((x, i) => i === idx ? { ...x, name: e.target.value } : x))}
                  style={inputStyle}
                />
                <input
                  placeholder="label (e.g. Location)"
                  value={vd.label}
                  onChange={(e) => setVarDefs((prev) => prev.map((x, i) => i === idx ? { ...x, label: e.target.value } : x))}
                  style={inputStyle}
                />
                <input
                  placeholder="default"
                  value={vd.default_value ?? ''}
                  onChange={(e) => setVarDefs((prev) => prev.map((x, i) => i === idx ? { ...x, default_value: e.target.value || undefined } : x))}
                  style={{ ...inputStyle, width: 90 }}
                />
                <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--io-text)', whiteSpace: 'nowrap', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={vd.required}
                    onChange={(e) => setVarDefs((prev) => prev.map((x, i) => i === idx ? { ...x, required: e.target.checked } : x))}
                  />
                  Required
                </label>
                <button
                  type="button"
                  onClick={() => setVarDefs((prev) => prev.filter((_, i) => i !== idx))}
                  style={{ padding: '4px 8px', borderRadius: 4, border: '1px solid var(--io-border)', background: 'transparent', color: '#ef4444', fontSize: 12, cursor: 'pointer' }}
                >
                  Remove
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => setVarDefs((prev) => [...prev, { name: '', label: '', required: false }])}
              style={{ padding: '4px 10px', borderRadius: 4, border: '1px dashed var(--io-border)', background: 'transparent', color: 'var(--io-text-muted)', fontSize: 12, cursor: 'pointer' }}
            >
              + Add Variable
            </button>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => {
                if (createForm.name && createForm.title_template && createForm.body_template) {
                  createMutation.mutate({ ...(createForm as CreateTemplatePayload), variables: varDefs.filter(v => v.name.trim()) })
                }
              }}
              disabled={createMutation.isPending}
              style={{
                padding: '6px 14px',
                borderRadius: 6,
                border: 'none',
                background: 'var(--io-accent, #4a9eff)',
                color: '#fff',
                fontWeight: 600,
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              {createMutation.isPending ? 'Creating…' : 'Create'}
            </button>
            <button
              onClick={() => { setShowCreate(false); setCreateForm({}); setVarDefs([]) }}
              style={{
                padding: '6px 14px',
                borderRadius: 6,
                border: '1px solid var(--io-border)',
                background: 'transparent',
                color: 'var(--io-text)',
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {deleteTarget && (
        <ConfirmDeleteDialog
          title={`Delete template "${deleteTarget.name}"?`}
          message="This template will be permanently removed. This action cannot be undone."
          onConfirm={() => deleteMutation.mutate(deleteTarget.id)}
          onCancel={() => setDeleteConfirmId(null)}
        />
      )}

      {isLoading ? (
        <p style={{ color: 'var(--io-text-muted)', fontSize: 14 }}>Loading…</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {templates.map((tpl) => (
            <ContextMenuPrimitive.Root key={tpl.id}>
              <ContextMenuPrimitive.Trigger asChild>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '10px 14px',
                    borderRadius: 6,
                    border: '1px solid var(--io-border)',
                    background: tpl.enabled ? 'var(--io-surface-secondary)' : 'transparent',
                    opacity: tpl.enabled ? 1 : 0.5,
                    cursor: 'default',
                  }}
                >
                  <SeverityBadge severity={tpl.severity} />
                  <div style={{ flex: 1 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--io-text)' }}>
                      {tpl.name}
                      {tpl.is_system && (
                        <span style={{ marginLeft: 6, fontSize: 10, color: 'var(--io-text-muted)' }}>SYSTEM</span>
                      )}
                    </span>
                    <br />
                    <span style={{ fontSize: 11, color: 'var(--io-text-muted)' }}>{tpl.title_template}</span>
                  </div>
                  <ChannelChips channels={tpl.channels} />
                  <button
                    onClick={() => toggleMutation.mutate({ id: tpl.id, enabled: !tpl.enabled })}
                    style={{
                      fontSize: 11,
                      padding: '3px 8px',
                      borderRadius: 4,
                      border: '1px solid var(--io-border)',
                      background: 'transparent',
                      color: tpl.enabled ? '#22c55e' : 'var(--io-text-muted)',
                      cursor: 'pointer',
                    }}
                  >
                    {tpl.enabled ? 'Enabled' : 'Disabled'}
                  </button>
                  {!tpl.is_system && (
                    <button
                      onClick={() => setDeleteConfirmId(tpl.id)}
                      style={{
                        fontSize: 11,
                        padding: '3px 8px',
                        borderRadius: 4,
                        border: '1px solid var(--io-border)',
                        background: 'transparent',
                        color: '#ef4444',
                        cursor: 'pointer',
                      }}
                    >
                      Delete
                    </button>
                  )}
                </div>
              </ContextMenuPrimitive.Trigger>

              <ContextMenuPrimitive.Portal>
                <ContextMenuPrimitive.Content style={ctxMenuContentStyle}>
                  <style>{`
                    @keyframes io-context-menu-in {
                      from { opacity: 0; transform: scale(0.97) translateY(-3px); }
                      to   { opacity: 1; transform: scale(1) translateY(0); }
                    }
                    [data-radix-context-menu-item]:hover,
                    [data-radix-context-menu-item][data-highlighted] {
                      background: var(--io-accent-subtle, rgba(74,158,255,0.12)) !important;
                      outline: none;
                    }
                    [data-radix-context-menu-item][data-disabled] {
                      pointer-events: none;
                    }
                  `}</style>

                  {/* Primary: Edit */}
                  <ContextMenuPrimitive.Item
                    style={ctxMenuItemStyle}
                    onSelect={() => setShowCreate(true)}
                  >
                    Edit
                  </ContextMenuPrimitive.Item>

                  {/* Secondary: Duplicate */}
                  <ContextMenuPrimitive.Item
                    style={ctxMenuItemStyle}
                    onSelect={() => duplicateMutation.mutate(tpl)}
                  >
                    Duplicate
                  </ContextMenuPrimitive.Item>

                  {/* Secondary: Send Alert from Template */}
                  <ContextMenuPrimitive.Item
                    style={ctxMenuItemStyle}
                    onSelect={() => navigate(`/alerts?template=${tpl.id}`)}
                  >
                    Send Alert from Template
                  </ContextMenuPrimitive.Item>

                  {/* Secondary: Test Send */}
                  <ContextMenuPrimitive.Item
                    style={ctxMenuItemStyle}
                    onSelect={() => {
                      setTestSendPendingId(tpl.id)
                      testSendMutation.mutate(tpl.id)
                    }}
                    disabled={testSendPendingId === tpl.id}
                  >
                    {testSendPendingId === tpl.id ? 'Sending…' : 'Test Send (to self)'}
                  </ContextMenuPrimitive.Item>

                  {/* Separator */}
                  <ContextMenuPrimitive.Separator style={ctxMenuSeparatorStyle} />

                  {/* Destructive: Delete */}
                  <ContextMenuPrimitive.Item
                    style={tpl.is_system ? ctxMenuItemDisabledStyle : ctxMenuItemDestructiveStyle}
                    onSelect={() => {
                      if (!tpl.is_system) setDeleteConfirmId(tpl.id)
                    }}
                    disabled={tpl.is_system}
                    title={tpl.is_system ? 'System templates cannot be deleted' : undefined}
                  >
                    Delete{tpl.is_system ? ' (built-in)' : ''}
                  </ContextMenuPrimitive.Item>
                </ContextMenuPrimitive.Content>
              </ContextMenuPrimitive.Portal>
            </ContextMenuPrimitive.Root>
          ))}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Groups management panel
// ---------------------------------------------------------------------------

function GroupsPanel() {
  const qc = useQueryClient()
  const [showCreate, setShowCreate] = useState(false)
  const [createName, setCreateName] = useState('')
  const [createDesc, setCreateDesc] = useState('')
  const [deleteGroupId, setDeleteGroupId] = useState<string | null>(null)
  const [editGroupId, setEditGroupId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editDesc, setEditDesc] = useState('')
  const [viewMembersGroupId, setViewMembersGroupId] = useState<string | null>(null)

  const { data: result, isLoading } = useQuery({
    queryKey: ['notification-groups'],
    queryFn: () => notificationsApi.listGroups(),
  })

  const groups: NotificationGroup[] = (result?.success && result.data) ? result.data : []
  const deleteGroupTarget = deleteGroupId ? groups.find((g) => g.id === deleteGroupId) : null
  const editGroupTarget = editGroupId ? groups.find((g) => g.id === editGroupId) : null
  const viewMembersTarget = viewMembersGroupId ? groups.find((g) => g.id === viewMembersGroupId) : null

  const createMutation = useMutation({
    mutationFn: (payload: CreateGroupPayload) => notificationsApi.createGroup(payload),
    onSuccess: (res) => {
      if (res.success) {
        qc.invalidateQueries({ queryKey: ['notification-groups'] })
        setShowCreate(false)
        setCreateName('')
        setCreateDesc('')
      }
    },
  })

  const updateGroupMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateGroupPayload }) =>
      notificationsApi.updateGroup(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notification-groups'] })
      setEditGroupId(null)
      setEditName('')
      setEditDesc('')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => notificationsApi.deleteGroup(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notification-groups'] })
      setDeleteGroupId(null)
    },
  })

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '7px 10px',
    borderRadius: 6,
    border: '1px solid var(--io-border)',
    background: 'var(--io-surface-secondary)',
    color: 'var(--io-text)',
    fontSize: 13,
    boxSizing: 'border-box',
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h3 style={{ margin: 0, fontSize: 15 }}>Notification Groups</h3>
        <button
          onClick={() => setShowCreate(true)}
          style={{
            padding: '6px 14px',
            borderRadius: 6,
            border: '1px solid var(--io-accent)',
            background: 'var(--io-accent-subtle, rgba(74,158,255,0.15))',
            color: 'var(--io-accent, #4a9eff)',
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          + New Group
        </button>
      </div>

      {showCreate && (
        <div
          style={{
            background: 'var(--io-surface-secondary)',
            border: '1px solid var(--io-border)',
            borderRadius: 8,
            padding: 16,
            marginBottom: 16,
          }}
        >
          <h4 style={{ margin: '0 0 12px', fontSize: 14 }}>Create Group</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 10 }}>
            <input
              placeholder="Group name *"
              value={createName}
              onChange={(e) => setCreateName(e.target.value)}
              style={inputStyle}
            />
            <input
              placeholder="Description (optional)"
              value={createDesc}
              onChange={(e) => setCreateDesc(e.target.value)}
              style={inputStyle}
            />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => {
                if (createName.trim()) {
                  createMutation.mutate({ name: createName.trim(), description: createDesc || undefined })
                }
              }}
              disabled={createMutation.isPending}
              style={{
                padding: '6px 14px',
                borderRadius: 6,
                border: 'none',
                background: 'var(--io-accent, #4a9eff)',
                color: '#fff',
                fontWeight: 600,
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              {createMutation.isPending ? 'Creating…' : 'Create'}
            </button>
            <button
              onClick={() => { setShowCreate(false); setCreateName(''); setCreateDesc('') }}
              style={{
                padding: '6px 14px',
                borderRadius: 6,
                border: '1px solid var(--io-border)',
                background: 'transparent',
                color: 'var(--io-text)',
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {deleteGroupTarget && (
        <ConfirmDeleteDialog
          title={`Delete group "${deleteGroupTarget.name}"?`}
          message="All members will be removed and this group will be unlinked from any templates. This action cannot be undone."
          onConfirm={() => deleteMutation.mutate(deleteGroupTarget.id)}
          onCancel={() => setDeleteGroupId(null)}
        />
      )}

      {editGroupTarget && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2000,
          }}
        >
          <div
            style={{
              background: 'var(--io-surface)',
              border: '1px solid var(--io-border)',
              borderRadius: 8,
              padding: 24,
              width: 400,
              maxWidth: '90vw',
            }}
          >
            <h3 style={{ margin: '0 0 16px', fontSize: 16, color: 'var(--io-text)' }}>Edit Group</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
              <input
                placeholder="Group name *"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                style={{
                  width: '100%',
                  padding: '7px 10px',
                  borderRadius: 6,
                  border: '1px solid var(--io-border)',
                  background: 'var(--io-surface-secondary)',
                  color: 'var(--io-text)',
                  fontSize: 13,
                  boxSizing: 'border-box',
                }}
              />
              <input
                placeholder="Description (optional)"
                value={editDesc}
                onChange={(e) => setEditDesc(e.target.value)}
                style={{
                  width: '100%',
                  padding: '7px 10px',
                  borderRadius: 6,
                  border: '1px solid var(--io-border)',
                  background: 'var(--io-surface-secondary)',
                  color: 'var(--io-text)',
                  fontSize: 13,
                  boxSizing: 'border-box',
                }}
              />
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                onClick={() => { setEditGroupId(null); setEditName(''); setEditDesc('') }}
                style={{
                  padding: '8px 16px',
                  borderRadius: 6,
                  border: '1px solid var(--io-border)',
                  background: 'transparent',
                  color: 'var(--io-text)',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (editName.trim()) {
                    updateGroupMutation.mutate({
                      id: editGroupTarget.id,
                      payload: { name: editName.trim(), description: editDesc || undefined },
                    })
                  }
                }}
                disabled={updateGroupMutation.isPending}
                style={{
                  padding: '8px 16px',
                  borderRadius: 6,
                  border: 'none',
                  background: 'var(--io-accent, #4a9eff)',
                  color: '#fff',
                  fontWeight: 700,
                  cursor: updateGroupMutation.isPending ? 'not-allowed' : 'pointer',
                  opacity: updateGroupMutation.isPending ? 0.7 : 1,
                }}
              >
                {updateGroupMutation.isPending ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {viewMembersTarget && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2000,
          }}
        >
          <div
            style={{
              background: 'var(--io-surface)',
              border: '1px solid var(--io-border)',
              borderRadius: 8,
              padding: 24,
              width: 480,
              maxWidth: '90vw',
              maxHeight: '70vh',
              overflow: 'auto',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 16, color: 'var(--io-text)' }}>
                Members — {viewMembersTarget.name}
              </h3>
              <button
                onClick={() => setViewMembersGroupId(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--io-text-muted)',
                  fontSize: 20,
                  lineHeight: 1,
                  padding: '0 4px',
                }}
              >
                ×
              </button>
            </div>
            {viewMembersTarget.members && viewMembersTarget.members.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {viewMembersTarget.members.map((m) => (
                  <div
                    key={m.id}
                    style={{
                      padding: '8px 10px',
                      borderRadius: 6,
                      border: '1px solid var(--io-border)',
                      background: 'var(--io-surface-secondary)',
                      fontSize: 13,
                      color: 'var(--io-text)',
                    }}
                  >
                    {m.display_name ?? m.email ?? m.user_id}
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ color: 'var(--io-text-muted)', fontSize: 13, margin: 0 }}>
                {(viewMembersTarget.member_count ?? 0) > 0
                  ? `${viewMembersTarget.member_count} member(s) — load group detail to view.`
                  : 'No members in this group.'}
              </p>
            )}
          </div>
        </div>
      )}

      {isLoading ? (
        <p style={{ color: 'var(--io-text-muted)', fontSize: 14 }}>Loading…</p>
      ) : groups.length === 0 ? (
        <p style={{ color: 'var(--io-text-muted)', fontSize: 14 }}>No notification groups yet.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {groups.map((g) => (
            <ContextMenuPrimitive.Root key={g.id}>
              <ContextMenuPrimitive.Trigger asChild>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '10px 14px',
                    borderRadius: 6,
                    border: '1px solid var(--io-border)',
                    background: 'var(--io-surface-secondary)',
                    cursor: 'default',
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--io-text)' }}>{g.name}</span>
                    {g.description && (
                      <span style={{ fontSize: 12, color: 'var(--io-text-muted)', marginLeft: 8 }}>
                        {g.description}
                      </span>
                    )}
                  </div>
                  <span
                    style={{
                      fontSize: 11,
                      padding: '2px 6px',
                      borderRadius: 4,
                      background: 'var(--io-surface)',
                      color: 'var(--io-text-muted)',
                      border: '1px solid var(--io-border)',
                    }}
                  >
                    {g.group_type}
                  </span>
                  <span style={{ fontSize: 12, color: 'var(--io-text-muted)' }}>
                    {g.member_count ?? 0} members
                  </span>
                  <button
                    onClick={() => setDeleteGroupId(g.id)}
                    style={{
                      fontSize: 11,
                      padding: '3px 8px',
                      borderRadius: 4,
                      border: '1px solid var(--io-border)',
                      background: 'transparent',
                      color: '#ef4444',
                      cursor: 'pointer',
                    }}
                  >
                    Delete
                  </button>
                </div>
              </ContextMenuPrimitive.Trigger>

              <ContextMenuPrimitive.Portal>
                <ContextMenuPrimitive.Content style={ctxMenuContentStyle}>
                  {/* Primary: Edit */}
                  <ContextMenuPrimitive.Item
                    style={ctxMenuItemStyle}
                    onSelect={() => {
                      setEditGroupId(g.id)
                      setEditName(g.name)
                      setEditDesc(g.description ?? '')
                    }}
                  >
                    Edit
                  </ContextMenuPrimitive.Item>

                  {/* Secondary: Add Members */}
                  <ContextMenuPrimitive.Item
                    style={ctxMenuItemStyle}
                    onSelect={() => setShowCreate(true)}
                  >
                    Add Members
                  </ContextMenuPrimitive.Item>

                  {/* Secondary: View Members */}
                  <ContextMenuPrimitive.Item
                    style={ctxMenuItemStyle}
                    onSelect={() => setViewMembersGroupId(g.id)}
                  >
                    View Members
                  </ContextMenuPrimitive.Item>

                  {/* Separator */}
                  <ContextMenuPrimitive.Separator style={ctxMenuSeparatorStyle} />

                  {/* Destructive: Delete */}
                  <ContextMenuPrimitive.Item
                    style={ctxMenuItemDestructiveStyle}
                    onSelect={() => setDeleteGroupId(g.id)}
                  >
                    Delete
                  </ContextMenuPrimitive.Item>
                </ContextMenuPrimitive.Content>
              </ContextMenuPrimitive.Portal>
            </ContextMenuPrimitive.Root>
          ))}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Management panel (sub-tabs: Templates | Groups)
// ---------------------------------------------------------------------------

function ManagementPanel() {
  const [subTab, setSubTab] = useState<'templates' | 'groups'>('templates')

  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding: '6px 16px',
    borderRadius: 0,
    border: 'none',
    background: active ? 'var(--io-surface-secondary)' : 'transparent',
    color: active ? 'var(--io-text)' : 'var(--io-text-muted)',
    fontWeight: active ? 600 : 400,
    fontSize: 13,
    cursor: 'pointer',
    borderBottom: active ? '2px solid var(--io-accent, #4a9eff)' : '2px solid transparent',
  })

  return (
    <div>
      <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--io-border)', marginBottom: 20 }}>
        <button onClick={() => setSubTab('templates')} style={tabStyle(subTab === 'templates')}>
          Templates
        </button>
        <button onClick={() => setSubTab('groups')} style={tabStyle(subTab === 'groups')}>
          Groups
        </button>
      </div>
      {subTab === 'templates' ? <TemplatesPanel /> : <GroupsPanel />}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main AlertsPage
// ---------------------------------------------------------------------------

type AlertsTab = 'send' | 'active' | 'history' | 'management'

export default function AlertsPage() {
  const [activeTab, setActiveTab] = useState<AlertsTab>('send')

  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding: '8px 20px',
    border: 'none',
    background: 'transparent',
    color: active ? 'var(--io-text)' : 'var(--io-text-muted)',
    fontWeight: active ? 600 : 400,
    fontSize: 14,
    cursor: 'pointer',
    borderBottom: active ? '2px solid var(--io-accent, #4a9eff)' : '2px solid transparent',
    borderRadius: 0,
  })

  const TABS: { id: AlertsTab; label: string }[] = [
    { id: 'send', label: 'Send Alert' },
    { id: 'active', label: 'Active' },
    { id: 'history', label: 'History' },
    { id: 'management', label: 'Management' },
  ]

  return (
    <div style={{ padding: 24, maxWidth: 1100, margin: '0 auto' }}>
      {/* Page header */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ margin: '0 0 4px', fontSize: 22, fontWeight: 700, color: 'var(--io-text)' }}>
          Alerts
        </h1>
        <p style={{ margin: 0, fontSize: 14, color: 'var(--io-text-muted)' }}>
          Human-initiated emergency notifications and muster accountability
        </p>
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--io-border)', marginBottom: 24 }}>
        {TABS.map((tab) => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={tabStyle(activeTab === tab.id)}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'send' && <SendAlertPanel />}
      {activeTab === 'active' && <ActiveAlertsPanel />}
      {activeTab === 'history' && <HistoryPanel />}
      {activeTab === 'management' && <ManagementPanel />}
    </div>
  )
}
