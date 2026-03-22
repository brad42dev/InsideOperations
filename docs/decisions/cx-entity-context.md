---
id: CX-ENTITY-CONTEXT
title: Entity List Right-Click Context Menu
status: decided
contract: CX-ENTITY-CONTEXT
decided: 2026-03-21
---

## What Was Decided

Every entity list and admin table in the application supports right-click context menus using the P2 base pattern (Edit, Duplicate, separator, Delete, separator, Copy items). Each entity type extends P2 with entity-specific actions inserted between the Duplicate and Delete groups. Items are hidden (not grayed) when the user lacks permission; Delete is grayed with a tooltip when the object has dependencies. Every destructive action requires a confirmation dialog.

## Inventory (What Exists Today)

| Module / Entity | Implemented? | Current behavior | Gap found |
|-----------------|-------------|-----------------|-----------|
| Settings / Users | ⚠️ Partial | Edit, Delete exist | Missing Reset Password, Disable/Enable, Terminate Sessions, View Audit Log, Copy Username |
| Settings / OPC Sources | ⚠️ Partial | Edit, Delete | Missing Test Connection, Enable/Disable, View Statistics, View Connected Points |
| Settings / other lists | ❌ | No right-click | Missing entirely on Roles, Groups, Certificates, Import, etc. |
| Dashboards / list | ❌ | No right-click | Missing entirely |
| Reports / templates | ❌ | No right-click | Missing entirely |
| Forensics / investigations | ❌ | No right-click | Missing entirely |
| Log / templates | ❌ | No right-click | Missing entirely |
| Rounds / templates | ❌ | No right-click | Missing entirely |
| Shifts / roster | ❌ | No right-click | Missing entirely |
| Alerts / templates | ❌ | No right-click | Missing entirely |

## Questions and Answers

The spec was written by the design team directly. Key decisions embedded in the spec:

**Q1**: Should permission-lacking items be hidden or grayed?
**A**: Hidden — except Delete, which is grayed with a tooltip when the object has dependencies (prevents accidental deletion of things in use).

**Q2**: What suffix for Duplicate?
**A**: " (Copy)" suffix — e.g., "Pump Station A (Copy)". Not "Copy of Pump Station A".

**Q3**: Is Delete always available via context menu, or only when safe?
**A**: Always rendered if the user has permission, but grayed with tooltip when dependencies exist. Always requires a confirmation dialog regardless. No single-click deletion anywhere.

**Q4**: What about immutable entities (certificates, recognition models)?
**A**: No Edit item — certificates and models are immutable. View Details + Delete (gated on in-use state) only.

**Q5**: Should there be a universal multi-select context menu?
**A**: The spec does not define a multi-select menu — individual entity menus cover single-row interactions. Multi-select bulk actions (Delete selected, Export selected) are surfaced via toolbar, not context menu.

## Resulting Specification

### Universal Rules (apply to all entity lists)

1. Every entity list row supports right-click. A list with no right-click behavior is a bug.
2. **P2 base order**:
   - Edit (requires `{resource}:write` or `{resource}:manage` — hidden if no permission)
   - Duplicate (requires write permission — hidden if no permission; uses " (Copy)" suffix)
   - *Separator*
   - Delete (requires `{resource}:delete` or `{resource}:manage` — grayed with tooltip if has dependencies)
   - *Separator*
   - Copy [ObjectType] (internal clipboard — no permission required)
   - Copy [Key Field] (system clipboard — no permission required)
3. Entity-specific actions are inserted **between Duplicate and the Delete separator**.
4. Every destructive action opens a **confirmation dialog** before executing.
5. Permission-lacking items are **hidden** (not rendered). Exception: Delete is grayed (not hidden) when the object has active dependencies.

### Module-Specific Rules

Full item tables per entity are defined in `context-menu-implementation-spec.md`:

**Settings**:
- **Users** (RC-SET-1): +Disable/Enable, +Reset Password (local auth only — grayed for IdP users), +Terminate Sessions, +Assign to Group, +View Audit Log, +Copy Username
- **Roles** (RC-SET-2): Duplicate renamed to "Clone Role"; +View Users with This Role. Delete gated on custom-only (predefined roles permanently grayed).
- **Groups** (RC-SET-3): +Add Members, +Manage Roles. Delete grayed if has members.
- **OPC Sources** (RC-SET-4): +Test Connection, +Enable/Disable toggle, +View Statistics, +View Connected Points. Delete grayed if points reference it.
- **Import Connections** (RC-SET-6): +Test Connection, +Enable/Disable. Delete grayed if definitions reference it.
- **Import Definitions** (RC-SET-7): +Run Now, +View Run History, +Enable/Disable.
- **Certificates** (RC-SET-8): No Edit (immutable). +View Details, +Download Certificate, +Copy Fingerprint. Delete grayed if in active use.
- **Recognition Models** (RC-SET-9): No Edit (immutable). +View Details, +Set as Active, +View Feedback History. Delete grayed if active model.
- **App Settings** (RC-SET-10): Not a P2 entity — in-place edit. Items: Edit Value, Reset to Default, Copy Setting Key, Copy Setting Value.
- **Change Snapshots** (RC-SET-11): No Edit (immutable). +View Snapshot Contents, +Restore.

