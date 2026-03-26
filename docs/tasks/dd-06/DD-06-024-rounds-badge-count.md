---
id: DD-06-024
title: Wire active rounds count to sidebar badge via API
unit: DD-06
status: pending
priority: low
depends-on: []
---

## What This Feature Should Do

The sidebar nav item for Rounds displays a badge showing the count of currently active (in-progress) rounds. This badge is currently hardcoded to return 0 via a stub function, so the Rounds badge never appears even when rounds are active.

## Spec Excerpt (verbatim)

> **Badge counts:** unread alerts + active rounds in sidebar nav items
> — design-docs/06_FRONTEND_SHELL.md, §Sidebar (3-State) / Module navigation

## Where to Look in the Codebase

Primary files:
- `frontend/src/shared/layout/AppShell.tsx:137–142` — `useActiveRoundsCount()` stub that returns 0
- `frontend/src/api/rounds.ts` (or similar) — rounds API client

## Verification Checklist

- [ ] `useActiveRoundsCount()` calls `GET /api/v1/rounds?status=in_progress` or equivalent active-rounds endpoint
- [ ] Hook returns the count of active rounds from the API response
- [ ] Badge renders on the `/rounds` sidebar item when count > 0
- [ ] Badge disappears when count is 0

## Assessment

- **Status**: ⚠️ Partial — badge rendering logic exists (AppShell.tsx:1142–1165) but the count is always 0

## Fix Instructions

In `frontend/src/shared/layout/AppShell.tsx`, replace the stub `useActiveRoundsCount()` (lines 139–142):

```ts
function useActiveRoundsCount(): number {
  const { data } = useQuery<number>({
    queryKey: ['rounds-active-count'],
    queryFn: async () => {
      const res = await fetch('/api/v1/rounds?status=in_progress&limit=1', {
        headers: { Authorization: `Bearer ${localStorage.getItem('io_access_token') ?? ''}` },
      })
      if (!res.ok) return 0
      const json = await res.json()
      if (typeof json?.total === 'number') return json.total
      if (Array.isArray(json?.data)) return json.data.length
      return 0
    },
    refetchInterval: 60_000,
    staleTime: 55_000,
  })
  return data ?? 0
}
```

Adjust the endpoint path and response shape to match what `GET /api/v1/rounds` (or `/api/v1/rounds/active`) actually returns once the Rounds backend is available (Phase 13). The TODO comment already notes this dependency.

Do NOT:
- Remove the TODO comment — update it to reference this task ID instead
- Set a very short refetch interval — 60 seconds is appropriate for rounds (they don't change often)
