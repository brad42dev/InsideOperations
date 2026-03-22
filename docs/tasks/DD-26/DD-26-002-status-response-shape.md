---
id: DD-26-002
title: Fix /recognition/status response to return per-domain shape
unit: DD-26
status: pending
priority: medium
depends-on: []
---

## What This Feature Should Do

The `GET /api/recognition/status` endpoint is consumed by the Settings > Recognition page (and any future clients) to determine which domains have models loaded and what hardware each is using. The spec defines a specific per-domain structure. The current implementation returns a flat object that omits the `hardware` and `mode` fields and does not group by domain.

## Spec Excerpt (verbatim)

> GET    /api/recognition/status
>        Response: { domains: { pid: { model_loaded: boolean, hardware: string, mode: "gpu" | "cpu" | "disabled" }, dcs: { model_loaded: boolean, hardware: string, mode: "gpu" | "cpu" | "disabled" } } }
> — design-docs/26_PID_RECOGNITION.md, §API Endpoints > Recognition

## Where to Look in the Codebase

Primary files:
- `services/recognition-service/src/main.rs:201–211` — `get_status` handler returns flat JSON object
- `frontend/src/api/recognition.ts:37–43` — `RecognitionStatus` interface reflects the flat shape (also needs updating)
- `frontend/src/pages/settings/Recognition.tsx:96–113` — reads `data.models_loaded`, `data.pid_model`, `data.dcs_model`, `data.onnx_available` (all need updating)

## Verification Checklist

- [ ] Response JSON has a top-level `domains` key containing `pid` and `dcs` sub-objects
- [ ] Each domain sub-object has `model_loaded: boolean`, `hardware: string`, `mode: "gpu" | "cpu" | "disabled"`
- [ ] Frontend `RecognitionStatus` interface matches the new shape
- [ ] `ServiceStatusCard` in Recognition.tsx reads from `data.domains.pid` and `data.domains.dcs`

## Assessment

- **Status**: ⚠️ Wrong — current shape is `{ models_loaded, models_total, pid_model, dcs_model, onnx_available }` — does not match spec

## Fix Instructions

In `services/recognition-service/src/main.rs`, update `get_status` (lines 201–211) to return:

```rust
let pid_loaded = models.iter().any(|m| m.domain == "pid" && m.loaded);
let dcs_loaded = models.iter().any(|m| m.domain == "dcs" && m.loaded);
let status = serde_json::json!({
    "domains": {
        "pid": {
            "model_loaded": pid_loaded,
            "hardware": "cpu",        // stub: "cpu" until ort CUDA detection is wired
            "mode": if pid_loaded { "cpu" } else { "disabled" }
        },
        "dcs": {
            "model_loaded": dcs_loaded,
            "hardware": "cpu",
            "mode": if dcs_loaded { "cpu" } else { "disabled" }
        }
    }
});
```

In `frontend/src/api/recognition.ts`, replace `RecognitionStatus` with:

```typescript
export interface DomainStatus {
  model_loaded: boolean
  hardware: string
  mode: 'gpu' | 'cpu' | 'disabled'
}

export interface RecognitionStatus {
  domains: {
    pid: DomainStatus
    dcs: DomainStatus
  }
}
```

In `frontend/src/pages/settings/Recognition.tsx` (`ServiceStatusCard`), update the stat items to read from `data.domains.pid` and `data.domains.dcs` instead of the flat fields.

Do NOT:
- Keep the old flat fields alongside the new shape — remove them
- Hard-code `mode: "disabled"` permanently; once `ort` is integrated the mode should reflect actual hardware
