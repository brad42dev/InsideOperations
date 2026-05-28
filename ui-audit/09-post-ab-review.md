# Post-Claim-A/B Review — Claim C Revisit Decision

**Date:** 2026-05-28  
**Inputs:** 02-comparison.md, 04-recommendations.md, 05-claim-c-deferral.md, 06-claim-a-plan.md + check-ins 06a/06b/06c, 07-future-work-notes.md, 08-claim-b-plan.md + check-ins 08a/08b/08c  
**Purpose:** Take stock of where things stand; inform the Claim C revisit decision.

---

## Section 1 — What Landed

### Claim A — Token Registry and App Shell

**Token registry (14 items in `index.css`):**

| Token | Disposition | Value |
|-------|-------------|-------|
| `--io-bg` | Added | `var(--io-surface-primary)` |
| `--io-text` | Added | `var(--io-text-primary)` |
| `--io-surface-hover` | Added | `var(--io-surface-elevated)` |
| `--io-font-sans` | Added | Full Inter/system sans-serif stack (`:root` only) |
| `--io-text-on-accent` | Added | `var(--io-accent-foreground)` |
| `--io-error` | Added | `var(--io-danger)` |
| `--io-surface-raised` | Added | `var(--io-surface-elevated)` |
| `--io-overlay` | Added | `var(--io-modal-backdrop)` |
| `--io-accent-rgb` | Added | Per-theme RGB triplets (dark=`45 212 191`, light=`13 148 136`, hphmi=`20 184 166`) |
| `--io-alarm-inactive` | Added | `#808080` in all three themes |
| `--io-z-modal` | Updated | Full z-index scale: dropdown:500, modal:1000, command:1200, visual-lock:1500, kiosk-auth:1800, toast:2000, emergency:3000 |
| `--io-sidebar-width` | Updated | 220px in all three themes |
| `--io-text-inverse` | Skipped | Already defined; plan claim was wrong |
| `--io-accent-muted` | Rejected | Single consumer; `PromoteToShapeWizard.tsx:2168` updated to `var(--io-accent-subtle)` instead |

All 14 items resolved with zero undefined token references remaining in the surveyed scope.

**Shell drift fixes (`index.tsx`, `DesignerLeftPalette.tsx`):**

- `DesignerLeftPalette.tsx:2436` — background `var(--io-surface)` → `var(--io-surface-secondary)` (aligns Designer left palette with Console and Settings)
- `settings/index.tsx:211–214` — active nav item gets `borderLeft: 2px solid var(--io-accent)` + uniform `padding: 7px 10px 7px 8px` (transparent border on inactive; reserved space prevents text jump)
- `settings/index.tsx:198` — nav group header `letterSpacing` 0.08em → 0.06em (matches Console palette sections and Designer SectionHeader)
- Sidebar width: no code changes; all three modules were already at 220px, token now agrees

**Functional regressions fixed (not strictly Claim A but landed in the same window):**

- `shared/clipboard/selection/selection.css` lines 2 and 9: `var(--accent)` → `var(--io-accent)` — selection highlight was invisible
- `shared/clipboard/selection/MarqueeLayer.tsx` line 100: `rgba(80,180,255,0.08)` → `var(--io-accent-subtle)`; line 101: `var(--accent)` → `var(--io-accent)` — marquee border color corrected
- `frontend/src/pages/settings/OpcSources.tsx:168–170` — `${color}20` hex-alpha concatenation bug → `color-mix(in srgb, ${color} 12%, transparent)`; same for the `${color}40` border

---

### Claim B — Module Framework Layer

**New files in `frontend/src/shared/`:**

