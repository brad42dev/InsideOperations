import { Routes, Route, Navigate } from 'react-router-dom'
import { useEffect } from 'react'
import { initTheme } from './shared/theme/tokens'
import AppShell from './shared/layout/AppShell'
import PermissionGuard from './shared/components/PermissionGuard'
import DesignerPage from './pages/designer/index'
import DesignerHome from './pages/designer/DesignerHome'
import DesignerGraphicsList from './pages/designer/DesignerGraphicsList'
import DesignerReportsList from './pages/designer/DesignerReportsList'
import DesignerImport from './pages/designer/DesignerImport'
import DesignerDashboardsList from './pages/designer/DesignerDashboardsList'
import ConsolePage from './pages/console/index'
import WorkspaceView from './pages/console/WorkspaceView'
import WorkspaceEditor from './pages/console/WorkspaceEditor'
import ProcessPage from './pages/process/index'
import ProcessView from './pages/process/ProcessView'
import ProcessEditor from './pages/process/ProcessEditor'
import LoginPage from './pages/Login'
import NotFound from './pages/NotFound'
import ResetPassword from './pages/ResetPassword'
import EulaAcceptance from './pages/EulaAcceptance'
import EulaGate from './pages/EulaGate'
import SettingsShell from './pages/settings/index'
import UsersPage from './pages/settings/Users'
import UserDetail from './pages/settings/UserDetail'
import RolesPage from './pages/settings/Roles'
import Groups from './pages/settings/Groups'
import OpcSourcesPage from './pages/settings/OpcSources'
import AppearancePage from './pages/settings/Appearance'
import HealthPage from './pages/settings/Health'
import AboutPage from './pages/settings/About'
import EulaAdminPage from './pages/settings/EulaAdmin'
import CertificatesPage from './pages/settings/Certificates'
import BackupRestorePage from './pages/settings/BackupRestore'
import ExpressionLibrary from './pages/settings/ExpressionLibrary'
import ReportScheduling from './pages/settings/ReportScheduling'
import ExportPresets from './pages/settings/ExportPresets'
import EmailSettingsPage from './pages/settings/Email'
import SecurityPage from './pages/settings/Security'
import ImportSettingsPage from './pages/settings/Import'
import RecognitionPage from './pages/settings/Recognition'
import AuthProvidersPage from './pages/settings/AuthProviders'
import SystemHealth from './pages/settings/SystemHealth'
import Sessions from './pages/settings/Sessions'
import Display from './pages/settings/Display'
import DataSources from './pages/settings/DataSources'
import OpcConfig from './pages/settings/OpcConfig'
import PointManagement from './pages/settings/PointManagement'
import EventConfig from './pages/settings/EventConfig'
import AlertConfig from './pages/settings/AlertConfig'
import Badges from './pages/settings/Badges'
import BulkUpdate from './pages/settings/BulkUpdate'
import Snapshots from './pages/settings/Snapshots'
import OidcCallback from './pages/OidcCallback'
import ReportsPage from './pages/reports/index'
import ReportViewer from './pages/reports/ReportViewer'
import ReportTemplates from './pages/reports/ReportTemplates'
import ReportGenerator from './pages/reports/ReportGenerator'
import ReportHistory from './pages/reports/ReportHistory'
import ReportSchedules from './pages/reports/ReportSchedules'
import MyExports from './pages/reports/MyExports'
import DashboardsPage from './pages/dashboards/index'
import DashboardViewer from './pages/dashboards/DashboardViewer'
import DashboardBuilder from './pages/dashboards/DashboardBuilder'
import PlaylistPlayer from './pages/dashboards/PlaylistPlayer'
import ForensicsPage from './pages/forensics/index'
import InvestigationWorkspace from './pages/forensics/InvestigationWorkspace'
import ForensicsNew from './pages/forensics/ForensicsNew'
import InvestigationEditor from './pages/forensics/InvestigationEditor'
import RoundsPage from './pages/rounds/index'
import RoundPlayer from './pages/rounds/RoundPlayer'
import TemplateDesigner from './pages/rounds/TemplateDesigner'
import ActiveRounds from './pages/rounds/ActiveRounds'
import RoundTemplates from './pages/rounds/RoundTemplates'
import RoundExecution from './pages/rounds/RoundExecution'
import RoundSchedules from './pages/rounds/RoundSchedules'
import RoundHistory from './pages/rounds/RoundHistory'
import LogPage from './pages/log/index'
import LogEditor from './pages/log/LogEditor'
import LogNew from './pages/log/LogNew'
import LogEntryEdit from './pages/log/LogEntryEdit'
import LogTemplates from './pages/log/LogTemplates'
import LogSchedules from './pages/log/LogSchedules'
import TemplateEditor from './pages/log/TemplateEditor'
import AlertsPage from './pages/alerts/index'
import MusterDashboard from './pages/alerts/MusterDashboard'
import ActiveAlerts from './pages/alerts/ActiveAlerts'
import AlertHistory from './pages/alerts/AlertHistory'
import AlertComposer from './pages/alerts/AlertComposer'
import AlertTemplates from './pages/alerts/AlertTemplates'
import AlertGroups from './pages/alerts/AlertGroups'
import MusterPage from './pages/alerts/MusterPage'
import ShiftsPage from './pages/shifts/index'
import ShiftSchedule from './pages/shifts/ShiftSchedule'
import ShiftScheduleEditor from './pages/shifts/ShiftScheduleEditor'
import CrewList from './pages/shifts/CrewList'
import PresenceBoard from './pages/shifts/PresenceBoard'
import MusterPointConfig from './pages/shifts/MusterPointConfig'
import ToastProvider from './shared/components/Toast'
import { ErrorBoundary } from './shared/components/ErrorBoundary'
import { useAuthStore } from './store/auth'

