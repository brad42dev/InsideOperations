---
id: frontend-ui-audit-console-designer-settings
title: Frontend UI Audit — Console, Designer, Settings
status: interim
created: 2026-05-27
last_updated: 2026-05-27
last_synced_with_code: 2026-05-27
work_units:
  - 2026-05-27_read-only-task-do-not-analyze-ui-or-ux-y_003908
implementation:
  - ui-audit/00-inventory.md
  - ui-audit/00b-audit-plan.md
  - ui-audit/01-console.md
  - ui-audit/01-console-verification.md
  - ui-audit/01-designer-pass1.md
  - ui-audit/01-designer-pass1-supplement.md
  - ui-audit/01-designer-pass2.md
  - ui-audit/01-designer-pass3.md
  - ui-audit/01-designer.md
  - ui-audit/01-settings-pass1.md
  - ui-audit/01-settings-pass2.md
  - ui-audit/01-settings.md
  - ui-audit/02-comparison.md
  - ui-audit/02b-sanity-sweep.md
  - ui-audit/03-verification.md
  - ui-audit/03c-pre-reconciliation.md
  - ui-audit/04-recommendations.md
  - .claude/docs/interim/frontend-ui-audit-console-designer-settings.md
related:
  - frontend-ui-audit-app-shell
---

# Frontend UI Audit — Console, Designer, Settings

A multi-phase read-only audit of the Console, Designer, and Settings frontend modules, covering eleven UI element categories per module, cross-module comparison, source-code-verified claim reconciliation, and architecture recommendations. All design documentation was treated as stale; code was the sole source of truth.

## Purpose

Establishes ground truth for the current visual and structural state of three primary modules — Console, Designer, and Settings — as a prerequisite for a UI consistency and design-system standardisation effort. The audit produces a verified, reconciled comparison of how each module implements colours, typography, toolbars, menus, side panels, buttons, form inputs, status indicators, labels, canvases, and dialogs, and recommends a convergence path.

## Behavior

The audit ran in phases:

1. **Inventory** (`00-inventory.md`): Four sections — console-files, designer-files, settings-files, app-shell-files — each listing file path, one-line purpose, and module-specific vs. shared classification with evidence.

2. **Audit plan** (`00b-audit-plan.md`): Sizing recommendation per module. Console: single pass (27 files, ~8 k LOC). Designer: three passes (DesignerCanvas is 12 k lines; DesignerRightPanel is ~6 k lines). Settings: two passes (~43 k LOC but uniform CRUD pattern).

3. **Per-module audits** — eleven categories each, five fields each (implementation type, source-of-truth files with line numbers, concrete visual properties, deviations from app shell, notes):
   - `01-console.md` — single pass; corrected after verification (category 5 panel resize, category 10 GRID\_SCALE 24 / GRID\_COLS 288).
   - `01-designer.md` — consolidated from three passes plus a supplement that filled in categories 6, 8, 9 that the first pass missed. Intermediate files: `01-designer-pass1.md`, `01-designer-pass1-supplement.md`, `01-designer-pass2.md`, `01-designer-pass3.md`.
   - `01-settings.md` — consolidated from two passes (`01-settings-pass1.md`, `01-settings-pass2.md`); category 10 (canvas) is N/A for Settings.

4. **Cross-module comparison** (`02-comparison.md`): One table per category (eleven tables), columns Console / Designer / Settings / Shared-across-all-three / Notes, rows matching the five audit fields. Also contains three summary lists: elements already consistent, elements inconsistent with a one-sentence description, and elements where one module is the best candidate for convergence. The comparison file is the authoritative post-reconciliation source; per-module audit files were not retroactively corrected.

5. **Verification** (`03-verification.md`): Claims in the comparison file checked against actual source code. Found 11 discrepancies, primarily false "undefined token" assertions. Four shared CSS files were missing from the comparison entirely: `selection.css`, `MarqueeLayer.tsx`, `alarmFlash.css`, `operationalState.css`, `lod.css`.

6. **Pre-reconciliation** (`03c-pre-reconciliation.md`): Upstream audit consistency check (located the same systematic false-undefined claims in per-module files) plus five-field detail gathering for the missing shared CSS files.

7. **Reconciled comparison** (`02-comparison.md` rewritten): All 11 verification discrepancies applied, 3 additional token-status corrections applied, shared CSS files added as "Shared infrastructure" subsections in affected category tables. `operationalState.css` flagged explicitly as intentional ISA-101 hardcoded colours — documented exception, not a gap. Reconciliation log appended.

8. **Sanity sweep** (`02b-sanity-sweep.md`): Confirmed three additional token corrections landed, shared-infrastructure structure was consistent across tables, operationalState.css framing was preserved, and the meta-entry noting the comparison file as authoritative was present. Status: clear-to-proceed.

9. **Recommendations** (`04-recommendations.md`): Four sections — target architecture (refined from hypothesis), per-category convergence recommendations (which existing implementation to adopt or whether to build new), rough migration order with dependency notes, risks and unknowns.

## Implementation Notes

All audit artefacts live under `ui-audit/` at the project root. This directory is not part of the compiled application; it is a reference corpus for the design-system effort.

**Key findings (brief)**:
- The `--io-*` CSS custom property system in `src/index.css` is the intended token authority; the JS mirror in `src/shared/theme/tokens.ts` is for runtime access.
- Several tokens referenced in module code do not exist in `index.css`: `--io-text-on-accent` (no definition anywhere), `--io-surface-raised`, `--io-surface-hover`, `--io-accent-muted`, `--io-font-sans`.
- `selection.css` references `--accent` (no `io-` prefix) — unresolved whether intentional alias or error.
- `operationalState.css` intentionally uses `!important` hardcoded ISA-101 state colours; this is by design and should not be tokenised.
- Designer has the most deviation from app-shell tokens; Settings is the most uniform but contains `BulkUpdate.tsx` with its own independent button colour system.
- Dialog ARIA coverage is inconsistent across modules and across dialogs within modules.

**Audit scope caveat**: DesignerCanvas (12 k lines), DesignerRightPanel (6 k lines), PromoteToShapeWizard (~2.4 k lines), and ShapeDropDialog (~2.3 k lines) were sampled rather than read fully; findings for those files may be incomplete.

**Authoritative files for downstream work**:
- `02-comparison.md` — reconciled cross-module comparison (not the per-module files, which retain some pre-correction claims)
- `04-recommendations.md` — convergence plan and migration order

## Changelog

<!-- IGNORE UNLESS SPECIFICALLY ASKED TO REVIEW DOCUMENT HISTORY -->
### 2026-05-27
Wrapup completed for work unit. Added intermediate Designer and Settings pass files to implementation list (`01-designer-pass1.md`, `01-designer-pass1-supplement.md`, `01-designer-pass2.md`, `01-designer-pass3.md`, `01-settings-pass1.md`, `01-settings-pass2.md`). Added this doc itself to implementation list. Clarified in Implementation Notes which files are authoritative for downstream work. Summary and shallow review generated by wrapup scripts.

### 2026-05-27
Initial creation. Documents the complete UI audit sequence for Console, Designer, and Settings — inventory through reconciled comparison and recommendations. Audit artefacts written to `ui-audit/`. The reconciled `02-comparison.md` is the authoritative source for all downstream design-system work.
