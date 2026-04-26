import {
  buildIOClipboardPayload,
  useIOClipboardStore,
} from "@/shared/clipboard";
import { useGlobalSelectionStore } from "@/store/globalSelectionStore";
import type { PortablePointRef } from "@/shared/clipboard";

interface PointRow {
  tagname: string;
  display_name?: string | null;
  unit?: string | null;
  data_type?: string | null;
}

/**
 * Copy the current settings-points zone selection to the universal clipboard.
 *
 * Extracts PortablePointRef[] from selected table rows and builds a payload
 * that downstream paste targets (console trend, expression builder, etc.) can
 * consume as point references.
 */
export async function copySettingsPointsSelection(): Promise<void> {
  const selected = useGlobalSelectionStore
    .getState()
    .getSelection("settings-points");
  if (selected.length === 0) return;

  const rows = selected
    .filter((e) => e.kind === "table-row")
    .map((e) => e.payload as PointRow)
    .filter(Boolean);

  if (rows.length === 0) return;

  const points: PortablePointRef[] = rows.map((row) => ({
    tagname: row.tagname,
    displayName: row.display_name ?? undefined,
    unit: row.unit ?? undefined,
    dataType: row.data_type ?? undefined,
  }));

  const textRepresentation = points
    .map((p) =>
      p.displayName ? `${p.displayName} (${p.tagname})` : p.tagname,
    )
    .join(", ");

  const payload = buildIOClipboardPayload({
    originContext: "table",
    contents: {
      points,
      textRepresentation,
    },
  });

  await useIOClipboardStore.getState().writeToClipboard(payload);
}