| File | Key exports |
|------|-------------|
| `shared/styles/buttons.ts` | `btnPrimary`, `btnSecondary`, `btnDanger`, `btnSmall`, `buttonBaseClass` — all use `var(--io-accent-foreground)` for primary text, `var(--io-radius)` for radius |
| `shared/styles/buttons.css` | `.io-btn:hover { opacity: 0.85 }` and `.io-btn:focus-visible` outline |
| `shared/styles/inputs.ts` | `inputStyle` (no `outline:none`; `var(--io-surface-sunken)` bg; `var(--io-radius)` borderRadius), `inputClassName` |
| `shared/styles/inputs.css` | `:focus-visible` focus ring on `.io-input` elements |
| `shared/components/FieldLabel.tsx` | `{ children: ReactNode; htmlFor?: string }` — 11px/600/uppercase/0.05em/`--io-text-muted` |
| `shared/components/StatusBadge.tsx` | `{ status: string; label?: string }` — token-pair map for 17 named status strings |
| `shared/components/Dialog.tsx` | `{ open, onOpenChange, title, description?: ReactNode, children, width?=480, footer?: ReactNode }` — Radix-based; `--io-modal-backdrop`; `--io-z-modal`; `--io-surface-elevated`; `--io-radius-lg` |
| `shared/components/ConfirmDialog.tsx` | Patched: overlay `var(--io-z-modal)`, content `var(--io-surface-elevated)` + `var(--io-radius-lg)`, confirm text `var(--io-accent-foreground)` |

**Consumers migrated:**

*FieldLabel:* `DesignerRightPanel.tsx` (local definition removed; 14+ call sites inherit automatically); `PaneConfigModal.tsx` (6 field labels migrated, `htmlFor` added where applicable).

*StatusBadge:* `Import.tsx`, `OpcSources.tsx`, `SystemHealth.tsx`, `Email.tsx` — local StatusBadge implementations removed; all import from shared. `SystemHealth.tsx` adds a local `STATUS_LABELS` record to preserve custom display text.

*Dialog:* `PaneConfigModal.tsx` (token fixes only; retains Radix Dialog directly); `console/index.tsx` — `WorkspaceNameModal`, `DeleteConfirmDialog`, `CloseConfirmDialog` all replaced with shared wrapper (ARIA now Radix-provided); `settings/RestorePreviewModal.tsx` (highest-priority ARIA gap resolved — destructive-adjacent action path); `TabClosePrompt.tsx`; `IographicExportDialog.tsx`.

*ConfirmDialog / window.confirm():* `DesignerReportsList.tsx`, `DesignerDashboardsList.tsx`, `CameraStreams.tsx` — `window.confirm()` replaced with ConfirmDialog state + render. All 15 existing ConfirmDialog consumers inherit the z-index/bg/radius token fixes automatically.

---

## Section 2 — What Was Deferred or Rejected

### Rejected approaches

**`--io-accent-muted` as a new token (Claim A, A8).** Only one consumer; rejected in favor of updating the consumer to use the existing `var(--io-accent-subtle)`. Established the rule: single-consumer tokens belong at the consumer, not in the registry. Applied consistently throughout.

**Component library framework (Claim B, Section 7 Item 2).** Permanently excluded, not a deferred workstream item. Named as a permanent architectural exclusion. The constants-file + thin shared-components approach is the ceiling.

**Merging WorkspaceGrid and DesignerCanvas.** Confirmed architecturally incorrect throughout both workstreams. The module-specific container distinction is not a gap to close.

**Typography scale token migration** (`--io-text-*` tokens unused across all three modules). Deferred pending font-size scaling as a product requirement. The right approach when that requirement arrives — not before.

### Deferred by Claim A (to Claim B or C)

- Consumer-level code changes for all hardcoded hex values (WS dot colors, dirty indicator, READ-ONLY badge, alarm priority badges, published dot) — all deferred; only aliases were added at the token level.
- `--io-z-command`/`--io-z-kiosk-auth` wiring to CommandPalette — executed early (scope creep in 2b); accepted as permanent at 2026-05-27 check-in (F1 resolution in 06c).

### Deferred by Claim B

**Full buttons.ts consumer migration (11 files):** `BulkUpdate.tsx`, `Import.tsx` (buttons), `Sessions.tsx` (buttons), `console/index.tsx` (buttons), `PaneConfigModal.tsx` (buttons), `PaneWrapper.tsx`, `AlarmListPane.tsx`, `PointTablePane.tsx`, `DesignerToolbar.tsx` (text-action buttons), `DesignerImport.tsx` (wrong-hue fallback), `DesignerGraphicsList.tsx`. *Reason: "create the artifact" and "migrate all consumers" were treated as different work items; initial scope proved out the shared artifact.*

