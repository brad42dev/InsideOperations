# I/O Frontend Application Structure - Right-Click Implementation Inventory

**Date**: 2026-04-06  
**Purpose**: Comprehensive inventory of the I/O frontend application to identify all pages, interactive elements, and components that would benefit from right-click context menu implementations.

## 1. All Pages in `/frontend/src/pages/`

### Core Authentication & User Pages
- **Login.tsx** - User authentication/login interface
- **ResetPassword.tsx** - Password reset flow
- **OidcCallback.tsx** - OIDC authentication callback handler
- **EulaGate.tsx** - EULA gate redirect wrapper
- **EulaAcceptance.tsx** - EULA acceptance dialog
- **NotFound.tsx** - 404 error page

### Module: Console
Main real-time monitoring and workspace management interface.

**Main Pages:**
- **console/index.tsx** - Console workspace viewer with grid-based pane layout
- **console/WorkspaceView.tsx** - Workspace layout viewer
- **console/WorkspaceGrid.tsx** - Grid layout wrapper for panes
- **console/WorkspaceEditor.tsx** - Workspace editor/configuration
- **console/ConsolePalette.tsx** - Draggable palette of available panes
- **console/PaneConfigModal.tsx** - Pane configuration dialog
- **console/PaneWrapper.tsx** - Wrapper for individual panes
- **console/PaneErrorBoundary.tsx** - Error handling for panes

**Pane Types (console/panes/):**
- **AlarmListPane.tsx** - Display list of active/historical alarms
- **GraphicPane.tsx** - Display graphics/iographics
- **PointTablePane.tsx** - Tabular point data display
- **TrendPane.tsx** - Time-series trend visualization

**Utilities:**
- **layout-utils.ts** - Layout calculation helpers
- **types.ts** - Type definitions for workspace/pane structures

### Module: Designer
Visual graphic and dashboard design environment.

**Core Pages:**
- **designer/index.tsx** - Designer main entry point and router
- **designer/DesignerHome.tsx** - Designer home/project selection
- **designer/DesignerCanvas.tsx** - Main SVG canvas for editing graphics
- **designer/DesignerToolbar.tsx** - Top toolbar with tools and actions
- **designer/DesignerTabBar.tsx** - Tab management for open graphics/dashboards
- **designer/DesignerLeftPalette.tsx** - Left sidebar with symbols and stencils library
- **designer/DesignerRightPanel.tsx** - Right sidebar with properties and layers panel
- **designer/DesignerModeTabs.tsx** - Mode tabs (Graphics/Dashboard/Report)
- **designer/DesignerStatusBar.tsx** - Status bar at bottom

**List Pages:**
- **designer/DesignerGraphicsList.tsx** - Browse/manage graphics
- **designer/DesignerDashboardsList.tsx** - Browse/manage dashboards
- **designer/DesignerReportsList.tsx** - Browse/manage reports
- **designer/SymbolLibrary.tsx** - Symbol library browser

**Dialogs & Wizards:**
- **designer/DesignerImport.tsx** - Import graphics/iographics
- **designer/components/CanvasPropertiesDialog.tsx** - Canvas size/properties
- **designer/components/IographicImportWizard.tsx** - Iographic import wizard
- **designer/components/IographicExportDialog.tsx** - Iographic export
- **designer/components/SaveAsStencilDialog.tsx** - Save as reusable stencil
- **designer/components/PromoteToShapeWizard.tsx** - Convert group to shape
- **designer/components/RecognitionWizard.tsx** - Symbol recognition wizard
- **designer/components/VersionHistoryDialog.tsx** - Version history browser
- **designer/components/ValidateBindingsDialog.tsx** - Binding validation
- **designer/components/TabClosePrompt.tsx** - Unsaved changes prompt

### Module: Process
Process flow visualization and execution interface.

**Main Pages:**
- **process/index.tsx** - Process viewer main page
- **process/ProcessView.tsx** - Process canvas viewer
- **process/ProcessEditor.tsx** - Process flow editor
- **process/ProcessSidebar.tsx** - Process sidebar with details
- **process/ProcessMinimap.tsx** - Minimap navigation
- **process/ProcessDetachedView.tsx** - Detached process view window

