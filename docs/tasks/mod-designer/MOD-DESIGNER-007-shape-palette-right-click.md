---
id: MOD-DESIGNER-007
title: Add right-click context menus to shape palette (RC-DES-13/14/15)
unit: MOD-DESIGNER
status: pending
priority: medium
depends-on: []
---

## What This Feature Should Do

Each shape tile in the left palette panel should support a right-click context menu with actions appropriate to the shape type. Library shapes (RC-DES-13): Copy to My Shapes, Export SVG. Custom/user shapes (RC-DES-14): Edit Shape, Export SVG, Replace SVG…, Delete. Stencils (RC-DES-15): Edit, Export SVG, Delete.

## Spec Excerpt (verbatim)

> **Shape palette right-click** (RC-DES-13/14/15): Library shapes → Copy to My Shapes, Export SVG. Custom shapes → Edit Shape, Export SVG, Replace SVG…, Delete. Stencils → Edit, Export SVG, Delete.
> — docs/SPEC_MANIFEST.md, CX-CANVAS-CONTEXT Non-Negotiable #4

## Where to Look in the Codebase

Primary files:
- `frontend/src/pages/designer/DesignerLeftPalette.tsx` — no onContextMenu or ContextMenu primitives found (verified by grep)
- `frontend/src/pages/designer/DesignerLeftPalette.tsx` — `ShapeTile` component renders individual shape tiles

## Verification Checklist

Read the code at the files listed above. Check each item:

- [ ] Each ShapeTile is wrapped in `<ContextMenuPrimitive.Root>` + `<ContextMenuPrimitive.Trigger>`
- [ ] Library shapes (isLibraryShape === true) show: Copy to My Shapes, Export SVG
- [ ] Custom shapes (user-uploaded) show: Edit Shape, Export SVG, Replace SVG…, Delete (with confirmation)
- [ ] Stencils show: Edit, Export SVG, Delete (with confirmation)
- [ ] Export SVG downloads the SVG file to the browser

## Assessment

After checking:
- **Status**: ❌ Missing — no right-click implementation in DesignerLeftPalette.tsx

## Fix Instructions

In `frontend/src/pages/designer/DesignerLeftPalette.tsx`, find the `ShapeTile` component and wrap its root element in Radix ContextMenu:

```tsx
import * as ContextMenuPrimitive from '@radix-ui/react-context-menu'

function ShapeTile({ item, collapsed }: { item: ShapeIndexEntry; collapsed?: boolean }) {
  // Determine tile type
  const isLibrary = item.category !== 'custom' && item.category !== 'stencil'
  const isCustom = item.category === 'custom'
  const isStencil = item.category === 'stencil'

  function handleExportSvg() {
    const shapeData = useLibraryStore.getState().getShape(item.id)
    if (!shapeData?.svg) return
    const blob = new Blob([shapeData.svg], { type: 'image/svg+xml' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `${item.id}.svg`; a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <ContextMenuPrimitive.Root>
      <ContextMenuPrimitive.Trigger asChild>
        <div /* existing tile div */> ... </div>
      </ContextMenuPrimitive.Trigger>
      <ContextMenuPrimitive.Portal>
        <ContextMenuPrimitive.Content style={contextMenuContentStyle}>
          {isLibrary && (
            <>
              <ContextMenuPrimitive.Item onSelect={() => { /* copy to my shapes */ }}>
                Copy to My Shapes
              </ContextMenuPrimitive.Item>
              <ContextMenuPrimitive.Item onSelect={handleExportSvg}>
                Export SVG
              </ContextMenuPrimitive.Item>
            </>
          )}
          {isCustom && (
            <>
              <ContextMenuPrimitive.Item onSelect={() => { /* open edit shape dialog */ }}>
                Edit Shape
              </ContextMenuPrimitive.Item>
              <ContextMenuPrimitive.Item onSelect={handleExportSvg}>
                Export SVG
              </ContextMenuPrimitive.Item>
              <ContextMenuPrimitive.Item onSelect={() => { /* file picker to replace SVG */ }}>
                Replace SVG…
              </ContextMenuPrimitive.Item>
              <ContextMenuPrimitive.Separator />
              <ContextMenuPrimitive.Item onSelect={() => {
                if (confirm(`Delete "${item.name}"? This cannot be undone.`)) {
                  /* call API to delete shape */
                }
              }}>
                Delete
              </ContextMenuPrimitive.Item>
            </>
          )}
          {isStencil && (
            <>
              <ContextMenuPrimitive.Item onSelect={() => { /* open stencil editor */ }}>
                Edit
              </ContextMenuPrimitive.Item>
              <ContextMenuPrimitive.Item onSelect={handleExportSvg}>
                Export SVG
              </ContextMenuPrimitive.Item>
              <ContextMenuPrimitive.Separator />
              <ContextMenuPrimitive.Item onSelect={() => {
                if (confirm(`Delete stencil "${item.name}"?`)) {
                  /* call API to delete stencil */
                }
              }}>
                Delete
              </ContextMenuPrimitive.Item>
            </>
          )}
        </ContextMenuPrimitive.Content>
      </ContextMenuPrimitive.Portal>
    </ContextMenuPrimitive.Root>
  )
}
```

The context menu content style should match the canvas context menu style (same design tokens).

Do NOT:
- Use a custom onContextMenu + positioned div (must use Radix ContextMenu primitives)
- Delete without a confirmation dialog
