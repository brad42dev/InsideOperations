# Pre-Reconciliation Research — UI Audit

**Produced:** 2026-05-27  
**Inputs read:** 01-console.md, 01-designer.md, 01-settings.md, 02-comparison.md, 03-verification.md  
**Source code verified against:** index.css, selection.css, MarqueeLayer.tsx, alarmFlash.css, operationalState.css, lod.css  

---

## Section 1 — Upstream-Audit Matches

This section records every claim in the three per-module audit files that matches one of the six known false-positive patterns, plus additional claims of the form "X is undefined / unregistered / has no CSS rule" flagged by the broadened search.

### 1.1 Six Known Patterns

---

**Pattern 1 — `--io-space-*` claimed unregistered**

| Audit file | Category | Exact claim text | Verification status |
|---|---|---|---|
| 01-settings.md | Category 7.3 (BulkUpdate.tsx) | "The `--io-space-*` tokens appear in BulkUpdate and RestorePreviewModal only; if they are not registered they resolve to empty and collapse the spacing entirely. Worth verifying against `src/index.css`." | **FALSE.** `--io-space-0` through `--io-space-48` (17 tokens) are defined in `index.css:148-164`. Correction: 03-verification.md discrepancy #4. |

No matches in 01-console.md or 01-designer.md.

---

**Pattern 2 — `--io-info` claimed undefined**

| Audit file | Category | Exact claim text | Verification status |
|---|---|---|---|
| 01-settings.md | Category 8.4 (AuthProviders TypeBadge) | "`--io-info` is not in the 138-token registry; the fallback `#3b82f6` (Tailwind blue-500) applies in all cases." | **FALSE.** `--io-info: #3b82f6` is defined in `index.css:72`. Fallback value equals token value, so no visual regression, but claim of non-existence is wrong. Correction: 03-verification.md discrepancy #5. |

No matches in 01-console.md or 01-designer.md.

---

**Pattern 3 — `--io-input-bg` or `--io-input-border` claimed unregistered**

| Audit file | Category | Exact claim text | Verification status |
|---|---|---|---|
| 01-designer.md | Category 7 Deviation #2 (ShapePointSelector) | "`var(--io-input-bg)` and `var(--io-input-border)` in `ShapePointSelector` are not in the pass 1 token registry (138 tokens in `index.css`). If unregistered, inputs in ShapePointSelector have no background and no border." | **FALSE.** Both are defined: `--io-input-bg: var(--io-surface-sunken)` at `index.css:131`; `--io-input-border: var(--io-border)` at `index.css:132`. ShapePointSelector.tsx:366-367 uses them both correctly. Correction: 03-verification.md discrepancy #3. |

No matches in 01-console.md or 01-settings.md.

---

**Pattern 4 — `--io-modal-backdrop` claimed undefined**

Two locations in 01-settings.md:

| Audit file | Category | Exact claim text | Verification status |
|---|---|---|---|
| 01-settings.md | Category 11.2 (Overlay token inconsistency) | "Both `--io-modal-backdrop` and `--io-overlay` appear to be undefined tokens. No single standard backdrop token is used consistently." | **FALSE (for `--io-modal-backdrop`).** `--io-modal-backdrop: var(--io-surface-overlay)` is defined at `index.css:139`. `--io-overlay` is genuinely undefined (no `:root` definition). Correction: 03-verification.md discrepancy #8. |
| 01-settings.md | Cross-cutting section, "Pass 2 — Undefined tokens in active use" table | `--io-modal-backdrop` listed with note "No fallback; overlay becomes empty string if token absent" | **FALSE.** Same token is defined at `index.css:139`. Correction: same as above. |

No matches in 01-console.md or 01-designer.md.

Note: The Console audit (Category 11 Deviations) says "None of the 3 modal tokens (`--io-modal-bg`, `--io-modal-backdrop`, `--io-modal-radius`) are referenced in Console modal code" — this is a claim of *non-use*, not a claim that the token is undefined. Not a match for this pattern.

---

**Pattern 5 — `--io-surface` claimed undefined**

Two locations in 01-settings.md:

| Audit file | Category | Exact claim text | Verification status |
|---|---|---|---|
| 01-settings.md | Category 7.5 (Textarea and monospace field overrides) | "Certificates defines a standalone `textareaStyle` with `background: 'var(--io-surface)'` — not in the standard surface token set (`--io-surface-primary`, `--io-surface-secondary`, `--io-surface-elevated`, `--io-surface-sunken`). Likely resolves to undefined." | **FALSE.** `--io-surface: var(--io-surface-elevated)` is defined at `index.css:29`. It is an alias token, not one of the four named primaries, which is why the audit missed it. Correction: 03-verification.md discrepancy #11. |
| 01-settings.md | Category 11.3 (Modal content background inconsistency) | "`var(--io-surface)` is not in the named surface token set." (implied: resolves to undefined) | **FALSE.** Same definition as above. Correction: 03-verification.md discrepancy #11. |

No matches in 01-console.md or 01-designer.md.

Note: The Console and Designer audits reference `var(--io-surface)` throughout as a valid token without any claim of it being undefined. This pattern is specific to Settings where the audit author cross-checked against an enumerated list of primary surface tokens and missed the alias at index.css:29.

---

**Pattern 6 — `io-multiselect-active` claimed to have no CSS rule**

| Audit file | Category | Exact claim text | Verification status |
|---|---|---|---|
| 01-designer.md | Category 10 Notes | "The `io-multiselect-active` class is added to SVG when `selectedNodeIds.size > 1` but the class has no observable CSS rule — it appears to be a hook for future styling or external CSS." | **FALSE.** Rule exists at `index.css:904-909`: `svg.io-multiselect-active [data-node-id].io-selected { filter: drop-shadow(0 0 3px var(--io-accent)) drop-shadow(0 0 6px var(--io-accent)); }`. The class IS active and applies a teal drop-shadow to selected nodes during multiselect. Correction: 03-verification.md discrepancy #6. |

No matches in 01-console.md or 01-settings.md.

---

### 1.2 Broadened Search — Additional Flagged Candidates

The following claims in the audit files use hedged language ("may or may not," "potentially unregistered," "not enumerated in pass 1") about CSS custom properties or CSS classes, raising the same concern as the six known patterns. These are NOT already covered by 03-verification.md.

All are in 01-designer.md. Code checks against index.css were performed for each.

| Audit file | Category | Claim text | Code check result |
|---|---|---|---|
| 01-designer.md | Category 5 Deviation #1 | "`var(--io-surface-sunken)` was not enumerated in the pass 1 token survey; it may or may not be registered in `index.css`." | **Registered.** `--io-surface-sunken: #09090b` at `index.css:26`. |
| 01-designer.md | Category 5 Deviation #5 | "If `var(--io-accent-subtle)` is not registered, the selection highlight renders with the wrong hue. This is a silent correctness risk on any environment where the token is absent." | **Registered.** `--io-accent-subtle: rgba(45, 212, 191, 0.1)` at `index.css:42`. The `rgba(99,102,241,0.1)` indigo fallback in CanvasLayerRow would never fire. |
| 01-designer.md | Category 7 Deviation #4 | "`var(--io-accent-subtle)` used as active tab background in PointPickerModal and selected-row background in CanvasLayerRow. The token was not enumerated in pass 1; requires verification against `index.css`." | **Registered.** Same definition as above. |
| 01-designer.md | Category 7 Deviation #5 | "`var(--io-border-subtle)` in PointPickerModal row dividers is not enumerated in pass 1. If unregistered, list rows have no bottom separator." | **Registered.** `--io-border-subtle: #27272a` at `index.css:46`. |

These four hedged claims correctly resolve: the tokens exist. The indigo fallback in CanvasLayerRow (`rgba(99,102,241,0.1)`) is a latent inconsistency (wrong fallback color) but is unreachable at runtime given the token is defined.

---

## Section 2 — Shared CSS File Details

### 2.1 `shared/clipboard/selection/selection.css`

**Implementation:** Two CSS rules scoped to the `.io-selection-overlay` container, targeting elements by `data-indicator` attribute values. Applies a selection box outline and a soft glow effect to selected entities. Both rules depend on a CSS custom property `var(--accent)` — without the `--io-` prefix that all other token references in the project use.

**Source-of-truth files:**
- `frontend/src/shared/clipboard/selection/selection.css:1-11`

