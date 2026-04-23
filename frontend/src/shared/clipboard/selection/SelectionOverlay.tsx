import { CSSProperties } from "react";
import type { SelectionZoneId } from "../types";
import { useGlobalSelectionStore } from "../../../store/globalSelectionStore";

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

interface Props {
  zoneId: SelectionZoneId;
  rectOf: (entityId: string) => Rect | null;
  className?: string;
  style?: CSSProperties;
}

export function SelectionOverlay({ zoneId, rectOf, className, style }: Props) {
  const entities = useGlobalSelectionStore(
    (s) => Array.from(s.zones.get(zoneId)?.selected.keys() ?? []),
  );
  const indicatorStyle = useGlobalSelectionStore(
    (s) => s.zones.get(zoneId)?.config.indicatorStyle ?? "selection-box",
  );

  return (
    <div
      className={["io-selection-overlay", className].filter(Boolean).join(" ")}
      style={{ position: "absolute", inset: 0, pointerEvents: "none", ...style }}
      data-zone={zoneId}
    >
      {entities.map((id) => {
        const r = rectOf(id);
        if (!r) return null;
        return (
          <div
            key={id}
            data-indicator={indicatorStyle}
            style={{
              position: "absolute",
              top: r.top,
              left: r.left,
              width: r.width,
              height: r.height,
            }}
          />
        );
      })}
    </div>
  );
}
