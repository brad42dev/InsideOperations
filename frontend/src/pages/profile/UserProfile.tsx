import { useState } from 'react'
import { useAuthStore } from '../../store/auth'
import { useUiStore } from '../../store/ui'
import { authApi } from '../../api/auth'
import { showToast } from '../../shared/components/Toast'

// ---------------------------------------------------------------------------
// UserProfile page — /profile
// Allows users to view basic account info and manage their lock screen PIN.
// ---------------------------------------------------------------------------

function PinSetupSection({
  authProvider,
}: {
  authProvider: 'local' | 'oidc' | 'saml' | 'ldap' | null
}) {
  const isLocalAccount = !authProvider || authProvider === 'local'

  const [mode, setMode] = useState<'idle' | 'set' | 'remove'>('idle')
  const [pin, setPin] = useState('')
  const [pinConfirm, setPinConfirm] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function resetForm() {
    setPin('')
    setPinConfirm('')
    setCurrentPassword('')
    setError(null)
    setMode('idle')
  }

  async function handleSetPin(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!/^\d{6}$/.test(pin)) {
      setError('PIN must be exactly 6 numeric digits.')
      return
    }
    if (pin !== pinConfirm) {
      setError('PINs do not match.')
      return
    }

    setSubmitting(true)
    try {
      const result = await authApi.setPin(pin, currentPassword)
      if (!result.success) {
        const msg = (result.error as { message?: string }).message
        if (msg?.includes('invalid_password') || msg?.includes('incorrect')) {
          setError('Current password is incorrect.')
        } else if (msg?.includes('validation') || msg?.includes('6 numeric')) {
          setError('PIN must be exactly 6 numeric digits.')
        } else {
          setError(result.error.message ?? 'Failed to set PIN. Please try again.')
        }
        return
      }
      showToast({ title: 'PIN set successfully.', variant: 'success' })
      // Update lockMeta so the lock screen immediately offers PIN entry
      // without requiring a page reload.
      useUiStore.getState().setLockMeta({ hasPin: true })
      resetForm()
    } finally {
      setSubmitting(false)
    }
  }

  async function handleRemovePin(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const result = await authApi.deletePin(currentPassword)
      if (!result.success) {
        const msg = (result.error as { message?: string }).message
        if (msg?.includes('invalid_password') || msg?.includes('incorrect')) {
          setError('Current password is incorrect.')
        } else {
          setError(result.error.message ?? 'Failed to remove PIN. Please try again.')
        }
        return
      }
      showToast({ title: 'PIN removed successfully.', variant: 'success' })
      // Update lockMeta so the lock screen immediately drops PIN entry
      // without requiring a page reload.
      useUiStore.getState().setLockMeta({ hasPin: false })
      resetForm()
    } finally {
      setSubmitting(false)
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '8px 10px',
    border: '1px solid var(--io-border)',
    borderRadius: 'var(--io-radius)',
    background: 'var(--io-surface-primary)',
    color: 'var(--io-text-primary)',
    fontSize: '13px',
    boxSizing: 'border-box',
  }

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: '12px',
    fontWeight: 500,
    color: 'var(--io-text-muted)',
    marginBottom: '4px',
  }

  const fieldStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  }

  return (
    <div
      style={{
        border: '1px solid var(--io-border)',
        borderRadius: 'var(--io-radius)',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '14px 16px',
          borderBottom: mode !== 'idle' ? '1px solid var(--io-border)' : undefined,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div>
          <div
            style={{
              fontSize: '13px',
              fontWeight: 600,
              color: 'var(--io-text-primary)',
            }}
          >
            Lock Screen PIN
          </div>
          <div
            style={{
              fontSize: '12px',
              color: 'var(--io-text-muted)',
              marginTop: '2px',
            }}
          >
            Set a 6-digit PIN as an alternative to your password on the lock screen.
          </div>
        </div>

        {mode === 'idle' && (
          <div style={{ display: 'flex', gap: '8px', flexShrink: 0, marginLeft: '16px' }}>
            <button
              onClick={() => setMode('set')}
              style={{
                padding: '6px 12px',
                borderRadius: 'var(--io-radius)',
                border: '1px solid var(--io-accent)',
                background: 'var(--io-accent-subtle)',
                color: 'var(--io-accent)',
                fontSize: '12px',
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              Set PIN
            </button>
            <button
              onClick={() => setMode('remove')}
              style={{
                padding: '6px 12px',
                borderRadius: 'var(--io-radius)',
                border: '1px solid var(--io-border)',
                background: 'transparent',
                color: 'var(--io-text-secondary)',
                fontSize: '12px',
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              Remove PIN
            </button>
          </div>
        )}
      </div>

      {/* Set PIN form */}
      {mode === 'set' && (
        <form onSubmit={handleSetPin} style={{ padding: '16px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={fieldStyle}>
              <label style={labelStyle} htmlFor="new-pin">
                New PIN (6 digits)
              </label>
              <input
                id="new-pin"
                type="password"
                inputMode="numeric"
                pattern="\d{6}"
                maxLength={6}
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="Enter 6-digit PIN"
                style={inputStyle}
                autoComplete="new-password"
                required
              />
            </div>

            <div style={fieldStyle}>
              <label style={labelStyle} htmlFor="confirm-pin">
                Confirm PIN
              </label>
              <input
                id="confirm-pin"
                type="password"
                inputMode="numeric"
                pattern="\d{6}"
                maxLength={6}
                value={pinConfirm}
                onChange={(e) =>
                  setPinConfirm(e.target.value.replace(/\D/g, '').slice(0, 6))
                }
                placeholder="Re-enter PIN"
                style={inputStyle}
                autoComplete="new-password"
                required
              />
            </div>

            {isLocalAccount && (
              <div style={fieldStyle}>
                <label style={labelStyle} htmlFor="current-password-set">
                  Current Password (required to set PIN)
                </label>
                <input
                  id="current-password-set"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Enter your current password"
                  style={inputStyle}
                  autoComplete="current-password"
                  required
                />
              </div>
            )}

            {error && (
              <div
                role="alert"
                style={{
                  fontSize: '12px',
                  color: 'var(--io-error)',
                  padding: '8px 10px',
                  background: 'var(--io-error-subtle, rgba(220,38,38,0.08))',
                  borderRadius: 'var(--io-radius)',
                  border: '1px solid var(--io-error-border, rgba(220,38,38,0.25))',
                }}
              >
                {error}
              </div>
            )}

            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={resetForm}
                disabled={submitting}
                style={{
                  padding: '7px 14px',
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
              <button
                type="submit"
                disabled={submitting}
                style={{
                  padding: '7px 14px',
                  borderRadius: 'var(--io-radius)',
                  border: 'none',
                  background: 'var(--io-accent)',
                  color: '#fff',
                  fontSize: '13px',
                  fontWeight: 500,
                  cursor: submitting ? 'not-allowed' : 'pointer',
                  opacity: submitting ? 0.7 : 1,
                }}
              >
                {submitting ? 'Saving...' : 'Save PIN'}
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Remove PIN form */}
      {mode === 'remove' && (
        <form onSubmit={handleRemovePin} style={{ padding: '16px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div
              style={{
                fontSize: '13px',
                color: 'var(--io-text-secondary)',
              }}
            >
              This will remove your lock screen PIN. You will need your password to unlock the
              session.
            </div>

            {isLocalAccount && (
              <div style={fieldStyle}>
                <label style={labelStyle} htmlFor="current-password-remove">
                  Current Password (required to remove PIN)
                </label>
                <input
                  id="current-password-remove"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Enter your current password"
                  style={inputStyle}
                  autoComplete="current-password"
                  required
                />
              </div>
            )}

            {error && (
              <div
                role="alert"
                style={{
                  fontSize: '12px',
                  color: 'var(--io-error)',
                  padding: '8px 10px',
                  background: 'var(--io-error-subtle, rgba(220,38,38,0.08))',
                  borderRadius: 'var(--io-radius)',
                  border: '1px solid var(--io-error-border, rgba(220,38,38,0.25))',
                }}
              >
                {error}
              </div>
            )}

            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={resetForm}
                disabled={submitting}
                style={{
                  padding: '7px 14px',
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
              <button
                type="submit"
                disabled={submitting}
                style={{
                  padding: '7px 14px',
                  borderRadius: 'var(--io-radius)',
                  border: 'none',
                  background: 'var(--io-error, #dc2626)',
                  color: '#fff',
                  fontSize: '13px',
                  fontWeight: 500,
                  cursor: submitting ? 'not-allowed' : 'pointer',
                  opacity: submitting ? 0.7 : 1,
                }}
              >
                {submitting ? 'Removing...' : 'Remove PIN'}
              </button>
            </div>
          </div>
        </form>
      )}
    </div>
  )
}

export default function UserProfile() {
  const { user } = useAuthStore()

  // authProvider is not stored in the auth store (it comes from session check).
  // We rely on the fact that if the user has a password-based account, the
  // session check in AppShell populates it. For the PIN form we use a
  // sessionStorage key that AppShell writes, or fall back to 'local'.
  const authProvider = (
    sessionStorage.getItem('io_auth_provider') as
      | 'local'
      | 'oidc'
      | 'saml'
      | 'ldap'
      | null
  ) ?? 'local'

  const initials = user
    ? (user.full_name ?? user.username)
        .split(' ')
        .map((w) => w.charAt(0).toUpperCase())
        .slice(0, 2)
        .join('')
    : '?'

  return (
    <div
      style={{
        maxWidth: '600px',
        margin: '0 auto',
        padding: '32px 24px',
      }}
    >
      <h1
        style={{
          fontSize: '20px',
          fontWeight: 600,
          color: 'var(--io-text-primary)',
          marginBottom: '24px',
        }}
      >
        My Profile
      </h1>

      {/* Account info card */}
      <div
        style={{
          border: '1px solid var(--io-border)',
          borderRadius: 'var(--io-radius)',
          padding: '16px',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
        }}
      >
        {/* Avatar circle */}
        <div
          style={{
            width: '48px',
            height: '48px',
            borderRadius: '50%',
            background: 'var(--io-accent-subtle)',
            border: '2px solid var(--io-accent)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--io-accent)',
            fontSize: '16px',
            fontWeight: 700,
            flexShrink: 0,
          }}
        >
          {initials}
        </div>

        <div>
          <div
            style={{
              fontSize: '15px',
              fontWeight: 600,
              color: 'var(--io-text-primary)',
            }}
          >
            {user?.full_name ?? user?.username ?? 'Unknown'}
          </div>
          {user?.full_name && (
            <div
              style={{
                fontSize: '12px',
                color: 'var(--io-text-muted)',
                marginTop: '2px',
              }}
            >
              @{user.username}
            </div>
          )}
          <div
            style={{
              fontSize: '12px',
              color: 'var(--io-text-muted)',
              marginTop: '2px',
            }}
          >
            {user?.email}
          </div>
        </div>
      </div>

      {/* PIN Setup section */}
      <div style={{ marginBottom: '8px' }}>
        <h2
          style={{
            fontSize: '13px',
            fontWeight: 600,
            color: 'var(--io-text-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            marginBottom: '10px',
          }}
        >
          Security
        </h2>
        <PinSetupSection authProvider={authProvider} />
      </div>
    </div>
  )
}