**Full inputs.ts consumer migration (8 files):** `Import.tsx` (inputStyle), `BulkUpdate.tsx`, `Sessions.tsx` (inputs), `PaneConfigModal.tsx` (multiple `outline:none` inputs), `PaneWrapper.tsx`, `ConsolePalette.tsx`, `console/index.tsx` (inline inputs), `PointPickerModal.tsx`. *Reason: same pattern as buttons. DesignerRightPanel compact inspector inputs intentionally excluded (documented exception).*

**FieldLabel — Settings labelStyle users.** Settings uses 12px/500/no-uppercase which is visually and semantically distinct from FieldLabel's 11px/600/uppercase/0.05em convention. Intentionally not migrated. *Signal: there are two legitimate form-label conventions in this project — one for compact inspector forms (Settings), one for structured modals and palette configurations (FieldLabel).*

**StatusBadge — four deferred categories:**
- `PointManagement.tsx ActiveBadge` — boolean API (`active: boolean`) doesn't map directly; needs an adapter or a separate migration decision.
- `Users.tsx`, `Roles.tsx`, `CameraStreams.tsx`, `MaintenanceTicketsPanel.tsx` — hex-alpha bug (`${color}20`) in `Badge({ label, color })` pattern. Not a StatusBadge migration candidate (dynamic color input, not named-status). Requires the DC-6 `color-mix()` fix. *Reason: separate bug fix, not StatusBadge substitution.*
- Console alarm badges (`PriorityBadge`, `StateBadge`, `QualityBadge`) — different semantic vocabulary (alarm priority, not connection status); deferred to Claim C / alarm token work. *Reason: alarm domain has its own token set and is architecturally the right Claim C scope.*

**Dialog — multiple deferred categories:**
- `Import.tsx` Modal/Drawer and `OpcSources ManageCategoriesModal` — ARIA gaps. *Reason: not highest-priority; out of Claim B scope per plan.*
- Four designer wizard dialogs (`IographicImportWizard`, `CategoryShapeWizard`, `RecognitionWizard`, `PromoteToShapeWizard`) — complex multi-step flows; Dialog wrapper would add structure without simplifying the step-indicator and ARIA complexity. *Reason: these need a dedicated wizard-dialog audit pass, not a simple wrapper substitution.*
- `SaveAsStencilDialog`, `ShapeDropDialog`, `PromoteToShapeWizard` — rendered inside `DesignerCanvas.tsx`. *Reason: Claim C scope; requires portal evaluation per CLAUDE.md invariant.*

**window.confirm() — dashboards module** (`dashboards/index.tsx`, `PlaylistManager.tsx`). *Reason: dashboards is out of scope for this workstream; portal check required (react-grid-layout ancestor likely).*

**Phase 5 polish (entire phase deferred):** DOM-mutation hover replacement, DesignerCanvas grid/canvas/guide colors, semantic headings, letterSpacing standardization beyond the Settings nav group fix. *Reason: low functional impact; appropriate after the eight-module rebuild establishes adoption patterns.*

**`--io-surface-tertiary` undefined.** StatusBadge's muted state falls back to `--io-surface-secondary`. The plan referenced this token inherited from Import.tsx, which also used it. Token is not registered in `index.css`. *Signal: token registry has an implicit gap in the surface-tier hierarchy; either register `--io-surface-tertiary` or formally adopt `--io-surface-secondary` as canonical for muted badge backgrounds.*

**Dialog.tsx z-index literals (minor consistency gap).** Dialog uses `1000`/`1001` numeric literals with comments; ConfirmDialog uses `"var(--io-z-modal)"` CSS token strings. Both compute identically. *Signal: if the z-index scale changes, Dialog.tsx will need a manual update alongside the token. Low urgency; flag for cleanup.*

---

## Section 3 — Current State of the Three Concentric Rectangles

### Outer rectangle: app shell

The outer rectangle is the most converged of the three. The 12-token alias pass, the z-index scale, the sidebar width decision, and the three shell-drift fixes together produced a shell layer that:

- Has zero undefined token references in the audited scope
- Has consistent 220px side panels across all three modules using `var(--io-sidebar-width)`
- Has consistent surface tier (`var(--io-surface-secondary)`) across all three left panels
- Has consistent active nav indicator (`borderLeft: 2px solid var(--io-accent)`) across Settings and AppShell; Console and Designer use their own nav patterns but are internally consistent
- Has consistent section-header typography (11px/600/uppercase/0.06em) across Console, Designer, and Settings

