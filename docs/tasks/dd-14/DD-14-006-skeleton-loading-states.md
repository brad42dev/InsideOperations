---
id: DD-14-006
title: Replace text loading spinners with module-shaped skeleton loading states
unit: DD-14
status: pending
priority: low
depends-on: []
---

## What This Feature Should Do

Every loading state in the Rounds module must show a structural skeleton that matches the shape of the content being loaded — card skeletons for the available/in-progress/template/schedule card lists, a table-row skeleton for the history view, and a checkpoint-flow skeleton for RoundPlayer. No plain text "Loading…" strings.

## Spec Excerpt (verbatim)

> Each module provides a **module-shaped skeleton** that matches the structure of the content being loaded. Not a generic shimmer bar or spinner covering the whole area.
> Skeleton must appear immediately on navigation (no blank flash before skeleton).
> — docs/SPEC_MANIFEST.md, §CX-LOADING Non-negotiables #1-2

## Where to Look in the Codebase

Primary files:
- `frontend/src/pages/rounds/index.tsx` — line 425-428 (available tab text), 449-452 (in-progress tab text), 484-487 (templates tab text), 549-552 (schedules tab text) — all plain "Loading…" text
- `frontend/src/pages/rounds/RoundPlayer.tsx` — line 1123-1128, plain "Loading round…" div
- `frontend/src/pages/rounds/RoundTemplates.tsx` — line 61-63, plain "Loading…" text
- `frontend/src/pages/rounds/RoundSchedules.tsx` — line 173-175, plain "Loading…" text
- `frontend/src/shared/components/` — check for existing `Skeleton` or `SkeletonCard` component to reuse

## Verification Checklist

Read the code at the files listed above. Check each item:

- [ ] The available/in-progress tab loading state shows 3–4 card-shaped skeletons (matching InstanceCard layout: title, status badge, due date, button)
- [ ] The templates tab loading state shows 2–3 template card skeletons (matching the name + version + checkpoint count + Edit button layout)
- [ ] The schedules tab loading state shows 2–3 schedule card skeletons
- [ ] RoundPlayer loading state shows a progress bar skeleton + checkpoint card skeleton
- [ ] No plain text "Loading…" strings remain in any rounds component

## Assessment

After checking:
- **Status**: ❌ Missing
- **What's missing**: All 6 loading states are `<div style={{ color: 'var(--io-text-muted)' }}>Loading…</div>` or similar text. No structural skeletons exist in the rounds module.

## Fix Instructions (if needed)

1. Check `frontend/src/shared/components/` for an existing `Skeleton` primitive (shimmer box). If one exists, use it as the base. If not, create a minimal one — a `<div>` with a CSS animation: `background: linear-gradient(90deg, var(--io-surface-secondary) 25%, var(--io-surface-elevated) 50%, var(--io-surface-secondary) 75%)`.

2. For card-based lists (available, in-progress, templates, schedules), create a `SkeletonCard` that mirrors the actual card structure — a rectangle for the title line, a shorter rectangle for the subtitle, and a small rectangle for the action button. Render 3 of these when `loading` is true.

3. For `RoundPlayer.tsx` (line 1123-1128), replace the text with a skeleton that matches the player layout: a progress bar skeleton at the top, a large card skeleton for the checkpoint area, and two button skeletons at the bottom for Prev/Next.

4. In `index.tsx`, replace the 4 text loading blocks (lines 425, 449, 484, 549) with the card skeleton. The same `SkeletonCard` component can be used across all tabs.

Do NOT:
- Use a single centered spinner or "Loading…" text — this is what we are replacing
- Use a completely different skeleton shape for each tab — the card skeleton is reusable
- Delay skeleton display — it must show immediately when `isLoading` is true (before data arrives)
