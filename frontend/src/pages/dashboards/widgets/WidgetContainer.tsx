import { memo, useState } from "react";
import type { WidgetConfig } from "../../../api/dashboards";
import { useAuthStore } from "../../../store/auth";
import KpiCard from "./KpiCard";
import LineChart from "./LineChart";
import BarChart from "./BarChart";
import PieChart from "./PieChart";
import GaugeWidget from "./GaugeWidget";
import TableWidget from "./TableWidget";
import TextWidget from "./TextWidget";
import AlertStatusWidget from "./AlertStatusWidget";
import AlarmCountBySeverityWidget from "./AlarmCountBySeverityWidget";
import UnackCountWidget from "./UnackCountWidget";
import AlarmRateWidget from "./AlarmRateWidget";
import AlarmListWidget from "./AlarmListWidget";
import AlarmKpiWidget from "./AlarmKpiWidget";
import OpcStatusWidget from "./OpcStatusWidget";
import ShiftInfoWidget from "./ShiftInfoWidget";
import AreaStatusTableWidget from "./AreaStatusTableWidget";
import ServiceHealthWidget from "./ServiceHealthWidget";
import WsThroughputWidget from "./WsThroughputWidget";
import DbSizeWidget from "./DbSizeWidget";
import ApiResponseTimeWidget from "./ApiResponseTimeWidget";
import ServiceHealthTableWidget from "./ServiceHealthTableWidget";
import QualityDistributionWidget from "./QualityDistributionWidget";
import StalePointsWidget from "./StalePointsWidget";
import BadQualityBySourceWidget from "./BadQualityBySourceWidget";
import PointStatusTableWidget from "./PointStatusTableWidget";
import AlarmHealthKpiWidget from "./AlarmHealthKpiWidget";
import ProductionStatusWidget from "./ProductionStatusWidget";
import RoundsCompletionWidget from "./RoundsCompletionWidget";
import OpenAlertsWidget from "./OpenAlertsWidget";
import SystemUptimeWidget from "./SystemUptimeWidget";
import AlarmRateTrendWidget from "./AlarmRateTrendWidget";
import TrendChartWidget from "./TrendChartWidget";
import PlaceholderWidget from "./PlaceholderWidget";
import ExportDataDialog from "./ExportDataDialog";

interface Props {
  config: WidgetConfig;
  variables: Record<string, string[]>;
  editMode?: boolean;
  onEdit?: (id: string) => void;
  onRemove?: (id: string) => void;
}

function WidgetBody({
  config,
  variables,
}: {
  config: WidgetConfig;
  variables: Record<string, string[]>;
}) {
  switch (config.type) {
    case "kpi-card":
      return <KpiCard config={config} variables={variables} />;
    case "line-chart":
      return <LineChart config={config} variables={variables} />;
    case "bar-chart":
      return <BarChart config={config} variables={variables} />;
    case "pie-chart":
      return <PieChart config={config} variables={variables} />;
    case "gauge":
      return <GaugeWidget config={config} variables={variables} />;
    case "table":
      return <TableWidget config={config} variables={variables} />;
    case "text":
      return <TextWidget config={config} variables={variables} />;
    case "alert-status":
      return <AlertStatusWidget config={config} variables={variables} />;
    case "alarm-count-by-severity":
      return (
        <AlarmCountBySeverityWidget config={config} variables={variables} />
      );
    case "unack-count":
      return <UnackCountWidget config={config} variables={variables} />;
    case "alarm-rate":
      return <AlarmRateWidget config={config} variables={variables} />;
    case "alarm-list":
      return <AlarmListWidget config={config} variables={variables} />;
    // Operations Overview widgets
    case "alarm-kpi":
      return <AlarmKpiWidget config={config} variables={variables} />;
    case "opc-status":
      return <OpcStatusWidget config={config} variables={variables} />;
    case "shift-info":
      return <ShiftInfoWidget config={config} variables={variables} />;
    case "area-status-table":
      return <AreaStatusTableWidget config={config} variables={variables} />;
    // System Health dashboard widgets
    case "service-health":
      return <ServiceHealthWidget config={config} variables={variables} />;
    case "ws-throughput":
      return <WsThroughputWidget config={config} variables={variables} />;
    case "db-size":
      return <DbSizeWidget config={config} variables={variables} />;
    case "api-response-time":
      return <ApiResponseTimeWidget config={config} variables={variables} />;
    case "service-health-table":
      return <ServiceHealthTableWidget config={config} variables={variables} />;
    // Equipment Health dashboard widgets
    case "quality-distribution":
      return (
        <QualityDistributionWidget config={config} variables={variables} />
      );
    case "stale-points":
      return <StalePointsWidget config={config} variables={variables} />;
    case "bad-quality-by-source":
      return <BadQualityBySourceWidget config={config} variables={variables} />;
    case "point-status-table":
      return <PointStatusTableWidget config={config} variables={variables} />;
    // Executive Summary dashboard widgets
    case "alarm-health-kpi":
      return <AlarmHealthKpiWidget config={config} variables={variables} />;
    case "production-status":
      return <ProductionStatusWidget config={config} variables={variables} />;
    case "rounds-completion":
      return <RoundsCompletionWidget config={config} variables={variables} />;
    case "open-alerts":
      return <OpenAlertsWidget config={config} variables={variables} />;
    case "system-uptime":
      return <SystemUptimeWidget config={config} variables={variables} />;
    case "alarm-rate-trend":
      return <AlarmRateTrendWidget config={config} variables={variables} />;
    // Process/time-series trend chart
    case "trend-chart":
      return <TrendChartWidget config={config} variables={variables} />;
    default:
      return <PlaceholderWidget config={config} />;
  }
}

