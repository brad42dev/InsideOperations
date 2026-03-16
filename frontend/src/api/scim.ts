import { api } from './client'

export interface ScimToken {
  id: string
  name: string
  description: string | null
  enabled: boolean
  last_used_at: string | null
  created_at: string
}

export interface CreateScimTokenPayload {
  name: string
  description?: string
}

export interface CreateScimTokenResponse {
  id: string
  name: string
  token: string // plaintext — shown once
}

export const scimApi = {
  listTokens: () => api.get<ScimToken[]>('/api/auth/admin/scim-tokens'),

  createToken: (payload: CreateScimTokenPayload) =>
    api.post<CreateScimTokenResponse>('/api/auth/admin/scim-tokens', payload),

  deleteToken: (id: string) =>
    api.delete<{ message: string }>(`/api/auth/admin/scim-tokens/${id}`),
}
