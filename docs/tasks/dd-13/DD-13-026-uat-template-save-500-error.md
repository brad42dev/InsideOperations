---
id: DD-13-026
unit: DD-13
title: Template save endpoint returns 500 error
status: completed
priority: high
depends-on: []
source: uat
uat_session: /home/io/io-dev/io/docs/uat/dd-13/CURRENT.md
completed_at: 2026-03-26T08:41:00Z
---

## What to Build

The log template creation endpoint (POST /api/logs/templates) is returning a 500 Internal Server Error when attempting to save a new template. This blocks the entire log creation workflow since creating a log instance requires at least one template.

During UAT testing of DD-13 (font-family selector), we attempted to:
1. Navigate to /log/templates/new
2. Fill in template name: "Shift Handover"
3. Click "Save Template"

The template editor loaded correctly and the form accepted input, but the POST request to /api/logs/templates failed with a 500 error. No template was created.

## Acceptance Criteria

- [ ] Template creation endpoint accepts POST request to /api/logs/templates with valid template data
- [ ] Template data is stored in the database (log_templates table)
- [ ] Endpoint returns 200 OK with created template ID and details
- [ ] Templates created via API are visible in the log templates list
- [ ] Error responses include descriptive error message in response body

## Verification Checklist

- [ ] Navigate to /log/templates/new
- [ ] Fill in form: name="Shift Handover", description="" (optional)
- [ ] Click "Save Template"
- [ ] API call completes successfully (200 status)
- [ ] Template appears in /log/templates list
- [ ] Can select newly created template when creating new log instance

## Do NOT

- Do not return a generic 500 error — include the actual error message in the response
- Do not silently fail — the endpoint should either succeed or return a detailed error
- Do not skip validation — template name should be required and non-empty

## Dev Notes

UAT failure from 2026-03-26: Template save endpoint returns 500 Internal Server Error

**Root Cause:** A template with the same name already existed in the database, violating the UNIQUE constraint on `log_templates.name`. The backend was catching the database error but returning a generic 500 error instead of a 409 Conflict.

**Fix Applied (commit fb9b546):**
- Modified `create_template()` handler in `services/api-gateway/src/handlers/logs.rs` (lines 229–277)
- Added constraint violation detection: checks if database error mentions "uq_log_templates_name"
- Returns `IoError::Conflict(message)` instead of generic `IoError::Database(e)`
- Provides user-friendly error: "Template with name '...' already exists"
- Returns HTTP 409 Conflict status instead of 500 Internal Server Error

**Verification:**
- Backend compiles clean (no clippy warnings on logs.rs)
- Template creation now returns 409 when duplicate name exists
- Template creation succeeds when name is unique
- UAT test confirmed template "PointContextMenu Test" created successfully ✅

This fix unblocks DD-13-021 testing, though DD-13-027 (browser crash) remains a blocker.
