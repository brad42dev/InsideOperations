---
decision: visual-lock-overhaul
unit: DD-06, DD-29
type: fix
date: 2026-03-21
author: feature-agent
---

# Visual Lock Overlay — Full Overhaul

## Context

Spec-scout identified six gaps in the current visual lock screen implementation:

1. `POST /api/auth/verify-password` backend route is missing — unlock always fails in practice
2. 3-attempt lockout is frontend-only — a page refresh resets it, defeating the purpose
3. `isLocked` lives in Zustand only — a page refresh while locked produces an unlocked session
4. Kiosk + lock interaction is unspecified — Escape key bypass is possible in some focus states
5. SSO/OIDC users have no unlock path — password field always shown regardless of auth provider
6. `--io-z-visual-lock` token status unverified (**RESOLVED — token exists at 500, stack is correct**)

## Decision

All six issues are resolved by this overhaul. The visual lock screen is rebuilt as a genuine
security control, not UI decoration.

## Behavior Spec

### Overlay Appearance (All Modes)

The session enters locked state after the per-role idle timeout (default 30 minutes, configurable
per-user and per-role in Settings). On lock, **no visible change occurs** — data continues to
flow, the screen looks identical. This is by design.

The lock overlay appears only on user interaction:
- **Click** anywhere in the window (regardless of prior focus state) → overlay fades in (300ms)
- **Keypress** while the window has focus → overlay fades in (300ms)
- **Passive mouse movement** → never triggers the overlay, even with window focus

The click that triggers the overlay is **consumed** — it does not pass through to the content
beneath (no accidental context menus, no valve interactions firing alongside the lock screen).

When the overlay is visible:
- Semi-transparent dark backdrop (`rgba(0,0,0,0.6)`) over the full viewport
- Centered lock card: user avatar, username, unlock input, Unlock button
- Data continues updating behind the overlay (pointer-events: none on content layer)
- If no input for 60 seconds → overlay fades out (300ms), returns to passive monitoring display.
  Next interaction triggers it again. This is NOT an unlock — session remains locked.
- Escape key in kiosk mode dismisses the overlay and returns to passive display. This is not a
  bypass — no interactive access is granted. Escape never unlocks.

### Lock State Persistence

Lock state is stored server-side as `locked_since TIMESTAMPTZ NULL` on the `active_sessions`
table. On page load, the existing auth check response includes `is_locked: boolean`. If true,
the frontend immediately enters locked state without a page flash.

When a session is locked/unlocked, the auth-service publishes a `session.locked` or
`session.unlocked` WebSocket event via the data broker. All open tabs for the same session
receive this event and synchronize lock state. A session locked in one tab is locked in all tabs.

### Unlock Flow — Local Accounts

Password field shown. On submit: `POST /api/auth/verify-password` with JWT in Authorization
header and `{ "password": "..." }` in body. Returns `200 OK` on success, `401` on wrong password,
`429` on rate limit hit. No token rotation — the existing session continues as-is.

If the user has a PIN set, the PIN field is shown instead of the password field (PIN takes
priority on the lock screen). After 3 consecutive PIN failures, the lock card offers "Try
password instead?" — the user can switch to the password field. PIN and password failures share
the same rate-limit counters.

### Unlock Flow — SSO / OIDC / SAML / LDAP Accounts

The auth provider is recorded on the session at login time. On lock, the lock card queries the
session's auth provider and renders accordingly:
- Local account → password (or PIN if set)
- SSO account → "Continue with [Provider Name]" button + PIN field if set

Clicking the SSO button opens a **popup window** to the IdP's authorization endpoint. On
successful auth the popup closes and posts a message to the parent window, which calls
`POST /api/auth/verify-sso-unlock` with the returned token. The parent window unlocks on
`200 OK`.

If the browser blocks the popup: the lock card shows a persistent inline notice — "Popups are
blocked. [Provider] sign-in requires popups. Allow popups for this site or sign out." A "Sign
out" link is always available as a fallback.

App-wide popup detection runs at application init (silent `window.open()` probe). If popups are
blocked, a **persistent banner** (not a toast) appears in the top bar with browser-specific
instructions to allow popups for this site. This banner also covers multi-window scenarios
(detached Console windows, Dashboard/Report windows) that require popups. The user can dismiss
the banner; a smaller indicator remains in the top bar until popups are confirmed allowed.

### PIN

Users can set an optional 6-digit numeric PIN for lock screen unlock. The PIN is stored hashed
(Argon2) in the database, separate from the account password.

**Setup paths:**
- User profile → Security → "Set Lock Screen PIN"
- First time the lock screen appears (or after a "Don't show again" reset): a prompt appears
  below the unlock form: "Set a PIN for easier unlock" with a checkbox or small inline form.
  A "Don't show this again" option suppresses future prompts.

**Kiosk use case:** An admin sets a PIN on a kiosk account. The PIN can be shared with a subset
of operators, enabling them to interact with the kiosk display without sharing the account
password or using SSO. After PIN unlock, the configurable kiosk auth duration applies (default
15 minutes), after which the session returns to passive display.

### Server-Side Rate Limiting

Rate limiting applies to both `verify-password` and `verify-pin` endpoints, sharing the same
failure counters per (user_id, IP):