Remaining gaps: toolbar height tokens undefined (hardcoded integers still); Console/Designer topbar uses `var(--io-surface)` rather than AppShell's `var(--io-surface-primary)` — this is the audited-and-accepted divergence, not a gap to close. The outer rectangle is materially done.

### Middle rectangle: module framework

This is the rectangle where it is most important to be honest: **the infrastructure exists but adoption is near-zero.**

`buttons.ts` and `inputs.ts` are the right canonical definitions. They exist. The code in `console/index.tsx`, `PaneWrapper.tsx`, `DesignerToolbar.tsx`, and all the Settings pages still uses inline styles and hardcoded hex values. The shared constants have zero consumers beyond the files that were explicitly migrated during Claim B.

The shared components are a different story: they have meaningful coverage within their initial scope. FieldLabel covers Designer's form fields (14+ sites) and Console's PaneConfigModal. StatusBadge covers four of five Settings implementations. Dialog covers the highest-priority accessibility gaps. ConfirmDialog's token fixes propagated to all 15 consumers automatically.

But the gap between "standards defined" and "standards applied" is real and wide. As of today:

- Every button in Console, most buttons in Designer, and the non-canonical buttons in Settings still use inline styles with hardcoded text color (`#fff`) or inconsistent `borderRadius` values.
- Every form input in Console and most in Designer still has `outline: none` suppressing the focus ring.
- DOM-mutation hover (`onMouseEnter`/`onMouseLeave` style writes) is still the dominant hover implementation across all three modules.
- The `inactive` → danger StatusBadge mapping in OpcSources has not been UX-reviewed.

The middle rectangle has converged architecturally (the right components and constants exist and are correctly designed) but has not converged visually across the full codebase. A full consumer migration pass would close most of this gap.

### Inner rectangle: canvas/work-surface

Fully untouched as planned. No changes to `WorkspaceGrid.tsx`, `DesignerCanvas.tsx`, `SceneRenderer.tsx`, `alarmFlash.css`, `operationalState.css`, or `lod.css`.

Token aliases from Claim A resolved two items automatically without code changes:
- WorkspaceGrid container background (`var(--io-bg)` → resolves via alias) — closed
- DesignerCanvas context menu destructive color (`var(--io-error)` → resolves via alias) — closed

Remaining open items from `05-claim-c-deferral.md` Section 3:

| Item | Functional or Cosmetic | Status |
|------|------------------------|--------|
| `alarmFlash.css` hardcoded alarm hex | **Functional** — wrong in light/HPHMI themes | Still open |
| WorkspaceGrid `var(--io-bg)` | Resolved automatically via A1 alias | Closed |
| DesignerCanvas canvas border `rgba(255,255,255,0.08)` | Cosmetic (dark theme OK; light theme wrong) | Still open |
| DesignerCanvas resize handles `fill="white"` | Functional if light theme arrives | Still open |
| DesignerCanvas `--io-error` context menu | Resolved automatically via A6 alias | Closed |
| DesignerCanvas guide line colors hardcoded rgba | Cosmetic / intentional design choice | Still open |
| DesignerCanvas grid lines hardcoded rgba | Cosmetic / acceptable | Still open |
| "Paste as…" submenu always disabled | **Functional** — user interaction broken | Still open |

New Claim C scope items discovered during Claim B execution (not in `05-claim-c-deferral.md`):
- `SaveAsStencilDialog`, `ShapeDropDialog`, `PromoteToShapeWizard` (inside DesignerCanvas scope) — need Dialog wrapper evaluation and portal check per CLAUDE.md invariant.
- `ConfirmDialog` z-index is now 1000; any DesignerCanvas content currently at z-index 100–999 may now render behind it. Audit needed at Claim C start.
- Wizard dialog step indicator inconsistency (`IographicImportWizard`, `CategoryShapeWizard`, `RecognitionWizard`, `PromoteToShapeWizard`) — this is Designer-layer dialog work that was deferred from Claim B. It sits at the boundary between the middle rectangle (dialog standards) and the canvas layer (designer workflow). It belongs in a dedicated wizard-dialog pass, coordinated with or preceding Claim C.