**Visual properties as concrete values:**
- `[data-indicator="selection-box"]`: `outline: 2px solid var(--accent)`, `outline-offset: -1px`, `border-radius: 2px`
- `[data-indicator="soft-glow"]`: `box-shadow: 0 0 0 2px rgba(255,255,255,0.15), 0 0 12px 2px var(--accent)`, `border-radius: 4px`

**Deviations from the app shell token system:**
- **Both rules use `var(--accent)` without the `--io-` prefix.** This token has no definition anywhere in the codebase — not in `index.css`, not in `tokens.ts`, and not injected anywhere at runtime. All `index.css` registrations use the `--io-` namespace exclusively. With no `--accent` definition, both CSS var calls resolve to the CSS initial value (empty/no color). The practical effect is: the selection box outline is invisible (no color applied to the outline) and the glow box-shadow has no color component (renders as a transparent or invisible shadow). This is a functional regression affecting the entire shared selection indicator system.

**Notes:** The `--io-` prefix convention is enforced everywhere else in the codebase without exception. This file was likely written with the wrong prefix and the breakage is masked because other selection feedback exists (e.g., inline-style borders in PaneWrapper for Console, SVG stroke in DesignerCanvas for the canvas selection). The clipboard selection overlay is an additional layer on top of those. Modules consuming this system: Console (WorkspaceGrid pane selection via Mode A, `useNodeMarquee`/`useNodeClick`) and any other module using the globalSelectionStore with `io-selection-overlay`.

**Category assignments:** Category 10 (Canvas/Main Work Area) — selection state is a canvas-layer interaction mechanism in Console. Category 5 (Side Panels) — the shared selection system is used for panel/tile multi-select where applicable.

---

### 2.2 `shared/clipboard/selection/MarqueeLayer.tsx`

**Implementation:** React component that renders a marquee selection box via inline styles. Handles mouse events (down/move/up/leave) to track drag rectangle. Uses `globalSelectionStore` for `selectMany`/`clearZone`. The marquee rectangle is rendered as an absolutely-positioned `<div>` only while dragging. Uses the same broken `var(--accent)` token in its inline border style.

**Source-of-truth files:**
- `frontend/src/shared/clipboard/selection/MarqueeLayer.tsx:81-108` (render return)
- `frontend/src/shared/clipboard/selection/MarqueeLayer.tsx:101` (the specific deviation)

**Visual properties as concrete values:**
- Container: `position: absolute, inset: 0`
- Marquee rectangle (while dragging): `position: absolute`, coords from state, `background: rgba(80, 180, 255, 0.08)`, `border: 1px dashed var(--accent)`, `pointerEvents: none`

**Deviations from the app shell token system:**
- **`var(--accent)` without the `--io-` prefix** (`MarqueeLayer.tsx:101`). Same issue as `selection.css`. The marquee border has no visible color. The background (`rgba(80, 180, 255, 0.08)`) is hardcoded and uses a pale blue (not `var(--io-accent-subtle)` = `rgba(45, 212, 191, 0.1)` teal). So even if the prefix bug were fixed, the background color doesn't match the project's accent.
- Background `rgba(80, 180, 255, 0.08)` is a hardcoded blue and does not adapt to theme changes.

**Notes:** The `io-accent` color in the project is teal (`#2dd4bf`). The marquee background `rgba(80, 180, 255, 0.08)` is blue — visually different from the teal accent used everywhere else (WorkspaceGrid marquee uses `var(--io-accent-subtle)` which is correct). Two different marquee styles exist: `MarqueeLayer.tsx` (broken `var(--accent)` + hardcoded blue bg) and `WorkspaceGrid.tsx` (correct `var(--io-accent)` + `var(--io-accent-subtle)`). This component is the shared clipboard-layer marquee; its brokenness does not prevent the Console WorkspaceGrid's own marquee from working.

**Category assignments:** Category 10 (Canvas/Main Work Area) — marquee is a canvas interaction element. Also Category 5 if used in panel contexts.

---

### 2.3 `shared/graphics/alarmFlash.css`

**Implementation:** CSS `@keyframes` animations and class selectors for alarm flash states applied to SVG display elements. 10 keyframe animations (5 alarm levels × 2: stroke-based for shapes, fill-based for text elements) plus one box-flash animation for text readout components. Class selectors apply these animations to child elements via `> *` (shapes), `text` (text nodes), and `rect` (text readout box) selectors. All animations use `steps(1)` easing (binary toggle, not fade) at 1 second period, infinite loop.

