/**
 * I/O Design System — Theme Tokens
 *
 * JS mirror of the CSS custom properties in index.css.
 * Applied by setTheme() to override CSS defaults for the
 * selected theme. Doc 38 token registry — all 138 tokens.
 */

export type Theme = "light" | "dark" | "hphmi";

const THEME_KEY = "io_theme";

// ---------------------------------------------------------------------------
// Token maps
// ---------------------------------------------------------------------------

const darkTokens: Record<string, string> = {
  // Surface & Layout
  "--io-surface-primary": "#09090b",
  "--io-surface-secondary": "#18181b",
  "--io-surface-elevated": "#27272a",
  "--io-surface-sunken": "#09090b",
  "--io-surface-overlay": "rgba(0,0,0,0.7)",

  // Text
  "--io-text-primary": "#f9fafb",
  "--io-text-secondary": "#a1a1aa",
  "--io-text-muted": "#71717a",
  "--io-text-inverse": "#09090b",

  // Accent (dark = 400-level Midnight Teal)
  "--io-accent": "#2dd4bf",
  "--io-accent-hover": "#5eead4",
  "--io-accent-active": "#99f6e4",
  "--io-accent-foreground": "#09090b",
  "--io-accent-subtle": "rgba(45,212,191,0.1)",

  // Borders
  "--io-border": "#3f3f46",
  "--io-border-subtle": "#27272a",
  "--io-border-strong": "#52525b",
  "--io-focus-ring": "#2dd4bf",

  // Alarm Priority (ISA-101 — NOT user-customizable)
  "--io-alarm-urgent": "#ef4444",
  "--io-alarm-high": "#f97316",
  "--io-alarm-low": "#eab308",
  "--io-alarm-diagnostic": "#f4f4f5",
  "--io-alarm-custom": "#60a5fa",
  "--io-alarm-shelved": "#d946ef",

  // Graphics Display Elements
  "--io-fill-normal": "#475569",
  "--io-display-zone-inactive": "#3f3f46",
  "--io-display-zone-normal": "#404048",
  "--io-display-zone-border": "#52525b",

  // Operational Status
  "--io-alarm-normal": "#22c55e",
  "--io-alarm-disabled": "#52525b",

  // Semantic Status
  "--io-danger": "#ef4444",
  "--io-success": "#22c55e",
  "--io-warning": "#f59e0b",
  "--io-info": "#3b82f6",
  "--io-text-disabled": "#52525b",

  // Chart & Visualization
  "--io-chart-bg": "#18181b",
  "--io-chart-grid": "#3f3f46",
  "--io-chart-axis": "#a1a1aa",
  "--io-chart-crosshair": "#71717a",
  "--io-chart-tooltip-bg": "#27272a",

  // Pen colors (static)
  "--io-pen-1": "#2563eb",
  "--io-pen-2": "#dc2626",
  "--io-pen-3": "#16a34a",
  "--io-pen-4": "#d97706",
  "--io-pen-5": "#7c3aed",
  "--io-pen-6": "#0891b2",
  "--io-pen-7": "#db2777",
  "--io-pen-8": "#65a30d",

  // Sidebar
  "--io-sidebar-width": "240px",
  "--io-sidebar-collapsed": "48px",

  // Top bar
  "--io-topbar-height": "48px",

  // Spacing
  "--io-space-0": "0px",
  "--io-space-1": "4px",
  "--io-space-2": "8px",
  "--io-space-3": "12px",
  "--io-space-4": "16px",
  "--io-space-5": "20px",
  "--io-space-6": "24px",
  "--io-space-8": "32px",
  "--io-space-10": "40px",
  "--io-space-12": "48px",
  "--io-space-14": "56px",
  "--io-space-16": "64px",
  "--io-space-20": "80px",
  "--io-space-24": "96px",
  "--io-space-32": "128px",
  "--io-space-40": "160px",
  "--io-space-48": "192px",

  // Border Radius
  "--io-radius-sm": "3px",
  "--io-radius": "6px",
  "--io-radius-lg": "9px",
  "--io-radius-full": "9999px",

  // Shadow
  "--io-shadow-sm": "0 1px 2px rgba(0,0,0,0.3)",
  "--io-shadow": "0 1px 3px rgba(0,0,0,0.4), 0 1px 2px rgba(0,0,0,0.3)",
  "--io-shadow-lg": "0 10px 15px rgba(0,0,0,0.5), 0 4px 6px rgba(0,0,0,0.3)",
  "--io-shadow-none": "none",

  // Duration
  "--io-duration-fast": "150ms",
  "--io-duration-medium": "250ms",
  "--io-duration-slow": "350ms",

  // Text (remaining)
  "--io-text-link": "#2dd4bf",

  // Button (Layer 4)
  "--io-btn-bg": "#2dd4bf",
  "--io-btn-hover": "#5eead4",
  "--io-btn-active": "#99f6e4",
  "--io-btn-text": "#09090b",
  "--io-btn-secondary-bg": "#18181b",
  "--io-btn-secondary-border": "#3f3f46",

  // Sidebar (remaining Layer 4)
  "--io-sidebar-bg": "#18181b",
  "--io-sidebar-active-border": "#2dd4bf",
  "--io-sidebar-hover-bg": "rgba(45,212,191,0.1)",

  // Top bar (remaining Layer 4)
  "--io-topbar-bg": "#09090b",
  "--io-topbar-border": "#27272a",

  // Card (Layer 4)
  "--io-card-bg": "#18181b",
  "--io-card-border": "#3f3f46",
  "--io-card-radius": "6px",
  "--io-card-shadow": "0 1px 2px rgba(0,0,0,0.3)",

  // Table (Layer 4)
  "--io-table-row-compact": "28px",
  "--io-table-row-default": "36px",
  "--io-table-row-comfortable": "44px",
  "--io-table-header-bg": "#09090b",
  "--io-table-row-hover": "rgba(45,212,191,0.1)",
  "--io-table-row-selected": "rgba(45,212,191,0.1)",

  // Input (Layer 4)
  "--io-input-bg": "#09090b",
  "--io-input-border": "#3f3f46",
  "--io-input-focus-border": "#2dd4bf",
  "--io-input-placeholder": "#71717a",
  "--io-input-height": "36px",

  // Modal (Layer 4)
  "--io-modal-bg": "#27272a",
  "--io-modal-backdrop": "rgba(0,0,0,0.7)",
  "--io-modal-radius": "9px",

  // Toast (Layer 4)
  "--io-toast-bg": "#27272a",
  "--io-toast-border": "#3f3f46",
  "--io-toast-shadow": "0 10px 15px rgba(0,0,0,0.5), 0 4px 6px rgba(0,0,0,0.3)",

  // Z-Index Scale (static, all themes)
  "--io-z-base": "0",
  "--io-z-panel": "10",
  "--io-z-sidebar": "100",
  "--io-z-topbar": "100",
  "--io-z-edge-hover": "150",
  "--io-z-dropdown": "200",
  "--io-z-modal": "300",
  "--io-z-command": "400",
  "--io-z-visual-lock": "500",
  "--io-z-kiosk-auth": "600",
  "--io-z-toast": "700",
  "--io-z-emergency": "800",

  // Typography — font-size tokens (static, all themes)
  "--io-text-4xl": "2.25rem",
  "--io-text-3xl": "1.75rem",
  "--io-text-2xl": "1.375rem",
  "--io-text-xl": "1.125rem",
  "--io-text-lg": "1rem",
  "--io-text-base": "0.875rem",
  "--io-text-sm": "0.8125rem",
  "--io-text-xs": "0.75rem",
  "--io-text-2xs": "0.6875rem",
  "--io-text-label": "0.75rem",
  "--io-text-label-sm": "0.6875rem",
  "--io-text-value": "0.875rem",
  "--io-text-value-lg": "1.125rem",
  "--io-text-value-xl": "1.5rem",
  "--io-text-code": "0.8125rem",
  "--io-text-code-sm": "0.75rem",
};

