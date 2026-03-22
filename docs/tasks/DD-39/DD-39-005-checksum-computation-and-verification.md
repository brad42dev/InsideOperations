---
id: DD-39-005
title: Compute SHA-256 checksum on export and verify on import
unit: DD-39
status: pending
priority: medium
depends-on: [DD-39-001]
---

## What This Feature Should Do

Every exported `.iographic` package must include a SHA-256 checksum in `manifest.json` that covers all files in the ZIP except `manifest.json` itself. On import, the checksum must be verified before the package is processed further. A failing checksum must reject the import with a "Package integrity check failed" error. This prevents accidental corruption and tampered packages from being imported silently.

## Spec Excerpt (verbatim)

> `checksum` | string | Yes | SHA-256 digest of all other files in the ZIP (excluding `manifest.json` itself), computed over the concatenation of each file's content sorted by ZIP entry path. Format: `"sha256:<hex>"`.
>
> Checksum Computation:
> 1. List all ZIP entries except `manifest.json`, sorted lexicographically by full path
> 2. For each entry, read the raw bytes
> 3. Feed all bytes sequentially into a SHA-256 hasher
> 4. Hex-encode the digest
>
> Import Phase 1: Validation
> 5. Verify checksum against actual file contents
> 6. If checksum fails → reject with "Package integrity check failed"
> — design-docs/39_IOGRAPHIC_FORMAT.md, §3 and §9

## Where to Look in the Codebase

Primary files:
- `services/api-gateway/src/handlers/iographic.rs` lines 558-675 — `export_graphic` function: checksum must be computed here before finalizing ZIP
- `services/api-gateway/src/handlers/iographic.rs` lines 727-780 — import handler `import_graphic` / new `analyze_iographic`: checksum verification must be added here
- `services/api-gateway/Cargo.toml` — must add `sha2` dependency

## Verification Checklist

- [ ] `sha2` crate is present in `services/api-gateway/Cargo.toml`
- [ ] `export_graphic` collects all non-manifest file bytes in a `BTreeMap<String, Vec<u8>>` (sorted by path), feeds them into a `sha2::Sha256` hasher, and writes `"sha256:{hex}"` to `manifest.checksum`
- [ ] `analyze_iographic` reads the ZIP entries (excluding `manifest.json`), sorts by path, computes SHA-256 and compares to `manifest.checksum`
- [ ] If checksum mismatch in analyze: `errors` array includes `"Package integrity check failed"` and `valid` is set to `false`
- [ ] If checksum mismatch in `commit_iographic`: returns 400 with body `"Package integrity check failed"`

## Assessment

- **Status**: ❌ Missing
- **What needs to change**: `sha2` crate must be added. Export must compute and store checksum. Import (both analyze and commit) must verify it.

## Fix Instructions

1. Add to `services/api-gateway/Cargo.toml`:
   ```toml
   sha2 = "0.10"
   hex = "0.4"
   ```

2. In `export_graphic`, change the file-writing approach:
   - Instead of writing directly to the ZIP, collect all files into a `BTreeMap<String, Vec<u8>>`:
     ```rust
     let mut files: BTreeMap<String, Vec<u8>> = BTreeMap::new();
     files.insert(format!("graphics/{}/graphic.svg", dir), svg_bytes);
     files.insert(format!("graphics/{}/graphic.json", dir), json_bytes);
     // ... shapes, stencils, etc.
     ```
   - Compute checksum:
     ```rust
     use sha2::{Sha256, Digest};
     let mut hasher = Sha256::new();
     for (_, bytes) in &files {
         hasher.update(bytes);
     }
     let checksum = format!("sha256:{}", hex::encode(hasher.finalize()));
     ```
   - Set `manifest.checksum = checksum`, then serialize manifest and write all files to ZIP.

3. In `analyze_iographic`, after reading manifest, before tag/shape analysis:
   ```rust
   // Collect non-manifest files sorted by path
   let mut file_map: BTreeMap<String, Vec<u8>> = BTreeMap::new();
   for i in 0..zip.len() {
       if let Ok(mut f) = zip.by_index(i) {
           if f.name() != "manifest.json" {
               let mut buf = Vec::new();
               let _ = f.read_to_end(&mut buf);
               file_map.insert(f.name().to_string(), buf);
           }
       }
   }
   let mut hasher = Sha256::new();
   for (_, bytes) in &file_map {
       hasher.update(bytes);
   }
   let computed = format!("sha256:{}", hex::encode(hasher.finalize()));
   if computed != manifest.checksum {
       errors.push("Package integrity check failed".to_string());
       valid = false;
   }
   ```

Do NOT:
- Skip checksum verification for packages that are missing the `checksum` field — treat missing checksum as a validation warning (not a hard reject) to allow importing packages produced before this feature was added, but log a warning
- Include `manifest.json` itself in the checksum computation
