import { useEffect, useMemo } from "react";
import { useLibraryStore } from "@/store/designer/libraryStore";

interface ShapeThumbnailProps {
  shapeId: string;
  size?: number;
  style?: React.CSSProperties;
}

export function ShapeThumbnail({ shapeId, size = 40, style }: ShapeThumbnailProps) {
  const entry = useLibraryStore((s) => s.cache.get(shapeId));
  const loadShape = useLibraryStore((s) => s.loadShape);

  useEffect(() => {
    if (!entry) loadShape(shapeId);
  }, [shapeId, entry, loadShape]);

  const blobUrl = useMemo(() => {
    if (!entry?.svg) return null;
    const blob = new Blob([entry.svg], { type: "image/svg+xml" });
    return URL.createObjectURL(blob);
  }, [entry?.svg]);

  useEffect(() => {
    return () => {
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [blobUrl]);

  if (!blobUrl) {
    return <div style={{ width: size, height: size, flexShrink: 0, ...style }} />;
  }

  return (
    <img
      src={blobUrl}
      alt=""
      style={{ width: size, height: size, objectFit: "contain", flexShrink: 0, ...style }}
    />
  );
}
