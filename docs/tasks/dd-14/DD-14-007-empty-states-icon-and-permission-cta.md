---
id: DD-14-007
title: Add icons to empty states and gate CTAs on permission
unit: DD-14
status: pending
priority: low
depends-on: [DD-14-005]
---

## What This Feature Should Do

Every empty state in the Rounds module must include a module-specific icon (or illustration), a plain-language explanation of why it's empty, and a CTA that is only rendered when the user has permission to take the action. Currently all empty states are plain text with no icon, and the "Create one to get started" CTA is always shown.

## Spec Excerpt (verbatim)

> Empty states are **tailored per module and entity**. No generic "No data found" messages.
> Empty state includes: module-specific illustration or icon, plain-language explanation of why it's empty, and a CTA (if applicable).
> CTAs in empty states are **permission-aware**: rendered only if the user has the permission to take the action.
> — docs/SPEC_MANIFEST.md, §CX-EMPTY Non-negotiables #1-3

## Where to Look in the Codebase

Primary files:
- `frontend/src/pages/rounds/index.tsx` — line 430-432 ("No pending rounds."), 453-456 ("No rounds in progress."), 489-491 ("No templates yet. Create one to get started."), 554-557 ("No schedules configured."), 469-478 (history DataTable with `emptyMessage="No completed rounds."`)
- `frontend/src/pages/rounds/RoundTemplates.tsx` — line 63-65 ("No templates yet. Create one to get started.")
- `frontend/src/pages/rounds/RoundSchedules.tsx` — line 175-177 ("No schedules configured.")
- `frontend/src/shared/components/EmptyState.tsx` — check if a shared empty state component already exists

## Verification Checklist

Read the code at the files listed above. Check each item:

- [ ] Each empty state renders an icon or illustration (at minimum an SVG icon relevant to the entity — clipboard for rounds, template page for templates, calendar for schedules)
- [ ] Empty state text is entity-specific and explains why it's empty (not generic "No data found")
- [ ] "Create one to get started" / "Add Schedule" CTAs are only rendered when user has `rounds:template_manage` / `rounds:schedule_manage` permission respectively
- [ ] "No pending rounds" empty state includes a note that rounds are assigned to shifts (so user knows why none appear)
- [ ] No plain text-only empty states remain

## Assessment

After checking:
- **Status**: ⚠️ Wrong
- **What's wrong**: index.tsx line 430-432 shows a plain `<div>No pending rounds.</div>` with no icon, no explanation of the shift assignment model, no CTA. Line 489-491 shows "No templates yet. Create one to get started." — the phrase "Create one to get started" implies a CTA but there is no button and no permission check. RoundTemplates.tsx line 63-65 and RoundSchedules.tsx line 175-177 have the same plain text pattern.

## Fix Instructions (if needed)

1. Check `frontend/src/shared/components/` for an existing `EmptyState` component. If it exists with icon + title + description + optional CTA, use it.

2. If no shared EmptyState exists, create one at `frontend/src/shared/components/EmptyState.tsx` with props: `icon`, `title`, `description`, `action?: { label: string, onClick: () => void }`.

3. Replace the plain text empty states in `index.tsx`:

   **Available tab** (line 430-432):
   ```tsx
   <EmptyState
     icon={<ClipboardIcon />}
     title="No rounds available"
     description="Rounds are assigned to shifts. Check back when your shift starts, or contact your supervisor."
   />
   ```

   **Templates tab** (line 489-491):
   ```tsx
   <EmptyState
     icon={<TemplateIcon />}
     title="No templates yet"
     description="Round templates define the checkpoints and data to collect during an inspection."
     action={canManageTemplates ? { label: '+ New Template', onClick: () => navigate('/rounds/templates/new/edit') } : undefined}
   />
   ```

4. Apply the same pattern in `RoundTemplates.tsx:63`, `RoundSchedules.tsx:175`, and the in-progress empty state in `index.tsx:453`.

Do NOT:
- Use a generic "No data found" message — each empty state should be specific
- Show the CTA action to users who lack the required permission — pass `action={undefined}` when permission is absent
- Use `depends-on: [DD-14-005]` code — implement the permission check logic independently here as well
