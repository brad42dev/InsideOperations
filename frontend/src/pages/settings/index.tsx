import { NavLink, Outlet } from 'react-router-dom'

interface SubNavItem {
  path: string
  label: string
}

const SUB_NAV: SubNavItem[] = [
  { path: '/settings/users', label: 'Users' },
  { path: '/settings/roles', label: 'Roles' },
  { path: '/settings/groups', label: 'Groups' },
  { path: '/settings/sessions', label: 'Sessions' },
  { path: '/settings/opc-sources', label: 'OPC Sources' },
  { path: '/settings/expressions', label: 'Expression Library' },
  { path: '/settings/report-scheduling', label: 'Report Scheduling' },
  { path: '/settings/export-presets', label: 'Export Presets' },
  { path: '/settings/email', label: 'Email' },
  { path: '/settings/security', label: 'Security' },
  { path: '/settings/appearance', label: 'Appearance' },
  { path: '/settings/health', label: 'System Health' },
  { path: '/settings/certificates', label: 'Certificates' },
  { path: '/settings/backup', label: 'Backup & Restore' },
  { path: '/settings/auth-providers', label: 'Auth Providers' },
  { path: '/settings/mfa', label: 'MFA' },
  { path: '/settings/api-keys', label: 'API Keys' },
  { path: '/settings/scim', label: 'SCIM' },
  { path: '/settings/sms-providers', label: 'SMS Providers' },
  { path: '/settings/import', label: 'Import' },
  { path: '/settings/recognition', label: 'Recognition' },
  { path: '/settings/eula', label: 'EULA' },
  { path: '/settings/about', label: 'About' },
]

const COMING_SOON_ITEMS: string[] = []

export default function SettingsShell() {
  return (
    <div
      style={{
        display: 'flex',
        height: '100%',
        minHeight: 0,
      }}
    >
      {/* Sub-navigation */}
      <aside
        style={{
          width: '200px',
          borderRight: '1px solid var(--io-border)',
          background: 'var(--io-surface-secondary)',
          flexShrink: 0,
          padding: '16px 8px',
          overflowY: 'auto',
        }}
      >
        <div
          style={{
            fontSize: '11px',
            fontWeight: 600,
            color: 'var(--io-text-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            padding: '0 8px 8px',
          }}
        >
          Settings
        </div>

        {SUB_NAV.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            style={({ isActive }) => ({
              display: 'block',
              padding: '7px 10px',
              borderRadius: 'var(--io-radius)',
              marginBottom: '2px',
              textDecoration: 'none',
              fontSize: '13px',
              fontWeight: isActive ? 600 : 400,
              color: isActive ? 'var(--io-accent)' : 'var(--io-text-secondary)',
              background: isActive ? 'var(--io-accent-subtle)' : 'transparent',
            })}
          >
            {item.label}
          </NavLink>
        ))}

        {COMING_SOON_ITEMS.length > 0 && (
          <div
            style={{
              marginTop: '16px',
              borderTop: '1px solid var(--io-border)',
              paddingTop: '16px',
            }}
          >
            <div
              style={{
                fontSize: '11px',
                fontWeight: 600,
                color: 'var(--io-text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                padding: '0 8px 8px',
              }}
            >
              Coming Soon
            </div>
            {COMING_SOON_ITEMS.map((label) => (
              <div
                key={label}
                style={{
                  display: 'block',
                  padding: '7px 10px',
                  borderRadius: 'var(--io-radius)',
                  marginBottom: '2px',
                  fontSize: '13px',
                  color: 'var(--io-text-muted)',
                  cursor: 'default',
                }}
              >
                {label}
              </div>
            ))}
          </div>
        )}
      </aside>

      {/* Child route content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
        <Outlet />
      </div>
    </div>
  )
}
