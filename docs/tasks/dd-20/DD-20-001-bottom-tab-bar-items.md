---
id: DD-20-001
title: Fix bottom tab bar items to match spec (Monitor/Rounds/Log/Alerts/More)
unit: DD-20
status: pending
priority: medium
depends-on: []
---

## What This Feature Should Do

The mobile bottom tab bar (visible at <=768px) should show five tabs: Monitor, Rounds, Log, Alerts, and More. The Monitor tab combines Console/Process/Dashboards. The More tab opens a secondary list with Shifts, Reports, and a Settings link. Currently the bar shows Console, Process, Dashboards, Alerts, and Settings — wrong items with no "More" overflow and missing Rounds and Log.

## Spec Excerpt (verbatim)

> Bottom Tab Bar:
>   [Monitor]  [Rounds]  [Log]  [Alerts]  [More]
>      │          │        │       │         │
>      │          │        │       │         └── Shifts, Reports, Dashboards (tablet), Settings link
>      │          │        └── New entry, Previous logs
>      │          └── My rounds, Start round, History
>      └── Console (pane view), Process (graphic view)
>
> **Monitor tab** combines Console, Process, and Dashboards — the user picks which view within the tab.
> — design-docs/20_MOBILE_ARCHITECTURE.md, §Navigation

## Where to Look in the Codebase

Primary files:
- `frontend/src/shared/layout/AppShell.tsx` — line 1077-1110: the current bottom tab bar items array

## Verification Checklist

- [ ] Bottom tab bar has exactly 5 entries: Monitor, Rounds, Log, Alerts, More
- [ ] Monitor tab navigates to `/console` (or a combined Monitor sub-view) — not directly to `/dashboards`
- [ ] More tab opens a sheet/drawer listing Shifts, Reports, Settings
- [ ] Rounds tab navigates to `/rounds`
- [ ] Log tab navigates to `/log`

## Assessment

- **Status**: ⚠️ Partial — bar exists with correct count and breakpoint, but wrong items
- **What specifically needs to change**: Replace the items array in AppShell.tsx and add a "More" sheet for secondary modules

## Fix Instructions

File: `frontend/src/shared/layout/AppShell.tsx`, lines 1077-1082.

Replace the items array:
```tsx
{ path: '/console', label: 'Console', icon: Monitor },
{ path: '/process', label: 'Process', icon: Layers },
{ path: '/dashboards', label: 'Dashboards', icon: LayoutDashboard },
{ path: '/alerts', label: 'Alerts', icon: Bell },
{ path: '/settings', label: 'Settings', icon: SettingsIcon },
```

With:
```tsx
{ path: '/console', label: 'Monitor', icon: Monitor },     // Monitor = Console/Process/Dashboards combined
{ path: '/rounds',  label: 'Rounds',  icon: CheckSquare },
{ path: '/log',     label: 'Log',     icon: BookOpen },
{ path: '/alerts',  label: 'Alerts',  icon: Bell },
// 5th item: "More" opens a bottom sheet
```

For the 5th "More" item, add a state toggle `const [moreOpen, setMoreOpen] = useState(false)` and render a bottom drawer (simple `position:fixed` overlay) listing links to `/shifts`, `/reports`, `/dashboards`, and `/settings`. The drawer should close when a link is tapped.

The Monitor tab should navigate to `/console` as the primary view. If the user is currently on `/process` or `/dashboards`, the Monitor tab should appear active (check `location.pathname.startsWith('/console') || location.pathname.startsWith('/process') || location.pathname.startsWith('/dashboards')`).

Do NOT:
- Remove the existing sidebar-based navigation — the bottom bar is an additive mobile-only component
- Change the sidebar nav items — they remain unchanged for desktop
- Add Rounds/Log to the desktop sidebar in a new position
