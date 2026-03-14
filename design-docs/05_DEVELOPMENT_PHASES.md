# Inside/Operations - Development Phases

## Phased Development Approach

Build Inside/Operations incrementally through 17 phases. The plan is structured around two priorities: (1) get a live OPC demo running against SimBLAH as fast as possible, and (2) fill in remaining modules and features from there.

### Build Infrastructure

Two Linux VMs serve distinct roles throughout development:

- **Server 1 (Build/Test)**: Development machine with Claude Code. All compilation, testing, and CI happens here. Hosts a local PostgreSQL + TimescaleDB instance for test data. Not always online — only active during development sessions.
- **Server 2 (Demo/Live)**: Always-online server connected to SimBLAH OPC simulator. Receives installer packages at major milestones. Serves as the running demo environment and eventual production target. Runs its own PostgreSQL + TimescaleDB instance with live SimBLAH data.

### Installer Package Model

At designated milestones (marked with 📦 below), a versioned installer package is built on Server 1 and deployed to Server 2. The installer:

1. Stops running services
2. Backs up the database
3. Deploys new binaries and frontend assets
4. Runs any pending migrations
5. Restarts services
6. Runs a smoke test suite

The installer framework itself is built in Phase 1. Each subsequent installer milestone adds the new phase's components to the package.

### Settings Module — Incremental Build

Settings is not a single phase. Each phase that introduces configurable features also builds the corresponding Settings tabs/pages. By the end of all phases, Settings is complete.

---

## Phase 1: Foundation (3-5 weeks)

**Goal:** Scaffold all 11 backend services, deploy full database schema, build shared crates, and create the installer framework.

**Tasks:**
1. Initialize Cargo workspace with all 11 service crates (API Gateway, Data Broker, OPC Service, Event Service, Parser Service, Archive Service, Import Service, Alert Service, Email Service, Auth Service, Recognition Service)
2. Set up frontend package structure (React 18 + TypeScript + Vite)
3. Configure PostgreSQL 16 + TimescaleDB 2.13+ (Docker Compose for Server 1, native install for Server 2)
4. Implement database migration framework (sqlx-cli)
5. Create full initial migration set — all ~106 tables from doc 04 (users, roles, permissions, points, hypertables, events, alarms, equipment, integrations, shifts, badges, etc.)
6. Build shared crates: io-auth, io-bus, io-db, io-error, io-models, io-opc, io-time, io-validate, io-export, io-health, io-observability
7. Implement health check endpoints (`/healthz`) on all services with standard format (doc 36)
8. Set up structured logging with tracing (doc 36 observability spec)
9. Set up Prometheus-format metrics collection routed to TimescaleDB `io_metrics` schema (doc 36)
10. Implement systemd service unit files for all 11 services
11. Implement systemd `LoadCredentialEncrypted` for IO_MASTER_KEY (doc 03 secrets management)
12. Build installer framework: packaging script (Server 1), deployment script (Server 2), backup/restore, migration runner, smoke test harness
13. Seed database with default admin user, 8 predefined roles, 118 RBAC permissions, connector templates
14. Create development script (`./dev.sh start/stop/status/logs`)

**Deliverables:**
- All 11 services compile and start (stub handlers only)
- Full database schema deployed with seed data
- All shared crates available in workspace
- Installer framework functional (package → deploy → verify cycle tested)
- Health endpoints responding on all services
- Metrics flowing to `io_metrics` schema

**Milestone:** Development environment fully scaffolded. All services running as stubs.

---

## Phase 2: Auth & Core API (2-4 weeks)

**Goal:** Implement authentication, RBAC enforcement, and core API Gateway patterns. First installer deployment to Server 2.

**Tasks:**
1. Implement JWT token generation and validation (15min access / 7-day refresh)
2. Create authentication endpoints (login, logout, refresh, session management)
3. Implement password hashing with Argon2
4. Implement RBAC middleware with 118-permission enforcement
5. Create user management APIs (CRUD)
6. Create role and permission management APIs
7. Implement group management with role assignment (group_roles junction table)
8. Implement API Gateway routing patterns — REST conventions, error format, pagination, filtering (doc 21)
9. Implement inter-service auth (IO_SERVICE_SECRET Bearer token)
10. Implement UDS (Unix Domain Socket) IPC between services (doc 37)
11. Implement EULA acceptance flow (doc 29)
12. Implement audit logging for all auth events
13. Implement 3-concurrent-session enforcement (SharedWorker = 1 session)
14. Set up CORS, rate limiting, input validation middleware
15. Build Settings → User Management tab
16. Build Settings → Role Management tab (clone-based custom roles)

**Deliverables:**
- Login/logout working with JWT
- Protected endpoints enforce RBAC
- Inter-service auth operational over UDS
- Audit log captures auth events
- User and role management functional in Settings

**Milestone:** Authentication and authorization complete. 📦 **Installer v0.2** deployed to Server 2.

---

## Phase 3: Real-Time Pipeline (3-5 weeks)

**Goal:** Full OPC UA integration, Data Broker with WebSocket distribution, and Archive Service for historical storage.

