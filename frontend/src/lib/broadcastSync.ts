/**
 * BroadcastChannel sync — io-app-sync
 *
 * Synchronises theme changes, auth refreshes, density changes, and session
 * lock/unlock events across all open browser windows/tabs of the application.
 *
 * spec: 06_FRONTEND_SHELL.md §BroadcastChannel State Sync
 */

type SyncMessageType =
  | 'theme:change'
  | 'density:change'
  | 'auth:refresh'
  | 'session:lock'
  | 'session:unlock'

export interface SyncMessage {
  type: SyncMessageType
  /** Present on theme:change */
  theme?: string
  /** Present on density:change */
  density?: string
  /** Present on auth:refresh — the new access token */
  token?: string
}

// Guard for SSR / environments without BroadcastChannel (e.g. some test runners)
const chan: BroadcastChannel | null =
  typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('io-app-sync') : null

/** Publish a theme change to all other windows. */
export function publishThemeChange(theme: string): void {
  chan?.postMessage({ type: 'theme:change', theme } satisfies SyncMessage)
}

/** Publish a density-mode change to all other windows. */
export function publishDensityChange(density: string): void {
  chan?.postMessage({ type: 'density:change', density } satisfies SyncMessage)
}

/** Publish a token refresh so all windows stay authenticated. */
export function publishAuthRefresh(token: string): void {
  chan?.postMessage({ type: 'auth:refresh', token } satisfies SyncMessage)
}

/** Publish a session-lock event — all windows will show the lock overlay. */
export function publishSessionLock(): void {
  chan?.postMessage({ type: 'session:lock' } satisfies SyncMessage)
}

/** Publish a session-unlock event — all windows will dismiss the lock overlay. */
export function publishSessionUnlock(): void {
  chan?.postMessage({ type: 'session:unlock' } satisfies SyncMessage)
}

/**
 * Subscribe to incoming sync messages from other windows.
 *
 * Returns an unsubscribe function — call it in a useEffect cleanup.
 */
export function subscribeToSync(handler: (msg: SyncMessage) => void): () => void {
  if (!chan) return () => {}

  const listener = (event: MessageEvent<SyncMessage>) => {
    handler(event.data)
  }
  chan.addEventListener('message', listener)
  return () => chan.removeEventListener('message', listener)
}
