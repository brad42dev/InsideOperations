---
id: DD-24-007
title: Add missing API endpoints and populate connector template_config
unit: DD-24
status: pending
priority: medium
depends-on: []
---

## What This Feature Should Do

Several API endpoints specified in the design doc are absent from the import service router: template instantiation (POST /templates/:id/instantiate), schema discovery (POST /connections/:id/discover), file upload (POST /upload), definition clone (POST /definitions/:id/clone). Additionally, all 49 connector templates are seeded with empty `template_config = '{}'` and `required_fields = '[]'` rather than the pre-built import definitions with {{placeholder}} variables described in §5c.

## Spec Excerpt (verbatim)

> | Method | Endpoint | Description |
> |---|---|---|
> | `POST` | `/api/imports/templates/:id/instantiate` | Create connection + definition(s) from template with user-provided field values |
> | `POST` | `/api/imports/connections/:id/discover` | Discover source schema (tables/columns) |
> | `POST` | `/api/imports/upload` | Upload file for import (CSV, Excel, JSON, XML) |
> | `POST` | `/api/imports/definitions/:id/clone` | Clone definition |
> — 24_UNIVERSAL_IMPORT.md, §14 API Endpoints

> I/O ships with **40 pre-built connector templates** [...] Templates pre-populate the entire import definition — connection config, source endpoints, field mappings, value maps, sync strategy, and validation — so that a fresh I/O install can start pulling data from a known application in minutes.
> — 24_UNIVERSAL_IMPORT.md, §5c Connector Templates — Turnkey Integration

> The `required_fields` column drives the wizard's dynamic form.
> ```jsonc
> [
>   { "key": "instance", "label": "ServiceNow Instance Name", "placeholder": "your-company", "type": "text" },
>   { "key": "SERVICENOW_CLIENT_SECRET", "label": "OAuth Client Secret", "type": "secret" }
> ]
> ```
> — 24_UNIVERSAL_IMPORT.md, §5c Template Structure

## Where to Look in the Codebase

Primary files:
- `services/import-service/src/handlers/import.rs:1129–1170` — `import_routes()` router; missing routes
- `services/import-service/src/main.rs:619–633` — template INSERT: `template_config = '{}'`, `required_fields = '[]'`
- `frontend/src/pages/settings/Import.tsx:365–506` — `SetupConnectionDrawerContent`: renders static JSON textarea instead of dynamic form from `required_fields`

## Verification Checklist

Read the code at the files listed above. Check each item:

- [ ] `POST /connector-templates/:id/instantiate` route exists and performs {{placeholder}} substitution using user-supplied field values, then creates `import_connection` + `import_definition(s)`
- [ ] `POST /connections/:id/discover` route exists and returns available tables/endpoints from the source
- [ ] `POST /upload` route exists and accepts multipart/form-data up to 100MB
- [ ] `POST /definitions/:id/clone` route exists and creates a copy with "(Copy)" suffix on the name
- [ ] At least one template (e.g., servicenow-itsm) has non-empty `required_fields` with typed entries (key, label, type: text/secret/number/select)
- [ ] `SetupConnectionDrawerContent` in `Import.tsx` renders dynamic form fields driven by `template.required_fields` array instead of a raw JSON textarea

## Assessment

- **Status**: ❌ Missing (all four endpoints) + ❌ Missing (template_config content)
- `handlers/import.rs:1129–1170`: router has no `/connector-templates/:slug/instantiate`, no `/connections/:id/discover`, no `/upload`, no `/definitions/:id/clone`
- `main.rs:619–633`: `template_config = '{}'`, `required_fields = '[]'` for all 49 templates

## Fix Instructions

**Backend — missing routes:**

1. Add to `import_routes()` in `handlers/import.rs`:
   ```rust
   .route("/connector-templates/:slug/instantiate", post(instantiate_template))
   .route("/connections/:id/discover", post(discover_schema))
   .route("/upload", post(upload_file))
   .route("/definitions/:id/clone", post(clone_definition))
   ```

2. `instantiate_template`: accept JSON body `{ "field_values": { "key": "value", ... } }`. Fetch the template row. Perform recursive string replacement of `{{key}}` in all string values of `template_config` JSONB. Create one `import_connection` and one or more `import_definition` rows from the substituted config.

3. `discover_schema`: fetch the connection row, dispatch to connector's `discover_schema` method (stub for unsupported connector types). Return `[{ "name": "table_name", "fields": [...] }]`.

4. `upload_file`: use `axum::extract::Multipart` to receive the file. Write to a temp directory (configurable via `IMPORT_UPLOAD_DIR`). Return a `{ "file_id": "...", "filename": "...", "size_bytes": N }`. Clean up after the import run completes.

5. `clone_definition`: fetch existing `import_definitions` row, insert a copy with `name = original_name + " (Copy)"` and a new UUID.

**Backend — template_config content:**

For each of the 40 domain templates in `seed_connector_templates`, add the appropriate `required_fields` array (at minimum: hostname/base_url, username, password/API key). The full pre-built `template_config` JSONB (with source_config, field_mappings, etc.) should be added incrementally as the integration profiles are written.

As a minimum viable step: populate `required_fields` for all 49 templates so the dynamic form can render. Example for `servicenow-itsm`:
```json
[{"key":"base_url","label":"ServiceNow Instance URL","placeholder":"https://yourcompany.service-now.com","type":"text"},{"key":"username","label":"Username","type":"text"},{"key":"password","label":"Password","type":"secret"}]
```

**Frontend — dynamic form:**

In `SetupConnectionDrawerContent` (`Import.tsx:365–506`): replace the raw JSON config textarea with a dynamically rendered form. Iterate `template.required_fields` array and render each field as `<input type="password">` for `type: "secret"`, `<input type="text">` for `type: "text"`, `<input type="number">` for `type: "number"`, `<select>` for `type: "select"`. Collect values into a `field_values` object and POST to `/api/import/connector-templates/:slug/instantiate` instead of manually constructing a raw connection.

Do NOT:
- Add placeholder substitution logic in the frontend — it belongs in the backend `instantiate_template` handler
- Allow the file upload endpoint to write outside the configured temp directory
- Mark any template as "complete" if its `required_fields` is still `'[]'`