### Module: Dashboards
Business intelligence and KPI dashboard interfaces.

**Main Pages:**
- **dashboards/index.tsx** - Dashboard browser and viewer
- **dashboards/DashboardViewer.tsx** - Display dashboard with widgets
- **dashboards/PlaylistManager.tsx** - Manage presentation playlists
- **dashboards/PlaylistPlayer.tsx** - Play dashboard playlists
- **dashboards/dashboardConverter.ts** - Dashboard format conversion utilities

**Widget Types (dashboards/widgets/) - 39 widget types:**
- **KPI/Metrics**: KpiCard.tsx, GaugeWidget.tsx, ShiftInfoWidget.tsx, SystemUptimeWidget.tsx
- **Status Widgets**: AlertStatusWidget.tsx, OpcStatusWidget.tsx, ProductionStatusWidget.tsx, ServiceHealthWidget.tsx
- **Trend/Chart Widgets**: LineChart.tsx, TrendChartWidget.tsx, BarChart.tsx, PieChart.tsx
- **Alarm/Alert Widgets**: AlarmListWidget.tsx, AlarmKpiWidget.tsx, AlarmHealthKpiWidget.tsx, AlarmCountBySeverityWidget.tsx, AlarmRateWidget.tsx, AlarmRateTrendWidget.tsx, UnackCountWidget.tsx, OpenAlertsWidget.tsx
- **Data Display**: TableWidget.tsx, PointStatusTableWidget.tsx, AreaStatusTableWidget.tsx, ServiceHealthTableWidget.tsx
- **System Metrics**: DbSizeWidget.tsx, WsThroughputWidget.tsx, StalePointsWidget.tsx, BadQualityBySourceWidget.tsx, ApiResponseTimeWidget.tsx
- **Quality/Completion**: QualityDistributionWidget.tsx, RoundsCompletionWidget.tsx
- **Generic**: TextWidget.tsx, PlaceholderWidget.tsx, WidgetContainer.tsx

**Widget Utilities:**
- **ExportDataDialog.tsx** - Export widget data

### Module: Reports
Report generation and scheduling interface.

**Main Pages:**
- **reports/index.tsx** - Report browser and generator
- **reports/ReportGenerator.tsx** - Report generation interface
- **reports/ReportViewer.tsx** - Report viewer/preview
- **reports/ReportConfigPanel.tsx** - Report configuration
- **reports/MyExports.tsx** - User's exported reports
- **reports/ReportTemplates.tsx** - Report template management
- **reports/ReportSchedules.tsx** - Report scheduling
- **reports/ReportHistory.tsx** - Report generation history
- **reports/SubscribeDialog.tsx** - Report subscription dialog

### Module: Rounds
Manual round execution and template management.

**Main Pages:**
- **rounds/index.tsx** - Rounds main interface
- **rounds/ActiveRounds.tsx** - Currently active rounds
- **rounds/RoundExecution.tsx** - Execute a round (form entry)
- **rounds/RoundPlayer.tsx** - Play back recorded round
- **rounds/RoundTemplates.tsx** - Browse round templates
- **rounds/RoundSchedules.tsx** - Schedule rounds
- **rounds/RoundHistory.tsx** - Round execution history
- **rounds/TemplateDesigner.tsx** - Design/edit round templates
- **rounds/PrintDialog.tsx** - Print round forms

### Module: Shifts
Shift management and crew scheduling.

**Main Pages:**
- **shifts/index.tsx** - Shifts main interface
- **shifts/ShiftSchedule.tsx** - Shift schedule calendar
- **shifts/ShiftScheduleEditor.tsx** - Edit shift schedules
- **shifts/CrewList.tsx** - Crew member directory
- **shifts/PresenceBoard.tsx** - Real-time crew presence tracking
- **shifts/MusterPointConfig.tsx** - Configure muster points for alarms

### Module: Alerts
Alert/alarm management and notification templates.

**Main Pages:**
- **alerts/index.tsx** - Alert template and group management (with context menus)
- **alerts/AlertComposer.tsx** - Compose/create alert templates
- **alerts/AlertGroups.tsx** - Manage alert groups/escalation
- **alerts/AlertTemplates.tsx** - Browse alert templates
- **alerts/AlertHistory.tsx** - Alert history and audit trail
- **alerts/ActiveAlerts.tsx** - Currently active alerts
- **alerts/MusterPage.tsx** - Muster event management
- **alerts/MusterDashboard.tsx** - Muster dashboard view

