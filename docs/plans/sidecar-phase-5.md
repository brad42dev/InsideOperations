Implement Phase 5 of the sidecar architecture plan. Read this file completely before writing any code.

---

## Context

A full iographic export embeds complete SVG + sidecar + hashes for every shape the graphic
references. On import, each embedded shape is hash-compared against the target DB. This makes
iographic files fully portable across all IO versions and customer sites.

**Ownership policy (locked, do not change):**
- Hash match → use DB shape, skip import
- Library shape hash mismatch → import as user shape named `{shape_id}.imported`
  (or `{shape_id}.imported.{first-8-chars-of-sidecar-hash}` on collision)
  Rewrite the graphic's `shapeRef.shapeId` references to use the new name
- User shape hash mismatch → overwrite the user shape in DB
- Shape not in DB at all → import as new user shape
- **Library shapes (`source='library'`) are NEVER modified by any user action, including full import**

Thin export (default, no `mode` parameter) is unchanged from Phase 4.

Depends on: Phase 4 must be complete.

---

## Key Files

Read these fully before starting:
- `services/api-gateway/src/handlers/iographic.rs` — full file
  - `ExportIographicBody` struct (export request body)
  - `export_graphic` function (builds the ZIP)
  - `commit_iographic` function (import logic)
  - `IographicManifest` struct (added to in Phase 4)
- `frontend/src/shared/types/graphics.ts` — `SymbolInstance` type, `shapeRef.shapeId` field
  This shows the structure that must be rewritten when shape IDs change on import

---

## Implementation Steps

### Step 1 — Add `mode` parameter to export endpoint

Find `ExportIographicBody` (the request body struct for the export endpoint). Add:

```rust
/// Export mode: "thin" (default) or "full".
/// Full embeds complete SVG + sidecar for all shapes referenced by the graphic.
#[serde(default = "default_thin_mode")]
pub mode: String,
```

(The `default_thin_mode` function was added in Phase 4.)

### Step 2 — Embed shapes in full export

In `export_graphic`, after `shape_hashes` is built and before the manifest is constructed,
add the full-mode embedding block:

```rust
if body.mode == "full" {
    for dep_id in &shape_dependencies {
        let row = match sqlx::query(
            r#"SELECT svg_data, metadata
               FROM design_objects
               WHERE metadata->>'shape_id' = $1
                 AND type IN ('shape', 'shape_part')
               LIMIT 1"#,
        )
        .bind(dep_id)
        .fetch_optional(&state.db)
        .await
        {
            Ok(Some(r)) => r,
            Ok(None) => {
                tracing::warn!(shape_id = %dep_id, "full export: shape not found");
                continue;
            }
            Err(e) => {
                tracing::warn!(error = %e, shape_id = %dep_id, "full export: db error");
                continue;
            }
        };

        let shape_svg: String = row.try_get::<Option<String>, _>("svg_data")
            .ok().flatten().unwrap_or_default();
        let shape_meta: Option<serde_json::Value> = row.try_get("metadata").ok().flatten();
        let shape_sidecar = shape_meta.as_ref()
            .and_then(|m| m.get("sidecar")).cloned()
            .unwrap_or(serde_json::json!({}));

        // Write to ZIP under shapes/{shape_id}/
        zip_file_map.insert(
            format!("shapes/{}/shape.svg", dep_id),
            shape_svg.into_bytes(),
        );
        zip_file_map.insert(
            format!("shapes/{}/sidecar.json", dep_id),
            serde_json::to_string_pretty(&shape_sidecar)
                .unwrap_or_default()
                .into_bytes(),
        );
    }
}
```

Find the variable name for the ZIP file map (likely a `HashMap` or `BTreeMap`) — use the
actual name from the existing `export_graphic` code.

Update `export_mode` in the manifest to reflect the actual mode:
```rust
export_mode: body.mode.clone(),
```

### Step 3 — Add `import_full_shapes` helper function

Add this async function to `iographic.rs`:

