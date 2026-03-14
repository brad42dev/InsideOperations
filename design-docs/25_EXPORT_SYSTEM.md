# Inside/Operations - Universal Export, Admin Bulk Update & Change Snapshots

## 1. Overview

The Export System provides three interconnected capabilities that give users and administrators control over getting data out of Inside/Operations, modifying configuration in bulk, and safely reverting changes.

### 1.1 Universal Export

Universal Export adds raw data export capability to every module in the application. Wherever data is displayed in a table, widget, or graphic, users can export it to a file. The export inherits the current view's filters, sort order, and visible columns -- what you see is what you get.

This is **not** a replacement for the Reports module (doc 11) or Forensics export (doc 12). Those systems produce refined, formatted, template-driven output. Universal Export produces raw data dumps for ad hoc analysis. The distinction:

| | Universal Export | Reports Module | Forensics Export |
|---|---|---|---|
| **Purpose** | Raw data extraction | Formatted analytical reports | Investigation analysis |
| **Trigger** | User clicks Export on any table/widget | On-demand or scheduled | From analysis session |
| **Scope** | Current view (with filters) | Template-defined query | Correlation results |
| **Formatting** | None -- raw rows and columns | Headers, grouping, computed columns | Session context |
| **Templates** | No | Yes | Investigation sessions |
| **Aggregation** | No | Yes | Yes |

### 1.2 Admin Bulk Update

Bulk Update is a round-trip workflow for administrators to modify configuration data at scale. The admin downloads a populated template (CSV or XLSX) containing current values, modifies it in Excel or another tool, and reimports it. The system validates every change, shows a field-level diff preview, and applies changes only after explicit confirmation.

Bulk Update lives in the **API Gateway** (Port 3000), not the Import Service (Port 3006). This is a deliberate architectural decision:
- Bulk updates are admin-initiated and need responsive feedback (not queued behind batch imports)
- The API Gateway already has access to all configuration tables and authorization middleware
- Different QoS profile than the Import Service, which handles scheduled external data ingestion

Administrators can bulk-edit almost anything in the system **except**:
- Time-series data (immutable historical record)
- Events (immutable operational record)
- Audit logs (immutable and indefinite by design)
- System logs (immutable operational record)

### 1.3 Change Snapshots

Before any bulk update is applied, the system automatically creates a point-in-time snapshot of the affected data. Admins can also create manual snapshots at any time. Snapshots support both full rollback and selective record restore, with a "what will change" preview before any restoration is executed.

Snapshots are **point-in-time copies**, not running change logs. They capture the state of configuration data at a specific moment. Restoration always creates its own snapshot before applying, so you can undo a restore.

### 1.4 Summary

```
Capability          Who         Where          QoS         Data Flow
─────────────────── ─────────── ────────────── ─────────── ──────────────────────────────────
Universal Export    Any user    Every module   API Gateway DB → File → User download
Admin Bulk Update   Admin       Settings       API Gateway DB → Template → User → Modified → DB
Change Snapshots    Admin       Settings       API Gateway DB → Snapshot → (optional restore) → DB
```

---

## 2. Architecture

### 2.1 Service Placement

All three capabilities are handled by the **API Gateway** (Port 3000). No new service is required. The API Gateway already manages authentication, authorization, and access to all database tables.

```
                                  ┌─────────────────────────────────────────────┐
                                  │              API Gateway (3000)              │
                                  │                                             │
                                  │  ┌──────────────┐  ┌──────────────────────┐ │
  Browser ──── HTTPS ────────────>│  │  Export       │  │  Bulk Update         │ │
                                  │  │  Endpoints    │  │  Endpoints           │ │
                                  │  └──────┬───────┘  └──────────┬───────────┘ │
                                  │         │                     │             │
                                  │  ┌──────▼─────────────────────▼───────────┐ │
                                  │  │           Job Queue (PostgreSQL)        │ │
                                  │  │    export_jobs table + NOTIFY/LISTEN    │ │
                                  │  └──────┬─────────────────────────────────┘ │
                                  │         │                                   │
                                  │  ┌──────▼─────────────────────────────────┐ │
                                  │  │         Worker Pool (Tokio tasks)       │ │
                                  │  │  Max concurrent: 3 (configurable)      │ │
                                  │  │  Per-user limit: 5 active jobs         │ │
                                  │  └──────┬──────────────┬──────────────────┘ │
                                  │         │              │                    │
                                  │  ┌──────▼──────┐ ┌────▼────────────┐       │
                                  │  │ File Writer  │ │ DB Writer       │       │
                                  │  │ (CSV/XLSX/   │ │ (bulk update    │       │
                                  │  │  PDF/JSON/   │ │  apply +        │       │
                                  │  │  Parquet/    │ │  snapshot)      │       │
                                  │  │  HTML)       │ │                 │       │
                                  │  └──────┬──────┘ └─────────────────┘       │
                                  │         │                                   │
                                  └─────────┼───────────────────────────────────┘
                                            │
                                  ┌─────────▼───────────────┐
                                  │  Export File Storage     │
                                  │  /opt/insideoperations/  │
                                  │  exports/                │
                                  │  (auto-cleanup: 24h)     │
                                  └─────────────────────────┘
```

### 2.2 Sync vs Async Pipeline

Export jobs follow a dual path depending on the estimated result size:

```
POST /api/exports
    │
    ├── rows < 50,000: Synchronous
    │   │
    │   ├── CSV/JSON: Stream directly to HTTP response (no temp file)
    │   ├── XLSX/PDF/Parquet/HTML: Generate to temp file → stream response
    │   │
    │   └── Client receives file immediately
    │
    └── rows >= 50,000: Asynchronous
        │
        ├── Return 202 Accepted with job ID
        ├── Worker generates file in background
        ├── Update export_jobs.status → 'completed'
        ├── Send WebSocket notification to user
        │
        └── User downloads from My Exports page
```

### 2.3 Notification Path

When an async export completes:

1. Worker updates `export_jobs.status` to `'completed'`
2. Worker issues `NOTIFY export_complete, '{"job_id": "...", "user_id": "..."}'`
3. Data Broker (Port 3001) receives NOTIFY, routes to user's WebSocket session(s)
4. Frontend displays toast notification with download link
5. If `notify_email = true`: send email notification via the Email Service (doc 28) using the `export_complete` template, with download link

### 2.4 File Storage

Export files are written to a configurable directory (default `/opt/insideoperations/exports/`). Files are named `{job_id}.{ext}` (e.g., `a1b2c3d4-5678-90ab-cdef-1234567890ab.xlsx`). A scheduled cleanup task runs hourly, deleting export files older than the retention period (default 24 hours). Snapshot data is stored in PostgreSQL (not as files) and has indefinite retention.

---

## 3. Export Formats

### 3.1 Supported Formats

| Format | Library | License | MIME Type | Streaming | Use Case |
|---|---|---|---|---|---|
| CSV | `csv` | MIT/Unlicense | `text/csv; charset=utf-8` | Yes | Universal interchange, spreadsheet import |
| XLSX | `rust_xlsxwriter` | MIT/Apache-2.0 | `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` | No (temp file) | Excel analysis, formatted tables |
| PDF | `typst` (via `typst-as-lib`) | MIT | `application/pdf` | No (temp file) | Printable documents, graphics snapshots |
| JSON | `serde_json` | MIT/Apache-2.0 | `application/json; charset=utf-8` | Yes | API integration, programmatic consumption |
| Parquet | `parquet` (arrow-rs) | Apache-2.0 | `application/vnd.apache.parquet` | No (temp file) | Large-dataset analytics, data science tools |
| HTML | Built-in (Axum) | N/A | `text/html; charset=utf-8` | Yes | Browser viewing, email embedding, graphics |

### 3.2 Format Details

**CSV**
- Delimiter: comma (default), configurable to tab or semicolon
- Encoding: UTF-8 with optional BOM for Excel compatibility
- Quoting: necessary fields only (default), configurable to always-quote
- Header row always included
- Serde serialization for type-safe row writing

**XLSX**
- Constant memory mode via `rust_xlsxwriter` for large exports (row-by-row flushing to temp file)
- Sheet naming from `{module}_{entity}` (e.g., "settings_points")
- Header row: bold, freeze pane below header
- Column auto-width based on content
- Data type formatting: numbers as numeric, timestamps as Excel datetime, booleans as TRUE/FALSE
- Serde integration for direct struct serialization

**PDF**
- Generated via `typst` (MIT, via `typst-as-lib`) — modern typesetting engine compiled as a Rust library
- Typst templates define layout, branding, headers/footers — shared across Reports, Log, and Export modules
- Table layout with automatic page breaks, repeated headers, and proportional column widths
- Page header: "Inside/Operations - {entity} Export" (customizable via template)
- Page footer: page number, export timestamp
- Page orientation: landscape if > 5 columns, portrait otherwise
- For graphics export: SVG rendered to embedded image at configurable DPI
- Supports branded templates with logo, custom fonts, and consistent styling across all PDF output

**PDF Print Enhancements** (available when generating via the Print button — see doc 06):

Page sizes:

| Size | Dimensions | Use Case |
|------|-----------|----------|
| Letter | 8.5 × 11 in | Standard US paper |
| A4 | 210 × 297 mm | Standard international paper |
| Ledger / Tabloid | 11 × 17 in | Larger tables, two-page spreads |
| A3 | 297 × 420 mm | Large tables, graphics reference prints |
| A1 | 594 × 841 mm | Wall-mounted process graphics (plotter output) |

Watermark system:

- Default watermark text: **"UNCONTROLLED COPY"** — light gray diagonal text behind content on every page
- Configurable via Settings > General: watermark text (freeform), enable/disable, opacity (default 10%)
- Per-print override: users can toggle the watermark off for a specific print job in the print dialog
- Rationale: regulated industrial environments require printed process documents to be marked as uncontrolled copies unless they are part of a formal document management system

Graphics print formats (Console/Process Print button only):

| Format | Description |
|--------|-------------|
| **Wall Mount** | Large page size (A3/A1/Tabloid), minimal margins, graphic fills page. Optional title bar at top with graphic name and print timestamp. Designed for posting in control rooms and field locations. |
| **Reference** | Standard page size, border, title block (graphic name, site, print date, printed by), legend showing alarm color meanings, point value table below graphic. Designed for binders and desk reference. |

