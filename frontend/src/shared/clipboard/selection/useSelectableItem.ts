import { useCallback } from "react";
import type { SelectableEntity, SelectionZoneId } from "../types";
import { useGlobalSelectionStore } from "../../../store/globalSelectionStore";

interface Opts {
  zoneId: SelectionZoneId;
  entity: SelectableEntity;
  interactive?: boolean;
  onInteractiveClick?: (e: React.MouseEvent) => void;
}

export function useSelectableItem({
  zoneId,
  entity,
  interactive,
  onInteractiveClick,
}: Opts) {
  const select = useGlobalSelectionStore((s) => s.select);
  const setActive = useGlobalSelectionStore((s) => s.setActiveZone);
  const isSelected = useGlobalSelectionStore(
    (s) => s.zones.get(zoneId)?.selected.has(entity.id) ?? false,
  );

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      setActive(zoneId);
      if (e.button !== 0) return;
      if (interactive && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
        onInteractiveClick?.(e);
        return;
      }
      if (e.ctrlKey || e.metaKey) {
        select(zoneId, entity, "toggle");
      } else if (e.shiftKey) {
        select(zoneId, entity, "add");
      } else {
        select(zoneId, entity, "replace");
      }
      e.stopPropagation();
    },
    [zoneId, entity, interactive, onInteractiveClick, select, setActive],
  );

  return { onMouseDown, isSelected };
}
