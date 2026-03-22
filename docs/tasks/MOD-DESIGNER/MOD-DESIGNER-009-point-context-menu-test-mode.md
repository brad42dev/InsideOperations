---
id: MOD-DESIGNER-009
title: Wire PointContextMenu to point-bound display elements in Designer test mode
unit: MOD-DESIGNER
status: pending
priority: medium
depends-on: []
---

## What This Feature Should Do

In Designer test mode (when live point values are displayed), right-clicking a point-bound display element should open the shared `PointContextMenu` component. This provides Point Detail, Trend This Point, Investigate Point, Report on Point, Copy Tag Name and other canonical actions. The Designer currently renders live values in test mode but has no right-click behavior on those values.

## Spec Excerpt (verbatim)

> Right-clicking (desktop) or long-pressing **500ms** (mobile) on any point-bound element opens the unified `PointContextMenu` shared component. Individual modules must NOT implement their own version.
>
> **Applies to**: ALL modules that display point tag names or live/historical values
> — docs/SPEC_MANIFEST.md, CX-POINT-CONTEXT Non-Negotiable #1

## Where to Look in the Codebase

Primary files:
- `frontend/src/pages/designer/DesignerCanvas.tsx:356-358` — `DisplayElementRenderer` reads `node.binding.pointId` and `liveValues.get(...)` for test mode rendering
- `frontend/src/shared/components/PointContextMenu.tsx` — the shared component to use (verify it exists and check its props)
- `frontend/src/pages/designer/DesignerCanvas.tsx:244-258` — `extractPointIds()` shows how pointIds are extracted from the doc

## Verification Checklist

Read the code at the files listed above. Check each item:

- [ ] `PointContextMenu` is imported in `DesignerCanvas.tsx` (or the file that renders DisplayElementRenderer)
- [ ] Right-clicking a `display_element` node in test mode (when `testMode === true`) triggers `PointContextMenu` with `{ pointId, tagName, isAlarm: false, isAlarmElement: false }`
- [ ] Right-clicking outside of test mode (edit mode) does NOT trigger PointContextMenu — it should use the standard node context menu (RC-DES-4)
- [ ] The PointContextMenu renders within 50ms (no async fetch before render)

## Assessment

After checking:
- **Status**: ❌ Missing — no PointContextMenu import or usage found in DesignerCanvas.tsx

## Fix Instructions

1. Import `PointContextMenu` from `../../shared/components/PointContextMenu`.

2. In `DisplayElementRenderer` (around line 356), when `testMode` is true and `node.binding.pointId` is set, add a right-click handler. The simplest approach: add state to track the point context menu trigger position and pointId:

```tsx
// In DesignerCanvas component state:
const [pointCtxMenu, setPointCtxMenu] = useState<{ pointId: string; tagName: string; x: number; y: number } | null>(null)
```

3. In `DisplayElementRenderer` or the `<g>` wrapper for display elements, add:
```tsx
onContextMenu={(e) => {
  if (!testMode) return // only in test mode
  e.preventDefault()
  e.stopPropagation() // prevent canvas context menu from also opening
  const pid = node.binding.pointId
  if (!pid) return
  setPointCtxMenu({ pointId: pid, tagName: pid, x: e.clientX, y: e.clientY })
}}
```

4. Pass `pointCtxMenu` and `setPointCtxMenu` up to `DesignerCanvas` and render the `PointContextMenu` component at the root level when it is non-null:
```tsx
{testMode && pointCtxMenu && (
  <PointContextMenu
    pointId={pointCtxMenu.pointId}
    tagName={pointCtxMenu.tagName}
    isAlarm={false}
    isAlarmElement={false}
    anchorX={pointCtxMenu.x}
    anchorY={pointCtxMenu.y}
    onClose={() => setPointCtxMenu(null)}
  />
)}
```

Check the exact PointContextMenu component signature in `frontend/src/shared/components/PointContextMenu.tsx` and adjust props accordingly.

Do NOT:
- Show PointContextMenu in edit mode (only when `testMode === true`)
- Re-implement the Point Detail or Trend actions locally — always delegate to the shared `PointContextMenu` component
- Block the canvas context menu from opening when testMode is false and the user right-clicks a display element
