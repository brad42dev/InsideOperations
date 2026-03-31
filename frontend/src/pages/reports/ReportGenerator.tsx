import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { reportsApi } from "../../api/reports";
import ReportConfigPanel from "./ReportConfigPanel";

export default function ReportGenerator() {
  const { template_id } = useParams<{ template_id: string }>();
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ["reports", "template", template_id],
    queryFn: () => reportsApi.getTemplate(template_id!),
    enabled: !!template_id,
  });

  if (isLoading) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100%",
          color: "var(--io-text-muted)",
          fontSize: "14px",
        }}
      >
        Loading template…
      </div>
    );
  }

  if (!data?.success) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100%",
          flexDirection: "column",
          gap: "12px",
        }}
      >
        <div style={{ color: "#ef4444", fontSize: "14px" }}>
          Template not found.
        </div>
        <button
          onClick={() => navigate("/reports")}
          style={{
            padding: "8px 16px",
            background: "none",
            border: "1px solid var(--io-border)",
            borderRadius: "6px",
            cursor: "pointer",
            fontSize: "13px",
            color: "var(--io-text-secondary)",
          }}
        >
          Back to Reports
        </button>
      </div>
    );
  }

  return (
    <ReportConfigPanel
      template={data.data}
      onClose={() => navigate("/reports")}
    />
  );
}
