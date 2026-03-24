# UAT Scenarios — DD-10

## BadQualityBySource Widget (DD-10-016)

Scenario 1: [DD-10-016] Dashboards page renders without error — navigate to /dashboards → page loads, no error boundary
Scenario 2: [DD-10-016] Equipment Health dashboard loads without crash — click Equipment Health dashboard → page opens, no "Dashboards failed to load" error boundary
Scenario 3: [DD-10-016] BadQualityBySource widget renders content or graceful state — open Equipment Health → BadQualityBySource widget area shows content, loading spinner, or "No data" — NOT a raw "bad-quality-by-source" type badge and NOT a JS crash error boundary

## ProductionStatus Widget (DD-10-017)

Scenario 4: [DD-10-017] Executive Summary dashboard loads without crash — click Executive Summary dashboard → page opens, no "Dashboards failed to load" error boundary
Scenario 5: [DD-10-017] ProductionStatus widget renders content or graceful state — open Executive Summary → ProductionStatus widget area shows content, loading spinner, or "No data" — NOT a raw "production-status" type badge and NOT a JS crash

## TrendChart Widget (DD-10-018)

Scenario 6: [DD-10-018] Reactor Unit 1 KPIs dashboard loads without crash — click Reactor Unit 1 KPIs dashboard → page opens, no "Dashboards failed to load" error boundary
Scenario 7: [DD-10-018] TrendChart widget renders chart or graceful state — open Reactor Unit 1 KPIs → Unit 1 Trends / trend-chart widget shows a chart or "No data" placeholder — NOT a raw "trend-chart" type badge and NOT a JS crash

## Cross-cutting

Scenario 8: [DD-10-016] No raw type-string badges visible on Equipment Health — after opening Equipment Health, no widget shows raw type string text (e.g., "bad-quality-by-source", "stale-points") as visible content
Scenario 9: [DD-10-017] No raw type-string badge "production-status" visible — open Executive Summary, no widget shows raw "production-status" text as content
Scenario 10: [DD-10-018] No raw type-string badge "trend-chart" visible — open Reactor Unit 1 KPIs, no widget shows raw "trend-chart" text as content
