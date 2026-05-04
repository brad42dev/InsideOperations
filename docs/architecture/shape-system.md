# Shape System Architecture

**Status:** Current and authoritative  
**Decision:** [docs/decisions/shape-storage-architecture.md](../decisions/shape-storage-architecture.md)  
**Last updated:** 2026-05-04

---

## Overview

Shapes are SVG equipment stencils (valves, pumps, vessels, columns, etc.) used in the I/O designer. Every shape has two components:

- **SVG data** — the raw vector geometry
- **Sidecar** — a JSON metadata blob that defines how the shape behaves at runtime: connection points, text zones, alarm binding, composable addons, variants, bindable parts, state CSS classes, etc.

The database is the runtime source of truth for both. No shape file reads happen at runtime in a fully migrated deployment.

---

## Shape Types

There are two shape types, both stored in the `design_objects` table.

### Library Shapes (`metadata->>'source' = 'library'`)

Built-in equipment stencils shipped with the application. ~85 shapes at initial release, growing over time via releases.

- **Immutable to users.** The delete endpoint enforces `source != 'library'`. No user action can remove or overwrite a library shape.
- **Version-locked to deployment.** Library shapes ship with the application binary. A fresh environment is automatically seeded. Shape changes between releases are handled by SQL migrations targeting specific shape IDs.
- **Protected by unique index** `uq_library_shape_id` on `(metadata->>'shape_id')` where `source='library'`.

### User Shapes (`metadata->>'source' = 'user'`)

Shapes uploaded by designers: custom SVGs, DCS-imported equipment stencils, facility-specific symbols.

- **Mutable.** Designers with `designer:write` permission can upload and delete user shapes.
- **Shape ID format:** `.custom.{uuid}` — the dot-prefix prevents any collision with library IDs.
- **DB is authoritative.** No files involved. Upload → DB. That's it.
- **Sidecar on upload:** a minimal sidecar is auto-generated from the SVG geometry. The designer can enrich it later via the sidecar editing workflow.

---

## Data Model

All shapes live in `design_objects`:

| Column | Type | Shape usage |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `name` | VARCHAR | Display name (same as `metadata->>'display_name'`) |
| `type` | VARCHAR | `'shape'` or `'shape_part'` |
| `svg_data` | TEXT | Raw SVG markup |
| `metadata` | JSONB | Shape metadata + full sidecar (see below) |
| `created_by` | UUID | Uploader (null for library shapes) |
| `created_at` | TIMESTAMPTZ | — |
| `updated_at` | TIMESTAMPTZ | — |

### `metadata` structure

```json
{
  "shape_id": "valve-control",
  "source": "library",
  "display_name": "Control Valve",
  "category": "valves",
  "view_box": "0 0 48 44",
  "schema": "io-shape-v1",
  "sidecar": { /* full ShapeSidecar — see io-shape-v1.schema.json */ }
}
```

For user shapes, `shape_id` is `.custom.{uuid}` and `source` is `'user'`.

### Sidecar schema

`frontend/public/shapes/_schema/io-shape-v1.schema.json` (or DB equivalent after full migration) is the canonical schema. Key top-level fields:

- `geometry` — viewBox, width, height
- `variants` — named SVG file options (opt1/opt2/etc.)
- `connections` — snap points for pipes and lines
- `textZones` — label render positions
- `valueAnchors` — bound point value display positions
- `alarmBinding` — how alarm severity maps to shape appearance
- `alarmAnchor` — alarm chip position
- `addons` — composable part shapes (agitators, actuators, fail indicators)
- `compositeAttachments` — positioning rules for addons
- `bindableParts` — sub-elements that accept individual point bindings
- `states` — CSS class mapping for running/stopped/alarm states
- `vesselInteriorPath` — clip path for fill gauge rendering
- `defaultSlots` — default positions for alarm/value overlays

---

## Access Path

All shape reads go through a single endpoint regardless of shape type:

**`POST /api/v1/shapes/batch`**

```json
Request:  { "shape_ids": ["valve-control", ".custom.abc123"] }
Response: { "valve-control": { "svg": "...", "sidecar": {...} }, ... }
```

