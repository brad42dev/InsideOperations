# UI Source File Inventory

Generated from code inspection. Out-of-scope modules (alerts, dashboards, forensics, log, process, reports, rounds, shifts) are excluded. Shared/specific determination requires evidence; "unknown" when none found.

---

## console-files

| Path | Purpose | Scope |
|------|---------|-------|
| `pages/console/index.tsx` | Main console page: workspace selector, section-based left palette, playback bar assembly | module-specific; no imports from outside console/ except shared/ |
| `pages/console/ConsolePalette.tsx` | Left assets palette listing workspaces, saved charts, and graphics with section-level favorites and view-mode | module-specific; named "Console" throughout |
| `pages/console/WorkspaceView.tsx` | Read-only workspace renderer used in both normal and detached-window contexts | module-specific; file comment names two routes both inside console |
| `pages/console/WorkspaceEditor.tsx` | Stub edit-mode wrapper that routes to WorkspaceGrid via URL param | module-specific; only routes /console/… |
| `pages/console/WorkspaceGrid.tsx` | react-grid-layout canvas that renders panes, handles drag/resize, persists layout | module-specific; imports only from console/ and shared/ |
| `pages/console/WorkspaceGrid.css` | Pane portal animation and RGL margin override styles (spec §5.11) | module-specific; CSS comment names console |
| `pages/console/layout-utils.ts` | Pure layout helpers: slot-finding, compaction, migration, 16+8 preset templates | module-specific; file comment: "shared between workspaceStore and WorkspaceGrid" (both console) |
| `pages/console/types.ts` | PaneType, PaneConfig, GridItem, WorkspaceLayout type definitions for the console module | module-specific; comment says "Console module type definitions" |
| `pages/console/PaneConfigModal.tsx` | Dialog for configuring pane type, point bindings, and chart settings | module-specific; imports `PaneConfig` from console/types |
| `pages/console/PaneErrorBoundary.tsx` | Error boundary that catches render failures inside individual panes | module-specific; prop `paneId` only meaningful in console |
| `pages/console/PaneWrapper.tsx` | Dispatches to the correct pane component (Trend/PointTable/Alarm/Graphic) based on `PaneConfig.type` | module-specific; imports all four pane types from console/panes/ |
| `pages/console/panes/GraphicPane.tsx` | Renders a live SVG graphic in a console pane with WebSocket point subscriptions | module-specific; imports `shared/graphics/SceneRenderer` (shared with other modules but listed here as consumer) |
| `pages/console/panes/TrendPane.tsx` | Chart pane with dual render paths: live uPlot and historical ECharts | module-specific; imports `shared/components/charts/` (shared infrastructure) |
| `pages/console/panes/PointTablePane.tsx` | Tabular real-time point value display with historical playback support | module-specific; imports shared hooks useWebSocket, useHistoricalValues |
| `pages/console/panes/AlarmListPane.tsx` | Live alarm list filtered to workspace-configured points with WS subscription | module-specific; also uses `shared/clipboard` (shared infrastructure) |
| `pages/console/clipboard/consoleCopyHandler.ts` | Builds clipboard payload from the active console selection zone | module-specific; named "console" and imports from store/workspaceStore |
| `pages/console/clipboard/consoleCutHandler.ts` | Cuts selected panes from the workspace grid to clipboard | module-specific; named "console"; imports workspaceStore |
| `pages/console/clipboard/consolePasteTarget.ts` | Paste target adding panes to the workspace grid from clipboard contents | module-specific; named "console"; imports workspaceStore |
| `pages/console/clipboard/TemporaryGraphicPane.tsx` | Temporary pane that materializes a pasted graphic layout | module-specific; only used in console clipboard flow |
| `pages/console/clipboard/temporaryGraphicStore.ts` | In-memory Map store for temporary clipboard graphic content keyed by pane ID | module-specific; only referenced by TemporaryGraphicPane |
| `store/workspaceStore.ts` | Console module workspace state with undo/redo via zundo (50 steps), layout and edit mode | module-specific; file comment: "Console module workspace state" |
| `store/selectionStore.ts` | Console module ephemeral pane selection state: selectedPaneIds, selectionRect | module-specific; file comment: "Console module ephemeral pane selection state" |
| `store/realtimeStore.ts` | Console module point value buffer and WebSocket subscription registry | module-specific; file comment: "Console module real-time point value buffer" |
| `api/console.ts` | REST client for workspace CRUD and version history endpoints | module-specific; all exports are workspace-domain types |
| `shared/hooks/useConsoleFavorites.ts` | Generic favorites persister for Console palette sections (server-side via preferences API) | module-specific by name and comment ("console-implementation-spec.md"); physically in `shared/hooks/` by directory convention |
| `shared/hooks/useConsolePanelResize.ts` | Persists Console assets panel width in localStorage | module-specific by name and comment; physically in `shared/hooks/` |
| `shared/hooks/useConsoleSectionFavorites.ts` | Persists favorited item IDs for a given Console palette section server-side | module-specific by name and comment; physically in `shared/hooks/` |
| `shared/hooks/useConsoleSectionHeight.ts` | Persists per-section palette heights in localStorage | module-specific by name and comment; physically in `shared/hooks/` |
| `shared/hooks/useConsoleSectionViewMode.ts` | Persists per-section view mode (list/thumbnails/grid) in localStorage | module-specific by name and comment; physically in `shared/hooks/` |
| `shared/hooks/useConsoleWorkspaceFavorites.ts` | Persists favorited workspace IDs server-side via preferences API | module-specific by name and comment; physically in `shared/hooks/` |

---

## designer-files

