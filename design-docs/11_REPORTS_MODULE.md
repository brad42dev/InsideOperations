# Inside/Operations - Reports Module

## Overview

Report browsing, generation, scheduling, and viewing. Report templates are designed in the Designer module (doc 09) using the Report design mode. The Reports module is the operational front-end for running, scheduling, and consuming reports — not for designing them.

## Relationship to Dashboards

Reports and Dashboards share the same widget palette (doc 32 — Shared UI Components). The difference:

| Aspect | Dashboards | Reports |
|--------|-----------|---------|
| **Data** | Live, real-time | Snapshot of a specific time range |
| **Layout** | Screen-oriented (viewport fills) | Page-oriented (PDF/HTML pages) |
| **Delivery** | View in-app | Generate on demand or on schedule, export/email |
| **Expanding elements** | N/A | Tables, event lists, alarm summaries grow at generation time |

A Dashboard layout can be converted to a Report template (and vice versa) in the Designer. Same elements, different rendering context.

## Template Design (in Designer — doc 09)

Report templates are created in the Designer module using Report design mode. The Designer provides:

- The full shared widget palette (trends, tables, gauges, KPIs, alarm lists — same as Dashboards)
- Report-specific elements: text blocks, headers, footers, page breaks, section breaks
- Point data binding and computed columns via Expression Builder (doc 23)

### Expanding Elements

Data-driven sections (tables, event lists, alarm summaries) expand at generation time to fit actual data volume. In the Designer:

- Expanding elements appear as fixed-size placeholders with overflow indicators
- Page breaks are inserted automatically around expanding sections
- Manual page break controls available for explicit layout control
- "Preview with sample data" button shows approximate generated output

## Key Features

### Report Generation

- **On-demand**: User selects template, specifies time range, generates
- **Scheduled**: Configure schedule (daily, weekly, shift-end) + recipients + format. Schedule configuration managed in the Reports module (not the Designer).
- **Email delivery**: Via Email Service (doc 28) using `report_ready` template. Reports emailed as attachments (CSV, PDF) or with download links. Recipient list supports users, roles, or explicit email addresses.
- Date range selection
- Parameter input forms (template-defined)
- Async processing for large reports with progress tracking
- Result caching (1 hour)

### Computed Columns

- Report column configuration includes a **"Computed Column"** option alongside standard point data columns
- Selecting "Computed Column" opens the Expression Builder (doc 23) with `context="calculated_value"`
- On apply: stores expression reference in the report template configuration
- Computed columns are evaluated **server-side** during report generation via the Rhai expression engine
- Enables derived calculations (e.g., efficiency ratios, normalized values, multi-point formulas) directly within report output

### Export Formats

- **PDF**: Via Typst engine (`typst-as-lib`, MIT) — branded templates, page-spanning tables, embedded charts
- **HTML**: Web view with full formatting
- **CSV**: Comma-separated values (rich text stripped to plain text)
- **Excel (XLSX)**: Shares `rust_xlsxwriter` library with Universal Export (doc 25)
- **JSON**: Structured data

### Report Viewer

In-app viewer for generated reports rendered as HTML. Download available for PDF/CSV/XLSX formats.

### Reports vs Universal Export

The Reports module retains its own template-driven generation pipeline. Universal Export (doc 25) provides raw data dumps from any table/widget. Some overlap is expected and acceptable — they serve different purposes:

- **Reports**: Structured, formatted, template-defined output with headers, grouping, computed columns, and page layout
- **Universal Export**: Raw rows and columns, what-you-see-is-what-you-get from any data table

Universal Export adds a report template list export (catalog of templates as CSV/XLSX/JSON) and template definition export (full config as JSON). Report generation output continues through the Reports module's own pipeline.

### Data Sources

- Points historical data (time-series)
- Log entries
- Round completions
- Events and alarms
- **Alert history** — alerts by severity, response times (time-to-acknowledge, time-to-resolve), escalation frequency, channel reliability (email/SMS/webhook delivery success rates). Enables alert summary reports for operational review and compliance. See doc 27.
- Custom SQL queries (admin only)

## What the Reports Module Does

The Reports module (as a frontend module) is focused on:

1. **Browsing/searching** report templates (created in the Designer)
2. **Running reports on demand** — pick template, set time range and parameters, generate
3. **Managing schedules** — create/edit/delete scheduled report runs, configure recipients and format
4. **Viewing generated report history** — list of past runs with status, download/view
5. **In-app report viewer** — HTML rendering of generated reports

