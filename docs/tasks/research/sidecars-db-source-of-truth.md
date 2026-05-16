# Task: Research and Plan — Sidecars as DB Source of Truth

**Last updated:** 2026-05-04 (Phase 13 audit by Opus; gaps fixed same day)

**Type:** Research and planning. Do NOT write implementation code. Produce a plan, discuss with the user, get approval.

**Model:** Use Opus (deep research + architecture decisions).

---

## Implementation Status

### Architecture doc vs implementation audit

Audited `docs/architecture/shape-system.md` against the actual codebase. Below is the gap list — items in the architecture doc that are not yet implemented, or where the implementation diverges.

#### IMPLEMENTED (confirmed matching architecture doc)

| Architecture doc claim | Implementation status | Files |
|---|---|---|
| DB is runtime source of truth for all shapes | YES | `seed_shapes.rs`, `batch_shapes`, `SceneRenderer.tsx`, `libraryStore.ts` |
| Library shapes: `metadata->>'source' = 'library'` | YES | `seed_shapes.rs:42`, `list_library_shapes`, `shapes_export()` |
| User shapes: `metadata->>'source' = 'user'`, `.custom.{uuid}` IDs | YES | `upload_user_shape` at `graphics.rs:1969` |
| `POST /api/v1/shapes/batch` returns both library and user shapes | YES — `source` filter removed | `graphics.rs:1322-1328` (no `source` filter in WHERE clause) |
| `GET /api/v1/shapes` — shape catalog endpoint | YES | `graphics.rs:1398-1450`, route at `main.rs:357` |
| `POST /api/v1/shapes/user` — upload endpoint | YES | `graphics.rs:1862` |
| `DELETE /api/v1/shapes/user/:id` — enforces `source != 'library'` | YES | `graphics.rs:2020-2065` |
| `GET /api/v1/shapes/user` — list user shapes | YES | `graphics.rs:1786` |
| Unique index `uq_library_shape_id` on `(metadata->>'shape_id')` | YES | `migrations/20260510000004_library_shape_unique_index.up.sql` |
| `build.rs` reads source files, generates `shape_seeds.rs` | YES — reads from `frontend/shapes-source/` | `services/api-gateway/build.rs` |
| `seed_shape_library()` is insert-if-not-exists (DO NOTHING) | YES | `seed_shapes.rs:51-58` |
| Orphan cleanup: deletes library shapes not in current set | YES | `seed_shapes.rs:82-97` |
| Insert/skipped counters in seed log | YES | `seed_shapes.rs:99-106` |
| `shapeCache.ts` — 200-entry LRU cache | YES | `shapeCache.ts:17` |
| `shapeCache.delete()` method | YES | `shapeCache.ts:50-52` |
| `shapeCache.clear()` method | YES | `shapeCache.ts:54-56` |
| `SceneRenderer` uses `batchShapesFetch` callback | YES | `SceneRenderer.tsx:661-668`, calls at lines 679 and 711 |
| `libraryStore` loads index from `GET /api/v1/shapes` | YES | `libraryStore.ts:181` via `graphicsApi.shapesIndex()` |
| `libraryStore` loads shapes from `POST /api/v1/shapes/batch` | YES | `libraryStore.ts:277` via `graphicsApi.batchShapes([id])` |
| `frontend/public/shapes/` removed (Vite no longer serves shape files) | YES | Directory does not exist; `frontend/shapes-source/` is the authoring source |
| Static file fallback removed from `shapeCache.ts` | YES | No `fetchShapesFromPublic` or `getShapeIndex` functions remain |
| `ShapeThumbnail` component uses blob URLs from DB SVG strings | YES | `frontend/src/pages/designer/components/ShapeThumbnail.tsx` used in `DesignerLeftPalette.tsx` and `CategoryShapeWizard.tsx` |
| Ghost placement uses `libraryStore` SVG (not static file) | YES | `DesignerCanvas.tsx:6746` |
| `./dev.sh shapes export` — writes `shapes-snapshot.json` | YES | `dev.sh:287-305` |
| `./dev.sh shapes restore` — restores from snapshot | YES | `dev.sh:307-349` |
| Pre-commit hook refreshes snapshot | YES | `.git/hooks/pre-commit` exists and runs `shapes export` |
| `shapes-snapshot.json` exists and committed | YES | `services/api-gateway/shapes-snapshot.json` |
| ETag support on batch endpoint | YES | `graphics.rs:1363-1392` |
| Cache-Control `private, max-age=300` on batch endpoint | YES | `graphics.rs:1388-1391` |
| `reimportShapeSvg` evicts shape from cache | YES | `graphics.ts:182` calls `shapeCache.delete(shapeId)` |
| `deleteUserShape` clears cache | YES | `graphics.ts:294` calls `shapeCache.clear()` |
| `display_name` in metadata | YES | `seed_shapes.rs:44`, `list_library_shapes`, `upload_user_shape` (now includes `display_name` in user shape metadata JSONB) |
| No `<img src="/shapes/...">` references remaining | YES | grep returns zero results |
| Schema file at `frontend/shapes-source/_schema/io-shape-v1.schema.json` | YES | File exists |

