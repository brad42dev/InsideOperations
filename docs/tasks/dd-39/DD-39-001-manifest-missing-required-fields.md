---
id: DD-39-001
title: Add shapes, stencils, shape_dependencies, point_tags, checksum to manifest
unit: DD-39
status: pending
priority: high
depends-on: []
---

## What This Feature Should Do

The exported `manifest.json` must include the full set of required fields defined in doc 39. Currently the `IographicManifest` struct omits `shapes`, `stencils`, `shape_dependencies`, `point_tags`, and `checksum`. An importer reading the file cannot determine what shapes or points the package depends on without parsing every graphic file individually. The import wizard's overview step (Step 1) will fail because `manifest.shape_dependencies.length` and `manifest.point_tags.length` return undefined.

## Spec Excerpt (verbatim)

> `shapes` | array | Yes | Inventory of custom shapes packaged for portability. Empty array if all shapes are built-in.
> `shape_dependencies` | string[] | Yes | Deduplicated list of ALL shape library IDs referenced across all graphics in the package — both built-in and custom.
> `point_tags` | string[] | Yes | Deduplicated list of all point tag names referenced in bindings across all graphics.
> `checksum` | string | Yes | SHA-256 digest of all other files in the ZIP (excluding `manifest.json` itself), computed over the concatenation of each file's content sorted by ZIP entry path. Format: `"sha256:<hex>"`.
> — design-docs/39_IOGRAPHIC_FORMAT.md, §3 Manifest Fields

## Where to Look in the Codebase

Primary files:
- `services/api-gateway/src/handlers/iographic.rs` lines 34-56 — `IographicManifest` struct: add the missing fields here
- `services/api-gateway/src/handlers/iographic.rs` lines 509-676 — `export_graphic` function: populate the new fields before writing manifest.json
- `services/api-gateway/src/handlers/iographic.rs` lines 566-583 — where `IographicManifest { ... }` is constructed: new fields must be filled in here

## Verification Checklist

Read `services/api-gateway/src/handlers/iographic.rs`:

- [ ] `IographicManifest` struct has fields: `shapes: Vec<IographicShapeEntry>`, `stencils: Vec<IographicStencilEntry>`, `shape_dependencies: Vec<String>`, `point_tags: Vec<String>`, `checksum: String`
- [ ] `export_graphic` collects unique `shape_id` values from the graphic's `shapes` array in `graphic.json` and writes them to `manifest.shape_dependencies`
- [ ] `export_graphic` collects unique point tag names from resolved bindings and writes them to `manifest.point_tags`
- [ ] `export_graphic` builds `manifest.shapes` with an entry per custom shape (`.custom.*` IDs) bundled in the `shapes/` directory
- [ ] Checksum is computed as SHA-256 over all files except `manifest.json`, sorted by path, and written as `"sha256:<hex>"`
- [ ] `Cargo.toml` for `io-api-gateway` lists `sha2` as a dependency

## Assessment

- **Status**: ❌ Missing
- **What needs to change**: `IographicManifest` struct and the `export_graphic` function both need to be updated. The struct is missing 5 required fields. The export function never populates them.

## Fix Instructions

1. Add `sha2` to `services/api-gateway/Cargo.toml` under `[dependencies]`:
   ```toml
   sha2 = { version = "0.10", features = ["default"] }
   ```

2. Add supporting structs and extend `IographicManifest` in `iographic.rs`:
   ```rust
   #[derive(Debug, Serialize, Deserialize)]
   pub struct IographicShapeEntry {
       pub directory: String,
       pub name: String,
       pub shape_id: String,
   }

   #[derive(Debug, Serialize, Deserialize)]
   pub struct IographicStencilEntry {
       pub directory: String,
       pub name: String,
   }
   ```
   Add to `IographicManifest`:
   ```rust
   pub shapes: Vec<IographicShapeEntry>,
   pub stencils: Vec<IographicStencilEntry>,
   pub shape_dependencies: Vec<String>,
   pub point_tags: Vec<String>,
   pub checksum: String,
   ```

3. In `export_graphic`, before building the manifest:
   - Parse the graphic's `bindings` JSONB (after UUID→tag conversion in DD-39-002) to collect all resolved tag names into a `HashSet<String>`, then sort into a `Vec` for `point_tags`.
   - Scan `bindings` for `shape_id` references (the `shapes` array in `graphic.json`) to collect `shape_dependencies`. Separate `.custom.*` IDs for `shapes` entries.
   - For each custom shape being packaged, create an `IographicShapeEntry` with the directory, name, and shape_id.

4. Compute checksum after writing all non-manifest ZIP entries:
   ```rust
   use sha2::{Sha256, Digest};
   // Collect all file paths except manifest.json, sorted
   // For each: read content, feed into hasher
   // manifest.checksum = format!("sha256:{}", hex::encode(hasher.finalize()))
   ```
   Note: because ZIP is being written sequentially, collect file contents into a `BTreeMap<String, Vec<u8>>` during export, compute checksum from that, then write all files including manifest.

Do NOT:
- Omit `checksum` even when `point_tags` is empty — the spec requires it in all packages
- Use the `zip` entry iteration on the output ZIP to compute the checksum (the ZIP writer is consumed at that point); collect bytes beforehand
