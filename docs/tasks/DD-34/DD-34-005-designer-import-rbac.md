---
id: DD-34-005
title: Enforce designer:import RBAC permission on DCS import endpoint
unit: DD-34
status: pending
priority: medium
depends-on: []
---

## What This Feature Should Do

The spec states that all DCS import endpoints require `designer:import` permission. The current `POST /api/dcs-import` endpoint passes through JWT authentication (valid JWT required) but does not check whether the authenticated user has the `designer:import` permission. A user with a valid JWT but without this permission should receive a 403 Forbidden response.

## Spec Excerpt (verbatim)

> ### Permissions
> Uses existing `designer:import` permission — no new permissions needed.
> — `34_DCS_GRAPHICS_IMPORT.md`, §Permissions

> All endpoints require `designer:import` permission.
> — `34_DCS_GRAPHICS_IMPORT.md`, §API Endpoints

## Where to Look in the Codebase

Primary files:
- `services/api-gateway/src/main.rs` — `proxy_dcs_import()` at line 719: passes request straight to parser-service with no permission check
- `services/api-gateway/src/mw.rs` — look for how other handlers check permissions (e.g. `require_permission` or equivalent)

## Verification Checklist

Read the code at the files listed above. Check each item:

- [ ] `proxy_dcs_import()` or the route handler extracts the JWT claims from request extensions
- [ ] A permission check for `designer:import` is performed before proxying to parser-service
- [ ] A user without `designer:import` receives HTTP 403 (not 401)
- [ ] The check uses the same RBAC mechanism as other permission-gated routes in the gateway

## Assessment

- **Status**: ❌ Missing
- `proxy_dcs_import()` at `main.rs:719` is two lines: extract state, call proxy. No permission check. JWT authentication is enforced by the middleware layer at line 597, but that only verifies token validity, not the specific permission.

## Fix Instructions

In `services/api-gateway/src/main.rs`, modify `proxy_dcs_import()`:

```rust
async fn proxy_dcs_import(
    State(state): State<AppState>,
    req: Request,
) -> Response {
    // Extract claims injected by jwt_auth middleware
    let claims = match req.extensions().get::<Claims>() {
        Some(c) => c.clone(),
        None => return (StatusCode::UNAUTHORIZED, "Unauthorized").into_response(),
    };

    // Check designer:import permission
    if !claims.has_permission("designer:import") {
        return (StatusCode::FORBIDDEN, Json(serde_json::json!({
            "success": false,
            "error": { "code": "FORBIDDEN", "message": "designer:import permission required" }
        }))).into_response();
    }

    proxy::proxy(&state, req, &state.config.parser_service_url, "/parse/dcs-import").await
}
```

Check how `Claims` and `has_permission` are used in other handlers in `services/api-gateway/src/handlers/` for the exact method signature — follow the same pattern used elsewhere in the codebase.

Apply the same fix to all 6 job-based endpoints added in DD-34-004 when those are implemented.

Do NOT:
- Remove the JWT middleware — this check is additive on top of JWT validation
- Return 401 for a missing permission — 403 is correct when the token is valid but lacks permission
