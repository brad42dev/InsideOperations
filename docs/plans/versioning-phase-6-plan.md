# Versioning Phase 6 — Version Recovery Dialog

Full replacement of the `VersionHistoryDialog.tsx` shell with a production-quality, feature-complete version picker and recovery modal.

**Architecture doc:** `docs/architecture/versioning-and-publishing.md`
**Parent plan:** `docs/plans/versioning-plan.md` (Task 6)
**Prerequisites:** Task 5 complete — `useObjectActions` hook and five dialogs exist in `frontend/src/shared/components/versioning/`

---

## 1. What Exists vs. What This Phase Builds

### Existing (Task 5 output — do not re-create)

- `frontend/src/shared/hooks/useObjectActions.ts` — the generic action hook
- `frontend/src/shared/components/versioning/SaveConfirmDialog.tsx`
- `frontend/src/shared/components/versioning/SaveAsDialog.tsx`
- `frontend/src/shared/components/versioning/PublishConfirmDialog.tsx`
- `frontend/src/shared/components/versioning/UnpublishConfirmDialog.tsx`
- `frontend/src/shared/components/versioning/DeleteConfirmDialog.tsx`
- `frontend/src/shared/components/versioning/index.ts` (barrel export)

### Backend endpoints available (all routes registered in main.rs)

| Endpoint | Purpose |
|----------|---------|
| `GET /api/v1/design-objects/:id/versions?include_deleted=true` | List graphic versions |
| `GET /api/v1/design-objects/:id/versions/:version_number` | Get version content (`scene_data` field) |
| `DELETE /api/v1/design-objects/:id/versions/:version_number` | Soft-delete version |
| `POST /api/v1/design-objects/:id/versions/:version_number/restore` | Restore version to live |
| `POST /api/v1/design-objects/:id/versions/:version_number/recover` | Admin: un-soft-delete |
| `DELETE /api/v1/design-objects/:id/versions/:version_number/permanent` | Admin: hard delete |
| `PATCH /api/v1/design-objects/:id/versions/:version_number` | Update label |
| `GET /api/console/workspaces/:id/versions?include_deleted=true` | List workspace versions |
| `GET /api/console/workspaces/:id/versions/:version_number` | Get workspace version content |
| `DELETE /api/console/workspaces/:id/versions/:version_number` | Soft-delete workspace version |
| `POST /api/console/workspaces/:id/versions/:version_number/restore` | Restore workspace version |
| `POST /api/console/workspaces/:id/versions/:version_number/recover` | Admin: recover workspace version |
| `DELETE /api/console/workspaces/:id/versions/:version_number/permanent` | Admin: hard delete workspace version |
| `PATCH /api/console/workspaces/:id/versions/:version_number` | Update workspace version label |

No version endpoints exist for `saved_charts` (the architecture doc confirms versioning is optional in the first pass for charts). The dialog must not render for `chart` type.

### Admin detection

The backend `is_admin()` checks for `permissions = ["*"]`. In the frontend, check `user?.permissions.includes("*")`. **Do not use `designer:admin`** for the version-recovery admin section — it uses the global wildcard `*` permission which is what the backend gates recover/permanent-delete on.

---

## 2. File Inventory

### New files (create all)

| File | Purpose |
|------|---------|
| `frontend/src/shared/types/versioning.ts` | Shared TypeScript types for all version data shapes |
| `frontend/src/shared/components/versioning/VersionRecoveryDialog.tsx` | Main dialog component — replaces the designer-specific shell |
| `frontend/src/shared/components/versioning/useVersionList.ts` | Hook: fetch + filter/search version list |
| `frontend/src/shared/components/versioning/useVersionActions.ts` | Hook: all per-version actions (soft-delete, restore, recover, perm-delete, label update) |
| `frontend/src/shared/components/versioning/VersionListPanel.tsx` | Left panel: scrollable version list with filter controls |
| `frontend/src/shared/components/versioning/VersionPreviewPanel.tsx` | Right panel: version content preview |
| `frontend/src/shared/components/versioning/VersionStatsPanel.tsx` | Stats sidebar on selected version |
| `frontend/src/shared/components/versioning/VersionActionBar.tsx` | Action buttons for selected version |

### Modified files

| File | Change |
|------|--------|
| `frontend/src/api/client.ts` | Add `patch` method if missing |
| `frontend/src/api/graphics.ts` | Update `getVersions`, `getVersionContent`, `restoreVersion` stubs with correct types; add `softDeleteVersion`, `recoverVersion`, `permanentDeleteVersion`, `updateVersionLabel` |
| `frontend/src/api/console.ts` | Add `getWorkspaceVersions`, `getWorkspaceVersionContent`, `restoreWorkspaceVersion`, `softDeleteWorkspaceVersion`, `recoverWorkspaceVersion`, `permanentDeleteWorkspaceVersion`, `updateWorkspaceVersionLabel` |
| `frontend/src/shared/components/versioning/index.ts` | Add `VersionRecoveryDialog` export |
| `frontend/src/pages/designer/components/VersionHistoryDialog.tsx` | Replace body with a thin wrapper that renders `VersionRecoveryDialog` |

---

## 3. TypeScript Types

### 3.1 Create `frontend/src/shared/types/versioning.ts`

This is a pure type file with no imports from other project files (avoids circular dependencies).

```ts
// The wire format from the backend — matches VersionSummary (graphics.rs) and
// WorkspaceVersionSummary (console.rs) which are structurally identical.
export interface VersionSummary {
  id: string;                            // UUID of the version row
  version_number: number;                // Sequential: 1, 2, 3…
  version_type: 'save' | 'publish';      // publish = checkpoint
  label: string | null;                  // User notes / commit message
  parent_version_number: number | null;  // vN that was live when this was saved
  metadata: {
    element_count?: number;
    binding_count?: number;
    [key: string]: unknown;
  } | null;
  created_by: string;                    // UUID — never display to user
  created_by_name: string | null;        // Display name
  created_at: string;                    // ISO 8601
  deleted_at: string | null;             // Non-null = soft-deleted
}

// Wire format from get_version_content (graphics.rs)
// scene_data is the full GraphicDocument JSON blob
export interface GraphicVersionContent {
  id: string;
  version_number: number;
  version_type: 'save' | 'publish';
  label: string | null;
  parent_version_number: number | null;
  scene_data: unknown;  // typed as GraphicDocument at call sites
  metadata: Record<string, unknown> | null;
  created_by: string;
  created_at: string;
}

// Wire format from get_workspace_version_content (console.rs)
export interface WorkspaceVersionContent {
  id: string;
  version_number: number;
  version_type: 'save' | 'publish';
  label: string | null;
  parent_version_number: number | null;
  layout: unknown;  // typed as WorkspaceLayout at call sites
  metadata: Record<string, unknown> | null;
  created_by: string;
  created_at: string;
}

export type ObjectType = 'graphic' | 'workspace';
```

### 3.2 Component props

