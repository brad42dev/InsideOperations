---
id: DD-26-005
title: Add ort, sha2, zip, image crates and implement SHA-256 integrity check on .iomodel load
unit: DD-26
status: done
priority: high
depends-on: []
---

## What This Feature Should Do

The Recognition Service must load `.iomodel` ZIP packages and run ONNX inference. Foundationally, it needs the `ort` (ONNX Runtime) crate to create inference sessions, the `zip` crate to unpack `.iomodel` packages, the `sha2` crate to verify model file hashes against the manifest, and the `image` crate for image preprocessing. Without these crates the service can never do real inference. The SHA-256 integrity check is a specific non-negotiable: if hash verification fails the model must be rejected.

## Spec Excerpt (verbatim)

> Integrity verification on load: When loading a `.iomodel` package, the Recognition Service MUST compute the SHA-256 digest of each ONNX file and compare against `model_hashes`. On mismatch: log an error, reject the package, and surface the error in Settings > Recognition. Old packages without `model_hash` fields load with a warning ("model integrity not verified — pre-1.1 package").
> — design-docs/26_PID_RECOGNITION.md, §.iomodel Package Structure

> | Crate | Version | License | Purpose |
> | `ort` | 2.x | MIT/Apache-2.0 | ONNX Runtime bindings for Rust |
> — design-docs/26_PID_RECOGNITION.md, §Technology > New Crate

## Where to Look in the Codebase

Primary files:
- `services/recognition-service/Cargo.toml` — missing `ort`, `sha2`, `zip`, `image` dependencies
- `services/recognition-service/src/main.rs:104–148` — `upload_model` handler reads file bytes but does nothing with them
- `services/recognition-service/src/state.rs` — `AppState` has no model session storage

## Verification Checklist

- [ ] `Cargo.toml` declares `ort = { version = "2", features = ["load-dynamic"] }` or similar 2.x dependency
- [ ] `Cargo.toml` declares `sha2`, `zip`, and `image` dependencies
- [ ] `upload_model` unpacks the ZIP, reads `manifest.json`, extracts `model_hashes`
- [ ] For each ONNX file in `model_hashes`, SHA-256 is computed and compared; mismatch returns an error response
- [ ] Missing `model_hashes` field logs a warning with message "model integrity not verified — pre-1.1 package" and continues loading
- [ ] `AppState` updated to hold `DomainSlot` or equivalent typed model state (not just `Vec<ModelInfo>`)

## Assessment

- **Status**: ❌ Missing — no `ort`, `sha2`, `zip`, or `image` in Cargo.toml; upload_model is a pure stub

## Fix Instructions

**Step 1 — Add dependencies to `services/recognition-service/Cargo.toml`:**

```toml
ort = { version = "2", features = ["load-dynamic"] }
sha2 = "0.10"
zip = "2"
image = { version = "0.25", default-features = false, features = ["png", "jpeg", "tiff"] }
```

Verify `ort` 2.x and `zip` 2.x licenses: `ort` is MIT/Apache-2.0 (confirmed in doc 26); `zip` is MIT/Apache-2.0; `sha2` is MIT/Apache-2.0; `image` is MIT.

**Step 2 — Implement hash verification in `upload_model`:**

When the `file` multipart field is received:
1. Write bytes to a temp path under `config.model_dir/incoming/`
2. Open as ZIP archive using `zip::ZipArchive`
3. Read `manifest.json` → parse `model_hashes: HashMap<String, String>`
4. If `model_hashes` is absent, log `warn!("model integrity not verified — pre-1.1 package")` and continue
5. For each `(filename, expected_hash)` in `model_hashes`:
   - Read the file from the ZIP
   - Compute SHA-256 using `sha2::Sha256`
   - Compare `"sha256:" + hex::encode(digest)` against `expected_hash`
   - On mismatch: return `IoError::InvalidInput(format!("hash mismatch for {filename}"))` — reject the package
6. Read `model_domain` from manifest to determine "pid" or "dcs" (do not use the form field)
7. On success: record the model info with `loaded: false` (real session loading is deferred until `ort` integration is completed)

**Step 3 — Update `AppState`:**

Model management should eventually use a `DomainSlot` per the spec architecture. For this task, the minimum is ensuring the `models` Vec stores the correct domain read from `manifest.json` (not the form field).

Do NOT:
- Skip the hash check just because ONNX inference is still deferred — the integrity check must work independently
- Use an LGPL-licensed ZIP crate — `zip` (MIT/Apache) is correct
- Store the `.iomodel` file bytes in memory — write to `config.model_dir` path
