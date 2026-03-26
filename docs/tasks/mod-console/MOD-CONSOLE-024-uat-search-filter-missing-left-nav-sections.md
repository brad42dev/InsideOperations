---
id: MOD-CONSOLE-024
unit: MOD-CONSOLE
title: Search/filter input missing from left nav section panels
status: pending
priority: medium
depends-on: []
source: uat
uat_session: docs/uat/MOD-CONSOLE/CURRENT.md
---

## What to Build

Each accordion section in the left nav panel (Workspaces, Graphics, Widgets) must have a text search/filter input that filters items in real-time as the user types. Currently no such input exists in the Workspaces, Graphics, or Widgets sections (only Points has a search).

The spec (console-implementation-spec.md §2.3) requires:
- Text input at the top of each section
- Keystroke-by-keystroke filtering (no debounce needed — lists are local)
- Filters items by name (case-insensitive substring match)

## Acceptance Criteria

- [ ] Workspaces section contains a text search/filter input
- [ ] Graphics section contains a text search/filter input
- [ ] Widgets section contains a text search/filter input
- [ ] Typing in the input filters the section items in real-time
- [ ] Clearing the input restores all items

## Verification Checklist

- [ ] Navigate to /console → Workspaces section → search input visible
- [ ] Type partial workspace name → only matching workspaces shown
- [ ] Clear input → all workspaces shown again
- [ ] Same behavior confirmed in Graphics section (type "pump" → only pump graphics shown)

## Do NOT

- Do not debounce the search — it must filter on every keystroke
- Do not add server-side search — all filtering must be local/client-side

## Dev Notes

UAT failure from 2026-03-25: Workspaces section shows workspace items but NO search/filter text input. Points section already has search; Workspaces/Graphics/Widgets do not.
Screenshot: docs/uat/MOD-CONSOLE/left-nav-missing-features.png
Spec reference: MOD-CONSOLE-001
