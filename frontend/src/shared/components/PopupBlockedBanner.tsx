/**
 * PopupBlockedBanner — DD-06-012
 *
 * Persistent banner that appears when the browser blocks popup windows.
 * Renders below the top bar (pushed, not overlay) and provides browser-specific
 * instructions to allow popups.
 *
 * Dismiss behaviour:
 * - Full banner hides; a compact warning indicator appears in the right section
 *   of the top bar area (rendered by the caller as a sibling).
 * - Dismissed state is stored in sessionStorage (resets on new session/tab).
 * - "Check again" re-runs the popup probe; clears banner if now allowed.
 *
 * Not shown in kiosk mode (caller's responsibility to gate this).
 */

import { useState, useEffect, useCallback } from "react";
import { detectPopupBlocked } from "../utils/popupDetection";

// ---------------------------------------------------------------------------
// Session storage key for dismissed state
// ---------------------------------------------------------------------------

const SESSION_KEY = "io_popup_banner_dismissed";

// ---------------------------------------------------------------------------
// Browser detection helpers — used for browser-specific instructions.
// We must NOT link to chrome:// or about: URLs (browsers block them).
// ---------------------------------------------------------------------------

type BrowserHint = {
  browser: "chrome" | "edge" | "firefox" | "safari" | "other";
  instructions: string;
};

