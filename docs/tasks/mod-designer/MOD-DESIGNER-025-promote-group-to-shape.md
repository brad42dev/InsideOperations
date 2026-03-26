---
id: MOD-DESIGNER-025
unit: MOD-DESIGNER
title: Extend Promote to Shape wizard to accept groups with display elements as value anchors
status: pending
priority: medium
depends-on: [MOD-DESIGNER-021]
source: feature
decision: docs/decisions/designer-groups-and-tabs.md
---

## What to Build

Extend the existing `PromoteToShapeWizard` component (`frontend/src/pages/designer/components/PromoteToShapeWizard.tsx`)
to accept a **group node** as the source. The wizard already handles a single SVG blob; this adds support
for groups containing a mix of vector primitives, symbol instances, display elements, text blocks, and pipes.

The end goal: a user builds a composite element (e.g., a vessel symbol instance + 3 display elements showing
Level, Temperature, and Pressure), groups it, promotes it to a shape, and the result is a reusable Custom
shape that when placed as a `SymbolInstance` shows the vessel + has pre-wired value anchor slots at the
display element positions.

### Triggering the wizard for a group

The wizard can already be triggered from:
- Right-click on a custom SVG shape → "Promote to Shape"

Add triggering from:
- Right-click on a group node → "Promote to Shape..." (added in MOD-DESIGNER-021's right-click menu)

Pass `sourceType: 'group'` and `sourceNodeId: groupNodeId` to the wizard as props.

### Wizard Step 1 extension — group source analysis

When `sourceType === 'group'`, replace the existing "Upload SVG" step with a **"Source Analysis" step**
that auto-scans the group's children and presents a summary.

Categorize each child:

| Child type | What it becomes | Note |
|---|---|---|
| `primitive` (rect, ellipse, line, path) | SVG geometry | Included in shape SVG |
| `symbol_instance` | SVG geometry | The instance's shape SVG is embedded at its transform |
| `embedded_svg` | SVG geometry | Included as-is |
| `display_element` | Value anchor | Position → anchor; `displayType` → anchor label |
| `text_block` | Text zone | Content → zone label, position → zone position |
| `pipe` | Connection point | Start/end attachment points → connection points |
| `widget` | **Excluded** | Warning shown; user can proceed or cancel |
| nested `group` | Flattened | Children recursively categorized (1 level deep max) |
| `image` | SVG geometry | Embedded as `<image>` in SVG |
| `annotation` | SVG geometry | Included if renderable as SVG |

Show a summary card for each category:
```
✓ 4 geometry elements  (will become shape SVG)
✓ 2 data slots         (will become value anchors)
✓ 1 text zone          (will become a text zone)
⚠ 1 widget             (will be EXCLUDED — widgets cannot be included in shapes)
```

If any widgets are present, show a warning banner:
"⚠ 1 widget will be excluded from the shape. Only vector elements, display elements, and text blocks
can be promoted. Proceed without the widget, or cancel and remove it from the group first."

[Proceed without widget] [Cancel]

If no issues, a [Next →] button advances to Step 2.

### SVG compositing (Step 2 — SVG generation)

The wizard must generate a single SVG file from the geometry elements. The compositing process:

1. Compute the bounding box of all geometry elements in the group
2. Create an SVG with `viewBox="0 0 {bboxW} {bboxH}"`
3. For each geometry element (in z-order, back to front):
   - `primitive`: emit the corresponding SVG element (rect, ellipse, path, etc.) with its transform
     translated to be relative to the group bounding box origin
   - `symbol_instance`: load the shape SVG from `libraryStore`, embed it as a `<g>` with the instance's
     transform (relative to bounding box origin)
   - `embedded_svg`: embed as a `<g>` at its position
   - `image`: embed as `<image>`
4. Display elements, text blocks, and pipes are NOT included in the SVG (they become sidecar metadata)

The generated SVG is shown as a preview in the wizard (same as today's SVG preview step).

### Value anchor generation (Step 3 / sidecar)

For each `display_element` in the group, generate a value anchor entry in the sidecar:

```json
{
  "valueAnchors": [
    {
      "id": "anchor-0",
      "label": "Level",        // from displayType: 'fill_gauge' → "Level"; 'text_readout' → "Value";
                                // 'analog_bar' → "Measurement"; 'sparkline' → "Trend"; etc.
      "x": 42,                  // position relative to shape bounding box (not absolute canvas pos)
      "y": 15,
      "defaultDisplayType": "fill_gauge"  // the original display element type as the default
    }
  ]
}
```

The wizard shows a **"Value Anchors" step** (new, inserted between the existing SVG step and Connection Points
step) where the user can:
- Rename each anchor's label (e.g., change "Value" to "Level")
- Choose the `defaultDisplayType` for each anchor from a dropdown
- Drag anchor positions on the SVG preview to adjust them
- Delete anchors they don't want

### Text zone generation (Step 4 / sidecar)

For each `text_block` in the group, generate a text zone entry:
```json
{
  "textZones": [
    {
      "id": "zone-0",
      "label": "Equipment Tag",  // the text_block's content (or user-editable in wizard)
      "x": 10, "y": 5,
      "defaultText": "TAG-001"   // original text_block content as placeholder
    }
  ]
}
```

### Connection points from pipes

For each `pipe` in the group that has one endpoint unconnected (dangling, i.e., connects to a node inside
the group at one end and nothing at the other end), generate a connection point at the dangling endpoint
position:
```json
{
  "connections": [
    { "id": "conn-0", "label": "Inlet", "x": 0, "y": 60 }
  ]
}
```

### Steps 5–8 — Standard wizard flow

Steps after the new "Value Anchors" step follow the existing wizard flow:
- Name the shape
- Choose or create a category (placed in Custom shapes)
- Review connection points (pre-populated from pipes, user can add/move)
- Review text zones (pre-populated from text_blocks)
- Final review with SVG preview showing anchor and connection point positions
- Promote → create shape in library

### Replace group with SymbolInstance

On the final step, add a toggle: **"Replace group in current graphic with this shape"** (default: on).
When on: after creating the shape in the library, execute:
1. `DeleteNodesCommand` to remove the group from the scene graph
2. `AddNodeCommand` to add a `SymbolInstance` of the new shape at the same position/scale as the group

This is wrapped in a `CompoundCommand` so it's undoable in one step.

## Acceptance Criteria

- [ ] Right-click on a group → "Promote to Shape..." opens the wizard with the group as source.
- [ ] Step 1 shows a source analysis summary: geometry count, data slot count, text zone count, excluded
      widget count (with warning if any).
- [ ] The wizard generates a valid SVG from the group's vector elements.
- [ ] Each display element in the group becomes a value anchor with an auto-labeled name and position.
- [ ] The Value Anchors step lets the user rename anchors and adjust their positions on the SVG preview.
- [ ] The resulting shape appears in the Custom shapes library and can be placed as a SymbolInstance.
- [ ] When placed, the SymbolInstance has pre-wired value anchor slots at the correct positions.
- [ ] "Replace group with shape" toggle works: group is replaced by the new SymbolInstance in one undoable step.
- [ ] Widgets in the group are excluded with a clear warning. The user can proceed or cancel.
- [ ] Cancelling the wizard at any step leaves the scene graph unchanged.

## Do NOT

- Do not try to include widget nodes in the promoted shape SVG.
- Do not implement a new separate "Save as Template" mechanism — this uses the existing Promote to Shape
  wizard extended for groups.
- Do not change the existing single-SVG promotion flow (when source is a raw SVG upload, not a group).

## Dev Notes

File to edit: `frontend/src/pages/designer/components/PromoteToShapeWizard.tsx`

The wizard already has a multi-step structure. The group source adds:
- A new conditional entry path (when `sourceType === 'group'`) that skips the "Upload SVG" step and
  replaces it with the "Source Analysis" step
- A new "Value Anchors" step injected between SVG preview and Connection Points
- Modified sidecar generation to include `valueAnchors` from display elements and `textZones` from
  text_blocks

SVG compositing for `symbol_instance` children: load SVGs from `libraryStore.shapes`. The libraryStore
already has a shape cache — use `libraryStore.getShapeSvg(shapeId)`. Embed as `<g transform="...">` using
the instance's transform values.

Positioning relative to bounding box: subtract `groupBBox.x` and `groupBBox.y` from all absolute
canvas positions when generating SVG coordinates and sidecar anchor positions.

Display type → anchor label mapping:
- `fill_gauge` → "Level" / "Fill"
- `analog_bar` → "Measurement"
- `text_readout` → "Value"
- `sparkline` → "Trend"
- `alarm_indicator` → "Alarm"
- `digital_status` → "Status"

The "drag anchor positions on SVG preview" feature in the Value Anchors step: a simple SVG interaction
where anchor dots (teal circles) can be dragged within the preview SVG. Update the anchor x/y in wizard
local state. No need for full canvas interaction — just SVG `onMouseDown`/`onMouseMove`/`onMouseUp` on
the anchor dots.
