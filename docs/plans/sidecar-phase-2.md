Implement Phase 2 of the sidecar architecture plan. Read this file completely before writing any code.

---

## Context

Content hashing enables staleness detection for iographic export/import. Two hashes are
computed per shape: `sidecar_hash` (SHA-256 of RFC 8785 canonical JSON of the sidecar)
and `svg_hash` (SHA-256 of LF-normalized SVG bytes). Both stored in
`design_objects.metadata` as top-level keys alongside `sidecar`, `shape_id`, etc.

The `sha2` crate (v0.10) is already in the workspace and api-gateway's `Cargo.toml`.
No new crate needed for hashing. RFC 8785 canonicalization is implemented by converting
`serde_json::Value` through `BTreeMap` recursively — no external crate needed.

Depends on: Phase 1 (schema fix) must be complete.

---

## Key Files

- **CREATE:** `services/api-gateway/src/shape_hash.rs` — new module with hash and validation utilities
- **MODIFY:** `services/api-gateway/src/main.rs` — register new module
- **MODIFY:** `services/api-gateway/src/seed_shapes.rs` — compute and store hashes on seed
- **MODIFY:** `services/api-gateway/src/handlers/graphics.rs` — return hashes from batch_shapes; store hashes on upload/reimport
- **MODIFY:** `dev.sh` — compute hashes in `shapes_import()` function (around line 307)
- **CREATE:** `migrations/20260511000001_shape_content_hashes_backfill.up.sql`
- **CREATE:** `migrations/20260511000001_shape_content_hashes_backfill.down.sql`

---

## Implementation Steps

Read the files listed above before starting. Key facts confirmed by code review:
- `seed_shapes.rs` uses `ON CONFLICT DO NOTHING` at the conflict target `(metadata->>'shape_id')` for library shapes — this will be changed to `DO UPDATE` to backfill hashes on existing rows.
- `batch_shapes` in `graphics.rs` currently returns `{ "svg": ..., "sidecar": ... }` per shape — we add `sidecar_hash` and `svg_hash`.
- `iographic.rs` already imports `sha2::{Digest, Sha256}` (line 13) — confirmed available.
- `dev.sh shapes_import()` builds metadata via `jq` and does a full `DO UPDATE SET metadata = EXCLUDED.metadata` — adding hashes to the `jq` construction is sufficient.

### Step 1 — Create `services/api-gateway/src/shape_hash.rs`

```rust
use sha2::{Digest, Sha256};
use serde_json::Value as JsonValue;
use std::collections::BTreeMap;

/// SHA-256 of RFC 8785 canonical JSON (keys sorted recursively, no whitespace).
/// Returns lowercase hex string (64 chars).
pub fn sidecar_hash(sidecar: &JsonValue) -> String {
    let canonical = canonicalize_json(sidecar);
    let s = serde_json::to_string(&canonical).unwrap_or_default();
    sha256_hex(s.as_bytes())
}

/// SHA-256 of SVG bytes with line endings normalized to LF.
/// Returns lowercase hex string (64 chars).
pub fn svg_hash(svg: &str) -> String {
    let normalized = svg.replace("\r\n", "\n").replace('\r', "\n");
    sha256_hex(normalized.as_bytes())
}

fn sha256_hex(data: &[u8]) -> String {
    let mut hasher = Sha256::new();
    hasher.update(data);
    let result = hasher.finalize();
    result.iter().map(|b| format!("{:02x}", b)).collect()
}

/// Recursively convert to canonical form: objects become sorted BTreeMap.
fn canonicalize_json(val: &JsonValue) -> JsonValue {
    match val {
        JsonValue::Object(map) => {
            let sorted: BTreeMap<String, JsonValue> = map
                .iter()
                .map(|(k, v)| (k.clone(), canonicalize_json(v)))
                .collect();
            serde_json::to_value(sorted).unwrap_or(JsonValue::Null)
        }
        JsonValue::Array(arr) => {
            JsonValue::Array(arr.iter().map(canonicalize_json).collect())
        }
        other => other.clone(),
    }
}
```

### Step 2 — Register in `main.rs`

In `services/api-gateway/src/main.rs`, find the `mod seed_shapes;` line and add after it:
```rust
mod shape_hash;
```

### Step 3 — Update `seed_shapes.rs`