Both formats apply the same print color normalization as browser print (doc 06): white background, dark text, semantic colors preserved. The "Match screen appearance" option is available for both.

**JSON**
- Array of objects format: `[{"tagname": "TI-101", "value": 72.5}, ...]`
- ISO 8601 timestamps (`2026-02-22T14:30:00Z`)
- `null` for missing/empty values
- Pretty-print (default) or compact (configurable)
- Streaming: write `[`, serialize records individually with commas, write `]`

**Parquet**
- Column types mapped from PostgreSQL: `TEXT` → `Utf8`, `FLOAT8` → `Float64`, `TIMESTAMPTZ` → `TimestampMicrosecond`, `BOOLEAN` → `Boolean`, `INTEGER` → `Int32`, `UUID` → `Utf8`, `JSONB` → `Utf8`
- Compression: Snappy (default), Zstd available for maximum compression
- Row group size: 10,000 rows
- Schema embedded in file (self-describing)
- Ideal for import into Python/pandas, Spark, DuckDB, Jupyter notebooks

**HTML**
- Self-contained HTML with inline CSS (no external stylesheet dependencies)
- Responsive table with `<thead>` and `<tbody>`
- Sortable columns via embedded minimal JavaScript (optional)
- For graphics export: inline SVG with frozen point values
- Suitable for email embedding or browser viewing

### 3.3 Content-Disposition Headers

All export responses include:
- `Content-Disposition: attachment; filename="{descriptive_name}.{ext}"`
- `Content-Type` set per format (see table above)
- `Content-Length` when file size is known (non-streaming responses)

Filename convention: `{module}_{entity}_{YYYY-MM-DD_HHmm}.{ext}`
Example: `settings_points_2026-02-22_1430.csv`

### 3.4 ExportFormatter Trait

```rust
use async_trait::async_trait;

pub struct ExportColumn {
    pub name: String,
    pub display_name: String,
    pub data_type: ExportDataType,
}

pub enum ExportDataType {
    Text,
    Integer,
    Float,
    Boolean,
    Timestamp,
    Json,
    Uuid,
}

pub struct ExportRow {
    pub values: Vec<Option<serde_json::Value>>,
}

#[async_trait]
pub trait ExportFormatter: Send + Sync {
    fn format_name(&self) -> &str;
    fn content_type(&self) -> &str;
    fn file_extension(&self) -> &str;
    fn supports_streaming(&self) -> bool;

    /// Initialize the formatter with column definitions
    async fn begin(&mut self, columns: &[ExportColumn]) -> Result<()>;

    /// Write a batch of rows (called repeatedly for large datasets)
    async fn write_rows(&mut self, rows: &[ExportRow]) -> Result<()>;

    /// Finalize and return the output (file path for temp-file formats, bytes for streaming)
    async fn finalize(&mut self) -> Result<ExportOutput>;
}

pub enum ExportOutput {
    /// Streamable bytes (CSV, JSON, HTML)
    Bytes(Vec<u8>),
    /// Path to generated temp file (XLSX, PDF, Parquet)
    FilePath(std::path::PathBuf),
}
```

---

## 4. Export Dialog UX

### 4.1 Button Placement

Export buttons appear in two locations throughout the application:

**Table Toolbar** -- Every data table has an Export button in its toolbar:

```
┌──────────────────────────────────────────────────────────────────────┐
│  [ Filter v ]  [ Search...                ]  [ Columns ]  [Export v]│
├──────────────────────────────────────────────────────────────────────┤
│  Tag Name    │ Description        │ Area    │ Criticality │ Active  │
│  TI-101      │ Reactor Inlet Temp │ Unit 1  │ High        │ true    │
│  PI-201      │ Feed Pressure      │ Unit 2  │ Medium      │ true    │
│  ...         │ ...                │ ...     │ ...         │ ...     │
└──────────────────────────────────────────────────────────────────────┘
```

The `[Export v]` is a split button:
- **Left click**: Opens the full Export Dialog
- **Dropdown arrow**: Quick-format picker (CSV, XLSX, PDF, JSON, Parquet) that exports immediately with current settings

**Dashboard Widget Kebab Menu** -- Each dashboard widget has an export option in its three-dot menu:

```
┌─────────────────────────────────────────────┐
│  Pump Temperature Trend           [ ··· ]   │
│                                    ┌──────┐ │
│   /\    /\                         │ Edit │ │
│  /  \  /  \  ___                   │ ────── │
│ /    \/    \/                      │Export │ │
│                                    │ Share │ │
│                                    └──────┘ │
└─────────────────────────────────────────────┘
```

### 4.2 Export Dialog

When a user clicks Export, the following dialog appears:

```
╔══════════════════════════════════════════════════════════════════╗
║  Export Data                                              [ X ] ║
╠══════════════════════════════════════════════════════════════════╣
║                                                                 ║
║  Source: Points Table (Settings > Points)                       ║
║  Rows matching current filters: 2,847 of 12,450 total          ║
║                                                                 ║
║  SCOPE ─────────────────────────────────────────────────────    ║
║  (●) Current filtered view (2,847 rows)                         ║
║  ( ) All data (12,450 rows)                                     ║
║                                                                 ║
║  FORMAT ────────────────────────────────────────────────────    ║
║  [ CSV  v ]                                                     ║
║                                                                 ║
║  COLUMNS ──────────────────────────────────── [ Select All ]    ║
║  [x] Tag Name       [x] Description      [x] Eng. Units        ║
║  [x] Area           [x] Criticality      [ ] GPS Latitude      ║
║  [ ] GPS Longitude  [x] Active           [ ] Notes              ║
║  [x] Barcode        [ ] Write Frequency  [ ] Aggregation Types  ║
║                                                                 ║
║  PREVIEW (first 5 rows) ───────────────────────────────────    ║
║  ┌──────────┬──────────────────┬───────┬───────┬────────┐       ║
║  │ Tag Name │ Description      │ Units │ Area  │ Active │       ║
║  ├──────────┼──────────────────┼───────┼───────┼────────┤       ║
║  │ TI-101   │ Reactor Inlet T  │ degF  │ Unit1 │ true   │       ║
║  │ PI-201   │ Feed Pressure    │ psig  │ Unit2 │ true   │       ║
║  │ FI-301   │ Feed Flow Rate   │ GPM   │ Unit1 │ true   │       ║
║  └──────────┴──────────────────┴───────┴───────┴────────┘       ║
║                                                                 ║
║  [ Cancel ]                            [ Export 2,847 rows ]    ║
╚══════════════════════════════════════════════════════════════════╝
```

### 4.3 Dialog Behavior

**Filter Inheritance**: The dialog pre-populates with the current view's state:
- Scope defaults to "Current filtered view" (what the user sees)
- Column checkboxes default to currently visible columns
- Sort order carries through to the exported file

**Column Picker**: Checkboxes for every available column. Select All / Deselect All buttons. Forbidden fields (password hashes, connection secrets) never appear in the column list regardless of user role. Restricted fields only appear for users with the appropriate admin permission.

**Row Count**: Displayed prominently in the header and on the Export button. This signals to the user whether the export will be small (sync) or large (async).

**Preview**: First 5 rows of the export with selected columns, refreshed when scope or columns change. Catches mistakes cheaply before committing.

**Threshold Logic**:
- If estimated rows < 50,000: The Export button triggers a synchronous download. Button shows progress: `[ Exporting... 67% ]` then `[ Exported! ]` briefly, then reverts.
- If estimated rows >= 50,000: Button text changes to `[ Start Export ]`. Clicking shows a confirmation: "This export contains ~142,000 rows and will be generated in the background. You'll be notified when it's ready." The job appears in My Exports.

**Format-Specific Options** (shown when relevant):
- CSV: Delimiter (comma/tab/semicolon), UTF-8 BOM for Excel
- XLSX: Include metadata sheet with filter summary
- PDF: Page orientation (portrait/landscape), page size (Letter/A4/A3/Tabloid/A1), watermark toggle
- JSON: Pretty-print or compact
- Parquet: Compression (Snappy/Zstd)

---

## 5. Graphics Export

### 5.1 Scope

Console and Process modules display rendered SVG graphics with bound point data. Exporting from these modules requires special handling because the "data" includes both visual graphics and underlying point values.

### 5.2 Export Modes

When a user exports from a graphics pane (Console workspace pane or Process view), the export dialog includes an additional **Content** section:

```
CONTENT ──────────────────────────────────────────────────────
( ) Graphics only       -- Rendered graphic with current values
(●) Graphics + data     -- Graphic image followed by point data table
( ) Data only           -- Point data table (no graphic image)
```

**Graphics only** (PDF and HTML only):
- Renders the SVG graphic at the current zoom/viewport state
- Point values are frozen at the moment of export
- PDF: SVG rendered to embedded image. DPI configurable (72, 150, 300). Page auto-fit.
- HTML: Inline `<svg>` element with frozen text values

**Graphics + data** (PDF and HTML only):
- First page(s): rendered graphic image
- Following pages/section: data table listing all bound points with columns: Tag Name, Value, Quality, Timestamp, Engineering Units
- PDF: graphic on page 1, data table from page 2
- HTML: graphic element above data table

**Data only** (all formats):
- Table export of all bound points in the graphic/pane
- Columns: Tag Name, Value, Quality, Timestamp, Engineering Units, Description
- No graphic rendering
- Available in CSV, XLSX, PDF, JSON, Parquet, HTML

### 5.3 Format Restrictions

| Format | Graphics Only | Graphics + Data | Data Only |
|---|---|---|---|
| CSV | -- | -- | Yes |
| XLSX | -- | -- | Yes |
| PDF | Yes | Yes | Yes |
| JSON | -- | -- | Yes |
| Parquet | -- | -- | Yes |
| HTML | Yes | Yes | Yes |

Graphics rendering is only available for PDF and HTML formats. CSV, XLSX, JSON, and Parquet are data-only formats by nature.

### 5.4 Native Graphic Interchange (.iographic)

