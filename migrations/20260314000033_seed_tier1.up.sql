-- Seed Data Tier 1: Bootstrap
-- Required for first startup. Safe to re-run (idempotent via ON CONFLICT DO NOTHING).

-- Default roles (8 predefined)
INSERT INTO roles (name, description, is_predefined, idle_timeout_minutes, max_concurrent_sessions) VALUES
    ('Viewer',               'Read-only access to high-level data (finance, executives, visitors)',          true, 30, 3),
    ('Operator',             'Console operation, alarm acknowledgment, rounds, logs',                        true, 60, 3),
    ('Shift Supervisor',     'Operator permissions + alarm management, shelving, round oversight',           true, 60, 3),
    ('Engineer',             'Dashboard/report creation, forensics, expression builder',                     true, 30, 5),
    ('Maintenance Technician','Rounds, equipment data, maintenance-focused access',                          true, 30, 3),
    ('Safety Officer',       'Safety event access, environmental data, audit reports',                       true, 30, 3),
    ('Data Steward',         'Import/export management, point configuration, data quality',                  true, 30, 3),
    ('Admin',                'Full system access including user management and system configuration',        true, 15, 5)
ON CONFLICT (name) DO NOTHING;

-- All 118 permissions (authoritative list per doc 03)
INSERT INTO permissions (name, description, module) VALUES
    -- Console (7)
    ('console:read',                'View console workspaces',                                    'console'),
    ('console:write',               'Create/edit personal workspaces',                            'console'),
    ('console:workspace_write',     'Create/edit any workspace',                                  'console'),
    ('console:workspace_publish',   'Publish workspaces',                                         'console'),
    ('console:workspace_delete',    'Delete workspaces',                                          'console'),
    ('console:export',              'Export point data from console workspaces',                  'console'),
    ('console:admin',               'Console module administration',                              'console'),
    -- Process (6)
    ('process:read',                'View process views and navigate between them',               'process'),
    ('process:write',               'Create/edit process views',                                  'process'),
    ('process:publish',             'Publish process views for other users',                      'process'),
    ('process:delete',              'Delete process views',                                       'process'),
    ('process:export',              'Export point data from process views',                       'process'),
    ('process:admin',               'Process module administration',                              'process'),
    -- Designer (7)
    ('designer:read',               'View graphics in designer',                                  'designer'),
    ('designer:write',              'Create/edit graphics',                                       'designer'),
    ('designer:delete',             'Delete graphics',                                            'designer'),
    ('designer:publish',            'Publish graphics templates',                                 'designer'),
    ('designer:import',             'Import files and run symbol recognition (P&ID and DCS)',     'designer'),
    ('designer:export',             'Export graphics metadata and point bindings',                'designer'),
    ('designer:admin',              'Designer module administration',                             'designer'),
    -- Dashboards (6)
    ('dashboards:read',             'View dashboards',                                            'dashboards'),
    ('dashboards:write',            'Create/edit personal dashboards',                            'dashboards'),
    ('dashboards:delete',           'Delete personal dashboards',                                 'dashboards'),
    ('dashboards:publish',          'Publish dashboards',                                         'dashboards'),
    ('dashboards:export',           'Export widget data from dashboards',                         'dashboards'),
    ('dashboards:admin',            'Dashboards module administration',                           'dashboards'),
    -- Reports (7)
    ('reports:read',                'View reports and generated report history',                  'reports'),
    ('reports:write',               'Create/edit report templates (via Designer report mode)',    'reports'),
    ('reports:generate',            'Run reports on demand',                                      'reports'),
    ('reports:schedule_manage',     'Create/edit/delete scheduled report runs',                   'reports'),
    ('reports:delete',              'Delete report templates',                                    'reports'),
    ('reports:export',              'Export reports to CSV/PDF/Excel/HTML/JSON',                  'reports'),
    ('reports:admin',               'Reports administration',                                     'reports'),
    -- Forensics (7)
    ('forensics:read',              'Access forensics module, view own and shared investigations','forensics'),
    ('forensics:write',             'Create, edit, and close/cancel own investigations',          'forensics'),
    ('forensics:share',             'Share investigations with other users or roles',             'forensics'),
    ('forensics:search',            'Perform advanced searches',                                  'forensics'),
    ('forensics:correlate',         'Run correlation engine analysis',                            'forensics'),
    ('forensics:export',            'Export investigation results',                               'forensics'),
    ('forensics:admin',             'Forensics module administration',                            'forensics'),
    -- Events (5)
    ('events:read',                 'View events and alarms',                                     'events'),
    ('events:manage',               'Create/edit/disable I/O-generated alarm definitions',        'events'),
    ('events:acknowledge',          'Acknowledge I/O-generated alarms',                           'events'),
    ('events:shelve',               'Shelve/unshelve I/O-generated alarms',                      'events'),
    ('events:admin',                'Events administration',                                      'events'),
    -- Log (7)
    ('log:read',                    'View log entries and instances',                             'log'),
    ('log:write',                   'Create/edit log entries',                                    'log'),
    ('log:delete',                  'Delete log entries (own entries only)',                      'log'),
    ('log:template_manage',         'Create/edit/delete log templates and reusable segments',     'log'),
    ('log:schedule_manage',         'Create/edit/delete log schedules',                           'log'),
    ('log:export',                  'Export log entries and templates',                           'log'),
    ('log:admin',                   'Log module administration',                                  'log'),
    -- Rounds (7)
    ('rounds:read',                 'View rounds, instances, and completion history',             'rounds'),
    ('rounds:execute',              'Start, complete, and save checkpoint responses',             'rounds'),
    ('rounds:transfer',             'Request transfer of a locked round',                         'rounds'),
    ('rounds:template_manage',      'Create/edit/delete round templates',                         'rounds'),
    ('rounds:schedule_manage',      'Create/edit/delete round schedules',                         'rounds'),
    ('rounds:export',               'Export round data, templates, and schedules',                'rounds'),
    ('rounds:admin',                'Rounds administration',                                      'rounds'),
    -- Settings (4)
    ('settings:read',               'View settings',                                             'settings'),
    ('settings:write',              'Modify application settings',                               'settings'),
    ('settings:export',             'Export settings data',                                       'settings'),
    ('settings:admin',              'Full settings administration',                               'settings'),
    -- Alerts (8)
    ('alerts:read',                 'View active alerts, alert history, templates, delivery',     'alerts'),
    ('alerts:acknowledge',          'Acknowledge alerts',                                         'alerts'),
    ('alerts:send',                 'Create manual alerts, send notifications, resolve, cancel',  'alerts'),
    ('alerts:send_emergency',       'Send EMERGENCY-severity notifications',                      'alerts'),
    ('alerts:manage_templates',     'Create, edit, delete alert and notification templates',      'alerts'),
    ('alerts:manage_groups',        'Create, edit, delete alert groups, recipient rosters',       'alerts'),
    ('alerts:configure',            'Configure alert channels, escalation rules',                 'alerts'),
    ('alerts:muster',               'View muster status dashboard, mark personnel as accounted',  'alerts'),
    -- Email (4)
    ('email:configure',             'Configure email providers, set default, enable/disable',     'email'),
    ('email:manage_templates',      'Create, edit, delete email templates',                       'email'),
    ('email:send_test',             'Send test emails to verify provider configuration',          'email'),
    ('email:view_logs',             'View email delivery logs and queue status',                  'email'),
    -- Auth (3)
    ('auth:configure',              'Configure authentication providers',                         'auth'),
    ('auth:manage_mfa',             'Configure MFA policies per role',                            'auth'),
    ('auth:manage_api_keys',        'Create, revoke, and manage service account API keys',        'auth'),
    -- Shifts (8)
    ('shifts:read',                 'View shifts, schedules, crews, muster points',               'shifts'),
    ('shifts:write',                'Create/edit shifts, patterns, crews, shift assignments',     'shifts'),
    ('presence:read',               'View on-site personnel, badge events, presence status',      'shifts'),
    ('presence:manage',             'Manually clear stale presence entries',                      'shifts'),
    ('muster:manage',               'Configure muster points, account personnel, end muster',     'shifts'),
    ('badge_config:manage',         'Configure badge system connections and polling',              'shifts'),
    ('alert_groups:read',           'View custom alert groups and membership',                    'shifts'),
    ('alert_groups:write',          'Create, edit, delete custom alert groups',                   'shifts'),
    -- System (27)
    ('system:manage_users',         'Create/edit/disable users',                                  'system'),
    ('system:manage_groups',        'Create/edit groups',                                         'system'),
    ('system:manage_roles',         'Assign roles to users',                                      'system'),
    ('system:view_logs',            'View audit logs',                                            'system'),
    ('system:system_settings',      'Configure system-wide settings',                             'system'),
    ('system:opc_config',           'Configure OPC UA endpoints',                                 'system'),
    ('system:source_config',        'Manage data sources (point_sources CRUD, enable/disable)',   'system'),
    ('system:event_config',         'Configure event historian settings',                         'system'),
    ('system:point_config',         'Update point application config',                            'system'),
    ('system:point_deactivate',     'Deactivate/reactivate points',                               'system'),
    ('system:expression_manage',    'Share expressions and manage other users'' expressions',     'system'),
    ('system:import_connections',   'Create, edit, delete, and test import connections',          'system'),
    ('system:import_definitions',   'Create, edit, delete import definitions',                    'system'),
    ('system:import_execute',       'Execute imports manually, trigger dry runs',                 'system'),
    ('system:import_history',       'View import run history, error details, metrics',            'system'),
    ('system:bulk_update',          'Access the admin bulk update wizard',                        'system'),
    ('system:change_backup',        'Create and view change snapshots',                           'system'),
    ('system:change_restore',       'Restore data from change snapshots',                         'system'),
    ('system:data_link_config',     'Create, edit, delete data links between import datasets',    'system'),
    ('system:point_detail_config',  'Configure Point Detail panel sections and display settings', 'system'),
    ('system:monitor',              'View system monitoring dashboard',                           'system'),
    ('system:sessions',             'View and terminate active user sessions',                    'system'),
    ('system:backup',               'Initiate database backups and manage scheduled backup',      'system'),
    ('system:restore',              'Restore from backups',                                        'system'),
    ('system:export_data',          'Export entire database',                                     'system'),
    ('system:import_data',          'Import system data (backup/restore operations)',             'system'),
    ('system:admin',                'Full system administration',                                  'system')
