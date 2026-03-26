import { lazy, Suspense, useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import * as echarts from 'echarts'
import { ioLightTheme, ioDarkTheme, ioHighContrastTheme } from './shared/theme/echarts-themes'
import { ThemeProvider } from './shared/theme/ThemeContext'
import AppShell from './shared/layout/AppShell'
import PermissionGuard from './shared/components/PermissionGuard'
import { ErrorBoundary } from './shared/components/ErrorBoundary'
import { useAuthStore } from './store/auth'
import { ROUTE_REGISTRY } from './shared/routes/registry'
import { useUiStore } from './store/ui'
import { useUomStore } from './store/uomStore'
import { subscribeToSync } from './lib/broadcastSync'
import PointDetailPanel from './shared/components/PointDetailPanel'
import { usePointDetailStore } from './store/pointDetailStore'
import ToastProvider from './shared/components/Toast'
import LoginPage from './pages/Login'
import NotFound from './pages/NotFound'
import ResetPassword from './pages/ResetPassword'
import EulaAcceptance from './pages/EulaAcceptance'
import EulaGate from './pages/EulaGate'
import OidcCallback from './pages/OidcCallback'
import { detectDeviceType } from './shared/hooks/useWebSocket'

// ---------------------------------------------------------------------------
// Mobile guard — Designer, Forensics, and Settings are desktop-only modules.
// spec: design-docs/20_MOBILE_ARCHITECTURE.md §Performance Budgets > Code Splitting
// "Modules not available on a given device form factor are never loaded."
// ---------------------------------------------------------------------------
const isMobile = detectDeviceType() !== 'desktop'

function MobileNotAvailable({ module: moduleName }: { module: string }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        minHeight: '200px',
        padding: '24px',
        textAlign: 'center',
        color: 'var(--io-text-muted)',
        fontSize: '14px',
        gap: '8px',
      }}
    >
      <div style={{ fontWeight: 600, fontSize: '16px', color: 'var(--io-text-primary)' }}>
        {moduleName} is not available on mobile devices
      </div>
      <div>Please use a desktop browser to access this feature.</div>
    </div>
  )
}

// Register named ECharts themes at module load time (once, before any chart renders).
// Names are prefixed 'io-' to avoid collision with ECharts built-in 'light' / 'dark'.
echarts.registerTheme('io-light', ioLightTheme)
echarts.registerTheme('io-dark', ioDarkTheme)
echarts.registerTheme('io-high-contrast', ioHighContrastTheme)

// ---------------------------------------------------------------------------
// Lazy-loaded module-level page components (code splitting)
// spec: 06_FRONTEND_SHELL.md §Routing — "Lazy loading for all 11 modules"
// ---------------------------------------------------------------------------

// Console module
const ConsolePage = lazy(() => import('./pages/console/index'))
const WorkspaceView = lazy(() => import('./pages/console/WorkspaceView'))
const WorkspaceEditor = lazy(() => import('./pages/console/WorkspaceEditor'))

// Process module
const ProcessPage = lazy(() => import('./pages/process/index'))
const ProcessView = lazy(() => import('./pages/process/ProcessView'))
const ProcessEditor = lazy(() => import('./pages/process/ProcessEditor'))
const ProcessDetachedView = lazy(() => import('./pages/process/ProcessDetachedView'))

// Designer module
const DesignerPage = lazy(() => import('./pages/designer/index'))
const DesignerHome = lazy(() => import('./pages/designer/DesignerHome'))
const DesignerGraphicsList = lazy(() => import('./pages/designer/DesignerGraphicsList'))
const DesignerReportsList = lazy(() => import('./pages/designer/DesignerReportsList'))
const DesignerImport = lazy(() => import('./pages/designer/DesignerImport'))
const DesignerDashboardsList = lazy(() => import('./pages/designer/DesignerDashboardsList'))
const SymbolLibrary = lazy(() => import('./pages/designer/SymbolLibrary'))

// Dashboards module
const DashboardsPage = lazy(() => import('./pages/dashboards/index'))
const DashboardViewer = lazy(() => import('./pages/dashboards/DashboardViewer'))
const DashboardBuilder = lazy(() => import('./pages/dashboards/DashboardBuilder'))
const PlaylistPlayer = lazy(() => import('./pages/dashboards/PlaylistPlayer'))

// Reports module
const ReportsPage = lazy(() => import('./pages/reports/index'))
const ReportViewer = lazy(() => import('./pages/reports/ReportViewer'))
const ReportTemplates = lazy(() => import('./pages/reports/ReportTemplates'))
const ReportGenerator = lazy(() => import('./pages/reports/ReportGenerator'))
const ReportHistory = lazy(() => import('./pages/reports/ReportHistory'))
const ReportSchedules = lazy(() => import('./pages/reports/ReportSchedules'))
const MyExports = lazy(() => import('./pages/reports/MyExports'))
const UserProfile = lazy(() => import('./pages/profile/UserProfile'))

// Forensics module
const ForensicsPage = lazy(() => import('./pages/forensics/index'))
const InvestigationWorkspace = lazy(() => import('./pages/forensics/InvestigationWorkspace'))
const ForensicsNew = lazy(() => import('./pages/forensics/ForensicsNew'))
const InvestigationEditor = lazy(() => import('./pages/forensics/InvestigationEditor'))

