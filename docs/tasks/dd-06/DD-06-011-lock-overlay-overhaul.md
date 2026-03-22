---
id: DD-06-011
unit: DD-06
title: Rewrite LockOverlay — transparent passive state, server-sync, SSO popup, PIN support
status: pending
priority: high
depends-on: [DD-29-009, DD-29-010, DD-29-011]
source: feature
decision: docs/decisions/visual-lock-overhaul.md
---

## What to Build

Completely rewrite `LockOverlay.tsx` and the surrounding lock infrastructure in AppShell to
implement the full visual lock spec. This supersedes task DD-06-004 — do not implement
DD-06-004's fix instructions.

### Behaviour to implement

**Passive locked state (overlay invisible):**
- Session is locked but no overlay is shown
- Data continues updating behind the scenes (WebSocket subscriptions unaffected)
- The content layer has `pointer-events: none` (interaction blocked, rendering unaffected)
- No visible change from the user's perspective

**Interaction triggers overlay (300ms fade-in):**
- Click anywhere in the window → overlay appears. The triggering click is consumed and does
  NOT pass through to content beneath.
- Keypress while window has focus → overlay appears
- Passive mouse movement → never triggers the overlay

**Overlay visible:**
- Semi-transparent dark backdrop (`rgba(0,0,0,0.6)`) covering the full viewport
- Centered lock card: user avatar, username, unlock input(s), Unlock button
- `z-index: var(--io-z-visual-lock)` (= 500)
- 60-second auto-dismiss: if no input for 60s, overlay fades out (300ms) and returns to passive
  locked state. This is NOT an unlock — session remains locked. Next interaction re-triggers.

**Unlock input rendering (from session check `auth_provider` + `has_pin`):**

| auth_provider | has_pin | Lock card shows |
|---|---|---|
| local | false | Password field |
| local | true | PIN field + "Use password instead" toggle |
| oidc/saml/ldap | false | "[Provider] Sign In" button |
| oidc/saml/ldap | true | PIN field + "[Provider] Sign In" button |

After 3 consecutive PIN failures: show "Try password instead?" option on the card.

**SSO unlock popup flow:**
1. User clicks "[Provider] Sign In" button
2. `window.open(ssoUnlockUrl, '_blank', 'width=500,height=600')` opens the IdP popup
3. On successful auth the popup calls `window.opener.postMessage({ type: 'sso_unlock_success', token: '...' }, origin)`
4. Parent window calls `POST /api/auth/verify-sso-unlock` with the token
5. On 200: unlock session, fade out overlay
6. If popup is null (blocked): show inline notice in lock card — "Popups are blocked. Allow popups
   for this site or [Sign out]."

**On successful unlock:**
- Overlay fades out (200ms)
- Content layer `pointer-events` restored
- Idle timer resets
- `POST /api/auth/lock` is NOT called — lock state was already cleared by verify-password/pin

**Rate limit feedback:**
- `429` response: disable input, show countdown: "Too many attempts — try again in X:XX"
- Re-enable input when countdown hits zero
- `401` with `forced_signout`: show brief message, then call auth store `logout()` and redirect
  to `/login`

### AppShell changes

**Boot-time lock state sync:**
On app load, the session check response now includes `is_locked`, `auth_provider`, `has_pin`.
If `is_locked = true`: immediately set lock state in the store. Do NOT show the overlay yet —
wait for the first user interaction.

**Idle timer:**
- Fire `POST /api/auth/lock` when idle timer expires (default 30 minutes = 1_800_000ms)
- Per-role and per-user timeout values should be read from the session check response
  (or a user preferences endpoint). Default to 1_800_000ms if not provided.
- Fix the current IDLE_TIMEOUT_MS constant which is incorrectly set to 60_000ms (1 minute).

**WebSocket event listeners:**
- `session.locked` → set lock state in store (handles multi-tab sync)
- `session.unlocked` → clear lock state in store (handles multi-tab sync)

**Kiosk mode specifics:**
- Escape key in kiosk while overlay is visible: dismiss overlay (return to passive locked state).
  This is correct — it does not unlock. Escape must be blocked from also exiting kiosk mode
  while the overlay is visible.
- All other Escape press handling (exit kiosk, close modals) is blocked while overlay is visible.
- Unlock in kiosk: success → overlay fades out, user is in authenticated kiosk state.
  Do not exit kiosk mode.

