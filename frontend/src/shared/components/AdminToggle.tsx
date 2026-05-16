import { useAuthStore } from "../../store/auth";

interface AdminToggleProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  title?: string;
}

export function AdminToggle({
  label,
  checked,
  onChange,
  title,
}: AdminToggleProps) {
  const isAdmin = useAuthStore(
    (s) => s.user?.permissions.includes("*") ?? false,
  );
  if (!isAdmin) return null;

  return (
    <label
      title={title}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        cursor: "pointer",
        fontSize: 11,
        color: checked ? "var(--io-accent)" : "var(--io-text-muted)",
        userSelect: "none",
        padding: "2px 0",
        whiteSpace: "nowrap",
      }}
    >
      <span
        style={{
          display: "inline-block",
          width: 28,
          height: 16,
          borderRadius: 8,
          background: checked ? "var(--io-accent)" : "var(--io-border)",
          position: "relative",
          transition: "background 0.15s",
          flexShrink: 0,
        }}
      >
        <span
          style={{
            position: "absolute",
            top: 2,
            left: checked ? 14 : 2,
            width: 12,
            height: 12,
            borderRadius: "50%",
            background: "#fff",
            transition: "left 0.15s",
            boxShadow: "0 1px 2px rgba(0,0,0,0.2)",
          }}
        />
      </span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        style={{ position: "absolute", opacity: 0, width: 0, height: 0 }}
      />
      {label}
    </label>
  );
}