### Module: Forensics
Historical data investigation and analysis.

**Main Pages:**
- **forensics/index.tsx** - Forensics main interface
- **forensics/InvestigationWorkspace.tsx** - Investigation workspace viewer
- **forensics/InvestigationEditor.tsx** - Create/edit investigations
- **forensics/ForensicsNew.tsx** - New investigation form
- **forensics/EvidenceRenderer.tsx** - Render forensics evidence/charts
- **forensics/AlarmSearch.tsx** - Search historical alarms
- **forensics/ThresholdSearch.tsx** - Search threshold violations

### Module: Log
Event log and note entry interface.

**Main Pages:**
- **log/index.tsx** - Log browser and entry
- **log/LogEditor.tsx** - Edit existing log entries
- **log/LogNew.tsx** - Create new log entry
- **log/LogEntryEdit.tsx** - Log entry editing form
- **log/LogTemplates.tsx** - Log template management
- **log/LogSchedules.tsx** - Scheduled log entries
- **log/TemplateEditor.tsx** - Edit log templates
- **log/PasteFromOffice.ts** - Clipboard parsing utility

### Module: Settings
System administration and configuration.

**Main Pages:** (45+ pages)
- **settings/index.tsx** - Settings main router
- **settings/SettingsPageLayout.tsx** - Settings layout wrapper

**Subsections:**
- **User/Auth**: Users.tsx, UserDetail.tsx, Roles.tsx, Groups.tsx, IdentityAccess.tsx, AuthProviders.tsx, Sessions.tsx, StreamingSessions.tsx
- **Security**: MfaSettings.tsx, Certificates.tsx, ScimTokens.tsx
- **System**: SystemSettings.tsx, SystemHealth.tsx, About.tsx
- **Data/Archive**: PointManagement.tsx, BulkUpdate.tsx, ArchiveSettings.tsx, Snapshots.tsx, BackupRestore.tsx, RestorePreviewModal.tsx
- **Integration**: OpcSources.tsx, SupplementalConnectorsTab.tsx
- **Email/SMS**: Email.tsx, SmsProviders.tsx
- **Alerts/Events**: AlertConfig.tsx, EventConfig.tsx, Badges.tsx
- **Features**: ExpressionLibrary.tsx, Recognition.tsx, ExportPresets.tsx, ReportScheduling.tsx, EulaAdmin.tsx, Import.tsx

**Utilities:**
- **settingsStyles.ts** - Shared settings styling

### Module: Profile
User profile and preferences.

**Main Pages:**
- **profile/index.tsx** - Profile main page
- **profile/ProfileTab.tsx** - User profile information
- **profile/PreferencesTab.tsx** - User preferences
- **profile/SecurityTab.tsx** - Security settings
- **profile/SessionsTab.tsx** - Active sessions management

---

## 2. Interactive Elements - Right-Click Context Menu Candidates

### A. Canvas/SVG Graphics Elements

**Location**: `pages/designer/DesignerCanvas.tsx`

Elements that need right-click menus:
- **Graphic nodes on canvas** (shapes, symbols, images, text blocks, groups)
- **Display elements** (point-bound elements showing real-time data)
- **Guides and grid** (ruler lines for alignment)
- **Canvas background** (empty area)

Current implementation status: **Radix ContextMenu partially implemented**
- Has context menu for guide lines
- Has PointContextMenu for display elements in test mode
- Canvas background context menu supported via DesignerContextMenuContent

### B. Tree Views / Navigation Trees

**Locations**: 
- `pages/designer/DesignerLeftPalette.tsx` - Symbol/stencil library tree
- `pages/designer/DesignerRightPanel.tsx` - Layers panel (hierarchical)
- `pages/console/WorkspaceEditor.tsx` - Workspace pane list
- `pages/process/ProcessSidebar.tsx` - Process sidebar

Current implementation status: **Radix ContextMenu implemented**
- Symbol library items have context menus
- Layer items have context menus
- Stencil library items have context menus