**Tasks:**
1. Implement OPC Service: OPC UA client connection, subscription management, metadata crawling (doc 17)
2. Implement subscription batching and reconnection with exponential backoff
3. Implement Data Broker: real-time point value distribution, in-memory point cache (doc 16)
4. Implement WebSocket broker protocol: subscription registry, topic-based routing, backpressure handling
5. Implement ticket-based WebSocket auth (DashMap, 30s TTL, single-use)
6. Implement adaptive throttling: client status_report messages, 5-level per-client escalation, server-wide aggregate monitoring
7. Implement change-only delivery + deadband + max-silence heartbeat (60s) + batched JSON (250ms) + staggered fanout
8. Implement Archive Service: hypertable writes, continuous aggregates, compression policies, retention policies (doc 18)
9. Implement point source management: `point_sources` table, source status tracking, stale data detection (point-level 60s + source-level instant)
10. Implement point lifecycle: never-delete policy, point metadata versioning
11. Implement UOM conversion service (real-time and historical)
12. Implement PostgreSQL NOTIFY/LISTEN fallback for IPC
13. Build Settings → OPC Configuration tab (connection config, browse/subscribe, metadata explorer)
14. Build Settings → Point Source Management tab

**Deliverables:**
- OPC UA client connects to SimBLAH, subscribes to points, receives live values
- Data Broker distributes values via WebSocket to connected clients
- Archive Service writes to hypertables with compression and retention
- Point lifecycle and UOM conversion operational
- OPC and point source configuration functional in Settings

**Milestone:** Live data flowing from SimBLAH through entire pipeline. End-to-end latency <2s.

---

## Phase 4: Frontend Shell & Settings Core (2-4 weeks)

**Goal:** Build the application shell with all navigation, theming, and the core Settings pages not covered by other phases.

**Tasks:**
1. Implement app shell: 3-state sidebar, top bar, content area, notification tray (doc 06)
2. Implement 3 themes (Light, Dark, High Contrast) with 138 CSS design tokens (doc 38)
3. Implement 4-layer design token architecture: preset → parameters → semantic → component
4. Implement command palette (Ctrl+K, cmdk library) with G-key navigation shortcuts
5. Implement visual lock overlay (fades after 60s, data keeps flowing)
6. Implement kiosk mode: read-only base, authenticated interactive layer, non-expiring refresh tokens
7. Implement emergency alert overlay (shell-level banner, non-blocking, pushes content down)
8. Implement route guards with RBAC permission checks (~80 routes from doc 38)
9. Implement frontend error boundaries and loading states
10. Implement SharedWorker for multi-tab WebSocket sharing
11. Build Settings → System Health page (service status, metrics display from io_metrics, doc 36)
12. Build Settings → Appearance tab (theme, density mode, scale preference)
13. Build Settings → Certificate Management tab (server certs, client certs, trusted CAs, self-signed generation via rcgen)
14. Build Settings → Backup/Restore tab (.iobackup encrypted container, triple-wrapped DEK)
15. Build Settings → About page (version, EULA display, system info)

**Deliverables:**
- Full app shell with navigation, theming, visual lock, kiosk mode
- Command palette and keyboard navigation
- Core Settings pages functional
- Certificate and backup management available

**Milestone:** Application shell complete. 📦 **Installer v0.4** deployed to Server 2 — first version with a UI.

---

## Phase 5: Shared Components (2-3 weeks)

**Goal:** Build all shared UI components used across multiple modules, plus global search and onboarding tours.

**Tasks:**
1. Implement charting infrastructure: uPlot (time-series), Apache ECharts (categorical/statistical), shared chart wrapper components (doc 32)
2. Implement TanStack Table with virtual scrolling (100K+ rows), column config, export integration
3. Implement shared timeline component (horizontal time axis with zoom/pan)
4. Implement Point Detail floating panel (aggregate endpoint, sparkline, alarm status, linked data)
5. Implement Shared Point Context Menu (right-click on any point value across the app — Investigate Point/Alarm entry points)
6. Implement global search UI: command palette integration, debounce 200ms → `GET /api/search` (doc 21)
7. Implement global search backend: parallel async queries across 10 entity types, RBAC filtering, GIN indexes on tsvector columns, 500ms sub-query timeout, <200ms p95
8. Implement onboarding walkthrough: React Joyride tooltip-based guided tours
9. Build app-level first-login tour (sidebar, command palette, search, themes, key areas)
10. Build per-module first-use tour framework (each module registers its own tour steps, triggered on first visit)
11. Store tour completion state in `user_preferences` JSONB column
12. Implement data link display components (for Universal Import cross-references)

**Deliverables:**
- All shared chart, table, and timeline components available
- Point Detail panel and context menu functional
- Global search operational across all entity types
- Onboarding tours trigger on first login and first module visit
- Shared component Storybook/demo page for development reference

**Milestone:** Shared component library complete. All subsequent module builds use these components.

---

## Phase 6: Graphics System & Designer (4-6 weeks)

**Goal:** Build the SVG rendering engine and the full Designer module with all 3 modes.

**Tasks:**
1. Implement SVG rendering engine: point bindings, value mapping, ISA-101 state colors, LOD optimization (doc 19)
2. Implement hybrid SVG/Canvas rendering: auto-switch above 3,000 elements (1,500 tablet, 800 phone)
3. Implement 6 point value display element types: Text Readout, Analog Bar, Fill Gauge, Sparkline, Alarm Indicator, Digital Status
4. Implement ISA-101 gray-is-normal color scheme with 4 graphics-specific CSS tokens
5. Build Designer module with SVG.js (MIT): canvas, toolbar, property panels (doc 09)
6. Implement 3 Designer modes: Graphic, Dashboard, Report
7. Implement symbol library browser with search, categorization, drag-to-canvas
8. Implement shape palette with all Tier 1 DCS equipment shapes (doc 35) — 25 types with composable parts
9. Implement custom shape drawing tools (rectangle, ellipse, path, polyline, text, group)
10. Implement point binding overlay: drag point onto element, configure display type and value mapping
11. Implement orthogonal auto-routing (Graphic mode only) with manual toggle
12. Implement pessimistic edit locking with fork capability
13. Implement versioning: rolling 10-draft + permanent publish snapshots
14. Implement manual save + IndexedDB crash recovery
15. Implement 4-tier file import: SVG/DCS native → DXF/VSDX/WMF/EMF → raster recognition → best-effort (doc 09)
16. Implement .iographic import/export
17. Implement shape SVG export (right-click palette/canvas → standalone SVG for external editing)
18. Implement shape SVG reimport (user-created shapes only, preview, validation, dimension warning)
19. Build Settings → Shape Library management tab

