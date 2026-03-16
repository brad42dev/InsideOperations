import { api, ApiResult } from './client'

export interface OpcServerCert {
  id: string
  source_id: string | null
  source_name: string | null
  fingerprint: string
  fingerprint_display: string
  subject: string | null
  issuer: string | null
  not_before: string | null
  not_after: string | null
  expired: boolean
  /** "pending" | "trusted" | "rejected" */
  status: string
  auto_trusted: boolean
  reviewed_by: string | null
  reviewed_at: string | null
  first_seen_at: string
  last_seen_at: string
}

export const opcCertsApi = {
  list(): Promise<ApiResult<OpcServerCert[]>> {
    return api.get('/api/opc/server-certs')
  },

  get(id: string): Promise<ApiResult<OpcServerCert>> {
    return api.get(`/api/opc/server-certs/${id}`)
  },

  trust(id: string): Promise<ApiResult<OpcServerCert>> {
    return api.post(`/api/opc/server-certs/${id}/trust`, {})
  },

  reject(id: string): Promise<ApiResult<OpcServerCert>> {
    return api.post(`/api/opc/server-certs/${id}/reject`, {})
  },

  delete(id: string): Promise<ApiResult<void>> {
    return api.delete(`/api/opc/server-certs/${id}`)
  },
}
