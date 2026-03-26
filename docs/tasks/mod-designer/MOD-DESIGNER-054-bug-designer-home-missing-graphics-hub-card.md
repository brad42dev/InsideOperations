---
id: MOD-DESIGNER-054
unit: MOD-DESIGNER
title: Designer Home missing Graphics hub card (Browse + New buttons absent)
status: pending
priority: medium
depends-on: []
source: bug
bug_report: Designer Home shows Dashboards and Report Templates hub cards but not the Graphics card — no Browse or New button for graphics
---

## What's Broken

`DesignerHome.tsx` renders only two `HubCard` components (lines 250-268):
- Dashboards → `/designer/dashboards`
- Report Templates → `/designer/reports`

The Graphics hub card is absent. Users have no way to browse existing graphics or create a new one from the Designer home page.

Additionally, the `recentItems` list (lines 188-194) combines dashboards and reports but never fetches or includes graphics, so recently modified graphics also do not appear in the "Recently Modified" section.

## Expected Behavior

Designer Home shows three hub cards in the grid:

1. **Graphics** — browseHref `/designer/graphics`, newHref `/designer/graphics/new`
2. **Dashboards** — already present
3. **Report Templates** — already present

The "Recently Modified" section should include graphics alongside dashboards and reports, sorted by `updated_at` desc.

Per design-docs/09 and `designer-implementation-spec.md`: Designer serves all three modes (Graphic / Dashboard / Report). The home page is the entry point for all three.

## Root Cause (if known)

The `HubCard` component is fully built. `graphicsApi.list({ mode: 'graphic' })` exists in `frontend/src/api/graphics.ts` (line 36-39). The routing/label/icon helpers at lines 197-211 already handle `type === 'graphic'` (icon `🖼`, route `/designer/graphics/:id`) — confirming this was intended.

The Graphics card was simply never added to the JSX, and no `graphicsQuery` was wired up to feed the count and recent items.

## Acceptance Criteria

- [ ] A third `HubCard` titled "Graphics" appears in the hub grid alongside Dashboards and Report Templates.
- [ ] The Graphics card displays a live count of graphics fetched from `graphicsApi.list({ mode: 'graphic' })`.
- [ ] "Browse" navigates to `/designer/graphics`.
- [ ] "+ New" navigates to `/designer/graphics/new`.
- [ ] Graphics appear in the "Recently Modified" list sorted by `updated_at` desc alongside dashboards and reports.
- [ ] Loading state (count shows `—`) while the graphics query is in-flight.
- [ ] No regression: Dashboards and Report Templates cards continue to work as before.

## Verification

1. Navigate to `/designer`.
2. Confirm three hub cards are visible: Graphics, Dashboards, Report Templates — in that order (Graphics first, matching spec's primary mode).
3. Click "Browse" on Graphics card → navigates to `/designer/graphics`.
4. Click "+ New" on Graphics card → navigates to `/designer/graphics/new`.
5. If any graphics exist in the system, they appear in the "Recently Modified" list with icon `🖼` and subtitle "Process Graphic".
6. No error in browser console.

## Spec Reference

`design-docs/09_DESIGNER_MODULE.md` §"One unified Designer serves all visual content creation through three modes" — Graphics is the primary mode.

`designer-implementation-spec.md` confirms three designer modes; DesignerHome is the landing for all three.

## Do NOT

- Stub the graphics query — that would replicate the original omission.
- Hardcode a count of 0 — fetch and display the real count.
- Change the order to put Dashboards first — Graphics is the primary designer mode.
