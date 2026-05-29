---
id: ui-audit-preflight-facts-gather
title: UI Audit Preflight Facts Gathering
status: interim
created: 2026-05-28
last_updated: 2026-05-28
last_synced_with_code: 2026-05-28
work_units:
- 2026-05-28_preflight-info-gathering
implementation:
- ui-audit/00-preflight-facts.md
related:
- ui-audit-post-ab-claim-c-readiness
- claim-a-css-token-registry-gaps
- claim-b-dialog-promotion-migration
topics: []
aliases: []
keywords: []
covers: UI Audit Preflight Facts Gathering
---

# UI Audit Preflight Facts Gathering

Read-only investigation that gathered concrete evidence across six frontend areas to inform upcoming workstream plans. Results are written to `ui-audit/00-preflight-facts.md` (12,514 chars).

## Purpose

Answers six specific questions about the I/O frontend codebase state before finalizing Claim C and later workstream plans: theme implementation status, DesignerCanvas z-index distribution, alarm token completeness, react-grid-layout portal context, git workflow state, and `--io-surface-tertiary` usage scope.

## Behavior

The output artifact (`ui-audit/00-preflight-facts.md`) contains six sections, each with file-path-and-line-number evidence:

1. **Theme status** — whether `light` and `hphmi` CSS theme blocks in `index.css` have distinct real values or are placeholder copies of `dark`; whether a theme switcher exposes them in the UI.
2. **DesignerCanvas z-index inventory** — every `zIndex` / `z-index` / `--io-z-*` value in `DesignerCanvas.tsx` with line numbers, element context, and a distribution summary (below 100 / 100–999 / 1000+, tokens vs. hardcoded integers). Determines whether the ConfirmDialog-at-1000 stacking concern is real.
3. **Alarm token existence** — presence and per-theme values of `--io-alarm-urgent`, `--io-alarm-high`, `--io-alarm-low`, `--io-alarm-diagnostic`, `--io-alarm-custom`, `--io-alarm-inactive` in `index.css`; flags missing or identical-across-themes tokens.
4. **react-grid-layout portal context** — component-tree trace confirming whether `DesignerCanvas` is rendered inside a `react-grid-layout` ancestor (which would break `position:fixed` per the CLAUDE.md invariant); also confirms `WorkspaceGrid` uses react-grid-layout.
5. **Git and commit workflow** — current branch, uncommitted changes, confirming that `git diff HEAD`-based review hooks will behave correctly.
6. **surface-tertiary evidence** — reference count and locations for `--io-surface-tertiary` across the codebase; assessment of whether a genuine distinct tier is needed or `--io-surface-secondary` suffices.

Uncertainty is stated explicitly rather than inferred where evidence was absent.

## Implementation Notes

This work unit was purely investigative — no source code or existing audit artifacts were modified. All evidence was gathered via parallel grep/bash queries targeting:

- `frontend/src/index.css` — theme blocks and token definitions
- `frontend/src/pages/designer/DesignerCanvas.tsx` — z-index inventory
- `frontend/src/shared/theme/ThemeContext.tsx` — theme switcher logic
- `frontend/src/pages/profile/PreferencesTab.tsx` — user-facing theme setting
- `frontend/src/pages/designer/index.tsx` — DesignerCanvas mount context
- `frontend/src/pages/console/WorkspaceGrid.tsx` — react-grid-layout confirmation
- `frontend/src/pages/settings/PointManagement.tsx`, `Import.tsx` — surface-tertiary usage
- `frontend/src/shared/components/StatusBadge.tsx` — surface-tertiary usage

The six-section structure of `ui-audit/00-preflight-facts.md` maps directly to the six planning questions.

## Changelog

<!-- IGNORE UNLESS SPECIFICALLY ASKED TO REVIEW DOCUMENT HISTORY -->
### 2026-05-28
Wrapup pass: doc confirmed accurate against work unit log; no code changes occurred in this work unit. Work unit filename already present in work_units list.

### 2026-05-28
Initial creation. Describes the read-only preflight investigation work unit that produced `ui-audit/00-preflight-facts.md` with six evidence sections covering theme status, z-index distribution, alarm tokens, portal context, git state, and surface-tertiary scope.
