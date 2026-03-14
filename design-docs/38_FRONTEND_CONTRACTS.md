# Inside/Operations — Frontend Contracts

## Purpose

This document defines the **concrete frontend contracts** that prevent implementation drift between modules. When different LLM instances build different React modules, both reference this document to guarantee consistent routing, permission enforcement, and visual theming.

Doc 06 (Frontend Shell) describes the high-level design philosophy, navigation, and theming architecture. Doc 37 (IPC Contracts) defines the backend wire formats and TypeScript type parity. This document sits between them — specifying the frontend's internal contracts that every module must follow.

---

## 1. Route Map & Permission Guard Registry

Every route in the application is listed here. No ad-hoc routes. The React Router configuration (`src/routes.tsx`) must match this table exactly.

**Implementation:** A `RouteConfig[]` array in `src/shared/routes/registry.ts` drives both the router and the sidebar. The `PermissionGuard` wrapper component checks the user's permissions before rendering the route component. If the user lacks the required permission, they see a "403 — Insufficient Permissions" page (not a redirect to login).

### Route Registry

```typescript
interface RouteConfig {
  path: string;                    // React Router path pattern
  component: string;               // Lazy-loaded module component
  permission: string | null;       // Required permission (null = authenticated only)
  sidebar_group: SidebarGroup;     // Which sidebar section
  sidebar_label: string;           // Display label in sidebar
  sidebar_icon: string;            // Lucide icon name
  g_key: string;                   // G-key navigation shortcut
  breadcrumb_root: string;         // First breadcrumb segment
  mobile: boolean;                 // Available on mobile PWA
}

type SidebarGroup = 'monitoring' | 'analysis' | 'operations' | 'management';
```

### Complete Route Table

#### Module Root Routes

| Path | Component | Permission | Sidebar | G-Key | Mobile |
|------|-----------|-----------|---------|-------|--------|
| `/console` | `ConsoleModule` | `console:read` | Monitoring / Console | `G C` | No |
| `/process` | `ProcessModule` | `process:read` | Monitoring / Process | `G P` | No |
| `/dashboards` | `DashboardsModule` | `dashboards:read` | Analysis / Dashboards | `G B` | No |
| `/reports` | `ReportsModule` | `reports:read` | Analysis / Reports | `G R` | No |
| `/forensics` | `ForensicsModule` | `forensics:read` | Analysis / Forensics | `G F` | No |
| `/log` | `LogModule` | `log:read` | Operations / Log | `G L` | Yes |
| `/rounds` | `RoundsModule` | `rounds:read` | Operations / Rounds | `G O` | Yes |
| `/alerts` | `AlertsModule` | `alerts:read` | Operations / Alerts | `G A` | No |
| `/shifts` | `ShiftsModule` | `shifts:read` | Management / Shifts | `G H` | No |
| `/settings` | `SettingsModule` | `settings:read` | Management / Settings | `G S` | No |
| `/designer` | `DesignerModule` | `designer:read` | Management / Designer | `G D` | No |

#### Console Sub-Routes

| Path | Component | Permission | Breadcrumb |
|------|-----------|-----------|------------|
| `/console` | `WorkspaceList` | `console:read` | Console |
| `/console/:workspace_id` | `WorkspaceView` | `console:read` | Console > {workspace_name} |
| `/console/:workspace_id/edit` | `WorkspaceEditor` | `console:write` | Console > {workspace_name} > Edit |

#### Process Sub-Routes

| Path | Component | Permission | Breadcrumb |
|------|-----------|-----------|------------|
| `/process` | `ProcessViewList` | `process:read` | Process |
| `/process/:view_id` | `ProcessView` | `process:read` | Process > {view_name} |
| `/process/:view_id/edit` | `ProcessEditor` | `process:write` | Process > {view_name} > Edit |

#### Designer Sub-Routes

| Path | Component | Permission | Breadcrumb |
|------|-----------|-----------|------------|
| `/designer` | `DesignerBrowser` | `designer:read` | Designer |
| `/designer/graphics` | `GraphicsList` | `designer:read` | Designer > Graphics |
| `/designer/graphics/new` | `GraphicEditor` | `designer:write` | Designer > Graphics > New |
| `/designer/graphics/:id/edit` | `GraphicEditor` | `designer:write` | Designer > Graphics > {name} > Edit |
| `/designer/dashboards` | `DashboardDesignerList` | `designer:read` | Designer > Dashboards |
| `/designer/dashboards/new` | `DashboardEditor` | `dashboards:write` | Designer > Dashboards > New |
| `/designer/dashboards/:id/edit` | `DashboardEditor` | `dashboards:write` | Designer > Dashboards > {name} > Edit |
| `/designer/reports` | `ReportDesignerList` | `designer:read` | Designer > Reports |
| `/designer/reports/new` | `ReportEditor` | `reports:write` | Designer > Reports > New |
| `/designer/reports/:id/edit` | `ReportEditor` | `reports:write` | Designer > Reports > {name} > Edit |
| `/designer/import` | `ImportWizard` | `designer:import` | Designer > Import |
| `/designer/symbols` | `SymbolLibrary` | `designer:read` | Designer > Symbol Library |

