# Frontend — Working Instructions

## Point Identity Rule — Non-Negotiable

UUIDs are an **internal storage detail**. Frontend code must never treat a raw UUID as a point identifier.

**The only correct point reference in frontend code is `tagname` (+ `source_id` when disambiguation is needed).**

### What this means in practice

- Point bindings in scene nodes carry `pointTag` (tagname string) or `pointId` that is a tagname stored in the pointId field. Both resolve through `resolvedTagMap` before any WS subscription or DOM mutation.
- `resolvedTagMap` in `SceneRenderer.tsx` is the single resolution path. Do not add a second one. Do not bypass it.
- `data-point-id` DOM attributes contain resolved UUIDs — this is correct and intentional. The WS wire format is UUID-keyed for broker performance. This is the one layer where UUIDs belong.
- If `resolvedTagMap` does not yet contain an entry for a tagname (async, still loading), the element shows offline/loading state. It does not fall back to using the tagname string as a UUID.
- `POST /api/points/resolve-tags` is the API endpoint for bulk tag→UUID resolution. Use it; do not hand-roll alternatives.
- Do not add new API call sites that take a UUID as a URL parameter and display the result to the user. Route through tagname.

### False-DONE patterns

- Subscribing to a WS point by passing a raw tagname string where a UUID is expected
- Skipping `resolvedTagMap` and calling `wsManager.subscribe(tagname, handler)` directly
- Displaying a UUID string in any UI element visible to the user
- Adding a "resolve later, display now" path that shows UUIDs temporarily

## WebSocket Subscription Pattern

```
tagname → resolvedTagMap.get(tagname) → UUID → wsManager.subscribe(UUID, handler)
```

The `wsManager` and WS worker communicate UUID-keyed. `SceneRenderer` and `GraphicPane` are the resolution boundary. Everything above them is tagname-land.

## Chart / TrendPane point binding

Charts bind points using `PortablePointBinding` (tagname form) for storage and export. UUID resolution happens inside the chart component before WS subscription. Do not store resolved UUIDs in chart config — they are not portable across database instances.
