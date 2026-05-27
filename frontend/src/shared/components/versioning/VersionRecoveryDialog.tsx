import { useState } from "react";
import { useAuthStore } from "../../../store/auth";
import { useObjectActions } from "../../hooks/useObjectActions";
import { SaveAsDialog } from "./SaveAsDialog";
import { PublishConfirmDialog } from "./PublishConfirmDialog";
import { VersionListPanel } from "./VersionListPanel";
import { VersionPreviewPanel } from "./VersionPreviewPanel";
import { VersionActionBar } from "./VersionActionBar";
import { useVersionList } from "./useVersionList";
import { useVersionActions } from "./useVersionActions";
import { graphicsApi } from "../../../api/graphics";
import { consoleApi } from "../../../api/console";
import { savedChartsApi } from "../../../api/savedCharts";
import type { GraphicDocument } from "../../types/graphics";
import type {
  LayoutPreset,
  PaneConfig,
  GridItem,
} from "../../../pages/console/types";
import type { ChartConfig } from "../charts/chart-config-types";
import type {
  VersionRecoveryDialogProps,
  GraphicVersionContent,
  WorkspaceVersionContent,
  ChartVersionContent,
} from "../../../shared/types/versioning";

export type { VersionRecoveryDialogProps };

export function VersionRecoveryDialog({
  open,
  onClose,
  objectType,
  objectId,
  objectName,
  onLoadVersion,
}: VersionRecoveryDialogProps) {
  const isAdmin = useAuthStore(
    (s) => s.user?.permissions.includes("*") ?? false,
  );

  const versionList = useVersionList(objectType, objectId);
  const versionActions = useVersionActions(objectType, objectId);
  const objectActions = useObjectActions({
    objectType,
    objectId,
    onSaveAsOverride: async ({ name, label }) => {
      if (!previewContent) {
        return {
          success: false as const,
          error: { code: "NO_VERSION", message: "No version selected" },
        };
      }
      switch (objectType) {
        case "graphic": {
          const gc = previewContent as GraphicVersionContent;
          return graphicsApi.create({
            name,
            scene_data: gc.scene_data as GraphicDocument,
            label,
          });
        }
        case "workspace": {
          const wc = previewContent as WorkspaceVersionContent;
          const meta = wc.layout as {
            layout?: LayoutPreset;
            panes?: PaneConfig[];
            gridItems?: GridItem[];
            overflowPanes?: PaneConfig[];
            description?: string;
          };
          return consoleApi.saveWorkspace({
            name,
            layout: meta.layout ?? "2x2",
            panes: meta.panes ?? [],
            gridItems: meta.gridItems,
            overflowPanes: meta.overflowPanes,
            description: meta.description,
            label,
          });
        }
        case "chart": {
          const cc = previewContent as ChartVersionContent;
          const parent = await savedChartsApi.get(objectId);
          if (!parent.success) return parent;
          return savedChartsApi.create({
            name,
            chart_type: parent.data.chart_type,
            config: cc.config as ChartConfig,
            label,
          });
        }
      }
    },
  });

  const [selectedVersionNumber, setSelectedVersionNumber] = useState<
    number | null
  >(null);
  const [previewContent, setPreviewContent] = useState<
    GraphicVersionContent | WorkspaceVersionContent | ChartVersionContent | null
  >(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [labelEditVersionNumber, setLabelEditVersionNumber] = useState<
    number | null
  >(null);
  const [labelEditValue, setLabelEditValue] = useState("");
  const [permDeleteConfirmVersionNumber, setPermDeleteConfirmVersionNumber] =
    useState<number | null>(null);
  const [loadVersionConfirmVersionNumber, setLoadVersionConfirmVersionNumber] =
    useState<number | null>(null);
  const [showSaveAsDialog, setShowSaveAsDialog] = useState(false);
  const [showPublishDialog, setShowPublishDialog] = useState(false);

  if (!open) return null;

  const selectedVersion =
    versionList.allVersions.find(
      (v) => v.version_number === selectedVersionNumber,
    ) ?? null;

  async function handleSelectVersion(versionNumber: number) {
    setSelectedVersionNumber(versionNumber);
    setPreviewContent(null);
    setPreviewLoading(true);
    const content = await versionActions.loadVersion(versionNumber);
    setPreviewContent(content);
    setPreviewLoading(false);
  }

  function handleLoadInCurrentViewConfirmed() {
    if (!previewContent) return;
    onLoadVersion(previewContent);
    onClose();
  }

  function handleOpenInNewTab() {
    const url =
      objectType === "graphic"
        ? `/designer/graphics/${objectId}/edit`
        : `/console?workspace=${objectId}`;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  return (
    <>
      {/* Backdrop */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 3100,
          background: "rgba(0,0,0,0.25)",
        }}
        onClick={onClose}
      />

      {/* Panel */}
      <div
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          bottom: 0,
          width: 900,
          maxWidth: "calc(100vw - 32px)",
          zIndex: 3101,
          background: "var(--io-surface-elevated)",
          borderLeft: "1px solid var(--io-border)",
          display: "flex",
          flexDirection: "column",
          boxShadow: "-4px 0 24px rgba(0,0,0,0.2)",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "12px 16px",
            borderBottom: "1px solid var(--io-border)",
            display: "flex",
            alignItems: "center",
            gap: 8,
            flexShrink: 0,
          }}
        >
          <div style={{ flex: 1 }}>
            <span style={{ fontWeight: 600, fontSize: 14 }}>
              Version History
            </span>
            {objectName && (
              <span
                style={{
                  fontSize: 12,
                  color: "var(--io-text-muted)",
                  marginLeft: 8,
                }}
              >
                {objectName}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            style={{
              fontSize: 18,
              lineHeight: 1,
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "var(--io-text-secondary)",
            }}
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflow: "hidden", display: "flex" }}>
          <VersionListPanel
            versionList={versionList}
            selectedVersionNumber={selectedVersionNumber}
            onSelect={(vn) => void handleSelectVersion(vn)}
            isAdmin={isAdmin}
            labelEditVersionNumber={labelEditVersionNumber}
            labelEditValue={labelEditValue}
            setLabelEditValue={setLabelEditValue}
            onStartLabelEdit={(vn, currentLabel) => {
              setLabelEditVersionNumber(vn);
              setLabelEditValue(currentLabel ?? "");
            }}
            onCommitLabelEdit={async () => {
              if (!labelEditVersionNumber) return;
              const ok = await versionActions.updateLabel(
                labelEditVersionNumber,
                labelEditValue.trim() || null,
              );
              if (ok) {
                void versionList.refetch();
                setLabelEditVersionNumber(null);
              }
            }}
            onCancelLabelEdit={() => setLabelEditVersionNumber(null)}
            actionVersionNumber={versionActions.actionVersionNumber}
          />
          <div
            style={{
              width: 1,
              background: "var(--io-border)",
              flexShrink: 0,
            }}
          />
          <VersionPreviewPanel
            objectType={objectType}
            previewContent={previewContent}
            previewLoading={previewLoading}
            selectedVersion={selectedVersion}
          />
        </div>

        {/* Action bar */}
        {selectedVersion && (
          <VersionActionBar
            version={selectedVersion}
            isAdmin={isAdmin}
            isLoadingAction={versionActions.isLoading}
            actionVersionNumber={versionActions.actionVersionNumber}
            permDeleteConfirmVersionNumber={permDeleteConfirmVersionNumber}
            loadConfirmPending={
              loadVersionConfirmVersionNumber === selectedVersion.version_number
            }
            onLoadInCurrentView={() =>
              setLoadVersionConfirmVersionNumber(selectedVersion.version_number)
            }
            onLoadConfirm={handleLoadInCurrentViewConfirmed}
            onLoadCancel={() => setLoadVersionConfirmVersionNumber(null)}
            onOpenInNewTab={handleOpenInNewTab}
            onSaveAs={() => setShowSaveAsDialog(true)}
            onPublish={() => setShowPublishDialog(true)}
            onSoftDelete={async () => {
              const ok = await versionActions.softDeleteVersion(
                selectedVersion.version_number,
              );
              if (ok) {
                setSelectedVersionNumber(null);
                void versionList.refetch();
              }
            }}
            onRecover={async () => {
              const ok = await versionActions.recoverVersion(
                selectedVersion.version_number,
              );
              if (ok) void versionList.refetch();
            }}
            onPermDeleteClick={() =>
              setPermDeleteConfirmVersionNumber(selectedVersion.version_number)
            }
            onPermDeleteConfirm={async () => {
              const ok = await versionActions.permanentDeleteVersion(
                selectedVersion.version_number,
              );
              if (ok) {
                setPermDeleteConfirmVersionNumber(null);
                setSelectedVersionNumber(null);
                void versionList.refetch();
              }
            }}
            onPermDeleteCancel={() => setPermDeleteConfirmVersionNumber(null)}
          />
        )}
      </div>

      <SaveAsDialog
        open={showSaveAsDialog}
        onOpenChange={setShowSaveAsDialog}
        onConfirm={({ name, label }) => {
          void objectActions.saveAs({ name, label }).then((id) => {
            if (id) setShowSaveAsDialog(false);
          });
        }}
        loading={objectActions.isSavingAs}
        error={objectActions.saveAsError}
        defaultName={objectName ? `Copy of ${objectName}` : undefined}
      />

      <PublishConfirmDialog
        open={showPublishDialog}
        onOpenChange={setShowPublishDialog}
        onConfirm={({ label }) => {
          void objectActions.publish({ label }).then((ok) => {
            if (ok) {
              setShowPublishDialog(false);
              void versionList.refetch();
            }
          });
        }}
        loading={objectActions.isPublishing}
        error={objectActions.publishError}
        objectName={objectName}
      />
    </>
  );
}
