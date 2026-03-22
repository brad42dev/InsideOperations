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

/**
 * Response from POST /api/auth/verify-password and POST /api/auth/verify-pin.
 * On success the server returns 200 with `{ ok: true }`.
 * On wrong credential: 401 (handled as a non-2xx response by the api client).
 * On soft rate limit: 429 with `{ retry_after_seconds: number }`.
 * On hard rate limit (forced sign-out): 401 with `{ reason: "forced_signout" }`.
 */
export interface VerifyUnlockOk {
  ok: true
}

export interface VerifySsoUnlockRequest {
  token: string
}

/**
 * Response from GET /api/auth/me — current session check.
 * Includes lock state and provider metadata so the frontend can sync on boot.
 */
export interface SessionCheckResponse {
  id: string
  username: string
  full_name: string | null
  email: string
  permissions: string[]
  /** True if the session is currently locked server-side. */
  is_locked: boolean
  /** Authentication provider used for this session. */
  auth_provider: 'local' | 'oidc' | 'saml' | 'ldap'
  /** Display name of the SSO provider (e.g. "Azure AD"). Empty for local accounts. */
  auth_provider_name: string
  /** True if the user has a PIN set for lock screen unlock. */
  has_pin: boolean
  /** Per-session idle timeout in milliseconds. Undefined → use default. */
  idle_timeout_ms?: number
}

export const authApi = {
  login: (req: LoginRequest) => api.post<LoginResponse>('/api/auth/login', req),
  logout: () => api.post<void>('/api/auth/logout', {}),
  refresh: () => api.post<RefreshResponse>('/api/auth/refresh', {}),
  providers: () => api.get<AuthProvider[]>('/api/auth/providers'),

  /**
   * Persist session lock state server-side.
   * Called by the idle timer when it fires so the locked state survives a
   * page refresh.  Backend: POST /api/auth/lock
   */
  lockSession: () => api.post<{ locked: boolean }>('/api/auth/lock', {}),

  /**
   * Verify current user's password during the visual lock overlay.
   * Backend: POST /api/auth/verify-password  { password }
   * Returns 200 OK { ok: true } on success.
   * 401 on wrong password (or forced_signout reason on hard rate limit).
   * 429 on soft rate limit (retry_after_seconds in body).
   */
  verifyPassword: (password: string) =>
    api.post<VerifyUnlockOk>('/api/auth/verify-password', { password }),

  /**
   * Verify current user's PIN during the visual lock overlay.
   * Backend: POST /api/auth/verify-pin  { pin }
   * Same contract as verifyPassword.
   */
  verifyPin: (pin: string) =>
    api.post<VerifyUnlockOk>('/api/auth/verify-pin', { pin }),

  /**
   * Exchange an SSO callback token (from popup postMessage) for session unlock.
   * Backend: POST /api/auth/verify-sso-unlock  { token }
   * Returns 200 OK { ok: true } on success.
   */
  verifySsoUnlock: (token: string) =>
    api.post<VerifyUnlockOk>('/api/auth/verify-sso-unlock', { token }),

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

  /**
   * GET /api/auth/me — returns current session info including lock state.
   * Called on app boot to sync is_locked, auth_provider, has_pin without
   * needing a WebSocket event.
   */
  sessionCheck: () => api.get<SessionCheckResponse>('/api/auth/me'),

  /** @deprecated use eulaGetPending instead */
  eulaStatus: () => api.get<EulaStatus>('/api/auth/eula/status'),
}
