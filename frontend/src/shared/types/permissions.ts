/**
 * RBAC permission registry — TypeScript parity for Rust `Permission` enum (doc 37 §18)
 *
 * These strings are the canonical permission identifiers. They must match:
 *   - Rust: io-models `pub enum Permission` with serde rename attributes
 *   - Database: `permissions.name` column seed data
 *   - JWT claims: `permissions` array in access token payload
 *
 * Total: 118 permissions across 15 modules.
 * No ad-hoc permission strings anywhere in the codebase — all must appear here.
 */

// Console Module (7)
export type ConsolePermission =
  | 'console:read'
  | 'console:write'
  | 'console:workspace_write'
  | 'console:workspace_publish'
  | 'console:workspace_delete'
  | 'console:export'
  | 'console:admin'

// Process Module (6)
export type ProcessPermission =
  | 'process:read'
  | 'process:write'
  | 'process:publish'
  | 'process:delete'
  | 'process:export'
  | 'process:admin'

// Designer Module (7)
export type DesignerPermission =
  | 'designer:read'
  | 'designer:write'
  | 'designer:delete'
  | 'designer:publish'
  | 'designer:import'
  | 'designer:export'
  | 'designer:admin'

// Dashboards Module (6)
export type DashboardsPermission =
  | 'dashboards:read'
  | 'dashboards:write'
  | 'dashboards:delete'
  | 'dashboards:publish'
  | 'dashboards:export'
  | 'dashboards:admin'

// Reports Module (5)
export type ReportsPermission =
  | 'reports:read'
  | 'reports:write'
  | 'reports:delete'
  | 'reports:export'
  | 'reports:admin'

// Forensics Module (7)
export type ForensicsPermission =
  | 'forensics:read'
  | 'forensics:write'
  | 'forensics:share'
  | 'forensics:search'
  | 'forensics:correlate'
  | 'forensics:export'
  | 'forensics:admin'

// Events Module (5)
export type EventsPermission =
  | 'events:read'
  | 'events:manage'
  | 'events:acknowledge'
  | 'events:shelve'
  | 'events:admin'

// Log Module (7)
export type LogPermission =
  | 'log:read'
  | 'log:write'
  | 'log:delete'
  | 'log:template_manage'
  | 'log:schedule_manage'
  | 'log:export'
  | 'log:admin'

// Rounds Module (7)
export type RoundsPermission =
  | 'rounds:read'
  | 'rounds:execute'
  | 'rounds:transfer'
  | 'rounds:template_manage'
  | 'rounds:schedule_manage'
  | 'rounds:export'
  | 'rounds:admin'

// Settings Module (4)
export type SettingsPermission =
  | 'settings:read'
  | 'settings:write'
  | 'settings:export'
  | 'settings:admin'

// Alerts Module (8)
export type AlertsPermission =
  | 'alerts:read'
  | 'alerts:acknowledge'
  | 'alerts:send'
  | 'alerts:send_emergency'
  | 'alerts:manage_templates'
  | 'alerts:manage_groups'
  | 'alerts:configure'
  | 'alerts:muster'

// Email System (4)
export type EmailPermission =
  | 'email:configure'
  | 'email:manage_templates'
  | 'email:send_test'
  | 'email:view_logs'

// Authentication (3)
export type AuthPermission =
  | 'auth:configure'
  | 'auth:manage_mfa'
  | 'auth:manage_api_keys'

// Shifts Module (8)
export type ShiftsPermission =
  | 'shifts:read'
  | 'shifts:write'
  | 'presence:read'
  | 'presence:manage'
  | 'muster:manage'
  | 'badge_config:manage'
  | 'alert_groups:read'
  | 'alert_groups:write'

