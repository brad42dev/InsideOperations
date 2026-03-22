---
id: DD-26-007
title: Implement recognition import wizard in Designer module
unit: DD-26
status: pending
priority: high
depends-on: [DD-26-001, DD-26-002, DD-26-003]
---

## What This Feature Should Do

The Designer module should offer an import wizard that allows users to upload a P&ID or DCS image (PNG, JPEG, PDF, TIFF), run recognition against it, review detected symbols with color-coded confidence overlays (green/yellow/red), accept/reject/correct each detection, and generate an SVG graphic with detected symbols placed at their bounding-box positions with point binding placeholders. This is the primary user-facing feature of the recognition system. Currently there is no recognition integration anywhere in the Designer module.

## Spec Excerpt (verbatim)

> ### Import Wizard Flow
> 1. **Upload**: User uploads an image (PNG, JPEG, PDF, TIFF) via Designer
> 2. **Domain Selection**: System auto-detects domain (P&ID or DCS) or user selects explicitly
> 3. **Detect**: Recognition Service runs the appropriate inference pipeline, returns detected symbols
> 4. **Review**: User sees the original image with detections overlaid
>    - Color coding: green (high confidence > 0.90), yellow (medium 0.70-0.90), red (low < 0.70)
>    - User can: accept (checkmark), reject (X), or correct (change class via dropdown)
>    - User can switch domain if auto-detection was wrong
> 5. **Map**: Accepted detections are mapped to I/O's SVG template library
> 6. **Generate**: I/O creates an SVG graphic with detected symbols placed at their bounding box positions
> 7. **Refine**: User opens the generated graphic in Designer for manual refinement
>
> ### Permission
> The import wizard requires the `designer:import` permission (already exists). No new permissions are needed for recognition specifically.
> — design-docs/26_PID_RECOGNITION.md, §Designer Module Integration

## Where to Look in the Codebase

Primary files:
- `frontend/src/pages/designer/` — no recognition-related files present
- `frontend/src/api/recognition.ts` — has `runInference` and `uploadGapReport` but no `submitCorrections` or `generateGraphic` functions
- `frontend/src/App.tsx:1007–1012` — `settings/recognition` route exists but no designer wizard route

## Verification Checklist

- [ ] A "Recognize Image" or equivalent trigger exists in the Designer toolbar or file-import flow
- [ ] Wizard step 1: file picker accepting PNG, JPEG, PDF, TIFF
- [ ] Wizard step 2: domain auto-detection result displayed; user can override
- [ ] Wizard step 3: POST to `/api/recognition/detect` with the image file; spinner while waiting
- [ ] Wizard step 4: image displayed with bounding box overlays; color-coded by confidence (green/yellow/red thresholds as specified); each box has accept/reject/correct controls
- [ ] Wizard step 5–6: "Generate" button calls `POST /api/recognition/generate`; success navigates to the new graphic in Designer
- [ ] When recognition service returns 503 (no model loaded), the import wizard option is hidden or shows a "Recognition not available" message — not a broken wizard flow
- [ ] Requires `designer:import` permission (use existing permission guard pattern)

## Assessment

- **Status**: ❌ Missing — no recognition wizard exists in the Designer module

## Fix Instructions

Create `frontend/src/pages/designer/components/RecognitionWizard.tsx` as a multi-step wizard modal/panel:

**Step structure:**
- Step 1 (`upload`): `<input type="file" accept=".png,.jpg,.jpeg,.pdf,.tif,.tiff">` — on select, call `POST /api/recognition/detect` with `multipart/form-data { image: File, options: { domain: "auto" } }`
- Step 2 (`review`): Render the uploaded image with `<svg>` overlay of bounding boxes. Each detection renders a `<rect>` with stroke color based on confidence (`>0.90` = green `#22c55e`, `0.70–0.90` = yellow `#eab308`, `<0.70` = red `#ef4444`). Each box has three icon buttons: accept (checkmark sets `accepted: true`), reject (X sets `rejected: true`), correct (opens dropdown of class names from `GET /api/recognition/classes?domain={domain}`).
- Step 3 (`generate`): "Generate Graphic" button — call `POST /api/recognition/generate` with accepted detections. On success: navigate to the new graphic ID in Designer. Also call `POST /api/recognition/feedback/corrections` with any corrected/rejected detections.

**Graceful degradation:**
- Before showing the wizard, check `GET /api/recognition/status`. If both domains show `mode: "disabled"`, render a message instead of the wizard: "Symbol recognition is not available. No model is loaded. Contact your administrator."

**Integration point:**
- Add a "Recognize Image" button to the existing import flow in the Designer (look for the file import entrypoint, likely in the toolbar or a menu — check `frontend/src/pages/designer/` for import-related components).

**Permission:**
- Wrap the wizard trigger in a check for `designer:import` permission using the existing `usePermission` hook or `PermissionGuard` component pattern used elsewhere in the app.

Do NOT:
- Add new RBAC permissions — `designer:import` already covers this
- Block the main Designer from loading when recognition service is down — it is graceful degradation only
- Implement actual ONNX preprocessing in the frontend — the frontend only calls the backend API
