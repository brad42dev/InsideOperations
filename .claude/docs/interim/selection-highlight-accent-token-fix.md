---
id: selection-highlight-accent-token-fix
title: Selection Highlight and Marquee Accent Token Fix
status: interim
created: 2026-05-27
last_updated: 2026-05-27
last_synced_with_code: 2026-05-27
work_units:
  - "2026-05-27_regression-accent-token-prefix\n\nread-onl_052806"
implementation:
  - frontend/src/shared/clipboard/selection/selection.css
  - frontend/src/shared/clipboard/selection/MarqueeLayer.tsx
related:
  - ui-audit-comparison
  - ui-audit-recommendations
---

# Selection Highlight and Marquee Accent Token Fix

Fixed a functional regression where selection box outlines, soft-glow shadows, and marquee drag borders were invisible because the shared selection CSS and MarqueeLayer component referenced `var(--accent)` — an undefined token — instead of the correct `--io-`-prefixed equivalents.

## Purpose

The shared clipboard selection overlay system provides two visual affordances used across Console and Designer:

1. **Selection box** — `selection.css` applies an outline and glow effect to `.io-selection-overlay` child elements via `data-indicator` attribute values (`selection-box`, `soft-glow`).
2. **Marquee drag rectangle** — `MarqueeLayer.tsx` renders a translucent rectangle with a dashed border during drag-select operations and writes the selected entities to `globalSelectionStore`.

Both affordances were rendering with no visible color because their CSS token references resolved to nothing.

## Behavior

After the fix:

- **Selection box outline**: `2px solid var(--io-accent)` — teal accent color (#2dd4bf in dark theme)
- **Soft-glow shadow**: `0 0 12px 2px var(--io-accent)` — same teal glow
- **Marquee drag background**: `var(--io-accent-subtle)` — low-opacity teal fill (`rgba(45,212,191,0.1)` per `index.css:42`)
- **Marquee drag border**: `1px dashed var(--io-accent)` — teal dashed border

The fix is scoped to the shared infrastructure layer only. Per the Claim C deferral, no changes were made to the canvas or work-surface containers (WorkspaceGrid, DesignerCanvas).

## Implementation Notes

**Files changed:**

- `frontend/src/shared/clipboard/selection/selection.css:2,9` — two `var(--accent)` → `var(--io-accent)` replacements
- `frontend/src/shared/clipboard/selection/MarqueeLayer.tsx:100-101` — `rgba(80,180,255,0.08)` → `var(--io-accent-subtle)` (hardcoded blue replaced with registered teal token); `var(--accent)` → `var(--io-accent)` on the border

**Token verification:** Both `--io-accent` (index.css:38) and `--io-accent-subtle` (index.css:42) were confirmed present in the registry before making changes. No new tokens were added.

**Audit artifacts updated:** `ui-audit/02-comparison.md` Cat 5 and Cat 10 shared infrastructure entries and `ui-audit/04-recommendations.md` Cat 5 actions, Cat 10 actions, and Phase 2 migration order list were all updated to record the fix as resolved on 2026-05-27.

**Masking note:** The regression was masked in practice by module-specific selection feedback — `PaneWrapper` inline-style border for Console panes and SVG stroke in DesignerCanvas — so the shared overlay being invisible was not immediately obvious at the module level.

## Changelog

<!-- IGNORE UNLESS SPECIFICALLY ASKED TO REVIEW DOCUMENT HISTORY -->
### 2026-05-27
Wrapup review confirmed document accurately reflects the committed fix. No body changes required; audit artifacts (`ui-audit/02-comparison.md`, `ui-audit/04-recommendations.md`) verified updated and committed under "Fix var(--accent) prefix bug — selection highlights now render correctly".

### 2026-05-27
Created. Documents the two-file fix replacing undefined `var(--accent)` references with `var(--io-accent)` and `var(--io-accent-subtle)` in the shared clipboard selection overlay system.