The Reports module does **not** handle template design — that is the Designer module (doc 09, Report design mode).

## User Stories

1. **As an engineer, I want to generate a monthly production report, so I can analyze trends over time.**

2. **As a compliance officer, I want to export alarm history to Excel, so I can submit regulatory reports.**

3. **As a manager, I want to schedule weekly reports to be emailed automatically.**

## Technical Requirements

### Report Engine

- Server-side report generation
- Async processing for large reports
- Progress tracking
- Result caching (1 hour)
- UOM conversion performed server-side: API Gateway converts historical data to the requested unit before returning results

### Query Optimization

- Use TimescaleDB continuous aggregates (1m, 5m, 15m, 1h, 1d) based on report time range
- All aggregate data includes only `Good` OPC UA quality values
- Limit query time (< 30 seconds)
- Pagination for large result sets

### Aggregation Type Awareness

- When configuring report columns with point data, only offer aggregate functions permitted by the point's `aggregation_types`
- If a point does not permit averaging, do not offer avg columns; if it does not permit summing, do not offer sum/total columns
- `min`, `max`, and `count` columns are always available
- Rolling averages available as a column option when the point permits averaging
- Custom time bucket sizes supported via `bucket_interval` API parameter (see `21_API_DESIGN.md`). Expression-based calculated columns supported via Expression Builder (see `23_EXPRESSION_BUILDER.md`).

### Export Libraries

- CSV: Native Rust
- PDF: Typst (`typst-as-lib`, MIT)
- Excel: rust_xlsxwriter

## API Endpoints

- `GET /api/reports/templates` - List report templates
- `POST /api/reports/templates` - Create template (from Designer)
- `GET /api/reports/templates/:id` - Get template details
- `POST /api/reports/generate` - Generate report (template ID + time range + parameters)
- `GET /api/reports/:id/status` - Check generation status
- `GET /api/reports/:id/download` - Download generated report file
- `GET /api/reports/history` - List generated report history
- `POST /api/reports/schedules` - Create scheduled report
- `GET /api/reports/schedules` - List scheduled reports
- `PUT /api/reports/schedules/:id` - Update schedule
- `DELETE /api/reports/schedules/:id` - Delete schedule

## Success Criteria

- Users can browse and run report templates
- Reports generate within reasonable time (< 30s for typical queries)
- Export formats work correctly
- Large datasets handled efficiently
- Reports are accurate and match source data
- Report column configuration respects point aggregation type constraints
- Scheduled reports deliver on time via email
- In-app viewer renders reports correctly

## Permissions

| Permission | Description | Default Roles |
|---|---|---|
| `reports:read` | View reports | All roles |
| `reports:create` | Create/edit report templates | Analyst, Supervisor, Content Manager, Admin |
| `reports:delete` | Delete report templates | Supervisor, Admin |
| `reports:export` | Export reports to CSV/PDF/Excel | Analyst, Supervisor, Content Manager, Admin |
| `reports:admin` | Reports module administration (schedules, system templates) | Admin |

*Role-permission assignments are managed centrally in doc 03. Defaults shown for reference.*

## Canned Report Templates

I/O ships with 38 pre-built report templates organized into 8 categories. Canned reports are seed templates stored using the same Designer-based report template format as user-created templates. They are marked `is_system_template = true` and cannot be deleted, but users can duplicate and customize them. All templates are populated via the same report generation engine.

### Alarm Management (9 reports)

| Report | Description | Phase |
|--------|-------------|-------|
| **Alarm Rate Summary** | Average and peak alarm rates per operator position with EEMUA 191 benchmark comparison. Hourly/daily/shift breakdown. | 1 |
| **Top N Bad Actor Alarms** | Most frequently occurring alarms ranked by count. Top 10/20/50 with Pareto chart. Typically top 10-20 alarms account for 25-95% of total load. | 1 |
| **Standing/Stale Alarms** | Alarms continuously active beyond configurable threshold (default 24h). Sorted by duration. Trend of standing count over time. | 1 |
| **Chattering Alarms** | Alarms rapidly cycling between alarm and normal states. Transition counts, average cycle time, recommended actions. | 1 |
| **Alarm Flood Analysis** | Periods exceeding flood threshold (EEMUA 191: >10 alarms/10 min). Flood duration, peak rate, total alarms per flood, trigger events. | 1 |
| **Alarm Priority Distribution** | Actual priority distribution vs. recommended ISA-18.2 pyramid (~5% Critical, ~15% High, ~80% Medium/Low). | 1 |
| **Alarm System Health Summary** | One-page executive summary combining all alarm KPIs with EEMUA classification (Robust/Stable/Reactive/Overloaded). | 1 |
| **Time to Acknowledge** | Distribution of alarm acknowledgment times with percentile markers (median, p90, p95). Breakdown by priority. | 2 |
| **Shelved & Suppressed Alarms** | Currently shelved alarms with auto-unshelve countdown, shelving frequency, compliance with ISA-18.2 shelving time limits. | 2 |