| Path | Purpose | Scope |
|------|---------|-------|
| `pages/designer/index.tsx` | Main designer orchestrator: layout composition for Graphic/Dashboard/Report modes | module-specific; file comment describes Designer page routes |
| `pages/designer/DesignerHome.tsx` | Landing screen that redirects to the active tab or the graphics list | module-specific; imports tabStore from store/designer/ |
| `pages/designer/DesignerGraphicsList.tsx` | Paginated list of graphics with create/rename/delete/duplicate context menu | module-specific; imports graphicsApi and designer types |
| `pages/designer/DesignerDashboardsList.tsx` | Dashboard list rendered in the Designer breadcrumb context; comment: "reached via /designer/dashboards" | shared with out-of-scope Dashboards module (imports `api/dashboards`); note: dashboards module is out-of-scope |
| `pages/designer/DesignerReportsList.tsx` | Report template list with create/rename/delete/duplicate context menu in Designer context | shared with out-of-scope Reports module (imports `api/reports`); note: reports module is out-of-scope |
| `pages/designer/DesignerImport.tsx` | 6-step wizard for importing DCS graphics with tag mapping (file comment names 6 steps) | module-specific; imports `api/dcsImport` |
| `pages/designer/DesignerCanvas.tsx` | SVG canvas with FSM interaction for select/draw/pan/pipe tools; Mode B selection via interactionRef | module-specific; file comment: "main SVG canvas for the Designer module"; imports sceneStore |
| `pages/designer/DesignerLeftPalette.tsx` | Mode-dependent left palette: shapes/stencils/display elements/widgets/points | module-specific; file comment names all three Designer modes |
| `pages/designer/DesignerRightPanel.tsx` | Context-sensitive property inspector with Layout/Style/Data/Shape/Content/Doc tabs | module-specific; file comment: "Designer module" |
| `pages/designer/DesignerToolbar.tsx` | Mode-aware horizontal toolbar for file/edit/view/tool actions | module-specific; file comment: "mode-aware: different tool sets for graphic / dashboard / report modes" |
| `pages/designer/DesignerTabBar.tsx` | Multi-document tab bar with modified-dot indicator, close button, and active tab highlight | module-specific; file comment: "DesignerTabBar — Horizontal tab bar placed between the toolbar and canvas" |
| `pages/designer/DesignerModeTabs.tsx` | 36px mode-tab bar for Graphic/Dashboard/Report + File dropdown menu | module-specific; file comment names all three modes |
| `pages/designer/DesignerStatusBar.tsx` | 28px status bar showing WS status, binding summary, grid size, zoom | module-specific; file comment: "28px status bar at the very bottom of the Designer area" |
| `pages/designer/SymbolLibrary.tsx` | Symbol/shape library management page at /designer/symbols | module-specific; comment: "Symbol Library page — Designer module" |
| `pages/designer/clipboard/designerCopyHandler.ts` | Builds clipboard payload from selected scene nodes with point and style extraction | module-specific; imports sceneStore from store/designer/ |
| `pages/designer/clipboard/designerPasteTarget.ts` | Paste target inserting scene nodes with offset; imports sceneStore | module-specific; imports sceneStore from store/designer/ |
| `pages/designer/components/canvasPresets.tsx` | Canvas sizing presets for New Graphic and Canvas Properties dialogs | module-specific; file comment: "Shared canvas sizing presets … for the New Graphic dialog and Canvas Properties dialog" (designer-internal shared) |
| `pages/designer/components/CanvasPropertiesDialog.tsx` | Dialog for canvas width/height with proportion lock and presets | module-specific; file comment: "Floating dialog for canvas properties" in Designer |
| `pages/designer/components/CategoryShapeWizard.tsx` | Multi-step wizard for configuring an equipment category shape on drop | module-specific; file comment: "Multi-step shape configuration wizard opened when an equipment category tile is dragged from the left palette" |
| `pages/designer/components/IographicExportDialog.tsx` | Dialog to export current graphic as a .iographic ZIP package | module-specific; file comment names .iographic format |
| `pages/designer/components/IographicImportWizard.tsx` | 5-step wizard for importing a .iographic package (file comment names 5 steps) | module-specific; file comment names .iographic format |
| `pages/designer/components/PointPickerModal.tsx` | Designer-specific inline point picker with OPC tree browse and tag search | module-specific; imports `api/points` but is only used inside pages/designer/ |
| `pages/designer/components/PromoteToShapeWizard.tsx` | 8-step wizard to promote selected SVG elements into a reusable I/O shape | module-specific; file comment: "8-step wizard to promote selected elements into a full I/O equipment shape" |
| `pages/designer/components/RecognitionWizard.tsx` | Multi-step P&ID/DCS symbol recognition wizard (upload → review → generate) | module-specific; file comment names Designer context; imports `api/recognition` (also used by settings/Recognition.tsx — note shared API) |
| `pages/designer/components/SaveAsStencilDialog.tsx` | Dialog to save selected elements as a named reusable stencil | module-specific; file comment: "Modal dialog for saving selected elements as a stencil" |
| `pages/designer/components/ShapeDropDialog.tsx` | 2-step dialog for variant selection and point binding when dropping a shape | module-specific; file comment: "2-step dialog opened when a specific shape is dropped from the shape library panel" |
| `pages/designer/components/ShapePointSelector.tsx` | Reusable left-list + right-slot point assignment panel for shape placement wizards | module-specific; file comment says "for shape placement and configuration wizards" (designer-internal shared) |
| `pages/designer/components/ShapeThumbnail.tsx` | Renders a cached SVG thumbnail for a given shape ID | module-specific; imports libraryStore from store/designer/ |
| `pages/designer/components/TabClosePrompt.tsx` | Save/Discard/Cancel modal when closing a modified tab | module-specific; file comment: "shown when closing a modified tab" (designer tab) |
| `pages/designer/components/ValidateBindingsDialog.tsx` | Lists unresolved point bindings with element ID and reason | module-specific; interface UnresolvedBinding is designer-specific |
| `pages/designer/components/VersionHistoryDialog.tsx` | Thin wrapper delegating to shared VersionRecoveryDialog for graphic version history | shared; imports `shared/components/versioning/VersionRecoveryDialog` (import path evidence) |
| `store/designer/sceneStore.ts` | Scene graph store: single source of truth holding GraphicDocument, executes commands | module-specific; file comment: "THE single source of truth for the Designer module" |
| `store/designer/historyStore.ts` | Undo/redo command stack paired with sceneStore | module-specific; file comment: "Undo/redo history for the Designer scene graph" |
| `store/designer/tabStore.ts` | Multi-tab state: open graphics, active tab, per-tab saved scene snapshots | module-specific; file comment: "Tab state management for the Designer module" |
| `store/designer/uiStore.ts` | Ephemeral designer UI state: active tool, viewport position, zoom, selection | module-specific; file comment: "All transient UI state for the Designer module. This store NEVER touches the scene graph" |
| `store/designer/libraryStore.ts` | Shape library cache: fetches shape index once and loads SVG+sidecar on demand | module-specific; file comment: "Shape library cache for the Designer module" |
| `store/designer/index.ts` | Barrel export for all designer stores and utilities | module-specific; file comment: "Designer store barrel export" |
| `api/graphics.ts` | REST client for graphic document CRUD, versioning, and shape lookup | shared; imported by `pages/console/panes/GraphicPane.tsx` (console) and `pages/designer/` (designer) |
| `api/dashboards.ts` | REST client for dashboard CRUD and playlist management | shared; imported by DesignerDashboardsList (designer) and out-of-scope dashboards module |
| `api/reports.ts` | REST client for report template CRUD, schedules, and export presets | shared; imported by DesignerReportsList (designer) and out-of-scope reports module |
| `api/dcsImport.ts` | REST client for DCS graphics import workflow (upload, parse, preview, tag map, convert) | module-specific; imported only by `pages/designer/DesignerImport.tsx` |
| `shared/graphics/clipboardStore.ts` | Deprecated v1 designer clipboard compatibility shim (file comment: "@deprecated … used by DesignerCanvas, commands") | module-specific per file comment; physically in `shared/graphics/` but designated for designer callers |

---

## settings-files

