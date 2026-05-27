# Claim A Work Plan — App Shell Convergence

**Derived from:** `ui-audit/02-comparison.md` (post-reconciliation), `ui-audit/04-recommendations.md`, `ui-audit/05-claim-c-deferral.md`
**Scope:** `index.css` token registry, left nav (sidebar), top-bar styling. Excludes Claim B (shared style constants, shared components) and Claim C (canvas/work-surface containers, shared graphics CSS).
**Date:** 2026-05-27
**Status:** Planning only — no implementation

---

## Section 1 — Scope: Concrete Changes Required

### 1.1 Category A — Token Registry Gaps

All changes are additions or value corrections to `index.css`. No existing tokens are deleted.

| # | Token | Status | Proposed Fix | Source |
|---|---|---|---|---|
| A1 | `--io-bg` | Undefined; referenced in Console (grid container) | `--io-bg: var(--io-surface-primary)` | 02 Cat 1 Console Deviations; 04 Cat 1 |
| A2 | `--io-text` | Undefined; referenced in Console and Designer dialog titles | `--io-text: var(--io-text-primary)` | 02 Cat 1 Console+Designer Deviations; 02 Cat 9 Console+Designer Deviations; 04 Cat 1 |
| A3 | `--io-surface-hover` | Undefined; referenced in Designer zoom dropdown | `--io-surface-hover: var(--io-surface-elevated)` | 02 Cat 4 Designer Deviations; 04 Cat 1 |
| A4 | `--io-font-sans` | Undefined; referenced in Designer zoom dropdown (font-family) | Define using the same font stack as the document root. Read `index.css` lines 1–18 (root selector) before writing to confirm the value matches what the document actually inherits. | 02 Cat 1 Designer Deviations; 02 Cat 4 Designer Deviations; 04 Cat 1 |
| A5 | `--io-text-on-accent` | Undefined; referenced in Settings `btnPrimary` across ~15 files | `--io-text-on-accent: var(--io-accent-foreground)` | 02 Cat 1 Settings Deviations; 02 Cat 6 Settings Deviations; 04 Cat 1 |
| A6 | `--io-error` | Undefined; referenced in DesignerCanvas context menu (Claim C file, but token definition is Claim A) | `--io-error: var(--io-danger)` | 02 Cat 10 Designer Deviations; 02 List 2 #7; 04 Cat 1 |
| A7 | `--io-surface-raised` | Undefined; referenced in Designer `RowSection` | `--io-surface-raised: var(--io-surface-elevated)` | 02 Cat 7 Designer Deviations; 02 List 2 #7 |
| A8 | `--io-accent-muted` | Undefined; referenced in Designer (specific file not pinned in audit) | Define as an opacity-reduced accent color. Research required: grep all Designer source files for `--io-accent-muted` to determine the visual tier expected. Likely between `--io-accent-subtle` (`rgba(45,212,191,0.1)`, index.css:42) and `--io-accent` (`#2dd4bf`). Propose value after grep confirms usage context. | 02 List 2 #7 |
| A9 | `--io-overlay` | Undefined; referenced in Settings as `var(--io-overlay, rgba(0,0,0,0.5))` | `--io-overlay: var(--io-modal-backdrop)`. Pre-condition: verify `--io-surface-overlay` (the target of `--io-modal-backdrop` at index.css:139) is itself registered. If not, define `--io-overlay: rgba(0,0,0,0.5)` directly. | 02 Cat 11 Settings Deviations; 02 List 2 #7 |
| A10 | `--io-accent-rgb` | Undefined; referenced in Settings for `rgba()` constructs | `--io-accent-rgb: 45 212 191` (space-separated for modern CSS `rgba(var(--io-accent-rgb) / opacity)` syntax; dark-theme `#2dd4bf` decomposes to `45 212 191`). Must be kept in sync with the accent hex across all themes. | 02 List 2 #7 |
| A11 | `--io-alarm-inactive` | Not yet defined; needed by `alarmFlash.css` off-state hex migration (Claim C work) | `--io-alarm-inactive: #808080` (documented as the off-state value in 02 Cat 8 Shared Infrastructure) | 04 Cat 8 actions; 05 Section 3.1 |
| A12 | `--io-text-inverse` | Not yet defined; needed by DesignerCanvas resize handle fix (Claim C work) | `--io-text-inverse: #ffffff` (dark-theme-first; preserves current `fill="white"` behavior while making it themeable) | 04 Cat 10 actions; 05 Section 3.4 |
| A13 | `--io-z-modal` | Defined at 300 in index.css; misaligned with all actual usage across all three modules (1000–9999 range) | **⚠ User decision required — see Section 2.** Two options: (a) raise to 1000 only; (b) define a full scale `--io-z-dropdown: 500`, `--io-z-modal: 1000`, `--io-z-toast: 2000`. | 04 Cat 11 actions; 04 Risk R1; 02 List 2 #11 |
| A14 | `--io-sidebar-width` | Defined as 240px; all three modules hardcode 220px in code (token not consumed anywhere) | **⚠ User decision required — see Section 2.** Option A: update token to 220px (1-line change in index.css, no module code changes). Option B: update all module code to 240px (changes in DesignerLeftPalette.tsx, ConsolePalette.tsx, Settings/index.tsx aside — 3 files). | 02 Cat 5 Console+Settings+Designer Deviations; 04 Cat 5 |

