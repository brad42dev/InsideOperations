import {
  buildIOClipboardPayload,
  useIOClipboardStore,
} from "@/shared/clipboard";
import { useGlobalSelectionStore } from "@/store/globalSelectionStore";

export async function copyReportsSelection(): Promise<void> {
  const selected = useGlobalSelectionStore
    .getState()
    .getSelection("reports");
  if (selected.length === 0) return;

  const items = selected.map(
    (e) => e.payload as { name?: string; id?: string },
  );
  const text = items.map((i) => i.name ?? i.id ?? "report").join(" | ");

  const payload = buildIOClipboardPayload({
    originContext: "table",
    contents: {
      textRepresentation: text,
    },
  });
  await useIOClipboardStore.getState().writeToClipboard(payload);
}
