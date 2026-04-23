import { useCallback } from "react";
import { useIOClipboardStore } from "./clipboardStore";
import { useGlobalSelectionStore } from "../../store/globalSelectionStore";
import { findTargetForZone, pickDefaultMode } from "./pasteTargetRegistry";
import { createTextFieldTarget } from "./targets/textFieldTarget";
import { showToast } from "../components/Toast";
import type { PasteMode } from "./types";

function isEditableElement(el: Element | null): boolean {
  if (!el) return false;
  const tag = el.tagName.toLowerCase();
  return (
    tag === "input" || tag === "textarea" || (el as HTMLElement).isContentEditable
  );
}

export function usePasteEngine() {
  const read = useIOClipboardStore((s) => s.readFromSystemClipboard);
  const getPrevious = useIOClipboardStore((s) => s.getPrevious);

  const pasteDefault = useCallback(async (): Promise<boolean> => {
    const payload = await read();
    const zoneId = useGlobalSelectionStore.getState().activeZone;
    if (!payload) return false;
    if (zoneId) {
      const target = findTargetForZone(zoneId);
      if (target) {
        const mode = pickDefaultMode(target, payload);
        if (mode) {
          await target.applyPaste(payload, mode);
          return true;
        }
      }
    }
    // Text-field fallback: if focused element is editable, paste text
    if (
      payload.contents.textRepresentation &&
      isEditableElement(document.activeElement)
    ) {
      await createTextFieldTarget().applyPaste(payload, "text");
      return true;
    }
    return false;
  }, [read]);

  const pastePrevious = useCallback(async (): Promise<boolean> => {
    const payload = getPrevious();
    const zoneId = useGlobalSelectionStore.getState().activeZone;
    if (!payload) {
      showToast({ title: "Nothing to paste", description: "No previous clipboard contents", variant: "warning" });
      return false;
    }
    if (zoneId) {
      const target = findTargetForZone(zoneId);
      if (target) {
        const mode = pickDefaultMode(target, payload);
        if (mode) {
          await target.applyPaste(payload, mode);
          return true;
        }
      }
    }
    if (
      payload.contents.textRepresentation &&
      isEditableElement(document.activeElement)
    ) {
      await createTextFieldTarget().applyPaste(payload, "text");
      return true;
    }
    return false;
  }, [getPrevious]);

  const pasteAs = useCallback(
    async (
      mode: PasteMode,
      source: "current" | "previous" = "current",
    ): Promise<boolean> => {
      const payload = source === "current" ? await read() : getPrevious();
      const zoneId = useGlobalSelectionStore.getState().activeZone;
      if (!zoneId || !payload) return false;
      const target = findTargetForZone(zoneId);
      if (target && target.accepts(payload).includes(mode)) {
        await target.applyPaste(payload, mode);
        return true;
      }
      // Text-field fallback for explicit text paste
      if (
        mode === "text" &&
        payload.contents.textRepresentation &&
        isEditableElement(document.activeElement)
      ) {
        await createTextFieldTarget().applyPaste(payload, "text");
        return true;
      }
      return false;
    },
    [read, getPrevious],
  );

  return { pasteDefault, pastePrevious, pasteAs };
}
