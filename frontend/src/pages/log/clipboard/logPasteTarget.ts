import type { PasteTarget, PasteMode } from "@/shared/clipboard/types";
import { extractPoints } from "@/shared/clipboard/extract";

export const logPasteTarget: PasteTarget = {
  id: "logbook",
  zoneId: "logbook",
  priority: 5,

  accepts(payload) {
    if (!payload) return [];
    const modes: PasteMode[] = [];
    if (extractPoints(payload).length) modes.push("points");
    if (payload.contents.tableRows?.length) modes.push("table");
    return modes;
  },

  async applyPaste(payload, mode) {
    if (mode === "points" || mode === "table") {
      const points = extractPoints(payload);
      window.dispatchEvent(
        new CustomEvent("io-navigate:logbook", {
          detail: { tagnames: points.map((p) => p.tagname), mode },
        }),
      );
    }
  },

  describeRejection(payload) {
    if (!payload) return "Clipboard is empty";
    return "Logbook only accepts points or table rows";
  },
};