In addition to rendered export (PDF/HTML with frozen values), I/O supports native graphic interchange via the `.iographic` format. This exports the full editable graphic definition — SVG content, point bindings (tag-name based for portability), shape references, pipe routing, layer definitions, and annotations — as a portable package that can be imported into any I/O instance.

This is distinct from the rendered export described above:
- **Rendered export** (PDF/HTML): snapshot of the graphic with frozen point values at export time. For viewing/printing.
- **Native export** (.iographic): complete editable definition. For transferring graphics between I/O instances or creating backups of individual graphics.

See doc 39 (.iographic Format Specification) for the complete format, import wizard, and point tag resolution workflow.

---

## 6. Per-Module Exportable Data

### 6.1 Module Export Inventory

#### Console Module (Doc 07)

| Exportable Entity | Formats | Key Columns | Notes |
|---|---|---|---|
| Bound point data (per pane) | All 6 | tagname, value, quality, timestamp, eng_units | Snapshot of live values at export time |
| Bound point data (per workspace) | All 6 | Same as above, all panes combined | Union of all panes in workspace |
| Workspace list | CSV, XLSX, JSON | name, owner, published, pane_count, created_at | Configuration table |
| Graphics rendering | PDF, HTML | N/A (rendered SVG image) | See Section 5 |

**Bulk-update candidate**: Workspace configurations (published flag, sharing via `workspace_shares`). See Section 9.

#### Process Module (Doc 08)

| Exportable Entity | Formats | Key Columns | Notes |
|---|---|---|---|
| Bound point data (viewport) | All 6 | tagname, value, quality, timestamp, eng_units | Points visible in current viewport |
| View hierarchy | CSV, JSON | name, type, parent_name | Navigation tree structure |
| Graphics rendering | PDF, HTML | N/A (rendered SVG image) | See Section 5 |

**Bulk-update candidate**: View hierarchy (parent/child assignments).

#### Designer Module (Doc 09)

| Exportable Entity | Formats | Key Columns | Notes |
|---|---|---|---|
| Graphics list | CSV, XLSX, JSON | name, type, created_by, created_at, bindings_count | Design object catalog |
| Point bindings (per graphic) | CSV, XLSX, JSON | element_id, tagname, binding_type, value_map | Per-graphic binding export |
| Template list | CSV, JSON | name, parameters, created_by | Template catalog |

**Bulk-update candidate**: Point bindings (high-value for OPC server migration: re-point hundreds of bindings). Graphics metadata (bulk rename, reorganize hierarchy).

**Excluded from tabular export**: SVG source data (too large for CSV/XLSX; use Designer UI for SVG access). Individual shape SVG export/reimport is available in the Designer (see doc 09, Shape SVG Export/Reimport).

#### Dashboards Module (Doc 10)

| Exportable Entity | Formats | Key Columns | Notes |
|---|---|---|---|
| Widget data (per widget) | CSV, XLSX, JSON, Parquet | Depends on widget type (trend, table, KPI) | Inline export via kebab menu |
| Dashboard list | CSV, XLSX, JSON | name, owner, published, widget_count, created_at | Configuration catalog |
| Dashboard definition | JSON | Full layout + widget configs | JSON only (complex JSONB) |

**Bulk-update candidate**: Dashboard metadata (published, sharing via `dashboard_shares`). Widget data source reassignment (limited -- complex JSONB structures are better managed through the UI).

#### Reports Module (Doc 11)

Reports module **retains its own export system** (CSV, PDF, HTML). Universal Export does not replace or duplicate Report generation. The following extensions apply:
- XLSX format promoted from "future" to included (shares `rust_xlsxwriter` library)
- JSON added as a report output format

| From Universal Export | Formats | Key Columns | Notes |
|---|---|---|---|
| Report template list | CSV, XLSX, JSON | name, description, created_by, created_at | Template catalog only |
| Report template definition | JSON | Full template_config JSONB | JSON only |

#### Forensics Module (Doc 12)

Forensics module **retains its own export system** (CSV, analysis sessions). The following extensions apply:
- XLSX, JSON, PDF formats added alongside existing CSV
- Point dossier export added

| From Universal Export | Formats | Key Columns | Notes |
|---|---|---|---|
| (No Universal Export additions -- Forensics manages its own exports) | | | |

#### Log Module (Doc 13)

| Exportable Entity | Formats | Key Columns | Notes |
|---|---|---|---|
| Log entries (filtered) | CSV, XLSX, PDF, JSON | title, content_text, author, tags, created_at | Rich text stripped to plain text for CSV/XLSX |
| Log entry (single, with formatting) | PDF, HTML | Full rich text content | Preserves WYSIWYG formatting |
| Log templates | CSV, JSON | name, fields, required_flags | Template definitions |

**Bulk-update candidate**: Log templates (field configurations). NOT log entry content (each entry is an authored document).

**Sensitive note**: Log entries may contain operationally sensitive information (incident reports, near-miss details). Export respects `log:read` + `log:export` permissions.

#### Rounds Module (Doc 14)

| Exportable Entity | Formats | Key Columns | Notes |
|---|---|---|---|
| Round templates | CSV, XLSX, JSON | name, unit_area, question_count, created_by | Template catalog |
| Round template definition | JSON | Full checklist JSONB | JSON only for complex structure |
| Assigned rounds | CSV, XLSX | template_name, assignee, due_date, status | Schedule table |
| Completed round results | CSV, XLSX, PDF, JSON | template_name, completed_by, completed_at, answers | Inspection data |
| Completion history | CSV, XLSX | template_name, compliance_rate, overdue_count | Trend data |

**Bulk-update candidates**: Round templates (questions, expected values -- high value for sites with hundreds of inspection points). Round schedules (assignments, due dates).

#### Settings Module (Doc 15)

| Exportable Entity | Formats | Key Columns | Notes |
|---|---|---|---|
| Point metadata | CSV, XLSX, JSON | tagname, description, eng_units, area, criticality, active, ... | Primary bulk-update target |
| User list | CSV, XLSX, JSON | username, email, full_name, roles, enabled, last_login | `password_hash` NEVER exported |
| Role-permission matrix | CSV, XLSX, JSON | role_name, permission_name, granted | RBAC configuration |
| Point source list | CSV, XLSX, JSON | name, source_type, status, enabled | `connection_config` secrets NEVER exported |
| Application settings | CSV, JSON | key, value, description | Key-value pairs |
| Expression catalog | CSV, XLSX, JSON | name, context, owner, shared | Expression AST excluded (too complex for tabular) |
| Import connections | CSV, JSON | name, connector_type, enabled, status | `auth_config` secrets NEVER exported |
| Import definitions | CSV, JSON | name, connection_name, enabled, schedule_type | Configuration catalog |
| Event history | CSV, XLSX, JSON | event_type, source, severity, timestamp, acknowledged | Operational events |
| Audit log | CSV, XLSX, JSON | action, user, timestamp, details | Admin-only, read-only |

**Bulk-update candidates** (see Section 9 for full details): points_metadata, users, user_roles, settings, round templates, log templates, dashboard metadata, import definitions.

### 6.2 Field Classification

Every database column is classified into one of three tiers:

| Classification | Behavior | Examples |
|---|---|---|
| **Public** | Exported by default for any user with module read + export permission | tagname, description, area, active, timestamps |
| **Restricted** | Only exported for users with the module's admin/write permission | email, GPS coordinates, connection hostnames |
| **Forbidden** | NEVER exported regardless of role or permission | password_hash, refresh_token, encrypted credentials |

### 6.3 Forbidden Fields (Complete List)

These fields are excluded from all exports and never appear in the column picker:

| Table | Field | Reason |
|---|---|---|
| `users` | `password_hash` | Argon2 hashes must never leave the database |
| `user_sessions` | `refresh_token` | Session secret -- hijacking risk |
| `user_sessions` | `expires_at` | Internal session management |
| `point_sources` | `connection_config` (credential fields) | OPC UA passwords, database passwords |
| `import_connections` | `connection_config` (credential fields) | External system credentials |
| `import_connections` | `auth_config` (credential fields) | Authentication secrets |

When exporting tables containing Forbidden fields, those columns are silently omitted. They do not appear as blank columns -- they are absent from the export schema entirely.

---

## 7. My Exports Page

### 7.1 Access

The My Exports page is accessible from the user menu dropdown (top-right avatar/username menu) as a "My Exports" link. It is not a module tab -- it is a user-level utility page.

### 7.2 Layout

```
╔══════════════════════════════════════════════════════════════════════╗
║  My Exports                                     [ Clear Completed ] ║
╠══════════════════════════════════════════════════════════════════════╣
║                                                                     ║
║  ┌────────┬───────────────────────────────┬────────┬────────┬─────┐ ║
║  │ Status │ Export                        │ Format │ Size   │ Age │ ║
║  ├────────┼───────────────────────────────┼────────┼────────┼─────┤ ║
║  │ ████   │ settings_points_2026-02-22    │ CSV    │ 1.2 MB │ 2m  │ ║
║  │ ████   │ log_entries_2026-02-21        │ XLSX   │ 4.8 MB │ 1d  │ ║
║  │ ▓▓░░   │ dashboards_widget_data_...    │ Parquet│ --     │ 30s │ ║
║  │ FAIL   │ events_export_2026-02-20      │ PDF    │ --     │ 2d  │ ║
║  └────────┴───────────────────────────────┴────────┴────────┴─────┘ ║
║                                                                     ║
║  Selected: [ Download ]  [ Retry ]  [ Delete ]  [ Cancel ]         ║
║                                                                     ║
║  Exports are available for 24 hours after completion.               ║
╚══════════════════════════════════════════════════════════════════════╝
```

### 7.3 Behavior

**User view**: Regular users see only their own export jobs.

**Admin view**: Administrators see all users' export jobs with a user filter dropdown. Admins can cancel any user's in-progress export to free server resources.

**Status values**:

| Status | Icon | Description |
|---|---|---|
| `queued` | Spinner | Waiting for worker capacity |
| `processing` | Progress bar (with %) | Worker generating file |
| `completed` | Green checkmark | Ready for download |
| `failed` | Red X | Generation failed (error message available) |
| `cancelled` | Gray dash | Cancelled by user or admin |

