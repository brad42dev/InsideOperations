import { api } from './client'

export interface LoginRequest {
  username: string
  password: string
}

export interface AuthUser {
  id: string
  username: string
  full_name: string | null
  email: string
  eula_accepted?: boolean
}

export interface LoginResponse {
  access_token: string
  token_type: string
  expires_in: number
  user: AuthUser
}

export interface RefreshResponse {
  access_token: string
  expires_in: number
}

export interface AuthProvider {
  id: string
  name: string
  display_name: string
  provider_type: string
}

export interface EulaVersion {
  id: string
  eula_type: 'installer' | 'end_user'
  version: string
  title: string
  content: string
  published_at: string | null
}

/** One item returned by GET /auth/eula/pending */
export interface EulaPendingItem {
  eula_type: 'installer' | 'end_user'
  id: string
  version: string
  title: string
  content: string
  published_at: string
}

export interface EulaStatus {
  accepted: boolean
  accepted_at: string | null
  version: string | null
}

export const authApi = {
  login: (req: LoginRequest) => api.post<LoginResponse>('/api/auth/login', req),
  logout: () => api.post<void>('/api/auth/logout', {}),
  refresh: () => api.post<RefreshResponse>('/api/auth/refresh', {}),
  providers: () => api.get<AuthProvider[]>('/api/auth/providers'),

  /** Fetch the active EULA for the given type (default: end_user) */
  eulaGetCurrent: (type: 'installer' | 'end_user' = 'end_user') =>
    api.get<EulaVersion>(`/api/auth/eula/current?type=${type}`),

  /** Returns ordered list of EULAs this user still needs to accept */
  eulaGetPending: () => api.get<EulaPendingItem[]>('/api/auth/eula/pending'),

  /** Accept a specific EULA version */
  eulaAccept: (
    version: string,
    eula_type: 'installer' | 'end_user' = 'end_user',
    acceptance_context: 'installer' | 'installer_admin' | 'login' | 'version_update' = 'login',
  ) =>
    api.post<{ accepted: boolean; receipt_token: string }>(
      '/api/auth/eula/accept',
      { version, eula_type, acceptance_context },
    ),

  /** @deprecated use eulaGetPending instead */
  eulaStatus: () => api.get<EulaStatus>('/api/auth/eula/status'),
}
