---
id: DD-13-019
title: Add CX-ENTITY-CONTEXT RC-LOG-2 right-click menu on log template rows
unit: DD-13
status: pending
priority: medium
depends-on: []
---

## What This Feature Should Do

Log template rows in the Templates management page must have a right-click context menu (RC-LOG-2) with the full set of entity-specific actions: Edit Template, Duplicate, Preview Template, Delete (grayed if in use), and Export Template Definition. Currently the row only has inline Edit and Delete buttons with no right-click behavior.

## Spec Excerpt (verbatim)

> Log Templates (RC-LOG-2): Edit Template, Duplicate, Preview Template, Delete (grayed if in use), Export Template Definition.
> — docs/SPEC_MANIFEST.md, §CX-ENTITY-CONTEXT, Non-negotiable #5

> Right-clicking any row in an entity list opens a context menu. An entity list with no right-click behavior is wrong.
> — docs/SPEC_MANIFEST.md, §CX-ENTITY-CONTEXT, Non-negotiable #1

## Where to Look in the Codebase

Primary files:
- `frontend/src/pages/log/LogTemplates.tsx:53–88` — template list rows; plain `<div>` with Edit/Delete buttons, no `onContextMenu`
- `frontend/src/pages/log/index.tsx:254–326` — TemplatesList sub-component in the main log page; also has no right-click on rows
- `frontend/src/shared/components/PointContextMenu.tsx` — for reference on how shared context menus are structured

## Verification Checklist

Read the code at the files listed above. Check each item:

- [ ] Template rows in `LogTemplates.tsx` have an `onContextMenu` handler that opens a context menu.
- [ ] Context menu includes: Edit Template, Duplicate (creates copy with " (Copy)" suffix), Preview Template, Delete (grayed if template is referenced by active instances), Export Template Definition.
- [ ] Delete item is **grayed with tooltip** (not hidden) when the template is in use — this is the P2 pattern for dependent objects.
- [ ] Duplicate creates the copy server-side via `logsApi.createTemplate(...)` with ` (Copy)` appended to the name, not "Copy of …".
- [ ] Context menu uses **Radix UI ContextMenu primitives** (not a custom `<div>` overlay).
- [ ] The same context menu (or equivalent) is present on template rows in `index.tsx:254–326` (the Templates tab on the main log page).

## Assessment

After checking:
- **Status**: ❌ Missing — `LogTemplates.tsx:53–88` shows plain `<div>` rows with no `onContextMenu`. `index.tsx:254–326` also has no right-click handling. RC-LOG-2 items Duplicate, Preview Template, and Export Template Definition are absent entirely.

## Fix Instructions

**Step 1 — Install/confirm Radix ContextMenu** in `frontend/package.json`. It should already be present (`@radix-ui/react-context-menu`); verify.

**Step 2 — Build the RC-LOG-2 context menu** as a component (or inline in `LogTemplates.tsx`):

```tsx
import * as ContextMenu from '@radix-ui/react-context-menu'

// Wrap each template row:
<ContextMenu.Root>
  <ContextMenu.Trigger asChild>
    <div key={t.id} style={...}>
      {/* existing row content */}
    </div>
  </ContextMenu.Trigger>
  <ContextMenu.Portal>
    <ContextMenu.Content>
      <ContextMenu.Item onSelect={() => navigate(`/log/templates/${t.id}/edit`)}>
        Edit Template
      </ContextMenu.Item>
      <ContextMenu.Item onSelect={() => handleDuplicate(t)}>
        Duplicate
      </ContextMenu.Item>
      <ContextMenu.Item onSelect={() => handlePreview(t)}>
        Preview Template
      </ContextMenu.Item>
      <ContextMenu.Separator />
      <ContextMenu.Item
        disabled={t.instance_count > 0}
        onSelect={() => handleDelete(t)}
      >
        Delete
      </ContextMenu.Item>
      <ContextMenu.Separator />
      <ContextMenu.Item onSelect={() => handleExportDefinition(t)}>
        Export Template Definition
      </ContextMenu.Item>
    </ContextMenu.Content>
  </ContextMenu.Portal>
</ContextMenu.Root>
```

**Duplicate logic**: call `logsApi.createTemplate({ ...t, name: t.name + ' (Copy)', is_active: false })` then invalidate the templates query.

**Export Template Definition**: call the existing export API with `entity="Log Template"` and `format="json"`, or export the template's JSON structure directly as a file download.

**Delete gating**: the API response for `listTemplates` should include a field indicating if the template is referenced by active instances. If `instance_count > 0` (or equivalent), render the Delete item disabled with a `title` tooltip like "Cannot delete — template has active log instances".

**Step 3 — Apply the same context menu to `index.tsx:254–326`** (TemplatesList component). The Templates tab on the main log page also renders template rows without right-click.

Do NOT:
- Use a custom `<div>` positioned absolutely as a context menu — use Radix `ContextMenu` primitives.
- Hide the Delete item when template is in use — per CX-ENTITY-CONTEXT P2 pattern, it must be **grayed** (disabled) with a tooltip, not hidden.
- Name the duplicate "Copy of {name}" — the spec requires `{name} (Copy)` (suffix, not prefix).