- Returns both library and user shapes in one call.
- `SceneRenderer` and `libraryStore` both use this endpoint.
- In-memory LRU cache (200 entries) in `shapeCache.ts` sits in front of the API call.
- Auth: same as all other graphics endpoints. Static file fallback does not exist in a fully migrated deployment.

**`GET /api/v1/shapes`** — shape catalog for the designer palette (id, category, label, subcategory for all shapes).

---

## Bootstrap / Initial Seed

Library shapes are embedded in the `api-gateway` binary at compile time via `build.rs`, which reads `frontend/public/shapes/` and generates `shape_seeds.rs`. At startup, `seed_shape_library()` inserts shapes that do not yet exist in the DB (**insert-if-not-exists only — never overwrites existing rows**).

This means:
- Fresh environment: shapes seeded automatically from the binary.
- Existing environment: startup is a no-op.
- Orphaned old IDs (legacy shapes no longer on disk): deleted on startup if not in the current shape set.

After the full migration (all phases complete), `frontend/public/shapes/*.json` files are deleted from the web bundle. The SVG files may be kept temporarily for palette thumbnails, or replaced by blob URLs generated from the DB-served SVG strings.

---

## Updating Library Shapes

Library shapes are **not** updated by editing files and redeploying. After initial seed, the DB owns them.

**Adding a new library shape:**
1. Author the SVG + sidecar JSON in `frontend/public/shapes/{category}/`
2. Run `./dev.sh shapes import` — reads the file, upserts into DB
3. The file can then be committed to the repo as an authoring artifact or left off disk

**Updating an existing library shape:**
1. Write a SQL migration: `UPDATE design_objects SET svg_data = '...', metadata = '...' WHERE metadata->>'shape_id' = 'valve-control' AND metadata->>'source' = 'library'`
2. Apply via `sqlx migrate run`

**Bulk updates (changing sidecar schema fields across all shapes):**
Write a migration that transforms `metadata->'sidecar'` in bulk using JSONB operators.

---

## Updating User Shapes

User shapes are updated through the designer UI or API:

- **Upload new:** `POST /api/v1/shapes/user` (multipart: SVG file + name + category)
- **Delete:** `DELETE /api/v1/shapes/user/:id`
- **Re-import SVG:** `PUT /api/v1/shapes/:id/svg` (replace SVG, preserve sidecar)
- **Edit sidecar:** via the sidecar editing workflow (see sidecar architecture doc when written)

---

## Snapshot Backup (Dev Machine)

To snapshot the current shape library to git:

```bash
./dev.sh shapes export
```

This writes `services/api-gateway/shapes-snapshot.json` — all 85+ shapes as a JSON array. Commit this file. If the DB is ever corrupted or a migration goes wrong, restore with:

```bash
./dev.sh shapes restore
```

A git pre-commit hook on this machine runs `./dev.sh shapes export` automatically before each commit so the snapshot always reflects the current state.

The snapshot file is diffable — you can see exactly what changed between commits.

---

## DCS-Imported Shapes

When a customer site needs shapes that match their existing DCS graphics (facility-specific equipment, vendor symbols, etc.):

1. The SVG is prepared externally (from DCS export, traced from PDF, or drawn)
2. Uploaded via `POST /api/v1/shapes/user` — becomes a user shape
3. Sidecar is configured: connection points, text zones, alarm binding set up to match how the DCS represents that equipment
4. Shape is now available in the designer palette alongside library shapes, accessed through the same batch endpoint

These shapes live in the DB with `source='user'`. They are deployment-specific (not shipped with the binary) and are covered by the DB backup.

---

## What Does Not Exist at Runtime (After Full Migration)

- `frontend/public/shapes/*.json` — sidecar JSON files removed from web bundle
- `frontend/public/shapes/index.json` — shape catalog removed; served from `GET /api/v1/shapes`
- Static file fallback path in `shapeCache.ts` — removed
- Any `<img src="/shapes/...">` references — replaced with blob URLs from DB-served SVG strings