**Category A total: 14 changes in `index.css`**

Items A1–A3, A5–A7, A9, A11, A12 can be executed unilaterally — target values are clear.
Items A4, A8 require a research step (read index.css root / grep Designer) before writing.
Items A10 requires confirming the dark-theme accent hex before writing.
Items A13, A14 require explicit user decisions before executing.

---

### 1.2 Category B — Shell Drift

Changes to module component files in the sidebar and left-nav layer.

| # | Change | File(s) | Description | Source |
|---|---|---|---|---|
| B1 | Designer left palette background | `frontend/src/designer/DesignerLeftPalette.tsx` | Change `background: var(--io-surface)` → `background: var(--io-surface-secondary)`. Console and Settings both use `var(--io-surface-secondary)` for their side panels; Designer is one surface tier lighter, creating a visible inconsistency at the module-boundary seam. | 02 Cat 5 Designer Deviations; 04 Cat 5 "Fix: Align Designer left palette background" |
| B2 | Settings active nav item — left-border accent | `frontend/src/settings/index.tsx` (nav item active-state styles) | Add `borderLeft: '2px solid var(--io-accent)'` and reduce `paddingLeft` by 2px to maintain alignment. The AppShell implements this indicator; Settings omits it. Audit Cat 5 Notes: "Missing active left-border accent is the most visible deviation from AppShell nav pattern." | 02 Cat 5 Settings Deviations; 04 Cat 5 "Fix: Settings active nav item" |
| B3 | Sidebar width — align code to decided value | Conditional on A14 decision | If 220px chosen (Option A): no code changes needed beyond A14 token update. If 240px chosen (Option B): update `ConsolePalette.tsx` (220px hardcode), `Settings/index.tsx` aside width (220px hardcode), and `DesignerLeftPalette.tsx` width (220px hardcode) to 240px. Change `var(--io-sidebar-width)` references if any exist, not raw integers. | 02 Cat 5 Console+Settings+Designer Deviations; 04 Cat 5 |
| B4 | Settings nav group header — letterSpacing | `frontend/src/settings/index.tsx` (nav group label styles) | Change `letterSpacing` from 0.08em to 0.06em. Console palette section labels use 0.06em; Designer `SectionHeader` uses 0.06em; Settings nav group header drifts to 0.08em. Font size (11px), weight (600), and transform (uppercase) are already consistent. | 02 Cat 2 Settings Deviations; 02 Cat 5; 04 Cat 2 typography table; 04 Cat 5 "Fix: Section label typography" |

**Category B total: 4 changes (B3 expands to 3 additional file edits if 240px is chosen in A14; 0 file changes if 220px chosen)**

---

## Section 2 — Multi-Module Implications

### Shell-layer changes (inherited by all 11 modules)

