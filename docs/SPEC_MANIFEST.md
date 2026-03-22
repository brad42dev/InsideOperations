# I/O Spec Manifest
_Audit authority mapping for all design docs and spec docs._
_Last updated: 2026-03-21 (pass 7 — context-menu-addendum.md applied: item limit 10→15, group ordering clarified, RC-RPT-2/RC-RND-3/RC-FOR-2/RC-SET-5 menus updated)_

---

## How to Use This File

This manifest is the rulebook for the `/audit` skill. For each audit unit it defines:

- **Spec files** — primary source of truth (read first, governs architecture)
- **Design-doc files** — secondary (read after spec, mine for additive features only)
- **Relationship type** — how spec and design-doc relate
- **Target code paths** — where to look in the codebase
- **Architectural non-negotiables** — things GAP_ANALYSIS commonly marks "DONE" but gets wrong
- **Known false-DONE patterns** — specific items that appeared done but weren't

### Cross-Cutting Rule

**When auditing ANY module unit (Wave 1–3), the auditor MUST also check all Wave 0 contracts that list that module in their `Applies to` matrix.** Wave 0 features are defined once here and verified in every qualifying module — they are not "someone else's job."

### Two-Phase Workflow for Unspecced Features

Some Wave 0 contracts are marked **⚠️ NOT SPECCED** — they describe behavior expected by users but not written in any design doc. These cannot be audited until the behavior is first decided.

```
⚠️ NOT SPECCED contract
        │
        ▼
   /design-qa {contract-id}
   ├── Inventories all current implementations across codebase
   ├── Produces cross-module comparison table
   ├── Asks targeted Q&A to resolve design ambiguities
   └── Writes docs/decisions/{slug}.md + updates manifest
        │
        ▼
   Contract now has a decision file → ⚠️ removed
        │
        ▼
   /audit {contract-id} or /audit {module}
   └── Verifies code against the decided spec
```

Run `/design-qa` first on any `⚠️ NOT SPECCED` contract. Do not create implementation tasks until the decision file exists.

Decision files live in `docs/decisions/`. Template: `docs/DECISION_TEMPLATE.md`.

### Relationship Types

| Type | Meaning | Conflict rule |
|------|---------|---------------|
| **OVERHAUL** | Spec completely replaces design-doc for architecture decisions | Spec wins on everything; design-doc consulted only for features not mentioned in spec |
| **SUPPLEMENT** | Spec adds protocol/implementation depth to design-doc | Both used together; spec wins on conflicts |
| **DESIGN-DOC-ONLY** | No spec_doc exists; design-doc is sole authority | Design-doc wins |

### Audit Decision Logic

```
If OVERHAUL:
  1. Read spec → build complete feature list
  2. Read design-doc → add any feature NOT mentioned in spec (additive only)
  3. If design-doc feature contradicts spec architecture → discard it
  4. Feature list vs code → catalog (✅ correct / ⚠️ wrong / ❌ missing)

If SUPPLEMENT:
  1. Read both → union of features; spec governs architecture decisions
  2. Feature list vs code → catalog

If DESIGN-DOC-ONLY:
  1. Read design-doc → feature list vs code → catalog
```

---

## Audit Execution Order

Run in wave order. Later waves depend on Wave 1 foundations being defined.
**WAVE 0 is not a separate audit pass** — its items are injected into each qualifying Wave 1–3 audit automatically. See the Cross-Cutting Rule above.

```
WAVE 0 — Cross-Cutting Contracts (applied to every qualifying module)
  CX-EXPORT          Universal export button + 6 formats in every module table/toolbar
  CX-POINT-CONTEXT   Point right-click menu on every point-bound element (shell-level, all modules)
  CX-ENTITY-CONTEXT  Entity list row right-click CRUD menu — P2 pattern + per-entity extensions
  CX-CANVAS-CONTEXT  Designer canvas right-click menus per node type (spec §6, MOD-DESIGNER only)
  CX-POINT-DETAIL    Point Detail floating panel (triggered from context menu)
  CX-PLAYBACK        Historical Playback Bar in time-aware modules
  CX-RBAC            Per-module RBAC enforcement on every route, action, and empty-state CTA
  CX-ERROR           React error boundary per module with [Reload Module] recovery UI
  CX-LOADING         Module-shaped skeleton loading states (not generic shimmer)
  CX-EMPTY           Tailored empty states (not generic "No data found")
  CX-TOKENS          Design token compliance — all 3 themes, no hardcoded colors
  CX-KIOSK           Kiosk mode (?kiosk=true hides chrome) in applicable modules

WAVE 1 — Graphics Foundation (no upstream spec deps)
  GFX-CORE     Graphics scene graph + rendering pipeline
  GFX-DISPLAY  Point value display elements
  GFX-SHAPES   Equipment shape library

WAVE 2 — Module Consumers (depend on Wave 1 being audited first)
  MOD-CONSOLE  Console module
  MOD-PROCESS  Process module
  MOD-DESIGNER Designer module
  OPC-BACKEND  OPC UA backend integration

WAVE 3 — Remaining Design-Doc-Only (any order, alphabetical below)
  DD-06   Frontend shell + app chrome
  DD-10   Dashboards module
  DD-11   Reports module
  DD-12   Forensics module
  DD-13   Log module
  DD-14   Rounds module
  DD-15   Settings module
  DD-16   Real-time WebSocket protocol
  DD-18   Time-series data (backend)
  DD-20   Mobile architecture + PWA
  DD-21   API design conventions
  DD-22   Deployment guide (backend/infra)
  DD-23   Expression builder
  DD-24   Universal import
  DD-25   Export system
  DD-26   P&ID recognition
  DD-27   Alert system (backend engine)
  DD-28   Email service
  DD-29   Authentication
  DD-30   Access control + shifts
  DD-31   Alerts module (frontend)
  DD-32   Shared UI components
  DD-33   Testing strategy
  DD-34   DCS graphics import
  DD-36   Observability
  DD-37   IPC contracts + wire formats
  DD-38   Frontend contracts + route map
  DD-39   .iographic format

  SKIP (fully covered by Wave 1/2):
  doc 07 → MOD-CONSOLE
  doc 08 → MOD-PROCESS
  doc 09 → MOD-DESIGNER
  doc 17 → OPC-BACKEND
  doc 19 → GFX-CORE + GFX-DISPLAY
  doc 35 → GFX-SHAPES
```

---

## WAVE 0 — Cross-Cutting Contracts

These features span multiple modules. They are defined once here. **Every audit of a Wave 1–3 unit must verify all WAVE 0 items whose `Applies to` row includes that unit.**

---

### CX-EXPORT — Universal Export

**Source**: `32_SHARED_UI_COMPONENTS.md` DataTable spec + `25_EXPORT_SYSTEM.md`

**Applies to**:

| Module | What gets exported | Permission |
|--------|--------------------|------------|
| Console | Workspace point values (current view) | `console:export` |
| Process | Visible point values + graphic data | `process:export` |
| Dashboards | Widget data (current filters) | `dashboards:export` |
| Log | Log entries (filtered) | `log:export` |
| Rounds | Round results, checklist data | `rounds:export` |
| Settings | Points, users, roles, OPC sources, etc. | `settings:export` |
| Forensics | Correlation results (adds to existing forensics export) | `forensics:export` |
| Reports | Report data (adds to existing reports export) | `reports:export` |

**Non-negotiables**:
1. Every qualifying module table/toolbar has an **Export button**. It is not buried in a menu.
2. Export inherits the current view's active filters, sort order, and visible columns — **WYSIWYG export**.
3. Supported formats: **CSV, XLSX, PDF, JSON, Parquet, HTML** (6 formats). Fewer formats is wrong.
4. Rows < 50,000: synchronous, file streams directly to browser. Rows ≥ 50,000: async job, 202 response, WebSocket `export_complete` notification → "My Exports" download link.
5. Export button is hidden (not disabled) when user lacks `<module>:export` permission.
6. Filename convention: `{module}_{entity}_{YYYY-MM-DD_HHmm}.{ext}`.

**Known false-DONE patterns**:
- Export button exists but only offers CSV (missing XLSX, PDF, JSON, Parquet, HTML)
- Export ignores active filters (exports all rows instead of filtered rows)
- Export button disabled instead of hidden when user lacks permission
- Large exports don't show async progress — browser hangs waiting
- Module has export in some tables but not all (partial implementation)

---

### CX-POINT-CONTEXT — Point Right-Click Context Menu

**Source**: `context-menu-implementation-spec.md` §2 (P1 pattern) + §15 (RC-SHARED-4 canonical component). `context-menu-addendum.md` §A4 ("Show in Console Graphic" cross-module action). Also cross-references `32_SHARED_UI_COMPONENTS.md` §11.

**Decision file**: `docs/decisions/cx-point-context.md`

**Applies to**: ALL modules that display point tag names or live/historical values — Console, Process, Dashboards, Forensics, Log, Rounds (point value readings), Alerts (alarm point references), Settings (OPC point browser). If a module shows a point value or tag name, this menu must trigger on it. See spec §16.2 for per-module coverage matrix.