```ts
// VersionRecoveryDialog — the primary exported component
export interface VersionRecoveryDialogProps {
  open: boolean;
  onClose: () => void;
  objectType: ObjectType;  // charts excluded (no version endpoints)
  objectId: string;
  objectName?: string;
  /**
   * Called when user clicks "Load in current view".
   * For graphics: receives the GraphicVersionContent.
   * For workspaces: receives the WorkspaceVersionContent.
   * The caller is responsible for applying the content and handling unsaved-changes warning.
   */
  onLoadVersion: (content: GraphicVersionContent | WorkspaceVersionContent) => void;
}

// useVersionList hook return
export interface UseVersionListResult {
  versions: VersionSummary[];           // filtered list
  allVersions: VersionSummary[];        // unfiltered list
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
  filterType: 'all' | 'save' | 'publish';
  setFilterType: (t: 'all' | 'save' | 'publish') => void;
  searchText: string;
  setSearchText: (s: string) => void;
  dateFrom: string;
  setDateFrom: (d: string) => void;
  dateTo: string;
  setDateTo: (d: string) => void;
  showDeleted: boolean;                 // admin only; false by default
  setShowDeleted: (v: boolean) => void;
}

// useVersionActions hook return
export interface UseVersionActionsResult {
  loadVersion: (versionNumber: number) => Promise<GraphicVersionContent | WorkspaceVersionContent | null>;
  softDeleteVersion: (versionNumber: number) => Promise<boolean>;
  restoreVersion: (versionNumber: number) => Promise<boolean>;
  recoverVersion: (versionNumber: number) => Promise<boolean>;
  permanentDeleteVersion: (versionNumber: number) => Promise<boolean>;
  updateLabel: (versionNumber: number, label: string | null) => Promise<boolean>;
  isLoading: boolean;
  actionVersionNumber: number | null;  // which version has an in-flight operation
  error: string | null;
}
```

---

## 4. API Function Updates

### 4.1 Verify and add `api.patch` in `frontend/src/api/client.ts`

Before writing any API functions, check if `patch` exists on the `api` object. If missing:

```ts
// In client.ts, inside the api object:
patch: <T>(url: string, body?: unknown): Promise<ApiResult<T>> =>
  request<T>(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  }),
```

### 4.2 Update `frontend/src/api/graphics.ts`

Import `VersionSummary`, `GraphicVersionContent` from `'../shared/types/versioning'`.

Replace the three existing version stubs with correct signatures and add four new functions. The version number (integer) is the URL parameter — not the UUID.

```ts
// Replace getVersions:
getVersions: (id: string, opts?: { includeDeleted?: boolean }) =>
  api.get<{ data: VersionSummary[] }>(
    `/api/v1/design-objects/${id}/versions${opts?.includeDeleted ? '?include_deleted=true' : ''}`,
  ),

// Replace getVersionContent — version_number (integer), not a UUID string:
getVersionContent: (id: string, versionNumber: number) =>
  api.get<{ data: GraphicVersionContent }>(
    `/api/v1/design-objects/${id}/versions/${versionNumber}`,
  ),

// Replace restoreVersion — version_number (integer):
restoreVersion: (id: string, versionNumber: number) =>
  api.post<{ data: { version_number: number } }>(
    `/api/v1/design-objects/${id}/versions/${versionNumber}/restore`,
    {},
  ),

// NEW: soft-delete a version
softDeleteVersion: (id: string, versionNumber: number) =>
  api.delete<{ data: { deleted: boolean } }>(
    `/api/v1/design-objects/${id}/versions/${versionNumber}`,
  ),

// NEW: recover a soft-deleted version (admin only)
recoverVersion: (id: string, versionNumber: number) =>
  api.post<{ data: { recovered: boolean } }>(
    `/api/v1/design-objects/${id}/versions/${versionNumber}/recover`,
    {},
  ),

// NEW: permanently delete a version (admin only)
permanentDeleteVersion: (id: string, versionNumber: number) =>
  api.delete<{ data: { permanently_deleted: boolean } }>(
    `/api/v1/design-objects/${id}/versions/${versionNumber}/permanent`,
  ),

// NEW: update version label
updateVersionLabel: (id: string, versionNumber: number, label: string | null) =>
  api.patch<{ data: { version_number: number; label: string | null } }>(
    `/api/v1/design-objects/${id}/versions/${versionNumber}`,
    { label },
  ),
```

**IMPORTANT:** The existing `VersionHistoryDialog.tsx` called `getVersionContent(graphicId, versionId)` where `versionId` was a string UUID. The backend now accepts `version_number` (integer) as a URL segment. This is a fix — the old parameter name was never correct.

### 4.3 Add workspace version functions to `frontend/src/api/console.ts`

Import `VersionSummary`, `WorkspaceVersionContent` from `'../shared/types/versioning'`.

Add these functions to the `consoleApi` object alongside the existing workspace methods:

```ts
listWorkspaceVersions: (id: string, opts?: { includeDeleted?: boolean }) =>
  api.get<{ data: VersionSummary[] }>(
    `/api/console/workspaces/${id}/versions${opts?.includeDeleted ? '?include_deleted=true' : ''}`,
  ),

getWorkspaceVersionContent: (id: string, versionNumber: number) =>
  api.get<{ data: WorkspaceVersionContent }>(
    `/api/console/workspaces/${id}/versions/${versionNumber}`,
  ),

restoreWorkspaceVersion: (id: string, versionNumber: number) =>
  api.post<{ data: { version_number: number } }>(
    `/api/console/workspaces/${id}/versions/${versionNumber}/restore`,
    {},
  ),

softDeleteWorkspaceVersion: (id: string, versionNumber: number) =>
  api.delete<{ data: { deleted: boolean } }>(
    `/api/console/workspaces/${id}/versions/${versionNumber}`,
  ),

recoverWorkspaceVersion: (id: string, versionNumber: number) =>
  api.post<{ data: { recovered: boolean } }>(
    `/api/console/workspaces/${id}/versions/${versionNumber}/recover`,
    {},
  ),

permanentDeleteWorkspaceVersion: (id: string, versionNumber: number) =>
  api.delete<{ data: { permanently_deleted: boolean } }>(
    `/api/console/workspaces/${id}/versions/${versionNumber}/permanent`,
  ),

updateWorkspaceVersionLabel: (id: string, versionNumber: number, label: string | null) =>
  api.patch<{ data: { version_number: number; label: string | null } }>(
    `/api/console/workspaces/${id}/versions/${versionNumber}`,
    { label },
  ),
```

---

## 5. Hook Implementations

### 5.1 `useVersionList.ts`

**Location:** `frontend/src/shared/components/versioning/useVersionList.ts`

Fetches the version list and manages all filter state. Does NOT load version content.

