import type { PasteMode, PasteTarget } from "@/shared/clipboard";
import {
  extractPoints,
  extractStyleFromNodes,
  hasKind,
  stripBindings,
} from "@/shared/clipboard";
import { useSceneStore } from "@/store/designer/sceneStore";
import { useHistoryStore } from "@/store/designer/historyStore";
import { useUiStore } from "@/store/designer";
import {
  PasteNodesCommand,
  ApplyStyleCommand,
  ChangePropertyCommand,
  CompoundCommand,
} from "@/shared/graphics/commands";
import type { SceneCommand } from "@/shared/graphics/commands";
import type {
  GraphicDocument,
  GraphicExpression,
  SceneNode,
} from "@/shared/types/graphics";
import { useLibraryStore } from "@/store/designer/libraryStore";

function collectShapeIds(nodes: SceneNode[]): string[] {
  const ids: string[] = [];
  function walk(n: SceneNode) {
    if (n.type === "symbol_instance") {
      const shapeId = (n as { shapeRef?: { shapeId?: string } }).shapeRef
        ?.shapeId;
      if (shapeId) ids.push(shapeId);
    }
    const children = (n as { children?: SceneNode[] }).children;
    if (Array.isArray(children)) children.forEach(walk);
  }
  nodes.forEach(walk);
  return ids;
}

function execCmd(cmd: SceneCommand): GraphicDocument | null {
  const currentDoc = useSceneStore.getState().doc;
  if (!currentDoc) return null;
  const newDoc = useSceneStore.getState().execute(cmd);
  useHistoryStore.getState().push(cmd, currentDoc);
  return newDoc;
}

export function createDesignerPasteTarget(): PasteTarget {
  return {
    id: "designer",
    zoneId: "designer",
    priority: 10,

    accepts(payload) {
      if (!payload) return [];
      const modes: PasteMode[] = [];
      if (payload.contents.nodes?.length) modes.push("native", "shapes");
      if (hasKind(payload, "points")) modes.push("points");
      if (hasKind(payload, "style")) modes.push("style");
      if (hasKind(payload, "style+layout")) modes.push("style+layout");
      if (payload.contents.textRepresentation) modes.push("text");
      modes.push("new-graphic");
      return modes;
    },

    async applyPaste(payload, mode) {
      switch (mode) {
        case "native":
        case "shapes": {
          const nodes =
            mode === "shapes"
              ? stripBindings(payload.contents.nodes ?? [])
              : (payload.contents.nodes ?? []);
          const remapped = remapExpressionIds(
            nodes,
            payload.contents.expressions ?? {},
          );
          // Preload symbol_instance shapes before the user places them so the
          // canvas renders correctly on first anchor click.
          const shapeIds = collectShapeIds(remapped.nodes);
          if (shapeIds.length > 0) {
            void useLibraryStore.getState().loadShapes(shapeIds);
          }
          // Enter two-phase place mode: floating ghost → click to anchor → confirm/cancel.
          document.dispatchEvent(
            new CustomEvent("io-designer:enter-place-mode", {
              detail: {
                nodes: remapped.nodes,
                expressions: remapped.expressions,
              },
            }),
          );
          return;
        }

        case "points": {
          const points = extractPoints(payload);
          const nodes: SceneNode[] = points.map((p, i) =>
            createPointTextBlock(p, i),
          );
          const oldIds = new Set(
            (useSceneStore.getState().doc?.children ?? []).map((n) => n.id),
          );
          const newDoc = execCmd(new PasteNodesCommand(nodes));
          if (newDoc) {
            const pastedIds = newDoc.children
              .filter((n) => !oldIds.has(n.id))
              .map((n) => n.id);
            useUiStore.getState().setSelectedNodes(pastedIds);
          }
          return;
        }

        case "style": {
          const snap =
            payload.contents.style ??
            extractStyleFromNodes(payload.contents.nodes ?? []);
          if (!snap) return;
          const selectedIds = Array.from(useUiStore.getState().selectedNodeIds);
          if (selectedIds.length === 0) return;
          execCmd(
            new ApplyStyleCommand(
              selectedIds,
              snap as unknown as Record<string, unknown>,
            ),
          );
          return;
        }

        case "style+layout": {
          const snap =
            payload.contents.style ??
            extractStyleFromNodes(payload.contents.nodes ?? []);
          const selectedIds = Array.from(useUiStore.getState().selectedNodeIds);
          if (selectedIds.length === 0) return;

          const cmds: SceneCommand[] = [];
          if (snap) {
            cmds.push(
              new ApplyStyleCommand(
                selectedIds,
                snap as unknown as Record<string, unknown>,
              ),
            );
          }

          const layout = payload.contents.layout;
          if (layout?.sidecarPositions) {
            const posEntries = Object.values(layout.sidecarPositions);
            const doc = useSceneStore.getState().doc;
            if (doc) {
              selectedIds.forEach((nodeId, i) => {
                const pos = posEntries[i];
                if (!pos) return;
                const node = findNodeById(doc.children, nodeId);
                if (!node) return;
                cmds.push(
                  new ChangePropertyCommand(
                    nodeId,
                    "transform",
                    {
                      ...node.transform,
                      position: { x: pos.x, y: pos.y },
                      rotation: pos.rotation ?? node.transform.rotation,
                    },
                    node.transform,
                  ),
                );
              });
            }
          }

          if (cmds.length === 0) return;
          execCmd(
            cmds.length === 1
              ? cmds[0]
              : new CompoundCommand("Paste Style + Layout", cmds),
          );
          return;
        }

        case "text": {
          const node = createTextBlock(payload.contents.textRepresentation);
          const oldIds = new Set(
            (useSceneStore.getState().doc?.children ?? []).map((n) => n.id),
          );
          const newDoc = execCmd(new PasteNodesCommand([node]));
          if (newDoc) {
            const pastedIds = newDoc.children
              .filter((n) => !oldIds.has(n.id))
              .map((n) => n.id);
            useUiStore.getState().setSelectedNodes(pastedIds);
          }
          return;
        }

        case "new-graphic": {
          window.dispatchEvent(
            new CustomEvent("io-designer:new-graphic-from-clipboard", {
              detail: payload,
            }),
          );
          return;
        }
      }
    },

    describeRejection(payload) {
      if (!payload) return "Clipboard is empty";
      return "Clipboard has no designer-compatible data";
    },
  };
}

