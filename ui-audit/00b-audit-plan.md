# UI Audit Sizing Plan

Generated from `00-inventory.md` + targeted spot-checks. File counts and line counts are module-specific only (shared infrastructure excluded).

---

## Console

**Recommendation: single-pass (all 11 categories)**

**Reasoning.** The Console module has 27 module-specific files. The four largest components (ConsolePalette 2,353 lines, TrendPane 1,153, WorkspaceGrid 1,033, PaneConfigModal 497) are all manageable in one context window. The UI surface is narrow: one grid canvas, one left palette, four pane types, and one config modal. Categories 1–2 (tokens, typography) are entirely inherited from the app-shell with no Console-specific overrides, so those sections will be brief. Categories 3–11 all have concrete Console-specific content but none is deep enough to justify splitting.

*No multi-pass split needed.*

**Concerns for this module:**
- Categories 1–2 will be thin — Console adds no custom design tokens or font overrides. The audit should confirm inheritance rather than trying to enumerate.
- TrendPane's chart UI (category 10 canvas, and category 7 forms in PaneConfigModal) is largely delegated to `shared/components/charts/`. Audit only the Console-owned wrapper; do not chase shared chart components.
- Versioning dialogs in Console (SaveConfirmDialog, PublishConfirmDialog, etc.) are all in `shared/components/versioning/`. Treat these as app-shell scope; note their presence but do not audit them here.

---

## Designer

**Recommendation: three-pass**

**Reasoning.** Designer has four enormous files — DesignerCanvas.tsx (12,067 lines), DesignerRightPanel.tsx (5,994 lines), DesignerLeftPalette.tsx (2,707 lines), DesignerToolbar.tsx (1,694 lines) — and 12,587 lines of wizard/dialog components. A single context window cannot hold the canvas and panels simultaneously. Two passes would still leave Pass 2 reading RightPanel (5,994) + LeftPalette (2,707) + the full dialogs list in a single run, which is too heavy. Three focused passes keep each run under a defensible ceiling.

**Pass 1 — Visual shell (categories 1, 2, 3, 4, 6, 8, 9)**
Covers: color palette and theme tokens; typography; toolbars (DesignerToolbar, DesignerModeTabs, DesignerTabBar, DesignerStatusBar); menus and dropdowns in the toolbar; buttons (primary/secondary/icon throughout the shell); status indicators (StatusBar binding summary, WS dot); labels and headers (tab bar labels, mode tab names, section titles).
Files: `index.tsx`, `DesignerHome.tsx`, `DesignerGraphicsList.tsx`, `DesignerToolbar.tsx`, `DesignerModeTabs.tsx`, `DesignerTabBar.tsx`, `DesignerStatusBar.tsx`, `DesignerImport.tsx` (header/breadcrumb only), `SymbolLibrary.tsx` (header/button layer only).

**Pass 2 — Side panels and forms (categories 5, 7)**
Covers: left palette (DesignerLeftPalette — shapes, stencils, display elements, widgets, points sections); right property inspector (DesignerRightPanel — Layout, Style, Data, Shape, Content, Doc tabs); all form input patterns across both panels; point-binding UI in the palette and inspector.
Files: `DesignerLeftPalette.tsx`, `DesignerRightPanel.tsx`, `components/ShapePointSelector.tsx`, `components/PointPickerModal.tsx`.
Note: DesignerRightPanel carries categories 5, 7, and 9 simultaneously. Audit all three aspects in this pass rather than splitting the file across passes.

**Pass 3 — Canvas and dialogs (categories 10, 11)**
Covers: the main SVG canvas (DesignerCanvas FSM, tool states, draw/select/pan/pipe interactions); all modals and dialogs (IographicExport, IographicImportWizard, CanvasPropertiesDialog, CategoryShapeWizard, PromoteToShapeWizard, RecognitionWizard, ShapeDropDialog, SaveAsStencilDialog, ValidateBindingsDialog, TabClosePrompt, VersionHistoryDialog).
Files: `DesignerCanvas.tsx`, `clipboard/designerCopyHandler.ts`, `clipboard/designerPasteTarget.ts`, all `components/` dialog files.
Note: DesignerCanvas.tsx at 12,067 lines is the single largest file in the frontend. The auditor should read it in targeted sections (tool FSM entry, draw path, pointer capture, context menu wiring) rather than top-to-bottom.

