---
id: DD-26-011
title: Implement ModelManager with dual DomainSlot architecture
unit: DD-26
status: pending
priority: medium
depends-on: []
---

## What This Feature Should Do

The Recognition Service spec defines a `ModelManager` struct with two independent `DomainSlot` instances — one for P&ID models and one for DCS models. Each `DomainSlot` wraps `Arc<RwLock<Arc<ort::Session>>>` so models can be hot-swapped per domain without affecting the other. Currently `AppState` stores a flat `Vec<ModelInfo>` with no per-domain session management — model upload appends to the vec but never creates an `ort::Session`.

## Spec Excerpt (verbatim)

> ```rust
> pub struct DomainSlot {
>     session: Arc<RwLock<Arc<ort::Session>>>,
>     metadata: Arc<RwLock<ModelMetadata>>,
>     class_map: Arc<HashMap<i64, String>>,
>     preprocessing: Arc<PreprocessingConfig>,
> }
>
> pub struct ModelManager {
>     pid_domain: Option<DomainSlot>,
>     dcs_domain: Option<DomainSlot>,
>     model_dir: PathBuf,
> }
> ```
> Both P&ID and DCS models can be loaded simultaneously. Each domain operates independently — loading a DCS model does not affect the P&ID model and vice versa.
> — design-docs/26_PID_RECOGNITION.md, §Recognition Service > Architecture

## Where to Look in the Codebase

Primary files:
- `services/recognition-service/src/state.rs` — defines `AppState`; currently `models: Arc<RwLock<Vec<ModelInfo>>>` instead of a `ModelManager`
- `services/recognition-service/src/main.rs:124–243` — `upload_model()` appends `ModelInfo` to Vec; should call `model_manager.load(path)` for the appropriate domain slot
- `services/recognition-service/src/main.rs:320–375` — `run_inference()` is a stub returning empty detections; should dispatch to the loaded domain's `ort::Session`
- `services/recognition-service/Cargo.toml` — `ort` crate already present at `2.0.0-rc.12`

## Verification Checklist

- [ ] `DomainSlot` struct defined with `session: Arc<RwLock<Arc<ort::Session>>>`, `metadata`, `class_map`, `preprocessing` fields
- [ ] `ModelManager` struct defined with `pid_domain: Option<DomainSlot>`, `dcs_domain: Option<DomainSlot>`, `model_dir: PathBuf`
- [ ] `AppState` contains `model_manager: Arc<RwLock<ModelManager>>` (not a raw `Vec<ModelInfo>`)
- [ ] `upload_model()` calls `model_manager.load(domain, path)` to populate the appropriate domain slot
- [ ] `run_inference()` dispatches to the correct domain slot's `ort::Session` (returning a stub 200 if no model loaded is acceptable)
- [ ] Loading a DCS model does not modify `pid_domain` and vice versa

## Assessment

- **Status**: ❌ Missing
- **What's wrong**: `state.rs` uses `Arc<RwLock<Vec<ModelInfo>>>` — no `ModelManager`, no `DomainSlot`, no `ort::Session` references. `upload_model()` at main.rs:234 pushes to the Vec but never creates a session. Inference at main.rs:361 returns a hardcoded stub regardless of domain.

## Fix Instructions

1. In `services/recognition-service/src/`, create `model_manager.rs` defining `DomainSlot` and `ModelManager` per the spec. For now, `ModelManager::load()` can be a stub that creates a `ModelInfo` record and stores it — actual `ort::Session` creation is Phase 2.
2. Update `state.rs`: replace `models: Arc<RwLock<Vec<ModelInfo>>>` with `model_manager: Arc<RwLock<ModelManager>>`.
3. Update `upload_model()` in main.rs: after parsing the manifest, call `state.model_manager.write().await.load(domain, &manifest)` instead of pushing to a Vec.
4. Update `list_models()` and `get_model()` to retrieve model info from the `ModelManager` rather than a raw Vec.
5. Update `get_status()` to derive per-domain status from `model_manager.pid_domain` and `model_manager.dcs_domain`.

Do NOT:
- Do not attempt to run actual ONNX inference in this task — stub sessions are acceptable
- Do not remove the existing `ModelInfo` struct — it can remain as the metadata type stored inside `DomainSlot`
- Do not break the API shape for `/recognition/status`, `/recognition/models`, or `/recognition/detect`