#### Dashboards Sub-Routes

| Path | Component | Permission | Breadcrumb |
|------|-----------|-----------|------------|
| `/dashboards` | `DashboardList` | `dashboards:read` | Dashboards |
| `/dashboards/:id` | `DashboardView` | `dashboards:read` | Dashboards > {name} |

#### Reports Sub-Routes

| Path | Component | Permission | Breadcrumb |
|------|-----------|-----------|------------|
| `/reports` | `ReportList` | `reports:read` | Reports |
| `/reports/templates` | `ReportTemplateList` | `reports:read` | Reports > Templates |
| `/reports/generate/:template_id` | `ReportGenerator` | `reports:generate` | Reports > Generate > {template_name} |
| `/reports/history` | `ReportHistory` | `reports:read` | Reports > History |
| `/reports/schedules` | `ReportScheduleList` | `reports:schedule_manage` | Reports > Schedules |

#### Forensics Sub-Routes

| Path | Component | Permission | Breadcrumb |
|------|-----------|-----------|------------|
| `/forensics` | `InvestigationList` | `forensics:read` | Forensics |
| `/forensics/new` | `InvestigationEditor` | `forensics:write` | Forensics > New Investigation |
| `/forensics/:id` | `InvestigationView` | `forensics:read` | Forensics > {name} |
| `/forensics/:id/edit` | `InvestigationEditor` | `forensics:write` | Forensics > {name} > Edit |

#### Log Sub-Routes

| Path | Component | Permission | Breadcrumb |
|------|-----------|-----------|------------|
| `/log` | `LogFeed` | `log:read` | Log |
| `/log/new` | `LogEntryEditor` | `log:write` | Log > New Entry |
| `/log/:id` | `LogEntryView` | `log:read` | Log > {entry_title} |
| `/log/:id/edit` | `LogEntryEditor` | `log:write` | Log > {entry_title} > Edit |
| `/log/templates` | `LogTemplateList` | `log:template_manage` | Log > Templates |
| `/log/schedules` | `LogScheduleList` | `log:schedule_manage` | Log > Schedules |

#### Rounds Sub-Routes

| Path | Component | Permission | Breadcrumb |
|------|-----------|-----------|------------|
| `/rounds` | `RoundsDashboard` | `rounds:read` | Rounds |
| `/rounds/active` | `ActiveRoundsList` | `rounds:read` | Rounds > Active |
| `/rounds/:instance_id/execute` | `RoundExecution` | `rounds:execute` | Rounds > {template_name} > Execute |
| `/rounds/templates` | `RoundTemplateList` | `rounds:template_manage` | Rounds > Templates |
| `/rounds/templates/:id/edit` | `RoundTemplateEditor` | `rounds:template_manage` | Rounds > Templates > {name} > Edit |
| `/rounds/schedules` | `RoundScheduleList` | `rounds:schedule_manage` | Rounds > Schedules |
| `/rounds/history` | `RoundHistory` | `rounds:read` | Rounds > History |

#### Alerts Sub-Routes

| Path | Component | Permission | Breadcrumb |
|------|-----------|-----------|------------|
| `/alerts` | `AlertsDashboard` | `alerts:read` | Alerts |
| `/alerts/active` | `ActiveAlertsList` | `alerts:read` | Alerts > Active |
| `/alerts/history` | `AlertHistory` | `alerts:read` | Alerts > History |
| `/alerts/send` | `AlertComposer` | `alerts:send` | Alerts > Send |
| `/alerts/templates` | `AlertTemplateList` | `alerts:manage_templates` | Alerts > Templates |
| `/alerts/groups` | `AlertGroupList` | `alerts:manage_groups` | Alerts > Groups |
| `/alerts/muster` | `MusterDashboard` | `alerts:muster` | Alerts > Muster |

#### Shifts Sub-Routes

