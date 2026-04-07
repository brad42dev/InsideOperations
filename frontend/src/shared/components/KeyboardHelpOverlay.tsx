/**
 * KeyboardHelpOverlay — shows keyboard shortcuts for the current module plus
 * global application shortcuts when '?' is pressed or the topbar button is clicked.
 *
 * Spec reference: design-docs/06_FRONTEND_SHELL.md §Keyboard Shortcuts
 * Task: DD-06-013
 */

import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { ROUTE_REGISTRY } from "../routes/registry";
import {
  MODULE_SHORTCUTS,
  type ShortcutEntry,
  type ShortcutSection,
} from "../keyboard/shortcutRegistry";

interface KeyboardHelpOverlayProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** First path segment of the current route (e.g. "console", "designer"). */
  currentModule?: string;
}

// Build the navigation section dynamically from ROUTE_REGISTRY so it stays
// in sync with any future changes to the registry.
const NAV_SHORTCUTS: ShortcutEntry[] = ROUTE_REGISTRY.filter(
  (r) => r.g_key,
).map((r) => ({
  keys: ["G", r.g_key.split(" ")[1]],
  description: `Go to ${r.sidebar_label}`,
}));

const GLOBAL_SECTIONS: ShortcutSection[] = [
  {
    title: "Sidebar",
    shortcuts: [
      {
        keys: ["Ctrl", "\\"],
        description: "Toggle sidebar expanded / collapsed",
      },
      {
        keys: ["Ctrl", "Shift", "\\"],
        description: "Toggle sidebar hidden / collapsed",
      },
      {
        keys: ["Ctrl", "Shift", "T"],
        description: "Toggle top bar visibility",
      },
    ],
  },
  {
    title: "Application",
    shortcuts: [
      { keys: ["Ctrl", "K"], description: "Open command palette" },
      { keys: ["Ctrl", "L"], description: "Lock screen" },
      { keys: ["Ctrl", "Shift", "K"], description: "Toggle kiosk mode" },
      { keys: ["F8"], description: "Open notification history panel" },
      { keys: ["?"], description: "Show keyboard shortcuts (this panel)" },
    ],
  },
  {
    title: "Navigation  (press G, then a letter)",
    shortcuts: NAV_SHORTCUTS,
  },
];

// ─── Key badge ───────────────────────────────────────────────────────────────

function KeyBadge({ label }: { label: string }) {
  return (
    <kbd
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        minWidth: "22px",
        height: "20px",
        padding: "0 5px",
        borderRadius: "3px",
        background: "var(--io-surface-secondary)",
        border: "1px solid var(--io-border-subtle)",
        boxShadow: "0 1px 0 0 var(--io-border-subtle)",
        fontSize: "11px",
        fontFamily: "var(--io-font-mono, ui-monospace, monospace)",
        color: "var(--io-text-secondary)",
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </kbd>
  );
}

// ─── Shortcut row ─────────────────────────────────────────────────────────────

function ShortcutRow({ keys, description }: ShortcutEntry) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "12px",
        padding: "4px 0",
      }}
    >
      <span
        style={{
          fontSize: "12px",
          color: "var(--io-text-primary)",
          flexShrink: 1,
          minWidth: 0,
        }}
      >
        {description}
      </span>
      <span
        style={{
          display: "flex",
          alignItems: "center",
          gap: "3px",
          flexShrink: 0,
        }}
      >
        {keys.map((k, i) => (
          <KeyBadge key={i} label={k} />
        ))}
      </span>
    </div>
  );
}

// ─── Section ──────────────────────────────────────────────────────────────────

function ShortcutSectionBlock({ title, shortcuts }: ShortcutSection) {
  if (shortcuts.length === 0) return null;
  return (
    <div style={{ marginBottom: "18px" }}>
      <div
        style={{
          fontSize: "10px",
          fontWeight: 600,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          color: "var(--io-text-muted)",
          marginBottom: "6px",
        }}
      >
        {title}
      </div>
      <div>
        {shortcuts.map((s, i) => (
          <ShortcutRow key={i} keys={s.keys} description={s.description} />
        ))}
      </div>
    </div>
  );
}

// ─── Module label map ─────────────────────────────────────────────────────────

