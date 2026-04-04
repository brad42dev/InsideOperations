import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { usePermission } from "../../shared/hooks/usePermission";

import WorkspaceGrid, { presetToGridItems } from "./WorkspaceGrid";
import { migrateGridItems } from "./layout-utils";
import type { GridItem } from "./types";
import ConsolePalette, { type ConsoleDragItem } from "./ConsolePalette";
import HistoricalPlaybackBar from "../../shared/components/HistoricalPlaybackBar";
import PaneConfigModal from "./PaneConfigModal";
import ContextMenu from "../../shared/components/ContextMenu";
import type { WorkspaceLayout, PaneConfig, LayoutPreset } from "./types";
import { uuidv4 } from "../../lib/uuid";
import { consoleApi } from "../../api/console";
import { useAuthStore } from "../../store/auth";
import { useUiStore } from "../../store/ui";
import { usePlaybackStore } from "../../store/playback";
import {
  useWorkspaceStore,
  useWorkspaceTemporal,
  makeNewWorkspace,
} from "../../store/workspaceStore";
import { useSelectionStore } from "../../store/selectionStore";
import { useRealtimeStore } from "../../store/realtimeStore";
import { ExportDialog } from "../../shared/components/ExportDialog";
import { exportsApi, type ExportFormat } from "../../api/exports";
import { showToast } from "../../shared/components/Toast";
import { useConsoleWorkspaceFavorites } from "../../shared/hooks/useConsoleWorkspaceFavorites";
import { useConsolePanelResize } from "../../shared/hooks/useConsolePanelResize";

// ---------------------------------------------------------------------------
// ConsoleStatusBar
// ---------------------------------------------------------------------------

function ConsoleStatusBar({ workspaceName }: { workspaceName: string }) {
  const { mode } = usePlaybackStore();
  const isHistorical = mode === "historical";
  const { connectionStatus, subscribedPointCount } = useRealtimeStore();

  return (
    <div
      style={{
        height: 24,
        flexShrink: 0,
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "0 10px",
        background: "var(--io-surface-secondary)",
        borderTop: "1px solid var(--io-border)",
        fontSize: 11,
        color: "var(--io-text-muted)",
        userSelect: "none",
      }}
    >
      {/* Connection dot */}
      <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            background:
              connectionStatus === "connected"
                ? "var(--io-success)"
                : connectionStatus === "connecting"
                  ? "var(--io-warning)"
                  : "var(--io-danger)",
            display: "inline-block",
          }}
        />
        {connectionStatus === "connected"
          ? "Connected"
          : connectionStatus === "connecting"
            ? "Connecting…"
            : connectionStatus === "error"
              ? "Error"
              : "Disconnected"}
      </span>
      <span style={{ color: "var(--io-border)" }}>|</span>
      {/* Points */}
      <span>{subscribedPointCount} points subscribed</span>
      <span style={{ color: "var(--io-border)" }}>|</span>
      {/* Workspace name */}
      {workspaceName && (
        <>
          <span
            style={{
              color: "var(--io-text-primary)",
              maxWidth: 200,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {workspaceName}
          </span>
          <span style={{ color: "var(--io-border)" }}>|</span>
        </>
      )}
      {/* Mode */}
      <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: isHistorical
              ? "var(--io-warning)"
              : "var(--io-success)",
            display: "inline-block",
          }}
        />
        {isHistorical ? "Historical" : "Live"}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// LocalStorage fallback (used when not authenticated or API unavailable)
// ---------------------------------------------------------------------------

const STORAGE_KEY = "io-console-workspaces";
const DRAFT_PREFIX = "io-console-ws-draft-";
const CLOSED_TABS_KEY = "io-console-closed-tabs";

function loadClosedTabIds(): Set<string> {
  try {
    const raw = localStorage.getItem(CLOSED_TABS_KEY);
    return raw ? new Set(JSON.parse(raw) as string[]) : new Set();
  } catch {
    return new Set();
  }
}

function saveClosedTabIds(ids: Set<string>): void {
  try {
    localStorage.setItem(CLOSED_TABS_KEY, JSON.stringify([...ids]));
  } catch {
    /* ignore quota errors */
  }
}

function saveDraftLocal(ws: WorkspaceLayout): void {
  try {
    localStorage.setItem(DRAFT_PREFIX + ws.id, JSON.stringify(ws));
  } catch {
    /* ignore quota errors */
  }
}

function migrateWorkspace(ws: WorkspaceLayout): WorkspaceLayout {
  if (!ws.gridItems?.length) return ws;
  const migrated = migrateGridItems(ws.gridItems);
  return migrated === ws.gridItems ? ws : { ...ws, gridItems: migrated };
}

function loadDraftLocal(id: string): WorkspaceLayout | null {
  try {
    const raw = localStorage.getItem(DRAFT_PREFIX + id);
    return raw ? migrateWorkspace(JSON.parse(raw) as WorkspaceLayout) : null;
  } catch {
    return null;
  }
}

function clearDraftLocal(id: string): void {
  try {
    localStorage.removeItem(DRAFT_PREFIX + id);
  } catch {
    /* ignore */
  }
}

function loadWorkspacesLocal(): WorkspaceLayout[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return (JSON.parse(raw) as WorkspaceLayout[]).map(migrateWorkspace);
  } catch {
    return [];
  }
}

function saveWorkspacesLocal(workspaces: WorkspaceLayout[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(workspaces));
  } catch {
    // ignore quota errors
  }
}

// ---------------------------------------------------------------------------
// Layout preset metadata
// ---------------------------------------------------------------------------

const LAYOUT_PRESETS: { value: LayoutPreset; label: string }[] = [
  // Even grids
  { value: "1x1", label: "1×1" },
  { value: "2x1", label: "2×1" },
  { value: "1x2", label: "1×2" },
  { value: "2x2", label: "2×2" },
  { value: "3x1", label: "3×1" },
  { value: "1x3", label: "1×3" },
  { value: "3x2", label: "3×2" },
  { value: "2x3", label: "2×3" },
  { value: "3x3", label: "3×3" },
  { value: "4x1", label: "4×1" },
  { value: "1x4", label: "1×4" },
  { value: "4x2", label: "4×2" },
  { value: "2x4", label: "2×4" },
  { value: "4x3", label: "4×3" },
  { value: "3x4", label: "3×4" },
  { value: "4x4", label: "4×4" },
  // Asymmetric
  { value: "big-left-3-right", label: "Big Left + 3 Right" },
  { value: "big-right-3-left", label: "Big Right + 3 Left" },
  { value: "big-top-3-bottom", label: "Big Top + 3 Bottom" },
  { value: "big-bottom-3-top", label: "Big Bottom + 3 Top" },
  { value: "2-big-4-small", label: "2 Big + 4 Small" },
  { value: "pip", label: "Picture in Picture" },
  { value: "featured-sidebar", label: "Featured + Sidebar" },
  { value: "side-by-side-unequal", label: "Side by Side Unequal" },
];

// ---------------------------------------------------------------------------
// ConsolePage — API-backed workspace persistence with localStorage fallback
// ---------------------------------------------------------------------------