| Change | Scope | Flag for user review? | Reasoning |
|---|---|---|---|
| **A13 — `--io-z-modal` value** | Shell layer; all current and future modules that render dialogs | **Yes** | Every modal in all three modules currently uses z-index values between 1000 and 9999, with no code referencing the existing 300-value token. Choosing the z-index scale now sets a convention inherited by all 11 modules. Risk R1 from `04-recommendations.md`: a full z-index audit across all `zIndex` values in the frontend is recommended before setting definitive scale values, because uncoordinated layer ordering can cause dialogs to appear behind other dialogs or overlapping dropdowns in edge cases. The Claim B dialog work will migrate code to use these tokens; a partial or incorrect scale is harder to fix after migration than before. |
| **A14 — `--io-sidebar-width` decision** | Shell layer; all current and future modules with a side panel | **Yes** | The 8 future modules will be built to this width from day one. Retrofitting after the fact would require touching all 11 modules. The choice between 220px and 240px is a visual design question, not a technical one. 220px is the current practice; 240px is the AppShell reference value. Neither is obviously correct — which is why this needs an explicit decision, not a unilateral call. |
| **A11, A12 — new tokens** | Shell layer (index.css), consumed by Claim C | No | Purely additive. No effect on code that does not reference these tokens. Defined now so Claim C can reference them without revisiting the token layer. |
| **A1–A10 — alias tokens** | Shell layer; resolve broken references globally | No (individually clear) | Additive. Code referencing these undefined tokens will start rendering correctly once the token is defined. No new breakage is possible since undefined tokens already degrade to no-value or browser fallback. Exception: A4 (`--io-font-sans`) must be verified against the document root font-family to avoid introducing a font-stack inconsistency — the implementer must read the root selector before writing this value. |

### Single-module changes (do not affect convention inheritance)

| Change | Module | Flag for user review? | Reasoning |
|---|---|---|---|
| **B1 — Designer palette background** | Designer only | No | Changes one `background` token reference in one file to match what Console and Settings already do. The target value (`--io-surface-secondary`) is already registered and in use by both other modules. |
| **B2 — Settings active nav indicator** | Settings only | No | The AppShell pattern is unambiguous (`borderLeft: 2px solid var(--io-accent)` + padding adjustment). This aligns Settings to the established pattern. |
| **B3 — Sidebar width code changes** | 0–3 modules, conditional on A14 | Depends on A14 decision | The code changes themselves are mechanical once the width value is decided. No separate review needed beyond the A14 decision. |
| **B4 — Settings nav group typography** | Settings only | No | Changes `letterSpacing` from 0.08em to 0.06em in one location. Small typographic alignment to the value that Console and Designer already use. No functional impact. |

---

## Section 3 — Sequencing

Token registry work must precede shell drift work because some drift fixes reference tokens that do not yet exist (e.g., `--io-surface-secondary` and `--io-accent` ARE registered, so B1–B4 are not blocked — but as a general rule, any drift fix that adds a new token reference depends on that token existing in index.css first).

Within token work, independent gaps go first; research-gated or decision-gated items go second and third.

### Pass 1 — Unblocked aliases (no research, no decision needed)

All are `index.css` only. Can land in a single commit.

1. **A1** — `--io-bg: var(--io-surface-primary)`
2. **A2** — `--io-text: var(--io-text-primary)`
3. **A3** — `--io-surface-hover: var(--io-surface-elevated)`
4. **A5** — `--io-text-on-accent: var(--io-accent-foreground)`
5. **A6** — `--io-error: var(--io-danger)`
6. **A7** — `--io-surface-raised: var(--io-surface-elevated)`
7. **A9** — `--io-overlay: var(--io-modal-backdrop)` (after verifying alias chain)
8. **A11** — `--io-alarm-inactive: #808080`
9. **A12** — `--io-text-inverse: #ffffff`

### Pass 2 — Research-gated tokens (grep / read index.css before writing)

Resolve values, then add in a second `index.css` commit.

