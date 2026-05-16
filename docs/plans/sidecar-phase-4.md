Implement Phase 4 of the sidecar architecture plan. Read this file completely before writing any code.

---

## Context

The iographic thin export currently records `shape_dependencies` (list of shape_id strings)
in the manifest but no content hashes. Adding `sidecar_hash` + `svg_hash` per shape allows
any recipient to detect staleness — if their DB version of a shape doesn't match the hash,
they know the graphic was built with a different shape version. This phase adds hashes to the
thin export manifest and updates `analyze_iographic` to report hash match status. No import
behavior changes in this phase — import changes come in Phase 5.

Depends on: Phase 2 (content hashing infrastructure) must be complete.

---

## Key Files

- **MODIFY:** `services/api-gateway/src/handlers/iographic.rs`
  - Add `ShapeHashEntry` struct
  - Add `shape_hashes` field to `IographicManifest`
  - Add `export_mode` field to `IographicManifest`
  - Update `export_graphic` to populate `shape_hashes`
  - Update `analyze_iographic` to compare hashes and report `hash_status`

Read `iographic.rs` fully before starting. Key locations:
- `IographicManifest` struct — around line 53
- `export_graphic` function — around line 839; `shape_dependencies` built around line 1168
- `analyze_iographic` function — around line 1914; `ShapeStatus` struct around line 1690
- Shape lookup query in `analyze_iographic` — around line 1918

---

## Implementation Steps

### Step 1 — Add `ShapeHashEntry` struct

After the `IographicShapeEntry` struct definition, add:

```rust
/// Per-shape content hashes for staleness detection.
#[derive(Debug, Serialize, Deserialize, Default, Clone)]
pub struct ShapeHashEntry {
    pub shape_id: String,
    pub sidecar_hash: String,
    pub svg_hash: String,
}
```

### Step 2 — Update `IographicManifest`

Add two new fields to `IographicManifest`. Both must be `#[serde(default)]` for backward
compatibility with old iographic files that lack these fields:

```rust
/// "thin" (default) or "full". Full exports embed complete shape data.
#[serde(default = "default_thin_mode")]
pub export_mode: String,

/// Per-shape content hashes. Present in both thin and full exports.
#[serde(default)]
pub shape_hashes: Vec<ShapeHashEntry>,
```

Add the default function:
```rust
fn default_thin_mode() -> String {
    "thin".to_string()
}
```

### Step 3 — Populate `shape_hashes` in `export_graphic`

After the `shape_dependencies` list is built and before the manifest is constructed, add
a query that fetches hashes for all dependent shapes:

```rust
let shape_hashes: Vec<ShapeHashEntry> = if !shape_dependencies.is_empty() {
    match sqlx::query(
        r#"
        SELECT metadata->>'shape_id'    AS shape_id,
               metadata->>'sidecar_hash' AS sidecar_hash,
               metadata->>'svg_hash'     AS svg_hash
        FROM design_objects
        WHERE metadata->>'shape_id' = ANY($1)
          AND type IN ('shape', 'shape_part')
        "#,
    )
    .bind(&shape_dependencies)
    .fetch_all(&state.db)
    .await
    {
        Ok(rows) => rows
            .iter()
            .filter_map(|row| {
                let sid: Option<String> = row.try_get("shape_id").ok().flatten();
                let sh: Option<String>  = row.try_get("sidecar_hash").ok().flatten();
                let svh: Option<String> = row.try_get("svg_hash").ok().flatten();
                Some(ShapeHashEntry {
                    shape_id:     sid?,
                    sidecar_hash: sh.unwrap_or_default(),
                    svg_hash:     svh.unwrap_or_default(),
                })
            })
            .collect(),
        Err(e) => {
            tracing::warn!(error = %e, "export_graphic: failed to fetch shape hashes");
            vec![]
        }
    }
} else {
    vec![]
};
```

Wire `shape_hashes` and `export_mode: "thin".to_string()` into the manifest construction.

### Step 4 — Update `ShapeStatus` in `analyze_iographic`

Find the `ShapeStatus` struct. Add a `hash_status` field:

```rust
#[derive(Serialize)]
struct ShapeStatus {
    shape_id: String,
    status: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    hash_status: Option<String>,
    // ... existing fields
}
```

Values: `"match"`, `"mismatch"`, `"no_hash"`, `"not_checked"`.

### Step 5 — Compare hashes in `analyze_iographic` shape loop

In the shape availability loop, update the shape lookup query to also select hash fields:

```sql
SELECT id,
       metadata->>'sidecar_hash' AS sidecar_hash,
       metadata->>'svg_hash'     AS svg_hash
FROM design_objects
WHERE type IN ('shape', 'shape_part')
  AND metadata->>'shape_id' = $1
LIMIT 1
```

After getting the DB row, compare against the manifest hash entry:

```rust
let manifest_hash = manifest.shape_hashes.iter()
    .find(|h| h.shape_id == *shape_id);

let hash_status = match (manifest_hash, &db_row) {
    (Some(mh), Some(row)) if !mh.sidecar_hash.is_empty() => {
        let db_sh: String  = row.try_get("sidecar_hash").unwrap_or_default();
        let db_svh: String = row.try_get("svg_hash").unwrap_or_default();
        if db_sh == mh.sidecar_hash && db_svh == mh.svg_hash {
            Some("match".to_string())
        } else {
            Some("mismatch".to_string())
        }
    }
    (Some(_), Some(_)) => Some("no_hash".to_string()),
    _ => Some("not_checked".to_string()),
};
```

Include `hash_status` in the `ShapeStatus` struct construction.

---

## Cargo.toml / Package Changes

None.

---

## DB / Migration Changes

None.

---

## Verification

```bash
cd /home/io/io-dev/io

# 1. Build
BINDGEN_EXTRA_CLANG_ARGS="-I/usr/lib/gcc/x86_64-linux-gnu/13/include" cargo build -p api-gateway

# 2. Tests
cargo test -p api-gateway

# 3. Export test — start services, export an existing graphic
./dev.sh start
# Export via API: POST /api/v1/design-objects/{id}/export/iographic
# Unzip the .iographic file, inspect manifest.json:
# unzip -p exported.iographic manifest.json | python3 -m json.tool | grep -A5 shape_hashes
# Should show shape_hashes array with non-empty sidecar_hash and svg_hash values

# 4. Analyze test
# POST /api/v1/design-objects/import/iographic/analyze with the exported file
# Response should include hash_status: "match" for all shapes (same system export/analyze)

# 5. Backward compat: import a pre-Phase-4 iographic file (no shape_hashes field)
# Should import without error (serde default fills empty vec)

# 6. Frontend build
cd frontend && pnpm build
```

---

## Definition of Done

- [ ] `ShapeHashEntry` struct added to `iographic.rs`
- [ ] `IographicManifest` includes `shape_hashes: Vec<ShapeHashEntry>` with `#[serde(default)]`
- [ ] `IographicManifest` includes `export_mode: String` with `#[serde(default)]`
- [ ] `export_graphic` fetches hashes from DB and populates `shape_hashes`
- [ ] `export_graphic` sets `export_mode: "thin"` in manifest
- [ ] `analyze_iographic` compares manifest hashes against DB and reports `hash_status`
- [ ] Old iographic files (no `shape_hashes`) import without error
- [ ] `cargo build -p api-gateway` succeeds
- [ ] `cargo test -p api-gateway` passes