```ts
import { useState, useEffect, useCallback, useMemo } from 'react';
import { graphicsApi } from '../../../api/graphics';
import { consoleApi } from '../../../api/console';
import type { VersionSummary, ObjectType, UseVersionListResult } from '../../../shared/types/versioning';

export function useVersionList(
  objectType: ObjectType,
  objectId: string,
): UseVersionListResult {
  const [allVersions, setAllVersions] = useState<VersionSummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [filterType, setFilterType] = useState<'all' | 'save' | 'publish'>('all');
  const [searchText, setSearchText] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showDeleted, setShowDeleted] = useState(false);

  const fetchVersions = useCallback(async () => {
    if (!objectId) return;
    setIsLoading(true);
    setError(null);
    try {
      const result = objectType === 'graphic'
        ? await graphicsApi.getVersions(objectId, { includeDeleted: showDeleted })
        : await consoleApi.listWorkspaceVersions(objectId, { includeDeleted: showDeleted });
      if (result.success) {
        setAllVersions(result.data.data);
      } else {
        setError(result.error?.message ?? 'Failed to load versions');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load versions');
    } finally {
      setIsLoading(false);
    }
  }, [objectId, objectType, showDeleted]);

  useEffect(() => { void fetchVersions(); }, [fetchVersions]);

  const versions = useMemo(() => {
    let list = allVersions;
    if (filterType !== 'all') list = list.filter(v => v.version_type === filterType);
    if (searchText.trim()) {
      const q = searchText.trim().toLowerCase();
      list = list.filter(v => v.label?.toLowerCase().includes(q) ?? false);
    }
    if (dateFrom) {
      const from = new Date(dateFrom).getTime();
      list = list.filter(v => new Date(v.created_at).getTime() >= from);
    }
    if (dateTo) {
      const to = new Date(dateTo + 'T23:59:59Z').getTime();
      list = list.filter(v => new Date(v.created_at).getTime() <= to);
    }
    return list;
  }, [allVersions, filterType, searchText, dateFrom, dateTo]);

  return {
    versions,
    allVersions,
    isLoading,
    error,
    refetch: fetchVersions,
    filterType, setFilterType,
    searchText, setSearchText,
    dateFrom, setDateFrom,
    dateTo, setDateTo,
    showDeleted, setShowDeleted,
  };
}
```

### 5.2 `useVersionActions.ts`

**Location:** `frontend/src/shared/components/versioning/useVersionActions.ts`

Executes per-version actions. Returns the content object when loading a version, booleans for mutating operations.

```ts
import { useState, useCallback } from 'react';
import { graphicsApi } from '../../../api/graphics';
import { consoleApi } from '../../../api/console';
import type {
  ObjectType, GraphicVersionContent, WorkspaceVersionContent, UseVersionActionsResult,
} from '../../../shared/types/versioning';

export function useVersionActions(
  objectType: ObjectType,
  objectId: string,
): UseVersionActionsResult {
  const [isLoading, setIsLoading] = useState(false);
  const [actionVersionNumber, setActionVersionNumber] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function withLoading<T>(versionNumber: number, fn: () => Promise<T>): Promise<T | null> {
    setActionVersionNumber(versionNumber);
    setIsLoading(true);
    setError(null);
    try {
      return await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Operation failed');
      return null;
    } finally {
      setIsLoading(false);
      setActionVersionNumber(null);
    }
  }

  const loadVersion = useCallback(async (versionNumber: number) => {
    return withLoading(versionNumber, async () => {
      const result = objectType === 'graphic'
        ? await graphicsApi.getVersionContent(objectId, versionNumber)
        : await consoleApi.getWorkspaceVersionContent(objectId, versionNumber);
      if (!result.success) {
        throw new Error(result.error?.message ?? 'Failed to load version content');
      }
      return result.data.data as GraphicVersionContent | WorkspaceVersionContent;
    });
  }, [objectType, objectId]);

  const softDeleteVersion = useCallback(async (versionNumber: number): Promise<boolean> => {
    const result = await withLoading(versionNumber, () =>
      objectType === 'graphic'
        ? graphicsApi.softDeleteVersion(objectId, versionNumber)
        : consoleApi.softDeleteWorkspaceVersion(objectId, versionNumber),
    );
    return !!(result as { data?: { deleted?: boolean } } | null)?.data?.deleted;
  }, [objectType, objectId]);

  const restoreVersion = useCallback(async (versionNumber: number): Promise<boolean> => {
    const result = await withLoading(versionNumber, () =>
      objectType === 'graphic'
        ? graphicsApi.restoreVersion(objectId, versionNumber)
        : consoleApi.restoreWorkspaceVersion(objectId, versionNumber),
    );
    return !!result;
  }, [objectType, objectId]);

  const recoverVersion = useCallback(async (versionNumber: number): Promise<boolean> => {
    const result = await withLoading(versionNumber, () =>
      objectType === 'graphic'
        ? graphicsApi.recoverVersion(objectId, versionNumber)
        : consoleApi.recoverWorkspaceVersion(objectId, versionNumber),
    );
    return !!result;
  }, [objectType, objectId]);

  const permanentDeleteVersion = useCallback(async (versionNumber: number): Promise<boolean> => {
    const result = await withLoading(versionNumber, () =>
      objectType === 'graphic'
        ? graphicsApi.permanentDeleteVersion(objectId, versionNumber)
        : consoleApi.permanentDeleteWorkspaceVersion(objectId, versionNumber),
    );
    return !!result;
  }, [objectType, objectId]);

  const updateLabel = useCallback(async (versionNumber: number, label: string | null): Promise<boolean> => {
    const result = await withLoading(versionNumber, () =>
      objectType === 'graphic'
        ? graphicsApi.updateVersionLabel(objectId, versionNumber, label)
        : consoleApi.updateWorkspaceVersionLabel(objectId, versionNumber, label),
    );
    return !!result;
  }, [objectType, objectId]);

  return {
    loadVersion,
    softDeleteVersion,
    restoreVersion,
    recoverVersion,
    permanentDeleteVersion,
    updateLabel,
    isLoading,
    actionVersionNumber,
    error,
  };
}
```

---

## 6. Component Implementations

### 6.1 `VersionRecoveryDialog.tsx` — main dialog

**Location:** `frontend/src/shared/components/versioning/VersionRecoveryDialog.tsx`

This is a large right-side-panel modal, NOT a centered dialog. It follows the existing `VersionHistoryDialog` panel pattern (fixed right side, full height, backdrop).

**Layout:**
```
[Backdrop div — full screen]
[Panel div — fixed, right: 0, width: 900px, full height, flexbox column]
  [Header row — title "Version History", subtitle "objectName", close X]
  [Body row — flex: 1, overflow hidden, flexbox row]
    [Left: VersionListPanel — width: 340px, flex-shrink: 0]
    [Center divider — 1px border]
    [Right: VersionPreviewPanel — flex: 1, contains preview + VersionStatsPanel]
  [Footer — VersionActionBar (only shown when a version is selected)]
```

**State managed in `VersionRecoveryDialog`:**

```ts
const [selectedVersionNumber, setSelectedVersionNumber] = useState<number | null>(null);
const [previewContent, setPreviewContent] = useState<GraphicVersionContent | WorkspaceVersionContent | null>(null);
const [previewLoading, setPreviewLoading] = useState(false);
const [labelEditVersionNumber, setLabelEditVersionNumber] = useState<number | null>(null);
const [labelEditValue, setLabelEditValue] = useState('');
const [permDeleteConfirmVersionNumber, setPermDeleteConfirmVersionNumber] = useState<number | null>(null);
const [loadVersionConfirmVersionNumber, setLoadVersionConfirmVersionNumber] = useState<number | null>(null);
const [showSaveAsDialog, setShowSaveAsDialog] = useState(false);
const [showPublishDialog, setShowPublishDialog] = useState(false);
```

