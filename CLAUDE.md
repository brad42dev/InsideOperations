# Inside/Operations — Master Build Prompt

**Project Name:** Inside/Operations (I/O)
**Type:** Industrial Process Monitoring Web Application
**Approach:** Implementation from 40 design specifications

---

## 1. Licensing Requirements (CRITICAL)

**ALL libraries, frameworks, and dependencies used in this project MUST be licensed for royalty-free commercial use.** Before incorporating ANY third-party library, verify its license. This is non-negotiable.

**Acceptable licenses:**
- MIT License
- Apache License 2.0
- BSD License (2-clause, 3-clause)
- ISC License
- PostgreSQL License
- Mozilla Public License 2.0 (for specific components only)

**Explicitly prohibited:**
- GPL, AGPL, LGPL, or any copyleft license
- Ultralytics YOLO (AGPL)
- Cleanlab open-source (AGPL)

If you are uncertain about a dependency's license, do not use it. Find an alternative.

---

## 2. Technology Stack

### Backend
- **Language:** Rust (latest stable)
- **Web Framework:** Axum (async HTTP framework)
- **Async Runtime:** Tokio
- **Database Client:** SQLx (async PostgreSQL driver)
- **WebSocket:** tokio-tungstenite
- **Authentication:** JWT (jsonwebtoken crate), Argon2 (password hashing)
- **Serialization:** serde, serde_json
- **Logging/Tracing:** tracing ecosystem
- **Metrics:** prometheus
- **PDF Generation:** Typst (typst-as-lib, MIT)
- **File Scanning:** YARA-X (BSD-3-Clause)
- **ACME:** instant-acme (Apache-2.0, compiled into API Gateway)

### Frontend
- **Framework:** React 18+ with TypeScript
- **Build Tool:** Vite
- **State Management:** Zustand (client state), TanStack Query (server state)
- **UI Components:** Radix UI primitives
- **Styling:** Tailwind CSS
- **Charting:** uPlot (time-series), Apache ECharts (non-time-series)
- **Data Tables:** TanStack Table (virtual scrolling, 100K+ rows)
- **SVG Editing:** SVG.js (MIT) — Designer module
- **Rich Text:** Tiptap (MIT) — Log module
- **Real-Time:** Native WebSocket API

### Database
- **Primary Database:** PostgreSQL 16+
- **Time-Series Extension:** TimescaleDB 2.13+
- **Migration Tool:** sqlx-cli
- **Schema:** ~106 tables across operational, time-series, auth, integration, and metrics schemas

### Infrastructure
- **Reverse Proxy:** nginx (TLS termination, static file serving)
- **Process Management:** systemd (production)
- **Containerization:** Docker Compose (development database only)

### Development Tools
- **Package Manager (Rust):** Cargo
- **Package Manager (Node):** pnpm
- **Version Control:** Git

---

## 3. Application Overview

**Inside/Operations** is a comprehensive web application for refinery and industrial process monitoring. The system provides:

- **Real-time data visualization** from OPC UA servers (10,000+ concurrent data points, <2s update latency)
- **Multi-pane graphics workspaces** for control room monitoring (Console + Process modules)
- **Graphics editor** for creating and editing process graphics, dashboards, and report layouts (Designer module — 3 modes)
- **Widget-based dashboards** with real-time updates and template variables (Dashboards module)
- **Canned and custom reports** with async PDF/CSV/HTML generation (Reports module — 38 canned reports)
- **Historical data forensics** with multi-source correlation, investigation model, and pattern detection (Forensics module)
- **WYSIWYG operational logging** for shift handovers and equipment documentation (Log module)
- **Equipment inspection checklists** with offline-capable mobile PWA (Rounds module)
- **Expression builder** for calculated points, alarm definitions, and report formulas (tile-based, Rhai evaluation)
- **Universal import/export** with 40 connector templates and 6 export formats
- **Alert engine** with ISA-18.2 alarm state machine, escalation policies, and shift-aware routing
- **Human-initiated emergency notifications** with muster command center (Alerts module)
- **Multi-provider authentication** (Local, OIDC, SAML, LDAP) with MFA and SCIM provisioning
- **Badge integration, shift management, and mustering** (Access Control & Shifts module)
- **P&ID and DCS symbol recognition** consuming .iomodel packages from SymBA

