/**
 * libraryStore.ts
 *
 * Shape library cache for the Designer module.
 *
 * Responsibilities:
 *  - Fetches and caches the global shape index from /shapes/index.json (once).
 *  - Loads individual shape SVG + JSON sidecar files on demand from:
 *      /shapes/{category}/{id}.svg
 *      /shapes/{category}/{id}.json
 *    (falls back to /shapes/{id}.svg and /shapes/{id}.json if category unknown)
 *  - Maintains an in-memory cache of up to 200 fully-loaded shapes.
 *  - Deduplicates concurrent loads for the same shape ID.
 *  - Provides synchronous getShape() for rendering code that has already
 *    triggered a load.
 *
 * The shape index JSON is expected to have the shape:
 * {
 *   shapes: Array<{
 *     id: string
 *     category: string
 *     label: string
 *     subcategory?: string
 *   }>
 * }
 */

import { create } from "zustand";

// ---------------------------------------------------------------------------
// Exported sidecar types (mirror the .iographic shape sidecar schema)
// ---------------------------------------------------------------------------

/** Connection point — actual JSON uses absolute x/y coords */
export interface ConnectionPoint {
  id: string;
  /** Absolute x coordinate in viewBox space */
  x?: number;
  /** Absolute y coordinate in viewBox space */
  y?: number;
  direction: "left" | "right" | "up" | "down" | "top" | "bottom";
  type: "process" | "signal" | "actuator" | "electrical";
  rotatesWithShape?: boolean;
}

/** Text zone — actual JSON uses absolute x/y with width */
export interface TextZone {
  id: string;
  x?: number;
  y?: number;
  width?: number;
  anchor?: "start" | "middle" | "end";
  fontSize?: number;
}

/** Value anchor — actual JSON uses normalized nx/ny with preferredElement */
export interface ValueAnchor {
  /** Normalized x (0–1) relative to shape width */
  nx?: number;
  /** Normalized y (0–1) relative to shape height */
  ny?: number;
  preferredElement?: string;
}

export interface ShapeSidecar {
  id?: string;
  category?: string;
  geometry: {
    viewBox: string;
    /** Preferred: [width, height] tuple */
    baseSize?: [number, number];
    /** Flat format used by most sidecar files */
    width?: number;
    height?: number;
    gridSnap?: number;
    orientations?: number[];
    mirrorable?: boolean;
  };
  connections?: ConnectionPoint[];
  textZones?: TextZone[];
  valueAnchors?: ValueAnchor[];
  /** Alarm anchor — either normalized [nx, ny] tuple or {nx, ny} object */
  alarmAnchor?: [number, number] | { nx: number; ny: number };
  states?: Record<string, string> | string[];
  /** Optional variant files — normalized flat array (populated from `variants.options` on load) */
  options?: Array<{ id: string; file: string; label: string }>;
  /** Raw variant structure from JSON sidecar — normalized into `options` on load */
  variants?: { options?: Record<string, { file: string; label: string }> };
  /** Optional configuration files */
  configurations?: Array<{ id: string; label: string; file: string }>;
  addons?: Array<{
    id: string;
    file: string;
    label: string;
    group?: string;
    exclusive?: boolean;
  }>;
  anchorSlots?: Partial<
    Record<
      | "PointNameLabel"
      | "AlarmIndicator"
      | "TextReadout"
      | "AnalogBar"
      | "FillGauge"
      | "Sparkline"
      | "DigitalStatus",
      string[]
    >
  >;
  defaultSlots?: Record<string, string>;
  bindableParts?: Array<{ partId: string; label: string; category: string }>;
}

// ---------------------------------------------------------------------------
// Cache entry
// ---------------------------------------------------------------------------

export interface ShapeEntry {
  id: string;
  svg: string;
  sidecar: ShapeSidecar;
}

// ---------------------------------------------------------------------------
// Index entry
// ---------------------------------------------------------------------------

export interface ShapeIndexItem {
  id: string;
  category: string;
  label: string;
  subcategory?: string;
  /** 'library' = built-in Tier 1 shape (read-only for reimport), 'user' = custom shape */
  source?: "library" | "user";
}

// ---------------------------------------------------------------------------
// Raw index JSON shape
// ---------------------------------------------------------------------------

interface RawIndexShape {
  id: string;
  category: string;
  label: string;
  subcategory?: string;
}