**Actions**:
- **Download**: Available for completed exports. Streams the file to the browser.
- **Retry**: Available for failed exports. Creates a new job with the same parameters.
- **Delete**: Removes the job record and associated file.
- **Cancel**: Stops an in-progress export.
- **Clear Completed**: Bulk action to remove all completed/failed jobs from the list.

**Retention**: Export files are automatically deleted after 24 hours (configurable via `EXPORT_RETENTION_HOURS` environment variable). The job record remains in the database for audit purposes even after the file is deleted, with `file_path` set to NULL.

---

## 8. Notification System

### 8.1 In-App Notifications (WebSocket)

All async export completions trigger an in-app notification via the existing WebSocket infrastructure (Data Broker, doc 16). This is always active and cannot be disabled.

**WebSocket Message Schema**:

```json
{
  "type": "export_notification",
  "payload": {
    "job_id": "a1b2c3d4-5678-90ab-cdef-1234567890ab",
    "status": "completed",
    "filename": "settings_points_2026-02-22_1430.csv",
    "format": "csv",
    "row_count": 12450,
    "file_size_bytes": 1258000,
    "download_url": "/api/exports/a1b2c3d4.../download",
    "message": "Your export is ready: settings_points_2026-02-22_1430.csv"
  }
}
```

For failed exports:

```json
{
  "type": "export_notification",
  "payload": {
    "job_id": "a1b2c3d4-5678-90ab-cdef-1234567890ab",
    "status": "failed",
    "error_message": "Database query timed out after 300 seconds",
    "message": "Export failed: settings_points_2026-02-22_1430.csv"
  }
}
```

**Frontend behavior**: The notification renders as a toast (bottom-right corner) with the export name, status, and a "Download" link for completed exports. The notification persists until dismissed or for 10 seconds, whichever is longer.

### 8.2 Email Notifications

Export jobs include an optional email notification flag. When enabled, the system sends an email on export completion via the Email Service (doc 28) using the `export_complete` template.