| Path | Purpose | Scope |
|------|---------|-------|
| `pages/settings/index.tsx` | Settings shell with left-nav groups and nested sub-route outlet | module-specific; renders NavLink groups for settings sub-pages |
| `pages/settings/SettingsPageLayout.tsx` | Common title/description/action header layout wrapper for settings pages | module-specific; only imported within pages/settings/ |
| `pages/settings/settingsStyles.ts` | Shared inline style constants (inputStyle, labelStyle, button variants) for settings pages | module-specific; only imported within pages/settings/ |
| `pages/settings/IdentityAccess.tsx` | Tabbed container for Users/Roles/Groups sub-pages | module-specific; imports Users, Roles, Groups from same directory |
| `pages/settings/Users.tsx` | User management CRUD: create, edit, delete with context menu and UserDetail modal | module-specific; imports `api/users` |
| `pages/settings/UserDetail.tsx` | User detail modal: roles, groups, active sessions, profile edit | module-specific; imports `api/users` and `api/sessions` |
| `pages/settings/Groups.tsx` | User group management CRUD with membership editing | module-specific; imports `api/groups` |
| `pages/settings/Roles.tsx` | Role definitions CRUD with permission assignment checkbox matrix | module-specific; imports `api/roles` |
| `pages/settings/OpcSources.tsx` | OPC-UA data source CRUD with certificate management | module-specific; imports `api/opcCerts` |
| `pages/settings/PointManagement.tsx` | Point tagging, archival, and metadata management with clipboard copy support | module-specific; imports settingsCopyHandler from same clipboard/ dir |
| `pages/settings/EventConfig.tsx` | ISA-18.2 alarm definition CRUD and event configuration (comment: "informational reference + alarm definitions CRUD") | shared; imports `api/alarms` (also used by console AlarmListPane) |
| `pages/settings/AlertConfig.tsx` | Navigation links to Alerts module sub-pages for template and group management | shared; comment: "links to the Alerts module sub-pages" (out-of-scope module) |
| `pages/settings/Badges.tsx` | Badge reader integration informational page; comment: "server-side configuration, Phase 15" | module-specific; no substantive API calls |
| `pages/settings/BulkUpdate.tsx` | Bulk point tag and metadata update with CSV upload and snapshot gating | module-specific; imports `api/bulkUpdate` |
| `pages/settings/Snapshots.tsx` | Database snapshot CRUD: create, list, restore, download | module-specific; imports snapshotsApi (from `api/system.ts`) |
| `pages/settings/ArchiveSettings.tsx` | Archive cold-storage configuration: tier thresholds and compression | module-specific; imports `api/client` directly for settings endpoints |
| `pages/settings/SystemHealth.tsx` | Service health, disk, and memory monitoring tabs | module-specific; imports `api/client` and `api/health` |
| `pages/settings/BackupRestore.tsx` | Full database backup/restore with token-authenticated file download | module-specific; imports `api/client` directly |
| `pages/settings/About.tsx` | System version info and license dependency table | module-specific; imports `api/system` |
| `pages/settings/AuthProviders.tsx` | SSO provider CRUD (OIDC, SAML, LDAP, local) with test/fetch controls | shared; imports `api/authProviders` (also imported by Login.tsx) |
| `pages/settings/MfaSettings.tsx` | MFA enforcement policy administration with method management | shared; imports `api/settings`; mfaApi is also used by Profile/SecurityTab |
| `pages/settings/ScimTokens.tsx` | SCIM provisioning token management | module-specific; imports `api/scim` |
| `pages/settings/Email.tsx` | Email provider configuration with SMTP settings and template management | module-specific; imports `api/email` |
| `pages/settings/SmsProviders.tsx` | SMS provider CRUD for alert delivery configuration | module-specific; imports `api/smsProviders` |
| `pages/settings/Certificates.tsx` | X.509 certificate upload and management | module-specific; imports `api/client` directly for cert endpoints |
| `pages/settings/ExpressionLibrary.tsx` | Named expression library CRUD with ExpressionBuilder integration | module-specific; imports `api/expressions` |
| `pages/settings/ExportPresets.tsx` | Export format preset definitions for reports | shared; imports `api/reports` (also used by designer) |
| `pages/settings/MyExports.tsx` | User's export and video export job history with download links | shared; imports `api/exports` and `api/videoExports` (both also used by shared components) |
| `pages/settings/ReportScheduling.tsx` | Report schedule template CRUD | shared; imports `api/reports` (also used by designer) |
| `pages/settings/Import.tsx` | DCS/CSV import connections, connector definitions, run history, streaming sessions, data links | module-specific; imports `api/import` and `api/dataLinks` |
| `pages/settings/Recognition.tsx` | AI shape recognition model management: upload, activate, test | shared; imports `api/recognition` (also used by designer RecognitionWizard) |
| `pages/settings/CameraStreams.tsx` | Video stream source CRUD for camera chart widget | module-specific; imports `api/videoStreams` |
| `pages/settings/EulaAdmin.tsx` | EULA version management with accept/reject tracking | module-specific; imports `api/client` for EULA admin endpoints |
| `pages/settings/RestorePreviewModal.tsx` | Preview modal for snapshot restore showing affected rows per entity type | module-specific; imports snapshotsApi |
| `pages/settings/StreamingSessions.tsx` | Active import streaming session monitoring; exports a named component used by Import.tsx | module-specific; imports `api/import` |
| `pages/settings/Sessions.tsx` | Active user session list with revoke capability | shared; imports `api/sessions` (also used by Profile/SessionsTab and Settings/UserDetail) |
| `pages/settings/SupplementalConnectorsTab.tsx` | Supplemental connector (third-party import adapter) configuration | module-specific; imports `api/import` |
| `pages/settings/clipboard/settingsCopyHandler.ts` | Builds clipboard payload from selected points in PointManagement | module-specific; named "settings" and imports globalSelectionStore |
| `pages/settings/clipboard/settingsPasteTarget.ts` | Paste target for the PointManagement table | module-specific; file comment: "Paste target for the Settings / Point Management table" |
| `api/settings.ts` | REST client for key-value system settings (MFA policy, EULA config, etc.) | module-specific; imported only from pages/settings/ |
| `api/users.ts` | REST client for user CRUD and role/group membership | module-specific; imported only from pages/settings/ |
| `api/roles.ts` | REST client for role definitions and permission assignment | module-specific; imported only from pages/settings/ |
| `api/groups.ts` | REST client for group CRUD and membership management | module-specific; imported only from pages/settings/ |
| `api/scim.ts` | REST client for SCIM provisioning token management | module-specific; imported only from pages/settings/ScimTokens.tsx |
| `api/email.ts` | REST client for email provider configuration and template management | module-specific; imported only from pages/settings/Email.tsx |
| `api/smsProviders.ts` | REST client for SMS provider CRUD | module-specific; imported only from pages/settings/SmsProviders.tsx |
| `api/opcCerts.ts` | REST client for OPC-UA server certificate management | module-specific; imported only from pages/settings/OpcSources.tsx |
| `api/bulkUpdate.ts` | REST client for bulk point tag/metadata update job management | module-specific; imported only from pages/settings/BulkUpdate.tsx |
| `api/videoStreams.ts` | REST client for video stream source CRUD | module-specific; imported only from pages/settings/CameraStreams.tsx |
| `api/expressions.ts` | REST client for named expression library CRUD | module-specific; imported only from pages/settings/ExpressionLibrary.tsx |
| `api/import.ts` | REST client for connector templates, supplemental connectors, streaming sessions, and import tickets | module-specific; imported by pages/settings/ components and shared/components/MaintenanceTicketsPanel |
| `api/system.ts` | REST client for system info, health, backup/restore, snapshots, and license data | module-specific; imported only from pages/settings/ |
| `api/dataLinks.ts` | REST client for data link CRUD | module-specific; imported only from pages/settings/Import.tsx |

---

## app-shell-files

### Entry and root

| Path | Purpose | Scope |
|------|---------|-------|
| `App.tsx` | Root route tree: lazy-loads all module pages, renders AppShell wrapper, registers ECharts themes | app-shell; imports all module pages as lazy components |
| `main.tsx` | React DOM root: initializes QueryClient, BrowserRouter, polyfills crypto.randomUUID | app-shell; top-level entry point |
| `index.css` | Global CSS: 138 design tokens, Tailwind base, alarm priority colors, typography | app-shell; imported only in main.tsx |
| `vite-env.d.ts` | Vite client type reference and ambient declarations for untyped packages | app-shell; build-time types only |

### Shell layout and navigation

| Path | Purpose | Scope |
|------|---------|-------|
| `shared/layout/AppShell.tsx` | Top bar, collapsible left sidebar, G-key navigation shortcuts, lock screen and emergency alert state | app-shell; wraps all module route outlets |
| `shared/routes/registry.ts` | Route registry driving sidebar groups and G-key map; separate from React Router route tree (file comment) | app-shell; consumed by AppShell for nav rendering |

### Theme

| Path | Purpose | Scope |
|------|---------|-------|
| `shared/theme/ThemeContext.tsx` | Theme provider: active theme name and canvas-compatible color set for all children (file comment) | app-shell; wraps entire app in App.tsx |
| `shared/theme/theme-colors.ts` | JS mirror of chart-relevant CSS token values for ECharts/uPlot canvas rendering (file comment) | app-shell; consumed by chart components across all modules |
| `shared/theme/tokens.ts` | JS mirror of all 138 CSS design tokens applied by setTheme() (file comment) | app-shell; consumed by ThemeContext and theme toggle |
| `shared/theme/echarts-themes.ts` | Three ECharts named theme objects registered at app startup (file comment) | app-shell; registered once in main.tsx |

### Keyboard

| Path | Purpose | Scope |
|------|---------|-------|
| `shared/keyboard/shortcutRegistry.ts` | Per-module keyboard shortcut section data consumed by KeyboardHelpOverlay (file comment) | app-shell; merged with module sections at runtime |

### Global stores

