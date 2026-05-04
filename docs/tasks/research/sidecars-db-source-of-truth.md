# Task: Research and Plan — Sidecars as DB Source of Truth

> **NOTICE — 2026-05-04:** Shape storage architecture decision has been made.
> See `docs/decisions/shape-storage-architecture.md` and `docs/architecture/shape-system.md`
> **before executing this task.** The shape SVG + sidecar serving has moved to the DB
> (`POST /api/v1/shapes/batch`); the related shapes plan in `docs/plans/mainplan.md`
> is mid-execution. This task is now narrower — it's about the sidecar **data model and
> editing/versioning workflow**, not whether the DB is the runtime source of truth (it is).
> Several steps below are partially mooted; updates inline.

**Type:** Research and planning. Do NOT write implementation code. Produce a plan, discuss with the user, get approval.

**Model:** Use Opus (deep research + architecture decisions).

**Related task:** `docs/tasks/research/shapes-db-source-of-truth.md` — that task addressed moving the shape SVG + full sidecar serving from static files to the DB. THAT decision is now made and being executed (`docs/plans/mainplan.md`). THIS task is specifically about the sidecar **data model** — how sidecars should be stored within the DB, versioned, mutated, and edited — and remains relevant as the sidecar editing/versioning story is still open.

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

### Where sidecars live (post-decision, 2026-05-04)

**The decision: DB is the runtime source of truth.** See `docs/decisions/shape-storage-architecture.md`. Per `docs/architecture/shape-system.md`:

1. **Database** — `design_objects.metadata->'sidecar'` (JSONB) for each `type IN ('shape','shape_part')` row. This is the runtime source of truth. All reads go through `POST /api/v1/shapes/batch`.

2. **Static JSON files on disk** — `frontend/public/shapes/{category}/{shape_id}.json`. These are now an **authoring/bootstrap artifact only**. They are read at compile time by `services/api-gateway/build.rs` and embedded in the binary; on startup, `seed_shape_library()` populates a fresh DB from those embedded shapes **insert-if-not-exists only — never overwrites**. After initial seed, the DB is authoritative; library shape updates go through SQL migrations or a `./dev.sh shapes import` CLI tool, not file edits + redeploy. Files are scheduled to be removed from the web bundle entirely (Phase 10 of the shapes plan) and may be deleted from the repo (Phase 11) once `<img src="/shapes/...">` thumbnail call sites are migrated to blob URLs.

3. **Snapshot file** — `services/api-gateway/shapes-snapshot.json`. A deterministic dump of all `source='library'` shapes, exported by `./dev.sh shapes export` and committed to git. This is the diffable git history of the library; restored via `./dev.sh shapes restore` if the DB is corrupted. A pre-commit hook keeps it current.

The previous "two stores have drifted" problem has been resolved by Phases 1–4 of `docs/plans/mainplan.md`: build.rs replaces inline Rust literals, the DB has all 85 shapes with full sidecars (`addons`, `compositeAttachments`, etc.), and the seed is being moved to insert-if-not-exists in Phase 4.

### Why this matters

- `services/api-gateway/src/handlers/graphics.rs:1305` (`batch_shapes`) returns `metadata->'sidecar'`. The frontend wires `batchFetch` to this endpoint as part of `docs/plans/mainplan.md` Phase 5 — so the DB sidecar is (or will shortly be) the live read path.
- `services/api-gateway/src/handlers/graphics.rs:1888` (`upload_user_shape`) builds a placeholder sidecar with only `geometry.viewBox` — user-uploaded shapes effectively have no behavior. **This is still an open problem and a primary subject of Step 10 below.**
- `frontend/src/.../SceneRenderer.tsx:668-670` previously documented why the DB sidecar was bypassed (missing `addons` / `compositeAttachments`). After Phase 5 of the shapes plan that comment is removed, and the DB is the canonical source.
- The library-shape update path is now defined for the simple case: edit JSON file → rebuild → `./dev.sh shapes import` for existing deployments, or write a SQL migration for production. **What's still undefined:** the editing UX (admin UI vs CLI vs file edit), the versioning story (what happens to existing graphics when a sidecar changes), and the user-shape sidecar generation/editing flow. Those are the open questions this task addresses.

### Key facts you should already trust

- `design-docs/shape-sidecar-spec/` is the **only** actively maintained design doc in the project (CLAUDE.md says so). Read it as authoritative.
- `frontend/public/shapes/_schema/io-shape-v1.schema.json` is the JSON Schema for sidecars.
- The shapes task (separate file) handles SVG storage + serving. Don't re-litigate that here. Focus on the sidecar data model.

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

Then read `frontend/public/shapes/_schema/io-shape-v1.schema.json` end-to-end. Build a mental model of every top-level field and every nested structure.

### Step 2 — Sample the disk sidecars

Read at least **5 representative disk sidecars** from `frontend/public/shapes/`. Do not pick randomly — pick deliberately to cover different shape complexities:

- One shape that has `addons` (e.g., a vessel with jacket / agitator addons)
- One shape that has `variants` (e.g., a column with packed/trayed/plain variants)
- One shape that has `vesselInteriorPath` (for fill gauges)
- One shape that has `alarmBinding`
- One shape that has `compositeAttachments` and/or `bindableParts` populated
- (Bonus) the simplest shape you can find, as a baseline

Use `ls frontend/public/shapes/` and the schema to pick. Note for each: which top-level fields are populated, which are absent.

### Step 3 — Read the DB-side seeding code

> **Updated 2026-05-04:** `seed_shapes.rs` no longer contains inline Rust literals. It now consumes an auto-generated `shape_seeds()` function produced by `services/api-gateway/build.rs` at compile time from `frontend/public/shapes/`. The seed currently UPSERTs (Phase 3 of the shapes plan) but is being changed to insert-if-not-exists in Phase 4 (in progress). The two backfill migrations from 2026-03-27 are obsolete in the current architecture — all shapes now have full sidecars from the build.rs pipeline.

Read in full:
- `services/api-gateway/build.rs` — compile-time shape ingestion (reads `frontend/public/shapes/`, generates `$OUT_DIR/shape_seeds.rs`)
- `services/api-gateway/src/seed_shapes.rs` — the runtime seed entry point. Note its current state per `docs/plans/mainplan.md` (Phase 3 done, Phase 4 changes it to insert-if-not-exists).
- `services/api-gateway/src/handlers/graphics.rs` lines around `batch_shapes` (1305) and `upload_user_shape` (1888)
- `migrations/20260327000001_populate_shape_sidecars.up.sql` — historical, supplanted by build.rs
- `migrations/20260327000002_shape_sidecars_variant_fallback.up.sql` — historical, supplanted by build.rs

Also grep for any other code that touches `metadata->'sidecar'` or constructs sidecar JSON. Look in:
- `services/api-gateway/src/`
- `services/graphics-service/` (if it exists)
- Any migration that mentions `sidecar`

### Step 4 — Diff the schema vs the seed

> **Updated 2026-05-04:** Largely mooted. `build.rs` now reads disk JSON files verbatim and embeds them in the binary, so disk and DB sidecars are byte-identical at seed time. The old "inline Rust literals drop fields silently" failure mode is gone. Skim this step to confirm nothing has regressed (e.g., `build.rs` or `seed_shapes.rs` does not strip or transform fields between the file and the DB row), but do not redo the full schema-vs-seed diff exercise unless the field-loss problem has reappeared.

Concretely confirm: read a few shapes' rows directly from the DB and compare `metadata->'sidecar'` to the disk JSON files. They should match field-for-field. If they don't, find the lossy step in `build.rs` or `seed_shapes.rs`.

For reference, original instruction: "Concretely produce a table of every top-level field in `io-shape-v1.schema.json` and mark for each:
- Present in `seed_shapes.rs` (yes / no / partial)
- Present in disk JSON for the sample shapes (yes / no / per-shape)
- Present in the variant fallback migration (yes / no)"

### Step 5 — Storage shape question

Decide and recommend: should the sidecar live as today (`design_objects.metadata->'sidecar'`), get its own dedicated JSONB column (`design_objects.sidecar`), or get its own table (`shape_sidecars` keyed by `shape_id` with versioning)? Consider:

- Read pattern: `batch_shapes` fetches many at once for a graphic — what's fastest?
- Indexing: do we ever query inside the sidecar (e.g., "all shapes with an alarm binding")? If yes, JSONB-in-column with GIN index. If no, an opaque `text`/`bytea` column might be simpler.
- Versioning: can we tolerate sidecar changes silently breaking existing graphics? (See Step 8.)
- Validation: where does JSON Schema validation happen on write? Today: nowhere on the DB side.
- Migrations: how painful is it to evolve the sidecar shape across the whole table?
- Coexistence with the related shapes task — if SVG also moves to a dedicated location, does it make sense to co-locate or split?

Pros/cons table required. State your recommendation with rationale.

### Step 6 — Authoritative update path

Decide and recommend: when a developer wants to update a shape's sidecar (move a connection point, add an addon, change a state class, etc.), what is the **single correct way** to do it? Options:

- (A) Edit the JSON file on disk; some build/seed step pushes to DB on next deploy.
- (B) Edit via an admin API / admin UI; DB is sole source; disk files are export artifacts.
- (C) Edit Rust string literals in `seed_shapes.rs`; re-seed. (Current accidental answer; almost certainly wrong.)
- (D) Hybrid: disk files are dev-time source, but a CLI tool (`io-shape-sync` or `cargo run --bin seed-shapes`) reads disk and idempotently updates DB.

For each option assess: developer ergonomics, deployability across environments (dev/staging/prod), risk of drift, who-owns-what (frontend devs vs backend devs), how user-uploaded shapes fit in, and how it interacts with `upload_user_shape`. State a recommendation.

### Step 7 — `seed_shapes.rs` shape — DECIDED

