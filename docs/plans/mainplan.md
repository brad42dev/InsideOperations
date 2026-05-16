# Shape Library DB Migration — Master Plan

## How to use this file

Read this file in full, then execute **only the phase number you were given**. Do not implement any other phase. Each phase has its own Gate, Implementation, Verification, and Rollback. Do not proceed without passing Verification.

The launch prompt is always: `read docs/plans/mainplan.md and execute phase N`

---

## Context (skim once; skip on phase execution)

### Migration goal

Move the I/O designer shape library (~85 SVG equipment stencils — valves, pumps, vessels, columns, etc.) off of static JSON + SVG files in `frontend/public/shapes/` and onto the database as the runtime source of truth. Every shape read at runtime — library or user — goes through `POST /api/v1/shapes/batch` against the DB. After full migration the static JSON files are removed from the web bundle entirely.

### The architectural decision (DB is source of truth)

The decision was finalized 2026-05-04. The full rationale lives in `docs/decisions/shape-storage-architecture.md`. The implementation contract is `docs/architecture/shape-system.md` (read both before executing any phase that touches DB seeding or the batch endpoint).

In short:

- **Database is the runtime source of truth for all shapes** (library + user). After initial seed, no running service reads from shape files.
- **Files on disk + binary embed are bootstrap mechanisms only.** `build.rs` reads `frontend/public/shapes/` at compile time and embeds shape data in the `api-gateway` binary; on startup, `seed_shape_library()` populates the DB **insert-if-not-exists only — never overwrites existing rows.**
- **Library shape updates after initial seed go through SQL migrations or a CLI import tool**, not file edits + redeploy. The binary is a bootstrap, not the ongoing authority.
- **All shapes (library + user) served from `POST /api/v1/shapes/batch`** — one access path for both `source='library'` and `source='user'` rows.
- **Static files are deleted from the web bundle after full migration.**

### What's already done

Phases 1, 2, 3 are complete:

- **Phase 1 (Build script scaffold)** — `services/api-gateway/build.rs` exists and walks `frontend/public/shapes/` at compile time, generating `$OUT_DIR/shape_seeds.rs` with all shape SVG + sidecar content embedded as Rust string literals. 85 shapes generated.
- **Phase 2 (Saved document preflight)** — Database verified to have no graphics referencing shape IDs not present on disk.
- **Phase 3 (Rebuild seed_shapes.rs)** — `seed_shapes.rs` rewritten to consume the auto-generated `shape_seeds()`, with the unique partial index `uq_library_shape_id` created and 28 orphaned legacy shape IDs cleaned from the DB. **Currently DB has 85 library shapes.**

**Phase 3 has a known regression:** the rewritten seed uses `INSERT ... ON CONFLICT DO UPDATE` (UPSERT). This contradicts the new architectural decision — DB is supposed to be authoritative after first seed, so the binary must not overwrite DB rows on every startup. **Phase 4 fixes this before any further work proceeds.**

### The insert-if-not-exists rule (non-negotiable)

`seed_shape_library()` must populate a fresh DB but never overwrite an existing row. Library shape changes after the initial seed are delivered via SQL migrations targeting specific shape IDs, or via the `./dev.sh shapes import` CLI command. This is the architectural contract that lets the DB be authoritative; do not introduce code that re-establishes the binary as the ongoing authority.

### Plan layout

- **Phase 1** — build.rs scaffold (DONE)
- **Phase 2** — saved document preflight (DONE)
- **Phase 3** — rebuild seed_shapes.rs (DONE, but contains a UPSERT regression that Phase 4 fixes)
- **Phase 4** — fix seed insert-if-not-exists + fix batch endpoint to include user shapes + add CLI export command
- **Phase 5** — wire batchFetch in SceneRenderer
- **Phase 6** — parity verification
- **Phase 7** — add library index API endpoint (`GET /api/v1/shapes`)
- **Phase 8** — migrate libraryStore.ts to API
- **Phase 9** — snapshot + git pre-commit hook (`./dev.sh shapes export`)
- **Phase 10** — remove static JSON files from web bundle
- **Phase 11** — replace static SVG thumbnails with blob URLs (from DB)
- **Phase 12** — cache hardening and stale-data fixes
- **Phase 13** — architecture review and sidecar alignment

**Critical constraint:** Shapes must render EXACTLY the same after this migration. Every phase has a verification gate. Do not skip them.

---

## Phase 1: Build Script Scaffold — DONE

### Status
Complete. `services/api-gateway/build.rs` exists and generates `$OUT_DIR/shape_seeds.rs` at compile time with 85 shapes embedded.

### Verification (already passed)
```bash
BINDGEN_EXTRA_CLANG_ARGS="-I/usr/lib/gcc/x86_64-linux-gnu/13/include" cargo build -p api-gateway 2>&1 | grep "warning=Shape seeds"
# warning: Shape seeds generated: 85
```

No further action required for this phase. Skip to Phase 4 (the next phase that needs work) unless re-verifying.

---

## Phase 2: Saved Document Preflight Check — DONE

### Status
Complete. Database verified — no graphics reference shape IDs that don't exist on disk.

### Rationale for keeping in plan
Documents the SQL diagnostic for future use if shape ID drift is suspected. The preflight queries are in the git history of the old `docs/plans/mainplan.md` (commit before `0bd92b03`).

No further action required.

---

## Phase 3: Rebuild seed_shapes.rs — DONE (with known UPSERT regression)

### Status
Complete: `seed_shapes.rs` consumes the auto-generated `shape_seeds()`, the partial unique index `uq_library_shape_id` exists, and 28 legacy orphan shapes were cleaned from the DB. DB currently has 85 library shapes.

### Known regression
The rewritten seed uses `INSERT ... ON CONFLICT DO UPDATE` (UPSERT) which overwrites DB rows on every startup. This contradicts the architectural decision (DB is authoritative after first seed). **Phase 4 fixes this** by changing the seed to insert-if-not-exists.

Do not re-execute Phase 3 in isolation — proceed to Phase 4.

---

## Phase 4: Fix Seed (Insert-If-Not-Exists), Fix Batch Endpoint, Add CLI Export

### Goal
Three coupled fixes that bring the running system into alignment with the new architectural decision before any frontend wiring happens:

