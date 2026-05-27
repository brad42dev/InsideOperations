Corrected on 2026-05-27 per ui-audit/01-console-verification.md — category 5 panel resize behavior, category 10 grid scale and column count.

# Console Module UI Audit

Audited: 2026-05-27. Single-pass per plan. Source files read from `frontend/src/`. All findings derived from code only — no design documents consulted.

---

## Category 1: Color palette and theme tokens

**Implementation:** shared-component — all colors consumed via CSS custom properties defined in `frontend/src/index.css`. No Console-specific token overrides.

**Source-of-truth files:**
- `frontend/src/index.css:19-295` — 138 CSS custom properties (dark + light theme)
- `frontend/src/pages/console/panes/AlarmListPane.tsx:34-46` — hardcoded hex priority colors
- `frontend/src/pages/console/panes/PointTablePane.tsx:28-35` — hardcoded hex quality colors
- `frontend/src/pages/console/panes/TrendPane.tsx:46-55` — hardcoded hex series palette
- `frontend/src/pages/console/index.tsx:2033-2036` — hardcoded published dot color

**Visual properties actually applied:**
Token-referenced colors used in Console:
- Surfaces: `var(--io-surface)`, `var(--io-surface-secondary)`, `var(--io-surface-elevated)`, `var(--io-bg)` (undefined — see deviations)
- Text: `var(--io-text-primary)`, `var(--io-text-muted)`, `var(--io-text-disabled)`, `var(--io-text-inverse)`, `var(--io-text)` (undefined — see deviations)
- Borders: `var(--io-border)`
- Accent: `var(--io-accent)`, `var(--io-accent-subtle)`
- Semantic: `var(--io-success)`, `var(--io-warning)`, `var(--io-danger)`, `var(--io-warning-subtle)`, `var(--io-alarm-high)`

Hardcoded colors that bypass the token system:
- AlarmListPane priority colors: `#EF4444` (urgent), `#F97316` (high), `#EAB308` (low), `#F4F4F5` (diagnostic)
- AlarmListPane state colors: `#EF4444` (active), `#F59E0B` (unacknowledged)
- PointTablePane quality colors: `#10B981` (good), `#F59E0B` (uncertain), `#EF4444` (bad)
- TrendPane legacy series palette: `#4A9EFF`, `#F59E0B`, `#10B981`, `#EF4444`, `#8B5CF6`, `#EC4899`, `#06B6D4`, `#84CC16`
- Tab published dot: `#10b981`
- Pane swap-source border: `#F59E0B` (matches `--io-warning` numerically but not referenced by token)
- Hover-overlay button background: `rgba(9,9,11,0.70)`
- Save-failure banner text: `#fff` instead of `var(--io-status-fg)`

**Deviations from app shell:**
- `var(--io-bg)` is referenced at `index.tsx:1878` and `index.tsx:1938` but is not defined in `index.css`. The token registry only defines `--io-surface-primary`, `--io-surface-secondary`, etc. No fallback provided; CSS var resolves as empty.
- `var(--io-text)` is referenced in `index.tsx` (WorkspaceNameModal, DeleteConfirmDialog, CloseConfirmDialog) and `ConsolePalette.tsx` section search input — not defined in `index.css`. Likely intended as `var(--io-text-primary)`.
- Alarm priority badge colors do not use `--io-alarm-urgent`, `--io-alarm-high`, `--io-alarm-low`, `--io-alarm-diagnostic`. Those tokens have theme-adaptive values; hardcoded hex values are fixed for dark theme.
- Published dot `#10b981` vs `var(--io-success)` = `#22c55e` (dark) / `#16a34a` (light) — not theme-adaptive.

**Notes:**
- Quality badge colors have no corresponding app-shell tokens; the choice of hardcoded hex here is the only available option for that sub-type.

---

## Category 2: Typography

**Implementation:** inline-styles — no Console-specific CSS classes or shared typography component. Font-family not overridden anywhere in Console; inherits system sans-serif from app shell.

**Source-of-truth files:**
- `frontend/src/index.css:179-218` — 16 typography scale tokens + `--io-font-mono`
- `frontend/src/pages/console/index.tsx:1963-1971, 2008-2020, 2088-2103` — module name, tab labels, new-tab button
- `frontend/src/pages/console/index.tsx:59-134` — status bar font sizes
- `frontend/src/pages/console/PaneWrapper.tsx:84-101, 409-424` — pane type badge, pane header title
- `frontend/src/pages/console/ConsolePalette.tsx:66-84, 511-537` — section labels, sub-group labels
- `frontend/src/pages/console/PaneConfigModal.tsx:247-264, 296-305, 329-342` — dialog title, form labels
- `frontend/src/pages/console/panes/AlarmListPane.tsx:50-65, 352-376` — priority badge, table header

