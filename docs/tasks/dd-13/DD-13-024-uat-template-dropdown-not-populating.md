---
id: DD-13-024
unit: DD-13
title: LogNew template dropdown not populating with templates despite API returning data
status: pending
priority: high
depends-on: []
source: uat
uat_session: docs/uat/DD-13/CURRENT.md
---

## What to Build

The LogNew component (/log/new) displays a template selector dropdown, but the dropdown does not populate with options even though the backend API (GET /api/logs/templates) returns 5 active templates correctly.

**Evidence:**
- API tested via curl: GET /api/logs/templates?is_active=true returns HTTP 200 with 5 templates (Test Template, Shift Handover, Test Log Template, Test Log with Points, UAT Test Template)
- Frontend page loads without errors
- Select dropdown element is present in the DOM
- Dropdown shows placeholder text "— Select a template —" but no options
- No JavaScript errors in browser console

**Root Cause:**
Likely issue in React Query state handling or component rendering logic. The API response is correct, but the component is not rendering the template options.

## Acceptance Criteria

- [ ] LogNew template dropdown renders with populated options when page loads
- [ ] API response is correctly parsed from React Query
- [ ] Users can select a template from the dropdown
- [ ] Template selection enables the "Start Entry" button
- [ ] Selected template ID is correctly passed to POST /api/logs/instances

## Verification Checklist

- [ ] Navigate to /log/new
- [ ] Wait for page load
- [ ] Click or hover over template dropdown
- [ ] Confirm options appear (Test Template, Shift Handover, Test Log Template, Test Log with Points, UAT Test Template)
- [ ] Select one template
- [ ] Confirm "Start Entry" button becomes enabled
- [ ] No console errors during interaction

## Do NOT

- Do not stub this with a no-op dropdown
- Do not filter out templates without checking the API response
- Do not ignore React Query error states

## Dev Notes

**Component File:** frontend/src/pages/log/LogNew.tsx
**API Call:** logsApi.listTemplates({ is_active: true })
**React Query:** useQuery({ queryKey: ['log', 'templates', 'active'], ... })

**Debugging Steps:**
1. Check if React Query is actually fetching (inspect Network tab)
2. Verify the API response matches the expected shape
3. Check the template mapping logic (lines 102-106)
4. Verify isLoading state is properly set to false after fetch
5. Check for any conditional rendering that might hide options

**UAT Failure:** Browser testing 2026-03-26 — dropdown showed no options despite API returning data
