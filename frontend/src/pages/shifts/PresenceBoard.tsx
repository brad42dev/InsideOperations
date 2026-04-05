import { useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { shiftsApi, type PresenceStatus } from "../../api/shifts";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatLastSeen(iso: string | null): string {
  if (!iso) return "Never";
  const d = new Date(iso);
  const now = Date.now();
  const diff = now - d.getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

// ---------------------------------------------------------------------------
// Avatar
// ---------------------------------------------------------------------------

function Avatar({ name }: { name: string | null }) {
  const initials = name
    ? name
        .split(" ")
        .map((p) => p[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : "?";
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 36,
        height: 36,
        borderRadius: "50%",
        background: "var(--io-accent)",
        color: "#fff",
        fontSize: 13,
        fontWeight: 700,
        flexShrink: 0,
      }}
    >
      {initials}
    </span>
  );
}

// ---------------------------------------------------------------------------
// On-site indicator dot
// ---------------------------------------------------------------------------

function OnSiteDot({ on }: { on: boolean }) {
  return (
    <span
      style={{
        display: "inline-block",
        width: 9,
        height: 9,
        borderRadius: "50%",
        background: on ? "#22c55e" : "#374151",
        border: `1px solid ${on ? "#16a34a" : "#6b7280"}`,
        flexShrink: 0,
      }}
    />
  );
}

// ---------------------------------------------------------------------------
// Presence row
// ---------------------------------------------------------------------------

function PresenceRow({ p }: { p: PresenceStatus }) {
  return (
    <tr style={{ borderBottom: "1px solid var(--io-border)" }}>
      <td style={{ padding: "11px 16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Avatar name={p.display_name} />
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                color: "var(--io-text-primary)",
                fontWeight: 500,
                fontSize: 14,
              }}
            >
              {p.display_name ?? p.email ?? "Unknown"}
            </div>
            {p.email && (
              <div style={{ color: "var(--io-text-muted)", fontSize: 12 }}>
                {p.email}
              </div>
            )}
          </div>
        </div>
      </td>
      <td style={{ padding: "11px 16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <OnSiteDot on={p.on_site} />
          <span
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: p.on_site ? "#22c55e" : "var(--io-text-muted)",
            }}
          >
            {p.on_site ? "On Site" : "Off Site"}
          </span>
        </div>
      </td>
      <td
        style={{
          padding: "11px 16px",
          color: "var(--io-text-secondary)",
          fontSize: 13,
        }}
      >
        {p.last_area ?? (
          <span style={{ color: "var(--io-text-muted)" }}>—</span>
        )}
      </td>
      <td
        style={{
          padding: "11px 16px",
          color: "var(--io-text-secondary)",
          fontSize: 13,
        }}
      >
        {p.last_door ?? (
          <span style={{ color: "var(--io-text-muted)" }}>—</span>
        )}
      </td>
      <td
        style={{
          padding: "11px 16px",
          color: "var(--io-text-muted)",
          fontSize: 13,
        }}
      >
        {formatLastSeen(p.last_seen_at)}
      </td>
      <td style={{ padding: "11px 16px" }}>
        {p.on_shift ? (
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.05em",
              textTransform: "uppercase",
              padding: "2px 8px",
              borderRadius: 100,
              background: "rgba(74,158,255,0.12)",
              color: "#4a9eff",
              border: "1px solid #4a9eff",
              whiteSpace: "nowrap",
            }}
          >
            On Shift
          </span>
        ) : (
          <span style={{ color: "var(--io-text-muted)", fontSize: 12 }}>—</span>
        )}
      </td>
    </tr>
  );
}

// ---------------------------------------------------------------------------
// Summary counts
// ---------------------------------------------------------------------------