**Source-of-truth files:**
- `frontend/src/shared/graphics/alarmFlash.css:1-149` (entire file)

**Visual properties as concrete values:**

| Animation | Active-state color | Off-state color |
|---|---|---|
| `io-alarm-flash-urgent` (stroke) | `#ef4444` | `#808080` |
| `io-alarm-flash-urgent-text` (fill) | `#ef4444` | `#808080` |
| `io-alarm-flash-high` (stroke) | `#f97316` | `#808080` |
| `io-alarm-flash-high-text` (fill) | `#f97316` | `#808080` |
| `io-alarm-flash-low` (stroke) | `#eab308` | `#808080` |
| `io-alarm-flash-low-text` (fill) | `#eab308` | `#808080` |
| `io-alarm-flash-diagnostic` (stroke) | `#f4f4f5` | `#808080` |
| `io-alarm-flash-diagnostic-text` (fill) | `#f4f4f5` | `#808080` |
| `io-alarm-flash-custom` (stroke) | `#60a5fa` | `#808080` |
| `io-alarm-flash-custom-text` (fill) | `#60a5fa` | `#808080` |
| `io-alarm-box-flash` (rect fill+stroke) | `fill: rgba(239,68,68,0.2), stroke: #ef4444` | `fill: #27272a, stroke: #3f3f46` |

- All class selectors apply at `1s steps(1) infinite`
- `> *` selector targets all direct children for stroke changes
- `text` selector targets text child elements for fill changes
- `rect` selector in `.io-alarm-flash` targets text readout box background

**Deviations from the app shell token system:**
- **All alarm colors are hardcoded hex, not token references.** Token registry defines: `--io-alarm-urgent: #ef4444` (index.css:51), `--io-alarm-high: #f97316` (index.css:52), `--io-alarm-low: #eab308` (index.css:53), `--io-alarm-diagnostic: #f4f4f5` (index.css:54), `--io-alarm-custom: #60a5fa` (index.css:55). The hex values in the CSS file match the dark-theme token values, but CSS `@keyframes` cannot use `var()` functions in some browsers (browser support for CSS custom properties inside `@keyframes` is broad but the pattern is unusual). Even so, the file does not attempt token references.
- **Off-state `#808080` has no token equivalent.** No `--io-alarm-off` or `--io-neutral-state` token is defined in the registry. The ISA-101 grey-for-stopped convention has no CSS variable.
- **`io-alarm-box-flash` off-state uses `#27272a` and `#3f3f46`** — the exact dark-theme hex values of `--io-surface-elevated` and `--io-border` respectively, but not referenced via tokens. This means the box flash off-state won't adapt if themes change.
- No `!important` overrides (unlike operationalState.css) — these animations win by specificity.

**Notes:** The hardcoded alarm hex values match the dark-theme token values exactly, so the visual output is correct in the current dark theme. Light-theme and HPHMI-theme adaptation would be broken if those themes use different alarm color values. The comparison file (02-comparison.md) covers alarm badge colors in Categories 1 and 8 for each module but does not mention this shared CSS layer, which is the source of animation-level alarm state rendering for all display elements in the graphics canvas. Consumed by: SceneRenderer via class assignment on symbol instance `<g>` wrappers.

**Category assignments:** Category 8 (Status Indicators) — alarm flash is a visual alarm-state indicator at the SVG element level. Category 10 (Canvas/Main Work Area) — applied exclusively within the graphics canvas to display elements.

---

### 2.4 `shared/graphics/operationalState.css`

**Implementation:** ISA-101 operational state CSS classes applied as class names to symbol instance `<g>` wrapper elements. Targets `.io-stateful` child elements within shape SVGs using `!important` overrides to guarantee these state classes override shape-specific styling. Five mutually exclusive states: `io-running`, `io-stopped`, `io-fault`, `io-transitioning`, `io-oos`. One `@keyframes` animation (`io-state-transitioning-pulse`) for opacity pulsing on the transitioning state. One `@supports` fallback for OOS hatch pattern.

