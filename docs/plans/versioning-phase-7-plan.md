# Versioning Phase 7 — Admin Toggles and Audit Logging

Cross-cutting admin features: "Show all users' objects" toggle, "Show deleted objects" toggle (already partially wired in Task 6), session-only toggle state management, and permanent-delete audit logging.

**Architecture doc:** `docs/architecture/versioning-and-publishing.md`
**Parent plan:** `docs/plans/versioning-plan.md` (Task 7)
**Prerequisites:** Tasks 1-6 complete. All list endpoints exist. VersionRecoveryDialog has the "Show deleted" toggle UI slot. Audit log table (`audit_log`) exists (migration `20260314000008_settings_audit.up.sql`). Permanent-delete audit logging is ALREADY wired in `graphics.rs` and `console.rs` (Tasks 2-3 added it via `tokio::spawn` INSERT into `audit_log`).

---

## 0. Key Findings from Codebase Exploration

### Audit logging already exists

The `audit_log` table is fully operational (migration `20260314000008_settings_audit.up.sql` lines 13-20):

```sql
CREATE TABLE audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    action VARCHAR(100) NOT NULL,
    table_name VARCHAR(100),
    record_id UUID,
    changes JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Permanent-delete audit logging is already implemented** in both backend handlers:

- `graphics.rs` ~line 1336: `INSERT INTO audit_log` with `action = "version.permanent_delete"`, `table_name = "design_object_versions"`, `changes` JSONB includes `design_object_id`, `version_number`, `action`.
- `console.rs` ~line 1281: Same pattern with `table_name = "workspace_versions"`, `changes` JSONB includes `workspace_id`, `version_number`, `action`.

Both use `tokio::spawn` for fire-and-forget async logging. Both include user_id and record_id (version UUID).

**No new migration is needed. No new backend audit code is needed.** This phase only needs to verify the existing audit logging is correct and add the toggle features.

### `list_graphics` has NO visibility filtering

The `list_graphics` handler (`graphics.rs` line 308) returns ALL graphics to any user with `designer:read` — no `created_by` or `published` filter. This differs from `list_workspaces` (filters by `created_by = $1`) and `list_saved_charts` (filters by `created_by = $1 OR published = true`).

For the "show all users' objects" toggle to be meaningful on graphics, `list_graphics` must first add a visibility filter (own + published by default), then add the `include_all_users` bypass. This is a prerequisite backend change.

### `list_saved_charts` already supports `all_users=true`

`saved_charts.rs` line 142: `let all_users = params.all_users.as_deref() == Some("true") && is_admin(&claims);`

The frontend API also supports it: `savedChartsApi.list({ allUsers: true })` in `frontend/src/api/savedCharts.ts` line 33.

### "Show deleted" toggle in VersionRecoveryDialog

Task 6 (`useVersionList.ts`) already has `showDeleted` / `setShowDeleted` state and passes `include_deleted=true` to the backend. The `VersionListPanel` renders the admin toggle when `isAdmin === true`. This toggle is already functional. Phase 7 only needs to ensure it renders correctly and connect it to the new admin toggle store for consistent state.

---

## 1. Complete View Inventory

Every view/component that lists saveable objects, where the toggle(s) must appear:

### Graphics list views

| # | View | File | What it lists | API call | Toggle placement |
|---|------|------|--------------|----------|-----------------|
| 1 | **Designer Graphics List** (full-page grid) | `frontend/src/pages/designer/DesignerGraphicsList.tsx` | All graphics (type='graphic') | `graphicsApi.list()` → `GET /api/graphics` | Filter bar, right side, next to result count |
| 2 | **Console Palette — Graphics section** | `frontend/src/pages/console/ConsolePalette.tsx` `GraphicsSection` ~line 1733 | Console-scoped graphics | `graphicsApi.list({ scope: 'console' })` → `GET /api/graphics?module=console` | Below search input in Graphics accordion header |
| 3 | **Process Sidebar — Navigation tree** | `frontend/src/pages/process/ProcessSidebar.tsx` `NavigationTree` ~line 197 | Process-scoped graphics via hierarchy | `graphicsApi.getHierarchy()` → `GET /api/graphics/hierarchy?scope=process` | Below search in sidebar, before tree |
| 4 | **Process index — graphics list** | `frontend/src/pages/process/index.tsx` ~line 695 | Process-scoped graphics flat list | `graphicsApi.list({ scope: 'process' })` → `GET /api/graphics?module=process` | Shared with ProcessSidebar (same query) |
| 5 | **PaneWrapper — Replace graphic dialog** | `frontend/src/pages/console/PaneWrapper.tsx` ~line 240 | Console-scoped graphics for pane replacement | `graphicsApi.list({ scope: 'console' })` → same as #2 | Inside replace dialog, above list |
| 6 | **Dashboards index — designer dashboards** | `frontend/src/pages/dashboards/index.tsx` ~line 600 | All graphics filtered to dashboards | `graphicsApi.list()` filtered client-side | Filter bar area (same pattern as #1) |
| 7 | **Forensics — snapshot dialog** | `frontend/src/pages/forensics/InvestigationWorkspace.tsx` ~line 140 | All graphics for snapshot | `graphicsApi.list()` | Inside snapshot dialog, above list |

### Workspace list views

| # | View | File | What it lists | API call | Toggle placement |
|---|------|------|--------------|----------|-----------------|
| 8 | **Console Palette — Workspaces section** | `frontend/src/pages/console/ConsolePalette.tsx` `WorkspacesSection` ~line 940 | User's workspaces + published | `consoleApi.listWorkspaces()` → `GET /api/console/workspaces` | Below search in Workspaces accordion header |
| 9 | **Console index — workspace tabs** | `frontend/src/pages/console/index.tsx` ~line 584 | Same query as #8 | `consoleApi.listWorkspaces()` | Shared with ConsolePalette (same query) |

### Saved charts list views

| # | View | File | What it lists | API call | Toggle placement |
|---|------|------|--------------|----------|-----------------|
| 10 | **Console Palette — Charts section** | `frontend/src/pages/console/ConsolePalette.tsx` `ChartsSection` ~line 1169 | User's charts + published | `useSavedChartsStore.fetchCharts()` → `savedChartsApi.list()` → `GET /api/v1/saved-charts` | Below search in Charts accordion header |

### Version recovery dialog

| # | View | File | What it lists | Toggle |
|---|------|------|--------------|--------|
| 11 | **VersionRecoveryDialog — version list** | `frontend/src/shared/components/versioning/VersionListPanel.tsx` | Versions of a single object | "Show deleted" toggle (already in Task 6) |

### Out of scope

- **SymbolLibrary** (`DesignerLeftPalette.tsx`, `SymbolLibrary.tsx`): Lists user-uploaded custom shapes via `graphicsApi.listUserShapes()`. These are NOT versioned saveable objects — they are per-user SVG uploads. No toggle needed.
- **ExpressionLibrary** (`settings/ExpressionLibrary.tsx`): System expressions, not saveable objects.
- **Point pickers** (`PointPickerModal`, `PointsBrowserPanel`, etc.): List points, not saveable objects.

---

## 2. Admin Toggle Store

### New file: `frontend/src/store/adminToggleStore.ts`

A tiny Zustand store with NO persistence. Resets on page refresh (safe default per architecture doc).

```ts
import { create } from 'zustand';

