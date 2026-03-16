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
  version: string
  title: string
  content: string
  published_at: string | null
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
  eulaGetCurrent: () => api.get<EulaVersion>('/api/auth/eula/current'),
  eulaStatus: () => api.get<EulaStatus>('/api/auth/eula/status'),
  eulaAccept: (version: string) => api.post<{ accepted: boolean }>('/api/auth/eula/accept', { version }),
}