### C. Data Tables (TanStack Table)

**Locations**:
- `shared/components/DataTable.tsx` - Generic table component
- `pages/console/panes/PointTablePane.tsx` - Point data table
- `pages/dashboards/widgets/TableWidget.tsx` - Dashboard table widget
- `pages/dashboards/widgets/PointStatusTableWidget.tsx` - Status table
- `pages/dashboards/widgets/AreaStatusTableWidget.tsx` - Area status table
- `pages/dashboards/widgets/ServiceHealthTableWidget.tsx` - Service health table
- `pages/settings/PointManagement.tsx` - Point management table
- `pages/settings/Users.tsx` - User list table
- `pages/settings/Roles.tsx` - Role list table
- `pages/settings/Groups.tsx` - Group list table

Current implementation status: **PointContextMenu for point-bound rows**
- Table rows with point IDs show PointContextMenu
- Other table rows lack right-click support

### D. Charts (uPlot, ECharts)

**Locations**:
- `shared/components/charts/` - 39+ chart renderer types
- `shared/components/charts/renderers/` - Individual chart implementations
- `pages/console/panes/TrendPane.tsx` - Trend chart pane
- `pages/dashboards/widgets/LineChart.tsx` - ECharts line
- `pages/dashboards/widgets/BarChart.tsx` - ECharts bar
- `pages/dashboards/widgets/PieChart.tsx` - ECharts pie

Chart types that could use right-click:
- **chart01-live-trend.tsx** - Live trend with uPlot
- **chart04-step-chart.tsx** - Step chart
- **chart05-bar-column.tsx** - Bar/column chart
- **chart06-pie-donut.tsx** - Pie/donut chart
- **chart07-kpi-card.tsx** - KPI card
- **chart08-gauge.tsx** - Gauge chart
- **chart15-data-table.tsx** - Data table in chart
- **chart35-state-timeline.tsx** - State timeline
- **chart36-scorecard-table.tsx** - Scorecard table

Current implementation status: **None - charts lack context menus**

### E. List Items

**Locations**:
- `pages/console/index.tsx` - Workspace list items
- `pages/designer/DesignerGraphicsList.tsx` - Graphic list items
- `pages/designer/DesignerDashboardsList.tsx` - Dashboard list items
- `pages/designer/DesignerReportsList.tsx` - Report list items
- `pages/alerts/index.tsx` - Alert template/group items (Radix ContextMenu implemented)
- `pages/reports/ReportTemplates.tsx` - Report template items
- `pages/reports/ReportSchedules.tsx` - Report schedule items
- `pages/reports/ReportHistory.tsx` - Report history items
- `pages/rounds/RoundTemplates.tsx` - Round template items
- `pages/rounds/RoundSchedules.tsx` - Round schedule items
- `pages/log/LogTemplates.tsx` - Log template items

Current implementation status: **Alerts page has Radix ContextMenu**
- alert templates and groups have delete/edit/duplicate menus
- Other modules lack context menus

### F. Cards / Tiles

**Locations**:
- `pages/dashboards/widgets/KpiCard.tsx` - KPI card widget
- `pages/dashboards/widgets/ShiftInfoWidget.tsx` - Shift info card
- `pages/dashboards/widgets/AlertStatusWidget.tsx` - Alert status card
- `pages/designer/DesignerHome.tsx` - Project cards
- Multiple dashboard widgets render as cards

Current implementation status: **None - cards lack context menus**

### G. Form Elements

**Locations**:
- `pages/designer/components/CanvasPropertiesDialog.tsx` - Form fields
- `pages/rounds/TemplateDesigner.tsx` - Checkpoint configuration
- `pages/reports/ReportConfigPanel.tsx` - Report configuration form
- `pages/settings/` - All configuration forms

Current implementation status: **None - forms use standard input interactions**

### H. Sidebar Items

**Locations**:
- `pages/console/index.tsx` - Workspace sidebar
- `pages/designer/DesignerLeftPalette.tsx` - Symbol/stencil library sidebar
- `pages/designer/DesignerRightPanel.tsx` - Layers/properties sidebar
- `pages/process/ProcessSidebar.tsx` - Process details sidebar

