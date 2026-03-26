---
id: DD-21-001
title: Implement pagination envelope on all list endpoints
unit: DD-21
status: pending
priority: medium
depends-on: []
---

## What This Feature Should Do

Every list endpoint (`GET /api/<resource>`) must return a structured pagination envelope so clients know the total record count, current page, and how many pages exist. Without this, clients cannot implement pagination UI — they receive only a flat array with no metadata.

## Spec Excerpt (verbatim)

> ### Response Format
> ```json
> {
>     "success": true,
>     "data": [ ... ],
>     "pagination": {
>         "page": 1,
>         "limit": 50,
>         "total": 150,
>         "pages": 3
>     }
> }
> ```
> — design-docs/21_API_DESIGN.md, §Pagination

> ### Query Parameters
> - `page`: Page number (1-indexed)
> - `limit`: Items per page (default 50, max 100)
> - `sort`: Sort field (e.g., `created_at`)
> - `order`: Sort order (`asc` or `desc`)
> — design-docs/21_API_DESIGN.md, §Pagination

## Where to Look in the Codebase

Primary files:
- `crates/io-models/src/lib.rs:32-83` — `PagedResponse<T>` and `PageParams` are already defined here. The struct is correct per spec. It is simply unused.
- `services/api-gateway/src/handlers/console.rs:56-100` — `list_workspaces` returns `Json(ApiResponse::ok(items))` — example of the wrong pattern.
- `services/api-gateway/src/handlers/dashboards.rs:191-241` — `list_dashboards` — same wrong pattern. Also shows `ListParams` query struct without `page`/`limit` fields.
- `services/api-gateway/src/handlers/rounds.rs:258-298` — `list_templates` — same wrong pattern.
- `services/api-gateway/src/handlers/logs.rs:155` — `list_templates` — same wrong pattern.
- `services/api-gateway/src/handlers/reports.rs:401` — `list_report_history` — same wrong pattern.
- `services/api-gateway/src/handlers/forensics.rs:239` — `list_investigations` — same wrong pattern.
- All other `pub async fn list_*` functions in `services/api-gateway/src/handlers/`.

## Verification Checklist

Read each list handler and check:

- [ ] Handler accepts `Query(params): Query<PageParams>` (or a struct embedding `page` and `limit` fields).
- [ ] Handler passes `params.page()` and `params.limit()` to the SQL query as `LIMIT` / `OFFSET`.
- [ ] Handler issues a separate `SELECT COUNT(*)` (or `COUNT(*) OVER ()`) query to get total row count.
- [ ] Handler returns `Json(PagedResponse::new(items, page, limit, total))` — not `ApiResponse::ok(items)`.
- [ ] Serialized response JSON contains `pagination: { page, limit, total, pages }` at the top level alongside `data`.

## Assessment

- **Status**: ❌ Missing
- **If partial/missing**: `PagedResponse<T>` is fully defined and correct in `crates/io-models/src/lib.rs`. No handler uses it. Every list handler returns a bare `ApiResponse::ok(Vec<T>)`.

## Fix Instructions

For each `list_*` handler in `services/api-gateway/src/handlers/`:

1. **Add imports** at the top of each handler file (if not already present):
   ```rust
   use io_models::{PagedResponse, PageParams};
   ```

2. **Add `page`/`limit` fields** to the existing query-param struct, or replace it with `PageParams`:
   ```rust
   #[derive(Debug, Deserialize)]
   pub struct ListXxxParams {
       // existing filters...
       pub page: Option<u32>,
       pub limit: Option<u32>,
       pub sort: Option<String>,
       pub order: Option<io_models::SortOrder>,
   }
   ```
   Alternatively, embed `PageParams` if the handler has no other filters.

3. **Update the SQL query** to add `LIMIT $N OFFSET $M` using `params.limit()` and `params.offset()`. Add a parallel `SELECT COUNT(*) FROM ...` with the same WHERE clause (without LIMIT/OFFSET).

4. **Change the return value**:
   ```rust
   Json(PagedResponse::new(items, params.page(), params.limit(), total)).into_response()
   ```

5. **Priority order** — start with the highest-traffic endpoints:
   - `console.rs` — `list_workspaces`
   - `dashboards.rs` — `list_dashboards`, `list_playlists`
   - `rounds.rs` — `list_templates`, `list_schedules`, `list_instances`
   - `logs.rs` — `list_templates`, `list_segments`, `list_instances`
   - `forensics.rs` — `list_investigations`
   - `reports.rs` — `list_report_history`, `list_my_exports`
   - All remaining `list_*` in `notifications.rs`, `shifts.rs`, `bookmarks.rs`, `opc_certs.rs`, `certificates.rs`, `bulk_update.rs`.

Do NOT:
- Remove or change the `PagedResponse` definition in `crates/io-models/src/lib.rs` — it already matches the spec.
- Use `ApiResponse::ok(items)` for list endpoints — the spec requires the `pagination` key.
- Return `total` as `0` or hardcode it — always issue a real COUNT query.