| Path | Purpose | Scope |
|------|---------|-------|
| `store/auth.ts` | JWT auth state, login/logout, token refresh, WebSocket lifecycle | app-shell; imported across all modules |
| `store/ui.ts` | Theme, lock state, emergency alert, kiosk mode, BroadcastChannel sync | app-shell; drives AppShell visual state |
| `store/uomStore.ts` | Application-level unit-of-measure catalog cache (file comment: "fetches once at startup") | app-shell; consumed by chart widgets across modules |
| `store/pointDetailStore.ts` | Shell-level store for pinned PointDetailPanel instances; file comment: "rendered by App.tsx … never unmounted when user navigates" | app-shell; explicitly shell-hosted per comment |
| `store/alarmStore.ts` | Live alarm state buffer updated from WS alarm_state_changed messages | app-shell; consumed by SceneRenderer and console panes |
| `store/globalSelectionStore.ts` | Cross-module selection zone registry and per-zone selection state | app-shell; imported by clipboard infrastructure and all module clipboard handlers |
| `store/playback.ts` | Shared live/historical playback mode state; file comment: "Consumed by Console, Process, and Forensics" | app-shell; shared across multiple modules per comment |
| `store/savedChartsStore.ts` | Saved chart config library cache | app-shell; consumed by ConsolePalette and versioning hooks |
| `store/adminToggleStore.ts` | Admin mode toggle state (show all objects, deleted versions) | app-shell; consumed across designer and versioning |
| `store/useSelectionZone.ts` | Hook to register/unregister a selection zone in globalSelectionStore on mount/unmount | app-shell; imported by all module clipboard targets |

### Lib

| Path | Purpose | Scope |
|------|---------|-------|
| `lib/broadcastSync.ts` | BroadcastChannel sync for theme/auth/lock events across browser tabs (file comment) | app-shell; consumed by store/auth and store/ui |
| `lib/uuid.ts` | RFC 4122 v4 UUID generator that works in HTTP dev contexts (file comment) | app-shell; imported throughout application |

### Shell components

| Path | Purpose | Scope |
|------|---------|-------|
| `shared/components/Toast.tsx` | Radix Toast notification system with imperative showToast() API and notification history | app-shell; imported from many modules |
| `shared/components/CommandPalette.tsx` | Global cmdk command palette with search and navigate | app-shell; rendered in AppShell |
| `shared/components/PermissionGuard.tsx` | RBAC route protection redirecting to login on insufficient permissions | app-shell; wraps all protected routes in App.tsx |
| `shared/components/ErrorBoundary.tsx` | Generic error boundary with optional module label | app-shell; wraps all module route outlets |
| `shared/components/LockOverlay.tsx` | Session lock screen with pointer-events blocking and unlock flow (file comment: "DD-06-011") | app-shell; rendered in AppShell |
| `shared/components/EmergencyAlert.tsx` | Emergency banner driven by ui store emergencyAlert state | app-shell; rendered in AppShell |
| `shared/components/KeyboardHelpOverlay.tsx` | Keyboard shortcuts help overlay shown on '?' press (file comment) | app-shell; rendered in AppShell |
| `shared/components/PopupBlockedBanner.tsx` | Persistent banner with browser-specific popup unblock instructions (file comment: "DD-06-012") | app-shell; rendered in AppShell |
| `shared/components/NotificationHistoryPanel.tsx` | Slide-in drawer showing recent toast history; opened by F8 (file comment) | app-shell; rendered in AppShell |
| `shared/components/SystemHealthDot.tsx` | Service health status indicator dot for the top bar | app-shell; rendered in AppShell top bar |
| `shared/components/PointDetailPanel.tsx` | Floating draggable/resizable/pinnable point detail panel; file comment: "Floating window (not a modal)" rendered shell-level | app-shell; rendered by App.tsx outside route outlet per pointDetailStore comment |
| `shared/components/PointContextMenu.tsx` | Right-click context menu for point references across all modules | app-shell; imported across console and process panes |
| `shared/components/PointsBrowserPanel.tsx` | Infinite-scroll point browser panel with multi-select drag support | app-shell; used in console palette and designer palette |
| `shared/components/PointPicker.tsx` | Tabbed point selector (Browse/Search/Favorites/Recent) used across modules (file comment) | app-shell; shared by designer and console pane config |
| `shared/components/PointPickerModal.tsx` | Modal wrapper around PointPicker; file comment: "Designed for single-select use-cases such as the Dashboard widget config panel" | app-shell; imported in multiple modules |
| `shared/components/PlaceholderPage.tsx` | Generic placeholder page component | app-shell; used for not-yet-implemented routes |
| `shared/components/ConfirmDialog.tsx` | Reusable confirm/cancel modal dialog | app-shell; imported throughout settings, designer, and console |
| `shared/components/ContextMenu.tsx` | React portal-based context menu with submenus and permission gating | app-shell; imported throughout all modules |
| `shared/components/ExportDialog.tsx` | Export dialog supporting sync/async file export jobs | app-shell; imported by console and shared components |
| `shared/components/VideoExportModal.tsx` | Video export configuration modal using playback time range | app-shell; imported in console and settings MyExports |
| `shared/components/Skeleton.tsx` | Shimmer loading skeleton placeholder components | app-shell; used throughout all modules |
| `shared/components/AdminToggle.tsx` | Admin-mode toggle switch shown in admin contexts | app-shell; imported by versioning, palette, and designer |
| `shared/components/SettingsTabs.tsx` | Tab navigation component used in Settings and Profile pages | app-shell; imported by both pages/settings/ and pages/profile/ |
| `shared/components/DataTable.tsx` | Generic sortable data grid built on TanStack Table | app-shell; imported throughout settings and other modules |
| `shared/components/HistoricalPlaybackBar.tsx` | Live/historical playback toggle and scrub bar; file comment: "Used by Console, Process, and Forensics modules" | app-shell; explicitly cross-module per comment |
| `shared/components/ForensicsPlaybackBar.tsx` | Prop-driven scrub bar for Forensics stage snapshot picker (file comment) | app-shell; imported by out-of-scope forensics module |
| `shared/components/MaintenanceTicketsPanel.tsx` | Import maintenance ticket list fetched from api/import | app-shell; used in shell-level panels |
| `shared/components/TileGraphicViewer.tsx` | Leaflet-based tile viewer for phone graphics; file comment: "Used when detectDeviceType() === 'phone' in Console/Process panes" | app-shell; shared between console and out-of-scope process module |
| `shared/components/TimestampOverlay.tsx` | Utility function and component for formatting export timestamps | app-shell; used by export infrastructure |

### Versioning components

| Path | Purpose | Scope |
|------|---------|-------|
| `shared/components/versioning/index.ts` | Barrel export for versioning dialog components | app-shell; consumed by designer and console versioning flows |
| `shared/components/versioning/SaveConfirmDialog.tsx` | Save confirmation dialog with optional version label field | app-shell; used by designer and console |
| `shared/components/versioning/SaveAsDialog.tsx` | Save-as dialog for creating a named copy | app-shell; used by designer and console |
| `shared/components/versioning/PublishConfirmDialog.tsx` | Publish version confirmation dialog | app-shell; used by designer and console |
| `shared/components/versioning/UnpublishConfirmDialog.tsx` | Unpublish version confirmation dialog | app-shell; used by designer and console |
| `shared/components/versioning/DeleteConfirmDialog.tsx` | Delete version confirmation dialog | app-shell; used by designer and console |
| `shared/components/versioning/useVersionActions.ts` | Save/publish/delete version mutations for graphics, workspaces, and charts (imports all three APIs) | app-shell; cross-module per imports: graphicsApi, consoleApi, savedChartsApi |
| `shared/components/versioning/useVersionList.ts` | Fetches and manages version history list for graphics, workspaces, and charts | app-shell; cross-module per imports: graphicsApi, consoleApi, savedChartsApi |
| `shared/components/versioning/VersionActionBar.tsx` | Action buttons row for a selected version (restore, publish, delete) | app-shell; used in VersionRecoveryDialog |
| `shared/components/versioning/VersionListPanel.tsx` | Scrollable version history list with admin toggle | app-shell; used in VersionRecoveryDialog |
| `shared/components/versioning/VersionPreviewPanel.tsx` | Preview pane rendering a historical graphic or workspace snapshot | app-shell; imports SceneRenderer (cross-module) |
| `shared/components/versioning/VersionStatsPanel.tsx` | Stats panel showing version metadata (author, date, type) | app-shell; used in VersionRecoveryDialog |
| `shared/components/versioning/VersionRecoveryDialog.tsx` | Full version history recovery dialog combining list, preview, and actions | app-shell; imported by designer VersionHistoryDialog |
| `shared/components/versioning/versioning-utils.ts` | Timestamp formatting utilities for version history display | app-shell; used within versioning components |

