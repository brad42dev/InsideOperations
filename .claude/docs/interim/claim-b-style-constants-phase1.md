---
id: claim-b-style-constants-phase1
title: Claim B Style Constants — Phase 1 (Buttons and Inputs)
status: interim
created: 2026-05-28
last_updated: 2026-05-28
last_synced_with_code: 2026-05-28
work_units:
  - 2026-05-28_workstream-3b-constants-files\nread-ui-a_024054
implementation:
  - frontend/src/shared/styles/buttons.ts
  - frontend/src/shared/styles/buttons.css
  - frontend/src/shared/styles/inputs.ts
  - frontend/src/shared/styles/inputs.css
related:
  - claim-b-shared-style-constants
---

# Claim B Style Constants — Phase 1 (Buttons and Inputs)

Two TypeScript constants files and companion CSS files providing shared button variant style objects and input styling for the I/O frontend. Pure additions with no consumer migrations; they establish the shared foundation for the Claim B UI convergence workstream.

## Purpose

Eliminate per-module duplication of button and input style definitions across Console, Designer, and Settings modules. The three modules previously defined equivalent style objects independently with inconsistent values (hardcoded colors, integer radii, missing tokens). These files provide a single authoritative source that consumer files can import and spread as inline styles.

## Behavior

### buttons.ts / buttons.css

- Exports four named `CSSProperties` variants: `btnPrimary`, `btnSecondary`, `btnDanger`, `btnSmall`
- Exports `buttonBaseClass = "io-btn"` — consumers spread this as `className` to pick up pseudo-class rules from `buttons.css`
- `buttons.css` provides `.io-btn:hover { opacity: 0.85 }` and `.io-btn:focus-visible { outline: 2px solid var(--io-accent); outline-offset: 2px }` — pseudo-class rules that cannot be expressed as inline style objects
- All variants use `var(--io-accent-foreground)` (canonical) for primary text color, `var(--io-radius)` for border radius, `var(--io-border)` for secondary/danger borders
- `btnSmall` omits `fontWeight: 600` — follows the plan's explicit spec block; the divergence table's "align all variants" note was not treated as authoritative over the spec

### inputs.ts / inputs.css

- Exports a single `inputStyle: CSSProperties` — `width: 100%`, `padding: 8px 10px`, `background: var(--io-surface-sunken)`, `border: 1px solid var(--io-border)`, `borderRadius: var(--io-radius)`, `color: var(--io-text-primary)`, `fontSize: 13px`, `boxSizing: border-box`
- Exports `inputClassName = "io-input"` — consumers spread as `className` for the focus ring
- `inputs.css` provides `:focus-visible` ring (`outline: 2px solid var(--io-accent)` + `border-color: var(--io-accent)`) for `input.io-input`, `select.io-input`, `textarea.io-input`
- Intentionally omits `outline: none` — accessibility fix; the prior cross-module pattern of suppressing the focus ring with no replacement is corrected here by providing a visible styled ring instead

**Caveat — CSS companions are inert until imported.** Neither `buttons.css` nor `inputs.css` is imported by any file yet. Vite will not bundle them and the class rules have no effect. The first consumer migration in each category must import both the `.ts` and `.css` files together.

## Implementation Notes

- All referenced CSS custom properties (`--io-accent`, `--io-accent-foreground`, `--io-border`, `--io-radius`, `--io-danger`, `--io-text-secondary`, `--io-surface-sunken`, `--io-text-primary`) are verified present in `frontend/src/index.css`. `--io-input-bg` is an alias for `--io-surface-sunken` across all themes; `inputStyle` uses the canonical name.
- No barrel export (`index.ts`) exists in `shared/styles/`; consumers import individual files directly, e.g. `import { btnPrimary, buttonBaseClass } from "@/shared/styles/buttons"`.
- `DesignerRightPanel.tsx` compact inputs (`padding: 4px 7px`, `fontSize: 12`) are explicitly out of scope for migration to `inputStyle` — those are inspector panel inputs where vertical space is at a premium. The shared `inputStyle` targets form inputs in modals, settings pages, and search boxes only.
- `DesignerToolbar.tsx` `IconBtn` (lines 904–948) is also out of scope — it is a module-local primitive with its own hover/transition behavior; it should not be migrated to `buttons.ts`.
- No `shared/styles/` directory existed before this work unit; it was created as part of this phase.

## Changelog

<!-- IGNORE UNLESS SPECIFICALLY ASKED TO REVIEW DOCUMENT HISTORY -->
### 2026-05-28
Initial creation. Documents the four new constants files added in workstream-3b-constants-files (Claim B Phase 1). Records the accessibility rationale for omitting `outline: none`, the scope exclusions for DesignerRightPanel compact inputs and IconBtn, and the inert-until-imported caveat for the CSS companion files.
