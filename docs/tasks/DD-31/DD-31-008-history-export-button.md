---
id: DD-31-008
title: Add Export button to Alert History table (CX-EXPORT)
unit: DD-31
status: pending
priority: medium
depends-on: []
---

## What This Feature Should Do

The Alert History view must expose an Export button in its toolbar. Export must respect the active severity filter and produce files in all 6 required formats: CSV, XLSX, PDF, JSON, Parquet, HTML. The button must be hidden when the user lacks the relevant export permission. Rows below 50,000 stream synchronously; 50,000+ go async with a WebSocket completion notification.

## Spec Excerpt (verbatim)

> Every qualifying module table/toolbar has an Export button. It is not buried in a menu.
> Supported formats: CSV, XLSX, PDF, JSON, Parquet, HTML (6 formats). Fewer formats is wrong.
> Export inherits the current view's active filters, sort order, and visible columns — WYSIWYG export.
> — `docs/SPEC_MANIFEST.md`, §CX-EXPORT Non-negotiables

## Where to Look in the Codebase

Primary files:
- `frontend/src/pages/alerts/AlertHistory.tsx` lines 88–198 — add export button to the header area (around line 90)
- `frontend/src/pages/alerts/index.tsx` lines 606–760 — `HistoryPanel` component — same issue in the composite view

## Verification Checklist

- [ ] Export button is visible in the Alert History toolbar (not buried in a menu)
- [ ] Clicking Export opens a format picker with all 6 options: CSV, XLSX, PDF, JSON, Parquet, HTML
- [ ] Export request includes the active `severity` filter parameter
- [ ] Button is hidden (not disabled) when user lacks the relevant export permission
- [ ] Filename follows convention: `alerts_history_YYYY-MM-DD_HHmm.{ext}`

## Assessment

- **Status**: ❌ Missing
- **If missing**: `AlertHistory.tsx:88-198` has a severity filter dropdown and pagination but no export button. `index.tsx:606-760` `HistoryPanel` has the same omission. Neither file shows any export-related code.

## Fix Instructions

1. In `AlertHistory.tsx`, add an Export button to the header row (line 90–114 area), next to the severity filter dropdown.
2. On click, show a format picker (can be a `<select>` or a small dropdown menu) with the 6 required formats.
3. On format select, call a new `notificationsApi.exportMessages({ severity, format })` method that hits the appropriate export endpoint (work with the backend team to add `GET /api/notifications/export?format=csv&severity=...`).
4. For synchronous exports (< 50k rows), use a browser-download anchor. For async exports, show a toast and wait for the `export_complete` WebSocket event.
5. Apply the same fix to `HistoryPanel` in `index.tsx`.

Do NOT:
- Offer only CSV — all 6 formats are required
- Export all rows without applying the active severity filter
- Disable the button when lacking permission — hide it
