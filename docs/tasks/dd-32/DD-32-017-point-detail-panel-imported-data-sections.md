---
id: DD-32-017
title: PointDetailPanel — render dynamic imported-data sections (work orders, inventory, tickets)
unit: DD-32
status: pending
priority: medium
depends-on: []
---

## What This Feature Should Do

The Point Detail panel must dynamically render sections for each external dataset connected to a point via Data Links (doc 24). For example, if a point is linked to a Maximo work order dataset, a "Work Orders (RefineryBMaximo01)" section appears listing open and recent WOs. If linked to SAP inventory, an "Inventory (Site7SAP02)" section shows stock levels. The sections are configured per import connection in Settings > Integrations > Point Detail, and the panel fetches them as part of `GET /api/v1/points/:id/detail`. Each section respects RBAC data category permissions — hidden if the user lacks access.

## Spec Excerpt (verbatim)

> **Imported data sections** (configured per dataset):
>
> Each connected import definition can become a section. The admin picks:
> 1. Dataset (by name, e.g., "RefineryBMaximo01")
> 2. Which linked records to show (work orders, inventory items, tickets)
> 3. Display label override
>
> The panel fetches all sections in a single `GET /api/v1/points/:id/detail` call. The response includes a `sections` array — one entry per configured dataset section. If the array is empty the panel renders only built-in sections (Process Data, Alarm Data, Graphics).
>
> Data shown in each section respects existing RBAC data category permissions — if a user can't see maintenance data, the work orders section is hidden regardless of configuration.
> — design-docs/32_SHARED_UI_COMPONENTS.md, §Point Detail Panel — Imported Data Sections

## Where to Look in the Codebase

Primary files:
- `frontend/src/shared/components/PointDetailPanel.tsx` — panel body where Alarm Data and Graphics sections are rendered (lines 843-847); add the dynamic sections loop after Graphics
- `frontend/src/api/points.ts` — `PointDetailResponse` type; check whether `sections` array is already in the type or needs adding
- `frontend/src/shared/components/PointDetailPanel.tsx` lines 253-459 — `AlarmDataSection` and `GraphicsSection` are the pattern to follow for the new dynamic sections

## Verification Checklist

- [ ] `PointDetailResponse` (in `frontend/src/api/points.ts`) includes a `sections?: ImportedDataSection[]` field where each entry has at minimum `{ label: string; dataset: string; records: ImportedRecord[] }`
- [ ] `PointDetailPanel.tsx` maps over `detail.sections` (when non-empty) and renders one collapsible `SectionContainer` per entry, below the Graphics section
- [ ] Each section renders its records list (at minimum: record ID / number, title/description, status)
- [ ] Sections with zero records render an empty state ("No records linked") rather than crashing or hiding completely
- [ ] If `detail.sections` is absent or empty the panel renders identically to its current state (no regression)

## Assessment

- **Status**: ❌ Missing
- **What needs to change**: `PointDetailPanel.tsx` has no imported-data section rendering. The panel body (around line 847, after GraphicsSection) needs a dynamic map over `detail.sections`. The `PointDetailResponse` type likely needs a `sections` field added.

## Fix Instructions

1. **Add `sections` to `PointDetailResponse`** in `frontend/src/api/points.ts`:
   ```ts
   export interface ImportedRecord {
     id: string
     title: string
     status?: string
     url?: string        // external URL if configured
     fields?: Record<string, string>  // additional label → value pairs
   }
   export interface ImportedDataSection {
     label: string       // e.g. "Work Orders (RefineryBMaximo01)"
     dataset: string     // import connection name
     records: ImportedRecord[]
   }
   // Add to PointDetailResponse:
   sections?: ImportedDataSection[]
   ```

2. **Add `ImportedDataSection` component** in `PointDetailPanel.tsx`, following the `AlarmDataSection` pattern (lines 253-335). The section should:
   - Use `SectionContainer` wrapper (already defined)
   - Render each record as a row: ID/title left, status right, optional clickable URL

3. **Wire into panel body** — after `<GraphicsSection pointId={pointId} />` (line 847), add:
   ```tsx
   {detail.sections?.map((section) => (
     <ImportedDataSection key={section.dataset} section={section} />
   ))}
   ```
   where `detail` is the data from the existing `useQuery` call at the top of the component.

4. **No backend implementation needed for this task** — the backend `GET /api/v1/points/:id/detail` endpoint is out of scope here. If the endpoint does not yet return `sections`, the panel should handle `sections: undefined` gracefully (renders nothing, no error).

Do NOT:
- Break the existing Alarm Data or Graphics sections
- Add a separate API call for imported sections — they must come from the existing single `detail` query
- Render the sections when `detail.sections` is undefined or an empty array (no empty section headers)
