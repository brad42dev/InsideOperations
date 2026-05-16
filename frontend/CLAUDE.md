# Frontend (React + Vite + TypeScript)

Dev server: `pnpm dev` (port 5173). Build: `pnpm build`. Test: `pnpm test`. Lint: `pnpm lint`.

## Frontend-specific invariants

- **Point identity:** UUIDs never appear in user-facing code. All point references use `pointTag` or `pointId` (resolved). Resolution flows through `resolvedTagMap` in `SceneRenderer` and `POST /api/points/resolve-tags`. If resolution fails or is still loading, show error/offline — never silent bind or fall back to using a tagname string as a UUID. Only exception: `data-point-id` attributes on SVG elements (WS wire format is UUID-keyed).
- **`point_meta.tagname`** — one word, no underscore. API returns `tagname`.

### WS subscription flow
```
tagname → resolvedTagMap.get(tagname) → UUID → wsManager.subscribe(UUID, handler)
```
`SceneRenderer` and `GraphicPane` are the resolution boundary. Everything above them is tagname-land. Do not add a second resolution path; do not bypass `resolvedTagMap`.

### False-DONE patterns
- Subscribing to WS by passing a raw tagname where a UUID is expected
- Calling `wsManager.subscribe(tagname, handler)` directly, skipping `resolvedTagMap`
- Displaying a UUID string in any UI element visible to the user
- Adding a "resolve later, display now" path that shows UUIDs temporarily

## React quirks
- `position: fixed` inside `react-grid-layout` breaks due to CSS transforms. Use `createPortal(el, document.body)` instead. See `src/shared/graphics/` for the established pattern.
- Designer scope lives at `doc.metadata.graphicScope`, not `doc.scope`.

## API quirks
- `aggregation_types = 0` means *unrestricted* (all types allowed), not "none". Sending 0 in the wrong context produces HTTP 400 on all charts.
- Chart configs store point bindings as `PortablePointBinding` (tagname form). UUID resolution happens inside the chart component before WS subscription. Do not store resolved UUIDs in chart config — they are not portable across database instances.
