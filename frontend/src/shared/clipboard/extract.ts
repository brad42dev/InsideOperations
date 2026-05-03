import type {
  IOClipboardPayload,
  IOClipboardContents,
  PasteMode,
  PortablePointRef,
  StyleSnapshot,
  TableRowSnapshot,
} from "./types";
import type { SceneNode } from "../types/graphics";

export function hasKind(
  payload: IOClipboardPayload | null,
  mode: PasteMode,
): boolean {
  if (!payload) return false;
  const c = payload.contents;
  switch (mode) {
    case "points":
      return (
        !!c.points?.length || !!extractPointsFromNodes(c.nodes ?? []).length
      );
    case "shapes":
      return !!c.nodes?.length;
    case "style":
      return !!c.style || !!extractStyleFromNodes(c.nodes ?? []);
    case "style+layout":
      return !!c.style && !!c.layout;
    case "table":
      return !!c.tableRows?.length || !!c.points?.length;
    case "text":
      return !!c.textRepresentation;
    case "most-recent-alarms":
      return !!c.points?.length;
    case "new-graphic":
    case "temporary-graphic":
    case "native":
      return true;
  }
}

export function extractPoints(payload: IOClipboardPayload): PortablePointRef[] {
  const explicit = payload.contents.points ?? [];
  if (explicit.length) return explicit;
  return extractPointsFromNodes(payload.contents.nodes ?? []);
}

export function extractPointsFromNodes(nodes: SceneNode[]): PortablePointRef[] {
  const out: PortablePointRef[] = [];
  const seen = new Set<string>();
  const addTag = (tag: string, displayName?: string, unit?: string) => {
    if (!seen.has(tag)) {
      seen.add(tag);
      out.push({ tagname: tag, displayName, unit });
    }
  };
  const visit = (n: SceneNode) => {
    const node = n as unknown as Record<string, unknown>;
    const binding = node.binding as
      | { pointTag?: string; displayName?: string; unit?: string }
      | undefined;
    if (binding?.pointTag)
      addTag(binding.pointTag, binding.displayName, binding.unit);

    // text_readout_array: additional bindings each carry their own tag
    if (node.displayType === "text_readout_array") {
      const cfg = node.config as
        | {
            additionalBindings?: Array<{
              pointTag?: string;
              displayName?: string;
              unit?: string;
            }>;
          }
        | undefined;
      for (const b of cfg?.additionalBindings ?? []) {
        if (b.pointTag) addTag(b.pointTag, b.displayName, b.unit);
      }
    }

    const children = node.children as SceneNode[] | undefined;
    if (Array.isArray(children)) children.forEach(visit);
  };
  nodes.forEach(visit);
  return out;
}

export function extractStyleFromNodes(
  nodes: SceneNode[],
): StyleSnapshot | undefined {
  for (const n of nodes) {
    const node = n as unknown as Record<string, unknown>;
    const snap: StyleSnapshot = {};
    if (typeof node.fill === "string") snap.fill = node.fill;
    if (typeof node.stroke === "string") snap.stroke = node.stroke;
    if (typeof node.strokeWidth === "number")
      snap.strokeWidth = node.strokeWidth;
    if (typeof node.strokeDasharray === "string")
      snap.strokeDasharray = node.strokeDasharray;
    if (typeof node.opacity === "number") snap.opacity = node.opacity;
    if (typeof node.fontFamily === "string") snap.fontFamily = node.fontFamily;
    if (typeof node.fontSize === "number") snap.fontSize = node.fontSize;
    if (
      typeof node.fontWeight === "number" ||
      typeof node.fontWeight === "string"
    )
      snap.fontWeight = node.fontWeight as number | string;
    if (Object.keys(snap).length > 0) return snap;
  }
  return undefined;
}

export function stripBindings<T extends SceneNode>(nodes: T[]): T[] {
  return JSON.parse(JSON.stringify(nodes), (k, v) => {
    // Replace binding with an empty object rather than deleting it — renderers
    // access de.binding.pointId etc. without null guards, so undefined crashes.
    if (k === "binding") return {};
    if (k === "expressionId") return undefined;
    return v;
  });
}

export function synthesizeTableFromPoints(
  points: PortablePointRef[],
): TableRowSnapshot[] {
  return points.map((p) => ({
    columns: ["Tagname", "Display Name", "Unit"],
    values: [p.tagname, p.displayName ?? "", p.unit ?? ""],
    sourceRefs: { tagname: p.tagname },
  }));
}

export function computeTextRepresentation(
  contents: Partial<IOClipboardContents>,
): string {
  const parts: string[] = [];
  const firstPoint =
    contents.points?.[0] ?? extractPointsFromNodes(contents.nodes ?? [])[0];
  if (firstPoint?.displayName) parts.push(firstPoint.displayName);
  if (firstPoint?.tagname) parts.push(firstPoint.tagname);
  return parts.filter(Boolean).join(" - ");
}
