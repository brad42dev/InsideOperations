/**
 * I/O ThemeContext
 *
 * Provides the active theme name and its associated canvas-compatible color set
 * to all child components. Chart components (uPlot, ECharts) subscribe to this
 * context to get theme colors without reading CSS custom properties.
 *
 * Also provides the active density mode (compact / default / comfortable) so
 * shared components like DataTable can respond to the global setting without
 * requiring a caller-supplied prop.
 *
 * Usage:
 *   const colors    = useThemeColors()   // ThemeColorSet for active theme
 *   const theme     = useThemeName()     // 'light' | 'dark' | 'hphmi'
 *   const setTheme  = useSetTheme()      // call to change active theme
 *   const density   = useDensity()       // 'compact' | 'default' | 'comfortable'
 *   const setDensity = useSetDensity()   // call to change density
 */

import React, { createContext, useContext, useState, useCallback } from "react";
import type { Theme } from "./tokens";
import { initTheme, setTheme as applyThemeTokens } from "./tokens";
import { themeColors } from "./theme-colors";
import type { ThemeColorSet } from "./theme-colors";

// ---------------------------------------------------------------------------
// Density type
// ---------------------------------------------------------------------------

export type Density = "compact" | "default" | "comfortable";

const DENSITY_STORAGE_KEY = "io:display:density";

function initDensity(): Density {
  const stored = localStorage.getItem(DENSITY_STORAGE_KEY);
  if (stored === "compact" || stored === "default" || stored === "comfortable")
    return stored;
  return "default";
}

// ---------------------------------------------------------------------------
// Context shape
// ---------------------------------------------------------------------------

export interface ThemeContextValue {
  /** The active theme name (matches the Theme type in tokens.ts) */
  theme: Theme;
  /** Canvas-compatible color set for the active theme */
  colors: ThemeColorSet;
  /** Change the active theme — updates CSS tokens AND React state */
  setTheme: (theme: Theme) => void;
  /** The active density setting */
  density: Density;
  /** Change the active density — updates React state (persisting to localStorage is the caller's responsibility) */
  setDensity: (d: Density) => void;
}

// ---------------------------------------------------------------------------
// Helper: map Theme → themeColors key
// ---------------------------------------------------------------------------

export function themeToColorKey(
  theme: Theme,
): "light" | "dark" | "high-contrast" {
  if (theme === "light") return "light";
  if (theme === "hphmi") return "high-contrast";
  return "dark";
}

// ---------------------------------------------------------------------------
// Context + Provider
// ---------------------------------------------------------------------------

const defaultValue: ThemeContextValue = {
  theme: "dark",
  colors: themeColors["dark"],
  setTheme: () => {},
  density: "default",
  setDensity: () => {},
};

export const ThemeContext = createContext<ThemeContextValue>(defaultValue);

export interface ThemeProviderProps {
  children: React.ReactNode;
}

/**
 * ThemeProvider — wrap the app root with this.
 * Initialises theme from localStorage/navigator, then exposes setTheme()
 * so any component can switch themes and trigger a React re-render (which
 * causes uPlot and ECharts consumers to pick up the new color set).
 */
export function ThemeProvider({ children }: ThemeProviderProps) {
  const [theme, setThemeState] = useState<Theme>(() => initTheme());
  const [density, setDensityState] = useState<Density>(() => initDensity());

  const handleSetTheme = useCallback((newTheme: Theme) => {
    applyThemeTokens(newTheme);
    setThemeState(newTheme);
  }, []);

  const handleSetDensity = useCallback((d: Density) => {
    setDensityState(d);
  }, []);

  const colors = themeColors[themeToColorKey(theme)];

  return (
    <ThemeContext.Provider
      value={{
        theme,
        colors,
        setTheme: handleSetTheme,
        density,
        setDensity: handleSetDensity,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

/**
 * useThemeColors — returns the ThemeColorSet for the currently active theme.
 * All canvas library configurations must call this hook to get colors.
 */
export function useThemeColors(): ThemeColorSet {
  return useContext(ThemeContext).colors;
}

/**
 * useThemeName — returns the active Theme string ('light' | 'dark' | 'hphmi').
 */
export function useThemeName(): Theme {
  return useContext(ThemeContext).theme;
}

/**
 * useSetTheme — returns the setTheme dispatcher that updates CSS tokens AND
 * React state. Components that switch themes (e.g. AppearancePage) should use
 * this instead of calling setTheme() from tokens.ts directly.
 */
export function useSetTheme(): (theme: Theme) => void {
  return useContext(ThemeContext).setTheme;
}

/**
 * useDensity — returns the active density value ('compact' | 'default' | 'comfortable').
 * Shared components (e.g. DataTable) read this to determine row heights and spacing.
 */
export function useDensity(): Density {
  return useContext(ThemeContext).density;
}

/**
 * useSetDensity — returns the setDensity dispatcher.
 * Settings pages call this (in addition to writing localStorage) to propagate
 * the change to all mounted components without a page reload.
 */
export function useSetDensity(): (d: Density) => void {
  return useContext(ThemeContext).setDensity;
}
