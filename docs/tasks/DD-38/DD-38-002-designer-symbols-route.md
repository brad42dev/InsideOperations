---
id: DD-38-002
title: Fix /designer/symbols route — render SymbolLibrary instead of redirecting
unit: DD-38
status: pending
priority: medium
depends-on: []
---

## What This Feature Should Do

The `/designer/symbols` route should render a `SymbolLibrary` component that displays the shape/symbol library browser. Currently it unconditionally redirects to `/designer`, making the URL inaccessible.

## Spec Excerpt (verbatim)

> | `/designer/symbols` | `SymbolLibrary` | `designer:read` | Designer > Symbol Library |
> — 38_FRONTEND_CONTRACTS.md, §1 Designer Sub-Routes

## Where to Look in the Codebase

Primary files:
- `frontend/src/App.tsx:314` — current implementation: `<Route path="designer/symbols" element={<Navigate to="/designer" replace />} />`
- `frontend/src/pages/designer/` — directory to check if `SymbolLibrary.tsx` or similar exists

## Verification Checklist

- [ ] A `SymbolLibrary` component exists (at `frontend/src/pages/designer/SymbolLibrary.tsx` or similar)
- [ ] App.tsx route for `designer/symbols` renders `SymbolLibrary`, not a `<Navigate>` redirect
- [ ] The route is guarded with `permission="designer:read"` (matching spec)
- [ ] Navigating to `/designer/symbols` does not redirect to `/designer`

## Assessment

- **Status**: ⚠️ Wrong
- **If partial/missing**: App.tsx:314 has `<Navigate to="/designer" replace />`. The component doesn't exist yet and the route is a stub redirect instead of the real component.

## Fix Instructions

1. Create `frontend/src/pages/designer/SymbolLibrary.tsx` — a stub page component is acceptable initially. It should show a heading "Symbol Library" and placeholder content (list of available shapes from the shape library). See `design-docs/35_SHAPE_LIBRARY.md` for what the symbol browser should display long-term.

2. Import `SymbolLibrary` in `App.tsx` (add to imports at the top alongside other designer imports).

3. Replace App.tsx:314:
   ```tsx
   // BEFORE (wrong):
   <Route path="designer/symbols" element={<Navigate to="/designer" replace />} />

   // AFTER (correct):
   <Route
     path="designer/symbols"
     element={
       <PermissionGuard permission="designer:read">
         <ErrorBoundary module="Designer">
           <SymbolLibrary />
         </ErrorBoundary>
       </PermissionGuard>
     }
   />
   ```

Do NOT:
- Remove the `/designer/symbols` route entry — it must exist as a real route per spec.
- Use `designer:write` as the permission — spec requires `designer:read`.
- Build a full symbol library in this task — a stub component that renders a placeholder is sufficient to fix the route contract.
