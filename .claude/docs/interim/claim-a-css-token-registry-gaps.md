---
id: claim-a-css-token-registry-gaps
title: Claim A — CSS Token Registry Gaps
status: interim
created: 2026-05-27
last_updated: 2026-05-27
last_synced_with_code: 2026-05-27
work_units:
  - 2026-05-27_workstream-2b-token-gaps\n\nread-ui-audit-_062420
implementation:
  - frontend/src/index.css
  - frontend/src/pages/designer/components/PromoteToShapeWizard.tsx
  - ui-audit/06-claim-a-plan.md
related:
  - claim-a-plan
  - claim-c-deferral
---

# Claim A — CSS Token Registry Gaps

Fourteen Category A token gaps were identified in `index.css` by the Claim A UI audit workstream. Twelve were filled in this work unit (2026-05-27); one was skipped as already defined (A12); one was resolved by patching the single consumer instead of defining a new token (A8).

## Purpose

The I/O design system token registry (`frontend/src/index.css`) contained references to CSS custom properties that were used across Console, Designer, and Settings module code but never defined. Undefined tokens silently fall through to browser defaults or explicit fallback values, causing invisible rendering gaps. This work unit filled all resolvable gaps and established the official z-index scale and sidebar width values as shell-layer conventions for all 11 current and future modules.

## Behavior

All tokens are defined on `:root, [data-theme="dark"]`, `[data-theme="light"]`, and `[data-theme="hphmi"]` unless noted otherwise:

- **Alias tokens** (most of the set) forward to existing primitives: `--io-bg → --io-surface-primary`, `--io-text → --io-text-primary`, `--io-surface-hover / --io-surface-raised → --io-surface-elevated`, `--io-text-on-accent → --io-accent-foreground`, `--io-error → --io-danger`, `--io-overlay → --io-modal-backdrop`.
- **`--io-accent-rgb`** is a per-theme space-separated RGB triplet for use in modern `rgba(var(--io-accent-rgb) / alpha)` syntax: dark=`45 212 191`, light=`13 148 136`, hphmi=`20 184 166`. Must be kept in sync with `--io-accent` if accent hues change.
- **`--io-alarm-inactive`** is `#808080` across all three themes (ISA-18.2 off-state gray; same value theme-wide).
- **`--io-font-sans`** is defined in `:root` only (static across themes, same pattern as `--io-font-mono`). Matches the `body` selector font stack exactly.
- **`--io-sidebar-width`** was corrected from 240px to 220px in all three theme blocks. 220px is the convention all three modules already hardcode; no module code changes were needed.
- **Z-index scale** was updated to a realistic range: `--io-z-dropdown: 500`, `--io-z-modal: 1000`, `--io-z-toast: 2000`, `--io-z-emergency: 3000`. `--io-z-visual-lock` was raised to 1500 (above modals, below toast) to maintain lock-screen semantics. `--io-z-command` (400) and `--io-z-kiosk-auth` (600) are defined but consumed by no component as of this date.
- **A8 (`--io-accent-muted`):** No token defined. The single usage site (`PromoteToShapeWizard.tsx:2168`, completed-step color in a stepper) was changed from `var(--io-accent-muted, #3b82f6)` to `var(--io-accent-subtle)`.
- **A12 (`--io-text-inverse`):** Already defined in all three theme blocks; the audit's "not yet defined" claim was incorrect. No action taken.

## Implementation Notes

All token additions follow the existing block structure in `index.css`: alias/derived tokens are grouped by semantic category within each theme block. The z-index block is duplicated across all three theme blocks (same values in each) because `index.css` uses per-theme selector blocks rather than a single shared `:root` for non-color tokens.

The `--io-z-visual-lock` / `--io-z-dropdown` collision (both were 500 after A13) was caught in post-implementation review and resolved immediately by raising `--io-z-visual-lock` to 1500. The `--io-z-command` and `--io-z-kiosk-auth` tokens are orphaned (no component references them); their values are left as-is pending a Claim B z-index audit.

The consumer change in `PromoteToShapeWizard.tsx` is the only non-`index.css` file modified. It was authorized mid-session by the user.

## Changelog

<!-- IGNORE UNLESS SPECIFICALLY ASKED TO REVIEW DOCUMENT HISTORY -->
### 2026-05-27
Initial creation. Documents the token registry gap fills completed in workstream-2b: 12 tokens added to `index.css` (A1–A7, A9–A11, A13–A14), A12 skipped (already defined), A8 resolved via consumer patch in `PromoteToShapeWizard.tsx`. Includes z-index scale adoption and sidebar width decision.
