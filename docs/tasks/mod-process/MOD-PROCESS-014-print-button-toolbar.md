---
id: MOD-PROCESS-014
title: Add Print button to view toolbar (gated by process:export)
unit: MOD-PROCESS
status: pending
priority: medium
depends-on: []
---

## What This Feature Should Do

The Process module view toolbar must include a `[Print]` button that triggers server-side PDF generation for the current graphic. The button is hidden (not disabled) for users who lack `process:export` permission. Printing is a primary use case for process overviews (wall-mount A1/A3 prints for control rooms).

## Spec Excerpt (verbatim)

> **Right group (actions):**
> - Export split button `[Export ▾]` (same as Console §10.1)
> - Print button `[Print]`
> - Bookmark button `[★]` — creates a bookmark at current viewport position (Ctrl+Shift+B)
> - Fullscreen button `[⛶]` — browser fullscreen (F11)
> — process-implementation-spec.md, §2.5

> **Print button | process:export | process:export**
> — process-implementation-spec.md, §16.1

> Large-format wall-mount prints (A1/A3) of process overviews are a PRIMARY use case.
> — process-implementation-spec.md, §10.2

## Where to Look in the Codebase

Primary files:
- `frontend/src/pages/process/index.tsx:1347-1525` — view toolbar JSX (Print button is absent)
- `frontend/src/pages/process/index.tsx:384` — `canExport = usePermission('process:export')` (reuse this guard)
- `frontend/src/api/exports.ts` — check for a print endpoint or use the existing export API with a `pdf` scope

## Verification Checklist

- [ ] `[Print]` button appears in the view toolbar to the right of the Export button.
- [ ] Button is hidden (not rendered) when the user lacks `process:export` permission.
- [ ] Clicking `[Print]` invokes the server-side PDF generation endpoint (`POST /api/process/print` per spec §14.2).
- [ ] Print button is styled consistently with the Export and Fullscreen buttons in the same toolbar row.
- [ ] Ctrl+P shortcut triggers the same action (keyboard shortcut spec §12.1).

## Assessment

- **Status**: ❌ Missing
- `index.tsx:1347-1525` — the toolbar contains Zoom controls, Live/Historical toggle, Bookmark, Export, and Fullscreen. No Print button.

## Fix Instructions

In `frontend/src/pages/process/index.tsx`, inside the view toolbar JSX (after the Export split button, around line 1508), add:

```tsx
{/* Print button — gated by process:export, same as Export */}
{canExport && (
  <button
    onClick={handlePrint}
    title="Print graphic (server-side PDF)"
    style={toolbarBtnStyle}
  >
    Print
  </button>
)}
```

Add the `handlePrint` function near the `handleExport` function:

```typescript
const handlePrint = useCallback(async () => {
  try {
    await exportsApi.create({
      module: 'process',
      entity: 'graphic',
      format: 'pdf',
      scope: 'print',
      columns: selectedId ? [selectedId] : [],
    })
  } catch (err) {
    console.error('[Process] Print failed:', err)
  }
}, [selectedId])
```

Check `frontend/src/api/exports.ts` for the exact API shape. If the exports API doesn't support a `print` scope, fall back to `format: 'pdf'` with `scope: 'all'`. The backend endpoint is `POST /api/process/print` per spec §14.2.

Also add the `Ctrl+P` keyboard shortcut in the `onKeyDown` handler (around line 922):
```typescript
if (ctrl && e.key === 'p') { e.preventDefault(); void handlePrint(); return }
```

Do NOT:
- Use `window.print()` — that is browser print, not the server-side PDF (spec §10.2 explicitly requires server-side).
- Gate the button on a different permission — `process:export` is correct.
- Disable the button instead of hiding it — spec §16.1 says hidden when permission lacking.
