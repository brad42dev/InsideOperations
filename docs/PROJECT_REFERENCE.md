# Inside/Operations — Project Reference

> **Keep this file current.** When the tech stack, services, modules, or build model changes, update here.
> A PostToolUse hook reminds you when `package.json` or `Cargo.toml` is modified.
> The `design-docs/` directory is frozen at initial commit — this file is the authoritative current record.

---

## Technology Stack

### Backend (Rust)
- **Web Framework:** Axum 0.7
- **Async Runtime:** Tokio
- **Database:** SQLx 0.8 (PostgreSQL/TimescaleDB)
- **WebSocket:** tokio-tungstenite 0.21
- **Auth:** jsonwebtoken 9 (JWT), argon2 0.5 (passwords), totp-rs 5 (MFA/TOTP), samael 0.0.19 (SAML), openidconnect 3 (OIDC), ldap3 0.11 (LDAP)
- **Serialization:** serde, serde_json
- **Logging/Tracing:** tracing 0.1, tracing-subscriber 0.3
- **Metrics:** metrics 0.23 + metrics-exporter-prometheus 0.15
- **PDF Generation:** typst-as-lib 0.15 (optional feature flag `typst-pdf` on api-gateway)
- **SVG Rendering:** resvg 0.44 + tiny-skia 0.11 (thumbnail/export rendering in api-gateway)
- **File Scanning:** YARA-X 0.10 via `io-scan` crate (malware/policy enforcement)
- **TLS/Certificates:** rcgen 0.13 + x509-parser 0.16 (self-signed cert generation)
- **Expression Eval:** rhai 1.19 (expression builder evaluation)
- **Export Formats:** csv 1, calamine 0.26 (Excel read), rust_xlsxwriter 0.81 (Excel write), parquet 52 (Parquet)
- **Signal Processing:** rustfft 6.4, realfft 3.5, ndarray 0.16, ndarray-stats 0.6, rayon 1.10
- **Email:** lettre 0.11, minijinja 2 (templates)
- **OPC UA:** async-opcua 0.17
- **HTTP Client:** reqwest 0.12 (rustls-tls)
- **Misc:** zip 2, aes-gcm 0.10, sha2, hmac, dashmap 6, rhai 1.19, sd-notify 0.4

> **Note:** `instant-acme` was planned for ACME/Let's Encrypt but is NOT in the codebase. Certificate management uses `rcgen` + `x509-parser` for self-signed only.

### Frontend (React/TypeScript)
- **Framework:** React 18 + TypeScript, Vite, react-router-dom
- **State:** Zustand (client), TanStack Query (server), zundo (undo/redo middleware — Console WorkspaceStore)
- **UI Primitives:** Radix UI (context-menu, dialog, dropdown-menu, slot, toast, tooltip)
- **Styling:** Tailwind CSS + PostCSS + autoprefixer
- **Charting:**
  - uPlot — time-series charts
  - Apache ECharts — general non-time-series charts
  - Plotly.js (`plotly.js-dist-min`) — statistical/3D charts (histogram, surface 3D, probability plots)
  - mathjs — math evaluation for SPC charts (CUSUM, Shewhart, EWMA)
- **Data Tables:** TanStack Table (virtual scrolling)
- **Drag & Drop:** @dnd-kit/core + @dnd-kit/sortable + @dnd-kit/utilities (Forensics, Dashboards, Expression Builder)
- **SVG Editing:** @svgdotjs/svg.js (Designer module)
- **Rich Text:** Tiptap (starter-kit + extensions: color, font-family, image, table, text-style, underline) — Log module
- **Maps/Tiles:** Leaflet (TileGraphicViewer component — geographic overlays)
- **Zoom/Pan:** react-zoom-pan-pinch (Console panes, Process module touch zoom)
- **Barcode/QR:** @zxing/library (Rounds mobile — equipment tag scanning)
- **Command Palette:** cmdk (AppShell global command palette)
- **Spatial Index:** rbush (Process module viewport culling, >2000 elements)
- **Real-Time:** Native WebSocket API (SharedWorker in Console)

### Database
- **Primary:** PostgreSQL 16+
- **Time-Series:** TimescaleDB 2.13+
- **Migrations:** sqlx-cli
- **Schema:** ~106 tables across operational, time-series, auth, integration, and metrics schemas

### Infrastructure
- **Reverse Proxy:** nginx (TLS termination, static file serving)
- **Process Management:** systemd (production) / `./dev.sh` (development)
- **Containerization:** Docker Compose (development database only)

