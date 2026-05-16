# Versioning Phase 5 — Frontend Shared Action Primitives

Detailed implementation plan for the `useObjectActions` hook and five confirmation dialogs. All backend endpoints (Tasks 1-4) are assumed complete.

**Architecture doc:** `docs/architecture/versioning-and-publishing.md`
**Parent plan:** `docs/plans/versioning-plan.md` (Task 5)

---

## 1. File Inventory

### New files

| File | Purpose |
|------|---------|
| `frontend/src/shared/hooks/useObjectActions.ts` | Generic hook for Save / Save As / Publish / Unpublish / Delete |
| `frontend/src/shared/components/versioning/SaveConfirmDialog.tsx` | "Save all changes?" confirmation with optional notes |
| `frontend/src/shared/components/versioning/SaveAsDialog.tsx` | Name input + optional notes for Save As |
| `frontend/src/shared/components/versioning/PublishConfirmDialog.tsx` | Publish explanation + optional notes |
| `frontend/src/shared/components/versioning/UnpublishConfirmDialog.tsx` | Unpublish warning |
| `frontend/src/shared/components/versioning/DeleteConfirmDialog.tsx` | Soft-delete warning |
| `frontend/src/shared/components/versioning/index.ts` | Barrel export |

### Files NOT modified in this phase

No existing files are modified. The hook and dialogs are standalone primitives. Task 8 (Integration) wires them into existing pages.

---

## 2. Hook API Spec — `useObjectActions`

### Location

`frontend/src/shared/hooks/useObjectActions.ts`

Convention: all shared hooks live in `frontend/src/shared/hooks/`. The file name follows the existing `use*.ts` pattern.

### TypeScript Types

```ts
import type { ApiResult } from '../../api/client';

// ── Input types ──────────────────────────────────────────────────────────

export type ObjectType = 'graphic' | 'workspace' | 'chart';

export interface UseObjectActionsOptions {
  objectType: ObjectType;
  objectId: string | null;
  /** Current object name — used for default label on save, and displayed in dialogs */
  objectName?: string;
  /** Called after a successful save. Receives the server response. */
  onSaveSuccess?: (result: unknown) => void;
  /** Called after a successful publish. */
  onPublishSuccess?: (result: unknown) => void;
  /** Called after a successful unpublish. */
  onUnpublishSuccess?: (result: unknown) => void;
  /** Called after a successful delete. */
  onDeleteSuccess?: () => void;
  /** Called after a successful Save As. Receives the new object's ID. */
  onSaveAsSuccess?: (newId: string) => void;
}

// ── Return type ──────────────────────────────────────────────────────────

export interface ObjectActions {
  /** Save current state + create version snapshot. Pass optional label (notes). */
  save: (opts?: { label?: string }) => Promise<boolean>;
  /** Save As — create a new independent object. Returns the new object ID on success, null on failure. */
  saveAs: (opts: { name: string; label?: string }) => Promise<string | null>;
  /** Publish — saves + sets published=true. Pass optional label. */
  publish: (opts?: { label?: string }) => Promise<boolean>;
  /** Unpublish — sets published=false. */
  unpublish: () => Promise<boolean>;
  /** Soft-delete the object. */
  delete: () => Promise<boolean>;

  // ── Per-action loading state ──
  isSaving: boolean;
  isSavingAs: boolean;
  isPublishing: boolean;
  isUnpublishing: boolean;
  isDeleting: boolean;
  /** True if any action is in flight */
  isBusy: boolean;

  // ── Per-action error state ──
  saveError: string | null;
  saveAsError: string | null;
  publishError: string | null;
  unpublishError: string | null;
  deleteError: string | null;
  /** Clear all error states */
  clearErrors: () => void;

  // ── Permission flags ──
  canSave: boolean;
  canSaveAs: boolean;
  canPublish: boolean;
  canUnpublish: boolean;
  canDelete: boolean;

  /** True if the objectId is an auto-save row (starts with `__autosave_`). All version actions are disabled. */
  isAutoSave: boolean;
}
```

### Internal Implementation Notes

The hook MUST:

1. **Read permissions from the auth store** using `useAuthStore` selector (not `usePermission` hook, since the hook needs multiple permissions in a single selector to avoid multiple re-renders):

```ts
const permissions = useAuthStore((s) => s.user?.permissions ?? []);
const userId = useAuthStore((s) => s.user?.id ?? null);
const has = (p: string) => permissions.includes(p);
```

2. **Detect auto-save rows** and disable all actions:

```ts
const isAutoSave = objectId?.startsWith('__autosave_') ?? false;
```

