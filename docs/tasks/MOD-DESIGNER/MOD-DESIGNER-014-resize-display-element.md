---
id: MOD-DESIGNER-014
unit: MOD-DESIGNER
title: Add resize handles and drag resize for standalone display elements
status: pending
priority: medium
depends-on: [MOD-DESIGNER-011]
source: feature
decision: docs/decisions/designer-resize-completeness.md
---

## What to Build

Display elements (`display_element` node type) placed directly on the canvas as standalone nodes need
bounding box resize handles. Display elements that are children of a `symbol_instance` (attached via
valueAnchors) are explicitly excluded from this.

### Part 1 — Ensure `getNodeBounds()` returns correct sizes for display elements

`getNodeBounds()` in `DesignerCanvas.tsx` currently has hardcoded fallback sizes for display element types
(e.g., `text_readout` → `{w: 92, h: 22}`). These must match the node's actual config fields so that resize
handles appear at the right positions:

| `displayType` | Width from | Height from |
|---|---|---|
| `text_readout` | `config.width ?? 92` | `config.height ?? 22` |
| `analog_bar` | `config.barWidth ?? 25` | `config.barHeight ?? 100` |
| `fill_gauge` | `config.barWidth ?? 24` | `config.barHeight ?? 80` |
| `sparkline` | `config.sparkWidth ?? 110` | `config.sparkHeight ?? 18` |
| `alarm_indicator` | `config.width ?? 24` | `config.height ?? 20` |
| `digital_status` | `config.width ?? 30` | `config.height ?? 20` |

Update `getNodeBounds()` to read these config fields instead of using hardcoded values.

### Part 2 — Exclude SymbolInstance-child display elements from resize handles

In the selection/handle rendering logic, display elements that are children of a SymbolInstance should NOT
show bounding box resize handles. Only top-level display elements (direct children of GraphicDocument or a
Group) should show handles.

Check: when a `display_element` is selected, look up whether its parent is a `symbol_instance`. If yes,
suppress the 8 resize handles. If no, show handles as normal.

A helper `getNodeParent(nodeId: NodeId, doc: GraphicDocument): SceneNode | null` may need to be added or
reused if it already exists.

### Part 3 — Add display_element branch to resize mouseup dispatch

Add an `else if (target?.type === 'display_element')` branch:

```
target.type === 'display_element':
  const de = target as DisplayElement
  const cfg = de.config

  // Minimums per type
  const MINS: Record<string, [number, number]> = {
    text_readout: [40, 16],
    analog_bar: [10, 30],
    fill_gauge: [10, 30],
    sparkline: [40, 10],
    alarm_indicator: [20, 16],
    digital_status: [30, 16],
  }
  const [minW, minH] = MINS[de.displayType] ?? [20, 16]
  const finalW = max(minW, nw)
  const finalH = max(minH, nh)

  // Map to the correct config field keys per display type
  const DIM_KEYS: Record<string, [string, string]> = {
    text_readout: ['width', 'height'],
    analog_bar: ['barWidth', 'barHeight'],
    fill_gauge: ['barWidth', 'barHeight'],
    sparkline: ['sparkWidth', 'sparkHeight'],
    alarm_indicator: ['width', 'height'],
    digital_status: ['width', 'height'],
  }
  const [wKey, hKey] = DIM_KEYS[de.displayType] ?? ['width', 'height']

  const prevT = inter.resizeOrigTransform
  const newT = { ...prevT, position: { x: nx, y: ny } }

  executeCmd(new CompoundCommand([
    new ChangePropertyCommand(de.id, `config.${wKey}`, finalW, (cfg as any)[wKey]),
    new ChangePropertyCommand(de.id, `config.${hKey}`, finalH, (cfg as any)[hKey]),
    new ChangePropertyCommand(de.id, 'transform.position', { x: nx, y: ny }, prevT.position),
  ]))
```

(Or use `ResizeNodeWithDimsCommand` if it can be configured with config sub-paths — check commands.ts.)

## Acceptance Criteria

- [ ] Standalone text_readout display elements show resize handles at correct positions and commit size
      changes to `config.width` / `config.height` on mouseup. Min 40×16.
- [ ] Standalone analog_bar and fill_gauge display elements resize via `barWidth`/`barHeight`. Min 10×30.
- [ ] Standalone sparkline display elements resize via `sparkWidth`/`sparkHeight`. Min 40×10.
- [ ] Standalone alarm_indicator and digital_status display elements resize. Min 20×16 and 30×16.
- [ ] Display elements that are children of a SymbolInstance do NOT show bounding box resize handles.
- [ ] Resize is undoable (single Ctrl+Z restores size and position).
- [ ] No regression in how display elements render after resize (they visually match the new dimensions).

## Do NOT

- Do not add resize handles to display elements that are children of SymbolInstance nodes.
- Do not change how display elements attached to SymbolInstances are repositioned (value anchors).
- Do not implement multi-node resize here (MOD-DESIGNER-015).

## Dev Notes

File to edit: `frontend/src/pages/designer/DesignerCanvas.tsx`
The `DisplayElement` and `DisplayElementConfig` types are in `frontend/src/shared/types/graphics.ts`.
The `getNodeBounds()` function is a local helper in DesignerCanvas — look for the switch/if-chain that maps
node types to `{x, y, w, h}`. Update each display element case to read config fields.
`ChangePropertyCommand` supports dot-path property strings (`config.width`) — check commands.ts to confirm
the path syntax matches how the store's Immer produce applies property changes.
The parent-check for SymbolInstance children: the scene graph stores display elements as `children` on
SymbolInstance nodes. When building the selection handle overlay, check if the parent is a symbol_instance.