### Expression components

| Path | Purpose | Scope |
|------|---------|-------|
| `shared/components/expression/index.ts` | Barrel export for expression builder components and evaluator | app-shell; imported by settings/ExpressionLibrary and designer/RightPanel |
| `shared/components/expression/ExpressionBuilder.tsx` | Interactive tile-based expression editor with point picker | app-shell; imported by settings and designer |
| `shared/components/expression/ExpressionBuilderModal.tsx` | Modal wrapper around ExpressionBuilder | app-shell; imported across multiple modules |
| `shared/components/expression/ast.ts` | Converts flat infix ExpressionTile array to recursive AST (file comment names doc 23) | app-shell; used by evaluator and server serialization |
| `shared/components/expression/evaluator.ts` | Client-side expression evaluator for live preview; file comment: "Time functions … require server-side eval" | app-shell; used by ExpressionBuilder and expressionBenchmark.worker |
| `shared/components/expression/preview.ts` | Converts ExpressionTile array to human-readable string | app-shell; used by ExpressionBuilder preview panel |
| `shared/components/expression/templates.ts` | Pre-built tile arrays for common expression patterns | app-shell; loaded by ExpressionBuilder on template select |
| `shared/components/expression/clipboard/expressionCopyHandler.ts` | Copy handler for expression tiles to clipboard | app-shell; part of cross-module clipboard infrastructure |
| `shared/components/expression/clipboard/expressionPasteTarget.ts` | Paste target for expression builder from clipboard | app-shell; part of cross-module clipboard infrastructure |

### Chart components

| Path | Purpose | Scope |
|------|---------|-------|
| `shared/components/charts/ChartRenderer.tsx` | Dispatches to one of 45 chart renderers via React.lazy; file comment: "All 39 chart types lazy-loaded" | app-shell; consumed by console TrendPane, designer widget config, and dashboards |
| `shared/components/charts/EChart.tsx` | ECharts instance wrapper with theme synchronization | app-shell; used by ECharts-based chart renderers |
| `shared/components/charts/TimeSeriesChart.tsx` | uPlot-based time-series line chart with portal toolbar | app-shell; used by chart01-live-trend and console TrendPane |
| `shared/components/charts/ChartConfigPanel.tsx` | Chart configuration UI; file comment: "modal or embedded for Designer right panel" | app-shell; consumed by console and designer |
| `shared/components/charts/ChartTypePicker.tsx` | Chart type selector with category grouping and preview | app-shell; used in ChartConfigPanel |
| `shared/components/charts/ChartToolbar.tsx` | Chart controls: zoom, pan, time range, export | app-shell; used by multiple chart renderers |
| `shared/components/charts/ChartLegend.tsx` | Dynamic legend with toggle and color editing | app-shell; used by time-series and other chart renderers |
| `shared/components/charts/ChartPointSelector.tsx` | Left-list + right-slot point binding UI for chart configuration | app-shell; used in ChartConfigPanel |
| `shared/components/charts/ChartOptionsForm.tsx` | Form for chart display options (colors, labels, grid) | app-shell; used in ChartConfigPanel |
| `shared/components/charts/ChartScalingTab.tsx` | Axis scaling and unit conversion configuration | app-shell; used in ChartConfigPanel |
| `shared/components/charts/SaveChartModal.tsx` | Dialog to save current chart config as a named template | app-shell; used in chart toolbar |
| `shared/components/charts/chart-aggregate.ts` | Aggregation math functions (mean, max, min, p95, etc.) | app-shell; used by multiple chart renderers |
| `shared/components/charts/chart-aggregate-config.ts` | Aggregation configuration types and defaults | app-shell; used by ChartConfigPanel |
| `shared/components/charts/chart-config-types.ts` | TypeScript types for all chart configuration shapes; file comment: "shared across all 39 chart renderers" | app-shell; imported throughout charts and console |
| `shared/components/charts/chart-defaults.ts` | Default chart configuration values per chart type | app-shell; used by ChartConfigPanel |
| `shared/components/charts/chart-definitions.ts` | Chart type metadata: name, category, description; file comment: "Used by ChartTypePicker" | app-shell; drives chart picker UI |
| `shared/components/charts/chart-highlight-utils.ts` | Cross-chart hover highlight synchronization utilities | app-shell; used by multiple chart renderers |
| `shared/components/charts/hooks/useHighlight.ts` | Cross-chart hover highlight state hook | app-shell; used by chart renderers |
| `shared/components/charts/hooks/useTimeSeriesBuffer.ts` | Ring-buffer hook for accumulating live time-series data | app-shell; used by live trend chart renderer |
| `shared/components/charts/renderers/chart01-live-trend.tsx` | Unified time-series line chart with live auto-scroll and historical window (file comment) | app-shell; used by console TrendPane and dashboards |
| `shared/components/charts/renderers/chart04-step-chart.tsx` | Step-interpolated time-series chart | app-shell; dispatched by ChartRenderer |
| `shared/components/charts/renderers/chart05-bar-column.tsx` | Bar/column chart with vertical and horizontal variants | app-shell; dispatched by ChartRenderer |
| `shared/components/charts/renderers/chart06-pie-donut.tsx` | Pie and donut chart | app-shell; dispatched by ChartRenderer |
| `shared/components/charts/renderers/chart07-kpi-card.tsx` | KPI summary card with trend indicator | app-shell; dispatched by ChartRenderer |
| `shared/components/charts/renderers/chart08-gauge.tsx` | Gauge chart with configurable ranges | app-shell; dispatched by ChartRenderer |
| `shared/components/charts/renderers/chart09-sparkline.tsx` | Inline sparkline chart | app-shell; dispatched by ChartRenderer |
| `shared/components/charts/renderers/chart10-analog-bar.tsx` | Horizontal analog bar gauge | app-shell; dispatched by ChartRenderer |
| `shared/components/charts/renderers/chart11-fill-gauge.tsx` | Fill-level gauge | app-shell; dispatched by ChartRenderer |
| `shared/components/charts/renderers/chart12-alarm-indicator.tsx` | Alarm priority indicator chart | app-shell; dispatched by ChartRenderer |
| `shared/components/charts/renderers/chart13-xy-scatter.tsx` | X-Y scatter plot | app-shell; dispatched by ChartRenderer |
| `shared/components/charts/renderers/chart14-event-timeline.tsx` | Event timeline chart | app-shell; dispatched by ChartRenderer |
| `shared/components/charts/renderers/chart15-data-table.tsx` | Tabular data view rendered as a chart widget | app-shell; dispatched by ChartRenderer |
| `shared/components/charts/renderers/chart16-batch-comparison.tsx` | Batch run comparison overlay chart | app-shell; dispatched by ChartRenderer |
| `shared/components/charts/renderers/chart17-heatmap.tsx` | Heatmap calendar or matrix chart | app-shell; dispatched by ChartRenderer |
| `shared/components/charts/renderers/chart18-pareto.tsx` | Pareto analysis chart | app-shell; dispatched by ChartRenderer |
| `shared/components/charts/renderers/chart19-box-plot.tsx` | Statistical box plot | app-shell; dispatched by ChartRenderer |
| `shared/components/charts/renderers/chart20-histogram.tsx` | Frequency histogram | app-shell; dispatched by ChartRenderer |
| `shared/components/charts/renderers/chart21-waterfall.tsx` | Waterfall chart for cumulative change | app-shell; dispatched by ChartRenderer |
| `shared/components/charts/renderers/chart22-stacked-area.tsx` | Stacked area chart | app-shell; dispatched by ChartRenderer |
| `shared/components/charts/renderers/chart23-bullet.tsx` | Bullet chart for target vs. actual | app-shell; dispatched by ChartRenderer |
| `shared/components/charts/renderers/chart24-shewhart.tsx` | Shewhart SPC control chart | app-shell; dispatched by ChartRenderer |
| `shared/components/charts/renderers/chart25-regression.tsx` | Regression analysis chart | app-shell; dispatched by ChartRenderer |
| `shared/components/charts/renderers/chart26-correlation-matrix.tsx` | Correlation matrix heatmap | app-shell; dispatched by ChartRenderer |
| `shared/components/charts/renderers/chart27-sankey.tsx` | Sankey flow diagram | app-shell; dispatched by ChartRenderer |
| `shared/components/charts/renderers/chart28-treemap.tsx` | Treemap area chart | app-shell; dispatched by ChartRenderer |
| `shared/components/charts/renderers/chart29-cusum.tsx` | CUSUM cumulative-sum control chart | app-shell; dispatched by ChartRenderer |
| `shared/components/charts/renderers/chart30-ewma.tsx` | EWMA exponentially-weighted moving average chart | app-shell; dispatched by ChartRenderer |
| `shared/components/charts/renderers/chart31-probability-plot.tsx` | Normal probability plot | app-shell; dispatched by ChartRenderer |
| `shared/components/charts/renderers/chart32-funnel.tsx` | Funnel chart | app-shell; dispatched by ChartRenderer |
| `shared/components/charts/renderers/chart33-radar.tsx` | Radar/spider chart | app-shell; dispatched by ChartRenderer |
| `shared/components/charts/renderers/chart34-surface3d.tsx` | 3D surface plot | app-shell; dispatched by ChartRenderer |
| `shared/components/charts/renderers/chart35-state-timeline.tsx` | State timeline Gantt-style chart | app-shell; dispatched by ChartRenderer |
| `shared/components/charts/renderers/chart36-scorecard-table.tsx` | Scorecard table widget | app-shell; dispatched by ChartRenderer |
| `shared/components/charts/renderers/chart37-parallel-coord.tsx` | Parallel coordinates chart | app-shell; dispatched by ChartRenderer |
| `shared/components/charts/renderers/chart38-subgroup-spc.tsx` | Subgroup SPC Xbar-R chart | app-shell; dispatched by ChartRenderer |
| `shared/components/charts/renderers/chart39-attribute-control.tsx` | Attribute control chart (p/np/c/u) | app-shell; dispatched by ChartRenderer |
| `shared/components/charts/renderers/chart40-accumulated-run.tsx` | Accumulated run chart | app-shell; dispatched by ChartRenderer |
| `shared/components/charts/renderers/chart41-status-map.tsx` | Status map grid chart | app-shell; dispatched by ChartRenderer |
| `shared/components/charts/renderers/chart50-text-markdown.tsx` | Markdown text widget rendered as a chart slot | app-shell; dispatched by ChartRenderer |
| `shared/components/charts/renderers/chart51-header-divider.tsx` | Section header/divider widget | app-shell; dispatched by ChartRenderer |
| `shared/components/charts/renderers/chart52-clock-timer.tsx` | Live clock and timer widget | app-shell; dispatched by ChartRenderer |
| `shared/components/charts/renderers/chart53-logs-viewer.tsx` | Log viewer widget | app-shell; dispatched by ChartRenderer |
| `shared/components/charts/renderers/chart54-iframe-embed.tsx` | IFrame embed widget | app-shell; dispatched by ChartRenderer |
| `shared/components/charts/renderers/chart55-camera-stream.tsx` | Live camera stream widget | app-shell; dispatched by ChartRenderer |