| Path | Component | Permission | Breadcrumb |
|------|-----------|-----------|------------|
| `/shifts` | `ShiftsDashboard` | `shifts:read` | Shifts |
| `/shifts/schedule` | `ShiftSchedule` | `shifts:read` | Shifts > Schedule |
| `/shifts/schedule/edit` | `ShiftScheduleEditor` | `shifts:write` | Shifts > Schedule > Edit |
| `/shifts/crews` | `CrewList` | `shifts:read` | Shifts > Crews |
| `/shifts/presence` | `PresenceBoard` | `presence:read` | Shifts > Presence |
| `/shifts/muster-points` | `MusterPointConfig` | `muster:manage` | Shifts > Muster Points |

#### Settings Sub-Routes

| Path | Component | Permission | Breadcrumb |
|------|-----------|-----------|------------|
| `/settings` | `SettingsDashboard` | `settings:read` | Settings |
| `/settings/users` | `UserManagement` | `system:manage_users` | Settings > Users |
| `/settings/users/:id` | `UserDetail` | `system:manage_users` | Settings > Users > {username} |
| `/settings/groups` | `GroupManagement` | `system:manage_groups` | Settings > Groups |
| `/settings/roles` | `RoleManagement` | `system:manage_roles` | Settings > Roles |
| `/settings/auth` | `AuthProviderConfig` | `auth:configure` | Settings > Authentication |
| `/settings/sources` | `DataSourceList` | `system:source_config` | Settings > Data Sources |
| `/settings/sources/:id` | `DataSourceDetail` | `system:source_config` | Settings > Data Sources > {name} |
| `/settings/opc` | `OpcConfig` | `system:opc_config` | Settings > OPC UA |
| `/settings/points` | `PointManagement` | `system:point_config` | Settings > Points |
| `/settings/events` | `EventConfig` | `system:event_config` | Settings > Events |
| `/settings/imports` | `ImportManagement` | `system:import_connections` | Settings > Imports |
| `/settings/imports/connections` | `ConnectionList` | `system:import_connections` | Settings > Imports > Connections |
| `/settings/imports/definitions` | `DefinitionList` | `system:import_definitions` | Settings > Imports > Definitions |
| `/settings/imports/history` | `ImportHistory` | `system:import_history` | Settings > Imports > History |
| `/settings/email` | `EmailConfig` | `email:configure` | Settings > Email |
| `/settings/alerts` | `AlertConfig` | `alerts:configure` | Settings > Alert System |
| `/settings/badges` | `BadgeConfig` | `badge_config:manage` | Settings > Badges |
| `/settings/recognition` | `RecognitionConfig` | `settings:admin` | Settings > Recognition |
| `/settings/expressions` | `ExpressionManager` | `system:expression_manage` | Settings > Expressions |
| `/settings/bulk-update` | `BulkUpdateWizard` | `system:bulk_update` | Settings > Bulk Update |
| `/settings/snapshots` | `ChangeSnapshots` | `system:change_backup` | Settings > Snapshots |
| `/settings/backup` | `BackupRestore` | `system:backup` | Settings > Backup |
| `/settings/system-health` | `SystemHealth` | `system:monitor` | Settings > System Health |
| `/settings/sessions` | `SessionManagement` | `system:sessions` | Settings > Sessions |
| `/settings/display` | `DisplayPreferences` | null | Settings > Display |
| `/settings/about` | `AboutPage` | null | Settings > About |

#### Non-Module Routes

| Path | Component | Permission | Notes |
|------|-----------|-----------|-------|
| `/login` | `LoginPage` | (unauthenticated) | Redirect to `/console` if already authenticated |
| `/login/callback` | `OAuthCallback` | (unauthenticated) | OIDC/SAML callback handler |
| `/reset-password` | `PasswordReset` | (unauthenticated) | Password reset flow |
| `/eula` | `EulaAcceptance` | (authenticated, pre-EULA) | EULA acceptance gate |
| `/my-exports` | `MyExports` | null | Export download panel (accessible from any module) |
| `*` | `NotFound` | (any) | 404 page |

### Permission Guard Component

```typescript
// src/shared/components/PermissionGuard.tsx
interface PermissionGuardProps {
  permission: string | null;
  children: React.ReactNode;
}

function PermissionGuard({ permission, children }: PermissionGuardProps) {
  const { user, isAuthenticated } = useAuthStore();

  if (!isAuthenticated) return <Navigate to="/login" />;
  if (!user.eula_accepted) return <Navigate to="/eula" />;
  if (permission && !user.permissions.includes(permission)) return <ForbiddenPage />;

  return <>{children}</>;
}
```

### Sidebar Visibility Rules

The sidebar shows only modules the user has permission to access. Permission checks for sidebar visibility:

