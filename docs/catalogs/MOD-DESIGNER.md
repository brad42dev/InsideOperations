---
unit: MOD-DESIGNER
audited: 2026-03-21
relationship: OVERHAUL
spec-files:
  - /home/io/spec_docs/designer-implementation-spec.md
  - /home/io/spec_docs/designer-ui-prompt.md
result: ⚠️ Gaps found
tasks-generated: 10
---

## Summary

The Designer module has a well-structured foundation: three Zustand stores are correctly separated, the Command pattern is implemented for mutations, Radix ContextMenu primitives are used on the canvas, and all three design modes (Graphic, Dashboard, Report) exist. However, several gaps remain: undo uses snapshot restoration instead of calling `command.undo()` (false-DONE pattern), no visual drag ghost during drag (nodes stay frozen until mouseup), selection state is kept in a local ref rather than `uiStore`, the context menu is missing Lock/Unlock, Navigation Link, Properties base items (RC-DES-2) and all type-specific items for ImageNode/Stencil/EmbeddedSvg/Annotation, shape palette and layer panel have no right-click menus, and several Wave 0 gaps exist (no PointContextMenu wiring, no nested error boundaries, loading state is a plain text fallback, hardcoded colors in loading/error states).

## Non-Negotiables

| # | Non-Negotiable | Status | Evidence |
|---|---------------|--------|----------|
| 1 | Designer has 3 modes: Graphic, Dashboard, Report | ✅ | `DesignerModeTabs.tsx:45-48` — TABS array has all three; `sceneStore.ts:25` — designMode field |
| 2 | Command pattern for undo/redo — every mutation is a Command with execute() and undo() | ⚠️ Wrong | `historyStore.ts:153` — undo() calls `_setDoc(entry.docBefore)` (snapshot restore), never calls `command.undo()`. Redo correctly calls `entry.command.execute()`. False-DONE pattern "undo/redo uses snapshot stack" is present. |
| 3 | Scene graph is single source of truth; SVG is derived rendering artifact | ✅ | Canvas uses React SVG rendering (not SVG.js). `DesignerCanvas.tsx:9` — comment confirms SVG.js replaced. All mutations route through SceneCommand.execute(). |
| 4 | Point bindings in scene graph as `DisplayElement.binding.pointId` | ✅ | `DesignerCanvas.tsx:246` — `de.binding.pointId` read for test mode. `ChangeBindingCommand` in `commands.ts`. |
| 5 | .iographic import parses into scene graph nodes, not raw SVG blobs | ✅ | `IographicImportWizard.tsx:1040` — delegates to `graphicsApi.commitIographic()`. Server-side endpoint handles parsing. |
| 6 | Shape library — drop creates SymbolInstance with shapeRef.shapeId, SVG loaded at render time | ✅ | `DesignerLeftPalette.tsx` shape tiles drag to canvas; `DesignerCanvas.tsx` creates SymbolInstance via AddNodeCommand. |
| 7 | Three Zustand stores with strict separation | ⚠️ Partial | Three stores exist. However `selectedIdsRef` at `DesignerCanvas.tsx:1507` is a local `useRef<Set<NodeId>>`, not in `uiStore`. Selection state must be in `uiStore` per spec. `uiStore.ts` defines dragState/resizeState/rotateState but no selectedNodeIds. |
| 8 | Drag preview: SVG DOM diverges for 60fps ghost during drag; single MoveNodesCommand on mouseup | ⚠️ Partial | `handleMouseMove` at line 1923 (drag branch) only computes alignment guides — no visual ghost position update. Nodes stay at original positions visually during drag. Mouseup at line 2104 correctly creates one MoveNodesCommand. Ghost preview is absent. |

## False-DONE Patterns

| Pattern | Present? | Evidence |
|---------|----------|----------|
| SVG.js stores positions (.move(), .attr()) instead of sceneStore | ✅ Not present | Canvas uses React SVG rendering. No SVG.js imports in DesignerCanvas.tsx. |
| Event handlers mutate SVG without updating sceneStore | ✅ Not present | All mutations route through executeCmd() → sceneStore.execute() |
| One monolithic Designer store | ✅ Not present | Three separate stores confirmed |
| Selection state in sceneStore (persisted) | ✅ Not present | sceneStore.ts has no selectedNodeIds |
| Drag updates committing to sceneStore on every mousemove tick | ✅ Not present | handleMouseMove does not call executeCmd() during drag |
| Only one designer mode (graphic) | ✅ Not present | All three modes exist in DesignerModeTabs.tsx:45-48 |
| Undo/redo uses snapshot stack instead of Command objects | ⚠️ Found | historyStore.ts:153 — undo() calls _setDoc(entry.docBefore), bypassing command.undo(). Commands define undo() in commands.ts:27 but it is never called. |
| .iographic import creates raw SVG blobs | ✅ Not present | Server-side parsing |

## Wave 0 Contract Gaps