---

## Section 4 — Deferred Promotion and Consumer Migration Backlog

From `07-future-work-notes.md` follow-up-promotions and deferred-consumer-migrations sections:

### Should any of this clear before Claim C?

**FP-1 — DC-6: Hex-alpha badge bug (Users.tsx, Roles.tsx, CameraStreams.tsx, MaintenanceTicketsPanel.tsx)** ✅ RESOLVED 2026-05-28

`07-future-work-notes.md` is explicit: *"Gate: Must complete before module rebuild."* This is a rendering bug — `${color}20` hex-alpha concatenation produces invalid CSS values when a CSS custom property string is passed as the color argument. The fix pattern is fully established (OpcSources fix, Claim A). Four files, same three-line `color-mix()` substitution each.

**Fixed (Workstream 4.5c):** Each file had a local badge component (not shared). Changed `${color}20` → `color-mix(in srgb, ${color} 12%, transparent)` and `${color}40` → `color-mix(in srgb, ${color} 25%, transparent)` in:
- `Users.tsx` — `Badge` component (lines 108, 110)
- `Roles.tsx` — `Badge` component (lines 51, 53)
- `CameraStreams.tsx` — `VisibilityBadge` component (lines 786, 788)
- `MaintenanceTicketsPanel.tsx` — `StatusPill` component (line 52, background only — no border)

**FP-2 — DC-3: ContextMenu danger-item token fix**

`shared/components/ContextMenu.tsx`: `var(--io-alarm-urgent)` → `var(--io-danger)`. One-line change. Both tokens resolve to `#ef4444` in dark theme, so there is no visual regression today — but they diverge in light/HPHMI themes. The main Claim C action (alarmFlash.css token migration) is the primary light/HPHMI theme fix; landing this ContextMenu fix before or during Claim C is thematically consistent.

**Recommendation: land FP-2 as part of Claim C pre-work or early in Claim C scope.** It is too small to delay opening Claim C.

**FP-3 — DC-5: DesignerLeftPalette local DeleteConfirmDialog → ConfirmDialog migration**

Ready; no design decisions needed. Should land before the Designer module rebuild, not before Claim C. Does not affect canvas layer or Claim C sequencing.

**FP-4 — DC-4: SectionLabel component promotion**

Promote when the first rebuilt module needs a side-panel section header. Does not affect Claim C.

**FP-5 — DC-1: IconBtn evaluation** and **FP-6 — DC-2: SettingsPageLayout promotion**

Both are explicitly timed to module-rebuild planning phase. Not Claim C dependencies.

**Full consumer migration pass (buttons.ts/inputs.ts, 11 + 8 files)**

This pass does not affect Claim C scope. Canvas layer work is independent of whether PaneWrapper uses `btnSecondary` from the shared constants file. The correct timing is after Claim C and as a pre-rebuild pass, where adoption can be locked in for all eight new modules simultaneously. Running the consumer migration pass now would add latency before Claim C with no architectural benefit.

**Wizard dialog pass (four designer dialogs)**

This is not a Claim C dependency, but it shares scope proximity: the wizard dialogs are Designer workflow components that sit in the same module as DesignerCanvas. Planning a wizard-dialog pass as a standalone workstream coordinated with (but not blocking) Claim C is the correct approach.

**`--io-surface-tertiary` token gap**

Should be resolved before any rebuilt module needs a muted badge background. A low-effort token decision: either register `--io-surface-tertiary` as a distinct step between `--io-surface-secondary` and `--io-surface`, or formally document `--io-surface-secondary` as canonical for muted badge backgrounds and update the StatusBadge source comment.

---

## Section 5 — Claim C Readiness

### Formal trigger conditions (from `05-claim-c-deferral.md` Section 5)

| Condition | Status |
|-----------|--------|
| Claim A complete, including check-in review | ✅ Met — 06c check-in resolved all open items; CommandPalette z-index explicitly accepted 2026-05-27 |
| Claim B complete, including check-in review | ✅ Met — 08c check-in confirmed all four components promoted, all DoD criteria satisfied |
| `04-recommendations.md` and `02-comparison.md` updated to reflect A and B | ✅ Met — execution notes are inline in both documents; open/resolved status is current |

