---
id: MOD-CONSOLE-038
unit: MOD-CONSOLE
title: Fix pane title bar — optional per-pane show/hide, auto-populate from graphic, workspace-level hide-all toggle
status: pending
priority: medium
depends-on: []
source: bug
bug_report: Blank panes show "Blank" in the title bar; any pane without an explicit title falls back to the pane type label; no way to suppress the title bar
---

## What's Broken

`PaneWrapper.tsx` line 154 always resolves a display title via:

```ts
const title = config.title ?? PANE_TYPE_LABELS[config.type] ?? config.type
```

The 36px title bar then renders unconditionally in **both** live mode and edit mode.
Result: blank panes show "Blank", graphic panes without a custom title show "Graphic", etc.

The console spec (console-implementation-spec.md §5.2, line 519) says:
> "Panes are visually minimal — **no built-in headers or title bars**."

The title bar should be off by default and only appear when the user explicitly opts in.

## Expected Behavior

### 1 — Per-pane opt-in (PaneConfig data model)

Add `showTitle?: boolean` to `PaneConfig` (default: `false`/absent = hidden).

The title bar renders **only** when `config.showTitle === true`. When hidden, no 36px header exists — content fills the pane from top to bottom.

### 2 — Auto-populate title from graphic name

When a graphic is selected in `PaneConfigModal`:
- Fetch or use the already-queried graphic name from the graphics list.
- If `config.title` is currently empty (not explicitly set by the user), pre-populate the title input with the graphic's name.
- Set `showTitle: true` at the same time so the user sees the result immediately.
- The user can clear the title or uncheck "Show title" before saving.

Non-graphic panes (Trend, Point Table, Alarm List): no auto-population. Title field is blank until the user types something.

### 3 — "Show title" checkbox in PaneConfigModal

In the title row of the configure-pane dialog, add a checkbox:

```
[ Title _____________________ ]  [x] Show title bar
```

- Checkbox label: **"Show title bar"**
- Checked = `showTitle: true`; unchecked = `showTitle: false`
- The title text field remains editable regardless of checkbox state (user may want to pre-set a title for later).
- When the user checks the box while the title is empty, auto-focus the title input.

### 4 — Workspace-level "Hide all titles" toggle in top toolbar

Add a **"TT" toggle button** to the console workspace toolbar, positioned next to the AR button (between AR and Export):

- **Label:** `TT` (same style as the `AR` button — text label, no icon)
- **Tooltip:** `"Hide all pane titles"` when off / `"Pane titles hidden (click to restore)"` when on
- **Active state:** same pattern as AR — `background: var(--io-accent)`, `color: #fff`
- **Inactive state:** `background: transparent`, `color: var(--io-text-muted)`
- **Behavior:** When active, **all** pane title bars are suppressed regardless of individual `showTitle` settings. Individual settings are preserved — turning the toggle off restores each pane to its own `showTitle` state.
- **Storage:** Add `hideTitles: boolean` + `setHideTitles` to the Zustand workspace store (same pattern as `preserveAspectRatio`). Session-persistent, not saved to the server workspace config.

### 5 — Edit-mode pane chrome (unchanged behavior)

In edit mode the drag-handle header must still exist for:
- Drag-handle grab target
- Configure (gear) button
- Remove (×) button

When `showTitle` is false (or workspace-level `hideTitles` is active), the header in edit mode:
- Still renders at 36px for the drag handle and action buttons
- The title text area renders as empty (no fallback to "Blank" / type labels)
- The `PaneTypeBadge` remains visible in edit mode as a type identifier — this is acceptable

In live mode, when `showTitle` is false AND `hideTitles` is false:
- The header div does **not** render. Zero height.
- The fullscreen toggle button moves to a hover-revealed overlay (absolutely positioned top-right corner of the pane, appears on `hovered` state). Use the existing `hovered` state already tracked in `PaneWrapper`.

## Root Cause

`PaneWrapper.tsx` line 154 always resolves a non-empty title string, so the 36px header always renders. No `showTitle` flag exists on `PaneConfig`. No workspace-level suppression toggle exists.

## Data Model Changes

**`frontend/src/pages/console/types.ts` — `PaneConfig`:**
```ts
export interface PaneConfig {
  id: string
  type: PaneType
  title?: string
  showTitle?: boolean   // ADD — default absent = false (hidden)
  // ... rest unchanged
}
```

**`frontend/src/store/workspaceStore.ts`:**
```ts
hideTitles: boolean         // ADD — workspace-level override
setHideTitles: (v: boolean) => void   // ADD
```
Initialize `hideTitles: false`. Pattern is identical to `preserveAspectRatio`.

## Acceptance Criteria

- [ ] A freshly added blank pane shows **no title bar** in live mode. "Blank" never appears.
- [ ] A graphic pane configured without touching the title field shows **no title bar** in live mode.
- [ ] A graphic pane where the user checked "Show title bar" in the configure dialog shows the title bar with the graphic name (auto-populated) or the user's custom text.
- [ ] The "Show title bar" checkbox in `PaneConfigModal` correctly toggles the title bar on/off for that pane.
- [ ] When a graphic is selected in PaneConfigModal and the title is empty, the title input auto-populates with the graphic's name and the checkbox is checked.
- [ ] The `TT` toggle button appears in the console toolbar between the AR and Export buttons.
- [ ] When `TT` is active, all pane title bars disappear regardless of per-pane `showTitle` setting.
- [ ] When `TT` is turned off, panes with `showTitle: true` restore their title bar; panes with `showTitle: false` remain hidden.
- [ ] In edit mode, the drag-handle header still renders regardless of `showTitle` or `hideTitles`. No "Blank" / type label appears as the title text when no title is set.
- [ ] In live mode with no title bar, the fullscreen button appears as a hover overlay (top-right corner, shown on `hovered`).
- [ ] No regression: panes that previously had an explicit `title` set and `showTitle` absent should be treated as `showTitle: false` (title stored but not displayed — consistent with the new default).

## Verification

1. Open any Console workspace in live mode. Add a blank pane → confirm no "Blank" label, no title bar.
2. Open a graphic pane's configure dialog → confirm title auto-populates from graphic name and "Show title bar" is checked. Save → confirm title bar appears with that name.
3. Uncheck "Show title bar" and save → confirm title bar disappears in live mode.
4. Press the `TT` button in the toolbar → confirm all pane title bars disappear. Press again → confirm per-pane settings restore.
5. Switch to edit mode → confirm drag-handle header still present on all panes; no "Blank" fallback text.
6. Hover a pane in live mode with no title bar → confirm fullscreen button appears in top-right overlay.

## Spec Reference

- `console-implementation-spec.md` §5.2 Visual Feedback (line 519): "Panes are visually minimal — no built-in headers or title bars."
- `design-docs/07_CONSOLE_MODULE.md` line 180: same wording.
- `workspaceStore.ts` `preserveAspectRatio` pattern: reference for the workspace-level `hideTitles` store field and `TT` toolbar toggle.

## Do NOT

- Stub this — the fallback-to-type-label pattern is the root cause
- Show "Blank" anywhere in live mode under any condition
- Remove the drag-handle header from edit mode (that would break drag-to-reorder)
- Persist `hideTitles` to the server workspace config — session-only, same as AR