**Source-of-truth files:**
- `frontend/src/shared/graphics/operationalState.css:1-73` (entire file)

**Visual properties as concrete values:**

| State class | Stroke | Fill | Circle fill | Notes |
|---|---|---|---|---|
| `.io-running` | `#047857 !important` (emerald-700) | `none !important` | `rgba(5,150,105,0.15) !important` | Green = running/energised per ISA-101 |
| `.io-stopped` | `#808080 !important` | `none !important` | — | Grey = stopped/normal per ISA-101 |
| `.io-fault` | `#dc2626 !important` (red-600) | `none !important` | `rgba(220,38,38,0.12) !important` | Red = physical fault state |
| `.io-transitioning` | `#d97706 !important` (amber-600) | `none !important` | — | Amber + opacity pulse animation |
| `.io-oos` | `#808080 !important` | `url(#io-hatch-pattern) !important` | — | Dashed stroke + hatch fill |

- `io-state-transitioning-pulse`: `opacity 1 → 0.5 → 1`, `1.5s ease-in-out infinite`
- `@supports not (fill: url(#io-hatch-pattern))` fallback: `fill: none !important`

**Deviations from the app shell token system:**
- **All colors are hardcoded hex with `!important` overrides** — the entire file intentionally bypasses the CSS custom property system. This is an architectural choice, not an oversight: `!important` is required to override SVG shape-specific fill/stroke defined at authoring time.
- `#047857` (running green) has no token equivalent. The closest registered token is `--io-alarm-normal: #22c55e` (green) but it is a lighter green at a different hue. ISA-101 specifies emerald-700 for running state.
- `#dc2626` (fault red) corresponds closely to `--io-alarm-urgent: #ef4444` by intent but uses a different value (red-600 vs red-500). Not a token reference by design — fault state in ISA-101 is a physical state, not an alarm priority.
- `#d97706` (transitioning amber) is the same hex as `--io-warning` in the dark theme (`--io-warning: #f59e0b` is amber-500 vs amber-600 `#d97706`). Close but different; also not a token reference.
- `#808080` (neutral grey for stopped/oos) has no token. `--io-text-disabled: #52525b` and `--io-fill-normal: #475569` are the closest tokens but are different values.

**Notes:** The `!important` usage is intentional and correct — shape SVG elements authored in the symbol library may have fill/stroke attributes set directly; `!important` is the only reliable override mechanism for SVG attribute-level styling. This file represents ISA-101 compliance requirements and is intentionally not token-driven because ISA-101 prescribes specific operational state colors. Consumed by: SceneRenderer assigning state classes to symbol instance wrapper elements based on bound point operational state values.

**Category assignments:** Category 10 (Canvas/Main Work Area) — applied exclusively within the graphics canvas to symbol instances. Category 8 (Status Indicators) — operational state is a status indicator at the SVG element level.

---

### 2.5 `shared/graphics/lod.css`

**Implementation:** Level-of-Detail (LOD) visibility rules. Canvas container element receives one of four mutually exclusive classes: `lod-0`, `lod-1`, `lod-2`, `lod-3`. Each rendered SVG element carries a `data-lod="0|1|2|3"` attribute. CSS rules control which elements are visible at each zoom level using two strategies: adjacent tier (fade: `opacity: 0, pointer-events: none, transition: opacity 200ms ease`) and non-adjacent tier (remove: `display: none`). LOD 3 restores all elements to full visibility. A default rule applies `transition: opacity 200ms ease` to all `[data-lod]` elements regardless of current LOD class.

LOD thresholds (documented in file comments):
- LOD 0 (Overview, zoom < 15%): major equipment, pipes, large labels
- LOD 1 (Area, zoom 15–40%): + text readouts, alarm indicators, medium labels
- LOD 2 (Unit, zoom 40–80%): + all display elements, fill gauges, sparklines
- LOD 3 (Detail, zoom > 80%): everything

**Source-of-truth files:**
- `frontend/src/shared/graphics/lod.css:1-67` (entire file)

**Visual properties as concrete values:**
- Default: `transition: opacity 200ms ease` on all `[data-lod]` elements
- Adjacent tier: `opacity: 0, pointer-events: none`
- Non-adjacent tier: `display: none`
- LOD 3 full-detail: `opacity: 1, pointer-events: auto`
- No color properties, no hardcoded hex values, no CSS custom properties

