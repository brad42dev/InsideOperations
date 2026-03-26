---
id: DD-31-020
title: Fix TemplatesPanel "Edit" action to pre-populate selected template
unit: DD-31
status: pending
priority: medium
depends-on: []
---

## What This Feature Should Do

When a user right-clicks a template row in the Alerts > Management > Templates panel and selects "Edit", the edit form should open pre-populated with that template's current data (name, severity, title_template, body_template, channels, variables). The user should be able to modify any field and save the changes via a PUT to `/api/notifications/templates/:id`. Currently the Edit context-menu item opens a blank "Create Template" form — the selected template's data is never loaded.

## Spec Excerpt (verbatim)

> **Template editor**:
> - Template name (required, unique)
> - Severity (dropdown: emergency, critical, warning, info)
> - Is Emergency (checkbox)
> - Title template (supports `{{variable}}` placeholders)
> - Message body template (supports `{{variable}}` placeholders)
> - Variables definition (name, label, default value, required flag)
> - Default recipient group (dropdown of alert groups)
> - Default channels (checkboxes)
> ...
> — design-docs/31_ALERTS_MODULE.md, §Template Management View

## Where to Look in the Codebase

Primary files:
- `frontend/src/pages/alerts/index.tsx` — `TemplatesPanel` function (line ~1219); look at `showCreate` state and the "Edit" context-menu item (line ~1543)
- `frontend/src/api/notifications.ts` — `updateTemplate(id, payload)` API method; `UpdateTemplatePayload` type (~line 123)

## Verification Checklist

- [ ] `TemplatesPanel` has an `editTemplateId` state (or similar) separate from `showCreate`
- [ ] Context menu "Edit" item sets `editTemplateId` to the right-clicked template's `id`
- [ ] When edit mode is active, the form is pre-populated: name, severity, title_template, body_template, channels, variables all show the existing template values
- [ ] Submitting the edit form calls `notificationsApi.updateTemplate(id, payload)` (not `createTemplate`)
- [ ] After successful save, the template list refreshes and the edit form closes
- [ ] The form title reads "Edit Template" (not "Create Template") when editing

## Assessment

- **Status**: ⚠️ Wrong
- **Current state**: `TemplatesPanel` has no `editTemplateId` state. The context-menu "Edit" item at `index.tsx:1543` calls `setShowCreate(true)` — the `tpl` variable in scope is not referenced at all. The same blank create form opens regardless of which template was right-clicked. There is no mutation that calls `updateTemplate` with template content (only `toggleMutation` which patches `{ enabled }` only).

## Fix Instructions

In `frontend/src/pages/alerts/index.tsx`, inside `TemplatesPanel`:

1. Add state:
   ```ts
   const [editTemplateId, setEditTemplateId] = useState<string | null>(null)
   const [editForm, setEditForm] = useState<Partial<UpdateTemplatePayload>>({})
   const [editVarDefs, setEditVarDefs] = useState<TemplateVariable[]>([])
   ```

2. Add `updateMutation`:
   ```ts
   const updateMutation = useMutation({
     mutationFn: ({ id, payload }: { id: string; payload: UpdateTemplatePayload }) =>
       notificationsApi.updateTemplate(id, payload),
     onSuccess: (res) => {
       if (res.success) {
         qc.invalidateQueries({ queryKey: ['notification-templates'] })
         setEditTemplateId(null)
         setEditForm({})
         setEditVarDefs([])
       }
     },
   })
   ```

3. Fix the context-menu "Edit" item to open the edit form pre-populated:
   ```ts
   onSelect={() => {
     setEditTemplateId(tpl.id)
     setEditForm({
       name: tpl.name,
       severity: tpl.severity,
       title_template: tpl.title_template,
       body_template: tpl.body_template,
       channels: tpl.channels,
     })
     setEditVarDefs(tpl.variables ?? [])
   }}
   ```

4. Render an edit form (same fields as the create form) below the "Edit Template" heading when `editTemplateId` is set. Submit button calls `updateMutation.mutate({ id: editTemplateId, payload: editForm })`.

5. Keep the create form (`showCreate`) and edit form (`editTemplateId`) mutually exclusive — opening one should close the other.

Do NOT:
- Leave the "Edit" item calling `setShowCreate(true)` — that creates a new template
- Submit edit changes via `createMutation` — that posts to the create endpoint
- Share state between create and edit forms (keep them separate to avoid pre-fill bleed)
