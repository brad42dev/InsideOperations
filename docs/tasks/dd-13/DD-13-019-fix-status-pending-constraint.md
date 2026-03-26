---
id: DD-13-019
unit: DD-13
title: Fix status value in create_instance — 'pending' should be 'draft'
status: completed
priority: critical
depends-on: []
source: uat
uat_session: /home/io/io-dev/io/docs/uat/DD-13/CURRENT.md
---

## What to Build

The migration `20260322000002_log_instance_status_states.up.sql` changed the `log_instances.status` CHECK constraint to only accept values: 'draft', 'in_progress', 'submitted', 'reviewed'.

However, the `create_instance` handler in `services/api-gateway/src/handlers/logs.rs` line 584 still uses the old status value 'pending':

```rust
.bind("pending")  // ← VIOLATES the new CHECK constraint
```

This causes all log template and instance creation operations to fail with:
```json
{"error": {"code": "INTERNAL_ERROR", "message": "A database error occurred"}}
```

This blocks the entire Log module from functioning (cannot create templates or instances).

## Acceptance Criteria

- [ ] Change line 584 in logs.rs from `.bind("pending")` to `.bind("draft")`
- [ ] Rebuild the api-gateway service: `cargo build -p io-api-gateway`
- [ ] Verify the service compiles without errors
- [ ] Test: Create a log template via UI (/log/templates → New Template → Save)
- [ ] Test: Create a log instance from template (/log/new → select template → Start Entry)
- [ ] Verify no database errors appear in logs

## Verification Checklist

- [ ] Navigate to /log module → loads successfully
- [ ] Click Templates tab → UI responsive
- [ ] Click "New Template" button → template editor opens
- [ ] Fill in template name, add WYSIWYG segment, click "Save Template" → template is saved and visible in Templates list
- [ ] Click "Active Logs" tab → empty state visible
- [ ] API endpoint POST /api/logs/instances returns 201 Created (not 500 Internal Error)
- [ ] Log entry is visible in the UI after creation
- [ ] Browser console shows no errors

## Do NOT

- Do not ignore the constraint violation and work around it
- Do not use any other status value besides 'draft'
- Do not stub the fix with TODO comments
- Do not deploy without testing template/instance creation manually

## Dev Notes

UAT failure from 2026-03-26: Template save fails with INTERNAL_ERROR when status='pending' violates CHECK constraint.

The fix is straightforward:
1. File: `services/api-gateway/src/handlers/logs.rs`
2. Line: 584 (inside create_instance function)
3. Change: `.bind("pending")` → `.bind("draft")`

Related task: DD-13-020 tests the font-family control in LogEditor, which requires log creation to work.
