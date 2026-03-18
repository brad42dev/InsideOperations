// Badge reader integration — informational page (server-side configuration, Phase 15)

// ---------------------------------------------------------------------------
// Shared styles
// ---------------------------------------------------------------------------

const CARD: React.CSSProperties = {
  background: 'var(--io-surface)',
  border: '1px solid var(--io-border)',
  borderRadius: '8px',
  padding: 'var(--io-space-5)',
}

const SECTION_LABEL: React.CSSProperties = {
  fontSize: '11px',
  fontWeight: 700,
  color: 'var(--io-text-muted)',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.07em',
  marginBottom: 12,
}

// ---------------------------------------------------------------------------
// Flow step component
// ---------------------------------------------------------------------------

function FlowStep({
  step,
  title,
  desc,
  last,
}: {
  step: number
  title: string
  desc: string
  last?: boolean
}) {
  return (
    <div style={{ display: 'flex', gap: 16 }}>
      {/* Step indicator + connector */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: '50%',
            background: 'var(--io-accent)',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 700,
            fontSize: '13px',
            flexShrink: 0,
          }}
        >
          {step}
        </div>
        {!last && (
          <div
            style={{
              width: 2,
              flex: 1,
              minHeight: 24,
              background: 'var(--io-border)',
              margin: '4px 0',
            }}
          />
        )}
      </div>
      {/* Content */}
      <div style={{ paddingBottom: last ? 0 : 'var(--io-space-4)', paddingTop: 4 }}>
        <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--io-text-primary)', marginBottom: 4 }}>
          {title}
        </div>
        <p style={{ margin: 0, fontSize: '13px', color: 'var(--io-text-secondary)', lineHeight: 1.55 }}>
          {desc}
        </p>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Protocol card
// ---------------------------------------------------------------------------

