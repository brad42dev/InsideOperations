---
id: DD-26-001
title: Rename inference route from /recognition/infer to /recognition/detect
unit: DD-26
status: done
priority: medium
depends-on: []
---

## What This Feature Should Do

The recognition service exposes an inference endpoint that the API Gateway proxies as `POST /api/recognition/detect`. The current implementation routes to `/recognition/infer`, which means all API clients — including the frontend `recognitionApi.runInference()` and any external callers — would receive 404 responses when they use the spec-mandated path.

## Spec Excerpt (verbatim)

> POST   /api/recognition/detect
>        Body: multipart/form-data { image: File, options?: { confidence_threshold?: number, domain?: "pid" | "dcs" | "auto" } }
>        "auto" (default) auto-detects domain from image characteristics
>        Response: { domain: "pid" | "dcs", detections: [...], ocr_results: [...], line_results?: [...] }
> — design-docs/26_PID_RECOGNITION.md, §API Endpoints > Recognition

## Where to Look in the Codebase

Primary files:
- `services/recognition-service/src/main.rs:240` — current route `.route("/recognition/infer", post(run_inference))`
- `frontend/src/api/recognition.ts:73` — `api.post('/api/recognition/infer', body)` — also needs updating when the route changes

## Verification Checklist

- [ ] Route in main.rs reads `.route("/recognition/detect", ...)` (not `/recognition/infer`)
- [ ] Handler accepts `multipart/form-data` with an `image` file field and optional `options` JSON field (not `image_base64` in JSON body)
- [ ] Response type includes `domain`, `detections`, `ocr_results` fields
- [ ] Frontend `recognitionApi` calls `/api/recognition/detect` not `/api/recognition/infer`
- [ ] `RunInferenceBody` struct updated to reflect multipart form not JSON body

## Assessment

- **Status**: ⚠️ Partial — endpoint exists but at wrong path and with wrong input shape (JSON `image_base64` instead of multipart `image` file)

## Fix Instructions

In `services/recognition-service/src/main.rs`:

1. Rename the route from `/recognition/infer` to `/recognition/detect`:
   - Line 240: change `.route("/recognition/infer", post(run_inference))` to `.route("/recognition/detect", post(run_inference))`

2. Update the handler to accept `Multipart` (not JSON). The spec input is `multipart/form-data { image: File, options?: { ... } }`. Change `run_inference` to use `mut multipart: Multipart` and extract the `image` file and optional `options` JSON field from it.

3. Update `RunInferenceBody` or remove it in favour of the multipart handler. The stub can still return empty detections — just correct the interface.

4. In `frontend/src/api/recognition.ts:73`, update the path from `/api/recognition/infer` to `/api/recognition/detect` and update `RunInferenceBody`/`runInference` to send `FormData` with an `image` file rather than a JSON body.

Do NOT:
- Change the handler logic (it is still a stub — that is acceptable for this phase)
- Add the `detect` route as an alias and keep `infer` — the old path must be removed