The formal trigger conditions are all satisfied.

### Dependencies or gaps that remain from A or B

No hard blockers for Claim C. The token aliases that Claim C depends on (`--io-alarm-inactive`, `--io-text-inverse`) were defined in Claim A. The component vocabulary that Claim C needs to be consistent with (Dialog, ConfirmDialog, FieldLabel) is now stable and documented.

The two soft gaps to note:
- FP-1 (hex-alpha bug) is a rendering bug that should clear before the rebuild. It is small enough to land as a pre-Claim-C bug fix rather than a workstream gate.
- FP-2 (ContextMenu token) is thematically related to the light/HPHMI theme work that alarmFlash.css migration initiates. Should land as part of Claim C scope or immediately prior.

### What Claim B revealed about Claim C scope

**DesignerCanvas-internal dialogs need portal evaluation.** `Dialog.tsx` uses `position: fixed`. Per CLAUDE.md invariant, `position: fixed` inside react-grid-layout transforms breaks — use `createPortal`. WorkspaceGrid uses react-grid-layout; any dialog inside a pane rendered by WorkspaceGrid needs a portal. The three Claim C dialogs (`SaveAsStencilDialog`, `ShapeDropDialog`, `PromoteToShapeWizard`) are inside `DesignerCanvas.tsx`, which is not inside a react-grid-layout context — but this needs explicit verification before wrapping them in Dialog.

**ConfirmDialog z-index change creates a new stacking audit requirement.** Before Claim C makes z-index changes inside `DesignerCanvas.tsx`, all internal z-index values must be mapped against the permanent scale (A13). Values in the 100–999 range will now render behind ConfirmDialog — this was not a conflict before Claim B's ConfirmDialog patch.

**Consumer migration pattern is established; Claim C should enforce it.** The Claim B workstream demonstrated that "create the shared artifact" and "migrate all consumers" are genuinely separate work items. Claim C should plan with this distinction from the start: separate DoD criteria for "DesignerCanvas chrome uses token-based values" and "all DesignerCanvas local chrome is consuming the token system."

---

## Section 6 — Refined Scope for Claim C

The original scope from `05-claim-c-deferral.md` Section 3, with current status:

| Original item | Resolved automatically? | Remaining work |
|---------------|------------------------|----------------|
| `alarmFlash.css` hardcoded alarm hex | No | Token migration: `#ef4444`→`--io-alarm-urgent`, `#f97316`→`--io-alarm-high`, `#eab308`→`--io-alarm-low`, `#f4f4f5`→`--io-alarm-diagnostic`, `#60a5fa`→`--io-alarm-custom`; off-state `#808080`→`--io-alarm-inactive` (defined in Claim A). **Functional — required for light/HPHMI theme support.** |
| WorkspaceGrid `var(--io-bg)` | ✅ Yes — A1 alias | Close the finding. No code change. |
| DesignerCanvas canvas border | No | `rgba(255,255,255,0.08)` → `var(--io-border)` with appropriate opacity, or a new `--io-canvas-border` token. Cosmetic; light-theme regression. |
| DesignerCanvas resize handles | No | `fill="white"` → `fill="var(--io-text-inverse)"`. Functional if light theme is coming. |
| DesignerCanvas `--io-error` | ✅ Yes — A6 alias | Close the finding. No code change. |
| DesignerCanvas guide lines | No | Acceptable as-is per original recommendations; decision: document as intentional if design choice, otherwise `--io-guide-line-x` and `--io-guide-line-y` tokens. |
| DesignerCanvas grid lines | No | Cosmetic; `rgba(128,128,128,0.12/0.28)` is theme-neutral gray; acceptable as-is. |
| "Paste as…" submenu always disabled | No | Separate bug task file. Not a UI token/convergence issue — behavioral bug in `designerPasteTarget.accepts()`. |

**New scope items from Claim B:**

