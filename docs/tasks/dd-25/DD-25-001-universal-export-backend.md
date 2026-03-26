---
id: DD-25-001
title: Implement Universal Export backend — /api/exports endpoint with 6-format pipeline
unit: DD-25
status: pending
priority: high
depends-on: []
---

## What This Feature Should Do

Any user with the appropriate `<module>:export` permission can POST to `/api/exports` to request a data export from any module. Requests below 50,000 rows are served synchronously (file streams to browser). Requests at or above 50,000 rows are queued as async jobs, a 202 is returned, and the user receives a WebSocket notification when the file is ready. The backend supports six output formats: CSV, XLSX, PDF, JSON, Parquet, and HTML.

## Spec Excerpt (verbatim)

> POST /api/exports
> { "module": "settings", "entity": "points", "format": "csv", "scope": "filtered", "filters": {...}, "columns": [...], "sort": {...}, "notify_email": false }
>
> rows < 50,000: Synchronous — CSV/JSON: Stream directly to HTTP response. XLSX/PDF/Parquet/HTML: Generate to temp file → stream response.
> rows >= 50,000: Return 202 Accepted with job ID. Worker generates file in background. Update export_jobs.status → 'completed'. Send WebSocket notification to user.
— design-docs/25_EXPORT_SYSTEM.md, §2.2, §13.1

## Where to Look in the Codebase

Primary files:
- `services/api-gateway/src/main.rs` — route registration; add `/api/exports` routes here (see lines 119–600 for existing route pattern)
- `services/api-gateway/src/handlers/` — create `exports.rs` handler file; no file exists yet
- `services/api-gateway/src/report_generator.rs` — CSV, XLSX, HTML, PDF formatters exist here (lines 945+); reuse for universal export; Parquet is missing entirely
- `services/api-gateway/Cargo.toml` — `parquet` (arrow-rs) crate must be added; `rust_xlsxwriter` already present (line 38); `typst-as-lib` present behind feature flag

## Verification Checklist

- [ ] `GET /api/exports` route is registered in `main.rs`
- [ ] `POST /api/exports` route is registered in `main.rs`
- [ ] `GET /api/exports/:id/download` route is registered in `main.rs`
- [ ] `DELETE /api/exports/:id` route is registered
- [ ] Synchronous path: rows < 50,000 returns 200 with file stream, correct Content-Disposition header using `{module}_{entity}_{YYYY-MM-DD_HHmm}.{ext}` convention
- [ ] Asynchronous path: rows >= 50,000 returns 202 with `{id, status, rows_total, message}`
- [ ] All 6 formats implemented: CSV, XLSX, PDF, JSON, Parquet, HTML
- [ ] `export_jobs` table is used for async job tracking (insert on create, update on complete/fail)
- [ ] Parquet dependency (`parquet` from `arrow-rs`, Apache-2.0 licensed) added to `Cargo.toml`

## Assessment

- **Status**: ❌ Missing
- **If partial/missing**: No `/api/exports` route exists anywhere. No `handlers/exports.rs` file exists. The `report_generator.rs` has CSV/XLSX/HTML/PDF implementation usable for sync exports but it is not wired to a universal export endpoint. Parquet is not implemented anywhere.

## Fix Instructions (if needed)

1. Create `services/api-gateway/src/handlers/exports.rs`. This handler must:
   - Accept `POST /api/exports` with the JSON body shape from §13.1 (module, entity, format, scope, filters, columns, sort, notify_email).
   - For sync path (rows < 50,000): query the relevant table using filters/columns/sort from the request, format the result via the appropriate formatter (reuse `report_generator.rs` functions), and stream the response with `Content-Disposition: attachment; filename="{module}_{entity}_{YYYY-MM-DD_HHmm}.{ext}"`.
   - For async path (rows >= 50,000): INSERT a row into `export_jobs` with status `queued`, return 202, spawn a Tokio task that generates the file, updates the job row to `completed` with `file_path` and `file_size_bytes`, then issues `NOTIFY export_complete` for the Data Broker to route to the user's WebSocket.
   - Check `<module>:export` permission from claims. Return 403 if absent.

2. Add Parquet support: add `parquet = { version = "52", features = ["async"] }` to `Cargo.toml` (Apache-2.0). Implement a `write_parquet(headers, rows, path)` function mapping PostgreSQL types per §3.2 (TEXT→Utf8, FLOAT8→Float64, TIMESTAMPTZ→TimestampMicrosecond, BOOLEAN→Boolean, INTEGER→Int32, UUID→Utf8, JSONB→Utf8). Row group size: 10,000 rows. Compression: Snappy default.

3. Register routes in `main.rs` following the existing `.route()` chain pattern:
   ```
   .route("/api/exports", get(handlers::exports::list_exports).post(handlers::exports::create_export))
   .route("/api/exports/:id", get(handlers::exports::get_export).delete(handlers::exports::delete_export))
   .route("/api/exports/:id/download", get(handlers::exports::download_export))
   ```

4. Implement a background cleanup Tokio task (spawn once at startup in `main.rs`) that runs hourly and deletes files older than `EXPORT_RETENTION_HOURS` (default 24), setting `file_path = NULL` in `export_jobs` per §11.5.

Do NOT:
- Build a new service — all of this belongs in the API Gateway (Port 3000), per §2.1.
- Use GPL-licensed Parquet libraries. Use `parquet` from `arrow-rs` (Apache-2.0).
- Place export logic in `report_generator.rs` directly — create a separate `exports.rs` handler that reuses the formatter functions.
