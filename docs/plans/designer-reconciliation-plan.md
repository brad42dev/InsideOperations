# Designer Reconciliation Plan

> **Written by**: Opus planning agent  
> **Status**: Approved for implementation  
> **Last updated**: 2026-04-05

---

## Executive Summary

The I/O frontend contains two incompatible designer implementations for dashboards. **Version A** (the full Designer at `/designer/*`) uses a scene-graph architecture backed by `design_objects` via `graphicsApi`, with undo/redo, pessimistic locking, auto-save, version history, and three modes (Graphic/Dashboard/Report). **Version B** (DashboardBuilder at `/dashboards/new` and `/dashboards/:id/edit`) is a monolithic 1,933-line component that writes flat `WidgetConfig[]` arrays to the `dashboards` table via `dashboardsApi`. Per the authoritative spec (`designer-implementation-spec.md`), Version A is the correct target state: all dashboards should be scene-graph documents in `design_objects`.

The reconciliation has four key challenges: (1) dead code that creates confusion and maintenance burden, (2) routing conflicts where `/dashboards/*` edit routes point to DashboardBuilder instead of the Designer, (3) a data model conflict where 8 seeded system dashboards live in the `dashboards` table but the spec requires them as `GraphicDocument` scene graphs in `design_objects`, and (4) the 35 widget rendering components under `pages/dashboards/widgets/` that are used by both DashboardBuilder and DashboardViewer and must be preserved for the viewer while the builder is retired. Additionally, Version A has spec gaps (phone preview, SVG export, rulers/guides rendering, smart guides) that should be addressed after the structural reconciliation is complete.

The plan is organized into five phases, each independently shippable. Phase 1 is pure cleanup with zero behavioral change. Phase 2 rewires routes and the Dashboards module viewer to coexist with the Designer. Phase 3 migrates the 8 system dashboards from `dashboards` table to `design_objects` and introduces a converter. Phase 4 removes DashboardBuilder entirely. Phase 5 fills the remaining Version A spec gaps. Each phase has explicit success criteria and rollback paths.

---

## Dependency Graph

```
Phase 1 (Dead Code)          ─────────────────────────→  Can ship independently
Phase 2 (Route Consolidation) ───────────────────────→  Can ship after Phase 1 (or independently)
Phase 3 (Dashboard Conversion) ──────────────────────→  Requires Phase 2
Phase 4 (DashboardBuilder Removal) ──────────────────→  Requires Phase 2 and Phase 3
Phase 5 (Spec Gap Closure)   ─────────────────────────→  Can start after Phase 1; sub-items are independent
```

---

## Key Architectural Decisions

1. **System dashboards stay in `dashboards` table.** The 8 seeded system dashboards use 20+ specialized widget types that have no scene graph equivalents. Migrating them would require either polluting the `WidgetType` union with system-specific types or losing functionality. They remain as-is.

2. **DashboardViewer remains a separate component.** It reads from `dashboardsApi` for legacy/system dashboards. Scene-graph dashboards created in the Designer are viewed through the Designer in read-only mode (the existing `/designer/dashboards/:id` route with `designer:read` permission).

3. **Widget rendering components are shared, not duplicated.** The 35 widget components in `pages/dashboards/widgets/` are reused by both the DashboardViewer (for legacy dashboards) and the Designer's HTML overlay (for scene-graph dashboards in test mode or preview). They stay in their current location.

4. **Conversion is on-demand, not automatic.** Users who want to edit legacy dashboards in the full Designer can use the "Convert to Designer Format" action. This avoids risky automatic migrations and gives users control.

5. **No backend API changes.** Both `graphicsApi` (`/api/v1/design-objects/*`) and `dashboardsApi` (`/api/dashboards/*`) continue to operate unchanged. The reconciliation is purely a frontend routing and UI concern, plus an optional client-side data converter.

---

## Phase 1: Dead Code Removal and Hygiene

**Risk:** Low — Zero behavioral change  
**Ships:** Independently

### Goal
Remove confirmed dead code that has zero imports anywhere in the codebase, reducing confusion for future development work.

### Files to Delete
- `frontend/src/pages/designer/panels/Toolbar.tsx` (1,115 lines, zero imports)
- `frontend/src/pages/designer/panels/PropertyPanel.tsx` (1,318 lines, zero imports)
- `frontend/src/pages/designer/panels/StatusBar.tsx` (192 lines, zero imports)
- `frontend/src/pages/designer/types.ts` (51 lines, only imported by the three dead panel files above)

