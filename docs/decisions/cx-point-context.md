---
id: CX-POINT-CONTEXT
title: Point Right-Click Context Menu
status: decided
contract: CX-POINT-CONTEXT
decided: 2026-03-21
---

## What Was Decided

A single shared `PointContextMenu` React component handles all point right-click menus across every module. It has 6 visible items: Point Detail, Trend This Point, Investigate Point (permission-gated), Report on Point (permission-gated), Investigate Alarm (conditional + permission-gated), and Copy Tag Name. Items the user lacks permission for are hidden entirely — never grayed. The alarm section only renders when `isAlarm || isAlarmElement` is true.

## Inventory (What Exists Today)

| Module / Entity | Implemented? | Current behavior | Gap found |
|-----------------|-------------|-----------------|-----------|
| Console / GraphicPane | ⚠️ Partial | 6 items inline (closest to spec) | Not using shared component; missing Copy Tag Name |
| Console / PaneWrapper | ⚠️ Partial | Pane ops menu only, no point items | Not a point menu — different concern |
| Process | ⚠️ Partial | 5 items, missing Investigate Alarm | Not shared component |
| Shared PointContextMenu.tsx | ⚠️ Partial | 4 items (wrong items per spec) | Missing Copy Tag Name; wrong item names |
| Dashboards | ❌ | No point right-click | Entirely missing |
| Forensics | ❌ | No point right-click | Entirely missing |
| Log | ❌ | No point right-click on embedded tags | Entirely missing |
| Rounds | ❌ | No point right-click | Entirely missing |
| Settings / Point Browser | ❌ | No point right-click | Entirely missing |
| Alerts | ❌ | No point right-click | Entirely missing |

## Questions and Answers

The spec was written by the design team directly; no interactive Q&A was required. Key decisions embedded in the spec:

**Q1**: Should "Trend This Point" require a permission?
**A**: No. Any user who can see a point can trend it. The trend opens as a floating overlay, not as module navigation.

**Q2**: Should permission-lacking items be grayed (with tooltip) or hidden?
**A**: Hidden (not rendered). Keeps menus clean and role-appropriate. No "you don't have permission" items.

**Q3**: When should "Investigate Alarm" appear?
**A**: Only when `isAlarm || isAlarmElement` — i.e., when the point is currently in alarm state OR the element is an alarm indicator / alarm-typed display element. The conditional separator also only appears in this case.

**Q4**: Should "Copy Tag Name" be in the menu?
**A**: Yes — always visible, no permission required. It is the last item in the menu.

## Resulting Specification

### Universal Rules (apply to all qualifying modules)

1. Use the shared `PointContextMenu` component (`@io/ui`). Do not implement per-module point menus.
2. Component props: `{ pointId: string, tagName: string, isAlarm: boolean, isAlarmElement: boolean }`.
3. Item order and visibility:
   - **Point Detail** — always rendered
   - **Trend This Point** — always rendered, no permission check
   - *Separator*
   - **Investigate Point** — rendered only if `usePermission('forensics:read')` is true
   - **Report on Point** — rendered only if `usePermission('reports:read')` is true
   - *Separator* — rendered only if `isAlarm || isAlarmElement`
   - **Investigate Alarm** — rendered only if `(isAlarm || isAlarmElement) && usePermission('forensics:read')`
   - *Separator*
   - **Copy Tag Name** — always rendered
4. Trigger: right-click on desktop, 500ms long-press on mobile (44×44px touch target).
5. Menu must appear in <50ms. No async fetching blocks render.
6. Applies to every element with a point identity signal: SVG elements with `data-point-id`, table cells with bound point data, chart series data points, widget values, tag name text links.

### Module-Specific Rules

**Rounds**: RC-RND-3 (checkpoint items) provides only "View Point Detail" — NOT the full P1 menu. This is intentional for field mobility. Trend and Investigate are accessible from the Point Detail panel.

**Settings Point Browser**: RC-SET-5 extends P1 with Settings-specific configuration items. The P1 items (Point Detail, Trend This Point, etc.) appear alongside Edit Point Configuration, Deactivate/Reactivate, and View Metadata History.

### Explicitly Out of Scope

- Per-module variations of the P1 item list (no module may add or remove P1 items)
- Graying items when user lacks permission (must hide)
- "Copy Point ID" as a separate item (the spec uses "Copy Tag Name")

## Implementation Notes

The canonical component is `PointContextMenu` exported from `@io/ui` (shared component library). Modules wrap their point-bearing elements in `<ContextMenu.Root>` with `<PointContextMenu ...>` as the content. They do not modify the P1 items but may compose additional module-specific items below a separator.

Shared helper exports from `@io/ui`:
- `<PointContextMenuItems />` — renders the P1 items for composition into larger menus

**Addendum (`context-menu-addendum.md`)**: P1 itself is unchanged by the addendum. The addendum defines "Show in Console Graphic" (§A4) as a cross-module action that can be appended after P1 items in module-specific menu extensions (RC-FOR-2, RC-SET-5). It does NOT belong in P1's core definition. Also: the item limit is 15 (not 10) per §A1, though P1 has only 6 items and is unaffected by the limit.

## Open Questions

None — spec is complete.