**Non-negotiables**:
1. Right-clicking (desktop) or long-pressing **500ms** (mobile) on any point-bound element opens the unified **`PointContextMenu`** shared component. Individual modules must NOT implement their own version.
2. The component signature is `PointContextMenu({ pointId, tagName, isAlarm, isAlarmElement })`. Callers must pass all four props.
3. **Canonical items** (in order):
   - **Point Detail** — always visible, no permission required. `openPointDetail(pointId)`.
   - **Trend This Point** — always visible, no permission required. Opens full-screen trend (24h default).
   - *Separator*
   - **Investigate Point** — hidden (not grayed) when user lacks `forensics:read`.
   - **Report on Point** — hidden (not grayed) when user lacks `reports:read`.
   - *Separator* — only rendered when `isAlarm || isAlarmElement`
   - **Investigate Alarm** — only rendered when `isAlarm || isAlarmElement`. Hidden if user lacks `forensics:read`.
   - *Separator*
   - **Copy Tag Name** — always visible. Copies full tag name to system clipboard.
4. Items are **hidden** (not grayed) when the user lacks the required permission.
5. Menu must appear in **<50ms**. No async data fetching before menu renders.

**Known false-DONE patterns**:
- Module implements its own point right-click menu instead of the shared `PointContextMenu` component
- "Copy Tag Name" item missing — only the 4 navigation items implemented
- "Trend This Point" behind a permission gate (it requires no permission)
- Permission-lacking items are shown grayed instead of hidden
- Long-press not implemented on mobile
- Menu appears on graphic SVG elements but not on table cells, chart data points, or widget values
- "Investigate Alarm" item missing, or present unconditionally regardless of `isAlarm`/`isAlarmElement`
- Rounds, Settings point browser, or Alerts never wired up to the shared component

---

### CX-ENTITY-CONTEXT — Entity List Right-Click Context Menu

**Source**: `context-menu-implementation-spec.md` §2 (P2 base pattern) + §§7–14 (per-module entity menus). `context-menu-addendum.md` §A1 (item limit + group ordering), §A2 (RC-RPT-2, RC-RND-3, RC-FOR-2, RC-SET-5 updated menus), §A3 (submenu guidance), §A4 ("Show in Console Graphic"). Cross-references design-docs per module.

**Decision file**: `docs/decisions/cx-entity-context.md`

**Applies to**: ALL modules that render lists or tables of manageable entities. See spec §16.3 CRUD coverage matrix for the complete list.

**Non-negotiables**:
1. Right-clicking any row in an entity list opens a context menu. An entity list with no right-click behavior is wrong.
2. **Item limit**: Maximum **15 non-separator items** at root level (addendum §A1 — raised from 10). Items MUST be organized into separator-delimited groups of 3–5. If a category needs 3+ items sharing the same verb (e.g., 3+ download formats), group them into a 1-level submenu (e.g., "Download As ▸").
3. **Group ordering** (addendum §A1 — overrides §1.9 text in the base spec which was inconsistent): Primary actions → Secondary actions → Navigation → Transfer/Sharing → **Destructive (Delete) → Clipboard (Copy items last)**. Clipboard is always last.
4. **P2 base pattern** — minimum items for every entity list (order matters):
   - **Edit** — opens entity editor/form. Requires `{resource}:write` or `{resource}:manage`. Hidden if no permission.
   - **Duplicate** — creates a copy with " (Copy)" suffix (not "Copy of…"). Requires write permission. Hidden if no permission.
   - *Separator*
   - **Delete** — confirmation dialog first, then delete. Requires `{resource}:delete` or `{resource}:manage`. Grayed (not hidden) when object has dependencies; tooltip explains blocker.
   - *Separator*
   - **Copy [ObjectType]** — copies to internal clipboard. No permission required.
   - **Copy [Key Field]** — copies primary identifier to system clipboard. No permission required.
5. **Entity-specific extensions** inserted between the Duplicate and Delete groups. Key entities per spec:
   - **Users** (RC-SET-1): Disable/Enable (toggle), Reset Password (local auth only, grayed for IdP users), Terminate Sessions, Assign to Group, View Audit Log, Copy Username
   - **Roles** (RC-SET-2): Clone Role (not Duplicate), View Users with This Role. Delete gated on custom-only (predefined roles always grayed).
   - **Groups** (RC-SET-3): Add Members, Manage Roles. Delete grayed if has members.
   - **OPC Sources** (RC-SET-4): Test Connection, Enable/Disable (toggle), View Statistics, View Connected Points. Delete grayed if points reference it.
   - **Import Connections** (RC-SET-6): Test Connection, Enable/Disable. Delete grayed if definitions reference it.
   - **Import Definitions** (RC-SET-7): Run Now, View Run History, Enable/Disable.
   - **Certificates** (RC-SET-8): View Details, Download Certificate, Copy Fingerprint. No Edit (certs are immutable).
   - **Recognition Models** (RC-SET-9): View Details, Set as Active, View Feedback History. No Edit (models are immutable).
   - **Report Templates** (RC-RPT-1): Run Now, Edit in Designer, Manage Schedule. Delete grayed if has active schedules.
   - **Report Schedules** (RC-RPT-3): Edit, Enable/Disable, Run Now, Duplicate, Delete.
   - **Log Templates** (RC-LOG-2): Edit Template, Duplicate, Preview Template, Delete (grayed if in use), Export Template Definition.
   - **Round Templates** (RC-RND-1): Edit Template, Duplicate, Manage Schedule, View History, Delete (grayed if has active instances), Export Template Definition.
   - **Round Instances** (RC-RND-2): Menu varies by status — Pending: Start Round (grayed if not on assigned shift), Transfer; In-Progress: Open, Transfer; Completed: View Details, Export PDF, Reopen (admin only).
   - **Alert Templates** (RC-ALT-3): Edit, Duplicate, Send Alert from Template, Test Send (to self), Delete.
   - **Contact Groups** (RC-ALT-4): Edit, Add Members, View Members, Delete (grayed if referenced by active templates/rules).
   - **Crews** (RC-SHF-3): Edit, Add Members, View Schedule, Duplicate, Delete (grayed if assigned to future shifts).
   - **Roster / On-Site Personnel** (RC-SHF-1): View Profile, Assign to Shift, Remove from Shift (grayed if not assigned), View Presence History, Copy Name, Copy Badge ID.
   - **Investigations** (RC-FOR-1): Open, Duplicate, Share, Delete (grayed if Closed status), Export PDF, Copy Investigation Link.
   - **Dashboards** (RC-DASH-1): Open, Open in New Tab, Edit in Designer, Duplicate, Publish/Unpublish (toggle), Share, Delete (grayed if published).
6. **Permission gating**: Items the user lacks permission for are **hidden** (not grayed), except Delete which is grayed with tooltip when the object has dependencies.
7. **Destructive actions always require a confirmation dialog** before executing. No single-click deletion.

**Known false-DONE patterns**:
- Entity list rows have no right-click behavior at all
- Right-click exists in Settings but not in Rounds, Shifts, Alerts, Log (partial implementation)
- Duplicate creates "Copy of…" instead of " (Copy)" suffix
- Delete executes immediately without confirmation dialog
- Permission-lacking items are grayed instead of hidden
- Entity-specific extensions missing (only generic Edit/Delete, no Reset Password, no Test Connection, etc.)
- Delete grayed unconditionally vs. only when object has dependencies (dependency check missing)
- Menu appears but only on the Name column, not on the entire row
- Clipboard Copy items placed first instead of last (ordering rule from addendum §A1)
- RC-RPT-2: separate PDF/CSV/XLSX items instead of "Download As ▸" submenu; HTML and JSON formats missing
- RC-RND-3: "Record Video" or "Trend This Point" missing from checkpoint context menu
- RC-SET-5: "Report on Point", "Show in Console Graphic", or "View Alarm History" missing from point browser menu

---

### CX-CANVAS-CONTEXT — Designer Canvas Right-Click Menus

**Source**: `designer-implementation-spec.md` §6 "Right-Click Context Menus" (primary, 9 subsections for node types). `context-menu-implementation-spec.md` §6 provides the full index of 17 menu IDs (RC-DES-1 through RC-DES-17) and the composition model.

**Applies to**: MOD-DESIGNER only

**Non-negotiables**:
1. **Empty canvas right-click** (RC-DES-1): Paste (grayed if clipboard empty), Select All (grayed if nothing exists), Grid submenu (Show/Snap/Size), Zoom submenu, Properties. Extends P5.
2. **Any node right-click — base items** (RC-DES-2): Cut, Copy, Paste, Delete, Duplicate, Bring to Front/Forward/Backward/Back (z-order), Group (`Ctrl+G`), Ungroup, Lock/Unlock, Navigation Link submenu, Properties. These appear for ALL node types.
3. **Node-type-specific additions** (appended after base items, per spec §6.3–6.12 and context-menu spec §6):
   - `SymbolInstance` (RC-DES-3): Switch Variant, Switch Configuration, Add Display Element submenu (6 types), Bind Point…, Promote to Shape…, Save as Stencil…
   - `DisplayElement` (RC-DES-4): Change Type submenu (6 types), Bind Point…, Detach from Shape
   - `Pipe` (RC-DES-5): Toggle Auto/Manual Routing, Re-route, Change Service Type submenu, Reverse Direction
   - `ImageNode` (RC-DES-6): Replace Image…, Reset to Original Size, Crop…
   - `Stencil` (RC-DES-7): Promote to Shape…, Replace SVG…
   - `EmbeddedSvg` (RC-DES-8): Explode to Primitives, Promote to Shape…, Save as Stencil…
   - `Group` (RC-DES-9): Ungroup (in addition to base Ungroup — this is the primary action), Enter Group (isolate group for editing)
   - `TextBlock` (RC-DES-10): Edit Text (opens inline text editor), Change Font…, Text Alignment submenu
   - `Annotation` (RC-DES-11): Edit Annotation, Change Style (note/warning/info variants)
   - `Widget` (RC-DES-12): Configure Widget…, Refresh Data, Detach from Dashboard