function remapExpressionIds(
  nodes: SceneNode[],
  expressions: Record<string, GraphicExpression>,
): { nodes: SceneNode[]; expressions: Record<string, GraphicExpression> } {
  const destExpr = useSceneStore.getState().doc?.expressions ?? {};
  const idMap = new Map<string, string>();
  const nextExpressions: Record<string, GraphicExpression> = {};

  for (const [oldId, def] of Object.entries(expressions)) {
    if (destExpr[oldId]) {
      const newId = crypto.randomUUID();
      idMap.set(oldId, newId);
      nextExpressions[newId] = def;
    } else {
      nextExpressions[oldId] = def;
    }
  }

  const patchNode = (n: SceneNode): SceneNode => {
    const copy = JSON.parse(JSON.stringify(n)) as SceneNode;
    walkNode(copy, (x) => {
      const b = (x as unknown as { binding?: { expressionId?: string } })
        .binding;
      if (b?.expressionId && idMap.has(b.expressionId)) {
        b.expressionId = idMap.get(b.expressionId)!;
      }
    });
    return copy;
  };

  return { nodes: nodes.map(patchNode), expressions: nextExpressions };
}

function findNodeById(nodes: SceneNode[], id: string): SceneNode | null {
  for (const n of nodes) {
    if (n.id === id) return n;
    const children = (n as unknown as { children?: SceneNode[] }).children;
    if (Array.isArray(children)) {
      const found = findNodeById(children, id);
      if (found) return found;
    }
  }
  return null;
}

function walkNode(node: SceneNode, fn: (n: SceneNode) => void) {
  fn(node);
  const children = (node as unknown as { children?: SceneNode[] }).children;
  if (Array.isArray(children)) children.forEach((c) => walkNode(c, fn));
}

function createPointTextBlock(
  p: { tagname: string; displayName?: string },
  i: number,
): SceneNode {
  return {
    id: crypto.randomUUID(),
    type: "text_block",
    transform: {
      position: { x: 40, y: 40 + i * 32 },
      rotation: 0,
      scale: { x: 1, y: 1 },
      mirror: "none",
    },
    visible: true,
    locked: false,
    opacity: 1,
    content: p.displayName ?? p.tagname,
    fontFamily: "Inter",
    fontSize: 14,
    fontWeight: 400,
    fontStyle: "normal",
    textAnchor: "start",
    fill: "var(--io-text-primary)",
  } as unknown as SceneNode;
}

function createTextBlock(text: string): SceneNode {
  return {
    id: crypto.randomUUID(),
    type: "text_block",
    transform: {
      position: { x: 60, y: 60 },
      rotation: 0,
      scale: { x: 1, y: 1 },
      mirror: "none",
    },
    visible: true,
    locked: false,
    opacity: 1,
    content: text,
    fontFamily: "Inter",
    fontSize: 14,
    fontWeight: 400,
    fontStyle: "normal",
    textAnchor: "start",
    fill: "var(--io-text-primary)",
  } as unknown as SceneNode;
}