#### GAPS — ALL FIXED (2026-05-04)

| # | Architecture doc claim | Resolution |
|---|---|---|
| G1 | `PUT /api/v1/shapes/:id/svg` — re-import SVG, preserve sidecar | **FIXED.** `reimport_shape_svg` handler added in `graphics.rs`; route registered in `main.rs`. Parses viewBox from new SVG, updates `sidecar.geometry.viewBox`, enforces library immutability (403). |
| G2 | User shape upload auto-generates sidecar from SVG geometry | **FIXED.** `extract_viewbox_from_svg()` helper added; `upload_user_shape` now parses the actual SVG viewBox, falling back to `"0 0 100 100"` only if absent. |
| G3 | `./dev.sh shapes import` — CLI tool to import shapes from disk files to DB | **FIXED.** `shapes_import()` function added to `dev.sh`; upserts all shapes from `frontend/shapes-source/` into the DB using the same conflict target as `shapes_restore`. |
| G4 | `display_name` stored in user shape metadata | **FIXED.** `upload_user_shape` now writes `"display_name"` and `"view_box"` into the metadata JSONB alongside `shape_id`, `source`, `category`, `schema`, and `sidecar`. |
| G5 | Sidecar editing workflow for user shapes | **DEFERRED by design** — this is the subject of this research task. |
| G6 | `shapeCache.test.ts` unit tests | **FIXED.** `frontend/src/shared/graphics/shapeCache.test.ts` created; 13 tests covering successful fetch, throwing fetch, cache-hit bypass, LRU eviction, and MRU promotion. All pass. |
| G7 | Orphan-delete runs unconditionally | **FIXED.** Delete now gated behind `IO_SEED_ORPHAN_CLEANUP=1`. Default startup is insert-only with no deletions. Architecture doc updated with when/why to set the flag. |

#### MINOR DISCREPANCIES — ALL FIXED (2026-05-04)

| Item | Resolution |
|---|---|
| `seed_shapes.rs` comment said "from frontend/public/shapes/" | Fixed — now says `frontend/shapes-source/`. |
| `list_user_shapes` / `delete_user_shape` used `type IN ('shape', 'symbol')` | Fixed — both now use `('shape', 'shape_part')` consistent with all other shape queries. |
| `upload_user_shape` omitted `created_at`/`updated_at` | Left as-is — table defaults handle it; no functional impact. |
| Stale `/shapes/` comments in `SceneRenderer.tsx` and `renderNodeSvg.tsx` (4 locations) | Fixed — updated to reference the batch shapes endpoint. |
| Architecture doc referenced `frontend/public/shapes/_schema/` path | Fixed — updated to `frontend/shapes-source/_schema/` throughout. |
| `GET /api/v1/shapes/:id/svg` endpoint missing | **FIXED** (was missed in initial gap list). `export_shape_svg` handler added in `graphics.rs`; route registered. Returns raw SVG with `Content-Type: image/svg+xml`. |

---

## CONTEXT

### What sidecars are

Shape sidecars are JSON metadata blobs that define everything about a shape's behavior in the I/O designer. They include:

- Connection points (where pipes/lines snap onto the shape)
- Text zones (where labels render)
- Value anchors (where bound point values appear)
- Alarm anchor (where the alarm chip renders)
- Composable addons (e.g., agitator, jacket, cone bottom)
- Bindable parts (sub-elements that take individual point bindings)
- State CSS classes (running/stopped/alarm/etc. styling)
- Alarm binding (how alarm severity maps to the shape's appearance)
- Vessel interior path (clip path for fill gauges)
- Variants and addons composition rules

Per the spec, the sidecar is the contract between the shape SVG and the runtime renderer. Without it, an SVG is just art.

### Where sidecars live (current implementation, 2026-05-04)

**The decision: DB is the runtime source of truth.** See `docs/decisions/shape-storage-architecture.md`. Confirmed by audit:

1. **Database** — `design_objects.metadata->'sidecar'` (JSONB) for each `type IN ('shape','shape_part')` row. This is the runtime source of truth. All reads go through `POST /api/v1/shapes/batch`. The endpoint returns both `source='library'` and `source='user'` shapes in one call. ETag and `Cache-Control: private, max-age=300` are implemented.

2. **Source files on disk** — `frontend/shapes-source/{category}/{shape_id}.json` and matching SVGs. These are the **authoring source only**. They are read at compile time by `services/api-gateway/build.rs` and embedded in the `api-gateway` binary. On startup, `seed_shape_library()` populates a fresh DB via **insert-if-not-exists only** (`ON CONFLICT DO NOTHING`). After initial seed, the DB is authoritative. `frontend/public/shapes/` has been deleted; Vite serves no shape files.

3. **Snapshot file** — `services/api-gateway/shapes-snapshot.json`. A deterministic dump of all `source='library'` shapes, exported by `./dev.sh shapes export` and committed to git via pre-commit hook. Restored via `./dev.sh shapes restore` if the DB is corrupted.

4. **Frontend caches** — `shapeCache.ts` (200-entry LRU, used by `SceneRenderer`) and `libraryStore.ts` (Zustand store with its own 200-entry cache, used by the designer palette). Both read exclusively from the batch API. No static file fallback remains.

### What's done vs what's open

**Done (shape system migration complete):**
- All 13 phases of `docs/plans/mainplan.md` complete. DB-as-source-of-truth migration is operational.
- `build.rs` reads disk JSON verbatim; DB sidecars are field-identical to disk files at seed time.
- `SceneRenderer` and `libraryStore` both use the batch API exclusively. No static file fallback.
- `ShapeThumbnail` uses blob URLs from DB-served SVG. No `<img src="/shapes/...">` references remain.
- Cache eviction on re-import and delete implemented.
- `PUT /api/v1/shapes/:id/svg` and `GET /api/v1/shapes/:id/svg` endpoints implemented.
- `./dev.sh shapes import` implemented.
- User shape upload parses real viewBox from SVG; `display_name` stored in metadata.
- Orphan-delete gated behind `IO_SEED_ORPHAN_CLEANUP=1`.
- `shapeCache.test.ts` — 13 tests, all passing.

**Open (the subject of this task):**
- The sidecar **editing UX** — no admin UI or API exists to edit a sidecar after shape creation.
- The **versioning story** — what happens to existing graphics when a sidecar changes.
- Sidecar **validation** — nothing validates against `io-shape-v1.schema.json` at any layer.

### Key facts you should already trust

- `design-docs/shape-sidecar-spec/` is the **only** actively maintained design doc in the project (CLAUDE.md says so). Read it as authoritative.
- `frontend/shapes-source/_schema/io-shape-v1.schema.json` is the JSON Schema for sidecars.
- The shapes migration task (`docs/plans/mainplan.md`) is substantially complete. All runtime reads go through the DB. This task does not need to re-litigate that.

### Non-negotiables

- Royalty-free commercial license dependencies only (CLAUDE.md). Sidecar storage choices must respect this.
- UUID-internal / tagname-external rule does not directly apply to shapes (shapes use `shape_id` strings), but be aware of it when designing any new APIs touching shape data.

---

## EXECUTE

### Step 1 — Read the spec, fully

Read every file in `design-docs/shape-sidecar-spec/`:
- `shape-sidecar-spec.md`
- `shape-composition-rules.md`
- `shape-variants-addons.md`
- `implementation-plan.md`
- `extraction-progress.md`
- `batch-prompts.md`
- `SHAPE-LIBRARY-REBUILD-PROMPT.md`
- The four HTML preview files (skim only — they're rendered output)

Then read `frontend/shapes-source/_schema/io-shape-v1.schema.json` end-to-end. Build a mental model of every top-level field and every nested structure.

### Step 2 — Sample the disk sidecars

Read at least **5 representative disk sidecars** from `frontend/shapes-source/`. Do not pick randomly — pick deliberately to cover different shape complexities:

- One shape that has `addons` (e.g., a vessel with jacket / agitator addons)
- One shape that has `variants` (e.g., a column with packed/trayed/plain variants)
- One shape that has `vesselInteriorPath` (for fill gauges)
- One shape that has `alarmBinding`
- One shape that has `compositeAttachments` and/or `bindableParts` populated
- (Bonus) the simplest shape you can find, as a baseline

Use `ls frontend/shapes-source/` and the schema to pick. Note for each: which top-level fields are populated, which are absent.

### Step 3 — Confirm the DB sidecar pipeline is lossless

**Status: CONFIRMED by Phase 13 audit.**

`build.rs` reads JSON files verbatim from `frontend/shapes-source/` via `fs::read_to_string` and embeds them as raw string literals in the generated `shape_seeds.rs`. `seed_shapes.rs` parses the string with `serde_json::from_str` and wraps it as `metadata.sidecar`. No fields are dropped or transformed between disk and DB.

The old failure mode (inline Rust literals silently dropping fields) is gone. The seed is insert-if-not-exists (`ON CONFLICT DO NOTHING`), confirmed in `seed_shapes.rs:55-57`.

**Remaining concern:** The sidecar JSON is stored as `metadata->'sidecar'` (nested inside the `metadata` JSONB column). `seed_shapes.rs` wraps the entire disk JSON as the sidecar value inside a metadata envelope that also includes `shape_id`, `source`, `display_name`, `category`, `view_box`, `schema`. This means the `display_name` field exists both at `metadata.display_name` and potentially inside `metadata.sidecar.display_name` (if the disk JSON has it). This duplication is harmless but worth noting.

### Step 4 — Diff the schema vs the seed — MOOTED

No longer needed. `build.rs` reads disk JSON verbatim. DB sidecars are byte-identical to disk files at seed time. Confirmed by code review in Phase 13 audit.

### Step 5 — Storage shape question

Decide and recommend: should the sidecar live as today (`design_objects.metadata->'sidecar'`), get its own dedicated JSONB column (`design_objects.sidecar`), or get its own table (`shape_sidecars` keyed by `shape_id` with versioning)? Consider:

- Read pattern: `batch_shapes` fetches many at once for a graphic — what's fastest?
- Indexing: do we ever query inside the sidecar (e.g., "all shapes with an alarm binding")? If yes, JSONB-in-column with GIN index. If no, an opaque `text`/`bytea` column might be simpler.
- Versioning: can we tolerate sidecar changes silently breaking existing graphics? (See Step 8.)
- Validation: where does JSON Schema validation happen on write? Today: nowhere on the DB side.
- Migrations: how painful is it to evolve the sidecar shape across the whole table?
- Coexistence with the related shapes task — SVG is already in `svg_data` column; sidecar is nested in `metadata->'sidecar'`.

Pros/cons table required. State your recommendation with rationale.

**Context for the evaluator:** The `docs/decisions/shape-storage-architecture.md` already rejected a separate `shape_sidecars` table ("Adds join complexity with no benefit"). The current `metadata->'sidecar'` path is working and all read/write code is built around it. The question now is whether to promote sidecar to a top-level column for cleaner access, or leave it nested.

### Step 6 — Authoritative update path

Decide and recommend: when a developer wants to update a shape's sidecar (move a connection point, add an addon, change a state class, etc.), what is the **single correct way** to do it?

**Current answer per architecture doc:** SQL migration targeting specific shape IDs, or `./dev.sh shapes import` CLI. The `./dev.sh shapes import` command does not exist yet (Gap G3).

Options:
- (A) Edit the JSON file in `frontend/shapes-source/`; `./dev.sh shapes import` reads from disk and upserts into DB.
- (B) Edit via an admin API / admin UI; DB is sole source; disk files are export artifacts.
- (C) ~~Edit Rust string literals in `seed_shapes.rs`~~ — obsolete; `build.rs` auto-generates from disk.
- (D) SQL migration embedding the new sidecar JSON.

For each option assess: developer ergonomics, deployability across environments (dev/staging/prod), risk of drift, who-owns-what, how user-uploaded shapes fit in.

### Step 7 — `seed_shapes.rs` shape — DECIDED AND CONFIRMED

**Decision made 2026-05-04. Confirmed by Phase 13 audit.**

`seed_shapes.rs` is a thin bootstrap layer. Shapes are read from disk by `build.rs` at compile time and embedded into the binary; `seed_shapes.rs` consumes that auto-generated function via `include!(concat!(env!("OUT_DIR"), "/shape_seeds.rs"))`. The seed is **insert-if-not-exists only** (`ON CONFLICT DO NOTHING`) — confirmed in code. After initial bootstrap, the DB is the authoritative source.

**Confirmed facts:**
- `seed_shapes.rs:55-57` uses `DO NOTHING` (not `DO UPDATE`)
- Counters: `inserted` and `skipped` (lines 22-23)
- Orphan cleanup runs unconditionally (lines 82-97) — flagged in Gap G7
- No production-style overwrite path exists

No further action needed for this step.

### Step 8 — Versioning and downstream impact

A sidecar change can break live graphics. Examples:

- A connection point ID is renamed -> existing pipes referencing it become orphans.
- A connection point moves -> existing pipes attach at the wrong place but don't fail.
- A `bindableParts` entry is removed -> graphics with bindings to that part break.
- An addon is renamed -> graphics with that addon disappear or render wrong.
- A state class is removed -> graphics using it fall back to default styling silently.

Assess:

- Is sidecar versioning needed (e.g., `sidecar_version`, semver, or a content hash per shape)? If yes, what does a graphic store — version reference or snapshot?
- What's the migration story when a sidecar changes? Auto-migrate graphics? Lock graphics to old sidecar? Warn the user?
- Should we even allow breaking changes, or treat sidecars as append-only with deprecation?
- How does this interact with shape import/export and `.iographic` ZIP bundles?

Recommend a versioning policy.

### Step 9 — Validation

Decide where JSON Schema validation happens. Today, nothing validates a sidecar against `io-shape-v1.schema.json` at any layer. Options:

- DB-side check constraint (`pg_jsonschema` extension — PostgreSQL License = MIT-equivalent, OK).
- API-gateway validation on write.
- Build-time validation (CI lint on `frontend/shapes-source/` files).
- All three.

Recommend.

### Step 10 — Remaining implementation gaps

The original Step 10 ("make DB sidecar the single read source") is **complete** per the Phase 13 audit. The DB is the single read source. No static file fallback exists. The remaining work is:

1. **Gap G1 — `PUT /api/v1/shapes/:id/svg` backend handler.** The frontend `reimportShapeSvg` function calls this endpoint, but no backend handler or route exists. Implement the handler in `graphics.rs`, register the route in `main.rs`. The handler should:
   - Accept `{ svg_content: string }` body
   - Verify the shape exists and is `source='user'` (library shapes are immutable)
   - Parse the SVG's `viewBox` attribute and update `metadata->'sidecar'->'geometry'->'viewBox'`
   - Replace `svg_data` column with the new SVG content
   - Return `{ viewBoxChanged, oldViewBox, newViewBox }`

2. **Gap G2 — Parse SVG viewBox on user shape upload.** `upload_user_shape` hardcodes `"viewBox": "0 0 100 100"`. Add a simple regex or XML parse of the uploaded SVG's `viewBox` attribute and use the real value. If not found, fall back to `"0 0 100 100"`.

3. **Gap G3 — `./dev.sh shapes import` command.** Add an `import` subcommand that reads JSON files from `frontend/shapes-source/`, connects to the dev DB, and upserts each shape (matching on `metadata->>'shape_id'` where `source='library'`). This is the developer workflow for pushing sidecar edits to the local DB after editing disk files.

4. **Gap G4 — `display_name` in user shape metadata.** Add `"display_name": name` to the metadata JSONB in `upload_user_shape`. Otherwise `list_library_shapes` (if ever extended to include user shapes) would return null labels.

5. **Gap G6 — `shapeCache.test.ts` unit tests.** Create the test file per the Phase 12 spec in `mainplan.md`.

6. **Gap G7 — Orphan-delete review.** Decide whether to gate the orphan-delete block behind a startup flag or environment variable, remove it entirely, or keep it as-is with a warning in the architecture doc. Current risk: a SQL migration that adds a library shape not yet in the binary would have that shape deleted on next startup.

### Step 11 — Open questions

List anything you couldn't decide without the user's input. Expected questions:

- Is sidecar editing a feature we want for end-users (shape designer UI), or strictly developer-internal?
- Should shapes be tenant-scoped or globally shared? (Affects sidecar storage shape.)
- Is there appetite for a `pg_jsonschema` extension dependency for DB-side validation?
- What happens to graphics when a sidecar is breaking-changed in a customer site?
- Should the orphan-delete block in `seed_shapes.rs` be gated behind a flag, or is the current unconditional behavior acceptable?
- Priority ordering of Gaps G1-G7: which to fix first?

### Step 12 — Present to the user

Present findings and the proposed plan to the user **in conversation**. Do not write code. Wait for explicit approval and direction before any implementation work begins.

When presenting:
- Lead with the Implementation Status section (gap list) at the top of this file.
- State recommendations from Steps 5, 6, 8, 9 with one-line rationale each.
- Show the remaining implementation gaps from Step 10.
- List open questions from Step 11.
- Ask which decisions the user wants to lock in now vs defer.

---

## Deliverables

A conversation with the user containing:

1. The implementation audit gap list (Implementation Status section above).
2. Recommendations on storage shape, update path, versioning, validation (Steps 5, 6, 8, 9).
3. A concrete list of remaining implementation gaps with proposed fixes (Step 10).
4. Open questions and a request for approval (Steps 11-12).

No code. No file edits beyond this task file. Plan only.