4. **Shape palette right-click** (RC-DES-13/14/15): Library shapes → Copy to My Shapes, Export SVG. Custom shapes → Edit Shape, Export SVG, Replace SVG…, Delete. Stencils → Edit, Export SVG, Delete.
5. **Layer panel right-click** (RC-DES-16): Rename, Delete (grayed if last layer), Duplicate, Show/Hide, Lock/Unlock, Move Up/Down.
6. **Guide right-click** (RC-DES-17): Remove Guide, Lock/Unlock Guide.
7. **Disabled items shown grayed with tooltip** — NOT hidden. This is the opposite rule from CX-POINT-CONTEXT and CX-ENTITY-CONTEXT. All users see all items; permission-lacking or state-unavailable items are grayed with an explanation.
8. All menus use **Radix UI ContextMenu primitives** (not custom implementations).

**Known false-DONE patterns**:
- Empty canvas right-click not implemented (right-click on canvas does nothing)
- Node type-specific additions (RC-DES-3 through RC-DES-12) missing — only base Cut/Copy/Delete work
- Z-order items absent (Bring to Front etc. only accessible via keyboard)
- "Add Display Element" submenu missing on SymbolInstance right-click
- "Bind Point…" opens inline text input instead of Point Picker modal
- TextBlock, Annotation, Group, Widget node types have no type-specific items (spec added these)
- Shape palette and layer panel have no right-click at all
- Locked nodes show no indication of why items are disabled
- Custom `onContextMenu` + `<div>` menu instead of Radix ContextMenu primitives

---

### CX-POINT-DETAIL — Point Detail Floating Panel

**Source**: `32_SHARED_UI_COMPONENTS.md` §11 "Point Detail Panel"

**Applies to**: ALL modules (panel is shell-level, available everywhere)

**Non-negotiables**:
1. Panel is a **floating window**: draggable, resizable, pinnable (stays on screen during navigation), minimizable. Not a modal.
2. Up to **3 concurrent instances** open simultaneously. Opening a 4th closes the oldest.
3. **Session-persisted** position and size — refreshing page restores panel state.
4. Z-index at "popover" layer: above module content, below modals and emergency overlay.
5. Panel sections: Process Value, Alarm State, Graphics (which graphics contain this point), + admin-configured Data Link sections. Sections load in parallel; individual section failure does not break the panel.
6. API: `GET /api/v1/points/:id/detail` returns all panel data in one request.

**Known false-DONE patterns**:
- Panel implemented as a modal (blocks interaction with the rest of the UI)
- Only one panel instance allowed (second open replaces first)
- Panel position not persisted (resets to center on every open)
- Panel closes when navigating between modules (should survive navigation if pinned)

---

### CX-PLAYBACK — Historical Playback Bar

**Source**: `32_SHARED_UI_COMPONENTS.md` §12 "Historical Playback Bar"

**Applies to** (with mode):

| Module | Mode | What it controls |
|--------|------|-----------------|
| Console | Full | Live↔Historical toggle, scrub, play/pause, ×1–×32 speed, step, loop |
| Process | Full | Same as Console |
| Forensics | Stage scrub | Scrub through investigation timeline |
| Dashboards | Time context | Sets time range for all widgets |
| Reports | Range selection | Sets report date range |

**Non-negotiables**:
1. Playback Bar is the **same shared component** across all modules — not re-implemented per module.
2. In Full mode: scrub bar with alarm event markers overlaid, transport controls (play/pause/stop/step), speed selector (×0.25, ×0.5, ×1, ×2, ×4, ×8, ×16, ×32), loop region toggle, keyboard shortcuts (Space=play/pause, arrows=step).
3. Entering Historical mode in Console/Process switches the **entire module** (all panes) to archive data — not just the active pane.
4. Alarm markers on the scrub bar come from `GET /api/v1/alarms/events` for the displayed time range.

**Known false-DONE patterns**:
- Playback bar re-implemented per module instead of using shared component
- Speed selector missing or only offers ×1 and ×2
- Alarm markers not shown on scrub bar (bar is blank timeline)
- Historical mode only affects one pane instead of the whole workspace
- Keyboard shortcuts not implemented (Space, arrow keys)

---

### CX-RBAC — Per-Module RBAC Enforcement

**Source**: `03_SECURITY_RBAC.md`

**Applies to**: ALL modules

**Non-negotiables**:
1. Every module route checks the required permission on load. No module is accessible without the correct permission.
2. Action buttons (Create, Edit, Delete, Export, Print) are **hidden** (not disabled) when the user lacks permission.
3. **Empty-state CTAs are permission-aware**: if the CTA requires a permission the user lacks, show the description but omit the action button entirely.
4. The sidebar navigation item for a module is hidden if the user has no permissions for any action in that module.
5. API endpoints enforce RBAC server-side regardless of what the UI shows (UI hiding is defense-in-depth, not the sole check).

