import { create } from 'zustand'
import { type Theme, setTheme as applyTheme, initTheme } from '../shared/theme/tokens'

interface EmergencyAlert {
  active: boolean
  message: string
}

interface UiState {
  theme: Theme
  isLocked: boolean
  isKiosk: boolean
  emergencyAlert: EmergencyAlert

  setTheme: (theme: Theme) => void
  lock: () => void
  unlock: () => void
  setKiosk: (kiosk: boolean) => void
  showEmergencyAlert: (message: string) => void
  dismissEmergencyAlert: () => void
}

export const useUiStore = create<UiState>((set) => ({
  theme: initTheme(),
  isLocked: false,
  isKiosk: false,
  emergencyAlert: { active: false, message: '' },

  setTheme: (theme: Theme) => {
    applyTheme(theme)
    set({ theme })
  },

  lock: () => set({ isLocked: true }),

  unlock: () => set({ isLocked: false }),

  setKiosk: (kiosk: boolean) => set({ isKiosk: kiosk }),

  showEmergencyAlert: (message: string) =>
    set({ emergencyAlert: { active: true, message } }),

  dismissEmergencyAlert: () =>
    set({ emergencyAlert: { active: false, message: '' } }),
}))