3. **Route API calls by objectType** using a dispatcher pattern (not three separate hooks):

```ts
// Internal helper — routes to the correct API
async function dispatchSave(
  objectType: ObjectType,
  objectId: string,
  opts?: { label?: string },
): Promise<ApiResult<unknown>> {
  switch (objectType) {
    case 'graphic':
      // graphicsApi.update already triggers backend version snapshot (Task 2)
      // The label param is sent as part of the update payload
      return graphicsApi.update(objectId, { label: opts?.label });
    case 'workspace':
      // consoleApi.saveWorkspace triggers backend version snapshot (Task 3)
      // TODO Task 8: consoleApi needs label pass-through
      return consoleApi.saveWorkspace({ id: objectId, label: opts?.label } as any);
    case 'chart':
      return savedChartsApi.update(objectId, { label: opts?.label } as any);
  }
}
```

   Similar dispatchers for `dispatchPublish`, `dispatchUnpublish`, `dispatchDelete`, `dispatchSaveAs`.

4. **Use `useCallback` for all returned action functions** to maintain referential stability.

5. **Manage loading/error state with `useState`** (not `useReducer` — keep it simple, matches existing hook patterns in the codebase).

6. **Never throw** — all action functions return `Promise<boolean>` (success/failure). Errors are captured in the error state fields. Consumers read `saveError` etc. to display inline errors in dialogs.

---

## 3. Permission Mapping

Permissions are read from `useAuthStore(s => s.user?.permissions)`. The JWT carries these as string arrays.

### Graphic permissions (from design-docs/03)

| Action | Permission | Constant |
|--------|-----------|----------|
| Save | `designer:write` | `canSave` |
| Save As | `designer:write` | `canSaveAs` |
| Publish | `designer:publish` | `canPublish` |
| Unpublish | `designer:publish` | `canUnpublish` |
| Delete | `designer:delete` | `canDelete` |

### Workspace permissions (from design-docs/03)

| Action | Permission | Constant |
|--------|-----------|----------|
| Save | `console:write` | `canSave` |
| Save As | `console:write` | `canSaveAs` |
| Publish | `console:workspace_publish` | `canPublish` |
| Unpublish | `console:workspace_publish` | `canUnpublish` |
| Delete | `console:workspace_delete` | `canDelete` |

### Chart permissions

Charts share console permissions since they live in the console module:

| Action | Permission | Constant |
|--------|-----------|----------|
| Save | `console:write` | `canSave` |
| Save As | `console:write` | `canSaveAs` |
| Publish | `console:workspace_publish` | `canPublish` |
| Unpublish | `console:workspace_publish` | `canUnpublish` |
| Delete | `console:workspace_delete` | `canDelete` |

### Implementation

```ts
function getPermissions(objectType: ObjectType, has: (p: string) => boolean) {
  switch (objectType) {
    case 'graphic':
      return {
        canSave: has('designer:write'),
        canSaveAs: has('designer:write'),
        canPublish: has('designer:publish'),
        canUnpublish: has('designer:publish'),
        canDelete: has('designer:delete'),
      };
    case 'workspace':
      return {
        canSave: has('console:write'),
        canSaveAs: has('console:write'),
        canPublish: has('console:workspace_publish'),
        canUnpublish: has('console:workspace_publish'),
        canDelete: has('console:workspace_delete'),
      };
    case 'chart':
      return {
        canSave: has('console:write'),
        canSaveAs: has('console:write'),
        canPublish: has('console:workspace_publish'),
        canUnpublish: has('console:workspace_publish'),
        canDelete: has('console:workspace_delete'),
      };
  }
}
```

When `isAutoSave` is true, ALL `can*` flags are forced to `false`.

---

## 4. Dialog Prop Interfaces

All five dialogs follow the same controlled-component pattern established by `ConfirmDialog.tsx` (`frontend/src/shared/components/ConfirmDialog.tsx`). They all use `@radix-ui/react-dialog` for the modal primitive.

### 4.1 SaveConfirmDialog

```ts
export interface SaveConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called with the optional label/notes text when user confirms. */
  onConfirm: (opts: { label?: string }) => void;
  /** True while the save API call is in flight. Disables buttons + shows spinner. */
  loading?: boolean;
  /** Error message from the last failed save attempt. Shown inline below the form. */
  error?: string | null;
  /** The object name, shown in the dialog title ("Save Workspace X?") */
  objectName?: string;
}
```

**UI layout:**
- Title: "Save changes?" (or "Save changes to {objectName}?" if objectName provided)
- Description: "This will create a new version snapshot."
- Optional textarea: "Notes (optional)" — maps to the `label` field on the version
- Error banner: red text below the textarea, shown only when `error` is non-null
- Footer buttons: Cancel (secondary) | Save (accent, `var(--io-accent)`)
- When `loading` is true: Save button shows a spinner and is disabled; Cancel is also disabled

