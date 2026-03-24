use serde::{Deserialize, Serialize};

/// All 118 RBAC permissions in the I/O system.
///
/// Each variant carries an explicit serde rename so that the wire format matches
/// the `"module:action"` string expected by the database and JWT claims.
/// Do NOT add `rename_all` — the colon in permission names is not handled by it.
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum Permission {
    // -----------------------------------------------------------------
    // Console Module (7)
    // -----------------------------------------------------------------
    #[serde(rename = "console:read")]
    ConsoleRead,
    #[serde(rename = "console:write")]
    ConsoleWrite,
    #[serde(rename = "console:workspace_write")]
    ConsoleWorkspaceWrite,
    #[serde(rename = "console:workspace_publish")]
    ConsoleWorkspacePublish,
    #[serde(rename = "console:workspace_delete")]
    ConsoleWorkspaceDelete,
    #[serde(rename = "console:export")]
    ConsoleExport,
    #[serde(rename = "console:admin")]
    ConsoleAdmin,

    // -----------------------------------------------------------------
    // Process Module (6)
    // -----------------------------------------------------------------
    #[serde(rename = "process:read")]
    ProcessRead,
    #[serde(rename = "process:write")]
    ProcessWrite,
    #[serde(rename = "process:publish")]
    ProcessPublish,
    #[serde(rename = "process:delete")]
    ProcessDelete,
    #[serde(rename = "process:export")]
    ProcessExport,
    #[serde(rename = "process:admin")]
    ProcessAdmin,

    // -----------------------------------------------------------------
    // Designer Module (7)
    // -----------------------------------------------------------------
    #[serde(rename = "designer:read")]
    DesignerRead,
    #[serde(rename = "designer:write")]
    DesignerWrite,
    #[serde(rename = "designer:delete")]
    DesignerDelete,
    #[serde(rename = "designer:publish")]
    DesignerPublish,
    #[serde(rename = "designer:import")]
    DesignerImport,
    #[serde(rename = "designer:export")]
    DesignerExport,
    #[serde(rename = "designer:admin")]
    DesignerAdmin,

    // -----------------------------------------------------------------
    // Dashboards Module (6)
    // -----------------------------------------------------------------
    #[serde(rename = "dashboards:read")]
    DashboardsRead,
    #[serde(rename = "dashboards:write")]
    DashboardsWrite,
    #[serde(rename = "dashboards:delete")]
    DashboardsDelete,
    #[serde(rename = "dashboards:publish")]
    DashboardsPublish,
    #[serde(rename = "dashboards:export")]
    DashboardsExport,
    #[serde(rename = "dashboards:admin")]
    DashboardsAdmin,

    // -----------------------------------------------------------------
    // Reports Module (7)
    // -----------------------------------------------------------------
    #[serde(rename = "reports:read")]
    ReportsRead,
    #[serde(rename = "reports:write")]
    ReportsWrite,
    #[serde(rename = "reports:generate")]
    ReportsGenerate,
    #[serde(rename = "reports:schedule_manage")]
    ReportsScheduleManage,
    #[serde(rename = "reports:delete")]
    ReportsDelete,
    #[serde(rename = "reports:export")]
    ReportsExport,
    #[serde(rename = "reports:admin")]
    ReportsAdmin,

    // -----------------------------------------------------------------
    // Forensics Module (7)
    // -----------------------------------------------------------------
    #[serde(rename = "forensics:read")]
    ForensicsRead,
    #[serde(rename = "forensics:write")]
    ForensicsWrite,
    #[serde(rename = "forensics:share")]
    ForensicsShare,
    #[serde(rename = "forensics:search")]
    ForensicsSearch,
    #[serde(rename = "forensics:correlate")]
    ForensicsCorrelate,
    #[serde(rename = "forensics:export")]
    ForensicsExport,
    #[serde(rename = "forensics:admin")]
    ForensicsAdmin,

    // -----------------------------------------------------------------
    // Events Module (5)
    // -----------------------------------------------------------------
    #[serde(rename = "events:read")]
    EventsRead,
    #[serde(rename = "events:manage")]
    EventsManage,
    #[serde(rename = "events:acknowledge")]
    EventsAcknowledge,
    #[serde(rename = "events:shelve")]
    EventsShelve,
    #[serde(rename = "events:admin")]
    EventsAdmin,

    // -----------------------------------------------------------------
    // Log Module (7)
    // -----------------------------------------------------------------
    #[serde(rename = "log:read")]
    LogRead,
    #[serde(rename = "log:write")]
    LogWrite,
    #[serde(rename = "log:delete")]
    LogDelete,
    #[serde(rename = "log:template_manage")]
    LogTemplateManage,
    #[serde(rename = "log:schedule_manage")]
    LogScheduleManage,
    #[serde(rename = "log:export")]
    LogExport,
    #[serde(rename = "log:admin")]
    LogAdmin,

    // -----------------------------------------------------------------
    // Rounds Module (7)
    // -----------------------------------------------------------------
    #[serde(rename = "rounds:read")]
    RoundsRead,
    #[serde(rename = "rounds:execute")]
    RoundsExecute,
    #[serde(rename = "rounds:transfer")]
    RoundsTransfer,
    #[serde(rename = "rounds:template_manage")]
    RoundsTemplateManage,
    #[serde(rename = "rounds:schedule_manage")]
    RoundsScheduleManage,
    #[serde(rename = "rounds:export")]
    RoundsExport,
    #[serde(rename = "rounds:admin")]
    RoundsAdmin,

    // -----------------------------------------------------------------
    // Settings Module (4)
    // -----------------------------------------------------------------
    #[serde(rename = "settings:read")]
    SettingsRead,
    #[serde(rename = "settings:write")]
    SettingsWrite,
    #[serde(rename = "settings:export")]
    SettingsExport,
    #[serde(rename = "settings:admin")]
    SettingsAdmin,

    // -----------------------------------------------------------------
    // Alerts Module (8)
    // -----------------------------------------------------------------
    #[serde(rename = "alerts:read")]
    AlertsRead,
    #[serde(rename = "alerts:acknowledge")]
    AlertsAcknowledge,
    #[serde(rename = "alerts:send")]
    AlertsSend,
    #[serde(rename = "alerts:send_emergency")]
    AlertsSendEmergency,
    #[serde(rename = "alerts:manage_templates")]
    AlertsManageTemplates,
    #[serde(rename = "alerts:manage_groups")]
    AlertsManageGroups,
    #[serde(rename = "alerts:configure")]
    AlertsConfigure,
    #[serde(rename = "alerts:muster")]
    AlertsMuster,

    // -----------------------------------------------------------------
    // Email System (4)
    // -----------------------------------------------------------------
    #[serde(rename = "email:configure")]
    EmailConfigure,
    #[serde(rename = "email:manage_templates")]
    EmailManageTemplates,
    #[serde(rename = "email:send_test")]
    EmailSendTest,
    #[serde(rename = "email:view_logs")]
    EmailViewLogs,

    // -----------------------------------------------------------------
    // Authentication (3)
    // -----------------------------------------------------------------
    #[serde(rename = "auth:configure")]
    AuthConfigure,
    #[serde(rename = "auth:manage_mfa")]
    AuthManageMfa,
    #[serde(rename = "auth:manage_api_keys")]
    AuthManageApiKeys,

    // -----------------------------------------------------------------
    // Shifts Module (8)
    // -----------------------------------------------------------------
    #[serde(rename = "shifts:read")]
    ShiftsRead,
    #[serde(rename = "shifts:write")]
    ShiftsWrite,
    #[serde(rename = "presence:read")]
    PresenceRead,
    #[serde(rename = "presence:manage")]
    PresenceManage,
    #[serde(rename = "muster:manage")]
    MusterManage,
    #[serde(rename = "badge_config:manage")]
    BadgeConfigManage,
    #[serde(rename = "alert_groups:read")]
    AlertGroupsRead,
    #[serde(rename = "alert_groups:write")]
    AlertGroupsWrite,

    // -----------------------------------------------------------------
    // System (29)
    // -----------------------------------------------------------------
    #[serde(rename = "system:manage_users")]
    SystemManageUsers,
    #[serde(rename = "system:manage_groups")]
    SystemManageGroups,
    #[serde(rename = "system:manage_roles")]
    SystemManageRoles,
    #[serde(rename = "system:view_logs")]
    SystemViewLogs,
    #[serde(rename = "system:system_settings")]
    SystemSystemSettings,
    #[serde(rename = "system:configure")]
    SystemConfigure,
    #[serde(rename = "system:certificates")]
    SystemCertificates,
    #[serde(rename = "system:opc_config")]
    SystemOpcConfig,
    #[serde(rename = "system:source_config")]
    SystemSourceConfig,
    #[serde(rename = "system:event_config")]
    SystemEventConfig,
    #[serde(rename = "system:point_config")]
    SystemPointConfig,
    #[serde(rename = "system:point_deactivate")]
    SystemPointDeactivate,
    #[serde(rename = "system:expression_manage")]
    SystemExpressionManage,
    #[serde(rename = "system:import_connections")]
    SystemImportConnections,
    #[serde(rename = "system:import_definitions")]
    SystemImportDefinitions,
    #[serde(rename = "system:import_execute")]
    SystemImportExecute,
    #[serde(rename = "system:import_history")]
    SystemImportHistory,
    #[serde(rename = "system:bulk_update")]
    SystemBulkUpdate,
    #[serde(rename = "system:change_backup")]
    SystemChangeBackup,
    #[serde(rename = "system:change_restore")]
    SystemChangeRestore,
    #[serde(rename = "system:data_link_config")]
    SystemDataLinkConfig,
    #[serde(rename = "system:point_detail_config")]
    SystemPointDetailConfig,
    #[serde(rename = "system:monitor")]
    SystemMonitor,
    #[serde(rename = "system:sessions")]
    SystemSessions,
    #[serde(rename = "system:backup")]
    SystemBackup,
    #[serde(rename = "system:restore")]
    SystemRestore,
    #[serde(rename = "system:export_data")]
    SystemExportData,
    #[serde(rename = "system:import_data")]
    SystemImportData,
    #[serde(rename = "system:admin")]
    SystemAdmin,
}