// Log module
const LogPage = lazy(() => import('./pages/log/index'))
const LogEditor = lazy(() => import('./pages/log/LogEditor'))
const LogNew = lazy(() => import('./pages/log/LogNew'))
const LogEntryEdit = lazy(() => import('./pages/log/LogEntryEdit'))
const LogTemplates = lazy(() => import(/* @vite-prefetch */ './pages/log/LogTemplates'))
const LogSchedules = lazy(() => import('./pages/log/LogSchedules'))
const TemplateEditor = lazy(() => import('./pages/log/TemplateEditor'))

// Rounds module
const RoundsPage = lazy(() => import('./pages/rounds/index'))
const RoundPlayer = lazy(() => import('./pages/rounds/RoundPlayer'))
const TemplateDesigner = lazy(() => import('./pages/rounds/TemplateDesigner'))
const ActiveRounds = lazy(() => import('./pages/rounds/ActiveRounds'))
const RoundTemplates = lazy(() => import('./pages/rounds/RoundTemplates'))
const RoundExecution = lazy(() => import('./pages/rounds/RoundExecution'))
const RoundSchedules = lazy(() => import('./pages/rounds/RoundSchedules'))
const RoundHistory = lazy(() => import('./pages/rounds/RoundHistory'))

// Alerts module
const AlertsPage = lazy(() => import('./pages/alerts/index'))
const MusterDashboard = lazy(() => import('./pages/alerts/MusterDashboard'))
const ActiveAlerts = lazy(() => import('./pages/alerts/ActiveAlerts'))
const AlertHistory = lazy(() => import('./pages/alerts/AlertHistory'))
const AlertComposer = lazy(() => import('./pages/alerts/AlertComposer'))
const AlertTemplates = lazy(() => import('./pages/alerts/AlertTemplates'))
const AlertGroups = lazy(() => import('./pages/alerts/AlertGroups'))
const MusterPage = lazy(() => import('./pages/alerts/MusterPage'))

// Shifts module
const ShiftsPage = lazy(() => import('./pages/shifts/index'))
const ShiftSchedule = lazy(() => import('./pages/shifts/ShiftSchedule'))
const ShiftScheduleEditor = lazy(() => import('./pages/shifts/ShiftScheduleEditor'))
const CrewList = lazy(() => import('./pages/shifts/CrewList'))
const PresenceBoard = lazy(() => import('./pages/shifts/PresenceBoard'))
const MusterPointConfig = lazy(() => import('./pages/shifts/MusterPointConfig'))

// Settings module — kept lazy too for consistent splitting
const SettingsShell = lazy(() => import('./pages/settings/index'))
const UsersPage = lazy(() => import('./pages/settings/Users'))
const UserDetail = lazy(() => import('./pages/settings/UserDetail'))
const RolesPage = lazy(() => import('./pages/settings/Roles'))
const Groups = lazy(() => import('./pages/settings/Groups'))
const OpcSourcesPage = lazy(() => import('./pages/settings/OpcSources'))
const AppearancePage = lazy(() => import('./pages/settings/Appearance'))
const HealthPage = lazy(() => import('./pages/settings/Health'))
const AboutPage = lazy(() => import('./pages/settings/About'))
const EulaAdminPage = lazy(() => import('./pages/settings/EulaAdmin'))
const CertificatesPage = lazy(() => import('./pages/settings/Certificates'))
const BackupRestorePage = lazy(() => import('./pages/settings/BackupRestore'))
const ExpressionLibrary = lazy(() => import('./pages/settings/ExpressionLibrary'))
const ReportScheduling = lazy(() => import('./pages/settings/ReportScheduling'))
const ExportPresets = lazy(() => import('./pages/settings/ExportPresets'))
const EmailSettingsPage = lazy(() => import('./pages/settings/Email'))
const SecurityPage = lazy(() => import('./pages/settings/Security'))
const ImportSettingsPage = lazy(() => import('./pages/settings/Import'))
const RecognitionPage = lazy(() => import('./pages/settings/Recognition'))
const AuthProvidersPage = lazy(() => import('./pages/settings/AuthProviders'))
const MfaSettingsPage = lazy(() => import('./pages/settings/MfaSettings'))
const ApiKeysPage = lazy(() => import('./pages/settings/ApiKeys'))
const ScimTokensPage = lazy(() => import('./pages/settings/ScimTokens'))
const SmsProvidersPage = lazy(() => import('./pages/settings/SmsProviders'))
const SystemHealth = lazy(() => import('./pages/settings/SystemHealth'))
const Sessions = lazy(() => import('./pages/settings/Sessions'))
const Display = lazy(() => import('./pages/settings/Display'))
const DataSources = lazy(() => import('./pages/settings/DataSources'))
const OpcConfig = lazy(() => import('./pages/settings/OpcConfig'))
const PointManagement = lazy(() => import('./pages/settings/PointManagement'))
const EventConfig = lazy(() => import('./pages/settings/EventConfig'))
const AlertConfig = lazy(() => import('./pages/settings/AlertConfig'))
const Badges = lazy(() => import('./pages/settings/Badges'))
const BulkUpdate = lazy(() => import('./pages/settings/BulkUpdate'))
const Snapshots = lazy(() => import('./pages/settings/Snapshots'))
const ArchiveSettings = lazy(() => import('./pages/settings/ArchiveSettings'))

