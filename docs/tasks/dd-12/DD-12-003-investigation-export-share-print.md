---
id: DD-12-003
title: Add Export, Share, and Print actions to investigation toolbar
unit: DD-12
status: pending
priority: medium
depends-on: []
---

## What This Feature Should Do

The investigation toolbar must include Export, Share, and Print buttons. Export triggers the investigation export API (all standard formats: CSV, XLSX, JSON, PDF, HTML), shown behind the `forensics:export` permission. Share opens a dialog to share with specific users or roles, behind `forensics:share`. Print triggers the print rendering pipeline.

## Spec Excerpt (verbatim)

> Investigations can be exported in all standard I/O formats (CSV, XLSX, JSON, PDF, HTML). The export captures the full investigation: investigation metadata, each stage with its time range, evidence items, and annotations, trend charts rendered as images, correlation results as tables, point values as data tables, graphic snapshots as images.
> — 12_FORENSICS_MODULE.md, §Export, Print, and Embedding > Standalone Export

> [Toolbar] [Save] [Lock/Close] [Cancel] [Export] [Print] [Share]
> — 12_FORENSICS_MODULE.md, §UI Layout

## Where to Look in the Codebase

Primary files:
- `frontend/src/pages/forensics/InvestigationWorkspace.tsx` — toolbar at lines 1527–1587; Save/Close/Cancel exist; Export/Share/Print absent
- `frontend/src/api/forensics.ts` — look for `exportInvestigation` or `shareInvestigation` methods
- `frontend/src/shared/hooks/usePermission.ts` (or similar) — for hiding buttons based on `forensics:export` and `forensics:share`

## Verification Checklist

- [ ] Export button appears in toolbar and is hidden (not disabled) when user lacks `forensics:export` permission
- [ ] Clicking Export opens a format picker (CSV, XLSX, JSON, PDF, HTML) and calls `POST /api/forensics/investigations/:id/export`
- [ ] Share button appears and is hidden when user lacks `forensics:share`
- [ ] Clicking Share opens a dialog to share with users or roles
- [ ] Print button triggers the browser print dialog or server-side print pipeline
- [ ] All three buttons appear only when investigation exists (not during loading)

## Assessment

- **Status**: ❌ Missing
- **If partial/missing**: InvestigationWorkspace.tsx toolbar (lines 1527–1587) contains only Save, Close, and Cancel. No Export, Share, or Print buttons exist anywhere in the forensics module.

## Fix Instructions

In `frontend/src/pages/forensics/InvestigationWorkspace.tsx`, inside the toolbar `div` (after line 1580, before the closing `</>`):

1. **Export button** — wrap in a `usePermission('forensics:export')` check and render only when true:
   ```tsx
   {canExport && (
     <ExportMenu
       formats={['csv', 'xlsx', 'json', 'pdf', 'html']}
       onExport={(fmt) => forensicsApi.exportInvestigation(id, { format: fmt })}
     />
   )}
   ```
   If `ExportMenu` is not a shared component yet, render a simple dropdown of format options.

2. **Share button** — wrap in `usePermission('forensics:share')`:
   Opens a dialog with user/role selector; calls `POST /api/forensics/investigations/:id/share`.

3. **Print button** — no permission guard needed; calls `window.print()` or navigates to a print-optimized route.

4. Add `exportInvestigation` and `shareInvestigation` methods to `frontend/src/api/forensics.ts` if they do not exist.

Do NOT:
- Disable buttons when permission is lacking — they must be hidden entirely (CX-RBAC requirement)
- Show Export on closed investigations differently from active ones — export should work for both
