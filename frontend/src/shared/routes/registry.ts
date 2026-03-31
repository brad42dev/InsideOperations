/**
 * Route registry — single source of truth for all top-level module routes.
 *
 * Drives both the sidebar navigation (via getSidebarGroups) and the G-key
 * shortcut map in AppShell. React Router <Route> elements in App.tsx are
 * separate and must NOT be replaced with this registry.
 *
 * Spec reference: design-docs/38_FRONTEND_CONTRACTS.md §1 Route Map & Permission Guard Registry
 */

import {
  Monitor,
  Layers,
  PenTool,
  LayoutDashboard,
  FileText,
  Search,
  BookOpen,
  CheckSquare,
  Bell,
  Users,
  Settings as SettingsIcon,
  type LucideIcon,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SidebarGroup =
  | "monitoring"
  | "analysis"
  | "operations"
  | "management";

export interface RouteConfig {
  /** Absolute path for this module (e.g. "/console") */
  path: string;
  /** Component name string — intentionally NOT a React component reference */
  component: string;
  /** RBAC permission required to access this route; null = any authenticated user */
  permission: string | null;
  /** Which sidebar group this route belongs to */
  sidebar_group: SidebarGroup;
  /** Display label shown in the sidebar */
  sidebar_label: string;
  /** Lucide icon name string (e.g. "Monitor") */
  sidebar_icon: string;
  /** G-key shortcut sequence (e.g. "G C") */
  g_key: string;
  /** Root segment shown in breadcrumbs */
  breadcrumb_root: string;
  /** Whether this route is available on the mobile PWA */
  mobile: boolean;
}

/** Subset of RouteConfig used by the sidebar renderer — icon resolved to LucideIcon */
export interface NavItem {
  path: string;
  label: string;
  icon: LucideIcon;
  permission: string | null;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

// ---------------------------------------------------------------------------
// Icon map — resolves sidebar_icon string → LucideIcon component
// ---------------------------------------------------------------------------

const ICON_MAP: Record<string, LucideIcon> = {
  Monitor,
  Layers,
  PenTool,
  LayoutDashboard,
  FileText,
  Search,
  BookOpen,
  CheckSquare,
  Bell,
  Users,
  Settings: SettingsIcon,
};

// ---------------------------------------------------------------------------
// ROUTE_REGISTRY — all 11 top-level module entries
// Source: design-docs/38_FRONTEND_CONTRACTS.md §1 Complete Route Table
// ---------------------------------------------------------------------------

export const ROUTE_REGISTRY: RouteConfig[] = [
  // Monitoring
  {
    path: "/console",
    component: "ConsoleModule",
    permission: "console:read",
    sidebar_group: "monitoring",
    sidebar_label: "Console",
    sidebar_icon: "Monitor",
    g_key: "G C",
    breadcrumb_root: "Console",
    mobile: false,
  },
  {
    path: "/process",
    component: "ProcessModule",
    permission: "process:read",
    sidebar_group: "monitoring",
    sidebar_label: "Process",
    sidebar_icon: "Layers",
    g_key: "G P",
    breadcrumb_root: "Process",
    mobile: false,
  },
  // Analysis
  {
    path: "/dashboards",
    component: "DashboardsModule",
    permission: "dashboards:read",
    sidebar_group: "analysis",
    sidebar_label: "Dashboards",
    sidebar_icon: "LayoutDashboard",
    g_key: "G B",
    breadcrumb_root: "Dashboards",
    mobile: false,
  },
  {
    path: "/reports",
    component: "ReportsModule",
    permission: "reports:read",
    sidebar_group: "analysis",
    sidebar_label: "Reports",
    sidebar_icon: "FileText",
    g_key: "G R",
    breadcrumb_root: "Reports",
    mobile: false,
  },
  {
    path: "/forensics",
    component: "ForensicsModule",
    permission: "forensics:read",
    sidebar_group: "analysis",
    sidebar_label: "Forensics",
    sidebar_icon: "Search",
    g_key: "G F",
    breadcrumb_root: "Forensics",
    mobile: false,
  },
  // Operations
  {
    path: "/log",
    component: "LogModule",
    permission: "log:read",
    sidebar_group: "operations",
    sidebar_label: "Log",
    sidebar_icon: "BookOpen",
    g_key: "G L",
    breadcrumb_root: "Log",
    mobile: true,
  },
  {
    path: "/rounds",
    component: "RoundsModule",
    permission: "rounds:read",
    sidebar_group: "operations",
    sidebar_label: "Rounds",
    sidebar_icon: "CheckSquare",
    g_key: "G O",
    breadcrumb_root: "Rounds",
    mobile: true,
  },
  {
    path: "/alerts",
    component: "AlertsModule",
    permission: "alerts:read",
    sidebar_group: "operations",
    sidebar_label: "Alerts",
    sidebar_icon: "Bell",
    g_key: "G A",
    breadcrumb_root: "Alerts",
    mobile: false,
  },
  // Management
  {
    path: "/shifts",
    component: "ShiftsModule",
    permission: "shifts:read",
    sidebar_group: "management",
    sidebar_label: "Shifts",
    sidebar_icon: "Users",
    g_key: "G H",
    breadcrumb_root: "Shifts",
    mobile: false,
  },
  {
    path: "/settings",
    component: "SettingsModule",
    permission: "settings:read",
    sidebar_group: "management",
    sidebar_label: "Settings",
    sidebar_icon: "Settings",
    g_key: "G S",
    breadcrumb_root: "Settings",
    mobile: false,
  },
  {
    path: "/designer",
    component: "DesignerModule",
    permission: "designer:read",
    sidebar_group: "management",
    sidebar_label: "Designer",
    sidebar_icon: "PenTool",
    g_key: "G D",
    breadcrumb_root: "Designer",
    mobile: false,
  },
];

// ---------------------------------------------------------------------------
// Sidebar group label map — sidebar_group key → display label
// ---------------------------------------------------------------------------

const GROUP_LABELS: Record<SidebarGroup, string> = {
  monitoring: "Monitoring",
  analysis: "Analysis",
  operations: "Operations",
  management: "Management",
};

// Canonical group order for sidebar rendering
const GROUP_ORDER: SidebarGroup[] = [
  "monitoring",
  "analysis",
  "operations",
  "management",
];

// ---------------------------------------------------------------------------
// getSidebarGroups — filters registry by permission and groups by sidebar_group
//
// Returns NavGroup[] with LucideIcon references resolved from ICON_MAP.
// Routes whose required permission is not in the provided permissions array
// are excluded. Routes with permission = null are always included.
// ---------------------------------------------------------------------------

export function getSidebarGroups(permissions: string[]): NavGroup[] {
  const permSet = new Set(permissions);

  const filtered = ROUTE_REGISTRY.filter(
    (r) => r.permission === null || permSet.has(r.permission),
  );

  const groups: NavGroup[] = [];

  for (const groupKey of GROUP_ORDER) {
    const items = filtered
      .filter((r) => r.sidebar_group === groupKey)
      .map(
        (r): NavItem => ({
          path: r.path,
          label: r.sidebar_label,
          icon: ICON_MAP[r.sidebar_icon] ?? Monitor,
          permission: r.permission,
        }),
      );

    if (items.length > 0) {
      groups.push({ label: GROUP_LABELS[groupKey], items });
    }
  }

  return groups;
}