function AppRoutes() {
  const { isAuthenticated } = useAuthStore()

  return (
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
              <AppShell />
            </EulaGate>
          </PermissionGuard>
        }
      >
        {/* Default redirect */}
        <Route index element={<Navigate to={isAuthenticated ? '/settings/users' : '/login'} replace />} />

        {/* My Exports — accessible from any module */}
        <Route
          path="my-exports"
          element={
            <PermissionGuard permission={null}>
              <MyExports />
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
        <Route
          path="designer"
          element={
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
            <PermissionGuard permission="designer:write">
              <ErrorBoundary module="Designer">
                <DesignerPage />
              </ErrorBoundary>
            </PermissionGuard>
          }
        />
        <Route path="designer/symbols" element={<Navigate to="/designer" replace />} />
        <Route
          path="designer/import"
          element={
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
            <PermissionGuard permission="reports:generate">
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
            <PermissionGuard permission="reports:schedule_manage">
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
        <Route
          path="forensics"
          element={
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
            <PermissionGuard permission="log:template_manage">
              <ErrorBoundary module="Log">
                <LogTemplates />
              </ErrorBoundary>
            </PermissionGuard>
          }
        />
        <Route
          path="log/schedules"
          element={
            <PermissionGuard permission="log:schedule_manage">
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
        <Route path="settings" element={<SettingsShell />}>
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
              <PermissionGuard permission="system:manage_users">
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
          <Route path="display" element={<Display />} />
          <Route path="appearance" element={<AppearancePage />} />
          <Route path="health" element={<HealthPage />} />
          <Route path="about" element={<AboutPage />} />
          <Route
            path="eula"
            element={
              <PermissionGuard permission="system:configure">
                <EulaAdminPage />
              </PermissionGuard>
            }
          />
          <Route path="certificates" element={<CertificatesPage />} />
          <Route path="backup" element={<BackupRestorePage />} />
          <Route path="expressions" element={<ExpressionLibrary />} />
          <Route path="report-scheduling" element={<ReportScheduling />} />
          <Route path="export-presets" element={<ExportPresets />} />
          <Route
            path="email"
            element={
              <PermissionGuard permission="settings:write">
                <EmailSettingsPage />
              </PermissionGuard>
            }
          />
          <Route path="security" element={<SecurityPage />} />
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
          {/* Doc 38 import sub-routes */}
          <Route
            path="imports/connections"
            element={
              <PermissionGuard permission="settings:write">
                <ImportSettingsPage defaultTab="connections" />
              </PermissionGuard>
            }
          />
          <Route
            path="imports/definitions"
            element={
              <PermissionGuard permission="settings:write">
                <ImportSettingsPage defaultTab="definitions" />
              </PermissionGuard>
            }
          />
          <Route
            path="imports/history"
            element={
              <PermissionGuard permission="settings:write">
                <ImportSettingsPage defaultTab="runs" />
              </PermissionGuard>
            }
          />
          <Route
            path="recognition"
            element={
              <PermissionGuard permission="settings:write">
                <RecognitionPage />
              </PermissionGuard>
            }
          />
        </Route>
      </Route>

      {/* 404 */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}

export default function App() {
  useEffect(() => {
    initTheme()
  }, [])

  return (
    <>
      <AppRoutes />
      <ToastProvider />
    </>
  )
}
