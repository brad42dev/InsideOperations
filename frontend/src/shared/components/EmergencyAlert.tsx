import { useUiStore } from "../../store/ui";

export default function EmergencyAlert() {
  const { emergencyAlert, dismissEmergencyAlert } = useUiStore();

  if (!emergencyAlert.active) return null;

  return (
    <div
      role="alertdialog"
      aria-live="assertive"
      aria-modal="true"
      aria-label="Emergency alert"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 2000,
        background: "#7f1d1d",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "32px",
        gap: "32px",
      }}
    >
      {/* Flashing border accent */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          border: "6px solid #ef4444",
          pointerEvents: "none",
          animation: "emergency-pulse 1s ease-in-out infinite",
        }}
      />

      {/* Warning icon */}
      <div
        style={{
          fontSize: "64px",
          lineHeight: 1,
          userSelect: "none",
        }}
      >
        ⚠
      </div>

      <div style={{ textAlign: "center", maxWidth: "640px" }}>
        <div
          style={{
            fontSize: "13px",
            fontWeight: 700,
            color: "#fca5a5",
            textTransform: "uppercase",
            letterSpacing: "0.15em",
            marginBottom: "16px",
          }}
        >
          Emergency Alert
        </div>
        <div
          style={{
            fontSize: "28px",
            fontWeight: 700,
            color: "#ffffff",
            lineHeight: 1.3,
          }}
        >
          {emergencyAlert.message}
        </div>
      </div>

      <button
        onClick={dismissEmergencyAlert}
        style={{
          padding: "12px 32px",
          background: "rgba(255, 255, 255, 0.15)",
          border: "2px solid rgba(255, 255, 255, 0.5)",
          borderRadius: "6px",
          color: "#ffffff",
          fontSize: "15px",
          fontWeight: 600,
          cursor: "pointer",
          transition: "background 0.15s",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLButtonElement).style.background =
            "rgba(255, 255, 255, 0.25)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.background =
            "rgba(255, 255, 255, 0.15)";
        }}
      >
        Dismiss
      </button>

      <style>{`
        @keyframes emergency-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  );
}
