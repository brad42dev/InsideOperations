import { api, type ApiResult, type PaginatedResult } from "./client";
import type {
  WorkspaceLayout,
  PaneConfig,
  LayoutPreset,
  GridItem,
} from "../pages/console/types";

// ---------------------------------------------------------------------------
// WorkspaceSummary — shape returned by the backend (metadata blob)
// ---------------------------------------------------------------------------

interface WorkspaceSummary {
  id: string;
  name: string;
  metadata?: {
    layout?: LayoutPreset;
    panes?: PaneConfig[];
    gridItems?: GridItem[];
    overflowPanes?: PaneConfig[];
    published?: boolean;
  } | null;
  created_at?: string;
}

/**
 * Normalize a raw WorkspaceSummary (from the API) into a WorkspaceLayout.
 * The backend stores layout/panes/gridItems inside the `metadata` JSON column.
 * This function extracts those fields and ensures `panes` always defaults to [].
 */
function normalizeWorkspace(raw: WorkspaceSummary): WorkspaceLayout {
  const meta = raw.metadata ?? {};
  return {
    id: raw.id,
    name: raw.name,
    layout: meta.layout ?? "2x2",
    panes: Array.isArray(meta.panes) ? meta.panes : [],
    gridItems: Array.isArray(meta.gridItems) ? meta.gridItems : undefined,
    overflowPanes: Array.isArray(meta.overflowPanes)
      ? meta.overflowPanes
      : undefined,
    published: meta.published ?? false,
  };
}

export const consoleApi = {
  listWorkspaces: async (): Promise<ApiResult<WorkspaceLayout[]>> => {
    const result = await api.get<PaginatedResult<WorkspaceSummary>>(
      "/api/console/workspaces",
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
    ws: Omit<WorkspaceLayout, "id"> & { id?: string },
  ): Promise<ApiResult<WorkspaceLayout>> => {
    // Send the full workspace layout as the metadata blob so the backend stores it
    const body = {
      name: ws.name,
      metadata: {
        layout: ws.layout,
        panes: ws.panes,
        gridItems: ws.gridItems,
        overflowPanes: ws.overflowPanes,
        published: ws.published,
      },
      id: ws.id,
    };
    // Always use POST. The backend will handle both creation (new workspace)
    // and updates (existing workspace) using UPSERT logic (INSERT ... ON CONFLICT DO UPDATE).
    // This allows the frontend to always send the same request format, and the backend
    // handles whether to insert or update based on whether the ID already exists.
    const result = await api.post<WorkspaceSummary>(
      "/api/console/workspaces",
      body,
    );
    if (!result.success) return result;
    return { success: true, data: normalizeWorkspace(result.data) };
  },

  deleteWorkspace: (id: string): Promise<ApiResult<void>> =>
    api.delete<void>(`/api/console/workspaces/${id}`),

  publishWorkspace: async (
    id: string,
    published: boolean,
  ): Promise<ApiResult<WorkspaceLayout>> => {
    const result = await api.patch<WorkspaceSummary>(
      `/api/console/workspaces/${id}/publish`,
      { published },
    );
    if (!result.success) return result;
    return { success: true, data: normalizeWorkspace(result.data) };
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
};
