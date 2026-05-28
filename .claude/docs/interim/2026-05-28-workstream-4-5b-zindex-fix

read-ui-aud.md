---
id: 2026-05-28-workstream-4-5b-zindex-fix
title: DesignerCanvas Z-Index Token Remap
status: interim
created: 2026-05-28
last_updated: 2026-05-28
last_synced_with_code: 2026-05-28
work_units:
  - 2026-05-28_workstream-4-5b-zindex-fix

read-ui-audi_064832
implementation:
  - frontend/src/index.css
  - frontend/src/pages/designer/DesignerCanvas.tsx
  - ui-audit/11-zindex-assessment.md
related:
  - 2026-05-28-workstream-4-5a-zindex-assessment
---

# DesignerCanvas Z-Index Token Remap

Migrated all 19 hardcoded z-index values in `DesignerCanvas.tsx` to CSS custom property tokens, and added two new tokens (`--io-z-canvas-overlay: 600`, `--io-z-priority-modal: 1050`) to the permanent design system scale in `index.css` across all three themes.

## Purpose

Eliminates hardcoded z-index integers from the canvas, making stacking order auditable and refactorable via the token scale. Resolves the direct conflict between canvas badge overlays (formerly at 1000) and `ConfirmDialog` (also at 1000) by separating them into distinct scale tiers.

## Behavior

The 19 z-index assignments in `DesignerCanvas.tsx` are now grouped into four semantic tiers:

- **Tier A — canvas chrome** (10 elements): guides, rulers, tooltips, selection overlay, inline editor. All preserve their original integer values via `var(--io-z-panel)` and `calc()` offsets.
- **Tier B — canvas annotation overlays** (3 elements, lines 8038, 9917, 10271): context menu badge, ruler tooltip, and context menu content. Moved from 1000 → `var(--io-z-canvas-overlay)` = 600. These no longer compete with modal dialogs.
- **Tier C — canvas dialogs and HUD** (4 elements): two blocking dialog backdrops (lines 332, 8621) and slot assignment popover (line 9426) moved to `var(--io-z-modal)` = 1000; canvas bottom toolbar HUD (line 9605) moved to `var(--io-z-dropdown)` = 500.
- **Tier D — capture overlays**: point picker (line 8928) uses `var(--io-z-emergency)` = 3000 (value unchanged); drag cursor (line 3750) remains hardcoded 9999 as a documented exception.

`ConfirmDialog.tsx` was not modified in this workstream. Its follow-on migration to `--io-z-priority-modal` (1050) is a separate one-line change.

Seven remaps change observable stacking and require visual spot-checks: lines 8038, 9917, 10271, 9426 (HIGH), 9605 (HIGH — dialogs now cover the canvas HUD), 332, 8621 (MEDIUM).

## Implementation Notes

**New tokens in `index.css`** (added to all three theme blocks: `:root`/dark, `[data-theme="light"]`, `[data-theme="hphmi"]`):
- `--io-z-canvas-overlay: 600` — between `--io-z-dropdown` (500) and `--io-z-modal` (1000); for canvas-internal badge/tooltip overlays that must float above canvas chrome but never compete with app dialogs.
- `--io-z-priority-modal: 1050` — between `--io-z-modal` (1000) and `--io-z-command` (1200); reserved for app-level confirmation dialogs (ConfirmDialog) that must always beat canvas-spawned dialogs at `--io-z-modal`. No consumers yet.

**Hardcoded exception at line 3750**: The drag cursor ghost stays at `z-index:9999` with an inline comment documenting it as an intentional, deliberate exception — a `pointer-events:none` transient indicator that must sit above all UI including emergency overlays.

**TypeScript compatibility**: All `zIndex: "var(...)"` string assignments in HTML element style objects are accepted by `React.CSSProperties` natively. The one SVG-element assignment at line 7686 carries `as React.CSSProperties` cast as previously required. Style objects at lines 9914 and 10268 are on HTML elements (`<div>` / `React.CSSProperties`-typed objects), so no additional casts are needed there.

**Lines 332 and 8621** both land at `var(--io-z-modal)` = 1000 after remap. These two canvas-spawned blocking dialogs are designed to never render simultaneously; their relative stacking (if they ever co-render) would fall back to DOM order.

**Open follow-ons**:
- ConfirmDialog.tsx migration to `--io-z-priority-modal` still pending
- Visual spot-check on line 9605 (toolbar HUD now covered by dialogs) not yet performed

## Changelog

### 2026-05-28
Post-implementation review completed. Deep review identified three concerns: (1) TypeScript cast consistency on SVG-context style objects — confirmed non-issue, lines 9914 and 10268 are HTML elements; `pnpm tsc --noEmit` run to verify. (2) Visual spot-check for line 9605 toolbar HUD behavior change still pending. (3) Implicit invariant that lines 332 and 8621 never coexist at `--io-z-modal` is undocumented in code. Shallow review on final state confirmed no concerns with the diff. No additional code changes were made during wrapup.

### 2026-05-28
Initial creation. Documents the full z-index remap of `DesignerCanvas.tsx`: 2 new tokens added to `index.css`, 18 hardcoded values remapped to tokens, 1 hardcoded value (9999) retained with exception comment, `ui-audit/11-zindex-assessment.md` marked COMPLETE.
SessionEnd hook [${CLAUDE_PROJECT_DIR}/.claude/hooks/session-end.sh] failed: /bin/sh: 1: /home/io/io-dev/io/frontend/.claude/hooks/session-end.sh: not found
