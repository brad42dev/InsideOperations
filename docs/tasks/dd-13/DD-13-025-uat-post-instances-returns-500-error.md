---
id: DD-13-025
unit: DD-13
title: POST /api/logs/instances returns 500 database error during instance creation
status: pending
priority: critical
depends-on: []
source: uat
uat_session: docs/uat/DD-13/CURRENT.md
---

## What to Build

The POST /api/logs/instances endpoint returns HTTP 500 "A database error occurred" when attempting to create a log instance. This blocks the entire log creation workflow.

**Evidence:**
- Endpoint handler exists and is properly wired: services/api-gateway/src/handlers/logs.rs:549-603
- Route is registered: main.rs line 572
- Permission validation passes (log:write permission check works)
- Template validation passes (template existence check works)
- Direct psql INSERT to log_instances table succeeds (schema is correct)
- cURL request returns: `{ "error": { "code": "INTERNAL_ERROR", "message": "A database error occurred" }, "success": false }`

**Root Cause:**
Unknown. Likely issues to investigate:
1. CreateInstanceRequest deserialization failure (JSON parsing)
2. Parameter binding issue (UUID parsing, null handling)
3. Database connection/transaction issue
4. Constraint violation not caught by permission/template checks

## Acceptance Criteria

- [ ] POST /api/logs/instances accepts valid CreateInstanceRequest
- [ ] Returns HTTP 201 CREATED with LogInstanceRow response
- [ ] Instance is persisted to database with correct status="draft"
- [ ] template_id foreign key is satisfied
- [ ] Proper error response on validation failure (400/404, not 500)

## Verification Checklist

- [ ] Test with minimal payload: { "template_id": "valid-uuid" }
- [ ] Test with full payload: { "template_id": "valid-uuid", "team_name": "UAT Test" }
- [ ] Verify created instance appears in GET /api/logs/instances response
- [ ] Verify instance has status="draft" (not "pending" or other value)
- [ ] Check that errors return appropriate HTTP codes (not 500 for validation errors)
- [ ] Enable detailed logging to see actual database error message

## Do NOT

- Do not return 500 for validation errors — return 400 or 404
- Do not swallow the actual error — log it with details
- Do not create instances with wrong status value

## Dev Notes

**Handler File:** services/api-gateway/src/handlers/logs.rs::create_instance (lines 549-603)
**Request Struct:** CreateInstanceRequest { template_id: Uuid, team_name: Option<String> }
**Query:** INSERT INTO log_instances (template_id, team_name, status) VALUES ($1, $2, 'draft')

**Testing Evidence:**
- Direct psql works: `INSERT INTO log_instances (template_id, team_name, status) VALUES ('1793863b-c6a1-4853-a314-0209b7dfe6b3', 'UAT Test', 'draft');` — SUCCESS
- API returns 500 with same UUID and team_name — FAILURE
- Suggests binding or deserialization issue, not schema issue

**Debugging Steps:**
1. Add detailed error logging to create_instance handler
2. Log the CreateInstanceRequest after deserialization
3. Log the error from sqlx::query before returning IoError::Database
4. Check sqlx parameter binding (bind order: template_id, team_name, status)
5. Verify UUID parsing from request
6. Check if team_name null handling is correct (it's Option<String>)

**UAT Failure:** Browser testing 2026-03-26 — cURL POST returned HTTP 500
**Impact:** Blocks log creation via UI and API
**Criticality:** High — feature completely non-functional without this
