import { useCallback, useMemo, useRef, useState } from "react";
import { useAuthStore } from "../../store/auth";
import { graphicsApi } from "../../api/graphics";
import { consoleApi } from "../../api/console";
import { savedChartsApi } from "../../api/savedCharts";
import type { ApiResult } from "../../api/client";

// ── Types ─────────────────────────────────────────────────────────────────────

export type ObjectType = "graphic" | "workspace" | "chart";

export interface UseObjectActionsOptions {
  objectType: ObjectType;
  objectId: string | null;
  objectName?: string;
  onSaveSuccess?: (result: unknown) => void;
  onPublishSuccess?: (result: unknown) => void;
  onUnpublishSuccess?: (result: unknown) => void;
  onDeleteSuccess?: () => void;
  onSaveAsSuccess?: (newId: string) => void;
  /**
   * Override the built-in save dispatch. When provided, called instead of the
   * default API stub. Task 8 uses this to pass the real scene_data/workspace
   * payload from the relevant store.
   */
  onSaveOverride?: (opts: {
    label?: string;
  }) => Promise<ApiResult<unknown>>;
  /**
   * Override the built-in Save As dispatch. Task 8 uses this to supply the
   * full object payload for the new copy.
   */
  onSaveAsOverride?: (opts: {
    name: string;
    label?: string;
  }) => Promise<ApiResult<unknown>>;
}

export interface ObjectActions {
  save: (opts?: { label?: string }) => Promise<boolean>;
  saveAs: (opts: { name: string; label?: string }) => Promise<string | null>;
  publish: (opts?: { label?: string }) => Promise<boolean>;
  unpublish: () => Promise<boolean>;
  delete: () => Promise<boolean>;

  isSaving: boolean;
  isSavingAs: boolean;
  isPublishing: boolean;
  isUnpublishing: boolean;
  isDeleting: boolean;
  isBusy: boolean;

  saveError: string | null;
  saveAsError: string | null;
  publishError: string | null;
  unpublishError: string | null;
  deleteError: string | null;
  clearErrors: () => void;

  canSave: boolean;
  canSaveAs: boolean;
  canPublish: boolean;
  canUnpublish: boolean;
  canDelete: boolean;

  isAutoSave: boolean;
}

// ── Permission mapping ────────────────────────────────────────────────────────

interface PermFlags {
  canSave: boolean;
  canSaveAs: boolean;
  canPublish: boolean;
  canUnpublish: boolean;
  canDelete: boolean;
}

function getPermissions(
  objectType: ObjectType,
  has: (p: string) => boolean,
): PermFlags {
  switch (objectType) {
    case "graphic":
      return {
        canSave: has("designer:write"),
        canSaveAs: has("designer:write"),
        canPublish: has("designer:publish"),
        canUnpublish: has("designer:publish"),
        canDelete: has("designer:delete"),
      };
    case "workspace":
      return {
        canSave: has("console:write"),
        canSaveAs: has("console:write"),
        canPublish: has("console:workspace_publish"),
        canUnpublish: has("console:workspace_publish"),
        canDelete: has("console:workspace_delete"),
      };
    case "chart":
      return {
        canSave: has("console:write"),
        canSaveAs: has("console:write"),
        canPublish: has("console:workspace_publish"),
        canUnpublish: has("console:workspace_publish"),
        canDelete: has("console:workspace_delete"),
      };
  }
}

const NO_PERMS: PermFlags = {
  canSave: false,
  canSaveAs: false,
  canPublish: false,
  canUnpublish: false,
  canDelete: false,
};

// ── Built-in API dispatchers ──────────────────────────────────────────────────
// These are intentional stubs for Task 5. Task 8 will supply onSaveOverride
// and onSaveAsOverride with real payloads from the relevant stores.

async function dispatchSave(
  objectType: ObjectType,
  objectId: string,
): Promise<ApiResult<unknown>> {
  switch (objectType) {
    case "graphic":
      return graphicsApi.update(objectId, {});
    case "workspace": {
      const ws = await consoleApi.getWorkspace(objectId);
      if (!ws.success) return ws;
      return consoleApi.saveWorkspace(ws.data);
    }
    case "chart":
      return savedChartsApi.update(objectId, {});
  }
}

