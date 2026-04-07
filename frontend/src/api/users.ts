import { api, queryString, PaginatedResult } from "./client";

export interface User {
  id: string;
  username: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  display_name: string | null;
  /** Legacy field — kept for compat. Derived from first_name + last_name. */
  full_name: string | null;
  phone_number: string | null;
  enabled: boolean;
  auth_provider: string;
  created_at: string;
  last_login_at: string | null;
}

export interface UserRole {
  id: string;
  name: string;
  display_name: string;
}

export interface UserGroup {
  id: string;
  name: string;
}

export interface UserDetail extends User {
  roles: UserRole[];
  groups: UserGroup[];
}

export interface CreateUserRequest {
  username: string;
  email: string;
  first_name?: string;
  last_name?: string;
  display_name?: string;
  phone_number?: string;
  password: string;
  role_ids?: string[];
  group_ids?: string[];
}

export interface UpdateUserRequest {
  email?: string;
  first_name?: string;
  last_name?: string;
  display_name?: string;
  phone_number?: string;
  enabled?: boolean;
  role_ids?: string[];
  group_ids?: string[];
  password?: string;
}

export interface ListUsersParams {
  page?: number;
  limit?: number;
  search?: string;
}

export const usersApi = {
  list: (params?: ListUsersParams) =>
    api.get<PaginatedResult<User>>(
      `/api/users${queryString(params as Record<string, unknown>)}`,
    ),

  get: (id: string) => api.get<UserDetail>(`/api/users/${id}`),

  create: (req: CreateUserRequest) => api.post<User>("/api/users", req),

  update: (id: string, req: UpdateUserRequest) =>
    api.put<UserDetail>(`/api/users/${id}`, req),

  delete: (id: string) => api.delete(`/api/users/${id}`),
};
