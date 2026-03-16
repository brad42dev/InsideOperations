import { api } from './client'

export interface ApiKey {
  id: string
  name: string
  key_prefix: string
  scopes: string[]
  expires_at: string | null
  last_used_at: string | null
  created_at: string
}

export interface CreateApiKeyPayload {
  name: string
  scopes?: string[]
  expires_at?: string
}

export interface CreateApiKeyResponse {
  id: string
  name: string
  key: string
  key_prefix: string
  scopes: string[]
  expires_at: string | null
}

export const apiKeysApi = {
  list: () => api.get<ApiKey[]>('/api/api-keys'),

  create: (payload: CreateApiKeyPayload) =>
    api.post<CreateApiKeyResponse>('/api/api-keys', payload),

  delete: (id: string) => api.delete<{ message: string }>(`/api/api-keys/${id}`),
}