### 4.2 SaveAsDialog

```ts
export interface SaveAsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called with the new name and optional notes when user confirms. */
  onConfirm: (opts: { name: string; label?: string }) => void;
  loading?: boolean;
  error?: string | null;
  /** Pre-fill suggestion for the name field (e.g., "Copy of {original}") */
  defaultName?: string;
}
```

**UI layout:**
- Title: "Save As"
- Text input: "Name" (required, auto-focused, pre-filled with `defaultName` if provided)
- Optional textarea: "Notes (optional)"
- Name validation: if empty, show inline "Name is required" and disable confirm button
- Error banner: same pattern as SaveConfirmDialog
- Footer buttons: Cancel | Save As (accent)
- Loading state: same pattern

### 4.3 PublishConfirmDialog

```ts
export interface PublishConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called with optional notes when user confirms. */
  onConfirm: (opts: { label?: string }) => void;
  loading?: boolean;
  error?: string | null;
  objectName?: string;
}
```

**UI layout:**
- Title: "Publish {objectName}?"
- Description: "Publishing makes this object visible to all users with module access. A version snapshot will be created automatically."
- Optional textarea: "Notes (optional)"
- Error banner
- Footer buttons: Cancel | Publish (accent)
- Loading state: same pattern

### 4.4 UnpublishConfirmDialog

```ts
export interface UnpublishConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  loading?: boolean;
  error?: string | null;
  objectName?: string;
}
```

**UI layout:**
- Title: "Unpublish {objectName}?"
- Description: "This object will no longer be visible to other users. Only you and administrators will be able to see it."
- No notes field (unpublish does not create a version snapshot)
- Error banner
- Footer buttons: Cancel | Unpublish (danger variant — `var(--io-danger)` border + text, matching `ConfirmDialog` danger style)
- Loading state: same pattern

### 4.5 DeleteConfirmDialog

```ts
export interface DeleteConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  loading?: boolean;
  error?: string | null;
  objectName?: string;
}
```

**UI layout:**
- Title: "Delete {objectName}?"
- Description: "This object will be soft-deleted and can be recovered by an administrator. All version history will be preserved."
- No notes field
- Error banner
- Footer buttons: Cancel | Delete (danger variant)
- Loading state: same pattern

---

## 5. Visual Pattern Reference

All dialogs MUST match the existing `ConfirmDialog.tsx` visual pattern exactly. Key style tokens (from the existing component):

- **Overlay:** `position: fixed; inset: 0; background: var(--io-overlay, rgba(0,0,0,0.5)); zIndex: 100`
- **Content:** `position: fixed; top: 50%; left: 50%; transform: translate(-50%,-50%); background: var(--io-surface-secondary); border: 1px solid var(--io-border); borderRadius: 10px; padding: 24px; width: 420px; maxWidth: calc(100vw - 32px); zIndex: 101`
- **Title:** `fontSize: 16px; fontWeight: 600; color: var(--io-text-primary)`
- **Description:** `fontSize: 13px; color: var(--io-text-secondary); lineHeight: 1.5`
- **Cancel button:** `padding: 8px 16px; background: transparent; color: var(--io-text-secondary); border: 1px solid var(--io-border); borderRadius: var(--io-radius); fontSize: 13px`
- **Confirm button (default/accent):** `padding: 8px 16px; background: var(--io-accent); color: var(--io-text-on-accent); border: none; borderRadius: var(--io-radius); fontSize: 13px; fontWeight: 600`
- **Confirm button (danger):** `background: transparent; color: var(--io-danger); border: 1px solid var(--io-danger)`
- **Textarea (notes):** `width: 100%; minHeight: 60px; padding: 8px; fontSize: 13px; background: var(--io-surface-primary, var(--io-surface)); border: 1px solid var(--io-border); borderRadius: var(--io-radius); color: var(--io-text-primary); resize: vertical; fontFamily: inherit`
- **Text input (name):** Same as textarea but `minHeight: unset`
- **Error text:** `fontSize: 12px; color: var(--io-danger); marginTop: 8px`
- **Loading spinner on button:** Use the same CSS spinner pattern from `PermissionGuard.tsx` (`LoadingSpinner`), scaled down to 14px for inline use

All dialogs use `@radix-ui/react-dialog` (Dialog.Root, Dialog.Portal, Dialog.Overlay, Dialog.Content, Dialog.Title, Dialog.Description). This matches the existing `ConfirmDialog` and `ExportDialog`.

