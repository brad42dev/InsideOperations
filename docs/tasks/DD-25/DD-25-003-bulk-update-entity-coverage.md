---
id: DD-25-003
title: Expand Bulk Update entity coverage to all 8+ spec-defined types including points_metadata
unit: DD-25
status: pending
priority: high
depends-on: []
---

## What This Feature Should Do

The Bulk Update system allows administrators to download a pre-populated template, modify it in Excel, and reimport it to apply configuration changes at scale. The spec defines 8+ entity types that must be supported. Currently only 4 are implemented (users, opc_sources, alarm_definitions, import_connections), and the highest-priority target (`points_metadata`) is entirely absent.

## Spec Excerpt (verbatim)

> Updateable Entities: Points (app config) → points_metadata (editable: active, criticality, area, aggregation_types, barcode, notes, gps_latitude, gps_longitude, write_frequency_seconds, default_graphic_id); Users → users; User role assignments → user_roles; Application settings → settings; Point sources → point_sources; Round templates → rounds tables; Log templates → log template config; Dashboard metadata → dashboards + dashboard_shares; Import definitions → import_definitions
— design-docs/25_EXPORT_SYSTEM.md, §9.1

## Where to Look in the Codebase

Primary files:
- `services/api-gateway/src/handlers/bulk_update.rs` — `TargetType` enum (lines 50–84), `fetch_current_rows()` (lines 247–348), `csv_headers()` (lines 78–85), `csv_row_to_json()` (lines 425–460), `apply_update()` (lines 482–561), `mutable_fields` match (lines 369–374)
- `frontend/src/api/bulkUpdate.ts` — `TargetType` and `TARGET_TYPE_LABELS` must also be updated
- `frontend/src/pages/settings/BulkUpdate.tsx` — entity selector dropdown (lines 393–406)

## Verification Checklist

- [ ] `TargetType` enum in `bulk_update.rs` includes `PointsMetadata`, `UserRoles`, `ApplicationSettings`, `PointSources`, `DashboardMetadata`, `ImportDefinitions`
- [ ] `fetch_current_rows()` queries `points_metadata` selecting all editable + read-only reference columns
- [ ] `csv_headers()` for `PointsMetadata` includes `__id`, all editable columns, and read-only reference columns with `[READ-ONLY]` suffix
- [ ] `apply_update()` for `PointsMetadata` updates only editable columns (active, criticality, area, aggregation_types, barcode, notes, gps_latitude, gps_longitude, write_frequency_seconds, default_graphic_id); never updates tagname, source_id, description, engineering_units, data_type, min_value, max_value
- [ ] `mutable_fields` for each new entity type excludes system-managed / immutable fields per §9.1 table
- [ ] `TARGET_TYPE_LABELS` in `frontend/src/api/bulkUpdate.ts` lists all new types
- [ ] Forbidden fields (password_hash, connection_config credentials, auth_config) never appear in any template

## Assessment

- **Status**: ❌ Missing
- **If partial/missing**: `bulk_update.rs:50–84` — `TargetType` has 4 variants: `Users`, `OpcSources`, `AlarmDefinitions`, `ImportConnections`. `points_metadata` (the primary advertised use case in §9.1 and the entire premise of the bulk update feature for industrial sites) is absent. 5 of the 9 spec-mandated types are missing entirely.

## Fix Instructions (if needed)

Add the following variants to `TargetType` in `bulk_update.rs` and implement all match arms for each:

1. `PointsMetadata` — query `points_metadata`; editable fields: `active`, `criticality`, `area`, `aggregation_types`, `barcode`, `notes`, `gps_latitude`, `gps_longitude`, `write_frequency_seconds`, `default_graphic_id`; read-only reference: `tagname`, `description`, `engineering_units`. Template ID column must be `__id` = `id` field. Apply UPDATE WHERE id = $1, setting only editable columns.

2. `UserRoles` — query `user_roles` joined to `users` and `roles` for reference; editable: role assignments per user. This entity requires different handling (many-to-many): template shows one row per user-role pair.

3. `ApplicationSettings` — query `settings`; editable: `value`; read-only: `key`, `description`.

4. `PointSources` — query `point_sources` (opc_sources is already `OpcSources`; check if this is the correct table name); editable: `name`, `description`, `enabled`; NEVER include `connection_config`.

5. `DashboardMetadata` — query `dashboards`; editable: `name`, `published`; exclude `layout`, `widgets` JSONB.

6. `ImportDefinitions` — query `import_definitions`; editable: `name`, `description`, `enabled`, `batch_size`, `error_strategy`; exclude `source_config`, `field_mappings` JSONB.

For ALL entity types: the template must include `_exported_at` as a metadata comment or dedicated column (ISO 8601 timestamp) for concurrency detection (see DD-25-006).

Update `TARGET_TYPE_LABELS` in `frontend/src/api/bulkUpdate.ts` to include all new types with user-facing labels.

Do NOT:
- Allow editing of OPC-managed point metadata fields (tagname, description, engineering_units, data_type, min_value, max_value) — they are overwritten on the next OPC sync per §9.2.
- Export `connection_config` or `auth_config` credential fields in any template regardless of entity type.
- Add `username` to editable fields for Users — it is an immutable identifier per §9.1.