**Admin detection:**

```ts
const isAdmin = useAuthStore((s) => s.user?.permissions.includes('*') ?? false);
```

**Selection handler — loads preview automatically:**

```ts
async function handleSelectVersion(versionNumber: number) {
  setSelectedVersionNumber(versionNumber);
  setPreviewContent(null);
  setPreviewLoading(true);
  const content = await versionActions.loadVersion(versionNumber);
  setPreviewContent(content);
  setPreviewLoading(false);
}
```

**Load in current view confirmation:**

```ts
function handleLoadInCurrentViewConfirmed() {
  if (!previewContent) return;
  onLoadVersion(previewContent);
  onClose();
}
```

The `loadVersionConfirmVersionNumber` state triggers a `ConfirmDialog` (from `frontend/src/shared/components/ConfirmDialog.tsx`) with the warning: "Loading this version will replace your current working content. Any unsaved changes will be lost. Continue?"

**Open in new tab:**

```ts
function handleOpenInNewTab() {
  const url = objectType === 'graphic'
    ? `/designer/graphics/${objectId}/edit`
    : `/console?workspace=${objectId}`;
  window.open(url, '_blank', 'noopener,noreferrer');
}
```

**Full component structure:**

```tsx
export function VersionRecoveryDialog({
  open, onClose, objectType, objectId, objectName, onLoadVersion,
}: VersionRecoveryDialogProps) {
  if (!open) return null;

  const isAdmin = useAuthStore((s) => s.user?.permissions.includes('*') ?? false);

  const versionList = useVersionList(objectType, objectId);
  const versionActions = useVersionActions(objectType, objectId);
  const selectedVersion = versionList.allVersions.find(
    v => v.version_number === selectedVersionNumber,
  ) ?? null;

  // ... state declarations and handlers as above ...

  return (
    <>
      {/* Backdrop */}
      <div
        style={{ position: 'fixed', inset: 0, zIndex: 1049, background: 'rgba(0,0,0,0.25)' }}
        onClick={onClose}
      />
      {/* Panel */}
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0,
        width: 900, maxWidth: 'calc(100vw - 32px)',
        zIndex: 1050,
        background: 'var(--io-surface-elevated)',
        borderLeft: '1px solid var(--io-border)',
        display: 'flex', flexDirection: 'column',
        boxShadow: '-4px 0 24px rgba(0,0,0,0.2)',
      }}>
        {/* Header */}
        <div style={{
          padding: '12px 16px',
          borderBottom: '1px solid var(--io-border)',
          display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0,
        }}>
          <div style={{ flex: 1 }}>
            <span style={{ fontWeight: 600, fontSize: 14 }}>Version History</span>
            {objectName && (
              <span style={{ fontSize: 12, color: 'var(--io-text-muted)', marginLeft: 8 }}>
                {objectName}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            style={{ fontSize: 18, lineHeight: 1, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--io-text-secondary)' }}
          >×</button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex' }}>
          <VersionListPanel
            versionList={versionList}
            selectedVersionNumber={selectedVersionNumber}
            onSelect={handleSelectVersion}
            isAdmin={isAdmin}
            labelEditVersionNumber={labelEditVersionNumber}
            labelEditValue={labelEditValue}
            onStartLabelEdit={(vn, currentLabel) => {
              setLabelEditVersionNumber(vn);
              setLabelEditValue(currentLabel ?? '');
            }}
            onCommitLabelEdit={async () => {
              if (!labelEditVersionNumber) return;
              const ok = await versionActions.updateLabel(
                labelEditVersionNumber, labelEditValue.trim() || null,
              );
              if (ok) {
                void versionList.refetch();
                setLabelEditVersionNumber(null);
              }
            }}
            onCancelLabelEdit={() => setLabelEditVersionNumber(null)}
            actionVersionNumber={versionActions.actionVersionNumber}
          />
          <div style={{ width: 1, background: 'var(--io-border)', flexShrink: 0 }} />
          <VersionPreviewPanel
            objectType={objectType}
            previewContent={previewContent}
            previewLoading={previewLoading}
            selectedVersion={selectedVersion}
          />
        </div>

        {/* Action bar — only when version selected */}
        {selectedVersion && (
          <VersionActionBar
            version={selectedVersion}
            isAdmin={isAdmin}
            isLoadingAction={versionActions.isLoading}
            actionVersionNumber={versionActions.actionVersionNumber}
            permDeleteConfirmVersionNumber={permDeleteConfirmVersionNumber}
            onLoadInCurrentView={() => setLoadVersionConfirmVersionNumber(selectedVersion.version_number)}
            onOpenInNewTab={handleOpenInNewTab}
            onSaveAs={() => setShowSaveAsDialog(true)}
            onPublish={() => setShowPublishDialog(true)}
            onSoftDelete={async () => {
              const ok = await versionActions.softDeleteVersion(selectedVersion.version_number);
              if (ok) { setSelectedVersionNumber(null); void versionList.refetch(); }
            }}
            onRecover={async () => {
              const ok = await versionActions.recoverVersion(selectedVersion.version_number);
              if (ok) void versionList.refetch();
            }}
            onPermDeleteClick={() => setPermDeleteConfirmVersionNumber(selectedVersion.version_number)}
            onPermDeleteConfirm={async () => {
              const ok = await versionActions.permanentDeleteVersion(selectedVersion.version_number);
              if (ok) {
                setPermDeleteConfirmVersionNumber(null);
                setSelectedVersionNumber(null);
                void versionList.refetch();
              }
            }}
            onPermDeleteCancel={() => setPermDeleteConfirmVersionNumber(null)}
          />
        )}
      </div>

      {/* Dialogs rendered outside the panel to avoid stacking context issues */}
      <ConfirmDialog
        open={loadVersionConfirmVersionNumber !== null}
        onOpenChange={(open) => { if (!open) setLoadVersionConfirmVersionNumber(null); }}
        title="Load this version?"
        description="Loading this version will replace your current working content. Any unsaved changes will be lost."
        confirmLabel="Load Version"
        variant="danger"
        onConfirm={handleLoadInCurrentViewConfirmed}
      />

      <SaveAsDialog
        open={showSaveAsDialog}
        onOpenChange={setShowSaveAsDialog}
        onConfirm={({ name, label }) => {
          void objectActions.saveAs({ name, label }).then(id => {
            if (id) setShowSaveAsDialog(false);
          });
        }}
        loading={objectActions.isSavingAs}
        error={objectActions.saveAsError}
        defaultName={objectName ? `Copy of ${objectName}` : undefined}
      />

      <PublishConfirmDialog
        open={showPublishDialog}
        onOpenChange={setShowPublishDialog}
        onConfirm={({ label }) => {
          void objectActions.publish({ label }).then(ok => {
            if (ok) {
              setShowPublishDialog(false);
              void versionList.refetch();
            }
          });
        }}
        loading={objectActions.isPublishing}
        error={objectActions.publishError}
        objectName={objectName}
      />
    </>
  );
}
```

