# Z-Index Assessment — DesignerCanvas Token Remap

**Date:** 2026-05-28  
**Status:** COMPLETE — all 19 remaps applied 2026-05-28. Two new tokens added to permanent scale.  
**Sources:** `ui-audit/00-preflight-facts.md §2`, `frontend/src/index.css:207–218`

---

## Permanent Token Scale (reference)

| Token | Value | Added |
|-------|-------|-------|
| `--io-z-base` | 0 | original |
| `--io-z-panel` | 10 | original |
| `--io-z-sidebar` | 100 | original |
| `--io-z-topbar` | 100 | original |
| `--io-z-edge-hover` | 150 | original |
| `--io-z-dropdown` | 500 | original |
| `--io-z-canvas-overlay` | 600 | **2026-05-28** — canvas-internal badge/tooltip overlays; above dropdowns, below modals |
| `--io-z-modal` | 1000 | original |
| `--io-z-priority-modal` | 1050 | **2026-05-28** — app-level confirmation dialogs (ConfirmDialog); guaranteed above canvas dialogs at --io-z-modal |
| `--io-z-command` | 1200 | original |
| `--io-z-visual-lock` | 1500 | original |
| `--io-z-kiosk-auth` | 1800 | original |
| `--io-z-toast` | 2000 | original |
| `--io-z-emergency` | 3000 | original |

---

## Part One — Tier Classification

### Tier A: Base canvas chrome (10 elements)

Elements that only need to stack correctly within the canvas's own stacking context. Their z-values compete only against each other inside the canvas div hierarchy, not globally. All are below 100.

| Line | Value | Element | Rationale |
|------|-------|---------|-----------|
| 7689 | -1 | SVG guide/grid line | Intentionally below canvas surface; background grid that must not interfere with any canvas element |
| 7994 | 10 | Canvas container overlay div | Base layer of canvas chrome; the lowest overlay inside the canvas |
| 8222 | 10 | Element tooltip | Inline hover tooltip on canvas elements; canvas-internal, small, transient |
| 8302 | 15 | Selection highlight overlay | Thin inset overlay drawn on selected elements; above element but below editing chrome |
| 8377 | 20 | Inline text editor | In-place text edit overlay; must be above selection highlight during editing |
| 9792 | 10 | Ruler bar (top) | Canvas chrome — ruler drawn at top edge |
| 9814 | 10 | Ruler bar (left) | Canvas chrome — ruler drawn at left edge |
| 9837 | 11 | Ruler corner tile | Sits just above the two ruler bars at their intersection; covers seam |
| 9863 | 9 | Vertical guide drag handle | Guide handle must be draggable; sits just below rulers so rulers draw on top |
| 9876 | 9 | Horizontal guide drag handle | Same — just below rulers |

These ten elements establish the relative stacking order: guides (9) < canvas content (10) ≈ rulers (10) < corner (11) < selection (15) < text editor (20). This ordering is internally consistent and must be preserved.

---

### Tier B: Canvas-spawned badge/overlay elements (3 elements)

Three elements at exactly z=1000 — the same value as `--io-z-modal` / ConfirmDialog. All are described as "canvas-internal overlay/badge" or "tooltip/inline overlay" with `fontSize:12, overflow:hidden`. These are small annotation or data overlays pinned to canvas elements. They are NOT dialog-level UI. Their presence at 1000 is the direct cause of the ConfirmDialog stacking tie.

| Line | Value | Element | Rationale |
|------|-------|---------|-----------|
| 8038 | 1000 | Canvas-internal overlay/badge | Small badge annotation on a canvas element; canvas-internal, non-blocking |
| 9917 | 1000 | Tooltip/inline overlay | Same pattern — canvas data annotation overlay |
| 10271 | 1000 | Tooltip/inline overlay | Same pattern — canvas data annotation overlay |

These are semantically sub-modal. They are annotations that float above the canvas but should never compete with app-level confirmation dialogs. ConfirmDialog must always win against these.

---

### Tier C: Canvas-spawned dialogs and popovers (5 elements)

