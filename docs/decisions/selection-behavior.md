# Selection Behavior — Canonical Spec

Two modes exist in the application. All canvas-based views must use one of them.

---

## Mode A — View (Console, Process, any read-only SceneRenderer)

**Implementation hooks:** `useNodeClick` + `useNodeMarquee` in `shared/hooks/`

### Click selection
- Single click on a `[data-node-id]` element → selects that node (replaces selection in zone)
- Click on background → clears selection in zone
- Ctrl/Cmd click → add/remove from selection
- Hit testing: `elementFromPoint` first; if empty, probe an 8-point radius (±4px) to handle `fill="none"` paths
- Visual indicator: `io-node-selected` CSS class on the `[data-node-id]` group → `filter: drop-shadow()` glow follows shape contours

### Marquee selection
- Pointer down anywhere in the container → begin tracking
- After ≥ 3px of movement → acquire pointer capture, show marquee rect overlay
- Pointer up → collect all `[data-node-id]` elements whose bounding rects intersect the selection rect; replace selection
- Minimum box size to trigger selection: 6 × 6px
- After marquee, suppress the synthesized click event so selection is not immediately cleared
- Visual: `border: 1px solid var(--io-accent)` + `10% accent fill`

### CSS
```css
/* Single or console-selected node */
[data-node-id].io-node-selected {
  filter: drop-shadow(0 0 3px color-mix(in srgb, var(--io-accent) 80%, transparent))
          drop-shadow(0 0 6px color-mix(in srgb, var(--io-accent) 40%, transparent));
}
```

---

## Mode B — Editable (Designer)

Implemented in `DesignerCanvas.tsx` via `interactionRef` FSM. Do not extract or replace.

### Click selection
- Single click on unselected node (no modifier) → replace selection with that node
- Shift or Ctrl click → toggle node in/out of selection
- Click on background (no hit) → clear selection

### Group drag (deferred selection)
- Mousedown on an **already-selected** node in a **multi-select** (no modifier):
  - Do NOT collapse selection immediately
  - Store `deferredSingleSelectId` in `interactionRef`
  - Begin drag with the full current selection
  - On mouseup with movement > 0.5px → discard deferred id; group has moved
  - On mouseup with movement ≤ 0.5px → commit deferred id as single-select (was a click, not a drag)

### Marquee selection
- Drag on empty canvas → rubber-band rect
- On release, all nodes whose AABB intersects the rect are selected
- Shift = additive, Alt = subtractive, no modifier = replace

---

## Shared infrastructure

| File | Purpose |
|------|---------|
| `shared/hooks/useNodeMarquee.ts` | Marquee pointer FSM for Mode A |
| `shared/hooks/useNodeClick.ts` | Click hit-test + selection for Mode A |
| `store/globalSelectionStore.ts` | Selection state, zone registration |
| `index.css` → `.io-node-selected` | Canonical glow CSS for Mode A |

---

## Adding a new canvas view

1. Determine the mode (editable → Mode B pattern; read-only → Mode A hooks)
2. Register a selection zone in `globalSelectionStore` on mount
3. For Mode A: use `useNodeClick` + `useNodeMarquee` — do not inline the pointer logic
4. Apply `io-node-selected` class (not a custom one) so the glow is consistent
5. Clear the zone on unmount
