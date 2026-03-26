# UAT Scenarios — MOD-DESIGNER

**Tasks under test:** MOD-DESIGNER-002, MOD-DESIGNER-006, MOD-DESIGNER-009
**Date:** 2026-03-26
**Seed data:** UNAVAILABLE

## Page Load

Scenario 1: [MOD-DESIGNER-002] Designer page renders without error — navigate to /designer → page loads with toolbar, left palette, canvas, right panel; no error boundary text

## Drag Ghost Preview (MOD-DESIGNER-002)

Scenario 2: [MOD-DESIGNER-002] Shape can be placed on canvas — left-click a shape in the palette → shape appears on canvas without error

Scenario 3: [MOD-DESIGNER-002] Drag existing shape on canvas — click shape to select it, then drag to new position → shape moves visually during drag and settles at new position on mouseup

Scenario 4: [MOD-DESIGNER-002] Escape key cancels drag — select shape, begin drag, press Escape → shape returns to or stays at pre-drag position; no error

## Node Context Menu — Node-Type-Specific Items (MOD-DESIGNER-006)

Scenario 5: [MOD-DESIGNER-006] Right-click placed shape shows node context menu — place shape on canvas, right-click it → [role="menu"] appears; menu appears specific to a node

Scenario 6: [MOD-DESIGNER-006] Node context menu contains Lock/Unlock item — right-click selected shape → menu contains "Lock" or "Unlock" text

Scenario 7: [MOD-DESIGNER-006] Node context menu contains Navigation Link item — right-click selected shape → menu contains "Navigation Link" or "Nav Link" or "Link" text

Scenario 8: [MOD-DESIGNER-006] Node context menu contains Properties item — right-click selected shape → menu contains "Properties" text

Scenario 9: [MOD-DESIGNER-006] Empty canvas right-click shows different menu — right-click empty canvas area → [role="menu"] with Paste/Select All/Grid items; does NOT show Lock/Unlock

## Point Context Menu in Test Mode (MOD-DESIGNER-009)

Scenario 10: [MOD-DESIGNER-009] Test mode toggle exists in toolbar — navigate to /designer → toolbar contains a Test mode button/toggle visible without scrolling

Scenario 11: [MOD-DESIGNER-009] Edit mode right-click uses standard node menu not PointContextMenu — place shape, right-click it in edit mode → standard node context menu (not PointContextMenu with Trend/Acknowledge items)

Scenario 12: [MOD-DESIGNER-009] Test mode activates without error — click Test mode button → designer switches to test mode without error boundary; canvas still renders

## Data Flow (MOD-DESIGNER)

Scenario 13: [MOD-DESIGNER-002] — data flow: GET /api/v1/graphics —
  1. Navigate to /designer
  2. Page load triggers data fetch
  3. Wait for response: browser_wait_for time=3000
  4. Snapshot and check: designer canvas area renders with toolbar and palette visible
  Pass: canvas area or file browser is present AND no persistent "Loading..." AND no error boundary
  Fail: element missing, still loading, error boundary, blank white page
