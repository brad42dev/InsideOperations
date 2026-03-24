/**
 * LockOverlay — Visual lock screen (DD-06-011)
 *
 * Behaviour summary:
 * - Session can be locked without any visible change (passive locked state).
 *   Data continues updating; pointer-events: none on content layer (managed by
 *   AppShell). No overlay is rendered until the user interacts.
 * - First click or keypress while locked → overlay fades in (300ms).
 *   The triggering click is consumed (does not pass through to content).
 *   Passive mouse movement never triggers the overlay.
 * - 60-second no-input auto-dismiss: overlay fades out (300ms), session stays
 *   locked. Next interaction triggers it again.
 * - Escape in kiosk: dismisses overlay → passive locked state. Does not unlock.
 * - Unlock card content varies by authProvider + hasPin (see table in spec).
 * - After 3 consecutive PIN failures: "Try password instead?" option.
 * - 429 response: disabled input + countdown timer.
 * - 401 forced_signout: brief message then logout + /login redirect.
 * - SSO popup: window.open IdP popup, postMessage back, verify-sso-unlock call.
 * - Popup blocked: inline notice in card.
 */

import {
  useState,
  useRef,
  useEffect,
  useCallback,
  type FormEvent,
  type ChangeEvent,
} from 'react'
import { useUiStore } from '../../store/ui'
import { useAuthStore } from '../../store/auth'
import { authApi } from '../../api/auth'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const AUTO_DISMISS_MS = 60_000  // 60 s of no input → return to passive state
const FADE_IN_MS = 300
const FADE_OUT_MS = 200
const PIN_FAILURE_THRESHOLD = 3  // after this many PIN failures, offer password fallback

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type OverlayPhase = 'hidden' | 'entering' | 'visible' | 'exiting'