ON CONFLICT (name) DO NOTHING;

-- Assign all permissions to Admin role
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'Admin'
ON CONFLICT DO NOTHING;

-- Viewer: basic read-only permissions across all modules
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.name IN (
    'console:read', 'process:read', 'designer:read', 'dashboards:read',
    'reports:read', 'forensics:read', 'events:read', 'log:read', 'rounds:read',
    'settings:read', 'alerts:read', 'alerts:acknowledge',
    'shifts:read', 'alert_groups:read'
)
WHERE r.name = 'Viewer'
ON CONFLICT DO NOTHING;

-- Operator: Viewer + write operational data + alerts
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.name IN (
    'console:read', 'console:write', 'console:export',
    'process:read', 'process:export',
    'designer:read',
    'dashboards:read', 'dashboards:write', 'dashboards:export',
    'reports:read', 'reports:generate', 'reports:export',
    'forensics:read',
    'events:read', 'events:acknowledge',
    'log:read', 'log:write', 'log:export',
    'rounds:read', 'rounds:execute', 'rounds:export',
    'settings:read',
    'alerts:read', 'alerts:acknowledge', 'alerts:send', 'alerts:muster',
    'shifts:read', 'alert_groups:read',
    'system:monitor'
)
WHERE r.name = 'Operator'
ON CONFLICT DO NOTHING;