The `objectActions` hook instance (from `useObjectActions`) is for object-level operations (Save As, Publish). Read the `useObjectActions` hook signature from `frontend/src/shared/hooks/useObjectActions.ts` and instantiate it with the correct props for this object type and ID.

### 6.2 `VersionListPanel.tsx`

**Location:** `frontend/src/shared/components/versioning/VersionListPanel.tsx`

**Width:** 340px, full height, flex column.

**Layout:**
```
[Filter bar — fixed top, does not scroll]
  [Search input — full width]
  [Pill buttons row — All / Saves / Publish checkpoints]
  [Date range row — From / To date inputs]
  [Admin toggle — only if isAdmin]
[Version list — flex: 1, overflow-y: auto]
  [VersionEntry × N]
```

**Each version entry:**

```tsx
function VersionEntry({ version, isSelected, onSelect, labelEditVersionNumber, labelEditValue, onStartLabelEdit, onCommitLabelEdit, onCancelLabelEdit }) {
  const isPublish = version.version_type === 'publish';
  const isDeleted = !!version.deleted_at;
  const isEditing = labelEditVersionNumber === version.version_number;

  return (
    <div
      onClick={() => !isDeleted && onSelect(version.version_number)}
      style={{
        padding: '10px 16px',
        borderBottom: '1px solid var(--io-border-subtle)',
        cursor: isDeleted ? 'default' : 'pointer',
        background: isSelected ? 'var(--io-accent-subtle)' : 'transparent',
        opacity: isDeleted ? 0.5 : 1,
        borderLeft: isPublish ? '3px solid var(--io-accent)' : '3px solid transparent',
      }}
    >
      {/* Version number + type badge + timestamp */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        {isPublish ? (
          <span style={{
            background: 'var(--io-accent)', color: 'var(--io-text-on-accent)',
            borderRadius: 4, padding: '1px 6px', fontSize: 11, fontWeight: 600,
          }}>
            v{version.version_number} ● PUBLISH
          </span>
        ) : (
          <span style={{ fontSize: 12, color: 'var(--io-text-primary)', fontWeight: 500 }}>
            v{version.version_number}
          </span>
        )}
        {isDeleted && (
          <span style={{
            background: 'var(--io-danger)', color: '#fff',
            borderRadius: 3, padding: '1px 5px', fontSize: 10,
            textDecoration: 'line-through',
          }}>deleted</span>
        )}
        <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--io-text-muted)', whiteSpace: 'nowrap' }}>
          {formatTimestamp(version.created_at)}
        </span>
      </div>

      {/* Author */}
      <div style={{ fontSize: 11, color: 'var(--io-text-muted)' }}>
        {version.created_by_name ?? 'Unknown'}
      </div>

      {/* Label — editable inline or shown as tooltip trigger */}
      {isEditing ? (
        <div style={{ marginTop: 4 }}>
          <input
            autoFocus
            value={labelEditValue}
            onChange={e => setLabelEditValue(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') void onCommitLabelEdit();
              if (e.key === 'Escape') onCancelLabelEdit();
            }}
            style={{ width: '100%', fontSize: 12, padding: '2px 6px', borderRadius: 3 }}
          />
          <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
            <button onClick={() => void onCommitLabelEdit()} style={smallAccentBtn}>Save</button>
            <button onClick={onCancelLabelEdit} style={smallGhostBtn}>Cancel</button>
          </div>
        </div>
      ) : version.label ? (
        <div
          title={version.label}
          onClick={e => { e.stopPropagation(); onStartLabelEdit(version.version_number, version.label); }}
          style={{
            marginTop: 4, fontSize: 11, color: 'var(--io-text-secondary)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            cursor: 'text',
          }}
        >
          {version.label}
        </div>
      ) : (
        <div
          onClick={e => { e.stopPropagation(); onStartLabelEdit(version.version_number, ''); }}
          style={{ marginTop: 4, fontSize: 11, color: 'var(--io-text-muted)', cursor: 'text' }}
        >
          + add note
        </div>
      )}
    </div>
  );
}
```

**Pill button style:**
```ts
const pillBtn = (active: boolean): React.CSSProperties => ({
  padding: '3px 10px',
  fontSize: 11,
  borderRadius: 12,
  border: '1px solid var(--io-border)',
  background: active ? 'var(--io-accent)' : 'transparent',
  color: active ? 'var(--io-text-on-accent)' : 'var(--io-text-secondary)',
  cursor: 'pointer',
});
```

### 6.3 `VersionPreviewPanel.tsx`

**Location:** `frontend/src/shared/components/versioning/VersionPreviewPanel.tsx`

**Layout (horizontal):**
```
[Preview area — flex: 1, overflow: hidden]
[VersionStatsPanel — width: 220px, border-left]
```

**For graphics (`objectType === 'graphic'`):**

Render `SceneRenderer` with the `scene_data` from `previewContent`. Use `previewMode={true}` and `liveSubscribe={false}` to get a static preview with no live point data.

```tsx
import { SceneRenderer } from '../../../shared/graphics/SceneRenderer';

{previewLoading && (
  <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--io-text-muted)' }}>
    Loading preview…
  </div>
)}
{!previewLoading && previewContent && objectType === 'graphic' && (
  <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
    <SceneRenderer
      document={(previewContent as GraphicVersionContent).scene_data}
      previewMode={true}
      liveSubscribe={false}
      preserveAspectRatio="xMidYMid meet"
      style={{ width: '100%', height: '100%' }}
    />
  </div>
)}
```

**For workspaces (`objectType === 'workspace'`):**

Render a structural layout preview — a grid of colored placeholder cells representing panes. Do NOT use WorkspaceGrid or SceneRenderer.

```tsx
{!previewLoading && previewContent && objectType === 'workspace' && (
  <WorkspaceLayoutSkeleton layout={(previewContent as WorkspaceVersionContent).layout} />
)}

function WorkspaceLayoutSkeleton({ layout }: { layout: unknown }) {
  // layout is the workspace layout JSON; iterate panes
  const panes = (layout as { panes?: Array<{ id: string; type: string; title?: string }> })?.panes ?? [];
  return (
    <div style={{
      flex: 1, display: 'grid',
      gridTemplateColumns: `repeat(${Math.min(Math.max(panes.length, 1), 3)}, 1fr)`,
      gap: 8, padding: 16, alignContent: 'start', overflowY: 'auto',
    }}>
      {panes.map(pane => (
        <div key={pane.id} style={{
          background: 'var(--io-surface-secondary)',
          border: '1px solid var(--io-border)',
          borderRadius: 6, padding: '8px 12px', minHeight: 80,
          display: 'flex', flexDirection: 'column', gap: 4,
        }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--io-text-secondary)' }}>
            {pane.type.toUpperCase()}
          </span>
          {pane.title && (
            <span style={{ fontSize: 12, color: 'var(--io-text-primary)' }}>{pane.title}</span>
          )}
        </div>
      ))}
    </div>
  );
}
```