If `panels/` directory becomes empty after deletion, remove the directory too.

### Detailed Steps
1. Verify zero imports: run a project-wide search for `from.*designer/panels/Toolbar`, `from.*designer/panels/PropertyPanel`, `from.*designer/panels/StatusBar`, and `from.*designer/types` (the one at `pages/designer/types.ts`, NOT `shared/types`). Confirm no live code references any of these files.
2. Delete the four files listed above.
3. Remove the `panels/` directory if empty.
4. Run `tsc --noEmit` to confirm no type errors.
5. Run `pnpm test` to confirm no regressions.
6. Run `pnpm build` to confirm production build is clean.

### Success Criteria
- TypeScript compilation passes with zero new errors.
- All existing tests pass.
- Production build succeeds.
- The 4 deleted files no longer exist on disk.
- No behavioral change to the application.

### Risk Notes
Essentially zero risk. These files have no runtime imports. The only risk is a dynamic `import()` reference, which does not exist (verified during research).

---

## Phase 2: Route Consolidation

**Risk:** Medium — User-facing route changes  
**Ships:** After Phase 1 (or independently)

### Goal
Make the `/dashboards/:id/edit` and `/dashboards/new` routes redirect to the full Designer in dashboard mode, while preserving the read-only DashboardViewer at `/dashboards/:id` and the DashboardsPage listing at `/dashboards`. After this phase, all dashboard *editing* happens through the Designer. Dashboard *viewing* continues via the existing DashboardViewer which reads from `dashboardsApi`.

### Files to Modify

**`frontend/src/App.tsx`** — routing changes:
- The `/dashboards/new` route: change `element` from `<DashboardBuilder />` to `<Navigate to="/designer/dashboards/new" replace />`
- The `/dashboards/:id/edit` route: replace with a small wrapper that reads `:id` and renders `<Navigate to={`/designer/dashboards/${id}/edit`} replace />`
- Keep `/dashboards` (listing), `/dashboards/:id` (viewer), `/dashboards/playlist/:id` (playlist) unchanged

**`frontend/src/pages/dashboards/index.tsx`** — listing page:
- Update "New Dashboard" button nav target from `/dashboards/new` to `/designer/dashboards/new`
- Update all "Edit" links from `/dashboards/:id/edit` to `/designer/dashboards/:id/edit`
- Add a second query: `graphicsApi.list({ mode: 'dashboard' })` to show Designer-created dashboards alongside legacy ones. Merge results and label the source (legacy vs. designer).

### Detailed Steps
1. In `App.tsx`, replace the `/dashboards/new` route element with `<Navigate to="/designer/dashboards/new" replace />`.
2. In `App.tsx`, add a small wrapper component (inline or separate file):
   ```tsx
   function DashboardEditRedirect() {
     const { id } = useParams();
     return <Navigate to={`/designer/dashboards/${id}/edit`} replace />;
   }
   ```
   Use it as the element for `/dashboards/:id/edit`.
3. Remove the `DashboardBuilder` import from `App.tsx` (it becomes unused).
4. In `dashboards/index.tsx`, update the "New Dashboard" CTA to navigate to `/designer/dashboards/new`.
5. Update all "Edit" buttons/links in the dashboards listing to use `/designer/dashboards/:id/edit`.
6. In `dashboards/index.tsx`, add a second TanStack Query for `graphicsApi.list({ mode: 'dashboard' })`. Merge with existing `dashboardsApi.list()` results. Display a subtle "Designer" badge on items from `design_objects`.
7. Run `tsc --noEmit` and `pnpm build`.
8. Manually verify:
   - `/dashboards` listing renders (with both sources if any designer dashboards exist)
   - "New Dashboard" navigates to `/designer/dashboards/new` (Designer opens in Dashboard mode)
   - `/dashboards/:id` (viewer) still works for existing dashboards
   - `/dashboards/:id/edit` redirects to `/designer/dashboards/:id/edit`
   - Designer at `/designer/dashboards/new` opens with Dashboard mode pre-selected

### Success Criteria
- No route leads to DashboardBuilder anymore.
- New dashboards are created through the Designer and saved to `design_objects`.
- Existing dashboards remain viewable through DashboardViewer (reading from `dashboardsApi`).
- The DashboardsPage listing shows items from both tables.