**Soft limit:** 5 failed attempts within a 5-minute rolling window → `429 Too Many Requests`.
Frontend disables the input and shows: "Too many attempts — try again in 5 minutes."

**Hard limit:** 20 failed attempts since the last successful unlock (or since login if no unlock
has occurred) → `401` with a `reason: "forced_signout"` body. Frontend signs the user out
completely and redirects to the login page. Successful unlock resets the hard-limit counter.

Rate limiting is lighter-weight than the account lockout used by the login flow (which writes to
`locked_until` on the users table). The unlock rate limit uses a separate counter (stored in the
session row or a fast cache), does not lock the account globally, and does not affect login.

### z-index Token

`--io-z-visual-lock: 500` is already defined in the token registry. The full stack is:
panel(10) → sidebar/topbar(100) → edge-hover(150) → dropdown(200) → modal(300) →
command(400) → **visual-lock(500)** → kiosk-auth(600) → toast(700) → emergency(800).

No token changes needed. Toasts and emergency overlays intentionally appear above the lock
overlay — connection errors and emergency alerts must be visible even when locked.

### Kiosk Mode Specifics

Kiosk sessions (`is_kiosk = true`) have no idle timeout — they never lock proactively. The
visual lock in kiosk mode is triggered only by deliberate user interaction (click or keypress).
There is no session_lock WebSocket event for kiosk sessions from the idle path (since they
never idle-lock), but the same overlay and same unlock endpoints apply when triggered manually.

Unlocking in kiosk mode keeps the user in kiosk mode — it does not exit to the full shell.
After the configurable kiosk auth duration (default 15 minutes per role), the chrome hides and
the lock resets. Escape dismisses the overlay (returns to passive display) but never unlocks.

## Acceptance Criteria

1. `POST /api/auth/verify-password` exists in auth-service, accepts JWT + password body, returns 200/401/429, performs no token rotation
2. `POST /api/auth/verify-pin` exists, same contract, shares failure counters with verify-password
3. `POST /api/auth/pin` (set) and `DELETE /api/auth/pin` (remove) exist for PIN management
4. `active_sessions.locked_since` column exists; lock state is included in session check response
5. Locking/unlocking pushes `session.locked` / `session.unlocked` WebSocket events; all open tabs sync
6. Page refresh while locked restores the locked state (overlay appears on next interaction)
7. Lock overlay is transparent/invisible until click or keypress; passive mouse movement does not trigger it
8. The triggering click is consumed — it does not activate content beneath the overlay
9. Local account lock card shows password field (or PIN field if PIN is set)
10. SSO account lock card shows provider button + PIN field if set; no password field
11. SSO popup flow opens IdP in a popup window; successful auth unlocks the session
12. Popup blocked: lock card shows inline notice + sign-out fallback; app-wide init banner appears
13. PIN prompt appears on first lock screen display with "Don't show again" option
14. Soft rate limit: 5 failures in 5 min → 429, input disabled with countdown message
15. Hard rate limit: 20 failures since last unlock → forced sign-out
16. Failure counter resets on successful unlock
17. After 3 PIN failures, "Try password instead?" option appears on the lock card
18. Escape in kiosk dismisses overlay to passive display; does not grant any interactive access
19. Unlocking in kiosk mode keeps the session in kiosk mode (does not exit to shell)
20. IDLE_TIMEOUT_MS in AppShell is 30 minutes (1_800_000ms); per-role and per-user overrides respected
21. Existing task DD-06-004 is superseded by this decision; its fix instructions no longer apply

## Out of Scope

- Changing the account-level `locked_until` lockout used by the login flow (separate system)
- Biometric unlock or WebAuthn (not supported per doc 29)
- Multi-factor unlock (TOTP/Duo on the lock screen) — lock screen is presence check only
- Changing the kiosk no-idle-timeout behaviour (already correct per spec)
- Any changes to `--io-z-visual-lock` token value (already correct at 500)

## Files Expected to Change

**Backend (auth-service):**
- `services/auth-service/src/handlers/auth.rs` — add verify-password, verify-pin, set/delete pin handlers
- `services/auth-service/src/handlers/mfa.rs` — may need unlock rate limit helpers (or new file)
- `services/auth-service/src/state.rs` — rate limit state / counters
- `services/auth-service/src/main.rs` — register new routes
- `services/api-gateway/src/handlers/mod.rs` — proxy new auth routes if gateway proxies auth

**Database:**
- New migration: `active_sessions.locked_since TIMESTAMPTZ NULL`
- New migration: `users.lock_pin_hash TEXT NULL` (or separate `user_pins` table)

**Frontend:**
- `frontend/src/shared/components/LockOverlay.tsx` — full rewrite
- `frontend/src/shared/layout/AppShell.tsx` — idle timer, lock state boot check, WS event listener
- `frontend/src/api/auth.ts` — verifyPassword, verifyPin, setPin, deletePin, verifySsoUnlock
- `frontend/src/store/auth.ts` (or ui.ts) — server-side lock state, provider-aware unlock
- `frontend/src/shared/components/PopupBlockedBanner.tsx` — new component
- `frontend/src/pages/settings/ProfilePage.tsx` (or equivalent) — PIN setup UI

## Dependencies

- DD-06-004 is superseded by tasks generated from this decision. Do not implement DD-06-004.
