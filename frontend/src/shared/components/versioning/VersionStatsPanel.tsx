import React from "react";
import type { VersionSummary } from "../../../shared/types/versioning";
import { formatTimestampFull } from "./versioning-utils";

export function VersionStatsPanel({
  version,
}: {
  version: VersionSummary | null;
}) {
  if (!version) return null;
  const meta = version.metadata ?? {};
  return (
    <div
      style={{
        width: 220,
        borderLeft: "1px solid var(--io-border)",
        padding: "16px 12px",
        overflowY: "auto",
        flexShrink: 0,
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}
    >
      <StatRow label="Version" value={`v${version.version_number}`} />
      <StatRow label="Date" value={formatTimestampFull(version.created_at)} />
      <StatRow
        label="Type"
        value={
          version.version_type === "publish" ? "● Publish checkpoint" : "Save"
        }
      />
      {version.created_by_name && (
        <StatRow label="By" value={version.created_by_name} />
      )}
      {meta.element_count !== undefined && (
        <StatRow label="Elements" value={String(meta.element_count)} />
      )}
      {meta.binding_count !== undefined && (
        <StatRow label="Bindings" value={String(meta.binding_count)} />
      )}
      {version.parent_version_number !== null && (
        <StatRow label="Previous" value={`v${version.parent_version_number}`} />
      )}
      {version.label && (
        <div>
          <StatLabel>Notes</StatLabel>
          <div
            style={{
              fontSize: 12,
              color: "var(--io-text-primary)",
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              marginTop: 2,
            }}
          >
            {version.label}
          </div>
        </div>
      )}
    </div>
  );
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <StatLabel>{label}</StatLabel>
      <div style={{ fontSize: 12, color: "var(--io-text-primary)", marginTop: 2 }}>
        {value}
      </div>
    </div>
  );
}

function StatLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: 10,
        color: "var(--io-text-muted)",
        textTransform: "uppercase",
        letterSpacing: "0.05em",
      }}
    >
      {children}
    </div>
  );
}
