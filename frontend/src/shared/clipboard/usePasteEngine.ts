import { useCallback } from "react";
import { useIOClipboardStore } from "./clipboardStore";
import { useGlobalSelectionStore } from "../../store/globalSelectionStore";
import { findTargetForZone, pickDefaultMode } from "./pasteTargetRegistry";
import { createTextFieldTarget } from "./targets/textFieldTarget";
import { showToast } from "../components/Toast";
import type { IOClipboardPayload, PasteMode } from "./types";

function describePaste(payload: IOClipboardPayload): string {
  const c = payload.contents;
  const parts: string[] = [];
  const n = (count: number, singular: string, plural: string) =>
    `${count} ${count === 1 ? singular : plural}`;
  if (c.nodes?.length) parts.push(n(c.nodes.length, "shape", "shapes"));
  if (c.points?.length) parts.push(n(c.points.length, "point", "points"));
  if (c.paneConfigs?.length)
    parts.push(n(c.paneConfigs.length, "pane", "panes"));
  if (c.alarms?.length) parts.push(n(c.alarms.length, "alarm", "alarms"));
  if (c.logEntries?.length)
    parts.push(n(c.logEntries.length, "log entry", "log entries"));
  if (c.tableRows?.length) parts.push(n(c.tableRows.length, "row", "rows"));
  if (c.expressionTiles?.length)
    parts.push(
      n(c.expressionTiles.length, "expression tile", "expression tiles"),
    );
  return parts.length > 0 ? parts.join(", ") : "clipboard contents";
}

async function applyAndToast(
  apply: () => void | Promise<void>,
  payload: IOClipboardPayload,
): Promise<boolean> {
  try {
    await apply();
    showToast({
      title: "Pasted",
      description: describePaste(payload),
      variant: "success",
    });
    return true;
  } catch (err) {
    showToast({
      title: "Paste failed",
      description: err instanceof Error ? err.message : "Unknown error",
      variant: "error",
    });
    return false;
  }
}

function isEditableElement(el: Element | null): boolean {
  if (!el) return false;
  const tag = el.tagName.toLowerCase();
  return (
    tag === "input" ||
    tag === "textarea" ||
    (el as HTMLElement).isContentEditable
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
          return applyAndToast(() => target.applyPaste(payload, mode), payload);
        }
      }
    }
    // Text-field fallback: if focused element is editable, paste text
    if (
      payload.contents.textRepresentation &&
      isEditableElement(document.activeElement)
    ) {
      return applyAndToast(
        () => createTextFieldTarget().applyPaste(payload, "text"),
        payload,
      );
    }
    return false;
  }, [read]);

  const pastePrevious = useCallback(async (): Promise<boolean> => {
    const payload = getPrevious();
    const zoneId = useGlobalSelectionStore.getState().activeZone;
    if (!payload) {
      showToast({
        title: "Nothing to paste",
        description: "No previous clipboard contents",
        variant: "warning",
      });
      return false;
    }
    if (zoneId) {
      const target = findTargetForZone(zoneId);
      if (target) {
        const mode = pickDefaultMode(target, payload);
        if (mode) {
          return applyAndToast(() => target.applyPaste(payload, mode), payload);
        }
      }
    }
    if (
      payload.contents.textRepresentation &&
      isEditableElement(document.activeElement)
    ) {
      return applyAndToast(
        () => createTextFieldTarget().applyPaste(payload, "text"),
        payload,
      );
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
        return applyAndToast(() => target.applyPaste(payload, mode), payload);
      }
      // Text-field fallback for explicit text paste
      if (
        mode === "text" &&
        payload.contents.textRepresentation &&
        isEditableElement(document.activeElement)
      ) {
        return applyAndToast(
          () => createTextFieldTarget().applyPaste(payload, "text"),
          payload,
        );
      }
      return false;
    },
    [read, getPrevious],
  );

  return { pasteDefault, pastePrevious, pasteAs };
}
