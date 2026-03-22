import { api, queryString, PaginatedResult } from './client'
import { UserRole } from './users'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Group {
  id: string
  name: string
  description: string | null
  role_count: number
  member_count: number
  created_at: string
}

export interface GroupRole {
  id: string
  name: string
  display_name: string
}

export interface GroupMember {
  id: string
  user_id: string
  username: string
  email: string
  full_name: string | null
  added_at: string
}

export interface GroupDetail extends Group {
  roles: GroupRole[]
}

export interface CreateGroupRequest {
  name: string
  description?: string
  role_ids?: string[]
}

export interface UpdateGroupRequest {
  name?: string
  description?: string
  role_ids?: string[]
}

export interface ListGroupsParams {
  page?: number
  limit?: number
  search?: string
}

export interface AddMemberRequest {
  user_id: string
}

// Re-export for convenience
export type { UserRole }

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------

export const groupsApi = {
  list: (params?: ListGroupsParams) =>
    api.get<PaginatedResult<Group>>(`/api/groups${queryString(params as Record<string, unknown>)}`),

  get: (id: string) => api.get<GroupDetail>(`/api/groups/${id}`),

  create: (req: CreateGroupRequest) => api.post<Group>('/api/groups', req),

  update: (id: string, req: UpdateGroupRequest) => api.put<GroupDetail>(`/api/groups/${id}`, req),

  delete: (id: string) => api.delete(`/api/groups/${id}`),

  listMembers: (groupId: string) =>
    api.get<PaginatedResult<GroupMember>>(`/api/groups/${groupId}/members`),

  addMember: (groupId: string, req: AddMemberRequest) =>
    api.post<GroupMember>(`/api/groups/${groupId}/members`, req),

  removeMember: (groupId: string, userId: string) =>
    api.delete(`/api/groups/${groupId}/members/${userId}`),
}
