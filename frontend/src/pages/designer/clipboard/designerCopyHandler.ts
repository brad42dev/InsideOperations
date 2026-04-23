import {
  buildIOClipboardPayload,
  computeTextRepresentation,
  extractPointsFromNodes,
  extractStyleFromNodes,
  useIOClipboardStore,
} from "@/shared/clipboard";
import { useSceneStore } from "@/store/designer/sceneStore";
import { useUiStore } from "@/store/designer";
import type { SceneNode } from "@/shared/types/graphics";

export async function copyDesignerSelection(): Promise<void> {
  const selectedNodeIds = useUiStore.getState().selectedNodeIds;
  if (selectedNodeIds.size === 0) return;
  const scene = useSceneStore.getState();
  const doc = scene.doc;
  if (!doc) return;

  const ids = Array.from(selectedNodeIds);

  function findNodeAnywhere(nodes: SceneNode[], id: string): SceneNode | null {
    for (const n of nodes) {
      if (n.id === id) return n;
      const children = (n as unknown as { children?: SceneNode[] }).children;
      if (Array.isArray(children)) {
        const found = findNodeAnywhere(children, id);
        if (found) return found;
      }
    }
    return null;
  }

  const nodes = ids
    .map((id) => findNodeAnywhere(doc.children, id))
    .filter((n): n is SceneNode => n !== null);

  if (nodes.length === 0) return;

  const usedExpressionIds = new Set<string>();
  const walkForExprs = (ns: SceneNode[]) => {
    for (const n of ns) {
      const b = (n as unknown as { binding?: { expressionId?: string } }).binding;
      if (b?.expressionId) usedExpressionIds.add(b.expressionId);
      const children = (n as unknown as { children?: SceneNode[] }).children;
      if (Array.isArray(children)) walkForExprs(children);
    }
  };
  walkForExprs(nodes);

  const expressions = Object.fromEntries(
    Array.from(usedExpressionIds)
      .map((id) => [id, doc.expressions[id]])
      .filter(([, v]) => v),
  );

  const style = extractStyleFromNodes(nodes) ?? undefined;
  const layout = {
    sidecarPositions: Object.fromEntries(
      nodes.map((n, i) => [
        String(i),
        {
          x: n.transform.position.x,
          y: n.transform.position.y,
          rotation: n.transform.rotation,
        },
      ]),
    ),
  };

  const payload = buildIOClipboardPayload({
    originContext: "designer",
    originGraphicId: doc.id,
    contents: {
      nodes: JSON.parse(JSON.stringify(nodes)),
      expressions,
      points: extractPointsFromNodes(nodes),
      textRepresentation: computeTextRepresentation({ nodes }),
      originalBounds: computeBounds(nodes),
      style,
      layout,
    },
  });

  await useIOClipboardStore.getState().writeToClipboard(payload);
}

function computeBounds(
  nodes: Array<{ transform: { position: { x: number; y: number } } }>,
) {
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const n of nodes) {
    const { x, y } = n.transform.position;
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  if (!isFinite(minX)) return { x: 0, y: 0, width: 0, height: 0 };
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}
