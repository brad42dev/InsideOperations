---
id: DD-24-003
title: Enforce RBAC permissions on /api/import/* routes
unit: DD-24
status: pending
priority: high
depends-on: []
---

## What This Feature Should Do

All import API routes must be protected by the four RBAC permissions defined in the spec: `system:import_connections`, `system:import_definitions`, `system:import_execute`, and `system:import_history`. Currently the API gateway proxies all `/api/import/*` requests without checking any permission, allowing any authenticated user to create, delete, or trigger imports.

## Spec Excerpt (verbatim)

> Four new permissions are added to the System permission group:
>
> | Permission | Default Roles |
> |---|---|
> | `system:import_connections` | Admin |
> | `system:import_definitions` | Admin |
> | `system:import_execute` | Supervisor, Admin |
> | `system:import_history` | All roles |
>
> — 24_UNIVERSAL_IMPORT.md, §15 RBAC Permissions

## Where to Look in the Codebase

Primary files:
- `services/api-gateway/src/main.rs:521–522, 684–691` — import proxy route and handler; no permission check present
- `services/api-gateway/src/handlers/graphics.rs:21–35` — `check_permission` helper — the pattern to replicate
- `frontend/src/pages/settings/Import.tsx` — no `usePermission` hook or permission guard found

## Verification Checklist

Read the code at the files listed above. Check each item:

- [ ] `GET /api/import/connections*` requires `system:import_connections` permission
- [ ] `POST /api/import/connections`, `PUT /api/import/connections/:id`, `DELETE /api/import/connections/:id` require `system:import_connections`
- [ ] `GET /api/import/definitions*` requires `system:import_definitions`
- [ ] `POST /api/import/definitions`, `PUT`, `DELETE` definitions require `system:import_definitions`
- [ ] `POST /api/import/definitions/:id/runs` (trigger) requires `system:import_execute`
- [ ] `GET /api/import/runs*` requires `system:import_history`
- [ ] Users without `system:import_history` receive 403 when accessing run history endpoints
- [ ] Frontend hides import management UI from users without `system:import_connections`

## Assessment

- **Status**: ❌ Missing
- `api-gateway/src/main.rs:684–691` — `proxy_import` passes all requests directly to the import service with no JWT claims inspection, no permission check. The `service_secret_middleware` in the import service validates only the inter-service secret, not user permissions.

## Fix Instructions

**Backend (API Gateway):**

Replace the simple `any(proxy_import)` route with a dedicated handler that checks permissions based on the HTTP method and path prefix:

```rust
async fn proxy_import(
    State(state): State<AppState>,
    Extension(claims): Extension<Arc<Claims>>,
    req: Request,
) -> Response {
    let path = req.uri().path();
    let method = req.method().clone();

    // Determine required permission
    let required = if path.contains("/runs") && method == Method::GET {
        "system:import_history"
    } else if path.contains("/runs") {
        "system:import_execute"
    } else if path.contains("/definitions") && method == Method::GET {
        "system:import_definitions"
    } else if path.contains("/definitions") {
        "system:import_definitions"
    } else if path.contains("/connections") {
        "system:import_connections"
    } else if path.contains("/connector-templates") {
        "system:import_definitions"
    } else {
        "system:import_connections"
    };

    if !check_permission(&claims, required) {
        return (StatusCode::FORBIDDEN, Json(serde_json::json!({
            "error": { "code": "FORBIDDEN", "message": "Insufficient permissions" }
        }))).into_response();
    }

    let downstream = path.strip_prefix("/api/import").unwrap_or(path).to_string();
    proxy::proxy(&state, req, &state.config.import_service_url, &downstream).await
}
```

**Frontend:**

Add a permission guard in `frontend/src/pages/settings/Import.tsx` using the existing `usePermission` pattern from other settings pages. Hide the "New Connection", "New Definition", "Run Now", and "Dry Run" buttons for users without the respective permissions.

Do NOT:
- Change the import service's own `service_secret_middleware` — that only protects inter-service communication
- Combine all import actions into a single permission check — use the four specific permissions as specified
