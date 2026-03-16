export default function ResetPassword() {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        background: 'var(--io-surface-primary)',
      }}
    >
      <div
        style={{
          background: 'var(--io-surface-elevated)',
          border: '1px solid var(--io-border)',
          borderRadius: 'var(--io-radius-lg)',
          padding: 'var(--io-space-8)',
          width: 360,
          boxShadow: 'var(--io-shadow-lg)',
        }}
      >
        <h2 style={{ color: 'var(--io-text-primary)', marginBottom: 'var(--io-space-2)' }}>
          Reset Password
        </h2>
        <p style={{ color: 'var(--io-text-secondary)', fontSize: 'var(--io-text-sm)' }}>
          Password reset flow — Phase 2
        </p>
      </div>
    </div>
  )
}
