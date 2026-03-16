export type Theme = 'light' | 'dark' | 'hphmi'

const THEME_KEY = 'io_theme'

const darkTokens: Record<string, string> = {
  '--io-surface-primary': '#09090b',
  '--io-surface-secondary': '#18181b',
  '--io-surface-elevated': '#27272a',
  '--io-surface-sunken': '#09090b',
  '--io-text-primary': '#fafafa',
  '--io-text-secondary': '#a1a1aa',
  '--io-text-muted': '#71717a',
  '--io-accent': '#2dd4bf',
  '--io-accent-hover': '#14b8a6',
  '--io-accent-subtle': 'rgba(45,212,191,0.1)',
  '--io-border': '#3f3f46',
  '--io-border-subtle': '#27272a',
  '--io-danger': '#ef4444',
  '--io-success': '#22c55e',
  '--io-warning': '#f59e0b',
  '--io-space-1': '4px',
  '--io-space-2': '8px',
  '--io-space-3': '12px',
  '--io-space-4': '16px',
  '--io-space-6': '24px',
  '--io-space-8': '32px',
  '--io-radius': '6px',
  '--io-sidebar-width': '220px',
  '--io-topbar-height': '48px',
}

const lightTokens: Record<string, string> = {
  '--io-surface-primary': '#ffffff',
  '--io-surface-secondary': '#f9fafb',
  '--io-surface-elevated': '#ffffff',
  '--io-surface-sunken': '#f3f4f6',
  '--io-text-primary': '#09090b',
  '--io-text-secondary': '#52525b',
  '--io-text-muted': '#a1a1aa',
  '--io-accent': '#0d9488',
  '--io-accent-hover': '#0f766e',
  '--io-accent-subtle': 'rgba(13,148,136,0.08)',
  '--io-border': '#e4e4e7',
  '--io-border-subtle': '#f4f4f5',
  '--io-danger': '#ef4444',
  '--io-success': '#22c55e',
  '--io-warning': '#f59e0b',
  '--io-space-1': '4px',
  '--io-space-2': '8px',
  '--io-space-3': '12px',
  '--io-space-4': '16px',
  '--io-space-6': '24px',
  '--io-space-8': '32px',
  '--io-radius': '6px',
  '--io-sidebar-width': '220px',
  '--io-topbar-height': '48px',
}

const hphmiTokens: Record<string, string> = {
  '--io-surface-primary': '#0f172a',
  '--io-surface-secondary': '#1e293b',
  '--io-surface-elevated': '#334155',
  '--io-surface-sunken': '#0c1525',
  '--io-text-primary': '#e2e8f0',
  '--io-text-secondary': '#94a3b8',
  '--io-text-muted': '#64748b',
  '--io-accent': '#2dd4bf',
  '--io-accent-hover': '#14b8a6',
  '--io-accent-subtle': 'rgba(45,212,191,0.08)',
  '--io-border': '#334155',
  '--io-border-subtle': '#1e293b',
  '--io-danger': '#ef4444',
  '--io-success': '#22c55e',
  '--io-warning': '#f59e0b',
  '--io-space-1': '4px',
  '--io-space-2': '8px',
  '--io-space-3': '12px',
  '--io-space-4': '16px',
  '--io-space-6': '24px',
  '--io-space-8': '32px',
  '--io-radius': '6px',
  '--io-sidebar-width': '220px',
  '--io-topbar-height': '48px',
}

function applyTokens(tokens: Record<string, string>): void {
  const root = document.documentElement
  for (const [key, value] of Object.entries(tokens)) {
    root.style.setProperty(key, value)
  }
}

export function initTheme(): Theme {
  const stored = localStorage.getItem(THEME_KEY)
  const theme: Theme =
    stored === 'light' || stored === 'dark' || stored === 'hphmi' ? stored : 'dark'
  document.documentElement.setAttribute('data-theme', theme)
  if (theme === 'light') {
    applyTokens(lightTokens)
  } else if (theme === 'hphmi') {
    applyTokens(hphmiTokens)
  } else {
    applyTokens(darkTokens)
  }
  return theme
}

export function setTheme(theme: Theme): void {
  localStorage.setItem(THEME_KEY, theme)
  document.documentElement.setAttribute('data-theme', theme)
  if (theme === 'light') {
    applyTokens(lightTokens)
  } else if (theme === 'hphmi') {
    applyTokens(hphmiTokens)
  } else {
    applyTokens(darkTokens)
  }
}

export { darkTokens, lightTokens, hphmiTokens }