Elements that are `position:fixed` or floating above canvas content with dialog/popover semantics. These are the canvas's own "modal layer" — UI that the canvas spawns to handle configuration, assignment, or status display.

| Line | Value | Element | Rationale |
|------|-------|---------|-----------|
| 8621 | 1200 | Fixed full-screen dialog backdrop | Canvas-spawned blocking dialog; position:fixed, rgba(0,0,0,0.55) scrim |
| 332 | 2000 | Fixed full-screen modal backdrop | A second canvas-spawned blocking modal, higher priority than 8621 — appears on top of it |
| 9426 | 2000 | Slot assignment popover | Non-scrim floating popover for slot assignment; elevated surface background |
| 9605 | 2000 | Canvas bottom status/toolbar overlay | Persistent floating HUD at canvas bottom; centered via transform:translateX(-50%) |

**Note on the two fixed backdrops (332 and 8621):** These are two separate canvas-spawned dialogs. The ordering (8621 at 1200, 332 at 2000) implies 332's dialog sits on top of 8621's dialog when both render — a layered dialog pattern. By design, only one is visible at a time. Their exact z-ordering relative to each other is an internal canvas concern.

**Note on 9605 (canvas toolbar HUD):** Though it uses z=2000 (matching the toast layer), it is persistent canvas chrome — not a toast or dialog. Its high value ensures it renders above canvas elements and any canvas badge overlays. Semantically it belongs closer to the dropdown layer (floating UI above content, not above modals).

---

### Tier D: Full-screen capture overlays (2 elements)

Elements that intentionally take over the entire screen for a capture interaction. Must appear above everything else including canvas dialogs.

| Line | Value | Element | Rationale |
|------|-------|---------|-----------|
| 8928 | 3000 | Point picker full-screen overlay | Full-screen crosshair mode for selecting a data point; must be above all canvas UI |
| 3750 | 9999 | Drag-cursor overlay | Transient drag tracking cursor; `pointer-events:none`; must be above all UI including emergency overlays |

---

## Part Two — Proposed Token Mapping

### Tier A: Base canvas chrome → `--io-z-panel` and calc offsets

All Tier A elements preserve their exact integer values; they merely adopt tokens. The calc offsets maintain the same stacking order.

| Line | Current | Proposed | Computed value | Preserves order? |
|------|---------|---------|---------------|-----------------|
| 7689 | -1 | `calc(var(--io-z-base) - 1)` | -1 | Yes |
| 7994 | 10 | `var(--io-z-panel)` | 10 | Yes |
| 8222 | 10 | `var(--io-z-panel)` | 10 | Yes |
| 8302 | 15 | `calc(var(--io-z-panel) + 5)` | 15 | Yes |
| 8377 | 20 | `calc(var(--io-z-panel) + 10)` | 20 | Yes |
| 9792 | 10 | `var(--io-z-panel)` | 10 | Yes |
| 9814 | 10 | `var(--io-z-panel)` | 10 | Yes |
| 9837 | 11 | `calc(var(--io-z-panel) + 1)` | 11 | Yes |
| 9863 | 9 | `calc(var(--io-z-panel) - 1)` | 9 | Yes |
| 9876 | 9 | `calc(var(--io-z-panel) - 1)` | 9 | Yes |

### Tier B: Canvas badge/overlay → `--io-z-dropdown` (500)

These three elements at 1000 must move below `--io-z-modal` to resolve the ConfirmDialog ties. `--io-z-dropdown` (500) is the correct tier: above canvas chrome (sub-20), above app sidebars/topbars (100), but clearly below any modal dialog.

**Key question:** should these sit at `--io-z-dropdown` (500) or closer to modal (e.g., 999)?

Recommendation: `var(--io-z-dropdown)` = 500. Using 500 creates unambiguous separation from the modal layer. Using a calc like `calc(var(--io-z-modal) - 1)` = 999 would maintain proximity to the modal layer with no semantic justification — these are badge overlays, not near-modal UI. The full 500-point gap makes intent legible.