> **Decision made 2026-05-04:** Keep `seed_shapes.rs` as a thin bootstrap layer. Shapes are read from disk by `build.rs` at compile time and embedded into the binary; `seed_shapes.rs` consumes that auto-generated function via `include!(concat!(env!("OUT_DIR"), "/shape_seeds.rs"))`. The seed is **insert-if-not-exists only** — it never overwrites an existing DB row. After initial bootstrap, the DB is the authoritative source and updates flow through SQL migrations or the `./dev.sh shapes import` CLI.
>
> See `docs/decisions/shape-storage-architecture.md` and `docs/architecture/shape-system.md` "Bootstrap / Initial Seed" for the full rationale.
>
> **What's actually left to do for this task:**
> - Confirm the insert-if-not-exists fix from Phase 4 of `docs/plans/mainplan.md` has landed and the seed cannot overwrite the DB on restart.
> - Verify no production-style overwrite path remains (e.g., a developer accidentally re-introducing UPSERT).
> - For the sidecar-specific concerns (validation, versioning, editing), see Steps 8–10 below — those are the open questions this task still needs to answer.

The original five options below are preserved for context but no longer require evaluation:

> - Keep inline literals (status quo).
> - Replace with `include_str!` of the disk JSON files at compile time.
> - Read JSON files at startup from a known directory (configurable).
> - Eliminate `seed_shapes.rs` entirely; rely on migration + admin tool.
> - Keep a thin `seed_shapes.rs` that bootstraps an empty DB, but the source-of-truth is elsewhere. *(This is the chosen option.)*

### Step 8 — Versioning and downstream impact

A sidecar change can break live graphics. Examples:

- A connection point ID is renamed → existing pipes referencing it become orphans.
- A connection point moves → existing pipes attach at the wrong place but don't fail.
- A `bindableParts` entry is removed → graphics with bindings to that part break.
- An addon is renamed → graphics with that addon disappear or render wrong.
- A state class is removed → graphics using it fall back to default styling silently.

Assess:

- Is sidecar versioning needed (e.g., `sidecar_version`, semver, or a content hash per shape)? If yes, what does a graphic store — version reference or snapshot?
- What's the migration story when a sidecar changes? Auto-migrate graphics? Lock graphics to old sidecar? Warn the user?
- Should we even allow breaking changes, or treat sidecars as append-only with deprecation?
- How does this interact with shape import/export and `.iographic` ZIP bundles (see project memory `project_iographic_format.md`)?

Recommend a versioning policy.

### Step 9 — Validation

Decide where JSON Schema validation happens. Today, nothing validates a sidecar against `io-shape-v1.schema.json` at runtime. Options:

- DB-side check constraint (PostgreSQL JSON Schema check — Postgres 16+ has limited support; consider `pg_jsonschema` extension license — it's PostgreSQL License = MIT-equivalent, OK).
- API-gateway validation on write.
- Build-time validation (CI lint).
- All three.

Recommend.

### Step 10 — Plan: DB sidecar as single read source

Draft a concrete plan for making the DB sidecar the **single authoritative read source** at runtime — no fallback to static files for sidecars. Coordinate with the related shapes task but solve only the sidecar piece. Include:

- Backfill: how do all 87 disk sidecars get into the DB completely (not the truncated subset in `seed_shapes.rs`)?
- Read path: confirm `batch_shapes` returns the full sidecar; the frontend (`SceneRenderer`) consumes it without filling in any fields from disk.
- Remove the bypass at `SceneRenderer.tsx:668-670` once `addons` / `compositeAttachments` are guaranteed in the DB payload.
- `upload_user_shape` produces a real sidecar (not a viewBox-only stub) — at minimum a sensible default for user uploads.
- Removal or downgrade of the variant-fallback migration once real sidecars are everywhere.
- Phased rollout: which steps are safe to ship independently? What's reversible?

Plan should be ordered, dependency-aware, and identify integration points with the shapes task.

### Step 11 — Open questions

List anything you couldn't decide without the user's input. Examples likely to come up:

- Is sidecar editing a feature we want for end-users (shape designer UI), or strictly developer-internal?
- Should shapes be tenant-scoped or globally shared? (Affects sidecar storage shape.)
- Is there appetite for a `pg_jsonschema` extension dependency?
- What happens to graphics when a sidecar is breaking-changed in a customer site?

### Step 12 — Present to the user

Present findings and the proposed plan to the user **in conversation**. Do not write code. Do not modify files (other than possibly updating this task file with notes if the user asks). Wait for explicit approval and direction before any implementation work begins.

When presenting:
- Lead with the diff table from Step 4 (the concrete gap).
- State your recommendations from Steps 5, 6, 7, 8, 9 with one-line rationale each.
- Show the phased plan from Step 10.
- List open questions from Step 11.
- Ask which decisions the user wants to lock in now vs defer.

---

## Deliverables

A conversation with the user containing:

1. The schema-vs-seed gap analysis (Step 4).
2. Recommendations on storage shape, update path, seeding approach, versioning, validation (Steps 5–9).
3. A phased implementation plan to make the DB the sole sidecar read source (Step 10).
4. Open questions and a request for approval (Steps 11–12).

No code. No file edits. Plan only.
