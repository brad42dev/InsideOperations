/**
 * Keyboard shortcut registry — pure data, no React.
 *
 * Each module key maps to an array of ShortcutSection objects.  The
 * KeyboardHelpOverlay merges the active module's sections with the shared
 * "global" sections to build the help panel for the current screen.
 *
 * Keep this file in sync with the actual event handlers in each module.
 */

export interface ShortcutEntry {
  keys: string[];
  description: string;
}

export interface ShortcutSection {
  title: string;
  shortcuts: ShortcutEntry[];
}

// ---------------------------------------------------------------------------
// Shared block reused across multiple module sections
// ---------------------------------------------------------------------------

const PLAYBACK_SECTION: ShortcutSection = {
  title: "Historical Playback",
  shortcuts: [
    { keys: ["Space"], description: "Play / pause" },
    { keys: ["←"], description: "Step backward" },
    { keys: ["Shift", "←"], description: "Step backward (large interval)" },
    { keys: ["→"], description: "Step forward" },
    { keys: ["Shift", "→"], description: "Step forward (large interval)" },
    { keys: ["Home"], description: "Jump to start of time range" },
    { keys: ["End"], description: "Jump to end of time range" },
    { keys: ["["], description: "Set loop start point" },
    { keys: ["]"], description: "Set loop end point" },
    { keys: ["L"], description: "Toggle loop" },
  ],
};

// ---------------------------------------------------------------------------
// Per-module shortcut sections
// ---------------------------------------------------------------------------

export const MODULE_SHORTCUTS: Record<string, ShortcutSection[]> = {
  // ── Console ──────────────────────────────────────────────────────────────
  console: [
    {
      title: "Workspace",
      shortcuts: [
        { keys: ["Ctrl", "S"], description: "Save workspace" },
        { keys: ["Ctrl", "Z"], description: "Undo" },
        { keys: ["Ctrl", "Y"], description: "Redo  (or Ctrl+Shift+Z)" },
        { keys: ["Ctrl", "A"], description: "Select all panes" },
        { keys: ["Ctrl", "C"], description: "Copy selected panes" },
        { keys: ["Ctrl", "V"], description: "Paste panes" },
        {
          keys: ["Delete"],
          description: "Remove selected panes  (or Ctrl+Bksp)",
        },
        { keys: ["Esc"], description: "Cancel swap mode / clear selection" },
      ],
    },
    {
      title: "Graphics Pane",
      shortcuts: [
        {
          keys: ["Ctrl", "I"],
          description: "Open Point Detail for hovered point",
        },
        { keys: ["F11"], description: "Fullscreen selected pane" },
        { keys: ["Esc"], description: "Exit fullscreen" },
        { keys: ["Scroll"], description: "Zoom in / out" },
        { keys: ["Ctrl", "Click"], description: "Pan mode" },
      ],
    },
    PLAYBACK_SECTION,
  ],

  // ── Process ──────────────────────────────────────────────────────────────
  process: [
    {
      title: "Navigation",
      shortcuts: [
        { keys: ["↑", "↓", "←", "→"], description: "Pan graphic" },
        { keys: ["+"], description: "Zoom in" },
        { keys: ["-"], description: "Zoom out" },
        { keys: ["Ctrl", "0"], description: "Fit to view" },
        { keys: ["M"], description: "Toggle minimap" },
        {
          keys: ["Ctrl", "I"],
          description: "Open Point Detail for hovered point",
        },
        { keys: ["Ctrl", "P"], description: "Print view" },
      ],
    },
    PLAYBACK_SECTION,
  ],

  // ── Designer ─────────────────────────────────────────────────────────────
  designer: [
    {
      title: "File",
      shortcuts: [
        { keys: ["Ctrl", "S"], description: "Save" },
        { keys: ["Ctrl", "W"], description: "Close current tab" },
        { keys: ["Ctrl", "Tab"], description: "Next tab" },
        { keys: ["Ctrl", "Shift", "Tab"], description: "Previous tab" },
        { keys: ["Ctrl", "1–9"], description: "Jump to tab number" },
      ],
    },
    {
      title: "Edit",
      shortcuts: [
        { keys: ["Ctrl", "Z"], description: "Undo" },
        { keys: ["Ctrl", "Y"], description: "Redo  (or Ctrl+Shift+Z)" },
        { keys: ["Ctrl", "A"], description: "Select all" },
        { keys: ["Ctrl", "C"], description: "Copy" },
        { keys: ["Ctrl", "X"], description: "Cut" },
        { keys: ["Ctrl", "V"], description: "Paste" },
        { keys: ["Ctrl", "D"], description: "Duplicate" },
        { keys: ["Delete"], description: "Delete selected" },
        { keys: ["Ctrl", "G"], description: "Group selection" },
        { keys: ["Ctrl", "Shift", "G"], description: "Ungroup" },
        {
          keys: ["Esc"],
          description: "Cancel drag / exit group / clear selection",
        },
      ],
    },
    {
      title: "Canvas",
      shortcuts: [
        { keys: ["Ctrl", "+"], description: "Zoom in" },
        { keys: ["Ctrl", "-"], description: "Zoom out" },
        { keys: ["Ctrl", "0"], description: "Fit to view" },
        { keys: ["Ctrl", "Shift", "0"], description: "Zoom to selection" },
        { keys: ["Space"], description: "Temporary pan mode" },
        { keys: ["Arrow keys"], description: "Nudge selected (1 px)" },
        { keys: ["Shift", "Arrow"], description: "Nudge selected (10 px)" },
        { keys: ["Ctrl", "'"], description: "Toggle grid visibility" },
        { keys: ["Ctrl", '"'], description: "Toggle snap to grid" },
      ],
    },
    {
      title: "Tools",
      shortcuts: [
        { keys: ["V"], description: "Select tool" },
        { keys: ["R"], description: "Rectangle" },
        { keys: ["E"], description: "Ellipse" },
        { keys: ["T"], description: "Text" },
        { keys: ["H"], description: "Pan tool" },
        { keys: ["P"], description: "Pen" },
        { keys: ["I"], description: "Pipe" },
        { keys: ["L"], description: "Line" },
        { keys: ["B"], description: "Freehand" },
        { keys: ["A"], description: "Annotation" },
        { keys: ["Enter"], description: "Finish pipe / pen path" },
      ],
    },
  ],

  // ── Dashboards ───────────────────────────────────────────────────────────
  dashboards: [],

  // ── Reports ──────────────────────────────────────────────────────────────
  reports: [],

  // ── Forensics ────────────────────────────────────────────────────────────
  forensics: [
    {
      title: "Chart",
      shortcuts: [
        { keys: ["←", "→"], description: "Shift time range" },
        { keys: ["+"], description: "Zoom in time range" },
        { keys: ["-"], description: "Zoom out time range" },
      ],
    },
  ],

  // ── Log ──────────────────────────────────────────────────────────────────
  log: [],

  // ── Rounds ───────────────────────────────────────────────────────────────
  rounds: [],

  // ── Alerts ───────────────────────────────────────────────────────────────
  alerts: [],

  // ── Shifts ───────────────────────────────────────────────────────────────
  shifts: [],

  // ── Settings ─────────────────────────────────────────────────────────────
  settings: [],
};