**Empty state (no version selected):**

```tsx
{!previewContent && !previewLoading && (
  <div style={{
    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: 'var(--io-text-muted)', fontSize: 13, textAlign: 'center', padding: 32,
  }}>
    Select a version on the left to preview it here.
  </div>
)}
```

The `VersionStatsPanel` is rendered as the right sibling — always visible when a version is selected, even while preview is loading.

### 6.4 `VersionStatsPanel.tsx`

**Location:** `frontend/src/shared/components/versioning/VersionStatsPanel.tsx`

**Width:** 220px, fixed. Shows per-selected-version metadata.

```tsx
export function VersionStatsPanel({ version }: { version: VersionSummary | null }) {
  if (!version) return null;
  const meta = version.metadata ?? {};
  return (
    <div style={{
      width: 220, borderLeft: '1px solid var(--io-border)',
      padding: '16px 12px', overflowY: 'auto', flexShrink: 0,
      display: 'flex', flexDirection: 'column', gap: 12,
    }}>
      <StatRow label="Version" value={`v${version.version_number}`} />
      <StatRow label="Date" value={formatTimestampFull(version.created_at)} />
      <StatRow label="Type" value={version.version_type === 'publish' ? '● Publish checkpoint' : 'Save'} />
      {version.created_by_name && <StatRow label="By" value={version.created_by_name} />}
      {meta.element_count !== undefined && <StatRow label="Elements" value={String(meta.element_count)} />}
      {meta.binding_count !== undefined && <StatRow label="Bindings" value={String(meta.binding_count)} />}
      {version.parent_version_number !== null && (
        <StatRow label="Previous" value={`v${version.parent_version_number}`} />
      )}
      {version.label && (
        <div>
          <StatLabel>Notes</StatLabel>
          <div style={{ fontSize: 12, color: 'var(--io-text-primary)', whiteSpace: 'pre-wrap', wordBreak: 'break-word', marginTop: 2 }}>
            {version.label}
          </div>
        </div>
      )}
    </div>
  );
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <StatLabel>{label}</StatLabel>
      <div style={{ fontSize: 12, color: 'var(--io-text-primary)', marginTop: 2 }}>{value}</div>
    </div>
  );
}

function StatLabel({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 10, color: 'var(--io-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{children}</div>;
}
```

### 6.5 `VersionActionBar.tsx`

**Location:** `frontend/src/shared/components/versioning/VersionActionBar.tsx`

Renders at the bottom of the dialog panel. Two modes: deleted version (admin recovery) vs. live version (normal actions).

```tsx
export function VersionActionBar({
  version, isAdmin, isLoadingAction, actionVersionNumber, permDeleteConfirmVersionNumber,
  onLoadInCurrentView, onOpenInNewTab, onSaveAs, onPublish, onSoftDelete,
  onRecover, onPermDeleteClick, onPermDeleteConfirm, onPermDeleteCancel,
}: VersionActionBarProps) {
  const isDeleted = !!version.deleted_at;
  const thisVersionLoading = isLoadingAction && actionVersionNumber === version.version_number;

  const actionBarStyle: React.CSSProperties = {
    padding: '10px 16px',
    borderTop: '1px solid var(--io-border)',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
    minHeight: 52,
    flexShrink: 0,
  };

  if (isDeleted) {
    return (
      <div style={actionBarStyle}>
        <span style={{ fontSize: 12, color: 'var(--io-text-muted)' }}>
          This version has been deleted.
        </span>
        {isAdmin && (
          <>
            <ActionButton onClick={onRecover} disabled={thisVersionLoading}>
              {thisVersionLoading ? '…' : 'Recover'}
            </ActionButton>
            {permDeleteConfirmVersionNumber === version.version_number ? (
              <>
                <span style={{ fontSize: 12, color: 'var(--io-danger)' }}>Are you sure?</span>
                <ActionButton danger onClick={onPermDeleteConfirm} disabled={thisVersionLoading}>
                  {thisVersionLoading ? '…' : 'Permanently Delete'}
                </ActionButton>
                <ActionButton onClick={onPermDeleteCancel}>Cancel</ActionButton>
              </>
            ) : (
              <ActionButton danger onClick={onPermDeleteClick}>Permanently Delete…</ActionButton>
            )}
          </>
        )}
      </div>
    );
  }

  return (
    <div style={actionBarStyle}>
      <ActionButton primary onClick={onLoadInCurrentView} disabled={isLoadingAction}>
        Load in Current View
      </ActionButton>
      <ActionButton onClick={onOpenInNewTab}>Open in New Tab</ActionButton>
      <ActionButton onClick={onSaveAs}>Save As…</ActionButton>
      {version.version_type !== 'publish' && (
        <ActionButton onClick={onPublish}>Publish…</ActionButton>
      )}
      <div style={{ marginLeft: 'auto' }} />
      <ActionButton danger onClick={onSoftDelete} disabled={thisVersionLoading}>
        {thisVersionLoading ? '…' : 'Delete'}
      </ActionButton>
    </div>
  );
}

function ActionButton({
  children, onClick, disabled, primary, danger,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  primary?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: '5px 12px', fontSize: 12,
        borderRadius: 'var(--io-radius)',
        border: danger ? '1px solid var(--io-danger)' : '1px solid var(--io-border)',
        background: primary ? 'var(--io-accent)' : danger ? 'transparent' : 'transparent',
        color: primary ? 'var(--io-text-on-accent)' : danger ? 'var(--io-danger)' : 'var(--io-text-secondary)',
        cursor: disabled ? 'not-allowed',
        opacity: disabled ? 0.6 : 1,
      }}
    >
      {children}
    </button>
  );
}
```

---

## 7. Replacing `VersionHistoryDialog.tsx`

**Location:** `frontend/src/pages/designer/components/VersionHistoryDialog.tsx`

Replace the entire body with a thin wrapper. The existing `VersionHistoryDialogProps` interface is preserved exactly so the call site in `designer/index.tsx` requires zero changes.

The wrapper adapts the old `graphicId/onPreview/onRestore` props to the new `objectType/objectId/onLoadVersion` pattern:

```tsx
import React from 'react';
import { VersionRecoveryDialog } from '../../../shared/components/versioning/VersionRecoveryDialog';
import type { GraphicVersionContent } from '../../../shared/types/versioning';

interface VersionHistoryDialogProps {
  open: boolean;
  onClose: () => void;
  graphicId: string | null;
  onPreview: (versionId: string, doc: unknown) => void;
  onRestore: (versionId: string) => void;
}

export default function VersionHistoryDialog({
  open,
  onClose,
  graphicId,
  onPreview,
}: VersionHistoryDialogProps) {
  if (!graphicId) return null;

  return (
    <VersionRecoveryDialog
      open={open}
      onClose={onClose}
      objectType="graphic"
      objectId={graphicId}
      onLoadVersion={(content) => {
        const gc = content as GraphicVersionContent;
        // Adapt to the old onPreview callback: pass version number as string ID and scene_data as doc
        onPreview(String(gc.version_number), gc.scene_data);
      }}
    />
  );
}
```