const MODULE_LABELS: Record<string, string> = {
  console: "Console",
  process: "Process",
  designer: "Designer",
  dashboards: "Dashboards",
  reports: "Reports",
  forensics: "Forensics",
  log: "Log",
  rounds: "Rounds",
  alerts: "Alerts",
  settings: "Settings",
};

// ─── Column layout helper ────────────────────────────────────────────────────
// Designer has many sections — split into two columns to avoid excessive scroll.

function TwoColumnSections({ sections }: { sections: ShortcutSection[] }) {
  const nonEmpty = sections.filter((s) => s.shortcuts.length > 0);
  const half = Math.ceil(nonEmpty.length / 2);
  const left = nonEmpty.slice(0, half);
  const right = nonEmpty.slice(half);
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 24px" }}>
      <div>
        {left.map((s) => (
          <ShortcutSectionBlock key={s.title} title={s.title} shortcuts={s.shortcuts} />
        ))}
      </div>
      <div>
        {right.map((s) => (
          <ShortcutSectionBlock key={s.title} title={s.title} shortcuts={s.shortcuts} />
        ))}
      </div>
    </div>
  );
}

// ─── Main overlay ─────────────────────────────────────────────────────────────

export default function KeyboardHelpOverlay({
  open,
  onOpenChange,
  currentModule,
}: KeyboardHelpOverlayProps) {
  const moduleSections: ShortcutSection[] = currentModule
    ? (MODULE_SHORTCUTS[currentModule] ?? [])
    : [];
  const nonEmptyModuleSections = moduleSections.filter(
    (s) => s.shortcuts.length > 0,
  );
  // Only surface the module label when there are actually module-specific
  // shortcuts to show — avoids a misleading "Showing shortcuts for Settings
  // + global" header when the module's section list is empty.
  const moduleLabel =
    currentModule && nonEmptyModuleSections.length > 0
      ? MODULE_LABELS[currentModule]
      : undefined;
  const useWide = currentModule === "designer";

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.45)",
            zIndex: 1200,
          }}
        />
        <Dialog.Content
          aria-describedby={undefined}
          style={{
            position: "fixed",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            zIndex: 1201,
            width: useWide ? "720px" : "480px",
            maxWidth: "calc(100vw - 32px)",
            maxHeight: "85vh",
            overflowY: "auto",
            background: "var(--io-surface-overlay)",
            border: "1px solid var(--io-border-default)",
            borderRadius: "8px",
            boxShadow: "var(--io-shadow-lg)",
            padding: "24px",
          }}
        >
          {/* Header */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: "20px",
            }}
          >
            <div>
              <Dialog.Title
                style={{
                  margin: 0,
                  fontSize: "15px",
                  fontWeight: 600,
                  color: "var(--io-text-primary)",
                }}
              >
                Keyboard Shortcuts
              </Dialog.Title>
              {moduleLabel && (
                <div
                  style={{
                    fontSize: "11px",
                    color: "var(--io-text-muted)",
                    marginTop: "2px",
                  }}
                >
                  Showing shortcuts for{" "}
                  <span style={{ color: "var(--io-accent)" }}>{moduleLabel}</span>{" "}
                  + global
                </div>
              )}
            </div>
            <Dialog.Close
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: "28px",
                height: "28px",
                border: "none",
                background: "transparent",
                borderRadius: "4px",
                color: "var(--io-text-muted)",
                cursor: "pointer",
                padding: 0,
              }}
              aria-label="Close keyboard shortcuts"
            >
              <X size={16} />
            </Dialog.Close>
          </div>

          {/* Module-specific sections */}
          {nonEmptyModuleSections.length > 0 && (
            <>
              {useWide ? (
                <TwoColumnSections sections={moduleSections} />
              ) : (
                moduleSections.map((section) => (
                  <ShortcutSectionBlock
                    key={section.title}
                    title={section.title}
                    shortcuts={section.shortcuts}
                  />
                ))
              )}
              {/* Divider before global shortcuts */}
              <div
                style={{
                  borderTop: "1px solid var(--io-border-subtle)",
                  margin: "4px 0 20px",
                }}
              />
            </>
          )}

          {/* Global sections */}
          {GLOBAL_SECTIONS.map((section) => (
            <ShortcutSectionBlock
              key={section.title}
              title={section.title}
              shortcuts={section.shortcuts}
            />
          ))}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
