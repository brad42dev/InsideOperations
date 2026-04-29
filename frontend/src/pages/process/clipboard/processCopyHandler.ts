import {
  buildIOClipboardPayload,
  useIOClipboardStore,
} from "@/shared/clipboard";
import { useGlobalSelectionStore } from "@/store/globalSelectionStore";
import type { SceneNode, GraphicExpression } from "@/shared/types/graphics";

/**
 * Copy the current process zone selection to the universal clipboard.
 *
 * Extracts scene nodes and their bound points from selected entities.
 * The payload includes both `nodes` (for paste-as-shapes in designer) and
 * `points` (for paste-as-points in trend/console).
 */
export async function copyProcessSelection(): Promise<void> {
  const selected = useGlobalSelectionStore.getState().getSelection("process");
  if (selected.length === 0) return;

  const sceneNodes = selected
    .filter((e) => e.kind === "scene-node")
    .map((e) => e.payload as SceneNode)
    .filter(Boolean);

  if (sceneNodes.length === 0) return;

  // Collect bound point tagnames from the selected nodes
  const points: Array<{
    tagname: string;
    displayName?: string;
    unit?: string;
  }> = [];
  const seenTagnames = new Set<string>();

  function extractPoints(node: SceneNode) {
    const n = node as unknown as Record<string, unknown>;
    const binding = n.binding as
      | {
          pointId?: string;
          pointTag?: string;
          displayName?: string;
          unit?: string;
        }
      | undefined;
    if (binding?.pointId && !seenTagnames.has(binding.pointId)) {
      seenTagnames.add(binding.pointId);
      points.push({
        tagname: binding.pointId,
        displayName: binding.displayName,
        unit: binding.unit,
      });
    }
    if (binding?.pointTag && !seenTagnames.has(binding.pointTag)) {
      seenTagnames.add(binding.pointTag);
      points.push({
        tagname: binding.pointTag,
        displayName: binding.displayName,
        unit: binding.unit,
      });
    }
    const stateBinding = n.stateBinding as { pointId?: string } | undefined;
    if (stateBinding?.pointId && !seenTagnames.has(stateBinding.pointId)) {
      seenTagnames.add(stateBinding.pointId);
      points.push({ tagname: stateBinding.pointId });
    }
    const children = (n.children as SceneNode[] | undefined) ?? [];
    for (const child of children) extractPoints(child);
  }

  for (const node of sceneNodes) extractPoints(node);

  const expressions: Record<string, GraphicExpression> = {};
  const textParts = sceneNodes.map((n) => {
    const node = n as unknown as Record<string, unknown>;
    return (
      (node.name as string | undefined) ?? (node.id as string | undefined) ?? ""
    );
  });

  const payload = buildIOClipboardPayload({
    originContext: "console-pane",
    contents: {
      nodes: sceneNodes,
      expressions,
      ...(points.length > 0 ? { points } : {}),
      textRepresentation: textParts.filter(Boolean).join(", "),
    },
  });

  await useIOClipboardStore.getState().writeToClipboard(payload);
}
