---
id: DD-06-012
unit: DD-06
title: Add app-wide popup detection banner for blocked popups
status: pending
priority: medium
depends-on: []
source: feature
decision: docs/decisions/visual-lock-overhaul.md
---

## What to Build

Add app-wide popup detection at application init. If the browser is blocking popups, a
persistent banner appears in the top bar with instructions to allow popups for this site.
This affects SSO lock screen unlock, detached Console windows, Dashboard windows, and Report
export windows — all of which use `window.open()`.

### Detection

Run a silent popup probe at app init (after auth, before first module renders):

```typescript
function detectPopupBlocked(): boolean {
  const probe = window.open('', '_blank', 'width=1,height=1')
  if (!probe || probe.closed || typeof probe.closed === 'undefined') {
    return true  // blocked
  }
  probe.close()
  return false
}
```

Store result in a Zustand store or React context. Re-probe when the user explicitly dismisses
the banner (they may have just allowed popups in browser settings).

### Banner component

Create `frontend/src/shared/components/PopupBlockedBanner.tsx`.

The banner:
- Renders inside the top bar area, below the main top bar content, full width
- Background: `var(--io-color-warning-subtle)` or equivalent warning token
- Text: "Popups are blocked. [App name] uses popups for multi-window support and SSO sign-in.
  [Allow popups ↗]  [Check again]  [✕ Dismiss]"
- "[Allow popups ↗]" links to browser-specific instructions. Detect browser via
  `navigator.userAgent` and link to the correct help page:
  - Chrome/Edge: chrome://settings/content/popups (non-linkable; show inline text instructions instead)
  - Firefox: about:preferences#privacy (same)
  - Safari: show inline text
  - Default: show generic text "In your browser settings, allow popups for this site"
- "[Check again]" re-runs the probe. If popups are now allowed: hide banner entirely.
- "[✕ Dismiss]" hides the full banner. A smaller indicator (warning icon) remains in the top
  bar right section. Clicking it restores the banner. Dismissed state is stored in
  `sessionStorage` (per-tab, reset on next session).

### Placement

`PopupBlockedBanner` renders in `AppShell.tsx` just below the TopBar component, above the
main content area. It should push content down (not overlay it) to avoid obscuring graphics.

### Integration with SSO lock screen

When the SSO "Continue with [Provider]" button is clicked in LockOverlay and the popup is
blocked:
- Do NOT show the app-wide banner again (it's already been shown at init)
- Show an inline message in the lock card: "Popups are blocked. [Fix it ↗] or [Sign out]"
- "Sign out" calls `authStore.logout()` and redirects to `/login`

## Acceptance Criteria

- [ ] Popup detection runs at app init (post-auth, pre-module render)
- [ ] Banner appears in top bar area when popups are blocked
- [ ] Banner includes "Check again" that re-probes and hides banner on success
- [ ] Banner dismiss shows smaller indicator; clicking indicator restores banner
- [ ] Dismissed state stored in sessionStorage (resets on new session)
- [ ] Banner does not overlay content (pushes layout down)
- [ ] LockOverlay shows inline blocked-popup message when SSO button is clicked and popups are blocked

## Verification Checklist

- [ ] PopupBlockedBanner.tsx component exists
- [ ] Detection function correctly identifies blocked popups in Chrome with popups disabled
- [ ] "Check again" clears the banner when popups are re-enabled
- [ ] Dismiss → indicator visible → click indicator → banner restores
- [ ] AppShell renders banner below TopBar
- [ ] LockOverlay handles null window.open() gracefully (shows inline message)

## Do NOT

- Use a toast for the banner (it must persist and be re-accessible after dismiss)
- Block app startup waiting for popup detection
- Show the banner in kiosk mode where the top bar is hidden (render it only when top bar is visible,
  or place it at the top of the content area in kiosk mode)
- Link directly to `chrome://` or `about:` URLs (browsers block these in anchor tags)

## Dev Notes

Decision file: `docs/decisions/visual-lock-overhaul.md`

This task does not depend on any backend tasks — it is purely frontend. It can be implemented
independently of DD-06-011 (lock overlay overhaul), though the lock overlay's SSO path will
call the same detection utility, so share the detection function between the two.

AppShell location: `frontend/src/shared/layout/AppShell.tsx`
TopBar component: check `frontend/src/shared/layout/` for the TopBar implementation.

The banner should use existing token values for warning states. Check
`frontend/src/shared/theme/theme-colors.ts` for the correct warning color token name.

Popup detection needs to be a utility function exported from a shared module (not inlined in
AppShell) so LockOverlay can import it too.