async function dispatchSaveAs(
  objectType: ObjectType,
  opts: { name: string; label?: string },
): Promise<ApiResult<unknown>> {
  switch (objectType) {
    case "graphic":
      return graphicsApi.create({
        name: opts.name,
        scene_data: {} as never,
      });
    case "workspace":
      return consoleApi.saveWorkspace({ name: opts.name, layout: "2x2", panes: [] });
    case "chart":
      return savedChartsApi.create({
        name: opts.name,
        chart_type: 0,
        config: {} as never,
      });
  }
}

async function dispatchPublish(
  objectType: ObjectType,
  objectId: string,
): Promise<ApiResult<unknown>> {
  switch (objectType) {
    case "graphic":
      return graphicsApi.publishGraphic(objectId);
    case "workspace":
      return consoleApi.publishWorkspace(objectId, true);
    case "chart":
      return savedChartsApi.publish(objectId);
  }
}

async function dispatchUnpublish(
  objectType: ObjectType,
  objectId: string,
): Promise<ApiResult<unknown>> {
  switch (objectType) {
    case "graphic":
      return graphicsApi.unpublishGraphic(objectId);
    case "workspace":
      return consoleApi.publishWorkspace(objectId, false);
    case "chart":
      return savedChartsApi.unpublish(objectId);
  }
}

async function dispatchDelete(
  objectType: ObjectType,
  objectId: string,
): Promise<ApiResult<unknown>> {
  switch (objectType) {
    case "graphic":
      return graphicsApi.remove(objectId);
    case "workspace":
      return consoleApi.deleteWorkspace(objectId);
    case "chart":
      return savedChartsApi.remove(objectId);
  }
}

function extractError(result: ApiResult<unknown>): string {
  if (!result.success) {
    return result.error.message || "Operation failed";
  }
  return "Operation failed";
}

