---
id: DD-13-029
unit: DD-13
title: Log templates list empty — /log/templates and Templates tab fetch from broken endpoint
status: pending
priority: high
depends-on: []
source: uat
uat_session: docs/uat/DD-13/CURRENT.md
---

## What to Build

The `/log/templates` page and the Templates tab on `/log` both show "No templates yet. Create one to get started." despite 6 templates existing in the database and loading correctly in the `/log/new` dropdown.

Root cause: `LogNew.tsx` fetches templates from an endpoint that works, but `LogTemplates.tsx` and the Templates tab in `index.tsx` are calling a different (broken or incorrectly parameterized) API endpoint.

The `/log/new` dropdown (LogNew.tsx) logs success to the console and shows all 6 templates. The list views call the API but receive empty results — either hitting a wrong route, incorrect query params, or a separate code path that doesn't share the working React Query config.

Fix the templates-fetching logic in `LogTemplates.tsx` and `index.tsx` (Templates tab, ~line 254–326) to use the same API path/query key that `LogNew.tsx` uses successfully.

## Acceptance Criteria

- [ ] Navigate to /log/templates → at least one template row visible (not empty state)
- [ ] Navigate to /log, click Templates tab → at least one template row visible
- [ ] Right-clicking a template row triggers a context menu (DD-13-019 prerequisite)
- [ ] Template rows show template name, and actions are accessible

## Verification Checklist

- [ ] Navigate to /log/templates, wait 3s → template rows visible (not "No templates yet")
- [ ] Navigate to /log → click Templates tab → template rows visible
- [ ] Both views call the same API endpoint that LogNew.tsx uses (check Network tab in browser DevTools)
- [ ] No console errors related to template fetching

## Do NOT

- Do not change the endpoint LogNew.tsx uses — it works correctly
- Do not stub or hardcode template data
- Do not suppress the empty-state message — fix the API call instead

## Dev Notes

UAT failure 2026-03-26: /log/templates and /log Templates tab show "No templates yet" while /log/new dropdown shows 6 templates.
Browser console log from LogNew.tsx: "[LogNew] Fetched templates: 6 [Object, Object...]"
Screenshot: docs/uat/DD-13/dd13-scenario9-no-template-rows.png
Spec reference: DD-13-019 (entity context menu on template rows) depends on this being fixed first.