interface RawIndex {
  shapes: RawIndexShape[];
}

// ---------------------------------------------------------------------------
// Store interface
// ---------------------------------------------------------------------------

export interface LibraryStore {
  /** All shapes available in the library, in the order returned by the index. */
  index: ShapeIndexItem[];
  /** True once the index has been successfully fetched (not set on failure). */
  indexLoaded: boolean;
  /** True while the index fetch is in progress. */
  indexLoading: boolean;
  /** Error message if the index fetch failed; null otherwise. */
  indexError: string | null;

  /** Fully loaded shapes, keyed by shape ID. */
  cache: Map<string, ShapeEntry>;
  /** IDs currently being fetched (deduplication). */
  loadingIds: Set<string>;

  /** Stencil SVG cache — keyed by stencilId (design_objects.id), value is raw SVG string. */
  stencilCache: Map<string, string>;

  /**
   * Load a stencil SVG by its design_objects ID.
   * Deduplicates concurrent calls. Returns SVG string or null on error.
   */
  loadStencil(id: string): Promise<string | null>;

  /**
   * Synchronous stencil SVG lookup. Returns null if not yet cached.
   */
  getStencil(id: string): string | null;

  /**
   * Populate the stencil cache from a list-stencils API response.
   * Call this after a successful listStencils() to avoid per-stencil fetches.
   */
  cacheStencilList(items: Array<{ id: string; svg_data?: string }>): void;

  /**
   * Fetch /shapes/index.json and populate `index`.
   * Safe to call multiple times — subsequent calls are no-ops if already loaded.
   * Sets indexError on failure and does NOT set indexLoaded=true, allowing retries.
   */
  loadIndex(): Promise<void>;

  /**
   * Load a single shape (SVG + sidecar). Returns the entry or null on error.
   * Deduplicates concurrent calls for the same ID.
   */
  loadShape(id: string): Promise<ShapeEntry | null>;

  /**
   * Load multiple shapes in parallel. Deduplicates IDs.
   */
  loadShapes(ids: string[]): Promise<void>;

  /**
   * Synchronous cache lookup. Returns null if the shape has not been loaded yet.
   */
  getShape(id: string): ShapeEntry | null;

  /**
   * Return the index grouped by category.
   */
  getCategories(): Map<string, ShapeIndexItem[]>;

  /**
   * Synchronous variant-aware SVG lookup.
   * Returns the SVG string for the given shape, optionally substituting a
   * specific option variant.  Returns null if the shape is not yet cached.
   *
   * @param id        Shape ID
   * @param variantId Optional variant ID (matches ShapeSidecar.options[].id)
   * @param configId  Optional configuration ID (matches ShapeSidecar.configurations[].id)
   */
  getShapeSvg(id: string, variantId?: string, configId?: string): string | null;
}

// ---------------------------------------------------------------------------
// Cache management
// ---------------------------------------------------------------------------

const CACHE_MAX = 200;

/**
 * Evict the oldest entry from the Map if we have reached the limit.
 * Map iteration order is insertion order, so the first key is the oldest.
 */
function evictOldestIfNeeded(cache: Map<string, ShapeEntry>): void {
  if (cache.size >= CACHE_MAX) {
    const firstKey = cache.keys().next().value;
    if (firstKey !== undefined) {
      cache.delete(firstKey);
    }
  }
}

/**
 * Insert an entry into the cache, maintaining max size.
 * Re-inserting an existing key moves it to the most-recently-used position.
 */
function cacheSet(
  cache: Map<string, ShapeEntry>,
  id: string,
  entry: ShapeEntry,
): void {
  if (cache.has(id)) {
    cache.delete(id);
  } else {
    evictOldestIfNeeded(cache);
  }
  cache.set(id, entry);
}

// ---------------------------------------------------------------------------
// Index singleton promise (module-level — survives hot-reloads gracefully)
// ---------------------------------------------------------------------------

let indexFetchPromise: Promise<ShapeIndexItem[]> | null = null;

/**
 * Fetch the shape index once and cache the promise module-level.
 * On failure, the promise is reset so the next call can retry.
 * Throws on failure — callers must handle the error.
 */