**`onRestore` is intentionally unused** in the new implementation. The new `VersionActionBar` has a dedicated Restore button (server-side restore via `useVersionActions.restoreVersion`). The `onLoadVersion`/`onPreview` callback handles the client-side "load into editor" path. The old `onRestore` prop is kept in the interface for backward compatibility (the call site passes it) but is not called.

**Verify the call site:** `frontend/src/pages/designer/index.tsx` renders `<VersionHistoryDialog>` around line 3128 (verify exact line by grepping for `VersionHistoryDialog`). The props passed must match the interface above — confirm no changes are needed.

---

## 8. Helper Functions

Define in a co-located file `frontend/src/shared/components/versioning/versioning-utils.ts` or at the top of `VersionRecoveryDialog.tsx`:

```ts
// Short timestamp for list entries: "Apr 15, 14:32"
export function formatTimestamp(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

// Full timestamp for stats panel: "April 15, 2026 at 14:32:07"
export function formatTimestampFull(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      year: 'numeric', month: 'long', day: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
  } catch {
    return iso;
  }
}
```

---

## 9. Barrel Export Update

Add to `frontend/src/shared/components/versioning/index.ts`:

```ts
export { VersionRecoveryDialog } from './VersionRecoveryDialog';
export type { VersionRecoveryDialogProps } from './VersionRecoveryDialog';
```

The shared types (`VersionSummary`, `GraphicVersionContent`, `WorkspaceVersionContent`, `ObjectType`) are exported from `frontend/src/shared/types/versioning.ts` directly — import them from there, not from the component file.

---

## 10. Style Tokens Reference

All inline styles use these CSS custom properties (same as existing `VersionHistoryDialog.tsx` and other dialogs):

| Token | Usage |
|-------|-------|
| `var(--io-surface-elevated)` | Panel background |
| `var(--io-surface-secondary)` | Version entry hover, stats panel |
| `var(--io-border)` | Panel left border, section dividers |
| `var(--io-border-subtle)` | Version entry dividers |
| `var(--io-text-primary)` | Version number, label text |
| `var(--io-text-secondary)` | Author name, description text |
| `var(--io-text-muted)` | Timestamp, empty state |
| `var(--io-text-on-accent)` | Text on accent backgrounds |
| `var(--io-accent)` | Publish badge, selected entry border, primary button |
| `var(--io-accent-subtle)` | Selected entry background |
| `var(--io-danger)` | Deleted badge, delete button, permanent delete |
| `var(--io-radius)` | Border radius on buttons/badges |

---

## 11. Potential Pitfalls

1. **Circular imports**: Types must live in `frontend/src/shared/types/versioning.ts`. Never import from `VersionRecoveryDialog.tsx` in API files or hooks — that creates a circular dependency. API files import from `versioning.ts`. Components import from `versioning.ts`. No circular chain.

2. **`api.patch` may not exist**: Verify before writing any API function that calls it. If missing, add to `client.ts` (section 4.1).

3. **`restoreVersion` vs. `onLoadVersion`** are two distinct operations:
   - `restoreVersion` (server-side): Creates new version snapshot at top of stack. The live `design_objects` row is updated server-side. Use for "make this the official latest."
   - `onLoadVersion` (client-side): Loads content into editor in memory. Does NOT touch the server. Use for "preview; I'll decide whether to save."
   Both are exposed in the `VersionActionBar`.

4. **`SceneRenderer` shape loading**: In preview mode, `SceneRenderer` still makes HTTP requests for custom shapes. This is fine — shapes are immutable and cached by the browser. Verify `SceneRenderer` accepts a `previewMode` prop; if not, look for the `liveSubscribe` or `readOnly` prop pattern it already uses.

5. **`api.delete` with `/permanent` suffix**: Verify `api.delete` in `client.ts` passes the full URL unchanged. Test the path `/api/v1/design-objects/:id/versions/:version_number/permanent` explicitly.

6. **The `showDeleted` toggle triggers a re-fetch**: Since the backend filters deleted versions server-side when `include_deleted` is absent, the toggle must re-fetch, not just filter the client-side list. This is handled by the `useEffect` dependency on `showDeleted` in `useVersionList`.

---

## 12. Integration Points (No Additional Changes Required in This Phase)

### Designer (`frontend/src/pages/designer/index.tsx`)

No changes required. The drop-in replacement in the wrapper preserves the existing props interface. Verify the call site renders:
```tsx
<VersionHistoryDialog
  open={showVersionHistory}
  onClose={() => setShowVersionHistory(false)}
  graphicId={currentGraphicId}
  onPreview={handlePreviewVersion}
  onRestore={handleRestoreVersion}
/>
```
After the replacement, `handleRestoreVersion` is no longer called but the prop is still passed — this is fine.

### Console (Task 8 scope)

When Task 8 runs, it will add a "Version History…" item to the workspace context menu and render:
```tsx
<VersionRecoveryDialog
  open={!!showVersionHistoryFor}
  objectType="workspace"
  objectId={showVersionHistoryFor!}
  onClose={() => setShowVersionHistoryFor(null)}
  onLoadVersion={handleLoadWorkspaceVersion}
/>
```
No console changes in this phase.

### Chart config (not applicable)

No version endpoints exist for saved charts. Do not render `VersionRecoveryDialog` for charts.

---

## 13. Implementation Checklist

Execute these steps in order. Verify each before proceeding.

### Step 1: Verify `api.patch` in `frontend/src/api/client.ts`
- [ ] Read `frontend/src/api/client.ts`
- [ ] Confirm `patch` method exists on the api object
- [ ] If missing, add it (see section 4.1)
- [ ] Run `cd frontend && pnpm build` to confirm client.ts compiles

### Step 2: Create `frontend/src/shared/types/versioning.ts`
- [ ] Create the file with `VersionSummary`, `GraphicVersionContent`, `WorkspaceVersionContent`, `ObjectType` types (section 3.1)
- [ ] No imports from other project files — pure type definitions only

### Step 3: Update `frontend/src/api/graphics.ts`
- [ ] Import `VersionSummary`, `GraphicVersionContent` from `'../shared/types/versioning'`
- [ ] Replace `getVersions` — now accepts `opts?: { includeDeleted?: boolean }`
- [ ] Replace `getVersionContent` — parameter is `versionNumber: number`, not a UUID string
- [ ] Replace `restoreVersion` — parameter is `versionNumber: number`
- [ ] Add `softDeleteVersion(id, versionNumber)`
- [ ] Add `recoverVersion(id, versionNumber)`
- [ ] Add `permanentDeleteVersion(id, versionNumber)`
- [ ] Add `updateVersionLabel(id, versionNumber, label)`

