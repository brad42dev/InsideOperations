import {
  buildIOClipboardPayload,
  useIOClipboardStore,
} from "@/shared/clipboard";
import { useGlobalSelectionStore } from "@/store/globalSelectionStore";
import type { LogEntrySnapshot } from "@/shared/clipboard/types";

export async function copyLogSelection(): Promise<void> {
  const selected = useGlobalSelectionStore.getState().getSelection("logbook");
  if (selected.length === 0) return;

  const entries = selected
    .filter((e) => e.kind === "log-entry")
    .map((e) => e.payload as LogEntrySnapshot);
  if (!entries.length) return;

  const pointRefs = entries
    .filter((e) => e.tagname)
    .map((e) => ({ tagname: e.tagname }));

  const payload = buildIOClipboardPayload({
    originContext: "logbook",
    contents: {
      logEntries: entries,
      ...(pointRefs.length ? { points: pointRefs } : {}),
      textRepresentation: entries.map((e) => e.tagname ?? e.id).join(" | "),
    },
  });
  await useIOClipboardStore.getState().writeToClipboard(payload);
}
