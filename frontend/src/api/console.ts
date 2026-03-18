import { api, type ApiResult } from './client'
import type { WorkspaceLayout } from '../pages/console/types'

export const consoleApi = {
  listWorkspaces: (): Promise<ApiResult<WorkspaceLayout[]>> =>
    api.get<WorkspaceLayout[]>('/api/console/workspaces'),

  getWorkspace: (id: string): Promise<ApiResult<WorkspaceLayout>> =>
    api.get<WorkspaceLayout>(`/api/console/workspaces/${id}`),

  saveWorkspace: (
    ws: Omit<WorkspaceLayout, 'id'> & { id?: string },
  ): Promise<ApiResult<WorkspaceLayout>> => {
    if (ws.id) {
      return api.put<WorkspaceLayout>(`/api/console/workspaces/${ws.id}`, ws)
    }
    return api.post<WorkspaceLayout>('/api/console/workspaces', ws)
  },

  deleteWorkspace: (id: string): Promise<ApiResult<void>> =>
    api.delete<void>(`/api/console/workspaces/${id}`),

  publishWorkspace: (id: string, published: boolean): Promise<ApiResult<WorkspaceLayout>> =>
    api.patch<WorkspaceLayout>(`/api/console/workspaces/${id}/publish`, { published }),

  shareWorkspace: (
    id: string,
    grantees: Array<{ id: string; type: 'user' | 'group'; permission: 'view' | 'edit' }>,
  ): Promise<ApiResult<void>> =>
    api.post<void>(`/api/console/workspaces/${id}/share`, { grantees }),
}