10. **A4** — `--io-font-sans`: read root `font-family` declaration in `index.css` (lines 1–18); write token with the same stack to guarantee consistency.
11. **A8** — `--io-accent-muted`: grep all Designer source files for the token name; examine the call site(s) to determine the expected visual tier; propose a value; write it.
12. **A10** — `--io-accent-rgb: 45 212 191`: confirm dark-theme `--io-accent` hex is `#2dd4bf`; confirm this RGB decomposition is correct; write the token. Note: light/HPHMI themes must update this value if their accent color differs — add a comment in index.css to that effect.

### Pass 3 — Decision-gated tokens (user decision before executing)

Get explicit user sign-off on both before writing any code.

13. **A13** — Present two options to user:
    - Option A: raise `--io-z-modal` to 1000 only.
    - Option B: define a full scale — `--io-z-dropdown: 500`, `--io-z-modal: 1000`, `--io-z-toast: 2000`. This is recommended because Claim B dialog migration will reference multiple z-index tiers, and a single token does not cover all cases.
    - In either case, the Claim B phase will migrate hardcoded z-index integers to the chosen tokens. This commit only updates/adds the token definitions.

14. **A14** — Present sidebar width choice to user:
    - Option A (220px): update `--io-sidebar-width: 220px` in index.css. No module code changes. Establishes 220px as the official convention. Fast.
    - Option B (240px): keep `--io-sidebar-width: 240px` in index.css; update `ConsolePalette.tsx`, `Settings/index.tsx` aside, and `DesignerLeftPalette.tsx` (3 files). Establishes 240px as the official convention aligned with the AppShell reference.

### Pass 4 — Shell drift fixes (after Passes 1–3 are committed)

Independent of each other; can be in one PR.

15. **B1** — Designer palette background: `var(--io-surface)` → `var(--io-surface-secondary)` in `DesignerLeftPalette.tsx`.
16. **B2** — Settings active nav indicator: add `borderLeft: '2px solid var(--io-accent)'` + padding adjustment in `Settings/index.tsx`.
17. **B3** — Sidebar width code: 0 files (if 220px) or 3 files (if 240px) — conditional on A14.
18. **B4** — Settings nav group `letterSpacing`: 0.08em → 0.06em in `Settings/index.tsx`.

### Natural PR boundaries

- **PR 1:** Pass 1 + Pass 2 results — pure `index.css` token additions. Minimal review burden; no component code changes.
- **PR 2:** Pass 3 decisions + Pass 4 drift — after user sign-off on A13/A14. Includes 2–5 component file edits.

B3 may be folded into PR 1 if the 220px decision is confirmed before that PR is authored (only updates the token value, no file edits needed).

### Changes that cannot be done as isolated PRs

None of the 18 changes require coordination that prevents isolation. B3 (if 240px) touches 3 files but they are independent of each other. The dependency chain (token before drift) is satisfied by the PR sequence above.

---

## Section 4 — Definition of Done for Claim A

Claim A is complete when all of the following are verifiable:

1. **Zero undefined token references in shell-layer code.** Each token in the set {`--io-bg`, `--io-text`, `--io-surface-hover`, `--io-font-sans`, `--io-text-on-accent`, `--io-error`, `--io-surface-raised`, `--io-accent-muted`, `--io-overlay`, `--io-accent-rgb`} is defined in `index.css`. Grep confirms no remaining unresolved references in the shell-layer files.

2. **Two new tokens defined.** `--io-alarm-inactive` and `--io-text-inverse` exist in `index.css` with documented values.

3. **`--io-z-modal` is at a realistic value.** Token is ≥1000 and consistent with the chosen z-index scale (whether single-token or full scale per A13 decision).

4. **`--io-sidebar-width` matches code.** Token value and hardcoded widths in all three modules are identical — either all 220px or all 240px, per A14 decision. No module contradicts the token.

5. **Designer left palette background matches Console and Settings.** Visual inspection in the running app confirms `DesignerLeftPalette` renders at the same surface tier as `ConsolePalette` and the Settings sidebar.

6. **Settings active nav item shows left-border accent.** Visual inspection confirms a 2px teal left border (`var(--io-accent)`) on the active nav item in Settings, matching the AppShell reference.

