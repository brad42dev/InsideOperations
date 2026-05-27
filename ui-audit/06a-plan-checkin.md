# Plan Check-In — Claim A Work Plan (06-claim-a-plan.md)

**Date:** 2026-05-27
**Reviewed files:** 06-claim-a-plan.md, 02-comparison.md, 04-recommendations.md, 05-claim-c-deferral.md
**Overall status:** **clear-to-proceed** (two minor notes, no blockers)

---

## Check 1 — Scope alignment

Verified: every Section 1 change cites at least one specific row in 02-comparison.md or section in 04-recommendations.md. All 18 items pass.

| Item | Citation(s) | Verdict |
|------|-------------|---------|
| A1 `--io-bg` | 02 Cat 1 Console Deviations ✓; 04 Cat 1 Define missing tokens ✓ | OK |
| A2 `--io-text` | 02 Cat 1 Console+Designer Deviations ✓; 02 Cat 9 Console+Designer Deviations ✓; 04 Cat 1 ✓ | OK |
| A3 `--io-surface-hover` | 02 Cat 4 Designer Deviations ✓; 04 Cat 1 ✓ | OK |
| A4 `--io-font-sans` | 02 Cat 1 Designer Deviations ✓; 02 Cat 4 Designer Deviations ✓; 04 Cat 1 ✓ | OK |
| A5 `--io-text-on-accent` | 02 Cat 1 Settings Deviations ✓; 02 Cat 6 Settings Deviations ✓; 04 Cat 1 ✓ | OK |
| A6 `--io-error` | 02 Cat 10 Designer Deviations ✓; 02 List 2 #7 ✓; 04 Cat 1 ✓ | OK |
| A7 `--io-surface-raised` | 02 Cat 7 Designer Deviations ✓; 02 List 2 #7 ✓ | OK — minor note below |
| A8 `--io-accent-muted` | 02 List 2 #7 ✓ | OK — minor note below |
| A9 `--io-overlay` | 02 Cat 11 Settings Deviations ✓; 02 List 2 #7 ✓ | OK |
| A10 `--io-accent-rgb` | 02 List 2 #7 ✓ | OK |
| A11 `--io-alarm-inactive` | 04 Cat 8 actions ✓; 05 Section 3.1 ✓ | OK |
| A12 `--io-text-inverse` | 04 Cat 10 actions ✓; 05 Section 3.4 ✓ | OK |
| A13 `--io-z-modal` | 04 Cat 11 actions ✓; 04 Risk R1 ✓; 02 List 2 #11 ✓ | OK |
| A14 `--io-sidebar-width` | 02 Cat 5 Console+Settings+Designer Deviations ✓; 04 Cat 5 ✓ | OK |
| B1 Designer palette bg | 02 Cat 5 Designer Deviations ✓; 04 Cat 5 ✓ | OK |
| B2 Settings active nav | 02 Cat 5 Settings Deviations ✓; 04 Cat 5 ✓ | OK |
| B3 Sidebar width code | 02 Cat 5 all modules ✓; 04 Cat 5 ✓ | OK |
| B4 Settings letterSpacing | 02 Cat 2 Settings Deviations ✓; 02 Cat 5 ✓; 04 Cat 2 typography table ✓; 04 Cat 5 ✓ | OK |

**Minor notes (not blockers):**

- **A7**: 04 Cat 1 does not list `--io-surface-raised` in "Define missing tokens." The 04 guidance is in Cat 5: "Fix: Designer `CanvasLayerRow` `--io-surface-raised` undefined → use `var(--io-surface-elevated)`" — which prescribes replacing the reference rather than adding an alias. The plan takes the alias approach (define the token), which is a legitimate choice but diverges from 04 Cat 5's prescription. The implementer should be aware of this difference; both approaches reach the same visual outcome.

- **A8**: `--io-accent-muted` does not appear in 04 at all — the research step in the plan is self-justified from 02 List 2 #7 alone. No unsupported scope, but there is no 04 recommendation governing the target value; the plan correctly gates this on a grep step.

**No unsupported changes found.**

---

## Check 2 — Exclusion compliance

Excluded files per 05 Section 4:
- `SceneRenderer.tsx` and related files
- `alarmFlash.css`
- `operationalState.css`
- `lod.css`
- `WorkspaceGrid.tsx` / `WorkspaceGrid.css`
- `DesignerCanvas.tsx`

Excluded categories: Category 10 entries in `02-comparison.md` — no new changes.

Checked all 18 plan items:

- **A1–A14**: All changes are additions to `index.css` only. No excluded file is touched.
- **B1**: `DesignerLeftPalette.tsx` — not excluded. ✓
- **B2**: `Settings/index.tsx` — not excluded. ✓
- **B3**: `ConsolePalette.tsx`, `Settings/index.tsx`, `DesignerLeftPalette.tsx` — none excluded. ✓
- **B4**: `Settings/index.tsx` — not excluded. ✓

Three plan items (A6, A11, A12) explicitly name excluded files as *consumers* of the tokens being defined but do not plan any changes to those files. The plan is clear on this boundary:

- A6 note: "referenced in DesignerCanvas context menu (Claim C file, but token definition is Claim A)"
- A11 note: "needed by `alarmFlash.css` off-state hex migration (Claim C work)"
- A12 note: "needed by DesignerCanvas resize handle fix (Claim C work)"

Section 5.1 discusses Claim C implications but plans no Claim C actions.

