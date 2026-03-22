---
id: DD-12-005
title: Persist annotation text edits to server via updateEvidence mutation
unit: DD-12
status: pending
priority: high
depends-on: []
---

## What This Feature Should Do

When an investigator edits annotation text and clicks Save, the new text must be persisted to the server via `PUT /api/forensics/investigations/:id/stages/:stageId/evidence/:evidenceId`. Currently the edit only updates local React state and is lost on page reload.

## Spec Excerpt (verbatim)

> **Annotation**: Free text note. Two types: (A) general note on the stage as a whole, (B) note pinned to a specific timestamp on the timeline. Both manually created by the investigator.
> — 12_FORENSICS_MODULE.md, §Evidence Toolkit > Available Evidence Items

## Where to Look in the Codebase

Primary files:
- `frontend/src/pages/forensics/EvidenceRenderer.tsx` — `AnnotationEvidence` component lines 338–439; `onUpdateText` prop at line 613 is currently a no-op
- `frontend/src/pages/forensics/InvestigationWorkspace.tsx` — `StageCard` at line 71; `addEvidenceMutation` exists (line 130) but no `updateEvidenceMutation` is defined
- `frontend/src/api/forensics.ts` — check for `updateEvidence` method

## Verification Checklist

- [ ] `updateEvidenceMutation` exists in `StageCard` calling `forensicsApi.updateEvidence(investigationId, stageId, evidenceId, { config: { text: newText } })`
- [ ] `onUpdateText` callback in `EvidenceRenderer` calls `updateEvidenceMutation.mutate(newText)` instead of a no-op
- [ ] After saving annotation text, refreshing the page shows the saved text (verifies server round-trip)
- [ ] The annotation Save button is disabled while the mutation is pending
- [ ] `forensicsApi.updateEvidence` maps to `PUT /api/forensics/investigations/:id/stages/:stageId/evidence/:evidenceId`

## Assessment

- **Status**: ⚠️ Wrong
- **If partial/missing**: EvidenceRenderer.tsx line 613: `onUpdateText={() => { // Config update is handled by the parent... for now the local state...handles optimistic display }}` — the callback is intentionally left as a no-op with a comment indicating it is incomplete.

## Fix Instructions

1. In `frontend/src/pages/forensics/InvestigationWorkspace.tsx`, inside `StageCard`, add an `updateEvidenceMutation`:
   ```tsx
   const updateEvidenceMutation = useMutation({
     mutationFn: async ({ evidenceId, config }: { evidenceId: string; config: Record<string, unknown> }) => {
       const result = await forensicsApi.updateEvidence(investigationId, stage.id, evidenceId, { config })
       if (!result.success) throw new Error(result.error.message)
       return result.data
     },
     onSuccess: () => {
       void queryClient.invalidateQueries({ queryKey: ['investigation', investigationId] })
     },
   })
   ```

2. Pass a real callback to `EvidenceRenderer`:
   ```tsx
   <EvidenceRenderer
     ...
     onUpdateConfig={(evidenceId, patch) => updateEvidenceMutation.mutate({ evidenceId, config: patch })}
   />
   ```

3. Update `EvidenceRenderer` props to accept `onUpdateConfig?: (evidenceId: string, patch: Record<string, unknown>) => void` and update `AnnotationEvidence` to call it with `{ text: newText }` on Save.

4. Ensure `forensicsApi.updateEvidence` exists in `frontend/src/api/forensics.ts` and maps to `PUT /api/forensics/investigations/:id/stages/:stageId/evidence/:evidenceId`.

Do NOT:
- Remove the local optimistic state from `AnnotationEvidence` — keep it for instant feedback; just also call the mutation
- Make the Save button navigate away or close the editor