// ---------------------------------------------------------------------------
// Minimal loading fallback used by Suspense boundaries
// ---------------------------------------------------------------------------
function RouteLoadingFallback() {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        minHeight: '200px',
        color: 'var(--io-text-muted)',
        fontSize: '13px',
      }}
    >
      Loading…
    </div>
  )
}

// ---------------------------------------------------------------------------
// Default post-login redirect — resolves to the first module whose required
// permission is held by the authenticated user (sidebar order per doc 38 §1).
// Spec: "The first visible module in sidebar order becomes the default redirect
// after login."
// ---------------------------------------------------------------------------
function useDefaultRoute(): string {
  const { isAuthenticated, user } = useAuthStore()
  if (!isAuthenticated) return '/login'

  const permissions = user?.permissions ?? []
  const first = ROUTE_REGISTRY.find(
    (r) => r.permission === null || permissions.includes(r.permission)
  )
  return first?.path ?? '/settings'
}

function DefaultRedirect() {
  const route = useDefaultRoute()
  return <Navigate to={route} replace />
}

function AppRoutes() {
  return (
    <Suspense fallback={<RouteLoadingFallback />}>
    <Routes>
      {/* Public */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/oidc-callback" element={<OidcCallback />} />
      <Route path="/login/callback" element={<OidcCallback />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/eula" element={<EulaAcceptance />} />

      {/* Authenticated shell */}
      <Route
        path="/"
        element={
          <PermissionGuard permission={null}>
            <EulaGate>
              <ErrorBoundary module="App Shell">
                <AppShell />
              </ErrorBoundary>
            </EulaGate>
          </PermissionGuard>
        }
      >
        {/* Default redirect — resolves to first permitted module per sidebar order */}
        <Route index element={<DefaultRedirect />} />

        {/* My Exports — accessible from any module */}
        <Route
          path="my-exports"
          element={
            <PermissionGuard permission={null}>
              <MyExports />
            </PermissionGuard>
          }
        />

        {/* User profile — accessible from any module via the user menu */}
        <Route
          path="profile"
          element={
            <PermissionGuard permission={null}>
              <UserProfile />
            </PermissionGuard>
          }
        />

        {/* Console module */}
        <Route
          path="console"
          element={
            <PermissionGuard permission="console:read">
              <ErrorBoundary module="Console">
                <ConsolePage />
              </ErrorBoundary>
            </PermissionGuard>
          }
        />
        <Route
          path="console/:workspace_id"
          element={
            <PermissionGuard permission="console:read">
              <ErrorBoundary module="Console">
                <WorkspaceView />
              </ErrorBoundary>
            </PermissionGuard>
          }
        />
        <Route
          path="console/:workspace_id/edit"
          element={
            <PermissionGuard permission="console:write">
              <ErrorBoundary module="Console">
                <WorkspaceEditor />
              </ErrorBoundary>
            </PermissionGuard>
          }
        />

        {/* Process module */}
        <Route
          path="process"
          element={
            <PermissionGuard permission="process:read">
              <ErrorBoundary module="Process">
                <ProcessPage />
              </ErrorBoundary>
            </PermissionGuard>
          }
        />
        <Route
          path="process/:view_id"
          element={
            <PermissionGuard permission="process:read">
              <ErrorBoundary module="Process">
                <ProcessView />
              </ErrorBoundary>
            </PermissionGuard>
          }
        />
        <Route
          path="process/:view_id/edit"
          element={
            <PermissionGuard permission="process:write">
              <ErrorBoundary module="Process">
                <ProcessEditor />
              </ErrorBoundary>
            </PermissionGuard>
          }
        />

        {/* Designer module — nested sub-routes */}
        {/* Mobile guard: Designer is not available on phone/tablet (doc 20 §Code Splitting) */}
        <Route
          path="designer"
          element={
            isMobile ? <MobileNotAvailable module="Designer" /> :
            <PermissionGuard permission="designer:read">
              <ErrorBoundary module="Designer">
                <DesignerHome />
              </ErrorBoundary>
            </PermissionGuard>
          }
        />
        <Route
          path="designer/graphics"
          element={
            isMobile ? <MobileNotAvailable module="Designer" /> :
            <PermissionGuard permission="designer:read">
              <ErrorBoundary module="Designer">
                <DesignerGraphicsList />
              </ErrorBoundary>
            </PermissionGuard>
          }
        />
        <Route
          path="designer/graphics/new"
          element={
            isMobile ? <MobileNotAvailable module="Designer" /> :
            <PermissionGuard permission="designer:write">
              <ErrorBoundary module="Designer">
                <DesignerPage />
              </ErrorBoundary>
            </PermissionGuard>
          }
        />
        <Route
          path="designer/graphics/:id"
          element={
            isMobile ? <MobileNotAvailable module="Designer" /> :
            <PermissionGuard permission="designer:read">
              <ErrorBoundary module="Designer">
                <DesignerPage />
              </ErrorBoundary>
            </PermissionGuard>
          }
        />
        <Route
          path="designer/graphics/:id/edit"
          element={
            isMobile ? <MobileNotAvailable module="Designer" /> :
            <PermissionGuard permission="designer:write">
              <ErrorBoundary module="Designer">
                <DesignerPage />
              </ErrorBoundary>
            </PermissionGuard>
          }
        />
        <Route
          path="designer/dashboards"
          element={
            isMobile ? <MobileNotAvailable module="Designer" /> :
            <PermissionGuard permission="designer:read">
              <ErrorBoundary module="Designer">
                <DesignerDashboardsList />
              </ErrorBoundary>
            </PermissionGuard>
          }
        />
        <Route
          path="designer/dashboards/new"
          element={
            isMobile ? <MobileNotAvailable module="Designer" /> :
            <PermissionGuard permission="dashboards:write">
              <ErrorBoundary module="Designer">
                <DashboardBuilder />
              </ErrorBoundary>
            </PermissionGuard>
          }
        />
        <Route
          path="designer/dashboards/:id/edit"
          element={
            isMobile ? <MobileNotAvailable module="Designer" /> :
            <PermissionGuard permission="dashboards:write">
              <ErrorBoundary module="Designer">
                <DashboardBuilder />
              </ErrorBoundary>
            </PermissionGuard>
          }
        />
        <Route
          path="designer/reports"
          element={
            isMobile ? <MobileNotAvailable module="Designer" /> :
            <PermissionGuard permission="designer:read">
              <ErrorBoundary module="Designer">
                <DesignerReportsList />
              </ErrorBoundary>
            </PermissionGuard>
          }
        />
        <Route
          path="designer/reports/new"
          element={
            isMobile ? <MobileNotAvailable module="Designer" /> :
            <PermissionGuard permission="designer:write">
              <ErrorBoundary module="Designer">
                <DesignerPage />
              </ErrorBoundary>
            </PermissionGuard>
          }
        />
        <Route
          path="designer/reports/:id/edit"
          element={
            isMobile ? <MobileNotAvailable module="Designer" /> :
            <PermissionGuard permission="designer:write">
              <ErrorBoundary module="Designer">
                <DesignerPage />
              </ErrorBoundary>
            </PermissionGuard>
          }
        />
        <Route
          path="designer/symbols"
          element={
            isMobile ? <MobileNotAvailable module="Designer" /> :
            <PermissionGuard permission="designer:read">
              <ErrorBoundary module="Designer">
                <SymbolLibrary />
              </ErrorBoundary>
            </PermissionGuard>
          }
        />
        <Route
          path="designer/import"
          element={
            isMobile ? <MobileNotAvailable module="Designer" /> :
            <PermissionGuard permission="designer:import">
              <ErrorBoundary module="Designer">
                <DesignerImport />
              </ErrorBoundary>
            </PermissionGuard>
          }
        />

        {/* Dashboards module — static paths before parameterised */}
        <Route
          path="dashboards"
          element={
            <PermissionGuard permission="dashboards:read">
              <ErrorBoundary module="Dashboards">
                <DashboardsPage />
              </ErrorBoundary>
            </PermissionGuard>
          }
        />
        <Route
          path="dashboards/new"
          element={
            <PermissionGuard permission="dashboards:write">
              <ErrorBoundary module="Dashboards">
                <DashboardBuilder />
              </ErrorBoundary>
            </PermissionGuard>
          }
        />
        <Route
          path="dashboards/playlist/:id"
          element={
            <PermissionGuard permission="dashboards:read">
              <ErrorBoundary module="Dashboards">
                <PlaylistPlayer />
              </ErrorBoundary>
            </PermissionGuard>
          }
        />
        <Route
          path="dashboards/:id"
          element={
            <PermissionGuard permission="dashboards:read">
              <ErrorBoundary module="Dashboards">
                <DashboardViewer />
              </ErrorBoundary>
            </PermissionGuard>
          }
        />
        <Route
          path="dashboards/:id/edit"
          element={
            <PermissionGuard permission="dashboards:write">
              <ErrorBoundary module="Dashboards">
                <DashboardBuilder />
              </ErrorBoundary>
            </PermissionGuard>
          }
        />

        {/* Reports module — static paths before parameterised */}
        <Route
          path="reports/templates"
          element={
            <PermissionGuard permission="reports:read">
              <ErrorBoundary module="Reports">
                <ReportTemplates />
              </ErrorBoundary>
            </PermissionGuard>
          }
        />
        <Route
          path="reports/generate/:template_id"
          element={
            <PermissionGuard permission="reports:read">
              <ErrorBoundary module="Reports">
                <ReportGenerator />
              </ErrorBoundary>
            </PermissionGuard>
          }
        />
        <Route
          path="reports/history"
          element={
            <PermissionGuard permission="reports:read">
              <ErrorBoundary module="Reports">
                <ReportHistory />
              </ErrorBoundary>
            </PermissionGuard>
          }
        />
        <Route
          path="reports/schedules"
          element={
            <PermissionGuard permission="reports:admin">
              <ErrorBoundary module="Reports">
                <ReportSchedules />
              </ErrorBoundary>
            </PermissionGuard>
          }
        />
        <Route
          path="reports/view/:jobId"
          element={
            <PermissionGuard permission="reports:read">
              <ErrorBoundary module="Reports">
                <ReportViewer />
              </ErrorBoundary>
            </PermissionGuard>
          }
        />
        <Route
          path="reports/exports"
          element={
            <PermissionGuard permission="reports:read">
              <ErrorBoundary module="Reports">
                <MyExports />
              </ErrorBoundary>
            </PermissionGuard>
          }
        />
        <Route
          path="reports/*"
          element={
            <PermissionGuard permission="reports:read">
              <ErrorBoundary module="Reports">
                <ReportsPage />
              </ErrorBoundary>
            </PermissionGuard>
          }
        />

        {/* Forensics module — static paths before parameterised */}
        {/* Mobile guard: Forensics is not available on phone/tablet (doc 20 §Code Splitting) */}
        <Route
          path="forensics"
          element={
            isMobile ? <MobileNotAvailable module="Forensics" /> :
            <PermissionGuard permission="forensics:read">
              <ErrorBoundary module="Forensics">
                <ForensicsPage />
              </ErrorBoundary>
            </PermissionGuard>
          }
        />
        <Route
          path="forensics/new"
          element={
            isMobile ? <MobileNotAvailable module="Forensics" /> :
            <PermissionGuard permission="forensics:write">
              <ErrorBoundary module="Forensics">
                <ForensicsNew />
              </ErrorBoundary>
            </PermissionGuard>
          }
        />
        <Route
          path="forensics/:id/edit"
          element={
            isMobile ? <MobileNotAvailable module="Forensics" /> :
            <PermissionGuard permission="forensics:write">
              <ErrorBoundary module="Forensics">
                <InvestigationEditor />
              </ErrorBoundary>
            </PermissionGuard>
          }
        />
        <Route
          path="forensics/:id"
          element={
            isMobile ? <MobileNotAvailable module="Forensics" /> :
            <PermissionGuard permission="forensics:read">
              <ErrorBoundary module="Forensics">
                <InvestigationWorkspace />
              </ErrorBoundary>
            </PermissionGuard>
          }
        />

        {/* Log module — static paths before parameterised */}
        <Route
          path="log"
          element={
            <PermissionGuard permission="log:read">
              <ErrorBoundary module="Log">
                <LogPage />
              </ErrorBoundary>
            </PermissionGuard>
          }
        />
        <Route
          path="log/new"
          element={
            <PermissionGuard permission="log:write">
              <ErrorBoundary module="Log">
                <LogNew />
              </ErrorBoundary>
            </PermissionGuard>
          }
        />
        <Route
          path="log/templates"
          element={
            <PermissionGuard permission="log:admin">
              <ErrorBoundary module="Log">
                <LogTemplates />
              </ErrorBoundary>
            </PermissionGuard>
          }
        />
        <Route
          path="log/schedules"
          element={
            <PermissionGuard permission="log:admin">
              <ErrorBoundary module="Log">
                <LogSchedules />
              </ErrorBoundary>
            </PermissionGuard>
          }
        />
        <Route
          path="log/templates/:id/edit"
          element={
            <PermissionGuard permission="log:admin">
              <ErrorBoundary module="Log">
                <TemplateEditor />
              </ErrorBoundary>
            </PermissionGuard>
          }
        />
        <Route
          path="log/:id/edit"
          element={
            <PermissionGuard permission="log:write">
              <ErrorBoundary module="Log">
                <LogEntryEdit />
              </ErrorBoundary>
            </PermissionGuard>
          }
        />
        <Route
          path="log/:id"
          element={
            <PermissionGuard permission="log:read">
              <ErrorBoundary module="Log">
                <LogEditor />
              </ErrorBoundary>
            </PermissionGuard>
          }
        />

        {/* Rounds module — static paths before parameterised */}
        <Route
          path="rounds"
          element={
            <PermissionGuard permission="rounds:read">
              <ErrorBoundary module="Rounds">
                <RoundsPage />
              </ErrorBoundary>
            </PermissionGuard>
          }
        />
        <Route
          path="rounds/active"
          element={
            <PermissionGuard permission="rounds:read">
              <ErrorBoundary module="Rounds">
                <ActiveRounds />
              </ErrorBoundary>
            </PermissionGuard>
          }
        />
        <Route
          path="rounds/templates"
          element={
            <PermissionGuard permission="rounds:template_manage">
              <ErrorBoundary module="Rounds">
                <RoundTemplates />
              </ErrorBoundary>
            </PermissionGuard>
          }
        />
        <Route
          path="rounds/schedules"
          element={
            <PermissionGuard permission="rounds:schedule_manage">
              <ErrorBoundary module="Rounds">
                <RoundSchedules />
              </ErrorBoundary>
            </PermissionGuard>
          }
        />
        <Route
          path="rounds/history"
          element={
            <PermissionGuard permission="rounds:read">
              <ErrorBoundary module="Rounds">
                <RoundHistory />
              </ErrorBoundary>
            </PermissionGuard>
          }
        />
        <Route
          path="rounds/templates/:id/edit"
          element={
            <PermissionGuard permission="rounds:template_manage">
              <ErrorBoundary module="Rounds">
                <TemplateDesigner />
              </ErrorBoundary>
            </PermissionGuard>
          }
        />
        <Route
          path="rounds/:instance_id/execute"
          element={
            <PermissionGuard permission="rounds:execute">
              <ErrorBoundary module="Rounds">
                <RoundExecution />
              </ErrorBoundary>
            </PermissionGuard>
          }
        />
        <Route
          path="rounds/:id"
          element={
            <PermissionGuard permission="rounds:execute">
              <ErrorBoundary module="Rounds">
                <RoundPlayer />
              </ErrorBoundary>
            </PermissionGuard>
          }
        />

        {/* Alerts module — static paths before parameterised */}
        <Route
          path="alerts"
          element={
            <PermissionGuard permission="alerts:read">
              <ErrorBoundary module="Alerts">
                <AlertsPage />
              </ErrorBoundary>
            </PermissionGuard>
          }
        />
        <Route
          path="alerts/active"
          element={
            <PermissionGuard permission="alerts:read">
              <ErrorBoundary module="Alerts">
                <ActiveAlerts />
              </ErrorBoundary>
            </PermissionGuard>
          }
        />
        <Route
          path="alerts/history"
          element={
            <PermissionGuard permission="alerts:read">
              <ErrorBoundary module="Alerts">
                <AlertHistory />
              </ErrorBoundary>
            </PermissionGuard>
          }
        />
        <Route
          path="alerts/send"
          element={
            <PermissionGuard permission="alerts:send">
              <ErrorBoundary module="Alerts">
                <AlertComposer />
              </ErrorBoundary>
            </PermissionGuard>
          }
        />
        <Route
          path="alerts/templates"
          element={
            <PermissionGuard permission="alerts:manage_templates">
              <ErrorBoundary module="Alerts">
                <AlertTemplates />
              </ErrorBoundary>
            </PermissionGuard>
          }
        />
        <Route
          path="alerts/groups"
          element={
            <PermissionGuard permission="alerts:manage_groups">
              <ErrorBoundary module="Alerts">
                <AlertGroups />
              </ErrorBoundary>
            </PermissionGuard>
          }
        />
        <Route
          path="alerts/muster"
          element={
            <PermissionGuard permission="alerts:muster">
              <ErrorBoundary module="Alerts">
                <MusterPage />
              </ErrorBoundary>
            </PermissionGuard>
          }
        />
        <Route
          path="alerts/muster/:messageId"
          element={
            <PermissionGuard permission="alerts:read">
              <ErrorBoundary module="Alerts">
                <MusterDashboard />
              </ErrorBoundary>
            </PermissionGuard>
          }
        />

        {/* Shifts module — static paths before parameterised */}
        <Route
          path="shifts"
          element={
            <PermissionGuard permission="shifts:read">
              <ErrorBoundary module="Shifts">
                <ShiftsPage />
              </ErrorBoundary>
            </PermissionGuard>
          }
        />
        <Route
          path="shifts/schedule"
          element={
            <PermissionGuard permission="shifts:read">
              <ErrorBoundary module="Shifts">
                <ShiftSchedule />
              </ErrorBoundary>
            </PermissionGuard>
          }
        />
        <Route
          path="shifts/schedule/edit"
          element={
            <PermissionGuard permission="shifts:write">
              <ErrorBoundary module="Shifts">
                <ShiftScheduleEditor />
              </ErrorBoundary>
            </PermissionGuard>
          }
        />
        <Route
          path="shifts/crews"
          element={
            <PermissionGuard permission="shifts:read">
              <ErrorBoundary module="Shifts">
                <CrewList />
              </ErrorBoundary>
            </PermissionGuard>
          }
        />
        <Route
          path="shifts/presence"
          element={
            <PermissionGuard permission="presence:read">
              <ErrorBoundary module="Shifts">
                <PresenceBoard />
              </ErrorBoundary>
            </PermissionGuard>
          }
        />
        <Route
          path="shifts/muster-points"
          element={
            <PermissionGuard permission="muster:manage">
              <ErrorBoundary module="Shifts">
                <MusterPointConfig />
              </ErrorBoundary>
            </PermissionGuard>
          }
        />

        {/* Settings */}
        {/* Mobile guard: Settings is not available on phone/tablet (doc 20 §Code Splitting) */}
        <Route
          path="settings"
          element={
            isMobile
              ? <MobileNotAvailable module="Settings" />
              : <ErrorBoundary module="Settings"><SettingsShell /></ErrorBoundary>
          }
        >
          <Route index element={<Navigate to="users" replace />} />
          <Route
            path="users"
            element={
              <PermissionGuard permission="system:manage_users">
                <UsersPage />
              </PermissionGuard>
            }
          />
          <Route
            path="users/:id"
            element={
              <PermissionGuard permission="system:manage_users">
                <UserDetail />
              </PermissionGuard>
            }
          />
          <Route
            path="groups"
            element={
              <PermissionGuard permission="system:manage_groups">
                <Groups />
              </PermissionGuard>
            }
          />
          <Route
            path="roles"
            element={
              <PermissionGuard permission="system:manage_roles">
                <RolesPage />
              </PermissionGuard>
            }
          />
          <Route
            path="opc-sources"
            element={
              <PermissionGuard permission="system:opc_config">
                <OpcSourcesPage />
              </PermissionGuard>
            }
          />
          <Route
            path="sources"
            element={
              <PermissionGuard permission="system:source_config">
                <DataSources />
              </PermissionGuard>
            }
          />
          <Route
            path="sources/:id"
            element={
              <PermissionGuard permission="system:source_config">
                <DataSources detail />
              </PermissionGuard>
            }
          />
          <Route
            path="opc"
            element={
              <PermissionGuard permission="system:opc_config">
                <OpcConfig />
              </PermissionGuard>
            }
          />
          <Route
            path="points"
            element={
              <PermissionGuard permission="system:point_config">
                <PointManagement />
              </PermissionGuard>
            }
          />
          <Route
            path="events"
            element={
              <PermissionGuard permission="system:event_config">
                <EventConfig />
              </PermissionGuard>
            }
          />
          <Route
            path="alerts"
            element={
              <PermissionGuard permission="alerts:configure">
                <AlertConfig />
              </PermissionGuard>
            }
          />
          <Route
            path="badges"
            element={
              <PermissionGuard permission="badge_config:manage">
                <Badges />
              </PermissionGuard>
            }
          />
          <Route
            path="bulk-update"
            element={
              <PermissionGuard permission="system:bulk_update">
                <BulkUpdate />
              </PermissionGuard>
            }
          />
          <Route
            path="snapshots"
            element={
              <PermissionGuard permission="system:change_backup">
                <Snapshots />
              </PermissionGuard>
            }
          />
          <Route
            path="system-health"
            element={
              <PermissionGuard permission="system:monitor">
                <SystemHealth />
              </PermissionGuard>
            }
          />
          <Route
            path="sessions"
            element={
              <PermissionGuard permission={null}>
                <Sessions />
              </PermissionGuard>
            }
          />
          <Route path="display" element={<PermissionGuard permission={null}><Display /></PermissionGuard>} />
          <Route path="appearance" element={<PermissionGuard permission={null}><AppearancePage /></PermissionGuard>} />
          <Route path="health" element={<PermissionGuard permission="system:monitor"><HealthPage /></PermissionGuard>} />
          <Route path="about" element={<PermissionGuard permission={null}><AboutPage /></PermissionGuard>} />
          <Route
            path="eula"
            element={
              <PermissionGuard permission="system:configure">
                <EulaAdminPage />
              </PermissionGuard>
            }
          />
          <Route path="certificates" element={<PermissionGuard permission="system:certificates"><CertificatesPage /></PermissionGuard>} />
          <Route path="archive" element={<PermissionGuard permission="system:configure"><ArchiveSettings /></PermissionGuard>} />
          <Route path="backup" element={<PermissionGuard permission="system:change_backup"><BackupRestorePage /></PermissionGuard>} />
          <Route path="expressions" element={<PermissionGuard permission="system:expression_manage"><ExpressionLibrary /></PermissionGuard>} />
          <Route path="report-scheduling" element={<PermissionGuard permission="reports:schedule_manage"><ReportScheduling /></PermissionGuard>} />
          <Route path="export-presets" element={<PermissionGuard permission="settings:export"><ExportPresets /></PermissionGuard>} />
          <Route
            path="email"
            element={
              <PermissionGuard permission="email:configure">
                <EmailSettingsPage />
              </PermissionGuard>
            }
          />
          <Route path="security" element={<PermissionGuard permission="system:configure"><SecurityPage /></PermissionGuard>} />
          <Route
            path="import"
            element={
              <PermissionGuard permission="settings:write">
                <ImportSettingsPage />
              </PermissionGuard>
            }
          />
          {/* Doc 38 alias: /settings/imports → /settings/import */}
          <Route
            path="imports"
            element={
              <PermissionGuard permission="settings:write">
                <ImportSettingsPage />
              </PermissionGuard>
            }
          />
          <Route
            path="auth-providers"
            element={
              <PermissionGuard permission="auth:configure">
                <AuthProvidersPage />
              </PermissionGuard>
            }
          />
          {/* Doc 38 alias: /settings/auth → /settings/auth-providers */}
          <Route
            path="auth"
            element={
              <PermissionGuard permission="auth:configure">
                <AuthProvidersPage />
              </PermissionGuard>
            }
          />
          <Route
            path="mfa"
            element={
              <PermissionGuard permission="auth:manage_mfa">
                <MfaSettingsPage />
              </PermissionGuard>
            }
          />
          <Route
            path="api-keys"
            element={
              <PermissionGuard permission="auth:manage_api_keys">
                <ApiKeysPage />
              </PermissionGuard>
            }
          />
          <Route
            path="scim"
            element={
              <PermissionGuard permission="auth:configure">
                <ScimTokensPage />
              </PermissionGuard>
            }
          />
          <Route
            path="sms-providers"
            element={
              <PermissionGuard permission="system:configure">
                <SmsProvidersPage />
              </PermissionGuard>
            }
          />
          {/* Doc 38 import sub-routes */}
          <Route
            path="imports/connections"
            element={
              <PermissionGuard permission="system:import_connections">
                <ImportSettingsPage defaultTab="connections" />
              </PermissionGuard>
            }
          />
          <Route
            path="imports/definitions"
            element={
              <PermissionGuard permission="system:import_definitions">
                <ImportSettingsPage defaultTab="definitions" />
              </PermissionGuard>
            }
          />
          <Route
            path="imports/history"
            element={
              <PermissionGuard permission="system:import_history">
                <ImportSettingsPage defaultTab="runs" />
              </PermissionGuard>
            }
          />
          <Route
            path="recognition"
            element={
              <PermissionGuard permission="settings:admin">
                <RecognitionPage />
              </PermissionGuard>
            }
          />
        </Route>
      </Route>

      {/* ------------------------------------------------------------------ */}
      {/* Detached window routes — no AppShell chrome (no sidebar/topbar)    */}
      {/* Used for multi-monitor setups where a workspace or dashboard is    */}
      {/* opened in a dedicated browser window.                              */}
      {/* spec: 06_FRONTEND_SHELL.md §Detached Window Routes                 */}
      {/* ------------------------------------------------------------------ */}
      <Route
        path="/detached/console/:workspaceId"
        element={
          <PermissionGuard permission="console:read">
            <ErrorBoundary module="Console">
              <WorkspaceView detached />
            </ErrorBoundary>
          </PermissionGuard>
        }
      />
      <Route
        path="/detached/process/:viewId"
        element={
          <PermissionGuard permission="process:read">
            <ErrorBoundary module="Process-Detached">
              <ProcessDetachedView />
            </ErrorBoundary>
          </PermissionGuard>
        }
      />
      <Route
        path="/detached/dashboard/:id"
        element={
          <PermissionGuard permission="dashboards:read">
            <ErrorBoundary module="Dashboards">
              <DashboardViewer kiosk />
            </ErrorBoundary>
          </PermissionGuard>
        }
      />

      {/* 404 */}
      <Route path="*" element={<NotFound />} />
    </Routes>
    </Suspense>
  )
}

/**
 * Shell-level pinned PointDetailPanel host.
 *
 * Renders all pinned panels outside the route outlet so they survive
 * navigation (spec CX-POINT-DETAIL non-negotiable #3).
 */
function PinnedPointDetailPanels() {
  const { pinnedPanels, unpinPanel } = usePointDetailStore()

  return (
    <>
      {pinnedPanels.map((panel) => (
        <PointDetailPanel
          key={panel.id}
          pointId={panel.pointId}
          panelId={panel.id}
          anchorPosition={panel.anchorPosition}
          isPinned
          onClose={() => unpinPanel(panel.id)}
        />
      ))}
    </>
  )
}

/**
 * BroadcastChannel receiver — applies sync messages originating from other
 * open windows.  Published by store/ui.ts and store/auth.ts.
 * spec: 06_FRONTEND_SHELL.md §BroadcastChannel State Sync
 */
/**
 * UomCatalogInit — fetches the UOM catalog once at app startup.
 *
 * Renders null. Kicks off fetchCatalog() which is idempotent — safe to call
 * repeatedly even if the component ever remounts.
 *
 * spec: design-docs/10_DASHBOARDS_MODULE.md §UOM Conversion
 * "The UOM catalog is cached at application startup."
 */
function UomCatalogInit() {
  const fetchCatalog = useUomStore((s) => s.fetchCatalog)

  useEffect(() => {
    void fetchCatalog()
  }, [fetchCatalog])

  return null
}

function BroadcastSyncReceiver() {
  const { lockLocal, unlockLocal, setThemeLocal } = useUiStore()
  const { setAccessToken } = useAuthStore()

  useEffect(() => {
    const unsub = subscribeToSync((msg) => {
      switch (msg.type) {
        case 'theme:change':
          if (msg.theme) {
            // Use the local (no-rebroadcast) setter to apply the theme
            setThemeLocal(msg.theme as Parameters<typeof setThemeLocal>[0])
          }
          break
        case 'session:lock':
          lockLocal()
          break
        case 'session:unlock':
          unlockLocal()
          break
        case 'auth:refresh':
          if (msg.token) {
            // setAccessToken already does localStorage + store update; it also
            // broadcasts — but the channel will not echo back to the sender
            // window (BroadcastChannel does not fire on the posting window).
            setAccessToken(msg.token)
          }
          break
        default:
          break
      }
    })
    return unsub
  }, [lockLocal, unlockLocal, setThemeLocal, setAccessToken])

  return null
}

export default function App() {
  return (
    <ThemeProvider>
      <BroadcastSyncReceiver />
      <UomCatalogInit />
      <AppRoutes />
      <ToastProvider />
      {/* Pinned point detail panels — rendered outside the route outlet so they
          survive navigation between Console, Process, and other modules. */}
      <PinnedPointDetailPanels />
    </ThemeProvider>
  )
}
