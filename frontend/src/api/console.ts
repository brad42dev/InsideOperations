import { api, type ApiResult, type PaginatedResult } from "./client";
import type {
  WorkspaceLayout,
  PaneConfig,
  LayoutPreset,
  GridItem,
} from "../pages/console/types";
import { migrateGridItems } from "../pages/console/layout-utils";
import type {
  VersionSummary,
  WorkspaceVersionContent,
} from "../shared/types/versioning";

// ---------------------------------------------------------------------------
// WorkspaceSummary — shape returned by the backend
// ---------------------------------------------------------------------------

interface WorkspaceSummary {
  id: string;
  name: string;
  owner_id?: string;
  published?: boolean;
  metadata?: {
    layout?: LayoutPreset;
    panes?: PaneConfig[];
    gridItems?: GridItem[];
    overflowPanes?: PaneConfig[];
    description?: string;
  } | null;
  created_at?: string;
}

function normalizeWorkspace(raw: WorkspaceSummary): WorkspaceLayout {
  const meta = raw.metadata ?? {};
  return {
    id: raw.id,
    name: raw.name,
    layout: meta.layout ?? "2x2",
    panes: Array.isArray(meta.panes) ? meta.panes : [],
    gridItems: Array.isArray(meta.gridItems)
      ? migrateGridItems(meta.gridItems)
      : undefined,
    overflowPanes: Array.isArray(meta.overflowPanes)
      ? meta.overflowPanes
      : undefined,
    published: raw.published ?? false,
    owner_id: raw.owner_id,
    description: meta.description,
  };
}

export const consoleApi = {
  listWorkspaces: async (params?: {
    includeAllUsers?: boolean;
  }): Promise<ApiResult<WorkspaceLayout[]>> => {
    const qs = params?.includeAllUsers ? "?include_all_users=true" : "";
    const result = await api.get<PaginatedResult<WorkspaceSummary>>(
      `/api/console/workspaces${qs}`,
    );
    if (!result.success) return result;
    const items = Array.isArray(result.data.data) ? result.data.data : [];
    return { success: true, data: items.map(normalizeWorkspace) };
  },

  getWorkspace: async (id: string): Promise<ApiResult<WorkspaceLayout>> => {
    const result = await api.get<WorkspaceSummary>(
      `/api/console/workspaces/${id}`,
    );
    if (!result.success) return result;
    return { success: true, data: normalizeWorkspace(result.data) };
  },

  saveWorkspace: async (
    ws: Omit<WorkspaceLayout, "id"> & { id?: string; label?: string },
  ): Promise<ApiResult<WorkspaceLayout>> => {
    const body: Record<string, unknown> = {
      name: ws.name,
      metadata: {
        layout: ws.layout,
        panes: ws.panes,
        gridItems: ws.gridItems,
        overflowPanes: ws.overflowPanes,
        description: ws.description,
      },
      id: ws.id,
    };
    if (ws.label !== undefined) body.label = ws.label;
    const result = await api.post<WorkspaceSummary>(
      "/api/console/workspaces",
      body,
    );
    if (!result.success) return result;
    return { success: true, data: normalizeWorkspace(result.data) };
  },

  saveWorkspaceSnapshot: async (
    ws: Omit<WorkspaceLayout, "id">,
  ): Promise<ApiResult<{ id: string }>> => {
    const body = {
      name: ws.name,
      metadata: {
        layout: ws.layout,
        panes: ws.panes,
        gridItems: ws.gridItems,
        overflowPanes: ws.overflowPanes,
        published: false,
        description: ws.description,
      },
    };
    const result = await api.post<WorkspaceSummary>(
      "/api/console/workspaces/snapshots",
      body,
    );
    if (!result.success) return result;
    return { success: true, data: { id: result.data.id } };
  },

  deleteWorkspace: (id: string): Promise<ApiResult<void>> =>
    api.delete<void>(`/api/console/workspaces/${id}`),

  recoverWorkspace: (id: string): Promise<ApiResult<{ id: string; recovered: boolean }>> =>
    api.post(`/api/console/workspaces/${id}/recover`, {}),

  permanentDeleteWorkspace: (id: string): Promise<ApiResult<{ id: string; permanently_deleted: boolean }>> =>
    api.delete(`/api/console/workspaces/${id}/permanent`),

  publishWorkspace: async (
    id: string,
    published: boolean,
  ): Promise<ApiResult<{ published: boolean; version?: number }>> => {
    const endpoint = published
      ? `/api/console/workspaces/${id}/publish`
      : `/api/console/workspaces/${id}/unpublish`;
    return api.post<{ published: boolean; version?: number }>(endpoint, {});
  },

  shareWorkspace: (
    id: string,
    grantees: Array<{
      id: string;
      type: "user" | "group";
      permission: "view" | "edit";
    }>,
  ): Promise<ApiResult<void>> =>
    api.post<void>(`/api/console/workspaces/${id}/share`, { grantees }),

  // ── Workspace versioning ─────────────────────────────────────────────────

  listWorkspaceVersions: (id: string, opts?: { includeDeleted?: boolean }) =>
    api.get<VersionSummary[]>(
      `/api/console/workspaces/${id}/versions${opts?.includeDeleted ? "?include_deleted=true" : ""}`,
    ),

  getWorkspaceVersionContent: (id: string, versionNumber: number) =>
    api.get<WorkspaceVersionContent>(
      `/api/console/workspaces/${id}/versions/${versionNumber}`,
    ),

  restoreWorkspaceVersion: (id: string, versionNumber: number) =>
    api.post<{ version_number: number }>(
      `/api/console/workspaces/${id}/versions/${versionNumber}/restore`,
      {},
    ),

  softDeleteWorkspaceVersion: (id: string, versionNumber: number) =>
    api.delete<{ deleted: boolean }>(
      `/api/console/workspaces/${id}/versions/${versionNumber}`,
    ),

  recoverWorkspaceVersion: (id: string, versionNumber: number) =>
    api.post<{ recovered: boolean }>(
      `/api/console/workspaces/${id}/versions/${versionNumber}/recover`,
      {},
    ),

  permanentDeleteWorkspaceVersion: (id: string, versionNumber: number) =>
    api.delete<{ permanently_deleted: boolean }>(
      `/api/console/workspaces/${id}/versions/${versionNumber}/permanent`,
    ),

  updateWorkspaceVersionLabel: (
    id: string,
    versionNumber: number,
    label: string | null,
  ) =>
    api.patch<{ version_number: number; label: string | null }>(
      `/api/console/workspaces/${id}/versions/${versionNumber}`,
      { label },
    ),
};