**Visual properties actually applied:**
- Module name "Console": `fontSize: 15, fontWeight: 600`
- Workspace tab labels: `fontSize: 13, fontWeight: 600` (active) / `fontWeight: 400` (inactive)
- Toolbar buttons and right-controls: `fontSize: 12`
- New-tab (+) button: `fontSize: 18`
- Status bar: `fontSize: 11`
- Pane header title: `fontSize: 13, fontWeight: 500`
- PaneTypeBadge: `fontSize: 10, fontWeight: 600, textTransform: uppercase, letterSpacing: 0.03em`
- Palette accordion section label: `fontSize: 11, fontWeight: 700, textTransform: uppercase, letterSpacing: 0.06em`
- Palette sub-group label (SubGroupLabel): `fontSize: 9, fontWeight: 700, textTransform: uppercase, letterSpacing: 0.08em`
- Layout picker group labels: `fontSize: 9, fontWeight: 700, textTransform: uppercase, letterSpacing: 0.07em`
- PaneConfigModal title: `fontSize: 16, fontWeight: 600`
- PaneConfigModal form section labels: `fontSize: 12, fontWeight: 600, textTransform: uppercase, letterSpacing: 0.04em`
- WorkspaceNameModal title: `fontSize: 14, fontWeight: 600`
- WorkspaceNameModal field labels: `fontSize: 11, fontWeight: 500`
- AlarmListPane table header: `fontSize: 11, fontWeight: 600, textTransform: uppercase, letterSpacing: 0.04em`
- AlarmListPane row: `fontSize: 12`; alarm tag/time: `fontFamily: monospace`
- AlarmListPane priority badge: `fontSize: 10, fontWeight: 700, letterSpacing: 0.05em`
- PointTablePane quality badge: `fontSize: 11, fontWeight: 500`
- TrendPane legend item: `fontSize: 11`
- Empty state paragraph: `fontWeight: 600, fontSize: 15` (heading) / `fontSize: 13` (body)

**Deviations from app shell:**
- None of the 16 typography scale tokens (`--io-text-4xl` through `--io-text-code-sm`) defined in `index.css:179-194` are referenced in any Console file. All sizes are raw integer pixels.
- `fontFamily: monospace` used in `AlarmListPane.tsx:151, 164` instead of `var(--io-font-mono)`.
- SubGroupLabel (9px) and PaneTypeBadge (10px) are below the smallest token (`--io-text-2xs: 0.6875rem` ≈ 11px).

**Notes:**
- None of the inline font sizes map cleanly to token equivalents (e.g., 15px ≠ any defined token; 16px ≠ any defined token).

---

## Category 3: Toolbars

**Implementation:** module-local-component — single 48px horizontal header bar, defined as inline JSX inside `ConsolePage` in `index.tsx`. No shared toolbar component used.

**Source-of-truth files:**
- `frontend/src/pages/console/index.tsx:1942-2826` — full header div including tab strip and all right-side controls
- `frontend/src/pages/console/index.tsx:247-466` — `LayoutPickerButton` component (inline layout picker dropdown)

**Visual properties actually applied:**
Toolbar container:
- `height: 48, display: flex, alignItems: center, padding: 0 12px 0 0`
- `background: var(--io-surface), borderBottom: 1px solid var(--io-border)`

Module name column (palette-aligned section):
- `width: panelWidth, padding: 0 16px, fontSize: 15, fontWeight: 600, color: var(--io-text-primary)`
- `borderRight: 1px solid var(--io-border), height: 100%`

Tab strip:
- `flex: 1, overflow: hidden, paddingLeft: 10, gap: 2`
- Active tab underline: `borderBottom: 2px solid var(--io-accent), height: 100%`
- Inactive tab underline: `borderBottom: 2px solid transparent`
- Tab button: `fontSize: 13, fontWeight: 600/400 (active/inactive), color: var(--io-text-primary)/var(--io-text-muted), background: transparent`
- Close tab (×): `fontSize: 14, opacity: 0.6 (default), 1 (hover), color: var(--io-text-muted)`
- New workspace (+): `fontSize: 18, color: var(--io-text-muted), background: transparent`

Right-side controls group:
- `gap: 8, flexShrink: 0`
- Separator: `width: 1, height: 18, background: var(--io-border)`

Standard toolbar buttons (Undo/Redo/Clear/Rename/Delete/Save/Close):
- `padding: 4px 8-10px, borderRadius: 6, fontSize: 12, border: 1px solid var(--io-border), background: transparent, color: var(--io-text-muted)`

Destructive button (Delete):
- `color: var(--io-danger)`; disabled: `opacity: 0.4, color: var(--io-text-disabled)`

Save button (accent, conditional render when dirty):
- `color: var(--io-accent), background: transparent, border: 1px solid var(--io-border)`

Active-state buttons (Lock when locked, Publish when published):
- `background: var(--io-accent-subtle), color: var(--io-accent), border: 1px solid var(--io-border)`

AR button (active state):
- `background: var(--io-accent), color: #fff` (full-fill, not subtle)

TT button (titles-visible state = TT active):
- `background: var(--io-accent), color: #fff, fontWeight: 600`

Live mode toggle (active):
- `background: var(--io-accent-subtle), color: var(--io-accent), borderColor: var(--io-accent), fontSize: 12, borderRadius: 6`

Historical mode toggle (active):
- `background: var(--io-warning-subtle), color: var(--io-warning), borderColor: var(--io-warning), fontSize: 12, borderRadius: 6`

Export split button:
- Left half: `borderRadius: 6px 0 0 6px, padding: 5px 10px, fontSize: 13, color: var(--io-text-primary)`
- Right chevron half: `borderRadius: 0 6px 6px 0, padding: 5px 7px, fontSize: 11`
- Both: `border: 1px solid var(--io-border), background: transparent`

Layout picker button:
- `padding: 3px 7px 3px 5px, borderRadius: 6, border: 1px solid var(--io-border), background: var(--io-surface-secondary)` (closed) / `var(--io-surface-elevated)` (open)