-- Shift Supervisor: Operator + alarm management + team oversight
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.name IN (
    'console:read', 'console:write', 'console:workspace_publish', 'console:export',
    'process:read', 'process:publish', 'process:export',
    'designer:read',
    'dashboards:read', 'dashboards:write', 'dashboards:publish', 'dashboards:export',
    'reports:read', 'reports:generate', 'reports:schedule_manage', 'reports:export',
    'forensics:read', 'forensics:write', 'forensics:share', 'forensics:search',
    'events:read', 'events:acknowledge', 'events:shelve',
    'log:read', 'log:write', 'log:delete', 'log:template_manage', 'log:schedule_manage', 'log:export',
    'rounds:read', 'rounds:execute', 'rounds:transfer', 'rounds:template_manage', 'rounds:schedule_manage', 'rounds:export',
    'settings:read',
    'alerts:read', 'alerts:acknowledge', 'alerts:send', 'alerts:muster', 'alerts:manage_groups',
    'shifts:read', 'shifts:write', 'presence:read', 'presence:manage', 'muster:manage', 'alert_groups:read', 'alert_groups:write',
    'system:monitor', 'system:sessions', 'system:view_logs'
)
WHERE r.name = 'Shift Supervisor'
ON CONFLICT DO NOTHING;

-- Engineer: analysis and creation focused
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.name IN (
    'console:read', 'console:write', 'console:export',
    'process:read', 'process:write', 'process:export',
    'designer:read', 'designer:write', 'designer:export',
    'dashboards:read', 'dashboards:write', 'dashboards:publish', 'dashboards:export',
    'reports:read', 'reports:write', 'reports:generate', 'reports:schedule_manage', 'reports:export',
    'forensics:read', 'forensics:write', 'forensics:share', 'forensics:search', 'forensics:correlate', 'forensics:export',
    'events:read', 'events:acknowledge',
    'log:read', 'log:write', 'log:export',
    'rounds:read', 'rounds:export',
    'settings:read',
    'alerts:read', 'alerts:acknowledge',
    'shifts:read', 'alert_groups:read',
    'system:monitor', 'system:point_config', 'system:expression_manage',
    'system:import_history', 'system:change_backup'
)
WHERE r.name = 'Engineer'
ON CONFLICT DO NOTHING;

