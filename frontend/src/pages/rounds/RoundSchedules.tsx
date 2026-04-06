import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { roundsApi, type RoundSchedule } from "../../api/rounds";
import { ExportButton } from "../../shared/components/ExportDialog";
import { useContextMenu } from "../../shared/hooks/useContextMenu";
import ContextMenu from "../../shared/components/ContextMenu";

type RecurrenceType = "per_shift" | "daily" | "interval" | "weekly" | "custom";

const SCHEDULE_COLUMNS = [
  { id: "template_name", label: "Template" },
  { id: "recurrence_type", label: "Recurrence" },
  { id: "is_active", label: "Active" },
];

function recurrenceLabel(
  type: RecurrenceType,
  config: Record<string, unknown>,
): string {
  switch (type) {
    case "per_shift":
      return "Every shift";
    case "daily":
      return `Daily at ${config.time ?? "00:00"}`;
    case "interval":
      return `Every ${config.interval_hours ?? "?"}h`;
    case "weekly": {
      const days = (config.days as string[] | undefined)?.join(", ") ?? "?";
      return `Weekly on ${days}`;
    }
    case "custom":
      return "Custom";
    default:
      return type;
  }
}

export default function RoundSchedules() {
  const queryClient = useQueryClient();
  const [showNew, setShowNew] = useState(false);
  const [newTemplateId, setNewTemplateId] = useState("");
  const [newRecurrence, setNewRecurrence] = useState<RecurrenceType>("daily");
  const [newTime, setNewTime] = useState("08:00");
  const [newInterval, setNewInterval] = useState("4");
  const [error, setError] = useState<string | null>(null);

  const { data: schedulesData, isLoading } = useQuery({
    queryKey: ["rounds", "schedules"],
    queryFn: () => roundsApi.listSchedules(),
  });

  const { data: templatesData } = useQuery({
    queryKey: ["rounds", "templates", "active"],
    queryFn: () => roundsApi.listTemplates({ is_active: true }),
  });

  const createMutation = useMutation({
    mutationFn: () => {
      const config: Record<string, unknown> =
        newRecurrence === "daily"
          ? { time: newTime }
          : newRecurrence === "interval"
            ? { interval_hours: parseFloat(newInterval) }
            : newRecurrence === "per_shift"
              ? {}
              : {};
      return roundsApi.createSchedule({
        template_id: newTemplateId,
        recurrence_type: newRecurrence,
        recurrence_config: config,
      });
    },
    onSuccess: (result) => {
      if (!result.success) {
        setError(result.error.message);
        return;
      }
      queryClient.invalidateQueries({ queryKey: ["rounds", "schedules"] });
      setShowNew(false);
      setNewTemplateId("");
      setNewRecurrence("daily");
      setNewTime("08:00");
    },
    onError: (err: Error) => setError(err.message),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      roundsApi.updateSchedule(id, { is_active: active }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["rounds", "schedules"] }),
  });

  const schedules = schedulesData?.success ? schedulesData.data : [];
  const templates = templatesData?.success ? templatesData.data : [];
  const { menuState, handleContextMenu, closeMenu } =
    useContextMenu<RoundSchedule>();

  const inputStyle: React.CSSProperties = {
    padding: "8px 10px",
    background: "var(--io-surface-secondary)",
    border: "1px solid var(--io-border)",
    borderRadius: "6px",
    color: "var(--io-text-primary)",
    fontSize: "13px",
    width: "100%",
    boxSizing: "border-box",
  };

  const btnStyle = (primary?: boolean): React.CSSProperties => ({
    padding: "7px 16px",
    background: primary ? "var(--io-accent)" : "none",
    border: primary ? "none" : "1px solid var(--io-border)",
    borderRadius: "6px",
    cursor: "pointer",
    fontSize: "13px",
    fontWeight: primary ? 600 : 400,
    color: primary ? "var(--io-accent-foreground)" : "var(--io-text-secondary)",
  });

  return (
    <div
      style={{
        padding: "var(--io-space-6)",
        display: "flex",
        flexDirection: "column",
        gap: "20px",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div>
          <h2
            style={{
              margin: 0,
              fontSize: "20px",
              fontWeight: 700,
              color: "var(--io-text-primary)",
            }}
          >
            Round Schedules
          </h2>
          <p
            style={{
              margin: "4px 0 0",
              fontSize: "14px",
              color: "var(--io-text-secondary)",
            }}
          >
            Automatically create round instances on a recurring schedule.
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <ExportButton
            module="rounds"
            entity="Round Schedules"
            filteredRowCount={schedules.length}
            totalRowCount={schedules.length}
            availableColumns={SCHEDULE_COLUMNS}
            visibleColumns={SCHEDULE_COLUMNS.map((c) => c.id)}
          />
          <button style={btnStyle(true)} onClick={() => setShowNew(true)}>
            + Add Schedule
          </button>
        </div>
      </div>

      {/* New schedule form */}
      {showNew && (
        <div
          style={{
            padding: "20px",
            background: "var(--io-surface)",
            border: "1px solid var(--io-accent)",
            borderRadius: "8px",
            display: "flex",
            flexDirection: "column",
            gap: "14px",
          }}
        >
          <h3
            style={{
              margin: 0,
              fontSize: "15px",
              fontWeight: 700,
              color: "var(--io-text-primary)",
            }}
          >
            New Schedule
          </h3>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "12px",
            }}
          >
            <div>
              <label
                style={{
                  display: "block",
                  fontSize: "12px",
                  fontWeight: 600,
                  color: "var(--io-text-secondary)",
                  marginBottom: "4px",
                }}
              >
                Template
              </label>
              <select
                value={newTemplateId}
                onChange={(e) => setNewTemplateId(e.target.value)}
                style={inputStyle}
              >
                <option value="">— Select —</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label
                style={{
                  display: "block",
                  fontSize: "12px",
                  fontWeight: 600,
                  color: "var(--io-text-secondary)",
                  marginBottom: "4px",
                }}
              >
                Recurrence
              </label>
              <select
                value={newRecurrence}
                onChange={(e) =>
                  setNewRecurrence(e.target.value as RecurrenceType)
                }
                style={inputStyle}
              >
                <option value="per_shift">Every shift</option>
                <option value="daily">Daily</option>
                <option value="interval">Fixed interval</option>
                <option value="weekly">Weekly</option>
              </select>
            </div>
          </div>

          {newRecurrence === "daily" && (
            <div style={{ maxWidth: "160px" }}>
              <label
                style={{
                  display: "block",
                  fontSize: "12px",
                  fontWeight: 600,
                  color: "var(--io-text-secondary)",
                  marginBottom: "4px",
                }}
              >
                Time
              </label>
              <input
                type="time"
                value={newTime}
                onChange={(e) => setNewTime(e.target.value)}
                style={inputStyle}
              />
            </div>
          )}

          {newRecurrence === "interval" && (
            <div style={{ maxWidth: "160px" }}>
              <label
                style={{
                  display: "block",
                  fontSize: "12px",
                  fontWeight: 600,
                  color: "var(--io-text-secondary)",
                  marginBottom: "4px",
                }}
              >
                Interval (hours)
              </label>
              <input
                type="number"
                min={1}
                max={24}
                value={newInterval}
                onChange={(e) => setNewInterval(e.target.value)}
                style={inputStyle}
              />
            </div>
          )}

          {error && (
            <div
              style={{
                padding: "8px 12px",
                background: "rgba(239,68,68,0.1)",
                border: "1px solid rgba(239,68,68,0.3)",
                borderRadius: "6px",
                fontSize: "13px",
                color: "var(--io-alarm-critical)",
              }}
            >
              {error}
            </div>
          )}

          <div
            style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}
          >
            <button
              style={btnStyle()}
              onClick={() => {
                setShowNew(false);
                setError(null);
              }}
            >
              Cancel
            </button>
            <button
              style={btnStyle(true)}
              onClick={() => createMutation.mutate()}
              disabled={!newTemplateId || createMutation.isPending}
            >
              {createMutation.isPending ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      )}

      {/* Schedule list */}
      {isLoading ? (
        <div style={{ color: "var(--io-text-muted)", fontSize: "14px" }}>
          Loading…
        </div>
      ) : schedules.length === 0 ? (
        <div
          style={{
            padding: "40px",
            textAlign: "center",
            color: "var(--io-text-muted)",
            fontSize: "14px",
            background: "var(--io-surface)",
            borderRadius: "8px",
            border: "1px solid var(--io-border)",
          }}
        >
          No schedules configured.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {schedules.map((s) => (
            <div
              key={s.id}
              onContextMenu={(e) => handleContextMenu(e, s)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                padding: "14px 16px",
                background: "var(--io-surface)",
                border: "1px solid var(--io-border)",
                borderRadius: "8px",
              }}
            >
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    fontWeight: 600,
                    fontSize: "14px",
                    color: "var(--io-text-primary)",
                  }}
                >
                  {s.template_name ?? s.template_id}
                </div>
                <div
                  style={{
                    fontSize: "12px",
                    color: "var(--io-text-muted)",
                    marginTop: "2px",
                  }}
                >
                  {recurrenceLabel(
                    s.recurrence_type as RecurrenceType,
                    s.recurrence_config,
                  )}
                </div>
              </div>
              <div
                style={{ display: "flex", alignItems: "center", gap: "10px" }}
              >
                <span
                  style={{
                    fontSize: "11px",
                    padding: "2px 8px",
                    borderRadius: "100px",
                    background: s.is_active
                      ? "rgba(34,197,94,0.12)"
                      : "var(--io-surface-secondary)",
                    color: s.is_active
                      ? "var(--io-alarm-normal)"
                      : "var(--io-text-muted)",
                    fontWeight: 700,
                  }}
                >
                  {s.is_active ? "Active" : "Paused"}
                </span>
                <button
                  onClick={() =>
                    toggleMutation.mutate({ id: s.id, active: !s.is_active })
                  }
                  style={{
                    padding: "5px 12px",
                    background: "none",
                    border: "1px solid var(--io-border)",
                    borderRadius: "6px",
                    cursor: "pointer",
                    fontSize: "12px",
                    color: "var(--io-text-secondary)",
                  }}
                >
                  {s.is_active ? "Pause" : "Resume"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      {menuState && (
        <ContextMenu
          x={menuState.x}
          y={menuState.y}
          items={[
            {
              label: "Edit",
              permission: "rounds:write",
              onClick: () => {
                closeMenu();
              },
            },
            {
              label: "Run Now",
              permission: "rounds:write",
              onClick: () => {
                closeMenu();
              },
            },
            {
              label: "Toggle Enable/Disable",
              permission: "rounds:write",
              onClick: () => {
                closeMenu();
                toggleMutation.mutate({
                  id: menuState.data!.id,
                  active: !menuState.data!.is_active,
                });
              },
            },
            {
              label: "Delete",
              danger: true,
              divider: true,
              permission: "rounds:write",
              onClick: () => {
                closeMenu();
              },
            },
          ]}
          onClose={closeMenu}
        />
      )}
    </div>
  );
}