### Process Data (5 reports)

| Report | Description | Phase |
|--------|-------------|-------|
| **Point Value Trend** | Select points + time range, get trend chart with tabular data. Multi-series with statistical summary (min, max, avg, std dev). | 1 |
| **Statistical Summary** | Min, max, average, standard deviation, range for selected points. Aggregated by hour/day/shift/week/month. | 1 |
| **Exceedance Report** | Time duration and percentage a value was above/below a configured threshold. Critical for environmental compliance. | 2 |
| **Data Quality Report** | Data gaps, bad OPC quality periods, stale data, points with persistent quality issues. Worst offenders ranked. | 2 |
| **Period Comparison** | Side-by-side comparison of same points across two time ranges (this week vs. last week, this month vs. same month last year). | 2 |

### Operational Logs (4 reports)

| Report | Description | Phase |
|--------|-------------|-------|
| **Shift Handover Report** | Complete summary of all log entries during a shift, organized by template/segment. Author attribution, open items highlighted. | 1 |
| **Log Compliance Report** | Scheduled vs. completed log instances, completion rate, incomplete entries with missing required fields flagged. | 1 |
| **Log Entry Search** | Full-text search results across log entries for a date range, formatted for investigation/audit documentation. | 2 |
| **Operator Activity Report** | All log entries by a specific operator across all templates in a time range. Grouped by log instance/template. | 2 |

### Rounds & Inspections (4 reports)

| Report | Description | Phase |
|--------|-------------|-------|
| **Round Completion Rate** | Percentage of scheduled rounds completed on time. Breakdown by template, shift, day of week. Industry benchmark: >=85%. | 1 |
| **Overdue Rounds** | Rounds past their due time and not yet completed. Sorted by most overdue. Real-time operational awareness. | 1 |
| **Exception Report** | Checkpoint readings outside expected ranges (alarm thresholds HH/H/L/LL). Sorted by severity then time. Photos if captured. | 1 |
| **Equipment Health Trend** | Historical readings for a specific checkpoint/equipment over time. Shows degradation trends with alarm thresholds and statistical summary. | 2 |

### Equipment & Maintenance (4 reports)

| Report | Description | Phase |
|--------|-------------|-------|
| **Alarm Rationalization Status** | How many alarms are documented/rationalized/approved per ISA-18.2 lifecycle. Unrationalized alarms ranked by annunciation frequency. | 2 |
| **Disabled Alarms Audit** | Permanently suppressed alarms with reason, review date. Alarms disabled >90 days without review flagged. MOC compliance. | 2 |
| **OPC Connection Health** | OPC UA connection uptime, reconnection events, downtime per source, point quality summary per source. | 2 |
| **Missed Readings Report** | Checkpoints skipped within otherwise-completed rounds. Partial completion tracking by template over time. | 2 |

### Environmental & Compliance (3 reports)

| Report | Description | Phase |
|--------|-------------|-------|
| **Environmental Exceedance Summary** | Points that exceeded regulatory thresholds with exceedance duration, max exceedance value, number of events. | 1 |
| **Alert Channel Delivery** | Delivery success rates across alert channels (WebSocket, email, SMS, voice, radio, PA, push). Failed delivery details. | 2 |
| **Escalation Report** | Alert escalation frequency beyond Level 0. Indicates inadequate initial routing or insufficient staffing. | 2 |

### Security & Access (4 reports)

| Report | Description | Phase |
|--------|-------------|-------|
| **Shift Coverage Report** | Scheduled vs. actual shift attendance. Assigned but not badged in, badged in but not assigned. Coverage percentage. | 1 |
| **Muster Event Report** | Full accounting of each emergency muster: trigger, timeline, accounted/unaccounted, per-person detail. OSHA PSM compliance. | 1 |
| **Attendance Report** | Badge-in/badge-out history per person, hours on site per day/week. | 2 |
| **Audit Trail Report** | Complete audit trail for configurable entity or time range. Chronological, filterable, searchable. | 2 |