-- Maintenance Technician: rounds + equipment focused
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.name IN (
    'console:read',
    'process:read',
    'designer:read',
    'dashboards:read',
    'reports:read', 'reports:generate',
    'events:read',
    'log:read', 'log:write',
    'rounds:read', 'rounds:execute', 'rounds:transfer', 'rounds:template_manage', 'rounds:schedule_manage', 'rounds:export',
    'settings:read',
    'alerts:read', 'alerts:acknowledge',
    'shifts:read', 'alert_groups:read',
    'system:monitor', 'system:point_config',
    'system:import_history'
)
WHERE r.name = 'Maintenance Technician'
ON CONFLICT DO NOTHING;

-- Safety Officer: safety/environmental focused
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.name IN (
    'console:read',
    'process:read',
    'dashboards:read',
    'reports:read', 'reports:generate', 'reports:export',
    'forensics:read', 'forensics:search', 'forensics:export',
    'events:read', 'events:acknowledge',
    'log:read', 'log:export',
    'rounds:read', 'rounds:export',
    'settings:read',
    'alerts:read', 'alerts:acknowledge', 'alerts:muster',
    'shifts:read', 'presence:read', 'muster:manage', 'alert_groups:read',
    'system:monitor', 'system:view_logs'
)
WHERE r.name = 'Safety Officer'
ON CONFLICT DO NOTHING;

-- Data Steward: import/export and point config focused
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.name IN (
    'console:read',
    'process:read',
    'dashboards:read',
    'reports:read', 'reports:generate', 'reports:export',
    'events:read',
    'log:read',
    'rounds:read',
    'settings:read', 'settings:export',
    'alerts:read',
    'shifts:read',
    'system:monitor', 'system:point_config', 'system:point_deactivate', 'system:expression_manage',
    'system:import_connections', 'system:import_definitions', 'system:import_execute', 'system:import_history',
    'system:bulk_update', 'system:change_backup', 'system:change_restore',
    'system:data_link_config', 'system:point_detail_config',
    'system:export_data'
)
WHERE r.name = 'Data Steward'
ON CONFLICT DO NOTHING;

-- Default data categories (9 predefined)
INSERT INTO data_categories (name, description, is_predefined) VALUES
    ('Process',        'Real-time process data from control systems',     true),
    ('Event',          'System and process events and alarms',             true),
    ('Access Control', 'Physical access and security data',               true),
    ('Personnel',      'Staff and personnel information',                  true),
    ('Financial',      'Cost and financial operational data',             true),
    ('Maintenance',    'Equipment maintenance and work orders',            true),
    ('Ticketing',      'Work tickets and task management',                 true),
    ('Environmental',  'Environmental monitoring data',                    true),
    ('General',        'Uncategorized or general-purpose data',           true)
ON CONFLICT (name) DO NOTHING;

-- Default alert channels (disabled by default — configured at setup time)
INSERT INTO alert_channels (channel_type, display_name, enabled, config) VALUES
    ('in_app',        'In-App Notification',     true,  '{}'),
    ('email',         'Email',                   false, '{}'),
    ('sms',           'SMS',                     false, '{}'),
    ('push',          'Push Notification',        false, '{}'),
    ('webhook',       'Webhook',                  false, '{}'),
    ('teams',         'Microsoft Teams',          false, '{}'),
    ('slack',         'Slack',                    false, '{}')