const lightTokens: Record<string, string> = {
  // Surface & Layout
  "--io-surface-primary": "#ffffff",
  "--io-surface-secondary": "#f9fafb",
  "--io-surface-elevated": "#ffffff",
  "--io-surface-sunken": "#f3f4f6",
  "--io-surface-overlay": "rgba(0,0,0,0.5)",

  // Text
  "--io-text-primary": "#111827",
  "--io-text-secondary": "#6b7280",
  "--io-text-muted": "#9ca3af",
  "--io-text-inverse": "#ffffff",

  // Accent (light = 600-level Midnight Teal)
  "--io-accent": "#0d9488",
  "--io-accent-hover": "#0f766e",
  "--io-accent-active": "#115e59",
  "--io-accent-foreground": "#ffffff",
  "--io-accent-subtle": "rgba(13,148,136,0.08)",

  // Borders
  "--io-border": "#e5e7eb",
  "--io-border-subtle": "#f3f4f6",
  "--io-border-strong": "#d1d5db",
  "--io-focus-ring": "#14b8a6",

  // Alarm Priority
  "--io-alarm-urgent": "#dc2626",
  "--io-alarm-high": "#d97706",
  "--io-alarm-low": "#ca8a04",
  "--io-alarm-diagnostic": "#0891b2",
  "--io-alarm-custom": "#6d28d9",
  "--io-alarm-shelved": "#7c3aed",

  // Graphics Display Elements
  "--io-fill-normal": "rgba(148,163,184,0.3)",
  "--io-display-zone-inactive": "#e5e7eb",
  "--io-display-zone-normal": "#d1d5db",
  "--io-display-zone-border": "#d1d5db",

  // Operational Status
  "--io-alarm-normal": "#16a34a",
  "--io-alarm-disabled": "#9ca3af",

  // Semantic Status
  "--io-danger": "#dc2626",
  "--io-success": "#16a34a",
  "--io-warning": "#d97706",
  "--io-info": "#2563eb",
  "--io-text-disabled": "#d1d5db",

  // Chart & Visualization
  "--io-chart-bg": "#ffffff",
  "--io-chart-grid": "#f5f6f8",
  "--io-chart-axis": "#6b7280",
  "--io-chart-crosshair": "#9ca3af",
  "--io-chart-tooltip-bg": "#ffffff",

  // Pen colors (static)
  "--io-pen-1": "#2563eb",
  "--io-pen-2": "#dc2626",
  "--io-pen-3": "#16a34a",
  "--io-pen-4": "#d97706",
  "--io-pen-5": "#7c3aed",
  "--io-pen-6": "#0891b2",
  "--io-pen-7": "#db2777",
  "--io-pen-8": "#65a30d",

  // Sidebar
  "--io-sidebar-width": "240px",
  "--io-sidebar-collapsed": "48px",

  // Top bar
  "--io-topbar-height": "48px",

  // Spacing
  "--io-space-0": "0px",
  "--io-space-1": "4px",
  "--io-space-2": "8px",
  "--io-space-3": "12px",
  "--io-space-4": "16px",
  "--io-space-5": "20px",
  "--io-space-6": "24px",
  "--io-space-8": "32px",
  "--io-space-10": "40px",
  "--io-space-12": "48px",
  "--io-space-14": "56px",
  "--io-space-16": "64px",
  "--io-space-20": "80px",
  "--io-space-24": "96px",
  "--io-space-32": "128px",
  "--io-space-40": "160px",
  "--io-space-48": "192px",

  // Border Radius
  "--io-radius-sm": "3px",
  "--io-radius": "6px",
  "--io-radius-lg": "9px",
  "--io-radius-full": "9999px",

  // Shadow
  "--io-shadow-sm": "0 1px 2px rgba(0,0,0,0.05)",
  "--io-shadow": "0 1px 3px rgba(0,0,0,0.1), 0 1px 2px rgba(0,0,0,0.06)",
  "--io-shadow-lg": "0 10px 15px rgba(0,0,0,0.1), 0 4px 6px rgba(0,0,0,0.05)",
  "--io-shadow-none": "none",

  // Duration
  "--io-duration-fast": "150ms",
  "--io-duration-medium": "250ms",
  "--io-duration-slow": "350ms",

  // Text (remaining)
  "--io-text-link": "#0d9488",

  // Button (Layer 4)
  "--io-btn-bg": "#0d9488",
  "--io-btn-hover": "#0f766e",
  "--io-btn-active": "#115e59",
  "--io-btn-text": "#ffffff",
  "--io-btn-secondary-bg": "#f9fafb",
  "--io-btn-secondary-border": "#e5e7eb",

  // Sidebar (remaining Layer 4)
  "--io-sidebar-bg": "#f9fafb",
  "--io-sidebar-active-border": "#0d9488",
  "--io-sidebar-hover-bg": "rgba(13,148,136,0.08)",

  // Top bar (remaining Layer 4)
  "--io-topbar-bg": "#ffffff",
  "--io-topbar-border": "#f3f4f6",

  // Card (Layer 4)
  "--io-card-bg": "#f9fafb",
  "--io-card-border": "#e5e7eb",
  "--io-card-radius": "6px",
  "--io-card-shadow": "0 1px 2px rgba(0,0,0,0.05)",

  // Table (Layer 4)
  "--io-table-row-compact": "28px",
  "--io-table-row-default": "36px",
  "--io-table-row-comfortable": "44px",
  "--io-table-header-bg": "#f3f4f6",
  "--io-table-row-hover": "rgba(13,148,136,0.08)",
  "--io-table-row-selected": "rgba(13,148,136,0.08)",

  // Input (Layer 4)
  "--io-input-bg": "#f3f4f6",
  "--io-input-border": "#e5e7eb",
  "--io-input-focus-border": "#0d9488",
  "--io-input-placeholder": "#9ca3af",
  "--io-input-height": "36px",

  // Modal (Layer 4)
  "--io-modal-bg": "#ffffff",
  "--io-modal-backdrop": "rgba(0,0,0,0.5)",
  "--io-modal-radius": "9px",

  // Toast (Layer 4)
  "--io-toast-bg": "#ffffff",
  "--io-toast-border": "#e5e7eb",
  "--io-toast-shadow":
    "0 10px 15px rgba(0,0,0,0.1), 0 4px 6px rgba(0,0,0,0.05)",

  // Z-Index Scale (static, all themes)
  "--io-z-base": "0",
  "--io-z-panel": "10",
  "--io-z-sidebar": "100",
  "--io-z-topbar": "100",
  "--io-z-edge-hover": "150",
  "--io-z-dropdown": "200",
  "--io-z-modal": "300",
  "--io-z-command": "400",
  "--io-z-visual-lock": "500",
  "--io-z-kiosk-auth": "600",
  "--io-z-toast": "700",
  "--io-z-emergency": "800",

  // Typography — font-size tokens (static, all themes)
  "--io-text-4xl": "2.25rem",
  "--io-text-3xl": "1.75rem",
  "--io-text-2xl": "1.375rem",
  "--io-text-xl": "1.125rem",
  "--io-text-lg": "1rem",
  "--io-text-base": "0.875rem",
  "--io-text-sm": "0.8125rem",
  "--io-text-xs": "0.75rem",
  "--io-text-2xs": "0.6875rem",
  "--io-text-label": "0.75rem",
  "--io-text-label-sm": "0.6875rem",
  "--io-text-value": "0.875rem",
  "--io-text-value-lg": "1.125rem",
  "--io-text-value-xl": "1.5rem",
  "--io-text-code": "0.8125rem",
  "--io-text-code-sm": "0.75rem",
};