export default function ConsolePage() {
  const queryClient = useQueryClient();
  const { isAuthenticated, user } = useAuthStore();
  const canPublish =
    user?.permissions.includes("console:workspace_publish") ?? false;
  const canWrite = user?.permissions.includes("console:write") ?? false;

  // ---- Kiosk mode -----------------------------------------------------------

  const [searchParams] = useSearchParams();
  const { setKiosk, isKiosk } = useUiStore();

  // Track whether this component instance set kiosk to true, so cleanup
  // doesn't accidentally clear kiosk state set by another module.
  const didSetKioskRef = useRef(false);

  useEffect(() => {
    const kioskParam = searchParams.get("kiosk") === "true";
    if (kioskParam) {
      didSetKioskRef.current = true;
      setKiosk(true);
    }
    return () => {
      if (didSetKioskRef.current) {
        setKiosk(false);
        didSetKioskRef.current = false;
      }
    };
  }, [searchParams, setKiosk]);

  // ---- Zustand stores ------------------------------------------------------

  const {
    workspaces,
    activeId,
    preserveAspectRatio,
    hideTitles,
    setWorkspaces,
    setActiveId,
    setPreserveAspectRatio,
    setHideTitles,
    toggleLocked,
    pinPane,
    unpinPane,
    updateWorkspace,
    renameWorkspace,
    changeLayout,
    updateGridItems,
    updatePane,
    removePane,
    swapPanes,
    clearPanes,
    setWorkspace,
  } = useWorkspaceStore();

  const temporal = useWorkspaceTemporal();

  // Which workspace IDs are currently open as tabs (subset of all workspaces)
  const [openTabIds, setOpenTabIds] = useState<string[]>([]);
  // IDs the user has explicitly closed — persisted so refresh doesn't re-open them
  const explicitlyClosedIdsRef = useRef<Set<string>>(loadClosedTabIds());
  // Server-saved snapshots per workspace — used for dirty detection and revert
  const serverSnapshotsRef = useRef<Record<string, string>>({});
  // Workspace name modal (create / rename)
  const [nameModal, setNameModal] = useState<{
    mode: "create" | "rename";
    workspaceId?: string;
    initialName: string;
    initialDescription?: string;
  } | null>(null);
  // Close-tab confirmation dialog (shown when closing with unsaved changes)
  const [closeDialog, setCloseDialog] = useState<{
    workspaceId: string;
    workspaceName: string;
  } | null>(null);
  // Delete confirmation dialog
  const [deleteDialog, setDeleteDialog] = useState<{
    workspaceId: string;
    workspaceName: string;
  } | null>(null);
  // After save-and-close, close this workspace once the save mutation resolves
  const pendingCloseAfterSaveRef = useRef<string | null>(null);

  const { toggleFavorite, isFavorite } = useConsoleWorkspaceFavorites();

  const {
    selectedPaneIds,
    swapModeSourceId,
    selectPane,
    selectAll,
    clearSelection,
    setSwapModeSourceId,
  } = useSelectionStore();

  // ---- API-backed state (when authenticated) --------------------------------

  const {
    data: apiWorkspaces,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["console-workspaces"],
    queryFn: async () => {
      const result = await consoleApi.listWorkspaces();
      if (!result.success) throw new Error(result.error.message);
      return result.data;
    },
    enabled: isAuthenticated,
    staleTime: 30_000,
  });

  // Decide which source to use
  const useApi = isAuthenticated && !isError;

  // Sync API workspaces → WorkspaceStore when they load
  useEffect(() => {
    if (useApi && apiWorkspaces) {
      // Seed per-workspace server snapshots and apply any localStorage drafts
      const resolvedWorkspaces = apiWorkspaces.map((ws) => {
        serverSnapshotsRef.current[ws.id] = JSON.stringify(ws);
        const draft = loadDraftLocal(ws.id);
        return draft ?? ws;
      });
      setWorkspaces(resolvedWorkspaces);
      // Additive merge: first load opens all tabs; subsequent refreshes (e.g. after
      // save invalidates the query, or activeId changes) only add newly created
      // workspaces — never re-open tabs the user explicitly closed.
      setOpenTabIds((prev) => {
        const allIds = resolvedWorkspaces.map((w) => w.id);
        const closed = explicitlyClosedIdsRef.current;
        // True first load: no tabs open yet and user hasn't closed anything
        if (prev.length === 0 && closed.size === 0) return allIds;
        const allSet = new Set(allIds);
        const prevSet = new Set(prev);
        const kept = prev.filter((id) => allSet.has(id)); // remove server-deleted
        // Only open IDs that are brand-new (not previously seen, not user-closed)
        const added = allIds.filter(
          (id) => !prevSet.has(id) && !closed.has(id),
        );
        return [...kept, ...added];
      });
      const newActiveId =
        resolvedWorkspaces.length > 0 &&
        (activeId === null ||
          !resolvedWorkspaces.find((w) => w.id === activeId))
          ? resolvedWorkspaces[0].id
          : activeId;
      if (newActiveId !== activeId) setActiveId(newActiveId);
      const targetId = newActiveId ?? activeId;
      const activeWs = resolvedWorkspaces.find((w) => w.id === targetId);
      if (activeWs) {
        lastSavedSnapshotRef.current =
          serverSnapshotsRef.current[activeWs.id] ?? JSON.stringify(activeWs);
      }
    }
  }, [useApi, apiWorkspaces, setWorkspaces, activeId, setActiveId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync localStorage workspaces → WorkspaceStore when not using API
  const [localWorkspacesLoaded, setLocalWorkspacesLoaded] = useState(false);
  useEffect(() => {
    if (!useApi && !localWorkspacesLoaded) {
      const local = loadWorkspacesLocal();
      setWorkspaces(local);
      setOpenTabIds(local.map((w) => w.id));
      if (local.length > 0) {
        setActiveId(local[0].id);
        lastSavedSnapshotRef.current = JSON.stringify(local[0]);
      }
      setLocalWorkspacesLoaded(true);
    }
  }, [useApi, localWorkspacesLoaded, setWorkspaces, setActiveId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- API mutations --------------------------------------------------------

  const saveMutation = useMutation({
    mutationFn: (ws: WorkspaceLayout) => consoleApi.saveWorkspace(ws),
    onSuccess: (data, ws) => {
      // The API client never rejects — it returns { success: false } on error.
      // We must check here so that 4xx/5xx responses route to error handling
      // rather than firing a false-positive success toast.
      if (!data.success) {
        const errorMessage =
          data.error.message ??
          "The server could not be reached. Please try again.";
        const isCreate = pendingCreateIdsRef.current.has(ws.id);
        if (isCreate) {
          pendingCreateIdsRef.current.delete(ws.id);
          // Roll back the optimistic workspace addition
          useWorkspaceStore.getState().deleteWorkspace(ws.id);
          queryClient.setQueryData<WorkspaceLayout[]>(
            ["console-workspaces"],
            (prev) => (prev ? prev.filter((w) => w.id !== ws.id) : []),
          );
          showToast({
            title: "Failed to create workspace",
            description: errorMessage,
            variant: "error",
            duration: 0,
          });
          return;
        }
        const isDuplicate = pendingDuplicateIdsRef.current.has(ws.id);
        if (isDuplicate) {
          pendingDuplicateIdsRef.current.delete(ws.id);
          // Roll back the optimistic duplicate addition
          useWorkspaceStore.getState().deleteWorkspace(ws.id);
          queryClient.setQueryData<WorkspaceLayout[]>(
            ["console-workspaces"],
            (prev) => (prev ? prev.filter((w) => w.id !== ws.id) : []),
          );
          showToast({
            title: "Failed to duplicate workspace",
            description: errorMessage,
            variant: "error",
            duration: 0,
          });
          return;
        }
        if (pendingRenameIdsRef.current.has(ws.id)) {
          pendingRenameIdsRef.current.delete(ws.id);
          showToast({
            title: "Failed to rename workspace",
            description: errorMessage,
            variant: "error",
            duration: 0,
          });
          return;
        }
        saveFailCountRef.current += 1;
        const next = saveFailCountRef.current;
        if (next >= 3) {
          setShowSaveBanner(true);
        } else {
          const delay = Math.pow(2, next - 1) * 1000;
          if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
          retryTimerRef.current = setTimeout(() => {
            saveMutation.mutate(ws);
          }, delay);
        }
        return;
      }
      const isCreate = pendingCreateIdsRef.current.has(ws.id);
      if (isCreate) {
        pendingCreateIdsRef.current.delete(ws.id);
        showToast({ title: "Workspace created", variant: "success" });
      }
      const isDuplicate = pendingDuplicateIdsRef.current.has(ws.id);
      if (isDuplicate) {
        pendingDuplicateIdsRef.current.delete(ws.id);
        showToast({ title: "Workspace duplicated", variant: "success" });
      }
      if (pendingRenameIdsRef.current.has(ws.id)) {
        pendingRenameIdsRef.current.delete(ws.id);
        // Rename success is silent — the tab label already updated optimistically
      }
      saveFailCountRef.current = 0;
      setShowSaveBanner(false);
      // Update server snapshot and clear draft for the saved workspace
      serverSnapshotsRef.current[ws.id] = JSON.stringify(ws);
      clearDraftLocal(ws.id);
      if (ws.id === useWorkspaceStore.getState().activeId) {
        lastSavedSnapshotRef.current = JSON.stringify(ws);
      }
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
      // If user saved-and-closed, close the tab now
      if (pendingCloseAfterSaveRef.current === ws.id) {
        pendingCloseAfterSaveRef.current = null;
        setOpenTabIds((prev) => prev.filter((id) => id !== ws.id));
      }
      void queryClient.invalidateQueries({ queryKey: ["console-workspaces"] });
    },
    onError: (_err, ws) => {
      const isCreate = pendingCreateIdsRef.current.has(ws.id);
      if (isCreate) {
        pendingCreateIdsRef.current.delete(ws.id);
        showToast({
          title: "Failed to create workspace",
          description:
            _err instanceof Error
              ? _err.message
              : "The server could not be reached. Please try again.",
          variant: "error",
          duration: 0,
        });
        return;
      }
      const isDuplicate = pendingDuplicateIdsRef.current.has(ws.id);
      if (isDuplicate) {
        pendingDuplicateIdsRef.current.delete(ws.id);
        showToast({
          title: "Failed to duplicate workspace",
          description:
            _err instanceof Error
              ? _err.message
              : "The server could not be reached. Please try again.",
          variant: "error",
          duration: 0,
        });
        return;
      }
      const isRename = pendingRenameIdsRef.current.has(ws.id);
      if (isRename) {
        pendingRenameIdsRef.current.delete(ws.id);
        showToast({
          title: "Failed to rename workspace",
          description:
            _err instanceof Error
              ? _err.message
              : "The server could not be reached. Please try again.",
          variant: "error",
          duration: 0,
        });
        return;
      }
      saveFailCountRef.current += 1;
      const next = saveFailCountRef.current;
      if (next >= 3) {
        setShowSaveBanner(true);
      } else {
        // Exponential backoff: 1s after first failure, 2s after second
        const delay = Math.pow(2, next - 1) * 1000;
        if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
        retryTimerRef.current = setTimeout(() => {
          saveMutation.mutate(ws);
        }, delay);
      }
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => consoleApi.deleteWorkspace(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["console-workspaces"] });
    },
    onError: (_err) => {
      showToast({
        title: "Failed to delete workspace",
        description:
          _err instanceof Error
            ? _err.message
            : "The server could not be reached. Please try again.",
        variant: "error",
        duration: 0,
      });
    },
  });

  const publishMutation = useMutation({
    mutationFn: ({ id, published }: { id: string; published: boolean }) =>
      consoleApi.publishWorkspace(id, published),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["console-workspaces"] });
    },
    onError: (_err, vars) => {
      showToast({
        title: vars.published
          ? "Failed to publish workspace"
          : "Failed to unpublish workspace",
        description:
          _err instanceof Error
            ? _err.message
            : "The server could not be reached. Please try again.",
        variant: "error",
        duration: 0,
      });
    },
  });

  // ---- Persist helper — routes to API or localStorage ---------------------

  const persistWorkspace = useCallback(
    (ws: WorkspaceLayout) => {
      if (useApi) {
        saveMutation.mutate(ws);
      } else {
        const current = useWorkspaceStore.getState().workspaces;
        const exists = current.find((w) => w.id === ws.id);
        const updated = exists
          ? current.map((w) => (w.id === ws.id ? ws : w))
          : [...current, ws];
        saveWorkspacesLocal(updated);
        // localStorage saves are synchronous — update snapshot immediately so the
        // dirty indicator clears right away (no async success callback on this path).
        lastSavedSnapshotRef.current = JSON.stringify(ws);
      }
    },
    [useApi, saveMutation],
  );

  // ---- Debounced draft save (2s after last layout change → localStorage only) --
  // Changes are stored locally for session recovery. The server is only written
  // when the user explicitly clicks Save (handleExplicitSave).

  const scheduleSave = useCallback(
    (ws: WorkspaceLayout) => {
      if (saveDebounceRef.current) clearTimeout(saveDebounceRef.current);
      saveDebounceRef.current = setTimeout(() => {
        // Draft-only: keep local copy for crash/refresh recovery
        if (useApi) {
          saveDraftLocal(ws);
        } else {
          // Non-API path: still persist to localStorage as the source of truth
          persistWorkspace(ws);
        }
        saveDebounceRef.current = null;
      }, 2000);
    },
    [useApi, persistWorkspace],
  );

  // Clear debounce on unmount to avoid stale saves
  useEffect(() => {
    return () => {
      if (saveDebounceRef.current) clearTimeout(saveDebounceRef.current);
    };
  }, []);

  // ---- RBAC helpers ----------------------------------------------------------

  const canSaveWorkspace = useCallback(
    (ws: WorkspaceLayout) => {
      if (!ws.published) return canWrite;
      // Published workspace: only the owner or an admin (canPublish) can overwrite
      return ws.owner_id === user?.id || canPublish;
    },
    [canWrite, canPublish, user?.id],
  );

  const canSaveAsPersonal = useCallback(
    (ws: WorkspaceLayout) => ws.published && !canSaveWorkspace(ws) && canWrite,
    [canSaveWorkspace, canWrite],
  );

  // ---- Explicit save ---------------------------------------------------------

  const handleExplicitSave = useCallback(() => {
    const ws = useWorkspaceStore
      .getState()
      .workspaces.find((w) => w.id === activeId);
    if (!ws) return;
    persistWorkspace(ws);
  }, [activeId, persistWorkspace]);

  const handleSaveAsPersonal = useCallback(() => {
    const ws = useWorkspaceStore
      .getState()
      .workspaces.find((w) => w.id === activeId);
    if (!ws) return;
    const copy: WorkspaceLayout = {
      ...ws,
      id: uuidv4(),
      published: false,
      owner_id: user?.id,
    };
    const current = useWorkspaceStore.getState().workspaces;
    setWorkspaces([...current, copy]);
    setOpenTabIds((prev) => [...prev.filter((id) => id !== ws.id), copy.id]);
    setActiveId(copy.id);
    persistWorkspace(copy);
  }, [activeId, user?.id, setWorkspaces, setActiveId, persistWorkspace]);

  // ---- Close tab logic -------------------------------------------------------

  const doCloseWorkspace = useCallback(
    (wsId: string) => {
      explicitlyClosedIdsRef.current.add(wsId);
      saveClosedTabIds(explicitlyClosedIdsRef.current);
      clearDraftLocal(wsId);
      setOpenTabIds((prev) => {
        const next = prev.filter((id) => id !== wsId);
        if (activeId === wsId) setActiveId(next[0] ?? null);
        return next;
      });
    },
    [activeId, setActiveId],
  );

  const handleCloseWorkspace = useCallback(
    (wsId: string) => {
      const ws = useWorkspaceStore
        .getState()
        .workspaces.find((w) => w.id === wsId);
      if (!ws) return;
      const snap = serverSnapshotsRef.current[wsId];
      const dirty = snap ? JSON.stringify(ws) !== snap : false;
      if (dirty) {
        setCloseDialog({ workspaceId: wsId, workspaceName: ws.name });
      } else {
        doCloseWorkspace(wsId);
      }
    },
    [doCloseWorkspace],
  );

  const handleSaveAndClose = useCallback(
    (wsId: string) => {
      const ws = useWorkspaceStore
        .getState()
        .workspaces.find((w) => w.id === wsId);
      if (!ws) return;
      pendingCloseAfterSaveRef.current = wsId;
      persistWorkspace(ws);
      setCloseDialog(null);
    },
    [persistWorkspace],
  );

  const handleDiscardAndClose = useCallback(
    (wsId: string) => {
      // Revert the workspace in the store to its last server-saved state
      const snap = serverSnapshotsRef.current[wsId];
      if (snap) {
        try {
          setWorkspace(migrateWorkspace(JSON.parse(snap) as WorkspaceLayout));
        } catch {
          /* ignore */
        }
      }
      setCloseDialog(null);
      doCloseWorkspace(wsId);
    },
    [setWorkspace, doCloseWorkspace],
  );

  // ---- Undo / Redo (via zundo temporal store) ----------------------------

  const handleUndo = useCallback(() => {
    temporal.getState().undo();
  }, [temporal]);

  const handleRedo = useCallback(() => {
    temporal.getState().redo();
  }, [temporal]);

  // Reactive undo/redo depth for button enabled state
  const [undoDepth, setUndoDepth] = useState(0);
  const [redoDepth, setRedoDepth] = useState(0);

  useEffect(() => {
    // Subscribe to temporal store changes to update button states
    const unsub = temporal.subscribe((state) => {
      setUndoDepth(state.pastStates.length);
      setRedoDepth(state.futureStates.length);
    });
    return unsub;
  }, [temporal]);

  // Reset undo history when switching workspaces
  useEffect(() => {
    temporal.getState().clear();
  }, [activeId, temporal]);

  // ---- UI state -----------------------------------------------------------

  const saveFailCountRef = useRef(0);
  const [showSaveBanner, setShowSaveBanner] = useState(false);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const lastSavedSnapshotRef = useRef<string | null>(null);

  // When the active workspace changes, reset the saved snapshot so the new
  // workspace starts in a clean state.  Also clear any pending debounce so
  // stale saves from the previous workspace don't fire against the new one.
  useEffect(() => {
    if (saveDebounceRef.current) {
      clearTimeout(saveDebounceRef.current);
      saveDebounceRef.current = null;
    }
    const ws = useWorkspaceStore
      .getState()
      .workspaces.find((w) => w.id === activeId);
    lastSavedSnapshotRef.current = ws ? JSON.stringify(ws) : null;
  }, [activeId]);

  // Track workspace IDs that are being created (not auto-saved) so we can toast on success/failure
  const pendingCreateIdsRef = useRef<Set<string>>(new Set());
  // Track workspace IDs that are being duplicated so we can show specific toasts
  const pendingDuplicateIdsRef = useRef<Set<string>>(new Set());
  // Track workspace IDs that are being renamed so we can show specific toasts
  const pendingRenameIdsRef = useRef<Set<string>>(new Set());

  const [paletteVisible, setPaletteVisible] = useState(true);
  const {
    panelWidth,
    onResizeHandleMouseDown: onPanelResizeMouseDown,
    isResizing: isPanelResizing,
  } = useConsolePanelResize();
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [configuringPaneId, setConfiguringPaneId] = useState<string | null>(
    null,
  );
  const [exportDropdownOpen, setExportDropdownOpen] = useState(false);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const canExport = usePermission("console:export");
  const copiedPanesRef = useRef<PaneConfig[]>([]);
  const [tabContextMenu, setTabContextMenu] = useState<{
    x: number;
    y: number;
    workspaceId: string;
  } | null>(null);
  const [workspaceBgCtxMenu, setWorkspaceBgCtxMenu] = useState<{
    x: number;
    y: number;
  } | null>(null);

  const handleWorkspaceContextMenu = useCallback((x: number, y: number) => {
    setWorkspaceBgCtxMenu({ x, y });
  }, []);

  const activeWorkspace = workspaces.find((w) => w.id === activeId) ?? null;
  const isLocked = activeWorkspace?.locked ?? false;
  const pinnedIds = useMemo(
    () =>
      new Set(
        activeWorkspace?.panes.filter((p) => p.pinned).map((p) => p.id) ?? [],
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activeWorkspace?.panes],
  );

  // ---- Browser fullscreen --------------------------------------------------

  const toggleFullscreen = useCallback(() => {
    if (!isFullscreen) {
      document.documentElement.requestFullscreen?.().catch(() => undefined);
    } else {
      document.exitFullscreen?.().catch(() => undefined);
    }
  }, [isFullscreen]);

  // Sync isFullscreen with actual browser state so the button icon stays correct
  // if the user exits fullscreen via Escape, browser F11, or browser native controls.
  useEffect(() => {
    function onFullscreenChange() {
      setIsFullscreen(!!document.fullscreenElement);
    }
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () =>
      document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  // ---- Workspace management -----------------------------------------------

  const createWorkspace = () => {
    setNameModal({
      mode: "create",
      initialName: `Workspace ${workspaces.length + 1}`,
      initialDescription: "",
    });
  };

  const confirmCreateWorkspace = (name: string, description?: string) => {
    setNameModal(null);
    const ws = makeNewWorkspace(
      name.trim() || `Workspace ${workspaces.length + 1}`,
      "2x2",
      description?.trim() || undefined,
    );
    const currentWorkspaces = useWorkspaceStore.getState().workspaces;
    setWorkspaces([...currentWorkspaces, ws]);
    setOpenTabIds((prev) => [...prev, ws.id]);
    setActiveId(ws.id);
    pendingCreateIdsRef.current.add(ws.id);
    persistWorkspace(ws);
    if (useApi) {
      queryClient.setQueryData<WorkspaceLayout[]>(
        ["console-workspaces"],
        (prev) => (prev ? [...prev, ws] : [ws]),
      );
    }
  };

  const confirmDeleteWorkspace = useCallback(
    (id: string) => {
      setDeleteDialog(null);
      const nextWorkspaces = workspaces.filter((w) => w.id !== id);
      setWorkspaces(nextWorkspaces);
      if (activeId === id) setActiveId(nextWorkspaces[0]?.id ?? null);
      if (useApi) {
        deleteMutation.mutate(id);
      } else {
        saveWorkspacesLocal(nextWorkspaces);
      }
    },
    [workspaces, activeId, useApi, setWorkspaces, setActiveId, deleteMutation],
  );

  const deleteActiveWorkspace = () => {
    if (!activeId) return;
    const ws = workspaces.find((w) => w.id === activeId);
    if (!ws) return;
    setDeleteDialog({ workspaceId: activeId, workspaceName: ws.name });
  };

  const duplicateWorkspace = (id: string) => {
    const source = workspaces.find((w) => w.id === id);
    if (!source) return;
    const copy: WorkspaceLayout = {
      ...source,
      id: uuidv4(),
      name: `${source.name} (copy)`,
      panes: source.panes.map((p) => ({ ...p, id: uuidv4() })),
    };
    const currentWorkspaces = useWorkspaceStore.getState().workspaces;
    setWorkspaces([...currentWorkspaces, copy]);
    setActiveId(copy.id);
    if (useApi) {
      pendingDuplicateIdsRef.current.add(copy.id);
    }
    persistWorkspace(copy);
    if (useApi) {
      queryClient.setQueryData<WorkspaceLayout[]>(
        ["console-workspaces"],
        (prev) => (prev ? [...prev, copy] : [copy]),
      );
    }
  };

  const handleTabContextMenu = useCallback(
    (e: React.MouseEvent, workspaceId: string) => {
      e.preventDefault();
      setTabContextMenu({ x: e.clientX, y: e.clientY, workspaceId });
    },
    [],
  );

  const handleRenameWorkspace = useCallback(
    (id: string, name: string, description?: string) => {
      renameWorkspace(id, name);
      const ws = useWorkspaceStore
        .getState()
        .workspaces.find((w) => w.id === id);
      if (ws) {
        if (useApi) {
          pendingRenameIdsRef.current.add(id);
        }
        persistWorkspace({
          ...ws,
          name,
          description: description?.trim() || ws.description,
        });
      }
    },
    [renameWorkspace, useApi, persistWorkspace],
  );

  const handleChangeLayout = (layout: LayoutPreset) => {
    if (!activeId) return;
    changeLayout(activeId, layout);
    const ws = useWorkspaceStore
      .getState()
      .workspaces.find((w) => w.id === activeId);
    if (ws) scheduleSave(ws);
  };

  const handleGridLayoutChange = useCallback(
    (items: GridItem[]) => {
      if (!activeId) return;
      updateGridItems(activeId, items);
      const ws = useWorkspaceStore
        .getState()
        .workspaces.find((w) => w.id === activeId);
      if (ws) scheduleSave(ws);
    },
    [activeId, updateGridItems, scheduleSave],
  );

  // ---- Keyboard shortcuts -------------------------------------------------

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const ctrl = e.ctrlKey || e.metaKey;
      // Ctrl+S — explicit save active workspace
      if (ctrl && e.key === "s") {
        e.preventDefault();
        handleExplicitSave();
        return;
      }
      // Undo / redo
      if (ctrl && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
        return;
      }
      if (ctrl && (e.key === "y" || (e.key === "z" && e.shiftKey))) {
        e.preventDefault();
        handleRedo();
        return;
      }
      // Ctrl+A — select all panes in active workspace (when unlocked)
      if (ctrl && e.key === "a" && !isLocked && activeId) {
        e.preventDefault();
        const ws = useWorkspaceStore
          .getState()
          .workspaces.find((w) => w.id === activeId);
        if (ws) selectAll(ws.panes.map((p) => p.id));
        return;
      }
      // Ctrl+C — copy selected panes (when unlocked)
      if (
        ctrl &&
        e.key === "c" &&
        !isLocked &&
        activeId &&
        selectedPaneIds.size > 0
      ) {
        e.preventDefault();
        const ws = useWorkspaceStore
          .getState()
          .workspaces.find((w) => w.id === activeId);
        if (ws) {
          copiedPanesRef.current = ws.panes.filter((p) =>
            selectedPaneIds.has(p.id),
          );
        }
        return;
      }
      // Ctrl+V — paste copied panes into active workspace (when unlocked)
      if (
        ctrl &&
        e.key === "v" &&
        !isLocked &&
        activeId &&
        copiedPanesRef.current.length > 0
      ) {
        e.preventDefault();
        const pasted = copiedPanesRef.current.map((p) => ({
          ...p,
          id: `pane-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        }));
        updateWorkspace(activeId, (w) => ({
          ...w,
          panes: [...w.panes, ...pasted],
        }));
        const ws = useWorkspaceStore
          .getState()
          .workspaces.find((w) => w.id === activeId);
        if (ws) scheduleSave(ws);
        return;
      }
      // Escape — cancel swap mode or clear selection
      if (e.key === "Escape") {
        if (swapModeSourceId !== null) {
          setSwapModeSourceId(null);
          return;
        }
        clearSelection();
        return;
      }
      // Delete / Backspace — remove selected panes (when unlocked)
      if (
        (e.key === "Delete" || e.key === "Backspace") &&
        !isLocked &&
        activeId
      ) {
        const currentSelection = useSelectionStore.getState().selectedPaneIds;
        if (currentSelection.size === 0) return;
        updateWorkspace(activeId, (w) => ({
          ...w,
          panes: w.panes.filter((p) => !currentSelection.has(p.id)),
        }));
        clearSelection();
        const ws = useWorkspaceStore
          .getState()
          .workspaces.find((w) => w.id === activeId);
        if (ws) scheduleSave(ws);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    handleUndo,
    handleRedo,
    isLocked,
    activeId,
    selectedPaneIds,
    swapModeSourceId,
    updateWorkspace,
    selectAll,
    clearSelection,
    setSwapModeSourceId,
    persistWorkspace,
    scheduleSave,
  ]);

  // ---- Pane management ----------------------------------------------------

  const handlePaneSelect = useCallback(
    (paneId: string, addToSelection: boolean) => {
      selectPane(paneId, addToSelection);
    },
    [selectPane],
  );

  const handleConfigurePane = useCallback((paneId: string) => {
    setConfiguringPaneId(paneId);
  }, []);

  const handleRemovePane = useCallback(
    (paneId: string) => {
      if (!activeId) return;
      removePane(activeId, paneId);
      const ws = useWorkspaceStore
        .getState()
        .workspaces.find((w) => w.id === activeId);
      if (ws) scheduleSave(ws);
    },
    [activeId, removePane, scheduleSave],
  );

  const handleSwapWith = useCallback(
    (paneId: string) => {
      setSwapModeSourceId(paneId);
    },
    [setSwapModeSourceId],
  );

  const handleSwapComplete = useCallback(
    (targetId: string) => {
      if (!activeId || !swapModeSourceId) return;
      const ws = useWorkspaceStore
        .getState()
        .workspaces.find((w) => w.id === activeId);
      if (!ws) return;
      const items = ws.gridItems?.length
        ? ws.gridItems
        : presetToGridItems(ws.layout, ws.panes);
      swapPanes(activeId, swapModeSourceId, targetId, items);
      setSwapModeSourceId(null);
      const updated = useWorkspaceStore
        .getState()
        .workspaces.find((w) => w.id === activeId);
      if (updated) scheduleSave(updated);
    },
    [activeId, swapModeSourceId, swapPanes, setSwapModeSourceId, scheduleSave],
  );

  const handleReplacePane = useCallback(
    (paneId: string, graphicId: string, graphicName: string) => {
      if (!activeId) return;
      updateWorkspace(activeId, (w) => ({
        ...w,
        panes: w.panes.map((p) =>
          p.id === paneId
            ? { ...p, type: "graphic", graphicId, title: graphicName }
            : p,
        ),
      }));
      const ws = useWorkspaceStore
        .getState()
        .workspaces.find((w) => w.id === activeId);
      if (ws) scheduleSave(ws);
    },
    [activeId, updateWorkspace, scheduleSave],
  );

  const handlePinToggle = useCallback(
    (paneId: string, pinned: boolean) => {
      if (!activeId) return;
      if (pinned) {
        pinPane(activeId, paneId);
      } else {
        unpinPane(activeId, paneId);
      }
      const ws = useWorkspaceStore
        .getState()
        .workspaces.find((w) => w.id === activeId);
      if (ws) scheduleSave(ws);
    },
    [activeId, pinPane, unpinPane, scheduleSave],
  );

  // ---------------------------------------------------------------------------
  // Export helpers
  // ---------------------------------------------------------------------------

  /** Produces spec-compliant filename: console_workspace_{YYYY-MM-DD_HHmm}.{ext} */
  function exportFilename(ext: string): string {
    const now = new Date();
    const datePart = now.toISOString().slice(0, 10);
    const timePart = now.toTimeString().slice(0, 5).replace(":", "");
    return `console_workspace_${datePart}_${timePart}.${ext}`;
  }

  /** Collect all point IDs from all pane types in the active workspace. */
  function collectWorkspacePointIds(ws: WorkspaceLayout): string[] {
    const ids: string[] = [];
    for (const pane of ws.panes) {
      if (pane.trendPointIds?.length) ids.push(...pane.trendPointIds);
      if (pane.tablePointIds?.length) ids.push(...pane.tablePointIds);
      // Graphic pane: points are tracked by the realtime store under their graphicId;
      // include them via the subscribed set which covers all graphic bindings.
    }
    return [...new Set(ids)];
  }

  const LARGE_EXPORT_THRESHOLD = 50_000;

  /** Quick-format export triggered from dropdown — uses exportsApi for all 6 formats. */
  const handleExport = useCallback(
    async (format: ExportFormat) => {
      setExportDropdownOpen(false);
      if (!activeWorkspace) return;

      const pointIds = collectWorkspacePointIds(activeWorkspace);
      // Columns are the point IDs themselves for a workspace export
      const columns =
        pointIds.length > 0
          ? pointIds
          : ["tagname", "value", "quality", "timestamp"];
      const estimatedRows = pointIds.length;

      try {
        if (estimatedRows >= LARGE_EXPORT_THRESHOLD) {
          // Async path: submit job, WebSocket export_complete will notify the user
          const result = await exportsApi.create({
            module: "console",
            entity: "workspace",
            format,
            scope: "all",
            columns,
          });
          if (result.type === "download") {
            exportsApi.triggerDownload(result.blob, exportFilename(format));
          }
          // If 'queued', the WebSocket export_complete event will show a toast
        } else {
          const result = await exportsApi.create({
            module: "console",
            entity: "workspace",
            format,
            scope: "all",
            columns,
          });
          if (result.type === "download") {
            // Override server filename with spec-compliant name
            exportsApi.triggerDownload(result.blob, exportFilename(format));
          }
        }
      } catch (err) {
        console.error("[Console] Export failed:", err);
      }
    },
    [activeWorkspace],
  );

  const handleSavePane = (updated: PaneConfig) => {
    if (!activeId) return;
    updatePane(activeId, updated);
    const ws = useWorkspaceStore
      .getState()
      .workspaces.find((w) => w.id === activeId);
    if (ws) scheduleSave(ws);
    setConfiguringPaneId(null);
  };

  // ---- Palette drop handler -----------------------------------------------

  const handlePaletteDrop = useCallback(
    (paneId: string, item: ConsoleDragItem) => {
      if (!activeId) return;
      updateWorkspace(activeId, (w) => ({
        ...w,
        panes: w.panes.map((p) => {
          if (p.id !== paneId) return p;
          switch (item.itemType) {
            case "chart":
              return {
                ...p,
                type: "trend" as const,
                chartConfig: item.chartConfig ?? p.chartConfig,
                trendPointIds: item.chartConfig ? [] : (item.pointIds ?? []),
                title: item.label ?? p.title,
                promptConfig:
                  !item.chartConfig && !item.pointIds?.length
                    ? true
                    : undefined,
              };
            case "graphic":
              return {
                ...p,
                type: "graphic" as const,
                graphicId: item.graphicId,
                title: item.label ?? p.title,
              };
            default:
              return p;
          }
        }),
      }));
      const ws = useWorkspaceStore
        .getState()
        .workspaces.find((w) => w.id === activeId);
      if (ws) scheduleSave(ws);
    },
    [activeId, updateWorkspace, scheduleSave],
  );

  // ---- Palette double-click quick-place (§5.4) ----------------------------

  const handleQuickPlace = useCallback(
    (item: ConsoleDragItem) => {
      if (!activeId) return;
      updateWorkspace(activeId, (w) => {
        const applyItem = (p: PaneConfig): PaneConfig => {
          switch (item.itemType) {
            case "chart":
              return {
                ...p,
                type: "trend" as const,
                chartConfig: item.chartConfig ?? p.chartConfig,
                trendPointIds: item.chartConfig ? [] : (item.pointIds ?? []),
                title: item.label ?? p.title,
                promptConfig:
                  !item.chartConfig && !item.pointIds?.length
                    ? true
                    : undefined,
              };
            case "graphic":
              return {
                ...p,
                type: "graphic" as const,
                graphicId: item.graphicId,
                title: item.label ?? p.title,
              };
            default:
              return p;
          }
        };

        const newPane = (): PaneConfig =>
          applyItem({ id: uuidv4(), type: "blank" as const });

        if (w.panes.length === 0) {
          // No panes: create a 1×1 layout
          const firstPane = newPane();
          return {
            ...w,
            panes: [firstPane],
            gridItems: [{ i: firstPane.id, x: 0, y: 0, w: 12, h: 8 }],
          };
        }

        // Priority 1: replace first selected pane
        const selIds = [...selectedPaneIds];
        if (selIds.length > 0) {
          return {
            ...w,
            panes: w.panes.map((p) => (p.id === selIds[0] ? applyItem(p) : p)),
          };
        }

        // Priority 2: first blank pane (row-major order by grid item y then x)
        const sorted = [...w.panes].sort((a, b) => {
          const ga = w.gridItems?.find((gi) => gi.i === a.id);
          const gb = w.gridItems?.find((gi) => gi.i === b.id);
          if (!ga || !gb) return 0;
          return ga.y !== gb.y ? ga.y - gb.y : ga.x - gb.x;
        });
        const blankPane = sorted.find((p) => p.type === "blank");
        if (blankPane) {
          return {
            ...w,
            panes: w.panes.map((p) =>
              p.id === blankPane.id ? applyItem(p) : p,
            ),
          };
        }

        // Priority 3: add new pane appended to grid
        const np = newPane();
        const maxRow = Math.max(
          0,
          ...(w.gridItems ?? []).map((gi) => gi.y + gi.h),
        );
        const newGridItem = { i: np.id, x: 0, y: maxRow, w: 6, h: 6 };
        return {
          ...w,
          panes: [...w.panes, np],
          gridItems: [...(w.gridItems ?? []), newGridItem],
        };
      });
      const ws = useWorkspaceStore
        .getState()
        .workspaces.find((w) => w.id === activeId);
      if (ws) scheduleSave(ws);
    },
    [activeId, updateWorkspace, selectedPaneIds, scheduleSave],
  );

  // ---- Configuring pane object --------------------------------------------

  const configuringPane = configuringPaneId
    ? (activeWorkspace?.panes.find((p) => p.id === configuringPaneId) ?? null)
    : null;

  // ---- Render -------------------------------------------------------------

  if (isLoading && isAuthenticated) {
    return (
      <div
        style={{ display: "flex", height: "100%", background: "var(--io-bg)" }}
      >
        {/* Left panel skeleton */}
        <div
          style={{
            width: 280,
            flexShrink: 0,
            background: "var(--io-surface-secondary)",
            borderRight: "1px solid var(--io-border)",
            padding: 8,
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              style={{
                height: 28,
                borderRadius: 4,
                background: "var(--io-surface-elevated)",
                animation: "io-shimmer 1.4s ease-in-out infinite",
              }}
            />
          ))}
        </div>
        {/* Grid area skeleton */}
        <div
          style={{
            flex: 1,
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gridTemplateRows: "1fr 1fr",
            gap: 4,
            padding: 4,
          }}
        >
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              style={{
                borderRadius: 4,
                background: "var(--io-surface-secondary)",
                animation: "io-shimmer 1.4s ease-in-out infinite",
                animationDelay: `${i * 0.1}s`,
              }}
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        background: "var(--io-bg)",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 0,
          padding: "0 12px 0 0",
          height: 48,
          flexShrink: 0,
          background: "var(--io-surface)",
          borderBottom: "1px solid var(--io-border)",
        }}
      >
        {/* Module name — occupies the palette column in the header */}
        {!isKiosk && paletteVisible && (
          <div
            style={{
              width: panelWidth,
              minWidth: panelWidth,
              flexShrink: 0,
              display: "flex",
              alignItems: "center",
              padding: "0 16px",
              fontSize: 15,
              fontWeight: 600,
              color: "var(--io-text-primary)",
              borderRight: "1px solid var(--io-border)",
              height: "100%",
            }}
          >
            Console
          </div>
        )}
        {/* Workspace tabs */}
        <div
          style={{
            display: "flex",
            flex: 1,
            alignItems: "stretch",
            gap: 2,
            overflow: "hidden",
            paddingLeft: 10,
          }}
        >
          {workspaces
            .filter((ws) => openTabIds.includes(ws.id))
            .map((ws) => {
              const wsSnap = serverSnapshotsRef.current[ws.id];
              const wsIsDirty = wsSnap ? JSON.stringify(ws) !== wsSnap : false;
              return (
                <div
                  key={ws.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    borderBottom:
                      ws.id === activeId
                        ? "2px solid var(--io-accent)"
                        : "2px solid transparent",
                    height: "100%",
                    flexShrink: 0,
                  }}
                >
                  <button
                    onClick={() => setActiveId(ws.id)}
                    onContextMenu={(e) => handleTabContextMenu(e, ws.id)}
                    style={{
                      background: "transparent",
                      border: "none",
                      padding: "0 4px 0 10px",
                      cursor: "pointer",
                      fontSize: 13,
                      fontWeight: ws.id === activeId ? 600 : 400,
                      color:
                        ws.id === activeId
                          ? "var(--io-text-primary)"
                          : "var(--io-text-muted)",
                      whiteSpace: "nowrap",
                      height: "100%",
                      display: "flex",
                      alignItems: "center",
                      gap: 5,
                    }}
                  >
                    {ws.published && (
                      <span
                        title="Published workspace"
                        style={{ color: "var(--io-accent)", fontSize: 8 }}
                      >
                        ●
                      </span>
                    )}
                    {ws.name}
                    {wsIsDirty && (
                      <span
                        title="Unsaved changes"
                        style={{
                          display: "inline-block",
                          width: 6,
                          height: 6,
                          borderRadius: "50%",
                          background: "var(--io-warning)",
                          flexShrink: 0,
                        }}
                      />
                    )}
                  </button>
                  {/* Close tab button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCloseWorkspace(ws.id);
                    }}
                    title="Close workspace"
                    style={{
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      padding: "2px 6px 2px 2px",
                      display: "flex",
                      alignItems: "center",
                      color: "var(--io-text-muted)",
                      fontSize: 14,
                      lineHeight: 1,
                      opacity: 0.6,
                      height: "100%",
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.opacity = "1";
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.opacity = "0.6";
                    }}
                  >
                    ×
                  </button>
                </div>
              );
            })}

          {/* + New tab */}
          <button
            onClick={createWorkspace}
            title="New workspace"
            style={{
              background: "transparent",
              border: "none",
              padding: "0 10px",
              cursor: "pointer",
              fontSize: 18,
              color: "var(--io-text-muted)",
              display: "flex",
              alignItems: "center",
              lineHeight: 1,
            }}
          >
            +
          </button>
        </div>

        {/* Right-side controls */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            flexShrink: 0,
          }}
        >
          {activeWorkspace && (
            <>
              {/* Undo / Redo */}
              <button
                onClick={handleUndo}
                disabled={undoDepth === 0}
                title="Undo (Ctrl+Z)"
                style={{
                  background: "transparent",
                  border: "1px solid var(--io-border)",
                  borderRadius: 6,
                  padding: "4px 8px",
                  cursor: undoDepth === 0 ? "default" : "pointer",
                  fontSize: 12,
                  color:
                    undoDepth === 0
                      ? "var(--io-text-disabled)"
                      : "var(--io-text-muted)",
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                {/* Undo arrow */}
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M9 14 4 9l5-5" />
                  <path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" />
                </svg>
                Undo
              </button>
              <button
                onClick={handleRedo}
                disabled={redoDepth === 0}
                title="Redo (Ctrl+Y)"
                style={{
                  background: "transparent",
                  border: "1px solid var(--io-border)",
                  borderRadius: 6,
                  padding: "4px 8px",
                  cursor: redoDepth === 0 ? "default" : "pointer",
                  fontSize: 12,
                  color:
                    redoDepth === 0
                      ? "var(--io-text-disabled)"
                      : "var(--io-text-muted)",
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                Redo
                {/* Redo arrow */}
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="m15 14 5-5-5-5" />
                  <path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13" />
                </svg>
              </button>

              {/* Layout selector */}
              <select
                value={activeWorkspace.layout}
                onChange={(e) =>
                  handleChangeLayout(e.target.value as LayoutPreset)
                }
                style={{
                  background: "var(--io-surface-secondary)",
                  border: "1px solid var(--io-border)",
                  borderRadius: 6,
                  padding: "4px 8px",
                  fontSize: 12,
                  color: "var(--io-text-primary)",
                  cursor: "pointer",
                  outline: "none",
                }}
              >
                {LAYOUT_PRESETS.map((lp) => (
                  <option key={lp.value} value={lp.value}>
                    {lp.label}
                  </option>
                ))}
              </select>

              {/* Clear Grid button */}
              <button
                onClick={() => {
                  if (!activeId) return;
                  clearPanes(activeId);
                  const ws = useWorkspaceStore
                    .getState()
                    .workspaces.find((w) => w.id === activeId);
                  if (ws) persistWorkspace(ws);
                }}
                title="Clear all panes"
                style={{
                  background: "transparent",
                  border: "1px solid var(--io-border)",
                  borderRadius: 6,
                  padding: "4px 10px",
                  cursor: "pointer",
                  fontSize: 12,
                  color: "var(--io-text-muted)",
                }}
              >
                Clear
              </button>

              {/* Rename button */}
              <button
                onClick={() => {
                  setNameModal({
                    mode: "rename",
                    workspaceId: activeWorkspace.id,
                    initialName: activeWorkspace.name,
                    initialDescription: activeWorkspace.description ?? "",
                  });
                }}
                title="Rename workspace"
                style={{
                  background: "transparent",
                  border: "1px solid var(--io-border)",
                  borderRadius: 6,
                  padding: "4px 10px",
                  cursor: "pointer",
                  fontSize: 12,
                  color: "var(--io-text-muted)",
                }}
              >
                Rename
              </button>

              {/* Publish toggle — gated by console:workspace_publish permission */}
              {canPublish && (
                <button
                  onClick={() =>
                    publishMutation.mutate({
                      id: activeWorkspace.id,
                      published: !activeWorkspace.published,
                    })
                  }
                  title={
                    activeWorkspace.published
                      ? "Unpublish workspace (visible to all users)"
                      : "Publish workspace (make visible to all users)"
                  }
                  style={{
                    background: activeWorkspace.published
                      ? "var(--io-accent-subtle)"
                      : "transparent",
                    border: "1px solid var(--io-border)",
                    borderRadius: 6,
                    padding: "4px 10px",
                    cursor: "pointer",
                    fontSize: 12,
                    color: activeWorkspace.published
                      ? "var(--io-accent)"
                      : "var(--io-text-muted)",
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                  }}
                >
                  {activeWorkspace.published ? "● Published" : "○ Publish"}
                </button>
              )}

              {/* Delete workspace */}
              <button
                onClick={deleteActiveWorkspace}
                title="Delete workspace"
                style={{
                  background: "transparent",
                  border: "1px solid var(--io-border)",
                  borderRadius: 6,
                  padding: "4px 10px",
                  cursor: "pointer",
                  fontSize: 12,
                  color: "var(--io-danger)",
                }}
              >
                Delete
              </button>

              {/* Lock toggle button — replaces Edit/Done */}
              <button
                onClick={() => activeId && toggleLocked(activeId)}
                title={
                  isLocked
                    ? "Unlock workspace (enable drag/resize)"
                    : "Lock workspace (freeze layout)"
                }
                style={{
                  background: isLocked
                    ? "var(--io-accent-subtle)"
                    : "transparent",
                  border: "1px solid var(--io-border)",
                  borderRadius: 6,
                  padding: "4px 8px",
                  cursor: "pointer",
                  color: isLocked ? "var(--io-accent)" : "var(--io-text-muted)",
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                <svg
                  width="13"
                  height="13"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  {isLocked ? (
                    <>
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                    </>
                  ) : (
                    <>
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                      <path d="M7 11V7a5 5 0 0 1 9.9-1" />
                    </>
                  )}
                </svg>
                {isLocked ? "Locked" : "Lock"}
              </button>
            </>
          )}

          {/* Explicit Save / Save as Personal — shown when workspace is dirty */}
          {activeWorkspace &&
            (() => {
              const wsSnap = serverSnapshotsRef.current[activeWorkspace.id];
              const wsIsDirty = wsSnap
                ? JSON.stringify(activeWorkspace) !== wsSnap
                : false;
              if (!wsIsDirty) return null;
              if (canSaveWorkspace(activeWorkspace)) {
                return (
                  <button
                    onClick={handleExplicitSave}
                    title="Save workspace (Ctrl+S)"
                    style={{
                      background: "var(--io-accent)",
                      border: "none",
                      borderRadius: 6,
                      padding: "5px 14px",
                      cursor: "pointer",
                      fontSize: 13,
                      fontWeight: 600,
                      color: "#fff",
                    }}
                  >
                    Save
                  </button>
                );
              }
              if (canSaveAsPersonal(activeWorkspace)) {
                return (
                  <button
                    onClick={handleSaveAsPersonal}
                    title="Save a personal copy of this workspace"
                    style={{
                      background: "var(--io-accent)",
                      border: "none",
                      borderRadius: 6,
                      padding: "5px 14px",
                      cursor: "pointer",
                      fontSize: 13,
                      fontWeight: 600,
                      color: "#fff",
                    }}
                  >
                    Save as Personal
                  </button>
                );
              }
              return null;
            })()}

          {/* Aspect ratio toggle — always visible when a workspace is active */}
          {activeWorkspace && (
            <button
              onClick={() => setPreserveAspectRatio(!preserveAspectRatio)}
              title={
                preserveAspectRatio
                  ? "Preserve aspect ratio (click to stretch to fill pane)"
                  : "Stretch to fill pane (click to preserve aspect ratio)"
              }
              style={{
                background: preserveAspectRatio
                  ? "transparent"
                  : "var(--io-accent)",
                border: "1px solid var(--io-border)",
                borderRadius: 6,
                padding: "4px 8px",
                cursor: "pointer",
                fontSize: 12,
                color: preserveAspectRatio ? "var(--io-text-muted)" : "#fff",
                display: "flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              {/* Lock/unlock icon */}
              {preserveAspectRatio ? (
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
              ) : (
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 9.9-1" />
                </svg>
              )}
              AR
            </button>
          )}

          {/* TT — hide-all pane titles toggle (spec MOD-CONSOLE-038 §4) */}
          {activeWorkspace && (
            <button
              onClick={() => setHideTitles(!hideTitles)}
              title={
                hideTitles
                  ? "Pane titles hidden (click to restore)"
                  : "Hide all pane titles"
              }
              style={{
                background: hideTitles ? "var(--io-accent)" : "transparent",
                border: "1px solid var(--io-border)",
                borderRadius: 6,
                padding: "4px 8px",
                cursor: "pointer",
                fontSize: 12,
                fontWeight: 600,
                color: hideTitles ? "#fff" : "var(--io-text-muted)",
              }}
            >
              TT
            </button>
          )}

          {/* Export split button — gated by console:export */}
          {activeWorkspace && canExport && (
            <div style={{ position: "relative", display: "inline-flex" }}>
              {/* Left: open full Export Dialog */}
              <button
                onClick={() => setExportDialogOpen(true)}
                title="Export workspace data"
                style={{
                  background: "transparent",
                  border: "1px solid var(--io-border)",
                  borderRight: "none",
                  borderRadius: "6px 0 0 6px",
                  padding: "5px 10px",
                  cursor: "pointer",
                  fontSize: 13,
                  color: "var(--io-text-primary)",
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                  whiteSpace: "nowrap",
                }}
              >
                Export
              </button>
              {/* Right: chevron opens quick-format dropdown */}
              <button
                onClick={() => setExportDropdownOpen((v) => !v)}
                title="Quick export format"
                style={{
                  background: "transparent",
                  border: "1px solid var(--io-border)",
                  borderRadius: "0 6px 6px 0",
                  padding: "5px 7px",
                  cursor: "pointer",
                  fontSize: 11,
                  color: "var(--io-text-primary)",
                  display: "flex",
                  alignItems: "center",
                }}
              >
                <svg
                  width="10"
                  height="10"
                  viewBox="0 0 10 10"
                  fill="currentColor"
                >
                  <polygon points="2,3 8,3 5,7" />
                </svg>
              </button>
              {exportDropdownOpen && (
                <>
                  <div
                    style={{ position: "fixed", inset: 0, zIndex: 999 }}
                    onClick={() => setExportDropdownOpen(false)}
                  />
                  <div
                    style={{
                      position: "absolute",
                      top: "100%",
                      right: 0,
                      zIndex: 1000,
                      background: "var(--io-surface-elevated)",
                      border: "1px solid var(--io-border)",
                      borderRadius: 6,
                      boxShadow: "0 8px 24px rgba(0,0,0,0.3)",
                      overflow: "hidden",
                      minWidth: 140,
                      marginTop: 4,
                    }}
                  >
                    {(
                      [
                        { label: "CSV", fmt: "csv" },
                        { label: "XLSX", fmt: "xlsx" },
                        { label: "JSON", fmt: "json" },
                        { label: "PDF", fmt: "pdf" },
                        { label: "Parquet", fmt: "parquet" },
                        { label: "HTML", fmt: "html" },
                      ] as { label: string; fmt: ExportFormat }[]
                    ).map(({ label, fmt }) => (
                      <button
                        key={fmt}
                        onClick={() => {
                          void handleExport(fmt);
                        }}
                        style={{
                          display: "block",
                          width: "100%",
                          padding: "8px 14px",
                          background: "none",
                          border: "none",
                          textAlign: "left",
                          cursor: "pointer",
                          fontSize: 13,
                          color: "var(--io-text-primary)",
                        }}
                        onMouseEnter={(e) => {
                          (
                            e.currentTarget as HTMLButtonElement
                          ).style.background = "var(--io-surface-secondary)";
                        }}
                        onMouseLeave={(e) => {
                          (
                            e.currentTarget as HTMLButtonElement
                          ).style.background = "none";
                        }}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </>
              )}
              {/* Full Export Dialog */}
              <ExportDialog
                open={exportDialogOpen}
                onClose={() => setExportDialogOpen(false)}
                module="console"
                entity="workspace"
                filteredRowCount={(activeWorkspace.panes ?? []).reduce(
                  (n, p) => {
                    if (p.trendPointIds?.length)
                      return n + p.trendPointIds.length;
                    if (p.tablePointIds?.length)
                      return n + p.tablePointIds.length;
                    return n;
                  },
                  0,
                )}
                totalRowCount={(activeWorkspace.panes ?? []).reduce((n, p) => {
                  if (p.trendPointIds?.length)
                    return n + p.trendPointIds.length;
                  if (p.tablePointIds?.length)
                    return n + p.tablePointIds.length;
                  return n;
                }, 0)}
                availableColumns={[
                  { id: "tagname", label: "Tag Name" },
                  { id: "value", label: "Value" },
                  { id: "quality", label: "Quality" },
                  { id: "timestamp", label: "Timestamp" },
                  { id: "description", label: "Description" },
                  { id: "units", label: "Units" },
                ]}
                visibleColumns={["tagname", "value", "quality", "timestamp"]}
              />
            </div>
          )}

          {/* Close workspace */}
          {activeWorkspace && !isKiosk && (
            <button
              onClick={() => handleCloseWorkspace(activeWorkspace.id)}
              title="Close workspace"
              style={{
                background: "transparent",
                border: "1px solid var(--io-border)",
                borderRadius: 6,
                padding: "5px 8px",
                cursor: "pointer",
                color: "var(--io-text-muted)",
                display: "flex",
                alignItems: "center",
              }}
            >
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}

          {/* Publish toggle */}
          {activeWorkspace && canPublish && (
            <button
              onClick={() =>
                publishMutation.mutate({
                  id: activeWorkspace.id,
                  published: !activeWorkspace.published,
                })
              }
              title={
                activeWorkspace.published
                  ? "Unpublish workspace"
                  : "Publish workspace"
              }
              style={{
                background: activeWorkspace.published
                  ? "var(--io-accent-subtle)"
                  : "transparent",
                border: "1px solid var(--io-border)",
                borderRadius: 6,
                padding: "4px 10px",
                cursor: "pointer",
                fontSize: 12,
                color: activeWorkspace.published
                  ? "var(--io-accent)"
                  : "var(--io-text-muted)",
                display: "flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              {activeWorkspace.published ? "● Published" : "○ Publish"}
            </button>
          )}

          {/* Open in New Window */}
          {activeWorkspace && !isKiosk && (
            <button
              onClick={() =>
                window.open(
                  `/detached/console/${activeWorkspace.id}`,
                  "_blank",
                  "noopener,noreferrer,width=1400,height=900",
                )
              }
              title="Open workspace in new window"
              style={{
                background: "transparent",
                border: "1px solid var(--io-border)",
                borderRadius: 6,
                padding: "5px 8px",
                cursor: "pointer",
                color: "var(--io-text-primary)",
                display: "flex",
                alignItems: "center",
              }}
            >
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                <polyline points="15 3 21 3 21 9" />
                <line x1="10" y1="14" x2="21" y2="3" />
              </svg>
            </button>
          )}

          {/* Browser fullscreen toggle — always visible when workspace active (spec §CX-CONSOLE-WORKSPACE-FULLSCREEN) */}
          {activeWorkspace && (
            <button
              onClick={toggleFullscreen}
              title={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
              style={{
                background: "transparent",
                border: "1px solid var(--io-border)",
                borderRadius: 6,
                padding: "5px 8px",
                cursor: "pointer",
                color: "var(--io-text-primary)",
                display: "flex",
                alignItems: "center",
              }}
            >
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                {isFullscreen ? (
                  <path d="M8 3v3a2 2 0 0 1-2 2H3M21 8h-3a2 2 0 0 1-2-2V3M3 16h3a2 2 0 0 1 2 2v3M16 21v-3a2 2 0 0 1 2-2h3" />
                ) : (
                  <path d="M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3" />
                )}
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Body */}
      <div
        style={{
          flex: 1,
          overflow: "hidden",
          display: "flex",
          flexDirection: "row",
        }}
      >
        {/* Left palette — hidden in kiosk mode so pane content fills the screen */}
        {!isKiosk && (
          <ConsolePalette
            visible={paletteVisible}
            onToggle={() => setPaletteVisible((v) => !v)}
            onQuickPlace={handleQuickPlace}
            workspaces={workspaces}
            activeWorkspaceId={activeId}
            onSelectWorkspace={(id) => {
              explicitlyClosedIdsRef.current.delete(id);
              saveClosedTabIds(explicitlyClosedIdsRef.current);
              if (!openTabIds.includes(id)) {
                setOpenTabIds((prev) => [...prev, id]);
              }
              setActiveId(id);
            }}
            onRenameWorkspace={(id) => {
              const ws = workspaces.find((w) => w.id === id);
              if (!ws) return;
              setNameModal({
                mode: "rename",
                workspaceId: id,
                initialName: ws.name,
                initialDescription: ws.description ?? "",
              });
            }}
            onDuplicateWorkspace={duplicateWorkspace}
            onDeleteWorkspace={(id) => {
              const target = workspaces.find((w) => w.id === id);
              if (target)
                setDeleteDialog({
                  workspaceId: id,
                  workspaceName: target.name,
                });
            }}
            panelWidth={panelWidth}
            onPanelResizeMouseDown={onPanelResizeMouseDown}
            isPanelResizing={isPanelResizing}
          />
        )}

        {/* Workspace area */}
        <div
          style={{
            flex: 1,
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
            minHeight: 0,
          }}
        >
          {/* Swap mode banner */}
          {swapModeSourceId && (
            <div
              style={{
                flexShrink: 0,
                padding: "6px 14px",
                background: "var(--io-warning)",
                color: "var(--io-text-inverse)",
                fontSize: 12,
                display: "flex",
                alignItems: "center",
                gap: 10,
              }}
            >
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M7 16V4m0 0L3 8m4-4l4 4M17 8v12m0 0l4-4m-4 4l-4-4" />
              </svg>
              Click another pane to swap positions — press Escape to cancel
              <button
                onClick={() => setSwapModeSourceId(null)}
                style={{
                  marginLeft: "auto",
                  background: "none",
                  border: "none",
                  color: "var(--io-text-inverse)",
                  cursor: "pointer",
                  fontSize: 11,
                }}
              >
                Cancel
              </button>
            </div>
          )}
          {/* Auto-save failure banner — persistent until manually retried or save succeeds */}
          {showSaveBanner && (
            <div
              style={{
                flexShrink: 0,
                padding: "6px 14px",
                background: "var(--io-alarm-high)",
                color: "#fff",
                fontSize: 13,
                display: "flex",
                alignItems: "center",
                gap: 12,
              }}
            >
              <span>Workspace changes not saved</span>
              <button
                onClick={() => {
                  if (activeWorkspace) {
                    saveFailCountRef.current = 0;
                    setShowSaveBanner(false);
                    saveMutation.mutate(activeWorkspace);
                  }
                }}
                style={{
                  background: "rgba(0,0,0,0.25)",
                  border: "1px solid rgba(255,255,255,0.4)",
                  borderRadius: 4,
                  color: "#fff",
                  padding: "2px 10px",
                  cursor: "pointer",
                  fontSize: 12,
                }}
              >
                Save now
              </button>
            </div>
          )}

          {workspaces.length === 0 || openTabIds.length === 0 ? (
            /* Empty state */
            <div
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 16,
                color: "var(--io-text-muted)",
              }}
            >
              <svg
                width="56"
                height="56"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1"
              >
                <rect x="2" y="3" width="20" height="14" rx="2" />
                <line x1="12" y1="3" x2="12" y2="17" />
                <line x1="2" y1="10" x2="22" y2="10" />
                <line x1="8" y1="21" x2="16" y2="21" />
                <line x1="12" y1="17" x2="12" y2="21" />
              </svg>
              <div style={{ textAlign: "center", fontSize: 15 }}>
                <p
                  style={{
                    margin: "0 0 4px",
                    fontWeight: 600,
                    color: "var(--io-text-primary)",
                  }}
                >
                  {workspaces.length === 0
                    ? "No workspaces yet"
                    : "No open workspaces"}
                </p>
                <p style={{ margin: 0, fontSize: 13 }}>
                  {workspaces.length === 0
                    ? "Create your first workspace to start monitoring"
                    : "Open one from the palette, or create a new one"}
                </p>
              </div>
              <button
                onClick={createWorkspace}
                style={{
                  background: "var(--io-accent)",
                  color: "#fff",
                  border: "none",
                  borderRadius: 6,
                  padding: "9px 20px",
                  cursor: "pointer",
                  fontSize: 14,
                  fontWeight: 600,
                }}
              >
                Create Workspace
              </button>
            </div>
          ) : activeWorkspace ? (
            <WorkspaceGrid
              workspace={activeWorkspace}
              locked={isLocked}
              pinnedIds={pinnedIds}
              selectedPaneIds={selectedPaneIds}
              preserveAspectRatio={preserveAspectRatio}
              hideTitles={hideTitles}
              onConfigurePane={handleConfigurePane}
              onRemovePane={handleRemovePane}
              onSelectPane={handlePaneSelect}
              onPaletteDrop={handlePaletteDrop}
              onGridLayoutChange={handleGridLayoutChange}
              onWorkspaceContextMenu={handleWorkspaceContextMenu}
              swapModeSourceId={swapModeSourceId}
              onSwapWith={handleSwapWith}
              onSwapComplete={handleSwapComplete}
              onReplace={handleReplacePane}
              onPinToggle={handlePinToggle}
              onBrowserFullscreen={toggleFullscreen}
            />
          ) : (
            <div
              style={{
                flex: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--io-text-muted)",
                fontSize: 14,
              }}
            >
              Select a workspace above
            </div>
          )}

          {/* Historical Playback Bar — always shown at bottom of workspace area */}
          {workspaces.length > 0 && <HistoricalPlaybackBar />}

          {/* Status bar */}
          {workspaces.length > 0 && (
            <ConsoleStatusBar workspaceName={activeWorkspace?.name ?? ""} />
          )}
        </div>
      </div>

      {/* Pane config modal */}
      {configuringPane && (
        <PaneConfigModal
          pane={configuringPane}
          onSave={handleSavePane}
          onClose={() => setConfiguringPaneId(null)}
        />
      )}

      {/* Workspace background right-click menu (§14.1) */}
      {workspaceBgCtxMenu && (
        <ContextMenu
          x={workspaceBgCtxMenu.x}
          y={workspaceBgCtxMenu.y}
          onClose={() => setWorkspaceBgCtxMenu(null)}
          items={[
            {
              label: "Add Pane",
              onClick: () => {
                if (activeId) {
                  updateWorkspace(activeId, (w) => ({
                    ...w,
                    panes: [
                      ...w.panes,
                      {
                        id: `pane-${Date.now()}`,
                        type: "blank" as const,
                        title: "New Pane",
                      },
                    ],
                  }));
                  const ws = useWorkspaceStore
                    .getState()
                    .workspaces.find((w) => w.id === activeId);
                  if (ws) persistWorkspace(ws);
                }
                setWorkspaceBgCtxMenu(null);
              },
            },
            {
              label: "Paste",
              disabled: copiedPanesRef.current.length === 0,
              onClick: () => {
                if (activeId && copiedPanesRef.current.length > 0) {
                  const pasted = copiedPanesRef.current.map((p) => ({
                    ...p,
                    id: `pane-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                  }));
                  updateWorkspace(activeId, (w) => ({
                    ...w,
                    panes: [...w.panes, ...pasted],
                  }));
                  const ws = useWorkspaceStore
                    .getState()
                    .workspaces.find((w) => w.id === activeId);
                  if (ws) persistWorkspace(ws);
                }
                setWorkspaceBgCtxMenu(null);
              },
            },
            {
              label: "Select All",
              onClick: () => {
                if (activeId) {
                  const ws = useWorkspaceStore
                    .getState()
                    .workspaces.find((w) => w.id === activeId);
                  if (ws) selectAll(ws.panes.map((p) => p.id));
                }
                setWorkspaceBgCtxMenu(null);
              },
            },
            {
              label: "Clear Grid",
              divider: true,
              onClick: () => {
                if (activeId) {
                  updateWorkspace(activeId, (w) => ({ ...w, panes: [] }));
                  const ws = useWorkspaceStore
                    .getState()
                    .workspaces.find((w) => w.id === activeId);
                  if (ws) persistWorkspace(ws);
                }
                setWorkspaceBgCtxMenu(null);
              },
            },
            {
              label: "Workspace Properties…",
              onClick: () => {
                setWorkspaceBgCtxMenu(null);
                if (activeId) {
                  const ws = useWorkspaceStore
                    .getState()
                    .workspaces.find((w) => w.id === activeId);
                  setNameModal({
                    mode: "rename",
                    workspaceId: activeId,
                    initialName: ws?.name ?? "",
                    initialDescription: ws?.description ?? "",
                  });
                }
              },
            },
            {
              label: "Save and Close",
              onClick: () => {
                setWorkspaceBgCtxMenu(null);
                if (activeId) handleCloseWorkspace(activeId);
              },
            },
            {
              label: "Delete…",
              divider: true,
              onClick: () => {
                setWorkspaceBgCtxMenu(null);
                if (activeId) {
                  const ws = useWorkspaceStore
                    .getState()
                    .workspaces.find((w) => w.id === activeId);
                  if (ws)
                    setDeleteDialog({
                      workspaceId: activeId,
                      workspaceName: ws.name,
                    });
                }
              },
            },
          ]}
        />
      )}

      {/* Workspace name modal (create & rename) */}
      {nameModal && (
        <WorkspaceNameModal
          mode={nameModal.mode}
          initialName={nameModal.initialName}
          initialDescription={nameModal.initialDescription ?? ""}
          onConfirm={(name, description) => {
            if (nameModal.mode === "create") {
              confirmCreateWorkspace(name, description);
            } else if (nameModal.workspaceId) {
              handleRenameWorkspace(nameModal.workspaceId, name, description);
              setNameModal(null);
            }
          }}
          onCancel={() => setNameModal(null)}
        />
      )}

      {/* Close-without-save confirmation dialog */}
      {closeDialog && (
        <CloseConfirmDialog
          workspaceName={closeDialog.workspaceName}
          onSave={() => handleSaveAndClose(closeDialog.workspaceId)}
          onDiscard={() => handleDiscardAndClose(closeDialog.workspaceId)}
          onCancel={() => setCloseDialog(null)}
        />
      )}

      {/* Delete confirmation dialog */}
      {deleteDialog && (
        <DeleteConfirmDialog
          workspaceName={deleteDialog.workspaceName}
          onConfirm={() => confirmDeleteWorkspace(deleteDialog.workspaceId)}
          onCancel={() => setDeleteDialog(null)}
        />
      )}

      {/* Workspace tab context menu */}
      {tabContextMenu &&
        (() => {
          const ws = workspaces.find(
            (w) => w.id === tabContextMenu.workspaceId,
          );
          if (!ws) return null;
          return (
            <ContextMenu
              x={tabContextMenu.x}
              y={tabContextMenu.y}
              onClose={() => setTabContextMenu(null)}
              items={[
                {
                  label: "Switch to Workspace",
                  onClick: () => setActiveId(ws.id),
                },
                {
                  label: "Open in New Window",
                  onClick: () => {
                    window.open(
                      `/detached/console/${ws.id}`,
                      "_blank",
                      "noopener,noreferrer,width=1400,height=900",
                    );
                    setTabContextMenu(null);
                  },
                },
                {
                  label: isFavorite(ws.id)
                    ? "Remove from Favorites"
                    : "Add to Favorites",
                  onClick: () => {
                    toggleFavorite(ws.id);
                    setTabContextMenu(null);
                  },
                },
                {
                  label: "Rename…",
                  divider: false,
                  onClick: () => {
                    setNameModal({
                      mode: "rename",
                      workspaceId: ws.id,
                      initialName: ws.name,
                    });
                    setTabContextMenu(null);
                  },
                },
                {
                  label: "Duplicate",
                  onClick: () => duplicateWorkspace(ws.id),
                },
                {
                  label: "Save and Close",
                  onClick: () => {
                    setTabContextMenu(null);
                    handleCloseWorkspace(ws.id);
                  },
                },
                ...(canPublish
                  ? [
                      {
                        label: ws.published ? "Unpublish" : "Publish",
                        divider: false,
                        onClick: () =>
                          publishMutation.mutate({
                            id: ws.id,
                            published: !ws.published,
                          }),
                      },
                    ]
                  : []),
                {
                  label: "Delete…",
                  divider: true,
                  onClick: () => {
                    setTabContextMenu(null);
                    setDeleteDialog({
                      workspaceId: ws.id,
                      workspaceName: ws.name,
                    });
                  },
                },
              ]}
            />
          );
        })()}
    </div>
  );
}

