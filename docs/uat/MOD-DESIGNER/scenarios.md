# UAT Scenarios — MOD-DESIGNER

Generated: 2026-03-26
Tasks: MOD-DESIGNER-049, 050, 051, 052, 053, 054
Mode: auto
Seed data: UNAVAILABLE

---

## Designer Home Hub Cards

Scenario 1: [MOD-DESIGNER-054] Designer home renders without error — navigate to /designer → page loads with hub cards visible; no error boundary; no "Something went wrong"

Scenario 2: [MOD-DESIGNER-054] — data flow: GET /api/v1/graphics — navigate to /designer, wait 3s for hub cards to load → Graphics hub card visible alongside Dashboards and Report Templates, count field is present (numeric or "—")

Scenario 3: [MOD-DESIGNER-054] Graphics Browse button navigates correctly — click Browse button on Graphics hub card → navigates to /designer/graphics (URL or page heading indicates graphics listing)

Scenario 4: [MOD-DESIGNER-054] Graphics New button navigates correctly — click "+ New" button on Graphics hub card → navigates to /designer/graphics/new (empty canvas or new graphic form)

---

## Drag Ghost (Palette to Canvas)

Scenario 5: [MOD-DESIGNER-053] Palette drag ghost element appears in DOM — navigate to /designer/graphics/new, install MutationObserver on document.body, drag a Display Elements palette tile toward canvas → evaluate window.__ghostSeen returns true (#io-canvas-drag-ghost detected during drag)

---

## Canvas Drag-to-Move

Scenario 6: [MOD-DESIGNER-049][MOD-DESIGNER-051] Canvas element drag moves to new position — place shape on canvas, click to select, drag element 100px right → element at new position (not original), scene panel shows same element count (no duplicates)

Scenario 7: [MOD-DESIGNER-049][MOD-DESIGNER-051] Undo after canvas drag shows Move — after successful drag-move → undo button/label references "Move" not "Add"

---

## Escape Key Drag Cancel

Scenario 8: [MOD-DESIGNER-052] Escape cancels in-progress canvas drag — place shape, select it, begin drag (mousedown+mousemove, do NOT release), press Escape → element returns to original position; undo stack has no Move entry

---

## Annotation Context Menu

Scenario 9: [MOD-DESIGNER-050] Annotation right-click shows "Change Style" — place text annotation (T key + click canvas), switch to Select mode (V/Escape), right-click annotation → [role="menu"] visible containing "Change Style" menuitem

Scenario 10: [MOD-DESIGNER-050] "Change Style" click opens style picker — after right-click annotation, click "Change Style" menu item → style popover or dialog opens (UI changes, not a no-op)
