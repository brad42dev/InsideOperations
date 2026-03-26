---
id: MOD-DESIGNER-039
title: Add "Refresh Data" and "Detach from Dashboard" to Widget node context menu (RC-DES-12)
unit: MOD-DESIGNER
status: pending
priority: low
depends-on: []
---

## What This Feature Should Do

When the user right-clicks a Widget node on the Designer canvas, the context menu should include three items: Configure Widget…, Refresh Data, and Detach from Dashboard. The current implementation only has "Configure Widget…". Refresh Data re-fetches widget data in test mode. Detach from Dashboard removes the dashboard binding from the widget node while keeping the widget in the scene graph (converting it to a standalone widget).

## Spec Excerpt (verbatim)

> `Widget` (RC-DES-12): Configure Widget…, Refresh Data, Detach from Dashboard
> — docs/SPEC_MANIFEST.md, CX-CANVAS-CONTEXT Non-Negotiable #3

## Where to Look in the Codebase

Primary files:
- `frontend/src/pages/designer/DesignerCanvas.tsx:5789–5798` — the `{widgetNode && ...}` block with Widget-specific context menu items. Only "Configure Widget…" is present.
- `frontend/src/shared/types/graphics.ts` — `WidgetNode` interface, particularly any `dashboardBinding` or `sourceId` field.

## Verification Checklist

Read the code at the files listed above. Check each item:

- [ ] Widget right-click menu shows "Configure Widget…", "Refresh Data", and "Detach from Dashboard"
- [ ] "Refresh Data" is only enabled in test mode (when `testMode === true`); disabled in design mode
- [ ] "Detach from Dashboard" is grayed (not hidden) when the widget has no dashboard binding
- [ ] Selecting "Detach from Dashboard" removes the dashboard binding via ChangePropertyCommand (undoable)

## Assessment

After checking:
- **Status**: ⚠️ Partial — `DesignerCanvas.tsx:5789-5798` has only "Configure Widget…". "Refresh Data" and "Detach from Dashboard" are absent.

## Fix Instructions

In `frontend/src/pages/designer/DesignerCanvas.tsx`, inside the `{widgetNode && ...}` block (around line 5789), add the two missing items:

```tsx
{widgetNode && (
  <>
    <ContextMenuPrimitive.Separator style={sepStyle} />
    <ContextMenuPrimitive.Item style={itemStyle}
      onSelect={() => { /* focuses right panel — already shows widget config when selected */ }}>
      Configure Widget…
    </ContextMenuPrimitive.Item>
    {/* Refresh Data — only meaningful in test mode */}
    <ContextMenuPrimitive.Item
      style={itemStyle}
      disabled={!testMode}
      onSelect={() => {
        // In test mode, trigger a re-query for this widget's data.
        // Dispatch a custom event that DesignerCanvas test-mode hooks can listen to.
        document.dispatchEvent(new CustomEvent('io:widget-refresh', { detail: { nodeId } }))
      }}
    >
      Refresh Data
    </ContextMenuPrimitive.Item>
    {/* Detach from Dashboard — removes dashboard source binding */}
    <ContextMenuPrimitive.Item
      style={itemStyle}
      disabled={!widgetNode.dashboardSourceId}  // adjust field name to actual WidgetNode field
      onSelect={() => {
        if (!nodeId || !widgetNode.dashboardSourceId) return
        executeCmd(new ChangePropertyCommand(nodeId, 'dashboardSourceId', undefined, widgetNode.dashboardSourceId))
      }}
    >
      Detach from Dashboard
    </ContextMenuPrimitive.Item>
  </>
)}
```

Adjust `widgetNode.dashboardSourceId` to whatever field name is used in the `WidgetNode` interface for dashboard binding (check `frontend/src/shared/types/graphics.ts`).

Do NOT:
- Remove the existing "Configure Widget…" item
- Hide "Detach from Dashboard" when unbound — spec says disabled items are grayed (not hidden) for canvas context menus
