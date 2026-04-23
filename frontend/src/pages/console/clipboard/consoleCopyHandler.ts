import {
  buildIOClipboardPayload,
  computeTextRepresentation,
  useIOClipboardStore,
} from "@/shared/clipboard";
import { useGlobalSelectionStore } from "@/store/globalSelectionStore";
import { useWorkspaceStore } from "@/store/workspaceStore";
import { graphicsApi } from "@/api/graphics";
import type { PaneConfig } from "@/pages/console/types";
import type { SelectionZoneId } from "@/shared/clipboard";
import type { SceneNode, GraphicExpression } from "@/shared/types/graphics";

export async function copyConsoleActiveZone(zoneId: string): Promise<void> {
  const selected = useGlobalSelectionStore
    .getState()
    .getSelection(zoneId as SelectionZoneId);
  if (selected.length === 0) return;

  const state = useWorkspaceStore.getState();
  const activeWs = state.workspaces.find((w) => w.id === state.activeId);

  if (zoneId === "console") {
    const panes: PaneConfig[] = selected
      .filter((e) => e.kind === "pane")
      .map((e) => activeWs?.panes.find((p) => p.id === e.id))
      .filter((p): p is PaneConfig => !!p);
    if (!panes.length) return;

    // For single graphic pane, include the scene nodes so the designer can
    // paste actual shapes instead of falling back to the text representation.
    let nodes: SceneNode[] | undefined;
    let expressions: Record<string, GraphicExpression> | undefined;
    if (panes.length === 1 && panes[0].type === "graphic" && panes[0].graphicId) {
      try {
        const res = await graphicsApi.get(panes[0].graphicId);
        if (res.success) {
          nodes = res.data.scene_data?.children ?? [];
          expressions = res.data.scene_data?.expressions ?? {};
        }
      } catch {
        // Non-fatal — fall back to pane-only payload
      }
    }

    const payload = buildIOClipboardPayload({
      originContext: "console-pane",
      contents: {
        paneConfigs: JSON.parse(JSON.stringify(panes)),
        ...(nodes ? { nodes, expressions } : {}),
        textRepresentation: panes.map((p) => p.title ?? p.id).join(" - "),
      },
    });
    await useIOClipboardStore.getState().writeToClipboard(payload);
    return;
  }

  const paneId = zoneId.replace(/^console\/pane\//, "");
  const pane = activeWs?.panes.find((p) => p.id === paneId);
  if (!pane) return;

  const kind = selected[0].kind;
  switch (kind) {
    case "chart-series-row": {
      const points = selected.map(
        (e) =>
          e.payload as { tagname: string; displayName?: string; unit?: string },
      );
      const payload = buildIOClipboardPayload({
        originContext: "chart",
        originPaneId: paneId,
        contents: {
          points,
          textRepresentation: computeTextRepresentation({ points }),
        },
      });
      await useIOClipboardStore.getState().writeToClipboard(payload);
      return;
    }
    case "table-row":
    case "table-cell": {
      const rows = selected.map(
        (e) =>
          e.payload as {
            columns: string[];
            values: (string | number | null)[];
          },
      );
      const payload = buildIOClipboardPayload({
        originContext: "table",
        originPaneId: paneId,
        contents: {
          tableRows: rows,
          textRepresentation: rows.map((r) => r.values.join(" - ")).join("\n"),
        },
      });
      await useIOClipboardStore.getState().writeToClipboard(payload);
      return;
    }
    case "alarm-row": {
      const alarms = selected.map(
        (e) => e.payload as { tagname: string; severity?: string },
      );
      const payload = buildIOClipboardPayload({
        originContext: "alarm-list",
        originPaneId: paneId,
        contents: {
          alarms,
          points: alarms.map((a) => ({ tagname: a.tagname })),
          textRepresentation: alarms.map((a) => a.tagname).join(" - "),
        },
      });
      await useIOClipboardStore.getState().writeToClipboard(payload);
      return;
    }
    case "scene-node": {
      if (pane.type !== "graphic" || !pane.graphicId) return;
      try {
        const res = await graphicsApi.get(pane.graphicId);
        if (!res.success) return;
        const allNodes: SceneNode[] = res.data.scene_data?.children ?? [];
        const expressions: Record<string, GraphicExpression> =
          res.data.scene_data?.expressions ?? {};
        const selectedIds = new Set(selected.map((e) => e.id));
        const nodes = collectSelectedNodes(allNodes, selectedIds);
        if (nodes.length === 0) return;
        const payload = buildIOClipboardPayload({
          originContext: "console-pane",
          originPaneId: paneId,
          contents: {
            nodes,
            expressions,
            textRepresentation: nodes.map((n) => n.name ?? n.id).join(", "),
          },
        });
        await useIOClipboardStore.getState().writeToClipboard(payload);
      } catch {
        // non-fatal
      }
      return;
    }
  }
}

function collectSelectedNodes(
  nodes: SceneNode[],
  ids: Set<string>,
): SceneNode[] {
  const result: SceneNode[] = [];
  for (const n of nodes) {
    if (ids.has(n.id)) {
      result.push(n);
    }
    const children = (n as { children?: SceneNode[] }).children;
    if (Array.isArray(children)) {
      result.push(...collectSelectedNodes(children, ids));
    }
  }
  return result;
}