Current implementation status: **Partial - some items have menus**
- Layer items in DesignerRightPanel have context menus
- Other sidebars lack them

### I. Toolbar Items

**Locations**:
- `pages/designer/DesignerToolbar.tsx` - Main toolbar buttons
- `pages/console/` - Various toolbar areas
- `pages/designer/DesignerStatusBar.tsx` - Status bar controls

Current implementation status: **None - toolbars use click handlers**

### J. Node Graphs / Process Diagrams

**Locations**:
- `pages/process/ProcessView.tsx` - Process flow diagram
- `pages/process/ProcessEditor.tsx` - Process editor canvas
- `pages/designer/DesignerCanvas.tsx` - (also contains group/component tree)

Current implementation status: **Not explored in detail**
- Process page mentions context menu handler but implementation not reviewed

---

## 3. Existing Radix UI Usage

### Radix UI Dependencies (from package.json)
```json
"@radix-ui/react-context-menu": "^2.2.16",
"@radix-ui/react-dialog": "^1.1.0",
"@radix-ui/react-dropdown-menu": "^2.1.0",
"@radix-ui/react-slot": "^1.1.0",
"@radix-ui/react-toast": "^1.2.0",
"@radix-ui/react-tooltip": "^1.1.0",
```

### Files Using Radix ContextMenu

**8 files found:**

1. **pages/designer/DesignerCanvas.tsx** (9367 lines)
   - Uses `@radix-ui/react-context-menu`
   - Context menus for canvas operations, node manipulation
   - Guide line context menus
   - PointContextMenu wrapper for display elements

2. **pages/designer/DesignerLeftPalette.tsx** (3096 lines)
   - Uses `@radix-ui/react-context-menu`
   - Symbol/stencil library item menus
   - Delete, edit, duplicate operations

3. **pages/designer/DesignerRightPanel.tsx** (extensive)
   - Uses `@radix-ui/react-context-menu`
   - Layer context menus (§RC-DES-16 in CLAUDE.md)
   - Operations: delete, duplicate, group, align, transform

4. **pages/alerts/index.tsx**
   - Uses `@radix-ui/react-context-menu`
   - Alert template/group menus
   - Delete, edit, duplicate, test operations

5. **pages/forensics/index.tsx**
   - Uses `@radix-ui/react-context-menu` (via imports)

6. **pages/console/ConsolePalette.tsx**
   - Uses `@radix-ui/react-dropdown-menu` (DropdownMenu)
   - Pane type selection

7. **shared/components/PointContextMenu.tsx**
   - Uses `@radix-ui/react-dropdown-menu`
   - Custom context menu for points
   - Actions: Point Detail, Trend Point, Investigate, Report, Copy Tag Name

### Pattern Summary

**ContextMenu Pattern (Radix):**
```tsx
<ContextMenuPrimitive.Root>
  <ContextMenuPrimitive.Trigger asChild>
    {/* trigger element */}
  </ContextMenuPrimitive.Trigger>
  <ContextMenuPrimitive.Portal>
    <ContextMenuPrimitive.Content style={contentStyle}>
      <ContextMenuPrimitive.Item onSelect={handler}>
        Action
      </ContextMenuPrimitive.Item>
      <ContextMenuPrimitive.Separator />
    </ContextMenuPrimitive.Content>
  </ContextMenuPrimitive.Portal>
</ContextMenuPrimitive.Root>
```

**DropdownMenu Pattern (Radix - for triggered menus):**
```tsx
<DropdownMenu.Root>
  <DropdownMenu.Trigger asChild>
    {children}
  </DropdownMenu.Trigger>
  <DropdownMenu.Portal>
    <DropdownMenu.Content style={contentStyle}>
      <DropdownMenu.Item onSelect={handler}>
        Action
      </DropdownMenu.Item>
    </DropdownMenu.Content>
  </DropdownMenu.Portal>
</DropdownMenu.Root>
```

---

## 4. Custom Context Menu Components

### ContextMenu.tsx

**Location**: `shared/components/ContextMenu.tsx` (268 lines)

**Purpose**: Portal-based right-click context menu (custom implementation, not Radix)

**Features**:
- Rendered at (x, y) document coordinates
- Auto-positions to stay within viewport (8px padding)
- Closes on click outside, Escape, or scroll
- Keyboard navigation: Arrow Up/Down, Enter/Space, Escape
- Fade-in animation

