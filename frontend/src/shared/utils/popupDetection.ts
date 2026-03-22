/**
 * Popup detection utility — DD-06-012
 *
 * Runs a silent window.open() probe to determine whether the browser is
 * blocking popup windows. Used at app init and on-demand (Check again).
 *
 * The probe window is immediately closed if it opens. No visible flash occurs
 * because the window is 1×1 pixels and is closed synchronously.
 *
 * Import this function wherever popup availability must be tested; do not
 * inline the probe logic in components.
 */

/**
 * Returns true if the browser blocked the popup, false if popups are allowed.
 *
 * NOTE: Some browsers (especially on mobile) may return a non-null window
 * object even when popups are blocked. The `closed` and `typeof closed`
 * guards handle those edge cases.
 */
export function detectPopupBlocked(): boolean {
  try {
    const probe = window.open('', '_blank', 'width=1,height=1')
    if (!probe || probe.closed || typeof probe.closed === 'undefined') {
      return true // blocked
    }
    probe.close()
    return false
  } catch {
    // If window.open throws (e.g. cross-origin sandbox restrictions), treat
    // as blocked.
    return true
  }
}
