import type { PasteTarget, PasteMode } from "@/shared/clipboard/types";
import { extractPoints } from "@/shared/clipboard/extract";

export const reportsPasteTarget: PasteTarget = {
  id: "reports",
  zoneId: "reports",
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
        new CustomEvent("io-navigate:reports", {
          detail: { tagnames: points.map((p) => p.tagname), mode },
        }),
      );
    }
  },

  describeRejection(payload) {
    if (!payload) return "Clipboard is empty";
    return "Reports only accepts points or table rows";
  },
};