**See Scale Gap #1** — the scale has no named token between dropdown (500) and modal (1000) for canvas-internal floating content. These elements would be the first users of such a token if one were added.

| Line | Current | Proposed | Computed value |
|------|---------|---------|---------------|
| 8038 | 1000 | `var(--io-z-dropdown)` | 500 |
| 9917 | 1000 | `var(--io-z-dropdown)` | 500 |
| 10271 | 1000 | `var(--io-z-dropdown)` | 500 |

### Tier C: Canvas dialogs and popovers

This tier contains the most complex decisions because two canvas "dialogs" are currently above ConfirmDialog, and moving them to `--io-z-modal` creates ties that depend on DOM order.

**Core principle:** Canvas-spawned dialogs are functionally equivalent to app modals. They should use `--io-z-modal` (1000). ConfirmDialog also uses `--io-z-modal` (1000). If ConfirmDialog renders via `createPortal` to `document.body`, it is appended later in the DOM than canvas dialogs and wins the tie. This is fragile but workable — see **Scale Gap #3** for the clean fix.

| Line | Current | Proposed | Computed value | Notes |
|------|---------|---------|---------------|-------|
| 8621 | 1200 | `var(--io-z-modal)` | 1000 | Fixed dialog backdrop. Currently at `--io-z-command` level (accidental match). Moves down 200. |
| 332 | 2000 | `var(--io-z-modal)` | 1000 | Fixed modal backdrop (higher-priority canvas dialog). Moves down 1000. Both canvas dialogs now share the modal layer. |
| 9426 | 2000 | `var(--io-z-modal)` | 1000 | Slot assignment popover. Moves down 1000. Popover should be modal-level (it overlays canvas interaction). |
| 9605 | 2000 | `var(--io-z-dropdown)` | 500 | Canvas bottom toolbar HUD. This is persistent chrome, not a dialog — belongs at dropdown level. Dialogs (1000) will correctly obscure it when open. |

**On the two canvas backdrops (332 and 8621) sharing z=1000 after remap:** These two dialogs should never be simultaneously visible by design (one is shown at a time). Their internal ordering (which one the user sees "on top") can be managed by DOM order if they ever overlap. If the canvas always unmounts one before mounting the other, z-ordering between them is moot.

### Tier D: Capture overlays

| Line | Current | Proposed | Computed value | Notes |
|------|---------|---------|---------------|-------|
| 8928 | 3000 | `var(--io-z-emergency)` | 3000 | No numeric change. Point picker legitimately uses the emergency layer — it is a full-screen mode capture. |
| 3750 | 9999 | **Scale gap — see Scale Gap #2** | 9999 | Drag cursor exceeds the scale ceiling. See below. |

---

## Part Three — Scale Gaps Flagged for Decision

### Gap #1: No named token for canvas-internal floating overlays

**Situation:** The three Tier B elements (badge/tooltip overlays at lines 8038, 9917, 10271) need to sit above canvas chrome (sub-20) and app topbars/sidebars (100) but below modal dialogs (1000). The nearest available tokens are `--io-z-dropdown` (500) and `--io-z-modal` (1000).

**Problem:** `--io-z-dropdown` is semantically for UI dropdowns (autocomplete menus, select lists, comboboxes). Canvas annotation badges are a distinct category. Using `var(--io-z-dropdown)` works numerically but conflates canvas chrome with interactive dropdowns.

**Decision needed:** Should a named `--io-z-canvas-overlay` token (e.g., 600) be added to the permanent scale, or is using `--io-z-dropdown` acceptable? A new token affects the eight-module rebuild — all modules would inherit it and potentially need to verify nothing breaks.

**Proposed token if added:** `--io-z-canvas-overlay: 600` — sits above dropdowns (500) and below modals (1000), clearly named for canvas-internal floating content.

---

### Gap #2: No token for above-emergency drag cursors (9999)

