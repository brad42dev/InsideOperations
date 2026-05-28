# Claim B Constants Files — Pre-Phase-2 Checkin

**Date:** 2026-05-28  
**Overall-status:** clear-to-proceed

---

## Check 1 — Constants files created and marked done

All four files exist at `frontend/src/shared/styles/`:

| File | Status |
|------|--------|
| `buttons.ts` | Created; exports `btnPrimary`, `btnSecondary`, `btnDanger`, `btnSmall`, `buttonBaseClass` matching plan spec exactly |
| `buttons.css` | Created; `.io-btn:hover { opacity: 0.85 }` and `.io-btn:focus-visible { outline: 2px solid var(--io-accent); outline-offset: 2px }` |
| `inputs.ts` | Created; exports `inputStyle` (no `outline:none`; `boxSizing: border-box`; `--io-surface-sunken` bg) and `inputClassName` |
| `inputs.css` | Created; `input/select/textarea.io-input:focus-visible` rule |

Plan sections 1.1 and 1.2 are marked **DONE 2026-05-28** in `08-claim-b-plan.md`.

One minor plan typo was corrected during execution: `buttonHoverClass` → `buttonBaseClass` in the hover-state row of the divergence table. The constant name in the plan and in the code are now consistent.

The interim doc at `.claude/docs/interim/claim-b-shared-style-constants.md` exists and documents the deliverable including the known latent gap: `btnSmall` omits `fontWeight: 600` (plan spec block did not include it despite the divergence table recommending 600 for all variants). This needs resolution before `btnSmall` consumer migration.

---

## Check 2 — No scope creep

**Plan file diff:** 3 lines added, 3 lines removed — net zero. Additions are exactly: two DONE markers (1.1, 1.2) and the `buttonHoverClass` → `buttonBaseClass` typo fix. No other content changed.

**Section 6 (deferred candidates):** DC-1 through DC-6 only — identical to the committed plan. No new candidates added during execution.

**No out-of-scope files modified.** `git diff --name-only HEAD` (excluding `.claude/`) shows only `ui-audit/08-claim-b-plan.md`. The `frontend/src/shared/styles/` directory is new/untracked (the four constants files). No other frontend or backend files touched.

---

## Check 3 — Ready for component promotions

All four base locations confirmed present and unmodified:

| Phase | Component | Base location | Status |
|-------|-----------|---------------|--------|
| Phase 2 | FieldLabel | `frontend/src/pages/designer/DesignerRightPanel.tsx:201` — local `function FieldLabel` present | Intact |
| Phase 3 | StatusBadge | `frontend/src/pages/settings/Import.tsx:72` — local `function StatusBadge` present | Intact |
| Phase 4 | Dialog | `frontend/src/shared/components/ConfirmDialog.tsx` — ConfirmDialog uses Radix Dialog; implementation model intact | Intact |
| Phase 5 | ConfirmDialog | `frontend/src/shared/components/ConfirmDialog.tsx` — unpatched (z-index 100/101, surface-secondary bg, "10px" radius) | Intact, awaiting Phase 5 |

`FieldLabel.tsx`, `StatusBadge.tsx`, and `Dialog.tsx` do not yet exist in `shared/components/` — correct, Phase 2–4 have not started.

---

## Check 4 — No canvas-layer changes

Canvas-layer files untouched: `DesignerCanvas.tsx`, `WorkspaceGrid.tsx`, `SceneRenderer.tsx`, `alarmFlash.css`, `operationalState.css`, `lod.css` — none appear in `git diff` or `git status`. Scope boundary held.

---

## Overall-status: clear-to-proceed

Phase 1 (constants files) is complete and correct. Phase 2 (FieldLabel) can begin immediately — the base location is intact, no dependencies on Phase 1.