const hphmiTokens: Record<string, string> = {
  // Surface & Layout
  "--io-surface-primary": "#0f172a",
  "--io-surface-secondary": "#1e293b",
  "--io-surface-elevated": "#334155",
  "--io-surface-sunken": "#0c1525",
  "--io-surface-overlay": "rgba(0,0,0,0.7)",

  // Text
  "--io-text-primary": "#e2e8f0",
  "--io-text-secondary": "#94a3b8",
  "--io-text-muted": "#64748b",
  "--io-text-inverse": "#0f172a",

  // Accent (HPHMI = 500-level Midnight Teal)
  "--io-accent": "#14b8a6",
  "--io-accent-hover": "#2dd4bf",
  "--io-accent-active": "#5eead4",
  "--io-accent-foreground": "#0f172a",
  "--io-accent-subtle": "rgba(45,212,191,0.08)",

  // Borders
  "--io-border": "#475569",
  "--io-border-subtle": "#2d3f53",
  "--io-border-strong": "#64748b",
  "--io-focus-ring": "#14b8a6",

  // Alarm Priority
  "--io-alarm-urgent": "#ef4444",
  "--io-alarm-high": "#f59e0b",
  "--io-alarm-low": "#eab308",
  "--io-alarm-diagnostic": "#06b6d4",
  "--io-alarm-custom": "#7c3aed",
  "--io-alarm-shelved": "#a78bfa",

  // Graphics Display Elements
  "--io-fill-normal": "rgba(71,85,105,0.5)",
  "--io-display-zone-inactive": "#3f3f46",
  "--io-display-zone-normal": "#404048",
  "--io-display-zone-border": "#52525b",

  // Operational Status
  "--io-alarm-normal": "#22c55e",
  "--io-alarm-disabled": "#64748b",

  // Semantic Status
  "--io-danger": "#ef4444",
  "--io-success": "#22c55e",
  "--io-warning": "#f59e0b",
  "--io-info": "#3b82f6",
  "--io-text-disabled": "#475569",

  // Chart & Visualization
  "--io-chart-bg": "#1e293b",
  "--io-chart-grid": "#3d5166",
  "--io-chart-axis": "#94a3b8",
  "--io-chart-crosshair": "#64748b",
  "--io-chart-tooltip-bg": "#1e293b",

  // Pen colors (static)
  "--io-pen-1": "#2563eb",
  "--io-pen-2": "#dc2626",
  "--io-pen-3": "#16a34a",
  "--io-pen-4": "#d97706",
  "--io-pen-5": "#7c3aed",
  "--io-pen-6": "#0891b2",
  "--io-pen-7": "#db2777",
  "--io-pen-8": "#65a30d",

  // Sidebar
  "--io-sidebar-width": "240px",
  "--io-sidebar-collapsed": "48px",

  // Top bar
  "--io-topbar-height": "48px",

  // Spacing
  "--io-space-0": "0px",
  "--io-space-1": "4px",
  "--io-space-2": "8px",
  "--io-space-3": "12px",
  "--io-space-4": "16px",
  "--io-space-5": "20px",
  "--io-space-6": "24px",
  "--io-space-8": "32px",
  "--io-space-10": "40px",
  "--io-space-12": "48px",
  "--io-space-14": "56px",
  "--io-space-16": "64px",
  "--io-space-20": "80px",
  "--io-space-24": "96px",
  "--io-space-32": "128px",
  "--io-space-40": "160px",
  "--io-space-48": "192px",

  // Border Radius
  "--io-radius-sm": "3px",
  "--io-radius": "6px",
  "--io-radius-lg": "9px",
  "--io-radius-full": "9999px",

  // Shadow
  "--io-shadow-sm": "0 1px 2px rgba(0,0,0,0.3)",
  "--io-shadow": "0 1px 3px rgba(0,0,0,0.4), 0 1px 2px rgba(0,0,0,0.3)",
  "--io-shadow-lg": "0 10px 15px rgba(0,0,0,0.5), 0 4px 6px rgba(0,0,0,0.3)",
  "--io-shadow-none": "none",

  // Duration
  "--io-duration-fast": "150ms",
  "--io-duration-medium": "250ms",
  "--io-duration-slow": "350ms",

  // Text (remaining)
  "--io-text-link": "#14b8a6",

  // Button (Layer 4)
  "--io-btn-bg": "#14b8a6",
  "--io-btn-hover": "#2dd4bf",
  "--io-btn-active": "#5eead4",
  "--io-btn-text": "#0f172a",
  "--io-btn-secondary-bg": "#1e293b",
  "--io-btn-secondary-border": "#475569",

  // Sidebar (remaining Layer 4)
  "--io-sidebar-bg": "#1e293b",
  "--io-sidebar-active-border": "#14b8a6",
  "--io-sidebar-hover-bg": "rgba(45,212,191,0.08)",

  // Top bar (remaining Layer 4)
  "--io-topbar-bg": "#0f172a",
  "--io-topbar-border": "#1e293b",

  // Card (Layer 4)
  "--io-card-bg": "#1e293b",
  "--io-card-border": "#475569",
  "--io-card-radius": "6px",
  "--io-card-shadow": "0 1px 2px rgba(0,0,0,0.3)",

  // Table (Layer 4)
  "--io-table-row-compact": "28px",
  "--io-table-row-default": "36px",
  "--io-table-row-comfortable": "44px",
  "--io-table-header-bg": "#0c1525",
  "--io-table-row-hover": "rgba(45,212,191,0.08)",
  "--io-table-row-selected": "rgba(45,212,191,0.08)",

  // Input (Layer 4)
  "--io-input-bg": "#0c1525",
  "--io-input-border": "#475569",
  "--io-input-focus-border": "#14b8a6",
  "--io-input-placeholder": "#64748b",
  "--io-input-height": "36px",

  // Modal (Layer 4)
  "--io-modal-bg": "#334155",
  "--io-modal-backdrop": "rgba(0,0,0,0.7)",
  "--io-modal-radius": "9px",

  // Toast (Layer 4)
  "--io-toast-bg": "#334155",
  "--io-toast-border": "#475569",
  "--io-toast-shadow": "0 10px 15px rgba(0,0,0,0.5), 0 4px 6px rgba(0,0,0,0.3)",

  // Z-Index Scale (static, all themes)
  "--io-z-base": "0",
  "--io-z-panel": "10",
  "--io-z-sidebar": "100",
  "--io-z-topbar": "100",
  "--io-z-edge-hover": "150",
  "--io-z-dropdown": "200",
  "--io-z-modal": "300",
  "--io-z-command": "400",
  "--io-z-visual-lock": "500",
  "--io-z-kiosk-auth": "600",
  "--io-z-toast": "700",
  "--io-z-emergency": "800",

  // Typography — font-size tokens (static, all themes)
  "--io-text-4xl": "2.25rem",
  "--io-text-3xl": "1.75rem",
  "--io-text-2xl": "1.375rem",
  "--io-text-xl": "1.125rem",
  "--io-text-lg": "1rem",
  "--io-text-base": "0.875rem",
  "--io-text-sm": "0.8125rem",
  "--io-text-xs": "0.75rem",
  "--io-text-2xs": "0.6875rem",
  "--io-text-label": "0.75rem",
  "--io-text-label-sm": "0.6875rem",
  "--io-text-value": "0.875rem",
  "--io-text-value-lg": "1.125rem",
  "--io-text-value-xl": "1.5rem",
  "--io-text-code": "0.8125rem",
  "--io-text-code-sm": "0.75rem",
};