---

## Application Overview

**Inside/Operations** is a web application for refinery and industrial process monitoring providing real-time data visualization from OPC UA servers (10,000+ concurrent data points, <2s update latency).

### 11 Frontend Modules

| Module | Purpose |
|--------|---------|
| Console | Multi-pane real-time graphics workspaces |
| Process | Single-pane large-scale process views |
| Designer | Graphics/dashboard/report editor (3 modes) |
| Dashboards | Widget-based real-time dashboards |
| Reports | Canned + custom report generation (38 canned) |
| Forensics | Data correlation and investigation |
| Log | WYSIWYG operational logbook |
| Rounds | Equipment inspection checklists (mobile PWA) |
| Settings | System configuration (incremental across phases) |
| Shifts | Shift management, badge events, presence |
| Alerts | Human-initiated notifications, muster command center |

### 11 Backend Services

| Service | Port | Purpose |
|---------|------|---------|
| API Gateway | 3000 | HTTP routing, JWT validation, RBAC enforcement, PDF/export/SVG rendering |
| Data Broker | 3001 | WebSocket broker, subscription registry, backpressure |
| OPC Service | 3002 | OPC UA client, metadata crawling, subscription batching |
| Event Service | 3003 | Unified event model, ISA-18.2 alarm state machine |
| Parser Service | 3004 | File parsing (SVG, DXF, DCS native formats) |
| Archive Service | 3005 | TimescaleDB management, compression, retention |
| Import Service | 3006 | Universal Import ETL pipeline, connector templates |
| Alert Service | 3007 | Alert engine, escalation, shift-aware routing |
| Email Service | 3008 | Transactional email, templates, queue, bounce handling |
| Auth Service | 3009 | Multi-provider auth, MFA, SCIM, API keys |
| Recognition Service | 3010 | P&ID + DCS symbol recognition (.iomodel inference) |

### 12 Shared Crates

| Crate | Purpose |
|-------|---------|
| `io-auth` | JWT validation, RBAC middleware |
| `io-bus` | Inter-service message bus |
| `io-db` | Database connection pool, query helpers |
| `io-error` | Consistent error types, user-facing messages |
| `io-models` | Shared domain models and types |
| `io-opc` | OPC UA client abstractions |
| `io-time` | Time utilities, TimescaleDB helpers |
| `io-validate` | Input validation |
| `io-export` | Export format utilities |
| `io-health` | Health check framework |
| `io-observability` | Prometheus metrics, distributed tracing |
| `io-scan` | YARA-X file scanning (malware/policy enforcement) |

### Security Model
- 118 RBAC permissions across 15 modules
- 8 roles: Viewer, Operator, Analyst, Supervisor, Content Manager, Maintenance, Contractor, Admin
- JWT auth (15min access / 7-day refresh), ticket-based WebSocket auth
- IO_SERVICE_SECRET for inter-service auth

---

## Build Infrastructure

### Two-Machine Model

| Machine | Role |
|---------|------|
| Server 1 (this machine) | Claude Code dev, Docker Compose DB, compile, test, produce installers |
| Server 2 (demo/live) | Always-online, native PostgreSQL + TimescaleDB, SimBLAH OPC simulator, nginx |

### Installer Milestones

| Installer | After Phase | Contents |
|-----------|-------------|----------|
| v0.2 | 2 | Services (stubs), full DB, auth, user/role management |
| v0.4 | 4 | + App shell, themes, Settings core, certificates, backup |
| v0.7 | 7 | + OPC pipeline, graphics, Console, Process — **demo-ready** |
| v0.9 | 9 | + Expression builder, alarms, reports, export pipeline |
| v0.13 | 13 | + Dashboards, forensics, log, rounds, alerts, shifts, email |
| v0.16 | 16 | + Import, recognition, Modbus/MQTT, enterprise auth — **feature-complete** |
| v1.0 | 17 | Security hardened, load tested, accessible — **production release** |

---

## Design Documents Index

`design-docs/` contains 40 documents. **These are frozen at initial commit** — they describe the plan, not necessarily what's built. The spec_docs in `/home/io/spec_docs/` are more current for covered modules.

### Foundation (00–05)
| Doc | Title | Scope |
|-----|-------|-------|
| 00 | PROJECT_OVERVIEW | Vision, goals, module summary, success metrics |
| 01 | TECHNOLOGY_STACK | Tech choices with licensing rationale ⚠️ outdated — see above |
| 02 | SYSTEM_ARCHITECTURE | 11 services, data flows, auth flow, schema overview |
| 03 | SECURITY_RBAC | 118 permissions, 8 roles, audit logging, input validation |
| 04 | DATABASE_DESIGN | Full DDL, ~106 tables, indexes, triggers, retention, seed data |
| 05 | DEVELOPMENT_PHASES | 17-phase demo-first plan, 44–77 weeks, parallel opportunities |

