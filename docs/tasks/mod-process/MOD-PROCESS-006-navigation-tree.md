---
id: MOD-PROCESS-006
title: Implement Navigation hierarchy tree in sidebar
unit: MOD-PROCESS
status: pending
priority: medium
depends-on: []
---

## What This Feature Should Do

The Navigation section in the Process sidebar shows a hierarchical tree of process views organized by area/unit. Users can expand/collapse tree branches and click a node to load that view. The current view is highlighted in the tree. The tree is built from `GET /api/graphics/hierarchy`.

## Spec Excerpt (verbatim)

> **Section 3: Navigation Tree**
>
> Hierarchical tree showing the view hierarchy for drill-down navigation.
>
> **Structure:**
> - Built from `GET /api/graphics/hierarchy`
> - Tree nodes represent process views organized by area/unit
> - Current view is highlighted in the tree
> - Click a tree node: load that view
> - Expand/collapse tree branches
> — process-implementation-spec.md, §2.3.3

## Where to Look in the Codebase

Primary files:
- `frontend/src/pages/process/ProcessSidebar.tsx:383-388` — Navigation section stub: "Navigation hierarchy coming soon"
- `frontend/src/api/graphics.ts` — check if `hierarchy` endpoint exists or needs adding

## Verification Checklist

- [ ] Navigation section renders a tree (not placeholder text).
- [ ] Tree data fetched from `GET /api/graphics/hierarchy`.
- [ ] Tree nodes can be expanded/collapsed.
- [ ] Clicking a tree node calls `onSelectView` with the node's graphic ID.
- [ ] The currently-loaded view is visually highlighted in the tree.

## Assessment

- **Status**: ❌ Missing
- `ProcessSidebar.tsx:383-388` — Navigation section contains only: `<div style={...}>Navigation hierarchy coming soon</div>`. No tree component, no API call.

## Fix Instructions

In `frontend/src/pages/process/ProcessSidebar.tsx`:

1. Add a prop for the hierarchy query (or fetch inside the component using `useQuery`):
```typescript
// In ProcessSidebarProps:
selectedId: string | null
onSelectView: (id: string, name: string) => void
// (already there — reuse these)
```

2. Replace the stub with a tree implementation:
```typescript
import { useQuery } from '@tanstack/react-query'
import { graphicsApi } from '../../api/graphics'

// Inside AccordionSection for Navigation:
const { data: hierarchy } = useQuery({
  queryKey: ['graphics', 'hierarchy'],
  queryFn: () => graphicsApi.getHierarchy(),
})

function TreeNode({ node, depth = 0 }) {
  const [expanded, setExpanded] = useState(depth < 2)
  return (
    <div>
      <button
        onClick={() => node.graphicId ? onSelectView(node.graphicId, node.name) : setExpanded(v => !v)}
        style={{ paddingLeft: depth * 12 + 10, background: node.graphicId === selectedId ? 'var(--io-accent-subtle)' : 'transparent', ... }}
      >
        {node.children?.length ? (expanded ? '▼' : '▶') : '•'} {node.name}
      </button>
      {expanded && node.children?.map(child => <TreeNode key={child.id} node={child} depth={depth + 1} />)}
    </div>
  )
}
```

3. Check whether `graphicsApi.getHierarchy()` exists. If not, add it to `frontend/src/api/graphics.ts`:
```typescript
getHierarchy: (): Promise<ApiResult<GraphicHierarchyNode[]>> =>
  api.get<GraphicHierarchyNode[]>('/api/graphics/hierarchy'),
```

Do NOT:
- Leave the "coming soon" stub — this is a required section.
- Make this a flat list — it must be a collapsible tree.
- Fetch hierarchy on every sidebar render — use `useQuery` with appropriate caching.