**Interface**:
```tsx
export interface ContextMenuItem {
  label: string;
  icon?: React.ReactNode;
  shortcut?: string;
  onClick?: () => void;
  disabled?: boolean;
  divider?: boolean; // Show divider line above
}

export interface ContextMenuProps {
  x: number;
  y: number;
  items: ContextMenuItem[];
  onClose: () => void;
}
```

**Style**: Portal-rendered fixed div with inline styles

**Current Usage**: Not found in codebase (may be legacy or not yet integrated)

### PointContextMenu.tsx

**Location**: `shared/components/PointContextMenu.tsx` (285 lines)

**Purpose**: Radix DropdownMenu wrapper for point-specific actions

**Features**:
- Wraps Radix DropdownMenu for consistent point interactions
- Supports right-click and long-press (500ms) on touch
- Respects permission gates (console:read, forensics:write, reports:read)
- Customizable handlers for Point Detail, Trend, Investigate, Report

**Actions**:
1. Point Detail
2. Trend Point (if canConsole)
3. Investigate Point (if canForensicsWrite)
4. Report on Point (if canReports)
5. Investigate Alarm (if isAlarm or isAlarmElement)
6. Copy Tag Name

**Current Usage**: 
- pages/console/panes/GraphicPane.tsx
- pages/console/index.tsx
- pages/console/panes/PointTablePane.tsx
- pages/designer/DesignerCanvas.tsx (test mode only)
- pages/log/LogEditor.tsx
- pages/dashboards/widgets/TableWidget.tsx
- pages/dashboards/widgets/AlarmListWidget.tsx
- pages/dashboards/widgets/KpiCard.tsx
- pages/dashboards/widgets/GaugeWidget.tsx
- pages/dashboards/widgets/AlertStatusWidget.tsx

---

## 5. Shared Components - Menus & Popovers

### Location: `shared/components/`

**Menu/Popup Related Components:**

1. **ContextMenu.tsx** - Custom portal-based context menu (described above)
2. **PointContextMenu.tsx** - Radix DropdownMenu wrapper for points (described above)
3. **CommandPalette.tsx** - Command palette (uses cmdk library)
4. **ConfirmDialog.tsx** - Confirmation dialog
5. **ExportDialog.tsx** - Export data dialog
6. **Toast.tsx** - Toast notifications
7. **EmergencyAlert.tsx** - Emergency banner alert

**Not Found:**
- No standalone "PopoverMenu", "DropdownMenu", or "MenuButton" components
- Modules use Radix directly or custom implementations

**Other Relevant Components:**
- **PointDetailPanel.tsx** - Point information panel
- **NotificationHistoryPanel.tsx** - Notification history
- **MaintenanceTicketsPanel.tsx** - Maintenance panel
- **PointPickerModal.tsx** - Modal point picker
- **PointPicker.tsx** - Inline point picker
- **PointsBrowserPanel.tsx** - Point browser
- **KeyboardHelpOverlay.tsx** - Keyboard help

---

## 6. Module-Specific Components

### Console Module

**Key Interactive Components:**
- Workspace list (workspace selector)
- Pane palette (draggable pane types)
- Pane tabs (open panes)
- Grid items (individual pane containers)
- Workspace layout controls

**Current Right-Click Support:**
- PointContextMenu for point-bound data in panes
- No workspace/pane right-click menus

**Candidates for Right-Click:**
- Workspace list items (duplicate, delete, export, import)
- Workspace tabs (close, rename, duplicate)
- Pane items (resize, float, lock, duplicate)

### Designer Module

**Key Interactive Components:**
- Canvas objects (shapes, symbols, display elements)
- Symbol/stencil library items
- Layer tree items
- Guide lines and rulers
- Tabs for open documents

**Current Right-Click Support:**
- Canvas objects: Radix ContextMenu ✓ (comprehensive)
- Library items: Radix ContextMenu ✓
- Layers: Radix ContextMenu ✓
- Guides: Radix ContextMenu ✓
- Tabs: Radix ContextMenu (via DesignerTabBar)

**Status:** Most complete implementation

### Process Module