**Deviations from app shell:**
- Console header uses `background: var(--io-surface)` = `var(--io-surface-elevated)` (#27272a dark). App shell defines `--io-topbar-bg: var(--io-surface-primary)` (#09090b dark) for the shell top bar. The Console header is visually a lighter background than the shell topbar.
- Delete button uses `color: var(--io-danger)` without a dedicated danger/destructive button token — no `--io-btn-danger-*` token exists in the token registry.
- None of the 6 button tokens (`--io-btn-bg`, `--io-btn-hover`, etc.) are used.

**Notes:**
- The Publish button appears twice in the right controls block: inside the `activeWorkspace && (...)` group at `index.tsx:2295` and again unconditionally at `index.tsx:2722`. Both render when `activeWorkspace && canPublish`, producing duplicate Publish buttons in the toolbar.
- LayoutPickerButton is module-local with its own custom dropdown (inline absolute positioned, `zIndex: 200`) — no shared dropdown component used.

---

## Category 4: Menus

**Implementation:** mix — right-click context menus use shared-component (`shared/components/ContextMenu`); the export quick-format dropdown is a hand-rolled inline-positioned panel in `index.tsx`.

**Source-of-truth files:**
- `frontend/src/pages/console/index.tsx:3108-3264` — workspace background right-click menu
- `frontend/src/pages/console/index.tsx:3304-3405` — workspace tab right-click menu
- `frontend/src/pages/console/PaneWrapper.tsx:791-958` — pane header right-click menu
- `frontend/src/pages/console/index.tsx:2591-2654` — export quick-format dropdown (inline)
- `frontend/src/shared/components/ContextMenu.tsx` — shared component (styles owned by app shell, not audited here)

**Visual properties actually applied:**
Context menus (right-click, all three locations): delegated entirely to `shared/components/ContextMenu`. No Console-specific container or item styles applied.

Export quick-format dropdown (Console-local):
- Backdrop (click-away layer): `position: fixed, inset: 0, zIndex: 999`
- Container: `position: absolute, top: 100%, right: 0, zIndex: 1000, background: var(--io-surface-elevated), border: 1px solid var(--io-border), borderRadius: 6, boxShadow: 0 8px 24px rgba(0,0,0,0.3), overflow: hidden, minWidth: 140, marginTop: 4`
- Items: `display: block, width: 100%, padding: 8px 14px, background: none, border: none, textAlign: left, cursor: pointer, fontSize: 13, color: var(--io-text-primary)`
- Hover state: inline `onMouseEnter` sets `background: var(--io-surface-secondary)`; `onMouseLeave` resets to `none` — direct DOM style mutation, not React state

**Deviations from app shell:**
- Export dropdown is a hand-rolled absolute-positioned panel using direct DOM style mutation for hover, rather than the shared `ContextMenu` component.
- Hover is implemented via `onMouseEnter`/`onMouseLeave` with `e.currentTarget.style.background` mutation — no CSS class or React state.

**Notes:**
- The export dropdown backdrop uses `position: fixed` — safe here since the toolbar is not inside an RGL transform ancestor.
- `ContextMenu` is also used to render the workspace background and tab context menus, which share the same visual treatment as context menus in other modules.

---

## Category 5: Side panels

**Implementation:** module-local-component — `ConsolePalette.tsx` with `useConsolePanelResize` hook for panel width persistence. The `panelWidth` prop received from `index.tsx` is applied in the rendered panel div at `ConsolePalette.tsx:2169-2170`, overriding the module-level `PANEL_W=220` constant; the right-edge resize handle works correctly.

**Source-of-truth files:**
- `frontend/src/pages/console/ConsolePalette.tsx:52-64, 66-84, 86-107` — panel, sectionHeader, sectionLabel, listItem style constants
- `frontend/src/pages/console/ConsolePalette.tsx:197-256` — ViewModeSelector button styles
- `frontend/src/pages/console/ConsolePalette.tsx:287-484` — AccordionSection component (search input, resize handle)
- `frontend/src/pages/console/ConsolePalette.tsx:511-537` — SubGroupLabel component
- `frontend/src/pages/console/ConsolePalette.tsx:2165-2173` — rendered panel div applying panelWidth prop
- `frontend/src/shared/hooks/useConsolePanelResize.ts` — panel width persistence in localStorage
- `frontend/src/pages/console/index.tsx:1127-1132` — panelWidth state from hook

**Visual properties actually applied:**
Panel container:
- `width: panelWidth prop (overrides PANEL_W=220 constant from style spread), minWidth: panelWidth, flexShrink: 0`
- `background: var(--io-surface-secondary), borderRight: 1px solid var(--io-border)`
- `overflow: hidden, userSelect: none`

Accordion section headers:
- `height: 36, padding: 0 10px, cursor: pointer, borderBottom: 1px solid var(--io-border), gap: 6`

Section label:
- `fontSize: 11, fontWeight: 700, textTransform: uppercase, letterSpacing: 0.06em, color: var(--io-text-muted), flex: 1`

Section count badge:
- `fontSize: 10, fontWeight: 700, background: var(--io-accent-subtle), color: var(--io-accent), borderRadius: 8, padding: 1px 5px`

View mode selector buttons (List/Thumbnails/Grid):
- `width: 20, height: 20, border: none, borderRadius: 3, padding: 0`
- Active: `background: var(--io-accent-subtle), color: var(--io-accent)`
- Inactive: `background: transparent, color: var(--io-text-muted)`
- Hover (non-active): `background: var(--io-surface-elevated), color: var(--io-text-primary)` (via DOM mutation)

Section search input (when search active):
- `padding: 3px 7px, background: var(--io-surface-elevated), border: 1px solid var(--io-border), borderRadius: 4, color: var(--io-text), fontSize: 11` (note: `var(--io-text)` undefined)

Section bottom resize handle:
- `height: 5, cursor: ns-resize, borderTop: 1px solid var(--io-border)`
- Active: `background: var(--io-accent)`; hover: `background: var(--io-surface-elevated)` (DOM mutation)

List items (`listItem` style constant):
- `padding: 6px 10px, fontSize: 12, color: var(--io-text-primary), cursor: grab, borderRadius: var(--io-radius), margin: 1px 4px`

Sub-group labels (SubGroupLabel):
- `fontSize: 9, fontWeight: 700, textTransform: uppercase, letterSpacing: 0.08em, color: var(--io-text-muted), padding: 6px 10px 2px`

**Deviations from app shell:**
- `var(--io-text)` used in section search input — undefined token (see category 1).
- View mode selector hover state and resize handle hover both use direct `onMouseEnter`/`onMouseLeave` DOM style mutation rather than React state or CSS.
- `borderRadius: 3` on view mode selector buttons — inconsistent with `var(--io-radius)` (6px) used on list items.
- App-shell defines `--io-sidebar-bg: var(--io-surface-secondary)` and `--io-sidebar-width: 240px`. ConsolePalette width is 220px and does not use the sidebar width token.

**Notes:**
- The palette is conditionally hidden (`!isKiosk`) in kiosk mode; no animation or transition on show/hide.
- The `PointsBrowserPanel` (app-shell component) is embedded inside the palette's Points section — its visual properties are app-shell-owned and not audited here.
- Right-edge panel drag resize is implemented in `index.tsx` using `useConsolePanelResize`; the resize handle lives outside `ConsolePalette` itself. The resulting `panelWidth` value is correctly propagated as a prop and applied in the rendered div (`ConsolePalette.tsx:2169-2170`), so the panel body does track the drag.

---

## Category 6: Buttons

**Implementation:** inline-styles — all buttons are native `<button>` elements with fully inline styles. No shared Button component used anywhere in Console.

**Source-of-truth files:**
- `frontend/src/pages/console/index.tsx:2116-2824` — toolbar buttons (Live/Historical, Undo/Redo, Layout, Clear, Rename, Lock, Delete, Save, AR, TT, Export, Fullscreen)
- `frontend/src/pages/console/PaneWrapper.tsx:143-160, 439-619` — pane icon buttons (configure, pin, remove) and blank pane CTA
- `frontend/src/pages/console/PaneConfigModal.tsx:461-492` — modal Cancel/Save buttons
- `frontend/src/pages/console/index.tsx:3012-3025, 3549-3581, 3641-3668, 3731-3778` — empty state CTA and inline modal buttons
- `frontend/src/pages/console/panes/AlarmListPane.tsx:176-192` — alarm Ack button
- `frontend/src/pages/console/panes/PointTablePane.tsx:185-199, 253-270` — configure-points CTA and overlay button

**Visual properties actually applied:**
Primary action buttons (accent fill):
- Empty state CTA, blank pane CTA, modal Save/Create/Rename: `background: var(--io-accent), color: #fff, border: none, borderRadius: 6, padding: 7-9px 14-20px, fontSize: 12-14, fontWeight: 500-600, cursor: pointer`
- PointTablePane overlay "Configure Points": `background: rgba(0,0,0,0.7), color: #fff, border: 1px solid rgba(255,255,255,0.2), borderRadius: 6, padding: 5px 10px, fontSize: 12`

Secondary buttons (bordered, transparent):
- Toolbar secondary (Clear/Rename/Undo/Redo): `background: transparent, border: 1px solid var(--io-border), borderRadius: 6, padding: 4px 8-10px, fontSize: 12, color: var(--io-text-muted), cursor: pointer`
- Modal Cancel: `padding: 5px 14px, background: transparent, border: 1px solid var(--io-border), borderRadius: 4 or 6, color: var(--io-text-muted), fontSize: 12`

Destructive button (Delete in toolbar):
- `color: var(--io-danger), background: transparent, border: 1px solid var(--io-border), borderRadius: 6, fontSize: 12`; disabled: `opacity: 0.4, color: var(--io-text-disabled)`

Modal destructive (Delete confirm):
- `background: var(--io-danger), color: #fff, border: none, borderRadius: 4, padding: 5px 14px, fontSize: 12`

Save button (toolbar, appears only when dirty):
- `color: var(--io-accent), background: transparent, border: 1px solid var(--io-border), borderRadius: 6, padding: 4px 10px, fontSize: 12`

Pane header icon buttons (configure gear, remove ×, pin):
- `background: transparent, border: none, padding: 3px 5px, borderRadius: 4, color: var(--io-text-muted), cursor: pointer`
- Pin active: `background: var(--io-accent-subtle), color: var(--io-accent)`

Hover-overlay fullscreen buttons:
- `background: rgba(9,9,11,0.70), border: 1px solid var(--io-border), borderRadius: 4, padding: 4px 6px, color: var(--io-text-muted)`

Alarm Ack button:
- `padding: 2px 7px, fontSize: 10, border: 1px solid var(--io-border), borderRadius: 3, background: transparent, color: var(--io-text-muted)`

**Deviations from app shell:**
- None of the 6 button tokens (`--io-btn-bg`, `--io-btn-hover`, `--io-btn-active`, `--io-btn-text`, `--io-btn-secondary-bg`, `--io-btn-secondary-border`) are referenced anywhere in Console.
- `borderRadius` is inconsistent across button types: `6` (most toolbar and modal), `4` (modal Cancel, pane icon buttons, hover-overlay), `3` (Alarm Ack button). The token `var(--io-radius)` = 6px is not used for buttons.
- `color: #fff` hardcoded on primary buttons instead of `var(--io-accent-foreground)` or `var(--io-btn-text)`.
- No hover state implemented for toolbar buttons, pane header icon buttons, or modal buttons (only `onMouseEnter`/`onMouseLeave` on export dropdown items and view mode selectors).
- Disabled toolbar buttons use `opacity: 0.4` — no standard disabled token exists, but behavior is inconsistent: the Save button is absent when clean rather than disabled.

**Notes:**
- There is no keyboard-focus visible style (`:focus-visible` ring) on any button in Console.

---

## Category 7: Form inputs

**Implementation:** inline-styles — all form inputs use inline styles; no shared input, select, or textarea component used.

**Source-of-truth files:**
- `frontend/src/pages/console/PaneConfigModal.tsx:65-82, 306-321, 357-378, 420-437` — text input, select, checkbox, radio
- `frontend/src/pages/console/index.tsx:3499-3547` — WorkspaceNameModal text input and textarea
- `frontend/src/pages/console/PaneWrapper.tsx:1037-1055` — Replace Graphic search input
- `frontend/src/pages/console/ConsolePalette.tsx:404-424` — section search input

**Visual properties actually applied:**
Text inputs (PaneConfigModal, WorkspaceNameModal):
- `background: var(--io-surface-secondary)` (PaneConfigModal) / `var(--io-surface-elevated)` (WorkspaceNameModal)
- `border: 1px solid var(--io-border), borderRadius: 6, padding: 6-7px 10px, fontSize: 13, color: var(--io-text-primary) or var(--io-text) (undefined), outline: none`

Replace Graphic search input:
- `width: 100%, boxSizing: border-box, padding: 6px 10px, background: var(--io-surface-secondary), border: 1px solid var(--io-border), borderRadius: 4, color: var(--io-text-primary), fontSize: 13, outline: none`

Section search input in ConsolePalette (type="search"):
- `padding: 3px 7px, background: var(--io-surface-elevated), border: 1px solid var(--io-border), borderRadius: 4, color: var(--io-text), fontSize: 11, outline: none`

Textarea (WorkspaceNameModal description):
- Same as text input plus `resize: vertical, fontFamily: inherit, rows: 3`

Select (duration in PaneConfigModal):
- `background: var(--io-surface-secondary), border: 1px solid var(--io-border), borderRadius: 6, padding: 7px 10px, fontSize: 13, color: var(--io-text-primary), cursor: pointer, outline: none`

Checkboxes (PointSearch in PaneConfigModal):
- `accentColor: var(--io-accent)` — browser native checkbox

Radio inputs (alarm filter in PaneConfigModal):
- `accentColor: var(--io-accent)` — browser native radio

Point search result items (PaneConfigModal):
- Row: `padding: 6px 10px, borderRadius: 6, fontSize: 13, border: 1px solid var(--io-border)`
- Selected row: `background: var(--io-accent-subtle), border-color: var(--io-accent)`
- Unselected row: `background: var(--io-surface-secondary)`
- Tag label: `fontFamily: monospace, fontSize: 11, color: var(--io-text-muted)` (uses literal `monospace` not `--io-font-mono`)

**Deviations from app shell:**
- `outline: none` on all inputs removes the browser focus ring; no Console replacement using `--io-focus-ring` or `--io-input-focus-border` is applied.
- `var(--io-text)` used in WorkspaceNameModal inputs (`index.tsx:3512, 3543`) and palette section search — not defined in `index.css`.
- `background: var(--io-surface-secondary)` vs `background: var(--io-surface-elevated)` used inconsistently across structurally identical text inputs.
- None of the 5 input tokens (`--io-input-bg`, `--io-input-border`, `--io-input-focus-border`, `--io-input-placeholder`, `--io-input-height`) are used.
- `borderRadius: 4` on Replace Graphic and palette search inputs vs `6` on PaneConfigModal and WorkspaceNameModal inputs — no consistent value.

**Notes:**
- There is no `placeholder` color override; browser default placeholder color applies. `--io-input-placeholder: var(--io-text-muted)` is defined but not applied.

---

## Category 8: Status indicators

**Implementation:** inline-styles — all status indicators are hand-drawn inline `<span>` elements with circle or badge styles.

**Source-of-truth files:**
- `frontend/src/pages/console/index.tsx:59-134` — `ConsoleStatusBar` (connection dot, playback mode dot)
- `frontend/src/pages/console/index.tsx:2026-2052` — tab published dot and dirty dot
- `frontend/src/pages/console/index.tsx:2889-2928, 2929-2965` — swap mode and save-failure banners
- `frontend/src/pages/console/panes/AlarmListPane.tsx:34-91` — `PriorityBadge` and `StateBadge`
- `frontend/src/pages/console/panes/PointTablePane.tsx:26-59` — `QualityBadge`

**Visual properties actually applied:**
ConsoleStatusBar connection dot:
- `width: 6, height: 6, borderRadius: 50%, display: inline-block`
- Connected: `background: var(--io-success)`
- Connecting: `background: var(--io-warning)`
- Disconnected / Error: `background: var(--io-danger)`
- Label: `fontSize: 11, color: var(--io-text-muted), gap: 4`

ConsoleStatusBar playback mode dot:
- Same 6×6px circle dimensions
- Live: `background: var(--io-success)`
- Historical: `background: var(--io-warning)`

Tab dirty dot (unsaved changes):
- `width: 6, height: 6, borderRadius: 50%, background: var(--io-warning), display: inline-block, flexShrink: 0`

Tab published dot:
- `width: 6, height: 6, borderRadius: 50%, background: #10b981` (hardcoded)

Swap mode banner:
- `flexShrink: 0, padding: 6px 14px, background: var(--io-warning), color: var(--io-text-inverse), fontSize: 12`

Save-failure banner:
- `flexShrink: 0, padding: 6px 14px, background: var(--io-alarm-high), color: #fff, fontSize: 13`

Alarm PriorityBadge:
- `padding: 1px 6px, borderRadius: 4, fontSize: 10, fontWeight: 700, letterSpacing: 0.05em`
- Urgent: `background: rgba(239,68,68,0.133), color: #EF4444, border: 1px solid rgba(239,68,68,0.267)`
- High: `background: rgba(249,115,22,0.133), color: #F97316, border: 1px solid rgba(249,115,22,0.267)`
- Low: `background: rgba(234,179,8,0.133), color: #EAB308, border: 1px solid rgba(234,179,8,0.267)`
- Diagnostic: `background: rgba(244,244,245,0.133), color: #F4F4F5, border: 1px solid rgba(244,244,245,0.267)`

Alarm StateBadge:
- `fontSize: 12`
- Active: `color: #EF4444, fontWeight: 600`
- Unacknowledged: `color: #F59E0B, fontWeight: 600`
- Acknowledged: `color: var(--io-text-muted), fontWeight: 400`

Quality badge (PointTablePane):
- `fontSize: 11, fontWeight: 500` with 6×6px circle
- Good: `color: #10B981`
- Uncertain: `color: #F59E0B`
- Bad: `color: #EF4444`
- Unknown: `color: var(--io-text-muted)`

**Deviations from app shell:**
- AlarmListPane priority badge colors use hardcoded hex (`#EF4444`, `#F97316`, `#EAB308`, `#F4F4F5`) instead of `--io-alarm-urgent`, `--io-alarm-high`, `--io-alarm-low`, `--io-alarm-diagnostic`. The alarm tokens differ per theme (e.g., dark urgent = `#ef4444`, light urgent = `#dc2626`).
- Tab published dot uses `#10b981` instead of `var(--io-success)`. Dark theme value is `#22c55e`; numerically distinct and not theme-adaptive.
- Quality badge colors have no corresponding tokens — hardcoded hex is the only option.
- Save-failure banner uses `color: #fff` rather than `var(--io-status-fg)`.

**Notes:**
- `var(--io-alarm-high)` is used correctly on the save-failure banner — this is the only alarm-token use in the Console status indicator layer.

---

## Category 9: Labels and headers

**Implementation:** inline-styles — no shared heading or label component used. All section titles, dialog titles, and column headers are `<div>` or `<span>` with manually-set font properties.

**Source-of-truth files:**
- `frontend/src/pages/console/index.tsx:1963-1972` — module name "Console"
- `frontend/src/pages/console/index.tsx:2008-2019` — workspace tab labels
- `frontend/src/pages/console/ConsolePalette.tsx:66-84, 344-348, 511-537` — section labels, section badge, sub-group labels
- `frontend/src/pages/console/PaneConfigModal.tsx:243-265, 296-305` — modal dialog title and form section labels
- `frontend/src/pages/console/index.tsx:3487-3491` — WorkspaceNameModal title
- `frontend/src/pages/console/index.tsx:3519-3526` — WorkspaceNameModal field labels
- `frontend/src/pages/console/panes/AlarmListPane.tsx:352-376` — alarm table column headers
- `frontend/src/pages/console/index.tsx:246-265, 405-414` — LayoutPickerButton dropdown group labels

**Visual properties actually applied:**
Module name "Console":
- `fontSize: 15, fontWeight: 600, color: var(--io-text-primary)`

Active workspace tab label:
- `fontSize: 13, fontWeight: 600, color: var(--io-text-primary)`

Inactive workspace tab label:
- `fontSize: 13, fontWeight: 400, color: var(--io-text-muted)`

Palette section header label:
- `fontSize: 11, fontWeight: 700, textTransform: uppercase, letterSpacing: 0.06em, color: var(--io-text-muted)`

Palette sub-group labels (SubGroupLabel):
- `fontSize: 9, fontWeight: 700, textTransform: uppercase, letterSpacing: 0.08em, color: var(--io-text-muted), padding: 6px 10px 2px`

Layout picker dropdown group labels:
- `fontSize: 9, fontWeight: 700, textTransform: uppercase, letterSpacing: 0.07em, color: var(--io-text-muted)`

PaneConfigModal dialog title (Radix Dialog.Title):
- `margin: 0, fontSize: 16, fontWeight: 600, color: var(--io-text-primary)` (inline style on Dialog.Title element)

PaneConfigModal form section labels:
- `fontSize: 12, fontWeight: 600, textTransform: uppercase, letterSpacing: 0.04em, color: var(--io-text-muted)`

WorkspaceNameModal dialog title:
- `fontSize: 14, fontWeight: 600, color: var(--io-text)` (undefined token)

WorkspaceNameModal field labels:
- `fontSize: 11, fontWeight: 500, color: var(--io-text-muted)`

Alarm table column headers:
- `fontSize: 11, fontWeight: 600, textTransform: uppercase, letterSpacing: 0.04em, color: var(--io-text-muted), height: 32, background: var(--io-surface-secondary)`

Empty state heading:
- `fontWeight: 600, color: var(--io-text-primary), fontSize: 15`

PaneWrapper header title:
- `fontSize: 13, fontWeight: 500, color: var(--io-text-primary), overflow: hidden, textOverflow: ellipsis, whiteSpace: nowrap`

**Deviations from app shell:**
- No typography scale tokens (`--io-text-*`) are used for any label or header.
- No semantic heading elements (`<h1>` through `<h6>`) are used anywhere in Console.
- `var(--io-text)` used in dialog titles — undefined token (see category 1).
- Dialog title size is inconsistent: PaneConfigModal uses 16px, WorkspaceNameModal uses 14px, DeleteConfirmDialog and CloseConfirmDialog use 14px — no single standard for modal titles.

**Notes:**
- PaneTypeBadge (`PaneWrapper.tsx:84-101`) uses `textTransform: uppercase, letterSpacing: 0.03em` — functions as a type label, not a form label, but uses a similar visual treatment.

---

## Category 10: Canvas / main work area

**Implementation:** mix — `WorkspaceGrid.tsx` wraps `react-grid-layout` (module-local-component for the grid shell); pane content types delegate to shared infrastructure: `TrendPane` → `shared/components/charts/TimeSeriesChart` and `shared/components/charts/ChartRenderer`; `GraphicPane` → `shared/graphics/SceneRenderer`; `PointTablePane` → `shared/components/DataTable`; `AlarmListPane` uses inline grid layout.

**Source-of-truth files:**
- `frontend/src/pages/console/WorkspaceGrid.tsx:752-1033` — grid container, RGL configuration, selection marquee, ghost outlines, fullscreen portal
- `frontend/src/pages/console/WorkspaceGrid.css:1-77` — pane padding, fullscreen animation, north resize handle overrides
- `frontend/src/pages/console/PaneWrapper.tsx:324-374, 376-390, 624-790` — pane card shell, thin drag strip, content area
- `frontend/src/pages/console/panes/TrendPane.tsx:46-55` — series color palette (hardcoded)
- `frontend/src/pages/console/panes/AlarmListPane.tsx:130-196` — alarm row grid layout

**Visual properties actually applied:**
Grid container:
- `flex: 1, overflow: hidden, position: relative, height: 100%, userSelect: none`
- Background: not set (inherits from outer layout div; that div uses `background: var(--io-bg)` — undefined token)
- RGL: `cols: 288 (12 × GRID_SCALE=24), rowHeight: containerHeight/288, margin: [0,0], containerPadding: [0,0]`
- Pane visual padding: `2px` via `.io-workspace-grid > .react-grid-item { padding: 2px; box-sizing: border-box }` (WorkspaceGrid.css:4-7)
- Resize handles: n/nw/ne overridden in CSS to remove RGL's default `rotate(225deg)` transform; widened to span full top edge (WorkspaceGrid.css:31-67)

Fullscreen portal animation:
- Enter: `opacity 0→1, scale 0.98→1, 200ms ease` keyframes `io-pane-fullscreen-enter`
- Exit: `opacity 1→0, scale 1→0.98, 200ms ease` keyframes `io-pane-fullscreen-exit`
- Portal div: `position: absolute, inset: 0, zIndex: 500`

Pane card shell (PaneWrapper):
- `background: var(--io-surface), borderRadius: 4, overflow: hidden, contain: layout style paint`
- Border states (in priority order):
  - Drag-over: `2px dashed var(--io-accent)`
  - Swap source: `2px solid #F59E0B`
  - Swap target: `2px dashed var(--io-accent)`
  - Selected: `2px solid var(--io-accent)` + `outline: 1px solid var(--io-accent), outlineOffset: -1px`
  - Hovered + clipboard available: `1px dashed var(--io-accent)`
  - Hovered: `1px solid var(--io-border)`
  - Default: `1px solid transparent`

Pane header (title bar):
- `height: 36, background: var(--io-surface-secondary), borderBottom: 1px solid var(--io-border), padding: 0 10px, cursor: grab/context-menu`

Thin drag strip (TT on, unlocked):
- `height: 4, cursor: grab` (no visual background)

Box selection marquee:
- `position: absolute, border: 1px solid var(--io-accent), background: var(--io-accent-subtle), pointerEvents: none, zIndex: 50`

Drag/resize ghost outline (displaced panes):
- `position: absolute, border: 2px dashed var(--io-accent), background: var(--io-accent-subtle), borderRadius: var(--io-radius), opacity: 0.75`
- Transition: `left/top/width/height 60ms ease`

ErrorBoundary fallback (inside pane):
- `background: var(--io-surface-secondary), color: var(--io-text-muted), fontSize: 13`
- Retry button: `borderRadius: var(--io-radius), border: 1px solid var(--io-border), background: var(--io-surface), color: var(--io-text-primary), padding: 4px 12px`

TrendPane series colors (hardcoded):
- `#4A9EFF` (blue), `#F59E0B` (amber), `#10B981` (green), `#EF4444` (red), `#8B5CF6` (purple), `#EC4899` (pink), `#06B6D4` (cyan), `#84CC16` (lime)

**Deviations from app shell:**
- Pane swap-source border uses `#F59E0B` — numerically identical to `var(--io-warning)` in dark theme but not token-referenced; will diverge on light theme (where `--io-warning` = `#d97706`).
- TrendPane series colors are a distinct palette from `--io-pen-1` through `--io-pen-8` tokens. The pen tokens are also hardcoded in `index.css` (not theme-adaptive for hue), but the specific hex values differ.
- Grid container background inherits `var(--io-bg)` from outer div in `index.tsx` — undefined token.
- `borderRadius: 4` on pane card vs `var(--io-radius)` = 6px.

**Notes:**
- `contain: layout style paint` on PaneWrapper div is a CSS containment optimization that prevents pane content from affecting layout outside the pane boundary.
- Fullscreen portal uses `createPortal` into `containerRef.current` (the grid container div), not into `document.body`. This escapes the RGL transform ancestor while keeping the fullscreen pane scoped within the workspace area visually.
- `allowOverlap: true` in RGL compactor (`WorkspaceGrid.tsx:45`) permits items to overlap during gesture; `handleResizeStop`/`handleDragStop` call `scanLineCompact` to resolve collisions on drop.

---

## Category 11: Modals and dialogs

**Implementation:** mix — `WorkspaceNameModal`, `DeleteConfirmDialog`, `CloseConfirmDialog` are module-local inline JSX with hand-rolled backdrop and content (no shared dialog primitive); `PaneConfigModal` uses Radix `@radix-ui/react-dialog`; Replace Graphic dialog in `PaneWrapper.tsx` is inline JSX; `VersionRecoveryDialog` and `SaveConfirmDialog` are shared app-shell components.

**Source-of-truth files:**
- `frontend/src/pages/console/index.tsx:3438-3584` — WorkspaceNameModal
- `frontend/src/pages/console/index.tsx:3588-3674` — DeleteConfirmDialog
- `frontend/src/pages/console/index.tsx:3676-3778` — CloseConfirmDialog
- `frontend/src/pages/console/PaneConfigModal.tsx:210-497` — Radix Dialog pane config modal
- `frontend/src/pages/console/PaneWrapper.tsx:961-1136` — Replace Graphic inline modal
- `frontend/src/pages/console/index.tsx:3407-3430` — VersionRecoveryDialog (shared, delegated)
- `frontend/src/pages/console/index.tsx:3418-3429` — SaveConfirmDialog (shared, delegated)

**Visual properties actually applied:**
Backdrop (WorkspaceNameModal, DeleteConfirmDialog, CloseConfirmDialog):
- `position: fixed, inset: 0, background: rgba(0,0,0,0.5), display: flex, alignItems: center, justifyContent: center, zIndex: 9999`

Content box (WorkspaceNameModal, DeleteConfirmDialog, CloseConfirmDialog):
- `background: var(--io-surface), border: 1px solid var(--io-border), borderRadius: 8, padding: 20px 24px`
- WorkspaceNameModal: `minWidth: 360, gap: 12`
- DeleteConfirmDialog / CloseConfirmDialog: `minWidth: 340, gap: 12`

PaneConfigModal (Radix Dialog):
- Overlay: `position: fixed, inset: 0, background: rgba(0,0,0,0.55), zIndex: 1000`
- Content: `position: fixed, top: 50%, left: 50%, transform: translate(-50%, -50%), zIndex: 1001, background: var(--io-surface), border: 1px solid var(--io-border), borderRadius: 8, padding: 24, width: 480, maxWidth: calc(100vw - 32px), maxHeight: calc(100vh - 64px), overflowY: auto, gap: 20`

Replace Graphic dialog (PaneWrapper inline):
- Backdrop: `position: fixed, inset: 0, zIndex: 4000, background: rgba(0,0,0,0.6)`
- Content: `width: 480, maxHeight: 80vh, background: var(--io-surface-elevated), border: 1px solid var(--io-border), borderRadius: 8, boxShadow: 0 16px 48px rgba(0,0,0,0.5)`
- Header: `padding: 14px 16px, borderBottom: 1px solid var(--io-border)`
- Search row: `padding: 10px 16px, borderBottom: 1px solid var(--io-border)`
- List items: `padding: 8px 16px, border: none, background: transparent (default) / color-mix(in srgb, var(--io-accent) 12%, transparent) (current)`, `fontSize: 13, color: var(--io-text-primary)`

Button rows in inline modals:
- Cancel: `padding: 5px 14px, background: transparent, border: 1px solid var(--io-border), borderRadius: 4, color: var(--io-text-muted), fontSize: 12`
- Save / Create / Rename: `padding: 5px 14px, background: var(--io-accent), border: none, borderRadius: 4, color: #fff, fontSize: 12`
- Delete (DeleteConfirmDialog): `background: var(--io-danger), border: none, borderRadius: 4, color: #fff`

VersionRecoveryDialog and SaveConfirmDialog: delegated to `shared/components/versioning/`; no Console-specific styles applied.

**Deviations from app shell:**
- `borderRadius: 8` used by all Console-owned modals vs `--io-modal-radius: var(--io-radius-lg)` = 9px defined in `index.css:140`.
- `background: var(--io-surface)` used by WorkspaceNameModal, DeleteConfirmDialog, CloseConfirmDialog, and PaneConfigModal vs `--io-modal-bg: var(--io-surface-elevated)` defined in `index.css:138`. Replace Graphic dialog correctly uses `var(--io-surface-elevated)`.
- None of the 3 modal tokens (`--io-modal-bg`, `--io-modal-backdrop`, `--io-modal-radius`) are referenced in Console modal code.
- Z-index values are inconsistent: inline modals use `9999`, PaneConfigModal uses `1001`, Replace Graphic dialog uses `4000`. App-shell defines `--io-z-modal: 300`.
- Modal button `borderRadius: 4` — inconsistent with `borderRadius: 6` used on toolbar and content-area buttons.
- `var(--io-text)` used for dialog titles in WorkspaceNameModal, DeleteConfirmDialog, CloseConfirmDialog — undefined token.

**Notes:**
- WorkspaceNameModal, DeleteConfirmDialog, CloseConfirmDialog do not use Radix Dialog, `aria-modal`, or `role="dialog"` — no ARIA semantics for screen readers.
- VersionRecoveryDialog and SaveConfirmDialog are shared versioning components; they are not Console-specific and are not styled by Console code.
