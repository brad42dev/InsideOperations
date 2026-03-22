---
id: DD-34-003
title: Implement 6-step DCS Import Wizard in Designer
unit: DD-34
status: pending
priority: high
depends-on: [DD-34-004]
---

## What This Feature Should Do

The Designer's Import Graphics page currently shows a "Coming Soon" placeholder. It needs to become a 6-step wizard: (1) Upload ZIP or raw DCS file with platform selector, (2) Preview parsed intermediate representation, (3) Tag mapping side-by-side UI, (4) Symbol mapping with shape library templates, (5) Generate the I/O graphic, (6) Refine in Designer with import report sidebar. The wizard should detect whether the user uploaded an image (routes to Recognition Wizard) or a ZIP/DCS file (routes to this DCS Import Wizard).

## Spec Excerpt (verbatim)

> ### DCS Graphics Import Wizard Steps
> 1. **Upload**: User uploads extraction kit `.zip` or raw DCS file(s). System reads `manifest.json` to identify platform, or auto-detects format from file contents.
> 2. **Preview**: Parsed intermediate representation rendered as a preview. User sees the extracted geometry and a summary: element count, tag count, unmapped symbols count, warnings.
> 3. **Tag Mapping**: Side-by-side display of extracted DCS tags (left) and I/O's available points (right). Auto-matched tags highlighted in green. Unmatched tags shown with a search/select control.
> 4. **Symbol Mapping**: Extracted equipment symbols mapped to I/O's shape library. Auto-matched symbols highlighted. Unmapped symbols shown with template selector.
> 5. **Generate**: I/O graphic created in `design_objects` table. Import report generated.
> 6. **Refine**: Generated graphic opens in Designer with standard editing tools. A sidebar panel shows the import report for reference.
> — `34_DCS_GRAPHICS_IMPORT.md`, §DCS Graphics Import Wizard

> ### Wizard Entry Point
> | Input | Route |
> | Image file (PNG, JPEG, PDF, BMP) | Existing DCS Recognition Wizard |
> | `.zip` extraction kit output | DCS Graphics Import Wizard |
> | Raw DCS files (`.htm`, `.xml`, `.xaml`, `.g`, `.svg`) | DCS Graphics Import Wizard with auto-detected platform |
> — `34_DCS_GRAPHICS_IMPORT.md`, §Wizard Entry Point

## Where to Look in the Codebase

Primary files:
- `frontend/src/pages/designer/DesignerImport.tsx` — currently a stub at line 3; must be replaced with a real wizard
- `frontend/src/api/dcsImport.ts` — `uploadDcsImport()` and `createGraphicFromDcsResult()` API functions exist but are never called
- `frontend/src/pages/designer/components/IographicImportWizard.tsx` — existing wizard component for `.iographic` files; use as structural reference

## Verification Checklist

Read the code at the files listed above. Check each item:

- [ ] `DesignerImport.tsx` renders a multi-step wizard (not a "Coming Soon" stub)
- [ ] Step 1: file upload input accepts `.zip` and common DCS file extensions; platform selector shown; image files (PNG/JPEG/PDF/BMP) are routed to the existing Recognition Wizard path
- [ ] Step 2: after upload, preview shows element count, tag count, unresolved symbols count, and a visual canvas preview of extracted geometry
- [ ] Step 3: tag mapping UI shows extracted DCS tags on left, I/O point search on right; auto-matches highlighted in green
- [ ] Step 4: symbol mapping UI shows equipment elements with template selector from shape library
- [ ] Step 5: Generate button calls the generate endpoint and shows the import report
- [ ] Step 6: on success, navigates to `/designer/:id` to open the generated graphic
- [ ] `uploadDcsImport()` from `dcsImport.ts` is called in Step 1 to upload the file
- [ ] `createGraphicFromDcsResult()` (or the job-based equivalent from DD-34-004) is called in Step 5

## Assessment

- **Status**: ❌ Missing
- `DesignerImport.tsx` is 60 lines rendering a single "Import — Coming Soon" message (line 53). No wizard steps, no file upload, no mapping UI. The `dcsImport.ts` API functions exist but are imported by no file in the project.

## Fix Instructions

Replace `frontend/src/pages/designer/DesignerImport.tsx` with a full 6-step wizard component. The wizard state should track:
```typescript
type WizardStep = 'upload' | 'preview' | 'tag-mapping' | 'symbol-mapping' | 'generate' | 'refine'
```

**Step 1 — Upload:**
- `<input type="file" accept=".zip,.htm,.xml,.xaml,.g,.svg">` with drag-and-drop zone
- Platform selector using `PLATFORMS` from `dcsImport.ts` (render `PlatformInfo.name` with `support` badge)
- On file select: check extension; if image extension (`.png`, `.jpg`, `.jpeg`, `.pdf`, `.bmp`) navigate to `/designer/import/recognition` instead
- On submit: call `uploadDcsImport(platform, file)` from `dcsImport.ts`; transition to Step 2 on success

**Step 2 — Preview:**
- Show `result.display_name`, `result.element_count`, `result.unresolved_symbols.length`, tags count from `result.tags`
- Render a scaled-down SVG canvas using element x/y/width/height from `result.elements` — basic rectangles are fine
- Show any `result.import_warnings` as a warning list

**Step 3 — Tag Mapping:**
- Left column: list of `result.elements` that have a non-null `tag` field
- Right column: search input calling `GET /api/points?search={query}` to find I/O points
- Store user's mapping decisions in local state `Map<elementId, pointId>`
- "Accept auto-matches" button, "Skip" per tag, "Create placeholder" option

**Step 4 — Symbol Mapping:**
- Show elements where `symbol_class !== null`
- Each row: source `symbol_class` + template selector using `GET /api/shapes` response
- "Mark as static shape" option per row

**Step 5 — Generate:**
- If using the simple synchronous path (DD-34-004 not yet done): call `createGraphicFromDcsResult()` from `dcsImport.ts` — that function is already complete
- If using the job API (after DD-34-004): `POST /api/designer/import/dcs/:id/generate`
- Show the import report (counts, warnings)

**Step 6 — Refine:**
- Navigate to `/designer/:newGraphicId`

Use Radix UI components for the step indicator, tables, and selectors. Follow existing wizard structure from `IographicImportWizard.tsx` for layout patterns.

Do NOT:
- Remove the "← Designer" back button from the page header
- Implement tag matching logic in the frontend — that belongs in the backend (DD-34-004)
- Use `createGraphicFromDcsResult()` as the permanent generate path; it's a bridge until the job API is implemented
