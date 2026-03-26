---
id: MOD-DESIGNER-038
title: Fix Annotation "Change Style" submenu to use spec-required note/warning/info variants
unit: MOD-DESIGNER
status: pending
priority: medium
depends-on: []
---

## What This Feature Should Do

When the user right-clicks an Annotation node, the "Change Style" submenu should offer the three annotation style variants defined in the spec: note, warning, and info. The current implementation instead shows annotation types (callout, legend, border, title_block) which are annotation sub-types, not style variants. The spec defines a style system that changes the visual presentation (icon, border color, background) of the annotation without changing its structural type.

## Spec Excerpt (verbatim)

> `Annotation` (RC-DES-11): Edit Annotation, Change Style (note/warning/info variants)
> — docs/SPEC_MANIFEST.md, CX-CANVAS-CONTEXT Non-Negotiable #3

## Where to Look in the Codebase

Primary files:
- `frontend/src/pages/designer/DesignerCanvas.tsx:5873–5903` — the `{annotationNode && ...}` block with the Change Style submenu. Currently iterates over `['callout', 'legend', 'border', 'title_block']` annotation types.
- `frontend/src/shared/types/graphics.ts` — the `Annotation` interface and any `annotationStyle` field (may not exist yet).

## Verification Checklist

Read the code at the files listed above. Check each item:

- [ ] The Change Style submenu for Annotation nodes offers exactly: Note, Warning, Info (three options)
- [ ] Selecting a style updates an `annotationStyle` field (or equivalent property) on the Annotation node via ChangePropertyCommand
- [ ] The three styles produce visually distinct annotations: Note = gray/info, Warning = amber/caution, Info = blue/informational
- [ ] The current selected style shows a checkmark prefix
- [ ] Changing style does not change the annotationType (callout, legend, etc. structure remains)

## Assessment

After checking:
- **Status**: ⚠️ Wrong — `DesignerCanvas.tsx:5887` iterates `['callout', 'legend', 'border', 'title_block']` which are annotation structure types, not the style variants (note/warning/info) specified. The spec's "Change Style" is about visual styling of a single annotation, not changing it to a completely different annotation type.

## Fix Instructions

Two changes are needed:

**1. Add `annotationStyle` to the Annotation type** (if not present) in `frontend/src/shared/types/graphics.ts`:
```typescript
export type AnnotationStyle = 'note' | 'warning' | 'info'

// Add to Annotation interface:
annotationStyle?: AnnotationStyle  // default: 'note'
```

**2. Replace the Change Style submenu content** in `DesignerCanvas.tsx` around line 5887:
```tsx
{(['note', 'warning', 'info'] as const).map(style => {
  const labels = { note: 'Note', warning: 'Warning', info: 'Info' }
  const currentStyle = (annotationNode as Annotation & { annotationStyle?: string }).annotationStyle ?? 'note'
  return (
    <ContextMenuPrimitive.Item key={style} style={itemStyle}
      onSelect={() => {
        if (!nodeId) return
        executeCmd(new ChangePropertyCommand(nodeId, 'annotationStyle', style, currentStyle))
      }}>
      {currentStyle === style ? `\u2713 ${labels[style]}` : labels[style]}
    </ContextMenuPrimitive.Item>
  )
})}
```

The visual rendering of style variants (icon, border color) is a separate rendering concern in the Annotation renderer inside RenderNode — update it to read `annotationStyle` and apply appropriate CSS custom property colors.

Do NOT:
- Change the `annotationType` when the user picks a style — style and type are orthogonal
- Remove the existing annotationType support (callout, legend, etc. still need to work)
- Use hardcoded hex colors for Warning/Info styles — use `--io-status-warning` and `--io-accent` tokens