DoD criterion 8 lists only Cat 1 and Cat 5 rows for annotation — no Cat 10 updates planned.

**No exclusion violations found.**

---

## Check 3 — Sequencing soundness

Token work (Passes 1–3) precedes shell drift work (Pass 4). Confirmed.

Checked each Pass 4 item for token dependencies:

| Drift item | Tokens referenced | Registered before Pass 4? |
|------------|-------------------|--------------------------|
| B1 `var(--io-surface-secondary)` | `--io-surface-secondary` | Yes — already registered in index.css; no Pass 1–3 dependency |
| B2 `var(--io-accent)` | `--io-accent` | Yes — already registered; no Pass 1–3 dependency |
| B3 hardcoded 220px or token | `--io-sidebar-width` | Token already exists; if 240px chosen, only raw integer changes in code |
| B4 `letterSpacing: 0.06em` | None — raw value | N/A |

The plan states this explicitly in Section 3: "`--io-surface-secondary` and `--io-accent` ARE registered, so B1–B4 are not blocked." This is accurate — no Pass 4 item depends on a Pass 1–3 addition.

**No drift item references a token absent from the token-work portion of the plan. Sequencing is sound.**

---

## Check 4 — Multi-module flags

Items requiring explicit user review before execution, as flagged in Section 2:

1. **A13 — `--io-z-modal` value** (Pass 3, step 13)
   - Scope: Shell layer; all current and future modules that render dialogs.
   - Options: (a) raise to 1000 only; (b) define full scale (`--io-z-dropdown: 500`, `--io-z-modal: 1000`, `--io-z-toast: 2000`).
   - Risk: 04 Risk R1 — a z-index audit across all `zIndex` values in the frontend is recommended before setting definitive values, because incomplete migration can cause layer-ordering failures in edge cases. Claim B dialog migration will reference these tokens; setting an incorrect scale is harder to fix after migration.

2. **A14 — `--io-sidebar-width` decision** (Pass 3, step 14)
   - Scope: Shell layer; all current and future modules with a side panel.
   - Options: (a) update token to 220px — no code changes beyond index.css; (b) keep token at 240px — update `ConsolePalette.tsx`, `Settings/index.tsx` aside, `DesignerLeftPalette.tsx` (3 files).
   - Note from plan: "One Claim A item must be resolved before any of the eight modules begins panel-layout work" (Section 5.2). This is a blocking prerequisite for rebuilt-module panel layout.

No other items are flagged for user review. B3's code changes are conditional on the A14 decision but require no separate review beyond it.

---

## Check 5 — Completion criteria concreteness

Section 4 has eight criteria. All are objectively verifiable with one minor ambiguity:

| # | Criterion | Verdict |
|---|-----------|---------|
| 1 | Zero undefined token references — ten specific tokens listed; grep confirms. References "shell-layer files" without enumerating them. | **Minor ambiguity**: "shell-layer files" is not defined. The token set itself is specific; the implementer will need to decide whether to grep only `index.css` + sidebar + topbar or the full frontend. Suggest clarifying as "all files in `src/` that reference at least one of the ten tokens" or simply "no unresolved references anywhere in the frontend." |
| 2 | `--io-alarm-inactive` and `--io-text-inverse` exist in index.css. | Concrete. ✓ |
| 3 | `--io-z-modal` ≥ 1000, consistent with chosen scale. | Concrete (binary check once A13 is decided). ✓ |
| 4 | Token value and all three modules' hardcoded widths identical (all 220px or all 240px). | Concrete — code-level check. ✓ |
| 5 | Visual inspection confirms DesignerLeftPalette at same surface tier as ConsolePalette and Settings sidebar. | Adequate — backed by a specific token (`--io-surface-secondary`); a grep also verifies it. ✓ |
| 6 | Visual inspection confirms 2px teal left border on active Settings nav item. | Concrete — specific pixel value and token. ✓ |
| 7 | Settings nav group `letterSpacing` is 0.06em — code-level check. | Concrete. ✓ |
| 8 | `02-comparison.md` Cat 1 and Cat 5 rows annotated with fix date and commit/PR. | Concrete — specific rows enumerated. ✓ |

**One criterion with minor ambiguity:** Criterion 1 — "shell-layer files" not enumerated. Not a blocker; the implementer can resolve this by scoping the grep to the entire frontend, which is the safer interpretation.

---

## Summary

| Check | Result |
|-------|--------|
| 1 — Scope alignment | All 18 changes supported. Two minor notes (A7 approach diverges from 04 Cat 5; A8 has no 04 precedent). |
| 2 — Exclusion compliance | Clean. No excluded files touched. Token-definition-for-Claim-C items correctly scoped to index.css. |
| 3 — Sequencing soundness | Sound. B1–B4 reference only already-registered tokens or raw values; no Pass 4 item depends on a Pass 1–3 addition. |
| 4 — Multi-module flags | Two items require user review: **A13** (z-index scale) and **A14** (sidebar width). Both are in Pass 3. |
| 5 — Completion criteria | Concrete with one minor exception: Criterion 1 leaves "shell-layer files" undefined. Suggest clarifying to "anywhere in the frontend." |

**Overall status: clear-to-proceed**

The plan is internally consistent, has no exclusion violations, sequences correctly, and has two decision points (A13, A14) that the user must resolve before Pass 3 work begins. No rework of the plan is required.