**Situation:** The drag cursor overlay (line 3750) is at z=9999, which exceeds the scale ceiling of `--io-z-emergency` (3000). The cursor must appear above everything including emergency overlays (`--io-z-emergency` is for kiosk/security-mode lockouts) because it is a transient visual indicator with `pointer-events:none` — it must never be obscured.

**Problem:** Moving the drag cursor to `var(--io-z-emergency)` = 3000 would make it visually tied with emergency overlays. If an emergency overlay ever renders while a drag is in progress, the cursor could be obscured. More importantly, the 9999 value signals "always on top" intent that the current scale cannot express.

**Decision needed:** One of:
1. Add `--io-z-drag-cursor: 9999` as a permanent, documented "always-on-top for `pointer-events:none` drag indicators" position.
2. Accept that `--io-z-emergency` (3000) is "high enough" — a drag operation and an emergency overlay cannot meaningfully overlap, and the visual difference between 3000 and 9999 is zero in practice.
3. Keep the drag cursor as a documented hardcoded exception at 9999 — it is `pointer-events:none` and fully transient; the exception is narrow and safe.

A new token affects all eight modules. Option 3 (documented hardcoded exception) is the lowest-risk path.

---

### Gap #3: No "priority modal" position between --io-z-modal and --io-z-command

**Situation:** ConfirmDialog is at `--io-z-modal` (1000). Canvas-spawned blocking dialogs should also be at `--io-z-modal` after remap. When ConfirmDialog fires while a canvas dialog is open, both are at 1000 and DOM order determines which appears on top. ConfirmDialog wins only if it is appended to the DOM after the canvas dialog — which is true if it uses `createPortal(el, document.body)`, but is an implicit assumption.

**Problem:** Relying on DOM insertion order for modal priority is fragile. If any future refactor changes portal ordering, ConfirmDialog could silently appear behind canvas dialogs.

**Decision needed:** One of:
1. Add `--io-z-priority-modal: 1050` (or similar, between modal and command) for ConfirmDialog and other app-level confirmation overlays that must always win. Canvas dialogs stay at `--io-z-modal` (1000).
2. Accept the DOM-order dependency — verify ConfirmDialog uses `createPortal` and document the invariant.
3. Move ConfirmDialog to `--io-z-command` (1200). `--io-z-command` is named for the command palette, but in practice ConfirmDialog and the command palette should not overlap; numeric reuse is acceptable. Canvas dialogs at `--io-z-modal` (1000) would then always be below ConfirmDialog.

Option 3 (ConfirmDialog at `--io-z-command`) is the cleanest immediate fix if the DOM-order dependency is undesirable.

---

## Part Four — Risk Assessment Per Remap

