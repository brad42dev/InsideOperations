import { useParams } from "react-router-dom";

export default function DataSources({ detail }: { detail?: boolean }) {
  const { id } = useParams<{ id: string }>();
  return (
    <div style={{ padding: "var(--io-space-6)" }}>
      <h2 style={{ color: "var(--io-text-primary)" }}>
        {detail ? `Data Source: ${id}` : "Data Sources"}
      </h2>
      <p style={{ color: "var(--io-text-secondary)" }}>
        {detail
          ? "Data source configuration detail"
          : "OPC UA and other data source connections"}{" "}
        — Phase 7
      </p>
    </div>
  );
}
