import { useEffect, useRef } from "react";
import { useGlobalSelectionStore } from "../../../store/globalSelectionStore";
import { usePasteEngine } from "../usePasteEngine";

interface KeybindMatcher {
  test: (zoneId: string) => boolean;
  handler: (zoneId: string) => void | Promise<void>;
}

interface KeybindOptions {
  matchers?: KeybindMatcher[];
  cutMatchers?: KeybindMatcher[];
}

/**
 * Global keyboard handler for Ctrl+C / Ctrl+X / Ctrl+V / Ctrl+Alt+V / Escape.
 * Mount ONCE at the app root.
 *
 * cutHandlers: zones that support destructive cut (copy + delete). Zones not
 * listed here silently ignore Ctrl+X — modules that handle it locally (designer)
 * are intentionally excluded so their local handler takes precedence.
 */
export function useSelectionKeybinds(
  copyHandlers: Record<string, () => void | Promise<void>>,
  options?: KeybindOptions,
  cutHandlers?: Record<string, () => void | Promise<void>>,
) {
  const { pasteDefault, pastePrevious } = usePasteEngine();

  // Store handler maps in refs so the window listener is mounted once (stable)
  // rather than re-added every render when callers pass inline object literals.
  const copyRef = useRef(copyHandlers);
  const optsRef = useRef(options);
  const cutRef = useRef(cutHandlers);
  copyRef.current = copyHandlers;
  optsRef.current = options;
  cutRef.current = cutHandlers;

  useEffect(() => {
    const onKey = async (e: KeyboardEvent) => {
      const tgt = e.target as HTMLElement | null;
      if (
        tgt &&
        (tgt.tagName === "INPUT" ||
          tgt.tagName === "TEXTAREA" ||
          tgt.isContentEditable)
      ) {
        return;
      }
      const zoneId = useGlobalSelectionStore.getState().activeZone;
      if (!zoneId) return;

      const ctrl = e.ctrlKey || e.metaKey;
      const copy = copyRef.current;
      const opts = optsRef.current;
      const cut = cutRef.current;

      if (ctrl && !e.shiftKey && !e.altKey && e.key.toLowerCase() === "c") {
        const direct = copy[zoneId];
        const matcher = !direct
          ? opts?.matchers?.find((m) => m.test(zoneId))
          : null;
        if (direct) {
          e.preventDefault();
          await direct();
        } else if (matcher) {
          e.preventDefault();
          await matcher.handler(zoneId);
        }
      } else if (
        ctrl &&
        !e.shiftKey &&
        !e.altKey &&
        e.key.toLowerCase() === "x"
      ) {
        const direct = cut?.[zoneId];
        const matcher = !direct
          ? opts?.cutMatchers?.find((m) => m.test(zoneId))
          : null;
        if (direct) {
          e.preventDefault();
          await direct();
        } else if (matcher) {
          e.preventDefault();
          await matcher.handler(zoneId);
        }
        // No fallback — zones without a cut handler ignore Ctrl+X globally
        // (e.g. designer handles it locally via its own onKeyDown handler)
      } else if (ctrl && !e.shiftKey && !e.altKey && e.key.toLowerCase() === "v") {
        e.preventDefault();
        await pasteDefault();
      } else if (ctrl && e.altKey && e.key.toLowerCase() === "v") {
        e.preventDefault();
        await pastePrevious();
      } else if (e.key === "Escape") {
        useGlobalSelectionStore.getState().clearZone(zoneId);
      }
      // Ctrl+A is zone-specific — each zone mounts its own handler.
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // pasteDefault and pastePrevious are stable useCallback refs — this effect
    // runs once on mount.
  }, [pasteDefault, pastePrevious]); // eslint-disable-line react-hooks/exhaustive-deps
}
