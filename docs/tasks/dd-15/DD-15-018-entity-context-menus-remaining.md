---
id: DD-15-018
title: Add entity right-click context menus to Groups, Import, Certificates, and Recognition tables
unit: DD-15
status: pending
priority: medium
depends-on: []
---

## What This Feature Should Do

Five entity tables in the Settings module are missing right-click context menus required by the CX-ENTITY-CONTEXT Wave 0 contract. The spec defines specific menu items per entity type (RC-SET-3 through RC-SET-9). Each table row must respond to right-click by opening a positioned context menu with the items listed in the spec. The pattern already exists in Users, Roles, and OpcSources — the same pattern must be applied to Groups, Import Connections, Import Definitions, Certificates, and Recognition Models.

## Spec Excerpt (verbatim)

> Right-clicking any row in an entity list opens a context menu. An entity list with no right-click behavior is wrong.
> — SPEC_MANIFEST.md, §CX-ENTITY-CONTEXT Non-negotiables #1

> - **Groups** (RC-SET-3): Add Members, Manage Roles. Delete grayed if has members.
> - **Import Connections** (RC-SET-6): Test Connection, Enable/Disable. Delete grayed if definitions reference it.
> - **Import Definitions** (RC-SET-7): Run Now, View Run History, Enable/Disable.
> - **Certificates** (RC-SET-8): View Details, Download Certificate, Copy Fingerprint. No Edit (certs are immutable).
> - **Recognition Models** (RC-SET-9): View Details, Set as Active, View Feedback History. No Edit (models are immutable).
> — SPEC_MANIFEST.md, §CX-ENTITY-CONTEXT Non-negotiables #3

## Where to Look in the Codebase

Primary files:
- `frontend/src/pages/settings/Groups.tsx` — group table rows (no `onContextMenu` handler)
- `frontend/src/pages/settings/Import.tsx` — connections table and definitions table rows (no `onContextMenu`)
- `frontend/src/pages/settings/Certificates.tsx` — certificates table rows (no `onContextMenu`)
- `frontend/src/pages/settings/Recognition.tsx` — models table rows (no `onContextMenu`)

Reference implementation (copy the pattern from):
- `frontend/src/pages/settings/Users.tsx:837` — `handleContextMenu` + `UserContextMenu` component
- `frontend/src/pages/settings/OpcSources.tsx:2332` — `handleContextMenu` + `OpcSourceContextMenu` component

## Verification Checklist

- [ ] Groups.tsx: right-click on a group row opens context menu with "Add Members", "Manage Roles", and grayed "Delete" (if group has members)
- [ ] Import.tsx connections table: right-click opens menu with "Test Connection", "Enable"/"Disable" toggle, "Delete" (grayed if definitions reference it)
- [ ] Import.tsx definitions table: right-click opens menu with "Run Now", "View Run History", "Enable"/"Disable"
- [ ] Certificates.tsx: right-click opens menu with "View Details", "Download Certificate", "Copy Fingerprint" (no Edit item)
- [ ] Recognition.tsx: right-click opens menu with "View Details", "Set as Active", "View Feedback History" (no Edit item)
- [ ] All menus are dismissed on Escape key and outside-click (use the same portal/overlay pattern as Users/OpcSources)

## Assessment

- **Status**: ❌ Missing (all five tables)
- **If partial/missing**: Groups.tsx — grep for `onContextMenu` returns no results. Import.tsx — no `onContextMenu` anywhere. Certificates.tsx — no `onContextMenu`. Recognition.tsx — no `onContextMenu`.

## Fix Instructions

Follow the exact pattern from `Users.tsx:837` and `OpcSources.tsx:2332`. For each file:

**1. Add state** for the context menu position and selected entity:
```tsx
interface ContextMenuPos { x: number; y: number }
const [contextMenu, setContextMenu] = useState<{ entity: T; pos: ContextMenuPos } | null>(null)
```

**2. Add handler** to the table row:
```tsx
function handleContextMenu(e: React.MouseEvent, entity: T) {
  e.preventDefault()
  setContextMenu({ entity, pos: { x: e.clientX, y: e.clientY } })
}
// On <tr>: onContextMenu={(e) => handleContextMenu(e, entity)}
```

**3. Add a context menu component** below the table that renders the correct items per spec:

**Groups** — `GroupContextMenu`:
- "Add Members" → opens member add dialog (already implemented in Groups.tsx)
- "Manage Roles" → opens role assignment dialog
- "Delete" → delete mutation; grayed with tooltip if `group.member_count > 0`

**Import Connections** — `ImportConnectionContextMenu`:
- "Test Connection" → calls `connectionsApi.test(connection.id)`
- "Enable" / "Disable" toggle → `connectionsApi.update(id, { enabled: !current })`
- "Delete" → grayed if `connection.definition_count > 0`

**Import Definitions** — `ImportDefinitionContextMenu`:
- "Run Now" → `definitionsApi.runNow(id)`
- "View Run History" → navigate to run history filtered by definition
- "Enable" / "Disable" toggle

**Certificates** — `CertificateContextMenu`:
- "View Details" → open read-only details dialog
- "Download Certificate" → `window.location.href = /api/v1/certs/${id}/download`
- "Copy Fingerprint" → `navigator.clipboard.writeText(cert.fingerprint)`
- NO Edit item (certificates are immutable per spec)

**Recognition Models** — `RecognitionModelContextMenu`:
- "View Details" → open read-only model detail dialog
- "Set as Active" → `modelsApi.setActive(id)` (grayed if already active)
- "View Feedback History" → navigate/open feedback history for this model
- NO Edit item (models are immutable per spec)

Do NOT:
- Add "Edit" to Certificates or Recognition menus — the spec explicitly says no Edit for these
- Hide disabled items — gray them with a tooltip explaining why (e.g., "Group has members")
- Use a dropdown menu triggered on left-click — must be right-click (`onContextMenu`) with the menu positioned at cursor coordinates