### 11 Frontend Modules

| Module | Purpose |
|--------|---------|
| Console | Multi-pane real-time graphics workspaces |
| Process | Single-pane large-scale process views |
| Designer | Graphics/dashboard/report editor (3 modes) |
| Dashboards | Widget-based real-time dashboards |
| Reports | Canned + custom report generation |
| Forensics | Data correlation and investigation |
| Log | WYSIWYG operational logbook |
| Rounds | Equipment inspection checklists (mobile PWA) |
| Settings | System configuration (incremental across phases) |
| Shifts | Shift management, badge events, presence |
| Alerts | Human-initiated notifications, muster command center |

### 11 Backend Services

| Service | Port | Purpose |
|---------|------|---------|
| API Gateway | 3000 | HTTP routing, JWT validation, RBAC enforcement |
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

### 11 Shared Crates (io-* workspace)

io-auth, io-bus, io-db, io-error, io-models, io-opc, io-time, io-validate, io-export, io-health, io-observability

### Security Model

- 118 RBAC permissions across 15 modules
- 8 predefined roles: Viewer, Operator, Analyst, Supervisor, Content Manager, Maintenance, Contractor, Admin
- JWT auth (15min access / 7-day refresh), ticket-based WebSocket auth
- Comprehensive audit logging, IO_SERVICE_SECRET for inter-service auth

---

## 4. Build Infrastructure

### Two-VM Model (from doc 05)

**Server 1 — Build/Test (this machine):**
- Claude Code development machine
- Docker Compose for dev PostgreSQL + TimescaleDB
- Compiles all Rust services and frontend
- Runs all tests
- Produces installer packages

**Server 2 — Demo/Live:**
- Always-online, native PostgreSQL + TimescaleDB
- Receives installer packages from Server 1
- Connected to SimBLAH OPC simulator for live data
- Runs production systemd services behind nginx

### Installer Model

7 milestone installers deliver incremental functionality:

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

## 5. Design Documents

The `design-docs/` folder contains **40 design documents**. These are the source of truth. Read ALL of them before writing code.

### Foundation (00–05)

| Doc | Title | Scope |
|-----|-------|-------|
| 00 | PROJECT_OVERVIEW | Vision, goals, module summary, success metrics |
| 01 | TECHNOLOGY_STACK | Tech choices with licensing rationale |
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

### Cross-Cutting Design (23–38)

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

### Authority Documents

These docs are the canonical reference for their domain. When in doubt, they win:

- **Doc 03** — RBAC authority (118 permissions, 8 roles, all permission names)
- **Doc 04** — Schema authority (all table DDL, indexes, triggers, seed data)
- **Doc 05** — Build order authority (17 phases, what ships when)
- **Doc 37** — Wire format authority (every inter-service message shape, REST envelope, error codes, TypeScript parity)

---

## 6. Task Instructions

### Step 1: Read and Understand All 40 Design Documents

Read every document in `design-docs/`. Take time to understand:

- The 11-service architecture and how services communicate (UDS primary, NOTIFY/LISTEN fallback)
- Data flows: OPC UA → OPC Service → Data Broker → WebSocket → frontend
- The security model: JWT + RBAC + audit logging + ticket-based WebSocket auth
- The database schema (~106 tables across multiple schemas)
- Performance targets: <2s point updates, <1.5s graphic render, <200ms API p95, 200+ concurrent users
- Each module's purpose, features, and requirements
- The 17-phase build sequence and what each installer delivers

### Step 2: Deep Dive and Analysis

After reading all documents:

1. **Identify technical challenges** — Real-time data handling, WebSocket fanout at scale, SVG rendering with 3,000+ elements, time-series aggregation, OPC UA connection management
2. **Understand data relationships** — How OPC data flows from source to UI, how user data is stored, how the equipment table serves as cross-domain join key
3. **Map dependencies** — Which services depend on which shared crates, which modules can be built in parallel per doc 05
4. **Internalize the wire formats** — Doc 37 defines every inter-service message. All Rust services consume these via io-* crates. TypeScript types must match.
5. **Clarify requirements** — If any design doc is unclear, ask for clarification before proceeding