**Deliverables:**
- SVG rendering engine renders graphics with live point values
- Designer creates, edits, and publishes graphics in all 3 modes
- File import pipeline handles SVG, DXF, VSDX, WMF, EMF
- Shape SVG export/reimport workflow functional
- Symbol library with all Tier 1 shapes available

**Milestone:** Full graphics authoring and rendering pipeline operational.

---

## Phase 7: Console & Process (3-5 weeks)

**Goal:** Build the Console (multi-pane workspace) and Process (full-screen viewer) modules. First live demo of SimBLAH graphics.

**Tasks:**
1. Implement Console module: multi-pane workspaces with configurable grid layout (doc 07)
2. Implement pane types: graphic view, trend, alarm list, point table, dashboard widget
3. Implement workspace save/load/share with layout persistence
4. Implement pane-level navigation: graphic browsing, point search, alarm filtering within panes
5. Implement Process module: single full-screen graphic viewer with zoom/pan (doc 08)
6. Implement minimap overlay for large graphics
7. Implement LOD (Level of Detail) — progressive detail rendering based on zoom level
8. Implement graphic bookmarks (user favorites, recent, pinned)
9. Connect Console and Process to live WebSocket data from Data Broker
10. Implement tile-based phone graphics (resvg + Leaflet) for mobile
11. Load SimBLAH demo graphics into Server 2 (import via Designer pipeline)
12. Verify end-to-end: SimBLAH OPC → Data Broker → WebSocket → Console/Process rendering with live values

**Deliverables:**
- Console shows multi-pane workspace with live SimBLAH data
- Process shows full-screen graphics with zoom/pan and minimap
- Real-time values update on graphics within 2s of OPC change
- Mobile tile view renders correctly on phone-sized screens

**Milestone:** 🎯 **FIRST LIVE DEMO** — SimBLAH graphics with live data in Console and Process. 📦 **Installer v0.7** deployed to Server 2.

> **SimBLAH Demo Integration:** This milestone is the primary target of the initial build push. Server 2 should be running with SimBLAH OPC data flowing, Console displaying multi-pane workspaces with live graphics, and Process showing full-screen views. The demo validates the entire data pipeline from OPC source through rendering. Connector templates for SimBLAH live under `24_integrations/demo-simblah/`. Console graphics spec at `.claude/console-graphics-spec.md`.

---

## Phase 8: Expression Builder (2-3 weeks)

**Goal:** Build the tile-based expression builder used across Settings, Dashboards, Reports, and Forensics.

**Tasks:**
1. Implement Expression Builder React component with @dnd-kit drag-and-drop (doc 23)
2. Implement tile palette: point references, constants, operators, functions (context-dependent input catalog)
3. Implement AST serialization to/from JSON
4. Implement client-side expression evaluation (expr-eval fork for preview/validation)
5. Implement server-side Rhai evaluation engine with sandboxing
6. Implement `custom_expressions` table and CRUD API
7. Implement expression validation: syntax checking, point reference resolution, type checking
8. Implement expression testing UI: enter test values, see computed result
9. Implement Events & Alarms engine: OPC alarm ingestion, ISA-18.2 full state machine (doc 27)
10. Implement I/O-native alarm evaluation: threshold wizard (HH/H/L/LL) + expression builder for complex logic
11. Implement alarm definition CRUD API and Settings UI
12. Build Settings → Expression Library tab
13. Build Settings → Alarm Configuration tab (threshold wizard + expression builder)

**Deliverables:**
- Expression builder component usable in any module context
- Rhai evaluation engine processes expressions server-side
- ISA-18.2 alarm state machine operational
- Threshold and expression-based alarms evaluate against live data

**Milestone:** Expression evaluation and alarm engine operational.

---

## Phase 9: Reports (3-5 weeks)

**Goal:** Build the Reports module with 20 Phase 1 canned reports, Typst PDF engine, and all promoted export features.