### Clipboard infrastructure

| Path | Purpose | Scope |
|------|---------|-------|
| `shared/clipboard/index.ts` | Barrel export for clipboard system | app-shell; imported by all module clipboard handlers |
| `shared/clipboard/types.ts` | IOClipboardPayload, PasteTarget, SelectionZoneId, and related type definitions | app-shell; imported throughout clipboard system |
| `shared/clipboard/clipboardStore.ts` | Zustand store holding current clipboard payload; syncs with system clipboard | app-shell; used by all module copy/paste handlers |
| `shared/clipboard/buildPayload.ts` | Constructs IOClipboardPayload from module-provided content | app-shell; used by all module copy handlers |
| `shared/clipboard/extract.ts` | Extracts points, styles, and nodes from a clipboard payload | app-shell; used by all module paste targets |
| `shared/clipboard/migrateLegacyClipboard.ts` | Migrates v1 designer-only ClipboardData to IOClipboardPayload format | app-shell; called from clipboardStore on read |
| `shared/clipboard/pasteTargetRegistry.ts` | Maps selection zone IDs to registered paste target implementations | app-shell; queried by usePasteEngine |
| `shared/clipboard/usePasteEngine.ts` | Hook executing paste into the registered target for the active zone | app-shell; used in AppShell keyboard handler |
| `shared/clipboard/usePasteTarget.ts` | Hook registering a paste target on mount and unregistering on unmount | app-shell; used by all module paste targets |
| `shared/clipboard/ClipboardContextMenu.tsx` | Radix ContextMenu presenting paste with mode options | app-shell; rendered in module canvases |
| `shared/clipboard/ClipboardInspector.tsx` | Dev-only floating clipboard payload inspector | app-shell; debug tooling only |
| `shared/clipboard/ClipboardStatusIndicator.tsx` | Status badge summarizing current clipboard contents | app-shell; shown in designer status bar |
| `shared/clipboard/selection/MarqueeLayer.tsx` | Transparent drag-to-select overlay layer for a selection zone | app-shell; used by console and settings PointManagement |
| `shared/clipboard/selection/SelectionOverlay.tsx` | Selection highlight rectangle overlay | app-shell; used with MarqueeLayer |
| `shared/clipboard/selection/useSelectableItem.ts` | Hook making an item participate in a selection zone | app-shell; used by console panes and settings rows |
| `shared/clipboard/selection/useSelectionKeybinds.ts` | Handles Ctrl+C/X/V keyboard shortcuts for a zone | app-shell; active in all module layouts |
| `shared/clipboard/selection/selection.css` | Selection rectangle and marquee layer CSS; imported in App.tsx | app-shell; imported at root in App.tsx |
| `shared/clipboard/targets/mostRecentAlarmsHook.ts` | Dispatches cross-module event to open Forensics with selected points | app-shell; cross-module event bridge |
| `shared/clipboard/targets/textFieldTarget.ts` | Paste target inserting text content into the currently focused text input | app-shell; global fallback target |

### Graphics rendering infrastructure

