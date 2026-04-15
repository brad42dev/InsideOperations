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

  clear(): void {
    cache.clear();
  },

  size(): number {
    return cache.size;
  },
};

// Shape index: shapeId -> category (loaded once)
let shapeIndexPromise: Promise<Map<string, string>> | null = null;

async function getShapeIndex(): Promise<Map<string, string>> {
  if (!shapeIndexPromise) {
    shapeIndexPromise = fetch("/shapes/index.json")
      .then((r) => r.json())
      .then((data: { shapes: Array<{ id: string; category: string }> }) => {
        const m = new Map<string, string>();
        for (const s of data.shapes) m.set(s.id, s.category);
        return m;
      })
      .catch(() => new Map<string, string>());
  }
  return shapeIndexPromise;
}

/**
 * Resolve the SVG filename for a shape from its sidecar.
 * For shapes with variants.options, defaults to opt1.
 * For shapes without variants (or with no options), falls back to "{shapeId}.svg".
 */
function resolveSvgFilename(
  shapeId: string,
  sidecar: ShapeSidecar,
  optionKey?: string,
): string {
  const options = sidecar.variants?.options;
  if (options) {
    const key = optionKey ?? "opt1";
    const option = options[key] ?? Object.values(options)[0];
    if (option?.file) return option.file;
  }
  // No variants.options — fall back to shape ID as filename
  return `${shapeId}.svg`;
}

/**
 * Fetch shapes from public static files (fallback when backend API is unavailable).
 * Reads /shapes/{category}/{id}.json then resolves SVG filename from sidecar variants.
 */
export async function fetchShapesFromPublic(
  shapeIds: string[],
  optionKey?: string,
): Promise<Record<string, ShapeData>> {
  const index = await getShapeIndex();
  const results: Record<string, ShapeData> = {};

  await Promise.all(
    shapeIds.map(async (id) => {
      const category = index.get(id);
      if (!category) return;
      const base = `/shapes/${category}/${id}`;
      try {
        const jsonRes = await fetch(`${base}.json`);
        if (!jsonRes.ok) return;
        const sidecar = (await jsonRes.json()) as ShapeSidecar;

        const svgFilename = resolveSvgFilename(id, sidecar, optionKey);
        const svgRes = await fetch(`/shapes/${category}/${svgFilename}`);
        if (!svgRes.ok) return;
        const svg = await svgRes.text();

        results[id] = { svg, sidecar };
      } catch {
        // shape not found — skip
      }
    }),
  );

  return results;
}

/**
 * Fetch all required shapes, using cache where possible.
 * Falls back to public static files when the API batch fetch fails or returns empty.
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

  if (missing.length > 0) {
    let fetched: Record<string, ShapeData> = {};

    if (batchFetch) {
      try {
        fetched = await batchFetch(missing);
      } catch {
        // fall through to static fallback
      }
    }

    // Fall back to static files for any still-missing shapes
    const stillMissing = missing.filter((id) => !fetched[id]);
    if (stillMissing.length > 0) {
      const staticFetched = await fetchShapesFromPublic(stillMissing);
      Object.assign(fetched, staticFetched);
    }

    for (const [id, data] of Object.entries(fetched)) {
      shapeCache.set(id, data);
      result.set(id, data);
    }
  }

  return result;
}