---

## 6. Implementation Steps

Execute these steps in order. Each step produces a verifiable artifact.

### Step 1: Create the versioning directory

Create `frontend/src/shared/components/versioning/` directory.

### Step 2: Implement SaveConfirmDialog

Create `frontend/src/shared/components/versioning/SaveConfirmDialog.tsx`.

- Import `* as Dialog from '@radix-ui/react-dialog'` and `React, { useState }`
- Implement the `SaveConfirmDialogProps` interface from section 4.1
- Internal state: `notesValue` (string, textarea value)
- On confirm: call `onConfirm({ label: notesValue.trim() || undefined })`
- Reset `notesValue` to `''` when `open` changes to `true` (use `useEffect`)
- When `loading` is true, disable both buttons and show a 14px CSS spinner next to the Save button text
- When `error` is non-null, show it as red text below the textarea
- Match all styles from section 5

### Step 3: Implement SaveAsDialog

Create `frontend/src/shared/components/versioning/SaveAsDialog.tsx`.

- Import same dependencies as Step 2
- Internal state: `nameValue` (string), `notesValue` (string)
- Initialize `nameValue` from `defaultName` prop when `open` changes to `true`
- Disable confirm button when `nameValue.trim()` is empty
- On confirm: call `onConfirm({ name: nameValue.trim(), label: notesValue.trim() || undefined })`
- Auto-focus the name input on open (use `autoFocus` prop on the input element)
- Show inline validation "Name is required" below the name input when the user has interacted and the field is empty (track `touched` state)

### Step 4: Implement PublishConfirmDialog

Create `frontend/src/shared/components/versioning/PublishConfirmDialog.tsx`.

- Same pattern as SaveConfirmDialog but with publish-specific copy
- Internal state: `notesValue` (string)
- On confirm: call `onConfirm({ label: notesValue.trim() || undefined })`

### Step 5: Implement UnpublishConfirmDialog

Create `frontend/src/shared/components/versioning/UnpublishConfirmDialog.tsx`.

- Simpler — no notes field
- Uses danger variant button styling
- On confirm: call `onConfirm()`

### Step 6: Implement DeleteConfirmDialog

Create `frontend/src/shared/components/versioning/DeleteConfirmDialog.tsx`.

- Same pattern as UnpublishConfirmDialog
- Uses danger variant button styling
- Different copy: soft-delete warning text

### Step 7: Create barrel export

Create `frontend/src/shared/components/versioning/index.ts`:

```ts
export { SaveConfirmDialog } from './SaveConfirmDialog';
export type { SaveConfirmDialogProps } from './SaveConfirmDialog';

export { SaveAsDialog } from './SaveAsDialog';
export type { SaveAsDialogProps } from './SaveAsDialog';

export { PublishConfirmDialog } from './PublishConfirmDialog';
export type { PublishConfirmDialogProps } from './PublishConfirmDialog';

export { UnpublishConfirmDialog } from './UnpublishConfirmDialog';
export type { UnpublishConfirmDialogProps } from './UnpublishConfirmDialog';

export { DeleteConfirmDialog } from './DeleteConfirmDialog';
export type { DeleteConfirmDialogProps } from './DeleteConfirmDialog';
```

### Step 8: Implement useObjectActions hook

Create `frontend/src/shared/hooks/useObjectActions.ts`.

This is the most complex piece. Implementation structure:

```ts
import { useState, useCallback, useMemo } from 'react';
import { useAuthStore } from '../../store/auth';
import { graphicsApi } from '../../api/graphics';
import { consoleApi } from '../../api/console';
import { savedChartsApi } from '../../api/savedCharts';
import type { ApiResult } from '../../api/client';

// ── Types (export all from section 2) ──

// ── Permission mapping (from section 3) ──

// ── API dispatch helpers ──

// Each helper takes objectType + objectId + action-specific args
// and routes to the correct API call. Returns ApiResult<unknown>.

async function dispatchSave(
  objectType: ObjectType,
  objectId: string,
  _opts?: { label?: string },
): Promise<ApiResult<unknown>> {
  switch (objectType) {
    case 'graphic':
      // Backend auto-creates version snapshot on update (Task 2).
      // The label will be passed through once the update endpoint
      // accepts it — for now this is a stub placeholder.
      return graphicsApi.update(objectId, {});
    case 'workspace': {
      // Console save triggers backend version snapshot (Task 3).
      // The workspace save expects a full WorkspaceLayout object.
      // The hook caller must have already updated the workspace in
      // the workspace store before calling save(). We fetch the
      // current workspace state from the API and re-save it.
      //
      // NOTE: This is a simplified dispatch. Task 8 will refine the
      // integration to pass the full workspace payload.
      return consoleApi.saveWorkspace({ id: objectId } as any);
    }
    case 'chart':
      return savedChartsApi.update(objectId, {});
  }
}

async function dispatchSaveAs(
  objectType: ObjectType,
  opts: { name: string; label?: string },
): Promise<ApiResult<unknown>> {
  switch (objectType) {
    case 'graphic':
      // Create a brand-new design object. The caller (Task 8)
      // will need to pass scene_data from the current scene store.
      // For now, the hook accepts a name; the integration layer
      // will supply the full payload.
      return graphicsApi.create({ name: opts.name, scene_data: {} as any });
    case 'workspace':
      return consoleApi.saveWorkspace({ name: opts.name } as any);
    case 'chart':
      return savedChartsApi.create({
        name: opts.name,
        chart_type: 0,
        config: {} as any,
      });
  }
}

async function dispatchPublish(
  objectType: ObjectType,
  objectId: string,
  _opts?: { label?: string },
): Promise<ApiResult<unknown>> {
  switch (objectType) {
    case 'graphic':
      return graphicsApi.publishGraphic(objectId);
    case 'workspace':
      return consoleApi.publishWorkspace(objectId, true);
    case 'chart':
      return savedChartsApi.publish(objectId);
  }
}

async function dispatchUnpublish(
  objectType: ObjectType,
  objectId: string,
): Promise<ApiResult<unknown>> {
  switch (objectType) {
    case 'graphic':
      // Task 2 added an unpublish endpoint.
      // graphicsApi needs an unpublishGraphic function.
      // For now, stub to the existing API shape:
      return (graphicsApi as any).unpublishGraphic?.(objectId)
        ?? { success: false, error: { code: 'NOT_IMPLEMENTED', message: 'Unpublish not yet wired' } };
    case 'workspace':
      return consoleApi.publishWorkspace(objectId, false);
    case 'chart':
      return savedChartsApi.unpublish(objectId);
  }
}

async function dispatchDelete(
  objectType: ObjectType,
  objectId: string,
): Promise<ApiResult<unknown>> {
  switch (objectType) {
    case 'graphic':
      return graphicsApi.remove(objectId);
    case 'workspace':
      return consoleApi.deleteWorkspace(objectId);
    case 'chart':
      return savedChartsApi.remove(objectId);
  }
}

// ── Hook ──

export function useObjectActions(options: UseObjectActionsOptions): ObjectActions {
  const { objectType, objectId, onSaveSuccess, onPublishSuccess,
          onUnpublishSuccess, onDeleteSuccess, onSaveAsSuccess } = options;

  // Permissions
  const permissions = useAuthStore((s) => s.user?.permissions ?? []);
  const has = useCallback((p: string) => permissions.includes(p), [permissions]);

  const isAutoSave = objectId?.startsWith('__autosave_') ?? false;

  const perms = useMemo(
    () => {
      if (isAutoSave || !objectId) {
        return {
          canSave: false, canSaveAs: false,
          canPublish: false, canUnpublish: false, canDelete: false,
        };
      }
      return getPermissions(objectType, has);
    },
    [objectType, has, isAutoSave, objectId],
  );

  // Loading states
  const [isSaving, setIsSaving] = useState(false);
  const [isSavingAs, setIsSavingAs] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isUnpublishing, setIsUnpublishing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Error states
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveAsError, setSaveAsError] = useState<string | null>(null);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [unpublishError, setUnpublishError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const clearErrors = useCallback(() => {
    setSaveError(null);
    setSaveAsError(null);
    setPublishError(null);
    setUnpublishError(null);
    setDeleteError(null);
  }, []);

  const isBusy = isSaving || isSavingAs || isPublishing || isUnpublishing || isDeleting;

  // ── Action implementations ──

  const save = useCallback(async (opts?: { label?: string }): Promise<boolean> => {
    if (!objectId || isAutoSave || !perms.canSave || isBusy) return false;
    setIsSaving(true);
    setSaveError(null);
    try {
      const result = await dispatchSave(objectType, objectId, opts);
      if (result.success) {
        onSaveSuccess?.(result.data);
        return true;
      }
      setSaveError((result as any).error?.message ?? 'Save failed');
      return false;
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Save failed');
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [objectId, objectType, isAutoSave, perms.canSave, isBusy, onSaveSuccess]);

  // saveAs, publish, unpublish, delete follow the same pattern
  // (see full implementation details above — each uses the
  // corresponding dispatch function and loading/error state pair)

  return {
    save, saveAs, publish, unpublish, delete: deleteAction,
    isSaving, isSavingAs, isPublishing, isUnpublishing, isDeleting, isBusy,
    saveError, saveAsError, publishError, unpublishError, deleteError,
    clearErrors,
    ...perms,
    isAutoSave,
  };
}
```

