Implement Phase 3 of the sidecar architecture plan. Read this file completely before writing any code.

---

## Context

Sidecar JSON must be validated against `io-shape-v1.schema.json` on write to catch
structural errors before they reach the renderer. The `jsonschema` crate (MIT licensed)
is used. The schema is embedded at compile time via `include_str!` so there is no runtime
file I/O. Validation applies to user-facing write endpoints. Library shape seeding logs
warnings but does not hard-fail — library shapes are developer-controlled.

Currently there are no user-facing endpoints that accept a full sidecar JSON (the shape
authoring wizard that will produce sidecars is deferred). So this phase mainly:
1. Adds the validation infrastructure to `shape_hash.rs`
2. Adds startup warning validation to `seed_shapes.rs`
3. Documents the HTTP 422 response pattern for the future wizard

Depends on: Phases 1 and 2 must be complete (`shape_hash.rs` must exist).

---

## Key Files

- **MODIFY:** `services/api-gateway/Cargo.toml` — add `jsonschema` crate
- **MODIFY:** `Cargo.toml` (workspace root) — add `jsonschema` to workspace dependencies
- **MODIFY:** `services/api-gateway/src/shape_hash.rs` — add `validate_sidecar()` function
- **MODIFY:** `services/api-gateway/src/seed_shapes.rs` — add warning-only validation call
- **MODIFY:** `services/api-gateway/build.rs` — track schema file for recompilation
- **READ:** `frontend/shapes-source/_schema/io-shape-v1.schema.json` — embedded at compile time

---

## Implementation Steps

### Step 1 — Add `jsonschema` to Cargo.toml

**In workspace root `Cargo.toml`**, under `[workspace.dependencies]`:
```toml
jsonschema = "0.28"
```

**In `services/api-gateway/Cargo.toml`**, under `[dependencies]`:
```toml
jsonschema.workspace = true
```

License: `jsonschema` 0.28 is MIT licensed. Verified safe.

Check `Cargo.toml` for `once_cell` — it is used for the `Lazy` static. If not present,
add it the same way (`once_cell = "1"` in workspace, `once_cell.workspace = true` in
api-gateway). It is likely already present as an indirect dependency.

### Step 2 — Add `validate_sidecar()` to `shape_hash.rs`

The `include_str!` path is relative to the source file. `shape_hash.rs` is at
`services/api-gateway/src/shape_hash.rs`. The schema is at
`frontend/shapes-source/_schema/io-shape-v1.schema.json`. The relative path from the .rs
file is `../../../frontend/shapes-source/_schema/io-shape-v1.schema.json`.

Verify before using:
```bash
# From services/api-gateway/src/
ls ../../../frontend/shapes-source/_schema/io-shape-v1.schema.json
```

Add to `shape_hash.rs`:

```rust
use once_cell::sync::Lazy;

const SCHEMA_STR: &str =
    include_str!("../../../frontend/shapes-source/_schema/io-shape-v1.schema.json");

static SHAPE_SCHEMA: Lazy<jsonschema::Validator> = Lazy::new(|| {
    let schema_value: serde_json::Value =
        serde_json::from_str(SCHEMA_STR).expect("io-shape-v1.schema.json must be valid JSON");
    jsonschema::validator_for(&schema_value)
        .expect("io-shape-v1.schema.json must be a valid JSON Schema")
});

/// Validate a sidecar JSON value against io-shape-v1 schema.
/// Returns Ok(()) on success, Err(Vec<String>) with human-readable errors on failure.
pub fn validate_sidecar(sidecar: &serde_json::Value) -> Result<(), Vec<String>> {
    match SHAPE_SCHEMA.validate(sidecar) {
        Ok(()) => Ok(()),
        Err(errors) => {
            let messages: Vec<String> = errors
                .map(|e| format!("{} at {}", e, e.instance_path))
                .collect();
            Err(messages)
        }
    }
}
```

### Step 3 — Add startup validation warnings to `seed_shapes.rs`

After parsing the sidecar JSON value (where `sidecar_value` is available), add:

```rust
if let Err(errors) = shape_hash::validate_sidecar(&sidecar_value) {
    warn!(
        shape_id = %s.shape_id,
        error_count = errors.len(),
        first_error = %errors.first().map(|e| e.as_str()).unwrap_or(""),
        "Sidecar schema validation warning (not blocking)"
    );
}
```

This will log any schema issues during startup without blocking the seed. If the output is
clean after Phase 1's schema fix, there will be no warnings.

### Step 4 — Document HTTP 422 pattern for future wizard endpoint

Add this comment block to `shape_hash.rs` (or as a doc comment on `validate_sidecar`):

```rust
/// ## HTTP 422 response pattern for sidecar-write endpoints
///
/// When a user-facing endpoint (e.g., the future Shape Authoring Wizard) accepts a
/// full sidecar JSON, validate it and return HTTP 422 on failure:
///
/// ```rust
/// if let Err(validation_errors) = crate::shape_hash::validate_sidecar(&sidecar_json) {
///     return (
///         StatusCode::UNPROCESSABLE_ENTITY,
///         Json(serde_json::json!({
///             "success": false,
///             "error": {
///                 "code": "SIDECAR_VALIDATION_FAILED",
///                 "message": "Sidecar JSON does not conform to io-shape-v1 schema",
///                 "details": validation_errors
///             }
///         }))
///     ).into_response();
/// }
/// ```
```

### Step 5 — Track schema file in `build.rs`

In `services/api-gateway/build.rs`, after the existing `println!("cargo:rerun-if-changed=...")` lines for shapes-source files, add:

```rust
println!(
    "cargo:rerun-if-changed={}",
    shapes_root.join("_schema/io-shape-v1.schema.json").display()
);
```

This ensures the binary recompiles when the schema changes.

---

## Cargo.toml Changes

- Add `jsonschema = "0.28"` to workspace root `Cargo.toml` under `[workspace.dependencies]`
- Add `jsonschema.workspace = true` to `services/api-gateway/Cargo.toml` under `[dependencies]`
- Add `once_cell` to workspace if not already present (check first)

---

## DB / Migration Changes

None.

---

## Verification

```bash
cd /home/io/io-dev/io

# 1. Build (jsonschema compile may take ~30s first time)
BINDGEN_EXTRA_CLANG_ARGS="-I/usr/lib/gcc/x86_64-linux-gnu/13/include" cargo build -p api-gateway

# 2. Tests
cargo test -p api-gateway

# 3. Start services and check for validation warnings in logs
./dev.sh start
./dev.sh logs api-gateway | grep -i "validation"
# Should be silent — no warnings if Phase 1 schema fix is complete

# 4. Verify SHAPE_SCHEMA loads without panic (startup would fail if schema is invalid)
# A successful startup confirms the Lazy static initialized correctly

# 5. Frontend build
cd frontend && pnpm build
```

---

## Definition of Done

- [ ] `jsonschema` crate added to workspace and api-gateway `Cargo.toml`
- [ ] `validate_sidecar()` function in `shape_hash.rs`
- [ ] Schema embedded via `include_str!` — no runtime file I/O
- [ ] `seed_shape_library()` logs schema warnings on startup (not errors)
- [ ] `build.rs` tracks schema file for rebuild-on-change
- [ ] HTTP 422 pattern documented in `shape_hash.rs` for future wizard
- [ ] `cargo build -p api-gateway` succeeds
- [ ] `cargo test -p api-gateway` passes
- [ ] No validation warnings in startup logs (clean schema after Phase 1)
