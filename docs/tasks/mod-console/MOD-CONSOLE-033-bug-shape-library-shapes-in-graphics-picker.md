---
id: MOD-CONSOLE-033
unit: MOD-CONSOLE
title: "Bug: shape library shapes appear in Console and Process graphics pickers"
status: pending
priority: medium
depends-on: []
source: bug
bug_report: "Console and Process list shape library shapes under graphics — shapes are not loadable graphics and should not appear there"
---

## What's Broken

`graphicsApi.list({ scope: 'console' })` and `graphicsApi.list({ scope: 'process' })` both call:

```
GET /api/v1/design-objects?scope=console
```

That URL routes to the `list_design_objects` handler (`services/api-gateway/src/handlers/graphics.rs` line 716), which is the **shape library endpoint**. It only returns rows with `type IN ('shape', 'stencil', 'symbol', 'template')` and completely ignores the `scope` parameter. The result is that the Console palette (ConsolePalette.tsx line 1575) and Process graphics list (process/index.tsx line 585) show shape library shapes instead of actual process graphics.

When a user selects one of these shapes, it fails to load — shapes don't have a `scene_data` / `GraphicDocument` structure that the pane renderer expects.

Affected files:
- `frontend/src/api/graphics.ts` — `graphicsApi.list()` calls the wrong endpoint
- `frontend/src/pages/console/ConsolePalette.tsx:1575` — calls `graphicsApi.list({ scope: 'console' })`
- `frontend/src/pages/console/PaneWrapper.tsx:164` — calls `graphicsApi.list({ scope: 'console' })`
- `frontend/src/pages/process/index.tsx:585` — calls `graphicsApi.list({ scope: 'process' })`

## Expected Behavior

Console and Process graphics pickers show only actual `graphic`-type design objects scoped to their module. Shape library shapes (`shape`, `stencil`, `symbol`, `template`) must not appear in these pickers at all.

## Root Cause

`graphicsApi.list()` in `frontend/src/api/graphics.ts` builds the URL as `/api/v1/design-objects` with a `scope` query param. That endpoint was originally the shape/stencil management endpoint and maps to `list_design_objects`. The correct endpoint for listing actual graphics is `/api/graphics?module=...`, handled by `list_graphics` (`graphics.rs` line 128), which queries `WHERE type = 'graphic' AND metadata->>'module' = $1`.

The `scope` param in `graphicsApi.list()` needs to become `module`, and the base path needs to change from `/api/v1/design-objects` to `/api/graphics`.

## Acceptance Criteria

- [ ] Console palette graphics section shows only `type='graphic'` records tagged `module='console'` — no shapes, stencils, symbols, or templates
- [ ] Process graphics picker shows only `type='graphic'` records tagged `module='process'` — no shapes, stencils, symbols, or templates
- [ ] Selecting a graphic in either module loads successfully (no parse error, scene renders)
- [ ] Shape library shapes remain accessible in Designer as before — this change must not break Designer

## Verification

1. Navigate to Console (`/console`), open the Graphics section of the left palette
2. Confirm only proper named graphics appear (not DCS shape names like "centrifugal_pump", "valve", etc.)
3. Drag a graphic into a pane — it should render without error
4. Navigate to Process (`/process`), open any view-selector UI that lists graphics
5. Confirm only process-scoped graphics appear
6. Navigate to Designer — confirm shape library still shows shapes in the left palette

## Implementation Notes

The fix is in `frontend/src/api/graphics.ts`:

```ts
// BEFORE (wrong — hits shape library endpoint, scope is ignored):
list: (params?: { scope?: 'console' | 'process'; mode?: 'graphic' | 'dashboard' | 'report' }) =>
  api.get(`/api/v1/design-objects${queryString(params)}`)

// AFTER (correct — hits graphics list endpoint, module is respected):
list: (params?: { module?: 'console' | 'process'; mode?: 'graphic' | 'dashboard' | 'report' }) =>
  api.get(`/api/graphics${queryString(params)}`)
```

Also update call sites to pass `module` instead of `scope`:
- `ConsolePalette.tsx:1575` — `graphicsApi.list({ module: 'console' })`
- `PaneWrapper.tsx:164` — `graphicsApi.list({ module: 'console' })`
- `process/index.tsx:585` — `graphicsApi.list({ module: 'process' })`

The backend `list_graphics` handler at `/api/graphics` already supports the `module` query param and returns the correct data shape (`GraphicSummary` with `id`, `name`, `type`, `module`, `created_at`).

## Spec Reference

Process spec (`/home/io/spec_docs/process-implementation-spec.md` §Views): "Views are `design_objects` rows with `type='graphic'` and `graphicScope='process'`." Shape library shapes are explicitly separate from graphics.

## Do NOT

- Add a frontend filter over the existing `/api/v1/design-objects` call — fix the root cause (wrong endpoint)
- Change the Designer palette — it legitimately uses shape endpoints and must remain unaffected
- Rename the `graphicsApi.list()` function — just fix the endpoint URL and param name