| Module | Sidebar Visible When |
|--------|---------------------|
| Console | `console:read` |
| Process | `process:read` |
| Dashboards | `dashboards:read` |
| Reports | `reports:read` |
| Forensics | `forensics:read` |
| Log | `log:read` |
| Rounds | `rounds:read` |
| Alerts | `alerts:read` |
| Shifts | `shifts:read` |
| Settings | `settings:read` |
| Designer | `designer:read` |

If a module is hidden, its G-key shortcut is also disabled. Command palette results for that module are suppressed.

### Default Route After Login

The first visible module in sidebar order becomes the default redirect after login. For most roles this is `/console`. If a user only has `log:read` and `rounds:read`, they land on `/log`.

---

## 2. CSS Design Token Registry

Complete enumeration of every CSS custom property that components may reference. This is the contract between the theme system (doc 06) and every component in the application. Components MUST use these tokens — no raw color values, no hardcoded pixel sizes (except in the token definitions themselves).

**Implementation:** Generated into `:root` (or `[data-theme="dark"]`, `[data-theme="hphmi"]`) by the theme engine in `src/shared/theme/tokens.ts`. The source of truth is the token registry below — the theme engine's output must match this schema exactly.

### Token Naming Convention

```
--io-{category}-{name}[-{variant}]
```

- `io` prefix on everything (namespace isolation)
- Category: `surface`, `text`, `accent`, `border`, `alarm`, `status`, `chart`, `pen`, `space`, `radius`, `shadow`, `text-size` (typography), `btn`, `sidebar`, `topbar`, `card`, `table`
- Variant: optional modifier (e.g., `-hover`, `-active`, `-sm`, `-lg`)

### Layer 3: Semantic Tokens (Complete)

These are the tokens components reference. Every component uses these — never raw values.

#### Surface & Layout (5 tokens)

| Token | Purpose | Light | Dark | HPHMI |
|-------|---------|-------|------|-------|
| `--io-surface-primary` | Main app background | `#FFFFFF` | `#09090B` | `#0F172A` |
| `--io-surface-secondary` | Sidebar, card backgrounds | `#F9FAFB` | `#18181B` | `#1E293B` |
| `--io-surface-elevated` | Modals, popovers, dropdowns | `#FFFFFF` | `#27272A` | `#334155` |
| `--io-surface-sunken` | Input fields, code blocks | `#F3F4F6` | `#09090B` | `#0C1525` |
| `--io-surface-overlay` | Overlay backdrop | `rgba(0,0,0,0.5)` | `rgba(0,0,0,0.7)` | `rgba(0,0,0,0.7)` |

#### Text (5 tokens)

| Token | Purpose | Light | Dark | HPHMI |
|-------|---------|-------|------|-------|
| `--io-text-primary` | Primary content text | `#111827` | `#F9FAFB` | `#E2E8F0` |
| `--io-text-secondary` | Supporting/secondary text | `#6B7280` | `#A1A1AA` | `#94A3B8` |
| `--io-text-muted` | Placeholder, tertiary text | `#9CA3AF` | `#71717A` | `#64748B` |
| `--io-text-inverse` | Text on accent backgrounds | `#FFFFFF` | `#09090B` | `#0F172A` |
| `--io-text-link` | Link text | `=--io-accent` | `=--io-accent` | `=--io-accent` |

#### Accent (5 tokens, Midnight Teal default)

| Token | Purpose | Light | Dark | HPHMI |
|-------|---------|-------|------|-------|
| `--io-accent` | Primary interactive | `--accent-600` | `--accent-400` | `--accent-500` |
| `--io-accent-hover` | Hover state | `--accent-700` | `--accent-300` | `--accent-400` |
| `--io-accent-active` | Pressed state | `--accent-800` | `--accent-200` | `--accent-300` |
| `--io-accent-foreground` | Text on accent bg | `#FFFFFF` | `#09090B` | `#0F172A` |
| `--io-accent-subtle` | Selected row, active tab bg | `--accent-50` | `--accent-950` | `--accent-950` |

#### Borders & Separators (4 tokens)

| Token | Purpose | Light | Dark | HPHMI |
|-------|---------|-------|------|-------|
| `--io-border` | Default border | `#E5E7EB` | `#3F3F46` | `#334155` |
| `--io-border-subtle` | Table cell borders, light separators | `#F3F4F6` | `#27272A` | `#1E293B` |
| `--io-border-strong` | Selected item, emphasized borders | `#D1D5DB` | `#52525B` | `#475569` |
| `--io-focus-ring` | Focus indicator ring | `--accent-500` | `--accent-400` | `--accent-500` |

#### Alarm Priority — ISA-101 / ISA-18.2 (6 tokens, NOT customizable)

These are the process alarm priority colors used on display elements (text readouts, analog bars, fill gauges, alarm indicators). Per ISA-101, equipment shapes do NOT change color for alarms — see doc 19 Point Value Display Elements.

