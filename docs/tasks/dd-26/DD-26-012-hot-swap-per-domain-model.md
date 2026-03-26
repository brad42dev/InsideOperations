---
id: DD-26-012
title: Implement per-domain model hot-swap without affecting other domain
unit: DD-26
status: pending
priority: medium
depends-on: ["DD-26-011"]
---

## What This Feature Should Do

When a new `.iomodel` is uploaded for domain `pid`, the old P&ID session is atomically replaced with the new one. The DCS domain continues serving inference uninterrupted. This is achieved via `Arc<RwLock<Arc<ort::Session>>>` inside each `DomainSlot` — acquiring a write lock to swap the inner `Arc<ort::Session>`, then releasing it so in-flight requests on the old arc complete naturally. Currently there is no session concept at all; uploading a model appends to a Vec and does nothing further.

## Spec Excerpt (verbatim)

> ```rust
> // 6a. Swap into the domain-specific DomainSlot
> // 7. Old sessions drop when last reference is released
> // 8. Other domain is unaffected
> ```
> Both P&ID and DCS models can be loaded simultaneously. Each domain operates independently — loading a DCS model does not affect the P&ID model and vice versa.
> — design-docs/26_PID_RECOGNITION.md, §Model Loading

## Where to Look in the Codebase

Primary files:
- `services/recognition-service/src/model_manager.rs` — will be created by DD-26-011; `ModelManager::load()` must perform the swap
- `services/recognition-service/src/main.rs:124–243` — `upload_model()` triggers the hot-swap after integrity verification
- `services/recognition-service/src/main.rs:320–375` — `run_inference()` reads from the domain slot session under a read lock

## Verification Checklist

- [ ] `DomainSlot.session` is `Arc<RwLock<Arc<ort::Session>>>` (double-Arc pattern for hot-swap)
- [ ] `ModelManager::swap_domain(domain, new_session)` acquires write lock, replaces inner `Arc<ort::Session>`, releases lock
- [ ] `run_inference()` acquires read lock on `DomainSlot.session` and clones the inner `Arc<ort::Session>` before inference (allowing write-lock swap to proceed concurrently)
- [ ] Uploading a PID model does not touch `dcs_domain` field
- [ ] Uploading a DCS model does not touch `pid_domain` field
- [ ] After hot-swap, `GET /recognition/status` reflects the new model version for the swapped domain only

## Assessment

- **Status**: ❌ Missing
- **What's wrong**: No session concept exists. `upload_model()` at main.rs:234 does `state.models.write().await.push(model)` — no swap, no session creation, no per-domain isolation. This task depends on DD-26-011 establishing the `ModelManager`/`DomainSlot` types first.

## Fix Instructions

1. After DD-26-011 establishes `DomainSlot`, ensure `session` field is `Arc<RwLock<Arc<ort::Session>>>`.
2. Add `ModelManager::swap(domain: &str, session: Arc<ort::Session>)` method that:
   a. Matches `domain` to `pid_domain` or `dcs_domain`
   b. Acquires `write()` on the slot's `session` RwLock
   c. Replaces the inner `Arc<ort::Session>` with the new one
   d. Releases the lock (old arc drops when last clone is gone)
3. In `upload_model()`, after parsing + verifying the `.iomodel` ZIP, create a stub `ort::Session` (or defer to the future inference implementation) and call `model_manager.swap(domain, session)`.
4. In `run_inference()`, acquire `read()` on the domain's session RwLock, clone the `Arc<ort::Session>`, then drop the lock before running inference.

Do NOT:
- Do not hold the write lock during inference — clone the inner Arc first, then release
- Do not block the entire service during model load — swap should be milliseconds
- Do not mix domain slots — pid upload must only write to `pid_domain`
