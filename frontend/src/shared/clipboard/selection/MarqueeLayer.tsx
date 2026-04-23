import { useCallback, useRef, useState } from "react";
import type { SelectableEntity, SelectionZoneId } from "../types";
import { useGlobalSelectionStore } from "../../../store/globalSelectionStore";

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

interface Props {
  zoneId: SelectionZoneId;
  enumerate: () => Array<{ entity: SelectableEntity; rect: Rect }>;
  containerRef: React.RefObject<HTMLElement>;
}

export function MarqueeLayer({ zoneId, enumerate, containerRef }: Props) {
  const [rect, setRect] = useState<Rect | null>(null);
  const modeRef = useRef<"add" | "toggle" | "remove" | "replace">("replace");
  const startRef = useRef<{ x: number; y: number } | null>(null);
  const selectMany = useGlobalSelectionStore((s) => s.selectMany);
  const clearZone = useGlobalSelectionStore((s) => s.clearZone);

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0) return;
      if (e.target !== containerRef.current) return;
      const bounds = containerRef.current!.getBoundingClientRect();
      startRef.current = { x: e.clientX - bounds.left, y: e.clientY - bounds.top };
      modeRef.current = e.altKey
        ? "remove"
        : e.ctrlKey || e.metaKey
          ? "add"
          : "replace";
      setRect({ top: startRef.current.y, left: startRef.current.x, width: 0, height: 0 });
    },
    [containerRef],
  );

  const onMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!startRef.current) return;
      const bounds = containerRef.current!.getBoundingClientRect();
      const x = e.clientX - bounds.left;
      const y = e.clientY - bounds.top;
      const left = Math.min(startRef.current.x, x);
      const top = Math.min(startRef.current.y, y);
      const width = Math.abs(x - startRef.current.x);
      const height = Math.abs(y - startRef.current.y);
      setRect({ top, left, width, height });
    },
    [containerRef],
  );

  const onMouseUp = useCallback(() => {
    if (!rect) return;
    const contained = enumerate()
      .filter(({ rect: r }) => fullyContained(r, rect))
      .map(({ entity }) => entity);
    if (modeRef.current === "replace") {
      if (contained.length === 0) clearZone(zoneId);
      else selectMany(zoneId, contained, "replace");
    } else if (modeRef.current === "add") {
      selectMany(zoneId, contained, "add");
    } else if (modeRef.current === "remove") {
      selectMany(zoneId, contained, "remove");
    }
    startRef.current = null;
    setRect(null);
  }, [rect, enumerate, selectMany, clearZone, zoneId]);

  return (
    <div
      style={{ position: "absolute", inset: 0 }}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={() => {
        startRef.current = null;
        setRect(null);
      }}
    >
      {rect ? (
        <div
          style={{
            position: "absolute",
            top: rect.top,
            left: rect.left,
            width: rect.width,
            height: rect.height,
            background: "rgba(80, 180, 255, 0.08)",
            border: "1px dashed var(--accent)",
            pointerEvents: "none",
          }}
        />
      ) : null}
    </div>
  );
}

function fullyContained(inner: Rect, outer: Rect): boolean {
  return (
    inner.left >= outer.left &&
    inner.top >= outer.top &&
    inner.left + inner.width <= outer.left + outer.width &&
    inner.top + inner.height <= outer.top + outer.height
  );
}