interface AdminToggleState {
  /** When true, admin sees all users' unpublished objects in every list view. */
  showAllUsersObjects: boolean;
  setShowAllUsersObjects: (v: boolean) => void;

  /** When true, admin sees soft-deleted versions in the recovery dialog. */
  showDeletedVersions: boolean;
  setShowDeletedVersions: (v: boolean) => void;
}

export const useAdminToggleStore = create<AdminToggleState>()((set) => ({
  showAllUsersObjects: false,
  setShowAllUsersObjects: (v) => set({ showAllUsersObjects: v }),

  showDeletedVersions: false,
  setShowDeletedVersions: (v) => set({ showDeletedVersions: v }),
}));
```

**Why Zustand over React context:** The toggle state must persist across page navigations (e.g., navigating from Console to Designer) within a single session. React context would be scoped to a component tree and unmount on route change. Zustand stores persist in module scope for the lifetime of the JS bundle. This matches the existing pattern (`useAuthStore`, `useUiStore`, `useSavedChartsStore`).

**Why NOT localStorage:** Architecture doc explicitly says "Do NOT persist to localStorage or database — resets on page refresh (safe default)". This prevents an admin accidentally leaving the toggle on and forgetting about it.

---

## 3. Admin Toggle UI Component

### New file: `frontend/src/shared/components/AdminToggle.tsx`

A reusable toggle switch visible ONLY to admin users. Renders nothing for non-admins.

```ts
import React from 'react';
import { useAuthStore } from '../../store/auth';

interface AdminToggleProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** Optional tooltip text */
  title?: string;
}

export function AdminToggle({ label, checked, onChange, title }: AdminToggleProps) {
  const isAdmin = useAuthStore((s) => s.user?.permissions.includes('*') ?? false);
  if (!isAdmin) return null;

  return (
    <label
      title={title}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        cursor: 'pointer',
        fontSize: 11,
        color: checked ? 'var(--io-accent)' : 'var(--io-text-muted)',
        userSelect: 'none',
        padding: '2px 0',
        whiteSpace: 'nowrap',
      }}
    >
      {/* Toggle track */}
      <span
        style={{
          display: 'inline-block',
          width: 28,
          height: 16,
          borderRadius: 8,
          background: checked ? 'var(--io-accent)' : 'var(--io-border)',
          position: 'relative',
          transition: 'background 0.15s',
          flexShrink: 0,
        }}
      >
        {/* Toggle knob */}
        <span
          style={{
            position: 'absolute',
            top: 2,
            left: checked ? 14 : 2,
            width: 12,
            height: 12,
            borderRadius: '50%',
            background: '#fff',
            transition: 'left 0.15s',
            boxShadow: '0 1px 2px rgba(0,0,0,0.2)',
          }}
        />
      </span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        style={{ position: 'absolute', opacity: 0, width: 0, height: 0 }}
      />
      {label}
    </label>
  );
}
```

This component:
- Is completely invisible to non-admin users (returns null)
- Uses a minimal CSS-only toggle switch (no external dependency)
- Matches the design system tokens (`--io-accent`, `--io-border`, etc.)
- Is 28x16px — compact enough to fit in filter bars and accordion headers

---

## 4. Backend Changes

### 4.1 Add visibility filtering to `list_graphics` handler

**File:** `services/api-gateway/src/handlers/graphics.rs`

**Current state:** `list_graphics` (line 308) returns ALL graphics to any user with `designer:read`. No visibility filtering.

**Required changes:**

#### 4.1.1 Add `include_all_users` to `ListGraphicsQuery`

```rust
#[derive(Debug, Deserialize)]
pub struct ListGraphicsQuery {
    pub module: Option<String>,
    pub page: Option<u32>,
    pub limit: Option<u32>,
    /// Admin only: when "true", return all users' graphics (including unpublished).
    /// Default behavior: return user's own graphics + published graphics.
    pub include_all_users: Option<String>,
}
```

#### 4.1.2 Update the SQL queries in `list_graphics`

The handler builds SQL dynamically with `format!()`. Add a visibility clause:

```rust
let user_id: Uuid = Uuid::parse_str(&claims.sub).unwrap_or_default();
let all_users = query.include_all_users.as_deref() == Some("true") && is_admin(&claims);

