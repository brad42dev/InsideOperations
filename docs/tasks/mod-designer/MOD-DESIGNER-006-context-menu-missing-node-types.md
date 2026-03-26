---
id: MOD-DESIGNER-006
title: Add missing node-type-specific context menu items (RC-DES-6/7/8/10/11)
unit: MOD-DESIGNER
status: pending
priority: medium
depends-on: [MOD-DESIGNER-004]
---

## What This Feature Should Do

Five node types are missing their type-specific context menu items. When a user right-clicks one of these nodes, only the generic base items appear. The spec requires additional items for: ImageNode (Replace Image, Reset to Original Size, Crop), Stencil (Promote to Shape, Replace SVG), EmbeddedSvg (Explode to Primitives, Promote to Shape, Save as Stencil), TextBlock (Change Font, Text Alignment submenu — existing "Edit Text" is present but incomplete), and Annotation (Edit Annotation, Change Style submenu).

## Spec Excerpt (verbatim)

> **Node-type-specific additions** (appended after base items):
> - `ImageNode` (RC-DES-6): Replace Image…, Reset to Original Size, Crop…
> - `Stencil` (RC-DES-7): Promote to Shape…, Replace SVG…
> - `EmbeddedSvg` (RC-DES-8): Explode to Primitives, Promote to Shape…, Save as Stencil…
> - `TextBlock` (RC-DES-10): Edit Text (opens inline text editor), Change Font…, Text Alignment submenu
> - `Annotation` (RC-DES-11): Edit Annotation, Change Style (note/warning/info variants)
> — docs/SPEC_MANIFEST.md, CX-CANVAS-CONTEXT Non-Negotiable #3

## Where to Look in the Codebase

Primary files:
- `frontend/src/pages/designer/DesignerCanvas.tsx:4135-4279` — existing type-specific sections for SymbolInstance, DisplayElement, Pipe, Group, TextBlock, Widget. Need new sections for ImageNode, Stencil, EmbeddedSvg, Annotation.
- `frontend/src/pages/designer/DesignerCanvas.tsx:3756-3810` — `DesignerContextMenuContent` props and node type detection at top — add imageNode, stencilNode, embeddedSvgNode, annotationNode variables
- `frontend/src/shared/types/graphics.ts` — ImageNode, Stencil, EmbeddedSvgNode, Annotation type interfaces

## Verification Checklist

Read the code at the files listed above. Check each item:

- [ ] Right-clicking an ImageNode shows: Replace Image… (opens file picker), Reset to Original Size, Crop… (opens crop dialog or noted as future)
- [ ] Right-clicking a Stencil shows: Promote to Shape… (opens PromoteToShapeWizard), Replace SVG… (opens file picker)
- [ ] Right-clicking an EmbeddedSvg shows: Explode to Primitives (converts to Primitive nodes via command), Promote to Shape…, Save as Stencil…
- [ ] Right-clicking a TextBlock shows existing "Edit Text" PLUS: Change Font…, Text Alignment submenu (Left/Center/Right/Justify)
- [ ] Right-clicking an Annotation shows: Edit Annotation, Change Style submenu (Note/Warning/Info/Error)

## Assessment

After checking:
- **Status**: ❌ Missing — no imageNode/stencilNode/embeddedSvgNode/annotationNode branches exist in DesignerContextMenuContent

## Fix Instructions

In `DesignerContextMenuContent` (line 3756), add new type detection variables after line 3807:

```tsx
const imageNode = targetNode?.type === 'image' ? (targetNode as ImageNode) : null
const stencilNode = targetNode?.type === 'stencil' ? (targetNode as Stencil) : null
const embeddedSvgNode = targetNode?.type === 'embedded_svg' ? (targetNode as EmbeddedSvgNode) : null
const annotationNode = targetNode?.type === 'annotation' ? (targetNode as import('../../shared/types/graphics').Annotation) : null
```

Then add JSX blocks before the closing `</ContextMenuPrimitive.Content>`:

**RC-DES-6 ImageNode:**
```tsx
{imageNode && (
  <>
    <ContextMenuPrimitive.Separator style={sepStyle} />
    <ContextMenuPrimitive.Item style={itemStyle} onSelect={() => {
      // trigger hidden file input for image replacement
    }}>Replace Image…</ContextMenuPrimitive.Item>
    <ContextMenuPrimitive.Item style={itemStyle} onSelect={() => {
      if (!nodeId || !imageNode) return
      // Reset displayWidth/displayHeight to original via ChangePropertyCommand
      executeCmd(new CompoundCommand('Reset Image Size', [
        new ChangePropertyCommand(nodeId, 'displayWidth', imageNode.naturalWidth ?? imageNode.displayWidth, imageNode.displayWidth),
        new ChangePropertyCommand(nodeId, 'displayHeight', imageNode.naturalHeight ?? imageNode.displayHeight, imageNode.displayHeight),
      ]))
    }}>Reset to Original Size</ContextMenuPrimitive.Item>
    <ContextMenuPrimitive.Item style={itemStyle} disabled>Crop… (coming soon)</ContextMenuPrimitive.Item>
  </>
)}
```

