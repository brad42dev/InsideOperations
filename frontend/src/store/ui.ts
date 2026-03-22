import { create } from 'zustand'
import { type Theme, setTheme as applyTheme, initTheme } from '../shared/theme/tokens'

interface EmergencyAlert {
  active: boolean
  message: string
}

/**
 * Lock state extended with server-provided session metadata.
 * authProvider and hasPin are populated from the session check response
 * (is_locked=true) or when the idle timer fires POST /api/auth/lock.
 */
export interface LockMeta {
  /** 'local' | 'oidc' | 'saml' | 'ldap' — from session check response */
  authProvider: 'local' | 'oidc' | 'saml' | 'ldap'
  /** Display name of the SSO provider (e.g. "Azure AD") — only meaningful for non-local */
  authProviderName: string
  /** true if the user has a PIN set on their account */
  hasPin: boolean
}

interface UiState {
  theme: Theme
  isLocked: boolean
  lockMeta: LockMeta
  isKiosk: boolean
  emergencyAlert: EmergencyAlert

  setTheme: (theme: Theme) => void
  lock: (meta?: Partial<LockMeta>) => void
  unlock: () => void
  setLockMeta: (meta: Partial<LockMeta>) => void
  setKiosk: (kiosk: boolean) => void
  showEmergencyAlert: (message: string) => void
  dismissEmergencyAlert: () => void
}

const DEFAULT_LOCK_META: LockMeta = {
  authProvider: 'local',
  authProviderName: '',
  hasPin: false,
}

export const useUiStore = create<UiState>((set) => ({
  theme: initTheme(),
  isLocked: false,
  lockMeta: { ...DEFAULT_LOCK_META },
  isKiosk: false,
  emergencyAlert: { active: false, message: '' },

  setTheme: (theme: Theme) => {
    applyTheme(theme)
    set({ theme })
  },

  lock: (meta?: Partial<LockMeta>) =>
    set((state) => ({
      isLocked: true,
      lockMeta: { ...state.lockMeta, ...meta },
    })),

  unlock: () =>
    set({
      isLocked: false,
      lockMeta: { ...DEFAULT_LOCK_META },
    }),

  setLockMeta: (meta: Partial<LockMeta>) =>
    set((state) => ({
      lockMeta: { ...state.lockMeta, ...meta },
    })),

  setKiosk: (kiosk: boolean) => set({ isKiosk: kiosk }),

  showEmergencyAlert: (message: string) =>
    set({ emergencyAlert: { active: true, message } }),

  dismissEmergencyAlert: () =>
    set({ emergencyAlert: { active: false, message: '' } }),
}))
