import { api, type ApiResult } from './client'

export interface AuthProviderConfig {
  id: string
  provider_type: 'oidc' | 'saml' | 'ldap'
  name: string
  display_name: string
  enabled: boolean
  config: Record<string, unknown>
  jit_provisioning: boolean
  default_role_id: string | null
  display_order: number
  created_at: string
  updated_at: string
}

export interface PublicProvider {
  id: string
  name: string
  display_name: string
  provider_type: string
  display_order: number
}

export interface IdpRoleMapping {
  id: string
  provider_config_id: string
  idp_group: string
  role_id: string
  match_type: string
  created_at: string
}

export interface CreateProviderBody {
  provider_type: string
  name: string
  display_name: string
  enabled?: boolean
  config: Record<string, unknown>
  jit_provisioning?: boolean
  default_role_id?: string | null
  display_order?: number
}

export const authProvidersApi = {
  listPublic: (): Promise<ApiResult<PublicProvider[]>> =>
    api.get('/api/auth/providers'),

  list: (): Promise<ApiResult<AuthProviderConfig[]>> =>
    api.get('/api/auth/admin/providers'),

  get: (id: string): Promise<ApiResult<AuthProviderConfig>> =>
    api.get(`/api/auth/admin/providers/${id}`),

  create: (body: CreateProviderBody): Promise<ApiResult<AuthProviderConfig>> =>
    api.post('/api/auth/admin/providers', body),

  update: (id: string, body: CreateProviderBody): Promise<ApiResult<AuthProviderConfig>> =>
    api.put(`/api/auth/admin/providers/${id}`, body),

  delete: (id: string): Promise<ApiResult<void>> =>
    api.delete(`/api/auth/admin/providers/${id}`),

  listMappings: (id: string): Promise<ApiResult<IdpRoleMapping[]>> =>
    api.get(`/api/auth/admin/providers/${id}/mappings`),

  createMapping: (
    id: string,
    body: { idp_group: string; role_id: string; match_type?: string },
  ): Promise<ApiResult<IdpRoleMapping>> =>
    api.post(`/api/auth/admin/providers/${id}/mappings`, body),

  deleteMapping: (id: string, mappingId: string): Promise<ApiResult<void>> =>
    api.delete(`/api/auth/admin/providers/${id}/mappings/${mappingId}`),
}