### Executive & Management (4 reports)

| Report | Description | Phase |
|--------|-------------|-------|
| **Alarm System Health Executive** | Monthly management summary: EEMUA classification, metrics vs. benchmarks, month-over-month trend, top 3 action items. | 1 |
| **Safety Metrics Summary** | Safety event count, emergency alerts, critical alarms, round exceptions, safety-tagged log entries. Trend vs. prior period. | 2 |
| **Operational Summary** | Configurable executive KPI report combining selected widgets. Template customizable per site. | 2 |
| **Shift Schedule Report** | Calendar view of shift assignments for a date range with crew roster per shift. | 1 |

### Shift Operations (1 report)

| Report | Description | Phase |
|--------|-------------|-------|
| **Shift Handover Packet** | Comprehensive end-of-shift bundle designed for printing and handoff to incoming shift. Contents: active alarms (sorted by priority), shelved alarms with unshelve countdown, recent log entries from current shift, current shift roster (on-site status from badge data), critical point summary (points flagged as critical with current value, trend direction, and alarm state). One-click generation from the Reports module or via the shell toolbar Print button. Schedulable at shift-change times for automatic delivery. | 1 |

### Phase Summary

- **Phase 1**: 20 reports (core operational and compliance reports needed for initial deployment)
- **Phase 2**: 18 additional reports (analytical, trend, and advanced audit reports)
- **Total**: 38 canned report templates

## Report Configuration UX

Report configuration uses a **right-side slide-out panel** -- not a wizard, not a modal. The panel opens when a user clicks "Configure" on a report template or creates a new report from template. The left side shows the report description, template preview thumbnail, and recent run history.

### Smart Defaults (3 Tiers)

Every canned report template defines smart defaults at three tiers so reports work with minimal or zero user input:

