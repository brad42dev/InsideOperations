import { useEffect } from "react";
import type { SelectionZoneConfig } from "../shared/clipboard";
import { useGlobalSelectionStore } from "./globalSelectionStore";

/**
 * Register a selection zone on mount and unregister on unmount.
 * Returns selectors for the zone's current selection plus action helpers.
 */
export function useSelectionZone(config: SelectionZoneConfig) {
  const register = useGlobalSelectionStore((s) => s.registerZone);
  const unregister = useGlobalSelectionStore((s) => s.unregisterZone);

  useEffect(() => {
    register(config);
    return () => unregister(config.zoneId);
    // Intentionally re-register only if zoneId changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.zoneId]);

  const selection = useGlobalSelectionStore(
    (s) => s.zones.get(config.zoneId)?.selected,
  );
  return {
    selection: selection ? Array.from(selection.values()) : [],
    isSelected: (id: string) =>
      useGlobalSelectionStore.getState().isSelected(config.zoneId, id),
  };
}
