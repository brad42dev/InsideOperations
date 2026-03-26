---
id: DD-13-023
unit: DD-13
title: Implement POST /api/logs/instances handler (create_instance)
status: completed
priority: high
depends-on: []
source: uat
uat_session: docs/uat/DD-13/CURRENT.md
---

## What to Build

The `POST /api/logs/instances` endpoint is missing from the API Gateway. The frontend calls this endpoint to create new log instances, but the handler is not implemented.

Without this endpoint:
- Users cannot create new log instances via the UI
- The LogEditor is unreachable (blocks DD-13-020, DD-13-021)
- The entire Log module workflow is broken

## Acceptance Criteria

- [x] Implement `pub async fn create_instance` in `services/api-gateway/src/handlers/logs.rs` (lines 549-603)
- [x] Wire route: `POST /api/logs/instances` → `post(handlers::logs::create_instance)` (main.rs:572)
- [x] Request body accepts: `{ template_id: UUID, team_name?: string }` (CreateInstanceRequest lines 123-126)
- [x] Response returns: `LogInstance` (id, template_id, status='pending', created_at, etc.) (LogInstanceRow)
- [x] Permission check: `log:write` required (line 554)
- [x] Database insert: Insert row into `log_instances` table with correct schema (lines 575-586)
- [x] HTTP 201 Created on success (StatusCode::CREATED line 600)
- [x] HTTP 403 Forbidden if missing log:write permission (line 555)
- [x] HTTP 404 Not Found if template_id doesn't exist (lines 570-572)
- [x] HTTP 400 Bad Request if required fields missing (Axum JSON extractor)

## Implementation Notes

**Fix Applied (2026-03-26):**
- Changed initial status from "draft" to "pending" to match database schema constraint
- Database migration defines status CHECK constraint: IN ('pending', 'in_progress', 'completed')
- This fix resolves the HTTP 500 "A database error occurred" error reported in UAT Scenario 4
- Verified in logs.rs:594 that status is now "pending" (not "draft")
- Build verified: cargo build -p api-gateway succeeds

**Frontend Call:**
```typescript
// logs.ts:114-117
createInstance: (data: {
  template_id: string
  team_name?: string
}): Promise<ApiResult<LogInstance>>
  => api.post<LogInstance>('/api/logs/instances', data)
```

**Database Schema:**
Look at `log_instances` table in migrations. Expected fields:
- id (UUID, PK)
- template_id (UUID, FK → log_templates.id)
- status (text, default 'draft')
- team_name (text, nullable)
- created_at (timestamptz)
- updated_at (timestamptz)
- shift_id (UUID, nullable)

**Handler Signature (Example):**
```rust
pub async fn create_instance(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateInstanceRequest>,
) -> impl IntoResponse {
    // Check log:write permission
    // Insert into log_instances
    // Return LogInstance with 201 Created
}
```

## Do NOT

- Do not skip permission checks
- Do not allow creating instances for non-existent templates
- Do not return 200 — must be 201 Created
- Do not forget to validate template exists before inserting

## Blocking

- DD-13-020: Font-family toolbar verification (depends on this)
- DD-13-021: Point context menu verification (depends on this)
- Entire Log module workflow
