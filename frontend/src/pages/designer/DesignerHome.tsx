import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTabStore } from "../../store/designer/tabStore";

export default function DesignerHome() {
  const navigate = useNavigate();

  // If tabs are already open, redirect to the active one instead of showing home.
  // This handles: clicking the Designer nav item when work is in progress.
  useEffect(() => {
    const tabs = useTabStore.getState().tabs;
    if (tabs.length === 0) return;
    const activeId = useTabStore.getState().activeTabId;
    const targetTab =
      tabs.find((t) => t.id === activeId) ?? tabs[tabs.length - 1];
    if (!targetTab) return;
    if (!targetTab.graphicId.startsWith("new-")) {
      navigate(`/designer/graphics/${targetTab.graphicId}/edit`, {
        replace: true,
      });
    } else {
      navigate("/designer/graphics/new", { replace: true });
    }
  }, [navigate]);

  return (
    <div
      style={{
        height: "100%",
        background: "var(--io-surface-secondary)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 12,
        }}
      >
        <div
          style={{
            fontSize: 13,
            color: "var(--io-text-muted)",
            marginBottom: 4,
            letterSpacing: "0.03em",
          }}
        >
          Designer
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button
            onClick={() => navigate("/designer/graphics/new")}
            style={{
              padding: "9px 22px",
              background: "var(--io-accent)",
              color: "var(--io-accent-foreground)",
              border: "none",
              borderRadius: "var(--io-radius)",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            New
          </button>
          <button
            onClick={() => navigate("/designer/graphics")}
            style={{
              padding: "9px 22px",
              background: "transparent",
              color: "var(--io-text-secondary)",
              border: "1px solid var(--io-border)",
              borderRadius: "var(--io-radius)",
              fontSize: 13,
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Open Existing
          </button>
        </div>
      </div>
    </div>
  );
}
