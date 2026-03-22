import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { mfaApi, EnrollTotpResponse } from '../../api/mfa'

type EnrollStep = 'idle' | 'setup' | 'verify' | 'recovery'
type AdminTab = 'methods' | 'policies' | 'my-mfa'

// ── Stub types for admin-level MFA configuration ──────────────────────────────

interface MfaMethod {
  id: 'totp' | 'sms' | 'email'
  label: string
  description: string
  enabled: boolean
  warning?: string
}

interface RoleMfaPolicy {
  role_id: string
  role_name: string
  require_mfa: boolean
  allowed_methods: ('totp' | 'sms' | 'email')[]
  grace_period_hours: number
}

// ── Admin: Method Configuration tab ──────────────────────────────────────────

function MfaMethodsTab() {
  const [methods, setMethods] = useState<MfaMethod[]>([
    {
      id: 'totp',
      label: 'Authenticator App (TOTP)',
      description: 'Time-based one-time passwords via Google Authenticator, Authy, 1Password, etc.',
      enabled: true,
    },
    {
      id: 'sms',
      label: 'SMS / Text Message',
      description: 'One-time codes sent via SMS to the user\'s registered phone number.',
      enabled: false,
      warning: 'SMS-based MFA is less secure than TOTP. Ensure your SMS provider is configured in SMS Providers before enabling.',
    },
    {
      id: 'email',
      label: 'Email OTP',
      description: 'One-time codes sent to the user\'s verified email address.',
      enabled: false,
      warning: 'Email-based MFA is susceptible to email compromise. Use only as a fallback method.',
    },
  ])
  const [saving, setSaving] = useState<string | null>(null)

  const handleToggle = (id: MfaMethod['id']) => {
    const method = methods.find((m) => m.id === id)
    if (!method) return
    if (method.warning && !method.enabled) {
      if (!window.confirm(`${method.warning}\n\nEnable anyway?`)) return
    }
    if (method.enabled && !window.confirm(`Disable ${method.label}? Users currently using this method will be required to re-enroll with another method.`)) return
    setSaving(id)
    // Simulate API call — replace with actual API call when backend endpoint exists
    setTimeout(() => {
      setMethods((prev) =>
        prev.map((m) => (m.id === id ? { ...m, enabled: !m.enabled } : m))
      )
      setSaving(null)
    }, 600)
  }

  return (
    <div>
      <h4 style={{ margin: '0 0 4px', fontSize: '14px', fontWeight: 600, color: 'var(--io-text-primary)' }}>
        Global MFA Methods
      </h4>
      <p style={{ margin: '0 0 20px', fontSize: '13px', color: 'var(--io-text-secondary)' }}>
        Control which authentication methods are available system-wide. Disabling a method prevents
        new enrollments and may require users to switch methods.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {methods.map((method) => (
          <div
            key={method.id}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '16px',
              padding: '16px',
              borderRadius: 'var(--io-radius)',
              border: '1px solid var(--io-border)',
              background: 'var(--io-surface)',
            }}
          >
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--io-text-primary)' }}>
                  {method.label}
                </span>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 600,
                    padding: '2px 6px',
                    borderRadius: '4px',
                    background: method.enabled ? 'var(--io-success-subtle, #f0fdf4)' : 'var(--io-surface-secondary)',
                    color: method.enabled ? 'var(--io-success, #16a34a)' : 'var(--io-text-muted)',
                  }}
                >
                  {method.enabled ? 'Enabled' : 'Disabled'}
                </span>
              </div>
              <p style={{ margin: 0, fontSize: '12px', color: 'var(--io-text-secondary)' }}>
                {method.description}
              </p>
              {method.warning && (
                <p style={{ margin: '6px 0 0', fontSize: '12px', color: 'var(--io-warning, #d97706)' }}>
                  {method.warning}
                </p>
              )}
            </div>
            <button
              onClick={() => handleToggle(method.id)}
              disabled={saving === method.id}
              style={{
                flexShrink: 0,
                padding: '6px 14px',
                borderRadius: 'var(--io-radius)',
                border: method.enabled
                  ? '1px solid var(--io-error, #ef4444)'
                  : '1px solid var(--io-accent)',
                background: 'transparent',
                color: method.enabled ? 'var(--io-error, #ef4444)' : 'var(--io-accent)',
                fontSize: '13px',
                cursor: saving === method.id ? 'not-allowed' : 'pointer',
                opacity: saving === method.id ? 0.5 : 1,
              }}
            >
              {saving === method.id ? 'Saving…' : method.enabled ? 'Disable' : 'Enable'}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Admin: Per-Role MFA Policies tab ─────────────────────────────────────────

