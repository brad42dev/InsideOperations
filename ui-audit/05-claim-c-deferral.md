# Claim C Deferral Record

**Date:** 2026-05-27
**Status:** Deferred — do not work on during regression, Claim A, or Claim B workstreams

---

## Section 1 — Scope of Deferral

Claim C is the innermost of three concentric rectangles in the working architecture model: the canvas and work-surface layer where rendering happens. This deferral covers:

- **`SceneRenderer`** and directly related shared rendering files — the graphics rendering engine consumed inside Console panes to render SVG display elements, alarm states, and LOD visibility
- **Shared graphics CSS infrastructure** — four files in `frontend/src/shared/graphics/` and `frontend/src/shared/clipboard/selection/`:
  - `selection.css` — CSS selection-box outline and glow applied to `.io-selection-overlay` children via `data-indicator` attribute
  - `alarmFlash.css` — CSS `@keyframes` alarm flash animations applied by SceneRenderer to SVG symbol instance wrappers
  - `operationalState.css` — ISA-101 operational state classes with intentionally hardcoded colors applied by SceneRenderer
  - `lod.css` — Level-of-Detail visibility rules applied via `lod-0` through `lod-3` classes on the canvas container
- **`WorkspaceGrid.tsx`** (Console) — the react-grid-layout tile dashboard container; the work-surface shell for Console panes
- **`DesignerCanvas.tsx`** (Designer) — the 12,067-line SVG editor with FSM interaction model (`interactionRef` Mode B); the work-surface for Designer

The recommendations doc (04-recommendations.md, Category 10) confirms this distinction:

> "Module-specific canvas containers are correct and should not be merged. Shared graphics infrastructure should be the focus."
> "The shared rendering engine exists and should be maintained. The work-surface container is intentionally module-specific."

**Architectural distinction to preserve:** The shared rendering layer (SceneRenderer, the four CSS files) is already correctly shared and is not being changed. The module-specific container layer (WorkspaceGrid, DesignerCanvas) serves fundamentally different work modes — a grid-layout tile dashboard vs. a 12,067-line SVG editor with FSM interactions — and merging them would introduce false coupling. Both layers are deferred, for different reasons: the shared layer because it already works correctly and its remaining imperfections depend on middle-rectangle work settling first; the container layer because convergence is architecturally incorrect.

---

## Section 2 — Rationale for Deferral

**First: Claim A and Claim B work will surface new requirements on the canvas layer.** Claim A (token registry, app shell uniformity) and Claim B (shared style constants, shared primitives: `FieldLabel`, `StatusBadge`, `Dialog`) will establish the token graph and the component surface that the canvas layer depends on. The Cat 10 imperfections in `WorkspaceGrid` and `DesignerCanvas` are mostly undefined-token references (e.g., `var(--io-bg)`, `var(--io-error)`) and hardcoded hex values — once Phase 1 token work lands, several of these resolve automatically via alias. Doing Claim C work before those aliases exist would require a second pass through the same files after Claim A lands.

**Second: The seam between the rendering layer and module-specific containers will look different after middle-rectangle convergence.** The known imperfections in the canvas layer (canvas border token, resize handle color, guide line colors, DesignerCanvas context-menu token references) sit precisely at the junction between the rendering engine and the module-specific container. The middle-rectangle work (Claim B component promotion, dialog standardization, button and input constant files) will clarify which conventions cross that boundary and which remain local. Fixing the seam now means fixing it against a convention that is still in flux.

**Third: The user's stated priority is uniformity in the outer and middle rectangles, not the canvas layer.** The outer rectangle (Claim A: token registry, sidebar, routing, theme) and the middle rectangle (Claim B: shared style constants and a small set of promoted components) are where inconsistency is most visible and most impactful across all three modules. The canvas layer's imperfections are largely invisible in normal use (dark theme only, undefined tokens that fall back gracefully) or are contained to their module. The regression exceptions (see Section 4) are bugs and are handled separately.

---

## Section 3 — Known Imperfections to Revisit

