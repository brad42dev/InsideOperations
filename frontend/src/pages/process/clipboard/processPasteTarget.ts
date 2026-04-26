import type { PasteTarget, PasteMode } from "@/shared/clipboard/types";
import { extractPoints } from "@/shared/clipboard/extract";

/**
 * Paste target for the Process module canvas.
 *
 * Accepts:
 *   - "native"  — open nodes in designer (dispatches io-navigate:designer)
 *   - "points"  — navigate to console with those points in a new trend pane
 */
export const processPasteTarget: PasteTarget = {
  id: "process",
  zoneId: "process",
  priority: 5,

  accepts(payload) {
    if (!payload) return [];
    const modes: PasteMode[] = [];
    if (extractPoints(payload).length) modes.push("points");
    if (payload.contents.nodes?.length) modes.push("native");
    return modes;
  },

  async applyPaste(payload, mode) {
    if (mode === "points") {
      const points = extractPoints(payload);
      if (points.length === 0) return;
      const tagnames = points.map((p) => p.tagname);
      // Navigate to console with the points pre-loaded as a trend
      window.dispatchEvent(
        new CustomEvent("io-navigate:console-trend", {
          detail: { tagnames },
        }),
      );
    } else if (mode === "native") {
      // Open the nodes in designer
      window.dispatchEvent(
        new CustomEvent("io-navigate:designer", {
          detail: { payload },
        }),
      );
    }
  },

  describeRejection(payload) {
    if (!payload) return "Clipboard is empty";
    return "Process canvas accepts points (opens trend) or shapes (opens in designer)";
  },
};