**Known false-DONE patterns**:
- UI hides buttons correctly but API endpoints don't check permissions (server-side gap)
- Buttons disabled with tooltip "you don't have access" instead of hidden
- Route accessible directly via URL even though sidebar link is hidden
- Empty state CTAs always rendered regardless of permission (user sees "Create X" CTA they can't use)

---

### CX-ERROR — React Error Boundary

**Source**: `32_SHARED_UI_COMPONENTS.md` §Error States

**Applies to**: ALL frontend modules

**Non-negotiables**:
1. Each module's content area is wrapped in a **React error boundary**. A crash in one module does not take down the app shell or other modules.
2. Error UI shows: generic error message + **[Reload Module]** button (remounts the module component, no full page reload).
3. Large modules (Console, Forensics, Designer) have **nested error boundaries** around individual panes/panels — a single pane crash must not kill the whole module.
4. Error is reported to the observability system (structured log + optional Sentry hook).

**Known false-DONE patterns**:
- No error boundary — uncaught React errors crash the entire app
- Error boundary exists but shows no recovery UI (blank white screen)
- [Reload Module] triggers a full `window.location.reload()` instead of just remounting the component
- No nested boundaries in large modules (one chart crash kills the whole Forensics view)

---

### CX-LOADING — Module Skeleton Loading States

**Source**: `32_SHARED_UI_COMPONENTS.md` §Loading States

**Applies to**: ALL frontend modules

**Non-negotiables**:
1. Each module provides a **module-shaped skeleton** that matches the structure of the content being loaded. Not a generic shimmer bar or spinner covering the whole area.
2. Skeleton must appear immediately on navigation (no blank flash before skeleton).
3. Partial loading is supported: when part of the data loads, that part renders; skeleton remains for still-loading sections.

**Known false-DONE patterns**:
- Generic shimmer rectangle used for all modules (identical loading state across Console, Forensics, Settings)
- Loading spinner overlaid on blank page instead of structural skeleton
- No partial loading — entire module waits for all data before rendering anything
- Skeleton shape doesn't match module layout (skeleton for Console showing Forensics-shaped columns)

---

### CX-EMPTY — Tailored Empty States

**Source**: `32_SHARED_UI_COMPONENTS.md` §Empty States

**Applies to**: ALL frontend modules

**Non-negotiables**:
1. Empty states are **tailored per module and entity**. No generic "No data found" messages.
2. Empty state includes: module-specific illustration or icon, plain-language explanation of why it's empty, and a CTA (if applicable).
3. CTAs in empty states are **permission-aware**: rendered only if the user has the permission to take the action. If not, show description only (no orphaned "Get started" button the user can't use).
4. Table-level empty states (inside a DataTable) are distinct from module-level empty states (entire module has no data).

**Known false-DONE patterns**:
- Generic "No results" text used across all modules
- Empty state CTA always shown regardless of permission ("Create Workspace" shown to read-only users)
- Table empty state and module empty state are identical (no distinction)
- Empty state shows no explanation — just "No data"

---

### CX-TOKENS — Design Token Compliance

**Source**: `38_FRONTEND_CONTRACTS.md` (138 design tokens, 3 themes)

**Applies to**: ALL frontend modules

**Non-negotiables**:
1. All colors, spacing, radius, shadow, and typography values reference **CSS custom properties** from the token registry. No hardcoded hex colors, no hardcoded pixel values for semantic properties.
2. All 3 themes must work: **dark** (default), **light**, **hphmi** (high-contrast). Switching theme at runtime must not require a page reload.
3. Alarm/status tokens (`--io-alarm-critical`, `--io-alarm-high`, etc.) are **non-customizable** — they follow ISA-101 and do not change per theme.
4. The 138 tokens in `tokens.ts` cover all 3 themes. A module that adds a new color outside the token system is wrong.

**Known false-DONE patterns**:
- Module works in dark theme but breaks visually in light or hphmi (hardcoded colors that assume dark background)
- Alarm colors adjusted by theme (ISA-101 requires fixed alarm colors regardless of theme)
- New components added post-spec use hardcoded colors instead of referencing tokens
- Theme switch requires page reload because CSS vars not used (colors set in JS)

---

### CX-KIOSK — Kiosk Mode

**Source**: `06_FRONTEND_SHELL.md` + `10_DASHBOARDS_MODULE.md`

**Applies to**: Console, Process, Dashboards

**Non-negotiables**:
1. URL parameter `?kiosk=true` hides all chrome: top bar, sidebar, status bar, breadcrumbs. Only the module content area is visible.
2. Kiosk mode activates without requiring login if the session is already authenticated.
3. Exiting kiosk mode: `Escape` key or a hoverable corner trigger (mouse dwell 1.5s on corner) reveals a minimal exit button.
4. Module continues to function fully in kiosk mode (real-time updates, navigation links, playback all work).

**Known false-DONE patterns**:
- `?kiosk=true` hides sidebar but not top bar (partial implementation)
- No way to exit kiosk mode (user is trapped)
- Kiosk mode breaks real-time subscriptions (SharedWorker disconnect on DOM mutation)
- Kiosk implemented only for Dashboards, not Console or Process

---

## WAVE 1 — Graphics Foundation

---

### GFX-CORE — Graphics Scene Graph + Rendering Pipeline

**Relationship**: OVERHAUL of `19_GRAPHICS_SYSTEM.md`

**Spec files (primary)**:
- `/home/io/spec_docs/graphics-scene-graph-implementation-spec.md` ← sole authority on architecture
- `/home/io/spec_docs/spec-docs-prompt.md` ← cluster index, key architecture rules §1

**Design-doc files (gap-fill only)**:
- `/home/io/io-dev/io/design-docs/19_GRAPHICS_SYSTEM.md` ← check for features not in spec

**Target code paths**:
- `frontend/src/shared/types/graphics.ts` — TypeScript interfaces for all 11 node types + `GraphicDocument` root
- `frontend/src/shared/graphics/SceneRenderer.tsx` — main rendering pipeline
- `frontend/src/shared/graphics/shapeCache.ts` — shape SVG loading + caching
- `frontend/src/shared/graphics/pointExtractor.ts` — subscription walk
- `frontend/src/shared/graphics/pipeRouter.ts` — pipe auto-routing
- `frontend/src/shared/graphics/commands.ts` — undo/redo command classes
- `frontend/src/shared/graphics/operationalState.css` — io-running/stopped/fault CSS
- `frontend/src/api/graphics.ts` — API client

**Architectural non-negotiables** (fail = wrong, not just missing):

1. **SVG is never stored. Scene graph JSON is the source of truth.** The DB stores `scene_data JSONB` containing a `GraphicDocument`. SVG is derived at render time. Any code that saves SVG strings to DB is wrong.

2. **11 node types, exactly.** `SceneNodeType` (spec §1, rows 2–12) has exactly 11 members — all must be handled: `symbol_instance`, `display_element`, `primitive`, `pipe`, `text_block`, `stencil`, `group`, `annotation`, `image`, `widget`, `embedded_svg`. Row 13 in the spec table is a structural note, not a type. `GraphicDocument` is the document root (extends `SceneNodeBase`) but is NOT a `SceneNode`. `NavigationLink` is an optional property on `SceneNodeBase`, not a node type. A renderer that handles 6-8 types and ignores the rest is wrong.

3. **Hybrid SVG + HTML overlay architecture.** Canvas is NOT a single SVG. It is two layers: SVG layer (shapes, pipes, primitives, display elements) + HTML overlay layer (Widget nodes only). Both layers share viewport transform. If Widgets render inside `<svg>`, it is wrong.
   - **Responsive hybrid element thresholds**: 3,000 elements (desktop), 1,500 (tablet), 800 (phone). Above threshold, consider canvas fallback for performance. Below threshold, SVG layer is canonical.

4. **Layers are NOT tree nodes.** `LayerDefinition[]` is metadata on `GraphicDocument`. Nodes reference their layer via `layerId`. There is no layer node in the tree. Rendering order is derived from layer order + node order within the layer.

5. **Shape SVGs are loaded by reference at render time, never embedded in scene_data.** `SymbolInstance` stores a `shapeRef.shapeId`. The renderer fetches the SVG via `POST /api/shapes/batch`. Any scene graph with embedded SVG paths instead of shapeId references is wrong.

6. **PointBinding has both `pointId` and `expressionId`.** Both must be treated as valid subscription keys. `pvKey = pointId ?? expressionId`. Code that only handles `pointId` is wrong.

7. **Real-time updates bypass React entirely.** Updates flow: WebSocket → mutable buffer → requestAnimationFrame drain loop → direct SVG DOM mutation via O(1) `pointToElements` map. useWebSocket/useState/useEffect for point values is architecturally wrong for the graphics layer.

8. **NavigationLink on any node.** Any `SceneNode` can have `navigationLink`. Clicking the node navigates to `targetGraphicId` or opens `targetUrl`. Not just SymbolInstances.

9. **`bindings` JSONB denormalization.** The `design_objects` table has a `bindings` JSONB column (array of `{nodeId, pointId, expressionId}`) maintained by a DB trigger whenever `scene_data` is saved. A separate `design_object_points` denormalized table is also maintained by the same trigger. Point subscription queries must use this denormalized data, not walk `scene_data` JSONB at query time.

10. **Image asset loading via content hash.** `ImageNode` stores `contentHash`, not a URL. Images are fetched at `GET /api/graphics/images/{hash}` and converted to blob URLs by the renderer. Storing raw URLs or base64 in the scene graph is wrong.

**Known false-DONE patterns**:
- Scene graph may use only 6-8 node types instead of all 11 (missing: stencil, annotation, image, widget, embedded_svg, etc.)
- Widget nodes may render inside SVG instead of HTML overlay
- Real-time updates may go through React state (useWebSocket) instead of direct DOM
- PointBinding may only use `pointId`, ignoring `expressionId`; also: both `pointId` AND `expressionId` can be null for a disconnected element — null-check before subscribing, do not crash
- Layers may be implemented as tree nodes instead of metadata on `GraphicDocument`

**Design-doc 19 additive features to check** (may not be in spec, not architectural):
- Graphic version history / rollback
- Graphic thumbnail generation (described in spec also, cross-check)
- Export to .iographic format (covered more in doc 39)

---

### GFX-DISPLAY — Point Value Display Elements

**Relationship**: OVERHAUL (of display-element section of `19_GRAPHICS_SYSTEM.md`)

**Spec files (primary)**:
- `/home/io/spec_docs/display-elements-implementation-spec.md` ← pixel-perfect authority
- Visual reference: `/home/io/spec_docs/shape-sidecar-preview.html` (open in browser)

**Design-doc files (gap-fill only)**:
- `/home/io/io-dev/io/design-docs/19_GRAPHICS_SYSTEM.md` §Display Elements section

**Target code paths**:
- `frontend/src/shared/graphics/displayElements/` — 6 element components
- `frontend/src/shared/graphics/SceneRenderer.tsx` — `renderDisplayElement()` function
- `frontend/src/shared/graphics/alarmFlash.css` — 1Hz flash animation

**Architectural non-negotiables**:

1. **Display elements are SVG, not React components.** They render as `<g>` elements inside the SVG layer. They are NOT `<div>` components in the HTML overlay. (Exception: only `widget` nodes go in overlay.)

2. **6 types only, exactly these names**: `text_readout`, `analog_bar`, `fill_gauge`, `sparkline`, `alarm_indicator`, `digital_status`. Verify each is implemented.

3. **Color system is token-based, no invented colors.** Every color traces to a named token. The color table in the spec is definitive:
   - Text readout box fill: `#27272A` (`--io-surface-elevated`)
   - Text readout border normal: `#3F3F46` (`--io-border`)
   - Signal line stroke: `#52525B` (`--io-border-strong`)
   - Alarm High: `#F97316` (orange, NOT `#F59E0B` amber — deliberately different)
   - Equipment gray: `#808080` (ISA-101, never changes for alarm state)

4. **Analog bar has 5-zone warm-to-cool ramp** (not 3-zone, not alarm colors):
   - HH: `#5C3A3A`, H: `#5C4A32`, Normal: `#404048`, L: `#32445C`, LL: `#2E3A5C`
   - Zone color is REPLACED (not overlaid) by ISA alarm priority color when that zone is in alarm

5. **Alarm Indicator shapes are ISA-18.2 specific**: Critical=rect 24×18 rx=2, High=triangle up, Medium=triangle down, Advisory=ellipse, Custom=diamond. Using generic shapes is wrong.

6. **1Hz flash for unacknowledged alarms** — CSS animation, not JS setInterval.

7. **Signal line** — dashed connector from display element back to parent SymbolInstance when `cfg.showSignalLine`. Drawn in SVG as `<line>` with `strokeDasharray="3 2"`.

8. **Quality states** — all 6 states must produce specific rendered output (just checking "a state exists" is wrong):
   - `good` → normal rendering, no modifier
   - `bad` → red (`#EF4444`) dashed border around entire element; `????` value text
   - `comm_fail` → gray (`#52525B`) border; "COMM" text overlaid on value
   - `stale` → entire element at 60% opacity + dashed border
   - `uncertain` → dotted border instead of solid
   - `manual` → cyan (`#06B6D4`) "M" badge in top-right corner (separate from alarm state)

9. **Analog bar pointer shape** — the current-value pointer is a filled triangle (~6px wide × 8px tall), NOT a circle or tick line. When the value is in an alarm zone, the pointer fill uses the zone's ISA alarm priority color. A separate horizontal tick line crosses the bar at the pointer's Y position. Both triangle AND line must be present.

**Known false-DONE patterns**:
- Analog bar may use alarm priority colors instead of the muted warm-to-cool ramp
- Analog bar pointer rendered as a circle or line instead of a filled triangle + crossing tick line
- Alarm indicator may use generic colored circles instead of ISA-18.2 shapes
- Flash animation may use JS timer instead of CSS animation
- Quality states may only handle `good` and `bad`, missing `comm_fail`, `stale`, `uncertain`, `manual`
- Quality state may be visually present but use wrong treatment (e.g., `stale` just changes border color instead of reducing opacity to 60%)
- Colors may be hardcoded hex instead of CSS token references

---

### GFX-SHAPES — Equipment Shape Library

**Relationship**: OVERHAUL of `35_SHAPE_LIBRARY.md`

**Spec files (primary)**:
- `/home/io/spec_docs/shape-library-implementation-spec.md` ← file structure and sidecar schema authority
- Visual reference: `/home/io/spec_docs/shape-library-preview.html` (open in browser)

**Design-doc files (gap-fill only)**:
- `/home/io/io-dev/io/design-docs/35_SHAPE_LIBRARY.md` ← check for category/shape count differences

**Target code paths**:
- `frontend/public/shapes/` — SVG files + JSON sidecars
- `frontend/public/shapes/index.json` — shape library index
- `frontend/src/shared/graphics/shapeCache.ts` — load + cache logic
- Backend: `POST /api/shapes/batch` endpoint in api-gateway

**Architectural non-negotiables**:

1. **Every shape has both an `.svg` file and a `.json` sidecar.** The sidecar defines: `connectionPoints`, `textZones`, `valueAnchors`, `alarmAnchor`, `operationalStates`, `composableParts`. A shape without a sidecar is incomplete.

2. **Equipment SVG files are state-neutral.** Shape SVG files contain only gray strokes (`stroke="#808080"`) and transparent fills. State colors are NEVER in the SVG file — they are applied by the renderer at runtime via CSS classes: `.io-running` (fill `#059669`, stroke `#047857`), `.io-stopped` (transparent fill, gray stroke), `.io-transitioning` (fill `#FFAA00`, stroke `#D97706`), `.io-fault` (fill `#D946EF`, stroke `#C026D3`), `.io-oos` (fill `url(#io-hatch-pattern)`). SVG files with hardcoded operational colors are wrong.

3. **Shape file structure** — categories must match spec: `valves/`, `pumps/`, `rotating/`, `heat-transfer/`, `instruments/`, `vessels/`, `reactors/`, `columns/`, `tanks/`, `separation/`, `control/`, `actuators/`, `agitators/`, `supports/`, `indicators/`.

4. **Composable parts** (actuators, agitators, supports) are separate SVG files that attach at defined `composableParts.attachmentPoints` from the sidecar. They are NOT baked into the base shape SVG.

5. **`POST /api/shapes/batch`** — batch endpoint exists and returns multiple shape SVGs + sidecars in one request. Single-shape fetching per-render is wrong (causes waterfall).

6. **valueAnchors** — sidecar defines where display elements are initially positioned when auto-placed by Designer. These are suggestion points, not constraints.

**Known false-DONE patterns**:
- Shapes may have SVG files but no JSON sidecars (or sidecars with wrong schema)
- Shape SVGs may have hardcoded operational state colors instead of being state-neutral gray
- Composable parts may be baked into base shape SVGs rather than separate files
- Batch endpoint may not exist (shapes fetched one at a time)
- Shape count may be wrong vs spec (spec defines specific shapes per category)
- Shape SVG `viewBox` may not match the sidecar's `geometry.viewBox`, causing transform calculations to be off by a scale factor — verify both match

---

## WAVE 2 — Module Consumers

---

### MOD-CONSOLE — Console Module

**Relationship**: OVERHAUL of `07_CONSOLE_MODULE.md`

**Spec files (primary)**:
- `/home/io/spec_docs/console-implementation-spec.md` ← sole authority

**Design-doc files (gap-fill only)**:
- `/home/io/io-dev/io/design-docs/07_CONSOLE_MODULE.md`
- `/home/io/io-dev/io/design-docs/32_SHARED_UI_COMPONENTS.md` — shared Trend, Table, Playback Bar, Point Context Menu

**Depends on**: GFX-CORE, GFX-DISPLAY, GFX-SHAPES (Wave 1 must be audited first)

**Target code paths**:
- `frontend/src/pages/console/index.tsx` — main Console page
- `frontend/src/pages/console/ConsolePalette.tsx` — left nav panel (4 accordion sections)
- `frontend/src/pages/console/WorkspaceGrid.tsx` — react-grid-layout grid
- `frontend/src/pages/console/PaneWrapper.tsx` — per-pane chrome + context menu
- `frontend/src/pages/console/panes/` — GraphicPane, TrendPane, TablePane, EmptyPane
- `frontend/src/api/console.ts` — workspace CRUD API client
- `package.json` — verify react-grid-layout@2.x, @dnd-kit, zundo@2.x are installed

**Architectural non-negotiables**:

1. **Three Zustand stores, strict separation**:
   - `WorkspaceStore` — with `zundo` temporal middleware (not useRef stacks). Only store with undo/redo.
   - `SelectionStore` — ephemeral pane selection, no temporal, never persisted
   - `RealtimeStore` — point value buffer, subscription registry. No React state for point values.
   - All three must exist as separate stores. One monolithic store is wrong.

2. **`zundo` (the library) for undo/redo**, not custom useRef stacks. `temporal.undo()` / `temporal.redo()`. Stack resets on workspace switch. GAP_ANALYSIS incorrectly marked useRef stacks as done.

3. **`react-grid-layout` v2 for the workspace grid** — not CSS grid. Items have `{i, x, y, w, h}` layout descriptors. Panes are draggable and resizable within the grid. GAP_ANALYSIS accepted CSS grid as "acceptable" — it is not per spec.

4. **Real-time updates bypass React** (same as GFX-CORE rule 7). `RealtimeUpdateManager` class drains a mutable buffer on requestAnimationFrame. Point values in GraphicPane go direct to DOM, never through React state.

5. **Left nav panel: 4 accordion sections** (Workspaces, Graphics, Widgets, Points), each with: favorites group, view mode selector (list/thumbnails/grid), search/filter. Panel is collapsible, resizable 200-400px, width persisted.

6. **SharedWorker manages WebSocket connection** — a single SharedWorker owns the WebSocket to the broker. Multiple Console tabs/windows share one connection. A plain WebSocket per tab is wrong.

7. **Workspace stored in `design_objects` table** with `type = 'workspace'`. Not a separate table. `scene_data` JSONB holds `WorkspaceConfig`.

8. **Historical playback syncs ALL panes** to a single timestamp via `WorkspaceStore`. Each pane independently fetches archive data for its points at the playback timestamp. The Playback Bar is part of WorkspaceStore state.

9. **Detached window support via SharedWorker** — `window.open()` for a pane opens a new window that shares the same SharedWorker connection and subscribes independently.

10. **Status bar** (bottom of Console): connection status (dot + text), subscribed point count (from RealtimeStore), current workspace name, Live/Historical mode indicator. Required; not optional chrome.

11. **Template switching** — switching a workspace template (Full/Split/Quad/etc.) does NOT discard pane content. Existing panes are remapped to new grid positions; panes that no longer fit are moved to the overflow stack, not deleted. Discarding pane content on template switch is wrong.

12. **Auto-save failure behavior** — workspace auto-save failure shows a persistent warning banner (not a toast that dismisses). The banner includes a manual "Save now" button. Silently failing or showing a dismissible toast is wrong.

13. **Aspect ratio lock** — panes have an optional aspect ratio lock toggle. When locked, resizing the pane preserves the original graphic aspect ratio. The lock state is persisted in `WorkspaceConfig`.

**Known false-DONE patterns**:
- undo/redo implemented with useRef stacks instead of zundo temporal middleware
- Grid implemented with CSS grid instead of react-grid-layout
- WebSocket managed per-tab instead of via SharedWorker
- Left panel has 3 sections (Graphics/Widgets/Points) missing Workspaces section or missing favorites/view-mode-selector within sections
- Left panel Workspaces section exists but does not allow workspace creation/deletion from the panel (forces navigation elsewhere)
- Real-time updates going through React state (useWebSocket/useState) — entire GraphicPane re-renders on every point value change
- `RealtimeStore` mutable buffer drained by RAF loop but actually using debounce/batching, causing point updates to lag
- `SelectionStore` state (active pane, selected element) stored in `WorkspaceStore` — persists across refreshes, wrong
- Grid pane positions not reset when switching workspaces (panes from 2×2 workspace bleed into 4×4 workspace layout)
- Status bar missing or incomplete
- Workspace config stored in separate table instead of design_objects

**Design-doc 07 additive features to check**:
- Workspace sharing via link (URL-based sharing)
- Print support: browser print + server-side PDF (A1 wall-mount size)
- Data export: 6 formats (CSV, JSON, Excel, PDF, PNG, SVG)
- Live/Historical toggle visible in toolbar or status bar

---

### MOD-PROCESS — Process Module

**Relationship**: OVERHAUL of `08_PROCESS_MODULE.md`

**Spec files (primary)**:
- `/home/io/spec_docs/process-implementation-spec.md` ← sole authority

**Design-doc files (gap-fill only)**:
- `/home/io/io-dev/io/design-docs/08_PROCESS_MODULE.md`

**Depends on**: GFX-CORE, GFX-DISPLAY, GFX-SHAPES (Wave 1)

**Target code paths**:
- `frontend/src/pages/process/index.tsx` — main Process page
- `frontend/src/pages/process/Minimap.tsx` (or inline in index) — minimap overlay
- `frontend/src/shared/graphics/lod.css` — LOD visibility CSS

**Architectural non-negotiables**:

1. **Viewport-based subscriptions with adaptive spatial index.** Process subscribes ONLY to points whose elements are visible in the current viewport. The binding index is a **flat sorted array by default**; it is replaced with an `rbush` R-tree only when the graphic has **>2,000 bound elements**. Subscription is recalculated on pan/zoom, debounced 200ms. A simple "subscribe to all points in the graphic" approach is wrong.

2. **4-tier LOD system** — CSS-driven, NOT a single class toggle on the whole SVG:
   - LOD 0 (<15% zoom): equipment outlines only, ~200 alarm/state points subscribed
   - LOD 1 (15-40% zoom): major equipment + process lines
   - LOD 2 (40-80% zoom): equipment + instruments + key labels
   - LOD 3 (>80% zoom): full detail, all elements visible
   - **Class applied to `io-canvas-container` div** (e.g. `<div class="io-canvas-container lod-2">`), NOT to the SVG root. Individual SVG elements carry a `data-lod="N"` attribute. CSS rules like `[data-lod="3"] { display: none }` on `lod-0`/`lod-1`/`lod-2` containers hide detail elements. LOD class on SVG root is wrong.

3. **Minimap** — persistent corner overlay showing full graphic thumbnail with a rectangle indicating current viewport position. Click/drag minimap to navigate. Updates continuously as viewport changes.

4. **5%-800% zoom range** (Console is 25%-400%). CSS transform matrix on the SVG viewport container. Smooth pan: pointer drag with `cursor:grab`.

5. **Viewport bookmarks** — save/restore named viewport positions (x, y, zoom) per user per graphic. Stored server-side in user preferences.

6. **Left sidebar sections**: Views (graphics list with favorites), Bookmarks, Navigation (hierarchy tree), Recent. Different from Console's 4-section panel.

7. **Shared rendering pipeline with Console** — Process does NOT have its own renderer. It uses the same `SceneRenderer` component. Process-specific differences are: viewport container CSS, LOD class application, and subscription strategy.

8. **Historical playback is viewport-aware** — fetches archive data only for visible points, not all points in the graphic. Pan during playback triggers background fetch of newly-visible points.

9. **Initial load: zoom-to-fit** — when a graphic first loads in Process view, the viewport auto-zooms to fit the entire graphic within the viewport. Users then zoom in to the area of interest. Loading at 100% zoom (no fit) is wrong.

10. **Variable pre-fetch buffer** — the viewport subscription slightly over-fetches beyond the visible viewport edge to reduce subscription latency on pan. Buffer is zoom-dependent: **10%** margin at >100% zoom, **8%** at 30–100% zoom, **5%** at <30% zoom. A fixed 10% buffer is wrong.

11. **Scope warning toast** — navigating away from a graphic that has active (non-playback) subscriptions shows a brief "Unsubscribing N points" toast (informational, auto-dismisses 3s). Not a blocking confirm dialog.

**Known false-DONE patterns**:
- Viewport subscriptions computed as "all points in graphic" with debounce (no spatial index, no LOD-aware filtering)
- Spatial index always using R-tree regardless of element count (should be flat array by default, rbush only >2,000)
- LOD implemented as a single CSS class toggle or applied to SVG root instead of 4-tier `data-lod` attribute system on container div
- Minimap missing or showing only a static thumbnail without live viewport rectangle overlay
- Zoom range copied from Console (25%-400%) instead of Process range (5%-800%)
- Bookmarks stored in localStorage instead of server-side user preferences
- Bookmark saves graphic ID + zoom but not pan position (x, y) — restoring jumps to zoom but not pan, wrong
- Left sidebar structured like Console palette instead of Process-specific Views/Bookmarks/Navigation/Recent
- Initial load at 100% zoom instead of zoom-to-fit entire graphic
- Fixed 10% pre-fetch buffer instead of variable 5-10% based on zoom level
- LOD 0 at <15% zoom hides ALL elements — must still show ~200 alarm/state points at any zoom level
- Minimap renders once at load time and does not update viewport rectangle as user pans (must be live)

---

### MOD-DESIGNER — Designer Module

**Relationship**: OVERHAUL of `09_DESIGNER_MODULE.md`

**Spec files (primary)**:
- `/home/io/spec_docs/designer-implementation-spec.md` ← architecture authority
- `/home/io/spec_docs/designer-ui-prompt.md` ← visual layout authority

**Design-doc files (gap-fill only)**:
- `/home/io/io-dev/io/design-docs/09_DESIGNER_MODULE.md`
- `/home/io/io-dev/io/design-docs/DESIGNER_WORK_QUEUE.md` ← known work items

**Decision files**:
- `docs/decisions/designer-resize-completeness.md` — fix resize for all node types + multi-node resize (tasks 011–015)
- `docs/decisions/designer-canvas-size-controls.md` — New Graphic dialog W/H, Properties dialog, boundary visual (tasks 016–018)
- `docs/decisions/designer-cross-mode-palette.md` — all elements in all modes, scrollable report canvas (tasks 019–020)
- `docs/decisions/designer-groups-and-tabs.md` — group management, in-place edit, file tabs, sub-tabs, promote group to shape (tasks 021–025)

**Depends on**: GFX-CORE, GFX-DISPLAY, GFX-SHAPES (Wave 1)

**Target code paths**:
- `frontend/src/pages/designer/` — all Designer files
- `frontend/src/pages/designer/index.tsx` — Designer hub (3 modes)
- `frontend/src/pages/designer/DesignerCanvas.tsx` — main canvas
- `frontend/src/shared/graphics/commands.ts` — command pattern for undo/redo
- `frontend/src/shared/graphics/selectionStore.ts` — selection state

**Architectural non-negotiables**:

1. **Designer has 3 modes**: Graphic mode (process graphics), Dashboard mode (dashboard layouts), Report mode (report templates). Each mode has different tool palettes and property panels. A single-mode designer is wrong.

2. **Command pattern for undo/redo** — every mutation is a Command object with `execute()` and `undo()`. Commands are logged in the undo stack. Direct state mutation without commands is wrong.

3. **Scene graph is the single source of truth** — Designer edits the scene graph JSON directly (in `sceneStore`). SVG.js is a **rendering bridge**: it reads the scene graph and produces SVG DOM. It may also be queried for hit-testing (which element did the user click). SVG.js must NOT own node data — position, size, and all properties live in `sceneStore`. Writing node positions directly to SVG.js (`.move()`, `.attr('x', x)`) without updating `sceneStore` first is wrong. SVG.js DOM is always a derived view, never a source of truth.

4. **Point bindings are scene graph metadata**, not overlays. `DisplayElement.binding.pointId` is stored in the scene graph. The Designer's point binding UI writes to this field. A separate "binding layer" overlay stored elsewhere is wrong.

5. **.iographic import/export** — Designer can import `.iographic` ZIP files (doc 39). Imported shapes must be parsed into scene graph nodes (SymbolInstance, Primitive, etc.) — not stored as raw SVG blobs.

6. **Shape library panel** — shapes are placed by dragging from the shape library panel onto the canvas. Drop creates a `SymbolInstance` node with the `shapeRef.shapeId` set. The SVG is loaded at render time, not embedded in the node.

7. **Three Zustand stores, strict separation**:
   - `sceneStore` — scene graph tree (`GraphicDocument` root + all `SceneNode[]`). This is the editing model. Single source of truth for all node positions, properties, and structure.
   - `uiStore` — tool selection, cursor mode, active drag state, hover highlights, panel widths, zoom level. Ephemeral; never persisted.
   - `historyStore` — `SceneCommand` undo stack (or zundo temporal on `sceneStore`). Commands implement `execute()` / `undo()`. Stack resets on file open/new.
   - One monolithic Designer store is wrong. Stores that bleed concerns (e.g. selection state inside sceneStore) are wrong.

8. **Drag preview exception (allowed divergence)** — during an active drag, the SVG DOM may temporarily diverge from `sceneStore` for 60fps preview performance. The renderer moves the dragged element's SVG DOM node directly (bypassing store) to show live position. On `mouseup`, a single `MoveNodeCommand` commits the final position to `sceneStore`, which then re-renders. This is the ONLY intentional DOM-ahead-of-store pattern. All other mutations must go through the store first.

**Known false-DONE patterns**:
- Designer uses SVG.js as the editing model (stores positions in SVG DOM via `.move()`; reads values back from `.x()`) instead of sceneStore as source of truth
- Event handlers call `shape.attr('x', x)` or `element.move(x, y)` directly without updating sceneStore → state divergence on next re-render
- `sceneStore` / `uiStore` / `historyStore` collapsed into one monolithic Designer store
- Selection state (`selectedNodeIds`) stored in sceneStore (persisted) instead of uiStore (ephemeral)
- Drag updates committing to sceneStore on every mousemove tick (60fps writes) instead of once on mouseup
- Only one designer mode (graphic) instead of three (graphic/dashboard/report)
- Undo/redo uses a snapshot stack instead of Command objects
- .iographic import creates raw SVG blobs instead of parsing into scene graph nodes

---

### OPC-BACKEND — OPC UA Backend Integration

**Relationship**: SUPPLEMENT to `17_OPC_INTEGRATION.md`

**Spec files (primary)**:
- `/home/io/spec_docs/opc-server-protocol-spec.md` ← SimBLAH OPC UA protocol details

**Design-doc files (used together)**:
- `/home/io/io-dev/io/design-docs/17_OPC_INTEGRATION.md` ← opc-service architecture

**Target code paths**:
- `services/opc-service/src/` — Rust OPC UA client service
- `services/opc-service/src/driver.rs` — OPC UA connection + subscription
- `services/opc-service/src/db.rs` — metadata write to DB

**Architectural non-negotiables**:

1. **7 security policy endpoints** on SimBLAH. Client must negotiate the highest available: prefer `Aes256_Sha256_RsaPss/SignAndEncrypt`, fall back gracefully.

2. **Namespace ns=1** (`urn:simblah:opc-server`) is the application namespace. All custom nodes (Plant folder, process units, areas, points, alarms) use ns=1. Standard OPC UA infrastructure (Objects, Server, etc.) uses ns=0. A&C methods have dual NodeIds: one ns=0 standard and one ns=1 application — the client must dispatch to both.

3. **OPC UA A&C (Alarms & Conditions)** — Part 9 event subscription via EventFilter. `ConditionRefresh` NodeId is `ns=0;i=3875`. Events written to `events` table. All 7 A&C methods must be implemented: `Acknowledge`, `ConditionRefresh`, `Enable`, `Disable`, `TimedShelve`, `OneShotShelve`, `Unshelve`. Missing any A&C method means alarms cannot be properly acknowledged or shelved.

4. **EUInformation binary decode** — `namespace_uri` (string, skip), `unit_id` (int32, skip), `displayName.text` (string, extract). `Range` is 2×f64 LE.

5. **Username/password auth** via Argon2id on `users` table (not a separate OPC users table).

**Known false-DONE patterns**:
- OPC client hardcoded to connect with None/None security only (no negotiation logic)
- A&C event subscription missing or non-functional
- EUInformation decode wrong (wrong byte offsets for displayName.text)
- Only some A&C methods implemented (e.g., Acknowledge but not Shelve methods)
- A&C method dispatch using only ns=1 NodeId, failing when server expects ns=0 dispatch

---

## WAVE 3 — Design-Doc-Only Units

For these units: read the design-doc, extract feature list, compare to code, catalog.
No spec_docs exist for these. Design-doc is the sole authority.

---

### DD-06 — Frontend Shell + App Chrome

**Design-doc**: `/home/io/io-dev/io/design-docs/06_FRONTEND_SHELL.md`
**Target code**: `frontend/src/shared/layout/AppShell.tsx`, `frontend/src/shared/theme/tokens.ts`

**Key things to verify** (GAP_ANALYSIS claimed DONE, verify correctness):
- Sidebar: 3-state (expanded 240px / collapsed 48px / hidden 0px), `Ctrl+Shift+B` cycles, edge-reveal strip when hidden
- Hover-to-expand: 300ms dwell on collapsed sidebar → floating overlay at 240px; 200ms retract on mouse leave
- Top bar hide: `Ctrl+Shift+T`, 8px edge hover strip, peek overlay
- Command palette prefix scopes: `>` (commands), `@` (points), `/` (graphics), `#` (reports)
- All 138 design tokens in `tokens.ts` for all 3 themes (dark/light/hphmi)
- Badge counts: unread alerts + active rounds in sidebar nav items
- Emergency alert overlay (system-wide)
- Kiosk mode (hides chrome, URL param `?kiosk=true`)

---

### DD-10 — Dashboards Module

**Design-doc**: `/home/io/io-dev/io/design-docs/10_DASHBOARDS_MODULE.md`
**Target code**: `frontend/src/pages/dashboards/`

**Key things to verify**:
- 8 widget types all implemented: KpiCard, LineChart, BarChart, PieChart, GaugeWidget, TableWidget, TextWidget, AlertStatusWidget
- Widget real-time via `usePointValue` hook (React state path, correct for widgets unlike graphics)
- Template variables: `var-{name}` URL params, variable bar UI
- Playlist player: auto-advance timing, Space/arrows keyboard control
- Dashboard builder: @dnd-kit drag, widget config panel per type
- Kiosk mode: `?kiosk=true` hides header/variable bar

---

### DD-11 — Reports Module

**Design-doc**: `/home/io/io-dev/io/design-docs/11_REPORTS_MODULE.md`
**Target code**: `frontend/src/pages/reports/`

**Key things to verify**:
- 38 canned report templates seeded (20 were noted in phase 9, then 18 more in post-phase-17)
- Async Typst PDF generation via api-gateway (not browser PDF)
- Report scheduling: recurring schedules, email delivery
- ReportViewer: sandboxed iframe for HTML reports
- CSV, XLSX, HTML, JSON, PDF format support
- WebSocket `export_complete` → toast with download link

---

### DD-12 — Forensics Module

**Design-doc**: `/home/io/io-dev/io/design-docs/12_FORENSICS_MODULE.md`
**Target code**: `frontend/src/pages/forensics/`

**Key things to verify**:
- Investigation model: create, stages, evidence, point curation
- Correlation: Pearson, Spearman, FFT cross-correlation, spike detection, change points
- Threshold search tab
- EvidenceRenderer: 10 evidence types
- Correlation heatmap: N×N ECharts heatmap with blue→neutral→teal gradient

---

### DD-13 — Log Module

**Design-doc**: `/home/io/io-dev/io/design-docs/13_LOG_MODULE.md`
**Target code**: `frontend/src/pages/log/`

**Key things to verify**:
- Tiptap WYSIWYG editor (MIT license confirmed)
- 4 segment types rendered correctly
- Template system: create/use/edit templates
- Full-text search via tsvector
- Auto-save (debounced)
- Attachments support

---

### DD-14 — Rounds Module

**Design-doc**: `/home/io/io-dev/io/design-docs/14_ROUNDS_MODULE.md`
**Target code**: `frontend/src/pages/rounds/`

**Key things to verify**:
- 5 input types in RoundPlayer: numeric, boolean, text, select, photo
- GPS capture on checkpoint
- Offline capability: IndexedDB queue, service worker, sync banner
- Threshold evaluation: HH/H/L/LL triggers `is_out_of_range`
- Round locking on start (prevents concurrent completion)
- Batch sync endpoint: `POST /api/mobile/rounds/sync`

---

### DD-15 — Settings Module

**Design-doc**: `/home/io/io-dev/io/design-docs/15_SETTINGS_MODULE.md`
**Target code**: `frontend/src/pages/settings/`

**Key things to verify**:
- All settings sub-pages exist per route map (doc 38)
- OPC Sources: connection CRUD, browse namespace, test connection
- User/Role management: full CRUD with permission grid
- Auth Providers: OIDC/SAML/LDAP CRUD + role mappings
- MFA enrollment wizard (TOTP + SMS + Email)
- API Keys: create, list, one-time reveal modal
- Email Providers/Templates/Queue tabs
- Bulk Update + Snapshots (doc 25)
- Terms of Use admin (version management, acceptance log)

---

### DD-16 — Real-Time WebSocket Protocol

**Design-doc**: `/home/io/io-dev/io/design-docs/16_REALTIME_WEBSOCKET.md`
**Target code**: `services/data-broker/src/`, `frontend/src/shared/hooks/useWebSocket.ts`

**Key things to verify**:
- WS message protocol: subscribe/unsubscribe/point_update message shapes match doc 37
- Ticket-based auth (30s TTL, single-use)
- Backpressure: adaptive throttling when subscriber can't keep up
- Shadow cache in broker (last-known values for new subscribers)
- SharedWorker in frontend (one WS connection shared across tabs)

---

### DD-18 — Time-Series Data

**Design-doc**: `/home/io/io-dev/io/design-docs/18_TIMESERIES_DATA.md`
**Target code**: `services/archive-service/src/`

**Key things to verify**:
- Hypertables correctly created for `point_history`
- Continuous aggregates: 1m, 5m, 1h aggregate tables
- Retention: 7-day raw, 90-day 1m, 1-year 1h (or per config)
- Compression policy applied
- Archive REST API: start/end validation, proper time bucketing

---

### DD-20 — Mobile Architecture + PWA

**Design-doc**: `/home/io/io-dev/io/design-docs/20_MOBILE_ARCHITECTURE.md`
**Target code**: `frontend/public/sw.js`, `frontend/src/shared/hooks/useOfflineRounds.ts`

**Key things to verify**:
- Service worker: caches `/api/mobile/rounds/active` GET
- IndexedDB queue for offline round responses
- Sync banner shown when offline/reconnecting
- Auto-sync on reconnect
- Mobile bottom tab bar (≤768px, 5 links, fixed 56px)
- Touch targets 44px minimum
- Batch sync: `POST /api/mobile/rounds/sync`

---

### DD-21 — API Design Conventions

**Design-doc**: `/home/io/io-dev/io/design-docs/21_API_DESIGN.md`
**Target code**: `services/api-gateway/src/`

**Key things to verify**:
- All routes prefixed `/api/v1/` (or `/api/` per doc 37 — check for consistency)
- Pagination envelope: `{ data: T[], total: number, page: number, per_page: number }`
- Error envelope: `{ error: { code: string, message: string, details?: object } }`
- Filtering: `q`, `page`, `per_page` params
- `x-io-service-secret` header for inter-service auth

---

### DD-23 — Expression Builder

**Design-doc**: `/home/io/io-dev/io/design-docs/23_EXPRESSION_BUILDER.md`
**Target code**: `frontend/src/shared/components/ExpressionBuilder/`

**Key things to verify**:
- Tile-based drag-and-drop (@dnd-kit)
- All tile types: point ref, literal, operator, function, grouping
- 5 nesting levels maximum
- Live preview panel with debounced eval
- AST serialization matches doc 37 format
- Rhai evaluation backend (100k op limit)
- 6 builder contexts: alarm threshold, calculated point, report formula, dashboard variable, graphic expression, filter rule

---

### DD-24 — Universal Import

**Design-doc**: `/home/io/io-dev/io/design-docs/24_UNIVERSAL_IMPORT.md`
**Target code**: `services/import-service/src/`, `frontend/src/pages/settings/Import.tsx`

**Key things to verify**:
- 10+ connector templates seeded (spec says 40, check count)
- Connection test (validate credentials before saving)
- Schedule: CRON expression, immediate run, manual trigger
- Run history with error details
- DCS supplemental connectors (7 REST connectors)

---

### DD-25 — Export System

**Design-doc**: `/home/io/io-dev/io/design-docs/25_EXPORT_SYSTEM.md`
**Target code**: `frontend/src/pages/settings/BulkUpdate.tsx`

**Key things to verify**:
- Bulk update: select items, preview changes, apply
- Snapshots: create, restore, history timeline
- 6 export formats: CSV, JSON, Excel, PDF, PNG, SVG
- Change snapshot before bulk apply

---

### DD-27 — Alert System (Backend Engine)

**Design-doc**: `/home/io/io-dev/io/design-docs/27_ALERT_SYSTEM.md`
**Target code**: `services/alert-service/src/`, `services/event-service/src/`

**Key things to verify**:
- ISA-18.2 state machine: 7 states, all transitions
- Escalation policies: tiers with time delays
- Shift-aware routing
- Email delivery via email-service `/internal/send`
- alert-service vs event-service separation correct

---

### DD-29 — Authentication

**Design-doc**: `/home/io/io-dev/io/design-docs/29_AUTHENTICATION.md`
**Target code**: `services/auth-service/src/`

**Key things to verify**:
- Local (Argon2id), OIDC (PKCE+state), SAML 2.0 (samael), LDAP (ldap3 bind) all functional
- MFA: TOTP + SMS (Twilio) + Email OTP
- SCIM 2.0: Users + Groups endpoints (Azure AD/Okta compatible)
- API keys: `io_` prefix, Argon2id-hashed, shown once
- Recovery codes: Argon2id-hashed, 8 codes

---

### DD-31 — Alerts Module (Frontend)

**Design-doc**: `/home/io/io-dev/io/design-docs/31_ALERTS_MODULE.md`
**Target code**: `frontend/src/pages/alerts/`

**Key things to verify**:
- Send alert: compose with template, select group, preview
- Active alerts tab with acknowledge/resolve
- Muster dashboard: accountability progress bar, mark safe/not-found
- History tab

---

### DD-32 — Shared UI Components

**Design-doc**: `/home/io/io-dev/io/design-docs/32_SHARED_UI_COMPONENTS.md`
**Target code**: `frontend/src/shared/components/`

**Key things to verify**:
- TimeSeriesChart (uPlot): time-series rendering, multi-series, zoom/pan
- EChart (Apache ECharts): bar, pie, scatter, heatmap
- DataTable (TanStack Table v8): virtual scroll, 100k rows, sort/filter/column-resize
- PointDetailPanel: floating window, trend sparkline, metadata
- PointContextMenu: right-click menu on any point-bound element
- Playback Bar: scrub, play/pause, speed selector, timestamp display

---

### DD-37 — IPC Contracts + Wire Formats

**Design-doc**: `/home/io/io-dev/io/design-docs/37_IPC_CONTRACTS.md`
**Target code**: `frontend/src/shared/types/ipc.ts`, all services

**Key things to verify**:
- `src/shared/types/ipc.ts` exists and matches doc 37 §16 TypeScript parity section
- `src/shared/types/permissions.ts` has all 118 RBAC permissions
- WS message shapes: `WsServerMessage`, `WsClientMessage` unions match doc 37
- REST envelope: `ApiResponse<T>` type used consistently
- Error codes: standard error code strings match doc 37

---

### DD-38 — Frontend Contracts + Route Map

**Design-doc**: `/home/io/io-dev/io/design-docs/38_FRONTEND_CONTRACTS.md`
**Target code**: `frontend/src/App.tsx`, `frontend/src/shared/theme/tokens.ts`

**Key things to verify**:
- All ~80 routes from doc 38 route map present in App.tsx (check for missing stubs)
- All 138 CSS design tokens present in tokens.ts for all 3 themes
- Sidebar navigation rules: groups, ordering, active states
- Route aliases: `/login/callback` → `/oidc-callback`, `/settings/imports` → `/settings/import`

---

### DD-39 — .iographic Format

**Design-doc**: `/home/io/io-dev/io/design-docs/39_IOGRAPHIC_FORMAT.md`
**Target code**: `services/api-gateway/src/` (ZIP import/export), `frontend/src/pages/designer/`

**Key things to verify**:
- .iographic is a ZIP container with `manifest.json` + SVG/JSON files
- Import: ZIP → parse manifest → create scene graph nodes (NOT SVG blob)
- Export: scene graph → ZIP with tag-based `PortablePointBinding`
- api-gateway has import/export endpoints

---

### Remaining Wave 3 (Lower Priority — Mostly Backend)

These docs are mostly backend/infra — audit after frontend Wave 1-3 complete.

| Unit | Doc | Focus |
|------|-----|-------|
| DD-22 | Deployment Guide | nginx config, systemd units, installer scripts |
| DD-26 | P&ID Recognition | recognition-service stub, .iomodel upload |
| DD-28 | Email Service | email-service templates, queue, SMTP + webhook |
| DD-30 | Access Control + Shifts | badge events, presence, muster declare/resolve |
| DD-33 | Testing Strategy | CI pipeline, E2E coverage, load tests |
| DD-34 | DCS Graphics Import | parser-service DCS ZIP import, 12 platforms |
| DD-36 | Observability | health endpoints, Prometheus metrics, tracing |

---

## Quick-Reference: Spec → Design-Doc Coverage Map

| Spec file | Replaces / supplements |
|-----------|------------------------|
| `graphics-scene-graph-implementation-spec.md` | doc 19 (architecture + data model) |
| `display-elements-implementation-spec.md` | doc 19 (display elements section) |
| `shape-library-implementation-spec.md` | doc 35 (full replacement) |
| `console-implementation-spec.md` | doc 07 (full replacement) |
| `process-implementation-spec.md` | doc 08 (full replacement) |
| `designer-implementation-spec.md` + `designer-ui-prompt.md` | doc 09 (full replacement) |
| `opc-server-protocol-spec.md` | doc 17 (protocol detail supplement) |
| `context-menu-implementation-spec.md` + `context-menu-addendum.md` | doc 32 §11 (point context menu), all module docs (entity CRUD menus), doc 09 §6 (canvas menus) |
| `spec-docs-prompt.md` | meta-index, no direct doc replacement |

---

## Audit Output Format

Each audit run produces a catalog file at `docs/catalogs/{unit-id}.md`.
Each catalog entry becomes one task file at `docs/tasks/{unit-id}/{unit-id}-NNN-{slug}.md`.

Task file template: see `docs/TASK_TEMPLATE.md`