### Step 3: Create Custom Agents

Create specialized agents to assist with development. Consider:

- **Rust Backend** — Axum, Tokio, async Rust, SQLx, service architecture
- **React Frontend** — React 18, TypeScript, Vite, Zustand, TanStack Query, Radix UI
- **Database** — PostgreSQL, TimescaleDB, schema design, migrations, seed data
- **WebSocket/Real-Time** — tokio-tungstenite, subscription management, backpressure, adaptive throttling
- **Security** — JWT, RBAC, Argon2, multi-provider auth, SCIM, MFA
- **API Design** — REST patterns, error handling, validation, pagination
- **OPC UA** — Industrial protocols, metadata crawling, subscription batching
- **Testing** — Unit, integration, E2E, CI pipeline (doc 33)
- **DevOps** — Docker Compose (dev), systemd + nginx (production), installer packaging

Create these as reusable tools invokable throughout development. Each agent should be specialized and able to work autonomously within its domain.

### Step 4: Initialize Project Structure

1. **Create a Git repository** in the current directory
2. **Initialize the project structure:**
   - Cargo workspace with 11 service crates + 11 shared io-* crates
   - Frontend package (React 18 + TypeScript + Vite)
   - Database migrations folder
   - Docker Compose for dev PostgreSQL + TimescaleDB
   - Installer packaging scripts
3. **Set up development environment** — .env template, .gitignore, workspace Cargo.toml
4. **Create README.md** with project overview and setup instructions

### Step 5: Execute Phased Development

Follow the **17-phase development approach** in `05_DEVELOPMENT_PHASES.md`. The phases are demo-first — each phase produces a testable increment on Server 2.

**For each phase:**

1. **Review phase requirements** from the relevant design docs
2. **Plan the implementation** — Break into tasks, assign to appropriate agents
3. **Build and test** — Use shared crates, follow wire formats from doc 37
4. **Verify RBAC** — Every endpoint must enforce permissions from doc 03
5. **Package installer** — At milestone phases (v0.2, v0.4, v0.7, v0.9, v0.13, v0.16, v1.0)
6. **Commit regularly** — Atomic commits with clear messages

---

## 7. Quality and Best Practices

Throughout development:

- **Write clean, idiomatic code** — Rust best practices (clippy clean), React best practices (hooks, composition)
- **Handle errors using the io-error crate** — Consistent error types across all services, user-friendly messages in UI
- **Structured logging** — tracing ecosystem, appropriate log levels, correlation IDs
- **Validate all inputs** — API validation (io-validate crate), form validation, SQL parameter binding
- **Performance** — Async everywhere in Rust, virtual scrolling for large lists, LOD optimization for graphics
- **Security by default** — HTTPS only, JWT with expiration, Argon2 password hashing, RBAC on every endpoint, audit logging
- **Test critical paths** — Unit tests for business logic, integration tests for APIs, E2E for critical workflows (doc 33)
- **Observability** — Health endpoints on every service, Prometheus metrics, distributed tracing (doc 36)
- **Document complex logic** — Code comments for non-obvious implementations, API documentation

---

## 8. Success Criteria

The project is successful when:

1. All 11 frontend modules are implemented with their specified features
2. All 11 backend services are operational, healthy, and passing health checks
3. All 11 shared crates are published to the workspace and consumed by services
4. Real-time data flows from OPC UA sources through Data Broker to frontend UI at <2s latency
5. 118 RBAC permissions are enforced across all API endpoints and UI routes
6. Multi-provider authentication (Local + OIDC + SAML + LDAP) works with MFA
7. The database schema (~106 tables) supports all modules with proper relationships and retention
8. WebSocket broker handles 200+ concurrent connections with adaptive throttling
9. All 7 milestone installers deploy cleanly to Server 2
10. All 17 development phases are complete
11. Frontend is responsive, accessible, and meets the "professional calm" aesthetic
12. Code is clean, tested, documented, and maintainable

---

**The design docs are the source of truth. All 40 documents have been cross-referenced for consistency. When you encounter a conflict between your assumptions and a design doc, the design doc wins. Start by reading all 40 documents, then begin Phase 1.**

Good luck building Inside/Operations! 🚀
