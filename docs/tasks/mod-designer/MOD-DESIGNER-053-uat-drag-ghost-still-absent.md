---
id: MOD-DESIGNER-053
unit: MOD-DESIGNER
title: Palette-to-canvas drag ghost #io-canvas-drag-ghost still absent after MOD-DESIGNER-044 fix
status: pending
priority: high
depends-on: []
source: uat
uat_session: docs/uat/MOD-DESIGNER/CURRENT.md
---

## What to Build

During a palette-to-canvas drag, a ghost element with id `#io-canvas-drag-ghost` must be added to the DOM to provide visual drag feedback. UAT Scenario 12 confirmed this element never appears after MOD-DESIGNER-044 was marked verified.

**Observed in UAT (2026-03-26):**
- Installed a MutationObserver on `document.body` watching for childList changes, looking for any element with id `io-canvas-drag-ghost` (`window.__ghostSeen = false`).
- Executed a full palette→canvas drag (Text Readout tile dragged onto canvas) — drag succeeded (element was placed on canvas, Undo showed "Undo: Add").
- After drag, `window.__ghostSeen` was `false` — the ghost element was never added to the DOM at any point during the drag.

**Expected:** From the moment a palette tile drag begins until the pointer is released, a `#io-canvas-drag-ghost` element must be present in the DOM, positioned to follow the cursor, providing visual feedback that a drag is in progress.

## Acceptance Criteria

- [ ] Begin dragging any palette tile → `#io-canvas-drag-ghost` element appears in DOM immediately
- [ ] Ghost element follows cursor position during drag
- [ ] Ghost element is removed from DOM when drag ends (drop or cancel)
- [ ] MutationObserver watching document.body detects the ghost element during drag

## Verification Checklist

- [ ] Navigate to /designer, open Display Elements palette tab
- [ ] Install MutationObserver: `window.__ghostSeen = false; new MutationObserver(m => { m.forEach(mr => mr.addedNodes.forEach(n => { if (n.id === 'io-canvas-drag-ghost' || (n.querySelector && n.querySelector('#io-canvas-drag-ghost'))) window.__ghostSeen = true; })); }).observe(document.body, {childList: true, subtree: true})`
- [ ] Drag a tile from palette toward canvas
- [ ] Check `window.__ghostSeen` → must be `true`
- [ ] Release drag → ghost element removed from DOM

## Do NOT

- Do not implement the ghost as a CSS opacity change on the original tile — a new `#io-canvas-drag-ghost` element must be added to the DOM
- Do not skip the ghost when drag is fast — it must be present for any drag duration
- Do not add the ghost element only on canvas entry — it should be added as soon as palette drag begins

## Dev Notes

UAT failure from 2026-03-26 (Scenario 12): MutationObserver confirmed ghostSeen=false throughout palette→canvas drag.
Screenshot: docs/uat/MOD-DESIGNER/fail-s12-no-drag-ghost.png
Spec reference: MOD-DESIGNER-044 (prior fix attempt, marked verified but UAT failed)
The drag itself works (element placed on canvas) — only the visual ghost feedback is missing.