function detectBrowser(): BrowserHint["browser"] {
  const ua = navigator.userAgent;
  if (/Edg\//.test(ua)) return "edge";
  if (/Chrome\//.test(ua) && !/Chromium\//.test(ua)) return "chrome";
  if (/Firefox\//.test(ua)) return "firefox";
  if (/Safari\//.test(ua) && !/Chrome\//.test(ua)) return "safari";
  return "other";
}

function getBrowserInstructions(browser: BrowserHint["browser"]): string {
  switch (browser) {
    case "chrome":
      return "In Chrome: click the address bar lock icon → Site settings → Popups and redirects → Allow";
    case "edge":
      return "In Edge: click the address bar lock icon → Permissions for this site → Pop-ups and redirects → Allow";
    case "firefox":
      return "In Firefox: Preferences → Privacy & Security → Block pop-up windows → Exceptions → add this site";
    case "safari":
      return "In Safari: Settings → Websites → Pop-up Windows → set this site to Allow";
    default:
      return "In your browser settings, allow popups for this site";
  }
}

// ---------------------------------------------------------------------------
// Hook: usePopupBlockedState
// Manages detection result, dismissed state, and re-probe.
// ---------------------------------------------------------------------------

export interface PopupBlockedState {
  /** Whether popups are currently detected as blocked */
  isBlocked: boolean;
  /** Whether the full banner has been dismissed (compact indicator shown instead) */
  isDismissed: boolean;
  /** Re-run the probe. If popups are now allowed, clears blocked state entirely. */
  checkAgain: () => void;
  /** Dismiss the full banner (stores flag in sessionStorage) */
  dismiss: () => void;
  /** Restore the full banner after it was dismissed */
  restore: () => void;
}

export function usePopupBlockedState(): PopupBlockedState {
  const [isBlocked, setIsBlocked] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  // Run probe once at mount (post-auth, pre-module render — AppShell mounts
  // after the auth guard has passed, satisfying this requirement).
  useEffect(() => {
    const blocked = detectPopupBlocked();
    setIsBlocked(blocked);
    if (blocked) {
      // Restore dismissed state from sessionStorage so a page refresh within
      // the same session doesn't re-show the full banner if already dismissed.
      const wasDismissed = sessionStorage.getItem(SESSION_KEY) === "1";
      setIsDismissed(wasDismissed);
    }
  }, []);

  const checkAgain = useCallback(() => {
    const blocked = detectPopupBlocked();
    setIsBlocked(blocked);
    if (!blocked) {
      // Popups are now allowed — clear dismissed state too
      setIsDismissed(false);
      try {
        sessionStorage.removeItem(SESSION_KEY);
      } catch {
        // ignore
      }
    }
  }, []);

  const dismiss = useCallback(() => {
    setIsDismissed(true);
    try {
      sessionStorage.setItem(SESSION_KEY, "1");
    } catch {
      // ignore storage errors
    }
  }, []);

  const restore = useCallback(() => {
    setIsDismissed(false);
    try {
      sessionStorage.removeItem(SESSION_KEY);
    } catch {
      // ignore
    }
  }, []);

  return { isBlocked, isDismissed, checkAgain, dismiss, restore };
}

// ---------------------------------------------------------------------------
// PopupBlockedBanner component
// ---------------------------------------------------------------------------

interface PopupBlockedBannerProps {
  state: PopupBlockedState;
}

export default function PopupBlockedBanner({ state }: PopupBlockedBannerProps) {
  const { isBlocked, isDismissed, checkAgain, dismiss } = state;

  // Do not render anything if popups are allowed
  if (!isBlocked) return null;
  // Do not render the full banner if dismissed (compact indicator shown by caller)
  if (isDismissed) return null;

  const browser = detectBrowser();
  const instructions = getBrowserInstructions(browser);

  return (
    <div
      role="alert"
      aria-live="polite"
      style={{
        width: "100%",
        background: "var(--io-surface-warning, rgba(245,158,11,0.12))",
        borderBottom: "1px solid var(--io-warning, #f59e0b)",
        display: "flex",
        alignItems: "center",
        flexWrap: "wrap",
        gap: "6px 12px",
        padding: "7px 16px",
        fontSize: "12px",
        color: "var(--io-text-primary)",
        flexShrink: 0,
        // Banner pushes layout down — it is NOT position:fixed or position:absolute
      }}
    >
      {/* Warning icon */}
      <span
        aria-hidden="true"
        style={{
          color: "var(--io-warning, #f59e0b)",
          fontSize: "14px",
          flexShrink: 0,
        }}
      >
        ⚠
      </span>

      {/* Main message */}
      <span style={{ flex: "1 1 auto", minWidth: 0 }}>
        <strong>Popups are blocked.</strong> Inside/Operations uses popups for
        multi-window support and SSO sign-in.{" "}
        <em style={{ fontStyle: "normal", color: "var(--io-text-muted)" }}>
          {instructions}
        </em>
      </span>

      {/* Action buttons */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          flexShrink: 0,
        }}
      >
        <button type="button" onClick={checkAgain} style={actionButtonStyle()}>
          Check again
        </button>

        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss popup blocked banner"
          style={actionButtonStyle()}
        >
          ✕ Dismiss
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// PopupBlockedIndicator — compact version shown in top bar after dismiss
// ---------------------------------------------------------------------------

interface PopupBlockedIndicatorProps {
  state: PopupBlockedState;
}

/**
 * Small warning icon that appears in the top bar right section when the full
 * banner has been dismissed. Clicking it restores the full banner.
 */
export function PopupBlockedIndicator({ state }: PopupBlockedIndicatorProps) {
  const { isBlocked, isDismissed, restore } = state;

  if (!isBlocked || !isDismissed) return null;

  return (
    <button
      type="button"
      onClick={restore}
      title="Popups are blocked — click to view details"
      aria-label="Popups are blocked. Click to restore warning banner."
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "none",
        border: "1px solid var(--io-warning, #f59e0b)",
        borderRadius: "var(--io-radius)",
        color: "var(--io-warning, #f59e0b)",
        cursor: "pointer",
        padding: "6px",
        width: "34px",
        height: "34px",
        fontSize: "14px",
        flexShrink: 0,
      }}
    >
      ⚠
    </button>
  );
}

// ---------------------------------------------------------------------------
// Inline style helpers
// ---------------------------------------------------------------------------

function actionButtonStyle(): React.CSSProperties {
  return {
    background: "none",
    border: "1px solid var(--io-warning, #f59e0b)",
    borderRadius: "var(--io-radius)",
    color: "var(--io-text-primary)",
    cursor: "pointer",
    fontSize: "11px",
    padding: "3px 8px",
    whiteSpace: "nowrap",
  };
}
