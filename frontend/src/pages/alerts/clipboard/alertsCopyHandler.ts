import {
  buildIOClipboardPayload,
  useIOClipboardStore,
} from "@/shared/clipboard";
import { useGlobalSelectionStore } from "@/store/globalSelectionStore";

export async function copyAlertsSelection(): Promise<void> {
  const selected = useGlobalSelectionStore
    .getState()
    .getSelection("alarm-list");
  if (selected.length === 0) return;

  const items = selected
    .filter((e) => e.kind === "alarm-row")
    .map((e) => e.payload as { tagname?: string; title?: string; severity?: string });
  if (!items.length) return;

  const alarms = items
    .filter((a) => a.tagname)
    .map((a) => ({ tagname: a.tagname!, severity: a.severity }));

  const text = items.map((a) => a.title ?? a.tagname ?? "alert").join(" | ");

  const payload = buildIOClipboardPayload({
    originContext: "alarm-list",
    contents: {
      alarms,
      ...(alarms.length ? { points: alarms.map((a) => ({ tagname: a.tagname })) } : {}),
      textRepresentation: text,
    },
  });
  await useIOClipboardStore.getState().writeToClipboard(payload);
}