async function fetchIndexOnce(): Promise<ShapeIndexItem[]> {
  if (!indexFetchPromise) {
    indexFetchPromise = fetch("/shapes/index.json")
      .then((res) => {
        if (!res.ok)
          throw new Error(`/shapes/index.json returned ${res.status}`);
        return res.json() as Promise<RawIndex>;
      })
      .then((data) => {
        if (!Array.isArray(data.shapes)) {
          throw new Error(
            '/shapes/index.json: "shapes" is missing or not an array',
          );
        }
        return data.shapes.map((s) => ({
          id: s.id,
          category: s.category,
          label: s.label,
          subcategory: s.subcategory,
        }));
      })
      .catch((err) => {
        // Reset promise so the next loadIndex() call can retry
        indexFetchPromise = null;
        throw err; // re-throw so loadIndex() can set indexError
      });
  }
  return indexFetchPromise;
}

// ---------------------------------------------------------------------------
// Per-shape in-flight promise map (module-level deduplication)
// ---------------------------------------------------------------------------

const shapeInFlight = new Map<string, Promise<ShapeEntry | null>>();

// ---------------------------------------------------------------------------
// Stencil in-flight deduplication (module-level)
// ---------------------------------------------------------------------------

const stencilInFlight = new Map<string, Promise<string | null>>();

// ---------------------------------------------------------------------------
// Zustand store
// ---------------------------------------------------------------------------

