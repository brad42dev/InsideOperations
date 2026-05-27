---
id: designer-settings-shell-drift-fixes
title: Designer and Settings Shell Drift Fixes
status: interim
created: 2026-05-27
last_updated: 2026-05-27
last_synced_with_code: 2026-05-27
work_units:
  - 2026-05-27_workstream-2c-shell-drift\n\nread-ui-audit_072739
implementation:
  - frontend/src/pages/designer/DesignerLeftPalette.tsx
  - frontend/src/pages/settings/index.tsx
  - ui-audit/06-claim-a-plan.md
related:
  - claim-a-token-registry
  - claim-c-deferral
---

# Designer and Settings Shell Drift Fixes

Three visual consistency fixes aligning the Designer left palette and Settings sidebar with the Console/AppShell reference pattern: surface token, active nav indicator, and nav group header typography.

## Purpose

The Designer left palette and Settings sidebar had drifted from the shell conventions established by the Console module and the AppShell reference. These fixes bring all three modules into alignment on side panel background color, active nav item indicator, and section label letter-spacing. The corrections establish the canonical values that all eight future rebuilt modules must follow.

## Behavior

**Designer left palette (B1):** The palette panel container now uses `var(--io-surface-secondary)`, matching Console and Settings side panels. The previous `var(--io-surface)` was one surface tier lighter, creating a visible seam at module boundaries. A separate `var(--io-surface)` reference in `DeleteConfirmDialog` (line 245) is a dialog background — correct and intentionally untouched.

**Settings active nav indicator (B2):** Active nav items now show a `2px solid var(--io-accent)` left border. Inactive items render a `2px solid transparent` border to reserve the space, keeping text horizontally aligned across both states. Padding is `7px 10px 7px 8px` uniformly — the 8px left padding plus the always-present 2px border produces 10px effective left offset in both states. This matches the AppShell nav pattern.

**Settings nav group header typography (B4):** `letterSpacing` corrected from `0.08em` to `0.06em`, matching Console palette section labels and Designer `SectionHeader`. Font size (11px), weight (600), transform (uppercase), and color (`var(--io-text-muted)`) were already consistent.

**Sidebar width (B3):** No code changes were required. The A14 decision confirmed 220px, and all module hardcodes already matched the `--io-sidebar-width` token value.

## Implementation Notes

- **B1 target location:** `containerStyle` object at `DesignerLeftPalette.tsx:2436`.
- **B2/B4 target location:** `SettingsShell` component in `settings/index.tsx`. Nav group label style object (~line 192) and `NavLink` style function (~line 208).
- No canvas-layer files were modified, per the Claim C deferral. No new hardcoded values were introduced; all changes reference tokens from the existing registry.
- These changes establish non-negotiable shell conventions for the eight-module rebuild: `var(--io-surface-secondary)` for side panels, `borderLeft: 2px solid var(--io-accent)` for active nav indicators, and `0.06em` letter-spacing for nav group headers.
- The plan file (`ui-audit/06-claim-a-plan.md`) was updated to mark all four B-items `✅ Done 2026-05-27` in both the Category B table (Section 1.2) and the Pass 4 sequencing list (Section 3). The B1 file path in the plan was also corrected from `frontend/src/designer/` to `frontend/src/pages/designer/`.

## Changelog

<!-- IGNORE UNLESS SPECIFICALLY ASKED TO REVIEW DOCUMENT HISTORY -->
### 2026-05-27
Deep review pass confirmed all three code changes match intent. No concerns identified: B1 surface token swap is targeted and correct; B2 padding arithmetic is sound (transparent border always reserves 2px, so 8px left-pad + 2px border = 10px effective offset in both active and inactive states); B4 letter-spacing change is a single-property fix. Plan file updates are accurate. Doc updated to clarify the Dialog.Content `var(--io-surface)` at line 245 as intentionally untouched, and to add detail on plan file corrections.

### 2026-05-27
Initial creation. Documents workstream 2c shell drift fixes: Designer palette background (B1), Settings active nav indicator (B2), Settings nav group letter-spacing (B4), and sidebar width no-op confirmation (B3). All four Category B items in `ui-audit/06-claim-a-plan.md` marked done.
