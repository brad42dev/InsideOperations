/**
 * uomStore — application-level UOM catalog cache.
 *
 * Fetches GET /api/v1/uom/catalog once at startup and stores the full list
 * of unit-of-measure conversion entries. Widgets use `useUomStore` to access
 * the catalog and call `convertUom` for client-side conversion of real-time
 * values.
 *
 * spec: design-docs/10_DASHBOARDS_MODULE.md §UOM Conversion
 * "Real-time widget values: client-side conversion using cached UOM catalog"
 */
import { create } from "zustand";
import { api } from "../api/client";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A single unit-of-measure conversion entry from the catalog. */
export interface UomEntry {
  /** Source unit symbol (e.g. "°C", "bar", "m/s") */
  from_unit: string;
  /** Target unit symbol (e.g. "°F", "psi", "ft/s") */
  to_unit: string;
  /**
   * Multiply the source value by this factor before adding the offset.
   * Converted value = (raw * factor) + offset
   */
  factor: number;
  /** Additive offset applied after the factor multiplication. */
  offset: number;
}

/** Full catalog keyed as `${fromUnit}:${toUnit}` for O(1) lookup. */
export type UomCatalog = Map<string, UomEntry>;

interface UomState {
  catalog: UomCatalog;
  loaded: boolean;
  loading: boolean;
  error: string | null;

  /** Fetch the catalog from the server and populate the store. */
  fetchCatalog: () => Promise<void>;
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useUomStore = create<UomState>((set, get) => ({
  catalog: new Map(),
  loaded: false,
  loading: false,
  error: null,

  fetchCatalog: async () => {
    // Only fetch once — idempotent if already loaded or in-flight
    if (get().loaded || get().loading) return;
    set({ loading: true, error: null });

    const result = await api.get<UomEntry[]>("/api/v1/uom/catalog");
    if (!result.success) {
      // Catalog is best-effort; widgets fall back to raw values on failure
      set({ loading: false, error: result.error.message });
      return;
    }

    const catalog: UomCatalog = new Map();
    for (const entry of result.data) {
      catalog.set(`${entry.from_unit}:${entry.to_unit}`, entry);
    }
    set({ catalog, loaded: true, loading: false, error: null });
  },
}));

// ---------------------------------------------------------------------------
// Conversion helper
// ---------------------------------------------------------------------------

/**
 * Convert `value` from `fromUnit` to `toUnit` using the cached catalog.
 *
 * Returns the original `value` unchanged when:
 * - `fromUnit` equals `toUnit` (no conversion needed)
 * - No catalog entry exists for the pair (unknown conversion — safe fallback)
 *
 * Formula: converted = (value * entry.factor) + entry.offset
 */
export function convertUom(
  value: number,
  fromUnit: string,
  toUnit: string,
  catalog: UomCatalog,
): number {
  if (fromUnit === toUnit) return value;
  const entry = catalog.get(`${fromUnit}:${toUnit}`);
  if (!entry) return value;
  return value * entry.factor + entry.offset;
}
