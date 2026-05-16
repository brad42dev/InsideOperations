export type {
  ShapeSidecar,
  ShapeVariantOption,
  ShapeVariants,
  ShapeAlarmBinding,
  ConnectionPoint,
  TextZone,
  ValueAnchor,
} from "../types/shapes";
import type { ShapeSidecar } from "../types/shapes";

export interface ShapeData {
  svg: string;
  sidecar: ShapeSidecar;
}

const CACHE_MAX = 200;
const cache = new Map<string, ShapeData>();

function evictIfNeeded(): void {
  if (cache.size >= CACHE_MAX) {
    const firstKey = cache.keys().next().value;
    if (firstKey) cache.delete(firstKey);
  }
}

export const shapeCache = {
  get(shapeId: string): ShapeData | undefined {
    const entry = cache.get(shapeId);
    if (entry) {
      cache.delete(shapeId);
      cache.set(shapeId, entry);
    }
    return entry;
  },

  set(shapeId: string, data: ShapeData): void {
    if (cache.has(shapeId)) {
      cache.delete(shapeId);
    } else {
      evictIfNeeded();
    }
    cache.set(shapeId, data);
  },

  has(shapeId: string): boolean {
    return cache.has(shapeId);
  },

  delete(shapeId: string): void {
    cache.delete(shapeId);
  },

  clear(): void {
    cache.clear();
  },

  size(): number {
    return cache.size;
  },
};

/**
 * Fetch all required shapes, using cache where possible.
 * Missing shapes are fetched via the provided batchFetch function (DB batch endpoint).
 * If batchFetch is not provided or fails, missing shapes are omitted from the result.
 */
export async function fetchShapes(
  shapeIds: string[],
  batchFetch?: (ids: string[]) => Promise<Record<string, ShapeData>>,
): Promise<Map<string, ShapeData>> {
  const result = new Map<string, ShapeData>();
  const missing: string[] = [];

  for (const id of shapeIds) {
    const cached = shapeCache.get(id);
    if (cached) {
      result.set(id, cached);
    } else {
      missing.push(id);
    }
  }

  if (missing.length > 0 && batchFetch) {
    try {
      const fetched = await batchFetch(missing);
      for (const [id, data] of Object.entries(fetched)) {
        shapeCache.set(id, data);
        result.set(id, data);
      }
    } catch (e) {
      console.error("[shapeCache] batchFetch failed:", e);
      // Missing shapes will not be in result; callers render nothing for them
    }
  }

  return result;
}