const STUB_POLICIES: RoleMfaPolicy[] = [
  { role_id: 'viewer', role_name: 'Viewer', require_mfa: false, allowed_methods: ['totp', 'sms', 'email'], grace_period_hours: 24 },
  { role_id: 'operator', role_name: 'Operator', require_mfa: true, allowed_methods: ['totp', 'sms'], grace_period_hours: 0 },
  { role_id: 'analyst', role_name: 'Analyst', require_mfa: false, allowed_methods: ['totp', 'sms', 'email'], grace_period_hours: 24 },
  { role_id: 'supervisor', role_name: 'Supervisor', require_mfa: true, allowed_methods: ['totp'], grace_period_hours: 0 },
  { role_id: 'content_manager', role_name: 'Content Manager', require_mfa: false, allowed_methods: ['totp', 'sms', 'email'], grace_period_hours: 24 },
  { role_id: 'maintenance', role_name: 'Maintenance', require_mfa: false, allowed_methods: ['totp', 'sms', 'email'], grace_period_hours: 24 },
  { role_id: 'contractor', role_name: 'Contractor', require_mfa: true, allowed_methods: ['totp'], grace_period_hours: 0 },
  { role_id: 'admin', role_name: 'Admin', require_mfa: true, allowed_methods: ['totp'], grace_period_hours: 0 },
]

const METHOD_LABELS: Record<string, string> = { totp: 'TOTP', sms: 'SMS', email: 'Email' }

