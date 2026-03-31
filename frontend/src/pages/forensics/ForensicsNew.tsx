import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { forensicsApi } from "../../api/forensics";

export default function ForensicsNew() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const createMutation = useMutation({
    mutationFn: () => forensicsApi.createInvestigation({ name: name.trim() }),
    onSuccess: (result) => {
      if (!result.success) {
        setError(result.error.message);
        return;
      }
      navigate(`/forensics/${result.data.id}`);
    },
    onError: (err: Error) => setError(err.message),
  });

  const containerStyle: React.CSSProperties = {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    minHeight: "100%",
    padding: "var(--io-space-6)",
    background: "var(--io-bg)",
  };

  const cardStyle: React.CSSProperties = {
    background: "var(--io-surface)",
    border: "1px solid var(--io-border)",
    borderRadius: "12px",
    padding: "32px",
    width: "100%",
    maxWidth: "480px",
    display: "flex",
    flexDirection: "column",
    gap: "20px",
  };

  const inputStyle: React.CSSProperties = {
    padding: "10px 12px",
    background: "var(--io-surface-secondary)",
    border: "1px solid var(--io-border)",
    borderRadius: "6px",
    color: "var(--io-text-primary)",
    fontSize: "14px",
    width: "100%",
    boxSizing: "border-box",
  };

  return (
    <div style={containerStyle}>
      <div style={cardStyle}>
        <div>
          <h2
            style={{
              margin: 0,
              fontSize: "20px",
              fontWeight: 700,
              color: "var(--io-text-primary)",
            }}
          >
            New Investigation
          </h2>
          <p
            style={{
              margin: "6px 0 0",
              fontSize: "14px",
              color: "var(--io-text-secondary)",
            }}
          >
            Create a multi-source correlation investigation to analyse process
            events.
          </p>
        </div>

        <label
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "6px",
            fontSize: "12px",
            fontWeight: 600,
            color: "var(--io-text-secondary)",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
          }}
        >
          Investigation Name *
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. HCU Unit 2 pressure excursion 2026-03-18"
            style={inputStyle}
            autoFocus
            onKeyDown={(e) =>
              e.key === "Enter" && name.trim() && createMutation.mutate()
            }
          />
        </label>

        {error && (
          <div
            style={{
              padding: "10px 14px",
              background: "rgba(239,68,68,0.1)",
              border: "1px solid rgba(239,68,68,0.3)",
              borderRadius: "6px",
              fontSize: "13px",
              color: "#ef4444",
            }}
          >
            {error}
          </div>
        )}

        <div
          style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}
        >
          <button
            onClick={() => navigate("/forensics")}
            style={{
              padding: "9px 18px",
              background: "none",
              border: "1px solid var(--io-border)",
              borderRadius: "6px",
              cursor: "pointer",
              fontSize: "14px",
              color: "var(--io-text-secondary)",
            }}
          >
            Cancel
          </button>
          <button
            onClick={() => createMutation.mutate()}
            disabled={!name.trim() || createMutation.isPending}
            style={{
              padding: "9px 18px",
              background: name.trim()
                ? "var(--io-accent)"
                : "var(--io-surface-secondary)",
              border: "none",
              borderRadius: "6px",
              cursor: name.trim() ? "pointer" : "not-allowed",
              fontSize: "14px",
              fontWeight: 600,
              color: name.trim() ? "#fff" : "var(--io-text-muted)",
            }}
          >
            {createMutation.isPending ? "Creating…" : "Create Investigation"}
          </button>
        </div>
      </div>
    </div>
  );
}
