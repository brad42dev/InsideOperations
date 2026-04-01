import type { EnumLabel } from "../../api/points";

export type PointCategory = "analog" | "boolean" | "discrete_enum";

/**
 * Resolves a raw numeric OPC UA value to a human-readable string label
 * for boolean and discrete_enum points. Returns null for analog points
 * (caller should format numerically).
 *
 * OPC UA boolean convention: 0 = false/FalseState, non-zero = true/TrueState.
 */
export function resolvePointLabel(
  value: number | null,
  category: PointCategory,
  enumLabels: EnumLabel[],
): string | null {
  if (value === null) return null;
  if (category === "boolean") {
    const idx = value === 0 ? 0 : 1;
    return enumLabels.find((l) => l.idx === idx)?.label ?? (value === 0 ? "False" : "True");
  }
  if (category === "discrete_enum") {
    const idx = Math.round(value);
    return enumLabels.find((l) => l.idx === idx)?.label ?? String(idx);
  }
  return null;
}
