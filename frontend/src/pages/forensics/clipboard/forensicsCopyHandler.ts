import {
  buildIOClipboardPayload,
  useIOClipboardStore,
} from "@/shared/clipboard";
import { useGlobalSelectionStore } from "@/store/globalSelectionStore";

export async function copyForensicsSelection(): Promise<void> {
  const selected = useGlobalSelectionStore.getState().getSelection("forensics");
  if (selected.length === 0) return;

  const hits = selected
    .filter((e) => e.kind === "forensics-hit")
    .map((e) => e.payload as { tagname: string; severity?: string });
  if (!hits.length) return;

  const points = hits
    .filter((h) => h.tagname)
    .map((h) => ({ tagname: h.tagname }));
  const alarms = hits
    .filter((h) => h.tagname)
    .map((h) => ({ tagname: h.tagname, severity: h.severity }));

  const payload = buildIOClipboardPayload({
    originContext: "forensics",
    contents: {
      points,
      alarms,
      textRepresentation: points.map((p) => p.tagname).join(" | "),
    },
  });
  await useIOClipboardStore.getState().writeToClipboard(payload);
}