Every concern from `04-recommendations.md` that touches the canvas or work-surface layer, in priority order. Fixes are not proposed here; this is a forward-looking inventory only.

### 3.1 `alarmFlash.css` — hardcoded alarm hex colors

**What:** Ten keyframe animations hardcode alarm colors as hex literals (`#ef4444`, `#f97316`, `#eab308`, `#f4f4f5`, `#60a5fa`). Values happen to match dark-theme token values but do not adapt to light or HPHMI themes.

**Where:** `frontend/src/shared/graphics/alarmFlash.css:1-149` (Cat 8 primary, Cat 10 secondary in 02-comparison.md).

**Category:** Functional (breaks theme adaptation for light/HPHMI themes; dark-theme output is currently correct).

---

### 3.2 Console `WorkspaceGrid` — undefined `var(--io-bg)` token

**What:** The grid container background inherits `var(--io-bg)`, which is undefined. The Cat 1 Phase 1 token work will add `--io-bg` as an alias for `--io-surface-primary`, at which point this resolves automatically without touching `WorkspaceGrid.tsx`.

**Where:** `WorkspaceGrid.tsx` container (Cat 10, Console Deviations in 02-comparison.md).

**Category:** Cosmetic (falls back to transparent/inherited background; no visible breakage in current dark theme).

---

### 3.3 DesignerCanvas — canvas border hardcoded rgba

**What:** The canvas border is `rgba(255,255,255,0.08)` hardcoded. Should use a token or `var(--io-border)` with opacity.

**Where:** `DesignerCanvas.tsx:7452–12067` outer container (Cat 10, Designer Deviations in 02-comparison.md).

**Category:** Cosmetic (border is subtle; dark-theme output is acceptable; light theme would be incorrect).

---

### 3.4 DesignerCanvas — resize handles `fill="white"`

**What:** SVG resize handles use `fill="white"` hardcoded. Should use `fill="var(--io-text-inverse)"` for theme-correctness.

**Where:** `DesignerCanvas.tsx` resize handle elements (Cat 10, Designer Deviations in 02-comparison.md).

**Category:** Cosmetic (dark-theme output correct; light theme would render white handles on white background).

---

### 3.5 DesignerCanvas — `--io-error` undefined token references

**What:** Context menu destructive item references `--io-error`, which is not defined. The correct token is `--io-danger`. The Cat 1 Phase 1 token work will add `--io-error` as an alias for `--io-danger`, resolving this automatically.

**Where:** `DesignerCanvas.tsx` context menu (Cat 10, Designer Deviations in 02-comparison.md; also Cat 11).

**Category:** Cosmetic (falls back to browser default or uncolored text; danger labeling is lost but not invisible).

---

### 3.6 DesignerCanvas — guide line colors hardcoded rgba

**What:** Guide lines use `rgba(0,200,255,0.5)` (blue) and `rgba(255,160,0,0.5)` (orange) hardcoded. 04-recommendations.md notes these as "low priority, canvas-only; acceptable as-is if guide colors are intentional design choices."

**Where:** `DesignerCanvas.tsx` guide line rendering (Cat 10, Designer Deviations in 02-comparison.md).

**Category:** Cosmetic (intentional design palette; does not affect theme correctness materially).

---

### 3.7 DesignerCanvas — grid lines fully hardcoded rgba

**What:** Canvas grid lines use `rgba(128,128,128,0.12)` and `rgba(128,128,128,0.28)` hardcoded for normal and emphasis lines. No token equivalent.

**Where:** `DesignerCanvas.tsx` grid line rendering (Cat 10, Designer Deviations in 02-comparison.md).

**Category:** Cosmetic (acceptable as-is per the recommendations; neutral gray values work in both dark and moderate-light contexts).

---

### 3.8 DesignerCanvas — "Paste as…" submenu items always disabled

**What:** The "Paste as table" and "Paste as temporary-graphic" submenu items in the canvas context menu always render in a disabled state, regardless of clipboard contents.

**Where:** `DesignerCanvas.tsx` context menu (Cat 10 Notes in 02-comparison.md; 04-recommendations.md notes it as "separate bug, out of scope for UI consistency work but worth a task file").