function getWidgetTitle(config: WidgetConfig): string {
  const cfg = config.config as Record<string, unknown>;
  if (typeof cfg.title === "string") return cfg.title;
  return config.type;
}

const WidgetContainer = memo(function WidgetContainer({
  config,
  variables,
  editMode = false,
  onEdit,
  onRemove,
}: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const title = getWidgetTitle(config);
  const user = useAuthStore((s) => s.user);
  const canExport = user?.permissions.includes("dashboards:export") === true;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        background: "var(--io-surface-elevated)",
        border: "1px solid var(--io-border)",
        borderRadius: "var(--io-radius)",
        overflow: "hidden",
        position: "relative",
      }}
    >
      {/* Title bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 10px",
          height: "32px",
          borderBottom: "1px solid var(--io-border)",
          background: "var(--io-surface-secondary)",
          flexShrink: 0,
        }}
      >
        <span
          style={{
            fontSize: "12px",
            fontWeight: 600,
            color: "var(--io-text-secondary)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {title}
        </span>

        {/* 3-dot menu — only in edit mode */}
        {editMode && (
          <div style={{ position: "relative", flexShrink: 0 }}>
            <button
              onClick={() => setMenuOpen((v) => !v)}
              style={{
                background: "none",
                border: "none",
                color: "var(--io-text-muted)",
                cursor: "pointer",
                padding: "2px 4px",
                fontSize: "14px",
                lineHeight: 1,
                borderRadius: 4,
              }}
              title="Widget options"
            >
              ⋯
            </button>

            {menuOpen && (
              <>
                <div
                  onClick={() => setMenuOpen(false)}
                  style={{ position: "fixed", inset: 0, zIndex: 98 }}
                />
                <div
                  style={{
                    position: "absolute",
                    right: 0,
                    top: "calc(100% + 4px)",
                    minWidth: "140px",
                    background: "var(--io-surface-elevated)",
                    border: "1px solid var(--io-border)",
                    borderRadius: "var(--io-radius)",
                    boxShadow: "var(--io-shadow-lg)",
                    zIndex: 99,
                    overflow: "hidden",
                  }}
                >
                  {(
                    [
                      {
                        label: "Edit",
                        action: () => {
                          onEdit?.(config.id);
                          setMenuOpen(false);
                        },
                      },
                      ...(canExport
                        ? [
                            {
                              label: "Export Data",
                              action: () => {
                                setShowExport(true);
                                setMenuOpen(false);
                              },
                            },
                          ]
                        : []),
                      {
                        label: "Remove",
                        action: () => {
                          onRemove?.(config.id);
                          setMenuOpen(false);
                        },
                        danger: true,
                      },
                    ] as Array<{
                      label: string;
                      action: () => void;
                      danger?: boolean;
                    }>
                  ).map((item) => (
                    <button
                      key={item.label}
                      onClick={item.action}
                      style={{
                        width: "100%",
                        padding: "8px 12px",
                        background: "none",
                        border: "none",
                        color: item.danger
                          ? "var(--io-danger)"
                          : "var(--io-text-secondary)",
                        fontSize: "13px",
                        cursor: "pointer",
                        textAlign: "left",
                        display: "block",
                      }}
                      onMouseEnter={(e) => {
                        (
                          e.currentTarget as HTMLButtonElement
                        ).style.background = "var(--io-surface-secondary)";
                      }}
                      onMouseLeave={(e) => {
                        (
                          e.currentTarget as HTMLButtonElement
                        ).style.background = "transparent";
                      }}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Widget body */}
      <div style={{ flex: 1, overflow: "hidden", minHeight: 0 }}>
        <WidgetBody config={config} variables={variables} />
      </div>

      {/* Export Data dialog — rendered outside the widget body so it is not clipped */}
      {showExport && (
        <ExportDataDialog
          widgetConfig={config}
          onClose={() => setShowExport(false)}
        />
      )}
    </div>
  );
});

export default WidgetContainer;
