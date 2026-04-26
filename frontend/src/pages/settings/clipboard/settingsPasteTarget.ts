import type { PasteTarget, PasteMode } from "@/shared/clipboard/types";
import { extractPoints } from "@/shared/clipboard/extract";

/**
 * Paste target for the Settings / Point Management table.
 *
 * Accepts:
 *   - "points" — navigates to console with those points pre-loaded in a new trend pane
 *
 * Uses the same io-navigate:console-trend custom event pattern as the process
 * paste target. The console page is expected to listen for this event.
 */
export const settingsPasteTarget: PasteTarget = {
  id: "settings-points",
  zoneId: "settings-points",
  priority: 5,

  accepts(payload) {
    if (!payload) return [];
    const modes: PasteMode[] = [];
    if (extractPoints(payload).length) modes.push("points");
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
    }
  },

  describeRejection(payload) {
    if (!payload) return "Clipboard is empty";
    return "Point Management only accepts point references";
  },
};
