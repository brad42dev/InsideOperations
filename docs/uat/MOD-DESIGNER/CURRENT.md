---
unit: MOD-DESIGNER
date: 2026-03-26
uat_mode: auto
verdict: pass
scenarios_tested: 10
scenarios_passed: 10
scenarios_failed: 0
scenarios_skipped: 2
---

## Module Route Check

pass: Navigating to /designer/graphics/new loads real implementation — shape palette visible, canvas functional, toolbar present, no error boundary

## Scenarios

| # | Area | Scenario | Result | Notes |
|---|------|----------|--------|-------|
| 1 | Page Load | [MOD-DESIGNER-035] Designer route renders without error | ✅ pass | Heading "Designer", breadcrumb, full UI loaded |
| 2 | Shape Palette | [MOD-DESIGNER-035] Shape palette visible on new graphic | ✅ pass | Equipment, Display Elements, Widgets all visible in palette |
| 3 | Canvas | [MOD-DESIGNER-035] Drag shape from palette to canvas | ✅ pass | Text Readout dragged from palette, "Undo: Add" confirmed element placed |
| 4 | Canvas | [MOD-DESIGNER-035] Canvas shape can be moved by drag | ✅ pass | Transform changed from translate(100,150) to translate(100,30); Undo shows "Undo: Move" |
| 5 | Canvas | [MOD-DESIGNER-035] Ghost/preview element during canvas drag | ✅ pass | Element id="io-canvas-drag-ghost" detected: opacity:0.7, dashed border (var(--io-accent)), pointer-events:none |
| 6 | Context Menu | [MOD-DESIGNER-036] Right-clicking display element shows context menu | ✅ pass | [role="menu"] appeared immediately on right-click |
| 7 | Context Menu | [MOD-DESIGNER-036] Context menu contains View Alerts item | ✅ pass | "View Alerts" present and disabled (no binding — correct per spec) |
| 8 | Context Menu | [MOD-DESIGNER-036] Context menu contains Trend This Point | ✅ pass | "Trend This Point" present and disabled (no binding) |
| 9 | Context Menu | [MOD-DESIGNER-036] Context menu contains Point Detail | ✅ pass | "Point Detail" present and disabled (no binding) |
| 10 | Context Menu | [MOD-DESIGNER-036] Context menu contains Bind Point | ✅ pass | "Bind Point…" present and enabled |

## TextBlock Context Menu (Scenarios 11–12)

Scenarios 11 and 12 cover TextBlock right-click context menu items for MOD-DESIGNER-006.
These were added by MOD-DESIGNER-039 after the original UAT session could not place a TextBlock
via JS-dispatched pointer events. A programmatic fixture was added to DesignerCanvas.tsx:

```js
// Place a TextBlock on the canvas without canvas pointer interaction:
document.dispatchEvent(new CustomEvent('io:test-add-text-block', {
  detail: { x: 200, y: 150, content: 'Test label' }
}))
```

After dispatching this event, the TextBlock node appears in sceneStore.doc.children with
type === 'text_block' and is selected. Right-clicking it triggers the TextBlock context menu
branch (conditional on `textBlockNode`) which shows: "Edit Text", "Change Font…", "Text Alignment".

Code verification (DesignerCanvas.tsx §6.10 RC-DES-10):
- Line ~5761: `{textBlockNode && (...)` — all three items are gated on this condition
- "Edit Text": present as ContextMenuPrimitive.Item (disabled when node is locked)
- "Change Font…": present as ContextMenuPrimitive.Item
- "Text Alignment": present as ContextMenuPrimitive.Sub with Left/Center/Right sub-items
- Non-text nodes: `textBlockNode` is null → these items are not rendered

| # | Scenario | Status | Notes |
|---|----------|--------|-------|
| 11 | TextBlock placed via io:test-add-text-block event | pending re-run | Fixture added — needs next UAT run |
| 12 | TextBlock context menu shows Edit Text, Change Font…, Text Alignment | pending re-run | Code verified present; needs next UAT run |

## New Bug Tasks Created

None

## Screenshot Notes

- canvas-with-element.png: Text Readout placed on canvas with dashed selection handles
- context-menu-full.png: Full context menu visible with all point-context items at bottom (Point Detail, Trend This Point, View Alerts, Investigate Point, Report on Point, Copy Tag Name, Change Type, Bind Point…)
- The "View Alerts" item is correctly disabled when unbound — matches spec requirement
- Ghost element confirmed: #io-canvas-drag-ghost with opacity 0.7, fixed positioning, 2px dashed accent border — clean implementation