**RC-DES-7 Stencil:**
```tsx
{stencilNode && (
  <>
    <ContextMenuPrimitive.Separator style={sepStyle} />
    <ContextMenuPrimitive.Item style={itemStyle} onSelect={() => {
      if (!doc || !nodeId) return
      setPromoteNodes([stencilNode])
    }}>Promote to Shape…</ContextMenuPrimitive.Item>
    <ContextMenuPrimitive.Item style={itemStyle} onSelect={() => {
      // trigger file input to replace SVG
    }}>Replace SVG…</ContextMenuPrimitive.Item>
  </>
)}
```

**RC-DES-8 EmbeddedSvg:**
```tsx
{embeddedSvgNode && (
  <>
    <ContextMenuPrimitive.Separator style={sepStyle} />
    <ContextMenuPrimitive.Item style={itemStyle} onSelect={() => {
      if (!nodeId) return
      // Create an ExplodeToPrimitivesCommand that parses the embedded SVG into Primitive nodes
      // This requires a command that takes the embeddedSvgNode.svgContent and creates child Primitives
    }}>Explode to Primitives</ContextMenuPrimitive.Item>
    <ContextMenuPrimitive.Item style={itemStyle} onSelect={() => {
      if (!doc) return
      setPromoteNodes([embeddedSvgNode])
    }}>Promote to Shape…</ContextMenuPrimitive.Item>
    <ContextMenuPrimitive.Item style={itemStyle} onSelect={() => {
      if (!doc) return
      setStencilNodes([embeddedSvgNode])
    }}>Save as Stencil…</ContextMenuPrimitive.Item>
  </>
)}
```

**RC-DES-10 TextBlock** (extend existing section at line 4254):
Add Change Font and Text Alignment after "Edit Text":
```tsx
<ContextMenuPrimitive.Item style={itemStyle} onSelect={() => { /* open font picker */ }}>Change Font…</ContextMenuPrimitive.Item>
<ContextMenuPrimitive.Sub>
  <ContextMenuPrimitive.SubTrigger style={itemStyle}>Text Alignment</ContextMenuPrimitive.SubTrigger>
  <ContextMenuPrimitive.Portal>
    <ContextMenuPrimitive.SubContent style={subContentStyle}>
      {(['left', 'center', 'right', 'justify'] as const).map(align => (
        <ContextMenuPrimitive.Item key={align} style={itemStyle}
          onSelect={() => {
            if (!nodeId || !textBlockNode) return
            executeCmd(new ChangePropertyCommand(nodeId, 'textAlign', align, textBlockNode.textAlign))
          }}>
          {textBlockNode?.textAlign === align ? `✓ ${align}` : align.charAt(0).toUpperCase() + align.slice(1)}
        </ContextMenuPrimitive.Item>
      ))}
    </ContextMenuPrimitive.SubContent>
  </ContextMenuPrimitive.Portal>
</ContextMenuPrimitive.Sub>
```

**RC-DES-11 Annotation:**
```tsx
{annotationNode && (
  <>
    <ContextMenuPrimitive.Separator style={sepStyle} />
    <ContextMenuPrimitive.Item style={itemStyle} onSelect={() => { /* open annotation edit dialog */ }}>Edit Annotation</ContextMenuPrimitive.Item>
    <ContextMenuPrimitive.Sub>
      <ContextMenuPrimitive.SubTrigger style={itemStyle}>Change Style</ContextMenuPrimitive.SubTrigger>
      <ContextMenuPrimitive.Portal>
        <ContextMenuPrimitive.SubContent style={subContentStyle}>
          {(['note', 'warning', 'info', 'error'] as const).map(style => (
            <ContextMenuPrimitive.Item key={style} style={itemStyle}
              onSelect={() => {
                if (!nodeId) return
                executeCmd(new ChangePropertyCommand(nodeId, 'annotationStyle', style, annotationNode.annotationStyle))
              }}>
              {style.charAt(0).toUpperCase() + style.slice(1)}
            </ContextMenuPrimitive.Item>
          ))}
        </ContextMenuPrimitive.SubContent>
      </ContextMenuPrimitive.Portal>
    </ContextMenuPrimitive.Sub>
  </>
)}
```

Do NOT:
- Implement Crop for ImageNode as a full feature now — a "coming soon" disabled item is acceptable
- Add ExplodeToPrimitivesCommand without also adding it to `commands.ts` with proper execute/undo
