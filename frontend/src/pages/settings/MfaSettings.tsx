import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { mfaApi, EnrollTotpResponse } from '../../api/mfa'

type EnrollStep = 'idle' | 'setup' | 'verify' | 'recovery'

export default function MfaSettings() {
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
      <h3
        style={{
          margin: '0 0 4px',
          fontSize: '15px',
          fontWeight: 600,
          color: 'var(--io-text-primary)',
        }}
      >
        Two-Factor Authentication
      </h3>
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
