import { api, PaginatedResult } from './client'

export interface Permission {
  id: string
  module: string
  name: string
  description: string | null
}

export interface Role {
  id: string
  name: string
  display_name: string
  description: string | null
  is_predefined: boolean
  created_at: string
  permission_count: number
}

export interface RoleDetail extends Role {
  permissions: Permission[]
}

export interface CreateRoleRequest {
  name: string
  display_name: string
  description?: string
  permissions?: string[]
}

export interface UpdateRoleRequest {
  display_name?: string
  description?: string
  permissions?: string[]
}

export const rolesApi = {
  list: () => api.get<PaginatedResult<Role>>('/api/roles'),

  get: (id: string) => api.get<RoleDetail>(`/api/roles/${id}`),

  create: (req: CreateRoleRequest) => api.post<Role>('/api/roles', req),

  update: (id: string, req: UpdateRoleRequest) =>
    api.put<RoleDetail>(`/api/roles/${id}`, req),

  delete: (id: string) => api.delete(`/api/roles/${id}`),
}

export const permissionsApi = {
  list: () => api.get<Permission[]>('/api/permissions'),
}