// System (27)
export type SystemPermission =
  | 'system:manage_users'
  | 'system:manage_groups'
  | 'system:manage_roles'
  | 'system:view_logs'
  | 'system:system_settings'
  | 'system:opc_config'
  | 'system:source_config'
  | 'system:event_config'
  | 'system:point_config'
  | 'system:point_deactivate'
  | 'system:expression_manage'
  | 'system:import_connections'
  | 'system:import_definitions'
  | 'system:import_execute'
  | 'system:import_history'
  | 'system:bulk_update'
  | 'system:change_backup'
  | 'system:change_restore'
  | 'system:data_link_config'
  | 'system:point_detail_config'
  | 'system:monitor'
  | 'system:sessions'
  | 'system:backup'
  | 'system:restore'
  | 'system:export_data'
  | 'system:import_data'
  | 'system:admin'

// ---------------------------------------------------------------------------
// Union type — the only valid permission strings in the codebase
// ---------------------------------------------------------------------------

export type Permission =
  | ConsolePermission
  | ProcessPermission
  | DesignerPermission
  | DashboardsPermission
  | ReportsPermission
  | ForensicsPermission
  | EventsPermission
  | LogPermission
  | RoundsPermission
  | SettingsPermission
  | AlertsPermission
  | EmailPermission
  | AuthPermission
  | ShiftsPermission
  | SystemPermission

// ---------------------------------------------------------------------------
// Helper — runtime check that a string is a valid Permission
// ---------------------------------------------------------------------------

const ALL_PERMISSIONS = new Set<string>([
  // Console (7)
  'console:read', 'console:write', 'console:workspace_write',
  'console:workspace_publish', 'console:workspace_delete',
  'console:export', 'console:admin',
  // Process (6)
  'process:read', 'process:write', 'process:publish',
  'process:delete', 'process:export', 'process:admin',
  // Designer (7)
  'designer:read', 'designer:write', 'designer:delete',
  'designer:publish', 'designer:import', 'designer:export', 'designer:admin',
  // Dashboards (6)
  'dashboards:read', 'dashboards:write', 'dashboards:delete',
  'dashboards:publish', 'dashboards:export', 'dashboards:admin',
  // Reports (5)
  'reports:read', 'reports:write',
  'reports:delete', 'reports:export', 'reports:admin',
  // Forensics (7)
  'forensics:read', 'forensics:write', 'forensics:share',
  'forensics:search', 'forensics:correlate', 'forensics:export', 'forensics:admin',
  // Events (5)
  'events:read', 'events:manage', 'events:acknowledge',
  'events:shelve', 'events:admin',
  // Log (7)
  'log:read', 'log:write', 'log:delete',
  'log:template_manage', 'log:schedule_manage', 'log:export', 'log:admin',
  // Rounds (7)
  'rounds:read', 'rounds:execute', 'rounds:transfer',
  'rounds:template_manage', 'rounds:schedule_manage', 'rounds:export', 'rounds:admin',
  // Settings (4)
  'settings:read', 'settings:write', 'settings:export', 'settings:admin',
  // Alerts (8)
  'alerts:read', 'alerts:acknowledge', 'alerts:send', 'alerts:send_emergency',
  'alerts:manage_templates', 'alerts:manage_groups', 'alerts:configure', 'alerts:muster',
  // Email (4)
  'email:configure', 'email:manage_templates', 'email:send_test', 'email:view_logs',
  // Auth (3)
  'auth:configure', 'auth:manage_mfa', 'auth:manage_api_keys',
  // Shifts (8)
  'shifts:read', 'shifts:write', 'presence:read', 'presence:manage',
  'muster:manage', 'badge_config:manage', 'alert_groups:read', 'alert_groups:write',
  // System (27)
  'system:manage_users', 'system:manage_groups', 'system:manage_roles',
  'system:view_logs', 'system:system_settings', 'system:opc_config',
  'system:source_config', 'system:event_config', 'system:point_config',
  'system:point_deactivate', 'system:expression_manage',
  'system:import_connections', 'system:import_definitions',
  'system:import_execute', 'system:import_history',
  'system:bulk_update', 'system:change_backup', 'system:change_restore',
  'system:data_link_config', 'system:point_detail_config',
  'system:monitor', 'system:sessions', 'system:backup', 'system:restore',
  'system:export_data', 'system:import_data', 'system:admin',
])

export function isPermission(s: string): s is Permission {
  return ALL_PERMISSIONS.has(s)
}
