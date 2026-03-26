---
id: DD-13-022
unit: DD-13
title: Fix Log templates API endpoint — returns empty array instead of seed templates
status: pending
priority: high
depends-on: []
source: uat
uat_session: /home/io/io-dev/io/docs/uat/DD-13/CURRENT.md
---

## What to Build

The `/api/v1/logs/templates` endpoint is returning an empty array `[]` instead of the expected seed templates. According to the DD-13-020 UAT specification, this endpoint should return at least 2 seed templates:
- "Test Template"
- "UAT Test Template"

**Impact:** Without templates, users cannot create log entries. The entire Log module flow is blocked at the template selection form.

## Acceptance Criteria

- [ ] GET /api/v1/logs/templates returns a non-empty array
- [ ] Response includes at least 2 templates with correct structure
- [ ] "Test Template" is present in response
- [ ] "UAT Test Template" is present in response
- [ ] Endpoint returns valid JSON with required fields (id, title, etc.)
- [ ] Frontend Log module can then proceed to create log entries
- [ ] DD-13-020 WYSIWYG font-family UAT can be completed

## Verification Checklist

- [ ] Query backend logs/templates table: SELECT count(*) should return >= 2
- [ ] Call GET /api/v1/logs/templates with valid auth and verify response
- [ ] Response matches expected schema for LogTemplate type
- [ ] Navigate to /log/new in frontend and confirm templates appear in dropdown
- [ ] Select a template and open the WYSIWYG editor successfully

## Do NOT

- Do not stub this with a hardcoded response — the templates should exist in the database
- Do not assume seed data already exists — verify it, and create seed data if missing
- Do not leave this partially working — ensure the full flow from selection to editor works

## Dev Notes

UAT failure from 2026-03-26: 
- Frontend code is correct (LogEditor.tsx:267-294 font-family control is properly implemented)
- Backend API is returning 0 templates instead of 2 seed templates
- This is a critical blocker for DD-13-020 UAT verification
- Database seed data verification returned UNAVAILABLE; check if seed migrations ran

Spec reference: DD-13-020 test spec section "Backend Status — ✅ Working"
