---
id: DD-37-005
title: Fix Pagination field names in io-models to match spec (per_page, total_items, total_pages)
unit: DD-37
status: pending
priority: medium
depends-on: []
---

## What This Feature Should Do

Every list endpoint returns a paginated response. The spec defines exact field names for
the pagination metadata. The current Rust implementation uses `limit`, `total`, `pages`
while the spec (and the TypeScript definition in `ipc.ts`) uses `per_page`, `total_items`,
`total_pages`. This creates a wire format mismatch: the frontend TypeScript reads
`pagination.per_page` but the Rust response serializes as `pagination.limit`.

## Spec Excerpt (verbatim)

> ```rust
> pub struct PaginationMeta {
>     pub page: u32,
>     pub per_page: u32,
>     pub total_items: u64,
>     pub total_pages: u32,
> }
> ```
>
> ```json
> {
>     "pagination": {
>         "page": 1,
>         "per_page": 50,
>         "total_items": 1234,
>         "total_pages": 25
>     }
> }
> ```
> — 37_IPC_CONTRACTS.md, §9

And TypeScript:
> ```typescript
> interface PaginationMeta {
>   page: number;
>   per_page: number;
>   total_items: number;
>   total_pages: number;
> }
> ```
> — 37_IPC_CONTRACTS.md, §16

## Where to Look in the Codebase

Primary files:
- `crates/io-models/src/lib.rs:50-56` — `Pagination` struct with wrong field names
- `crates/io-models/src/lib.rs:63-83` — `PageParams` uses `limit` field name (query param name is also wrong — spec says `per_page`)
- `frontend/src/shared/types/ipc.ts:51-55` — `PaginationMeta` interface (correct, matches spec)

## Verification Checklist

- [ ] `Pagination` struct has `per_page: u32` (not `limit: u32`)
- [ ] `Pagination` struct has `total_items: u64` (not `total: u64`)
- [ ] `Pagination` struct has `total_pages: u32` (not `pages: u32`)
- [ ] `PageParams` query struct uses `per_page: Option<u32>` (not `limit: Option<u32>`)
- [ ] `PageParams::limit()` method renamed to `per_page()` (or accessor is updated consistently)
- [ ] No service handler is broken by the rename (search for `pagination.limit`, `pagination.total`, `pagination.pages` across services)

## Assessment

- **Status**: ⚠️ Wrong
- **If partial/missing**: `crates/io-models/src/lib.rs:52-56` has `pub limit`, `pub total`, `pub pages`. Frontend `ipc.ts:51-55` correctly uses `per_page`, `total_items`, `total_pages`. Wire mismatch exists on every paginated endpoint.

## Fix Instructions (if needed)

In `crates/io-models/src/lib.rs`:

1. Rename the `Pagination` struct fields:
   - `limit: u32` → `per_page: u32`
   - `total: u64` → `total_items: u64`
   - `pages: u32` → `total_pages: u32`

2. Update `PagedResponse::new()` constructor at line 39:
   ```rust
   let total_pages = if per_page == 0 { 1 } else { (total_items as u32).div_ceil(per_page) }.max(1);
   Self {
       success: true,
       data,
       pagination: Pagination { page, per_page, total_items, total_pages },
   }
   ```

3. In `PageParams`:
   - Rename `limit: Option<u32>` → `per_page: Option<u32>`
   - Update the `limit()` helper method to `per_page()` OR keep it named `per_page()` returning `u32`
   - Update `offset()` to call `self.per_page()` instead of `self.limit()`

4. Run `cargo build` — compilation errors will surface every call site that needs updating.
   Likely affected: all service handlers that call `PageParams` or construct `Pagination` directly.

5. Update the unit tests at lines 142-173 to use the new field names.

Do NOT:
- Use `#[serde(rename = "...")]` as a workaround — change the actual field names so the struct is consistent in Rust code too
- Change the `PaginatedResponse` struct name — only field names inside `Pagination` change
- Forget to update `PageParams` — services read `page.per_page` as the query parameter name; the spec uses `per_page` (not `limit`) in query strings too