| Token | Purpose | Light | Dark | HPHMI |
|-------|---------|-------|------|-------|
| `--io-alarm-critical` | P1 Critical — Red (ISA-18.2) | `#DC2626` | `#EF4444` | `#EF4444` |
| `--io-alarm-high` | P2 High — Amber (ISA-18.2) | `#D97706` | `#F59E0B` | `#F59E0B` |
| `--io-alarm-medium` | P3 Medium — Yellow (ISA-18.2) | `#CA8A04` | `#EAB308` | `#EAB308` |
| `--io-alarm-advisory` | P4 Advisory — Cyan (ISA-18.2) | `#0891B2` | `#06B6D4` | `#06B6D4` |
| `--io-alarm-custom` | Custom (expression-builder) — Purple | `#6D28D9` | `#7C3AED` | `#7C3AED` |
| `--io-alarm-fault` | Fault — Magenta | `#C026D3` | `#D946EF` | `#D946EF` |

#### Alarm State CSS Classes (NOT tokens — applied directly to display elements)

These classes drive the visual treatment of alarm state (flash, steady, shelved, etc.) on display elements. They combine with alarm priority classes (`.io-alarm-1` through `.io-alarm-4`, `.io-alarm-custom`). See doc 19 for full specification and doc 35 for CSS definitions.

| Class | Purpose |
|-------|---------|
| `.io-unack` | Unacknowledged alarm — 1Hz flash (alarm color ↔ gray) |
| `.io-ack` | Acknowledged alarm — steady alarm color border/background |
| `.io-rtn-unack` | Return-to-normal unacknowledged — dimmed alarm color |
| `.io-shelved` | Shelved — dashed gray border, "S" badge |
| `.io-suppressed` | Suppressed — hidden or reduced opacity |
| `.io-oos-display` | Out of service — strikethrough, "OOS" badge |

#### Data Quality CSS Classes

Applied to display elements when data quality is not Good. Quality overrides alarm appearance when data is bad.

| Class | Purpose |
|-------|---------|
| `.io-quality-stale` | Stale data — dashed outline, 60% opacity |
| `.io-quality-bad` | Bad PV — `????` replacement, red dashed outline |
| `.io-quality-comm-fail` | Communication failure — `COMM` replacement, gray fill, diagonal hatching |
| `.io-quality-uncertain` | Uncertain quality — dotted outline |
| `.io-quality-manual` | Manual/forced value — cyan "M" badge |

#### Graphics Display Elements (4 tokens)

Tokens specific to the 6 point value display element types rendered on graphics (doc 19). These control the baseline appearance of analog bars, fill gauges, digital status pills, and standalone bar elements. Alarm-state rendering uses the Alarm Priority tokens above.

| Token | Purpose | Light | Dark | HPHMI |
|-------|---------|-------|------|-------|
| `--io-fill-normal` | Fill gauge normal level color | `#94A3B8` @ 30% | `#475569` @ 50% | `#475569` @ 50% |
| `--io-display-zone-inactive` | Analog bar inactive zone, digital status normal bg | `#E5E7EB` | `#3F3F46` | `#3F3F46` |
| `--io-display-zone-normal` | Analog bar normal operating zone | `#D1D5DB` | `#404048` | `#404048` |
| `--io-display-zone-border` | Analog bar zone stroke, standalone gauge border | `#D1D5DB` | `#52525B` | `#52525B` |

#### Operational Status (3 tokens)

| Token | Purpose | Light | Dark | HPHMI |
|-------|---------|-------|------|-------|
| `--io-alarm-normal` | Green — within range (sparingly) | `#16A34A` | `#22C55E` | `#22C55E` |
| `--io-alarm-suppressed` | Blue variant — shelved/suppressed | `#7C3AED` | `#A78BFA` | `#A78BFA` |
| `--io-alarm-disabled` | Gray — out of service | `#9CA3AF` | `#71717A` | `#64748B` |

**Runtime alarm CSS variables:** The `.io-alarm-1` through `.io-alarm-custom` CSS classes (defined in doc 35) set two runtime CSS custom properties on alarm indicator and display elements: `--io-alarm-color` (fill) and `--io-alarm-stroke` (stroke). These are NOT theme tokens — they are dynamically assigned from the alarm priority tokens above based on the element's current alarm state. Components that render alarm-colored elements should read `var(--io-alarm-color)` rather than hard-referencing a specific priority token.

#### Semantic Status (5 tokens)

