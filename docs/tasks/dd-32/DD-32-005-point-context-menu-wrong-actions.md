---
id: DD-32-005
title: Fix PointContextMenu actions to match spec (Trend Point, Investigate Point, Report on Point, RBAC, mobile long-press)
unit: DD-32
status: pending
priority: medium
depends-on: []
---

## What This Feature Should Do

The PointContextMenu is a shell-level component that appears on right-click (or long-press on mobile) of any point-bound element. It must show exactly the four items defined in the spec: "Point Detail", "Trend Point", "Investigate Point", and "Report on Point". Items the user lacks permission for must be hidden. Currently the menu has different items ("Add to Trend" instead of "Trend Point", "View History" instead of "Investigate Point"), is missing "Report on Point" entirely, performs no RBAC checks, and has no mobile long-press support.

## Spec Excerpt (verbatim)

> | **Point Detail** | Opens Point Detail floating panel for this point | `console:read` or module equivalent |
> | **Trend Point** | Opens a full-screen trend chart for this point (last 24h default, adjustable) | `console:read` or module equivalent |
> | **Investigate Point** | Creates a new Forensics investigation anchored to this point | `forensics:write` |
> | **Report on Point** | Opens Report generation with this point pre-selected as the data source | `reports:read` |
>
> Items the user lacks permission for are hidden (not grayed out).
>
> On mobile, this is triggered by long-press (500ms).
> — design-docs/32_SHARED_UI_COMPONENTS.md, §Point Context Menu

## Where to Look in the Codebase

Primary files:
- `frontend/src/shared/components/PointContextMenu.tsx` — all changes go here
- `frontend/src/shared/components/PermissionGuard.tsx` — existing RBAC guard component; use this for item visibility
- `frontend/src/store/` — check for auth/user store that exposes current user permissions

## Verification Checklist

- [ ] Menu has exactly: "Point Detail", "Trend Point", "Investigate Point", "Report on Point" (old "Add to Trend", "Copy Point ID", "View History" items replaced or renamed)
- [ ] "Trend Point" navigates to a full-screen trend view for the point (e.g., `/console?trend={pointId}` or opens a modal)
- [ ] "Investigate Point" creates a new Forensics investigation via POST to `/api/v1/forensics/investigations` with the point pre-populated, then navigates to `/forensics/investigations/{id}`
- [ ] "Report on Point" navigates to `/reports/new?point={pointId}`
- [ ] Menu items for which the user lacks the required permission (`console:read`, `forensics:write`, `reports:read`) are hidden (not rendered), not just disabled
- [ ] On a touch device, a 500ms long-press on the wrapped element opens the menu (not just right-click)

## Assessment

- **Status**: ⚠️ Wrong — menu exists but has incorrect items, no RBAC, no mobile trigger

## Fix Instructions

1. **Replace menu items** in `PointContextMenu.tsx`:

   Remove: "Add to Trend", "Copy Point ID", "View History" items (lines 98-143).

   Add:
   - **Trend Point**: `onSelect` → `navigate('/console?trend=' + encodeURIComponent(pointId))` (or call prop `onTrendPoint?.(pointId)`). Permission: `console:read`.
   - **Investigate Point**: `onSelect` → POST to `/api/v1/forensics/investigations` body `{ anchor_point_id: pointId, time_range: { start: -24h, end: now } }`, then navigate to `/forensics/investigations/{id}`. Permission: `forensics:write`.
   - **Report on Point**: `onSelect` → `navigate('/reports/new?point=' + encodeURIComponent(pointId))`. Permission: `reports:read`.

   Keep: "Point Detail" item (line 82-96) — it is correct.

2. **RBAC item visibility**: Import the `PermissionGuard` component or the user permissions hook. Wrap each item's render in a permission check. If the user lacks the permission, do not render the `<DropdownMenu.Item>` at all.

3. **Mobile long-press**: In the wrapper `<span>` (lines 60-72), add:
   ```ts
   let longPressTimer: ReturnType<typeof setTimeout> | null = null
   onTouchStart={() => { longPressTimer = setTimeout(() => triggerOpen(), 500) }}
   onTouchEnd={() => { if (longPressTimer) clearTimeout(longPressTimer) }}
   onTouchMove={() => { if (longPressTimer) clearTimeout(longPressTimer) }}
   ```
   where `triggerOpen()` programmatically opens the Radix DropdownMenu.

4. **Props update**: Update `PointContextMenuProps` to remove `onAddToTrend` and add `onTrendPoint?: (pointId: string) => void` and `onInvestigatePoint?: (pointId: string) => void` for callers that want to intercept the action instead of using default navigation.

Do NOT:
- Keep "Copy Point ID" as a primary menu item — this was not in the spec and is a developer tool, not an operator action
- Gray out (disable) permission-missing items — spec says "hidden (not grayed out)"
- Use Radix ContextMenu instead of DropdownMenu — the existing Radix DropdownMenu triggered by right-click is the correct pattern; keep it