// ---------------------------------------------------------------------------
// WorkspaceNameModal — used for both create and rename flows
// ---------------------------------------------------------------------------

function WorkspaceNameModal({
  mode,
  initialName,
  initialDescription = "",
  onConfirm,
  onCancel,
}: {
  mode: "create" | "rename";
  initialName: string;
  initialDescription?: string;
  onConfirm: (name: string, description: string) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription);

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && name.trim())
      onConfirm(name.trim(), description.trim());
    if (e.key === "Escape") onCancel();
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div
        style={{
          background: "var(--io-surface)",
          border: "1px solid var(--io-border)",
          borderRadius: 8,
          padding: "20px 24px",
          minWidth: 360,
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        <div style={{ fontSize: 14, fontWeight: 600, color: "var(--io-text)" }}>
          {mode === "create" ? "New Workspace" : "Rename Workspace"}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <label
            style={{
              fontSize: 11,
              color: "var(--io-text-muted)",
              fontWeight: 500,
            }}
          >
            Name
          </label>
          <input
            autoFocus
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Workspace name"
            style={{
              padding: "6px 10px",
              background: "var(--io-surface-elevated)",
              border: "1px solid var(--io-border)",
              borderRadius: 4,
              color: "var(--io-text)",
              fontSize: 13,
              outline: "none",
            }}
          />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <label
            style={{
              fontSize: 11,
              color: "var(--io-text-muted)",
              fontWeight: 500,
            }}
          >
            Description <span style={{ fontWeight: 400 }}>(optional)</span>
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") onCancel();
            }}
            placeholder="Brief description of this workspace"
            rows={3}
            style={{
              padding: "6px 10px",
              background: "var(--io-surface-elevated)",
              border: "1px solid var(--io-border)",
              borderRadius: 4,
              color: "var(--io-text)",
              fontSize: 13,
              outline: "none",
              resize: "vertical",
              fontFamily: "inherit",
            }}
          />
        </div>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button
            onClick={onCancel}
            style={{
              padding: "5px 14px",
              background: "transparent",
              border: "1px solid var(--io-border)",
              borderRadius: 4,
              color: "var(--io-text-muted)",
              fontSize: 12,
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
          <button
            onClick={() => {
              if (name.trim()) onConfirm(name.trim(), description.trim());
            }}
            disabled={!name.trim()}
            style={{
              padding: "5px 14px",
              background: "var(--io-accent)",
              border: "none",
              borderRadius: 4,
              color: "#fff",
              fontSize: 12,
              cursor: name.trim() ? "pointer" : "not-allowed",
              opacity: name.trim() ? 1 : 0.5,
            }}
          >
            {mode === "create" ? "Create" : "Rename"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// DeleteConfirmDialog — confirm before permanently deleting a workspace
// ---------------------------------------------------------------------------

function DeleteConfirmDialog({
  workspaceName,
  onConfirm,
  onCancel,
}: {
  workspaceName: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div
        style={{
          background: "var(--io-surface)",
          border: "1px solid var(--io-border)",
          borderRadius: 8,
          padding: "20px 24px",
          minWidth: 340,
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        <div style={{ fontSize: 14, fontWeight: 600, color: "var(--io-text)" }}>
          Delete workspace?
        </div>
        <div
          style={{
            fontSize: 13,
            color: "var(--io-text-muted)",
            lineHeight: 1.5,
          }}
        >
          <strong style={{ color: "var(--io-text)" }}>{workspaceName}</strong>{" "}
          will be permanently deleted. This cannot be undone.
        </div>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button
            onClick={onCancel}
            style={{
              padding: "5px 14px",
              background: "transparent",
              border: "1px solid var(--io-border)",
              borderRadius: 4,
              color: "var(--io-text-muted)",
              fontSize: 12,
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            style={{
              padding: "5px 14px",
              background: "var(--io-danger)",
              border: "none",
              borderRadius: 4,
              color: "#fff",
              fontSize: 12,
              cursor: "pointer",
            }}
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// CloseConfirmDialog — save / discard / cancel when closing with unsaved changes
// ---------------------------------------------------------------------------

function CloseConfirmDialog({
  workspaceName,
  onSave,
  onDiscard,
  onCancel,
}: {
  workspaceName: string;
  onSave: () => void;
  onDiscard: () => void;
  onCancel: () => void;
}) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div
        style={{
          background: "var(--io-surface)",
          border: "1px solid var(--io-border)",
          borderRadius: 8,
          padding: "20px 24px",
          minWidth: 340,
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        <div style={{ fontSize: 14, fontWeight: 600, color: "var(--io-text)" }}>
          Unsaved changes
        </div>
        <div
          style={{
            fontSize: 13,
            color: "var(--io-text-muted)",
            lineHeight: 1.5,
          }}
        >
          <strong style={{ color: "var(--io-text)" }}>{workspaceName}</strong>{" "}
          has unsaved changes. Save before closing?
        </div>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button
            onClick={onCancel}
            style={{
              padding: "5px 14px",
              background: "transparent",
              border: "1px solid var(--io-border)",
              borderRadius: 4,
              color: "var(--io-text-muted)",
              fontSize: 12,
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
          <button
            onClick={onDiscard}
            style={{
              padding: "5px 14px",
              background: "transparent",
              border: "1px solid var(--io-border)",
              borderRadius: 4,
              color: "var(--io-text-muted)",
              fontSize: 12,
              cursor: "pointer",
            }}
          >
            Discard
          </button>
          <button
            onClick={onSave}
            style={{
              padding: "5px 14px",
              background: "var(--io-accent)",
              border: "none",
              borderRadius: 4,
              color: "#fff",
              fontSize: 12,
              cursor: "pointer",
            }}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
