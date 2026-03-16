import { describe, it, expect } from 'vitest'

// ---------------------------------------------------------------------------
// formatBytes — replicated from src/pages/settings/Recognition.tsx
// The function is unexported so we test its contract inline here.
// ---------------------------------------------------------------------------

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`
}

describe('formatBytes', () => {
  it('returns "0 B" for 0', () => {
    expect(formatBytes(0)).toBe('0 B')
  })

  it('returns "1.0 KB" for 1024', () => {
    expect(formatBytes(1024)).toBe('1.0 KB')
  })

  it('returns "1.0 MB" for 1048576', () => {
    expect(formatBytes(1048576)).toBe('1.0 MB')
  })

  it('returns "1.0 GB" for 1073741824', () => {
    expect(formatBytes(1073741824)).toBe('1.0 GB')
  })

  it('returns bytes label for values under 1 KB', () => {
    expect(formatBytes(512)).toBe('512.0 B')
  })

  it('handles fractional KB correctly', () => {
    expect(formatBytes(1536)).toBe('1.5 KB')
  })
})

// ---------------------------------------------------------------------------
// Permission check — mirrors the logic used throughout the app
// (useAuthStore.getState().user?.permissions.includes(perm))
// ---------------------------------------------------------------------------

describe('permission array check', () => {
  const permissions = ['settings.view', 'users.manage', 'reports.view']

  it('returns true when permission is in array', () => {
    expect(permissions.includes('settings.view')).toBe(true)
  })

  it('returns false when permission is not in array', () => {
    expect(permissions.includes('rounds.manage')).toBe(false)
  })

  it('returns false for empty permissions array', () => {
    expect([].includes('settings.view' as never)).toBe(false)
  })

  it('is case-sensitive', () => {
    expect(permissions.includes('Settings.View')).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// queryString helper from src/api/client.ts
// ---------------------------------------------------------------------------

function queryString(params?: Record<string, unknown>): string {
  if (!params) return ''
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== null)
  if (entries.length === 0) return ''
  return '?' + entries.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`).join('&')
}

describe('queryString', () => {
  it('returns empty string for no params', () => {
    expect(queryString()).toBe('')
  })

  it('returns empty string for empty object', () => {
    expect(queryString({})).toBe('')
  })

  it('serialises a single param', () => {
    expect(queryString({ page: 1 })).toBe('?page=1')
  })

  it('omits null and undefined values', () => {
    expect(queryString({ page: 1, filter: null, sort: undefined })).toBe('?page=1')
  })

  it('encodes special characters', () => {
    const qs = queryString({ q: 'hello world' })
    expect(qs).toBe('?q=hello%20world')
  })
})
