/**
 * I/O ThemeContext
 *
 * Provides the active theme name and its associated canvas-compatible color set
 * to all child components. Chart components (uPlot, ECharts) subscribe to this
 * context to get theme colors without reading CSS custom properties.
 *
 * Usage:
 *   const colors    = useThemeColors()   // ThemeColorSet for active theme
 *   const theme     = useThemeName()     // 'light' | 'dark' | 'hphmi'
 *   const setTheme  = useSetTheme()      // call to change active theme
 */

import React, { createContext, useContext, useState, useCallback } from 'react'
import type { Theme } from './tokens'
import { initTheme, setTheme as applyThemeTokens } from './tokens'
import { themeColors } from './theme-colors'
import type { ThemeColorSet } from './theme-colors'

// ---------------------------------------------------------------------------
// Context shape
// ---------------------------------------------------------------------------

export interface ThemeContextValue {
  /** The active theme name (matches the Theme type in tokens.ts) */
  theme: Theme
  /** Canvas-compatible color set for the active theme */
  colors: ThemeColorSet
  /** Change the active theme — updates CSS tokens AND React state */
  setTheme: (theme: Theme) => void
}

// ---------------------------------------------------------------------------
// Helper: map Theme → themeColors key
// ---------------------------------------------------------------------------

export function themeToColorKey(theme: Theme): 'light' | 'dark' | 'high-contrast' {
  if (theme === 'light') return 'light'
  if (theme === 'hphmi') return 'high-contrast'
  return 'dark'
}

// ---------------------------------------------------------------------------
// Context + Provider
// ---------------------------------------------------------------------------

const defaultValue: ThemeContextValue = {
  theme: 'dark',
  colors: themeColors['dark'],
  setTheme: () => {},
}

export const ThemeContext = createContext<ThemeContextValue>(defaultValue)

export interface ThemeProviderProps {
  children: React.ReactNode
}

/**
 * ThemeProvider — wrap the app root with this.
 * Initialises theme from localStorage/navigator, then exposes setTheme()
 * so any component can switch themes and trigger a React re-render (which
 * causes uPlot and ECharts consumers to pick up the new color set).
 */
export function ThemeProvider({ children }: ThemeProviderProps) {
  const [theme, setThemeState] = useState<Theme>(() => initTheme())

  const handleSetTheme = useCallback((newTheme: Theme) => {
    applyThemeTokens(newTheme)
    setThemeState(newTheme)
  }, [])

  const colors = themeColors[themeToColorKey(theme)]

  return (
    <ThemeContext.Provider value={{ theme, colors, setTheme: handleSetTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

/**
 * useThemeColors — returns the ThemeColorSet for the currently active theme.
 * All canvas library configurations must call this hook to get colors.
 */
export function useThemeColors(): ThemeColorSet {
  return useContext(ThemeContext).colors
}

/**
 * useThemeName — returns the active Theme string ('light' | 'dark' | 'hphmi').
 */
export function useThemeName(): Theme {
  return useContext(ThemeContext).theme
}

/**
 * useSetTheme — returns the setTheme dispatcher that updates CSS tokens AND
 * React state. Components that switch themes (e.g. AppearancePage) should use
 * this instead of calling setTheme() from tokens.ts directly.
 */
export function useSetTheme(): (theme: Theme) => void {
  return useContext(ThemeContext).setTheme
}
