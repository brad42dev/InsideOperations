---
id: claim-b-shared-style-constants
title: Claim B — Shared Style Constants (buttons, inputs)
status: interim
created: 2026-05-28
last_updated: 2026-05-28
last_synced_with_code: 2026-05-28
work_units:
- 2026-05-28_workstream-3b-constants-files
implementation:
- frontend/src/shared/styles/buttons.ts
- frontend/src/shared/styles/buttons.css
- frontend/src/shared/styles/inputs.ts
- frontend/src/shared/styles/inputs.css
related:
- claim-a-css-token-registry-gaps
- frontend-ui-audit-console-designer-settings
topics:
- ui-framework
aliases: []
keywords: []
covers: Claim B — Shared Style Constants (buttons, inputs)
---

# Claim B — Shared Style Constants (buttons, inputs)

Phase 1 of the Claim B UI framework convergence. Creates shared style object constants for buttons and inputs at `frontend/src/shared/styles/`, replacing the per-module duplicates that exist today in Console, Designer, and Settings. No consumers migrated yet — these are pure additions.

## Purpose

Three modules (Console, Designer, Settings) each maintain their own inline button and input style objects, leading to visual inconsistencies: hardcoded hex colors, integer border-radii, missing focus rings, and non-canonical token references. This phase establishes canonical shared constants so future consumer migrations have a single source of truth to import from.

## Behavior

**buttons.ts** exports four style object variants typed as `CSSProperties`:
- `btnPrimary` — `var(--io-accent)` background, `var(--io-accent-foreground)` text, `8px 16px` padding, `var(--io-radius)` border-radius, 13px/600
- `btnSecondary` — transparent background, `var(--io-text-secondary)` text, `1px solid var(--io-border)` border, same sizing as primary, fontWeight 600
- `btnDanger` — transparent background, `var(--io-danger)` text and border
- `btnSmall` — `4px 10px` padding, 12px font, no fontWeight (spec block omits it; latent gap vs. divergence table)
- `buttonBaseClass = "io-btn"` — string constant; consumers spread this as `className` alongside the style object

**buttons.css** handles pseudo-class rules that inline styles cannot express:
- `.io-btn:hover { opacity: 0.85 }`
- `.io-btn:focus-visible { outline: 2px solid var(--io-accent); outline-offset: 2px }`

**inputs.ts** exports:
- `inputStyle` — `width: 100%`, `8px 10px` padding, `var(--io-surface-sunken)` background, `1px solid var(--io-border)` border, `var(--io-radius)` border-radius, `var(--io-text-primary)` color, 13px, `boxSizing: border-box`. No `outline: none` — accessibility preserved.
- `inputClassName = "io-input"` — string constant; consumers spread this as `className`

**inputs.css** provides the accessible focus ring:
- `input.io-input:focus-visible, select.io-input:focus-visible, textarea.io-input:focus-visible { outline: 2px solid var(--io-accent); outline-offset: 0; border-color: var(--io-accent); }`

**Both CSS companion files are currently inert** — they are not imported anywhere. They take effect only when a consumer migration imports them alongside the `.ts` file.

## Implementation Notes

All CSS custom property tokens were verified present in `frontend/src/index.css` before the files were written (`--io-accent`, `--io-accent-foreground`, `--io-text-secondary`, `--io-border`, `--io-danger`, `--io-radius`, `--io-surface-sunken`, `--io-text-primary`).

The `shared/styles/` directory was created new for this workstream; it had no prior contents.

**Consumer pattern:** Each consumer must spread both the style object and the className to get full behavior:
```tsx
import { btnPrimary, buttonBaseClass } from "@/shared/styles/buttons";
import "@/shared/styles/buttons.css";

<button style={btnPrimary} className={buttonBaseClass}>Save</button>
```

**DesignerRightPanel compact inputs** (`padding: 4px 7px`, `fontSize: 12`) are intentionally excluded from migration to `inputStyle` — those are inspector panel inputs where vertical space is at a premium.

**`btnSmall` omits `fontWeight`** — the plan's spec block does not include it, even though the divergence table says "align all variants: 600". This is a known latent inconsistency in the plan; the code faithfully implements the spec block. Needs resolution before consumer migration of `btnSmall` callers.

Token choices with non-obvious rationale:
- `var(--io-surface-sunken)` preferred over `var(--io-input-bg)` for inputs — both resolve to the same value; `--io-surface-sunken` is the canonical form
- `var(--io-accent-foreground)` preferred over `var(--io-text-on-accent)` for primary button text — `--io-text-on-accent` is a Claim A alias; canonical form preferred

## Changelog

<!-- IGNORE UNLESS SPECIFICALLY ASKED TO REVIEW DOCUMENT HISTORY -->
### 2026-05-28
Created. Documents the Phase 1 constants-files deliverable of the Claim B workstream: four new files in `frontend/src/shared/styles/` (buttons.ts, buttons.css, inputs.ts, inputs.css). No consumers migrated. Plan file `ui-audit/08-claim-b-plan.md` sections 1.1 and 1.2 marked DONE.
