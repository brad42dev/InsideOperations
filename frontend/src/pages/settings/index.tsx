import { NavLink, Outlet } from "react-router-dom";
import { useAuthStore } from "../../store/auth";

interface NavItem {
  path: string;
  label: string;
  permission?: string;
}

interface NavGroup {
  header: string;
  items: NavItem[];
}

// Nav structure: 7 groups, 18 items total.
// Temporary paths: "Users & Roles" → /settings/users (Phase 3 creates /settings/identity)
//                  "Archive & Backup" → /settings/archive (Phase 6 creates /settings/system)
const NAV_GROUPS: NavGroup[] = [
  {
    header: "Identity & Access",
    items: [
      {
        path: "/settings/identity",
        label: "Users & Roles",
        permission: "system:manage_users",
      },
    ],
  },
  {
    header: "Authentication",
    items: [
      {
        path: "/settings/auth-providers",
        label: "Auth Providers",
        permission: "auth:configure",
      },
      {
        path: "/settings/mfa",
        label: "MFA Policy",
        permission: "auth:configure",
      },
      {
        path: "/settings/scim",
        label: "SCIM Provisioning",
        permission: "auth:configure",
      },
      {
        path: "/settings/sms-providers",
        label: "SMS Providers",
        permission: "auth:configure",
      },
    ],
  },
  {
    header: "Data Sources",
    items: [
      {
        path: "/settings/opc-sources",
        label: "OPC Sources",
        permission: "system:opc_config",
      },
      {
        path: "/settings/points",
        label: "Point Management",
        permission: "system:point_config",
      },
      {
        path: "/settings/expressions",
        label: "Expressions",
        permission: "system:expression_manage",
      },
      {
        path: "/settings/import",
        label: "Import & Streaming",
        permission: "system:import_connections",
      },
    ],
  },
  {
    header: "Notifications",
    items: [
      {
        path: "/settings/email",
        label: "Email",
        permission: "email:configure",
      },
    ],
  },
  {
    header: "System",
    items: [
      {
        path: "/settings/system-health",
        label: "System Health",
        permission: "system:monitor",
      },
      {
        path: "/settings/system",
        label: "Archive & Backup",
        permission: "system:backup",
      },
      {
        path: "/settings/certificates",
        label: "Certificates",
        permission: "system:admin",
      },
    ],
  },
  {
    header: "Content & Export",
    items: [
      {
        path: "/settings/report-scheduling",
        label: "Report Scheduling",
        permission: "reports:schedule_manage",
      },
      {
        path: "/settings/export-presets",
        label: "Export Presets",
        permission: "system:admin",
      },
      {
        path: "/settings/bulk-update",
        label: "Bulk Update",
        permission: "system:bulk_update",
      },
      {
        path: "/settings/snapshots",
        label: "Change Snapshots",
        permission: "system:change_backup",
      },
      {
        path: "/settings/recognition",
        label: "Recognition",
        permission: "recognition:manage",
      },
    ],
  },
  {
    header: "About",
    items: [
      { path: "/settings/eula", label: "EULA" },
      { path: "/settings/about", label: "About" },
    ],
  },
];

function hasPermission(permissions: string[], permission?: string): boolean {
  if (!permission) return true;
  return permissions.includes("*") || permissions.includes(permission);
}

export default function SettingsShell() {
  const { user } = useAuthStore();
  const permissions = user?.permissions ?? [];

  const visibleGroups = NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) =>
      hasPermission(permissions, item.permission),
    ),
  })).filter((group) => group.items.length > 0);

  return (
    <div style={{ display: "flex", height: "100%", minHeight: 0 }}>
      <aside
        style={{
          width: "220px",
          borderRight: "1px solid var(--io-border)",
          background: "var(--io-surface-secondary)",
          flexShrink: 0,
          padding: "8px",
          overflowY: "auto",
        }}
      >
        {visibleGroups.map((group, groupIndex) => (
          <div key={group.header}>
            <div
              style={{
                fontSize: "11px",
                fontWeight: 600,
                color: "var(--io-text-muted)",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                padding: `${groupIndex === 0 ? "4px" : "12px"} 8px 6px`,
                userSelect: "none",
              }}
            >
              {group.header}
            </div>
            {group.items.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                style={({ isActive }) => ({
                  display: "block",
                  padding: "7px 10px",
                  borderRadius: "var(--io-radius)",
                  marginBottom: "2px",
                  textDecoration: "none",
                  fontSize: "13px",
                  fontWeight: isActive ? 600 : 400,
                  color: isActive
                    ? "var(--io-accent)"
                    : "var(--io-text-secondary)",
                  background: isActive
                    ? "var(--io-accent-subtle)"
                    : "transparent",
                })}
              >
                {item.label}
              </NavLink>
            ))}
          </div>
        ))}
      </aside>

      <div style={{ flex: 1, overflowY: "auto", padding: "24px" }}>
        <Outlet />
      </div>
    </div>
  );
}
