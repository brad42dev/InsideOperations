---
id: DD-23-013
title: Add breadcrumb trail above workspace when cursor is inside a nested container
unit: DD-23
status: pending
priority: low
depends-on: [DD-23-011]
---

## What This Feature Should Do

When the insertion cursor is inside a nested container tile, a breadcrumb trail appears above the workspace showing the path from the root to the current nesting context, e.g., "Workspace > Parens L1 > Square L2". This helps users understand and navigate deep nesting.

## Spec Excerpt (verbatim)

> Breadcrumb trail above workspace when cursor is inside a nested container (e.g., "Workspace > Parens L1 > Square L2")
> — design-docs/23_EXPRESSION_BUILDER.md, §6.5

## Where to Look in the Codebase

Primary files:
- `frontend/src/shared/components/expression/ExpressionBuilder.tsx:1334–1363` — workspace section; breadcrumb would go above the DndContext div
- `frontend/src/shared/components/expression/ExpressionBuilder.tsx:1056–1069` — state has `cursorParentId`

## Verification Checklist

- [ ] When cursorParentId is null (top-level), no breadcrumb is shown (or just "Workspace" with no children)
- [ ] When cursorParentId is set, the breadcrumb shows the full path from root to current parent
- [ ] Each breadcrumb segment is clickable and moves the cursor to that level
- [ ] Breadcrumb is always visible in high-contrast mode (spec §6.5 note about nesting depth badge)

## Assessment

- **Status**: ❌ Missing
- **If partial/missing**: No breadcrumb element exists anywhere in the component. `cursorParentId` is tracked in state but not used to derive a navigation path.

## Fix Instructions (if needed)

1. Add a helper `function getBreadcrumbPath(tiles: ExpressionTile[], parentId: string | null): Array<{id: string | null, label: string, depth: number}>` that walks from root to `parentId` and returns the path.
2. Compute `const breadcrumb = getBreadcrumbPath(state.tiles, state.cursorParentId)` in the render.
3. Render the breadcrumb above the DndContext workspace div (around line 1334):
   ```tsx
   {breadcrumb.length > 1 && (
     <div style={{ display: 'flex', gap: '4px', fontSize: '11px', color: 'var(--io-text-muted)', flexWrap: 'wrap' }}>
       {breadcrumb.map((crumb, i) => (
         <React.Fragment key={crumb.id ?? 'root'}>
           <button onClick={() => dispatch({ type: 'SET_CURSOR', parentId: crumb.id, index: 0 })}>
             {crumb.label}
           </button>
           {i < breadcrumb.length - 1 && <span>›</span>}
         </React.Fragment>
       ))}
     </div>
   )}
   ```
4. The breadcrumb labels should include the tile type and level: "Workspace", "Group L1", "Square L2", etc.

Do NOT:
- Show breadcrumb when cursor is at the top level (cursorParentId === null)
