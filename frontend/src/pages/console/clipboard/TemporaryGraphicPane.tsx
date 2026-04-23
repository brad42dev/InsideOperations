import { useState, useMemo } from "react";
import { useMutation } from "@tanstack/react-query";
import { graphicsApi } from "@/api/graphics";
import { useWorkspaceStore } from "@/store/workspaceStore";
import { usePasteTarget, extractPoints } from "@/shared/clipboard";
import type {
  PasteTarget,
  PasteMode,
  SelectionZoneId,
} from "@/shared/clipboard";
import {
  getTemporaryContents,
  clearTemporaryContents,
} from "./temporaryGraphicStore";
import type { IOClipboardPayload } from "@/shared/clipboard";

interface Props {
  paneId: string;
}

function buildSaveTarget(paneId: string): PasteTarget {
  return {
    id: `temporary-graphic-${paneId}`,
    zoneId: `console/pane/${paneId}` as SelectionZoneId,
    priority: 20,
    accepts(payload) {
      if (!payload) return [];
      const modes: PasteMode[] = [];
      if (payload.contents.nodes?.length) modes.push("shapes");
      if (extractPoints(payload).length) modes.push("points");
      return modes;
    },
    async applyPaste(payload, mode) {
      const existing = getTemporaryContents(paneId);
      if (!existing) return;
      const merged = {
        ...existing,
        nodes:
          mode === "shapes"
            ? [...(existing.nodes ?? []), ...(payload.contents.nodes ?? [])]
            : existing.nodes,
        points:
          mode === "points"
            ? [...(existing.points ?? []), ...extractPoints(payload)]
            : existing.points,
        textRepresentation: existing.textRepresentation,
      };
      const { registerTemporaryContents } =
        await import("./temporaryGraphicStore");
      registerTemporaryContents(paneId, merged);
    },
    describeRejection(payload: IOClipboardPayload | null) {
      if (!payload) return "Clipboard is empty";
      return "No graphic data on clipboard";
    },
  };
}

export default function TemporaryGraphicPane({ paneId }: Props) {
  const contents = getTemporaryContents(paneId);
  const [saveName, setSaveName] = useState("Untitled Graphic");
  const [showSaveForm, setShowSaveForm] = useState(false);

  const pasteTarget = useMemo(() => buildSaveTarget(paneId), [paneId]);
  usePasteTarget(pasteTarget);

  const nodeCount = contents?.nodes?.length ?? 0;
  const pointCount =
    (contents?.points?.length ?? 0) +
    (contents?.nodes
      ? contents.nodes.filter((n: any) => n.binding?.pointTag).length
      : 0);

  const saveMutation = useMutation({
    mutationFn: async (name: string) => {
      const state = useWorkspaceStore.getState();
      const result = await graphicsApi.create({
        name,
        scene_data: {
          type: "graphic_document",
          id: crypto.randomUUID(),
          transform: {
            position: { x: 0, y: 0 },
            rotation: 0,
            scale: { x: 1, y: 1 },
            mirror: "none" as const,
          },
          visible: true,
          locked: false,
          opacity: 1,
          children: contents?.nodes ?? [],
          expressions: contents?.expressions ?? {},
          canvas: { width: 1920, height: 1080, backgroundColor: "#1a1a1a" },
          metadata: {
            tags: [],
            designMode: "graphic",
            graphicScope: "console",
            gridSize: 20,
            gridVisible: false,
            snapToGrid: false,
          },
          layers: [
            {
              id: "default",
              name: "Layer 1",
              visible: true,
              locked: false,
              order: 0,
            },
          ],
        },
      });
      if (!result.success) throw new Error("Failed to save graphic");
      const graphicId = result.data.id;
      if (state.activeId) {
        state.updateWorkspace(state.activeId, (w) => ({
          ...w,
          panes: w.panes.map((p) =>
            p.id === paneId ? { ...p, graphicId, title: name } : p,
          ),
        }));
      }
      clearTemporaryContents(paneId);
      return graphicId;
    },
  });

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        background: "var(--io-surface)",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "8px 12px",
          borderBottom: "1px solid var(--io-border)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexShrink: 0,
        }}
      >
        <span
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: "var(--io-text-muted)",
            textTransform: "uppercase",
            letterSpacing: "0.06em",
          }}
        >
          Temporary Graphic
        </span>
        <button
          onClick={() => setShowSaveForm((v) => !v)}
          style={{
            padding: "3px 10px",
            fontSize: 11,
            borderRadius: "var(--io-radius)",
            border: "1px solid var(--io-border)",
            background: "var(--io-surface-secondary)",
            color: "var(--io-text-primary)",
            cursor: "pointer",
          }}
        >
          Save as graphic…
        </button>
      </div>

      {/* Save form */}
      {showSaveForm && (
        <div
          style={{
            padding: "10px 12px",
            borderBottom: "1px solid var(--io-border)",
            display: "flex",
            gap: 8,
            flexShrink: 0,
          }}
        >
          <input
            value={saveName}
            onChange={(e) => setSaveName(e.target.value)}
            placeholder="Graphic name…"
            style={{
              flex: 1,
              padding: "4px 8px",
              fontSize: 12,
              borderRadius: "var(--io-radius)",
              border: "1px solid var(--io-border)",
              background: "var(--io-surface-secondary)",
              color: "var(--io-text-primary)",
            }}
          />
          <button
            onClick={() => saveMutation.mutate(saveName)}
            disabled={saveMutation.isPending || !saveName.trim()}
            style={{
              padding: "4px 12px",
              fontSize: 12,
              borderRadius: "var(--io-radius)",
              border: "1px solid var(--io-border)",
              background: "var(--io-accent)",
              color: "#fff",
              cursor: saveMutation.isPending ? "wait" : "pointer",
              opacity: saveMutation.isPending ? 0.7 : 1,
            }}
          >
            {saveMutation.isPending ? "Saving…" : "Save"}
          </button>
        </div>
      )}

      {/* Content summary */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          color: "var(--io-text-muted)",
          fontSize: 13,
        }}
      >
        {saveMutation.isSuccess ? (
          <span style={{ color: "var(--io-success)" }}>
            Saved and converted to graphic
          </span>
        ) : saveMutation.isError ? (
          <span style={{ color: "var(--io-danger)" }}>
            Save failed — try again
          </span>
        ) : nodeCount === 0 && pointCount === 0 ? (
          <span>Empty clipboard paste</span>
        ) : (
          <>
            <span>
              {nodeCount} shape{nodeCount !== 1 ? "s" : ""}
              {pointCount > 0
                ? `, ${pointCount} point${pointCount !== 1 ? "s" : ""}`
                : ""}
            </span>
            <span style={{ fontSize: 11 }}>
              Right-click to paste more · Save as graphic to persist
            </span>
          </>
        )}
      </div>
    </div>
  );
}