function extractNewId(result: ApiResult<unknown>): string {
  if (!result.success) return "";
  const d = result.data as Record<string, unknown> | null;
  if (!d) return "";
  // graphics.ts: api.post<{ id: string }> → data.id
  if (typeof d.id === "string") return d.id;
  // workspaces: WorkspaceLayout → data.id
  return "";
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useObjectActions(options: UseObjectActionsOptions): ObjectActions {
  const {
    objectType,
    objectId,
    onSaveSuccess,
    onPublishSuccess,
    onUnpublishSuccess,
    onDeleteSuccess,
    onSaveAsSuccess,
    onSaveOverride,
    onSaveAsOverride,
  } = options;

  const permissions = useAuthStore((s) => s.user?.permissions ?? []);
  const has = useCallback((p: string) => permissions.includes(p), [permissions]);

  const isAutoSave = (objectId?.startsWith("__autosave_") ?? false);

  const perms = useMemo<PermFlags>(() => {
    if (isAutoSave || !objectId) return NO_PERMS;
    return getPermissions(objectType, has);
  }, [objectType, has, isAutoSave, objectId]);

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

  // Refs for double-fire prevention (mutable, always current)
  const savingRef = useRef(false);
  const savingAsRef = useRef(false);
  const publishingRef = useRef(false);
  const unpublishingRef = useRef(false);
  const deletingRef = useRef(false);

  const isBusy =
    isSaving || isSavingAs || isPublishing || isUnpublishing || isDeleting;

  const clearErrors = useCallback(() => {
    setSaveError(null);
    setSaveAsError(null);
    setPublishError(null);
    setUnpublishError(null);
    setDeleteError(null);
  }, []);

  const save = useCallback(
    async (opts?: { label?: string }): Promise<boolean> => {
      if (!objectId || isAutoSave || !perms.canSave || savingRef.current)
        return false;
      savingRef.current = true;
      setIsSaving(true);
      setSaveError(null);
      try {
        const result = onSaveOverride
          ? await onSaveOverride(opts ?? {})
          : await dispatchSave(objectType, objectId);
        if (result.success) {
          onSaveSuccess?.(result.data);
          return true;
        }
        setSaveError(extractError(result));
        return false;
      } catch (e) {
        setSaveError(e instanceof Error ? e.message : "Save failed");
        return false;
      } finally {
        setIsSaving(false);
        savingRef.current = false;
      }
    },
     
    [objectId, objectType, isAutoSave, perms.canSave, onSaveOverride, onSaveSuccess],
  );

  const saveAs = useCallback(
    async (opts: { name: string; label?: string }): Promise<string | null> => {
      if (isAutoSave || !perms.canSaveAs || savingAsRef.current) return null;
      savingAsRef.current = true;
      setIsSavingAs(true);
      setSaveAsError(null);
      try {
        const result = onSaveAsOverride
          ? await onSaveAsOverride(opts)
          : await dispatchSaveAs(objectType, opts);
        if (result.success) {
          const newId = extractNewId(result);
          onSaveAsSuccess?.(newId);
          return newId;
        }
        setSaveAsError(extractError(result));
        return null;
      } catch (e) {
        setSaveAsError(e instanceof Error ? e.message : "Save As failed");
        return null;
      } finally {
        setIsSavingAs(false);
        savingAsRef.current = false;
      }
    },
     
    [objectType, isAutoSave, perms.canSaveAs, onSaveAsOverride, onSaveAsSuccess],
  );

  const publish = useCallback(
    async (opts?: { label?: string }): Promise<boolean> => {
      void opts; // label passed through to backend once endpoints accept it
      if (!objectId || isAutoSave || !perms.canPublish || publishingRef.current)
        return false;
      publishingRef.current = true;
      setIsPublishing(true);
      setPublishError(null);
      try {
        const result = await dispatchPublish(objectType, objectId);
        if (result.success) {
          onPublishSuccess?.(result.data);
          return true;
        }
        setPublishError(extractError(result));
        return false;
      } catch (e) {
        setPublishError(e instanceof Error ? e.message : "Publish failed");
        return false;
      } finally {
        setIsPublishing(false);
        publishingRef.current = false;
      }
    },
     
    [objectId, objectType, isAutoSave, perms.canPublish, onPublishSuccess],
  );

  const unpublish = useCallback(async (): Promise<boolean> => {
    if (!objectId || isAutoSave || !perms.canUnpublish || unpublishingRef.current)
      return false;
    unpublishingRef.current = true;
    setIsUnpublishing(true);
    setUnpublishError(null);
    try {
      const result = await dispatchUnpublish(objectType, objectId);
      if (result.success) {
        onUnpublishSuccess?.(result.data);
        return true;
      }
      setUnpublishError(extractError(result));
      return false;
    } catch (e) {
      setUnpublishError(e instanceof Error ? e.message : "Unpublish failed");
      return false;
    } finally {
      setIsUnpublishing(false);
      unpublishingRef.current = false;
    }
     
  }, [objectId, objectType, isAutoSave, perms.canUnpublish, onUnpublishSuccess]);

  const deleteAction = useCallback(async (): Promise<boolean> => {
    if (!objectId || isAutoSave || !perms.canDelete || deletingRef.current)
      return false;
    deletingRef.current = true;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      const result = await dispatchDelete(objectType, objectId);
      if (result.success) {
        onDeleteSuccess?.();
        return true;
      }
      setDeleteError(extractError(result));
      return false;
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : "Delete failed");
      return false;
    } finally {
      setIsDeleting(false);
      deletingRef.current = false;
    }
     
  }, [objectId, objectType, isAutoSave, perms.canDelete, onDeleteSuccess]);

  return {
    save,
    saveAs,
    publish,
    unpublish,
    delete: deleteAction,
    isSaving,
    isSavingAs,
    isPublishing,
    isUnpublishing,
    isDeleting,
    isBusy,
    saveError,
    saveAsError,
    publishError,
    unpublishError,
    deleteError,
    clearErrors,
    ...perms,
    isAutoSave,
  };
}
