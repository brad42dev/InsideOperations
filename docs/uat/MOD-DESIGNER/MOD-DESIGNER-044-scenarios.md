# UAT Scenarios — MOD-DESIGNER-044: Drag Ghost Functionality

## Drag Ghost Display

Scenario 1: [MOD-DESIGNER-044] Drag ghost appears during palette tile drag —
  1. Navigate to /designer and open or create a new graphic
  2. Begin dragging (mousedown + mousemove) on a palette tile
  3. Mid-drag: Check that `document.getElementById('io-canvas-drag-ghost')` returns a visible element
  4. Expected: Ghost element is present, visible (display != 'none', visibility != 'hidden', opacity > 0)
  Pass: Ghost element visible with proper text label
  Fail: No ghost element, ghost invisible, or wrong text

Scenario 2: [MOD-DESIGNER-044] Drag ghost follows cursor —
  1. Continue from Scenario 1 (ghost visible during drag)
  2. Move mouse while dragging
  3. Observe ghost element's position via `ghost.style.left` and `ghost.style.top`
  Expected: Ghost position updates with cursor movement
  Pass: Ghost moves with cursor smoothly
  Fail: Ghost does not move or stays in initial position

Scenario 3: [MOD-DESIGNER-044] Drag ghost disappears on drop —
  1. Continue from Scenario 1-2 (ghost visible and moving)
  2. Release mouse button (mouseup) while over canvas
  3. Check that `document.getElementById('io-canvas-drag-ghost')` no longer exists
  4. Verify element is placed on canvas
  Expected: Ghost disappears from DOM after mouseup; element appears on canvas
  Pass: Ghost removed and element placed on canvas
  Fail: Ghost still visible after drop, or element not placed

Scenario 4: [MOD-DESIGNER-044] Ghost shows shape label —
  1. Drag any palette tile
  2. While dragging, read the text content of the ghost element via `ghost.textContent`
  Expected: Ghost text matches the palette tile's label
  Pass: Ghost shows correct label (e.g., "Rectangle", "Valve", "Pump")
  Fail: Ghost text is empty, wrong, or doesn't match tile label

Scenario 5: [MOD-DESIGNER-044] Ghost disappears on Escape key —
  1. Begin dragging a palette tile (ghost visible)
  2. Press Escape key while dragging
  3. Check that ghost is removed from DOM
  Expected: Ghost disappears when Escape is pressed, drag is cancelled
  Pass: Ghost removed and drag cancelled
  Fail: Ghost persists after Escape or drag continues