| Token | Purpose | Light | Dark | HPHMI |
|-------|---------|-------|------|-------|
| `--io-danger` | Destructive actions, error states | `#DC2626` | `#EF4444` | `#EF4444` |
| `--io-success` | Completion, confirmation | `#16A34A` | `#22C55E` | `#22C55E` |
| `--io-warning` | Caution messages | `#D97706` | `#F59E0B` | `#F59E0B` |
| `--io-info` | Informational messages, help text | `#2563EB` | `#3B82F6` | `#3B82F6` |
| `--io-text-disabled` | Disabled controls, inactive text | `#D1D5DB` | `#52525B` | `#475569` |

#### Chart & Visualization (5 + 8 pen tokens)

| Token | Purpose | Light | Dark | HPHMI |
|-------|---------|-------|------|-------|
| `--io-chart-bg` | Chart background | `#FFFFFF` | `#18181B` | `#1E293B` |
| `--io-chart-grid` | Grid lines | `#F3F4F6` | `#27272A` | `#1E293B` |
| `--io-chart-axis` | Axis labels and ticks | `#6B7280` | `#A1A1AA` | `#94A3B8` |
| `--io-chart-crosshair` | Crosshair / cursor line | `#9CA3AF` | `#71717A` | `#64748B` |
| `--io-chart-tooltip-bg` | Tooltip background | `#FFFFFF` | `#27272A` | `#1E293B` |

Default trend pen colors (8 pens, selected for maximum visual distinction and colorblind safety):

| Token | Color (all themes) | Notes |
|-------|-------------------|-------|
| `--io-pen-1` | `#2563EB` (Blue) | Primary pen |
| `--io-pen-2` | `#DC2626` (Red) | |
| `--io-pen-3` | `#16A34A` (Green) | |
| `--io-pen-4` | `#D97706` (Amber) | |
| `--io-pen-5` | `#7C3AED` (Purple) | |
| `--io-pen-6` | `#0891B2` (Cyan) | |
| `--io-pen-7` | `#DB2777` (Pink) | |
| `--io-pen-8` | `#65A30D` (Lime) | |

Pen colors are intentionally static across all themes — trend identification should be consistent when switching themes. Users can override individual pen colors per chart in the chart configuration panel.

### Layer 4: Component Tokens (Complete)

Per-component overrides. Components reference these first, falling back to Layer 3 semantics.

#### Button Tokens (6)

| Token | Default Value |
|-------|--------------|
| `--io-btn-bg` | `=--io-accent` |
| `--io-btn-hover` | `=--io-accent-hover` |
| `--io-btn-active` | `=--io-accent-active` |
| `--io-btn-text` | `=--io-accent-foreground` |
| `--io-btn-secondary-bg` | `=--io-surface-secondary` |
| `--io-btn-secondary-border` | `=--io-border` |

#### Sidebar Tokens (5)

| Token | Default Value |
|-------|--------------|
| `--io-sidebar-bg` | `=--io-surface-secondary` |
| `--io-sidebar-width` | `240px` |
| `--io-sidebar-collapsed` | `48px` |
| `--io-sidebar-active-border` | `=--io-accent` |
| `--io-sidebar-hover-bg` | `=--io-accent-subtle` |

#### Top Bar Tokens (3)

| Token | Default Value |
|-------|--------------|
| `--io-topbar-bg` | `=--io-surface-primary` |
| `--io-topbar-height` | `48px` |
| `--io-topbar-border` | `=--io-border-subtle` |

#### Card Tokens (4)

| Token | Default Value |
|-------|--------------|
| `--io-card-bg` | `=--io-surface-secondary` |
| `--io-card-border` | `=--io-border` |
| `--io-card-radius` | `=--io-radius` |
| `--io-card-shadow` | `=--io-shadow-sm` |

#### Table Tokens (6)

| Token | Default Value |
|-------|--------------|
| `--io-table-row-compact` | `28px` |
| `--io-table-row-default` | `36px` |
| `--io-table-row-comfortable` | `44px` |
| `--io-table-header-bg` | `=--io-surface-sunken` |
| `--io-table-row-hover` | `=--io-accent-subtle` |
| `--io-table-row-selected` | `=--io-accent-subtle` |

#### Input Tokens (5)

| Token | Default Value |
|-------|--------------|
| `--io-input-bg` | `=--io-surface-sunken` |
| `--io-input-border` | `=--io-border` |
| `--io-input-focus-border` | `=--io-accent` |
| `--io-input-placeholder` | `=--io-text-muted` |
| `--io-input-height` | `36px` (density-adjusted) |

#### Modal/Dialog Tokens (3)

| Token | Default Value |
|-------|--------------|
| `--io-modal-bg` | `=--io-surface-elevated` |
| `--io-modal-backdrop` | `=--io-surface-overlay` |
| `--io-modal-radius` | `=--io-radius-lg` |

