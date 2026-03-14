# Inside/Operations - Forensics Module

## Overview

Forensics is a structured investigation tool that gives engineers and operators a jumpstart when analyzing operational incidents. It surfaces correlations and context so the human investigator gets to the answer faster — it is not an autonomous root cause analysis engine.

An investigation is a narrative document composed of **stages**, each with its own time range and evidence items. The investigator builds a story: what happened, when, in what order, and what data supports each conclusion.

---

## Investigation Model

### Structure

```
Investigation
├── Metadata (name, status, creator, linked entities)
├── Stage 1: "Pressure Buildup" [17:00 - 18:00]
│   ├── Trend: PIC-301, PIC-302, PIC-303
│   ├── Point Detail: PIC-301 (scoped to 17:00-18:00)
│   ├── Correlation results (run within this stage)
│   └── Annotation: "Pressure rising steadily, no alarms yet"
├── Stage 2: "Relief Valve Response" [19:00 - 21:00]
│   ├── Trend: PV-310, PIC-301
│   ├── Alarm list: PIC-301 HH alarm at 19:02
│   └── Annotation: "Operator opened PV-310, pressure dropped"
├── Stage 3: "Cascading Low Pressure" [20:50 - 03:00]
│   ├── Trend: PIC-301, TIC-305, FIC-308, LIC-312, PIC-303
│   ├── Value table: all 5 points at key timestamps
│   ├── Console graphic snapshot at 21:15
│   └── Annotation: "Dropped below safe range at 20:57"
└── Stage 4: "Heater Trip & Shutdown" [02:40 - 09:00]
    ├── Trend: heater points
    ├── Alarm list: all alarms in window
    └── Annotation: "Full plant shutdown initiated at 02:52"
```

Each stage has its own time range. All evidence items within a stage are scoped to that stage's timeline — Point Detail shows alarms and work orders from that time window (not "now"), trends display data within that range, alarm lists filter to that range.

### Investigation Lifecycle

| Status | Meaning | Editable? |
|--------|---------|-----------|
| **Active** | Work in progress | Yes — add/remove stages, evidence, annotations |
| **Closed** | Investigator has finalized findings | No — locked and immutable for audit trail |
| **Cancelled** | Abandoned, kept for record | No — flagged as incomplete |

Closing an investigation creates a frozen snapshot of all evidence (trend data, correlation results, point values, graphic snapshots). The closed investigation is a self-contained record that does not change even if the underlying data is later compressed, archived, or corrected.

### Visibility

- **Private by default** — only the creator can see their investigations
- **Shareable** — creator can share with specific users or roles (same pattern as workspace sharing)
- **Admin override** — users with `forensics:admin` can view all investigations

### Entity Linking

Investigations can optionally be linked to other I/O entities:

- **Log entries**: Link to a specific shift log. On log export/print, the full investigation renders as an embedded appendix section (time range header, correlation results, trend chart images, annotations, change point markers). A hyperlink alone is useless on a printed page.
- **Tickets**: Link to a ticket for traceability ("investigation for MOC-2024-0891")
- **Alarm events**: Link to the triggering alarm ("root cause analysis for HH alarm on FIC-401")
- **Other investigations**: Link related investigations together

Links are bidirectional — the linked entity also shows a reference back to the investigation.

---

## Investigation Entry Points

Investigations can be started from multiple places in the application. All entry points land the user in the Forensics module with context pre-populated.

### From an Alarm Event

**"Investigate Alarm"** in the shared Point Context Menu (see `32_SHARED_UI_COMPONENTS.md`) — available anywhere an alarm is displayed (event list, alarm banner, Point Detail panel, dashboard widget). Pre-populates:
- Anchor point: the alarm's point
- Time range: smart default based on alarm duration (short alarm = tight window, long alarm = wider window, user adjustable)
- First stage created automatically with the alarm event marked

### From a Point (No Active Alarm)

