---
id: MOD-DESIGNER-038
unit: MOD-DESIGNER
title: Drag ghost verification blocked — backend /api/v1/design-objects returns 429
status: pending
priority: high
depends-on: []
source: uat
uat_session: docs/uat/MOD-DESIGNER/CURRENT.md
---

## What to Build

The drag ghost (DOM-ahead-of-store pattern) implemented in MOD-DESIGNER-031 needs end-to-end verification, but UAT was blocked by two issues:

1. **Backend rate limiting**: `/api/v1/design-objects` returns HTTP 429 Too Many Requests during the UAT session, preventing the Designer from loading the graphics list. This means the canvas cannot be loaded with a real design object, making drag testing impossible.

2. **React event system incompatibility**: JS-dispatched PointerEvent/MouseEvent on the canvas SVG do not trigger React synthetic event handlers, so automated drag testing cannot be performed via evaluate() calls.

The drag ghost feature itself (id="io-canvas-drag-ghost") was verified to exist in a previous UAT session — but that was testing a fresh canvas with a newly placed element, not an existing design object loaded from the API.

The primary blocking issue is (1): the backend rate limit on /api/v1/design-objects must be resolved so the Designer can load existing graphics during automated testing.

## Acceptance Criteria

- [ ] `/api/v1/design-objects` does not return 429 under normal usage patterns (single developer session loading the Designer)
- [ ] Drag ghost (id="io-canvas-drag-ghost") is visible during canvas element drag operations on loaded design objects
- [ ] Ghost element has opacity < 1, dashed border, and pointer-events: none per spec

## Verification Checklist

- [ ] Load /designer, open an existing graphic → design objects load without 429 error
- [ ] Click to select an element on canvas, then begin dragging → ghost element appears
- [ ] Ghost element is visually distinct from the real element (opacity, dashed outline)
- [ ] On drag end, ghost disappears and element settles at new position

## Do NOT

- Do not rate-limit the design-objects API endpoint at levels that affect normal single-user sessions
- Do not remove the drag ghost feature — it was previously implemented per MOD-DESIGNER-002

## Dev Notes

UAT failure from 2026-03-25: /api/v1/design-objects returned 429 Too Many Requests preventing canvas load. The backend rate limiting configuration on this endpoint needs review — a single developer testing session should not hit rate limits.
Spec reference: MOD-DESIGNER-002, MOD-DESIGNER-031
