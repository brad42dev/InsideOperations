---
id: DD-06-004
title: Implement password-based visual lock overlay (not click-to-unlock)
unit: DD-06
status: pending
priority: high
depends-on: []
---

## What This Feature Should Do

After an idle timeout, the screen enters a locked state with no visible change — data continues to flow. When the user moves the mouse or presses a key, a lock overlay fades in showing their avatar, username, and a password/PIN field. Correct password dismisses the overlay and resets the idle timer. The current implementation unlocks immediately on any click or keypress with no password challenge — it is a UI mockery of a lock, not a functional one.

## Spec Excerpt (verbatim)

> 1. User is idle for the role-configured timeout period (default 30 minutes)
> 2. Session transitions to locked state: **no visible change**. Data continues to flow.
> 3. User moves mouse, clicks, or presses a key → lock overlay fades in over 300ms:
>    - Semi-transparent dark backdrop (rgba(0,0,0,0.6)) over the entire viewport
>    - Centered lock card: user avatar, username, password/PIN field, "Unlock" button
>    - Data remains visible (dimmed) behind the overlay
> 4. If password entered correctly → overlay fades out (200ms), full interactive session restored, idle timer resets
> 5. If no password entry within 60 seconds → overlay fades away (300ms), returns to monitoring-only display
> 6. Three failed password attempts → follows existing auth lockout policy
> — 06_FRONTEND_SHELL.md, §Visual Lock Overlay

## Where to Look in the Codebase

Primary files:
- `frontend/src/shared/components/LockOverlay.tsx` — entire file needs rework
- `frontend/src/store/ui.ts` lines 11–45 — isLocked state, lock/unlock functions
- `frontend/src/shared/layout/AppShell.tsx` lines 25, 245–278 — IDLE_TIMEOUT_MS (currently 60s, spec says 30 min default)
- `frontend/src/api/auth.ts` — unlock API call target

## Verification Checklist

Read the code at the files listed above. Check each item:

- [ ] Lock overlay shows password/PIN input field and "Unlock" button, not just "click to continue"
- [ ] Unlock submits password via `POST /api/auth/unlock` or re-uses `POST /api/auth/login` (or equivalent)
- [ ] Three failed attempts triggers lockout (calls logout or shows lockout message)
- [ ] Auto-dismiss after 60 seconds of no input (returns to passive display, not logged out)
- [ ] Overlay fade-in is 300ms, fade-out is 200ms (CSS transition)
- [ ] IDLE_TIMEOUT_MS in AppShell is 30 minutes (1_800_000ms), not 60s
- [ ] Content-layer has `pointer-events: none` when locked (data renders but interaction blocked)

## Assessment

After checking:
- **Status**: ❌ Missing — LockOverlay.tsx unlocks on any keydown/mousedown (line 11–14). No password field. No API call. IDLE_TIMEOUT_MS is 60_000ms (1 minute) not 30 minutes.

## Fix Instructions

**1. Fix IDLE_TIMEOUT_MS in AppShell.tsx line 25:**
```typescript
const IDLE_TIMEOUT_MS = 30 * 60 * 1000  // 30 minutes per spec
```

**2. Rewrite LockOverlay.tsx:**

```typescript
import { useState, useRef, useEffect } from 'react'
import { useUiStore } from '../../store/ui'
import { useAuthStore } from '../../store/auth'

export default function LockOverlay() {
  const { isLocked, unlock } = useUiStore()
  const { user } = useAuthStore()
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [attempts, setAttempts] = useState(0)
  const autoDismissRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Auto-dismiss after 60 seconds if no password entered
  useEffect(() => {
    if (!isLocked) return
    if (autoDismissRef.current) clearTimeout(autoDismissRef.current)
    autoDismissRef.current = setTimeout(() => {
      // Return to monitoring-only (passive display) — not logged out, still locked
      // Overlay dismisses; next interaction re-triggers it
      unlock()  // passive: data flows, next interaction re-locks
    }, 60_000)
    return () => { if (autoDismissRef.current) clearTimeout(autoDismissRef.current) }
  }, [isLocked, unlock])

  if (!isLocked) return null

  async function handleUnlock(e: React.FormEvent) {
    e.preventDefault()
    if (!password.trim()) return
    try {
      const res = await fetch('/api/auth/verify-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('io_access_token') ?? ''}` },
        body: JSON.stringify({ password }),
      })
      if (res.ok) {
        unlock()
        setPassword('')
        setError('')
        setAttempts(0)
      } else {
        const next = attempts + 1
        setAttempts(next)
        if (next >= 3) {
          setError('Too many failed attempts. Session will end.')
          // After 3s, trigger logout
          setTimeout(() => { window.location.href = '/login' }, 3000)
        } else {
          setError(`Incorrect password. ${3 - next} attempt(s) remaining.`)
        }
        setPassword('')
      }
    } catch {
      setError('Unable to verify password. Check your connection.')
    }
  }

  return (
    <div role="dialog" aria-label="Screen locked" aria-modal="true"
      style={{ position: 'fixed', inset: 0, zIndex: 'var(--io-z-visual-lock)',
        background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center',
        justifyContent: 'center', animation: 'fadeIn 0.3s ease-out' }}>
      <form onSubmit={handleUnlock} style={{ background: 'var(--io-surface-elevated)',
        borderRadius: 'var(--io-radius-lg)', padding: '32px', minWidth: '300px',
        display: 'flex', flexDirection: 'column', gap: '16px', alignItems: 'center' }}>
        {/* Avatar, username, password field, unlock button */}
        ...
      </form>
    </div>
  )
}
```

Note: If `POST /api/auth/verify-password` does not yet exist in the API gateway, stub it or use the existing session token refresh as a signal. The UI architecture must be in place even if the backend endpoint is pending.

Do NOT:
- Unlock on any click (current behavior — remove the useEffect that listens for mousedown/keydown)
- Use `window.location.reload()` for lockout
- Use a z-index less than 500 (must use `var(--io-z-visual-lock)` = 500)