**3a.** Add import at the top:
```rust
use crate::shape_hash;
```

**3b.** After the sidecar JSON is parsed (find where `sidecar_value` is constructed from the embedded string), add:
```rust
let computed_sidecar_hash = shape_hash::sidecar_hash(&sidecar_value);
let computed_svg_hash = shape_hash::svg_hash(s.svg_data);
```

**3c.** Add `sidecar_hash` and `svg_hash` to the metadata JSON:
```rust
let metadata = serde_json::json!({
    "shape_id": s.shape_id,
    "source": "library",
    "display_name": &display_name,
    "category": s.category,
    "view_box": &view_box,
    "schema": "io-shape-v1",
    "sidecar": sidecar_value,
    "sidecar_hash": computed_sidecar_hash,
    "svg_hash": computed_svg_hash
});
```

**3d.** Change the `ON CONFLICT DO NOTHING` to `DO UPDATE` that backfills hashes on existing
rows. The new conflict handling should:
- On conflict: only update metadata hash fields when they are missing or changed (to stay idempotent)
- Leave all other metadata fields unchanged on conflict (we're adding hashes, not overwriting sidecar)

Change the conflict clause to:
```sql
ON CONFLICT ((metadata->>'shape_id'))
    WHERE type IN ('shape', 'shape_part') AND metadata->>'source' = 'library'
DO UPDATE SET
    metadata = design_objects.metadata
              || jsonb_build_object('sidecar_hash', $5::text, 'svg_hash', $6::text),
    updated_at = NOW()
WHERE design_objects.metadata->>'sidecar_hash' IS NULL
   OR design_objects.metadata->>'sidecar_hash' != $5
```
Bind `computed_sidecar_hash` as `$5` and `computed_svg_hash` as `$6`. Adjust `$N` indices to match the actual parameter order in the query.

### Step 4 — Update `batch_shapes` in `graphics.rs`

Find the `batch_shapes` function. It currently builds a result map entry like:
```rust
result.insert(sid, serde_json::json!({
    "svg": svg,
    "sidecar": sidecar,
}));
```

Extract hashes from metadata and include them:
```rust
let sidecar_hash_val = metadata.as_ref()
    .and_then(|m| m.get("sidecar_hash"))
    .and_then(|v| v.as_str())
    .unwrap_or("");
let svg_hash_val = metadata.as_ref()
    .and_then(|m| m.get("svg_hash"))
    .and_then(|v| v.as_str())
    .unwrap_or("");
result.insert(sid, serde_json::json!({
    "svg": svg,
    "sidecar": sidecar,
    "sidecar_hash": sidecar_hash_val,
    "svg_hash": svg_hash_val,
}));
```

### Step 5 — Compute hashes in `upload_user_shape`

In the `upload_user_shape` handler, after the sidecar JSON value is constructed and before
the INSERT, compute hashes and add them to the metadata:
```rust
let computed_sidecar_hash = crate::shape_hash::sidecar_hash(&sidecar_json_value);
let computed_svg_hash = crate::shape_hash::svg_hash(&svg_string);
```
Add `"sidecar_hash": computed_sidecar_hash, "svg_hash": computed_svg_hash` to the metadata JSON.

### Step 6 — Compute `svg_hash` in `reimport_shape_svg`

In the `reimport_shape_svg` handler, after the new SVG content is validated and before
the UPDATE query, compute:
```rust
let new_svg_hash = crate::shape_hash::svg_hash(&body.svg_content);
```
Update the UPDATE SQL to also set `svg_hash` in metadata:
```sql
metadata = jsonb_set(
    jsonb_set(
        jsonb_set(metadata, '{sidecar,geometry,viewBox}', to_jsonb($2::text)),
        '{svg_hash}', to_jsonb($4::text)
    ),
    ...
),
```
Bind `new_svg_hash` as the appropriate `$N` parameter.

### Step 7 — Update `dev.sh shapes_import()`

In `dev.sh`, in the `shapes_import()` function, after the sidecar variable is built and
before the `$DOCKER_PSQL` SQL call, compute hashes via Python (available in dev environment):

```bash
# Compute sidecar hash (RFC 8785: keys sorted, no whitespace)
local sidecar_hash svg_hash_val
sidecar_hash=$(echo "$sidecar" | python3 -c "
import json, sys, hashlib
data = json.load(sys.stdin)
canonical = json.dumps(data, sort_keys=True, separators=(',',':'), ensure_ascii=False)
print(hashlib.sha256(canonical.encode('utf-8')).hexdigest())
")
# Compute SVG hash (LF-normalized bytes)
svg_hash_val=$(sed 's/\r$//' "$json_dir/${shape_id}.svg" 2>/dev/null | sha256sum | cut -d' ' -f1)
```

Then extend the `jq` metadata construction to include both hash fields:
```bash
metadata=$(jq -n \
    --arg sid "$shape_id" \
    --arg src "library" \
    --arg dn "$display_name" \
    --arg cat "$category" \
    --arg vb "$view_box" \
    --argjson sc "$sidecar" \
    --arg sh "$sidecar_hash" \
    --arg svh "$svg_hash_val" \
    '{shape_id:$sid,source:$src,display_name:$dn,category:$cat,view_box:$vb,schema:"io-shape-v1",sidecar:$sc,sidecar_hash:$sh,svg_hash:$svh}')
```
The existing `DO UPDATE SET metadata = EXCLUDED.metadata` will automatically write the hashes.

### Step 8 — Create no-op migration as a deployment marker

**`migrations/20260511000001_shape_content_hashes_backfill.up.sql`:**
```sql
-- Hashes are computed and backfilled by seed_shapes on next startup.
-- This migration marks the feature as deployed.
SELECT 1;
```

**`migrations/20260511000001_shape_content_hashes_backfill.down.sql`:**
```sql
-- Hashes live in metadata JSONB; no DDL to reverse.
SELECT 1;
```

---

## Cargo.toml / package.json Changes

None. `sha2` is already in workspace dependencies and api-gateway's `Cargo.toml`.

---

## DB / Migration Changes

No DDL. Hashes go into the existing `metadata JSONB` column. The no-op migration (Step 8)
is a deployment marker only. Backfill for library shapes happens on next startup via the
`DO UPDATE` in seed_shapes. User shapes get hashes on their next reimport or upload.

---

## Verification

```bash
cd /home/io/io-dev/io

# 1. Build
BINDGEN_EXTRA_CLANG_ARGS="-I/usr/lib/gcc/x86_64-linux-gnu/13/include" cargo build -p api-gateway

# 2. Tests
cargo test -p api-gateway

# 3. Start services (triggers seed which backfills hashes)
./dev.sh start

# 4. Verify hashes are in DB for library shapes
docker compose exec postgres psql -U io -d io_dev -c \
  "SELECT metadata->>'shape_id', left(metadata->>'sidecar_hash',16), left(metadata->>'svg_hash',16) FROM design_objects WHERE type='shape' AND metadata->>'source'='library' LIMIT 5;"
# All 5 rows should have non-null, non-empty hash values

# 5. Verify batch_shapes returns hashes
# (requires auth token — test via browser DevTools or curl with token)
# Response for any shape_id should include sidecar_hash and svg_hash keys

# 6. Verify determinism: run import twice, hashes should not change
./dev.sh shapes import
docker compose exec postgres psql -U io -d io_dev -c \
  "SELECT metadata->>'shape_id', metadata->>'sidecar_hash' FROM design_objects WHERE metadata->>'shape_id'='pump-centrifugal' LIMIT 1;"
./dev.sh shapes import
# Re-run the query — hash must be identical

# 7. Frontend build
cd frontend && pnpm build
```

---

## Definition of Done

- [ ] `shape_hash.rs` created with `sidecar_hash()` and `svg_hash()` functions
- [ ] Module registered in `main.rs`
- [ ] `seed_shape_library()` computes and stores both hashes in metadata
- [ ] Existing library shape rows get hashes backfilled on next startup (DO UPDATE)
- [ ] `batch_shapes` response includes `sidecar_hash` and `svg_hash` per shape
- [ ] `upload_user_shape` computes and stores both hashes
- [ ] `reimport_shape_svg` recomputes and stores `svg_hash`
- [ ] `dev.sh shapes import` computes and stores both hashes
- [ ] Hashes are deterministic — same content always produces same hash across runs
- [ ] `cargo build -p api-gateway` succeeds
- [ ] `cargo test -p api-gateway` passes
