/**
 * KeyboardHelpOverlay — shows all registered keyboard shortcuts when '?' is pressed.
 *
 * Spec reference: design-docs/06_FRONTEND_SHELL.md §Keyboard Shortcuts
 * Task: DD-06-013
 */

import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { ROUTE_REGISTRY } from "../routes/registry";

interface KeyboardHelpOverlayProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ShortcutEntry {
  keys: string[];
  description: string;
}

interface ShortcutSection {
  title: string;
  shortcuts: ShortcutEntry[];
}

// Build the navigation section dynamically from ROUTE_REGISTRY so it stays
// in sync with any future changes to the registry.
const NAV_SHORTCUTS: ShortcutEntry[] = ROUTE_REGISTRY.filter(
  (r) => r.g_key,
).map((r) => ({
  keys: ["G", r.g_key.split(" ")[1]],
  description: `Go to ${r.sidebar_label}`,
}));

const SECTIONS: ShortcutSection[] = [
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
      { keys: ["Ctrl", "Shift", "K"], description: "Toggle kiosk mode" },
      { keys: ["F8"], description: "Open notification history panel" },
      { keys: ["?"], description: "Show keyboard shortcuts (this overlay)" },
      { keys: ["Esc"], description: "Dismiss overlay / exit kiosk" },
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
        minWidth: "28px",
        height: "22px",
        padding: "0 6px",
        borderRadius: "4px",
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
        padding: "5px 0",
      }}
    >
      <span
        style={{
          fontSize: "13px",
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
          gap: "4px",
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

function ShortcutSection({ title, shortcuts }: ShortcutSection) {
  return (
    <div style={{ marginBottom: "20px" }}>
      <div
        style={{
          fontSize: "11px",
          fontWeight: 600,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          color: "var(--io-text-muted)",
          marginBottom: "8px",
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

// ─── Main overlay ─────────────────────────────────────────────────────────────

export default function KeyboardHelpOverlay({
  open,
  onOpenChange,
}: KeyboardHelpOverlayProps) {
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
            width: "480px",
            maxWidth: "calc(100vw - 32px)",
            maxHeight: "80vh",
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

          {/* Sections */}
          {SECTIONS.map((section) => (
            <ShortcutSection
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
