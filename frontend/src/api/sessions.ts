import { api, queryString, PaginatedResult } from "./client";

export interface Session {
  id: string;
  user_id: string;
  username: string;
  email: string;
  full_name: string | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
  last_accessed_at: string;
  expires_at: string;
}

export interface MySession {
  id: string;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
  last_accessed_at: string;
  expires_at: string;
}

export const sessionsApi = {
  list: (params?: { page?: number; limit?: number; user_id?: string }) =>
    api.get<PaginatedResult<Session>>(
      `/api/auth/admin/sessions${queryString(params)}`,
    ),

  revoke: (id: string) => api.delete(`/api/auth/admin/sessions/${id}`),

  revokeAllForUser: (userId: string) =>
    api.delete(`/api/auth/admin/sessions/user/${userId}`),

  listMine: () => api.get<MySession[]>("/api/auth/sessions/mine"),

  /** Revoke one of the current user's own sessions (ownership enforced server-side). */
  revokeMine: (id: string) => api.delete(`/api/auth/sessions/mine/${id}`),
};