// Build visibility clause
let visibility_clause = if all_users {
    String::new() // Admin sees everything
} else {
    format!(" AND (created_by = '{}' OR published = true)", user_id)
};
```

Insert `{visibility_clause}` into the existing count_sql and data_sql `WHERE` clauses, after the `name NOT LIKE '__autosave_%'` condition and the `{extra_where}` module filter.

**Important:** The `published` column on `design_objects` was added by the Task 1 migration (`20260512000001_design_objects_published.up.sql`). It must exist before this code runs.

#### 4.1.3 SQL examples after the change

Count query (no module filter, normal user):
```sql
SELECT COUNT(*) FROM design_objects
WHERE type = 'graphic'
  AND name NOT LIKE '__autosave_%'
  AND (created_by = $USER_ID OR published = true)
```

Count query (admin with include_all_users=true):
```sql
SELECT COUNT(*) FROM design_objects
WHERE type = 'graphic'
  AND name NOT LIKE '__autosave_%'
```

### 4.2 Add `include_all_users` to `list_workspaces` handler

**File:** `services/api-gateway/src/handlers/console.rs`

**Current state:** `list_workspaces` (line 237) filters by `created_by = $1` (current user only). It does NOT show published workspaces from other users.

**Required changes:**

#### 4.2.1 Accept a query parameter

The handler currently uses `Query(page): Query<PageParams>` from `io_models`. Create a local struct instead:

```rust
#[derive(Debug, Deserialize)]
pub struct ListWorkspacesQuery {
    pub page: Option<u32>,
    pub per_page: Option<u32>,
    /// Admin only: when "true", return all users' workspaces.
    pub include_all_users: Option<String>,
}
```

Change the handler signature: `Query(params): Query<ListWorkspacesQuery>`

Then compute page/limit manually instead of using `PageParams` methods:
```rust
let pg = params.page.unwrap_or(1).max(1);
let limit = params.per_page.unwrap_or(50).clamp(1, 200) as i64;
let offset = ((pg - 1) as i64) * limit;
```

#### 4.2.2 Update the SQL

```rust
let all_users = params.include_all_users.as_deref() == Some("true") && is_admin(&claims);