| Path | Purpose | Scope |
|------|---------|-------|
| `shared/graphics/SceneRenderer.tsx` | Scene graph renderer: resolves point tags, manages LOD classes, delegates to renderNodeSvg | app-shell; used by console GraphicPane, export-render, and out-of-scope process |
| `shared/graphics/renderNodeSvg.tsx` | Pure render functions for all 11 SceneNode types to React SVG elements (file comment) | app-shell; called by SceneRenderer for every node |
| `shared/graphics/renderDisplayElementSvg.tsx` | Pure render functions for DisplayElement sub-types to SVG (file comment) | app-shell; called by renderNodeSvg |
| `shared/graphics/commands.ts` | Scene graph command type definitions used by designer historyStore | app-shell; imported by historyStore and DesignerCanvas |
| `shared/graphics/shapeCache.ts` | Shape SVG and sidecar cache with batch-load via POST /api/v1/shapes/batch | app-shell; consumed by designer libraryStore and SceneRenderer |
| `shared/graphics/pipeRouter.ts` | A* grid-based pipe routing algorithm for connecting anchor slots | app-shell; used by DesignerCanvas pipe tool |
| `shared/graphics/pointExtractor.ts` | Extracts all point bindings from a GraphicDocument for tag resolution | app-shell; used by SceneRenderer and export-render |
| `shared/graphics/nodeTransforms.ts` | SVG transform and bounding box utilities; file comment: "shared by DesignerCanvas and SceneRenderer" | app-shell; explicitly cross-module per comment |
| `shared/graphics/dataQuality.ts` | DataQualityState enum and hook detecting stale/uncertain point values | app-shell; used by display element renderers |
| `shared/graphics/displayElementColors.ts` | Alarm priority color constants (ISA-18.2); comment: "theme-independent (never change)" | app-shell; used by display elements and alarmFlash.css |
| `shared/graphics/anchorSlots.ts` | Normalized anchor slot positioning utilities for display elements (file comment) | app-shell; used by SceneRenderer and DesignerCanvas |
| `shared/graphics/selectionStore.ts` | SVG node selection highlight state (scope, selectedIds) for SceneRenderer | app-shell; used by SceneRenderer and DesignerCanvas |
| `shared/graphics/sidecarCollision.ts` | Sidecar display element collision detection and slot priority resolution | app-shell; used by SceneRenderer |
| `shared/graphics/svgDefs.tsx` | SVG gradient and pattern `<defs>` required by display element renderers (file comment) | app-shell; rendered inside every SVG canvas |
| `shared/graphics/useSnapToSlot.ts` | Hook providing ghost target anchors during display element drag-to-slot (file comment) | app-shell; used by DesignerCanvas drag interactions |
| `shared/graphics/valueUpdateFlash.ts` | 150ms CSS flash animation on point value update | app-shell; used by numeric display elements |
| `shared/graphics/displayElements/index.ts` | Display element type registry | app-shell; imported by renderDisplayElementSvg |
| `shared/graphics/displayElements/AlarmIndicator.tsx` | SVG alarm priority indicator with ISA-18.2 flash animation | app-shell; used in renderDisplayElementSvg |
| `shared/graphics/displayElements/AnalogBar.tsx` | SVG analog value bar gauge | app-shell; used in renderDisplayElementSvg |
| `shared/graphics/displayElements/DigitalStatus.tsx` | SVG digital on/off state indicator | app-shell; used in renderDisplayElementSvg |
| `shared/graphics/displayElements/FillGauge.tsx` | SVG fill-level gauge | app-shell; used in renderDisplayElementSvg |
| `shared/graphics/displayElements/NumericIndicator.tsx` | SVG numeric value readout | app-shell; used in renderDisplayElementSvg |
| `shared/graphics/displayElements/PointNameLabel.tsx` | SVG point tag name label | app-shell; used in renderDisplayElementSvg |
| `shared/graphics/displayElements/Sparkline.tsx` | SVG inline sparkline chart | app-shell; used in renderDisplayElementSvg |
| `shared/graphics/displayElements/TextReadout.tsx` | SVG free-format text display element | app-shell; used in renderDisplayElementSvg |
| `shared/graphics/alarmFlash.css` | @keyframes for ISA-18.2 alarm priority flash animations | app-shell; imported by AlarmIndicator |
| `shared/graphics/operationalState.css` | ISA-101 operational state CSS classes on symbol instance wrappers (file comment) | app-shell; applied by SceneRenderer |
| `shared/graphics/lod.css` | Level-of-detail visibility rules applied to canvas container (file comment: "process-implementation-spec.md §4.3.3") | app-shell; consumed by console and process graphics |
| `shared/graphics/shapeCache.test.ts` | Unit tests for shape SVG caching and LRU eviction behavior | app-shell; test infrastructure |

### Shared hooks

| Path | Purpose | Scope |
|------|---------|-------|
| `shared/hooks/useWebSocket.ts` | WebSocket manager facade with device-type detection and SharedWorker delegation | app-shell; imported across console, process, and all point-subscribed components |
| `shared/hooks/useWsWorker.ts` | Client connector for wsWorker SharedWorker; owns the SharedWorker instance (file comment) | app-shell; used only by useWebSocket |
| `shared/hooks/usePermission.ts` | RBAC permission checking hook reading JWT claims from auth store (file comment) | app-shell; used throughout all modules |
| `shared/hooks/usePointMeta.ts` | Batched point metadata fetcher using TanStack useQueries | app-shell; used across console, designer, and charts |
| `shared/hooks/usePointValues.ts` | Live or historical point value subscriptions by UUID | app-shell; used by chart renderers and display elements |
| `shared/hooks/useHistoricalValues.ts` | Fetches point values at a specific playback timestamp; file comment names ExportRenderConsole dependency | app-shell; explicitly cross-module per comment |
| `shared/hooks/useUserPreference.ts` | Server-persisted user preference hook with 500ms debounce write (file comment) | app-shell; used throughout console and profile |
| `shared/hooks/useContextMenu.ts` | Generic right-click coordinate state hook | app-shell; used throughout all modules |
| `shared/hooks/useLongPress.ts` | Mobile long-press event hook (500ms, touch events; file comment: "mobile equivalent of right-click") | app-shell; used in mobile-facing components |
| `shared/hooks/useNodeClick.ts` | SVG node click handler for Mode A selection (Console/Process) | app-shell; used by console GraphicPane and out-of-scope process |
| `shared/hooks/useNodeMarquee.ts` | SVG drag-to-select marquee for Mode A selection | app-shell; used by console GraphicPane and out-of-scope process |
| `shared/hooks/useObjectActions.ts` | Save/publish/delete version mutation hook; imports graphicsApi, consoleApi, savedChartsApi | app-shell; cross-module per three API imports |
| `shared/hooks/useOfflineRounds.ts` | IndexedDB offline queue for round responses with service worker sync (file comment) | app-shell; used by out-of-scope rounds module |
| `shared/hooks/useAuthImage.ts` | Session-scoped blob URL cache for auth provider logo images | app-shell; used by login and settings auth providers |
| `shared/hooks/useChartTimeRange.ts` | Computes effective chart time window from live/historical playback mode (file comment) | app-shell; used by chart renderers across all modules |
| `shared/hooks/tileCacheDb.ts` | IndexedDB LRU tile cache for phone graphics offline; file comment names TileGraphicViewer dependency | app-shell; used by TileGraphicViewer |
| `shared/hooks/pointCacheDb.ts` | IndexedDB cache for last-known point values for offline TileGraphicViewer (file comment) | app-shell; used by TileGraphicViewer |

### Shared types

| Path | Purpose | Scope |
|------|---------|-------|
| `shared/types/graphics.ts` | SceneNode, GraphicDocument, DisplayElement, and all scene graph type definitions | app-shell; imported throughout designer, console, and graphics infrastructure |
| `shared/types/expression.ts` | Expression AST tile and node type definitions | app-shell; imported by expression components and designer |
| `shared/types/ipc.ts` | TypeScript parity for Rust wire format IPC types; file comment: "must remain in lockstep with Rust types" | app-shell; imported by WS message handling and stores |
| `shared/types/permissions.ts` | RBAC permission string registry matching Rust Permission enum (file comment) | app-shell; imported by usePermission and all guarded routes |
| `shared/types/shapes.ts` | Canonical ShapeSidecar and related type definitions; file comment: "Single source of truth" | app-shell; imported by shapeCache, libraryStore, and designer |
| `shared/types/versioning.ts` | VersionSummary and content types for the versioning system | app-shell; imported by versioning components and API clients |

### Shared utilities

| Path | Purpose | Scope |
|------|---------|-------|
| `shared/utils/resolvePointLabel.ts` | Resolves numeric OPC UA enum values to human-readable string labels | app-shell; used by display elements and point detail panel |
| `shared/utils/popupDetection.ts` | Silent window.open() probe to detect popup blocking; file comment: "DD-06-012" | app-shell; used by PopupBlockedBanner |

### Workers

| Path | Purpose | Scope |
|------|---------|-------|
| `workers/wsWorker.ts` | SharedWorker managing a single WebSocket connection per browser origin (file comment) | app-shell; loaded by useWsWorker |
| `workers/expressionBenchmark.worker.ts` | Benchmarks expression evaluator 10K iterations and posts timing (file comment) | app-shell; developer/testing utility |

### Auth and global pages

