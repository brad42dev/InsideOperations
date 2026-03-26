---
id: DD-14-008
title: Replace hardcoded rgba/hex colors in rounds module with design tokens
unit: DD-14
status: pending
priority: low
depends-on: []
---

## What This Feature Should Do

All colors in the Rounds module must use CSS custom properties from the design token registry. Hardcoded `rgba()` and hex values break the light and hphmi themes because they assume dark backgrounds. Status badge colors should use `var(--io-alarm-high)`, `var(--io-alarm-normal)`, `var(--io-alarm-critical)`, and `var(--io-accent)` tokens — not hardcoded `rgba(251,191,36,...)` or `rgba(34,197,94,...)` values.

## Spec Excerpt (verbatim)

> All colors, spacing, radius, shadow, and typography values reference **CSS custom properties** from the token registry. No hardcoded hex colors, no hardcoded pixel values for semantic properties.
> All 3 themes must work: **dark** (default), **light**, **hphmi** (high-contrast).
> — docs/SPEC_MANIFEST.md, §CX-TOKENS Non-negotiables #1-2

## Where to Look in the Codebase

Primary files:
- `frontend/src/pages/rounds/index.tsx` — line 34-37: StatusBadge colorMap uses `rgba(251,191,36,0.15)`, `rgba(34,197,94,0.12)`, `rgba(239,68,68,0.12)`; lines 312-345: sync status indicator badges also use hardcoded rgba values
- `frontend/src/pages/rounds/ActiveRounds.tsx` — line 8-10: statusBadge map uses `rgba()` color literals and `'rgba(168,85,247,0.12)'` for transferred status
- `frontend/src/pages/rounds/RoundHistory.tsx` — line 8-10: same statusBadge pattern with rgba colors
- `frontend/src/pages/rounds/RoundPlayer.tsx` — line 674: `var(--io-accent, #4A9EFF)` fallback hex (should be just `var(--io-accent)`)
- `frontend/src/shared/tokens.ts` (or equivalent) — check for existing token names for alarm-state backgrounds like `--io-alarm-high-subtle`, `--io-alarm-normal-subtle`, `--io-alarm-critical-subtle`

## Verification Checklist

Read the code at the files listed above. Check each item:

- [ ] StatusBadge in index.tsx (lines 33-40) uses only CSS custom properties — no hardcoded rgba() values
- [ ] statusBadge in ActiveRounds.tsx (lines 6-18) uses only CSS custom properties
- [ ] statusBadge in RoundHistory.tsx (lines 6-17) uses only CSS custom properties
- [ ] Sync status indicators in index.tsx (lines 306-350) use only CSS custom properties
- [ ] RoundPlayer.tsx hardcoded `#4A9EFF` fallback hex removed — CSS var used standalone
- [ ] All 3 themes (dark, light, hphmi) render status colors correctly after the change

## Assessment

After checking:
- **Status**: ⚠️ Wrong
- **What's wrong**: Status badge colorMaps in index.tsx:34-37, ActiveRounds.tsx:8-10, RoundHistory.tsx:8-10 use `rgba()` with hardcoded numeric values. The sync banners in index.tsx:312-345 also use `rgba()`. These colors assume a dark background and will be incorrect in light/hphmi themes.

## Fix Instructions (if needed)

1. Check `frontend/src/shared/tokens.ts` (or `tokens.css`) for alarm-state background tokens. Common patterns: `--io-alarm-high-subtle`, `--io-alarm-critical-subtle`, `--io-alarm-normal-subtle`. If these don't exist, check what's available in the token registry.

2. Replace the StatusBadge colorMap in `index.tsx` (lines 33-40):
   - `pending` bg: use `var(--io-alarm-high-subtle)` instead of `rgba(251,191,36,0.15)` — text stays `var(--io-alarm-high)`
   - `completed` bg: use `var(--io-alarm-normal-subtle)` instead of `rgba(34,197,94,0.12)` — text stays `var(--io-alarm-normal)`
   - `missed` bg: use `var(--io-alarm-critical-subtle)` instead of `rgba(239,68,68,0.12)` — text stays `var(--io-alarm-critical)`
   - `in_progress` bg: already uses `var(--io-accent-subtle, rgba(74,158,255,0.15))` — remove the rgba fallback

3. Apply the same token substitution in `ActiveRounds.tsx:8-10` and `RoundHistory.tsx:8-10` statusBadge maps.

4. In `index.tsx:312-345` (sync banners): replace inline rgba with tokens:
   - Offline banner: `var(--io-alarm-high-subtle)` / `var(--io-alarm-high)` border
   - Syncing banner: `var(--io-alarm-normal-subtle)` / `var(--io-alarm-normal)` border
   - Sync failed banner: `var(--io-alarm-critical-subtle)` / `var(--io-alarm-critical)` border

5. In `RoundPlayer.tsx:674`: change `var(--io-accent, #4A9EFF)` to just `var(--io-accent)`. Remove all `#4A9EFF` fallback hex values throughout the file.

Do NOT:
- Create new tokens that aren't in the existing registry — use existing tokens or the alarm tokens which are guaranteed to be defined
- Change alarm text colors (the `color:` property) — those are already using tokens; only fix the background rgba values
- Change print-area colors in PrintDialog.tsx (lines 84-99, 179-194) — the print area intentionally uses hardcoded black/white for print compatibility
