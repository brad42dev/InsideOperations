# Graphics System — Spec Authority

**BEFORE editing any file in this directory**, read the specs in order:

1. **Scene graph**: `/home/io/spec_docs/graphics-scene-graph-implementation-spec.md`
2. **Display elements**: `/home/io/spec_docs/display-elements-implementation-spec.md`
3. **Shape library**: `/home/io/spec_docs/shape-library-implementation-spec.md`

These take priority over design-docs/19_GRAPHICS_SYSTEM.md when they conflict.

## Non-Negotiables

- **Exactly 11 SceneNode types** — `symbol_instance`, `display_element`, `primitive`, `pipe`, `text_block`, `stencil`, `group`, `annotation`, `image`, `widget`, `embedded_svg`. `NavigationLink` is a property on `SceneNodeBase`, not a node type. `GraphicDocument` is the root container, not a SceneNode.
- **Hybrid rendering thresholds** — React renders above 3,000 elements (static), hybrid at 1,500–3,000, direct DOM mutation below 1,500. These numbers are from the spec; do not invent different thresholds.
- **Real-time updates bypass React entirely** — point value updates write directly to the SVG DOM. Do not push point values through React state or Zustand.
- **LOD class on container div** — `.lod-0` through `.lod-3` applied to `io-canvas-container`, not to `<svg>`. Per-element `data-lod` attribute controls individual element behavior.

## False-DONE Patterns — Do Not Accept

- A 12th or 13th SceneNodeType added (e.g., `navigation_link`, `graphic_document`)
- Point value updates routed through React state causing re-renders on every tick
- LOD class applied to the SVG element instead of its container div
- Hybrid rendering threshold numbers invented rather than taken from the spec
