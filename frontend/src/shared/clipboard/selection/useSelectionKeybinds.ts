import { useEffect } from "react";
import { useGlobalSelectionStore } from "../../../store/globalSelectionStore";
import { usePasteEngine } from "../usePasteEngine";

interface KeybindMatcher {
  test: (zoneId: string) => boolean;
  handler: (zoneId: string) => void | Promise<void>;
}

interface KeybindOptions {
  matchers?: KeybindMatcher[];
}

/**
 * Global keyboard handler for Ctrl+C / Ctrl+V / Ctrl+Alt+V / Escape.
 * Mount ONCE at the app root.
 */
export function useSelectionKeybinds(
  copyHandlers: Record<string, () => void | Promise<void>>,
  options?: KeybindOptions,
) {
  const { pasteDefault, pastePrevious } = usePasteEngine();

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

      if (
        (e.ctrlKey || e.metaKey) &&
        !e.shiftKey &&
        !e.altKey &&
        e.key.toLowerCase() === "c"
      ) {
        const direct = copyHandlers[zoneId];
        const matcher = !direct
          ? options?.matchers?.find((m) => m.test(zoneId))
          : null;
        if (direct) {
          e.preventDefault();
          await direct();
        } else if (matcher) {
          e.preventDefault();
          await matcher.handler(zoneId);
        }
      } else if (
        (e.ctrlKey || e.metaKey) &&
        !e.shiftKey &&
        !e.altKey &&
        e.key.toLowerCase() === "v"
      ) {
        e.preventDefault();
        await pasteDefault();
      } else if (
        (e.ctrlKey || e.metaKey) &&
        e.altKey &&
        e.key.toLowerCase() === "v"
      ) {
        e.preventDefault();
        await pastePrevious();
      } else if (e.key === "Escape") {
        useGlobalSelectionStore.getState().clearZone(zoneId);
      }
      // Ctrl+A is zone-specific — each zone mounts its own handler.
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pasteDefault, pastePrevious, copyHandlers, options]);
}