// ---------------------------------------------------------------------------
// Apply / init helpers
// ---------------------------------------------------------------------------

function applyTokens(tokens: Record<string, string>): void {
  const root = document.documentElement;
  for (const [key, value] of Object.entries(tokens)) {
    root.style.setProperty(key, value);
  }
}

export function initTheme(): Theme {
  const stored = localStorage.getItem(THEME_KEY);
  // Mobile devices default to Light for outdoor readability (doc 20)
  const isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  const defaultTheme: Theme = isMobile ? "light" : "dark";
  const theme: Theme =
    stored === "light" || stored === "dark" || stored === "hphmi"
      ? stored
      : defaultTheme;
  document.documentElement.setAttribute("data-theme", theme);
  if (theme === "light") {
    applyTokens(lightTokens);
  } else if (theme === "hphmi") {
    applyTokens(hphmiTokens);
  } else {
    applyTokens(darkTokens);
  }
  return theme;
}

export function setTheme(theme: Theme): void {
  localStorage.setItem(THEME_KEY, theme);
  document.documentElement.setAttribute("data-theme", theme);
  if (theme === "light") {
    applyTokens(lightTokens);
  } else if (theme === "hphmi") {
    applyTokens(hphmiTokens);
  } else {
    applyTokens(darkTokens);
  }
}

export { darkTokens, lightTokens, hphmiTokens };