**Reports**:
- **Templates** (RC-RPT-1): Edit renamed to "Edit in Designer". +Run Now, +Manage Schedule. Delete grayed if has active schedules. +Copy Template Name instead of Copy Key Field.
- **Schedules** (RC-RPT-3): +Enable/Disable, +Run Now.

**Log**:
- **Log Instances** (RC-LOG-1): Opens are navigation. +Edit (status-gated), +Submit, +Duplicate as New Entry, +Export PDF, +Print, +Copy Log Link.
- **Templates** (RC-LOG-2): +Preview Template, +Export Template Definition (JSON). Delete grayed if instances use it.
- **Segments** (RC-LOG-3): Delete grayed if referenced by any template.

**Rounds**:
- **Templates** (RC-RND-1): +Manage Schedule, +View History, +Export Template Definition (JSON). Delete grayed if has active instances.
- **Instances** (RC-RND-2): Menu varies by status (Pending/In-Progress/Completed) — see spec §11 for full breakdown.

**Alerts**:
- **Templates** (RC-ALT-3): +Send Alert from Template, +Test Send (to Self).
- **Contact Groups** (RC-ALT-4): +Add Members, +View Members. Delete grayed if referenced by active templates.

**Shifts**:
- **Roster/On-Site** (RC-SHF-1): +Assign to Shift, +Remove from Shift (grayed if not assigned), +View Presence History, +Copy Name, +Copy Badge ID (grayed if no badge).
- **Shift Blocks** (RC-SHF-2): +Assign Crew, +Add Personnel, +Duplicate to Next Day, +Duplicate to Next Week.
- **Crews** (RC-SHF-3): +Add Members, +View Schedule. Delete grayed if assigned to future shifts.

**Forensics**:
- **Investigations** (RC-FOR-1): +Share, +Export Investigation (PDF), +Copy Investigation Link. Delete grayed if status is Closed.

**Dashboards**:
- **Dashboard list** (RC-DASH-1): Edit renamed to "Edit in Designer". +Publish/Unpublish (toggle), +Share. Delete grayed if dashboard is published.

### Explicitly Out of Scope

- Multi-select context menus (bulk Delete/Export via toolbar, not context menu)
- "Browse Namespace" and "Force Reconnect" for OPC Sources (not in spec)
- "Run On-Site Report" for Shift Personnel (moved to command palette / user profile page)
- "Reset MFA" for Users (not in spec; "Terminate Sessions" covers forced logout)

## Implementation Notes

Modules do not use a centralized menu registry. Each entity list component composes its context menu locally using Radix UI ContextMenu primitives and shared item components:

- `<TableRowContextMenuItems row={...} table={...} />` — renders P4 base items (Copy Row, Copy Cell Value, Export Table)

Entity-specific menus are composed directly in the host component's `ContextMenu.Content`.

**Addendum (`context-menu-addendum.md`) changes that affect entity menus:**
- **Item limit**: 15 non-separator items (raised from 10 in base spec §1). Mandatory separator grouping in groups of 3–5.
- **Group ordering** (§A1 — authoritative, overrides §1.9 text): Primary → Secondary → Navigation → Transfer/Sharing → Destructive → **Clipboard last**.
- **Submenu guidance** (§A3): Use "Download As ▸" submenu when 3+ download formats exist. Do not use submenus for only 2 items.
- **RC-RPT-2** (§A2): Report run downloads grouped into "Download As ▸" submenu (PDF, CSV, XLSX, HTML, JSON). HTML and JSON are new formats.
- **RC-RND-3** (§A2): Checkpoint menu gains "Record Video" and "Trend This Point" (conditional on point linkage).
- **RC-FOR-2** (§A2): Forensics Included Points panel gains "Show in Console Graphic" (requires `console:read`, gated on `default_graphic_id` being set).
- **RC-SET-5** (§A2): Settings point browser gains "Report on Point", "Show in Console Graphic", "View Alarm History" — 10 total items, reorganized into 5 separator groups.

## Open Questions

None — spec is complete.