**"Investigate Point"** in the shared Point Context Menu — available anywhere a point value is displayed (Console graphic, Process graphic, dashboard widget, table, chart). Pre-populates:
- Anchor point: the selected point
- Time range: last 24 hours (user adjustable)
- First stage created, user sets the time range from there

### From Forensics Module Direct

Two modes available from the Forensics landing page:

**Alarm search**: Pick a point → system shows historical alarms for that point → select an alarm as the investigation anchor. Aggregation interval selector (raw, 1m, 5m, 15m, 30m) for filtering transient spikes.

**Threshold search**: Pick a point → define a condition (e.g., "value > 300°C", using the point's existing UOM for display) → system shows when the condition was met. Two view modes (toggle in top-right corner):
- **Trend view**: Point trended over configurable lookback (default 30 days) with threshold drawn as a horizontal line. Exceedance periods highlighted as shaded regions. Click any region to anchor an investigation there.
- **List view**: Table of each exceedance (start time, duration, peak value, aggregation interval used). Click any row to anchor.

Both views support aggregation interval selection (raw, 1m, 5m, 15m, 30m) to filter out transient spikes or bad data.

---

## Evidence Toolkit

Each stage contains evidence items. The investigator builds stages by adding items from the toolkit. All evidence items are scoped to their stage's time range.

The toolkit uses the same component library as Designer's Dashboard and Report modes (docs 09, 32) — no new rendering components, just a new context.

### Available Evidence Items

| Item | Description |
|------|-------------|
| **Trend** | One or more points on a shared synchronized chart. Same component as Dashboard/Report trends. |
| **Point Detail** | Point Detail panel (doc 32) scoped to the stage's time range — alarms, work orders, tickets, etc. from that window, not from "now". |
| **Alarm list** | All alarms for selected points within the stage's time range. |
| **Value table** | Point values at key timestamps or at regular intervals within the stage. |
| **Console graphic snapshot** | A Console or Process graphic rendered with historical values at a user-specified timestamp within the stage's time range. "Here's what the operator was looking at at 19:02." |
| **Correlation results** | Output of the correlation engine run against this stage's points and time range (heatmap, ranked list, change points). |
| **Log entries** | Log entries from the stage's time range. |
| **Round entries** | Round readings for points in the investigation from the stage's time range. |
| **Calculated series** | Expression Builder (doc 23) computed series — derived calculations like differential pressure or efficiency metrics. |
| **Annotation** | Free text note. Two types: (A) general note on the stage as a whole, (B) note pinned to a specific timestamp on the timeline. Both manually created by the investigator. |

### Adding Evidence

- **"Add Evidence" button** on each stage opens the toolkit menu
- **Right-click on evidence items**: "Add point to this trend", "Add point to this table" — attach additional points to existing evidence items
- **Right-click on points in the left panel**: "Add trend", "Add Point Detail", "Add to [existing trend name]" — create or extend evidence from the point list

### Graphic Snapshots

When adding a Console/Process graphic to a stage, the investigator picks a specific timestamp within the stage's time range. The system queries historical point values at that timestamp and renders the graphic with those values frozen. The snapshot is stored as part of the investigation — it does not change when live data updates.

The timestamp picker for graphic snapshots uses the shared **Historical Playback Bar** (doc 32) in its simplified Forensics mode — scrub and step controls scoped to the stage's time range, with alarm markers. This lets the investigator scrub through the stage timeline to find the exact moment to capture, rather than typing a timestamp manually. The rendering uses the same historical rendering pipeline as Console/Process playback (doc 19).

---

## Point Curation

When an investigation starts, the correlation engine auto-suggests related points based on the anchor point (see [Correlation Engine](#correlation-engine)). The investigator then curates:

### Adding Points
- **"Add Points" button** in the left panel expands an inline point search/browser (collapsible, same pattern as Console left panel)
- Points can be added from search results, from data link suggestions, or by browsing by area/graphic

### Removing Points
- Right-click a point → "Remove from investigation"
- Prompt for optional removal reason (free text)
- Removed points are **not deleted** — they move to a "Removed Points" section in the left panel (collapsed by default, expandable). Each shows the removal reason if provided.
- Removal is logged in the investigation record

### Data Link Context Badges

Points in the left panel show subtle badges indicating data-link-traversed context exists: "3 work orders", "1 open ticket", etc. After the initial correlation runs, the system asks the investigator if they want to follow linked data paths — they can choose to or not depending on relevance.

### Recent Investigations

The left panel includes a "Recent Investigations" section showing past investigations involving the same point(s). Useful for spotting recurring issues without building a pattern-matching engine — the investigator eyeballs the trends from prior investigations.

---

## UI Layout

```
┌─────────────────────────────────────────────────────────┐
│  Investigation Toolbar                                   │
│  [Name field] [Status badge] [Time range (global ref)]   │
│  [Save] [Lock/Close] [Cancel] [Export] [Print] [Share]   │
├────────────┬────────────────────────────────────────────┤
│            │                                            │
│  Point     │   Main Canvas                              │
│  Selection │   ┌──────────────────────────────────────┐ │
│  Panel     │   │ Stage 1: "Pressure Buildup"          │ │
│            │   │ Timeline: [====17:00====18:00====]    │ │
│ ┌────────┐ │   │                                      │ │
│ │Included│ │   │  [Trend] [Point Detail] [Annotation] │ │
│ │ Points │ │   │  (evidence items for this stage)      │ │
│ ├────────┤ │   └──────────────────────────────────────┘ │
│ │Suggest-│ │   ┌──────────────────────────────────────┐ │
│ │  ed    │ │   │ Stage 2: "Relief Valve Response"     │ │
│ ├────────┤ │   │ Timeline: [====19:00====21:00====]    │ │
│ │Removed │ │   │                                      │ │
│ │(collapd│ │   │  [Trend] [Alarm List] [Annotation]   │ │
│ ├────────┤ │   └──────────────────────────────────────┘ │
│ │Recent  │ │                                            │
│ │Investig│ │   [+ Add Stage]                            │
│ ├────────┤ │                                            │
│ │[Add    │ ├────────────────────────────────────────────┤
│ │Points] │ │  Results Panel (collapsible)               │
│ └────────┘ │  [Heatmap] [Ranked List] [Change Points]   │
│            │  [Spike Detection]                          │
│            │  Tab-switched views of correlation output   │
├────────────┴────────────────────────────────────────────┤
│  (Bottom toolbar: stage navigation, global actions)      │
└─────────────────────────────────────────────────────────┘
```

- **Left panel**: Included points (active in analysis), Suggested points (correlation engine results not yet acted on), Removed points (collapsed, expandable with removal reasons), Recent investigations for these points, Add Points button
- **Center**: Scrollable stage list. Each stage is a collapsible card with its own timeline and evidence items. Evidence items render using the same shared components as Dashboards and Reports.
- **Bottom**: Correlation results panel (collapsible, tabbed). Heatmap, ranked correlation list, change points, spike detection. Results can be run per-stage or across the full investigation.

### Stage Management

- **Add Stage**: Button at the bottom of the stage list. Creates a new stage with a default time range (user sets it).
- **Reorder**: Drag stages to reorder (stages are a narrative sequence, not necessarily chronological — though they usually are).
- **Delete Stage**: Right-click → delete. Confirmation required.
- **Stage Timeline**: Each stage has a draggable time range selector. Evidence within the stage auto-updates when the time range changes.

---

## Correlation Engine

### Purpose

The correlation engine gives investigators a jumpstart by surfacing which points are statistically related to the anchor point within a given time window. It is a tool for the human, not a replacement for human analysis.

### Auto-Expansion Flow

When an investigation starts from an alarm or point:

1. System identifies candidate points using point selection helpers:
   - **By unit/area**: All points sharing the same `area` metadata
   - **By graphic**: All points bound to elements on the same Console/Process graphic (via `design_object_points` table)
   - **By connection**: Points connected via Designer pipe/line elements (topological neighbors)
2. System runs Pearson, Spearman, and FFT cross-correlation across all candidates against the anchor point
3. Results ranked by correlation strength. Top correlations populate the "Suggested" group in the left panel.
4. System asks: "Run correlation for [N] suggested points? Or continue with current selection?"
5. Investigator curates — accepts suggestions, removes irrelevant points, adds known-related points

### Per-Stage vs Investigation-Level Correlation

When the investigator adds the first point to a new stage, the system asks whether to:
- **Re-run correlation** for this stage's time range and point set
- **Continue with existing associations** from the initial correlation

This allows each stage to have its own correlation context when the relevant points or time range differ significantly from the investigation anchor.

### Algorithms

All algorithms run in Rust. No ML required — these are deterministic statistical methods.

#### Pearson Correlation (Phase 1)

Zero-lag linear correlation between point pairs. Output: -1 (perfect inverse) to +1 (perfect positive). Identifies which points move together at the same time.

- Computed via `ndarray-stats` correlation matrix in Rust, or PostgreSQL's built-in `corr()` for simple pre-filtering
- Time alignment via `time_bucket` aggregates (points may not report at exactly the same millisecond)
- Pairwise matrix for N points: N*(N-1)/2 pairs

#### Cross-Correlation with Time Lag (Phase 1)

FFT-based cross-correlation finds cause-and-effect chains. "Point B reacts to Point A with a 45-second lag." Computes correlation at ALL possible lags simultaneously in O(N log N).

- Implementation: `rustfft` / `realfft` crates (~30 lines of code on top of FFT)
- Each point's FFT computed once, reused for all pairs (50 points = 50 FFTs + 1,225 multiplications)
- Maximum lag is configurable (default: +/- 30 minutes for most process data; +/- 4 hours for slow thermal processes)
- Significance threshold: +/- 2/sqrt(N) for 95% confidence against white noise

#### Spearman Rank Correlation (Phase 1)

Non-linear monotonic relationships. Common in process data: valve position vs. flow (butterfly valves have non-linear trim), temperature vs. viscosity (exponential/logarithmic curves). Robust to outliers (a sensor spike at 99999 becomes just "the highest rank").

- Implementation: Sort to get ranks, then Pearson on ranks
- Presented alongside Pearson: if Pearson is low but Spearman is high, the UI highlights "nonlinear relationship detected"

#### Change Point Detection — PELT

Detects when a time series changes behavior — level shifts, variance changes. Answers "when did things start going wrong?"

- Uses the `augurs-changepoint` crate to find the globally optimal number and location of change points
- Not greedy — considers the entire time window and finds the mathematically best set of change points simultaneously
- Runs automatically on every selected point in an investigation
- Parameters: minimum segment length, penalty (controls sensitivity — higher penalty = fewer change points)

#### Spike Detection

Z-score-based outlier detection on each selected point. Flags values that are N standard deviations from the rolling mean within the investigation window. Highlights transient spikes that may indicate instrument issues, process upsets, or data quality problems.

- Rolling window size configurable (default: 30 samples)
- Threshold configurable (default: 3 sigma)
- Results shown as markers on trend charts and in a dedicated "Spike Detection" tab in the results panel

#### Granger Causality (deferred)

Tests directional causality ("does point A help predict point B?"). Deferred — cross-correlation with lag detection covers 80% of the same use case with fewer assumptions and simpler implementation.

### Rust Crate Stack

All crates are MIT or Apache-2.0 — fully compatible with I/O licensing requirements.

```toml
ndarray = "0.16"              # N-dimensional arrays
ndarray-stats = "0.6"         # Correlation matrix computation
rustfft = "6.4"               # FFT engine
realfft = "3.5"               # Real-valued FFT wrapper (2x speedup for real signals)
statrs = "0.17"               # Significance testing (p-values for correlations)
rayon = "1.10"                # Parallel computation across point pairs
augurs-changepoint = "0.7"    # PELT change point detection
```

### Architecture

- **SQL handles data retrieval**: Single query fetches all selected points aligned to the chosen resolution via `time_bucket` aggregates. One database round-trip.
- **Rust handles all computation**: In-memory. No intermediate database writes.
- **Data volume**: Worst case (50 points, 24hrs, 1-minute aggregates) = 50 x 1,440 samples = 72,000 f64 values = ~562 KB. Fits trivially in memory.

### Performance Strategy

**Target**: < 5 seconds for worst-case analysis (50 points, 24-hour window).

**Adaptive resolution** (extends the resolution logic from doc 18):

| Time Window | Resolution Used |
|-------------|----------------|
| <= 1 hour | Raw data (1-second) |
| 1-4 hours | Raw data if <= 20 points, else 1-minute aggregates |
| 4-24 hours | 1-minute aggregates |
| 1-7 days | 5-minute aggregates |
| > 7 days | 15-minute or 1-hour aggregates |

**Parallelization**: FFT cross-correlation for different point pairs is embarrassingly parallel. `rayon` distributes across CPU cores. On a 4-core server, the 50-point computation phase drops from ~2s to ~500ms.

**Result caching**: Results cached for the session keyed on `(sorted_point_ids, time_range, options_hash)` with a 60-second TTL. Same analysis window with different visualizations served from cache.

### Results Presentation

- **Correlation matrix heatmap**: N x N color-coded matrix (shared component from doc 32)
- **Ranked correlation list**: Significant correlations sorted by strength, showing: point pair, correlation coefficient, time lag, direction (positive/negative)
- **One-click trend overlay**: Click a correlation to generate an overlaid trend of the correlated points with synchronized time axes
- **Change points on timeline**: PELT results marked as vertical lines on trend charts
- **Spike markers**: Z-score outliers marked as points/dots on trend charts
- **Context annotations**: Operator-created annotations overlaid on trends for incident narrative

### TimescaleDB Note

TimescaleDB core (Apache 2.0) provides hypertables, continuous aggregates, and compression — used for time-series storage and adaptive resolution queries. TimescaleDB Toolkit (TSL license) is NOT used — all statistical computation (correlation, cross-correlation, change point detection) runs in Rust using MIT/Apache-2.0 crates. This avoids any non-standard licensing dependencies.

---

## Calculated Analysis Series

- Investigation stages gain an **"Add Calculated Series"** option in the evidence toolkit
- Selecting "Add Calculated Series" opens the Expression Builder (23_EXPRESSION_BUILDER.md) with `context="calculated_value"`
- On apply: adds a computed data series to the stage, rendered alongside raw point series on trends
- Useful for creating derived calculations from multiple points during investigation (e.g., differential pressure, heat balance, efficiency metrics)
- Calculated series are scoped to the stage's time range like all other evidence

---

## Versioned Metadata

- Query point metadata as it existed at any point in time via `get_effective_point_metadata()`
- Supports forensic questions like "what were this point's engineering units or description at the time of an incident?"
- Uses `points_metadata_versions` table for full metadata change history
- Versioned metadata is available within Point Detail when opened from a Forensics stage — Point Detail shows metadata as it was during the stage's time range

---

## Export, Print, and Embedding

### Standalone Export

Investigations can be exported in all standard I/O formats (CSV, XLSX, JSON, PDF, HTML). The export captures the full investigation:
- Investigation metadata (name, status, creator, dates)
- Each stage with its time range, evidence items, and annotations
- Trend charts rendered as images (PDF/HTML)
- Correlation results as tables
- Point values as data tables
- Graphic snapshots as images

Shares export libraries with Universal Export (doc 25).

### Print

Investigations support the same print infrastructure as the rest of the app (doc 06 print color normalization, doc 25 page sizes and watermark). The printed investigation renders as a structured document: cover page with investigation metadata, then each stage as a section with its evidence.

### Embedding in Log Entries

When an investigation is linked to a shift log entry, exporting or printing that log entry includes the investigation as an embedded appendix section. The investigation renders inline — not as a hyperlink (useless on paper). Content: stage headers with time ranges, trend chart images, correlation result tables, annotations, and graphic snapshots.

### Forensics vs Universal Export

Forensics retains its own investigation-based export. Universal Export (doc 25) provides raw data dumps from any table/widget. They serve different purposes:
- **Forensics Export**: Structured investigation with stages, narrative, correlation context, and annotations
- **Universal Export**: Raw rows and columns for ad hoc data extraction

---

## User Stories

1. **As an engineer**, I want to right-click an alarm and start an investigation, so I can immediately begin root cause analysis with relevant context pre-loaded.

2. **As a shift supervisor**, I want to save an investigation and return to it tomorrow, so I can continue analysis across multiple sessions.

3. **As an engineer**, I want to build a multi-stage investigation showing the progression of an incident, so I can present a clear narrative to management.

4. **As a specialist**, I want the system to auto-suggest correlated points when I start an investigation, so I get a jumpstart on identifying related variables.

5. **As a manager**, I want to search for past investigations involving the same point, so I can identify recurring issues.

6. **As an engineer**, I want to attach my investigation to a shift log entry, so the analysis is embedded in the operational record.

7. **As an operator**, I want to search for times a point exceeded a threshold, so I can find the specific incident I want to investigate.

8. **As an engineer**, I want to add a Console graphic snapshot to my investigation showing what the operator saw at the time of the incident, so I have visual evidence alongside data.

---

## Technical Requirements

### Query Performance
- Complex queries < 5 seconds
- Use database indexes effectively
- Limit result sets (max 10,000 records)
- Progress indication for long queries
- UOM conversion performed server-side: API Gateway converts historical data to the requested unit before returning results

### Visualization
- Time-series charts with multiple series (shared components from doc 32)
- Event markers on timeline
- Zoom/pan for time exploration within stages
- Synchronized cursors across evidence items within a stage

### Aggregation Type Awareness
- When adding points to correlation or analysis, only offer aggregate functions permitted by the point's `aggregation_types`
- Rolling averages are a key forensic tool for smoothing data and identifying trends; available when point permits averaging
- All aggregate and historical data includes only `Good` OPC UA quality values by default
- Raw data (including all quality levels) remains available for forensic investigation when quality analysis is the goal
- `min`, `max`, and `count` are always available for all points

---

## API Endpoints

### Investigations
- `GET /api/forensics/investigations` — List investigations (own; admin: all with filter)
- `POST /api/forensics/investigations` — Create investigation (from alarm, point, or threshold search)
- `GET /api/forensics/investigations/:id` — Get investigation with all stages and evidence
- `PUT /api/forensics/investigations/:id` — Update investigation metadata (name, linked entities)
- `PUT /api/forensics/investigations/:id/close` — Close and lock investigation (creates frozen snapshot)
- `PUT /api/forensics/investigations/:id/cancel` — Cancel investigation
- `POST /api/forensics/investigations/:id/share` — Share with users/roles
- `DELETE /api/forensics/investigations/:id` — Delete (active only; closed investigations cannot be deleted)

### Stages
- `POST /api/forensics/investigations/:id/stages` — Add stage
- `PUT /api/forensics/investigations/:id/stages/:stageId` — Update stage (name, time range, order)
- `DELETE /api/forensics/investigations/:id/stages/:stageId` — Delete stage

### Evidence
- `POST /api/forensics/investigations/:id/stages/:stageId/evidence` — Add evidence item to stage
- `PUT /api/forensics/investigations/:id/stages/:stageId/evidence/:evidenceId` — Update evidence item
- `DELETE /api/forensics/investigations/:id/stages/:stageId/evidence/:evidenceId` — Remove evidence item

### Point Curation
- `POST /api/forensics/investigations/:id/points` — Add points to investigation
- `DELETE /api/forensics/investigations/:id/points/:pointId` — Remove point (with optional reason)

### Analysis
- `POST /api/forensics/correlate` — Run correlation analysis (point IDs, time range, algorithm options)
- `POST /api/forensics/threshold-search` — Search for threshold exceedances (point ID, condition, lookback, aggregation interval)
- `POST /api/forensics/alarm-search` — Search historical alarms for a point

### Export
- `POST /api/forensics/investigations/:id/export` — Export investigation (format, options)
- `GET /api/forensics/investigations/:id/snapshot` — Get frozen snapshot of closed investigation

### Graphic Snapshots
- `POST /api/forensics/graphic-snapshot` — Render a graphic with historical values at a specified timestamp

---

## Database Schema Additions

```sql
CREATE TABLE investigations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(500) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'closed', 'cancelled')),
    anchor_point_id UUID,
    anchor_alarm_id UUID,
    snapshot JSONB,  -- frozen evidence data on close
    created_by UUID NOT NULL REFERENCES users(id),
    closed_at TIMESTAMPTZ,
    closed_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE TABLE investigation_stages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    investigation_id UUID NOT NULL REFERENCES investigations(id) ON DELETE CASCADE,
    name VARCHAR(500) NOT NULL,
    sort_order SMALLINT NOT NULL DEFAULT 0,
    time_range_start TIMESTAMPTZ NOT NULL,
    time_range_end TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE investigation_evidence (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stage_id UUID NOT NULL REFERENCES investigation_stages(id) ON DELETE CASCADE,
    evidence_type VARCHAR(50) NOT NULL
        CHECK (evidence_type IN ('trend', 'point_detail', 'alarm_list', 'value_table',
            'graphic_snapshot', 'correlation', 'log_entries', 'round_entries',
            'calculated_series', 'annotation')),
    config JSONB NOT NULL,  -- type-specific configuration (point IDs, graphic ID, timestamp, text, etc.)
    sort_order SMALLINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE investigation_points (
    investigation_id UUID NOT NULL REFERENCES investigations(id) ON DELETE CASCADE,
    point_id UUID NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'included'
        CHECK (status IN ('included', 'suggested', 'removed')),
    removal_reason TEXT,
    added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    removed_at TIMESTAMPTZ,
    PRIMARY KEY (investigation_id, point_id)
);

CREATE TABLE investigation_shares (
    investigation_id UUID NOT NULL REFERENCES investigations(id) ON DELETE CASCADE,
    shared_with_user_id UUID REFERENCES users(id),
    shared_with_role VARCHAR(100),
    shared_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    shared_by UUID NOT NULL REFERENCES users(id)
);

CREATE TABLE investigation_links (
    investigation_id UUID NOT NULL REFERENCES investigations(id) ON DELETE CASCADE,
    linked_entity_type VARCHAR(50) NOT NULL
        CHECK (linked_entity_type IN ('log_entry', 'ticket', 'alarm_event', 'investigation')),
    linked_entity_id UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID NOT NULL REFERENCES users(id),
    PRIMARY KEY (investigation_id, linked_entity_type, linked_entity_id)
);
```

These tables should be added to `04_DATABASE_DESIGN.md` in the next schema update.

> **Note:** The `point_module_links` and `point_external_links` tables previously referenced in this document are superseded by the Data Links system (doc 24) and the investigation-specific `investigation_points` and `investigation_links` tables above. The pending design proposal in `.claude/agent-output/point-model-external-links.md` is no longer needed.

---

## Success Criteria

- Investigators can create, save, and return to investigations across sessions
- Multi-stage investigations with per-stage time ranges render correctly
- All evidence types (trend, Point Detail, alarm list, value table, graphic snapshot, correlation, annotation) render within stages scoped to the stage's time range
- Correlation engine auto-suggests related points within 5 seconds
- Spike detection flags outliers on trend charts
- Threshold search and alarm search provide usable investigation entry points
- Investigations can be closed/locked as immutable records
- Closed investigations export as self-contained documents (PDF, XLSX, HTML)
- Investigations embed correctly in log entry exports/prints
- Entity linking (log, ticket, alarm, investigation) works bidirectionally
- Point curation (add, remove with reason, view removed) tracks investigator decisions
- Recent investigations for the same points are discoverable
- Queries complete in reasonable time (< 5s)
- Forensic analysis respects point aggregation type constraints
- Raw data (all quality levels) accessible for quality-focused investigation

---

## Permissions

| Permission | Description |
|---|---|
| `forensics:read` | Access forensics module, view own and shared investigations |
| `forensics:search` | Perform threshold search, alarm search, and correlation analysis |
| `forensics:write` | Create, edit, close, and cancel investigations |
| `forensics:share` | Share investigations with other users |
| `forensics:export` | Export forensic investigation results |
| `forensics:admin` | View all investigations, forensics module administration |

---

## Change Log

- **v1.1**: Promoted PELT change point detection from Phase 2 to v1, replacing CUSUM as the primary change point algorithm. PELT finds globally optimal change points (not greedy). CUSUM removed from Forensics — may be reused for real-time alerting in future. Moved `augurs-changepoint` crate to main dependency list. Granger Causality remains deferred.
- **v1.0**: Graphic snapshot timestamp picker now uses the shared Historical Playback Bar (doc 32) in Forensics mode — scrub and step controls scoped to the stage's time range with alarm markers. Same historical rendering pipeline as Console/Process playback (doc 19).
- **v0.9**: Updated investigation entry points (From Alarm, From Point) to reference the shared Point Context Menu (doc 32) instead of defining standalone right-click items. "Investigate Alarm" and "Investigate Point" are now standard items in the app-wide context menu.
- **v0.8**: Major rewrite — investigation lifecycle model. Investigations are structured narratives composed of stages, each with its own time range and evidence items scoped to that timeline. Evidence toolkit (trend, Point Detail, alarm list, value table, graphic snapshot, correlation, log entries, round entries, calculated series, annotation) reuses shared Dashboard/Report components. Investigation states (active/closed/cancelled) with close-to-lock immutability. Entity linking to logs, tickets, alarms, and other investigations — linked investigations embed as appendix in log exports/prints. Point curation workflow (add/remove with reasons, suggested/included/removed states, data link context badges). Multiple entry points (right-click alarm, right-click point, threshold search with trend/list toggle, alarm search). Per-stage correlation with re-run option. Spike detection (Z-score outliers). Replaced Point Dossier with Data Links integration (doc 24) and time-scoped Point Detail (doc 32). Renamed "Pattern Detection" to analysis capabilities consolidated under Correlation Engine. Full UI layout wireframe. Investigation database schema (6 tables). Expanded API from 4 to 20+ endpoints. Permissions expanded from 4 to 6 (added `forensics:write`, `forensics:share`). New user stories reflecting investigation workflow.
- **v0.7**: Added correlation engine specification -- Pearson, cross-correlation with time lag (FFT-based), Spearman rank, CUSUM change point detection (Phase 1), PELT (Phase 2). Rust crate stack (ndarray-stats, rustfft/realfft, statrs, rayon, augurs-changepoint). Investigation workflow with point selection helpers. Adaptive resolution strategy. Results presentation (heatmap, ranked list, one-click trend overlay). TimescaleDB Toolkit licensing note.
- **v0.6**: Added Permissions section with 4 Forensics permissions and role assignments from RBAC model (doc 03).
- **v0.5**: Added note that `point_module_links` and `point_external_links` tables are pending integration into canonical schema (04_DATABASE_DESIGN.md).
- **v0.4**: Added XLSX, JSON, PDF formats to Forensics results export (shares libraries with Universal Export). Added "Forensics vs Universal Export" section clarifying the distinction. See 25_EXPORT_SYSTEM.md.
- **v0.3**: Added Expression Builder integration for calculated analysis series. Forensics workspace supports computed series via saved expressions (23_EXPRESSION_BUILDER.md).
- **v0.2**: Added versioned metadata forensics via `get_effective_point_metadata()`. Added point dossier (unified timeline from `point_module_links` and `point_external_links`). Added server-side UOM conversion for historical investigation queries.
- **v0.1**: Added rolling averages to algorithms section. Added aggregation type awareness section. Added note on quality filtering (Good values for aggregates, all quality levels available for raw forensic analysis). Noted custom aggregation as future/TBD.