**Deviations from the app shell token system:**
None. This file contains no color tokens, no CSS custom properties, no `!important` overrides. It is pure structural CSS (opacity, display, pointer-events, transition timing). Fully compliant with the project's token system by virtue of using only non-color layout properties.

**Notes:** The `display: none` for non-adjacent tiers removes elements from compositing layers entirely, reducing GPU memory at high element counts. The `opacity: 0` for adjacent tiers allows smooth fade-in/out as zoom crosses a tier boundary. The LOD class is applied to the `io-canvas-container` div, not the `<svg>` element itself — this is consistent with the CLAUDE.md non-negotiable in `frontend/src/shared/graphics/CLAUDE.md`. The zoom-to-LOD assignment logic lives in the SceneRenderer/GraphicPane components. This file is consumed exclusively by the graphics canvas.

**Category assignments:** Category 10 (Canvas/Main Work Area) exclusively. This file has no relevance to any other category — it is purely a canvas visibility system.

---

## Section 3 — Additional Discrepancies

These are new findings from the broadened search (Section 1.2) that are not yet covered by 03-verification.md's 11-item discrepancy list. Each involves a CSS custom property that a per-audit-file described as potentially unregistered, but which is actually defined in `index.css`. These should be added to the reconciliation set alongside the original 11.

**Discrepancy A: `var(--io-surface-sunken)` — hedged claim of unregistered status**

- Location: 01-designer.md, Category 5 Deviation #1
- Claim: "`var(--io-surface-sunken)` was not enumerated in the pass 1 token survey; it may or may not be registered in `index.css`."
- Code check: `--io-surface-sunken: #09090b` is defined at `index.css:26` in the Surface & Layout block. It is one of the five surface tokens and fully registered.
- Impact on reconciliation: The deviation calling out equipment tiles using `var(--io-surface-sunken)` vs `var(--io-surface-elevated)` for other tiles is a real inconsistency (two different surface tiers for semantically equivalent palette items), but the token itself is valid. The reconciliation task should treat this as a valid token-choice inconsistency, not a broken token.

**Discrepancy B: `var(--io-accent-subtle)` — hedged claim of unregistered status**

- Locations: 01-designer.md, Category 5 Deviation #5 AND Category 7 Deviation #4
- Claim (Cat 5): "If `var(--io-accent-subtle)` is not registered, the selection highlight renders with the wrong hue. This is a silent correctness risk on any environment where the token is absent."
- Claim (Cat 7): "The token was not enumerated in pass 1; requires verification against `index.css`."
- Code check: `--io-accent-subtle: rgba(45, 212, 191, 0.1)` is defined at `index.css:42` in the Accent block.
- Impact on reconciliation: The `rgba(99,102,241,0.1)` indigo fallback in CanvasLayerRow is a latent inconsistency (wrong fallback hue) but is dead code since the token is defined. The underlying concern — that CanvasLayerRow's fallback uses an indigo that doesn't match the teal accent — is still worth noting as a hardcoded wrong-color fallback, but framed as a cosmetic issue in the fallback path, not a broken token.

**Discrepancy C: `var(--io-border-subtle)` — hedged claim of unregistered status**

- Location: 01-designer.md, Category 7 Deviation #5
- Claim: "`var(--io-border-subtle)` in PointPickerModal row dividers is not enumerated in pass 1. If unregistered, list rows have no bottom separator."
- Code check: `--io-border-subtle: #27272a` is defined at `index.css:46` in the Borders & Separators block.
- Impact on reconciliation: PointPickerModal row dividers DO render with a visible separator. The token divergence finding (using `--io-border-subtle` rather than `--io-border`) is still valid as a stylistic inconsistency, but the claim of invisible separators is wrong.

---

## Totals

- **Upstream-audit matches found:** 8 claim instances across 6 known patterns (all in 01-designer.md and 01-settings.md; 0 in 01-console.md for these patterns)
- **Shared files audited:** 5 (selection.css, MarqueeLayer.tsx, alarmFlash.css, operationalState.css, lod.css)
- **Additional discrepancies found:** 3 (--io-surface-sunken, --io-accent-subtle, --io-border-subtle — all hedged claims in 01-designer.md that are actually registered tokens)