| Contract | Check | Status | Evidence |
|----------|-------|--------|----------|
| CX-CANVAS-CONTEXT | RC-DES-1 empty-canvas: separate branch with Grid submenu, Zoom submenu, Properties | ⚠️ Wrong | DesignerCanvas.tsx:3877 — single unified menu regardless of ctxNodeId. No Grid submenu (only toggle at 4003), no Zoom submenu, no Properties item. |
| CX-CANVAS-CONTEXT | RC-DES-2 base items: Lock/Unlock, Navigation Link submenu, Properties | ❌ Missing | DesignerContextMenuContent (lines 3877–3993) has no Lock/Unlock, no Navigation Link submenu, no Properties item. |
| CX-CANVAS-CONTEXT | RC-DES-6 ImageNode: Replace Image, Reset to Original Size, Crop | ❌ Missing | No imageNode branch in DesignerContextMenuContent (lines 3877–4279). |
| CX-CANVAS-CONTEXT | RC-DES-7 Stencil: Promote to Shape, Replace SVG | ❌ Missing | No stencilNode branch found. |
| CX-CANVAS-CONTEXT | RC-DES-8 EmbeddedSvg: Explode to Primitives, Promote to Shape, Save as Stencil | ❌ Missing | No embeddedSvgNode branch found. |
| CX-CANVAS-CONTEXT | RC-DES-10 TextBlock: Change Font, Text Alignment submenu | ⚠️ Partial | DesignerCanvas.tsx:4254 — TextBlock block has "Edit Text" only. No Change Font, no Text Alignment submenu. |
| CX-CANVAS-CONTEXT | RC-DES-11 Annotation: Edit Annotation, Change Style | ❌ Missing | No annotationNode branch found. |
| CX-CANVAS-CONTEXT | RC-DES-13/14/15 shape palette right-click | ❌ Missing | DesignerLeftPalette.tsx — no onContextMenu or ContextMenu primitives. |
| CX-CANVAS-CONTEXT | RC-DES-16 layer panel right-click | ❌ Missing | DesignerRightPanel.tsx — no layer panel right-click. |
| CX-CANVAS-CONTEXT | RC-DES-17 guide right-click | ❌ Missing | DesignerCanvas.tsx — no right-click on rendered guide lines. |
| CX-POINT-CONTEXT | PointContextMenu on point-bound display elements | ❌ Missing | DesignerCanvas.tsx test mode (line 356) renders live values but no PointContextMenu component imported or rendered anywhere in the designer tree. |
| CX-ERROR | Nested error boundaries around individual panels | ❌ Missing | App.tsx:211,221,231,241,251,281 — ErrorBoundary wraps whole DesignerPage route only. No nested boundaries inside DesignerPage around DesignerCanvas, DesignerLeftPalette, DesignerRightPanel. |
| CX-ERROR | [Reload Module] button label | ⚠️ Wrong | ErrorBoundary.tsx:49 — button says "Try again" not "[Reload Module]". |
| CX-LOADING | Module-shaped skeleton (not generic text/shimmer) | ⚠️ Wrong | index.tsx:232-246 — LoadingSkeleton() shows "Loading graphic…" text on a dark div. Not a layout skeleton matching toolbar + palette + canvas + right panel. |
| CX-TOKENS | No hardcoded hex colors in module code | ⚠️ Wrong | index.tsx:239 — `background: '#0a0a0b'`; line 263 — `color: '#ef4444'`; line 162 — `color: '#09090b'`. Should reference --io-surface-primary, --io-status-error, text tokens. |
| CX-RBAC | Route-level RBAC and action-button permission gating | ✅ | App.tsx:210–322 — all Designer routes wrapped in PermissionGuard. useDesignerPermissions used in DesignerModeTabs.tsx:86, index.tsx:302. |
| CX-EMPTY | Tailored empty states per entity | ✅ | DesignerGraphicsList.tsx, DesignerDashboardsList.tsx, DesignerReportsList.tsx provide module-specific empty states. |

## Findings Summary

- [MOD-DESIGNER-001] Undo path bypasses command.undo() — restores docBefore snapshot — historyStore.ts:153
- [MOD-DESIGNER-002] No visual drag ghost; nodes frozen at original positions during drag — DesignerCanvas.tsx:1923-1980
- [MOD-DESIGNER-003] Selection state in local useRef instead of uiStore — DesignerCanvas.tsx:1507
- [MOD-DESIGNER-004] RC-DES-1 empty-canvas context menu not differentiated (no Grid/Zoom submenus, no Properties) — DesignerCanvas.tsx:3877
- [MOD-DESIGNER-005] RC-DES-2 base items missing Lock/Unlock, Navigation Link submenu, Properties — DesignerCanvas.tsx:3877-3993
- [MOD-DESIGNER-006] RC-DES-6/7/8/11 node-type-specific items missing (ImageNode, Stencil, EmbeddedSvg, Annotation; TextBlock missing Change Font and alignment) — DesignerCanvas.tsx:4094-4279
- [MOD-DESIGNER-007] Shape palette has no right-click context menu (RC-DES-13/14/15) — DesignerLeftPalette.tsx
- [MOD-DESIGNER-008] Layer panel and guide have no right-click context menu (RC-DES-16, RC-DES-17) — DesignerRightPanel.tsx, DesignerCanvas.tsx
- [MOD-DESIGNER-009] No PointContextMenu on point-bound display elements in test mode (CX-POINT-CONTEXT) — DesignerCanvas.tsx
- [MOD-DESIGNER-010] No nested error boundaries in Designer (CX-ERROR); "Try again" label (CX-ERROR); plain-text loading skeleton (CX-LOADING); hardcoded hex colors (CX-TOKENS) — index.tsx, ErrorBoundary.tsx
