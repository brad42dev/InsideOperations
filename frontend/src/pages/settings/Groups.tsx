// User group management — informational page pointing to Alerts module notification groups.
// No groups API exists yet; RBAC role assignment is handled in Users/Roles settings pages.

import { useNavigate } from 'react-router-dom'

// ---------------------------------------------------------------------------
// Shared styles
// ---------------------------------------------------------------------------

const CARD: React.CSSProperties = {
  background: 'var(--io-surface)',
  border: '1px solid var(--io-border)',
  borderRadius: '8px',
  padding: '14px 18px',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 16,
  textDecoration: 'none',
  transition: 'border-color 0.15s',
}

const INFO_CARD: React.CSSProperties = {
  background: 'var(--io-surface-secondary)',
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
// Navigation card
// ---------------------------------------------------------------------------

function NavCard({
  label,
  desc,
  path,
  onClick,
}: {
  label: string
  desc: string
  path: string
  onClick: () => void
}) {
  return (
    <div
      style={CARD}
      onClick={onClick}
      onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--io-accent)')}
      onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--io-border)')}
      role="link"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onClick() }}
      aria-label={`Navigate to ${label}`}
    >
      <div>
        <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--io-text-primary)', marginBottom: 3 }}>
          {label}
        </div>
        <div style={{ fontSize: '12px', color: 'var(--io-text-muted)', lineHeight: 1.5 }}>
          {desc}
        </div>
        <div style={{ fontSize: '11px', color: 'var(--io-accent)', marginTop: 4, fontFamily: 'monospace' }}>
          {path}
        </div>
      </div>
      <span style={{ color: 'var(--io-text-muted)', fontSize: '20px', flexShrink: 0 }}>›</span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function Groups() {
  const navigate = useNavigate()

  return (
    <div style={{ padding: 'var(--io-space-6)', maxWidth: 720 }}>
      {/* Header */}
      <div style={{ marginBottom: 'var(--io-space-6)' }}>
        <h2 style={{ margin: '0 0 6px', fontSize: '20px', fontWeight: 700, color: 'var(--io-text-primary)' }}>
          Groups
        </h2>
        <p style={{ margin: 0, fontSize: '13px', color: 'var(--io-text-secondary)', lineHeight: 1.55 }}>
          User grouping in Inside/Operations is handled through two separate mechanisms: RBAC roles (for access control) and notification groups (for alert routing). Use the links below to manage each.
        </p>
      </div>

      {/* Group types */}
      <div style={SECTION_LABEL}>Group Types</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--io-space-3)', marginBottom: 'var(--io-space-6)' }}>
        <div style={{ ...INFO_CARD }}>
          <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: '8px',
                background: 'var(--io-accent-subtle)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '18px',
                flexShrink: 0,
              }}
            >
              🛡
            </div>
            <div>
              <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--io-text-primary)', marginBottom: 4 }}>
                RBAC Roles
              </div>
              <p style={{ margin: 0, fontSize: '13px', color: 'var(--io-text-secondary)', lineHeight: 1.55 }}>
                Roles define what each user is permitted to see and do. A user can hold multiple roles. Roles control API access (118 permissions) and UI visibility. Manage roles in{' '}
                <strong>Settings › Roles</strong> and assign them per user in{' '}
                <strong>Settings › Users</strong>.
              </p>
              <div
                style={{
                  display: 'flex',
                  gap: 6,
                  flexWrap: 'wrap' as const,
                  marginTop: 10,
                }}
              >
                {['Viewer', 'Operator', 'Analyst', 'Supervisor', 'Content Manager', 'Maintenance', 'Contractor', 'Admin'].map(
                  (role) => (
                    <span
                      key={role}
                      style={{
                        padding: '2px 8px',
                        borderRadius: '999px',
                        fontSize: '11px',
                        fontWeight: 500,
                        background: 'var(--io-surface)',
                        border: '1px solid var(--io-border)',
                        color: 'var(--io-text-secondary)',
                      }}
                    >
                      {role}
                    </span>
                  ),
                )}
              </div>
            </div>
          </div>
        </div>

        <div style={{ ...INFO_CARD }}>
          <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: '8px',
                background: 'var(--io-warning-subtle, rgba(234,179,8,0.1))',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '18px',
                flexShrink: 0,
              }}
            >
              📣
            </div>
            <div>
              <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--io-text-primary)', marginBottom: 4 }}>
                Notification Groups
              </div>
              <p style={{ margin: 0, fontSize: '13px', color: 'var(--io-text-secondary)', lineHeight: 1.55 }}>
                Notification groups are collections of users and contacts used for alert routing. Groups can be static (fixed membership) or dynamic (resolved by shift role at send time). They are managed in the{' '}
                <strong>Alerts</strong> module and referenced in escalation policies.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation links */}
      <div style={SECTION_LABEL}>Manage Groups</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--io-space-2)', marginBottom: 'var(--io-space-6)' }}>
        <NavCard
          label="Roles"
          desc="Create and edit RBAC roles, manage permission sets for the 8 predefined roles"
          path="/settings/roles"
          onClick={() => navigate('/settings/roles')}
        />
        <NavCard
          label="Users"
          desc="Assign roles to individual users, view group membership"
          path="/settings/users"
          onClick={() => navigate('/settings/users')}
        />
        <NavCard
          label="Recipient Groups"
          desc="Static and dynamic notification groups for alert routing and escalation"
          path="/alerts/groups"
          onClick={() => navigate('/alerts/groups')}
        />
        <NavCard
          label="Alert Templates"
          desc="Pre-configured templates that reference notification groups for routing"
          path="/alerts/templates"
          onClick={() => navigate('/alerts/templates')}
        />
      </div>

      {/* Note about future API */}
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
        <strong style={{ color: 'var(--io-text-primary)' }}>Future: Named User Groups</strong> — Phase 16 will introduce named user groups as a standalone entity, separate from roles and notification groups. Groups will act as a cross-cutting membership abstraction used for bulk role assignment, report distribution lists, and shift crew definitions. This page will be updated at that time.
      </div>
    </div>
  )
}