### Module Requirements (06–15)
| Doc | Title | Scope |
|-----|-------|-------|
| 06 | FRONTEND_SHELL | App shell, navigation, 3 themes, design tokens, global search |
| 07 | CONSOLE_MODULE | Multi-pane workspaces, grid layout, real-time SVG graphics |
| 08 | PROCESS_MODULE | Large-scale single-pane views, zoom/pan, viewport optimization |
| 09 | DESIGNER_MODULE | Graphics/dashboard/report editor, file import, point binding |
| 10 | DASHBOARDS_MODULE | Widget-based dashboards, 8 widget types, template variables |
| 11 | REPORTS_MODULE | 38 canned reports, async Typst PDF generation, scheduling |
| 12 | FORENSICS_MODULE | Multi-source correlation, investigation model, pattern detection |
| 13 | LOG_MODULE | WYSIWYG operational logbook (Tiptap), templates, attachments |
| 14 | ROUNDS_MODULE | Equipment inspection checklists, scheduling, offline mobile |
| 15 | SETTINGS_MODULE | Incremental across phases — user/role/cert/OPC/system config |

### Technical Design (16–22)
| Doc | Title | Scope |
|-----|-------|-------|
| 16 | REALTIME_WEBSOCKET | Broker protocol, subscription registry, backpressure, adaptive throttling |
| 17 | OPC_INTEGRATION | OPC UA client, metadata crawling, subscription batching |
| 18 | TIMESERIES_DATA | Hypertables, continuous aggregates, compression, retention |
| 19 | GRAPHICS_SYSTEM | SVG rendering, point bindings, value mapping, 6 display element types |
| 20 | MOBILE_ARCHITECTURE | PWA, connectivity-resilient model, touch targets, IndexedDB sync |
| 21 | API_DESIGN | REST conventions, /api/v1/ prefix, error format, pagination, filtering |
| 22 | DEPLOYMENT_GUIDE | 3 deployment profiles (Standalone/Resilient/Enterprise HA), systemd, nginx |

### Cross-Cutting Design (23–39)
| Doc | Title | Scope |
|-----|-------|-------|
| 23 | EXPRESSION_BUILDER | Tile-based drag-and-drop, AST serialization, Rhai evaluation |
| 24 | UNIVERSAL_IMPORT | ETL pipeline, 40 connector templates, scheduling, wizard UI |
| 25 | EXPORT_SYSTEM | 6 formats, bulk update wizard, change snapshots |
| 26 | PID_RECOGNITION | P&ID + DCS symbol recognition, .iomodel consumption, .iogap gap reports |
| 27 | ALERT_SYSTEM | Alert engine, escalation policies, shift-aware routing, mustering |
| 28 | EMAIL_SERVICE | Transactional email, templates, queue management, bounce handling |
| 29 | AUTHENTICATION | Multi-provider (Local/OIDC/SAML/LDAP), MFA, SCIM, API keys |
| 30 | ACCESS_CONTROL_SHIFTS | Badge integration, shift management, presence tracking, mustering |
| 31 | ALERTS_MODULE | Human-initiated alerts, emergency notifications, muster command center |
| 32 | SHARED_UI_COMPONENTS | Charting (uPlot/ECharts), TanStack tables, widget configs, shared interactions |
| 33 | TESTING_STRATEGY | CI pipeline, backend/frontend/E2E testing, security & accessibility testing |
| 34 | DCS_GRAPHICS_IMPORT | Per-platform DCS extraction kits, import wizard, 12 platforms assessed |
| 35 | SHAPE_LIBRARY | 25 Tier 1 DCS equipment SVG shapes, ISA-101 design, composable parts |
| 36 | OBSERVABILITY | Health checks, Prometheus-format metrics, distributed tracing, shell status |
| 37 | IPC_CONTRACTS | Wire formats, shared types, UDS protocol, NOTIFY payloads, TypeScript parity |
| 38 | FRONTEND_CONTRACTS | Route map (~80 routes), CSS design token registry (138 tokens), sidebar rules |
| 39 | IOGRAPHIC_FORMAT | .iographic portable graphic interchange format — ZIP container, tag-based bindings |