**Category:** Functional (user-facing interaction bug; context menu items are always inaccessible).

---

## Section 4 — Exclusion List for the Next Workstreams

The following files and scopes are **off-limits** during the regression workstream, Claim A workstream, and Claim B workstream because they belong to Claim C.

### Files — do not touch

| File | Path | Reason |
|------|------|--------|
| SceneRenderer | `frontend/src/shared/graphics/SceneRenderer.tsx` (and directly related files) | Core of the shared rendering engine; no pending Claim A/B actions |
| `alarmFlash.css` | `frontend/src/shared/graphics/alarmFlash.css` | Claim C imperfection; token migration is a Claim C action |
| `operationalState.css` | `frontend/src/shared/graphics/operationalState.css` | Intentional ISA-101 exception; documented do-not-touch |
| `lod.css` | `frontend/src/shared/graphics/lod.css` | No deviations; structural-only; Claim C exclusively |
| `WorkspaceGrid.tsx` | `frontend/src/console/WorkspaceGrid.tsx` (and `WorkspaceGrid.css`) | Module-specific container; Claim C scope |
| `DesignerCanvas.tsx` | `frontend/src/designer/DesignerCanvas.tsx` | Module-specific container; high-risk 12,067-line file; Claim C scope |

### Audit categories — do not introduce new changes

- **Category 10 entries in `02-comparison.md`** — all module-level and shared-infrastructure entries in Cat 10 are Claim C scope. The comparison file should not be updated with new Cat 10 findings or resolutions until Claim C is opened.

### Important exception — regression fixes are NOT deferred

Two functional regressions identified in `04-recommendations.md` touch files in the Claim C layer but are explicitly **not deferred**. They are bugs to fix during the regression workstream:

1. **`var(--accent)` prefix bug** (`selection.css` + `MarqueeLayer.tsx`): `var(--accent)` → `var(--io-accent)` in two files; `rgba(80,180,255,0.08)` → `var(--io-accent-subtle)` in `MarqueeLayer.tsx`. The selection highlight is currently invisible. This is a two-line fix with outsized impact. Although `selection.css` lives in the Claim C layer, the regression itself is a defect, not a Claim C architectural action. Fix it now; do not let this deferral block the regression workstream.

2. **`OpcSources StatusBadge` hex-alpha concat bug**: `${color}20` string concatenation produces malformed color values. Fix via `color-mix(in srgb, ${color} 12%, transparent)` or early migration to `shared/components/StatusBadge`. This bug lives in Settings, not the canvas layer, but is listed here for completeness because it appears alongside the selection regression in the Phase 2 regression list.

---

## Section 5 — Trigger Conditions for Revisiting Claim C

Claim C work should be reopened when all of the following conditions are met:

1. **Claim A workstream complete** — including its check-in review. The `index.css` token registry has been updated with all missing tokens (`--io-bg`, `--io-text`, `--io-surface-hover`, `--io-font-sans`, `--io-text-on-accent`, `--io-error`, `--io-alarm-inactive`, `--io-text-inverse`). All three modules consume the canonical token set without undefined references.

2. **Claim B workstream complete** — including its check-in review. `shared/styles/buttons.ts` and `shared/styles/inputs.ts` exist. `shared/components/FieldLabel.tsx`, `shared/components/StatusBadge.tsx`, and `shared/components/Dialog.tsx` are promoted and in use. The middle-rectangle convergence is stable.

3. **`04-recommendations.md` and `02-comparison.md` updated** to reflect what landed in Claim A and Claim B. The imperfections resolved automatically (via token aliases) should be noted as closed. The remaining open items in Cat 10 should be the confirmed scope of Claim C work.

Once these conditions are met, reopen Claim C with the goal of: fixing the `alarmFlash.css` token migration (functional for light/HPHMI theme support), resolving remaining DesignerCanvas hardcoded values (canvas border, resize handles, guide lines) in a single minimally-invasive pass through that file, filing a task for the "Paste as…" submenu bug, and aligning the rendering-layer UX with the converged outer-and-middle-rectangle UX.