| Path | Purpose | Scope |
|------|---------|-------|
| `pages/Login.tsx` | Login form with SSO provider button list | app-shell; route outside AppShell |
| `pages/OidcCallback.tsx` | OIDC authorization code callback handler | app-shell; route outside AppShell |
| `pages/ResetPassword.tsx` | Password reset placeholder page | app-shell; route outside AppShell |
| `pages/EulaAcceptance.tsx` | EULA acceptance flow for new users | app-shell; route gated by EulaGate |
| `pages/EulaGate.tsx` | Route guard redirecting to EulaAcceptance when EULA is pending | app-shell; wraps protected routes in App.tsx |
| `pages/NotFound.tsx` | 404 not-found page | app-shell; catch-all route |

### Profile pages

| Path | Purpose | Scope |
|------|---------|-------|
| `pages/profile/index.tsx` | User profile shell with Profile/Security/Sessions/Preferences tabs | app-shell; linked from top bar user menu |
| `pages/profile/ProfileTab.tsx` | User display name and avatar display | app-shell; tab inside profile |
| `pages/profile/PreferencesTab.tsx` | Theme and display density selection | app-shell; tab inside profile |
| `pages/profile/SecurityTab.tsx` | Password change, MFA enrollment, and personal API key management | app-shell; tab inside profile; imports mfaApi and apiKeys |
| `pages/profile/SessionsTab.tsx` | Active session list with revoke capability | app-shell; tab inside profile; imports sessionsApi |

### Export-render pages

| Path | Purpose | Scope |
|------|---------|-------|
| `pages/export-render/ExportRenderPage.tsx` | Headless route dispatching to correct renderer by module type | app-shell; headless window for video export capture |
| `pages/export-render/ExportRenderConsole.tsx` | Headless console workspace renderer for video export frame capture; imports console WorkspaceGrid | shared; imports from `pages/console/WorkspaceGrid` and `api/console` |
| `pages/export-render/ExportRenderProcess.tsx` | Headless process graphic renderer using SceneRenderer for video export | shared; imports SceneRenderer and graphicsApi (shared with designer) |

### App-shell API clients

| Path | Purpose | Scope |
|------|---------|-------|
| `api/client.ts` | HTTP client with JWT auth header injection and REST envelope parsing | app-shell; base for all API modules |
| `api/auth.ts` | Authentication endpoints: login, logout, token refresh, EULA, OIDC flows | app-shell; imported by store/auth and Login page |
| `api/points.ts` | Point CRUD, search, tag resolution (resolve-tags), and metadata endpoints | app-shell; central point identity API used across all modules |
| `api/ws-ticket.ts` | Issues WebSocket authentication tickets | app-shell; imported by useWsWorker |
| `api/notifications.ts` | Notification history, read, and dismiss endpoints | app-shell; imported by NotificationHistoryPanel |
| `api/health.ts` | Service health status endpoints | app-shell; imported by SystemHealthDot and settings/SystemHealth |
| `api/search.ts` | Global cross-entity search endpoint | app-shell; imported by CommandPalette |
| `api/preferences.ts` | User preferences PATCH/GET (single JSONB blob per user; file comment) | app-shell; imported by useUserPreference |
| `api/savedCharts.ts` | Saved chart config CRUD and versioning | app-shell; imported by SaveChartModal, versioning hooks, and ConsolePalette |
| `api/logs.ts` | Audit log query endpoints | app-shell; imported by out-of-scope log module |
| `api/videoExports.ts` | Video export job creation and status | app-shell; imported by VideoExportModal and settings/MyExports |
| `api/exports.ts` | Sync/async file export job creation and download; file comment names design-docs/25 | app-shell; imported by ExportDialog and settings/MyExports |
| `api/sessions.ts` | User session list and revoke (used by profile and settings) | app-shell; imported by profile/SessionsTab, settings/Sessions, and settings/UserDetail |
| `api/alarms.ts` | Alarm state, history, and acknowledgment endpoints | app-shell; imported by settings/EventConfig and console/AlarmListPane |
| `api/mfa.ts` | MFA method enrollment, enforcement, and admin operations | app-shell; imported by profile/SecurityTab and settings/MfaSettings |
| `api/authProviders.ts` | SSO provider configuration endpoints | app-shell; imported by pages/Login.tsx and settings/AuthProviders |
| `api/apiKeys.ts` | Personal API key CRUD | app-shell; imported by profile/SecurityTab |
| `api/bookmarks.ts` | Entity bookmark CRUD | app-shell; usage in shell-level panels |
| `api/recognition.ts` | AI recognition model management | app-shell; imported by designer/RecognitionWizard and settings/Recognition |
| `api/savedCharts.ts` | (see above — listed once) | — |
| `api/forensics.ts` | Forensics investigation API | app-shell; imported by out-of-scope forensics module |
| `api/rounds.ts` | Rounds CRUD and execution endpoints | app-shell; imported by out-of-scope rounds module |
| `api/mobile.ts` | Mobile-specific endpoints | app-shell; imported by out-of-scope mobile module |
| `api/shifts.ts` | Shift schedule endpoints | app-shell; imported by out-of-scope shifts module |

### Test infrastructure

| Path | Purpose | Scope |
|------|---------|-------|
| `test/ApiResponse.test.ts` | Tests for API response envelope parsing | app-shell; tests api/client behavior |
| `test/authStore.test.ts` | Tests for auth store login/logout/token state | app-shell; tests store/auth |
| `test/commandPalette.test.ts` | Tests for command palette search and navigation | app-shell; tests shared/components/CommandPalette |
| `test/consoleGrid.test.ts` | Tests for WorkspaceGrid layout algorithms | app-shell; tests console layout-utils |
| `test/designerHistory.test.ts` | Tests for designer undo/redo command stack | app-shell; tests store/designer/historyStore |
| `test/designerStores.test.ts` | Tests for designer store interactions | app-shell; tests store/designer/ |
| `test/evaluator.test.ts` | Tests for client-side expression evaluator | app-shell; tests expression/evaluator |
| `test/expressionAst.test.ts` | Tests for expression tile-to-AST conversion | app-shell; tests expression/ast |
| `test/graphicsUtils.test.ts` | Tests for graphics utility functions | app-shell; tests shared/graphics/ utilities |
| `test/handlers.ts` | MSW request handler definitions for test mocks | app-shell; test infrastructure |
| `test/permissions.test.ts` | Tests for RBAC permission checking logic | app-shell; tests usePermission |
| `test/pipeRouter.test.ts` | Tests for A* pipe routing algorithm | app-shell; tests shared/graphics/pipeRouter |
| `test/playbackStore.test.ts` | Tests for live/historical playback state | app-shell; tests store/playback |
| `test/pointExtractor.test.ts` | Tests for point binding extraction from scene graphs | app-shell; tests shared/graphics/pointExtractor |
| `test/rbacVisibility.test.tsx` | Tests for RBAC-gated UI visibility | app-shell; tests PermissionGuard behavior |
| `test/sceneCommandsAdvanced.test.ts` | Advanced tests for scene graph command execution | app-shell; tests shared/graphics/commands |
| `test/sceneCommands.test.ts` | Tests for basic scene graph commands | app-shell; tests shared/graphics/commands |
| `test/server.ts` | MSW service worker server setup for tests | app-shell; test infrastructure |
| `test/setup.ts` | Vitest global test setup | app-shell; test infrastructure |
| `test/shapeCache.test.ts` | Tests for shape SVG cache | app-shell; tests shared/graphics/shapeCache |
| `test/theme.test.ts` | Tests for theme token application and switching | app-shell; tests shared/theme/ |
| `test/Toast.test.tsx` | Tests for toast notification system | app-shell; tests shared/components/Toast |
| `test/uiStore.test.ts` | Tests for UI store (lock, emergency alert, theme) | app-shell; tests store/ui |
| `test/utils.test.ts` | Miscellaneous utility function tests | app-shell; general test coverage |
| `test/wsMessages.test.ts` | Tests for WebSocket message parsing and routing | app-shell; tests WS infrastructure |
