import { SceneRenderer } from "../../graphics/SceneRenderer";
import type { GraphicDocument } from "../../types/graphics";
import type {
  ObjectType,
  GraphicVersionContent,
  WorkspaceVersionContent,
  ChartVersionContent,
  VersionSummary,
} from "../../../shared/types/versioning";
import { VersionStatsPanel } from "./VersionStatsPanel";

interface VersionPreviewPanelProps {
  objectType: ObjectType;
  previewContent:
    | GraphicVersionContent
    | WorkspaceVersionContent
    | ChartVersionContent
    | null;
  previewLoading: boolean;
  selectedVersion: VersionSummary | null;
}

export function VersionPreviewPanel({
  objectType,
  previewContent,
  previewLoading,
  selectedVersion,
}: VersionPreviewPanelProps) {
  return (
    <div style={{ flex: 1, overflow: "hidden", display: "flex" }}>
      <div
        style={{
          flex: 1,
          overflow: "hidden",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
        }}
      >
        {previewLoading && (
          <div
            style={{
              fontSize: 13,
              color: "var(--io-text-muted)",
            }}
          >
            Loading preview…
          </div>
        )}

        {!previewLoading && !previewContent && (
          <div
            style={{
              fontSize: 13,
              color: "var(--io-text-muted)",
              textAlign: "center",
              padding: 32,
            }}
          >
            Select a version on the left to preview it here.
          </div>
        )}

        {!previewLoading && previewContent && objectType === "graphic" && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              overflow: "hidden",
            }}
          >
            <SceneRenderer
              document={
                (previewContent as GraphicVersionContent)
                  .scene_data as GraphicDocument
              }
              previewMode={true}
              liveSubscribe={false}
              preserveAspectRatio="xMidYMid meet"
              style={{ width: "100%", height: "100%" }}
            />
          </div>
        )}

        {!previewLoading && previewContent && objectType === "workspace" && (
          <WorkspaceLayoutSkeleton
            layout={(previewContent as WorkspaceVersionContent).layout}
          />
        )}

        {!previewLoading && previewContent && objectType === "chart" && (
          <div
            style={{
              fontSize: 13,
              color: "var(--io-text-secondary)",
              textAlign: "center",
              padding: 32,
            }}
          >
            Chart version {(previewContent as ChartVersionContent).version_number}
            {(previewContent as ChartVersionContent).label
              ? ` — ${(previewContent as ChartVersionContent).label}`
              : ""}
          </div>
        )}
      </div>

      <VersionStatsPanel version={selectedVersion} />
    </div>
  );
}

function WorkspaceLayoutSkeleton({ layout }: { layout: unknown }) {
  const panes =
    (
      layout as {
        panes?: Array<{ id: string; type: string; title?: string }>;
      }
    )?.panes ?? [];
  return (
    <div
      style={{
        flex: 1,
        display: "grid",
        gridTemplateColumns: `repeat(${Math.min(Math.max(panes.length, 1), 3)}, 1fr)`,
        gap: 8,
        padding: 16,
        alignContent: "start",
        overflowY: "auto",
      }}
    >
      {panes.map((pane) => (
        <div
          key={pane.id}
          style={{
            background: "var(--io-surface-secondary)",
            border: "1px solid var(--io-border)",
            borderRadius: 6,
            padding: "8px 12px",
            minHeight: 80,
            display: "flex",
            flexDirection: "column",
            gap: 4,
          }}
        >
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: "var(--io-text-secondary)",
            }}
          >
            {pane.type.toUpperCase()}
          </span>
          {pane.title && (
            <span style={{ fontSize: 12, color: "var(--io-text-primary)" }}>
              {pane.title}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