| Tier | Name | Behavior | Example |
|------|------|----------|---------|
| **Tier 1** | Zero-config | Report works with no user input at all. All parameters have sensible defaults. | "Last 24 Hours Alarm Summary" defaults to all areas, all priorities, last 24h. User clicks "Generate" immediately. |
| **Tier 2** | Sensible | Pre-filled values the user typically adjusts. Visible in the panel. | Date range picker (default "Last 24 Hours"), area filter (default to user's assigned area). |
| **Tier 3** | Advanced | Collapsed/hidden options for power users. Expandable "Advanced" section. | Custom chattering threshold, specific alarm types, custom grouping/sort options. |

### Default Priority Order

1. **Last-used values** (stored per user per template, server-side) -- always wins except for time range
2. **User context** (user's assigned area/unit from profile) -- auto-populates area/unit filters
3. **Template-defined defaults** (set by template author) -- baseline fallback
4. Time range always resets to a relative default (never a stale absolute date)

### Dependent Parameters

Parameter dependencies cascade automatically:
- Selecting an **area** updates available **units** (clears unit selection, reloads options)
- Selecting a **unit** updates available **equipment/points** (clears selection, reloads)
- Loading indicator on dependent fields during fetch
- "All" option available at every level

### Point Selection

For reports requiring point selection (trend reports, statistical summaries):
- **Dual-mode picker**: Tree browser (area → unit → equipment hierarchy) + type-ahead search
- **Quick access tabs**: Recent (last 20 selections), Favorites (user-pinned, server-side)
- Selected points displayed as removable chips, drag-reorderable for column ordering
- Server-side search (not client-side filtering of 10,000+ items)

### Run vs. Schedule

The panel footer provides:
- **"Generate Report"** button with format selector (PDF | HTML | XLSX, with CSV/JSON under "More formats")
- **"Schedule this report"** link expands inline scheduling controls
- **"Open in Designer"** link (for users with `reports:write` permission)
- **"Duplicate as custom"** link (clones template, opens in Designer)

## Report Subscriptions

Users can subscribe to reports for automatic delivery without administrator involvement.

### Self-Service Subscriptions

- Users can self-subscribe to any report they have permission to view via a "Subscribe" button on the report template
- Subscription options:
  - **Frequency**: Daily, weekly, monthly, shift-end, or custom schedule
  - **Format**: PDF, CSV, HTML (per subscriber preference)
  - **Delivery**: In-app notification (always) + optional email attachment/link via Email Service (doc 28)
- Users can unsubscribe at any time without affecting other subscribers
- Subscription parameters inherit from the template defaults but can be customized per subscriber

### Admin-Pushed Subscriptions

- Admins and managers can push report subscriptions to any user or role
- Example: All Shift Supervisors automatically receive Shift Handover Report at shift end
- Pushed subscriptions are visible to the recipient with a "Pushed by [admin]" indicator
- Recipients cannot delete pushed subscriptions but can configure their preferred format

### Permission Scoping

- Generated reports automatically filter data to the viewer's permissions (data categories, site scope, area access)
- A single scheduled report can serve multiple subscribers, each receiving a permission-appropriate view

## Shared Alarm KPI Calculation Layer

Alarm management reports and dashboards (doc 10) share a common backend calculation layer for alarm KPI metrics.

### Shared Calculations

- Alarm rates (per operator position, per interval)
- Standing/stale alarm counts and durations
- Chattering alarm detection and counting
- Flood event identification and duration
- Priority distribution analysis
- Time-to-acknowledge distributions
- EEMUA 191 classification (Robust/Stable/Reactive/Overloaded)

### Built-in Benchmarks

ISA-18.2 and EEMUA 191 benchmark targets are embedded in the calculation layer:

| Metric | Acceptable | Manageable | Overloaded |
|--------|-----------|------------|------------|
| Average alarm rate | <=1 per 10 min | <=6 per hour | >12 per hour |
| Peak alarm rate (10-min) | <=10 alarms | -- | >10 alarms |
| Standing alarms | <10 | -- | >50 |
| Alarm flood (10-min) | <1% of time | -- | >5% of time |

Reports that include alarm metrics automatically color-code values against these benchmarks. This ensures dashboard alarm widgets and report alarm tables always show identical numbers for the same time range and filters.

## Change Log

- **v1.3**: Updated permission table from 3-role column format (User/Power User/Admin) to Default Roles format listing all 8 predefined roles. Renamed `reports:write` to `reports:create` for consistency. Adjusted role assignments per centralized RBAC model (doc 03).
- **v1.2**: Replaced stale `genpdf` references with Typst (`typst-as-lib`, MIT) per doc 01 v2.0. Fixed report count in header from 37 to 38 (Shift Handover Packet added in v1.0).
- **v1.1**: Replaced custom aggregation TBD with concrete references to `bucket_interval` (doc 21) and Expression Builder (doc 23).
- **v1.0**: Added Shift Handover Packet as canned report #38 (Phase 1). Comprehensive end-of-shift bundle: active alarms, shelved alarms, recent log entries, shift roster with on-site status, critical point summary. One-click generation, schedulable at shift change. Phase 1 report count 19→20, total 37→38.
- **v0.9**: Deep dive: 37 canned report templates (19 Phase 1), report config slide-out panel with smart defaults (3 tiers), user self-subscribe + admin push subscriptions, shared alarm KPI calculation layer with ISA-18.2/EEMUA 191 benchmarks. Same elements as Dashboards with page-oriented layout. Expanding elements spec added. Scheduled generation with email delivery via doc 28. Report Viewer section added. Reports module role clarified as browsing/running/scheduling — not template design. API endpoints expanded for schedules and history.
- **v0.7**: Added Permissions section with 5 Reports permissions and role assignments from RBAC model (doc 03).
- **v0.6**: Promoted scheduled reports from "future" to supported — email delivery via Email Service (doc 28) with attachments or download links. Added alert history as a report data source (severity breakdown, response times, escalation frequency, channel reliability). See 27_ALERT_SYSTEM.md and 28_EMAIL_SERVICE.md.
- **v0.5**: Fixed PDF library reference — replaced "wkhtmltopdf or similar" with "genpdf crate (pure Rust, no external dependencies)" per technology stack (01_TECHNOLOGY_STACK.md).
- **v0.4**: Promoted XLSX from "future" to included (shares `rust_xlsxwriter` with Universal Export). Added JSON as report output format. Added "Reports vs Universal Export" section clarifying the distinction between template-driven reports and raw Universal Export. See 25_EXPORT_SYSTEM.md.
- **v0.3**: Added Expression Builder integration for report computed columns. Reports can include calculated columns using saved expressions (23_EXPRESSION_BUILDER.md), evaluated server-side during generation.
- **v0.2**: Added server-side UOM conversion note to report engine. API Gateway converts historical data to requested units before returning results.
- **v0.1**: Added 15-minute aggregate to available resolutions. Added aggregation type awareness section for report column configuration. Added quality filtering note (Good values only). Noted custom aggregation as future/TBD.