**Tasks:**
1. Implement report template engine using Designer Report mode (doc 11)
2. Implement 20 Phase 1 canned report templates (pre-built, available out of box)
3. Implement report parameter configuration: right-side slide-out panel with smart defaults
4. Implement async report generation pipeline (large reports don't block UI)
5. Implement Typst PDF engine via typst-as-lib (doc 01): branded templates, page-spanning tables, embedded charts
6. Implement CSV, HTML export formats alongside PDF
7. Implement scheduled report generation: cron-style scheduling, user self-subscription, admin push
8. Implement export presets (saved parameter combinations for repeated exports)
9. Implement email with attachments (reports delivered via Email Service, doc 28)
10. Implement Universal Export pipeline: sync/async, My Exports page (doc 25)
11. Implement export notification via WebSocket (job started → progress → complete/failed)
12. Build Settings → Report Scheduling tab
13. Build Settings → Export Presets tab

**Deliverables:**
- 20 canned reports generate correctly with live data
- PDF output via Typst with professional formatting
- Reports can be scheduled, emailed, and exported in multiple formats
- My Exports page tracks all user export jobs
- Export presets save and recall configurations

**Milestone:** Reporting and export pipeline complete. 📦 **Installer v0.9** deployed to Server 2.

---

## Phase 10: Dashboards (2-4 weeks)

**Goal:** Build the Dashboards module with 8 Phase 1 canned dashboards, template variables, and display features.

**Tasks:**
1. Implement Dashboard rendering engine using Designer Dashboard mode (doc 10)
2. Implement 8 widget types: Line Chart, Bar Chart, Pie Chart, KPI Card, Gauge, Table, Text, Alert Status (doc 10)
3. Implement 8 Phase 1 canned dashboard templates
4. Implement dashboard template variables (Grafana-style) with "All" default
5. Implement real-time widget updates via WebSocket subscription
6. Implement widget configuration schemas with property panels
7. Implement kiosk mode for dashboards (full-screen, no chrome)
8. Implement dashboard playlists for wallboard rotation (configurable interval, auto-advance)
9. Implement shared alarm KPI calculation layer (shared between reports and dashboards)
10. Build Settings → Dashboard Management tab

**Deliverables:**
- 8 canned dashboards render with live data
- Template variables filter dashboard content dynamically
- Kiosk mode and playlists work for control room wallboards
- Alarm KPIs consistent between dashboards and reports

**Milestone:** Dashboard system complete with wallboard rotation capability.

---

## Phase 11: Forensics (3-5 weeks)

**Goal:** Build the Forensics module with investigation model, correlation engine, and analytical tools.

**Tasks:**
1. Implement investigation model: create, stage progression, evidence collection, conclusions (doc 12)
2. Implement evidence toolkit: 10 evidence types including graphic snapshots
3. Implement point curation: auto-suggest related points + manual add/remove with reasons
4. Implement correlation engine: Pearson, Spearman (Rust implementations)
5. Implement FFT cross-correlation for time-shifted pattern detection
6. Implement PELT change point detection via augurs-changepoint crate (doc 12)
7. Implement spike detection (Z-score based)
8. Implement multi-source timeline: overlay events, alarms, log entries, rounds data on time axis
9. Implement correlation results visualization (scatter plots, lag plots, change point markers)
10. Implement investigation export (PDF report of findings via Typst)
11. Implement mid-v1 chart types: Probability Plot, 3D Surface/Contour (Plotly.js, lazy-loaded)
12. Build Settings → Forensics Configuration tab (default correlation parameters, auto-suggest rules)

**Deliverables:**
- Investigations track through full lifecycle with evidence collection
- Correlation engine identifies relationships between points
- PELT detects change points in historical data
- Multi-source timeline shows unified view of events during incident
- Plotly.js charts render probability and 3D visualizations

**Milestone:** Forensics analysis tools operational.

---

## Phase 12: Log & Rounds (3-5 weeks)

**Goal:** Build the operational Log module and Rounds inspection system with mobile PWA support.

**Tasks:**
1. Implement Log module: Tiptap WYSIWYG editor (MIT, ProseMirror-based) (doc 13)
2. Implement log template/segment/instance model
3. Implement shift scheduling integration (log entries tagged with active shift)
4. Implement log attachments (file upload, image paste)
5. Implement tsvector full-text search across log entries
6. Implement log PDF export via Typst
7. Implement Rounds module: equipment inspection checklists with 5 checkpoint types (doc 14)
8. Implement round scheduling: recurring schedules, shift-based assignment
9. Implement barcode scanning via PWA BarcodeDetector API + zxing-js fallback
10. Implement GPS geofence gates for outdoor rounds
11. Implement expression builder integration for rounds alarm thresholds
12. Implement mobile PWA: bottom tab navigation, 60px touch targets (gloved operation), connectivity-resilient architecture
13. Implement offline capability for Rounds: online to start/lock, cache during round, sync on reconnect (IndexedDB + Workbox)
14. Implement LRU cache for last 10 graphics in IndexedDB (mobile)
15. Build Settings → Log Templates tab
16. Build Settings → Rounds Configuration tab (schedules, checkpoint types, geofences)

**Deliverables:**
- Log module with rich text editing, templates, attachments, search
- Rounds module with checklists, barcode scanning, GPS gates
- Mobile PWA works on phone with gloved touch targets
- Offline rounds complete and sync when connectivity returns

**Milestone:** Operational logging and field inspection tools complete.

---

## Phase 13: Alerts, Shifts & Email (4-6 weeks)

**Goal:** Build the Alert Service, Shifts module, Email Service, and badge integration.

**Tasks:**
1. Implement Email Service: 6 provider adapters, MiniJinja templates, PostgreSQL queue/retry (doc 28)
2. Implement bounce handling, delivery tracking, template management
3. Build Settings → Email Configuration tab (provider, templates, test send)
4. Implement Alert Service: 7 channel adapters (email, SMS, push, in-app, webhook, pager, io-sms) (doc 27)
5. Implement escalation policies: time-based escalation, acknowledgment tracking
6. Implement shift-aware alert routing: route to on-shift personnel, on-site routing
7. Implement emergency takeover UI (Alerts Module, doc 31)
8. Implement muster command center: muster points, personnel tracking, gap identification
9. Implement Shifts module: shift definitions, schedules, handover workflow (doc 30)
10. Implement badge integration: read-only badge event ingestion, 8 BadgeEventType values, 6 adapter types (Lenel, C-CURE, Genetec, Pro-Watch, Gallagher, GenericDB)
11. Implement presence tracking: who's on site, area occupancy
12. Implement human-initiated alerts and notifications (Alerts Module, doc 31)
13. Build Settings → Alert Configuration tab (channels, escalation policies, routing rules)
14. Build Settings → Shift Management tab (definitions, schedules, handover config)
15. Build Settings → Badge Integration tab (adapter config, badge reader mapping, muster points)

**Deliverables:**
- Email Service sends transactional email with retry and bounce handling
- Alert Service dispatches multi-channel alerts with escalation
- Shift management with badge-based presence tracking
- Muster command center tracks personnel during emergencies
- Human-initiated notifications reach targeted groups

**Milestone:** Communication and personnel management complete. 📦 **Installer v0.13** deployed to Server 2.

---

## Phase 14: Universal Import & Integrations (4-6 weeks)

**Goal:** Build the Universal Import system with SimBLAH integrations as the reference implementation.

**Tasks:**
1. Implement Import Service: trait-based connector architecture (doc 24)
2. Implement core connectors: databases (PostgreSQL, MSSQL, MySQL, Oracle), files (CSV, Excel, JSON, XML)
3. Implement schema discovery and auto-mapping with preview
4. Implement transformation/validation pipeline with Rhai expressions
5. Implement import job scheduling (cron-style recurring imports)
6. Implement import wizard UI: source config → schema browse → field mapping → transform → preview/dry-run → schedule
7. Implement import history and audit trail
8. Implement data quality dashboard (validation error rates, mapping coverage, import health)
9. Implement Import Designer (visual mapping builder for complex transforms)
10. Implement import definition export/import (portable templates between I/O instances)
11. Implement connector templates: wizard "Step 0" template browser, `{{placeholder}}` variable resolution
12. Deploy SimBLAH integration connector templates on Server 2
13. Implement equipment table as cross-domain join key (work orders, lab samples, tickets linked to equipment)
14. Implement data link management: `data_links` table, CRUD API, point column designator, chain validation
15. Build Settings → Import Management tab (connectors, schedules, history, data quality)
16. Build Settings → Equipment Management tab
17. Build Settings → Data Links tab

**Deliverables:**
- Import wizard handles database and file sources with auto-mapping
- SimBLAH integration running scheduled imports on Server 2
- Data quality dashboard shows import health metrics
- Import Designer enables complex visual mapping
- Import definitions exportable/importable between systems
- Equipment cross-references link imported data to points

**Milestone:** Integration pipeline operational with SimBLAH as reference.

---

## Phase 15: Recognition & SymBA Pipeline (2-3 weeks)

**Goal:** Build the recognition inference pipeline and all SymBA integration touchpoints.

**Tasks:**
1. Implement Recognition Service: `ort` crate ONNX inference, model loading, GPU/CPU fallback (doc 26)
2. Implement P&ID Import Wizard in Designer: upload → recognize → review → correct → generate graphic (6-step flow)
3. Implement DCS Import Wizard in Designer: platform-specific import with customer extraction kit output
4. Implement correction feedback collection and `.iofeedback` export to SymBA
5. Implement `.iomodel` package loading, validation, and hot-swap
6. Implement `.iogap` gap report consumption and display in Settings
7. Implement all 7 late-v1 recognition enhancements from doc 26 (post-SymBA integration testing)
8. Implement graceful degradation when no model loaded
9. Build Settings → Recognition Model Management tab (.iomodel upload, version tracking, gap reports)

**Deliverables:**
- Recognition Service runs ONNX inference on uploaded P&ID/DCS images
- Designer wizards walk users through recognition → correction → graphic generation
- Feedback loop to SymBA functional (.iofeedback export)
- Model management in Settings with gap report display

**Milestone:** SymBA integration pipeline complete. Recognition operational for both P&ID and DCS domains.

---

## Phase 16: Templates & Polish (3-5 weeks)

**Goal:** Build remaining canned reports/dashboards, late-v1 chart types, Modbus/MQTT, and remaining export features.

**Tasks:**
1. Implement remaining 18 canned reports (38 total = 20 Phase 1 + 18 remaining)
2. Implement remaining 11 canned dashboards (19 total = 8 Phase 1 + 11 remaining)
3. Implement Modbus TCP connector for real-time data acquisition (Phase 3 OPC patterns apply)
4. Implement MQTT connector for real-time data acquisition + MQTT streaming imports for Universal Import
5. Implement Multi-Window Architecture: SharedWorker coordination, detached routes, Window Groups, Window Management API
6. Implement JSONB bulk editing: 4-step wizard, validation, diff preview, conflict detection (doc 25)
7. Implement Change Snapshots: automatic/manual, full/selective restore, retention policy (doc 25)
8. Implement snapshot comparison view (diff two snapshots)
9. Implement scheduled exports (cron-style, separate from reports)
10. Implement Authentication & Identity: external providers (OIDC, SAML, LDAP), JIT/SCIM provisioning, MFA (TOTP, Duo, SMS, email), service account API keys (doc 29)
11. Implement IdP role mappings (`idp_role_mappings` table, 7 conflict resolution rules)
12. Implement ACME certificate automation via instant-acme (HTTP-01 + DNS-01) (doc 22)
13. Build Settings → Authentication & Identity tab (external providers, MFA, SCIM, API keys)
14. Build Settings → Snapshot Management tab

**Deliverables:**
- All 38 canned reports and 19 canned dashboards available
- Modbus TCP and MQTT data sources operational
- Multi-window support for control room multi-monitor setups
- Bulk editing and change snapshots functional
- Enterprise auth (OIDC/SAML/LDAP), MFA, and provisioning complete
- ACME automated certificate management operational

**Milestone:** Feature-complete application. 📦 **Installer v0.16** deployed to Server 2.

---

## Phase 17: Production Hardening (2-3 weeks)

**Goal:** Security audit, performance testing, accessibility, documentation, and final installer.

**Tasks:**
1. Security audit: OWASP top 10 review, penetration testing, dependency vulnerability scan
2. Load testing against performance targets: <2s point update latency, <1.5s graphic render, <200ms API response (p95), 200+ concurrent users, 10,000+ concurrent data points
3. WebSocket load testing: determine subscription caps, validate adaptive throttling under load
4. Accessibility audit: WCAG 2.1 AA compliance, screen reader testing, keyboard navigation verification
5. YARA-X file scanning integration for uploaded files
6. Review and harden all input validation, SQL injection prevention, XSS prevention
7. Verify soft delete semantics (deleted_at) across all business entities
8. Verify config reload behavior: env vars = restart, DB-backed = hot-reload
9. Verify 3 deployment profiles work: Standalone, Resilient, Enterprise HA
10. Build production deployment guide with nginx configuration, TLS setup, backup procedures (doc 22)
11. Build admin documentation
12. Finalize installer: upgrade path testing, rollback verification, fresh install verification
13. Run full regression test suite

**Deliverables:**
- Security audit report with all critical/high findings resolved
- Load test results confirming performance targets met
- Accessibility audit passing WCAG 2.1 AA
- Production deployment guide
- Installer handles fresh install, upgrade, and rollback

**Milestone:** 🚀 **Production ready.** 📦 **Installer v1.0** — final release candidate.

---

## Phase Summary

| Phase | Focus | Duration | Key Milestone |
|-------|-------|----------|---------------|
| 1 | Foundation | 3-5 weeks | All services scaffolded, full schema deployed |
| 2 | Auth & Core API | 2-4 weeks | Auth complete, 📦 Installer v0.2 |
| 3 | Real-Time Pipeline | 3-5 weeks | Live OPC data flowing end-to-end |
| 4 | Frontend Shell & Settings Core | 2-4 weeks | App shell complete, 📦 Installer v0.4 |
| 5 | Shared Components | 2-3 weeks | Charting, tables, search, onboarding tours |
| 6 | Graphics System & Designer | 4-6 weeks | Full graphics authoring pipeline |
| 7 | Console & Process | 3-5 weeks | 🎯 **First Live Demo**, 📦 Installer v0.7 |
| 8 | Expression Builder | 2-3 weeks | Expressions + ISA-18.2 alarm engine |
| 9 | Reports | 3-5 weeks | 20 canned reports + Typst PDF, 📦 Installer v0.9 |
| 10 | Dashboards | 2-4 weeks | 8 canned dashboards + wallboard rotation |
| 11 | Forensics | 3-5 weeks | Investigation model + correlation engine |
| 12 | Log & Rounds | 3-5 weeks | Operational tools + mobile PWA |
| 13 | Alerts, Shifts & Email | 4-6 weeks | Multi-channel alerts + shifts + presence, 📦 Installer v0.13 |
| 14 | Universal Import | 4-6 weeks | Import wizard + SimBLAH integrations |
| 15 | Recognition & SymBA | 2-3 weeks | P&ID + DCS recognition pipeline |
| 16 | Templates & Polish | 3-5 weeks | Feature-complete, 📦 Installer v0.16 |
| 17 | Hardening | 2-3 weeks | 🚀 **Production ready**, 📦 Installer v1.0 |

**Total Duration:** 44-77 weeks (approximately 11-19 months)

*Note: Assumes single developer with Claude Code assistance. Phases are sequential but some parallel work is possible (see below).*

---

## Parallel Development Opportunities

Some phases have independent workstreams that can overlap:

- **Phase 1 & 2**: Database schema and shared crates (Phase 1) can overlap with auth endpoint development (Phase 2) once the migration framework is running
- **Phase 3**: OPC Service and Archive Service are backend-heavy; frontend WebSocket client can begin once the broker protocol is defined
- **Phase 4 & 5**: Shell (Phase 4) and shared components (Phase 5) are both frontend — Phase 5 can begin as soon as the shell layout is stable
- **Phase 6 & 7**: Designer (Phase 6) and Console/Process (Phase 7) share the rendering engine but are otherwise independent. Console can start once the renderer is functional, even if Designer isn't complete
- **Phase 9 & 10**: Reports and Dashboards share the Designer Report/Dashboard modes but rendering is independent. Can overlap if Designer modes are stable
- **Phase 11 & 12**: Forensics (backend-heavy correlation engine) and Log/Rounds (editor + mobile frontend) are completely independent
- **Phase 13**: Email Service must complete before Alert Service (alerts use email channel). Shifts/Badge integration is independent of both and can start in parallel
- **Phase 14 & 15**: Universal Import and Recognition Service are independent. Recognition depends on having graphics infrastructure (Phase 6) but not on Import
- **Phase 16**: Modbus/MQTT, multi-window, bulk editing, auth providers, and remaining templates are all independent workstreams

---

## Installer Milestones

| Installer | After Phase | Contents |
|-----------|-------------|----------|
| v0.2 | 2 | Services (stubs), full DB, auth, user/role management |
| v0.4 | 4 | + App shell, themes, Settings core, certificates, backup |
| v0.7 | 7 | + OPC pipeline, graphics, Console, Process — **demo-ready** |
| v0.9 | 9 | + Expression builder, alarms, reports, export pipeline |
| v0.13 | 13 | + Dashboards, forensics, log, rounds, alerts, shifts, email |
| v0.16 | 16 | + Import, recognition, Modbus/MQTT, enterprise auth — **feature-complete** |
| v1.0 | 17 | Security hardened, load tested, accessible — **production release** |

Each installer is a complete, deployable package. Server 2 runs the latest installer at all times.

---

## Success Criteria Per Phase

Each phase must meet quality criteria before proceeding:

1. All code compiles without warnings
2. All tests passing (unit and integration)
3. Documentation updated (README, API docs)
4. Git commits with clear messages
5. No known critical bugs
6. Performance targets met (where applicable)
7. Security requirements satisfied (auth phases)
8. Installer packages build and deploy successfully (at installer milestones)

## Change Log

- **v2.1**: Fixed canned report counts to match doc 11 v1.0: Phase 1 reports 19→20, total 37→38. Shift Handover Packet added as Phase 1 report. Updated Phase 9 tasks, Phase 16 tasks, deliverables, and summary table.
- **v2.0**: Complete rewrite of development phases. Restructured from infrastructure-first to demo-first priority order. Key changes: (1) Phase 1 now scaffolds ALL 11 services and deploys full DB schema upfront instead of incrementally. (2) Phases reordered to reach first live SimBLAH demo (Phase 7) as fast as possible. (3) Settings built incrementally across phases instead of as a single phase. (4) Added installer package model with 7 milestone deployments to Server 2. (5) Promoted items from deferred audit integrated into their respective phases: unified search API (Phase 5), shape SVG export/reimport (Phase 6), onboarding walkthrough (Phase 5), Modbus TCP/MQTT (Phase 16), PELT change point detection (Phase 11), Typst PDF engine (Phase 9), instant-acme (Phase 16), systemd encrypted credentials (Phase 1), export presets/scheduling/email attachments (Phase 9), JSONB bulk editing/snapshots (Phase 16), data quality dashboard (Phase 14), import definition export/import (Phase 14), Import Designer (Phase 14), all recognition enhancements (Phase 15). (6) Total duration reduced from 53-90 to 44-77 weeks through better phase organization and reduced overlap waste. (7) Events/Alarms moved from standalone Phase 4F to Phase 8 alongside Expression Builder (natural dependency). (8) Auth & Identity (was Phase 16) moved to Phase 16 Templates & Polish (late v1, after core features). (9) Export System distributed across phases: core export in Phase 9 (Reports), bulk update/snapshots in Phase 16. (10) Mobile PWA consolidated into Phase 12 (Log & Rounds) instead of separate phase.
- **v1.7**: Added Data Links and Point Detail tasks to Phase 4E (Universal Import Service). Data Links: `data_links` table, CRUD API, point column designator, transform pipeline, chain validation, Settings tab. Point Detail: `point_detail_config` table, `design_object_points` trigger, aggregate endpoint, floating panel component, Settings tab. See docs 24, 32.
- **v1.6**: Added SimBLAH Demo Integration callout box after Phase 6 Console MVP milestone. References connector templates at `24_integrations/demo-simblah/`, console graphics spec at `.claude/console-graphics-spec.md`, integration guide at `.claude/simblah-io-integration-guide.md`, and demo script at `.claude/simblah-demo-script.md`. This is a first-build-only reminder — SimBLAH is the demo/POC data source, not part of the general product.
- **v1.5**: Updated Phase 13 inference pipeline references from RF-DETR/YOLOX to FCOS (FP16 GPU / FP32 CPU). Removed OCR from pipeline description. Matches SymBA's actual model architecture.
- **v1.4**: Updated phases to reflect expanded scope from Category C deep design work. Phase 5: added shared UI component infrastructure (uPlot, ECharts, TanStack Table from doc 32), expanded theme system description. Phase 6: added shared trend (uPlot) and table (TanStack Table) component integration. Phase 7: rewritten as "Designer Module" (was "Graphics Import & Designer") — SVG.js-based native editor with 3 design modes (Graphic, Dashboard, Report), symbol library browser, custom shape drawing tools, point binding overlay, phone preview; estimate increased from 3-4 to 4-6 weeks. Phase 8: clarified as full-screen super graphic viewer with minimap, LOD, bookmarks. Added Phase 4F: Events & Alarms Engine (2-3 weeks) — OPC alarm ingestion, I/O-native alarm evaluation (threshold wizard + expression-based), ISA-18.2 state machine, event query APIs and timeline. Phase 9: expanded Dashboards (dual layout, widget config schemas), Reports (Designer-based templates, expanding elements, scheduled generation via Email Service), Forensics (full correlation engine — Pearson, FFT cross-correlation, Spearman, CUSUM, point selection helpers, results visualization); estimate increased from 4-9 to 6-12 weeks. Phase 10: expanded Log (Tiptap, template/segment/instance, shift scheduling, tsvector search) and Rounds (5 checkpoint types, barcode/GPS gates, expression builder, alarm thresholds); estimate increased from 3-4 to 4-6 weeks. Phase 11: expanded with tile-based phone graphics (resvg + Leaflet), phone dashboard dual layouts, Status View, offline architecture (IndexedDB + Workbox); estimate increased from 1-2 to 2-4 weeks. Updated phase summary table and total duration from 49-81 to 53-90 weeks. Updated parallel development opportunities for new phases.
- **v1.3**: Expanded Phase 15 from "Email Service & Alert System" (3-5 weeks) to "Email, Alerting, Shifts & Presence" (6-10 weeks). Added sub-phases 15C (Access Control, Shifts & Presence, 1.5-2 weeks) and 15D (Alerts Module, 1-1.5 weeks). Badge integration, shift management, presence tracking, muster workflow, human-initiated notifications, and 15 new RBAC permissions. Updated total duration from 46-76 to 49-81 weeks. Updated parallel development opportunities. See docs 30 and 31.
- **v1.2**: Added Phase 14 placeholder note (removed during consolidation, numbering preserved for cross-reference stability). Updated phase count from 16 to 17 to reflect full numbering range.
- **v1.1**: Added Phase 16: Authentication & Identity (4-6 weeks). Sub-phases: 16A external auth providers (OIDC, SAML, LDAP), 16B JIT/SCIM provisioning, 16C MFA (TOTP, Duo, SMS, email), 16D service account API keys. Renumbered Production Hardening from Phase 16 to Phase 17. Updated phase count (15 → 16), summary table, total duration (42-70 → 46-76 weeks), and parallel development opportunities. See 29_AUTHENTICATION.md.
- **v1.0**: Added Phase 15: Email Service & Alert System (3-5 weeks). 15A: Email Service (1.5-2 weeks) with 6 provider adapters, MiniJinja templates, PostgreSQL queue/retry, Settings UI. 15B: Alert System (2-3 weeks) with 7 channel adapters, escalation engine, acknowledgment tracking, emergency takeover UI, Settings UI. Renumbered Production Hardening from Phase 14 to Phase 16. Updated phase count (14 → 15), summary table, total duration (39-65 → 42-70 weeks), and parallel development opportunities. See 27_ALERT_SERVICE.md and 28_EMAIL_SERVICE.md.
- **v0.9**: Renamed Phase 13 from "P&ID Recognition Integration" to "Symbol Recognition Integration" to reflect dual-domain scope (P&ID + DCS). Updated goal, task 8 (added DCS Import Wizard), deliverables, milestone, and summary table. See doc 26.
- **v0.8**: Added Multi-Window Architecture sub-phase to Phase 9 (2-3 weeks) — SharedWorker, detached routes, Window Groups, Window Management API. Updated Phase 9 duration (4-6 → 4-9 weeks), phase summary table, total duration (39-62 → 39-65 weeks), and parallel development opportunities.
- **v0.7**: Added Phase 13: P&ID Recognition Integration (2-3 weeks). Covers `ort` crate integration, model loading, inference pipeline (RF-DETR GPU / YOLOX CPU), Designer P&ID Import Wizard (6-step flow), correction feedback collection and `.iofeedback` export, model hot-swap, Settings admin UI, graceful degradation. Renumbered Production Hardening from Phase 13 to Phase 14. Updated phase summary table and total duration (37-59 → 39-62 weeks). See `26_PID_RECOGNITION.md`.
- **v0.6**: Added Phase 12: Export System (2-3 weeks). Covers Universal Export (6 formats, sync/async pipeline, My Exports page), Admin Bulk Update (4-step wizard, validation, diff preview, conflict detection), and Change Snapshots (automatic/manual, full/selective restore). Renumbered Production Hardening from Phase 12 to Phase 13. Updated phase summary table and total duration (35-56 → 37-59 weeks). See 25_EXPORT_SYSTEM.md.
- **v0.5**: Added Phase 4E: Universal Import Service (3-5 weeks). Covers Import Service as 7th Rust/Axum service, 6 database tables, trait-based connector architecture, core connectors (databases, files), schema discovery, auto-mapping, transformation/validation pipelines, job scheduling, wizard UI, preview/dry-run, import history, 4 RBAC permissions. Updated Phase 4 duration (6-10 → 9-15 weeks), phase summary table, total duration (32-51 → 35-56 weeks), deliverables, and milestone. See 24_UNIVERSAL_IMPORT.md.
- **v0.4**: Consistency fixes: updated Phase 4 heading duration from (4-6 weeks) to (6-10 weeks) to match sub-phase sum. Updated phase summary table. Corrected total duration from 30-50 to 32-51 weeks. Fixed parallel development opportunities (Phase 2 & 3 description corrected, added Phase 5 overlap note).
- **v0.3**: Added Phase 4D: Expression Builder (1.5-2.5 weeks). Covers custom_expressions table, Expression Builder React component with @dnd-kit drag-and-drop, AST serialization, client-side evaluation (expr-eval-fork), server-side evaluation (Rhai), API endpoints, performance benchmarking, and Settings module integration. Updated Phase 4 duration (4-6 → 6-9 weeks), phase summary table, total duration estimate (28-47 → 30-50 weeks), and deliverables.
- **v0.2**: Renamed Phase 4 from "OPC Integration" to "Multi-Source Integration". Split into sub-phases: 4A (source infrastructure and OPC UA with versioned metadata discovery, backfill, source status tracking), 4B (point lifecycle and application config with never-delete policy), 4C (UOM conversion for real-time and historical). Updated duration estimate and phase summary table.

---

**Next Steps:** Begin Phase 1 — Foundation. Scaffold all services, deploy full database schema, build shared crates, and create installer framework.