**Concerns for this module:**
- VersionHistoryDialog is a thin wrapper over `shared/components/versioning/VersionRecoveryDialog`. Versioning UI is app-shell scope. In Pass 3 note its presence and check the wrapper's styling only.
- DesignerRightPanel spans categories 5, 7, and 9 simultaneously. Pass 2 deliberately groups all three to avoid re-reading the file.
- The 8-step PromoteToShapeWizard (2,368 lines) and ShapeDropDialog (2,323 lines) are the largest dialog files; together they are heavier than the entire Console module.

---

## Settings

**Recommendation: two-pass**

**Reasoning.** Settings has ~43,000 lines across 35+ module-specific files, but the pattern is uniform: each sub-page is an independent CRUD form backed by a DataTable plus a modal. This uniformity means the auditor can sample 6–8 representative pages per pass rather than exhaustively reading all 35. Two passes are sufficient: one to establish the shell and navigation layer, one to cover the form-heavy sub-pages and their modals.

**Pass 1 — Shell, navigation, and representative identity pages (categories 1, 2, 3, 4, 5, 6, 9)**
Covers: theme tokens (`settingsStyles.ts` inline style constants, inherited CSS tokens); typography patterns; toolbars — Settings has no horizontal toolbars; category 3 will be thin, audit should confirm absence rather than force coverage; menus (context menus in Users, PointManagement rows); left nav sidebar layout (`index.tsx`, `SettingsPageLayout.tsx`); buttons (primary actions, destructive variants, icon buttons); labels and section headers.
Representative pages to include: `index.tsx`, `SettingsPageLayout.tsx`, `settingsStyles.ts`, `IdentityAccess.tsx`, `Users.tsx`, `Roles.tsx`, `Groups.tsx`.

**Pass 2 — System config pages, forms, status, and modals (categories 7, 8, 11; category 10 is N/A)**
Covers: form inputs (the bulk — all the config sub-pages); status indicators (SystemHealth service dots, OPC connection status in OpcSources, session active/revoked state in Sessions); modals and dialogs (RestorePreviewModal, UserDetail, confirm dialogs throughout).
Representative pages to include: `Import.tsx`, `OpcSources.tsx`, `Certificates.tsx`, `AuthProviders.tsx`, `PointManagement.tsx`, `SystemHealth.tsx`, `BulkUpdate.tsx`, `Email.tsx`, `RestorePreviewModal.tsx`.
Note: the remaining ~15 thinner sub-pages (Badges, About, ScimTokens, ExportPresets, etc.) follow identical patterns; the auditor should call out pattern-level findings rather than re-examining each file.

**Concerns for this module:**
- **Category 10 (canvas/main work area) is N/A for Settings.** There is no interactive canvas. The left-nav + content layout is a standard settings shell, not a canvas. Skip this category for both passes.
- **Category 3 (toolbars) is near-empty.** Settings has no horizontal toolbars — only page-level action buttons (covered under category 6). The audit should explicitly confirm absence rather than treating this as a gap.
- Settings shares `api/sessions`, `api/alarms`, `api/authProviders`, and `api/recognition` with other modules. The components that use these APIs may have UI patterns that appear in other modules; flag duplications but do not treat them as Settings-specific gaps.

---

## Cross-module concerns

1. **Versioning dialogs** (`shared/components/versioning/`) are used by both Console and Designer. Auditing them in either module audit will produce results that nominally apply to both. Recommend treating versioning components as app-shell scope: note them when encountered in module audits but defer deep inspection to an app-shell audit pass.

2. **DesignerCanvas.tsx at 12,067 lines** is large enough that even within Pass 3 it should be read in targeted chunks. The auditor should prioritize the canvas background, selection/tool cursor states, context menu anchoring, and the status-bar category 10 rendering — not the full interaction FSM.

3. **Settings sub-page uniformity** cuts both ways: finding one instance of an inconsistent button style or missing status indicator in one sub-page is strong evidence for the same gap across all 35 pages, and the audit should report it that way rather than listing each sub-page individually.
