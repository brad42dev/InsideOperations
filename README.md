# Inside/Operations - Project Build Kit

**Version:** 2.0
**Purpose:** Complete design documentation and build infrastructure for Inside/Operations

---

## Contents

This build kit contains everything needed to construct the Inside/Operations application from design specifications.

### Infrastructure Files

| File | Purpose |
|------|---------|
| **install_server1.sh** | Bootstrap script for Server 1 (Build/Test) — Rust, Node.js, Docker Compose dev DB |
| **install_server2.sh** | Bootstrap script for Server 2 (Demo/Live) — native PostgreSQL, nginx, systemd services |
| **install_baseline.sh** | Legacy generic bootstrap (superseded by server-specific scripts) |
| **IO_initial.md** | Master prompt for Claude Code — read this to begin development |
| **EULA.md** | End User License Agreement (clickwrap, 17 sections + 5 addenda) |
| **design-docs/** | 40 comprehensive design documents |

### Two-VM Build Infrastructure

- **Server 1 (Build/Test)**: Development machine with Claude Code. All compilation, testing, and CI happens here. Docker Compose for dev PostgreSQL. Not always online.
- **Server 2 (Demo/Live)**: Always-online server connected to SimBLAH OPC simulator. Native PostgreSQL + TimescaleDB. Receives installer packages at milestones. Eventual production target.

### Design Documents (design-docs/)

**Foundation (00-05):**
- 00_PROJECT_OVERVIEW — Vision, goals, 11 modules, success metrics
- 01_TECHNOLOGY_STACK — All technology choices with licensing rationale
- 02_SYSTEM_ARCHITECTURE — 11 services, data flows, deployment profiles
- 03_SECURITY_RBAC — 118 RBAC permissions, 8 predefined roles, audit logging
- 04_DATABASE_DESIGN — Complete DDL (~106 tables), indexes, triggers, seed data
- 05_DEVELOPMENT_PHASES — 17-phase demo-first plan (44-77 weeks)

**Module Requirements (06-15):**
- 06_FRONTEND_SHELL — App shell, 3 themes, design tokens, command palette
- 07_CONSOLE_MODULE — Multi-pane real-time graphics workspaces
- 08_PROCESS_MODULE — Large-scale single-pane views with zoom/pan
- 09_DESIGNER_MODULE — Graphics/dashboard/report editor (3 modes)
- 10_DASHBOARDS_MODULE — 8 widget types, template variables, playlists
- 11_REPORTS_MODULE — 38 canned reports, Typst PDF generation
- 12_FORENSICS_MODULE — Multi-source correlation, investigation model
- 13_LOG_MODULE — WYSIWYG operational logbook (Tiptap)
- 14_ROUNDS_MODULE — Equipment inspection checklists, scheduling
- 15_SETTINGS_MODULE — Built incrementally across all phases

**Technical Design (16-22):**
- 16_REALTIME_WEBSOCKET — WebSocket broker, subscriptions, backpressure
- 17_OPC_INTEGRATION — OPC UA client, metadata crawling, batching
- 18_TIMESERIES_DATA — Hypertables, continuous aggregates, compression
- 19_GRAPHICS_SYSTEM — SVG rendering, point bindings, 6 display element types
- 20_MOBILE_ARCHITECTURE — PWA, connectivity-resilient model
- 21_API_DESIGN — REST conventions, /api/v1/ prefix, error format
- 22_DEPLOYMENT_GUIDE — 3 deployment profiles, systemd, nginx, TLS

**Cross-Cutting Design (23-38):**
- 23_EXPRESSION_BUILDER — Tile-based drag-and-drop, Rhai evaluation
- 24_UNIVERSAL_IMPORT — ETL pipeline, 40 connector templates, scheduling
- 25_EXPORT_SYSTEM — 6 export formats, bulk update, change snapshots
- 26_PID_RECOGNITION — P&ID + DCS symbol recognition, .iomodel consumption
- 27_ALERT_SYSTEM — Alert engine, escalation, shift-aware routing
- 28_EMAIL_SERVICE — Transactional email, templates, queue, bounce handling
- 29_AUTHENTICATION — Multi-provider (Local/OIDC/SAML/LDAP), MFA, SCIM
- 30_ACCESS_CONTROL_SHIFTS — Badge integration, shift management, mustering
- 31_ALERTS_MODULE — Human-initiated notifications, muster command center
- 32_SHARED_UI_COMPONENTS — uPlot/ECharts charts, TanStack tables, widgets
- 33_TESTING_STRATEGY — CI pipeline, backend/frontend/E2E/security testing
- 34_DCS_GRAPHICS_IMPORT — 12 DCS platforms, extraction kits, import wizard
- 35_SHAPE_LIBRARY — 25 Tier 1 DCS equipment SVG shapes, ISA-101 style
- 36_OBSERVABILITY — Health checks, metrics, distributed tracing
- 37_IPC_CONTRACTS — Wire formats, shared types, UDS protocol, TypeScript parity
- 38_FRONTEND_CONTRACTS — Route map (~80 routes), CSS token registry (138 tokens)
- 39_IOGRAPHIC_FORMAT — .iographic portable graphic interchange format

---

## Getting Started

### Option A: Fresh Build (Server 1 + Server 2)

**1. Provision two Linux VMs** (Ubuntu 22.04+ LTS recommended)

**2. Bootstrap Server 2 (Demo/Live) first:**
```bash
chmod +x install_server2.sh
sudo ./install_server2.sh
```
This installs native PostgreSQL + TimescaleDB, nginx, creates systemd service units for all 11 services, and sets up the /opt/io directory structure. Server 2 is ready to receive installer packages.

**3. Bootstrap Server 1 (Build/Test):**
```bash
chmod +x install_server1.sh
./install_server1.sh
```
This installs Rust, Node.js, pnpm, Docker Compose (dev database), sqlx-cli, and creates the dev workspace.

**4. Install Claude Code on Server 1**

Follow Claude Code installation instructions for your system.

**5. Start building:**
```bash
mkdir -p ~/io-dev/src
cd ~/io-dev/src
# Copy design-docs/ and IO_initial.md here
claude
```
Open IO_initial.md in Claude Code. It will guide you through reading all 40 design documents and beginning Phase 1.

### Option B: Design Review Only

The design documents are also an Obsidian vault. Open the `InOps/` folder in Obsidian for cross-linked browsing of all 40 documents.

---

## Technology Stack

| Layer | Technology | License |
|-------|-----------|---------|
| Backend | Rust + Axum + Tokio + SQLx | MIT/Apache 2.0 |
| Frontend | React 18 + TypeScript + Vite | MIT |
| State | Zustand (client) + TanStack Query (server) | MIT |
| Database | PostgreSQL 16 + TimescaleDB 2.13+ | PostgreSQL / Apache 2.0 |
| Charting | uPlot (time-series) + Apache ECharts | MIT / Apache 2.0 |
| Tables | TanStack Table | MIT |
| SVG Editor | SVG.js | MIT |
| Rich Text | Tiptap | MIT |
| PDF | Typst (typst-as-lib) | MIT |
| File Scan | YARA-X | BSD-3-Clause |
| ACME | instant-acme (compiled in) | Apache 2.0 |
| Reverse Proxy | nginx | BSD-2-Clause |
| Process Mgmt | systemd | LGPL-2.1 (system) |

**Licensing rule:** ALL dependencies must be royalty-free commercial. No GPL/AGPL/copyleft.

---

## Architecture Summary

- **11 Frontend Modules**: Console, Process, Designer, Dashboards, Reports, Forensics, Log, Rounds, Settings, Shifts, Alerts
- **11 Backend Services**: API Gateway (3000), Data Broker (3001), OPC (3002), Event (3003), Parser (3004), Archive (3005), Import (3006), Alert (3007), Email (3008), Auth (3009), Recognition (3010)
- **11 Shared Crates**: io-auth, io-bus, io-db, io-error, io-models, io-opc, io-time, io-validate, io-export, io-health, io-observability
- **8 Predefined Roles**: Viewer, Operator, Analyst, Supervisor, Content Manager, Maintenance, Contractor, Admin
- **118 RBAC Permissions** across 15 modules
- **~106 Database Tables** with full DDL in doc 04

---

## Build Plan

17 phases with 7 installer milestones. First live SimBLAH demo at Phase 7.

| Installer | Phase | What's New |
|-----------|-------|------------|
| v0.2 | 2 | Auth + RBAC |
| v0.4 | 4 | Frontend shell + Settings foundation |
| v0.7 | 7 | **First live demo** — Console + Process with SimBLAH OPC data |
| v0.9 | 9 | Reports + Export |
| v0.13 | 13 | Alerts + Shifts + Mustering |
| v0.16 | 16 | Feature-complete |
| v1.0 | 17 | Production release |

See doc 05 for full phase details.

---

## Document Authority

| Domain | Authoritative Document |
|--------|----------------------|
| Build order | 05_DEVELOPMENT_PHASES |
| RBAC / Permissions | 03_SECURITY_RBAC |
| Database schema | 04_DATABASE_DESIGN |
| Wire formats / IPC | 37_IPC_CONTRACTS |
| API patterns | 21_API_DESIGN |
| Frontend routes / tokens | 38_FRONTEND_CONTRACTS |
| Deployment | 22_DEPLOYMENT_GUIDE |

All 40 documents have been cross-referenced for consistency.

---

## Success Criteria

The build is successful when:

- All 11 frontend modules operational with specified features
- All 11 backend services running and healthy
- Real-time data flows from OPC to frontend (< 2s latency)
- Authentication and RBAC fully functional (118 permissions enforced)
- WebSocket broker handles 200+ concurrent users
- Mobile PWA works for Log, Rounds, and Alerts
- Installer packages deploy cleanly to Server 2
- Application passes security audit and accessibility review
- Code is clean, tested, documented, and maintainable