function SummaryBar({ data }: { data: PresenceStatus[] }) {
  const onSite = data.filter((p) => p.on_site).length;
  const onShift = data.filter((p) => p.on_shift).length;
  const offSite = data.length - onSite;

  const tile = (label: string, value: number, color: string) => (
    <div
      style={{
        background: "var(--io-surface)",
        border: "1px solid var(--io-border)",
        borderRadius: 8,
        padding: "14px 20px",
        minWidth: 110,
        textAlign: "center",
      }}
    >
      <div style={{ fontSize: 28, fontWeight: 700, color }}>{value}</div>
      <div
        style={{ fontSize: 12, color: "var(--io-text-muted)", marginTop: 2 }}
      >
        {label}
      </div>
    </div>
  );

  return (
    <div
      style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" }}
    >
      {tile("On Site", onSite, "#22c55e")}
      {tile("Off Site", offSite, "var(--io-text-muted)")}
      {tile("On Shift", onShift, "#4a9eff")}
      {tile("Total", data.length, "var(--io-text-primary)")}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const REFRESH_INTERVAL_MS = 30_000;

export default function PresenceBoard() {
  const qc = useQueryClient();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { data, isLoading, isError, dataUpdatedAt } = useQuery<
    PresenceStatus[]
  >({
    queryKey: ["shifts", "presence"],
    queryFn: async () => {
      const res = await shiftsApi.listPresence();
      if (!res.success) throw new Error(res.error.message);
      return res.data.data;
    },
    refetchInterval: REFRESH_INTERVAL_MS,
  });

  // Track countdown and force re-render label updates
  useEffect(() => {
    intervalRef.current = setInterval(() => {
      // Forces a re-render to update "last refreshed X seconds ago" text
      qc.invalidateQueries({ queryKey: ["shifts", "presence"] });
    }, REFRESH_INTERVAL_MS);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [qc]);

  const presence = data ?? [];
  const onSiteFirst = [...presence].sort((a, b) => {
    if (a.on_site && !b.on_site) return -1;
    if (!a.on_site && b.on_site) return 1;
    if (a.on_shift && !b.on_shift) return -1;
    if (!a.on_shift && b.on_shift) return 1;
    const nameA = a.display_name ?? "";
    const nameB = b.display_name ?? "";
    return nameA.localeCompare(nameB);
  });

  const lastRefreshed = dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleTimeString(undefined, {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })
    : null;

  return (
    <div style={{ padding: "var(--io-space-6)" }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          marginBottom: 20,
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <div>
          <h2
            style={{
              margin: 0,
              color: "var(--io-text-primary)",
              fontSize: 20,
              fontWeight: 600,
            }}
          >
            Presence Board
          </h2>
          <p
            style={{
              margin: "4px 0 0",
              color: "var(--io-text-muted)",
              fontSize: 13,
            }}
          >
            Real-time personnel presence and badge-in status.
            {lastRefreshed && (
              <span style={{ marginLeft: 8 }}>
                Last updated: {lastRefreshed}
              </span>
            )}
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              fontSize: 12,
              color: "var(--io-text-muted)",
              padding: "4px 10px",
              border: "1px solid var(--io-border)",
              borderRadius: 6,
              background: "var(--io-surface)",
            }}
          >
            <span
              style={{
                width: 7,
                height: 7,
                borderRadius: "50%",
                background: "#22c55e",
                display: "inline-block",
              }}
            />
            Auto-refresh every 30s
          </span>
        </div>
      </div>

      {/* Summary tiles */}
      {!isLoading && !isError && <SummaryBar data={presence} />}

      {/* Table */}
      <div
        style={{
          background: "var(--io-surface)",
          border: "1px solid var(--io-border)",
          borderRadius: 8,
          overflow: "hidden",
        }}
      >
        {isLoading ? (
          <div
            style={{
              padding: 40,
              textAlign: "center",
              color: "var(--io-text-muted)",
            }}
          >
            Loading presence data…
          </div>
        ) : isError ? (
          <div style={{ padding: 40, textAlign: "center", color: "#ef4444" }}>
            Failed to load presence data.
          </div>
        ) : onSiteFirst.length === 0 ? (
          <div
            style={{
              padding: 40,
              textAlign: "center",
              color: "var(--io-text-muted)",
            }}
          >
            No presence records found.
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr
                style={{
                  borderBottom: "1px solid var(--io-border)",
                  background: "var(--io-bg)",
                }}
              >
                {[
                  "Personnel",
                  "Status",
                  "Area",
                  "Last Door",
                  "Last Seen",
                  "Shift",
                ].map((h) => (
                  <th
                    key={h}
                    style={{
                      padding: "10px 16px",
                      textAlign: "left",
                      fontSize: 11,
                      fontWeight: 700,
                      letterSpacing: "0.06em",
                      textTransform: "uppercase",
                      color: "var(--io-text-muted)",
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {onSiteFirst.map((p: PresenceStatus) => (
                <PresenceRow key={p.user_id} p={p} />
              ))}
            </tbody>
          </table>
        )}
      </div>

      {!isLoading && !isError && onSiteFirst.length > 0 && (
        <p
          style={{ marginTop: 10, fontSize: 12, color: "var(--io-text-muted)" }}
        >
          {onSiteFirst.length} person{onSiteFirst.length !== 1 ? "s" : ""}{" "}
          tracked
        </p>
      )}
    </div>
  );
}