**Key Interactive Components:**
- Process nodes/blocks on canvas
- Process connections/flows
- Process sidebar details
- Toolbar actions

**Current Right-Click Support:**
- Point context menus in graphics
- Canvas background menu (mentioned in code)

**Candidates:**
- Process nodes (edit, delete, duplicate, duplicate with values)
- Sidebar items (details, edit, delete)

### Dashboards Module

**Key Interactive Components:**
- Dashboard widget containers
- Chart elements (bars, lines, areas in charts)
- Data points in tables
- Widget toolbar

**Current Right-Click Support:**
- Table rows with points: PointContextMenu ✓
- Widgets themselves: None
- Chart data points: None

**Candidates:**
- Widget cards (edit, delete, duplicate, export, print)
- Chart data series (highlight, toggle, drill down)
- Table rows (export, drill down, details)

### Reports Module

**Key Interactive Components:**
- Report template list
- Report schedule list
- Report history list
- Report configuration panels

**Current Right-Click Support:**
- None found

**Candidates:**
- Template items (edit, duplicate, delete, export, preview)
- Schedule items (edit, disable, trigger now, delete)
- History items (view, export, download, retry)

### Rounds Module

**Key Interactive Components:**
- Round template list
- Round schedule list
- Round active list
- Template designer checkpoints

**Current Right-Click Support:**
- None found

**Candidates:**
- Template items (edit, duplicate, delete, export, preview)
- Schedule items (edit, disable, trigger now, delete)
- Active rounds (view, pause, abandon, print)
- Checkpoints (edit, duplicate, move, delete)

### Shifts Module

**Key Interactive Components:**
- Shift schedule calendar
- Crew list items
- Presence board
- Muster point configuration

**Current Right-Click Support:**
- None found

**Candidates:**
- Calendar shift blocks (edit, copy, duplicate, delete)
- Crew items (view profile, edit, remove, send message)
- Presence indicators (acknowledge, clear, etc.)

### Alerts/Alarms Module

**Key Interactive Components:**
- Alert template list
- Alert group list
- Active alarm list
- Alert composer form

**Current Right-Click Support:**
- Alert templates: Radix ContextMenu ✓ (delete, edit, duplicate, test)
- Alert groups: Radix ContextMenu ✓
- Active alarms: None on list items

**Candidates:**
- Active alarm items (acknowledge, clear, drill down, investigate)

### Forensics Module

**Key Interactive Components:**
- Investigation list
- Investigation workspace
- Evidence chart area
- Investigation sidebar

**Current Right-Click Support:**
- Point context menus in charts/tables
- Investigation list: None

**Candidates:**
- Investigation items (view, edit, delete, export, archive)
- Investigation workspace panes (similar to console)

### Log Module

**Key Interactive Components:**
- Log entry list
- Log template list
- Log schedule list
- Entry form fields

**Current Right-Click Support:**
- Point context menus in tables
- List items: None

**Candidates:**
- Log entry items (view, edit, delete, export, mark as reviewed)
- Template items (edit, duplicate, delete)
- Schedule items (edit, disable, trigger, delete)

### Settings Module

**Key Interactive Components:**
- User list table
- Role list
- Group list
- Point management table
- OPC source list
- Various configuration lists

**Current Right-Click Support:**
- Tables with points: PointContextMenu ✓
- Other tables: None

**Candidates:**
- User list rows (edit, deactivate, reset MFA, send message, view sessions)
- Role list items (edit, duplicate, delete)
- Group list items (edit, duplicate, delete, manage members)
- OPC source list (edit, test, disable, delete, view status)
- Point list (edit, bulk operations, export, delete)

---

## 7. Currently Implemented Features

### Designer Module - Context Menu Features

**Canvas Nodes (DesignerContextMenuContent):**
- Copy/Paste/Delete
- Duplicate
- Group/Ungroup
- Align (left, center, right, top, middle, bottom, distribute)
- Arrange (bring forward, send back, bring to front, send to back)
- Rotate/Flip (90°, 180°, 270°, horizontal, vertical)
- Lock/Unlock
- Show/Hide
- Edit bindings
- Promote to shape
- Save as stencil
- Edit custom properties
- Edit instance overrides
- Bind to point