- **DesignerCanvas-internal dialogs** (`SaveAsStencilDialog`, `ShapeDropDialog`, `PromoteToShapeWizard`): evaluate for Dialog wrapper migration; determine portal requirements per CLAUDE.md invariant; migrate if feasible. *Seam between rendering layer and module containers — these dialogs are instantiated from canvas interaction, not from module shell.*
- **ConfirmDialog z-index audit**: before touching z-index inside DesignerCanvas, audit all `zIndex` values in the file against the A13 permanent scale.
- **WorkspaceGrid pane chrome**: now that the middle rectangle is converged, the pane card `borderRadius: 4` vs `var(--io-radius)` = 6px, the swap-source border `#F59E0B` (not a token), and the pane header surface `var(--io-surface-secondary)` are visible seam issues between the work-surface container and the converged middle-rectangle chrome. These are smaller than the DesignerCanvas issues but belong in Claim C.

**Functional vs. cosmetic distinction:**

*Must fix (functional):*
- `alarmFlash.css` token migration — light/HPHMI themes produce wrong alarm flash colors
- DesignerCanvas resize handles — white handles on white background in light theme
- "Paste as…" submenu bug — user interaction permanently broken

*Should fix (cosmetic with theme implications):*
- DesignerCanvas canvas border — wrong in light theme; dark theme correct
- WorkspaceGrid pane `borderRadius` / swap-source border — visual seam

*Low priority / acceptable as-is:*
- DesignerCanvas grid lines — neutral gray; works in both themes
- DesignerCanvas guide line colors — intentional design palette; decision to formalize or leave

---

## Section 7 — Implications for the Eight-Module Rebuild

The eight rebuilt modules inherit the converged Console/Designer/Settings foundation at the end of Claim C. What that foundation looks like matters.

### What is already locked in (non-negotiable for rebuilt modules)

From `07-future-work-notes.md` hard constraints and Claim B additions:

| Convention | Value | Source |
|------------|-------|--------|
| Side panel background | `var(--io-surface-secondary)` | B1 (Claim A) |
| Active nav indicator | `borderLeft: 2px solid var(--io-accent)` + `padding: 7px 10px 7px 8px` | B2 (Claim A) |
| Sidebar width | `var(--io-sidebar-width)` = 220px | A14 (Claim A) |
| Nav group header typography | 11px/600/uppercase/0.06em/`--io-text-muted` | B4 (Claim A) |
| Toolbar surface | `var(--io-surface)` + `borderBottom: 1px solid var(--io-border)` | Consensus (Claim A) |
| Primary button | `shared/styles/buttons.ts` `btnPrimary` — `var(--io-accent-foreground)` text, `var(--io-radius)` radius | Claim B |
| Secondary/danger buttons | `shared/styles/buttons.ts` variants | Claim B |
| Form inputs | `shared/styles/inputs.ts` `inputStyle` — `var(--io-surface-sunken)` bg, `var(--io-radius)`, no `outline:none` | Claim B |
| Inspector-panel inputs | Local compact `inputStyle` exempted (documented exception) | Claim B |
| Form field labels | `shared/components/FieldLabel.tsx` — 11px/600/uppercase/0.05em/`--io-text-muted` | Claim B |
| Status badges | `shared/components/StatusBadge.tsx` — named status vocabulary | Claim B |
| General dialogs | `shared/components/Dialog.tsx` — Radix; `--io-modal-backdrop`; `--io-z-modal` | Claim B |
| Destructive confirmations | `shared/components/ConfirmDialog.tsx` | Claim B |
| Token hygiene | Zero undefined token references; no hardcoded hex for values that have token equivalents | Claim A |

### Pre-rebuild work that should happen

The following are explicitly gated as pre-rebuild or should happen before the rebuild begins:

1. ~~**FP-1 (DC-6 hex-alpha bug)** — `Users.tsx`, `Roles.tsx`, `CameraStreams.tsx`, `MaintenanceTicketsPanel.tsx` — rendering bug. Listed in `07-future-work-notes.md` as *"Gate: Must complete before module rebuild."* Small standalone PR.~~ ✅ RESOLVED 2026-05-28 (Workstream 4.5c)

2. **FP-3 (DC-5 DesignerLeftPalette local DeleteConfirmDialog)** — single-file consumer migration. Should complete before the Designer module rebuild begins.

3. **`--io-surface-tertiary` token gap** — resolve before any rebuilt module needs a muted badge background. Decide: register as distinct token, or formally adopt `--io-surface-secondary` as canonical.