```rust
/// Import embedded shapes from a full iographic package.
/// Returns mapping: original shape_id -> actual shape_id to use in this system.
/// May differ when library shapes are imported as .imported user copies.
async fn import_full_shapes(
    db: &sqlx::PgPool,
    zip_bytes: &[u8],
    manifest: &IographicManifest,
    created_by: Option<uuid::Uuid>,
) -> std::collections::HashMap<String, String> {
    use std::io::Read;
    let mut id_map = std::collections::HashMap::new();

    for hash_entry in &manifest.shape_hashes {
        let shape_id = &hash_entry.shape_id;

        // Read embedded SVG from ZIP
        let cursor = std::io::Cursor::new(zip_bytes);
        let mut archive = match zip::ZipArchive::new(cursor) {
            Ok(a) => a,
            Err(_) => { id_map.insert(shape_id.clone(), shape_id.clone()); continue; }
        };

        let svg = read_zip_string(&mut archive, &format!("shapes/{}/shape.svg", shape_id));
        let sidecar_str = read_zip_string(&mut archive, &format!("shapes/{}/sidecar.json", shape_id));

        if svg.is_none() {
            // Shape not embedded — use DB version as-is
            id_map.insert(shape_id.clone(), shape_id.clone());
            continue;
        }

        let svg = svg.unwrap();
        let sidecar: serde_json::Value = sidecar_str
            .and_then(|s| serde_json::from_str(&s).ok())
            .unwrap_or(serde_json::json!({}));

        // Look up shape in DB
        let db_row = sqlx::query(
            r#"SELECT metadata->>'source'       AS source,
                      metadata->>'sidecar_hash'  AS sidecar_hash,
                      metadata->>'svg_hash'       AS svg_hash
               FROM design_objects
               WHERE metadata->>'shape_id' = $1
                 AND type IN ('shape', 'shape_part')
               LIMIT 1"#,
        )
        .bind(shape_id)
        .fetch_optional(db)
        .await
        .ok()
        .flatten();

        match db_row {
            Some(row) => {
                let source: String   = row.try_get("source").unwrap_or_default();
                let db_sh: String    = row.try_get("sidecar_hash").unwrap_or_default();
                let db_svh: String   = row.try_get("svg_hash").unwrap_or_default();
                let hashes_match = !db_sh.is_empty()
                    && db_sh == hash_entry.sidecar_hash
                    && db_svh == hash_entry.svg_hash;

                if hashes_match {
                    id_map.insert(shape_id.clone(), shape_id.clone());
                } else if source == "library" {
                    // Library: never overwrite — import as user copy
                    let new_id = upsert_imported_shape(
                        db, shape_id, &svg, &sidecar, hash_entry, created_by,
                    ).await;
                    id_map.insert(shape_id.clone(), new_id);
                } else {
                    // User shape: overwrite
                    overwrite_user_shape(db, shape_id, &svg, &sidecar, hash_entry).await;
                    id_map.insert(shape_id.clone(), shape_id.clone());
                }
            }
            None => {
                // Not in DB — import as new user shape
                let new_id = upsert_imported_shape(
                    db, shape_id, &svg, &sidecar, hash_entry, created_by,
                ).await;
                id_map.insert(shape_id.clone(), new_id);
            }
        }
    }

    id_map
}
```

### Step 4 — Add `read_zip_string` helper

```rust
fn read_zip_string(archive: &mut zip::ZipArchive<std::io::Cursor<Vec<u8>>>, path: &str)
    -> Option<String>
{
    use std::io::Read;
    let mut entry = archive.by_name(path).ok()?;
    let mut buf = String::new();
    entry.read_to_string(&mut buf).ok()?;
    Some(buf)
}
```

Note: `zip::ZipArchive` requires `Seek`. The import path already has zip bytes in memory
(find how `commit_iographic` reads the ZIP — use the same approach). The `Cursor<Vec<u8>>`
wrapper provides `Seek`.

### Step 5 — Add `upsert_imported_shape` helper