Key implementation details for the `saveAs` action specifically:

```ts
const saveAs = useCallback(async (opts: { name: string; label?: string }): Promise<string | null> => {
  if (isAutoSave || !perms.canSaveAs || isBusy) return null;
  setIsSavingAs(true);
  setSaveAsError(null);
  try {
    const result = await dispatchSaveAs(objectType, opts);
    if (result.success) {
      const newId = (result.data as any)?.id ?? (result.data as any)?.data?.id;
      onSaveAsSuccess?.(newId);
      return newId;
    }
    setSaveAsError((result as any).error?.message ?? 'Save As failed');
    return null;
  } catch (e) {
    setSaveAsError(e instanceof Error ? e.message : 'Save As failed');
    return null;
  } finally {
    setIsSavingAs(false);
  }
}, [objectType, isAutoSave, perms.canSaveAs, isBusy, onSaveAsSuccess]);
```

### Step 9: Update barrel export to include hook

Add to `frontend/src/shared/components/versioning/index.ts`:

```ts
export { useObjectActions } from '../../hooks/useObjectActions';
export type { ObjectActions, ObjectType, UseObjectActionsOptions } from '../../hooks/useObjectActions';
```

This allows consumers to import everything from one place:
```ts
import { useObjectActions, SaveConfirmDialog, PublishConfirmDialog } from '@/shared/components/versioning';
```

### Step 10: Verify build

Run `cd /home/io/io-dev/io/frontend && pnpm build` to verify:
- No TypeScript errors
- No import resolution failures
- No unused export warnings