4. **Full buttons.ts/inputs.ts consumer migration pass** — the eight rebuilt modules will need to follow the constants-file adoption pattern. If existing modules haven't adopted it yet, the pattern is proven by spec but not by example. Running the consumer migration pass before the rebuild starts would give rebuilt modules a working model to follow, not just a spec to read.

5. **Claim C itself** — because rebuilt modules that include graphic display capabilities (Canvas-based panes) will inherit whatever rendering layer they find. If `alarmFlash.css` is still hardcoded-hex when the first rebuilt module is built, that module will ship with the same theme-adaptation gap.

### Wizard dialog pass

The four designer wizard dialogs (`IographicImportWizard`, `CategoryShapeWizard`, `RecognitionWizard`, `PromoteToShapeWizard`) are Designer-specific and not part of the rebuild. But they establish the pattern for any rebuilt module that needs a multi-step wizard workflow. Running a dedicated wizard-dialog audit pass (step indicator standardization, ARIA review, dialog token alignment) before the rebuild is sound practice even though none of the rebuilt modules will have these exact dialogs.

---

## Section 8 — Recommendation

**Path 1 (proceed to Claim C immediately):** the formal conditions are met; no hard blockers exist.  
**Path 2 (clear deferred items first):** FP-1 and FP-2 are small standalones; the full consumer migration pass is substantial.  
**Path 3 (pause):** not warranted; Claim C has functional items that matter (alarmFlash.css, "Paste as…" bug, DesignerCanvas-internal dialog migration).

**Recommendation: Path 2 with a narrow interpretation — execute FP-1 and FP-2 as standalone bug-fix PRs, then proceed to Claim C as Workstream 5.**

Rationale:

- FP-1 (DC-6 hex-alpha bug) takes under an hour across four files and is explicitly gated as "must complete before module rebuild." Since Claim C precedes the rebuild, and this is a rendering bug with an established fix pattern, it should not remain open while a new workstream opens.

- FP-2 (ContextMenu danger token) is a one-line fix thematically aligned with the light/HPHMI theme work that alarmFlash.css migration initiates. It belongs in the same "light-theme readiness" group as Claim C's main functional action. Landing it as an immediate pre-Claim-C PR or in the first PR of Claim C is correct.

Neither of these constitutes a workstream. They are bug fixes. They do not change the Claim C scope, sequencing, or timeline in any meaningful way.

**What Path 2 does NOT mean here:** running the full buttons.ts/inputs.ts consumer migration pass before opening Claim C. That pass does not affect the canvas layer, does not unblock any Claim C action, and has sufficient scope to constitute a separate workstream. It should be planned after Claim C, timed to precede the module rebuild planning phase. The same applies to the wizard dialog pass.

**Refined Claim C scope to take into Workstream 5:**

1. Land FP-1 (DC-6 hex-alpha bug) and FP-2 (DC-3 ContextMenu token) as pre-work PRs.
2. Open Claim C (Workstream 5) with this starting scope:
   - **Functional:** `alarmFlash.css` token migration (light/HPHMI theme support); "Paste as…" submenu bug (task file); DesignerCanvas resize handles `fill="white"` → `var(--io-text-inverse)` (light-theme functional)
   - **Canvas-internal dialog evaluation:** `SaveAsStencilDialog`, `ShapeDropDialog`, `PromoteToShapeWizard` — portal check, Dialog wrapper migration if viable
   - **ConfirmDialog z-index audit:** audit all DesignerCanvas `zIndex` values against A13 permanent scale
   - **WorkspaceGrid pane seam:** pane card `borderRadius: 4` → `var(--io-radius)`; swap-source border `#F59E0B` → token; surface usage review
   - **Close auto-resolved items:** verify WorkspaceGrid `--io-bg` and DesignerCanvas `--io-error` render correctly, remove from open task list
   - **Cosmetic (low priority):** canvas border rgba, guide line colors, grid lines — evaluate and formally document as accepted or tokenize
3. Plan a separate consumer migration workstream (buttons.ts/inputs.ts adoption pass + DC-5 + FP-4/FP-6 at module-rebuild start) to precede the eight-module rebuild.
