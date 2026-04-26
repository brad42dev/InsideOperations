import type { PasteTarget, PasteMode } from "@/shared/clipboard";
import { extractPoints } from "@/shared/clipboard";
import { openForensicsWithPoints } from "@/shared/clipboard/targets/mostRecentAlarmsHook";
import { useWorkspaceStore } from "@/store/workspaceStore";
import { showToast } from "@/shared/components/Toast";
import { uuidv4 } from "@/lib/uuid";
import {
  findFreeSlot,
  presetToGridItems,
  GRID_COLS,
  GRID_ROWS,
} from "../layout-utils";
import type { SelectionZoneId } from "@/shared/clipboard";
import { registerTemporaryContents } from "./temporaryGraphicStore";

export function createConsolePaneTarget(paneId: string): PasteTarget {
  return {
    id: `console-pane-${paneId}`,
    zoneId: `console/pane/${paneId}` as SelectionZoneId,
    priority: 10,

    accepts(payload) {
      if (!payload) return [];
      const state = useWorkspaceStore.getState();
      const activeWs = state.workspaces.find((w) => w.id === state.activeId);
      const pane = activeWs?.panes.find((p) => p.id === paneId);
      if (!pane) return [];
      const modes: PasteMode[] = [];
      if (pane.type === "trend") {
        if (payload.contents.chartConfigs?.length) modes.push("native");
        if (extractPoints(payload).length) modes.push("points");
      } else if (pane.type === "point_table") {
        if (
          payload.contents.tableRows?.length ||
          extractPoints(payload).length
        ) {
          modes.push("table");
        }
        if (extractPoints(payload).length) modes.push("points");
      } else if (pane.type === "alarm_list") {
        if (extractPoints(payload).length)
          modes.push("points", "most-recent-alarms");
      } else if (pane.type === "blank") {
        if (extractPoints(payload).length) modes.push("points");
        if (payload.contents.tableRows?.length) modes.push("table");
        if (payload.contents.paneConfigs?.length) modes.push("native");
      }
      return modes;
    },

    async applyPaste(payload, mode) {
      const state = useWorkspaceStore.getState();
      if (!state.activeId) return;
      const activeWs = state.workspaces.find((w) => w.id === state.activeId);
      const pane = activeWs?.panes.find((p) => p.id === paneId);
      if (!pane) return;

      if (pane.type === "trend" && (mode === "points" || mode === "native")) {
        const points = extractPoints(payload);
        state.updatePane(state.activeId, {
          ...pane,
          trendPointIds: [
            ...(pane.trendPointIds ?? []),
            ...points.map((pt) => pt.tagname),
          ],
        });
        return;
      }

      if (
        pane.type === "point_table" &&
        (mode === "table" || mode === "points")
      ) {
        const points = extractPoints(payload);
        state.updatePane(state.activeId, {
          ...pane,
          tablePointIds: [
            ...(pane.tablePointIds ?? []),
            ...points.map((pt) => pt.tagname),
          ],
        });
        return;
      }

      if (pane.type === "alarm_list") {
        const points = extractPoints(payload);
        if (points.length > 0) {
          await openForensicsWithPoints(
            points.map((p) => p.tagname),
            mode === "most-recent-alarms" ? "most-recent-alarms" : "points",
          );
        } else {
          showToast({
            title: "Nothing to paste",
            description: "Clipboard has no point references",
            variant: "warning",
          });
        }
        return;
      }

      if (pane.type === "blank") {
        const points = extractPoints(payload);
        if (mode === "table") {
          state.updatePane(state.activeId, {
            ...pane,
            type: "point_table",
            tablePointIds: points.map((pt) => pt.tagname),
          });
        } else {
          state.updatePane(state.activeId, {
            ...pane,
            type: "trend",
            trendPointIds: points.map((pt) => pt.tagname),
          });
        }
        return;
      }
    },

    describeRejection(payload) {
      if (!payload) return "Clipboard is empty";
      const state = useWorkspaceStore.getState();
      const activeWs = state.workspaces.find((w) => w.id === state.activeId);
      const pane = activeWs?.panes.find((p) => p.id === paneId);
      if (pane?.type === "trend")
        return "Chart only accepts point references or a chart config";
      if (pane?.type === "point_table")
        return "Table only accepts points or table rows";
      if (pane?.type === "alarm_list") return "Alarm list only accepts points";
      if (pane?.type === "blank") return "Blank pane accepts points or table rows";
      return "This pane accepts no data from the clipboard";
    },
  };
}

export function createConsoleWorkspaceTarget(): PasteTarget {
  return {
    id: "console-workspace",
    zoneId: "console",
    priority: 5,

    accepts(payload) {
      if (!payload) return [];
      const modes: PasteMode[] = [];
      if (payload.contents.paneConfigs?.length) modes.push("native");
      if (extractPoints(payload).length) modes.push("temporary-graphic");
      if (payload.contents.nodes?.length) modes.push("temporary-graphic");
      return modes;
    },

    async applyPaste(payload, mode) {
      const state = useWorkspaceStore.getState();
      if (!state.activeId) return;

      if (mode === "native" && payload.contents.paneConfigs) {
        state.updateWorkspace(state.activeId, (w) => {
          const currentItems = w.gridItems?.length
            ? w.gridItems
            : presetToGridItems(w.layout, w.panes);
          const halfW = Math.round(GRID_COLS / 2);
          const halfH = Math.round(GRID_ROWS / 2);

          let updatedItems = [...currentItems];
          const newPanes = (payload.contents.paneConfigs ?? []).map((pc) => {
            const newPane = { ...pc, id: uuidv4() };
            const slot = findFreeSlot(updatedItems, halfW, halfH) ?? {
              x: 0,
              y: 0,
              w: halfW,
              h: halfH,
            };
            updatedItems = [
              ...updatedItems,
              { i: newPane.id, x: slot.x, y: slot.y, w: slot.w, h: slot.h },
            ];
            return newPane;
          });

          return {
            ...w,
            panes: [...w.panes, ...newPanes],
            gridItems: updatedItems,
          };
        });
        return;
      }

      if (mode === "temporary-graphic") {
        const newPaneId = uuidv4();
        registerTemporaryContents(newPaneId, payload.contents);
        state.updateWorkspace(state.activeId, (w) => {
          const currentItems = w.gridItems?.length
            ? w.gridItems
            : presetToGridItems(w.layout, w.panes);
          const halfW = Math.round(GRID_COLS / 2);
          const halfH = Math.round(GRID_ROWS / 2);
          const slot = findFreeSlot(currentItems, halfW, halfH) ?? {
            x: 0,
            y: 0,
            w: halfW,
            h: halfH,
          };
          const newPane = {
            id: newPaneId,
            type: "graphic" as const,
            graphicId: "__temporary__",
            title: "Temporary Graphic",
          };
          return {
            ...w,
            panes: [...w.panes, newPane],
            gridItems: [
              ...currentItems,
              {
                i: newPaneId,
                x: slot.x,
                y: slot.y,
                w: slot.w,
                h: slot.h,
              },
            ],
          };
        });
        return;
      }
    },

    describeRejection(payload) {
      if (!payload) return "Clipboard is empty";
      return "Clipboard contains no pane or graphic data";
    },
  };
}