function MfaPoliciesTab() {
  const [policies, setPolicies] = useState<RoleMfaPolicy[]>(STUB_POLICIES)
  const [saving, setSaving] = useState<string | null>(null)

  const handleRequireMfaToggle = (roleId: string, current: boolean) => {
    if (current && !window.confirm('Removing the MFA requirement for this role will allow users in this role to log in without MFA. Continue?')) return
    setSaving(roleId)
    setTimeout(() => {
      setPolicies((prev) =>
        prev.map((p) => (p.role_id === roleId ? { ...p, require_mfa: !current } : p))
      )
      setSaving(null)
    }, 500)
  }

  return (
    <div>
      <h4 style={{ margin: '0 0 4px', fontSize: '14px', fontWeight: 600, color: 'var(--io-text-primary)' }}>
        Per-Role MFA Policies
      </h4>
      <p style={{ margin: '0 0 20px', fontSize: '13px', color: 'var(--io-text-secondary)' }}>
        Configure whether each role requires MFA for login, which methods are permitted, and the
        grace period for new enrollments.
      </p>

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
        <thead>
          <tr>
            {['Role', 'Require MFA', 'Allowed Methods', 'Grace Period', ''].map((h) => (
              <th
                key={h}
                style={{
                  textAlign: 'left',
                  padding: '8px 12px',
                  borderBottom: '1px solid var(--io-border)',
                  fontSize: '11px',
                  fontWeight: 600,
                  color: 'var(--io-text-muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {policies.map((policy) => (
            <tr
              key={policy.role_id}
              style={{ borderBottom: '1px solid var(--io-border)' }}
            >
              <td style={{ padding: '10px 12px', fontWeight: 500, color: 'var(--io-text-primary)' }}>
                {policy.role_name}
              </td>
              <td style={{ padding: '10px 12px' }}>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 600,
                    padding: '2px 8px',
                    borderRadius: '4px',
                    background: policy.require_mfa ? 'var(--io-success-subtle, #f0fdf4)' : 'var(--io-surface-secondary)',
                    color: policy.require_mfa ? 'var(--io-success, #16a34a)' : 'var(--io-text-muted)',
                  }}
                >
                  {policy.require_mfa ? 'Required' : 'Optional'}
                </span>
              </td>
              <td style={{ padding: '10px 12px', color: 'var(--io-text-secondary)' }}>
                {policy.allowed_methods.map((m) => METHOD_LABELS[m] ?? m).join(', ')}
              </td>
              <td style={{ padding: '10px 12px', color: 'var(--io-text-secondary)' }}>
                {policy.grace_period_hours === 0 ? 'None' : `${policy.grace_period_hours}h`}
              </td>
              <td style={{ padding: '10px 12px' }}>
                <button
                  onClick={() => handleRequireMfaToggle(policy.role_id, policy.require_mfa)}
                  disabled={saving === policy.role_id}
                  style={{
                    padding: '4px 12px',
                    borderRadius: 'var(--io-radius)',
                    border: policy.require_mfa
                      ? '1px solid var(--io-error, #ef4444)'
                      : '1px solid var(--io-accent)',
                    background: 'transparent',
                    color: policy.require_mfa ? 'var(--io-error, #ef4444)' : 'var(--io-accent)',
                    fontSize: '12px',
                    cursor: saving === policy.role_id ? 'not-allowed' : 'pointer',
                    opacity: saving === policy.role_id ? 0.5 : 1,
                  }}
                >
                  {saving === policy.role_id ? '…' : policy.require_mfa ? 'Make Optional' : 'Require'}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── Personal MFA enrollment tab (original implementation) ────────────────────

function MyMfaTab() {
  const queryClient = useQueryClient()
  const [step, setStep] = useState<EnrollStep>('idle')
  const [enrollData, setEnrollData] = useState<EnrollTotpResponse | null>(null)
  const [totpCode, setTotpCode] = useState('')
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([])
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  const { data: statusResult, isLoading } = useQuery({
    queryKey: ['mfa-status'],
    queryFn: () => mfaApi.getStatus(),
  })

  const status = statusResult?.success ? statusResult.data : null

  const enrollMutation = useMutation({
    mutationFn: () => mfaApi.enrollTotp(),
    onSuccess: (result) => {
      if (result.success) {
        setEnrollData(result.data)
        setStep('setup')
        setError('')
      } else {
        setError(result.error.message)
      }
    },
  })

  const verifyMutation = useMutation({
    mutationFn: (code: string) => mfaApi.verifyEnrollment(code),
    onSuccess: (result) => {
      if (result.success) {
        setRecoveryCodes(result.data.recovery_codes)
        setStep('recovery')
        setTotpCode('')
        queryClient.invalidateQueries({ queryKey: ['mfa-status'] })
      } else {
        setError(result.error.message)
      }
    },
  })

  const disableMutation = useMutation({
    mutationFn: () => mfaApi.disableTotp(),
    onSuccess: (result) => {
      if (result.success) {
        queryClient.invalidateQueries({ queryKey: ['mfa-status'] })
      } else {
        setError(result.error.message)
      }
    },
  })

  const handleCopyRecoveryCodes = () => {
    navigator.clipboard.writeText(recoveryCodes.join('\n'))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleDoneRecovery = () => {
    setStep('idle')
    setEnrollData(null)
    setRecoveryCodes([])
  }

  if (isLoading) {
    return (
      <div style={{ color: 'var(--io-text-muted)', fontSize: '13px' }}>
        Loading MFA status…
      </div>
    )
  }

  return (
    <div>
      <h4
        style={{
          margin: '0 0 4px',
          fontSize: '14px',
          fontWeight: 600,
          color: 'var(--io-text-primary)',
        }}
      >
        Two-Factor Authentication
      </h4>
      <p style={{ margin: '0 0 20px', fontSize: '13px', color: 'var(--io-text-secondary)' }}>
        Protect your account with a time-based one-time password (TOTP) authenticator app.
      </p>

      {error && (
        <div
          style={{
            padding: '10px 14px',
            borderRadius: 'var(--io-radius)',
            background: 'var(--io-error-subtle, #fef2f2)',
            color: 'var(--io-error, #ef4444)',
            fontSize: '13px',
            marginBottom: '16px',
          }}
        >
          {error}
        </div>
      )}

      {/* ── Current status ── */}
      {step === 'idle' && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '14px 16px',
            borderRadius: 'var(--io-radius)',
            border: '1px solid var(--io-border)',
            background: 'var(--io-surface)',
            marginBottom: '16px',
          }}
        >
          <div
            style={{
              width: 10,
              height: 10,
              borderRadius: '50%',
              background: status?.enabled
                ? 'var(--io-success, #22c55e)'
                : 'var(--io-text-muted)',
              flexShrink: 0,
            }}
          />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--io-text-primary)' }}>
              TOTP Authenticator
            </div>
            <div style={{ fontSize: '12px', color: 'var(--io-text-muted)', marginTop: '2px' }}>
              {status?.enabled
                ? `Active${status.has_recovery_codes ? ' · recovery codes available' : ' · no recovery codes'}`
                : 'Not configured'}
            </div>
          </div>
          {status?.enabled ? (
            <button
              onClick={() => {
                if (window.confirm('Disable TOTP? You will no longer need a code to log in.')) {
                  disableMutation.mutate()
                }
              }}
              disabled={disableMutation.isPending}
              style={{
                padding: '6px 14px',
                borderRadius: 'var(--io-radius)',
                border: '1px solid var(--io-error, #ef4444)',
                background: 'transparent',
                color: 'var(--io-error, #ef4444)',
                fontSize: '13px',
                cursor: 'pointer',
              }}
            >
              {disableMutation.isPending ? 'Disabling…' : 'Disable TOTP'}
            </button>
          ) : (
            <button
              onClick={() => enrollMutation.mutate()}
              disabled={enrollMutation.isPending}
              style={{
                padding: '6px 14px',
                borderRadius: 'var(--io-radius)',
                border: 'none',
                background: 'var(--io-accent)',
                color: '#fff',
                fontSize: '13px',
                cursor: 'pointer',
              }}
            >
              {enrollMutation.isPending ? 'Starting…' : 'Enable TOTP'}
            </button>
          )}
        </div>
      )}

      {/* ── Step 1: Setup — show secret and instructions ── */}
      {step === 'setup' && enrollData && (
        <div
          style={{
            border: '1px solid var(--io-border)',
            borderRadius: 'var(--io-radius)',
            padding: '20px',
            background: 'var(--io-surface)',
          }}
        >
          <h4
            style={{
              margin: '0 0 12px',
              fontSize: '14px',
              fontWeight: 600,
              color: 'var(--io-text-primary)',
            }}
          >
            Step 1 — Add to your authenticator app
          </h4>
          <p style={{ margin: '0 0 12px', fontSize: '13px', color: 'var(--io-text-secondary)' }}>
            Open your authenticator app (Google Authenticator, Authy, 1Password, etc.) and add a
            new account. You can either tap the link below or enter the key manually.
          </p>

          <div style={{ marginBottom: '16px' }}>
            <a
              href={enrollData.otpauth_uri}
              style={{
                display: 'inline-block',
                padding: '8px 16px',
                borderRadius: 'var(--io-radius)',
                background: 'var(--io-accent)',
                color: '#fff',
                fontSize: '13px',
                textDecoration: 'none',
              }}
            >
              Open in Authenticator App
            </a>
          </div>

          <div
            style={{
              padding: '12px 14px',
              borderRadius: 'var(--io-radius)',
              background: 'var(--io-surface-secondary)',
              border: '1px solid var(--io-border)',
              marginBottom: '20px',
            }}
          >
            <div
              style={{
                fontSize: '11px',
                fontWeight: 600,
                color: 'var(--io-text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                marginBottom: '6px',
              }}
            >
              Manual Entry Key
            </div>
            <code
              style={{
                fontSize: '15px',
                letterSpacing: '0.12em',
                color: 'var(--io-text-primary)',
                fontFamily: 'var(--io-font-mono, monospace)',
                wordBreak: 'break-all',
              }}
            >
              {enrollData.manual_entry_key}
            </code>
          </div>

          <h4
            style={{
              margin: '0 0 10px',
              fontSize: '14px',
              fontWeight: 600,
              color: 'var(--io-text-primary)',
            }}
          >
            Step 2 — Enter the 6-digit code
          </h4>
          <p style={{ margin: '0 0 12px', fontSize: '13px', color: 'var(--io-text-secondary)' }}>
            Enter the code shown in your authenticator app to confirm setup.
          </p>

          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              placeholder="000000"
              value={totpCode}
              onChange={(e) => {
                setTotpCode(e.target.value.replace(/\D/g, ''))
                setError('')
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && totpCode.length === 6) {
                  verifyMutation.mutate(totpCode)
                }
              }}
              style={{
                padding: '8px 12px',
                borderRadius: 'var(--io-radius)',
                border: '1px solid var(--io-border)',
                background: 'var(--io-surface)',
                color: 'var(--io-text-primary)',
                fontSize: '18px',
                letterSpacing: '0.25em',
                width: '140px',
                textAlign: 'center',
              }}
            />
            <button
              onClick={() => verifyMutation.mutate(totpCode)}
              disabled={totpCode.length !== 6 || verifyMutation.isPending}
              style={{
                padding: '8px 20px',
                borderRadius: 'var(--io-radius)',
                border: 'none',
                background: 'var(--io-accent)',
                color: '#fff',
                fontSize: '13px',
                cursor: totpCode.length === 6 ? 'pointer' : 'not-allowed',
                opacity: totpCode.length === 6 ? 1 : 0.5,
              }}
            >
              {verifyMutation.isPending ? 'Verifying…' : 'Verify & Activate'}
            </button>
            <button
              onClick={() => {
                setStep('idle')
                setEnrollData(null)
                setTotpCode('')
                setError('')
              }}
              style={{
                padding: '8px 14px',
                borderRadius: 'var(--io-radius)',
                border: '1px solid var(--io-border)',
                background: 'transparent',
                color: 'var(--io-text-secondary)',
                fontSize: '13px',
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ── Step 2: Recovery codes ── */}
      {step === 'recovery' && recoveryCodes.length > 0 && (
        <div
          style={{
            border: '1px solid var(--io-border)',
            borderRadius: 'var(--io-radius)',
            padding: '20px',
            background: 'var(--io-surface)',
          }}
        >
          <h4
            style={{
              margin: '0 0 8px',
              fontSize: '14px',
              fontWeight: 600,
              color: 'var(--io-text-primary)',
            }}
          >
            TOTP Enabled — Save Your Recovery Codes
          </h4>
          <p
            style={{
              margin: '0 0 16px',
              fontSize: '13px',
              color: 'var(--io-text-secondary)',
              lineHeight: 1.5,
            }}
          >
            These 8 single-use codes let you access your account if you lose your authenticator
            device. Save them somewhere safe — you will not be able to view them again.
          </p>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: '8px',
              padding: '16px',
              background: 'var(--io-surface-secondary)',
              borderRadius: 'var(--io-radius)',
              border: '1px solid var(--io-border)',
              marginBottom: '16px',
            }}
          >
            {recoveryCodes.map((code) => (
              <code
                key={code}
                style={{
                  fontSize: '13px',
                  fontFamily: 'var(--io-font-mono, monospace)',
                  color: 'var(--io-text-primary)',
                  textAlign: 'center',
                  padding: '4px',
                }}
              >
                {code}
              </code>
            ))}
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={handleCopyRecoveryCodes}
              style={{
                padding: '8px 16px',
                borderRadius: 'var(--io-radius)',
                border: '1px solid var(--io-border)',
                background: 'transparent',
                color: 'var(--io-text-secondary)',
                fontSize: '13px',
                cursor: 'pointer',
              }}
            >
              {copied ? 'Copied!' : 'Copy All Codes'}
            </button>
            <button
              onClick={handleDoneRecovery}
              style={{
                padding: '8px 20px',
                borderRadius: 'var(--io-radius)',
                border: 'none',
                background: 'var(--io-accent)',
                color: '#fff',
                fontSize: '13px',
                cursor: 'pointer',
              }}
            >
              I have saved my codes
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main export: tabbed MFA Settings page ─────────────────────────────────────

export default function MfaSettings() {
  const [activeTab, setActiveTab] = useState<AdminTab>('methods')

  const tabs: { id: AdminTab; label: string }[] = [
    { id: 'methods', label: 'Global Methods' },
    { id: 'policies', label: 'Per-Role Policies' },
    { id: 'my-mfa', label: 'My MFA' },
  ]

  return (
    <div>
      <h3
        style={{
          margin: '0 0 4px',
          fontSize: '15px',
          fontWeight: 600,
          color: 'var(--io-text-primary)',
        }}
      >
        MFA Configuration
      </h3>
      <p style={{ margin: '0 0 20px', fontSize: '13px', color: 'var(--io-text-secondary)' }}>
        Configure system-wide MFA methods, per-role policies, and your personal MFA enrollment.
      </p>

      {/* Tab bar */}
      <div
        style={{
          display: 'flex',
          gap: '2px',
          borderBottom: '1px solid var(--io-border)',
          marginBottom: '24px',
        }}
      >
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '8px 16px',
              border: 'none',
              borderBottom: activeTab === tab.id ? '2px solid var(--io-accent)' : '2px solid transparent',
              background: 'transparent',
              color: activeTab === tab.id ? 'var(--io-accent)' : 'var(--io-text-secondary)',
              fontSize: '13px',
              fontWeight: activeTab === tab.id ? 600 : 400,
              cursor: 'pointer',
              marginBottom: '-1px',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'methods' && <MfaMethodsTab />}
      {activeTab === 'policies' && <MfaPoliciesTab />}
      {activeTab === 'my-mfa' && <MyMfaTab />}
    </div>
  )
}