export const useLibraryStore = create<LibraryStore>((set, get) => ({
  index: [],
  indexLoaded: false,
  indexLoading: false,
  indexError: null,
  cache: new Map(),
  loadingIds: new Set(),
  stencilCache: new Map(),

  async loadIndex() {
    // Atomically check-and-set indexLoading to prevent a race where two concurrent
    // callers both read indexLoading=false before the first set() completes.
    let shouldFetch = false;
    set((state) => {
      if (state.indexLoaded || state.indexLoading) return state;
      shouldFetch = true;
      return { indexLoading: true, indexError: null };
    });
    if (!shouldFetch) return;

    try {
      const items = await fetchIndexOnce();
      set({
        index: items,
        indexLoaded: true,
        indexLoading: false,
        indexError: null,
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to load shape index";
      console.warn("[libraryStore] loadIndex failed:", message);
      set({ indexLoading: false, indexError: message });
      // indexLoaded remains false — next call can retry
    }
  },

  async loadShape(id) {
    // Return from cache if already loaded
    const cached = get().cache.get(id);
    if (cached) return cached;

    // Deduplicate concurrent requests for the same shape
    const existing = shapeInFlight.get(id);
    if (existing) return existing;

    // Mark as loading
    set((state) => {
      const loadingIds = new Set(state.loadingIds);
      loadingIds.add(id);
      return { loadingIds };
    });

    const promise: Promise<ShapeEntry | null> =
      (async (): Promise<ShapeEntry | null> => {
        let entry: ShapeEntry | null = null;
        try {
          // Ensure index is loaded so we know the category.
          if (!get().indexLoaded) {
            await get().loadIndex();
            if (!get().indexLoaded) {
              // Index failed — log and fall through to root-level fallback URLs.
              console.warn(
                `[libraryStore] Shape ${id}: index unavailable, using fallback URL`,
              );
            }
          }

          const indexItem = get().index.find((item) => item.id === id);
          const category = indexItem?.category;

          // Fetch sidecar JSON first so we can resolve the correct SVG filename
          // (shapes with variants don't have a bare {id}.svg — only opt1/opt2 files).
          const jsonUrl = category
            ? `/shapes/${category}/${id}.json`
            : `/shapes/${id}.json`;

          const jsonRes = await fetch(jsonUrl);
          if (!jsonRes.ok) {
            console.warn(`[libraryStore] Shape ${id}: json=${jsonRes.status}`);
            return null;
          }

          const rawSidecar = (await jsonRes.json()) as ShapeSidecar;

          // Normalize variants.options Record → flat options Array so all
          // consumers (variant picker, getShapeSvg) use the same structure.
          const sidecar: ShapeSidecar = rawSidecar;
          if (!sidecar.options && sidecar.variants?.options) {
            sidecar.options = Object.entries(sidecar.variants.options).map(
              ([optId, opt]) => ({ id: optId, file: opt.file, label: opt.label }),
            );
          }

          // Resolve SVG filename: prefer opt1 variant, fall back to {id}.svg.
          // Mirrors shapeCache.ts resolveSvgFilename().
          let svgFilename: string;
          if (sidecar.options && sidecar.options.length > 0) {
            const opt1 =
              sidecar.options.find((o) => o.id === "opt1") ?? sidecar.options[0];
            svgFilename = opt1.file;
          } else {
            svgFilename = `${id}.svg`;
          }

          // Variant file may include a path component — only prepend category if it's a bare filename.
          const svgUrl =
            category && !svgFilename.includes("/")
              ? `/shapes/${category}/${svgFilename}`
              : `/shapes/${svgFilename}`;

          const svgRes = await fetch(svgUrl);
          if (!svgRes.ok) {
            console.warn(
              `[libraryStore] Shape ${id}: svg=${svgRes.status} (${svgUrl})`,
            );
            return null;
          }

          const svg = await svgRes.text();
          entry = { id, svg, sidecar };
          return entry;
        } catch (err) {
          console.warn(`[libraryStore] Error loading shape ${id}:`, err);
          return null;
        } finally {
          // Single atomic set() — removes from loadingIds and adds to cache (if loaded).
          shapeInFlight.delete(id);
          set((state) => {
            const loadingIds = new Set(state.loadingIds);
            loadingIds.delete(id);
            if (entry) {
              const cache = new Map<string, ShapeEntry>(state.cache);
              cacheSet(cache, id, entry);
              return { cache, loadingIds };
            }
            return { loadingIds };
          });
        }
      })();

    shapeInFlight.set(id, promise);
    return promise;
  },

  async loadShapes(ids) {
    // Deduplicate the input list
    const unique = [...new Set(ids)];

    // Fire all loads in parallel
    await Promise.all(unique.map((id) => get().loadShape(id)));
  },

  getShape(id) {
    return get().cache.get(id) ?? null;
  },

  getCategories() {
    const result = new Map<string, ShapeIndexItem[]>();
    for (const item of get().index) {
      const bucket = result.get(item.category) ?? [];
      bucket.push(item);
      result.set(item.category, bucket);
    }
    return result;
  },

  getShapeSvg(id, variantId, _configId) {
    const entry = get().cache.get(id);
    if (!entry) return null;

    // If no variant requested, return the base SVG
    if (!variantId) return entry.svg;

    // Look up the variant file from the sidecar options list
    const option = entry.sidecar.options?.find((o) => o.id === variantId);
    if (!option) {
      // Variant ID not found in sidecar — fall back to base SVG
      console.warn(
        `[libraryStore] Shape ${id}: variant "${variantId}" not found, using base SVG`,
      );
      return entry.svg;
    }

    // Variant SVGs are not pre-loaded; their file path is in option.file.
    // The canvas is responsible for triggering a variant load if needed.
    // For now, return the base SVG (callers that need a specific variant SVG
    // should use loadShape() with the variant file path directly).
    return entry.svg;
  },

  // ---------------------------------------------------------------------------
  // Stencil methods
  // ---------------------------------------------------------------------------

  getStencil(id) {
    return get().stencilCache.get(id) ?? null;
  },

  cacheStencilList(items) {
    const sc = new Map(get().stencilCache);
    for (const item of items) {
      if (item.svg_data && !sc.has(item.id)) {
        sc.set(item.id, item.svg_data);
      }
    }
    set({ stencilCache: sc });
  },

  async loadStencil(id) {
    const cached = get().stencilCache.get(id);
    if (cached) return cached;

    const existing = stencilInFlight.get(id);
    if (existing) return existing;

    const promise: Promise<string | null> = (async (): Promise<
      string | null
    > => {
      try {
        const resp = await fetch(`/api/v1/design-objects/${id}`);
        if (!resp.ok)
          throw new Error(
            `/api/v1/design-objects/${id} returned ${resp.status}`,
          );
        const data = (await resp.json()) as { data: { svg_data?: string } };
        const svg = data.data.svg_data ?? null;
        if (svg) {
          set((state) => {
            const sc = new Map(state.stencilCache);
            sc.set(id, svg);
            return { stencilCache: sc };
          });
        }
        return svg;
      } catch (err) {
        console.warn(`[libraryStore] Failed to load stencil ${id}:`, err);
        return null;
      } finally {
        stencilInFlight.delete(id);
      }
    })();

    stencilInFlight.set(id, promise);
    return promise;
  },
}));