#### Toast/Notification Tokens (3)

| Token | Default Value |
|-------|--------------|
| `--io-toast-bg` | `=--io-surface-elevated` |
| `--io-toast-border` | `=--io-border` |
| `--io-toast-shadow` | `=--io-shadow-lg` |

### Spacing Tokens (17)

Defined in doc 06. Repeated here for completeness:

| Token | Value |
|-------|-------|
| `--io-space-0` | `0px` |
| `--io-space-1` | `4px` |
| `--io-space-2` | `8px` |
| `--io-space-3` | `12px` |
| `--io-space-4` | `16px` |
| `--io-space-5` | `20px` |
| `--io-space-6` | `24px` |
| `--io-space-8` | `32px` |
| `--io-space-10` | `40px` |
| `--io-space-12` | `48px` |
| `--io-space-14` | `56px` |
| `--io-space-16` | `64px` |
| `--io-space-20` | `80px` |
| `--io-space-24` | `96px` |
| `--io-space-32` | `128px` |
| `--io-space-40` | `160px` |
| `--io-space-48` | `192px` |

### Border Radius Tokens (4)

Derived from the Layer 2 "Border Radius" parameter (Sharp=2px, Subtle=6px, Rounded=12px):

| Token | Sharp | Subtle | Rounded |
|-------|-------|--------|---------|
| `--io-radius-sm` | `1px` | `3px` | `6px` |
| `--io-radius` | `2px` | `6px` | `12px` |
| `--io-radius-lg` | `3px` | `9px` | `18px` |
| `--io-radius-full` | `9999px` | `9999px` | `9999px` |

### Shadow Tokens (4)

| Token | Light | Dark / HPHMI |
|-------|-------|-------------|
| `--io-shadow-sm` | `0 1px 2px rgba(0,0,0,0.05)` | `0 1px 2px rgba(0,0,0,0.3)` |
| `--io-shadow` | `0 1px 3px rgba(0,0,0,0.1), 0 1px 2px rgba(0,0,0,0.06)` | `0 1px 3px rgba(0,0,0,0.4), 0 1px 2px rgba(0,0,0,0.3)` |
| `--io-shadow-lg` | `0 10px 15px rgba(0,0,0,0.1), 0 4px 6px rgba(0,0,0,0.05)` | `0 10px 15px rgba(0,0,0,0.5), 0 4px 6px rgba(0,0,0,0.3)` |
| `--io-shadow-none` | `none` | `none` |

### Typography Tokens (16)

Defined in doc 06. Full list for machine consumption:

| Token | Size | Weight | Font |
|-------|------|--------|------|
| `--io-text-4xl` | `2.25rem` (36px) | 600 | Inter |
| `--io-text-3xl` | `1.75rem` (28px) | 600 | Inter |
| `--io-text-2xl` | `1.375rem` (22px) | 600 | Inter |
| `--io-text-xl` | `1.125rem` (18px) | 600 | Inter |
| `--io-text-lg` | `1rem` (16px) | 600 | Inter |
| `--io-text-base` | `0.875rem` (14px) | 400 | Inter |
| `--io-text-sm` | `0.8125rem` (13px) | 400 | Inter |
| `--io-text-xs` | `0.75rem` (12px) | 400 | Inter |
| `--io-text-2xs` | `0.6875rem` (11px) | 400 | Inter |
| `--io-text-label` | `0.75rem` (12px) | 500 | Inter |
| `--io-text-label-sm` | `0.6875rem` (11px) | 500 | Inter |
| `--io-text-value` | `0.875rem` (14px) | 500 | Inter |
| `--io-text-value-lg` | `1.125rem` (18px) | 500 | Inter |
| `--io-text-value-xl` | `1.5rem` (24px) | 500 | Inter |
| `--io-text-code` | `0.8125rem` (13px) | 400 | JetBrains Mono |
| `--io-text-code-sm` | `0.75rem` (12px) | 400 | JetBrains Mono |

### Z-Index Scale (12 tiers)

Hardcoded, not theme-dependent. Prevents z-index wars between modules. Must match doc 06 Z-Index Stacking Order exactly.

