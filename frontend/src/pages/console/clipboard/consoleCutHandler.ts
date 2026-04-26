import { useGlobalSelectionStore } from "@/store/globalSelectionStore";
import { useWorkspaceStore } from "@/store/workspaceStore";
import { copyConsoleActiveZone } from "./consoleCopyHandler";
import type { SelectionZoneId } from "@/shared/clipboard";

/**
 * Cut handler for the console zone. Copies the selected panes to the universal
 * clipboard then removes them from the active workspace. For within-pane zones
 * (e.g. console/pane/{id}) the selection is content rows which can't be deleted,
 * so cut falls through to copy-only.
 */
export async function cutConsoleActiveZone(zoneId: string): Promise<void> {
  if (zoneId !== "console") {
    await copyConsoleActiveZone(zoneId);
    return;
  }

  // Snapshot pane IDs BEFORE the async copy so selection drift during the
  // graphicsApi.get() fetch window doesn't cause mismatched copy/delete.
  const preCopySelected = useGlobalSelectionStore
    .getState()
    .getSelection("console" as SelectionZoneId);
  const paneIdsToDelete = preCopySelected
    .filter((e) => e.kind === "pane")
    .map((e) => e.id);

  await copyConsoleActiveZone(zoneId);

  if (paneIdsToDelete.length === 0) return;

  const state = useWorkspaceStore.getState();
  const activeWs = state.workspaces.find((w) => w.id === state.activeId);
  if (!activeWs) return;

  for (const paneId of paneIdsToDelete) {
    state.removePane(activeWs.id, paneId);
  }
  useGlobalSelectionStore.getState().clearZone("console" as SelectionZoneId);
}