```rust
async fn upsert_imported_shape(
    db: &sqlx::PgPool,
    original_id: &str,
    svg: &str,
    sidecar: &serde_json::Value,
    hash_entry: &ShapeHashEntry,
    created_by: Option<uuid::Uuid>,
) -> String {
    // Try "{original_id}.imported", fall back to "{original_id}.imported.{8-char-hash}"
    let base_id = format!("{}.imported", original_id);
    let count: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM design_objects WHERE metadata->>'shape_id' = $1"
    )
    .bind(&base_id)
    .fetch_one(db)
    .await
    .unwrap_or(0);

    let final_id = if count == 0 {
        base_id
    } else {
        format!("{}.imported.{}", original_id, &hash_entry.sidecar_hash[..8.min(hash_entry.sidecar_hash.len())])
    };

    let display_name = sidecar.get("display_name")
        .and_then(|v| v.as_str())
        .unwrap_or(original_id);

    let new_sidecar_hash = crate::shape_hash::sidecar_hash(sidecar);
    let new_svg_hash     = crate::shape_hash::svg_hash(svg);

    let metadata = serde_json::json!({
        "shape_id":     final_id,
        "source":       "user",
        "display_name": format!("{} (imported)", display_name),
        "category":     sidecar.get("category").and_then(|v| v.as_str()).unwrap_or("imported"),
        "schema":       "io-shape-v1",
        "sidecar":      sidecar,
        "sidecar_hash": new_sidecar_hash,
        "svg_hash":     new_svg_hash,
        "imported_from": original_id,
    });

    let shape_type = if original_id.starts_with("part-") { "shape_part" } else { "shape" };

    if let Err(e) = sqlx::query(
        "INSERT INTO design_objects (id, name, type, svg_data, metadata, created_by)
         VALUES (gen_random_uuid(), $1, $2, $3, $4::jsonb, $5)
         ON CONFLICT ((metadata->>'shape_id'))
             WHERE type IN ('shape','shape_part') AND metadata->>'source' = 'user'
         DO UPDATE SET svg_data = EXCLUDED.svg_data,
                       metadata = EXCLUDED.metadata,
                       updated_at = NOW()"
    )
    .bind(display_name)
    .bind(shape_type)
    .bind(svg)
    .bind(metadata.to_string())
    .bind(created_by)
    .execute(db)
    .await
    {
        tracing::error!(error = %e, shape_id = %final_id, "upsert_imported_shape failed");
    }

    final_id
}
```

### Step 6 — Add `overwrite_user_shape` helper

```rust
async fn overwrite_user_shape(
    db: &sqlx::PgPool,
    shape_id: &str,
    svg: &str,
    sidecar: &serde_json::Value,
    hash_entry: &ShapeHashEntry,
) {
    if let Err(e) = sqlx::query(
        r#"UPDATE design_objects
           SET svg_data   = $1,
               metadata   = jsonb_set(
                   jsonb_set(
                       jsonb_set(metadata, '{sidecar}', $2::jsonb),
                       '{sidecar_hash}', to_jsonb($3::text)
                   ),
                   '{svg_hash}', to_jsonb($4::text)
               ),
               updated_at = NOW()
           WHERE metadata->>'shape_id' = $5
             AND type IN ('shape', 'shape_part')
             AND metadata->>'source' = 'user'"#,
    )
    .bind(svg)
    .bind(sidecar)
    .bind(&hash_entry.sidecar_hash)
    .bind(&hash_entry.svg_hash)
    .bind(shape_id)
    .execute(db)
    .await
    {
        tracing::error!(error = %e, shape_id = %shape_id, "overwrite_user_shape failed");
    }
}
```

### Step 7 — Add `rewrite_shape_refs` helper

This recursively replaces `shapeRef.shapeId` values in the graphic's scene JSON:

```rust
fn rewrite_shape_refs(
    val: serde_json::Value,
    id_map: &std::collections::HashMap<String, String>,
) -> serde_json::Value {
    match val {
        serde_json::Value::Object(mut map) => {
            // Rewrite shapeRef.shapeId if present and mapped
            if let Some(shape_ref) = map.get_mut("shapeRef") {
                if let Some(shape_id) = shape_ref.get("shapeId").and_then(|v| v.as_str()) {
                    if let Some(new_id) = id_map.get(shape_id) {
                        if new_id != shape_id {
                            if let Some(obj) = shape_ref.as_object_mut() {
                                obj.insert("shapeId".to_string(),
                                    serde_json::Value::String(new_id.clone()));
                            }
                        }
                    }
                }
            }
            let new_map: serde_json::Map<String, serde_json::Value> = map
                .into_iter()
                .map(|(k, v)| (k, rewrite_shape_refs(v, id_map)))
                .collect();
            serde_json::Value::Object(new_map)
        }
        serde_json::Value::Array(arr) => serde_json::Value::Array(
            arr.into_iter().map(|v| rewrite_shape_refs(v, id_map)).collect(),
        ),
        other => other,
    }
}
```

### Step 8 — Wire into `commit_iographic`

In the `commit_iographic` function, after the manifest is parsed and before the graphic
display objects are processed:

```rust
// For full imports, process embedded shapes first and get the ID remapping
let shape_id_map = if manifest.export_mode == "full" && !manifest.shape_hashes.is_empty() {
    import_full_shapes(&state.db, &zip_bytes, &manifest, created_by_uuid).await
} else {
    std::collections::HashMap::new()
};
```

Then, when building the graphic's scene/bindings JSON to insert into the DB, apply the
rewrite if any IDs were remapped:

```rust
let has_remaps = shape_id_map.iter().any(|(k, v)| k != v);
let final_scene_json = if has_remaps {
    rewrite_shape_refs(scene_json, &shape_id_map)
} else {
    scene_json
};
```

Find the exact variable names and insertion points by reading `commit_iographic` carefully.

---

## Cargo.toml / Package Changes

The `zip` crate should already be in `iographic.rs`'s imports (it's used today). Verify.
No new crates needed.

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

# 3. Full export test
./dev.sh start
# Export a graphic with mode "full" via API or test curl command
# Unzip and verify shapes/ directory contains {shape_id}/shape.svg and sidecar.json
# unzip -l exported.iographic | grep shapes/

# 4. Full import round-trip (same system)
# Import the full .iographic back into the same system
# All shapes should hash-match; no .imported copies created
# Verify in DB: SELECT metadata->>'shape_id' FROM design_objects WHERE metadata->>'source'='user' AND metadata->>'shape_id' LIKE '%.imported';
# Should return 0 rows

# 5. Library mismatch test
# Manually corrupt a sidecar_hash in DB for one library shape, then import the full file
# Should create a {shape_id}.imported user shape and rewrite graphic references
# Restore the hash after testing:
# ./dev.sh shapes import

# 6. Thin export still works (no mode param = thin, same as before Phase 5)

# 7. Frontend build
cd frontend && pnpm build
```

---

## Definition of Done

- [ ] Export endpoint accepts `mode: "full"` parameter
- [ ] Full export embeds `shapes/{shape_id}/shape.svg` and `shapes/{shape_id}/sidecar.json` per dependency
- [ ] Manifest `export_mode` field set to `"full"` or `"thin"` accordingly
- [ ] `import_full_shapes` helper implemented and called from `commit_iographic`
- [ ] Library shape hash mismatch → imported as `{shape_id}.imported` user shape
- [ ] User shape hash mismatch → overwrites user shape
- [ ] Missing shape → imported as new user shape
- [ ] `shapeRef.shapeId` references rewritten in graphic when shapes are renamed on import
- [ ] Library shapes (`source='library'`) are never modified by import
- [ ] Thin export (default, no mode param) unchanged from Phase 4
- [ ] `cargo build -p api-gateway` succeeds
- [ ] `cargo test -p api-gateway` passes