### Files to modify

- `frontend/src/shared/components/LockOverlay.tsx` — full rewrite
- `frontend/src/shared/layout/AppShell.tsx` — idle timer fix, boot sync, WS listeners
- `frontend/src/api/auth.ts` — add `verifyPassword`, `verifyPin`, `verifySsoUnlock`, `lock`
- `frontend/src/store/auth.ts` or `ui.ts` — extend lock state to include `authProvider`, `hasPin`

## Acceptance Criteria

- [ ] Passive locked state: overlay invisible, data updates visible, clicks blocked
- [ ] Click or keypress triggers overlay; passive mouse movement does not
- [ ] Triggering click is consumed (does not activate content beneath)
- [ ] Overlay fades in 300ms, fades out 200ms
- [ ] Local account with no PIN: password field shown
- [ ] Local account with PIN: PIN field shown; "Use password instead" toggle available
- [ ] SSO account with no PIN: provider button shown, no password field
- [ ] SSO account with PIN: PIN field + provider button shown
- [ ] After 3 PIN failures: "Try password instead?" option appears
- [ ] SSO popup flow: opens popup, receives postMessage, calls verify-sso-unlock, unlocks
- [ ] Popup blocked: inline lock card notice with sign-out fallback
- [ ] 429 response: input disabled with countdown timer
- [ ] Forced-signout response: brief message then logout + redirect
- [ ] 60s auto-dismiss: overlay fades, session remains locked, next interaction re-triggers
- [ ] Page refresh while locked: overlay does not flash immediately; appears on next interaction
- [ ] Multi-tab: lock in one tab → overlay appears in all tabs on next interaction
- [ ] Kiosk: Escape dismisses overlay but does not exit kiosk or unlock
- [ ] Kiosk: successful unlock stays in kiosk mode
- [ ] IDLE_TIMEOUT_MS is 1_800_000 (30 minutes), not 60_000
- [ ] `var(--io-z-visual-lock)` used for overlay z-index (= 500)
- [ ] DD-06-004 is not implemented (this task supersedes it)

## Verification Checklist

- [ ] LockOverlay.tsx has been fully rewritten (no remnants of click-to-dismiss logic)
- [ ] AppShell idle timer constant is 30 min
- [ ] Auth store includes authProvider and hasPin fields
- [ ] API module has all four new auth functions
- [ ] WS event handler for session.locked / session.unlocked wired up in AppShell
- [ ] Manual test: lock screen appears after idle, password entry unlocks, 60s auto-dismiss works
- [ ] Manual test: SSO account sees provider button, not password field

## Do NOT

- Implement the click-to-dismiss flow from the old LockOverlay.tsx
- Allow any interaction (including Escape) to bypass the lock screen and grant access
- Use pointer-events manipulation that blocks WebSocket data updates (data must keep flowing)
- Exit kiosk mode on unlock
- Use localStorage or sessionStorage as the lock state source of truth

## Dev Notes

Decision file: `docs/decisions/visual-lock-overhaul.md`

This task depends on DD-29-009, DD-29-010, DD-29-011 being complete so the API endpoints exist.
In development, the endpoints can be stubbed if backend tasks are in progress.

Current LockOverlay location: `frontend/src/shared/components/LockOverlay.tsx`
Current AppShell: `frontend/src/shared/layout/AppShell.tsx` — IDLE_TIMEOUT_MS is on line 25
(currently 60_000ms, must be 1_800_000ms).

The spec excerpt for the visual lock is in `design-docs/06_FRONTEND_SHELL.md` §Visual Lock Overlay
and §Kiosk Visual Lock. This decision file's Behavior Spec section supersedes any conflicts with
those sections.

z-index stack for reference: panel(10) → sidebar/topbar(100) → edge-hover(150) →
dropdown(200) → modal(300) → command(400) → visual-lock(500) → kiosk-auth(600) →
toast(700) → emergency(800). Toasts and emergency overlays appear above the lock overlay
intentionally — connection errors must be visible even when locked.

The `POST /api/auth/verify-sso-unlock` endpoint is not in the DD-29 tasks — it is a
straightforward token exchange. Add it to auth-service alongside the other new handlers, or
raise it as a follow-on task if scope is a concern.
