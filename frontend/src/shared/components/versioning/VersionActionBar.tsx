import React from "react";
import type { VersionSummary } from "../../../shared/types/versioning";

interface VersionActionBarProps {
  version: VersionSummary;
  isAdmin: boolean;
  isLoadingAction: boolean;
  actionVersionNumber: number | null;
  permDeleteConfirmVersionNumber: number | null;
  loadConfirmPending: boolean;
  onLoadInCurrentView: () => void;
  onLoadConfirm: () => void;
  onLoadCancel: () => void;
  onOpenInNewTab: () => void;
  onSaveAs: () => void;
  onPublish: () => void;
  onSoftDelete: () => void;
  onRecover: () => void;
  onPermDeleteClick: () => void;
  onPermDeleteConfirm: () => void;
  onPermDeleteCancel: () => void;
}

export function VersionActionBar({
  version,
  isAdmin,
  isLoadingAction,
  actionVersionNumber,
  permDeleteConfirmVersionNumber,
  loadConfirmPending,
  onLoadInCurrentView,
  onLoadConfirm,
  onLoadCancel,
  onOpenInNewTab,
  onSaveAs,
  onPublish,
  onSoftDelete,
  onRecover,
  onPermDeleteClick,
  onPermDeleteConfirm,
  onPermDeleteCancel,
}: VersionActionBarProps) {
  const isDeleted = !!version.deleted_at;
  const thisVersionLoading =
    isLoadingAction && actionVersionNumber === version.version_number;

  const barStyle: React.CSSProperties = {
    padding: "10px 16px",
    borderTop: "1px solid var(--io-border)",
    display: "flex",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
    minHeight: 52,
    flexShrink: 0,
  };

  if (isDeleted) {
    return (
      <div style={barStyle}>
        <span style={{ fontSize: 12, color: "var(--io-text-muted)" }}>
          This version has been deleted.
        </span>
        {isAdmin && (
          <>
            <ActionButton onClick={onRecover} disabled={thisVersionLoading}>
              {thisVersionLoading ? "…" : "Recover"}
            </ActionButton>
            {permDeleteConfirmVersionNumber === version.version_number ? (
              <>
                <span style={{ fontSize: 12, color: "var(--io-danger)" }}>
                  Are you sure?
                </span>
                <ActionButton
                  danger
                  onClick={onPermDeleteConfirm}
                  disabled={thisVersionLoading}
                >
                  {thisVersionLoading ? "…" : "Permanently Delete"}
                </ActionButton>
                <ActionButton onClick={onPermDeleteCancel}>Cancel</ActionButton>
              </>
            ) : (
              <ActionButton danger onClick={onPermDeleteClick}>
                Permanently Delete…
              </ActionButton>
            )}
          </>
        )}
      </div>
    );
  }

  if (loadConfirmPending) {
    return (
      <div style={barStyle}>
        <span style={{ fontSize: 12, color: "var(--io-text-secondary)" }}>
          Replace current content with this version? Unsaved changes will be
          lost.
        </span>
        <ActionButton primary onClick={onLoadConfirm}>
          Load Version
        </ActionButton>
        <ActionButton onClick={onLoadCancel}>Cancel</ActionButton>
      </div>
    );
  }

  return (
    <div style={barStyle}>
      <ActionButton
        primary
        onClick={onLoadInCurrentView}
        disabled={isLoadingAction}
      >
        Load in Current View
      </ActionButton>
      <ActionButton onClick={onOpenInNewTab}>Open in New Tab</ActionButton>
      <ActionButton onClick={onSaveAs}>Save As…</ActionButton>
      {version.version_type !== "publish" && (
        <ActionButton onClick={onPublish}>Publish…</ActionButton>
      )}
      <div style={{ marginLeft: "auto" }} />
      {permDeleteConfirmVersionNumber !== version.version_number && (
        <ActionButton
          danger
          onClick={onSoftDelete}
          disabled={thisVersionLoading}
        >
          {thisVersionLoading ? "…" : "Delete"}
        </ActionButton>
      )}
      {isAdmin && (
        <>
          {permDeleteConfirmVersionNumber === version.version_number ? (
            <>
              <span style={{ fontSize: 12, color: "var(--io-danger)" }}>
                Are you sure?
              </span>
              <ActionButton
                danger
                onClick={onPermDeleteConfirm}
                disabled={thisVersionLoading}
              >
                {thisVersionLoading ? "…" : "Permanently Delete"}
              </ActionButton>
              <ActionButton onClick={onPermDeleteCancel}>Cancel</ActionButton>
            </>
          ) : (
            <ActionButton danger onClick={onPermDeleteClick}>
              Permanently Delete…
            </ActionButton>
          )}
        </>
      )}
    </div>
  );
}

function ActionButton({
  children,
  onClick,
  disabled,
  primary,
  danger,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  primary?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: "5px 12px",
        fontSize: 12,
        borderRadius: "var(--io-radius)",
        border: danger
          ? "1px solid var(--io-danger)"
          : "1px solid var(--io-border)",
        background: primary ? "var(--io-accent)" : "transparent",
        color: primary
          ? "var(--io-text-on-accent)"
          : danger
            ? "var(--io-danger)"
            : "var(--io-text-secondary)",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.6 : 1,
      }}
    >
      {children}
    </button>
  );
}
