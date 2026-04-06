import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { dashboardsApi, type DashboardVariable, type WidgetConfig } from "../../api/dashboards";
import { useAuthStore } from "../../store/auth";
import { useUiStore } from "../../store/ui";
import WidgetContainer from "./widgets/WidgetContainer";
import HistoricalPlaybackBar from "../../shared/components/HistoricalPlaybackBar";
import { useContextMenu } from "../../shared/hooks/useContextMenu";
import ContextMenu from "../../shared/components/ContextMenu";

// ---------------------------------------------------------------------------
// Variable bar
// ---------------------------------------------------------------------------

function VariableBar({
  variables,
  values,
  onChange,
}: {
  variables: DashboardVariable[];
  values: Record<string, string[]>;
  onChange: (name: string, val: string[]) => void;
}) {
  if (variables.length === 0) return null;

  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: "8px",
        padding: "8px 16px",
        background: "var(--io-surface-secondary)",
        borderBottom: "1px solid var(--io-border)",
        flexShrink: 0,
      }}
    >
      {variables.map((variable) => {
        const currentValues =
          values[variable.name] ?? (variable.default ? [variable.default] : []);
        const options = variable.options ?? [];

        if (variable.type === "text" || variable.type === "constant") {
          return (
            <div
              key={variable.name}
              style={{ display: "flex", alignItems: "center", gap: "6px" }}
            >
              <label
                style={{
                  fontSize: "12px",
                  color: "var(--io-text-muted)",
                  fontWeight: 600,
                }}
              >
                {variable.label}
              </label>
              <input
                type="text"
                value={currentValues[0] ?? ""}
                onChange={(e) => onChange(variable.name, [e.target.value])}
                style={{
                  padding: "4px 8px",
                  background: "var(--io-surface-elevated)",
                  border: "1px solid var(--io-border)",
                  borderRadius: "var(--io-radius)",
                  color: "var(--io-text-primary)",
                  fontSize: "12px",
                  outline: "none",
                  minWidth: "100px",
                }}
              />
            </div>
          );
        }

        if (variable.type === "interval") {
          const intervalOptions =
            options.length > 0
              ? options
              : ["1m", "5m", "15m", "30m", "1h", "6h", "24h"];
          return (
            <div
              key={variable.name}
              style={{ display: "flex", alignItems: "center", gap: "6px" }}
            >
              <label
                style={{
                  fontSize: "12px",
                  color: "var(--io-text-muted)",
                  fontWeight: 600,
                }}
              >
                {variable.label}
              </label>
              <select
                value={currentValues[0] ?? intervalOptions[0]}
                onChange={(e) => onChange(variable.name, [e.target.value])}
                style={{
                  padding: "4px 8px",
                  background: "var(--io-surface-elevated)",
                  border: "1px solid var(--io-border)",
                  borderRadius: "var(--io-radius)",
                  color: "var(--io-text-primary)",
                  fontSize: "12px",
                  outline: "none",
                  cursor: "pointer",
                }}
              >
                {intervalOptions.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>
          );
        }

        // Default: dropdown (query | custom | chained)
        const allOption = variable.include_all
          ? ["__all__", ...options]
          : options;
        const isMulti = variable.multi ?? false;

        return (
          <div
            key={variable.name}
            style={{ display: "flex", alignItems: "center", gap: "6px" }}
          >
            <label
              style={{
                fontSize: "12px",
                color: "var(--io-text-muted)",
                fontWeight: 600,
              }}
            >
              {variable.label}
            </label>
            <select
              multiple={isMulti}
              value={isMulti ? currentValues : (currentValues[0] ?? "")}
              onChange={(e) => {
                if (isMulti) {
                  const selected = Array.from(e.target.selectedOptions).map(
                    (o) => o.value,
                  );
                  onChange(variable.name, selected);
                } else {
                  onChange(variable.name, [e.target.value]);
                }
              }}
              style={{
                padding: "4px 8px",
                background: "var(--io-surface-elevated)",
                border: "1px solid var(--io-border)",
                borderRadius: "var(--io-radius)",
                color: "var(--io-text-primary)",
                fontSize: "12px",
                outline: "none",
                cursor: "pointer",
                minWidth: "100px",
              }}
            >
              {allOption.map((opt) => (
                <option key={opt} value={opt}>
                  {opt === "__all__" ? "All" : opt}
                </option>
              ))}
            </select>
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// DashboardViewer
// ---------------------------------------------------------------------------

interface Props {
  kiosk?: boolean;
}

export default function DashboardViewer({ kiosk: kioskProp }: Props) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuthStore();
  const { setKiosk } = useUiStore();
  const queryClient = useQueryClient();

  const kioskParam = searchParams.get("kiosk") === "true";
  const isKiosk = kioskProp ?? kioskParam;

  // Propagate kiosk state to global UI store so AppShell hides chrome
  useEffect(() => {
    setKiosk(isKiosk);
    return () => setKiosk(false);
  }, [isKiosk, setKiosk]);

  const [varValues, setVarValues] = useState<Record<string, string[]>>({});
  const [showKioskStrip, setShowKioskStrip] = useState(false);
  const [variableBarCollapsed, setVariableBarCollapsed] = useState(false);

  const query = useQuery({
    queryKey: ["dashboard", id],
    queryFn: async () => {
      if (!id) throw new Error("No dashboard ID");
      const result = await dashboardsApi.get(id);
      if (!result.success) throw new Error(result.error.message);
      return result.data;
    },
    enabled: !!id,
  });

  const dashboard = query.data;

  // Initialize variable values from URL or defaults
  useEffect(() => {
    if (!dashboard) return;
    const initial: Record<string, string[]> = {};
    for (const variable of dashboard.variables) {
      const urlVal = searchParams.get(`var-${variable.name}`);
      if (urlVal) {
        initial[variable.name] = urlVal.split(",");
      } else if (variable.default) {
        initial[variable.name] = [variable.default];
      }
    }
    setVarValues(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dashboard?.id]);

  const handleVariableChange = useCallback(
    (name: string, val: string[]) => {
      setVarValues((prev) => ({ ...prev, [name]: val }));
      const newParams = new URLSearchParams(searchParams);
      if (val.length > 0) {
        newParams.set(`var-${name}`, val.join(","));
      } else {
        newParams.delete(`var-${name}`);
      }
      setSearchParams(newParams, { replace: true });
    },
    [searchParams, setSearchParams],
  );

  const duplicateMutation = useMutation({
    mutationFn: async () => {
      if (!id) return;
      const result = await dashboardsApi.duplicate(id);
      if (!result.success) throw new Error(result.error.message);
      return result.data;
    },
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: ["dashboards"] });
      if (data) navigate(`/dashboards/${data.id}/edit`);
    },
  });

  const canEditDashboards =
    user?.permissions.includes("dashboards:edit") === true;
  const isOwner = (user && dashboard?.user_id === user.id) || canEditDashboards;

  if (query.isLoading) {
    return (
      <div
        style={{
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--io-text-muted)",
          fontSize: "14px",
        }}
      >
        Loading dashboard...
      </div>
    );
  }

  if (query.isError || !dashboard) {
    return (
      <div
        style={{
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "column",
          gap: "12px",
          color: "var(--io-danger)",
          fontSize: "14px",
        }}
      >
        <span>Failed to load dashboard</span>
        <button
          onClick={() => navigate("/dashboards")}
          style={{
            padding: "6px 14px",
            background: "var(--io-surface-elevated)",
            border: "1px solid var(--io-border)",
            borderRadius: "var(--io-radius)",
            color: "var(--io-text-secondary)",
            cursor: "pointer",
            fontSize: "13px",
          }}
        >
          Back to Dashboards
        </button>
      </div>
    );
  }

  const widgets = dashboard.widgets ?? [];
  const { menuState: widgetMenuState, handleContextMenu: handleWidgetContextMenu, closeMenu: closeWidgetMenu } = useContextMenu<WidgetConfig>();

  return (
    <div
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        background: "var(--io-surface-primary)",
        overflow: "hidden",
        position: "relative",
      }}
      onMouseMove={() => {
        if (isKiosk) setShowKioskStrip(true);
      }}
      onMouseLeave={() => {
        if (isKiosk) setShowKioskStrip(false);
      }}
    >
      {/* Toolbar — hidden in kiosk mode, or shown as strip on hover */}
      {(!isKiosk || showKioskStrip) && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 16px",
            height: "40px",
            flexShrink: 0,
            background: "var(--io-surface)",
            borderBottom: "1px solid var(--io-border)",
            ...(isKiosk
              ? {
                  position: "absolute",
                  top: 0,
                  left: 0,
                  right: 0,
                  zIndex: 20,
                  background: "var(--io-surface-overlay)",
                  backdropFilter: "blur(8px)",
                  borderBottom: "none",
                }
              : {}),
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            {!isKiosk && (
              <button
                onClick={() => navigate("/dashboards")}
                style={{
                  background: "none",
                  border: "none",
                  color: "var(--io-text-muted)",
                  cursor: "pointer",
                  fontSize: "13px",
                  padding: "4px",
                }}
                title="Back to dashboards"
              >
                ←
              </button>
            )}
            <span
              style={{
                fontSize: "14px",
                fontWeight: 600,
                color: "var(--io-text-primary)",
              }}
            >
              {dashboard.name}
            </span>
            {dashboard.published && (
              <span
                style={{
                  fontSize: "10px",
                  padding: "2px 6px",
                  borderRadius: "100px",
                  background: "var(--io-accent-subtle)",
                  color: "var(--io-accent)",
                  fontWeight: 700,
                  letterSpacing: "0.04em",
                }}
              >
                Published
              </span>
            )}
          </div>

          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            {dashboard.variables.length > 0 && (
              <button
                onClick={() => setVariableBarCollapsed((v) => !v)}
                style={{
                  padding: "4px 10px",
                  background: "none",
                  border: "1px solid var(--io-border)",
                  borderRadius: "var(--io-radius)",
                  color: "var(--io-text-muted)",
                  cursor: "pointer",
                  fontSize: "12px",
                }}
              >
                {variableBarCollapsed ? "Show Variables" : "Hide Variables"}
              </button>
            )}

            {isOwner && !isKiosk && (
              <button
                onClick={() => navigate(`/dashboards/${id}/edit`)}
                style={{
                  padding: "4px 10px",
                  background: "var(--io-accent)",
                  border: "none",
                  borderRadius: "var(--io-radius)",
                  color: "var(--io-btn-text)",
                  cursor: "pointer",
                  fontSize: "12px",
                  fontWeight: 600,
                }}
              >
                Edit
              </button>
            )}

            {!isKiosk && (
              <button
                onClick={() => duplicateMutation.mutate()}
                style={{
                  padding: "4px 10px",
                  background: "none",
                  border: "1px solid var(--io-border)",
                  borderRadius: "var(--io-radius)",
                  color: "var(--io-text-muted)",
                  cursor: "pointer",
                  fontSize: "12px",
                }}
              >
                Duplicate
              </button>
            )}

            <button
              onClick={() => {
                const newParams = new URLSearchParams(searchParams);
                if (kioskParam) {
                  newParams.delete("kiosk");
                } else {
                  newParams.set("kiosk", "true");
                }
                setSearchParams(newParams);
              }}
              style={{
                padding: "4px 10px",
                background: "none",
                border: "1px solid var(--io-border)",
                borderRadius: "var(--io-radius)",
                color: "var(--io-text-muted)",
                cursor: "pointer",
                fontSize: "12px",
              }}
            >
              {isKiosk ? "Exit Kiosk" : "Kiosk"}
            </button>

            {!isKiosk && (
              <button
                onClick={() =>
                  window.open(
                    `/detached/dashboard/${id}`,
                    "_blank",
                    "noopener,noreferrer,width=1400,height=900",
                  )
                }
                title="Open dashboard in new window"
                style={{
                  padding: "4px 6px",
                  background: "none",
                  border: "1px solid var(--io-border)",
                  borderRadius: "var(--io-radius)",
                  color: "var(--io-text-muted)",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                }}
              >
                <svg
                  width="13"
                  height="13"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                  <polyline points="15 3 21 3 21 9" />
                  <line x1="10" y1="14" x2="21" y2="3" />
                </svg>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Variable bar */}
      {!variableBarCollapsed && !isKiosk && (
        <VariableBar
          variables={dashboard.variables}
          values={varValues}
          onChange={handleVariableChange}
        />
      )}

      {/* Playback bar — time-context mode: sets global time range for all widgets */}
      {!isKiosk && <HistoricalPlaybackBar mode="time-context" />}

      {/* Dashboard grid */}
      <div
        style={{
          flex: 1,
          overflow: "auto",
          padding: "12px",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(12, 1fr)",
            gridAutoRows: "60px",
            gap: "8px",
            minHeight: "100%",
          }}
        >
          {widgets.map((widget) => (
            <div
              key={widget.id}
              onContextMenu={(e) => handleWidgetContextMenu(e, widget)}
              style={{
                gridColumn: `${widget.x + 1} / span ${widget.w}`,
                gridRow: `${widget.y + 1} / span ${widget.h}`,
              }}
            >
              <WidgetContainer
                config={widget}
                variables={varValues}
                editMode={false}
              />
            </div>
          ))}
          {widgetMenuState && (
            <ContextMenu
              x={widgetMenuState.x}
              y={widgetMenuState.y}
              items={[
                { label: "Refresh Widget", onClick: () => { closeWidgetMenu(); } },
                { label: "Export Data", onClick: () => { closeWidgetMenu(); } },
                { label: "Full Screen", onClick: () => { closeWidgetMenu(); } },
              ]}
              onClose={closeWidgetMenu}
            />
          )}

          {widgets.length === 0 && (
            <div
              style={{
                gridColumn: "1 / -1",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "80px 20px",
                color: "var(--io-text-muted)",
                fontSize: "14px",
                flexDirection: "column",
                gap: "12px",
              }}
            >
              <span style={{ fontSize: "32px", opacity: 0.3 }}>▦</span>
              <span>This dashboard has no widgets yet.</span>
              {isOwner && (
                <button
                  onClick={() => navigate(`/dashboards/${id}/edit`)}
                  style={{
                    padding: "6px 14px",
                    background: "var(--io-accent)",
                    border: "none",
                    borderRadius: "var(--io-radius)",
                    color: "var(--io-btn-text)",
                    cursor: "pointer",
                    fontSize: "13px",
                  }}
                >
                  Edit Dashboard
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