### Step 4: Add workspace version functions to `frontend/src/api/console.ts`
- [ ] Import `VersionSummary`, `WorkspaceVersionContent` from `'../shared/types/versioning'`
- [ ] Add `listWorkspaceVersions(id, opts?)`
- [ ] Add `getWorkspaceVersionContent(id, versionNumber)`
- [ ] Add `restoreWorkspaceVersion(id, versionNumber)`
- [ ] Add `softDeleteWorkspaceVersion(id, versionNumber)`
- [ ] Add `recoverWorkspaceVersion(id, versionNumber)`
- [ ] Add `permanentDeleteWorkspaceVersion(id, versionNumber)`
- [ ] Add `updateWorkspaceVersionLabel(id, versionNumber, label)`

### Step 5: Create `frontend/src/shared/components/versioning/useVersionList.ts`
- [ ] Implement per section 5.1
- [ ] Filter logic is pure client-side computed from `allVersions`
- [ ] `showDeleted` in `useEffect` dependency array so it triggers re-fetch

### Step 6: Create `frontend/src/shared/components/versioning/useVersionActions.ts`
- [ ] Implement per section 5.2
- [ ] All mutating operations return `Promise<boolean>`
- [ ] `loadVersion` returns `Promise<GraphicVersionContent | WorkspaceVersionContent | null>`
- [ ] `withLoading` helper manages `actionVersionNumber`, `isLoading`, `error`

### Step 7: Create `frontend/src/shared/components/versioning/VersionStatsPanel.tsx`
- [ ] Implement per section 6.4
- [ ] Returns `null` when `version` prop is `null`
- [ ] Uses `formatTimestampFull` helper

### Step 8: Create `frontend/src/shared/components/versioning/VersionActionBar.tsx`
- [ ] Implement per section 6.5
- [ ] Two modes: deleted version (admin recovery only) vs. live version (full actions)
- [ ] Two-step permanent delete: first click sets `permDeleteConfirmVersionNumber`, second click calls `onPermDeleteConfirm`
- [ ] Permanently delete only appears when `isAdmin === true`
- [ ] `ActionButton` internal component handles primary/danger/disabled styling

### Step 9: Create `frontend/src/shared/components/versioning/VersionPreviewPanel.tsx`
- [ ] Implement per section 6.3
- [ ] Verify `SceneRenderer` import path by checking `frontend/src/shared/graphics/SceneRenderer.tsx` exists
- [ ] Verify `SceneRenderer` prop names for preview mode (check existing uses in the codebase)
- [ ] For graphic: render `SceneRenderer` with preview/read-only props
- [ ] For workspace: render `WorkspaceLayoutSkeleton` (internal component)
- [ ] Include `VersionStatsPanel` as the 220px right sidebar
- [ ] Loading state while `previewLoading` is true
- [ ] Empty state when no version selected

### Step 10: Create `frontend/src/shared/components/versioning/VersionListPanel.tsx`
- [ ] Implement per section 6.2
- [ ] Filter bar at top (search input, pill buttons, date range, admin toggle)
- [ ] Scrollable version list below
- [ ] Each entry: version number, publish badge, timestamp, author, label
- [ ] Selected version: `var(--io-accent-subtle)` background
- [ ] Publish checkpoints: `borderLeft: '3px solid var(--io-accent)'`
- [ ] Soft-deleted: only shown when `showDeleted = true`; grayed out + strikethrough badge
- [ ] Inline label editing: click → edit mode; Enter saves, Escape cancels

### Step 11: Create `frontend/src/shared/components/versioning/VersionRecoveryDialog.tsx`
- [ ] Implement per section 6.1
- [ ] Admin detection: `useAuthStore(s => s.user?.permissions.includes('*') ?? false)`
- [ ] Panel: 900px wide, full height, right-anchored, zIndex 1050
- [ ] Backdrop: full screen, zIndex 1049, click to close
- [ ] Compose `VersionListPanel`, `VersionPreviewPanel`, `VersionActionBar`
- [ ] Auto-load preview on version select via `handleSelectVersion`
- [ ] Mount `ConfirmDialog` for "Load in current view" warning
- [ ] Mount `SaveAsDialog` and `PublishConfirmDialog` (use `useObjectActions` hook for these)
- [ ] Export `VersionRecoveryDialogProps`

### Step 12: Replace `frontend/src/pages/designer/components/VersionHistoryDialog.tsx`
- [ ] Read the current file first (before editing)
- [ ] Verify current `VersionHistoryDialogProps` interface matches the wrapper interface above
- [ ] Replace file body with thin wrapper per section 7
- [ ] `export default function VersionHistoryDialog` — same name and default export
- [ ] Grep for the call site in `designer/index.tsx` to confirm exact props passed
- [ ] Verify `designer/index.tsx` requires no changes

### Step 13: Update barrel export
- [ ] Add `VersionRecoveryDialog` export to `frontend/src/shared/components/versioning/index.ts`
- [ ] Export `VersionRecoveryDialogProps` type

### Step 14: Build verification
- [ ] `cd /home/io/io-dev/io/frontend && pnpm build`
- [ ] Fix TypeScript errors (common issues: api.patch missing, SceneRenderer prop names, WorkspaceLayout shape)
- [ ] No unused import warnings
- [ ] `pnpm test` (if tests exist for affected components)

---

## 14. Acceptance Criteria

All of the following must be true before Task 6 is considered complete:

1. `pnpm build` passes from `frontend/` with zero TypeScript errors.

2. Eight new files exist:
   - `frontend/src/shared/types/versioning.ts`
   - `frontend/src/shared/components/versioning/VersionRecoveryDialog.tsx`
   - `frontend/src/shared/components/versioning/useVersionList.ts`
   - `frontend/src/shared/components/versioning/useVersionActions.ts`
   - `frontend/src/shared/components/versioning/VersionListPanel.tsx`
   - `frontend/src/shared/components/versioning/VersionPreviewPanel.tsx`
   - `frontend/src/shared/components/versioning/VersionStatsPanel.tsx`
   - `frontend/src/shared/components/versioning/VersionActionBar.tsx`

3. `frontend/src/pages/designer/components/VersionHistoryDialog.tsx` is a thin wrapper — its `VersionHistoryDialogProps` interface is unchanged, but the component body renders `VersionRecoveryDialog`.

4. `frontend/src/pages/designer/index.tsx` is not modified.

5. `frontend/src/api/graphics.ts` has updated version stubs using `versionNumber: number` (not `versionId: string`) and four new functions.

6. `frontend/src/api/console.ts` has seven new workspace version functions.

7. Opening the version history dialog in designer shows a version list for the current graphic.

8. Selecting a version loads a read-only `SceneRenderer` preview.

9. Clicking "Load in Current View" shows a confirmation dialog, then calls `onLoadVersion`.

10. Admin users see the "Show deleted" toggle, and can see soft-deleted versions in the list.

11. Admin users see "Recover" and "Permanently Delete…" buttons on soft-deleted versions.

12. The permanently delete flow requires two clicks (click → "Are you sure?" → confirm click).

13. Label editing: clicking on a version's label area enters inline edit mode; Enter saves, Escape cancels.

14. The barrel export `frontend/src/shared/components/versioning/index.ts` exports `VersionRecoveryDialog`.
