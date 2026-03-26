---
id: DD-26-006
title: Auto-detect model domain from manifest.json inside .iomodel ZIP (not from form field)
unit: DD-26
status: done
priority: medium
depends-on: [DD-26-005]
---

## What This Feature Should Do

When an admin uploads a `.iomodel` file, the system should read the `model_domain` field from `manifest.json` inside the ZIP to determine whether it is a P&ID or DCS model — not accept a `domain` field from the form submission. Accepting domain from the form allows misclassification (e.g., uploading a DCS model but selecting P&ID in the UI). The spec explicitly states this: domain is always auto-detected from the manifest.

## Spec Excerpt (verbatim)

> POST   /api/recognition/model
>        Body: multipart/form-data { model: File (.iomodel) }
>        Domain auto-detected from manifest.json model_domain field
>        Response: { domain: string, version: string, classes: number, validation: { passed: boolean, details: string } }
> — design-docs/26_PID_RECOGNITION.md, §API Endpoints > Model Management

## Where to Look in the Codebase

Primary files:
- `services/recognition-service/src/main.rs:109–148` — `upload_model` reads `domain` from a multipart form field named `"domain"` (lines 116–119)
- `frontend/src/api/recognition.ts:77–108` — `uploadModel(file, domain)` appends `domain` to FormData (line 81)
- `frontend/src/pages/settings/Recognition.tsx:169–186` — calls `recognitionApi.uploadModel(file, uploadDomain)` with user-selected domain

## Verification Checklist

- [ ] `upload_model` in main.rs no longer reads a `"domain"` field from the multipart form
- [ ] `domain` is read exclusively from `manifest.json` → `model_domain` key inside the ZIP
- [ ] If `manifest.json` is missing or `model_domain` is not `"pid"` or `"dcs"`, the upload is rejected with a clear error
- [ ] Frontend `recognitionApi.uploadModel` signature no longer accepts a `domain` parameter
- [ ] Settings > Recognition UI removes the domain selector dropdown (the domain is now shown in the response, not selected before upload)

## Assessment

- **Status**: ⚠️ Wrong — domain is taken from form field, not from manifest.json

## Fix Instructions

In `services/recognition-service/src/main.rs`, in the `upload_model` handler:

1. Remove the `"domain"` multipart field handling (lines 116–119)
2. After receiving the `file` bytes, unpack the ZIP and read `manifest.json` (this is also covered in DD-26-005)
3. Extract `model_domain` from the parsed manifest JSON
4. Validate: `model_domain` must be `"pid"` or `"dcs"` — reject with `IoError::InvalidInput` otherwise
5. Use the manifest-derived domain to set `model.domain`

In `frontend/src/api/recognition.ts`:
- Remove the `domain: string` parameter from `uploadModel`
- Remove `form.append('domain', domain)` from the FormData

In `frontend/src/pages/settings/Recognition.tsx`:
- Remove the `<select>` for `uploadDomain` (lines 192–206)
- Remove `const [uploadDomain, setUploadDomain] = useState<'pid' | 'dcs'>('pid')` state
- After a successful upload, show the domain from the response (e.g., "Uploaded DCS model v1.0.0")

Do NOT:
- Keep the domain form field as an optional override — the spec says domain is always auto-detected
- Break the existing upload button flow — it should still work, just without the domain selector
