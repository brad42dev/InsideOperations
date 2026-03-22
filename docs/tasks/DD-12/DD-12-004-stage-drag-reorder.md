---
id: DD-12-004
title: Implement drag-to-reorder for investigation stages
unit: DD-12
status: pending
priority: low
depends-on: []
---

## What This Feature Should Do

Stages in an investigation are a narrative sequence. The investigator must be able to drag a stage card up or down to reorder them. Reordering calls the update-stage API with the new `sort_order` values for affected stages.

## Spec Excerpt (verbatim)

> **Reorder**: Drag stages to reorder (stages are a narrative sequence, not necessarily chronological — though they usually are).
> — 12_FORENSICS_MODULE.md, §UI Layout > Stage Management

## Where to Look in the Codebase

Primary files:
- `frontend/src/pages/forensics/InvestigationWorkspace.tsx` — stage list rendered at lines 1628–1657; stages are sorted by `sort_order` (line 1425) but no drag interaction exists
- `frontend/package.json` — check if `@dnd-kit/core` or `@dnd-kit/sortable` is already a dependency (used in Designer)

## Verification Checklist

- [ ] Each StageCard has a visible drag handle (or the whole header is draggable)
- [ ] Dragging a stage and dropping it at a new position updates the visual order immediately
- [ ] After drop, `forensicsApi.updateStage` is called with the new `sort_order` for all reordered stages
- [ ] Drag-to-reorder is disabled when the investigation is read-only (closed/cancelled)
- [ ] Stage order is stable on page reload (sort_order is persisted server-side)

## Assessment

- **Status**: ❌ Missing
- **If partial/missing**: stages.sort((a, b) => a.sort_order - b.sort_order) at line 1425 shows sort_order is used but no drag interaction is implemented anywhere in the component.

## Fix Instructions

In `frontend/src/pages/forensics/InvestigationWorkspace.tsx`:

1. Check if `@dnd-kit/core` and `@dnd-kit/sortable` are in `frontend/package.json` (they are used by the Designer module). If present, import them; if not, add them via `pnpm add @dnd-kit/core @dnd-kit/sortable` — both are MIT licensed.

2. Wrap the stage list (lines 1628–1657) in a `<DndContext>` + `<SortableContext>`:
   ```tsx
   <DndContext onDragEnd={handleDragEnd}>
     <SortableContext items={stages.map(s => s.id)} strategy={verticalListSortingStrategy}>
       {stages.map(stage => (
         <SortableStageCard key={stage.id} stage={stage} ... />
       ))}
     </SortableContext>
   </DndContext>
   ```

3. `handleDragEnd` should compute new `sort_order` values and call `forensicsApi.updateStage` for each affected stage.

4. Add a drag handle icon (e.g., `⠿` or a grip icon) to the StageCard header visible only when `!readOnly`.

Do NOT:
- Re-implement drag-and-drop from scratch — use @dnd-kit which is already in the project
- Allow drag when the investigation is closed or cancelled (`isReadOnly` check)
