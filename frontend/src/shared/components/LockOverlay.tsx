import { useState, useRef, useEffect, useCallback } from 'react'
import { useUiStore } from '../../store/ui'
import { useAuthStore } from '../../store/auth'
import { authApi } from '../../api/auth'

const AUTO_DISMISS_MS = 60_000 // 60 seconds of no input → passive monitoring mode
const FADE_IN_MS = 300
const FADE_OUT_MS = 200

export default function LockOverlay() {
  const { isLocked, unlock } = useUiStore()
  const { user } = useAuthStore()

  // 'hidden' | 'entering' | 'visible' | 'exiting'
  const [phase, setPhase] = useState<'hidden' | 'entering' | 'visible' | 'exiting'>('hidden')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [attempts, setAttempts] = useState(0)
  const [lockedOut, setLockedOut] = useState(false)

  const autoDismissRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const fadeOutTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Dismiss the overlay with a fade-out animation
  const dismissOverlay = useCallback(() => {
    if (autoDismissRef.current) clearTimeout(autoDismissRef.current)
    setPhase('exiting')
    fadeOutTimerRef.current = setTimeout(() => {
      setPhase('hidden')
    }, FADE_OUT_MS)
  }, [])

  // Show the overlay with a fade-in animation and start the auto-dismiss timer
  const showOverlay = useCallback(() => {
    if (!isLocked) return
    if (fadeOutTimerRef.current) clearTimeout(fadeOutTimerRef.current)
    setPhase('entering')
    // After animation completes, switch to stable 'visible' phase
    setTimeout(() => setPhase('visible'), FADE_IN_MS)
    // Reset auto-dismiss timer
    if (autoDismissRef.current) clearTimeout(autoDismissRef.current)
    autoDismissRef.current = setTimeout(dismissOverlay, AUTO_DISMISS_MS)
  }, [isLocked, dismissOverlay])

  // Reset state when lock is re-triggered
  useEffect(() => {
    if (isLocked) {
      setPhase('hidden')
      setPassword('')
      setError('')
      setAttempts(0)
      setLockedOut(false)
    } else {
      // Unlocked — clean up
      if (autoDismissRef.current) clearTimeout(autoDismissRef.current)
      if (fadeOutTimerRef.current) clearTimeout(fadeOutTimerRef.current)
      setPhase('hidden')
    }
  }, [isLocked])

  // Listen for mouse/keyboard to fade in the overlay
  useEffect(() => {
    if (!isLocked) return

    function handleInteraction() {
      showOverlay()
    }

    window.addEventListener('mousemove', handleInteraction)
    window.addEventListener('mousedown', handleInteraction)
    window.addEventListener('keydown', handleInteraction)
    window.addEventListener('touchstart', handleInteraction)

    return () => {
      window.removeEventListener('mousemove', handleInteraction)
      window.removeEventListener('mousedown', handleInteraction)
      window.removeEventListener('keydown', handleInteraction)
      window.removeEventListener('touchstart', handleInteraction)
    }
  }, [isLocked, showOverlay])

  // Auto-focus password input when overlay becomes visible
  useEffect(() => {
    if (phase === 'visible' || phase === 'entering') {
      inputRef.current?.focus()
    }
  }, [phase])

  // Reset auto-dismiss timer whenever password field receives input
  function handlePasswordChange(e: React.ChangeEvent<HTMLInputElement>) {
    setPassword(e.target.value)
    if (autoDismissRef.current) clearTimeout(autoDismissRef.current)
    autoDismissRef.current = setTimeout(dismissOverlay, AUTO_DISMISS_MS)
  }

  async function handleUnlock(e: React.FormEvent) {
    e.preventDefault()
    if (!password.trim() || lockedOut) return

    try {
      const result = await authApi.verifyPassword(password)
      if (result.success) {
        setPassword('')
        setError('')
        setAttempts(0)
        if (autoDismissRef.current) clearTimeout(autoDismissRef.current)
        dismissOverlay()
        // Wait for fade-out to complete before calling unlock
        setTimeout(() => unlock(), FADE_OUT_MS)
      } else {
        const next = attempts + 1
        setAttempts(next)
        setPassword('')
        if (next >= 3) {
          setLockedOut(true)
          setError('Too many failed attempts. Redirecting to login…')
          setTimeout(() => {
            window.location.href = '/login'
          }, 3000)
        } else {
          setError(`Incorrect password. ${3 - next} attempt${3 - next === 1 ? '' : 's'} remaining.`)
        }
      }
    } catch {
      setError('Unable to verify password. Check your connection.')
    }
  }

  if (!isLocked || phase === 'hidden') return null

  const displayName = user?.full_name ?? user?.username ?? 'Unknown User'
  const initials = displayName
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  const animationStyle =
    phase === 'exiting'
      ? 'lockOverlayFadeOut 0.2s ease-in forwards'
      : 'lockOverlayFadeIn 0.3s ease-out forwards'

  return (
    <div
      role="dialog"
      aria-label="Screen locked"
      aria-modal="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 'var(--io-z-visual-lock)' as unknown as number,
        background: 'rgba(0,0,0,0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        animation: animationStyle,
      }}
    >
      <form
        onSubmit={handleUnlock}
        style={{
          background: 'var(--io-surface-elevated)',
          border: '1px solid var(--io-border)',
          borderRadius: 'var(--io-radius-lg, 12px)',
          padding: '32px',
          minWidth: '300px',
          maxWidth: '360px',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          alignItems: 'center',
          boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
        }}
      >
        {/* Avatar */}
        <div
          aria-hidden="true"
          style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            background: 'var(--io-accent-subtle)',
            border: '2px solid var(--io-accent)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '22px',
            fontWeight: 700,
            color: 'var(--io-accent)',
            letterSpacing: '-0.5px',
            userSelect: 'none',
          }}
        >
          {initials || 'IO'}
        </div>

        {/* Username */}
        <div
          style={{
            fontSize: '16px',
            fontWeight: 600,
            color: 'var(--io-text-primary)',
            textAlign: 'center',
          }}
        >
          {displayName}
        </div>

        <div
          style={{
            fontSize: '13px',
            color: 'var(--io-text-muted)',
            textAlign: 'center',
            marginTop: '-8px',
          }}
        >
          Session locked. Enter your password to continue.
        </div>

        {/* Password field */}
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <label
            htmlFor="lock-password"
            style={{ fontSize: '12px', color: 'var(--io-text-secondary)', fontWeight: 500 }}
          >
            Password
          </label>
          <input
            id="lock-password"
            ref={inputRef}
            type="password"
            value={password}
            onChange={handlePasswordChange}
            autoComplete="current-password"
            disabled={lockedOut}
            placeholder="Enter password or PIN"
            style={{
              width: '100%',
              padding: '8px 12px',
              background: 'var(--io-surface-input, var(--io-surface))',
              border: `1px solid ${error ? 'var(--io-destructive, #ef4444)' : 'var(--io-border)'}`,
              borderRadius: 'var(--io-radius, 6px)',
              color: 'var(--io-text-primary)',
              fontSize: '14px',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>

        {/* Error message */}
        {error && (
          <div
            role="alert"
            style={{
              width: '100%',
              fontSize: '12px',
              color: 'var(--io-destructive, #ef4444)',
              textAlign: 'center',
              padding: '6px 10px',
              background: 'rgba(239,68,68,0.1)',
              borderRadius: 'var(--io-radius, 6px)',
            }}
          >
            {error}
          </div>
        )}

        {/* Unlock button */}
        <button
          type="submit"
          disabled={lockedOut || !password.trim()}
          style={{
            width: '100%',
            padding: '10px 16px',
            background: 'var(--io-accent)',
            color: 'var(--io-accent-foreground, #fff)',
            border: 'none',
            borderRadius: 'var(--io-radius, 6px)',
            fontSize: '14px',
            fontWeight: 600,
            cursor: lockedOut || !password.trim() ? 'not-allowed' : 'pointer',
            opacity: lockedOut || !password.trim() ? 0.6 : 1,
            transition: 'opacity 0.15s',
          }}
        >
          Unlock
        </button>
      </form>

      <style>{`
        @keyframes lockOverlayFadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes lockOverlayFadeOut {
          from { opacity: 1; }
          to   { opacity: 0; }
        }
      `}</style>
    </div>
  )
}