| Token | Value | Usage |
|-------|-------|-------|
| `--io-z-base` | `0` | Normal flow content (module content area) |
| `--io-z-panel` | `10` | Inline panels (detail panel, properties panel — push content) |
| `--io-z-sidebar` | `100` | Sidebar (inline and overlay modes) |
| `--io-z-topbar` | `100` | Top bar (inline and overlay modes) |
| `--io-z-edge-hover` | `150` | Edge-hover chevron handles at viewport edges |
| `--io-z-dropdown` | `200` | Dropdowns, popovers, quick view overlay |
| `--io-z-modal` | `300` | Modal dialogs |
| `--io-z-command` | `400` | Command palette (Ctrl+K overlay) |
| `--io-z-visual-lock` | `500` | Visual lock backdrop + auth card |
| `--io-z-kiosk-auth` | `600` | Kiosk-mode authenticated overlay (above lock) |
| `--io-z-toast` | `700` | Toast notifications (above everything except emergency) |
| `--io-z-emergency` | `800` | Emergency alert banner — ALWAYS visible, highest priority |

### Duration Tokens (3)

Easing: `cubic-bezier(0.4, 0, 0.2, 1)` (default), `ease-out` for entries, `ease-in` for exits. Must match doc 06 Animation Speed Tokens.

| Token | Value | Usage |
|-------|-------|-------|
| `--io-duration-fast` | `150ms` | Hover/focus states, tooltip appear |
| `--io-duration-medium` | `250ms` | Sidebar/panel transitions, overlay slide |
| `--io-duration-slow` | `350ms` | Visual lock fade, complex transitions |

### Token Count Summary

| Layer | Category | Count |
|-------|----------|-------|
| Layer 3 | Surface & Layout | 5 |
| Layer 3 | Text | 5 |
| Layer 3 | Accent | 5 |
| Layer 3 | Borders | 4 |
| Layer 3 | Alarm (ISA-101) | 6 |
| Layer 3 | Graphics Display | 4 |
| Layer 3 | Semantic Status | 5 |
| Layer 3 | Chart | 5 |
| Layer 3 | Pen Colors | 8 |
| Layer 4 | Button | 6 |
| Layer 4 | Sidebar | 5 |
| Layer 4 | Top Bar | 3 |
| Layer 4 | Card | 4 |
| Layer 4 | Table | 6 |
| Layer 4 | Input | 5 |
| Layer 4 | Modal | 3 |
| Layer 4 | Toast | 3 |
| Shared | Spacing | 17 |
| Shared | Border Radius | 4 |
| Shared | Shadow | 4 |
| Shared | Typography | 16 |
| Shared | Z-Index | 12 |
| Shared | Duration | 3 |
| **Total** | | **138** |

---

## Change Log

- **v0.4**: Token audit fixes. Added 4 new tokens: `--io-info` (informational blue), `--io-text-disabled` (disabled controls), `--io-chart-crosshair` (cursor line), `--io-chart-tooltip-bg` (tooltip background). Full Light/Dark/HPHMI values for all 4. Documented `--io-alarm-color`/`--io-alarm-stroke` runtime CSS variable pattern (set by alarm CSS classes, not theme tokens). Token count 134 → 138. Semantic Status 3 → 5, Chart 3 → 5.
- **v0.3**: Added Graphics Display Element tokens (4 new): `--io-fill-normal`, `--io-display-zone-inactive`, `--io-display-zone-normal`, `--io-display-zone-border`. Full Light/Dark/HPHMI values for all 4. Token count 130 → 134. These tokens ensure analog bars, fill gauges, and digital status indicators theme correctly across all 3 themes. See doc 19 v1.3 Visual Design Language section.
- **v0.2**: Updated Alarm/Status CSS token registry to align with ISA-18.2 4-level alarm priority scheme (Critical/High/Medium/Advisory). Renamed `--io-alarm-warning` → `--io-alarm-high`, added `--io-alarm-medium`, `--io-alarm-advisory`, `--io-alarm-custom` (purple), `--io-alarm-fault`. Added Alarm State CSS Classes section (`.io-unack`, `.io-ack`, `.io-rtn-unack`, `.io-shelved`, `.io-suppressed`, `.io-oos-display`). Added Data Quality CSS Classes section (`.io-quality-stale`, `.io-quality-bad`, `.io-quality-comm-fail`, `.io-quality-uncertain`, `.io-quality-manual`). See doc 19 v1.2 (Point Value Display Elements), doc 35 v0.29 (State CSS Classes).
- **v0.1**: Initial frontend contracts document. Route map with permission guards for all 11 modules (~80 routes). Permission guard component spec. Sidebar visibility rules. CSS design token registry with complete enumeration of 130 tokens across Layer 3 (semantic), Layer 4 (component), spacing, radius, shadow, typography, z-index, and duration categories. Full hex values for all 3 themes. Token naming convention. Z-index scale matches doc 06 (11 tiers, 0-800). Duration tokens match doc 06 animation speed tokens. Consolidates and extends specifications from docs 06 (Shell), 32 (Shared UI Components), and 37 (IPC Contracts).