if all_users {
    // Return ALL workspaces
    sqlx::query("SELECT COUNT(*) FROM design_objects WHERE type = 'console_workspace'")
    // ...
    sqlx::query(r#"
        SELECT id, name, metadata, published, created_at, created_by
        FROM design_objects
        WHERE type = 'console_workspace'
        ORDER BY created_at DESC
        LIMIT $1 OFFSET $2
    "#)
} else {
    // Return user's own + published
    sqlx::query("SELECT COUNT(*) FROM design_objects WHERE type = 'console_workspace' AND (created_by = $1 OR published = true)")
    // ...
    sqlx::query(r#"
        SELECT id, name, metadata, published, created_at, created_by
        FROM design_objects
        WHERE type = 'console_workspace'
          AND (created_by = $1 OR published = true)
        ORDER BY created_at DESC
        LIMIT $2 OFFSET $3
    "#)
}
```

**NOTE:** The current query only returns `created_by = $1` (own). This must change to `created_by = $1 OR published = true` for the default case too, so that published workspaces from other users are visible even without the toggle. This is a baseline visibility fix that was missing.

### 4.3 No changes needed for `list_saved_charts`

Already has `all_users` query param support (line 142):
```rust
let all_users = params.all_users.as_deref() == Some("true") && is_admin(&claims);
```

And the default filter is already `created_by = $1 OR published = true` (line 176).

### 4.4 Add `include_all_users` to `list_graphics_hierarchy`

**File:** `services/api-gateway/src/handlers/graphics.rs`

The hierarchy endpoint (`list_graphics_hierarchy` ~line 1948) builds a tree of process-scoped graphics. It likely needs the same visibility filter. Check if it already has one; if not, add the same pattern:

- Accept `include_all_users: Option<String>` in its query params
- Default: filter to `created_by = $USER OR published = true`
- Admin with `include_all_users=true`: return all

### 4.5 No migration needed for audit log

The `audit_log` table already exists with the correct schema. The permanent-delete handlers already write audit entries. No new migration, no new DDL.

---

## 5. Frontend API Changes

### 5.1 Update `graphicsApi.list` signature

**File:** `frontend/src/api/graphics.ts` ~line 44

```ts
/** List graphics, optionally filtered by module scope */
list: (params?: {
  scope?: 'console' | 'process';
  mode?: 'graphic' | 'dashboard' | 'report';
  includeAllUsers?: boolean;
}) => {
  const qp = new URLSearchParams();
  if (params?.scope) qp.set('module', params.scope);
  if (params?.includeAllUsers) qp.set('include_all_users', 'true');
  const qs = qp.toString();
  return api.get<{ data: DesignObjectSummary[]; total: number }>(
    `/api/graphics${qs ? `?${qs}` : ''}`,
  );
},
```

### 5.2 Update `graphicsApi.getHierarchy` signature

**File:** `frontend/src/api/graphics.ts` ~line 38

```ts
getHierarchy: (params?: { includeAllUsers?: boolean }) => {
  const extra = params?.includeAllUsers ? '&include_all_users=true' : '';
  return api.get<{ tree: GraphicHierarchyNode[] }>(
    `/api/graphics/hierarchy?scope=process${extra}`,
  );
},
```

### 5.3 Update `consoleApi.listWorkspaces` signature

**File:** `frontend/src/api/console.ts` ~line 58

```ts
listWorkspaces: async (params?: {
  includeAllUsers?: boolean;
}): Promise<ApiResult<WorkspaceLayout[]>> => {
  const qs = params?.includeAllUsers ? '?include_all_users=true' : '';
  const result = await api.get<PaginatedResult<WorkspaceSummary>>(
    `/api/console/workspaces${qs}`,
  );
  if (!result.success) return result;
  const items = Array.isArray(result.data.data) ? result.data.data : [];
  return { success: true, data: items.map(normalizeWorkspace) };
},
```

### 5.4 Update `savedChartsApi.list` — already done

`savedChartsApi.list({ allUsers: true })` already exists in `frontend/src/api/savedCharts.ts` line 33.

### 5.5 Update `useSavedChartsStore.fetchCharts`

**File:** `frontend/src/store/savedChartsStore.ts` ~line 58

Add an optional `allUsers` parameter:

```ts
fetchCharts: async (params?: { allUsers?: boolean }) => {
  set({ loading: true });
  const result = await savedChartsApi.list({ allUsers: params?.allUsers });
  // ... rest unchanged
},
```

---

## 6. Frontend View Modifications — Per View

### 6.1 DesignerGraphicsList (View #1)

**File:** `frontend/src/pages/designer/DesignerGraphicsList.tsx`

**Where the toggle goes:** In the filter bar (line ~943), after the mode tag buttons and before the result count. The toggle is right-aligned alongside the count.

**Changes:**

1. Import `AdminToggle` and `useAdminToggleStore`:
   ```ts
   import { AdminToggle } from '../../shared/components/AdminToggle';
   import { useAdminToggleStore } from '../../store/adminToggleStore';
   ```

2. Read toggle state:
   ```ts
   const showAllUsers = useAdminToggleStore((s) => s.showAllUsersObjects);
   const setShowAllUsers = useAdminToggleStore((s) => s.setShowAllUsersObjects);
   ```

3. Pass `includeAllUsers` to the query:
   ```ts
   const { data, isLoading, isError } = useQuery({
     queryKey: ['design-objects', { scope: scopeFilter, mode: modeFilter, search, showAllUsers }],
     queryFn: () => graphicsApi.list({ includeAllUsers: showAllUsers }),
     staleTime: 30_000,
   });
   ```

4. Render the toggle in the filter bar, before the result count:
   ```tsx
   {/* Admin toggle — between mode buttons and result count */}
   <AdminToggle
     label="All users"
     checked={showAllUsers}
     onChange={setShowAllUsers}
     title="Show all users' objects (admin only)"
   />
   ```

### 6.2 ConsolePalette — Graphics section (View #2)

**File:** `frontend/src/pages/console/ConsolePalette.tsx`

**Where the toggle goes:** Inside the `GraphicsSection` function (~line 1733), below the search input area that the AccordionSection provides. The toggle renders as part of the section content, above the graphics list.

**Changes:**

1. Import `AdminToggle` and `useAdminToggleStore` at the top of the file.

2. Inside `GraphicsSection` (~line 1733), read the toggle:
   ```ts
   const showAllUsers = useAdminToggleStore((s) => s.showAllUsersObjects);
   ```

3. Update the query (~line 1747) to pass the toggle:
   ```ts
   const { data, isLoading } = useQuery({
     queryKey: ['console-palette-graphics', showAllUsers],
     queryFn: async () => {
       const r = await graphicsApi.list({ scope: 'console', includeAllUsers: showAllUsers });
       if (!r.success) return [];
       return r.data.data ?? [];
     },
     staleTime: 30_000,
   });
   ```

4. Render the toggle above the graphics list (before the favorites/library grouping, after loading check):
   ```tsx
   <div style={{ padding: '4px 10px 2px' }}>
     <AdminToggle
       label="All users"
       checked={showAllUsers}
       onChange={useAdminToggleStore.getState().setShowAllUsersObjects}
       title="Show all users' graphics"
     />
   </div>
   ```

### 6.3 ProcessSidebar — Navigation tree (View #3)

**File:** `frontend/src/pages/process/ProcessSidebar.tsx`

**Where the toggle goes:** Inside the `NavigationTree` component (~line 197), above the tree nodes. For the flat list in the process page, the toggle will also be visible.

**Changes:**

1. Import `AdminToggle` and `useAdminToggleStore`.

2. Inside `NavigationTree`:
   ```ts
   const showAllUsers = useAdminToggleStore((s) => s.showAllUsersObjects);
   ```

3. Update the query (~line 204):
   ```ts
   const { data, isLoading } = useQuery({
     queryKey: ['graphics', 'hierarchy', showAllUsers],
     queryFn: () => graphicsApi.getHierarchy({ includeAllUsers: showAllUsers }),
     staleTime: 5 * 60 * 1000,
   });
   ```

4. Render the toggle above the tree:
   ```tsx
   <div style={{ padding: '4px 10px 2px' }}>
     <AdminToggle
       label="All users"
       checked={showAllUsers}
       onChange={useAdminToggleStore.getState().setShowAllUsersObjects}
       title="Show all users' graphics"
     />
   </div>
   ```

### 6.4 Process index — graphics list (View #4)

**File:** `frontend/src/pages/process/index.tsx`

**Where the toggle goes:** The process index fetches `graphicsApi.list({ scope: 'process' })` (~line 698) and passes the result to `ProcessSidebar` as `graphicsList`. The toggle state from the sidebar (view #3) affects the hierarchy query. For the flat list, the toggle must also be passed.

**Changes:**

1. Import `useAdminToggleStore`.

2. Read toggle:
   ```ts
   const showAllUsers = useAdminToggleStore((s) => s.showAllUsersObjects);
   ```

3. Update query (~line 695):
   ```ts
   const { data: graphicsList, isLoading: graphicsLoading } = useQuery({
     queryKey: ['design-objects', 'process', showAllUsers],
     queryFn: async () => {
       const result = await graphicsApi.list({ scope: 'process', includeAllUsers: showAllUsers });
       if (result.success) return result.data.data;
       return [] as DesignObjectSummary[];
     },
   });
   ```

### 6.5 PaneWrapper — Replace graphic dialog (View #5)

**File:** `frontend/src/pages/console/PaneWrapper.tsx`

**Where the toggle goes:** Inside the replace graphic dialog, above the graphics list.

**Changes:**

1. Import `AdminToggle` and `useAdminToggleStore`.

2. Read toggle:
   ```ts
   const showAllUsers = useAdminToggleStore((s) => s.showAllUsersObjects);
   ```

3. Update query (~line 240):
   ```ts
   const { data: replaceGraphics = [] } = useQuery({
     queryKey: ['console-replace-graphics', showAllUsers],
     queryFn: async () => {
       const r = await graphicsApi.list({ scope: 'console', includeAllUsers: showAllUsers });
       if (!r.success) return [];
       return r.data.data ?? [];
     },
     enabled: replaceDialogOpen,
     staleTime: 30_000,
   });
   ```

4. Render the toggle inside the replace dialog, above the graphics list.

### 6.6 Dashboards index (View #6)

**File:** `frontend/src/pages/dashboards/index.tsx`

**Where the toggle goes:** In the filter/search area of the dashboards page.

**Changes:**

1. Import `AdminToggle` and `useAdminToggleStore`.

2. Read toggle:
   ```ts
   const showAllUsers = useAdminToggleStore((s) => s.showAllUsersObjects);
   ```

3. Update query (~line 600):
   ```ts
   const designerQuery = useQuery({
     queryKey: ['designer-dashboards', showAllUsers],
     queryFn: async () => {
       const result = await graphicsApi.list({ includeAllUsers: showAllUsers });
       if (!result.success) throw new Error(result.error.message);
       return result.data.data.filter((d) => d.designMode === 'dashboard');
     },
   });
   ```

4. Render toggle in the dashboards filter area.

### 6.7 Forensics InvestigationWorkspace (View #7)

**File:** `frontend/src/pages/forensics/InvestigationWorkspace.tsx`

**Where the toggle goes:** Inside the snapshot dialog, above the graphics list.

**Changes:**

1. Import `AdminToggle` and `useAdminToggleStore`.

2. Read toggle and pass to query (~line 140):
   ```ts
   const showAllUsers = useAdminToggleStore((s) => s.showAllUsersObjects);

   const graphicsQuery = useQuery({
     queryKey: ['graphics-list-for-snapshot', showAllUsers],
     queryFn: async () => {
       const result = await graphicsApi.list({ includeAllUsers: showAllUsers });
       return result.success ? (result.data.data ?? []) : [];
     },
     enabled: showSnapshotDialog,
     staleTime: 60_000,
   });
   ```

3. Render toggle inside the snapshot dialog above the graphics list.

### 6.8 ConsolePalette — Workspaces section (View #8)

**File:** `frontend/src/pages/console/ConsolePalette.tsx`

**Where the toggle goes:** Inside the `WorkspacesSection` function (~line 940), above the workspace groups.

**Changes:**

The `WorkspacesSection` receives `workspaces` as a prop from the parent `ConsolePalette`. The actual API call happens in `frontend/src/pages/console/index.tsx` (~line 586). The toggle must be wired in both places:

1. In `console/index.tsx`, update the workspace query:
   ```ts
   const showAllUsers = useAdminToggleStore((s) => s.showAllUsersObjects);

   const { data: apiWorkspaces, isLoading, isError } = useQuery({
     queryKey: ['console-workspaces', showAllUsers],
     queryFn: async () => {
       const result = await consoleApi.listWorkspaces({ includeAllUsers: showAllUsers });
       if (!result.success) throw new Error(result.error.message);
       return result.data;
     },
     enabled: isAuthenticated,
     staleTime: 30_000,
   });
   ```

2. In `ConsolePalette.tsx`, inside the `WorkspacesSection`, render the toggle:
   ```tsx
   <div style={{ padding: '4px 10px 2px' }}>
     <AdminToggle
       label="All users"
       checked={useAdminToggleStore((s) => s.showAllUsersObjects)}
       onChange={useAdminToggleStore.getState().setShowAllUsersObjects}
       title="Show all users' workspaces"
     />
   </div>
   ```

   Note: The toggle in WorkspacesSection is read-only visual feedback — the actual data refresh happens in `console/index.tsx` because that's where the query lives.

### 6.9 Console index — workspace tabs (View #9)

Same query as #8. No additional toggle UI needed — the ConsolePalette toggle covers it.

### 6.10 ConsolePalette — Charts section (View #10)

**File:** `frontend/src/pages/console/ConsolePalette.tsx`

**Where the toggle goes:** Inside the `ChartsSection` function (~line 1169), above the chart list.

**Changes:**

1. Inside `ChartsSection`, read the toggle and pass it to `fetchCharts`:
   ```ts
   const showAllUsers = useAdminToggleStore((s) => s.showAllUsersObjects);

   useEffect(() => {
     if (!initialized) fetchCharts({ allUsers: showAllUsers });
   }, [initialized, fetchCharts, showAllUsers]);

   // Also refetch when toggle changes
   useEffect(() => {
     if (initialized) fetchCharts({ allUsers: showAllUsers });
   }, [showAllUsers]);
   ```

2. Render the toggle above the chart list:
   ```tsx
   <div style={{ padding: '4px 10px 2px' }}>
     <AdminToggle
       label="All users"
       checked={showAllUsers}
       onChange={useAdminToggleStore.getState().setShowAllUsersObjects}
       title="Show all users' charts"
     />
   </div>
   ```

### 6.11 VersionRecoveryDialog — "Show deleted" toggle (View #11)

**File:** `frontend/src/shared/components/versioning/VersionListPanel.tsx`

Task 6 already wired `showDeleted` / `setShowDeleted` into `useVersionList` and renders a toggle in the filter bar when `isAdmin === true`. This phase connects it to the centralized `useAdminToggleStore`.

**Changes:**

1. In `useVersionList.ts`, replace the local `showDeleted` state with the store:
   ```ts
   // BEFORE (Task 6):
   const [showDeleted, setShowDeleted] = useState(false);

   // AFTER (Task 7):
   const showDeleted = useAdminToggleStore((s) => s.showDeletedVersions);
   const setShowDeleted = useAdminToggleStore((s) => s.setShowDeletedVersions);
   ```

   This ensures "Show deleted" persists across dialog open/close and navigating between modules within a session, but resets on page refresh.

2. In `VersionListPanel.tsx`, replace any local admin toggle with the `AdminToggle` component for visual consistency:
   ```tsx
   <AdminToggle
     label="Show deleted"
     checked={versionList.showDeleted}
     onChange={versionList.setShowDeleted}
     title="Show soft-deleted versions (admin only)"
   />
   ```

---

## 7. File Inventory Summary

### New files (create)

| File | Purpose |
|------|---------|
| `frontend/src/store/adminToggleStore.ts` | Zustand store for admin toggle state (no persistence) |
| `frontend/src/shared/components/AdminToggle.tsx` | Reusable toggle switch component (admin-only visibility) |

### Modified files — backend

| File | Change |
|------|--------|
| `services/api-gateway/src/handlers/graphics.rs` | Add `include_all_users` to `ListGraphicsQuery`; add visibility filtering to `list_graphics` SQL |
| `services/api-gateway/src/handlers/console.rs` | Create `ListWorkspacesQuery`; add `include_all_users` to `list_workspaces`; fix default visibility to `created_by = $1 OR published = true` |

### Modified files — frontend API

| File | Change |
|------|--------|
| `frontend/src/api/graphics.ts` | Add `includeAllUsers` param to `list()` and `getHierarchy()` |
| `frontend/src/api/console.ts` | Add `includeAllUsers` param to `listWorkspaces()` |
| `frontend/src/store/savedChartsStore.ts` | Add `allUsers` param to `fetchCharts()` |

### Modified files — frontend views

| File | Change |
|------|--------|
| `frontend/src/pages/designer/DesignerGraphicsList.tsx` | Import toggle, wire to query, render in filter bar |
| `frontend/src/pages/console/ConsolePalette.tsx` | Import toggle, wire in GraphicsSection, WorkspacesSection, ChartsSection |
| `frontend/src/pages/console/index.tsx` | Wire toggle to workspace query |
| `frontend/src/pages/console/PaneWrapper.tsx` | Wire toggle to replace-graphic query |
| `frontend/src/pages/process/index.tsx` | Wire toggle to graphics query |
| `frontend/src/pages/process/ProcessSidebar.tsx` | Wire toggle to hierarchy query, render in NavigationTree |
| `frontend/src/pages/dashboards/index.tsx` | Wire toggle to designer-dashboards query |
| `frontend/src/pages/forensics/InvestigationWorkspace.tsx` | Wire toggle to snapshot dialog graphics query |
| `frontend/src/shared/components/versioning/useVersionList.ts` | Replace local `showDeleted` state with `useAdminToggleStore` |
| `frontend/src/shared/components/versioning/VersionListPanel.tsx` | Use `AdminToggle` component for "Show deleted" toggle |

### Files NOT modified

| File | Reason |
|------|--------|
| `services/api-gateway/src/handlers/saved_charts.rs` | Already has `all_users` param |
| `services/api-gateway/src/main.rs` | No new routes needed |
| Any migration files | `audit_log` table already exists; no schema changes needed |

---

## 8. Implementation Checklist

Execute in order. Each step is independently verifiable.

### Step 1: Create admin toggle store

- [ ] Create `frontend/src/store/adminToggleStore.ts` per section 2
- [ ] Verify: `import { useAdminToggleStore } from '../store/adminToggleStore'` resolves

### Step 2: Create AdminToggle component

- [ ] Create `frontend/src/shared/components/AdminToggle.tsx` per section 3
- [ ] Verify: `pnpm build` passes from `frontend/`

### Step 3: Backend — add visibility filtering to `list_graphics`

- [ ] Read `services/api-gateway/src/handlers/graphics.rs` lines 80-86 and 308-404
- [ ] Add `include_all_users: Option<String>` to `ListGraphicsQuery` struct
- [ ] Add visibility clause: `AND (created_by = '{}' OR published = true)` for non-admin
- [ ] When `include_all_users=true` AND `is_admin(&claims)`, omit the visibility clause
- [ ] Preserve the existing `__autosave_%` filter and module filter
- [ ] Handle the dynamic SQL binding indices correctly (the handler uses `format!()` with numbered `$N` params — adding the `created_by` clause via string interpolation avoids breaking existing bind indices)
- [ ] Verify: `cargo build -p io-api-gateway`

### Step 4: Backend — add visibility filtering to `list_workspaces`

- [ ] Read `services/api-gateway/src/handlers/console.rs` lines 237-311
- [ ] Create `ListWorkspacesQuery` struct with `page`, `per_page`, `include_all_users`
- [ ] Replace `Query(page): Query<PageParams>` with `Query(params): Query<ListWorkspacesQuery>`
- [ ] Compute `pg`, `limit`, `offset` manually from params
- [ ] Change default SQL filter from `created_by = $1` to `created_by = $1 OR published = true`
- [ ] When `include_all_users=true` AND `is_admin(&claims)`, return all workspaces
- [ ] Verify: `cargo build -p io-api-gateway`

### Step 5: Backend — add visibility filtering to `list_graphics_hierarchy`

- [ ] Read `services/api-gateway/src/handlers/graphics.rs` `list_graphics_hierarchy` (~line 1948)
- [ ] Check if it already accepts query params (it may only accept the scope as a query param)
- [ ] Add `include_all_users: Option<String>` to its query struct
- [ ] Add the same visibility clause as `list_graphics`
- [ ] Verify: `cargo build -p io-api-gateway`

### Step 6: Frontend API — update `graphicsApi.list`

- [ ] Read `frontend/src/api/graphics.ts` lines 44-51
- [ ] Add `includeAllUsers?: boolean` to the params object
- [ ] Build query string with `URLSearchParams` (replaces the simple ternary)
- [ ] Verify: `pnpm build`

### Step 7: Frontend API — update `graphicsApi.getHierarchy`

- [ ] Read `frontend/src/api/graphics.ts` lines 38-42
- [ ] Add `params?: { includeAllUsers?: boolean }` parameter
- [ ] Append `&include_all_users=true` to the URL when applicable
- [ ] Verify: `pnpm build`

### Step 8: Frontend API — update `consoleApi.listWorkspaces`

- [ ] Read `frontend/src/api/console.ts` lines 58-65
- [ ] Add `params?: { includeAllUsers?: boolean }` parameter
- [ ] Append `?include_all_users=true` to the URL when applicable
- [ ] Verify: `pnpm build`

### Step 9: Frontend store — update `savedChartsStore.fetchCharts`

- [ ] Read `frontend/src/store/savedChartsStore.ts` lines 58-86
- [ ] Add `params?: { allUsers?: boolean }` parameter to `fetchCharts`
- [ ] Pass `allUsers` to `savedChartsApi.list()`
- [ ] Verify: `pnpm build`

### Step 10: Wire toggle — DesignerGraphicsList

- [ ] Read `frontend/src/pages/designer/DesignerGraphicsList.tsx`
- [ ] Import `AdminToggle` and `useAdminToggleStore`
- [ ] Read toggle state, add to `useQuery` queryKey and `queryFn`
- [ ] Render `<AdminToggle>` in filter bar (line ~1055, after mode buttons, before result count)
- [ ] Verify: `pnpm build`

### Step 11: Wire toggle — ConsolePalette (Graphics, Workspaces, Charts)

- [ ] Read `frontend/src/pages/console/ConsolePalette.tsx`
- [ ] Import `AdminToggle` and `useAdminToggleStore` at top of file
- [ ] **GraphicsSection** (~line 1733): Read toggle, add to queryKey + queryFn, render toggle above graphics list
- [ ] **WorkspacesSection** (~line 940): Render toggle above workspace groups (data refresh is in console/index.tsx)
- [ ] **ChartsSection** (~line 1169): Read toggle, pass to fetchCharts, refetch on toggle change, render toggle above chart list
- [ ] Verify: `pnpm build`

### Step 12: Wire toggle — Console index (workspace query)

- [ ] Read `frontend/src/pages/console/index.tsx` lines 580-592
- [ ] Import `useAdminToggleStore`
- [ ] Read toggle state
- [ ] Add `showAllUsers` to queryKey, pass `includeAllUsers` to `consoleApi.listWorkspaces()`
- [ ] Verify: `pnpm build`

### Step 13: Wire toggle — PaneWrapper

- [ ] Read `frontend/src/pages/console/PaneWrapper.tsx` lines 240-249
- [ ] Import `AdminToggle` and `useAdminToggleStore`
- [ ] Read toggle, add to queryKey + queryFn
- [ ] Render toggle inside the replace graphic dialog
- [ ] Verify: `pnpm build`

### Step 14: Wire toggle — Process sidebar + index

- [ ] Read `frontend/src/pages/process/ProcessSidebar.tsx` `NavigationTree` (~line 197)
- [ ] Import `AdminToggle` and `useAdminToggleStore`
- [ ] Read toggle, add to hierarchy queryKey + queryFn
- [ ] Render toggle above tree nodes
- [ ] Read `frontend/src/pages/process/index.tsx` lines 695-702
- [ ] Import `useAdminToggleStore`, read toggle, add to flat list queryKey + queryFn
- [ ] Verify: `pnpm build`

### Step 15: Wire toggle — Dashboards index

- [ ] Read `frontend/src/pages/dashboards/index.tsx` lines 600-607
- [ ] Import `AdminToggle` and `useAdminToggleStore`
- [ ] Read toggle, add to queryKey + queryFn
- [ ] Render toggle in the dashboards filter area
- [ ] Verify: `pnpm build`

### Step 16: Wire toggle — Forensics InvestigationWorkspace

- [ ] Read `frontend/src/pages/forensics/InvestigationWorkspace.tsx` lines 140-148
- [ ] Import `AdminToggle` and `useAdminToggleStore`
- [ ] Read toggle, add to queryKey + queryFn
- [ ] Render toggle inside the snapshot dialog
- [ ] Verify: `pnpm build`

### Step 17: Wire "Show deleted" toggle to admin store

- [ ] Read `frontend/src/shared/components/versioning/useVersionList.ts`
- [ ] Import `useAdminToggleStore`
- [ ] Replace `const [showDeleted, setShowDeleted] = useState(false)` with store selectors
- [ ] Read `frontend/src/shared/components/versioning/VersionListPanel.tsx`
- [ ] Import `AdminToggle` component
- [ ] Replace the existing admin toggle markup with `<AdminToggle>` component for visual consistency
- [ ] Verify: `pnpm build`

### Step 18: Verify audit logging (no code changes needed)

- [ ] Read `services/api-gateway/src/handlers/graphics.rs` ~line 1330-1350 — confirm `INSERT INTO audit_log` with `action = "version.permanent_delete"`, `table_name = "design_object_versions"`, `changes` includes `design_object_id`, `version_number`
- [ ] Read `services/api-gateway/src/handlers/console.rs` ~line 1270-1295 — confirm same pattern with `table_name = "workspace_versions"`, `changes` includes `workspace_id`, `version_number`
- [ ] Confirm the `audit_log` table schema (migration `20260314000008`) has columns: `id`, `user_id`, `action`, `table_name`, `record_id`, `changes`, `ip_address`, `user_agent`, `created_at`
- [ ] Document in this step's verification that NO additional audit code is needed

### Step 19: Full build verification

- [ ] `cd /home/io/io-dev/io && BINDGEN_EXTRA_CLANG_ARGS="-I/usr/lib/gcc/x86_64-linux-gnu/13/include" cargo build -p io-api-gateway`
- [ ] `cd /home/io/io-dev/io/frontend && pnpm build`
- [ ] No TypeScript errors, no Rust compile errors

### Step 20: Visual verification (if dev environment running)

- [ ] Log in as admin (admin/changeme)
- [ ] Navigate to Designer > Graphics list: verify toggle appears in filter bar; toggle ON → see all users' graphics; toggle OFF → see only own + published
- [ ] Navigate to Console: verify toggle appears in Workspaces, Graphics, and Charts accordion sections
- [ ] Open Version History dialog: verify "Show deleted" toggle appears and is connected to the admin store (persists when dialog is closed and reopened)
- [ ] Log in as a non-admin user: verify NO toggles are visible anywhere
- [ ] Permanently delete a version as admin: verify `audit_log` entry exists (query: `SELECT * FROM audit_log WHERE action = 'version.permanent_delete' ORDER BY created_at DESC LIMIT 1`)

---

## 9. Tricky Parts

### 9.1 Dynamic SQL binding in `list_graphics`

The `list_graphics` handler builds SQL with `format!()` and uses numbered `$N` bind parameters. The module filter uses `$1` when present. Adding a `created_by` clause must not break the parameter numbering.

**Recommended approach:** Use string interpolation for the UUID (it's a trusted server-side value from the JWT, not user input) rather than adding another `$N` bind parameter. This avoids restructuring the dynamic SQL builder:

```rust
let visibility_clause = if all_users {
    String::new()
} else {
    format!(" AND (created_by = '{}' OR COALESCE(published, false) = true)", user_id)
};
```

Alternatively, refactor to use a query builder, but that's out of scope for this phase.

### 9.2 `published` column may be NULL for old rows

The `published` column was added by Task 1 migration as `BOOLEAN NOT NULL DEFAULT false`, but if the migration hasn't run yet on the target database, old rows won't have the column. Use `COALESCE(published, false)` in SQL to be safe. However, since Tasks 1-6 are prerequisites, the column should exist. Use `COALESCE` anyway as defensive coding.

### 9.3 Workspace visibility fix is a baseline change

The current `list_workspaces` shows ONLY the current user's workspaces — it does NOT show published workspaces from other users. Changing the default to `created_by = $1 OR published = true` is a **baseline visibility improvement** that matters even without the admin toggle. This is correct behavior per the architecture doc: "Published = visible to all users who have module-level read access."

### 9.4 Single toggle for "All users" across all views

All views share the same `showAllUsersObjects` state from `useAdminToggleStore`. When an admin toggles it ON in the Console palette, the Designer graphics list and Process sidebar also show all users' objects without requiring a separate toggle action. This is intentional — the admin is saying "I want to see everything" globally for this session.

### 9.5 `useAdminToggleStore` must not be called in non-admin code paths at render time

All `useAdminToggleStore` selectors read a boolean — this is cheap. The `AdminToggle` component itself short-circuits with `return null` for non-admins. However, the `useQuery` calls that read `showAllUsers` will re-render when the value changes. For non-admin users, the value never changes (it's always `false`), so there is no performance concern.

---

## 10. Acceptance Criteria

All of the following must be true before Task 7 is considered complete:

1. **`cargo build -p io-api-gateway` passes** with zero errors.

2. **`pnpm build` passes** from `frontend/` with zero TypeScript errors.

3. **Two new frontend files exist:**
   - `frontend/src/store/adminToggleStore.ts`
   - `frontend/src/shared/components/AdminToggle.tsx`

4. **Backend `list_graphics` filters by visibility:** Default = user's own + published. With `include_all_users=true` AND admin role = all graphics.

5. **Backend `list_workspaces` filters by visibility:** Default = user's own + published (fixed from current user-only). With `include_all_users=true` AND admin role = all workspaces.

6. **Frontend `graphicsApi.list`, `graphicsApi.getHierarchy`, `consoleApi.listWorkspaces`** accept an `includeAllUsers` parameter.

7. **Admin toggle is visible** in all 10 list/search views enumerated in section 1 when logged in as admin.

8. **Admin toggle is invisible** to non-admin users.

9. **Toggle state persists** across page navigation within a session (e.g., toggling ON in Console carries over to Designer).

10. **Toggle state resets** on page refresh (no localStorage, no database persistence).

11. **"Show deleted" toggle** in VersionRecoveryDialog uses the centralized `useAdminToggleStore` instead of local state, persisting across dialog open/close cycles.

12. **Permanent-delete audit logging** is confirmed working: `INSERT INTO audit_log` with `action = 'version.permanent_delete'` is present in both `graphics.rs` and `console.rs` handlers. No additional audit code needed.

13. **No new migrations** created.