1. Change `seed_shape_library()` from UPSERT to **insert-if-not-exists only**. The binary must populate a fresh DB but never overwrite existing rows.
2. Fix `POST /api/v1/shapes/batch` (`batch_shapes` handler) — currently filters `metadata->>'source' = 'library'`, which means **user shapes are never returned**. The decision says one batch endpoint serves both. Remove the `source` filter and ensure user shapes are returned alongside library shapes.
3. Add `./dev.sh shapes export` CLI command that writes `services/api-gateway/shapes-snapshot.json` (a deterministic dump of all `source='library'` shapes). Adds the file to the repo. Does NOT add the pre-commit hook yet (that's Phase 9, after we have the rest of the migration done and verified — we want to snapshot from a known-good state, not a half-migrated one).

### Gate
Phase 3 verified complete (DB has 85 library shapes, build.rs generates correct seed count, unique index exists).

### Files to read before starting
- `/home/io/io-dev/io/services/api-gateway/src/seed_shapes.rs` — entire file (current UPSERT implementation)
- `/home/io/io-dev/io/services/api-gateway/src/handlers/graphics.rs` lines 1290–1365 — `batch_shapes` handler (note the `metadata->>'source' = 'library'` filter on line 1323)
- `/home/io/io-dev/io/dev.sh` — locate the case statement that dispatches subcommands; identify where to add `shapes` handling
- `/home/io/io-dev/io/docs/architecture/shape-system.md` — re-read sections "Bootstrap / Initial Seed" and "Snapshot Backup"

### Implementation

**Step 1 — Change seed to insert-if-not-exists.**

In `services/api-gateway/src/seed_shapes.rs`, replace the current `INSERT ... ON CONFLICT ... DO UPDATE` block with `INSERT ... ON CONFLICT ... DO NOTHING`. The exact change inside the `for s in &shapes` loop:

```rust
let result: Result<sqlx::postgres::PgQueryResult, _> = sqlx::query(
    r#"
    INSERT INTO design_objects (id, name, type, svg_data, metadata, created_at, updated_at)
    VALUES (gen_random_uuid(), $1, $2, $3, $4::jsonb, NOW(), NOW())
    ON CONFLICT ((metadata->>'shape_id'))
        WHERE type IN ('shape', 'shape_part') AND metadata->>'source' = 'library'
    DO NOTHING
    "#,
)
.bind(&display_name)
.bind(s.shape_type)
.bind(s.svg_data)
.bind(metadata.to_string())
.execute(db)
.await;

match result {
    Ok(r) => {
        if r.rows_affected() > 0 {
            inserted += 1;
        } else {
            skipped += 1;
        }
    }
    Err(e) => warn!(shape_id = %s.shape_id, error = %e, "Failed to insert shape"),
}
```

Rename the `upserted` counter to two counters `inserted` and `skipped` (so logs make it obvious whether this was a fresh DB or a no-op startup). Update the final `info!` log:

```rust
info!(
    inserted,
    skipped,
    deleted,
    total = shapes.len(),
    "Shape library seed complete"
);
```

**Keep the orphan-cleanup `DELETE` block as-is.** It removes library rows whose IDs are no longer in the embedded shape set. This is correct: it runs only against `source='library'` rows and only deletes IDs we never embedded, so it cannot delete a user shape and cannot delete a shape an admin added through a migration (because migrations create rows with current IDs that ARE in the embedded set, OR they would also be removed — see "Note on the orphan delete" below).

> **Note on the orphan delete:** The orphan-delete block currently runs unconditionally. After full migration this could become hostile to the "DB is authoritative" model — if a future SQL migration adds a new library shape ID that isn't yet in the binary (because the migration was deployed before the next binary release), the seed would delete it on the next startup. For now this is fine because no such migrations exist; flag in Phase 13's review whether to gate the delete behind a startup flag or remove it entirely.

**Step 2 — Fix `batch_shapes` to include user shapes.**

In `services/api-gateway/src/handlers/graphics.rs`, find the `batch_shapes` handler around line 1305. The current SQL is:

```sql
SELECT metadata->>'shape_id' as shape_id, svg_data, metadata
FROM design_objects
WHERE metadata->>'source' = 'library'
  AND metadata->>'shape_id' = ANY($1)
  AND type IN ('shape', 'shape_part')
```

Remove the `metadata->>'source' = 'library'` filter so the endpoint returns both library and user shapes:

```sql
SELECT metadata->>'shape_id' as shape_id, svg_data, metadata
FROM design_objects
WHERE metadata->>'shape_id' = ANY($1)
  AND type IN ('shape', 'shape_part')
```

The shape ID format prevents collisions: library shapes use plain IDs (`valve-control`), user shapes use the dot-prefix (`.custom.{uuid}`) per `docs/architecture/shape-system.md`. So `ANY($1)` matching by `shape_id` is safe regardless of source.

> Note: this query relies on `metadata->>'shape_id'` being indexed for both library and user shapes. The `uq_library_shape_id` index is partial (`WHERE source='library'`). Verify there is also an index covering user shapes — if not, this is something to flag in Phase 13's review (likely fine for current scale but worth checking the explain plan with `EXPLAIN (ANALYZE, BUFFERS)` after the change).

**Step 3 — Add `./dev.sh shapes export` CLI command.**

Add a new subcommand to `dev.sh`. The command should:

1. Connect to the dev database (`postgresql://io:io_password@localhost:5432/io_dev`)
2. Query all `source='library'` shapes ordered by `metadata->>'shape_id'` for deterministic output
3. Write to `services/api-gateway/shapes-snapshot.json` as a JSON array of `{ shape_id, name, type, svg_data, metadata }` objects
4. Pretty-print with stable key ordering (so the file is diffable in git)

Suggested implementation — a `shapes_export()` shell function that uses `docker exec` + the postgres container. `psql` is not in the host PATH — it lives inside the `io_dev_db` container. Example structure:

```bash
DOCKER_PSQL="docker exec io_dev_db psql -U io -d io_dev"

shapes_export() {
    local out="services/api-gateway/shapes-snapshot.json"
    $DOCKER_PSQL -At -c "
        SELECT jsonb_pretty(jsonb_agg(
            jsonb_build_object(
                'shape_id', metadata->>'shape_id',
                'name', name,
                'type', type,
                'svg_data', svg_data,
                'metadata', metadata
            )
            ORDER BY metadata->>'shape_id'
        ))
        FROM design_objects
        WHERE type IN ('shape', 'shape_part')
          AND metadata->>'source' = 'library';
    " > "$out"
    echo "Wrote $(wc -l < "$out") lines to $out"
}

shapes_restore() {
    local in="services/api-gateway/shapes-snapshot.json"
    if [ ! -f "$in" ]; then
        echo "ERROR: $in not found"
        exit 1
    fi
    # Restore is destructive — confirm with user
    read -p "Restore will TRUNCATE library shapes and reload from snapshot. Continue? [y/N] " -n 1 -r
    echo
    [[ $REPLY =~ ^[Yy]$ ]] || exit 0
    # Implementation: TRUNCATE library shapes, INSERT each row from snapshot
    # Skipping detail here — implement in this phase
}
```

Wire the dispatch in the main case statement:

```bash
shapes)
    case "$2" in
        export) shapes_export ;;
        restore) shapes_restore ;;
        *) echo "Usage: $0 shapes {export|restore}" ;;
    esac
    ;;
```

Run `./dev.sh shapes export` once after the seed change is verified. Commit `services/api-gateway/shapes-snapshot.json` along with the code changes. The pre-commit hook is added in Phase 9.

**Step 4 — Build and restart.**

```bash
BINDGEN_EXTRA_CLANG_ARGS="-I/usr/lib/gcc/x86_64-linux-gnu/13/include" cargo build -p api-gateway
./dev.sh restart
```

### Verification

**Verify insert-if-not-exists:**

```bash
# Wait ~10s for startup, then check logs from the most recent restart
./dev.sh logs api-gateway | grep "Shape library seed" | tail -1
# Should show: inserted=0 skipped=85 deleted=0 total=85
# (because all 85 shapes already exist in the DB from the previous Phase 3 run)
```

**Verify the seed cannot overwrite an existing row.** This is the test for the actual decision:

```bash
# Get a library shape's current updated_at
docker exec io_dev_db psql -U io -d io_dev -At -c "
    SELECT updated_at FROM design_objects
    WHERE metadata->>'shape_id' = 'valve-control'
      AND metadata->>'source' = 'library';"
# Capture the value, e.g., 2026-04-15 12:34:56.789+00

# Manually mark a shape as "modified" to detect overwrite
docker exec io_dev_db psql -U io -d io_dev -c "
    UPDATE design_objects
    SET metadata = jsonb_set(metadata, '{display_name}', '\"MARKER_DO_NOT_OVERWRITE\"')
    WHERE metadata->>'shape_id' = 'valve-control'
      AND metadata->>'source' = 'library';"

# Restart
./dev.sh restart
# Wait ~10s

# Confirm the marker is still there
docker exec io_dev_db psql -U io -d io_dev -At -c "
    SELECT metadata->>'display_name' FROM design_objects
    WHERE metadata->>'shape_id' = 'valve-control'
      AND metadata->>'source' = 'library';"
# MUST return: MARKER_DO_NOT_OVERWRITE
# If it returns the original "Control Valve", the seed is still UPSERTing — STOP.

# Restore the original value
docker exec io_dev_db psql -U io -d io_dev -c "
    UPDATE design_objects
    SET metadata = jsonb_set(metadata, '{display_name}', '\"Control Valve\"')
    WHERE metadata->>'shape_id' = 'valve-control'
      AND metadata->>'source' = 'library';"
```

**Verify batch endpoint includes user shapes.**

If there are no user shapes in the DB, create one for testing:

```bash
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"changeme"}' | jq -r '.data.access_token')

# Insert a synthetic user shape directly (mimicking what upload_user_shape would do)
docker exec io_dev_db psql -U io -d io_dev -c "
    INSERT INTO design_objects (id, name, type, svg_data, metadata, created_at, updated_at)
    VALUES (
        gen_random_uuid(),
        'Test Custom Shape',
        'shape',
        '<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 10 10\"><rect width=\"10\" height=\"10\"/></svg>',
        '{\"shape_id\":\".custom.test001\",\"source\":\"user\",\"display_name\":\"Test Custom Shape\",\"category\":\"custom\",\"sidecar\":{\"geometry\":{\"viewBox\":\"0 0 10 10\"}}}'::jsonb,
        NOW(), NOW()
    );"

# Verify batch endpoint returns BOTH a library shape and the user shape
curl -s -X POST http://localhost:3000/api/v1/shapes/batch \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"shape_ids":["valve-control",".custom.test001"]}' \
  | jq 'keys'
# Must show both: ["valve-control", ".custom.test001"]
# (or wrapped under .data depending on ApiResponse envelope)

# Cleanup synthetic shape
docker exec io_dev_db psql -U io -d io_dev -c "
    DELETE FROM design_objects WHERE metadata->>'shape_id' = '.custom.test001';"
```

**Verify CLI export.**

```bash
./dev.sh shapes export
# Confirm file exists and has expected shape count
ls -lh services/api-gateway/shapes-snapshot.json
jq 'length' services/api-gateway/shapes-snapshot.json
# Must return 85

# Confirm deterministic ordering — run twice, expect identical output
./dev.sh shapes export && cp services/api-gateway/shapes-snapshot.json /tmp/snap1.json
./dev.sh shapes export
diff /tmp/snap1.json services/api-gateway/shapes-snapshot.json
# Must show no differences
```

### Rollback

Each item is independent and rollable individually:

1. **Seed change:** `git checkout HEAD -- services/api-gateway/src/seed_shapes.rs`, rebuild. (Reverts to the UPSERT version — accept the regression temporarily.)
2. **Batch endpoint:** `git checkout HEAD -- services/api-gateway/src/handlers/graphics.rs`, rebuild.
3. **CLI export:** `git checkout HEAD -- dev.sh` and `rm services/api-gateway/shapes-snapshot.json`.

---

## Phase 5: Wire batchFetch in SceneRenderer

### Goal
Make `SceneRenderer.tsx` use the database as the primary shape source via `POST /api/v1/shapes/batch`. Two one-line changes plus a small adapter function. Static files remain as a transient fallback (removed in Phase 10).

### Gate
Phase 4 verified complete — seed is insert-if-not-exists, batch endpoint returns both library and user shapes, and `services/api-gateway/shapes-snapshot.json` is committed. This gate is non-negotiable: the original comment at SceneRenderer line 668 was written specifically because the DB sidecars were broken; Phases 1–4 are what make the DB sidecars correct and the batch endpoint complete.

### Files to read before starting
- `/home/io/io-dev/io/frontend/src/shared/graphics/SceneRenderer.tsx` lines 640–715
- `/home/io/io-dev/io/frontend/src/shared/graphics/shapeCache.ts` — entire file
- `/home/io/io-dev/io/frontend/src/api/graphics.ts` lines 88–95 (`batchShapes` function signature)

### Implementation

In `/home/io/io-dev/io/frontend/src/shared/graphics/SceneRenderer.tsx`:

**Step 1.** Verify that `graphicsApi` is already imported. Search the file for `graphicsApi`. If not present, add the import near the other imports:
```ts
import { graphicsApi } from "@/api/graphics";
```

**Step 2.** Add `ShapeData` import to the shapeCache import line if not already there:
```ts
import { fetchShapes, type ShapeData } from "./shapeCache";
```

**Step 3.** Add the adapter as a stable `useCallback` inside the component, placed just before the shape-loading `useEffect` (around line 660):
```ts
const batchShapesFetch = useCallback(
  async (ids: string[]): Promise<Record<string, ShapeData>> => {
    const res = await graphicsApi.batchShapes(ids);
    if (!res.success) throw new Error(res.error.message);
    return res.data as unknown as Record<string, ShapeData>;
  },
  [],
);
```

**Step 4.** Change line 671 from:
```ts
    fetchShapes(baseIds)
```
to:
```ts
    fetchShapes(baseIds, batchShapesFetch)
```

**Step 5.** Change line 703 from:
```ts
        const partMap = await fetchShapes(uniquePartIds);
```
to:
```ts
        const partMap = await fetchShapes(uniquePartIds, batchShapesFetch);
```

**Step 6.** Replace the comment block at lines 668–670:
```ts
    // Always load from public static files (canonical source, always current).
    // The DB-backed batchShapes API can return stale sidecars that lack `addons`/
    // `compositeAttachments`, which breaks composable part resolution in Phase 2.
```
with:
```ts
    // Fetch shapes from DB (batch endpoint), falling back to public static files.
    // DB is the canonical source; static files are a safety fallback removed in Phase 10.
```

### Verification
```bash
cd frontend && pnpm build
```
Must succeed with zero TypeScript errors.

Then start dev server:
```bash
cd frontend && pnpm dev
```

Manual checks:
1. Open designer in browser, open or create a graphic containing at least one shape
2. DevTools → Network → filter `batch` — confirm `POST /api/v1/shapes/batch` fires with shape IDs in the request body
3. Confirm the response payload contains `addons` in the sidecar for shapes that have them (e.g., valve-control)
4. Confirm shapes render visually — no blank shapes
5. If the graphic uses a shape with composable parts (e.g., a valve with an actuator), confirm the part shape renders correctly on top of the base shape
6. Open browser console — zero errors about shape loading or missing addons
7. Verify individual `/shapes/*.json` requests are NOT fired by SceneRenderer (the palette may still fire them — that's acceptable for now)

### Rollback
Remove the `batchShapesFetch` callback and revert the two `fetchShapes(...)` calls to remove the second argument. The static-file fallback in `shapeCache.ts` is always active regardless.

---

## Phase 6: Parity Verification

### Goal
Automated confirmation that shapes render identically from DB vs static files. This becomes the regression gate for all subsequent phases.

### Gate
Phase 5 verified complete (DB rendering working).

### Files to read before starting
- `/home/io/io-dev/io/.claude/worktrees/` or `memory/reference_playwright.md` — check if Playwright MCP is available
- `/home/io/io-dev/io/frontend/src/shared/graphics/shapeCache.ts` — understand the batchFetch fallback mechanism

### Implementation

This phase creates a Playwright test suite that confirms shape rendering parity.

**Test strategy:**
1. Render a test graphic containing representative shapes (including ones with addons/composable parts)
2. Screenshot the result (DB path active)
3. Intercept `POST /api/v1/shapes/batch` to return `{}` (forcing static fallback)
4. Clear `shapeCache` (if exposed; if not, reload the page with cache busted)
5. Screenshot again (static path)
6. Pixel-diff the two screenshots — tolerance must be 0px

If Playwright MCP is available, use it to drive this interactively. If not, create a test file at `frontend/src/test/shape-parity.spec.ts` for `pnpm test` to run.

**Minimum checklist if automated test is not feasible** (manual verification):
- [ ] Open designer with a graphic containing `valve-control` — confirm actuator part shape renders (the small actuator overlay on the valve body)
- [ ] Open a graphic with `column-distillation-standard-trayed-6` — confirm the tray lines inside the column are visible
- [ ] Open a graphic with `agitator-turbine` — confirm the turbine impeller shape renders
- [ ] Open the console module — confirm shapes render in any process graphic
- [ ] Check browser console — zero errors
- [ ] Network tab: `POST /api/v1/shapes/batch` fires; response JSON has `addons` field (non-empty array) for shapes that should have addons
- [ ] Temporarily add `graphicsApi` to `window` and call `.batchShapes(['valve-control'])` in console — compare the returned sidecar against `/shapes/valves/valve-control.json` loaded in another tab — they must be identical

**If any visual difference is found:** stop, report findings, do not proceed.

### Verification
All checklist items pass. If automated test: pixel diff = 0.

### Rollback
No code changes (unless an automated test file was added — delete it if needed).

---

## Phase 7: Add Library Index API Endpoint

### Goal
Add `GET /api/v1/shapes` backend endpoint that returns the shape library catalog (id, category, label, subcategory). This mirrors the structure of `/shapes/index.json`. Required by Phase 8.

### Gate
Phase 6 verified complete (rendering parity confirmed).

### Files to read before starting
- `/home/io/io-dev/io/services/api-gateway/src/handlers/graphics.rs` lines 1290–1365 — understand how `batch_shapes` is structured; model the new handler on it
- `/home/io/io-dev/io/services/api-gateway/src/main.rs` lines 350–380 — where to add the new route
- `/home/io/io-dev/io/frontend/public/shapes/index.json` lines 1–30 — response format to match exactly

### Implementation

**Step 1.** In `services/api-gateway/src/handlers/graphics.rs`, add after the `batch_shapes` function:

```rust
// ---------------------------------------------------------------------------
// GET /api/v1/shapes — shape library catalog (mirrors /shapes/index.json)
// ---------------------------------------------------------------------------
pub async fn list_library_shapes(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> impl IntoResponse {
    if !check_permission(&claims, "process:read") && !check_permission(&claims, "console:read") {
        return IoError::Forbidden("process:read or console:read permission required".into())
            .into_response();
    }

    let rows = match sqlx::query(
        r#"
        SELECT
            metadata->>'shape_id'             AS shape_id,
            metadata->>'display_name'          AS display_name,
            metadata->>'category'              AS category,
            metadata->'sidecar'->>'subcategory' AS subcategory
        FROM design_objects
        WHERE type IN ('shape', 'shape_part')
          AND metadata->>'source' = 'library'
        ORDER BY metadata->>'category', metadata->>'shape_id'
        "#,
    )
    .fetch_all(&state.db)
    .await
    {
        Ok(r) => r,
        Err(e) => {
            tracing::error!(error = %e, "list_library_shapes query failed");
            return IoError::Database(e).into_response();
        }
    };

    let shapes: Vec<serde_json::Value> = rows
        .iter()
        .filter_map(|row| {
            let id: Option<String> = row.try_get("shape_id").ok().flatten();
            let label: Option<String> = row.try_get("display_name").ok().flatten();
            let category: Option<String> = row.try_get("category").ok().flatten();
            let subcategory: Option<String> = row.try_get("subcategory").ok().flatten();
            match (id, label, category) {
                (Some(id), Some(label), Some(category)) => Some(serde_json::json!({
                    "id": id,
                    "label": label,
                    "category": category,
                    "subcategory": subcategory,
                })),
                _ => None,
            }
        })
        .collect();

    Json(ApiResponse::ok(serde_json::json!({ "shapes": shapes }))).into_response()
}
```

**Step 2.** In `services/api-gateway/src/main.rs`, add the route near the other shapes routes (around line 357):
```rust
.route(
    "/api/v1/shapes",
    get(handlers::graphics::list_library_shapes),
)
```

**Step 3.** Build and restart:
```bash
BINDGEN_EXTRA_CLANG_ARGS="-I/usr/lib/gcc/x86_64-linux-gnu/13/include" cargo build -p api-gateway
./dev.sh restart
```

### Verification
Get an access token (login as admin/changeme) then:
```bash
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"changeme"}' | jq -r '.data.access_token')

# Count must match disk shape count (85)
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:3000/api/v1/shapes \
  | jq '.data.shapes | length'

# Sample entry must have id, label, category
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:3000/api/v1/shapes \
  | jq '.data.shapes[0]'

# Compare IDs with index.json — every ID in index.json should be in the API response
```

### Rollback
Remove the `list_library_shapes` handler function and route registration. Rebuild.

---

## Phase 8: Migrate libraryStore.ts to API

### Goal
The designer palette (`libraryStore.ts`) reads the shape catalog from `GET /api/v1/shapes` and per-shape sidecars from `POST /api/v1/shapes/batch`. No more reads from `/shapes/index.json` or `/shapes/{category}/{id}.json`.

### Gate
Phase 7 verified complete (`GET /api/v1/shapes` returns correct data matching `index.json`).

### Files to read before starting
- `/home/io/io-dev/io/frontend/src/store/designer/libraryStore.ts` — **ENTIRE FILE** (all of it)
- `/home/io/io-dev/io/frontend/src/api/graphics.ts` lines 88–95 (`batchShapes` function)

### Implementation

**Step 1.** Add `shapesIndex` to `graphicsApi` in `frontend/src/api/graphics.ts`:
```ts
/** Fetch the shape library catalog from the database */
shapesIndex: () =>
  api.get<{ shapes: Array<{ id: string; category: string; label: string; subcategory?: string }> }>(
    "/api/v1/shapes",
  ),
```

**Step 2.** Update `libraryStore.ts`:

In `fetchIndexOnce()` (around line 206), replace the `fetch("/shapes/index.json")` block with a call to `graphicsApi.shapesIndex()`. The returned data has the same structure as `index.json`: `{ shapes: [{ id, category, label, subcategory }] }`.

In `loadShape()` (around line 305), the current code fetches `/shapes/${category}/${id}.json` for the sidecar, then fetches `/shapes/${category}/${svgFilename}.svg` separately. Replace both fetches with a single call to `graphicsApi.batchShapes([id])`. The response gives `{ [id]: { svg: string, sidecar: ShapeSidecar } }`.

Key points:
- Use `response.data[id].svg` for the SVG string (same content as the static file)
- Use `response.data[id].sidecar` for the sidecar (same structure as the JSON file)
- Keep the `sidecar.options` normalization logic (converting `variants.options` Record → flat array) unchanged — DB returns the same raw structure as the JSON files
- Keep the in-flight deduplication (`shapeInFlight` map) and LRU cache logic unchanged
- Do NOT bulk-fetch; the lazy-per-shape pattern is intentional

The SVG is now returned from the batch endpoint — no separate SVG fetch needed.

**Important:** The `<img src="/shapes/...">` call sites in palette components (DesignerLeftPalette, CategoryShapeWizard, DesignerCanvas) still use static SVG files. Do NOT change those. They are handled in Phase 11.

### Verification
```bash
cd frontend && pnpm build
```
No TypeScript errors.

Manual checks:
1. Open designer → palette panel loads with all shape categories
2. Expand a category → shapes appear (thumbnails use static SVGs — that's correct)
3. DevTools Network: NO requests to `/shapes/index.json` or `/shapes/*.json` from libraryStore
4. Click a shape type to open the variant picker — variants listed correctly
5. Drag a shape onto canvas — it appears and renders correctly
6. Open console — no errors

### Rollback
Revert `libraryStore.ts` and remove `shapesIndex` from `graphicsApi`.

---

## Phase 9: Snapshot + Pre-Commit Hook

### Goal
Now that the batch endpoint and library index are confirmed working end-to-end, lock in the snapshot file as the durable record of library shape state. Re-export the snapshot to capture the verified state, install a git pre-commit hook on this dev machine that runs `./dev.sh shapes export` automatically, and document the restore flow.

This phase comes BEFORE removing static JSON files (Phase 10) so we have a known-good snapshot to restore from if anything goes wrong.

### Gate
Phases 5–8 verified complete (DB-backed rendering working end-to-end, both for SceneRenderer and the palette).

### Files to read before starting
- `/home/io/io-dev/io/dev.sh` — verify `shapes export` and `shapes restore` from Phase 4 still work
- `/home/io/io-dev/io/.git/hooks/` — list existing hooks; check if a pre-commit already exists (chain it if so)

### Implementation

**Step 1 — Re-run snapshot export.**

```bash
./dev.sh shapes export
git status services/api-gateway/shapes-snapshot.json
# If diff vs the Phase 4 commit, review and commit
```

The diff (if any) likely captures shapes touched by sidecar fixes during Phases 5–8 manual verification.

**Step 2 — Install the pre-commit hook.**

Create `.git/hooks/pre-commit` (or extend it if it already exists). The hook should:

1. Detect if the dev environment is up (skip if `psql` cannot reach the DB — this is a dev machine convenience hook, not a CI gate)
2. Run `./dev.sh shapes export`
3. Add the resulting `services/api-gateway/shapes-snapshot.json` to the index if changed

```bash
#!/usr/bin/env bash
# pre-commit: refresh shapes-snapshot.json so the file in git always reflects current DB state.
# Skips silently if the DB is not reachable (dev environment is down).

set -e

if ! docker exec io_dev_db psql -U io -d io_dev -c '\q' >/dev/null 2>&1; then
    # Dev DB not running — skip hook
    exit 0
fi

./dev.sh shapes export >/dev/null
if ! git diff --quiet services/api-gateway/shapes-snapshot.json; then
    git add services/api-gateway/shapes-snapshot.json
    echo "[pre-commit] shapes-snapshot.json refreshed and staged"
fi

exit 0
```

```bash
chmod +x .git/hooks/pre-commit
```

> Note: this is local-machine-only. It does not check into the repo (hooks aren't tracked). If a second developer joins, they'd need to install their own copy. Consider adding the hook script under `scripts/git-hooks/pre-commit` and a one-line README on installing it; but for now the user works alone on this dev box, so a local hook is sufficient.

**Step 3 — Document restore.**

Add a one-line note to the top of `services/api-gateway/shapes-snapshot.json` is not possible (it's pure JSON), so document the restore command in `docs/architecture/shape-system.md` (already present in the doc — verify the section is accurate).

### Verification

**Snapshot integrity:**
```bash
./dev.sh shapes export
jq 'length' services/api-gateway/shapes-snapshot.json
# Must return 85

# Confirm every shape has the required fields
jq 'all(has("shape_id") and has("svg_data") and has("metadata"))' services/api-gateway/shapes-snapshot.json
# Must return true
```

**Hook fires on commit:**
```bash
# Make a trivial change and commit
echo "// test" >> /tmp/dummy.txt
cd /home/io/io-dev/io
git add docs/plans/mainplan.md   # or some other file
git commit -m "test: pre-commit hook" --allow-empty
# Hook output should appear; if shapes-snapshot.json was stale it should be re-staged
git reset HEAD~1   # undo the test commit
```

**Restore round-trips:**
```bash
# Snapshot the current state
./dev.sh shapes export
cp services/api-gateway/shapes-snapshot.json /tmp/snap-before.json

# Modify a shape directly
docker exec io_dev_db psql -U io -d io_dev -c "
    UPDATE design_objects
    SET metadata = jsonb_set(metadata, '{display_name}', '\"CORRUPTED\"')
    WHERE metadata->>'shape_id' = 'valve-gate'
      AND metadata->>'source' = 'library';"

# Restore
./dev.sh shapes restore  # Confirm 'y'

# Verify the modification was reverted
docker exec io_dev_db psql -U io -d io_dev -At -c "
    SELECT metadata->>'display_name' FROM design_objects
    WHERE metadata->>'shape_id' = 'valve-gate'
      AND metadata->>'source' = 'library';"
# Must NOT be 'CORRUPTED' — must be the original display name from the snapshot
```

### Rollback
- Remove `.git/hooks/pre-commit` (or remove the shapes-export block from it if you chained onto an existing hook)
- `git checkout HEAD -- services/api-gateway/shapes-snapshot.json` to revert to the previous committed snapshot

---

## Phase 10: Remove Static JSON Files from Web Bundle

### Goal
Delete `frontend/public/shapes/**/*.json` and `index.json` so they are no longer served to browsers. Keep all SVG files (still needed for `<img src>` palette thumbnails). Update `shapeCache.ts` to remove the dead static-file fallback for sidecar loading (it can no longer work without JSON files).

### Gate
Phases 7, 8, and 9 all verified complete. Confirm no remaining static JSON reads:
```bash
grep -rn '\.json' /home/io/io-dev/io/frontend/src/ \
  | grep '/shapes/' \
  | grep -v '\.svg' \
  | grep -v 'node_modules'
```
Must return zero results.

Also confirm the snapshot is in good shape:
```bash
jq 'length' /home/io/io-dev/io/services/api-gateway/shapes-snapshot.json
# Must equal the count of library shapes in the DB
```

### Files to read before starting
- `/home/io/io-dev/io/frontend/src/shared/graphics/shapeCache.ts` — full file
- `/home/io/io-dev/io/frontend/src/store/designer/libraryStore.ts` — verify no remaining `/shapes/*.json` reads

### Implementation

**Step 1.** Delete all JSON shape files:
```bash
find /home/io/io-dev/io/frontend/public/shapes -name "*.json" -delete
```
This removes all sidecar JSONs and `index.json`. The SVG files remain.

**Step 2.** Update `shapeCache.ts`.

Remove the `getShapeIndex` function and `shapeIndexPromise` module-level variable (they read `/shapes/index.json`).

Remove the `fetchShapesFromPublic` function (it reads both JSON sidecars and SVGs from static files; without the JSON files it cannot construct a `ShapeData` response).

Update `fetchShapes` to remove the static fallback path. The simplified function:

```ts
export async function fetchShapes(
  shapeIds: string[],
  batchFetch?: (ids: string[]) => Promise<Record<string, ShapeData>>,
): Promise<Map<string, ShapeData>> {
  const result = new Map<string, ShapeData>();
  const missing: string[] = [];

  for (const id of shapeIds) {
    const cached = shapeCache.get(id);
    if (cached) {
      result.set(id, cached);
    } else {
      missing.push(id);
    }
  }

  if (missing.length > 0 && batchFetch) {
    try {
      const fetched = await batchFetch(missing);
      for (const [id, data] of Object.entries(fetched)) {
        shapeCache.set(id, data);
        result.set(id, data);
      }
    } catch (e) {
      console.error("[shapeCache] batchFetch failed:", e);
      // Missing shapes will not be in result; callers render nothing for them
    }
  }

  return result;
}
```

Also remove the exports for `fetchShapesFromPublic` and `getShapeIndex` (or just delete the functions — check if anything imports them and update those imports).

### Verification
```bash
cd frontend && pnpm build
```
No TypeScript errors.

```bash
# Confirm no JSON files remain in public/shapes (only SVGs)
find /home/io/io-dev/io/frontend/public/shapes -name "*.json" | wc -l
# Must be 0

# Confirm SVG files still present
find /home/io/io-dev/io/frontend/public/shapes -name "*.svg" | wc -l
# Should be ~85+
```

Manual checks:
1. Open designer with shapes → renders correctly
2. Open palette → loads correctly, thumbnails visible (using static SVGs)
3. DevTools Network: zero requests to `/shapes/*.json`
4. All SVG images in palette still load (requests to `/shapes/*.svg` are expected and correct)
5. Browser console: no errors

### Rollback
```bash
git checkout HEAD -- frontend/public/shapes/
git checkout HEAD -- frontend/src/shared/graphics/shapeCache.ts
```

---

## Phase 11: Replace Static SVG Thumbnails with Blob URLs

### Goal
Eliminate the last 5 `<img src="/shapes/...">` call sites so no shape files are read from
`frontend/public/shapes/` at runtime. Replace each with a component that converts the SVG
string (already loaded by `libraryStore`) into a blob URL and renders it as a normal `<img>`.
After this phase, `frontend/public/shapes/` can be deleted entirely.

### Gate
Phase 8 verified complete — `libraryStore` loads shape SVG and sidecar from the API.
The shape SVG string is available in `libraryStore.cache.get(id)?.svg`.

### Files to read before starting
- `/home/io/io-dev/io/frontend/src/pages/designer/DesignerLeftPalette.tsx` lines 860–1060
  (the `EquipmentCategoryTile` component; understand `id`, `defaultId`, `label` props)
- `/home/io/io-dev/io/frontend/src/pages/designer/components/CategoryShapeWizard.tsx` lines 150–300
  (the `ShapeCard` and `AddonThumbnailCard` components; understand `category`, `shapeId`, `file` vars)
- `/home/io/io-dev/io/frontend/src/pages/designer/DesignerCanvas.tsx` lines 9070–9110
  (the ghost placement img at line 9089; understand `ghostPlacement` and the drag ghost structure)
- `/home/io/io-dev/io/frontend/src/store/designer/libraryStore.ts` — confirm `cache.get(id)?.svg`
  is the SVG string and `loadShape(id)` triggers the load

### Approach

Convert SVG string → `Blob` → object URL → `<img src={blobUrl}>`. SVGs loaded via `<img>` are
sandboxed by the browser (scripts inside cannot execute), so this is safe. No sanitization
library needed. Blob URLs are revoked on unmount to avoid memory leaks.

Create `frontend/src/pages/designer/components/ShapeThumbnail.tsx`:

```tsx
import { useEffect, useMemo } from "react";
import { useLibraryStore } from "@/store/designer/libraryStore";

interface ShapeThumbnailProps {
  shapeId: string;
  size?: number;
  style?: React.CSSProperties;
}

export function ShapeThumbnail({ shapeId, size = 40, style }: ShapeThumbnailProps) {
  const entry = useLibraryStore((s) => s.cache.get(shapeId));
  const loadShape = useLibraryStore((s) => s.loadShape);

  useEffect(() => {
    if (!entry) loadShape(shapeId);
  }, [shapeId, entry, loadShape]);

  const blobUrl = useMemo(() => {
    if (!entry?.svg) return null;
    const blob = new Blob([entry.svg], { type: "image/svg+xml" });
    return URL.createObjectURL(blob);
  }, [entry?.svg]);

  useEffect(() => {
    return () => {
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [blobUrl]);

  if (!blobUrl) {
    return <div style={{ width: size, height: size, flexShrink: 0, ...style }} />;
  }

  return (
    <img
      src={blobUrl}
      alt=""
      style={{ width: size, height: size, objectFit: "contain", flexShrink: 0, ...style }}
    />
  );
}
```

### Implementation

Replace each of the 5 call sites with `<ShapeThumbnail>`:

**1. `DesignerLeftPalette.tsx:990`** (collapsed tile):
Replace `<img src={...} style={{ maxWidth: 28, maxHeight: 28 }} onError={...} />`
with `<ShapeThumbnail shapeId={defaultId} size={28} />`

**2. `DesignerLeftPalette.tsx:1040`** (expanded tile):
Replace `<img src={...} style={{ maxWidth: 48, maxHeight: 40 }} onError={...} />`
with `<ShapeThumbnail shapeId={defaultId} size={44} />`

**3. `CategoryShapeWizard.tsx:204`** (shape card):
Replace `<img src={`/shapes/${category}/${shapeId}.svg`} style={{ maxWidth: 52, maxHeight: 52 }} onError={...} />`
with `<ShapeThumbnail shapeId={shapeId} size={52} />`

**4. `CategoryShapeWizard.tsx:281`** (addon card):
The `file` variable is a raw SVG filename from the sidecar addons array (e.g. `"part-actuator-diaphragm.svg"`).
The shape ID is the file stem:
Replace `<img src={`/shapes/${addonCategory}/${file}`} style={{ maxWidth: 52, maxHeight: 52 }} onError={...} />`
with `<ShapeThumbnail shapeId={file.replace(/\.svg$/, "")} size={52} />`

**5. `DesignerCanvas.tsx:9089`** (drag ghost):
Read the surrounding context carefully — the ghost may be an imperatively-created DOM element
rather than React JSX. If so, get the SVG string from the store directly and create a blob URL
in the drag handler:
```ts
const svgStr = useLibraryStore.getState().cache.get(ghostPlacement.shapeId)?.svg;
if (svgStr) {
  const blob = new Blob([svgStr], { type: "image/svg+xml" });
  const url = URL.createObjectURL(blob);
  imgEl.src = url;
  // revoke after drag ends
}
```
If it is React JSX, use `<ShapeThumbnail shapeId={ghostPlacement.shapeId} size={48} />`.

### After all 5 replacements: delete shape files from the web bundle

Delete only the files that Vite serves to browsers. Keep the directory and files on disk — they are
still needed by `build.rs` at compile time (it panics if the directory is missing) and as the
authoring source for new library shapes.

```bash
# Remove JSON files from the web bundle only — SVGs were already removed in Phase 10.
# The actual files stay in the repo; we exclude them from Vite's public dir.
```

**Vite exclusion approach:** Rather than deleting files, add a Vite config that excludes
`public/shapes/` from the dev server and production build. In `frontend/vite.config.ts`,
the `publicDir` option controls what Vite copies to the build output. Options:

1. **Move shapes out of `public/`** — rename `frontend/public/shapes/` to `frontend/shapes-source/`
   and update `build.rs` to read from the new path. Nothing in `public/` = nothing served.
2. **Custom Vite plugin** — a small plugin that filters `public/shapes/` from the copy step.

Option 1 is simpler and makes the intent explicit: shape source files live in `frontend/shapes-source/`,
the web bundle has no shape files, and `build.rs` reads from the new location.

Update `build.rs` line 7 to point to the new path:
```rust
let shapes_root = Path::new(&manifest_dir).join("../../frontend/shapes-source");
```

Rename the directory:
```bash
mv /home/io/io-dev/io/frontend/public/shapes /home/io/io-dev/io/frontend/shapes-source
```

After this:
- `build.rs` still works (reads from `frontend/shapes-source/`)
- Vite serves nothing under `/shapes/` (directory gone from `public/`)
- Shape authoring workflow is unchanged (edit files in `shapes-source/`, rebuild)
- `./dev.sh shapes import` still works for pushing to DB on existing deployments

### Verification
```bash
cd frontend && pnpm build
# Must succeed with no TypeScript errors

# Confirm shapes-source exists and has files (build.rs reads from here)
find /home/io/io-dev/io/frontend/shapes-source -name "*.json" | wc -l
# Should be 85+

# Confirm public/shapes is gone (nothing served to browsers)
ls /home/io/io-dev/io/frontend/public/shapes 2>&1
# Should error: No such file or directory

# Confirm build.rs still works
BINDGEN_EXTRA_CLANG_ARGS="-I/usr/lib/gcc/x86_64-linux-gnu/13/include" cargo build -p api-gateway 2>&1 | grep "warning=Shape seeds"
# Must output: warning: Shape seeds generated: 85
```

Manual checks:
1. Open designer palette — all category tiles show shape thumbnails (blob URL images)
2. Click a category — shape grid populates with thumbnails
3. Click a shape with addons (e.g., valve-control) — addon thumbnails appear in the wizard
4. Drag a shape onto canvas — ghost appears and shape renders on drop
5. DevTools Network — zero requests to `/shapes/` path at all
6. Browser console — no errors

### Rollback
```bash
mv /home/io/io-dev/io/frontend/shapes-source /home/io/io-dev/io/frontend/public/shapes
# Revert build.rs path change
git checkout HEAD -- services/api-gateway/build.rs
git checkout HEAD -- frontend/src/pages/designer/DesignerLeftPalette.tsx
git checkout HEAD -- frontend/src/pages/designer/components/CategoryShapeWizard.tsx
git checkout HEAD -- frontend/src/pages/designer/DesignerCanvas.tsx
```
Delete `ShapeThumbnail.tsx` if created.

---

## Phase 12: Cache Hardening and Stale-Data Fixes

### Goal
Fix the stale-cache bug for user-uploaded custom shapes (a real bug independent of this
migration), add ETag support to the batch endpoint for efficient repeat fetches, and add
unit test coverage for the batchFetch adapter.

### Gate
Phases 1–11 all verified complete. The full migration must be stable before layering hardening on top.

### Files to read before starting
- `/home/io/io-dev/io/frontend/src/shared/graphics/shapeCache.ts` — the LRU `shapeCache` object
- `/home/io/io-dev/io/frontend/src/api/graphics.ts` — `reimportShapeSvg` (around line 162) and
  `deleteUserShape` (around line 277)
- `/home/io/io-dev/io/services/api-gateway/src/handlers/graphics.rs` lines 1305–1362 — the
  `batch_shapes` handler where ETag support is added
- `/home/io/io-dev/io/frontend/src/shared/graphics/SceneRenderer.tsx` — find the
  `batchShapesFetch` adapter added in Phase 5

### Implementation

#### Item 1 — Fix stale cache on user shape re-import

When `reimportShapeSvg` succeeds, evict the shape from cache so the next render fetches fresh data.

In `shapeCache.ts`, add a `delete` method to the `shapeCache` object:
```ts
delete(shapeId: string): void {
  cache.delete(shapeId);
},
```

In `graphics.ts`, update `reimportShapeSvg` to call `shapeCache.delete(shapeId)` on success.
Also call `shapeCache.clear()` after `deleteUserShape` succeeds (user shapes don't have a
predictable cache key at the API layer, so clearing all is safest).

Import `shapeCache` from `@/shared/graphics/shapeCache` in `graphics.ts`.

#### Item 2 — ETag on batch shapes endpoint

In `services/api-gateway/src/handlers/graphics.rs`, in the `batch_shapes` handler:
1. Serialize the result map to a string
2. Hash it (use `std::collections::hash_map::DefaultHasher` — no extra dependency needed)
3. Check the incoming `If-None-Match` header; return `304 Not Modified` if it matches
4. Return `200` with `ETag` and `Cache-Control: private, max-age=300` headers otherwise

Read the handler in full before implementing to understand how responses are currently returned,
then add the header layer without changing the response body structure.

#### Item 3 — Unit tests for shapeCache

Create `frontend/src/shared/graphics/shapeCache.test.ts` with tests for:
- `fetchShapes` with successful `batchFetch` — cache populated, result returned correctly
- `fetchShapes` with `batchFetch` that throws — empty map returned, no crash
- `fetchShapes` with all IDs already cached — `batchFetch` never called
- LRU eviction: inserting 201 entries evicts the oldest

### Verification

**Item 1:**
1. Upload a custom shape SVG
2. Open a graphic using that shape — confirm it renders
3. Re-import the shape with a visibly different SVG (e.g., add a solid colored rect)
4. Without reloading the page, open the same graphic again — the updated SVG must appear immediately

**Item 2:**
```bash
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"changeme"}' | jq -r '.data.access_token')

# First request — must return ETag header
ETAG=$(curl -si -H "Authorization: Bearer $TOKEN" \
  -X POST http://localhost:3000/api/v1/shapes/batch \
  -H "Content-Type: application/json" \
  -d '{"shape_ids":["valve-gate"]}' | grep -i etag | awk '{print $2}' | tr -d '\r')
echo "ETag: $ETAG"

# Second request with matching ETag — must return 304
curl -si -H "Authorization: Bearer $TOKEN" \
  -X POST http://localhost:3000/api/v1/shapes/batch \
  -H "Content-Type: application/json" \
  -H "If-None-Match: $ETAG" \
  -d '{"shape_ids":["valve-gate"]}' | head -1
# Must show: HTTP/1.1 304 Not Modified
```

**Item 3:**
```bash
cd frontend && pnpm test -- shapeCache
# All tests pass
```

### Rollback
Each item is independent. Revert individual files with `git checkout HEAD -- <file>`.

---

## Phase 13: Architecture Review and Sidecar Alignment

### Goal
Have Opus review all shape implementation changes made in the preceding phases, verify alignment with docs/architecture/shape-system.md, identify any gaps or drift, and produce an updated version of docs/tasks/research/sidecars-db-source-of-truth.md that accurately reflects the shape implementation as built — so that when the sidecar planning phase begins, it starts from correct assumptions.

### Gate
All preceding phases verified complete.

### Implementation
Launch: `claude --model claude-opus-4-7 --agent audit-orchestrator` with prompt:
"Read docs/architecture/shape-system.md, docs/decisions/shape-storage-architecture.md, docs/plans/mainplan.md, and docs/tasks/research/sidecars-db-source-of-truth.md in full. Then audit the actual implementation against docs/architecture/shape-system.md — check seed_shapes.rs, build.rs, handlers/graphics.rs batch_shapes, shapeCache.ts, libraryStore.ts, SceneRenderer.tsx shape loading. Produce: (1) a gap list of anything in the architecture doc that isn't implemented, (2) an updated docs/tasks/research/sidecars-db-source-of-truth.md that corrects all references to old file/binary-based shape architecture and aligns the sidecar research plan with how shapes actually work now."

### Verification
docs/tasks/research/sidecars-db-source-of-truth.md updated and accurate.
No gaps between architecture doc and implementation.

### Rollback
N/A — documentation only.

---

## Appendix: File Reference

| Purpose | File |
|---------|------|
| Architectural decision | `docs/decisions/shape-storage-architecture.md` |
| Architectural contract | `docs/architecture/shape-system.md` |
| Build script (Phase 1, DONE) | `services/api-gateway/build.rs` |
| Shape seed (Phase 3 done; Phase 4 fixes UPSERT regression) | `services/api-gateway/src/seed_shapes.rs` |
| Batch shapes handler (Phase 4 fixes user-shape filter; Phase 12 adds ETag) | `services/api-gateway/src/handlers/graphics.rs:1305` |
| Library catalog handler (Phase 7) | `services/api-gateway/src/handlers/graphics.rs` (added) |
| Route registration | `services/api-gateway/src/main.rs:357` |
| SceneRenderer call sites (Phase 5) | `frontend/src/shared/graphics/SceneRenderer.tsx:671,703` |
| Shape cache (Phases 10, 12) | `frontend/src/shared/graphics/shapeCache.ts` |
| Library palette store (Phase 8) | `frontend/src/store/designer/libraryStore.ts` |
| API client for shapes | `frontend/src/api/graphics.ts:88-95` |
| Shape source files (moved in Phase 11) | `frontend/shapes-source/` (was `frontend/public/shapes/`) |
| img src call sites (Phase 11) | `DesignerLeftPalette.tsx:990,1040`, `CategoryShapeWizard.tsx:204,281`, `DesignerCanvas.tsx:9089` |
| ShapeThumbnail component (Phase 11) | `frontend/src/pages/designer/components/ShapeThumbnail.tsx` |
| Snapshot file (Phase 4 creates, Phase 9 hooks) | `services/api-gateway/shapes-snapshot.json` |
| CLI commands (Phase 4) | `dev.sh` (`shapes export`, `shapes restore`) |
| Pre-commit hook (Phase 9) | `.git/hooks/pre-commit` (local-only, not in repo) |
