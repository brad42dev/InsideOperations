import type {
  IOClipboardPayload,
  IOClipboardContents,
  PasteMode,
  PortablePointRef,
  StyleSnapshot,
  TableRowSnapshot,
} from "./types";
import type { SceneNode } from "../types/graphics";

export function hasKind(payload: IOClipboardPayload | null, mode: PasteMode): boolean {
  if (!payload) return false;
  const c = payload.contents;
  switch (mode) {
    case "points":
      return !!c.points?.length || !!extractPointsFromNodes(c.nodes ?? []).length;
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
  const visit = (n: SceneNode) => {
    const binding = (
      n as unknown as {
        binding?: { pointTag?: string; displayName?: string; unit?: string };
      }
    ).binding;
    if (binding?.pointTag && !seen.has(binding.pointTag)) {
      seen.add(binding.pointTag);
      out.push({
        tagname: binding.pointTag,
        displayName: binding.displayName,
        unit: binding.unit,
      });
    }
    const children = (n as unknown as { children?: SceneNode[] }).children;
    if (Array.isArray(children)) children.forEach(visit);
  };
  nodes.forEach(visit);
  return out;
}

export function extractStyleFromNodes(nodes: SceneNode[]): StyleSnapshot | undefined {
  for (const n of nodes) {
    const s = (n as unknown as { style?: StyleSnapshot }).style;
    if (s && Object.keys(s).length) return s;
  }
  return undefined;
}

export function stripBindings<T extends SceneNode>(nodes: T[]): T[] {
  return JSON.parse(JSON.stringify(nodes), (k, v) => {
    if (k === "binding") return undefined;
    if (k === "expressionId") return undefined;
    return v;
  });
}

export function synthesizeTableFromPoints(points: PortablePointRef[]): TableRowSnapshot[] {
  return points.map((p) => ({
    columns: ["Tagname", "Display Name", "Unit"],
    values: [p.tagname, p.displayName ?? "", p.unit ?? ""],
    sourceRefs: { tagname: p.tagname },
  }));
}

export function computeTextRepresentation(contents: Partial<IOClipboardContents>): string {
  const parts: string[] = [];
  const firstPoint =
    contents.points?.[0] ?? extractPointsFromNodes(contents.nodes ?? [])[0];
  if (firstPoint?.displayName) parts.push(firstPoint.displayName);
  if (firstPoint?.tagname) parts.push(firstPoint.tagname);
  return parts.filter(Boolean).join(" - ");
}
