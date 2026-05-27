---
id: claim-a-token-registry-gaps-zindex
title: Claim A — Token Registry Gaps and Z-Index Scale
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
  - claim-a-css-token-registry-gaps
---

# Claim A — Token Registry Gaps and Z-Index Scale

Fills all 14 Category A token registry gaps from the Claim A audit plan and resolves z-index ordering conflicts uncovered during post-implementation review. All changes are additive to `index.css`; no existing tokens were removed.

## Purpose

The audit identified 14 missing or misvalued CSS custom properties referenced by shell-layer code across Console, Designer, and Settings but undefined in `index.css`. Undefined tokens cause silent rendering failures (browser treats them as `initial`). This work unit defines them so all consumer references now resolve, and simultaneously corrects the z-index scale to match actual usage patterns across the three modules.

## Behavior

### New alias tokens (all three themes)
Each token below is now defined per-theme in `:root`/`[data-theme="dark"]`, `[data-theme="light"]`, and `[data-theme="hphmi"]`:

| Token | Value |
|---|---|
| `--io-bg` | `var(--io-surface-primary)` |
| `--io-text` | `var(--io-text-primary)` |
| `--io-surface-hover` | `var(--io-surface-elevated)` |
| `--io-surface-raised` | `var(--io-surface-elevated)` |
| `--io-text-on-accent` | `var(--io-accent-foreground)` |
| `--io-error` | `var(--io-danger)` |
| `--io-overlay` | `var(--io-modal-backdrop)` |
| `--io-alarm-inactive` | `#808080` (identical across all themes) |

### New per-theme tokens
- `--io-accent-rgb`: space-separated RGB for use in `rgba(var(--io-accent-rgb) / 0.x)` constructs. Values: dark=`45 212 191`, light=`13 148 136`, hphmi=`20 184 166`.

### New static token (`:root` only)
- `--io-font-sans`: `"InterVariable", "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif` — matches the `body` selector font stack exactly, same pattern as `--io-font-mono`.

### Value corrections (all three themes)
- `--io-sidebar-width`: 240px → **220px** (aligns token to actual module code; no module file changes needed)
- `--io-z-dropdown`: 200 → **500**
- `--io-z-modal`: 300 → **1000**
- `--io-z-toast`: 700 → **2000**
- `--io-z-visual-lock`: 500 → **1500** (above modal, below toast; preserves lock-screen-above-dialog invariant)
- `--io-z-emergency`: 800 → **3000** (above toast; preserves semantic ordering)

### Skipped items
- **A8 (`--io-accent-muted`)**: Token used in exactly one place (`PromoteToShapeWizard.tsx:2168`). No new token defined; that consumer was updated directly to `var(--io-accent-subtle)`.
- **A12 (`--io-text-inverse`)**: Already defined in all three theme blocks. The plan entry was incorrect.

## Implementation Notes

**`frontend/src/index.css`**: All new and corrected tokens are placed in consistent positions within each theme block — aliases follow their parent token groups (e.g., `--io-bg` after the surface group, `--io-text` after the text group). `--io-font-sans` is defined once in `:root` alongside `--io-font-mono`; font stacks are static across themes. The `--io-accent-rgb` comment in the dark theme block documents the light and HPHMI values for maintainers.

**Z-index ordering (final scale)**:
```
--io-z-base:        0
--io-z-panel:      10
--io-z-sidebar:   100
--io-z-topbar:    100
--io-z-edge-hover: 150
--io-z-command:    400   (not consumed by live code; CommandPalette hardcodes 3000/3001)
--io-z-dropdown:   500
--io-z-kiosk-auth: 600   (not consumed by live code)
--io-z-modal:     1000
--io-z-visual-lock: 1500
--io-z-toast:     2000
--io-z-emergency: 3000
```

`--io-z-command` and `--io-z-kiosk-auth` are defined but consumed by no live component (CommandPalette uses hardcoded values). Their ordering relative to the new scale should be reconciled in Claim B.

**`PromoteToShapeWizard.tsx:2168`**: Stepper completed-step fill changed from `"var(--io-accent-muted, #3b82f6)"` to `"var(--io-accent-subtle)"`. The fallback was info-blue (`#3b82f6`), inconsistent with the teal accent system; `--io-accent-subtle` is the correct visual tier for a faded completed state.

**Claim B dependency**: Full z-index reconciliation (migrating hardcoded `zIndex` integers in component code to use these tokens) is deferred to Claim B. The token values are now stable.

## Changelog

<!-- IGNORE UNLESS SPECIFICALLY ASKED TO REVIEW DOCUMENT HISTORY -->
### 2026-05-27
Initial creation. Documents all 14 Category A token registry changes from workstream-2b-token-gaps: 12 tokens added/corrected, 2 skipped (A8 consumer-fixed, A12 already defined). Records final z-index scale including post-review fixes to `--io-z-visual-lock` and `--io-z-emergency`.