ON CONFLICT (channel_type) DO NOTHING;

-- Default "Manual Entry" point source
INSERT INTO point_sources (id, name, source_type, status, description, enabled)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    'Manual Entry',
    'manual',
    'active',
    'Built-in source for manually entered data points.',
    true
)
ON CONFLICT (id) DO NOTHING;

-- Default admin user (password: changeme — MUST be changed on first login)
-- Argon2id hash of 'changeme' — generated at build time by api-gateway seed command
-- Placeholder: replaced by application-generated hash at runtime
INSERT INTO users (id, username, password_hash, email, full_name, enabled)
VALUES (
    '00000000-0000-0000-0000-000000000002',
    'admin',
    '$argon2id$v=19$m=19456,t=2,p=1$PLACEHOLDER_HASH_CHANGEME',
    'admin@localhost',
    'System Administrator',
    true
)
ON CONFLICT (username) DO NOTHING;

-- Assign Admin role to default admin user
INSERT INTO user_roles (user_id, role_id)
SELECT
    '00000000-0000-0000-0000-000000000002',
    r.id
FROM roles r WHERE r.name = 'Admin'
ON CONFLICT DO NOTHING;

-- Operational settings
INSERT INTO settings (key, value, description) VALUES
    -- Point management
    ('point_source_stale_threshold_hours',       '"24"',  'Hours without being seen before a point is considered stale'),
    ('point_metadata_refresh_interval_minutes',  '"60"',  'How often connector services re-browse source metadata'),
    ('point_backfill_enabled',                   '"true"','Whether to auto-trigger backfill on point reactivation'),
    ('point_backfill_max_lookback_days',         '"30"',  'Maximum number of days to look back during backfill'),
    -- Events / Alarms
    ('alarm_eval_interval_seconds',              '"10"',  'How often the I/O alarm evaluation engine checks threshold and expression alarms'),
    ('alarm_shelve_max_duration_hours',          '"24"',  'Maximum duration an alarm can be shelved (ISA-18.2 compliance)'),
    ('alarm_shelve_default_duration_minutes',    '"60"',  'Default shelve duration when operator does not specify'),
    ('event_retention_days',                     '"2555"','Days to retain events before archival (7 years default for regulatory compliance)'),
    ('alarm_chattering_threshold',               '"5"',   'Number of state transitions in 60 seconds before an alarm is flagged as chattering'),
    -- Rounds
    ('rounds_gps_proximity_meters',              '"50"',  'Maximum distance from checkpoint GPS coordinate for location verification'),
    ('rounds_transfer_timeout_seconds',          '"60"',  'Seconds to wait for acknowledgment before auto-transferring a round to a new user'),
    ('rounds_photo_max_size_mb',                 '"10"',  'Maximum upload size for round checkpoint photos'),
    ('rounds_video_max_duration_seconds',        '"120"', 'Maximum recording duration for round checkpoint videos'),
    -- Logs
    ('log_auto_create_on_shift_start',           '"true"','Automatically create log instances from templates when a shift begins'),
    -- Forensics
    ('forensics_max_correlation_points',         '"50"',  'Maximum number of points in a single correlation analysis'),
    ('forensics_max_time_window_days',           '"30"',  'Maximum time window for forensic analysis queries'),
    ('forensics_result_cache_ttl_seconds',       '"60"',  'Time-to-live for cached correlation results'),
    -- Tile rendering
    ('tile_auto_regenerate_on_save',             '"true"','Automatically regenerate tile pyramids when a graphic is saved in the Designer'),
    ('tile_max_zoom_level',                      '"5"',   'Maximum zoom level for tile pyramid generation (0 = overview, 5 = full detail)'),
    -- OPC
    ('opc.minimum_publish_interval_ms',          '"1000"','Global minimum OPC UA publish interval in milliseconds (min: 100)'),
    -- Backup
    ('backup_enabled',                           '"true"','Whether automated scheduled backups are enabled'),
    ('backup_include_uploads',                   '"true"','Include uploaded files (SVGs, photos, attachments) in backups'),
    -- Seed version tracking
    ('seed_version_tier1',                       '"1"',   'Bootstrap seed data version'),
    ('seed_version_tier2',                       '"0"',   'Content seed data version (0 = not yet loaded)')
ON CONFLICT (key) DO NOTHING;
