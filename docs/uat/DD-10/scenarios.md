# UAT Scenarios — DD-10

## Page Load and Dashboard List
Scenario 1: [DD-10-015] Dashboards page renders without error — navigate to /dashboards → dashboard list visible, no error boundary or blank page

## Equipment Health Dashboard
Scenario 2: [DD-10-015] Equipment Health dashboard loads — navigate to /dashboards, open Equipment Health → page renders with widgets, no "Unknown widget type" or raw type-string badge
Scenario 3: [DD-10-015] Equipment Health widgets show real content — after opening Equipment Health → all widgets render visual content or proper empty/loading state (not raw type strings like "quality-distribution", "stale-points", "bad-quality-by-source", "point-status-table")

## Executive Summary Dashboard
Scenario 4: [DD-10-015] Executive Summary dashboard loads — navigate to /dashboards, open Executive Summary → page renders with widgets, no error boundary
Scenario 5: [DD-10-015] Executive Summary widgets show real content — after opening Executive Summary → widgets render content not raw type-label badges (not "alarm-health-kpi", "production-status", "rounds-completion", "open-alerts", "system-uptime", "alarm-rate-trend")

## Reactor Unit 1 KPIs Dashboard
Scenario 6: [DD-10-015] Reactor Unit 1 KPIs dashboard loads — navigate to /dashboards, open Reactor Unit 1 KPIs → page renders, no error
Scenario 7: [DD-10-015] Trend chart widget renders as chart not type badge — on Reactor Unit 1 KPIs, Unit 1 Trends widget shows a chart visual, not the raw string "trend-chart"

## No Raw Type Strings Anywhere
Scenario 8: [DD-10-015] No raw widget type strings visible across dashboards — spot-check → no widget card shows raw type identifier string (e.g., "quality-distribution", "stale-points", "alarm-health-kpi", "trend-chart") as its primary visible text content
