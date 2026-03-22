# Process Module — Spec Authority

**BEFORE editing any file in this directory**, read the spec:

```
/home/io/spec_docs/process-implementation-spec.md
```

This spec takes priority over design-docs/08_PROCESS_MODULE.md when they conflict.

## Non-Negotiables

- **LOD class on container div** — Level-of-detail class (`.lod-0`, `.lod-1`, `.lod-2`, `.lod-3`) is applied to `io-canvas-container`, NOT to the SVG root element.
- **Zoom range 5%–800%** — clamp zoom outside this range. Do not allow free zoom beyond these bounds.
- **Spatial index** — flat sorted array by default; only upgrade to rbush R-tree when bound elements exceed 2,000.
- **Initial zoom-to-fit** — on first load, the graphic zooms to fit the viewport. Do not open at 100% scale.
- **Scope warning** — Process module shows one graphic at a time. It is not a multi-pane workspace (that is Console).

## False-DONE Patterns — Do Not Accept

- LOD class applied to `<svg>` element instead of the container div
- No initial zoom-to-fit (graphic renders at 100% requiring user to manually zoom out)
- rbush R-tree used unconditionally regardless of element count
- Zoom allowed below 5% or above 800%