**Guides:**
- Delete guide line
- Delete all guides

**Layers Panel:**
- Duplicate layer
- Delete layer
- Create group
- Convert to symbol
- Rename layer
- Show/Hide
- Lock/Unlock
- Adjust blend modes
- Move layers (up/down in hierarchy)

### Alerts Module - Context Menu Features

**Alert Templates:**
- Edit template
- Duplicate template
- Delete template
- Test notification
- Export
- View escalation rules

**Alert Groups:**
- Edit group
- Duplicate group
- Delete group
- Manage members
- View routing

### Other Modules

**Console:**
- No module-level context menus (only PointContextMenu for data)
- Workspace management via buttons/modals

**Dashboards:**
- Widget management via button toolbar (no context menus)
- PointContextMenu for table rows with point data

**Process:**
- Context menus mentioned in spec but not fully explored
- PointContextMenu for point-bound elements

---

## 8. Summary of Opportunities

### High Priority (Missing but Common)

1. **Table Row Context Menus**
   - Most data tables lack context menus
   - Could provide: Edit, Delete, Duplicate, Export, Bulk Operations
   - Applies to: Settings (Users, Roles, Groups, Points), Reports, Rounds, Logs

2. **List Item Context Menus**
   - Template/Schedule/History lists need menus
   - Could provide: Edit, Duplicate, Delete, Export, Archive
   - Applies to: Reports, Rounds, Logs, Investigations, Dashboards

3. **Chart/Data Point Context Menus**
   - 39+ chart types have no right-click support
   - Could provide: Drill down, Export, Highlight, Trend to console
   - High value for analysis workflows

4. **Widget Context Menus**
   - Dashboard widgets lack edit/duplicate/remove menus
   - Could provide: Edit, Duplicate, Delete, Export, Fullscreen, Refresh
   - Would improve dashboard design workflow

### Medium Priority

5. **Workspace/Pane Context Menus**
   - Console workspace tabs and pane items
   - Could provide: Rename, Duplicate, Float, Lock, Close

6. **Forensics Investigation Context Menus**
   - Investigation items in browser
   - Could provide: View, Edit, Delete, Export, Archive

### Low Priority (Already Well-Implemented)

7. **Designer Canvas** - Comprehensive context menus already exist
8. **Designer Layers** - Layer context menus already exist
9. **Alert Templates** - Template context menus already exist

---

## 9. Technical Architecture Notes

### Styling Conventions

All Radix UI menus use consistent styling:

```tsx
const contentStyle: React.CSSProperties = {
  background: "var(--io-surface-elevated)",
  border: "1px solid var(--io-border)",
  borderRadius: "var(--io-radius)",
  boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
  minWidth: 180,
  zIndex: 1000,
};

const itemStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  padding: "6px 14px",
  fontSize: 12,
  cursor: "pointer",
  userSelect: "none",
  outline: "none",
  color: "var(--io-text-primary)",
};
```

### Animation

Standard fade-in + scale animation:
```css
@keyframes io-dropdown-in {
  from { opacity: 0; transform: scale(0.96) translateY(-4px); }
  to   { opacity: 1; transform: scale(1) translateY(0); }
}
```

### Permission Gating

Uses `usePermission` hook to conditionally show menu items:
- `console:read` - Console access
- `forensics:write` - Create investigations
- `reports:read` - Generate reports
- `designer:write` - Modify graphics
- etc.

### Portal Rendering

Radix ContextMenu/DropdownMenu handle portal rendering automatically via:
```tsx
<ContextMenuPrimitive.Portal>
  {/* Content is rendered to document.body */}
</ContextMenuPrimitive.Portal>
```

### Z-Index Management

- Designer canvas context menus: z-index 1000+
- PointContextMenu: z-index 2500 (always on top)
- Custom ContextMenu: z-index 2000

---

## Appendix: File Statistics

**Total Pages**: 144+ files
**Total Shared Components**: 70+ files
**Total Widget Types**: 39 different dashboard widgets
**Total Settings Pages**: 45+ configuration pages
**Radix UI Using Files**: 8 files currently use context/dropdown menus
**Custom Context Menu Files**: 2 (ContextMenu.tsx, PointContextMenu.tsx)

