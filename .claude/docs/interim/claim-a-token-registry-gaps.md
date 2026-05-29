---
id: claim-a-token-registry-gaps
title: Claim A — Token Registry Gaps (index.css)
status: interim
created: 2026-05-27
last_updated: 2026-05-27
last_synced_with_code: 2026-05-27
work_units:
  - "2026-05-27_workstream-2b-token-gaps_read-ui-audit-_062420" # CORRECTED FROM CORRUPTED ENTRY
implementation:
  - frontend/src/index.css
  - frontend/src/pages/designer/components/PromoteToShapeWizard.tsx
  - frontend/src/shared/components/CommandPalette.tsx
  - frontend/src/shared/theme/tokens.ts
  - ui-audit/06-claim-a-plan.md
related:
  - claim-a-token-registry-gaps-zindex
---

# Claim A — Token Registry Gaps (index.css)

Fills the 14 Category A token registry gaps identified in the Claim A App Shell Convergence audit. All changes are additions or value corrections to `frontend/src/index.css`; 12 gaps were addressed, 2 were skipped with documented rationale.

## Purpose

The audit found that multiple CSS custom properties were referenced by Console, Designer, and Settings module code but not defined in `index.css`. Undefined tokens silently degrade to browser fallbacks or no-value, producing rendering inconsistencies across modules. This work unit defines those tokens so consumers resolve correctly, and corrects two mis-valued tokens (`--io-sidebar-width` and the z-index scale).

## Behavior

All tokens are defined across all three theme blocks (`[data-theme="dark"]` / `[data-theme="light"]` / `[data-theme="hphmi"]`) unless noted otherwise.

**Tokens added:**

| Token | Value | Notes |
|---|---|---|
| `--io-bg` | `var(--io-surface-primary)` | Per-theme |
| `--io-text` | `var(--io-text-primary)` | Per-theme |
| `--io-surface-hover` | `var(--io-surface-elevated)` | Per-theme |
| `--io-surface-raised` | `var(--io-surface-elevated)` | Per-theme |
| `--io-text-on-accent` | `var(--io-accent-foreground)` | Per-theme |
| `--io-error` | `var(--io-danger)` | Per-theme |
| `--io-overlay` | `var(--io-modal-backdrop)` | Per-theme; alias chain verified |
| `--io-accent-rgb` | `45 212 191` / `13 148 136` / `20 184 166` | Per-theme RGB triplet for dark/light/hphmi |
| `--io-alarm-inactive` | `#808080` | Per-theme, identical value |
| `--io-font-sans` | `"InterVariable", "Inter", -apple-system, …` | `:root` only; static across themes, matches `body` selector |

**Tokens corrected:**

| Token | Was | Now | Decision |
|---|---|---|---|
| `--io-sidebar-width` | `240px` | `220px` | Option A: align token to code convention, no module edits |
| `--io-z-dropdown` | `200` | `500` | Option B full scale |
| `--io-z-modal` | `300` | `1000` | Option B full scale |
| `--io-z-command` | `400` | `1200` | Corrected during post-review z-index pass |
| `--io-z-visual-lock` | `500` | `1500` | Raised above modal tier (lock screen must cover open dialogs) |
| `--io-z-kiosk-auth` | `600` | `1800` | Corrected during post-review z-index pass |
| `--io-z-toast` | `700` | `2000` | Option B full scale |
| `--io-z-emergency` | `800` | `3000` | Raised above toast tier |

**Tokens skipped:**

- `--io-accent-muted` (A8): Only consumer was `PromoteToShapeWizard.tsx:2168`; no shared pattern exists. Consumer updated to `var(--io-accent-subtle)` instead. Token not defined in `index.css`.
- `--io-text-inverse` (A12): Already defined in all three theme blocks; plan entry was incorrect.

## Implementation Notes

**`frontend/src/index.css`** — All new tokens are placed immediately after their nearest semantic neighbor within each theme block (e.g., surface aliases after `--io-surface`, text aliases after `--io-text-link`, status aliases after `--io-status-fg`). `--io-font-sans` lives in `:root` only alongside `--io-font-mono`, consistent with the static-font-stack pattern.

**`frontend/src/shared/theme/tokens.ts`** — JS token mirror updated to match the corrected z-index scale. Was stale at pre-A13 values after the initial index.css pass.

**`frontend/src/shared/components/CommandPalette.tsx`** — Hardcoded `z-index: 3000` / `3001` replaced with `var(--io-z-command)` / `calc(var(--io-z-command) + 1)`. Command palette now tracks the token scale.

**`frontend/src/pages/designer/components/PromoteToShapeWizard.tsx`** — Completed-step stepper color changed from `var(--io-accent-muted, #3b82f6)` to `var(--io-accent-subtle)`. No new token defined.

**Z-index scale rationale:** The old 200–800 band was below the values used by all real modal components (1000–9999 range), making the tokens non-functional. The new scale: sidebar/topbar=100, edge-hover=150, dropdown=500, modal=1000, command=1200, visual-lock=1500, kiosk-auth=1800, toast=2000, emergency=3000. `--io-z-visual-lock` is intentionally above `--io-z-modal` because LockOverlay is a full-screen lock screen that must render above any open dialog.

**Remaining z-index work for Claim B:** `--io-z-command` and `--io-z-kiosk-auth` are still orphaned tokens (no live component consumes them via the token — only CommandPalette was wired in this session). Full z-index reconciliation across all components is a Claim B task.

## Changelog

### 2026-05-27
Initial creation. Filled 10 undefined token gaps (A1–A7, A9–A11) and corrected 2 mis-valued tokens (A13 z-index scale, A14 sidebar width). Skipped A8 (consumer fix preferred) and A12 (already defined). Post-review z-index pass raised visual-lock and emergency to correct stacking order and wired CommandPalette to the command token. Updated `ui-audit/06-claim-a-plan.md` with per-item status flags.
