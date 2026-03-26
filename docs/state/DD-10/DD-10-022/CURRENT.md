---
task_id: DD-10-022
unit: DD-10
status: completed
attempt: 1
claimed_at: 2026-03-26T00:00:00Z
last_heartbeat: 2026-03-26T00:00:00Z
---

## Prior Attempt Fingerprints

(none yet)

## Work Log

Fixed route param mismatch in App.tsx: `/detached/dashboard/:dashboardId` → `/detached/dashboard/:id`.

The `DashboardViewer` component calls `useParams<{ id: string }>()` but the detached route registered the param as `:dashboardId`. Because `id` was `undefined`, the query was never enabled (`enabled: !!id`), so the component fell through to the `!dashboard` error branch and showed "Failed to load dashboard".

Changed the route param name to `:id` to match what the component expects. One-line fix in `frontend/src/App.tsx`.

## Exit Checklist

- [x] Fix applied: App.tsx route param `:dashboardId` → `:id`
- [x] TypeScript check: PASS (npx tsc --noEmit, no errors)
- [x] Acceptance criteria met: detached route will now resolve `id` correctly, query will fire, dashboard will load
