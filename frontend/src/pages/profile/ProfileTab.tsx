import { useAuthStore } from "../../store/auth";
import { labelStyle, inputStyle } from "../settings/settingsStyles";

export default function ProfileTab() {
  const { user } = useAuthStore();

  const initials = user
    ? (user.full_name ?? user.username)
        .split(" ")
        .map((w) => w.charAt(0).toUpperCase())
        .slice(0, 2)
        .join("")
    : "?";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {/* Avatar + identity */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "20px",
          padding: "20px",
          border: "1px solid var(--io-border)",
          borderRadius: "10px",
          background: "var(--io-surface)",
        }}
      >
        <div
          style={{
            width: "64px",
            height: "64px",
            borderRadius: "50%",
            background: "var(--io-accent-subtle)",
            border: "2px solid var(--io-accent)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--io-accent)",
            fontSize: "20px",
            fontWeight: 700,
            flexShrink: 0,
          }}
        >
          {initials}
        </div>
        <div>
          <div
            style={{
              fontSize: "17px",
              fontWeight: 600,
              color: "var(--io-text-primary)",
            }}
          >
            {user?.full_name ?? user?.username ?? "Unknown"}
          </div>
          {user?.full_name && (
            <div
              style={{
                fontSize: "13px",
                color: "var(--io-text-muted)",
                marginTop: "2px",
              }}
            >
              @{user.username}
            </div>
          )}
          <div
            style={{
              fontSize: "13px",
              color: "var(--io-text-muted)",
              marginTop: "2px",
            }}
          >
            {user?.email}
          </div>
        </div>
      </div>

      {/* Fields (read-only) */}
      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        <div>
          <label style={labelStyle}>Display Name</label>
          <input
            type="text"
            value={user?.full_name ?? ""}
            disabled
            placeholder="No display name set"
            style={{ ...inputStyle, opacity: 0.7 }}
          />
        </div>
        <div>
          <label style={labelStyle}>Username</label>
          <input
            type="text"
            value={user?.username ?? ""}
            disabled
            style={{ ...inputStyle, opacity: 0.7 }}
          />
        </div>
        <div>
          <label style={labelStyle}>Email</label>
          <input
            type="email"
            value={user?.email ?? ""}
            disabled
            style={{ ...inputStyle, opacity: 0.7 }}
          />
        </div>

        {/* Role badges */}
        {user?.permissions && user.permissions.length > 0 && (
          <div>
            <label style={labelStyle}>Permissions</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
              {user.permissions.includes("*") ? (
                <span
                  style={{
                    fontSize: "12px",
                    padding: "3px 9px",
                    borderRadius: "99px",
                    background: "var(--io-accent-subtle)",
                    color: "var(--io-accent)",
                    fontWeight: 500,
                  }}
                >
                  Administrator
                </span>
              ) : (
                user.permissions.slice(0, 8).map((p) => (
                  <span
                    key={p}
                    style={{
                      fontSize: "11px",
                      padding: "2px 7px",
                      borderRadius: "99px",
                      background: "var(--io-surface-secondary)",
                      color: "var(--io-text-muted)",
                      border: "1px solid var(--io-border)",
                    }}
                  >
                    {p}
                  </span>
                ))
              )}
              {!user.permissions.includes("*") &&
                user.permissions.length > 8 && (
                  <span
                    style={{
                      fontSize: "11px",
                      color: "var(--io-text-muted)",
                      padding: "2px 4px",
                    }}
                  >
                    +{user.permissions.length - 8} more
                  </span>
                )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
