# Context Menu Developer Checklist

Every new interactive surface in I/O **must ship with right-click coverage** before it is
considered complete. Use this checklist when building or reviewing any new feature.

---

## Quick Reference — Items by Element Type

| Element Type | Minimum Required Items | Hook / Component |
|---|---|---|
| Data table row | Copy Cell, Copy Row, Open/View, Edit, Delete | `useContextMenu<T>()` + `<ContextMenu>` |
| Card / list item | Open/View, Edit, Delete | `useContextMenu<T>()` + `<ContextMenu>` |
| Point-bound element (tag, value display) | View Point Detail, Add to Trend, Copy Tag Name, Copy Value | `<PointContextMenu>` |
| Time-series chart (background) | Export Chart Image, Toggle Grid Lines, Reset Zoom | `useContextMenu` or local state + `<ContextMenu>` |
| Canvas chart (background) | Copy Row Label (where applicable), chart-specific ops | local state + `<ContextMenu>` |
| Tree node | Open, Rename, Duplicate, Delete | `useContextMenu<T>()` + `<ContextMenu>` |
| Image / SVG graphic | Export, Reset View | local state + `<ContextMenu>` |
| Map / geo element | Copy Coordinates, Open Detail | local state + `<ContextMenu>` |

---

## Feature Checklist

### Tables

- [ ] Every `<table>` row has `onContextMenu` wired to `useContextMenu`
- [ ] Context menu includes at minimum: **Copy [Primary Field]**, **Copy Row**
- [ ] If row represents an entity: also include **Open/View**, **Edit**, **Delete**
- [ ] Delete item uses `danger: true` prop
- [ ] Unauthorized items are **hidden** (not disabled) using the `permission` prop
- [ ] `cursor: "context-menu"` applied to `<tr>` or clickable `<li>` element

### Cards and List Items

- [ ] Right-click on the card/item body triggers a context menu
- [ ] Minimum items: **Open/View**, **Edit**, **Delete**
- [ ] Kebab (⋮) button and right-click menu share the same item list (or at minimum the same actions)
- [ ] Delete uses `danger: true`
- [ ] RBAC: unauthorized actions hidden via `permission` prop

### Point-Bound Elements

- [ ] Any element displaying a live OPC/historian value uses `<PointContextMenu>`
- [ ] `pointId` and `value` props are correctly forwarded
- [ ] "Add to Trend" action is functional (opens the TrendPane point picker or navigates to Forensics)
- [ ] "View Point Detail" opens the point detail slide-over

### Charts — Time-Series (uPlot / ECharts)

- [ ] Outer wrapper `<div>` has `onContextMenu` handler (not just the chart canvas)
- [ ] Handler calls `e.preventDefault()` to suppress browser default
- [ ] Background right-click menu includes: **Export Chart Image**, **Toggle Grid Lines**, **Reset Zoom**
- [ ] ECharts charts pass a `chartRef` ref to `<EChart>` and use `chartRef.current?.getDataURL()` for export
- [ ] uPlot charts use the chart API for zoom reset (`u.setData(u.data)` or equivalent)

### Charts — Specialized Surfaces (Canvas, SVG, Table)

- [ ] Canvas charts implement hit testing to identify the clicked row/element
- [ ] Identified element label/id is shown as a disabled header item in the menu
- [ ] Relevant copy/export actions are present
- [ ] `setMenuPos(null)` (or `closeMenu()`) is called in every `onClick` handler to dismiss the menu

### RBAC

- [ ] Every destructive action (Delete, Remove, Reset) includes `permission: "<required.permission>"` on the menu item
- [ ] Every write action (Edit, Rename, Publish) includes the appropriate `permission`
- [ ] Read-only actions (Copy, View, Export) do **not** require a permission prop — always visible

### Mobile / Touch

- [ ] Long-press (500 ms) triggers the same context menu on touch devices
- [ ] Touch implementation uses `onTouchStart` / `onTouchEnd` with a `setTimeout` of 500 ms
- [ ] `e.preventDefault()` is called in `onTouchStart` to suppress text selection during the long press

---

## Standard Implementation Pattern

```tsx
import { useContextMenu } from "../../hooks/useContextMenu";
import ContextMenu from "../ContextMenu";

interface RowData { id: string; name: string; }

function MyTable() {
  const { menuState, handleContextMenu, closeMenu } = useContextMenu<RowData>();

  return (
    <>
      <table>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.id}
              style={{ cursor: "context-menu" }}
              onContextMenu={(e) => handleContextMenu(e, row)}
            >
              ...
            </tr>
          ))}
        </tbody>
      </table>

      {menuState && (
        <ContextMenu
          x={menuState.x}
          y={menuState.y}
          items={[
            { label: "Open", onClick: () => { closeMenu(); openDetail(menuState.data!.id); } },
            { label: "Edit", onClick: () => { closeMenu(); openEdit(menuState.data!.id); }, permission: "entity:write" },
            { label: "Delete", onClick: () => { closeMenu(); confirmDelete(menuState.data!.id); }, danger: true, permission: "entity:delete" },
          ]}
          onClose={closeMenu}
        />
      )}
    </>
  );
}
```

---

## PR Review Gate

Before approving a PR that adds any of the above element types, confirm:

1. The element has a working right-click menu in local dev
2. The checklist items above are satisfied
3. The `useContextMenu` hook (not custom inline state) is used wherever applicable
4. No `z-index` below 1800 is used for the menu container (the `<ContextMenu>` component handles this automatically)

If the PR author has not ticked these boxes, send back for revision.
