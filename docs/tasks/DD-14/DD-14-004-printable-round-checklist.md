---
id: DD-14-004
title: Implement printable round checklist (blank and current results modes)
unit: DD-14
status: pending
priority: low
depends-on: []
---

## What This Feature Should Do

A Print button in the Rounds module opens a dialog where the user selects a template, a mode (blank or current results), and a page size. The blank mode renders a table-format checklist with empty fields for handwritten entry. The current results mode pre-fills the table with data from the most recent completed round. The printed output includes HH/H/L/LL thresholds in the Expected Range column, multi-field checkpoints expanded to sub-rows, a header with template name and blank operator/shift lines, a footer with page number and "UNCONTROLLED COPY" watermark, and white background/dark text per print color normalization.

## Spec Excerpt (verbatim)

> The Print button in the Rounds module generates a paper-backup checklist from a round template.
> **Print dialog options**: Template (select), Mode (blank checklist / current results), Page size (Letter or A4)
> **Blank checklist format**: Table layout with columns: Checkpoint # | Equipment ID | Location | Description | Expected Range | Reading | Pass/Fail | Notes
> **Current results format**: Same table but Reading and Pass/Fail columns pre-filled with most recent completed round
> Footer: "UNCONTROLLED COPY" watermark
> — 14_ROUNDS_MODULE.md, §Printable Round Checklist

## Where to Look in the Codebase

Primary files:
- `frontend/src/pages/rounds/index.tsx` — main rounds page; Print button should live in the header toolbar (currently only has tabs and offline status indicators)
- `frontend/src/pages/rounds/RoundTemplates.tsx` — templates list; Print button could also appear per-template
- `frontend/src/api/rounds.ts` — getTemplate and getInstance calls already exist; no print API needed (client-side print)

## Verification Checklist

Read the code at the files listed above. Check each item:

- [ ] A Print button exists in the rounds module header or template list toolbar
- [ ] Clicking Print opens a dialog with template selector, mode toggle (blank/current), and page size selector
- [ ] The dialog renders a hidden print area that becomes visible only when printing (via @media print)
- [ ] Blank mode renders the 8-column table with empty Reading/Pass/Fail cells
- [ ] Current results mode fetches the most recent completed instance and pre-fills the table
- [ ] Numeric checkpoints show HH/H/L/LL thresholds in Expected Range column
- [ ] Multi-field checkpoints expand to one row per sub-field
- [ ] Footer includes "UNCONTROLLED COPY" text and page number
- [ ] @media print CSS sets background to white and text to dark

## Assessment

- **Status**: ❌ Missing — no Print button in any rounds file; no print dialog component; no @media print styles

## Fix Instructions (if needed)

1. **Add a PrintDialog component** — create `frontend/src/pages/rounds/PrintDialog.tsx`. It renders:
   - A modal (Radix Dialog) with Template select, Mode radio (blank/current), Page size radio (Letter/A4)
   - On "Print": loads template data via `roundsApi.getTemplate(templateId)`, optionally loads latest completed instance history, then calls `window.print()`

2. **Print area** — inside PrintDialog, render a hidden `<div id="rounds-print-area">` containing:
   - Header: template name, site name, print date, blank "Operator: ___" and "Shift: ___" lines
   - Table with columns: # | Equipment ID | Location | Description | Expected Range | Reading | Pass/Fail | Notes
   - For numeric checkpoints: Expected Range = "HH:{hh} H:{h} L:{l} LL:{ll}" if alarm mode, or "min–max" if limit mode
   - For dropdown checkpoints: Expected Range = option list joined by " / "
   - For multi_field checkpoints: expand to N rows (one per sub-field), group with thin border
   - Footer: "UNCONTROLLED COPY" centered, page number right-aligned

3. **@media print CSS** — add to the component or a global print stylesheet:
   ```css
   @media print {
     body > * { display: none !important; }
     #rounds-print-area { display: block !important; background: white; color: black; }
   }
   ```

4. **Print button** — add to `frontend/src/pages/rounds/index.tsx` header area (around line 299, next to the New Template button area) and to `RoundTemplates.tsx` per-template actions.

5. Print button is only shown to users with `rounds:read` permission (already guarded by route, but hide if lacking explicit print access once `rounds:print` is specced — for now gate on `rounds:read`).

Do NOT:
- Generate a PDF via the backend for this feature — the spec says "Print button" which implies client-side `window.print()`
- Show the print area outside of print context — it should be hidden on screen
- Implement watermark as a logo image — plain text "UNCONTROLLED COPY" is sufficient per spec
