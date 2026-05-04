# Decision: Shape Storage Architecture

**Date:** 2026-05-04  
**Status:** Accepted  
**Authors:** I/O Build

---

## Context

The shape library (~85 SVG equipment stencils) was originally served from static JSON + SVG files under `frontend/public/shapes/`. The database had shapes seeded into it (`design_objects`, `type='shape'`, `source='library'`) but the frontend never read from the DB at runtime — a comment in `SceneRenderer.tsx:668-670` explicitly documented why: the DB sidecars were incomplete, missing `addons` and `compositeAttachments` fields.

User-uploaded shapes (custom SVGs, DCS imports) already went into the DB via a separate upload API, meaning there were two incompatible shape storage systems in use simultaneously. With the shape library growing and customer DCS import use cases on the horizon, the divergence needed to be resolved.

The core question: **where does shape data live, and who owns it?**

Three possible answers were considered:

1. **Files own it** — DB is a cache, always overwritten from files at startup
2. **Binary owns it** — files compiled into binary at build time, binary seeds DB at startup and overwrites on every restart
3. **DB owns it** — files and binary are bootstrap mechanisms only; after initial seed, DB is authoritative

---

## Decision

**The database is the runtime source of truth for all shapes, both library and user.**

Files on disk are an authoring and bootstrap artifact only. After initial population, no running service reads from shape files. The DB is backed up, can be rolled back, and is not directly editable by end users.

---

## Rationale

**Why not files?**
Files can be edited, deleted, or corrupted by anyone with server access, bypassing RBAC. They differ across deployments based on what users have done. With ~85 shapes growing toward hundreds, managing files across environments is operationally fragile. Files also cannot hold user-uploaded custom shapes — that already required the DB — creating two incompatible systems.

**Why not binary embed as the canonical source?**
The binary embed approach (files → build.rs → binary → DB UPSERT on startup) means updating a library shape requires a full software release cycle: edit file → commit → build → deploy. That is wrong for operational data. It also means the DB is always overwritten by whatever was compiled in, so any DB-level fix or update is lost on the next restart.

**Why DB?**
- Covered by standard DB backups — shapes survive regardless of what happens to disk
- Rollback via `sqlx migrate revert` or point-in-time restore
- One consistent access path for library and user shapes (`POST /api/v1/shapes/batch`)
- Library shapes protected by `source='library'` and the `uq_library_shape_id` unique index — users cannot corrupt them
- Shape updates go through migrations (auditable, version-controlled in the migration history)
- DCS-imported customer shapes fit naturally as `source='user'` rows — no special handling needed

---

## How Library Shapes Bootstrap

Library shapes are embedded in the `api-gateway` binary at compile time via `build.rs`. On startup, `seed_shape_library()` uses **insert-if-not-exists** semantics — it never overwrites an existing row. This means:

- Fresh environment: shapes are populated automatically from the binary
- Existing environment: startup is a no-op
- Shape updates in a new release: handled by a targeted SQL migration, not a blanket UPSERT

This is the key distinction from the prior approach. The binary is the bootstrap mechanism, not the ongoing authority.

---

## Consequences

**Positive:**
- Single access path for all shapes regardless of source
- Library shapes are version-controlled through migration history, not file edits
- User/DCS shapes fit naturally into the same system
- DB backup covers all shape data
- No static files in the web bundle after full migration (security + bundle size)

**Negative:**
- Updating a library shape in a new release requires a SQL migration (not just committing a file change). Migrations with embedded SVG data are verbose. Mitigated by a CLI import tool (`./dev.sh shapes import`) that handles the SQL.
- Library shape changes are not in git file history. Mitigated by a snapshot file (`services/api-gateway/shapes-snapshot.json`) committed on a pre-commit hook.

---

## Alternatives Considered

| Alternative | Rejected Because |
|---|---|
| Files as runtime source | No backup, no access control, diverges across deployments, incompatible with user shapes |
| Binary UPSERT on startup | DB always overwritten — DB updates lost on restart, shape change requires full release cycle |
| Separate `shape_sidecars` table | Adds join complexity with no benefit; `design_objects.metadata->'sidecar'` is sufficient |
| SQL migrations embedding SVG directly | Impractical for bulk initial import; acceptable for targeted updates to specific shapes |