function ProtocolCard({
  name,
  desc,
  details,
}: {
  name: string
  desc: string
  details: string[]
}) {
  return (
    <div style={{ ...CARD }}>
      <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--io-text-primary)', marginBottom: 6 }}>
        {name}
      </div>
      <p style={{ margin: '0 0 10px', fontSize: '13px', color: 'var(--io-text-secondary)', lineHeight: 1.5 }}>
        {desc}
      </p>
      <ul style={{ margin: 0, paddingLeft: 16, listStyle: 'disc', fontSize: '12px', color: 'var(--io-text-muted)', lineHeight: 1.7 }}>
        {details.map((d) => (
          <li key={d}>{d}</li>
        ))}
      </ul>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function Badges() {
  return (
    <div style={{ padding: 'var(--io-space-6)', maxWidth: 820 }}>
      {/* Header */}
      <div style={{ marginBottom: 'var(--io-space-6)' }}>
        <h2 style={{ margin: '0 0 6px', fontSize: '20px', fontWeight: 700, color: 'var(--io-text-primary)' }}>
          Badge Reader Integration
        </h2>
        <p style={{ margin: 0, fontSize: '13px', color: 'var(--io-text-secondary)', lineHeight: 1.55 }}>
          Physical badge reader configuration for site access tracking, shift assignment, and muster verification. Configuration is performed server-side by your system administrator.
        </p>
      </div>

      {/* Coming soon banner */}
      <div
        style={{
          display: 'flex',
          gap: 14,
          alignItems: 'flex-start',
          padding: '14px 18px',
          borderRadius: '8px',
          background: 'var(--io-surface-secondary)',
          border: '1px solid var(--io-border)',
          marginBottom: 'var(--io-space-6)',
        }}
      >
        <span style={{ fontSize: '20px', lineHeight: 1 }}>🪪</span>
        <div>
          <p style={{ margin: '0 0 4px', fontWeight: 600, fontSize: '14px', color: 'var(--io-text-primary)' }}>
            Server-Side Configuration (Phase 15)
          </p>
          <p style={{ margin: 0, fontSize: '13px', color: 'var(--io-text-secondary)', lineHeight: 1.5 }}>
            Badge reader hardware is registered and configured in the Access Control service configuration file. The Phase 15 update will expose reader management, zone definitions, and badge event rules through this UI. Contact your system administrator to add or reconfigure readers in the meantime.
          </p>
        </div>
      </div>

      {/* Protocols */}
      <div style={SECTION_LABEL}>Supported Protocols</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 'var(--io-space-3)', marginBottom: 'var(--io-space-6)' }}>
        <ProtocolCard
          name="OSDP v2"
          desc="Open Supervised Device Protocol — the recommended standard for IP-connected badge readers. Provides bidirectional communication and tamper detection."
          details={[
            'RS-485 or TCP transport',
            'Encrypted channel (AES-128)',
            'Real-time event push to Access Control service',
            'Supports LED and buzzer control from server',
            'Supervised line — detects cable cuts and shorts',
          ]}
        />
        <ProtocolCard
          name="Wiegand"
          desc="Legacy pulse-based protocol for credential readers. Widely supported by existing hardware installations. Requires a Wiegand-to-TCP gateway device."
          details={[
            '26-bit and 34-bit card formats supported',
            'No bidirectional communication',
            'Polling via gateway device (1-second interval)',
            'No line supervision — single point of failure',
            'Suitable for retrofit installations',
          ]}
        />
      </div>

      {/* Badge event flow */}
      <div style={SECTION_LABEL}>Badge Event Flow</div>
      <div style={{ ...CARD, marginBottom: 'var(--io-space-6)', padding: 'var(--io-space-5) var(--io-space-5) var(--io-space-4)' }}>
        <FlowStep
          step={1}
          title="Badge Swipe"
          desc="An employee presents their card or fob to a badge reader. The reader decodes the credential and transmits the badge ID via OSDP or Wiegand."
        />
        <FlowStep
          step={2}
          title="Access Control Service"
          desc="The Access Control service receives the event, looks up the badge ID against the personnel directory, and validates the access zone rules."
        />
        <FlowStep
          step={3}
          title="Presence Tracking"
          desc="A badge-in event marks the employee as on-site in the presence registry. Badge-out events (or absence after shift end) clear the presence record."
        />
        <FlowStep
          step={4}
          title="Shift Assignment"
          desc="If the badge event occurs at shift start, the system auto-assigns the employee to the active shift roster. Shift supervisors can view badge-in status in the Shifts module."
        />
        <FlowStep
          step={5}
          title="Muster Integration"
          last
          desc="During an emergency muster, the muster command center uses badge presence records to reconcile who is on-site. Unaccounted personnel are flagged automatically."
        />
      </div>

      {/* Zone types */}
      <div style={SECTION_LABEL}>Access Zones</div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
          gap: 'var(--io-space-3)',
          marginBottom: 'var(--io-space-6)',
        }}
      >
        {[
          { zone: 'Entry / Exit', desc: 'Main site perimeter gates. Tracks site presence.' },
          { zone: 'Control Room', desc: 'Restricted area for licensed operators only.' },
          { zone: 'Process Units', desc: 'Individual process area readers for hazardous zones.' },
          { zone: 'Maintenance Workshop', desc: 'Tool and permit issuance tracking.' },
          { zone: 'Muster Points', desc: 'Emergency assembly locations with readers.' },
        ].map(({ zone, desc }) => (
          <div
            key={zone}
            style={{
              ...CARD,
              background: 'var(--io-surface-secondary)',
            }}
          >
            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--io-text-primary)', marginBottom: 4 }}>
              {zone}
            </div>
            <p style={{ margin: 0, fontSize: '12px', color: 'var(--io-text-muted)', lineHeight: 1.5 }}>
              {desc}
            </p>
          </div>
        ))}
      </div>

      {/* Admin note */}
      <div
        style={{
          padding: '14px 16px',
          background: 'var(--io-surface-secondary)',
          borderRadius: '8px',
          border: '1px solid var(--io-border)',
          fontSize: '13px',
          color: 'var(--io-text-secondary)',
          lineHeight: 1.55,
        }}
      >
        <strong style={{ color: 'var(--io-text-primary)' }}>Configure readers</strong> — Badge readers, zone definitions, and credential mappings are currently managed in{' '}
        <code style={{ fontFamily: 'monospace', fontSize: '12px' }}>access-control.toml</code> on the server. Contact your system administrator to register new readers, add employees to the badge directory, or adjust zone access rules. Badge event history is available in the{' '}
        <strong>Shifts</strong> module under Badge Events.
      </div>
    </div>
  )
}
