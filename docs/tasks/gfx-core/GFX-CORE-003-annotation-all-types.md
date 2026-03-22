---
id: GFX-CORE-003
title: Implement all 9 annotation types in renderAnnotation (7 currently return null)
unit: GFX-CORE
status: pending
priority: medium
depends-on: []
---

## What This Feature Should Do

The `Annotation` scene node supports 9 subtypes: `callout`, `dimension_line`, `north_arrow`, `legend`, `border`, `section_break`, `page_break`, `header`, and `footer`. `renderAnnotation` in SceneRenderer only handles `border` and `callout`. The other 7 types silently return `null`, meaning they are invisible in both the Console/Process viewer and in the Designer. Graphics with dimension lines, legends, drawing borders with title blocks, headers, or footers cannot be displayed at all.

## Spec Excerpt (verbatim)

> **2.9 Annotation**
> ```typescript
> type AnnotationType = 'callout' | 'dimension_line' | 'north_arrow' | 'legend' | 'border' | 'section_break' | 'page_break' | 'header' | 'footer'
> ```
> Each annotation type has a specific `AnnotationConfig` discriminated union and must be rendered.
> — graphics-scene-graph-implementation-spec.md, §2.9

## Where to Look in the Codebase

Primary files:
- `frontend/src/shared/graphics/SceneRenderer.tsx:686–716` — `renderAnnotation` function; only `border` and `callout` handled; all others fall through to `return null`
- `frontend/src/shared/types/graphics.ts:331–435` — all 9 `AnnotationConfig` interfaces with complete field definitions

## Verification Checklist

- [ ] `renderAnnotation` handles `dimension_line`: renders a horizontal/vertical dimension line with extension lines and an optional label, positioned using `startPoint` and `endPoint` from config.
- [ ] `renderAnnotation` handles `north_arrow`: renders a north arrow or compass rose symbol in the specified style and size.
- [ ] `renderAnnotation` handles `legend`: renders a bordered box with color swatches and labels for each entry in `config.entries`.
- [ ] `renderAnnotation` handles `section_break`: renders a horizontal line in the specified style (solid/dashed/dotted) at the node's position.
- [ ] `renderAnnotation` handles `page_break`: renders a visual page break indicator (dashed horizontal line or similar).
- [ ] `renderAnnotation` handles `header`: renders a text block at the top of the canvas area with specified content, height, and alignment.
- [ ] `renderAnnotation` handles `footer`: renders a text block at the bottom of the canvas area with specified content, height, and alignment.
- [ ] All 9 cases call `handleNodeClick(node, e)` on click (see GFX-CORE-002 dependency).

## Assessment

- **Status**: ⚠️ Wrong — 7 of 9 types return null
- **What needs to change**: Implement the 7 missing branches in the `renderAnnotation` switch/if chain

## Fix Instructions

In `frontend/src/shared/graphics/SceneRenderer.tsx`, extend the `renderAnnotation` function at line 686.

The current structure uses `if (config.annotationType === ...)` chains. Add the following cases. Use the existing `border` rendering as the style reference (line 686–706).

**Field reference** — all config types are in `types/graphics.ts:331–430`. Cast `config` to the correct config type inside each branch.

**`dimension_line`** (`DimensionLineConfig`):
- Draw a horizontal or vertical dimension line between `startPoint` and `endPoint`
- Draw short perpendicular extension lines at each end
- Place label text (if `label` exists) centered above/beside the line
- Use `config.color` for stroke, `config.fontSize` for label text, `config.offset` to shift the dimension line away from the measured object

**`north_arrow`** (`NorthArrowConfig`):
- `style: 'simple'`: draw an upward arrow (triangle pointing up with a stem)
- `style: 'compass'`: draw N/S/E/W marks with a compass rose outline
- Use `config.size` for overall bounding box, `config.color` for stroke/fill

**`legend`** (`LegendConfig`):
- Draw a rounded rect background (`config.backgroundColor`, `config.borderColor`)
- For each entry in `config.entries`: draw the symbol (line/rect/circle) in `entry.color`, then `entry.label` text beside it
- Space entries vertically, using `config.fontSize` for text

**`section_break`** (`SectionBreakConfig`):
- Draw a horizontal line spanning the canvas width at the node's y position
- `style: 'line'`: solid stroke; `style: 'dotted'`: `strokeDasharray="2 4"`; `style: 'space'`: two lighter lines with a gap
- Use `config.color` for stroke, `config.thickness` for strokeWidth

**`page_break`** (`PageBreakConfig`):
- Draw a dashed horizontal line spanning the canvas width; no config fields beyond annotationType

**`header`** (`HeaderConfig`):
- Draw a `<rect>` spanning canvas width and `config.height` at y=0 (or node position)
- Draw `<text>` centered/aligned per `config.textAlign` at `config.fontSize`
- Content: `config.content`

**`footer`** (`FooterConfig`):
- Same as header but positioned at the bottom (canvas height - `config.height`)

Do NOT:
- Return null for unrecognized annotation types — add a fallback placeholder rectangle with the annotation type label so it is visible in the designer
- Build annotation elements using raw HTML injection — all elements must be built with React SVG primitives (rect, line, text, path, etc.)