If `pnpm build` fails due to unused imports in the dispatch helpers (because Task 8 hasn't wired them yet), that is acceptable — the dispatchers reference `graphicsApi`, `consoleApi`, and `savedChartsApi` which all exist. The only potential issue is if the API functions don't accept the exact parameter shapes used. Fix any type mismatches against the actual API signatures.

---

## 7. Tricky Parts — Detailed Pseudocode

### 7.1 The dispatch layer needs Task 8 refinement

The `dispatchSave` for workspaces and graphics is intentionally simplified in this phase. The hook's `save()` function signals "save this object" but the actual payload assembly (reading the current scene_data from sceneStore, or the current workspace layout from workspaceStore) happens at the integration layer in Task 8.

**Pattern for Task 8:** The consuming component will call:

```ts
// In designer/index.tsx (Task 8):
const actions = useObjectActions({
  objectType: 'graphic',
  objectId: graphicId,
  onSaveSuccess: () => { markClean(); historyMarkClean(); },
});

// The existing handleSave already does graphicsApi.update(id, { name, scene_data })
// Task 8 will refactor handleSave to:
// 1. Call graphicsApi.update (with payload from sceneStore) directly
// 2. Call actions.save({ label }) for the version snapshot part
// OR:
// 1. Pass a custom save implementation via the hook options
```

To support this cleanly, the hook should accept an **optional override** for the save dispatch:

```ts
export interface UseObjectActionsOptions {
  // ... existing fields ...
  /** Override the default save dispatch. When provided, the hook calls this
   *  instead of the built-in API dispatcher. The override receives the label
   *  and must return an ApiResult. */
  onSaveOverride?: (opts: { label?: string }) => Promise<ApiResult<unknown>>;
  /** Override for Save As dispatch. */
  onSaveAsOverride?: (opts: { name: string; label?: string }) => Promise<ApiResult<unknown>>;
}
```

This way, designer can pass its own save function that reads from sceneStore:

```ts
const actions = useObjectActions({
  objectType: 'graphic',
  objectId: graphicId,
  onSaveOverride: async ({ label }) => {
    const doc = useSceneStore.getState().doc;
    return graphicsApi.update(graphicId!, { name: doc.name, scene_data: doc, label });
  },
});
```

### 7.2 Dialog loading/error wiring pattern

Each dialog receives `loading` and `error` directly from the hook's state. The consuming component wires them like:

```tsx
// Example: SaveConfirmDialog wired to useObjectActions
const [showSaveDialog, setShowSaveDialog] = useState(false);
const actions = useObjectActions({ objectType: 'graphic', objectId: graphicId });

<SaveConfirmDialog
  open={showSaveDialog}
  onOpenChange={(open) => {
    setShowSaveDialog(open);
    if (!open) actions.clearErrors();
  }}
  onConfirm={async ({ label }) => {
    const ok = await actions.save({ label });
    if (ok) setShowSaveDialog(false);
    // If !ok, dialog stays open showing the error from actions.saveError
  }}
  loading={actions.isSaving}
  error={actions.saveError}
  objectName={doc?.name}
/>
```

### 7.3 Loading spinner inline in buttons

Use a CSS animation spinner (matching the existing codebase pattern from `PermissionGuard.tsx`), scaled to 14px:

```tsx
function InlineSpinner() {
  return (
    <span
      style={{
        display: 'inline-block',
        width: 14,
        height: 14,
        border: '2px solid currentColor',
        borderTopColor: 'transparent',
        borderRadius: '50%',
        animation: 'io-spin 0.7s linear infinite',
        verticalAlign: 'middle',
        marginRight: 6,
      }}
    />
  );
}
```

The `@keyframes io-spin` is already globally defined by the `LoadingSpinner` component in `PermissionGuard.tsx`, so no additional `<style>` tag is needed. However, to be safe (in case the dialog renders before PermissionGuard mounts), include the keyframe in the dialog module:

```tsx
// At the top of each dialog file that uses InlineSpinner:
const spinKeyframes = `@keyframes io-spin { to { transform: rotate(360deg); } }`;
// Render: <style>{spinKeyframes}</style> inside the Dialog.Content
```

---

## 8. Acceptance Criteria

All of the following must be true before Task 5 is considered complete:

1. **`pnpm build` passes** from `frontend/` with zero TypeScript errors.

2. **Seven new files exist:**
   - `frontend/src/shared/hooks/useObjectActions.ts`
   - `frontend/src/shared/components/versioning/SaveConfirmDialog.tsx`
   - `frontend/src/shared/components/versioning/SaveAsDialog.tsx`
   - `frontend/src/shared/components/versioning/PublishConfirmDialog.tsx`
   - `frontend/src/shared/components/versioning/UnpublishConfirmDialog.tsx`
   - `frontend/src/shared/components/versioning/DeleteConfirmDialog.tsx`
   - `frontend/src/shared/components/versioning/index.ts`

3. **Barrel export works:** The following import resolves without error:
   ```ts
   import {
     useObjectActions,
     SaveConfirmDialog,
     SaveAsDialog,
     PublishConfirmDialog,
     UnpublishConfirmDialog,
     DeleteConfirmDialog,
   } from '../shared/components/versioning';
   ```

4. **Hook types are complete:** `useObjectActions` accepts `UseObjectActionsOptions` and returns `ObjectActions` with all fields from section 2.

5. **Permission mapping is correct:** The hook checks the correct permission strings per object type (section 3).

6. **Auto-save guard works:** When `objectId` starts with `__autosave_`, `isAutoSave` is `true` and all `can*` flags are `false`.

7. **All dialogs are controlled components:** Each accepts `open`, `onOpenChange`/`onClose`, `onConfirm`, `loading`, `error` props.

8. **All dialogs use Radix Dialog:** Imported as `* as Dialog from '@radix-ui/react-dialog'`.

9. **No existing files modified:** This phase creates only new files.

---

## 9. Integration Sketch — Task 8 Wiring Points

This section documents WHERE Task 8 will wire these primitives. DO NOT implement any of this in Task 5.

### 9.1 Designer (`frontend/src/pages/designer/index.tsx`)

**Hook instantiation** (~line 950, near existing state declarations):

```ts
const actions = useObjectActions({
  objectType: 'graphic',
  objectId: graphicId,
  objectName: doc?.name,
  onSaveOverride: async ({ label }) => {
    // Existing handleSave logic refactored to use the label param
    const currentDoc = useSceneStore.getState().doc;
    return graphicsApi.update(graphicId!, { name: currentDoc.name, scene_data: currentDoc, label });
  },
  onSaveSuccess: () => { markClean(); historyMarkClean(); /* autosave cleanup */ },
  onPublishSuccess: () => { setShowVersionHistory(true); },
  onDeleteSuccess: () => { navigate('/designer'); },
  onSaveAsSuccess: (newId) => { navigate(`/designer/${newId}`); },
});
```

**Dialog additions** (near existing ConfirmDialog instances, ~line 3230):

```tsx
<SaveConfirmDialog
  open={showSaveDialog}
  onOpenChange={setShowSaveDialog}
  onConfirm={({ label }) => actions.save({ label }).then(ok => ok && setShowSaveDialog(false))}
  loading={actions.isSaving}
  error={actions.saveError}
  objectName={doc?.name}
/>
<PublishConfirmDialog
  open={showPublishDialog}
  onOpenChange={setShowPublishDialog}
  onConfirm={({ label }) => actions.publish({ label }).then(ok => ok && setShowPublishDialog(false))}
  loading={actions.isPublishing}
  error={actions.publishError}
  objectName={doc?.name}
/>
// ... etc for SaveAs, Unpublish, Delete
```

**Toolbar wiring** (`DesignerToolbar` props, ~line 3254):

- `onSave` changes from `handleExplicitSave` to `() => setShowSaveDialog(true)` (opens dialog instead of saving directly)
- `onPublish` changes from `handlePublish` to `() => setShowPublishDialog(true)`
- `onDelete` changes to `() => setShowDeleteDialog(true)` and uses the new `DeleteConfirmDialog`
- New button: "Save As" in the toolbar menu, opens `SaveAsDialog`
- Permission flags from the hook gate button visibility: `actions.canPublish`, `actions.canDelete`, etc.

### 9.2 Console workspaces (`frontend/src/pages/console/index.tsx`)

**Hook instantiation** (~line 470, after permission checks):

```ts
const actions = useObjectActions({
  objectType: 'workspace',
  objectId: activeId,
  objectName: activeWorkspace?.name,
  onSaveOverride: async ({ label }) => {
    const ws = useWorkspaceStore.getState().workspaces.find(w => w.id === activeId);
    if (!ws) return { success: false, error: { code: 'NOT_FOUND', message: 'Workspace not found' } };
    return consoleApi.saveWorkspace({ ...ws, label } as any);
  },
  onSaveSuccess: () => { showToast({ title: 'Workspace saved', variant: 'success' }); },
  onDeleteSuccess: () => { doCloseWorkspace(activeId!); },
});
```

**Where dialogs attach:**
- Publish toggle button (~line 2220) changes to open `PublishConfirmDialog` / `UnpublishConfirmDialog` instead of calling `publishMutation.mutate()` directly
- "Save As Personal" button (~line 2370) opens `SaveAsDialog` instead of calling `handleSaveAsPersonal` directly
- Workspace context menu "Delete" item opens `DeleteConfirmDialog`

### 9.3 Chart config context (`frontend/src/pages/console/ConsolePalette.tsx` + chart config dialogs)

**Hook instantiation** (inside chart config dialog or PaneConfigModal):

```ts
const actions = useObjectActions({
  objectType: 'chart',
  objectId: selectedChartId,
  objectName: selectedChart?.name,
  onSaveSuccess: () => { useSavedChartsStore.getState().fetchCharts(); },
  onDeleteSuccess: () => { useSavedChartsStore.getState().fetchCharts(); },
});
```

**Where dialogs attach:**
- Chart palette context menu items: Save, Publish/Unpublish, Delete
- Chart config modal "Save" button opens `SaveConfirmDialog`
- Chart config modal "Save As" button opens `SaveAsDialog`

---

## 10. Dependencies and Assumptions

1. **`@radix-ui/react-dialog` is already installed.** Verified: `ConfirmDialog.tsx` and `ExportDialog.tsx` import it.

2. **All API endpoints from Tasks 2-4 exist and are functional.** The hook dispatches to:
   - `graphicsApi.update`, `graphicsApi.create`, `graphicsApi.remove`, `graphicsApi.publishGraphic` (existing)
   - `graphicsApi.unpublishGraphic` (added by Task 2 — if missing, add stub: `unpublishGraphic: (id: string) => api.post(\`/api/v1/design-objects/${id}/unpublish\`, {})`)
   - `consoleApi.saveWorkspace`, `consoleApi.publishWorkspace`, `consoleApi.deleteWorkspace` (existing)
   - `savedChartsApi.create`, `savedChartsApi.update`, `savedChartsApi.remove`, `savedChartsApi.publish`, `savedChartsApi.unpublish` (added by Task 4, confirmed in `frontend/src/api/savedCharts.ts`)

3. **If `graphicsApi.unpublishGraphic` does not exist in `frontend/src/api/graphics.ts`**, the implementation agent must add it as part of Step 8:
   ```ts
   unpublishGraphic: (id: string) =>
     api.post<{ data: { published: boolean } }>(
       `/api/v1/design-objects/${id}/unpublish`,
       {},
     ),
   ```
   This is the only modification to an existing file that may be needed.

4. **The `label` parameter on save/publish endpoints.** Tasks 2-3 updated the backend to accept an optional `label` in the request body. The frontend API functions may not yet pass this through. Task 8 will handle updating the API function signatures if needed. The hook implementation should pass `label` in the request body regardless; if the backend ignores it, no harm done.