| Line | Current | Proposed token | Computed | Risk | Why |
|------|---------|---------------|---------|------|-----|
| 7689 | -1 | `calc(var(--io-z-base) - 1)` | -1 | LOW | Value unchanged; canvas-internal only |
| 7994 | 10 | `var(--io-z-panel)` | 10 | LOW | Value unchanged; canvas-internal only |
| 8222 | 10 | `var(--io-z-panel)` | 10 | LOW | Value unchanged; canvas-internal only |
| 8302 | 15 | `calc(var(--io-z-panel) + 5)` | 15 | LOW | Value unchanged; canvas-internal only |
| 8377 | 20 | `calc(var(--io-z-panel) + 10)` | 20 | LOW | Value unchanged; canvas-internal only |
| 9792 | 10 | `var(--io-z-panel)` | 10 | LOW | Value unchanged; canvas-internal only |
| 9814 | 10 | `var(--io-z-panel)` | 10 | LOW | Value unchanged; canvas-internal only |
| 9837 | 11 | `calc(var(--io-z-panel) + 1)` | 11 | LOW | Value unchanged; canvas-internal only |
| 9863 | 9 | `calc(var(--io-z-panel) - 1)` | 9 | LOW | Value unchanged; canvas-internal only |
| 9876 | 9 | `calc(var(--io-z-panel) - 1)` | 9 | LOW | Value unchanged; canvas-internal only |
| 8928 | 3000 | `var(--io-z-emergency)` | 3000 | LOW | Value unchanged; point picker already at emergency layer |
| 8038 | 1000 | `var(--io-z-dropdown)` | 500 | **HIGH** | Canvas badge moves from modal layer to dropdown layer. If ConfirmDialog and this badge render simultaneously, ConfirmDialog now wins. This is the desired fix — but the change in stacking is observable and must be spot-checked. |
| 9917 | 1000 | `var(--io-z-dropdown)` | 500 | **HIGH** | Same as 8038. |
| 10271 | 1000 | `var(--io-z-dropdown)` | 500 | **HIGH** | Same as 8038. |
| 9605 | 2000 | `var(--io-z-dropdown)` | 500 | **HIGH** | Canvas toolbar HUD moves from toast layer (2000) to dropdown layer (500). Any dialog (1000) will now visually obscure the toolbar. This is intended behavior (dialogs block the toolbar) but is a visible stacking change that must be verified. |
| 9426 | 2000 | `var(--io-z-modal)` | 1000 | **HIGH** | Slot assignment popover moves from toast layer (2000) to modal layer (1000). If a canvas blocking dialog (332 or 8621 at 1000) is simultaneously rendered, DOM order determines which wins. Verify these never coexist. |
| 332 | 2000 | `var(--io-z-modal)` | 1000 | MEDIUM | Canvas blocking modal backdrop moves from toast layer to modal layer. Currently it renders above ConfirmDialog (2000 > 1000); after remap, ConfirmDialog can render above it via DOM order. This is an intended fix — ConfirmDialog should win — but requires verifying portal ordering. |
| 8621 | 1200 | `var(--io-z-modal)` | 1000 | MEDIUM | Fixed dialog backdrop moves from command layer (1200) to modal layer (1000). This 200-point reduction is only observable if the command palette (also at 1200) and this canvas backdrop coexist — an extremely unlikely scenario. Verify that neither 332 nor 8621 renders simultaneously (they'd share z=1000 after remap). |
| 3750 | 9999 | Scale gap (no remap yet) | 9999 | FLAGGED | Cannot remap without scale decision. Drag cursor exceeds emergency (3000). Interim recommendation: keep at hardcoded 9999 with a comment until Scale Gap #2 is decided. |

---

## Part Five — Summary

### (a) Applied Remap Table

All 19 remaps applied 2026-05-28. Tier B elements use `--io-z-canvas-overlay` (user decision overrides assessment proposal of `--io-z-dropdown`). Line 3750 kept hardcoded with documented-exception comment.

| Line | Element | Was | Applied token | Computed | Risk | Applied |
|------|---------|-----|--------------|---------|------|---------|
| 332 | Fixed modal backdrop | 2000 | `var(--io-z-modal)` | 1000 | MEDIUM | 2026-05-28 |
| 3750 | Drag cursor overlay | 9999 | hardcoded 9999 + exception comment | 9999 | — | 2026-05-28 |
| 7689 | SVG guide/grid line | -1 | `calc(var(--io-z-base) - 1)` | -1 | LOW | 2026-05-28 |
| 7994 | Canvas container overlay | 10 | `var(--io-z-panel)` | 10 | LOW | 2026-05-28 |
| 8038 | Canvas badge/overlay | 1000 | `var(--io-z-canvas-overlay)` | 600 | **HIGH** | 2026-05-28 |
| 8222 | Element tooltip | 10 | `var(--io-z-panel)` | 10 | LOW | 2026-05-28 |
| 8302 | Selection highlight | 15 | `calc(var(--io-z-panel) + 5)` | 15 | LOW | 2026-05-28 |
| 8377 | Inline text editor | 20 | `calc(var(--io-z-panel) + 10)` | 20 | LOW | 2026-05-28 |
| 8621 | Fixed dialog backdrop | 1200 | `var(--io-z-modal)` | 1000 | MEDIUM | 2026-05-28 |
| 8928 | Point picker overlay | 3000 | `var(--io-z-emergency)` | 3000 | LOW | 2026-05-28 |
| 9426 | Slot assignment popover | 2000 | `var(--io-z-modal)` | 1000 | **HIGH** | 2026-05-28 |
| 9605 | Canvas bottom toolbar HUD | 2000 | `var(--io-z-dropdown)` | 500 | **HIGH** | 2026-05-28 |
| 9792 | Ruler bar (top) | 10 | `var(--io-z-panel)` | 10 | LOW | 2026-05-28 |
| 9814 | Ruler bar (left) | 10 | `var(--io-z-panel)` | 10 | LOW | 2026-05-28 |
| 9837 | Ruler corner tile | 11 | `calc(var(--io-z-panel) + 1)` | 11 | LOW | 2026-05-28 |
| 9863 | Vertical guide drag handle | 9 | `calc(var(--io-z-panel) - 1)` | 9 | LOW | 2026-05-28 |
| 9876 | Horizontal guide drag handle | 9 | `calc(var(--io-z-panel) - 1)` | 9 | LOW | 2026-05-28 |
| 9917 | Tooltip/inline overlay | 1000 | `var(--io-z-canvas-overlay)` | 600 | **HIGH** | 2026-05-28 |
| 10271 | Tooltip/inline overlay | 1000 | `var(--io-z-canvas-overlay)` | 600 | **HIGH** | 2026-05-28 |

### (b) Scale Gaps Requiring User Decision

| # | Gap | Impact | Options |
|---|-----|--------|---------|
| 1 | No token between `--io-z-dropdown` (500) and `--io-z-modal` (1000) for canvas annotation overlays | Tier B elements would use `--io-z-dropdown` (semantic mismatch) or an ad-hoc calc | Add `--io-z-canvas-overlay: 600`; or accept `--io-z-dropdown`; or keep hardcoded 500 with comment |
| 2 | Drag cursor at 9999 exceeds `--io-z-emergency` (3000) scale ceiling | Cannot adopt a token without exceeding the defined scale | Add `--io-z-drag-cursor: 9999`; or document 9999 as an explicit hardcoded exception; or lower to emergency (risk: may conflict if emergency overlay renders during drag) |
| 3 | No "priority modal" layer to guarantee ConfirmDialog beats canvas dialogs when both are at `--io-z-modal` | After remap, ConfirmDialog vs canvas dialog ordering depends on DOM insertion order (portal position) — fragile | Add `--io-z-priority-modal: 1050`; or move ConfirmDialog to `--io-z-command` (1200); or document DOM-order dependency and verify portal ordering |

### (c) Must-change vs. cleanup

**Must change — resolves ConfirmDialog ties:**
- Line 8038 (1000 → 500): canvas badge competing with ConfirmDialog at 1000
- Line 9917 (1000 → 500): same
- Line 10271 (1000 → 500): same

These three are the direct fix for the identified conflict. Moving them to 500 guarantees ConfirmDialog at 1000 always appears above canvas annotation overlays.

**Also required for correct modal layering (canvas dialogs above ConfirmDialog is a bug):**
- Line 332 (2000 → 1000): canvas blocking modal currently above ConfirmDialog
- Line 8621 (1200 → 1000): canvas dialog backdrop currently above ConfirmDialog
- Line 9426 (2000 → 1000): slot popover currently above ConfirmDialog
- Line 9605 (2000 → 500): canvas HUD currently at toast level — not a ConfirmDialog fix but a category correction

**Cleanup — token adoption with no behavior change:**
- Lines 7689, 7994, 8222, 8302, 8377, 9792, 9814, 9837, 9863, 9876: all preserve their exact integer values; remap is notation-only
- Line 8928 (3000 → `var(--io-z-emergency)`): value unchanged, pure token adoption

---

**19 values remapped 2026-05-28. 2 new tokens added to permanent scale (`--io-z-canvas-overlay: 600`, `--io-z-priority-modal: 1050`). ConfirmDialog.tsx NOT touched — its move to `--io-z-priority-modal` is a separate follow-on change.**  
`ui-audit/11-zindex-assessment.md`