**Schema fields** (on `export_jobs` table):
- `notify_email BOOLEAN NOT NULL DEFAULT false` -- whether to send email on completion
- `email_address VARCHAR(255)` -- recipient email (defaults to user's email from `users` table)

**Export Dialog checkbox:**
```
[ ] Email me when complete
```

The checkbox defaults to unchecked. When checked, the Email Service delivers a notification using the `export_complete` template containing: export name, status, file size, and a download link. If no email provider is configured in the Email Service, the checkbox is disabled with a tooltip explaining that email is not available.

---

## 9. Admin Bulk Update

### 9.1 Updateable Entities

The following entities support bulk update via the template-export-modify-reimport workflow:

| Entity | Source Table | Editable Columns | Not Editable (Read-Only / System-Managed) |
|---|---|---|---|
| Points (app config) | `points_metadata` | `active`, `criticality`, `area`, `aggregation_types`, `barcode`, `notes`, `gps_latitude`, `gps_longitude`, `write_frequency_seconds`, `default_graphic_id` | `tagname`, `source_id`, `description`, `engineering_units`, `data_type`, `min_value`, `max_value` (source-managed), all timestamps, `id` |
| Users | `users` | `full_name`, `email`, `enabled` | `username` (immutable identifier), `password_hash`, `id`, timestamps |
| User role assignments | `user_roles` | role assignment per user | N/A |
| Application settings | `settings` | `value` per key | `key` (immutable), `updated_at` |
| Point sources | `point_sources` | `name`, `description`, `enabled` | `connection_config` (secrets), `status`, timestamps |
| Round templates | Rounds tables | `name`, checklist questions, expected values | `id`, completed results, timestamps |
| Log templates | Log template config | `name`, field definitions, required flags | `id`, timestamps |
| Dashboard metadata | `dashboards` + `dashboard_shares` | `name`, `published`, sharing grants | `layout`, `widgets` (complex JSONB -- use UI), `id`, timestamps |
| Import definitions | `import_definitions` | `name`, `description`, `enabled`, `batch_size`, `error_strategy` | `connection_id`, `source_config`, `field_mappings` (complex JSONB), `id` |

### 9.2 Excluded from Bulk Update

| Data | Reason |
|---|---|
| Time-series data (`points_history_raw`) | Immutable historical record. If data needs correction, use point overrides (future). |
| Events | Immutable operational record. Events are system-generated, not user-editable. |
| Audit logs | Immutable and indefinite by design. The audit trail is a compliance requirement. |
| System logs | Immutable operational record. |
| OPC-managed point metadata (`description`, `engineering_units`, `data_type`, `min_value`, `max_value`) | Source-of-truth is the OPC server. These fields are synced via `sync_point_metadata_from_version()` trigger. Admin CSV edits would be overwritten on the next OPC metadata refresh. |
| Expression ASTs (`custom_expressions.expression`) | Complex nested JSON structures. Use the Expression Builder UI (doc 23). |
| Complex JSONB configs (dashboard `widgets`, workspace `layout`, import `field_mappings`) | Deeply nested structures that cannot be meaningfully represented in CSV/XLSX. Use the respective module UIs. |

### 9.3 Bulk Update Wizard

The wizard is a 4-step modal flow accessible from the Settings module under a "Bulk Update" action menu.

#### Step 1: Upload

```
╔══════════════════════════════════════════════════════════════════╗
║  Bulk Update - Step 1 of 4: Upload                       [ X ] ║
╠══════════════════════════════════════════════════════════════════╣
║                                                                 ║
║  Entity: [ Points (App Config)  v ]                             ║
║                                                                 ║
║  ┌───────────────────────────────────────────────────────────┐  ║
║  │                                                           │  ║
║  │     Drag and drop your modified template file here        │  ║
║  │     or  [ Browse Files ]                                  │  ║
║  │                                                           │  ║
║  │     Accepted: .csv, .xlsx   Max: 50 MB / 50,000 rows     │  ║
║  └───────────────────────────────────────────────────────────┘  ║
║                                                                 ║
║  Need a template?  [ Download Current Data as Template ]        ║
║                                                                 ║
║  [ Cancel ]                                     [ Next -> ]     ║
╚══════════════════════════════════════════════════════════════════╝
```

The "Download Current Data as Template" button generates a pre-populated template with all current values and the appropriate columns. The template includes:
- An `__id` column (record UUID) for matching rows on reimport
- All editable columns with current values
- Read-only reference columns with a `[READ-ONLY]` header suffix (e.g., `tagname [READ-ONLY]`) to help users orient while editing
- An `_exported_at` metadata value (ISO 8601 timestamp of when the template was generated, used for concurrency detection)

#### Step 2: Validate and Map

```
╔══════════════════════════════════════════════════════════════════╗
║  Bulk Update - Step 2 of 4: Validate & Map               [ X ] ║
╠══════════════════════════════════════════════════════════════════╣
║                                                                 ║
║  File: points_config_updated.xlsx (2,847 rows detected)         ║
║                                                                 ║
║  COLUMN MAPPING ────────────────────────────────────────────    ║
║  File Column          System Field          Status              ║
║  __id                 Record ID             [Matched]           ║
║  tagname [READ-ONLY]  Tag Name              [Read-only, skip]   ║
║  active               Active                [Matched]           ║
║  criticality          Criticality           [Matched]           ║
║  area                 Area                  [Matched]           ║
║  notes                Notes                 [Matched]           ║
║  new_column           [ Select field v ]    [Unmapped]          ║
║                                                                 ║
║  VALIDATION ────────────────────────────────────────────────    ║
║  [OK]  2,847 rows have valid record IDs                         ║
║  [OK]  No duplicate IDs found                                   ║
║  [!!]  3 rows: invalid criticality value (must be 1-5)          ║
║  [!!]  1 row: blank required field (area)                       ║
║                                                                 ║
║  [ Show errors ]  [ Download error report ]                     ║
║                                                                 ║
║  [ <- Back ]                                    [ Next -> ]     ║
╚══════════════════════════════════════════════════════════════════╝
```

Validation checks:
- **Type validation**: Values match expected data types (integer, boolean, text, etc.)
- **Range validation**: Values within allowed ranges (e.g., criticality 1-5)
- **Constraint validation**: Values satisfy CHECK constraints (e.g., valid source_type values)
- **Foreign key validation**: Referenced records exist (e.g., default_graphic_id → design_objects)
- **Uniqueness validation**: No duplicate primary key or unique constraint violations
- **Required fields**: Non-nullable columns have values

Unmapped columns (columns in the file that don't match system fields) can be manually mapped via a dropdown or ignored.

#### Step 3: Diff Preview

```
╔══════════════════════════════════════════════════════════════════╗
║  Bulk Update - Step 3 of 4: Review Changes                [ X ] ║
╠══════════════════════════════════════════════════════════════════╣
║                                                                 ║
║  Summary: 2,847 rows analyzed                                   ║
║    312 rows with changes                                        ║
║    2,531 rows unchanged (skipped)                               ║
║    4 rows with errors (skipped)                                 ║
║                                                                 ║
║  Filter: [ All changes v ]  [ Show unchanged ]  [ Show errors ] ║
║                                                                 ║
║  ┌─────┬──────────┬──────────────┬─────────────────────────────┐║
║  │     │ Tag      │ Field        │ Change                      │║
║  ├─────┼──────────┼──────────────┼─────────────────────────────┤║
║  │ OK  │ TI-101   │ criticality  │ 3 --> 5                     │║
║  │ OK  │ TI-101   │ area         │ "Unit 1" --> "Unit 1A"      │║
║  │ OK  │ PI-201   │ active       │ true --> false               │║
║  │ OK  │ FI-301   │ notes        │ "" --> "Calibrated 2026-02" │║
║  │ ⚠   │ LI-401   │ area         │ "Unit 2" --> "Unit 2B"      │║
║  │     │          │              │ (modified since export)      │║
║  │ !!  │ XI-999   │ criticality  │ "EXTREME" (invalid value)   │║
║  └─────┴──────────┴──────────────┴─────────────────────────────┘║
║                                                     Page 1 of 7 ║
║                                                                 ║
║  [x] Create backup snapshot before applying                     ║
║                                                                 ║
║  Conflict Resolution for modified rows:                         ║
║  (●) Skip conflicted rows    ( ) Overwrite with template values ║
║                                                                 ║
║  [ <- Back ]                      [ Apply 308 Changes ]         ║
╚══════════════════════════════════════════════════════════════════╝
```

**Field-level diff**: Shows old → new values for every changed field, not just "row changed." Uses `-->` arrows for accessibility (in addition to color coding: green for valid changes, yellow/orange for conflicts, red for errors).

**Unchanged rows**: Hidden by default with a count summary ("2,531 rows unchanged"). Toggle to show them.

**Conflict detection**: Rows where `updated_at > _exported_at` are flagged with a warning icon (⚠). These rows were modified by another user or process between template export and reimport. The admin chooses: skip conflicted rows (default) or overwrite with template values.

**Backup checkbox**: Default checked. Creates a change snapshot before applying (see Section 10).

#### Step 4: Results

```
╔══════════════════════════════════════════════════════════════════╗
║  Bulk Update Complete                                    [ X ] ║
╠══════════════════════════════════════════════════════════════════╣
║                                                                 ║
║  Results:                                                       ║
║    [OK]  308 rows updated successfully                          ║
║    [--]  2,531 rows unchanged (skipped)                         ║
║    [⚠]   4 rows skipped (modified since export)                 ║
║    [!!]  4 rows failed validation (skipped)                     ║
║                                                                 ║
║  Backup snapshot created: "Pre-update: Points App Config"       ║
║  Snapshot ID: snap_a1b2c3d4...                                  ║
║                                                                 ║
║  Failed/Skipped Rows:                                           ║
║  ┌──────────┬─────────────────────────────────────────────────┐ ║
║  │ Tag      │ Reason                                          │ ║
║  ├──────────┼─────────────────────────────────────────────────┤ ║
║  │ XI-999   │ Invalid criticality value "EXTREME"             │ ║
║  │ TI-700   │ Required field "area" is blank                  │ ║
║  │ LI-401   │ Conflict: modified since template export        │ ║
║  │ FI-888   │ Record not found (may have been deleted)        │ ║
║  └──────────┴─────────────────────────────────────────────────┘ ║
║                                                                 ║
║  [ Download Error Report ]   [ Download Full Results ]          ║
║                                                                 ║
║  [ Undo All Changes ]                               [ Done ]    ║
╚══════════════════════════════════════════════════════════════════╝
```

**Error report**: Downloadable CSV containing only the failed/skipped rows with an `_error` column explaining the reason. This file can be fixed and re-imported without affecting already-updated rows.

**Undo All Changes**: Triggers a restore from the snapshot created in this operation. Opens the restore preview (Section 10.4) before executing.

### 9.4 Idempotent Reimport

When reimporting a file, rows where the current database values already match the template values (no actual change) are skipped silently. This makes it safe to retry a reimport after fixing errors without duplicating or re-applying already-successful changes.

### 9.5 Processing Model

Bulk updates are processed entirely within the API Gateway:

1. File is uploaded and parsed (CSV via `csv` crate, XLSX via `calamine` crate already in project)
2. Column mapping is computed (exact header match, then fuzzy via `strsim` Jaro-Winkler already in project)
3. Validation runs against the target table's schema and constraints
4. On Apply: a database transaction wraps the entire operation:
   - Snapshot creation (if checkbox enabled)
   - Row-by-row UPDATE statements with WHERE clause matching `__id`
   - On any error: individual row is logged as failed, transaction continues (partial success model)
5. Results are recorded in `export_jobs` table (type `bulk_update_apply`)

---

## 10. Change Snapshots

### 10.1 Concept

A change snapshot is a point-in-time copy of configuration data. It is not a running change log, not a diff journal, and not an undo/redo stack. It captures the complete state of a set of rows at a specific moment so that state can be partially or fully restored later.

### 10.2 Snapshot Types

| Type | Trigger | Scope | Description |
|---|---|---|---|
| **Automatic** | Before every bulk update Apply | Rows being modified | System creates a snapshot of the exact rows that will be changed, capturing their current values before the update is applied |
| **Manual** | Admin clicks "Create Snapshot" | Admin-selected table or filter | Admin creates an on-demand snapshot of a specific table (all rows or filtered subset) for safekeeping |

### 10.3 Supported Tables

The following tables can be snapshotted:

| Table | Primary Use Case |
|---|---|
| `points_metadata` | Before bulk point configuration changes |
| `users` | Before bulk user management changes |
| `user_roles` | Before bulk role assignment changes |
| `settings` | Before application settings changes |
| `dashboards` | Before dashboard configuration changes |
| `workspaces` | Before workspace configuration changes |
| `design_objects` | Before graphics metadata changes |
| `custom_expressions` | Before expression configuration changes |
| `import_connections` | Before import connection changes |
| `import_definitions` | Before import definition changes |

### 10.4 Non-Snapshottable Data

| Data | Reason |
|---|---|
| Time-series (`points_history_raw`, continuous aggregates) | Too large; use TimescaleDB retention and Archive Service |
| Audit logs (`audit_log`) | Immutable by design; never need restore |
| System logs | Immutable operational records |
| Events | Immutable operational records |
| File attachments (log photos, round photos) | Binary blobs; metadata can be snapshotted but files cannot |
| User sessions | Transient; security risk if restored |

### 10.5 Snapshot Data Model

Each snapshot consists of:
- **Metadata** (`change_snapshots` table): table name, type, description, row count, timestamp, who created it, and optionally a reference to the bulk update job that triggered it
- **Row data** (`change_snapshot_rows` table): one row per snapshotted record, containing the record's UUID and a JSONB copy of all its columns at snapshot time

### 10.6 Restoration

Restoration supports two modes:

**Full Rollback**: Restore all rows from the snapshot, replacing current values with the snapshotted values.

**Selective Restore**: Select individual records from the snapshot to restore. The admin picks specific rows via checkboxes.

Both modes follow the same workflow:

1. Admin selects a snapshot and clicks "Restore"
2. System generates a **restore preview** showing what will change:

```
╔══════════════════════════════════════════════════════════════════╗
║  Restore Preview                                          [ X ] ║
╠══════════════════════════════════════════════════════════════════╣
║                                                                 ║
║  Snapshot: "Pre-update: Points App Config" (2026-02-22 14:30)   ║
║  Table: points_metadata    Rows in snapshot: 308                ║
║                                                                 ║
║  RESTORE MODE ──────────────────────────────────────────────    ║
║  (●) Restore all 308 rows                                       ║
║  ( ) Select specific rows to restore                            ║
║                                                                 ║
║  PREVIEW OF CHANGES ────────────────────────────────────────    ║
║  ┌──────────┬──────────────┬──────────────────────────────────┐ ║
║  │ Tag      │ Field        │ Change                           │ ║
║  ├──────────┼──────────────┼──────────────────────────────────┤ ║
║  │ TI-101   │ criticality  │ 5 --> 3 (restore to original)    │ ║
║  │ TI-101   │ area         │ "Unit 1A" --> "Unit 1" (restore) │ ║
║  │ PI-201   │ active       │ false --> true (restore)          │ ║
║  │ FI-301   │ notes        │ "Calibrated..." --> "" (restore)  │ ║
║  └──────────┴──────────────┴──────────────────────────────────┘ ║
║                                                     Page 1 of 7 ║
║                                                                 ║
║  ⚠ 2 rows have been modified again since this snapshot.         ║
║    Restoring will overwrite those subsequent changes.            ║
║    [ Show affected rows ]                                       ║
║                                                                 ║
║  [x] Create backup snapshot before restoring                    ║
║                                                                 ║
║  [ Cancel ]                           [ Restore 308 Rows ]      ║
╚══════════════════════════════════════════════════════════════════╝
```

3. **Conflict detection**: If any row has been modified again after the snapshot was taken (by a user, bulk update, or system process), those rows are flagged with a warning. The admin sees both the snapshot value and the current value, and can choose to include or exclude conflicted rows from the restore.

4. **Pre-restore snapshot**: If the checkbox is enabled (default), the system creates a new snapshot of the current state of all rows about to be restored. This means every restore operation is itself reversible.

5. **Execution**: Restoration runs in a single database transaction. Each row is updated with the values from the snapshot's `row_data` JSONB. The restore preview's row count is verified against the actual UPDATE count; any mismatch aborts the transaction.

### 10.7 Retention

- **Default retention**: Indefinite. Snapshots are not automatically deleted.
- **Manual deletion**: Admins can delete snapshots from the snapshot management UI in Settings.
- **Deletion warning**: If a snapshot is referenced by a bulk update job that appears in the audit log, a confirmation dialog warns that deleting the snapshot removes the ability to restore from that operation.
- **Future**: Configurable retention policy (auto-delete snapshots older than N days, with exceptions for snapshots linked to audit events).

### 10.8 Snapshot Management UI

The snapshot management interface lives in the Settings module under a "Change Snapshots" section:

```
╔══════════════════════════════════════════════════════════════════════╗
║  Change Snapshots                             [ Create Snapshot v ] ║
╠══════════════════════════════════════════════════════════════════════╣
║                                                                     ║
║  ┌──────┬───────────────────────────────┬───────┬───────┬─────────┐ ║
║  │ Type │ Description                   │ Table │ Rows  │ Actions │ ║
║  ├──────┼───────────────────────────────┼───────┼───────┼─────────┤ ║
║  │ Auto │ Pre-update: Points App Config │ pts   │ 308   │[Restore]│ ║
║  │ Auto │ Pre-restore: Points Config    │ pts   │ 308   │[Restore]│ ║
║  │ Man  │ "Before maintenance window"   │ users │ 47    │[Restore]│ ║
║  │ Auto │ Pre-update: Round Templates   │ rnds  │ 12    │[Restore]│ ║
║  └──────┴───────────────────────────────┴───────┴───────┴─────────┘ ║
║                                                                     ║
║  [ View Details ]  [ Delete Selected ]                              ║
╚══════════════════════════════════════════════════════════════════════╝
```

---

## 11. Async Pipeline and Job Management

### 11.1 Job Queue

Export and bulk update jobs share a single PostgreSQL-based job queue using the same pattern as the Import Service (doc 24):

```sql
-- Worker claims next available job (concurrency-safe)
UPDATE export_jobs
SET status = 'processing', started_at = NOW()
WHERE id = (
    SELECT id FROM export_jobs
    WHERE status = 'queued'
    ORDER BY created_at
    FOR UPDATE SKIP LOCKED
    LIMIT 1
)
RETURNING *;
```

### 11.2 Job Lifecycle

```
  ┌─────────┐     claim      ┌────────────┐    success   ┌───────────┐
  │ queued  │ ──────────────> │ processing │ ───────────> │ completed │
  └─────────┘                 └────────────┘              └───────────┘
                                    │
                                    │ failure
                                    ▼
                              ┌──────────┐
                              │ failed   │
                              └──────────┘

  User cancel at any stage → 'cancelled'
```

### 11.3 Progress Tracking

For large exports, the worker updates `rows_processed` every 1,000 rows. The frontend polls `GET /api/exports/:id` or receives WebSocket progress updates.

```json
{
  "type": "export_progress",
  "payload": {
    "job_id": "a1b2c3d4...",
    "rows_processed": 45000,
    "rows_total": 142000,
    "percent": 31
  }
}
```

### 11.4 Concurrency Limits

| Limit | Default | Configurable Via |
|---|---|---|
| Max concurrent export workers | 3 | `EXPORT_MAX_WORKERS` |
| Per-user active job limit | 5 | `EXPORT_PER_USER_LIMIT` |
| Export file retention | 24 hours | `EXPORT_RETENTION_HOURS` |
| Max export file size | 500 MB | `EXPORT_MAX_FILE_SIZE_MB` |
| Max bulk update file upload | 50 MB | `BULK_UPDATE_MAX_UPLOAD_MB` |
| Max bulk update row count | 50,000 | `BULK_UPDATE_MAX_ROWS` |

### 11.5 File Cleanup

A background task runs every hour within the API Gateway process:

```rust
// Pseudo-code for cleanup task
async fn cleanup_expired_exports(pool: &PgPool, export_dir: &Path) {
    let expired = sqlx::query!(
        "UPDATE export_jobs SET file_path = NULL
         WHERE status = 'completed'
         AND completed_at < NOW() - INTERVAL '1 hour' * $1
         AND file_path IS NOT NULL
         RETURNING file_path",
        retention_hours
    ).fetch_all(pool).await?;

    for job in expired {
        if let Some(path) = job.file_path {
            tokio::fs::remove_file(path).await.ok();
        }
    }
}
```

---

## 12. Database Schema

### 12.1 Export Jobs Table

```sql
-- Export and bulk update job queue
CREATE TABLE export_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Job classification
    job_type VARCHAR(30) NOT NULL
        CHECK (job_type IN (
            'data_export',            -- Universal Export (file download)
            'bulk_update_template',   -- Template generation for bulk update
            'bulk_update_apply'       -- Applying bulk update changes
        )),

    -- Job status
    status VARCHAR(20) NOT NULL DEFAULT 'queued'
        CHECK (status IN ('queued', 'processing', 'completed', 'failed', 'cancelled')),

    -- What is being exported / updated
    module VARCHAR(50) NOT NULL,               -- console, process, designer, dashboards, log, rounds, settings
    entity VARCHAR(100) NOT NULL,              -- points, users, workspaces, log_entries, etc.
    format VARCHAR(20)
        CHECK (format IN ('csv', 'xlsx', 'pdf', 'json', 'parquet', 'html')),

    -- Filters and column selection
    filters JSONB DEFAULT '{}',                -- Filter criteria applied to the export
    columns TEXT[],                            -- Selected column names (NULL = all eligible)
    sort_field VARCHAR(100),                   -- Sort column
    sort_order VARCHAR(4) DEFAULT 'asc'
        CHECK (sort_order IN ('asc', 'desc')),

    -- Output file
    file_path VARCHAR(500),                    -- Path to generated file (NULL after cleanup)
    file_size_bytes BIGINT,                    -- Size of generated file
    original_filename VARCHAR(255),            -- User-facing filename for download

    -- Progress tracking
    rows_total INTEGER,                        -- Estimated total rows
    rows_processed INTEGER DEFAULT 0,          -- Rows processed so far

    -- Error details
    error_message TEXT,                        -- Error description if failed

    -- Notification preferences
    notify_email BOOLEAN NOT NULL DEFAULT false,
    email_address VARCHAR(255),                -- Override email (default: user's email)

    -- Bulk update specific
    snapshot_id UUID,                          -- FK to change_snapshots (set after snapshot creation)

    -- Ownership and timestamps
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_export_jobs_status ON export_jobs(status) WHERE status IN ('queued', 'processing');
CREATE INDEX idx_export_jobs_created_by ON export_jobs(created_by);
CREATE INDEX idx_export_jobs_created_at ON export_jobs(created_at DESC);
CREATE INDEX idx_export_jobs_cleanup ON export_jobs(completed_at) WHERE status = 'completed' AND file_path IS NOT NULL;

-- Triggers
CREATE TRIGGER trg_export_jobs_updated_at
    BEFORE UPDATE ON export_jobs
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_audit_export_jobs
    AFTER INSERT OR UPDATE OR DELETE ON export_jobs
    FOR EACH ROW
    EXECUTE FUNCTION log_audit_trail();
```

### 12.2 Change Snapshots Table

```sql
-- Point-in-time configuration snapshots
CREATE TABLE change_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- What was snapshotted
    table_name VARCHAR(100) NOT NULL,
    snapshot_type VARCHAR(20) NOT NULL
        CHECK (snapshot_type IN ('automatic', 'manual')),
    description TEXT,

    -- Scope
    row_count INTEGER NOT NULL DEFAULT 0,
    filter_criteria JSONB,                     -- Filter used to select rows (NULL = all rows)

    -- Relationship to bulk update job
    related_job_id UUID REFERENCES export_jobs(id) ON DELETE SET NULL,

    -- Ownership and timestamps
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_change_snapshots_table ON change_snapshots(table_name);
CREATE INDEX idx_change_snapshots_type ON change_snapshots(snapshot_type);
CREATE INDEX idx_change_snapshots_created_at ON change_snapshots(created_at DESC);
CREATE INDEX idx_change_snapshots_created_by ON change_snapshots(created_by);
CREATE INDEX idx_change_snapshots_related_job ON change_snapshots(related_job_id);

-- Audit trigger
CREATE TRIGGER trg_audit_change_snapshots
    AFTER INSERT OR UPDATE OR DELETE ON change_snapshots
    FOR EACH ROW
    EXECUTE FUNCTION log_audit_trail();
```

### 12.3 Change Snapshot Rows Table

```sql
-- Individual row data within a snapshot
CREATE TABLE change_snapshot_rows (
    id BIGSERIAL PRIMARY KEY,
    snapshot_id UUID NOT NULL REFERENCES change_snapshots(id) ON DELETE CASCADE,
    record_id UUID NOT NULL,                   -- PK of the snapshotted row
    row_data JSONB NOT NULL                    -- Complete row as JSON at snapshot time
);

-- Indexes
CREATE INDEX idx_change_snapshot_rows_snapshot ON change_snapshot_rows(snapshot_id);
CREATE INDEX idx_change_snapshot_rows_record ON change_snapshot_rows(snapshot_id, record_id);

-- No audit trigger on this table (high volume, covered by parent table audit)
```

### 12.4 Add Foreign Key to export_jobs

```sql
-- Add FK after both tables exist (avoids forward reference)
ALTER TABLE export_jobs
    ADD CONSTRAINT fk_export_jobs_snapshot
    FOREIGN KEY (snapshot_id)
    REFERENCES change_snapshots(id)
    ON DELETE SET NULL;
```

### 12.5 Schema Domain

These tables belong to a new schema domain: **Export & Bulk Update** (domain 9 in the database design overview, doc 04).

---

## 13. API Endpoints

All endpoints are served by the API Gateway (Port 3000) and follow the conventions in doc 21 (JSON request/response, standard error format, pagination for list endpoints).

### 13.1 Universal Export

| Method | Endpoint | Permission | Description |
|---|---|---|---|
| `POST` | `/api/exports` | `<module>:export` | Create an export job |
| `GET` | `/api/exports` | Authenticated | List export jobs (own; admin: all users with `?user_id=` filter) |
| `GET` | `/api/exports/:id` | Authenticated | Get export job status and details |
| `GET` | `/api/exports/:id/download` | Authenticated | Download the export file |
| `DELETE` | `/api/exports/:id` | Authenticated | Cancel or delete an export job |

**Create Export Request:**

```json
POST /api/exports
{
  "module": "settings",
  "entity": "points",
  "format": "csv",
  "scope": "filtered",
  "filters": {
    "area": "Unit 1",
    "active": true
  },
  "columns": ["tagname", "description", "engineering_units", "area", "criticality", "active"],
  "sort": { "field": "tagname", "order": "asc" },
  "notify_email": false
}
```

**Synchronous Response** (< 50K rows):

```
HTTP/1.1 200 OK
Content-Type: text/csv; charset=utf-8
Content-Disposition: attachment; filename="settings_points_2026-02-22_1430.csv"

tagname,description,engineering_units,area,criticality,active
TI-101,Reactor Inlet Temp,degF,Unit 1,5,true
PI-201,Feed Pressure,psig,Unit 1,3,true
...
```

**Asynchronous Response** (>= 50K rows):

```json
HTTP/1.1 202 Accepted
{
  "id": "a1b2c3d4-5678-90ab-cdef-1234567890ab",
  "status": "queued",
  "rows_total": 142000,
  "message": "Export queued. You will be notified when ready."
}
```

### 13.2 Admin Bulk Update

| Method | Endpoint | Permission | Description |
|---|---|---|---|
| `POST` | `/api/bulk-update/template` | `system:bulk_update` | Generate and download a template |
| `POST` | `/api/bulk-update/upload` | `system:bulk_update` | Upload a modified template file |
| `POST` | `/api/bulk-update/:id/validate` | `system:bulk_update` | Validate uploaded data and map columns |
| `GET` | `/api/bulk-update/:id/diff` | `system:bulk_update` | Get the diff preview (paginated) |
| `POST` | `/api/bulk-update/:id/apply` | `system:bulk_update` | Apply changes (creates snapshot first) |
| `GET` | `/api/bulk-update/:id/results` | `system:bulk_update` | Get results after apply |
| `DELETE` | `/api/bulk-update/:id` | `system:bulk_update` | Cancel a pending bulk update |

**Generate Template Request:**

```json
POST /api/bulk-update/template
{
  "entity": "points",
  "format": "xlsx",
  "filters": { "area": "Unit 1" }
}
```

Response: File download with populated template.

**Upload Request:**

```
POST /api/bulk-update/upload
Content-Type: multipart/form-data

entity=points
file=@points_config_updated.xlsx
```

Response:

```json
{
  "id": "b2c3d4e5-6789-0abc-def1-234567890bcd",
  "status": "uploaded",
  "rows_detected": 2847,
  "columns_detected": ["__id", "tagname", "active", "criticality", "area", "notes"]
}
```

**Diff Preview Response:**

```json
GET /api/bulk-update/b2c3d4e5.../diff?page=1&per_page=50
{
  "summary": {
    "rows_changed": 312,
    "rows_unchanged": 2531,
    "rows_errored": 4,
    "rows_conflicted": 2
  },
  "changes": [
    {
      "record_id": "uuid...",
      "reference": { "tagname": "TI-101" },
      "fields": [
        { "field": "criticality", "old": 3, "new": 5 },
        { "field": "area", "old": "Unit 1", "new": "Unit 1A" }
      ],
      "status": "valid"
    },
    {
      "record_id": "uuid...",
      "reference": { "tagname": "LI-401" },
      "fields": [
        { "field": "area", "old": "Unit 2", "new": "Unit 2B" }
      ],
      "status": "conflict",
      "conflict_detail": "Row modified since template export (updated_at > _exported_at)"
    }
  ],
  "pagination": { "page": 1, "per_page": 50, "total": 312 }
}
```

### 13.3 Change Snapshots

| Method | Endpoint | Permission | Description |
|---|---|---|---|
| `GET` | `/api/snapshots` | `system:change_backup` | List all snapshots (paginated) |
| `POST` | `/api/snapshots` | `system:change_backup` | Create a manual snapshot |
| `GET` | `/api/snapshots/:id` | `system:change_backup` | Get snapshot metadata |
| `GET` | `/api/snapshots/:id/rows` | `system:change_backup` | Get snapshot row data (paginated) |
| `GET` | `/api/snapshots/:id/restore-preview` | `system:change_restore` | Preview what restore would change |
| `POST` | `/api/snapshots/:id/restore` | `system:change_restore` | Execute restore (full or selective) |
| `DELETE` | `/api/snapshots/:id` | `system:change_backup` | Delete a snapshot |

**Create Manual Snapshot Request:**

```json
POST /api/snapshots
{
  "table_name": "points_metadata",
  "description": "Before maintenance window - February 2026",
  "filters": { "area": "Unit 1" }
}
```

**Restore Request:**

```json
POST /api/snapshots/c3d4e5f6.../restore
{
  "mode": "selective",
  "record_ids": ["uuid1", "uuid2", "uuid3"],
  "create_backup": true,
  "conflict_resolution": "skip"
}
```

**Restore Preview Response:**

```json
GET /api/snapshots/c3d4e5f6.../restore-preview
{
  "snapshot_id": "c3d4e5f6...",
  "table_name": "points_metadata",
  "rows_to_restore": 308,
  "rows_with_conflicts": 2,
  "changes": [
    {
      "record_id": "uuid...",
      "reference": { "tagname": "TI-101" },
      "fields": [
        { "field": "criticality", "current": 5, "restore_to": 3 },
        { "field": "area", "current": "Unit 1A", "restore_to": "Unit 1" }
      ],
      "has_conflict": false
    }
  ]
}
```

---

## 14. RBAC Permissions

### 14.1 New Module Export Permissions

| Permission | Description | Default Roles |
|---|---|---|
| `console:export` | Export point data from console workspaces | All roles |
| `process:export` | Export point data from process views | All roles |
| `designer:export` | Export graphics metadata and point bindings | All roles |
| `dashboards:export` | Export widget data from dashboards | All roles |
| `log:export` | Export log entries and templates | All roles |
| `rounds:export` | Export round data, templates, and schedules | All roles |
| `settings:export` | Export settings data (users, points, sources, events) | Admin |

*Role-permission assignments are managed centrally in doc 03. Defaults shown for reference.*

**Note**: `reports:export` and `forensics:export` already exist in doc 03. Those modules retain their own export systems; no new permissions are needed for them.

### 14.2 New System Permissions

| Permission | Description | Default Roles |
|---|---|---|
| `system:bulk_update` | Access the admin bulk update wizard, upload templates, apply changes | Admin |
| `system:change_backup` | Create and view change snapshots | Supervisor, Admin |
| `system:change_restore` | Restore data from change snapshots | Admin |

*Role-permission assignments are managed centrally in doc 03. Defaults shown for reference.*

### 14.3 Permission Count

| Category | Before | New | After |
|---|---|---|---|
| Module export permissions | 0 (new category) | +7 | 7 |
| System permissions | 20 | +3 | 23 |
| **Total** | **63** | **+10** | **73** |

### 14.4 Audit Action Types

All export system operations are logged to `audit_log`:

| Action Type | Trigger | Details Captured |
|---|---|---|
| `EXPORT_DATA` | User exports data from any module | module, entity, format, row_count, filters, columns |
| `BULK_UPDATE_UPLOAD` | Admin uploads a bulk update file | entity, filename, row_count |
| `BULK_UPDATE_APPLY` | Admin applies bulk update changes | entity, rows_updated, rows_skipped, rows_failed, snapshot_id |
| `SNAPSHOT_CREATE` | Snapshot created (auto or manual) | table_name, type, row_count, description |
| `SNAPSHOT_RESTORE` | Admin restores from a snapshot | snapshot_id, mode (full/selective), rows_restored |
| `SNAPSHOT_DELETE` | Admin deletes a snapshot | snapshot_id, table_name, row_count |

---

## 15. Security and Data Classification

### 15.1 Field Classification

Every database column in the system is classified for export purposes:

| Classification | Who Can Export | Behavior | Examples |
|---|---|---|---|
| **Public** | Any user with module:export permission | Exported by default; appears in column picker | tagname, description, area, active, timestamps |
| **Restricted** | Users with module admin/write permission only | Appears in column picker only for authorized users | email addresses, GPS coordinates, connection hostnames |
| **Forbidden** | Nobody | Never exported; never appears in column picker | password_hash, refresh_token, encrypted credentials |

### 15.2 Forbidden Fields Registry

The complete list of Forbidden fields (from Section 6.3) is enforced at the export layer. The `ExportFormatter` receives only Public and Restricted columns (filtered by the user's permissions). Forbidden columns are stripped before reaching the formatter.

### 15.3 Export Watermarking

Exported files include metadata identifying the exporter:

**CSV**: Comment header prepended to the file:
```csv
# Exported by: jsmith (John Smith)
# Export ID: a1b2c3d4-5678-90ab-cdef-1234567890ab
# Generated: 2026-02-22T14:30:00Z
# Source: Settings > Points (filtered: area = "Unit 1")
tagname,description,engineering_units,area,criticality,active
```

**XLSX**: Custom document properties (File > Properties):
- `io:exporter`: username and display name
- `io:export_id`: job UUID
- `io:generated`: ISO 8601 timestamp
- `io:source`: module and entity with filters

**PDF**: Footer on every page:
```
Exported by jsmith | 2026-02-22 14:30 UTC | Inside/Operations
```

**JSON**: Metadata wrapper:
```json
{
  "_metadata": {
    "exporter": "jsmith",
    "export_id": "a1b2c3d4...",
    "generated": "2026-02-22T14:30:00Z",
    "source": "settings.points",
    "filters": { "area": "Unit 1" },
    "row_count": 2847
  },
  "data": [ ... ]
}
```

**Parquet**: File-level key-value metadata (Parquet metadata section).

**HTML**: Hidden `<meta>` tags in `<head>`.

### 15.4 Audit Trail

Every export operation is recorded in the audit log. The audit record includes:
- User who initiated the export
- Module and entity exported
- Format chosen
- Filters and columns selected
- Row count
- Whether the export was sync or async
- For bulk updates: before/after snapshot IDs, rows changed, conflict resolution choices
- For restores: snapshot ID, mode (full/selective), rows affected

---

## 16. Technology Stack

### 16.1 New Crates

| Crate | Version | License | Purpose |
|---|---|---|---|
| `rust_xlsxwriter` | 0.80+ | MIT/Apache-2.0 | XLSX file generation with constant memory mode |
| `typst` | Latest | MIT | PDF generation via Typst typesetting engine (used as library via `typst-as-lib`) |
| `parquet` | 57+ | Apache-2.0 | Parquet file writing (columnar format for analytics) |
| `arrow` | 57+ | Apache-2.0 | Columnar data representation (required by `parquet`) |

### 16.2 Existing Crates (Reused)

| Crate | Already In | Used For |
|---|---|---|
| `csv` | Doc 24 (Import) | CSV writing (BurntSushi's crate -- confirmed full write support) |
| `serde_json` | Core stack | JSON export with pretty-print and streaming |
| `calamine` | Doc 24 (Import) | XLSX reading (for bulk update file parsing) |
| `strsim` | Doc 24 (Import) | Jaro-Winkler fuzzy matching (for column auto-mapping in bulk update) |
| `axum` | Core stack | HTTP endpoints, streaming responses, multipart upload |
| `tokio` | Core stack | Async runtime, background worker tasks, file I/O |
| `sqlx` | Core stack | Database queries, transactions, job queue |
| `chrono` | Core stack | Timestamp formatting in exports |
| `uuid` | Core stack | Job IDs, record IDs |
| `tokio-util` | Core stack (transitive) | `ReaderStream` for streaming file downloads |

### 16.3 No New Frontend Libraries

The Export Dialog, My Exports page, Bulk Update wizard, and Snapshot management UI use existing React components from the project's UI framework (forms, modals, tables, dialogs, toast notifications). No new frontend dependencies are required.

### 16.4 License Compliance

All new crates use MIT, Apache-2.0, or MIT/Apache-2.0 dual licensing. All are fully compliant with the project's licensing requirements (no GPL/AGPL/copyleft).

---

## 17. User Stories

1. **As an operator**, I want to export the currently filtered points list from Settings to CSV, so I can analyze point configurations in Excel.

2. **As an engineer**, I want to export the point data bound to my console workspace as a CSV snapshot, so I can share current readings with a colleague who doesn't have system access.

3. **As a shift supervisor**, I want to export the past week's log entries to PDF, so I can include them in a handover package.

4. **As an administrator**, I want to download a template of all point configurations, modify area assignments and criticality levels in Excel, and reimport to update 500 points at once -- instead of editing each one individually.

5. **As an administrator**, I want to see a field-level diff preview of all changes before a bulk update is applied, so I can catch mistakes before they affect production configuration.

6. **As an administrator**, I want the system to automatically create a snapshot before any bulk update, so I can roll back if something goes wrong.

7. **As an administrator**, I want to restore a single point's configuration from a previous snapshot without restoring everything, so I can fix a targeted mistake without undoing other correct changes.

8. **As a user**, I want to see my in-progress and completed exports in one place (My Exports), so I can download files when they're ready without waiting at the screen.

9. **As an administrator**, I want to see all users' export jobs and cancel resource-intensive ones if the server is under load.

10. **As a data analyst**, I want to export a dashboard widget's historical data to Parquet, so I can analyze it in a Jupyter notebook or DuckDB without format conversion.

11. **As a compliance officer**, I want to export round completion history to XLSX with column selection, so I can prepare regulatory compliance evidence.

12. **As an administrator**, I want to create a manual snapshot of the user table before making role changes, so I have a restore point if something goes wrong with bulk role assignment.

---

## 18. Success Criteria

- [ ] Export button appears in every module's table toolbar
- [ ] Dashboard widgets have "Export Data" in their kebab menu
- [ ] Export dialog shows current view filters, column picker, and row count
- [ ] All 6 export formats (CSV, XLSX, PDF, JSON, Parquet, HTML) produce valid, parseable files
- [ ] CSV and JSON exports stream directly for small datasets (no temp file)
- [ ] XLSX uses constant memory mode for large exports
- [ ] Exports < 50K rows complete synchronously within 10 seconds
- [ ] Exports >= 50K rows run asynchronously with progress updates via WebSocket
- [ ] My Exports page shows all user's exports with status, size, and download link
- [ ] Admins can see all users' exports and cancel in-progress jobs
- [ ] Graphics export in PDF/HTML includes rendered SVG with frozen point values
- [ ] Admin Bulk Update wizard validates uploads and shows accurate field-level diff preview
- [ ] Concurrency detection flags rows modified since template export
- [ ] Automatic snapshots are created before every bulk update apply
- [ ] Manual snapshots can be created for any supported table
- [ ] Snapshot restoration shows "what will change" preview before executing
- [ ] Restoration creates its own snapshot before applying (reversible restores)
- [ ] Selective restore allows picking individual records from a snapshot
- [ ] Forbidden fields never appear in any export output or column picker
- [ ] All export, bulk update, and snapshot operations are logged to audit_log
- [ ] Export files include watermark metadata identifying the exporter
- [ ] Export files are automatically cleaned up after retention period

---

## 19. Integration Points

| Document | Integration Required |
|---|---|
| **01_TECHNOLOGY_STACK** | Add new crates: rust_xlsxwriter, typst, parquet, arrow |
| **02_SYSTEM_ARCHITECTURE** | Add export/bulk-update/snapshot endpoints to API Gateway responsibilities |
| **03_SECURITY_RBAC** | Add export/bulk-update/snapshot permissions, add audit action types |
| **04_DATABASE_DESIGN** | Add 3 new tables (export_jobs, change_snapshots, change_snapshot_rows), new schema domain |
| **05_DEVELOPMENT_PHASES** | Add Export System sub-phase to development timeline |
| **06_FRONTEND_SHELL** | Add "My Exports" link in user menu dropdown |
| **07_CONSOLE_MODULE** | Add export button to workspace toolbar, graphics export modes |
| **08_PROCESS_MODULE** | Add export button to view toolbar, graphics export modes |
| **09_DESIGNER_MODULE** | Add export button for graphics metadata list and point bindings |
| **10_DASHBOARDS_MODULE** | Add per-widget kebab menu "Export Data" option |
| **11_REPORTS_MODULE** | Promote XLSX from "future" to included, add JSON format. Clarify Reports vs Universal Export distinction. |
| **12_FORENSICS_MODULE** | Add XLSX, JSON, PDF formats to existing CSV export. Clarify Forensics vs Universal Export distinction. |
| **13_LOG_MODULE** | Add export button for log entry table and templates |
| **14_ROUNDS_MODULE** | Add export button for templates, results, and schedule tables |
| **15_SETTINGS_MODULE** | Add Bulk Update wizard section, Snapshot management section, export buttons on all tables |
| **16_REALTIME_WEBSOCKET** | Add `export_notification` and `export_progress` message types |
| **21_API_DESIGN** | Add `/api/exports/*`, `/api/bulk-update/*`, `/api/snapshots/*` endpoint namespaces |
| **22_DEPLOYMENT_GUIDE** | Add export file storage directory configuration and cleanup cron |

---

## 20. Promoted Features (v1)

The following capabilities were originally deferred but are now included in the v1 build:

- **Scheduled exports**: Run exports on a cron schedule, building on the Import Service's scheduling infrastructure (doc 24). Example: "Export daily alarm summary to CSV every morning at 06:00."
- **Email delivery with attachments**: Export completion emails attach the export file directly (for exports under a configurable size threshold, e.g., 10 MB). Larger exports still use download links. This is a requirement — sites on closed networks may relay email externally but internal download links would be inaccessible to off-network recipients.
- **Export presets**: Save export configurations (format, columns, filters) as named presets for reuse. Users can have presets like "Daily Alarm CSV" or "Monthly Point Report." One-click re-run with optional date range override.
- **Complex JSONB bulk editing**: Tree-editor for nested configurations (dashboard widget layouts, import field mappings) in the Bulk Update wizard. Extends flat CSV/XLSX editing with structured JSON navigation.
- **Snapshot comparison**: Side-by-side diff of two change snapshots showing what changed between them. Useful for verifying bulk update results and tracking configuration drift. Highlights added/removed/modified rows with per-field diff.
- **Snapshot retention automation**: Configurable auto-delete policies for old snapshots (e.g., "keep for 90 days, except snapshots linked to audit events"). Without this, admins must manually clean up accumulated snapshots.
- **Typst PDF engine**: Use `typst` (MIT, via `typst-as-lib`) instead of `genpdf` for PDF generation. Produces professional output with proper typography, page headers/footers, tables that span pages correctly, embedded charts, and branded templates. Used by Reports, Log, Export, and any module generating PDF output.

## 21. Future Extensibility

The following capabilities remain deferred:

- **Graphics interchange (.iographic)**: Full graphic export/import capability including SVG content, tag-based portable bindings, shape/stencil references, pipe routing, and layer definitions. Packaged as `.iographic` ZIP files for cross-instance portability. See doc 39 for the complete format specification, doc 09 for the Designer export/import UI.

---

## Change Log

- **v0.7**: Replaced 3-column role format (Admin/Power User/User) with "Default Roles" column listing canonical 8-role names in both module export and system permission tables. Added doc 03 cross-reference notes.
- **v0.6**: Fixed stale references in Integration Points table — `genpdf` → `typst` (already changed in body at v0.5), removed hardcoded permission count from RBAC row.
- **v0.5**: Deferred items review — promoted 7 items to v1: scheduled exports, email with attachments (requirement for closed networks), export presets, JSONB bulk editing tree-editor, snapshot comparison, snapshot retention automation, Typst PDF engine (replaces genpdf). Reorganized Future Extensibility into Promoted Features (v1) and remaining deferred items. Updated PDF crate from `genpdf` to `typst` (MIT, via `typst-as-lib`) throughout.
- **v0.4**: Replaced deferred "Graphics layout export" with `.iographic` native graphic interchange format. Added Native Graphic Interchange section to Graphics Export (Section 5). `.iographic` packages contain full editable graphic definitions with tag-based portable bindings for cross-instance transfer. See doc 39 for format spec, doc 09 for Designer UI.
- **v0.3**: Added PDF Print Enhancements section. Additional page sizes (A3, Tabloid/Ledger, A1 for wall-mount plotter output). Watermark system ("UNCONTROLLED COPY" default, admin-configurable text and toggle, per-print override). Graphics print formats: Wall Mount (fills page, minimal margins, optional title bar) and Reference (border, title block, alarm legend, point table). Print color normalization applied to server-side PDF (same rules as browser print in doc 06). Updated PDF format-specific options with A3/Tabloid/A1 and watermark toggle.
- **v0.2**: Promoted email notifications from placeholder/future to active. Export completion emails now delivered via the Email Service (doc 28) using the `export_complete` template. Removed SMTP prerequisite from UI checkbox. Updated notification path and future extensibility sections. See 28_EMAIL_SERVICE.md.
- **v0.1**: Initial design. Universal Export with 6 formats (CSV, XLSX, PDF, JSON, Parquet, HTML), export dialog with filter inheritance and column picker, sync/async pipeline with 50K-row threshold, My Exports page. Admin Bulk Update with 4-step wizard (upload, validate/map, diff preview, results), template export/reimport, concurrency detection, idempotent reimport. Change Snapshots with automatic pre-update and manual creation, full rollback and selective restore, restoration-before-restore safety, indefinite retention. 3 database tables (export_jobs, change_snapshots, change_snapshot_rows), ~18 API endpoints across 3 groups, 10 new RBAC permissions (63 → 73 total). Per-module exportable data inventory with 3-tier field classification (Public/Restricted/Forbidden). Graphics export (PDF/HTML with embedded SVG). WebSocket notification with email placeholder.
