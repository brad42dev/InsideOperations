export default function LogSchedules() {
  return (
    <div style={{ padding: 'var(--io-space-6)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div>
        <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: 'var(--io-text-primary)' }}>Log Schedules</h2>
        <p style={{ margin: '4px 0 0', fontSize: '14px', color: 'var(--io-text-secondary)' }}>
          Automatically create recurring log entry instances on a schedule.
        </p>
      </div>
      <div style={{ padding: '32px', textAlign: 'center', color: 'var(--io-text-muted)', fontSize: '14px', background: 'var(--io-surface)', borderRadius: '8px', border: '1px solid var(--io-border)' }}>
        Log scheduling is configured on the backend. Contact your system administrator to set up recurring log instances.
      </div>
    </div>
  )
}
