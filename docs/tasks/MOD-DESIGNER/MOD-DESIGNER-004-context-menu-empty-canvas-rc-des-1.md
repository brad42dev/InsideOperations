---
id: MOD-DESIGNER-004
title: Differentiate empty-canvas context menu (RC-DES-1) from node context menu
unit: MOD-DESIGNER
status: pending
priority: medium
depends-on: []
---

## What This Feature Should Do

Right-clicking on an empty area of the Designer canvas (no node hit) should show a different context menu from right-clicking on a node. The empty-canvas menu (RC-DES-1) should have: Paste (grayed if clipboard empty), Select All (grayed if nothing exists), a Grid submenu (Show Grid toggle, Snap to Grid toggle, Grid Size submenu), a Zoom submenu (Zoom In, Zoom Out, Zoom to Fit, Zoom to 100%), and Properties (canvas properties). The current implementation shows the same flat menu regardless of whether a node was hit.

## Spec Excerpt (verbatim)

> **Empty canvas right-click** (RC-DES-1): Paste (grayed if clipboard empty), Select All (grayed if nothing exists), Grid submenu (Show/Snap/Size), Zoom submenu, Properties. Extends P5.
> — docs/SPEC_MANIFEST.md, CX-CANVAS-CONTEXT Non-Negotiable #1

## Where to Look in the Codebase

Primary files:
- `frontend/src/pages/designer/DesignerCanvas.tsx:2763-2790` — `handleContextMenu` — sets `ctxNodeIdRef.current` based on hit-test
- `frontend/src/pages/designer/DesignerCanvas.tsx:3756` — `DesignerContextMenuContent` — currently renders the same content regardless of `nodeId === null`
- `frontend/src/pages/designer/DesignerCanvas.tsx:3997-4005` — existing Grid toggle and Zoom to Fit items (currently in main menu, need to become Grid submenu items)

## Verification Checklist

Read the code at the files listed above. Check each item:

- [ ] When `ctxNodeIdRef.current === null` (empty canvas click), menu shows ONLY: Paste, Select All, Grid submenu, Zoom submenu, Properties
- [ ] Grid submenu contains: Show Grid (toggle), Snap to Grid (toggle), Grid Size (submenu with presets: 4, 8, 10, 16, 32px)
- [ ] Zoom submenu contains: Zoom In, Zoom Out, Zoom to Fit, Zoom to 100%
- [ ] When `ctxNodeIdRef.current !== null` (node click), menu shows the full node menu (base items + type-specific items)
- [ ] Paste item is grayed (disabled) when `_clipboard.length === 0`, not hidden

## Assessment

After checking:
- **Status**: ⚠️ Wrong — single unified menu at line 3877, no null-check for empty canvas

## Fix Instructions

In `DesignerContextMenuContent` (line 3756), at the start of the return JSX, branch on `nodeId === null`:

```tsx
return (
  <ContextMenuPrimitive.Portal>
    <ContextMenuPrimitive.Content style={contentStyle}>
      {nodeId === null ? (
        // RC-DES-1: Empty canvas menu
        <>
          <ContextMenuPrimitive.Item style={itemStyle}
            disabled={_clipboard.length === 0}
            onSelect={() => { /* paste logic */ }}>
            Paste
          </ContextMenuPrimitive.Item>
          <ContextMenuPrimitive.Item style={itemStyle}
            disabled={!hasDoc || (doc?.children.length ?? 0) === 0}
            onSelect={() => { /* select all */ }}>
            Select All
          </ContextMenuPrimitive.Item>
          <ContextMenuPrimitive.Separator style={sepStyle} />

          {/* Grid submenu */}
          <ContextMenuPrimitive.Sub>
            <ContextMenuPrimitive.SubTrigger style={itemStyle}>Grid</ContextMenuPrimitive.SubTrigger>
            <ContextMenuPrimitive.Portal>
              <ContextMenuPrimitive.SubContent style={subContentStyle}>
                <ContextMenuPrimitive.Item style={itemStyle} onSelect={() => setGrid(!gridVisible)}>
                  {gridVisible ? 'Hide Grid' : 'Show Grid'}
                </ContextMenuPrimitive.Item>
                <ContextMenuPrimitive.Item style={itemStyle} onSelect={() => setSnap(!snapEnabled)}>
                  {snapEnabled ? 'Disable Snap' : 'Enable Snap'}
                </ContextMenuPrimitive.Item>
                {/* Grid size sub-submenu or direct items */}
              </ContextMenuPrimitive.SubContent>
            </ContextMenuPrimitive.Portal>
          </ContextMenuPrimitive.Sub>

          {/* Zoom submenu */}
          <ContextMenuPrimitive.Sub>
            <ContextMenuPrimitive.SubTrigger style={itemStyle}>Zoom</ContextMenuPrimitive.SubTrigger>
            <ContextMenuPrimitive.Portal>
              <ContextMenuPrimitive.SubContent style={subContentStyle}>
                <ContextMenuPrimitive.Item style={itemStyle} onSelect={() => zoomTo(zoom * 1.25)}>Zoom In</ContextMenuPrimitive.Item>
                <ContextMenuPrimitive.Item style={itemStyle} onSelect={() => zoomTo(zoom * 0.8)}>Zoom Out</ContextMenuPrimitive.Item>
                <ContextMenuPrimitive.Item style={itemStyle} onSelect={() => { /* fit */ }}>Zoom to Fit</ContextMenuPrimitive.Item>
                <ContextMenuPrimitive.Item style={itemStyle} onSelect={() => zoomTo(1.0)}>Zoom to 100%</ContextMenuPrimitive.Item>
              </ContextMenuPrimitive.SubContent>
            </ContextMenuPrimitive.Portal>
          </ContextMenuPrimitive.Sub>

          <ContextMenuPrimitive.Separator style={sepStyle} />
          <ContextMenuPrimitive.Item style={itemStyle} onSelect={() => { /* open canvas properties */ }}>
            Properties…
          </ContextMenuPrimitive.Item>
        </>
      ) : (
        // RC-DES-2+: Node menu (existing content)
        <>
          {/* existing items */}
        </>
      )}
    </ContextMenuPrimitive.Content>
  </ContextMenuPrimitive.Portal>
)
```

The `setSnap` and `zoomTo` functions need to be passed as props from `DesignerCanvas` to `DesignerContextMenuContent` (similar to how `setGrid` is currently passed).

Do NOT:
- Show the full node menu on empty canvas click
- Hide Paste when clipboard is empty (it must be grayed/disabled, not hidden — this is the opposite rule from CX-POINT-CONTEXT)
