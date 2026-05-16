import React from "react";
import type { UseVersionListResult, VersionSummary } from "../../../shared/types/versioning";
import { formatTimestamp } from "./versioning-utils";
import { AdminToggle } from "../AdminToggle";

interface VersionListPanelProps {
  versionList: UseVersionListResult;
  selectedVersionNumber: number | null;
  onSelect: (versionNumber: number) => void;
  isAdmin: boolean;
  labelEditVersionNumber: number | null;
  labelEditValue: string;
  onStartLabelEdit: (vn: number, currentLabel: string | null) => void;
  onCommitLabelEdit: () => void;
  onCancelLabelEdit: () => void;
  setLabelEditValue: (v: string) => void;
  actionVersionNumber: number | null;
}

export function VersionListPanel({
  versionList,
  selectedVersionNumber,
  onSelect,
  isAdmin,
  labelEditVersionNumber,
  labelEditValue,
  onStartLabelEdit,
  onCommitLabelEdit,
  onCancelLabelEdit,
  setLabelEditValue,
  actionVersionNumber,
}: VersionListPanelProps) {
  const {
    versions,
    isLoading,
    error,
    filterType,
    setFilterType,
    searchText,
    setSearchText,
    dateFrom,
    setDateFrom,
    dateTo,
    setDateTo,
    showDeleted,
    setShowDeleted,
  } = versionList;

  const pillBtn = (active: boolean): React.CSSProperties => ({
    padding: "3px 10px",
    fontSize: 11,
    borderRadius: 12,
    border: "1px solid var(--io-border)",
    background: active ? "var(--io-accent)" : "transparent",
    color: active ? "var(--io-text-on-accent)" : "var(--io-text-secondary)",
    cursor: "pointer",
  });

  return (
    <div
      style={{
        width: 340,
        flexShrink: 0,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      {/* Filter bar */}
      <div
        style={{
          padding: "10px 12px",
          borderBottom: "1px solid var(--io-border)",
          display: "flex",
          flexDirection: "column",
          gap: 8,
          flexShrink: 0,
        }}
      >
        <input
          type="text"
          placeholder="Search notes…"
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          style={{
            width: "100%",
            fontSize: 12,
            padding: "4px 8px",
            borderRadius: 4,
            border: "1px solid var(--io-border)",
            background: "var(--io-surface-secondary)",
            color: "var(--io-text-primary)",
            boxSizing: "border-box",
          }}
        />
        <div style={{ display: "flex", gap: 4 }}>
          <button
            style={pillBtn(filterType === "all")}
            onClick={() => setFilterType("all")}
          >
            All
          </button>
          <button
            style={pillBtn(filterType === "save")}
            onClick={() => setFilterType("save")}
          >
            Saves
          </button>
          <button
            style={pillBtn(filterType === "publish")}
            onClick={() => setFilterType("publish")}
          >
            Publish
          </button>
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            style={{
              flex: 1,
              fontSize: 11,
              padding: "2px 4px",
              border: "1px solid var(--io-border)",
              borderRadius: 3,
              background: "var(--io-surface-secondary)",
              color: "var(--io-text-primary)",
            }}
          />
          <span style={{ fontSize: 11, color: "var(--io-text-muted)" }}>–</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            style={{
              flex: 1,
              fontSize: 11,
              padding: "2px 4px",
              border: "1px solid var(--io-border)",
              borderRadius: 3,
              background: "var(--io-surface-secondary)",
              color: "var(--io-text-primary)",
            }}
          />
        </div>
        {isAdmin && (
          <AdminToggle
            label="Show deleted"
            checked={showDeleted}
            onChange={setShowDeleted}
            title="Show soft-deleted versions (admin only)"
          />
        )}
      </div>

      {/* Version list */}
      <div style={{ flex: 1, overflowY: "auto" }}>
        {isLoading && (
          <div
            style={{
              padding: "24px 16px",
              textAlign: "center",
              fontSize: 12,
              color: "var(--io-text-muted)",
            }}
          >
            Loading versions…
          </div>
        )}
        {!isLoading && error && (
          <div
            style={{
              padding: "12px 16px",
              fontSize: 12,
              color: "var(--io-danger)",
            }}
          >
            {error}
          </div>
        )}
        {!isLoading && !error && versions.length === 0 && (
          <div
            style={{
              padding: "24px 16px",
              textAlign: "center",
              fontSize: 12,
              color: "var(--io-text-muted)",
            }}
          >
            No versions found.
          </div>
        )}
        {versions.map((version) => (
          <VersionEntry
            key={version.id}
            version={version}
            isSelected={selectedVersionNumber === version.version_number}
            onSelect={onSelect}
            labelEditVersionNumber={labelEditVersionNumber}
            labelEditValue={labelEditValue}
            onStartLabelEdit={onStartLabelEdit}
            onCommitLabelEdit={onCommitLabelEdit}
            onCancelLabelEdit={onCancelLabelEdit}
            setLabelEditValue={setLabelEditValue}
            isActionLoading={actionVersionNumber === version.version_number}
          />
        ))}
      </div>
    </div>
  );
}

interface VersionEntryProps {
  version: VersionSummary;
  isSelected: boolean;
  onSelect: (versionNumber: number) => void;
  labelEditVersionNumber: number | null;
  labelEditValue: string;
  onStartLabelEdit: (vn: number, currentLabel: string | null) => void;
  onCommitLabelEdit: () => void;
  onCancelLabelEdit: () => void;
  setLabelEditValue: (v: string) => void;
  isActionLoading: boolean;
}

function VersionEntry({
  version,
  isSelected,
  onSelect,
  labelEditVersionNumber,
  labelEditValue,
  onStartLabelEdit,
  onCommitLabelEdit,
  onCancelLabelEdit,
  setLabelEditValue,
  isActionLoading,
}: VersionEntryProps) {
  const isPublish = version.version_type === "publish";
  const isDeleted = !!version.deleted_at;
  const isEditing = labelEditVersionNumber === version.version_number;

  const smallAccentBtn: React.CSSProperties = {
    padding: "2px 8px",
    fontSize: 11,
    borderRadius: 3,
    border: "none",
    background: "var(--io-accent)",
    color: "var(--io-text-on-accent)",
    cursor: "pointer",
  };

  const smallGhostBtn: React.CSSProperties = {
    padding: "2px 8px",
    fontSize: 11,
    borderRadius: 3,
    border: "1px solid var(--io-border)",
    background: "transparent",
    color: "var(--io-text-secondary)",
    cursor: "pointer",
  };

  return (
    <div
      onClick={() => !isDeleted && !isActionLoading && onSelect(version.version_number)}
      style={{
        padding: "10px 16px",
        borderBottom: "1px solid var(--io-border-subtle)",
        cursor: isDeleted || isActionLoading ? "default" : "pointer",
        background: isSelected
          ? "var(--io-accent-subtle)"
          : "transparent",
        opacity: isDeleted ? 0.5 : 1,
        borderLeft: isPublish
          ? "3px solid var(--io-accent)"
          : "3px solid transparent",
      }}
    >
      <div
        style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}
      >
        {isPublish ? (
          <span
            style={{
              background: "var(--io-accent)",
              color: "var(--io-text-on-accent)",
              borderRadius: 4,
              padding: "1px 6px",
              fontSize: 11,
              fontWeight: 600,
            }}
          >
            v{version.version_number} ● PUBLISH
          </span>
        ) : (
          <span
            style={{
              fontSize: 12,
              color: "var(--io-text-primary)",
              fontWeight: 500,
            }}
          >
            v{version.version_number}
          </span>
        )}
        {isDeleted && (
          <span
            style={{
              background: "var(--io-danger)",
              color: "#fff",
              borderRadius: 3,
              padding: "1px 5px",
              fontSize: 10,
              textDecoration: "line-through",
            }}
          >
            deleted
          </span>
        )}
        <span
          style={{
            marginLeft: "auto",
            fontSize: 10,
            color: "var(--io-text-muted)",
            whiteSpace: "nowrap",
          }}
        >
          {formatTimestamp(version.created_at)}
        </span>
      </div>

      <div style={{ fontSize: 11, color: "var(--io-text-muted)" }}>
        {version.created_by_name ?? "Unknown"}
      </div>

      {isEditing ? (
        <div style={{ marginTop: 4 }}>
          <input
            autoFocus
            value={labelEditValue}
            onChange={(e) => setLabelEditValue(e.target.value)}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === "Enter") void onCommitLabelEdit();
              if (e.key === "Escape") onCancelLabelEdit();
            }}
            style={{
              width: "100%",
              fontSize: 12,
              padding: "2px 6px",
              borderRadius: 3,
              border: "1px solid var(--io-border)",
              background: "var(--io-surface-secondary)",
              color: "var(--io-text-primary)",
              boxSizing: "border-box",
            }}
          />
          <div style={{ display: "flex", gap: 4, marginTop: 4 }}>
            <button
              style={smallAccentBtn}
              onClick={(e) => {
                e.stopPropagation();
                void onCommitLabelEdit();
              }}
            >
              Save
            </button>
            <button
              style={smallGhostBtn}
              onClick={(e) => {
                e.stopPropagation();
                onCancelLabelEdit();
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : version.label ? (
        <div
          title={version.label}
          onClick={(e) => {
            e.stopPropagation();
            onStartLabelEdit(version.version_number, version.label);
          }}
          style={{
            marginTop: 4,
            fontSize: 11,
            color: "var(--io-text-secondary)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            cursor: "text",
          }}
        >
          {version.label}
        </div>
      ) : (
        <div
          onClick={(e) => {
            e.stopPropagation();
            onStartLabelEdit(version.version_number, null);
          }}
          style={{
            marginTop: 4,
            fontSize: 11,
            color: "var(--io-text-muted)",
            cursor: "text",
          }}
        >
          + add note
        </div>
      )}
    </div>
  );
}
