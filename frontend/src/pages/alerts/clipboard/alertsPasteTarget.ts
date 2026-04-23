import type { PasteTarget, PasteMode } from "@/shared/clipboard/types";
import { extractPoints } from "@/shared/clipboard/extract";
import { openForensicsWithPoints } from "@/shared/clipboard/targets/mostRecentAlarmsHook";
import { showToast } from "@/shared/components/Toast";

export const alertsPasteTarget: PasteTarget = {
  id: "alarm-list",
  zoneId: "alarm-list",
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
      await openForensicsWithPoints(
        points.map((p) => p.tagname),
        mode === "most-recent-alarms" ? "most-recent-alarms" : "points",
      );
    } else {
      showToast({ title: "Nothing to paste", description: "Clipboard has no point references", variant: "warning" });
    }
  },

  describeRejection(payload) {
    if (!payload) return "Clipboard is empty";
    return "Alarm list only accepts points";
  },
};
