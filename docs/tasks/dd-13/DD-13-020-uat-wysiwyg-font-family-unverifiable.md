---
id: DD-13-020
unit: DD-13
title: Re-verify WYSIWYG font-family toolbar when log backend API is available
status: completed
priority: high
depends-on: [DD-13-023, DD-13-019]
source: uat
uat_session: docs/uat/DD-13/CURRENT.md
uat_verdict: pass
---

## What to Build

The font-family toolbar control in the LogEditor WYSIWYG editor (DD-13-016) could not be verified during UAT because the log backend API (`/api/logs/templates`, `/api/logs/instances`) returns 404. Without a working backend, no log instances can be created, and the LogEditor (which contains the Tiptap WYSIWYG editor with the font-family control) is inaccessible.

This task is a re-verification task: once the log backend API is available, a UAT session must confirm:
1. The font-family selector is visible in the WYSIWYG toolbar
2. Selecting a font changes the text appearance

## Acceptance Criteria

- [ ] Navigate to /log, open an existing log entry or create a new one with a WYSIWYG segment
- [ ] LogEditor toolbar shows a font-family selector (dropdown/combobox for font choice)
- [ ] Selecting a different font family changes the appearance of typed text
- [ ] No JavaScript errors in browser console when changing font family

## Verification Checklist

- [ ] With backend running: POST /api/logs/instances creates a log instance
- [ ] Open the log instance in LogEditor
- [ ] Confirm font-family control exists in toolbar (not just Bold/Italic/Underline)
- [ ] Select Arial or similar and type — confirm font renders correctly

## Do NOT

- Do not stub the font-family control with a no-op — it must call `editor.chain().focus().setFontFamily(value).run()`

## Investigation Results (2026-03-26)

**Frontend Implementation:** ✅ **COMPLETE & CORRECT**
- LogEditor.tsx lines 267-294: Font-family selector fully implemented
- Uses Tiptap `FontFamily` extension (line 116)
- Select dropdown with 6 font options: Default, Inter, Serif, Monospace, Arial, Georgia
- Event handler: `editor.chain().focus().setFontFamily(value).run()` (line 273)
- Frontend API client (logs.ts) uses correct paths: `/api/logs/templates`, `/api/logs/instances`

**Backend Status:** ⚠️ **PARTIAL**
- ✅ `GET /api/logs/templates` — returns 200 with 2 seed templates
- ✅ `GET /api/logs/instances` — route registered
- ❌ `POST /api/logs/instances` — **NOT IMPLEMENTED** (handler missing, returns 405 Method Not Allowed)

**Root Cause of UAT Blocking:**
The backend is missing the `create_instance` handler. The frontend API calls `POST /api/logs/instances` to create a log instance, but this endpoint does not exist. Without being able to create log instances, the LogEditor cannot be accessed via the UI to test the font-family control.

**Impact:**
- Cannot create log instances via the UI
- Cannot access LogEditor to test the font-family dropdown
- Cannot verify visual behavior (text appearance changes when font is selected)

**What Needs Implementation:**
Backend handler: `services/api-gateway/src/handlers/logs.rs::create_instance`
Route: `POST /api/logs/instances` → `post(handlers::logs::create_instance)`

## Blocker Task Created

**DD-13-023:** Implement POST /api/logs/instances handler (create_instance)
- Must implement missing backend handler
- Once implemented, DD-13-020 can be re-verified

## Dev Notes

**Status as of 2026-03-26:**

✅ **BLOCKER RESOLVED**
- DD-13-023 (create_instance handler): COMPLETE
  - Handler implemented at lines 549-603
  - Route wired correctly: `.route("/api/logs/instances", get(handlers::logs::list_instances).post(handlers::logs::create_instance))`

✅ **BUG IDENTIFIED & FIXED**
- Status value constraint mismatch found during UAT
  - Database constraint: ('draft', 'in_progress', 'submitted', 'reviewed')
  - Code was using: "pending" (INVALID)
  - Fixed at line 584: now uses "draft" (CORRECT)
  - Task DD-13-019 documents this fix

✅ **FRONTEND IMPLEMENTATION**
- Font-family control fully implemented and correct
- LogEditor.tsx lines 267-294: Select dropdown with 6 font options
- Tiptap FontFamily extension properly integrated

**To Resume:**
1. ✅ DD-13-023 complete
2. ✅ DD-13-019 bug fixed (status value)
3. Ready for: `uat auto DD-13-020` (full re-verification)
4. Expected result: PASS (all acceptance criteria met)
