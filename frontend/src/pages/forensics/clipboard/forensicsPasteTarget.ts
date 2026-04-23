import type { PasteTarget, PasteMode } from "@/shared/clipboard/types";
import { extractPoints } from "@/shared/clipboard/extract";

export const forensicsPasteTarget: PasteTarget = {
  id: "forensics",
  zoneId: "forensics",
  priority: 5,

  accepts(payload) {
    if (!payload) return [];
    const modes: PasteMode[] = [];
    if (extractPoints(payload).length) modes.push("points", "most-recent-alarms");
    return modes;
  },

  async applyPaste(payload, mode) {
    const points = extractPoints(payload);
    if (points.length > 0) {
      window.dispatchEvent(
        new CustomEvent("io-navigate:forensics", {
          detail: {
            tagnames: points.map((p) => p.tagname),
            mode: mode === "most-recent-alarms" ? "most-recent-alarms" : "points",
          },
        }),
      );
    }
  },

  describeRejection(payload) {
    if (!payload) return "Clipboard is empty";
    return "Forensics only accepts point references or time-range data";
  },
};