/** Which credential mode the card currently shows */
type UnlockMode = 'pin' | 'password' | 'sso'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Format seconds as M:SS */
function formatCountdown(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

function buildInitials(displayName: string): string {
  return displayName
    .split(' ')
    .map((n) => n[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

/** Extract forced_signout reason from an error response body */
async function isForcedSignout(err: unknown): Promise<boolean> {
  if (err instanceof Response) {
    try {
      const body = await err.clone().json() as Record<string, unknown>
      return body?.reason === 'forced_signout'
    } catch {
      return false
    }
  }
  // api client may wrap as { status, body } object — check common shapes
  if (
    err &&
    typeof err === 'object' &&
    'status' in err &&
    'body' in err
  ) {
    const cast = err as { status: number; body?: Record<string, unknown> }
    if (cast.status === 401 && cast.body?.reason === 'forced_signout') return true
  }
  return false
}

/** Extract retry_after_seconds from a 429 response body */
async function extractRetryAfter(err: unknown): Promise<number> {
  // Default: 5 minutes
  const fallback = 300
  if (err instanceof Response) {
    try {
      const body = await err.clone().json() as Record<string, unknown>
      if (typeof body?.retry_after_seconds === 'number') return body.retry_after_seconds as number
    } catch {
      return fallback
    }
  }
  if (
    err &&
    typeof err === 'object' &&
    'body' in err
  ) {
    const cast = err as { body?: Record<string, unknown> }
    if (typeof cast.body?.retry_after_seconds === 'number') return cast.body.retry_after_seconds as number
  }
  return fallback
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function LockOverlay() {
  const { isLocked, lockMeta, lockImmediate, unlock, clearLockImmediate } = useUiStore()
  const { user, logout } = useAuthStore()

  const { authProvider, authProviderName, hasPin } = lockMeta

  // Overlay animation phase
  const [phase, setPhase] = useState<OverlayPhase>('hidden')

  // Which unlock mode is active
  const [unlockMode, setUnlockMode] = useState<UnlockMode>('password')

  // Credential input value (shared for password/PIN)
  const [inputValue, setInputValue] = useState('')

  // Error/status message
  const [errorMsg, setErrorMsg] = useState('')

  // Whether the input is disabled (during submit or rate-limit)
  const [inputDisabled, setInputDisabled] = useState(false)

  // Rate-limit countdown in seconds; 0 = not counting down
  const [countdown, setCountdown] = useState(0)

  // Consecutive PIN failure count (for offering password fallback)
  const [pinFailures, setPinFailures] = useState(0)

  // Whether user is in "forced signout" state (brief message before redirect)
  const [forcedSignout, setForcedSignout] = useState(false)

  // Whether the SSO popup was blocked
  const [ssoPopupBlocked, setSsoPopupBlocked] = useState(false)

  // Whether an unlock request is in-flight
  const [isSubmitting, setIsSubmitting] = useState(false)

  const autoDismissRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const fadeOutTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const ssoMessageHandlerRef = useRef<((e: MessageEvent) => void) | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Keep stable refs for callbacks used in event listeners
  const isLockedRef = useRef(isLocked)
  isLockedRef.current = isLocked
  const isKioskRef = useRef(useUiStore.getState().isKiosk)
  // Sync kiosk ref on each render
  isKioskRef.current = useUiStore.getState().isKiosk

  // ---------------------------------------------------------------------------
  // Overlay visibility helpers
  // ---------------------------------------------------------------------------

  const dismissOverlay = useCallback(() => {
    if (autoDismissRef.current) clearTimeout(autoDismissRef.current)
    setPhase('exiting')
    fadeOutTimerRef.current = setTimeout(() => {
      setPhase('hidden')
    }, FADE_OUT_MS)
  }, [])

  const showOverlay = useCallback(() => {
    if (!isLockedRef.current) return
    if (fadeOutTimerRef.current) clearTimeout(fadeOutTimerRef.current)
    setPhase('entering')
    setTimeout(() => setPhase('visible'), FADE_IN_MS)
    // Reset auto-dismiss timer
    if (autoDismissRef.current) clearTimeout(autoDismissRef.current)
    autoDismissRef.current = setTimeout(dismissOverlay, AUTO_DISMISS_MS)
  }, [dismissOverlay])

  const resetAutoDismiss = useCallback(() => {
    if (autoDismissRef.current) clearTimeout(autoDismissRef.current)
    autoDismissRef.current = setTimeout(dismissOverlay, AUTO_DISMISS_MS)
  }, [dismissOverlay])

  // ---------------------------------------------------------------------------
  // Lock state changes — reset UI, determine initial unlock mode
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (isLocked) {
      // Determine initial unlock mode from auth provider and hasPin
      if (authProvider !== 'local') {
        // SSO account: show PIN if they have one, otherwise SSO button directly
        setUnlockMode(hasPin ? 'pin' : 'sso')
      } else {
        // Local account: PIN takes priority over password if set
        setUnlockMode(hasPin ? 'pin' : 'password')
      }
      // Reset card state
      setInputValue('')
      setErrorMsg('')
      setInputDisabled(false)
      setCountdown(0)
      setPinFailures(0)
      setForcedSignout(false)
      setSsoPopupBlocked(false)
      setIsSubmitting(false)
      // Clean up any running countdown
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current)

      if (lockImmediate) {
        // Manual lock (e.g. lock button click) — show overlay immediately
        clearLockImmediate()
        setPhase('entering')
        setTimeout(() => setPhase('visible'), FADE_IN_MS)
        autoDismissRef.current = setTimeout(dismissOverlay, AUTO_DISMISS_MS)
      } else {
        // Passive lock (idle timeout, WS event) — overlay stays hidden until interaction
        setPhase('hidden')
      }
    } else {
      // Unlocked — clean up all timers and hide overlay
      if (autoDismissRef.current) clearTimeout(autoDismissRef.current)
      if (fadeOutTimerRef.current) clearTimeout(fadeOutTimerRef.current)
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current)
      // Remove SSO postMessage handler if any
      if (ssoMessageHandlerRef.current) {
        window.removeEventListener('message', ssoMessageHandlerRef.current)
        ssoMessageHandlerRef.current = null
      }
      setPhase('hidden')
    }
  }, [isLocked, authProvider, hasPin, lockImmediate, clearLockImmediate, dismissOverlay])

  // ---------------------------------------------------------------------------
  // Interaction listeners — click and keypress trigger overlay.
  // Passive mouse movement does NOT trigger it.
  // When the overlay is visible, clicks on the backdrop are consumed.
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!isLocked) return

    function handleMouseDown(e: MouseEvent) {
      if (phase === 'hidden' || phase === 'exiting') {
        // Triggering click — consume it so it doesn't pass to content
        e.stopPropagation()
        e.preventDefault()
        showOverlay()
      }
    }

    function handleKeyDown(e: KeyboardEvent) {
      // Escape in kiosk mode: dismiss overlay but do NOT unlock
      if (e.key === 'Escape' && isKioskRef.current) {
        if (phase === 'visible' || phase === 'entering') {
          e.stopPropagation()
          e.preventDefault()
          dismissOverlay()
        }
        return
      }

      // Any other keypress while overlay is hidden → show it
      if (phase === 'hidden' || phase === 'exiting') {
        showOverlay()
      }
    }

    // Use capture phase for mousedown so we intercept before content handlers
    window.addEventListener('mousedown', handleMouseDown, { capture: true })
    window.addEventListener('keydown', handleKeyDown, { capture: true })

    return () => {
      window.removeEventListener('mousedown', handleMouseDown, { capture: true })
      window.removeEventListener('keydown', handleKeyDown, { capture: true })
    }
  }, [isLocked, phase, showOverlay, dismissOverlay])

  // ---------------------------------------------------------------------------
  // Auto-focus input when overlay becomes visible
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (phase === 'visible' || phase === 'entering') {
      // Small delay so the animation has started before focus
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [phase])

  // ---------------------------------------------------------------------------
  // Input change — reset auto-dismiss timer on any input activity
  // ---------------------------------------------------------------------------

  function handleInputChange(e: ChangeEvent<HTMLInputElement>) {
    setInputValue(e.target.value)
    setErrorMsg('')
    resetAutoDismiss()
  }

  // ---------------------------------------------------------------------------
  // Rate-limit countdown
  // ---------------------------------------------------------------------------

  function startCountdown(seconds: number) {
    setCountdown(seconds)
    setInputDisabled(true)
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current)
    countdownIntervalRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(countdownIntervalRef.current!)
          countdownIntervalRef.current = null
          setInputDisabled(false)
          setErrorMsg('')
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }

  // ---------------------------------------------------------------------------
  // Unlock submit handlers
  // ---------------------------------------------------------------------------

  async function handlePasswordSubmit(e: FormEvent) {
    e.preventDefault()
    const value = inputValue.trim()
    if (!value || inputDisabled || isSubmitting) return

    setIsSubmitting(true)
    setErrorMsg('')
    resetAutoDismiss()

    try {
      const result = await authApi.verifyPassword(value)
      if (result.success) {
        handleUnlockSuccess()
      } else {
        handleVerifyError(result.error, 'password')
      }
    } catch (err) {
      await handleVerifyException(err, 'password')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handlePinSubmit(e: FormEvent) {
    e.preventDefault()
    const value = inputValue.trim()
    if (!value || inputDisabled || isSubmitting) return

    setIsSubmitting(true)
    setErrorMsg('')
    resetAutoDismiss()

    try {
      const result = await authApi.verifyPin(value)
      if (result.success) {
        handleUnlockSuccess()
      } else {
        handleVerifyError(result.error, 'pin')
      }
    } catch (err) {
      await handleVerifyException(err, 'pin')
    } finally {
      setIsSubmitting(false)
    }
  }

  function handleUnlockSuccess() {
    setInputValue('')
    setErrorMsg('')
    // Fade out overlay, then clear lock state
    dismissOverlay()
    setTimeout(() => {
      unlock()
    }, FADE_OUT_MS + 50)
  }

  function handleVerifyError(
    error: { status?: number; message?: string } | undefined,
    mode: 'password' | 'pin',
  ) {
    const status = error?.status ?? 0
    if (status === 429) {
      setErrorMsg('Too many attempts — try again in 5:00')
      startCountdown(300)
    } else if (status === 401) {
      setErrorMsg('Incorrect credential. Please try again.')
      setInputValue('')
      if (mode === 'pin') {
        const next = pinFailures + 1
        setPinFailures(next)
        if (next >= PIN_FAILURE_THRESHOLD) {
          setErrorMsg('Too many PIN failures. Try your password instead.')
        }
      }
    } else {
      setErrorMsg('Unable to verify. Check your connection.')
    }
  }

  async function handleVerifyException(err: unknown, mode: 'password' | 'pin') {
    setInputValue('')
    // Check for forced_signout (401 with reason field)
    const forced = await isForcedSignout(err)
    if (forced) {
      setForcedSignout(true)
      setErrorMsg('Session terminated. Signing you out…')
      setInputDisabled(true)
      setTimeout(async () => {
        await logout()
        window.location.href = '/login'
      }, 2500)
      return
    }
    // Check for 429 rate limit
    const isRateLimit =
      (err instanceof Response && err.status === 429) ||
      (err && typeof err === 'object' && 'status' in err && (err as { status: number }).status === 429)
    if (isRateLimit) {
      const retryAfter = await extractRetryAfter(err)
      setErrorMsg(`Too many attempts — try again in ${formatCountdown(retryAfter)}`)
      startCountdown(retryAfter)
      return
    }
    // Generic error
    if (mode === 'pin') {
      const next = pinFailures + 1
      setPinFailures(next)
      setErrorMsg('Incorrect PIN.')
      if (next >= PIN_FAILURE_THRESHOLD) {
        setErrorMsg('Too many PIN failures. Try your password instead.')
      }
    } else {
      setErrorMsg('Incorrect password. Please try again.')
    }
  }

  // ---------------------------------------------------------------------------
  // SSO popup flow
  // ---------------------------------------------------------------------------

  function handleSsoUnlock() {
    resetAutoDismiss()
    setSsoPopupBlocked(false)
    setErrorMsg('')

    // Remove any previous handler
    if (ssoMessageHandlerRef.current) {
      window.removeEventListener('message', ssoMessageHandlerRef.current)
      ssoMessageHandlerRef.current = null
    }

    // Register postMessage listener for SSO callback
    const handler = async (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return
      const data = event.data as Record<string, unknown>
      if (data?.type !== 'sso_unlock_success') return

      // Remove handler immediately to avoid double-handling
      window.removeEventListener('message', handler)
      ssoMessageHandlerRef.current = null

      const token = data.token as string | undefined
      if (!token) {
        setErrorMsg('SSO callback missing token. Please try again.')
        return
      }

      setIsSubmitting(true)
      try {
        const result = await authApi.verifySsoUnlock(token)
        if (result.success) {
          handleUnlockSuccess()
        } else {
          setErrorMsg('SSO verification failed. Please try again.')
        }
      } catch (err) {
        const forced = await isForcedSignout(err)
        if (forced) {
          setForcedSignout(true)
          setErrorMsg('Session terminated. Signing you out…')
          setInputDisabled(true)
          setTimeout(async () => {
            await logout()
            window.location.href = '/login'
          }, 2500)
        } else {
          setErrorMsg('Unable to verify SSO token. Please try again.')
        }
      } finally {
        setIsSubmitting(false)
      }
    }

    ssoMessageHandlerRef.current = handler
    window.addEventListener('message', handler)

    // Build the SSO unlock URL — the server provides this via the auth provider list.
    // For now we construct a conventional path; a real implementation would use
    // the provider's authorization URL from the providers API.
    const ssoUrl = `/api/auth/sso-unlock?provider=${encodeURIComponent(authProvider)}`

    const popup = window.open(ssoUrl, '_blank', 'width=500,height=600,noopener')
    if (!popup) {
      window.removeEventListener('message', handler)
      ssoMessageHandlerRef.current = null
      setSsoPopupBlocked(true)
    }
  }

  // ---------------------------------------------------------------------------
  // Cleanup on unmount
  // ---------------------------------------------------------------------------

  useEffect(() => {
    return () => {
      if (autoDismissRef.current) clearTimeout(autoDismissRef.current)
      if (fadeOutTimerRef.current) clearTimeout(fadeOutTimerRef.current)
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current)
      if (ssoMessageHandlerRef.current) {
        window.removeEventListener('message', ssoMessageHandlerRef.current)
      }
    }
  }, [])

  // ---------------------------------------------------------------------------
  // Render guard
  // ---------------------------------------------------------------------------

  if (!isLocked || phase === 'hidden') return null

  // ---------------------------------------------------------------------------
  // Derived display values
  // ---------------------------------------------------------------------------

  const displayName = user?.full_name ?? user?.username ?? 'Unknown User'
  const initials = buildInitials(displayName) || 'IO'

  const providerLabel = authProviderName || authProvider.toUpperCase()
  const isSSO = authProvider !== 'local'

  // Should the card offer a "Use password instead" link?
  const canSwitchToPassword =
    !isSSO && unlockMode === 'pin' && pinFailures >= PIN_FAILURE_THRESHOLD

  // Should the card offer a "Use PIN" link (when user switched away to password)?
  const canSwitchToPin = !isSSO && hasPin && unlockMode === 'password'

  const animationStyle: React.CSSProperties =
    phase === 'exiting'
      ? { animation: `lockOverlayFadeOut ${FADE_OUT_MS}ms ease-in forwards` }
      : { animation: `lockOverlayFadeIn ${FADE_IN_MS}ms ease-out forwards` }

  const submitDisabled =
    inputDisabled ||
    isSubmitting ||
    forcedSignout ||
    (unlockMode !== 'sso' && !inputValue.trim())

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div
      role="dialog"
      aria-label="Screen locked"
      aria-modal="true"
      // Capture all pointer events on the backdrop so nothing leaks to content
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 'var(--io-z-visual-lock)' as unknown as number,
        background: 'rgba(0,0,0,0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        ...animationStyle,
      }}
    >
      {/* Lock card */}
      <div
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
          {initials}
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
          Session locked.
          {unlockMode === 'sso'
            ? ` Sign in with ${providerLabel} to continue.`
            : unlockMode === 'pin'
              ? ' Enter your PIN to continue.'
              : ' Enter your password to continue.'}
        </div>

        {/* Popup blocked notice */}
        {ssoPopupBlocked && (
          <div
            role="alert"
            style={{
              width: '100%',
              fontSize: '12px',
              color: 'var(--io-text-primary)',
              background: 'var(--io-surface-warning, rgba(234,179,8,0.12))',
              border: '1px solid var(--io-warning, #ca8a04)',
              borderRadius: 'var(--io-radius, 6px)',
              padding: '10px 12px',
              textAlign: 'center',
              lineHeight: 1.5,
            }}
          >
            Popups are blocked. {providerLabel} sign-in requires popups.
            Allow popups for this site or{' '}
            <button
              type="button"
              onClick={async () => {
                await logout()
                window.location.href = '/login'
              }}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--io-accent)',
                cursor: 'pointer',
                fontSize: '12px',
                padding: 0,
                textDecoration: 'underline',
              }}
            >
              sign out
            </button>
            .
          </div>
        )}

        {/* PIN input */}
        {unlockMode === 'pin' && (
          <form onSubmit={handlePinSubmit} style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label
                htmlFor="lock-pin"
                style={{ fontSize: '12px', color: 'var(--io-text-secondary)', fontWeight: 500 }}
              >
                PIN
              </label>
              <input
                id="lock-pin"
                ref={inputRef}
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                value={inputValue}
                onChange={handleInputChange}
                autoComplete="off"
                disabled={inputDisabled || isSubmitting || forcedSignout}
                placeholder="6-digit PIN"
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  background: 'var(--io-surface-input, var(--io-surface))',
                  border: `1px solid ${errorMsg ? 'var(--io-destructive, #ef4444)' : 'var(--io-border)'}`,
                  borderRadius: 'var(--io-radius, 6px)',
                  color: 'var(--io-text-primary)',
                  fontSize: '14px',
                  outline: 'none',
                  boxSizing: 'border-box',
                  letterSpacing: '0.3em',
                }}
              />
            </div>
            <button
              type="submit"
              disabled={submitDisabled}
              style={submitButtonStyle(submitDisabled)}
            >
              {isSubmitting ? 'Verifying…' : countdown > 0 ? `Try again in ${formatCountdown(countdown)}` : 'Unlock'}
            </button>
            {/* Offer SSO button alongside PIN for SSO accounts */}
            {isSSO && (
              <button
                type="button"
                onClick={handleSsoUnlock}
                disabled={isSubmitting || forcedSignout}
                style={ssoButtonStyle(isSubmitting || forcedSignout)}
              >
                {providerLabel} Sign In
              </button>
            )}
            {/* After PIN_FAILURE_THRESHOLD failures, offer password fallback */}
            {canSwitchToPassword && (
              <button
                type="button"
                onClick={() => { setUnlockMode('password'); setInputValue(''); setErrorMsg('') }}
                style={linkButtonStyle()}
              >
                Try password instead?
              </button>
            )}
            {/* Allow switching to PIN if available for non-SSO accounts */}
          </form>
        )}

        {/* Password input */}
        {unlockMode === 'password' && (
          <form onSubmit={handlePasswordSubmit} style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
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
                value={inputValue}
                onChange={handleInputChange}
                autoComplete="current-password"
                disabled={inputDisabled || isSubmitting || forcedSignout}
                placeholder="Enter password"
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  background: 'var(--io-surface-input, var(--io-surface))',
                  border: `1px solid ${errorMsg ? 'var(--io-destructive, #ef4444)' : 'var(--io-border)'}`,
                  borderRadius: 'var(--io-radius, 6px)',
                  color: 'var(--io-text-primary)',
                  fontSize: '14px',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>
            <button
              type="submit"
              disabled={submitDisabled}
              style={submitButtonStyle(submitDisabled)}
            >
              {isSubmitting ? 'Verifying…' : countdown > 0 ? `Try again in ${formatCountdown(countdown)}` : 'Unlock'}
            </button>
            {canSwitchToPin && (
              <button
                type="button"
                onClick={() => { setUnlockMode('pin'); setInputValue(''); setErrorMsg('') }}
                style={linkButtonStyle()}
              >
                Use PIN instead
              </button>
            )}
          </form>
        )}

        {/* SSO-only mode (no PIN) */}
        {unlockMode === 'sso' && (
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <button
              type="button"
              onClick={handleSsoUnlock}
              disabled={isSubmitting || forcedSignout}
              style={ssoButtonStyle(isSubmitting || forcedSignout)}
            >
              {isSubmitting ? 'Signing in…' : `${providerLabel} Sign In`}
            </button>
          </div>
        )}

        {/* Error / status message */}
        {errorMsg && (
          <div
            role="alert"
            style={{
              width: '100%',
              fontSize: '12px',
              color: forcedSignout ? 'var(--io-text-primary)' : 'var(--io-destructive, #ef4444)',
              textAlign: 'center',
              padding: '6px 10px',
              background: forcedSignout
                ? 'rgba(100,100,100,0.1)'
                : 'rgba(239,68,68,0.1)',
              borderRadius: 'var(--io-radius, 6px)',
            }}
          >
            {errorMsg}
          </div>
        )}

        {/* Sign out fallback — always available */}
        <button
          type="button"
          onClick={async () => {
            await logout()
            window.location.href = '/login'
          }}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--io-text-muted)',
            cursor: 'pointer',
            fontSize: '12px',
            padding: '4px',
            textDecoration: 'underline',
            marginTop: '-4px',
          }}
        >
          Sign out
        </button>
      </div>

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

// ---------------------------------------------------------------------------
// Inline style helpers
// ---------------------------------------------------------------------------

function submitButtonStyle(disabled: boolean): React.CSSProperties {
  return {
    width: '100%',
    padding: '10px 16px',
    background: 'var(--io-accent)',
    color: 'var(--io-accent-foreground, #fff)',
    border: 'none',
    borderRadius: 'var(--io-radius, 6px)',
    fontSize: '14px',
    fontWeight: 600,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.6 : 1,
    transition: 'opacity 0.15s',
  }
}

function ssoButtonStyle(disabled: boolean): React.CSSProperties {
  return {
    width: '100%',
    padding: '10px 16px',
    background: 'var(--io-surface)',
    color: 'var(--io-text-primary)',
    border: '1px solid var(--io-border)',
    borderRadius: 'var(--io-radius, 6px)',
    fontSize: '14px',
    fontWeight: 500,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.6 : 1,
    transition: 'opacity 0.15s',
  }
}

function linkButtonStyle(): React.CSSProperties {
  return {
    background: 'none',
    border: 'none',
    color: 'var(--io-accent)',
    cursor: 'pointer',
    fontSize: '12px',
    padding: '2px 0',
    textDecoration: 'underline',
    alignSelf: 'center',
  }
}