7. **Settings nav group header letterSpacing is 0.06em.** Matches Console palette section labels and Designer `SectionHeader` per the Cat 2 typography table in `04-recommendations.md`.

8. **`02-comparison.md` Claim A rows annotated.** The following rows in the comparison file are updated with `Fixed [date]: [commit/PR]` notes:
   - Cat 1: Console/Designer/Settings undefined-token rows
   - Cat 5: sidebar-width deviation rows (Console, Settings, Designer)
   - Cat 5: Settings active-indicator deviation row

---

## Section 5 — Implications for Future Work

### 5.1 Implications for the Claim C Revisit (Workstream 5)

Per `05-claim-c-deferral.md` Section 5, Claim C reopens only after Claim A and Claim B are both complete and reviewed. The following Claim A items have direct downstream effects on Claim C scope:

- **A11 and A12 are consumed by Claim C.** `--io-alarm-inactive` enables `alarmFlash.css` hex migration (05 Section 3.1). `--io-text-inverse` enables the DesignerCanvas resize handle fix (05 Section 3.4). Defining them now means Claim C can reference them immediately without re-entering the token layer.

- **A6 (`--io-error` alias) and A1 (`--io-bg` alias) resolve Claim C imperfections automatically.** Once the aliases exist in `index.css`, DesignerCanvas's context menu destructive color (05 Section 3.5) and WorkspaceGrid's container background (05 Section 3.2) start rendering correctly without any code change in those Claim C files. This reduces the minimum touch-point count inside the high-risk 12,067-line `DesignerCanvas.tsx`.

- **A13 (z-index scale) is a prerequisite for Claim C z-index work.** DesignerCanvas uses internal `zIndex` values in the 300–2000 range. When Claim C touches DesignerCanvas, those values must be coordinated with the scale established in A13. The scale decision is a dependency, not a blocker — Claim C should not begin its z-index work until A13 is decided and committed.

- **A14 (sidebar width) does not directly affect the canvas seam.** The canvas containers (WorkspaceGrid, DesignerCanvas) span the remaining viewport width after the sidebar. The canvas-to-sidebar boundary is clean regardless of which value (220px or 240px) is chosen, as long as the token and code are consistent.

### 5.2 Conventions Established for the Eight-Module Rebuild

The eight modules being rebuilt around the converged Console/Designer foundation will inherit the shell conventions locked in by Claim A. The following must be treated as non-negotiable constraints for all rebuilt modules:

| Convention | Value | Applies to |
|---|---|---|
| Side panel background | `var(--io-surface-secondary)` | Any rebuilt module with a left or right panel. Designer's drift to `var(--io-surface)` is being corrected in B1 to establish this as the unambiguous standard. |
| Active nav item indicator | `borderLeft: 2px solid var(--io-accent)` + adjusted padding | Any rebuilt module with a sidebar nav list. |
| Sidebar width | `var(--io-sidebar-width)` (value per A14 decision) | All side panels in rebuilt modules must use this token, not a hardcoded integer. The value may not be known until A14 is decided — this token must be resolved before any rebuilt module's panel layout is coded. |
| Nav group header typography | 11px / 600 / uppercase / 0.06em / `var(--io-text-muted)` | All section-group labels within sidebar nav panels. |
| Toolbar surface | `var(--io-surface)` + `borderBottom: 1px solid var(--io-border)` | Module toolbars. This is the Console+Designer convention adopted in `04-recommendations.md` Cat 3 — not `var(--io-surface-primary)` (which is the AppShell reference but is not the adopted target for module toolbars). |
| Token hygiene | No token reference may be used that is not defined in `index.css` | Treat any undefined token reference in a rebuilt module as a blocking defect. The token list cleared by Claim A is the authoritative registry; nothing outside it may be referenced. |

**One Claim A item must be resolved before any of the eight modules begins panel-layout work:** A14 (`--io-sidebar-width` value). Building any panel at a hardcoded width and later discovering the chosen value was different requires an eleven-module edit. Decide it once, enforce it everywhere.
