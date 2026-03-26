---
id: DD-13-028
title: Fix /log/new route crash when creating new log instance
unit: DD-13
status: pending
priority: high
depends-on: []
source: uat
uat_session: /home/io/io-dev/io/docs/uat/DD-13/CURRENT.md
---

## What This Feature Should Do

Users should be able to navigate to /log/new to create a new log instance from an existing template. The page should load the LogNew component, display available templates, allow selection, and provide a form to create a log instance with optional team name.

## Current Behavior (Bug)

When a user (or test script) navigates to http://localhost:5173/log/new, the browser immediately crashes with error: "Target page, context or browser has been closed". The page never renders. Users cannot create log instances using the UI.

## Impact

- Users cannot create new log instances from the UI
- The Log module is blocked — log instances are essential to the feature
- DD-13-020 (font-family toolbar verification) cannot be completed because it requires log instances
- Blocking all log-related workflows: note-taking, team coordination, shift handovers

## Reproduction Steps

1. Navigate to http://localhost:5173
2. Log in with admin/admin
3. Click "Log" in the left navigation
4. Attempt to navigate to http://localhost:5173/log/new
5. Observe: browser crashes, page never loads, Playwright reports "Target page, context or browser has been closed"

## Root Cause (Investigation Needed)

The /log/new route is properly defined in `frontend/src/App.tsx` (lines 666-673):
```
path="log/new"
→ LogNew component
→ PermissionGuard permission="log:write"
```

The LogNew component (`frontend/src/pages/log/LogNew.tsx`) performs these actions on mount:
1. Uses `useQuery` to fetch templates via `logsApi.listTemplates({ is_active: true })`
2. Sets up a `useMutation` for `logsApi.createInstance()`

Possible causes:
1. API endpoint missing or returning error that breaks the component
2. React Query configuration issue
3. State management (Zustand) error
4. Missing permission causing guard failure
5. Dependency loading issue
6. Unhandled error in query/mutation that crashes the component tree

## Verification Checklist

- [ ] Navigate to /log/new without crash
- [ ] LogNew component renders successfully
- [ ] Template list fetches and displays
- [ ] Can select a template from the dropdown
- [ ] Can optionally enter a team name
- [ ] Create button works and navigates to created log instance
- [ ] Browser console has no errors during navigation or rendering
- [ ] No unhandled promise rejections

## Investigation Steps

1. Check browser console for errors during /log/new navigation
2. Check network tab — verify `/api/v1/logs/templates` endpoint responds correctly
3. Add debug logging to LogNew component to identify which hook fails
4. Verify API endpoint exists and permission guard is not blocking legitimate users
5. Check for race conditions or timing issues in useQuery/useMutation setup
6. Verify Tiptap editor initialization (LogEditor is loaded by LogNew UI flow)

## Do NOT

- Stub the /log/new page — it must work
- Remove the PermissionGuard — log:write permission is correct
- Break the template list or instance creation — these are load-bearing features

## Testing Approach

After fix, verify:
1. /log/new loads without crash
2. LogNew UI displays (template list visible)
3. Create an instance from the UI
4. Navigate to instance detail page
5. LogEditor component loads and font-family toolbar is visible and functional