### Risk Notes
- **Permission mismatch**: DashboardBuilder routes used `dashboards:write`. Designer routes use `designer:write`. Ensure users who had `dashboards:write` also have `designer:write`. Check the RBAC seed data — if these permissions are different roles, a backend seed data update may be needed. If they map to the same role (Content Manager), no change needed.
- **DashboardBuilder still exists on disk** after this phase (it's just unreachable). Removal happens in Phase 4.

---

## Phase 3: Dashboard Data Conversion Utility

**Risk:** Medium — New code, data model translation  
**Ships:** After Phase 2

### Goal
Create a client-side converter utility that transforms `dashboards` table `WidgetConfig[]` format into `GraphicDocument` scene graphs. Add an on-demand "Convert to Designer Format" action on the dashboards listing page. System dashboards (8 seeded, `is_system=true`) are **not** converted and remain in the `dashboards` table.

### Widget Type Mapping

| DashboardBuilder `type` | Scene Graph `WidgetType` | Notes |
|---|---|---|
| `line-chart` | `trend` | Map `points[]` to `series: TrendSeries[]` with `PointBinding` |
| `bar-chart` | `bar_chart` | Map `series` to typed `{binding, label, color}[]` |
| `pie-chart` | `pie_chart` | Map `series` to typed `{binding, label, color}[]` |
| `kpi-card` | `kpi_card` | Map `metric` string to `PointBinding` |
| `gauge` | `gauge` | Map `pointId` to `PointBinding`, preserve `thresholds` |
| `table` | `table` | Map `columns` to `TableColumn[]` with `PointBinding` |
| `text` | N/A — use `TextBlock` node | Text widgets become `TextBlock` scene nodes, not `WidgetNode` |
| `alert-status` / `alarm-list` | `alarm_list` | Map `maxItems` to `maxRows` |

**System-specific types** (alarm-kpi, opc-status, shift-info, service-health, ws-throughput, db-size, etc.) — ~20 types used only in seeded system dashboards. These have no scene graph equivalent and are skipped (system dashboards are not converted).

**Point binding format**: DashboardBuilder uses raw strings (`pointId: "uuid"`). Scene graph uses `PointBinding` objects (`{ pointId: "uuid" }`). The converter wraps raw IDs.

**Grid coordinate mapping**: DashboardBuilder uses a 12-column grid. Convert `x`, `y`, `w`, `h` (in grid units) to pixel coordinates using 80px column width × 60px row height (standard 960px wide canvas).

### Files to Create

**`frontend/src/shared/utils/dashboardConverter.ts`**:
```typescript
import type { Dashboard } from '../types/dashboard';
import type { GraphicDocument, WidgetNode } from '../types/graphics';

export function convertDashboardToGraphicDocument(
  dashboard: Dashboard
): GraphicDocument { ... }
```

- Pure function, no side effects
- Returns a `GraphicDocument` with `mode: 'dashboard'`, `width: 1920`, `height: 1080`, and a `WidgetNode` for each convertible widget
- Skips unknown widget types with a console warning
- Sets `metadata.convertedFromDashboardId` on each `WidgetNode` for traceability

### Files to Modify

**`frontend/src/pages/dashboards/index.tsx`**:
- Add a "Convert to Designer" action to the context menu (or action column) for non-system dashboards
- On click: show a confirmation dialog, call `convertDashboardToGraphicDocument()`, then `graphicsApi.create()` with the result, then navigate to `/designer/dashboards/:newId/edit` with a success toast
- System dashboards (`is_system: true`) do not show the convert action

### Detailed Steps
1. Implement `dashboardConverter.ts` with the widget type mapping table above.
2. Write unit tests covering each of the 8 convertible widget types plus the "skip unknown type" behavior.
3. Add the "Convert to Designer" action to `dashboards/index.tsx`.
4. Implement the confirmation dialog (simple Radix Alert Dialog).
5. Test the conversion flow end-to-end: convert a user dashboard, open it in Designer, verify widget positions and configs are correct.
6. Run `pnpm test` to confirm converter unit tests pass.

### Success Criteria
- Users can convert any non-system dashboard to Designer format on demand.
- Converted dashboards open correctly in the Designer.
- System dashboards (`is_system: true`) do not show the convert action.
- No data is lost — the original dashboard in `dashboards` table is not deleted; conversion creates a new `design_objects` record.
- Unit tests pass for all 8 convertible widget types.

### Risk Notes
- **Converter fidelity**: Widget configs between the two systems have different shapes. Handle missing fields gracefully with sensible defaults.
- **Point binding format**: Raw UUID strings need to be wrapped in `PointBinding` objects.
- **Grid-to-pixel translation**: The 80px × 60px assumption may need adjustment based on actual canvas defaults. Check `DesignerCanvas.tsx` for the default canvas size.

---

## Phase 4: DashboardBuilder Removal

**Risk:** Low (DashboardBuilder was already unreachable after Phase 2)  
**Ships:** After Phase 2 and Phase 3

### Goal
Delete `DashboardBuilder.tsx` from the codebase.

### Files to Delete
- `frontend/src/pages/dashboards/DashboardBuilder.tsx` (1,933 lines)

### Files to Keep (DO NOT DELETE)
- `frontend/src/pages/dashboards/widgets/*` — all 35 widget components. Used by `DashboardViewer`.
- `frontend/src/pages/dashboards/DashboardViewer.tsx` — still needed for viewing `dashboards` table items.
- `frontend/src/pages/dashboards/index.tsx` — listing page.
- `frontend/src/pages/dashboards/PlaylistPlayer.tsx` — playlist functionality.
- `frontend/src/api/dashboards.ts` — API client, still needed for viewing/listing.

### Detailed Steps
1. Search the codebase for any import of `DashboardBuilder`. After Phase 2, there should be zero.
2. If `App.tsx` still has a `DashboardBuilder` import (it should have been removed in Phase 2 Step 3), remove it.
3. Delete `DashboardBuilder.tsx`.
4. Run `tsc --noEmit` to confirm no compilation errors.
5. Run `pnpm test` and `pnpm build`.
6. Manually verify all routes: `/dashboards` (listing), `/dashboards/:id` (viewer), `/dashboards/new` (redirects to designer), `/dashboards/:id/edit` (redirects to designer).

### Success Criteria
- `DashboardBuilder.tsx` does not exist.
- Zero compilation errors.
- All dashboard viewing, listing, and playlist functionality unchanged.
- All dashboard editing goes through the Designer.

---

## Phase 5: Designer Spec Gap Closure

**Risk:** Variable per sub-item  
**Ships:** After Phase 1; sub-items are independent of each other

### Gap 5.1: Phone Preview Button

**Spec reference**: `designer-implementation-spec.md` §4 "Phone Group"  
**Current state**: Missing from `DesignerToolbar.tsx`

**Action**: Add a phone icon toggle button to the toolbar visible in Graphic and Dashboard modes (hidden in Report mode). When active, shows a 375px-wide phone frame overlay on the canvas. In Dashboard mode, switches the canvas to a responsive phone layout editor.

**Files to modify**:
- `frontend/src/store/designer/uiStore.ts` — add `phonePreviewActive: boolean` state + `setPhonePreview(active: boolean)` action
- `frontend/src/pages/designer/DesignerToolbar.tsx` — add Phone Preview button to the toolbar, wired to `uiStore.setPhonePreview`
- `frontend/src/pages/designer/DesignerCanvas.tsx` — render a 375px phone frame when `phonePreviewActive=true`; clip content to phone viewport

**Risk**: Medium — requires canvas layout mode switching.

---

### Gap 5.2: SVG Export in File Menu

**Current state**: File menu in `DesignerModeTabs.tsx` does not include "Export SVG"

**Action**: Add "Export SVG" item to the File dropdown. On click, serialize the current canvas SVG element and trigger a browser download.

**Files to modify**:
- `frontend/src/pages/designer/DesignerModeTabs.tsx` — add "Export as SVG" item to File dropdown
- Create `frontend/src/shared/utils/exportCanvasSvg.ts` — utility function that serializes the canvas SVG and triggers download

**Risk**: Low.

---

### Gap 5.3: Ruler Visual Rendering

**Current state**: `GuideDefinition` type exists in `uiStore`. Whether rulers render with tick marks and support drag-to-create guides is unclear.

**Action**: Audit `DesignerCanvas.tsx` for ruler rendering. If missing, implement: 20px rulers on top and left edges with major tick marks every 100 units, minor ticks every 10 units, and coordinate labels. Support click-drag from ruler to create persistent guide lines (stored as `GuideDefinition` in uiStore).

**Files to modify or create**:
- `frontend/src/pages/designer/DesignerCanvas.tsx` — add ruler rendering or integrate new `Rulers.tsx`
- Optionally: `frontend/src/pages/designer/components/Rulers.tsx` — dedicated ruler component

**Risk**: Medium — requires canvas coordinate mapping for accurate tick positioning during zoom/pan.

---

### Gap 5.4: Smart Guides (Alignment Snap Lines)

**Current state**: `SmartGuide` type is in `uiStore`. Canvas rendering during drag is unclear.

**Action**: During drag operations, compute alignment of dragged nodes against other nodes' edges and centers. When within 2px of an alignment, render temporary teal guide lines on the canvas and snap the dragged position. Clear guides when drag ends.

**Files to modify**:
- `frontend/src/pages/designer/DesignerCanvas.tsx` — drag handlers, alignment computation, overlay rendering

**Risk**: Medium — performance-sensitive during drag; must not cause lag with 100+ nodes.

---

### Gap 5.5: Test Mode Live Data Rendering

**Current state**: Test Mode toggle button exists in toolbar. Canvas may not actually subscribe to WebSocket data.

**Action**: When `testModeActive=true`, subscribe to live point values via `wsManager` for all bound elements. Update display element rendered values reactively. Show green pulsing indicator in toolbar when test mode is active and connected.

**Files to modify**:
- `frontend/src/pages/designer/DesignerCanvas.tsx` — subscribe to WS data in test mode; update display element render values
- `frontend/src/shared/graphics/displayElements/*` — ensure each display element type accepts a live `value` prop

**Risk**: Medium — WebSocket integration may require non-trivial plumbing.

---

### Gap 5.6: Dashboard Widget Rendering in Canvas HTML Overlay

**Current state**: Designer in dashboard mode renders `WidgetNode` entries as SVG placeholder rectangles. Real chart/gauge/table widgets need to render inside the canvas.

**Action**: In the `<HTMLOverlay>` layer of the canvas (per spec section 1.3), render actual widget components from `pages/dashboards/widgets/` for each `WidgetNode`. Position each widget div using `canvasToScreen()` coordinate transformation. Widgets are non-interactive in edit mode (pointer-events: none), interactive in test mode.

**Files to modify or create**:
- `frontend/src/pages/designer/DesignerCanvas.tsx` — add HTMLOverlay rendering for WidgetNodes
- `frontend/src/pages/designer/components/WidgetOverlay.tsx` (new) — component that renders all WidgetNodes as positioned HTML elements

**Risk**: High — coordinate synchronization between SVG canvas and HTML overlay during zoom/pan/resize requires careful transform calculation.

---

## Critical Files Reference

| File | Phase | Action |
|------|-------|--------|
| `frontend/src/pages/designer/panels/Toolbar.tsx` | 1 | DELETE |
| `frontend/src/pages/designer/panels/PropertyPanel.tsx` | 1 | DELETE |
| `frontend/src/pages/designer/panels/StatusBar.tsx` | 1 | DELETE |
| `frontend/src/pages/designer/types.ts` | 1 | DELETE |
| `frontend/src/App.tsx` | 2, 4 | Modify routing |
| `frontend/src/pages/dashboards/index.tsx` | 2, 3 | Update links + add convert action |
| `frontend/src/shared/utils/dashboardConverter.ts` | 3 | CREATE |
| `frontend/src/pages/dashboards/DashboardBuilder.tsx` | 4 | DELETE |
| `frontend/src/store/designer/uiStore.ts` | 5.1 | Add phonePreviewActive |
| `frontend/src/pages/designer/DesignerToolbar.tsx` | 5.1, 5.2 | Phone preview + SVG export |
| `frontend/src/pages/designer/DesignerModeTabs.tsx` | 5.2 | SVG export menu item |
| `frontend/src/pages/designer/DesignerCanvas.tsx` | 5.1, 5.3, 5.4, 5.5, 5.6 | Multiple spec gaps |
| `frontend/src/pages/designer/components/WidgetOverlay.tsx` | 5.6 | CREATE |
| `frontend/src/shared/utils/exportCanvasSvg.ts` | 5.2 | CREATE |
