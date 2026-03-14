# Inside/Operations - Technology Stack

## Overview

This document specifies the complete technology stack for Inside/Operations, including version recommendations, licensing information, and rationale for each choice.

## Licensing Requirement

**ALL technologies used must have licenses compatible with royalty-free commercial software distribution.**

Acceptable licenses:
- MIT License ✅
- Apache License 2.0 ✅
- BSD License (2-clause, 3-clause) ✅
- ISC License ✅
- PostgreSQL License ✅
- Mozilla Public License 2.0 ✅ (specific components only)
- SIL Open Font License 1.1 ✅ (fonts only — permits embedding and redistribution)

**NOT acceptable:**
- GPL/LGPL ❌
- AGPL ❌
- Commercial licenses requiring royalties ❌

---

## Backend Technologies

### Core Language & Runtime

| Technology | Version | License | Purpose |
|------------|---------|---------|---------|
| **Rust** | 1.75+ | MIT/Apache-2.0 | Primary backend language |
| **Tokio** | 1.x | MIT | Async runtime and I/O |

**Rationale for Rust:**
- Memory safety without garbage collection
- Exceptional performance for high-frequency data processing
- Strong type system catches errors at compile time
- Excellent async/await support via Tokio
- Zero-cost abstractions
- Growing ecosystem for web services

### Web Framework

| Technology | Version | License | Purpose |
|------------|---------|---------|---------|
| **Axum** | 0.7+ | MIT | HTTP web framework |
| **tower** | 0.4+ | MIT | Service middleware |
| **tower-http** | 0.5+ | MIT | HTTP-specific middleware |
| **hyper** | 1.x | MIT | HTTP library (Axum dependency) |

**Rationale for Axum:**
- Built on Tokio, excellent async performance
- Type-safe routing and extractors
- Minimal boilerplate code
- Composable middleware with tower
- Great ergonomics and developer experience

### Database Integration

| Technology | Version | License | Purpose |
|------------|---------|---------|---------|
| **SQLx** | 0.7+ | MIT/Apache-2.0 | Async PostgreSQL driver |
| **sqlx-cli** | 0.7+ | MIT/Apache-2.0 | Migration tooling |

**Rationale for SQLx:**
- Compile-time checked SQL queries
- Async/await support
- Connection pooling built-in
- No ORM overhead (direct SQL control)
- Excellent PostgreSQL feature support

### Authentication & Security

| Technology | Version | License | Purpose |
|------------|---------|---------|---------|
| **jsonwebtoken** | 9.x | MIT | JWT creation and validation |
| **argon2** | 0.5+ | MIT/Apache-2.0 | Password hashing |
| **rand** | 0.8+ | MIT/Apache-2.0 | Cryptographic randomness |

**Rationale:**
- JWT industry standard for stateless auth
- Argon2 is current best practice for password hashing
- Strong cryptographic libraries with security audits

### WebSocket

| Technology | Version | License | Purpose |
|------------|---------|---------|---------|
| **tokio-tungstenite** | 0.21+ | MIT | WebSocket server |

**Rationale:**
- Native Tokio integration
- Excellent performance for real-time data fanout
- Full WebSocket protocol support

### OPC UA Client

| Technology | Version | License | Purpose |
|------------|---------|---------|---------|
| **opcua** | 0.12+ | MPL-2.0 | OPC UA client library |

**Rationale:**
- Most mature Rust OPC UA implementation
- Support for standard security profiles
- MPL-2.0 license compatible with commercial use

> **Risk:** Pre-1.0 with sporadic maintenance. Only Rust OPC UA client available. Fallback ladder: (1) Fork and patch the Rust crate (hours), (2) FFI to `open62541` (C, MIT licensed) — the most widely deployed open-source OPC UA stack (days to weeks).

### Serialization

| Technology | Version | License | Purpose |
|------------|---------|---------|---------|
| **serde** | 1.x | MIT/Apache-2.0 | Serialization framework |
| **serde_json** | 1.x | MIT/Apache-2.0 | JSON serialization |
| **uuid** | 1.x | MIT/Apache-2.0 | UUID generation |
| **chrono** | 0.4+ | MIT/Apache-2.0 | Date/time handling |

**Rationale:**
- Serde is the de-facto standard for Rust serialization
- Zero-copy deserialization where possible
- Type-safe serialization/deserialization

### Expression Evaluation (Server-Side)

| Technology | Version | License | Purpose |
|------------|---------|---------|---------|
| **Rhai** | 1.19.0 | MIT OR Apache-2.0 | Server-side expression evaluation |

**Rationale for Rhai:**
- Expression-only mode (`eval_expression()`) restricts to expressions, no loops or assignments
- Only MIT/Apache-2.0 Rust expression library with native `if/else` conditional support in expression-only mode
- Built-in sandboxing with execution time limits, recursion depth limits, and operation count caps
- Serde integration for AST serialization from PostgreSQL JSONB
- **Not using**: fasteval (no conditional support), evalexpr (AGPL)

### Observability

| Technology | Version | License | Purpose |
|------------|---------|---------|---------|
| **tracing** | 0.1+ | MIT | Structured logging |
| **tracing-subscriber** | 0.3+ | MIT | Log collection |
| **prometheus** | 0.13+ | Apache-2.0 | Metrics collection |
| **metrics** | 0.24+ | MIT | Facade crate for application metrics (counters, gauges, histograms). Prometheus naming conventions. |
| **metrics-exporter-prometheus** | 0.16+ | MIT | Exposes `/metrics` HTTP endpoint in Prometheus text exposition format |
| **metrics-tracing-context** | 0.16+ | MIT | Bridges tracing span fields to metric labels automatically |
| **opentelemetry** | 0.27+ | Apache-2.0 | Distributed tracing SDK. Optional, enabled via config for cross-service trace correlation. |
| **tracing-opentelemetry** | 0.28+ | MIT | Bridges existing `tracing` instrumentation to OpenTelemetry spans |

**Rationale:**
- Tracing provides structured, contextual logging
- Prometheus standard for metrics in production systems
- Excellent async support
- `metrics` facade + `metrics-exporter-prometheus` provide a type-safe, Prometheus-native metrics pipeline alongside the existing `prometheus` crate (which remains for backward compatibility)
- `metrics-tracing-context` automatically propagates tracing span fields (e.g., service name, request ID) as metric labels without manual plumbing
- `opentelemetry` + `tracing-opentelemetry` enable optional distributed tracing across all 11 services — disabled by default, enabled via environment config when cross-service trace correlation is needed

### MSSQL Client

| Technology | Version | License | Purpose |
|------------|---------|---------|---------|
| **tiberius** | 0.12+ | MIT/Apache-2.0 | MSSQL async driver |

**Rationale:**
- Async MSSQL client for Event Service (event historian) and Import Service (MSSQL source imports)
- Native Tokio support

### Universal Export

| Technology | Version | License | Purpose |
|------------|---------|---------|---------|
| **rust_xlsxwriter** | 0.80+ | MIT/Apache-2.0 | XLSX file generation with constant memory mode |
| **typst** | Latest | MIT | PDF generation via Typst typesetting engine (used as library via `typst-as-lib`). Professional output with branded templates, proper typography, tables spanning pages, embedded charts. |
| **parquet** | 57+ | Apache-2.0 | Parquet file writing (columnar format for analytics) |
| **arrow** | 57+ | Apache-2.0 | Columnar data representation (required by `parquet`) |

**Rationale:**
- rust_xlsxwriter provides constant memory mode for large exports (row-by-row flushing, no full-document buffering)
- typst is a modern typesetting engine (MIT, pure Rust) used as a library — produces professional PDFs with branded templates, headers/footers, page-spanning tables, and embedded graphics. No external dependencies (no wkhtmltopdf). Shared across Reports, Log, and Export modules.
- parquet + arrow enable columnar file export for data science tools (pandas, DuckDB, Spark, Jupyter)
- CSV and JSON export reuse existing `csv` and `serde_json` crates already in the project
- All crates are MIT or Apache-2.0, fully compliant with licensing requirements
- See 25_EXPORT_SYSTEM.md for full export format specifications

### Symbol Recognition

| Technology | Version | License | Purpose |
|------------|---------|---------|---------|
| **ort** | 2.x | MIT/Apache-2.0 | ONNX Runtime bindings for Rust — used by the symbol recognition inference pipeline for both P&ID and DCS model domains |
| **image** | 0.25+ | MIT | Image loading, resizing, and preprocessing for recognition inference |
| **imageproc** | 0.24+ | MIT | Image processing operations (color conversion, filtering) for recognition preprocessing |

**Rationale:**
- ONNX Runtime provides cross-platform model inference (CPU and CUDA GPU)
- The `ort` crate wraps ONNX Runtime with safe Rust bindings and `Arc`-based session sharing
- Supports loading multiple ONNX sessions concurrently (P&ID detector, DCS equipment detector, line classifier, text detector/classifier)
- Execution provider selection (CUDA → CPU fallback) handled at session creation
- See [26_PID_RECOGNITION.md](26_PID_RECOGNITION.md) for full recognition architecture covering both P&ID and DCS domains

### OCR (Attachment Text Extraction)

| Technology | Version | License | Purpose |
|------------|---------|---------|---------|
| **tesseract-rs** | Latest | Apache-2.0 | Rust bindings for Tesseract OCR engine — extracts printed text from image attachments (log photos, round photos) for full-text search |

**Rationale:**
- Tesseract is the industry standard open-source OCR engine (Apache 2.0). Handles printed text, equipment labels, HMI screenshots, typed forms.
- System dependency: `tesseract-ocr` package must be installed on the server (handled by `install_baseline.sh`). Not a compiled-in Rust crate — uses FFI bindings.
- Runs async on media upload. Extracted text stored in `extracted_text` column on `log_media` and `round_media`, indexed for full-text search.
- **Post-v1 upgrade path**: ONNX-based handwritten text recognition (HTR) model via existing `ort` crate. Two-pass pipeline (Tesseract first, HTR second for low-confidence results). GPU recommended for HTR. See doc 13 for full spec.

### SVG Rendering (Server-Side)

| Technology | Version | License | Purpose |
|------------|---------|---------|---------|
| **resvg** | 0.44+ | MPL-2.0 | Server-side SVG to PNG rendering for tile pyramid generation (phone graphics). Rust-native, no system dependencies. |

**Rationale:**
- Renders Console and Process graphic SVGs into 256x256 tile pyramids at multiple zoom levels for phone viewing
- High-performance, Rust-native SVG rasterizer (~1,600 tests, well-maintained)
- MPL-2.0 license: file-level copyleft only — does not infect surrounding code. Explicitly on I/O's approved license list.
- See doc 20 (Mobile Architecture) for the full tile-based phone graphics specification

### File Scanning

| Technology | Version | License | Purpose |
|------------|---------|---------|---------|
| **yara-x** | 0.x | BSD-3-Clause | File upload scanning — malware signatures, SVG script injection, XML XXE, ONNX anomaly detection. Custom rule authoring for I/O-specific threats |

**Rationale:**
- Rust-native YARA engine with BSD-3-Clause license (fully compliant)
- Scans all file uploads (graphics imports, ONNX models, attachments) before storage
- Custom rule authoring enables I/O-specific threat patterns (e.g., embedded scripts in SVG, XXE in XML, anomalous ONNX structures)
- Runs in-process — no external daemon required (unlike ClamAV)

### Email & Alerting

| Technology | Version | License | Purpose |
|------------|---------|---------|---------|
| **lettre** | 0.11+ | MIT | Async SMTP client with STARTTLS, implicit TLS, XOAUTH2, connection pooling |
| **oauth2** | 5.0+ | MIT/Apache-2.0 | OAuth2 client credentials flow for Microsoft Graph, Gmail, SMTP XOAUTH2 |
| **minijinja** | 2.x | Apache-2.0 | Jinja2-compatible template engine for email and alert message templates |
| **web-push-native** | 0.3+ | MIT/Apache-2.0 | Web Push API client for browser push notifications (VAPID) |
| **jsonwebtoken** | 9.x | MIT | JWT for Google Workspace service account authentication |

**Optional:**
| Technology | Version | License | Purpose |
|------------|---------|---------|---------|
| **aws-sdk-sesv2** | 1.x | Apache-2.0 | Amazon SES v2 client (only if SES provider compiled in) |

**Rationale:**
- lettre is the standard Rust SMTP client with full async support, connection pooling, and XOAUTH2 for modern mail providers
- oauth2 crate (already listed under Universal Import Connectors) is reused for Microsoft Graph and Gmail API token acquisition
- minijinja provides Jinja2-compatible templating for email bodies and alert message formatting without pulling in a full Python runtime
- web-push-native implements the Web Push protocol with VAPID authentication for browser push notifications
- jsonwebtoken (already listed under Authentication & Security) is reused for Google Workspace service account JWT assertions
- `reqwest` (already in project) is used for Twilio API (SMS/voice), Microsoft Graph API (email), radio dispatch REST APIs, and PA system REST APIs
- aws-sdk-sesv2 is optional and only compiled when Amazon SES is configured as an email provider
- See 27_ALERT_SYSTEM.md and 28_EMAIL_SERVICE.md for full architecture

### Forensics & Analytics

| Technology | Version | License | Purpose |
|------------|---------|---------|---------|
| **rustfft** | 2.x | MIT OR Apache-2.0 | FFT for Forensics cross-correlation analysis |
| **realfft** | 3.x | MIT OR Apache-2.0 | Real-valued FFT wrapper (more efficient for real-only signals) |
| **ndarray-stats** | 0.6+ | MIT OR Apache-2.0 | Statistical functions for Forensics correlation engine |
| **augurs-changepoint** | 0.6+ | MIT OR Apache-2.0 | Change point detection (PELT algorithm) for Forensics |
| **statrs** | 0.17+ | MIT | Statistical distributions and functions |

**Rationale:**
- rustfft/realfft provide FFT for cross-correlation analysis in the Forensics module's pattern detection pipeline
- ndarray-stats extends ndarray with statistical operations (mean, variance, percentiles) for correlation analysis
- augurs-changepoint implements the PELT algorithm for detecting regime changes in time-series data
- statrs provides probability distributions, hypothesis testing, and summary statistics
- All crates are MIT or Apache-2.0, fully compliant with licensing requirements

### Backup Encryption

| Technology | Version | License | Purpose |
|------------|---------|---------|---------|
| **aes-gcm** | 0.10+ | MIT OR Apache-2.0 | AES-256-GCM encryption for .iobackup files |
| **rsa** | 0.9+ | MIT OR Apache-2.0 | RSA-4096 for vendor recovery key wrapping |

**Rationale:**
- aes-gcm provides authenticated encryption for backup DEK wrapping and file encryption
- rsa provides RSA-OAEP-SHA256 for the vendor recovery key path in triple-wrapped DEK scheme
- `argon2`, `rand`, and `sha2` crates (already listed elsewhere) are also used in the backup encryption pipeline
- See 15_SETTINGS_MODULE.md Backup & Restore section for the full triple-wrapped DEK specification

### Certificate Management

| Technology | Version | License | Purpose |
|------------|---------|---------|---------|
| **rcgen** | 0.13+ | MIT OR Apache-2.0 | X.509 certificate and CSR generation. Self-signed certs on first install, CSR generation for paid CA workflows. Part of the rustls project. |
| **x509-parser** | 0.16+ | MIT OR Apache-2.0 | Certificate parsing for import validation, expiry checking, chain verification. Pure Rust, zero-copy. |

**Rationale:**
- rcgen generates self-signed certificates on first install (HTTPS works immediately) and CSRs for admins submitting to corporate or paid CAs. Pure Rust, no OpenSSL dependency.
- x509-parser validates imported certificates: PEM parsing, expiry checks, key strength verification, hostname/SAN matching, chain completeness.
- `rustls-pemfile` (already a transitive dependency) is reused for PEM file parsing.
- See the certificate management research output and doc 22 (Deployment Guide) for the full certificate lifecycle specification.

### Universal Import Connectors

| Technology | Version | License | Purpose |
|------------|---------|---------|---------|
| **oracle** | 0.6+ | UPL-1.0/Apache-2.0 | Oracle database native driver |
| **odbc-api** | 9.x | MIT | ODBC fallback for uncommon databases |
| **calamine** | 0.26+ | MIT | Excel/ODS file reading (.xlsx, .xls, .xlsb, .ods) |
| **quick-xml** | 0.37+ | MIT | XML parsing for XML file and SOAP imports |
| **jsonschema** | 0.28+ | MIT | Runtime JSON Schema validation |
| **strsim** | 0.11+ | MIT | Jaro-Winkler fuzzy string matching for auto-mapping |
| **cron** | 0.13+ | MIT/Apache-2.0 | Cron expression parsing for schedule management |
| **notify** | 7.0+ | CC0-1.0 | Filesystem watching for file-arrival scheduling |
| **tokio-modbus** | 0.15+ | MIT/Apache-2.0 | Modbus TCP/RTU industrial protocol client |
| **rumqttc** | 0.24+ | Apache-2.0 | MQTT client for IIoT messaging |
| **ssh2** | 0.9+ | MIT/Apache-2.0 | SFTP file transfer |
| **suppaftp** | 6.0+ | Apache-2.0 | FTP/FTPS file transfer |
| **object_store** | 0.11+ | Apache-2.0 | S3-compatible object storage access |
| **rdkafka** | 0.36+ | MIT | Apache Kafka consumer |
| **lapin** | 2.5+ | MIT | RabbitMQ/AMQP client |
| **async-nats** | 0.38+ | Apache-2.0 | NATS messaging client |
| **tonic** | 0.12+ | MIT | gRPC client for gRPC API imports |
| **prost** | 0.13+ | MIT | Protocol Buffers (Sparkplug B and gRPC) |
| **graphql_client** | 0.14+ | MIT/Apache-2.0 | GraphQL API client |
| **ldap3** | 0.11+ | MIT/Apache-2.0 | LDAP/Active Directory client |
| **oauth2** | 5.0+ | MIT/Apache-2.0 | OAuth 2.0 authentication flows |
| **openidconnect** | 4.0+ | MIT/Apache-2.0 | OpenID Connect authentication |
| **sspi-rs** | 0.13+ | MIT/Apache-2.0 | Kerberos/NTLM Windows authentication |
| **sha2** | 0.10+ | MIT/Apache-2.0 | Row hashing for duplicate detection |

**Rationale:**
- Native Rust drivers for the 4 most common databases (PostgreSQL via sqlx, MSSQL via tiberius, MySQL via sqlx, Oracle via oracle crate); ODBC as fallback for uncommon databases
- Industrial protocol support (Modbus TCP/RTU, MQTT, Sparkplug B) for direct device integration
- File format parsers for common import sources (Excel, XML, CSV already in project)
- Messaging system clients (Kafka, RabbitMQ, NATS) for event-driven imports
- Authentication libraries for connecting to secured external systems (OAuth, OIDC, LDAP, Kerberos)
- See 24_UNIVERSAL_IMPORT.md for full connector catalog (60+ connection types)

---

## Frontend Technologies

### Core Framework

| Technology | Version | License | Purpose |
|------------|---------|---------|---------|
| **React** | 18.3+ | MIT | UI framework |
| **TypeScript** | 5.4+ | Apache-2.0 | Type safety for JavaScript |
| **Vite** | 5.x | MIT | Build tool and dev server |

**Rationale for React:**
- Industry-leading component-based architecture
- Massive ecosystem and community
- Excellent performance with virtual DOM
- Hooks provide clean state management patterns
- Great TypeScript support

**Rationale for Vite:**
- Lightning-fast development server with HMR
- Optimized production builds with Rollup
- Native ES modules support
- Excellent TypeScript integration

### State Management

| Technology | Version | License | Purpose |
|------------|---------|---------|---------|
| **Zustand** | 4.x | MIT | Client-side state management |
| **zundo** | 2.x | MIT | Temporal undo/redo middleware for Zustand |
| **TanStack Query** | 5.x | MIT | Server state and caching |

**Rationale for Zustand:**
- Minimal boilerplate compared to Redux
- No context provider overhead
- Excellent TypeScript support
- Simple, intuitive API

**Rationale for TanStack Query:**
- Automatic background refetching
- Cache management
- Optimistic updates
- Query invalidation

### UI Components & Styling

| Technology | Version | License | Purpose |
|------------|---------|---------|---------|
| **Radix UI** | Latest | MIT | Accessible UI primitives |
| **Tailwind CSS** | 3.x | MIT | Utility-first styling |
| **clsx** | Latest | MIT | Conditional class names |
| **tailwind-merge** | Latest | MIT | Merge Tailwind classes |
| **Inter** | Variable | SIL OFL 1.1 | Primary UI typeface. Variable font (wght 100-900, opsz). 14px body default. Tabular figures (`tnum`) for numeric data displays. |
| **JetBrains Mono** | Variable | SIL OFL 1.1 | Monospace typeface for code, data values, point IDs, expression editors. Variable font. |
| **Lucide React** | Latest | ISC | Icon library (~1,500 icons, tree-shakeable). Supplemented by ~50-60 custom industrial SVG icons for I/O-specific symbols. |
| **cmdk** | Latest | MIT | Command palette component (Ctrl+K). Headless/unstyled. Powers universal search + quick actions. |
| **react-hotkeys-hook** | Latest | MIT | Keyboard shortcut management. G-key navigation (G then D for Dashboards, etc.), module hotkeys, Escape handling. |

**Rationale for Radix UI:**
- Unstyled, accessible components
- WAI-ARIA compliant
- Composable and customizable
- Excellent keyboard navigation

**Rationale for Tailwind:**
- Rapid UI development
- Consistent design system
- Minimal CSS bundle size (tree-shaking)
- Easy theming with CSS variables

**Rationale for Inter + JetBrains Mono:**
- Inter dominates the monitoring/enterprise space (Grafana, Linear, Supabase all use it). Designed specifically for UI with excellent tabular figures critical for I/O's numeric data displays.
- JetBrains Mono provides clear distinction between similar characters (0/O, 1/l/I) essential for point IDs and data values in industrial contexts.
- Both are SIL OFL 1.1 — compatible with commercial use, self-hosted (no external font service dependency).

**Rationale for Lucide + cmdk + react-hotkeys-hook:**
- Lucide is the maintained fork of Feather Icons with ISC license, tree-shakeable (only imported icons ship). Custom industrial icons (valves, pumps, vessels, etc.) extend the set for I/O-specific UI elements.
- cmdk provides a headless command palette (Ctrl+K) that integrates with I/O's universal search, module navigation, and quick actions. Unstyled — styled with Tailwind + Radix to match I/O themes.
- react-hotkeys-hook manages keyboard shortcuts declaratively via React hooks. Supports Gmail-style G-key sequences (G+D = Dashboards), module-specific hotkeys, and scope-based activation to prevent conflicts.

### Routing

| Technology | Version | License | Purpose |
|------------|---------|---------|---------|
| **React Router** | 6.x | MIT | Client-side routing |

**Rationale:**
- Industry standard for React routing
- Type-safe routes with TypeScript
- Code splitting support
- Nested routes

### Graphics & Visualization

| Technology | Version | License | Purpose |
|------------|---------|---------|---------|
| **Native SVG** | - | W3C Standard | Graphics rendering |
| **react-grid-layout** | 2.x | MIT | Multi-pane workspace grid layout with drag, resize, and constraints |
| **uPlot** | 1.x | MIT | High-performance time-series charting (~35KB). Handles 100K+ points at 60fps. Used for all time-series visualizations. |
| **Apache ECharts** | 5.x | Apache-2.0 | General-purpose charting library (tree-shakeable). Bar, pie, gauge, heatmap, scatter, etc. WebGL renderer for large datasets. |
| **Plotly.js** | 2.x | MIT | Advanced statistical and 3D charts (Probability Plot, 3D Surface/Contour). Lazy-loaded on demand (~3 MB). Used for late v1 chart types only. |
| **TanStack Table** | 8.x | MIT | Headless table library. Virtual scrolling, sorting, filtering for 100K+ row tables. |
| **canvg** | 4.x | MIT | SVG-to-Canvas rendering for the hybrid rendering pipeline's static layer |
| **react-virtualized** | 9.x | MIT | List virtualization |
| **Tiptap** | 2.x | MIT | Rich text editor built on ProseMirror. Used in Log module for WYSIWYG shift log entries. |
| **SVG.js** | 3.x | MIT | SVG DOM manipulation library. Foundation for Designer module's SVG-native editor. |
| **react-zoom-pan-pinch** | 3.x | MIT | Touch-friendly zoom/pan for mobile graphics rendering. |
| **zxing-js** | 0.21+ | Apache-2.0 | Barcode scanning library. iOS fallback for PWA BarcodeDetector API. |
| **browser-image-compression** | 2.x | MIT | Client-side image compression for mobile photo capture. |
| **Leaflet** | 1.9+ | BSD-2-Clause | Lightweight tile viewer for phone graphics rendering. Smooth pinch-zoom, momentum scrolling, offline tile caching. |
| **Workbox** | 7.x | MIT | Service worker toolkit for PWA offline caching. |

**Rationale:**
- Native SVG provides maximum flexibility and performance
- react-grid-layout v2 is the Console/Process workspace foundation: pluggable compactors, built-in `aspectRatioConstraint`, drag-from-outside via `droppingItem`, TypeScript-first, 22k GitHub stars. Custom code for swap-on-drop and drag-to-remove is minimal (~80 lines). See `07_CONSOLE_MODULE.md`.
- uPlot + Apache ECharts + Plotly.js replace Recharts: Recharts cannot handle industrial-scale datasets (100K+ points). uPlot handles high-frequency time-series; ECharts handles general-purpose charts with WebGL rendering; Plotly.js (MIT, lazy-loaded) handles advanced statistical and 3D charts.
- TanStack Table provides headless table primitives with virtual scrolling for large configuration and data tables
- React-virtualized for handling large data lists efficiently
- Tiptap provides a ProseMirror-based rich text editor for the Log module's WYSIWYG entries
- SVG.js provides programmatic SVG manipulation for the Designer module
- react-zoom-pan-pinch enables touch-friendly zoom/pan for mobile graphics views
- zxing-js provides barcode scanning on iOS where the native BarcodeDetector API is unavailable
- browser-image-compression reduces photo size client-side before upload on mobile
- Leaflet provides a battle-tested tile viewer (Google Maps-style interaction) for phone graphics, rendering pre-generated tile pyramids with dynamic value overlays
- Workbox provides service worker generation and caching strategies for PWA offline support

### Drag-and-Drop & Expression Evaluation

| Technology | Version | License | Purpose |
|------------|---------|---------|---------|
| **@dnd-kit/core** | 6.x | MIT | Drag-and-drop framework |
| **@dnd-kit/sortable** | 7.x | MIT | Sortable presets for workspace layout |
| **@dnd-kit/modifiers** | Latest | MIT | Snap-to-grid and drag modifiers |
| **expr-eval-fork** | 3.0.1 | MIT | Safe client-side expression evaluation |

**Rationale for @dnd-kit:**
- React 18 compatible with first-class hook support
- Nested SortableContext for container/group tiles
- Snap-to-grid via modifiers (Flexbox-based tile layout)
- DragOverlay for drop position indicators
- Lightweight and performant
- Used by Expression Builder (23) for tile workspace and Console Module (07) as supplemental DnD for palette-to-workspace drag and multi-select interactions

**Rationale for expr-eval-fork:**
- Pure AST tree-walking evaluation (no `eval()` or `Function()`)
- v3.0.1 patches CVE-2025-12735 (critical RCE in original expr-eval)
- Supports `if(cond, then, else)` for conditional expressions
- Custom function allowlist for secure evaluation
- Compile-once, evaluate-many pattern (~0.01ms per evaluation)
- **Not using**: original expr-eval (unpatched CVE), mathjs (LGPL sub-dependency CSparse), evalexpr (AGPL)

### Help System

| Technology | Version | License | Purpose |
|------------|---------|---------|---------|
| **react-joyride** | 2.x | MIT | Guided tour library with spotlight overlay, step-by-step tooltips, and beacon animations. Used for onboarding tours and feature introductions. |
| **react-markdown** | 9.x | MIT | Markdown-to-React renderer for help content display in contextual help panel |
| **fuse.js** | 7.x | Apache-2.0 | Lightweight fuzzy search library for client-side help article search and command palette help integration |

**Rationale:**
- react-joyride provides spotlight-based guided tours for onboarding new users and introducing new features. Step definitions are declarative and context-aware.
- react-markdown renders help content authored in Markdown, allowing non-developer authoring of help articles that display natively in the contextual help panel.
- fuse.js enables fast client-side fuzzy search across help articles without requiring a server round-trip. Also powers help results in the command palette (Ctrl+K).
- All three are MIT or Apache-2.0, fully compliant with licensing requirements.
- See doc 06 (Frontend Shell) for help system integration.

### Real-Time Communication & Browser Platform APIs

| Technology | Version | License | Purpose |
|------------|---------|---------|---------|
| **WebSocket API** | Native | W3C Standard | Real-time data updates |
| **SharedWorker** | Native | W3C Standard | Cross-window WebSocket connection pooling |
| **BroadcastChannel** | Native | W3C Standard | Cross-window state synchronization |
| **Window Management API** | Native | W3C Draft | Multi-monitor window positioning |

**Rationale:**
- Native browser WebSocket API is lightweight and fast
- No library overhead
- Direct control over connection management

**Multi-Window APIs (SharedWorker, BroadcastChannel, Window Management API):**
- **SharedWorker**: All browser windows share a single WebSocket connection to the data broker via a SharedWorker. Eliminates redundant connections when multiple windows are open. Supported in Chrome, Edge, Firefox. See doc 06 and doc 16 for architecture details.
- **BroadcastChannel**: Lightweight pub/sub for auth token refresh, theme changes, and window lifecycle events across all open windows. Used on the `io-app-sync` channel. Supported in all modern browsers.
- **Window Management API**: Progressive enhancement that enables precise placement of detached windows on specific monitors. Chrome and Edge only; graceful fallback when unavailable (windows open with default positioning).
- All three are native browser APIs — no additional libraries, dependencies, or licensing concerns.

---

## Database

### Primary Database

| Technology | Version | License | Purpose |
|------------|---------|---------|---------|
| **PostgreSQL** | 16+ | PostgreSQL License | Relational database |
| **TimescaleDB** | 2.13+ | Apache-2.0 | Time-series extension |

**Rationale for PostgreSQL:**
- Industry-leading open-source RDBMS
- ACID compliance and reliability
- Excellent JSON support (JSONB)
- Rich indexing options (B-tree, GiST, GIN, BRIN)
- Strong community and ecosystem
- Commercial-friendly license

**Rationale for TimescaleDB:**
- PostgreSQL extension (no separate database)
- Automatic partitioning (hypertables)
- Continuous aggregates for fast queries
- Time-series specific optimizations
- Compression for storage efficiency
- Apache 2.0 license (commercial-friendly)

> **Note:** Only TimescaleDB core (Apache 2.0) is used — hypertables, continuous aggregates, compression, and `time_bucket`. TimescaleDB Toolkit (Timescale License / TSL) is **not used**. All statistical computation (correlation, cross-correlation, change point detection) runs in Rust using MIT/Apache-2.0 crates (see doc 12). This avoids any non-OSI licensing dependencies.

### Database Features Used

- **JSONB columns** - Flexible schema for settings and metadata
- **UUID primary keys** - Distributed-friendly identifiers
- **Triggers** - Automatic timestamp updates, audit logging
- **Views** - Simplified query interfaces
- **Indexes** - B-tree for lookups, GIN for JSONB, BRIN for time-series
- **Foreign keys** - Referential integrity
- **Multi-site support** - Multiple point sources with role-based access filtering. Application-level RBAC handles data visibility per user role and site assignment (row-level security not required)
- **Hypertables** - Time-series data partitioning
- **Continuous aggregates** - Pre-computed rollups (1min, 5min, 1hr, 1day)

---

## Infrastructure

### Reverse Proxy

| Technology | Version | License | Purpose |
|------------|---------|---------|---------|
| **nginx** | 1.24+ | 2-clause BSD | Reverse proxy, TLS termination |

**Rationale:**
- Industry standard reverse proxy
- Excellent performance for static file serving
- Mature TLS/SSL support
- Load balancing capabilities
- Simple configuration

### Containerization

| Technology | Version | License | Purpose |
|------------|---------|---------|---------|
| **Docker** | 24+ | Apache-2.0 | Container runtime |
| **Docker Compose** | 2.20+ | Apache-2.0 | Multi-container orchestration |

**Rationale:**
- Standard containerization platform
- Simplified development environment setup
- Consistent deployments
- Easy service isolation

### Process Management (Production)

| Technology | Version | License | Purpose |
|------------|---------|---------|---------|
| **systemd** | System default | LGPL-2.1+ | Service management |

**Rationale:**
- Standard on all modern Linux distributions
- Automatic restart on failure
- Service dependencies
- Resource limits
- *Note: systemd itself is LGPL, but using it to run our services does not impose licensing restrictions on our application*

### Certificate Automation

| Technology | Version | License | Purpose |
|------------|---------|---------|---------|
| **instant-acme** | Latest | Apache-2.0 | Pure Rust async ACME client for Let's Encrypt/ZeroSSL certificate automation. Integrated directly into the API Gateway. |

**Rationale:**
- Pure Rust, async/Tokio — no subprocess orchestration, no shell dependency
- Apache-2.0 license (compatible with I/O's licensing requirements)
- Native Rust error handling and structured logging (no stdout/stderr parsing)
- Supports HTTP-01 and DNS-01 challenge types
- DNS-01 provider integration via API Gateway HTTP client (Cloudflare, AWS Route 53, Azure DNS, etc.) — critical for industrial sites where port 80 is blocked
- Renewal automation via systemd timer (twice-daily check, 30-day renewal window on 90-day Let's Encrypt certs)
- The API Gateway handles ACME operations directly, translating results into structured API responses for the Settings > Certificates UI

---

## Development Tools

### Package Managers

| Technology | Version | License | Purpose |
|------------|---------|---------|---------|
| **Cargo** | Latest (via rustup) | MIT/Apache-2.0 | Rust package manager |
| **pnpm** | 8.x+ | MIT | Node.js package manager |

**Rationale for pnpm:**
- Faster than npm/yarn
- Efficient disk space usage (content-addressable storage)
- Strict dependency resolution
- Monorepo support

### Version Control

| Technology | Version | License | Purpose |
|------------|---------|---------|---------|
| **Git** | 2.40+ | GPL-2.0 | Version control |

*Note: Using Git does not impose licensing restrictions on our codebase*

### Code Quality

| Technology | Version | License | Purpose |
|------------|---------|---------|---------|
| **rustfmt** | Latest | MIT/Apache-2.0 | Rust code formatting |
| **clippy** | Latest | MIT/Apache-2.0 | Rust linter |
| **ESLint** | 8.x | MIT | TypeScript/JavaScript linter |
| **Prettier** | 3.x | MIT | Frontend code formatting |

### License & SBOM Tooling (Build-Time)

| Technology | Version | License | Purpose |
|------------|---------|---------|---------|
| **cargo-about** | Latest | MIT/Apache-2.0 | Generate backend license manifest (JSON) from Cargo dependencies |
| **cargo-deny** | Latest | MIT/Apache-2.0 | CI gate: reject banned licenses, detect duplicates, check advisories |
| **cargo-cyclonedx** | Latest | Apache-2.0 | Generate CycloneDX SBOM (backend) |
| **license-checker** | Latest | BSD-3-Clause | Generate frontend license manifest (JSON) from npm dependencies |
| **@cyclonedx/cyclonedx-npm** | Latest | Apache-2.0 | Generate CycloneDX SBOM (frontend) |

These tools run at build time only — they are not runtime dependencies and are not shipped with the application. Output artifacts (`backend-licenses.json`, `frontend-licenses.json`, `sbom-backend.cdx.json`, `sbom-frontend.cdx.json`) are bundled as static assets for the About page and SBOM download. See Doc 06 (Frontend Shell) About Page section.

---

## Architectural Patterns

### Backend Patterns
- **Service-oriented architecture** - 11 independent Rust services
- **Async/await everywhere** - Non-blocking I/O via Tokio
- **Repository pattern** - Database access abstraction
- **Middleware pattern** - Cross-cutting concerns (auth, logging, errors)
- **Pub/sub pattern** - WebSocket message fanout

### Frontend Patterns
- **Component-based architecture** - Reusable React components
- **Hooks pattern** - State and effects with React hooks
- **Custom hooks** - Shared logic extraction
- **Presentational vs Container** - Separate UI from logic
- **Route-based code splitting** - Lazy load modules

### Database Patterns
- **Normalized schema** - Third normal form for transactional data
- **Denormalized time-series** - Fast time-series queries
- **Soft deletes** - Audit trail preservation
- **Optimistic locking** - Concurrent update handling
- **Connection pooling** - Efficient connection management

---

## Internal Workspace Crates

Common functionality is implemented as shared workspace crates (`io-*`), never duplicated across services.

| Crate | Used By | Purpose |
|-------|---------|---------|
| `io-auth` | All 11 services | JWT validation, service secret check, RBAC permission checks, master key encrypt/decrypt |
| `io-bus` | Data Broker, OPC, Event, Alert | IPC messaging — UDS frame codec, NOTIFY channel helpers, message routing |
| `io-db` | All services with DB | SQLx pool setup, migration runner, common query helpers, audit log writing |
| `io-error` | All 11 services | Unified error types, API error response formatting (JSON shape, status codes) |
| `io-models` | All 11 services | Shared domain types — Rust structs mirroring DB schema, serde derives, TypeScript parity types |
| `io-opc` | OPC Service, Data Broker | OPC UA data types, subscription helpers, tag path parsing |
| `io-time` | All 11 services | Timestamp handling, timezone utilities, duration formatting |
| `io-validate` | All 11 services | Input validation rules, sanitization, constraint checking |
| `io-export` | API Gateway, Archive, Import | Export format utilities (CSV, PDF/Typst, HTML, JSON, .iobackup, .iographic) |
| `io-health` | All 11 services | Three-tier health check endpoints (live/ready/startup). See doc 36 |
| `io-observability` | All 11 services | Unified tracing + metrics + health init; structured logging; Prometheus-format `/metrics`. See doc 36 |

> **Decision framework:** If a capability is stateless and needed in the critical path, it's a shared crate (compile-time dependency). If it needs queuing, persistence, or centralized management, it's a standalone service.

---

## Browser Support Matrix

| Browser | Minimum Version | Support Level | Notes |
|---------|----------------|--------------|-------|
| Chrome | 120+ | Full | Primary development target |
| Edge | 120+ | Full | Chromium-based, feature parity with Chrome |
| Firefox | 115+ (ESR) | Full | SharedWorker supported since v29 |
| Safari | 17+ | Functional | No SharedWorker (each tab opens own WebSocket), no Window Management API |
| Mobile Chrome (Android) | 120+ | Functional | Rounds and Log modules only (see doc 20) |
| Mobile Safari (iOS) | 17+ | Functional | Rounds and Log modules only, PWA install limitations on iOS |

**Support level definitions:**
- **Full**: All features work including SharedWorker WebSocket connection pooling and multi-window management
- **Functional**: Core application features work; some progressive enhancements unavailable (SharedWorker, Window Management API)

**Not supported:** IE11, pre-Chromium Edge (<79), Chrome <120, Firefox <115. The application displays a browser upgrade notice for unsupported browsers.

**Enterprise note:** Firefox ESR 115 is included because many industrial environments run locked-down IT with extended support release cycles. Chrome 120+ covers all major enterprise management deployments (Chrome Enterprise).

---

## Performance Targets

| Metric | Target | Technology Impact |
|--------|--------|-------------------|
| Point update latency | < 2s | Tokio async, WebSocket, TimescaleDB |
| API response time (p95) | < 200ms | Axum, SQLx, connection pooling |
| Graphic render time | < 1.5s | React, SVG, virtualization |
| Concurrent users | 200+ | Tokio async, WebSocket fanout |
| Database query time | < 100ms | PostgreSQL indexes, TimescaleDB aggregates |

---

## Security Considerations

### Transport Security
- **TLS 1.3** - nginx terminates TLS
- **HTTPS only** - No plaintext HTTP in production
- **WebSocket over TLS** - wss:// protocol

### Application Security
- **JWT tokens** - Stateless authentication
- **Token expiration** - 15-minute access tokens, 7-day refresh tokens
- **Password hashing** - Argon2 (not bcrypt or MD5)
- **RBAC** - Fine-grained permissions
- **Input validation** - All API inputs validated
- **SQL injection prevention** - Parameterized queries (SQLx)
- **XSS prevention** - React automatic escaping

### Database Security
- **Encrypted connections** - PostgreSQL SSL/TLS
- **Principle of least privilege** - Service-specific database users
- **Audit logging** - Comprehensive audit trail
- **Backup encryption** - Encrypted database backups

---

## Excluded Technologies

Technologies explicitly **NOT** used and why:

| Technology | Why Not |
|------------|---------|
| **Node.js backend** | Performance concerns for real-time data processing; Rust provides better guarantees |
| **Python backend** | GIL limits concurrency; Rust provides better performance |
| **Go backend** | Acceptable, but Rust chosen for memory safety and ecosystem maturity |
| **MongoDB** | PostgreSQL provides better transactional guarantees and JSONB support |
| **Redis** | Not needed initially; PostgreSQL adequate for caching needs |
| **Kubernetes** | Overkill for single-server deployment; systemd sufficient |
| **GraphQL** | REST simpler for this use case; WebSocket handles real-time |
| **Angular** | React has larger ecosystem and better TypeScript experience |
| **Vue.js** | React more widely adopted, larger talent pool |
| **Svelte** | Too new, smaller ecosystem |
| **WebGL** | Defer until hybrid SVG/Canvas proves insufficient |
| **Canvas API (direct)** | Used indirectly via `canvg` for hybrid rendering static layer (see doc 19). Direct Canvas API authoring excluded — all graphics authored as SVG. |
| **mathjs** | LGPL sub-dependency (CSparse) violates licensing requirement |
| **evalexpr (Rust)** | AGPL license violates licensing requirement |
| **expr-eval (original)** | Unpatched CVE-2025-12735 (critical RCE); use expr-eval-fork v3.0.1 instead |
| **Recharts** | Performance limitations with industrial-scale datasets (100K+ points). Replaced by uPlot (time-series) + Apache ECharts (general-purpose). |
| **react-beautiful-dnd** | Deprecated; @dnd-kit is the modern replacement with React 18 support |

---

## Technology Decision Matrix

When evaluating new technologies or alternatives, use this decision matrix:

1. ✅ **License compatible?** (MIT, Apache-2.0, BSD, ISC)
2. ✅ **Actively maintained?** (Recent commits, responsive maintainers)
3. ✅ **Production-ready?** (Version 1.0+, battle-tested)
4. ✅ **Good documentation?** (Clear docs, examples)
5. ✅ **Community support?** (Active community, Stack Overflow presence)
6. ✅ **Performance adequate?** (Meets our performance targets)
7. ✅ **Security track record?** (No major vulnerabilities, security audits)
8. ✅ **TypeScript support?** (For frontend libraries)

All criteria must be satisfied before adopting a new technology.

---

**Next Steps:** Review system architecture document for how these technologies work together.

## Change Log

- **v2.1**: Reconciled Internal Workspace Crates table to canonical 11-crate list. Renamed `io-auth-middleware` → `io-auth`. Merged `io-telemetry` into `io-observability`, `io-crypto` into `io-auth`, `io-audit` into `io-db`. Removed `io-config` (per-service, not shared). Reclassified `io-sms` as utility crate (not shared — only Alert/Auth services). Added `io-bus`, `io-models`, `io-opc`, `io-time`, `io-validate`, `io-export`. Crate count now 11, matching docs 02 and 05.
- **v2.0**: Replaced `genpdf` (Apache-2.0) with `typst` (MIT, via `typst-as-lib`) for PDF generation. Typst produces professional output with branded templates, proper typography, page-spanning tables, and embedded charts. Shared across Reports, Log, and Export modules.
- **v1.9**: Replaced `acme.sh` (ISC, shell subprocess) with `instant-acme` (Apache-2.0, pure Rust, async/Tokio) for ACME certificate automation. Eliminates subprocess orchestration — ACME operations handled natively by API Gateway.
- **v1.8**: Updated Excluded Technologies: Canvas API entry now reflects indirect use via `canvg` for hybrid rendering (doc 19). WebGL deferral updated to reference hybrid SVG/Canvas baseline.
- **v1.7**: Added `tesseract-rs` (Apache 2.0) for OCR attachment text extraction. System dependency on `tesseract-ocr`. Post-v1 upgrade path: ONNX HTR model for handwritten text via existing `ort` crate. See doc 13.
- **v1.6**: Added Browser Support Matrix (Chrome 120+, Edge 120+, Firefox ESR 115+, Safari 17+ functional, mobile Chrome/Safari functional for Rounds/Log). Full vs Functional support levels defined. Enterprise ESR note for locked-down industrial environments.
- **v1.5**: Added observability crates (`metrics`, `metrics-exporter-prometheus`, `metrics-tracing-context`, `opentelemetry`, `tracing-opentelemetry`) for Prometheus-format metrics and optional distributed tracing. Added `io-health` and `io-observability` shared workspace crates (11 total, was 9). Added frontend help system libraries (`react-joyride`, `react-markdown`, `fuse.js`). See doc 36 (Observability) and doc 06 (Help System).
- **v1.4**: Added License & SBOM Tooling section under Development Tools. Build-time tools: cargo-about, cargo-deny, cargo-cyclonedx (backend); license-checker, @cyclonedx/cyclonedx-npm (frontend). Output artifacts bundled as static assets for About page and SBOM download. All tools MIT/Apache-2.0/BSD-3-Clause. See Doc 06 About Page.
- **v1.3**: Added Inter, JetBrains Mono, Lucide React, cmdk, react-hotkeys-hook (frontend); rcgen, x509-parser (backend certificate management); acme.sh (external ACME tool). Verified Recharts removal (already in Excluded Technologies).
- **v1.2**: Added resvg (MPL-2.0) for server-side tile rendering and Leaflet (BSD-2-Clause) for phone graphics tile viewer. See doc 20 for phone graphics architecture.
- **v1.1**: Added frontend libraries: uPlot, Apache ECharts, TanStack Table, Tiptap, SVG.js, react-zoom-pan-pinch, zxing-js, browser-image-compression, Workbox. Recharts replaced by uPlot + ECharts. Added Rust crates: rustfft/realfft, ndarray-stats, augurs-changepoint, statrs, aes-gcm, rsa.
- **v1.0**: Added Internal Workspace Crates section (9 `io-*` shared crates with decision framework). Added `yara-x` (BSD-3-Clause) for file upload scanning. Added OPC UA `opcua` crate risk note and fallback ladder (fork → `open62541` FFI). Replaced "Row-level security / multi-tenancy" with multi-site support via RBAC. Added `canvg` (MIT) for hybrid SVG-to-Canvas rendering. Updated service count from 9 to 11.
- **v0.9**: Added Email & Alerting crates section: lettre (SMTP), minijinja (templates), web-push-native (browser push), aws-sdk-sesv2 (optional SES). Noted reuse of oauth2, jsonwebtoken, and reqwest for alerting/email provider APIs. Updated service count from 7 to 9. See docs 27 and 28.
- **v0.8**: Renamed "P&ID Recognition" section to "Symbol Recognition" to reflect dual-domain support (P&ID and DCS). Updated `ort` description for multi-model concurrent sessions. Added `image` and `imageproc` crates for recognition preprocessing. See SymBA 17_IO_INTEGRATION.md.
- **v0.7**: Fixed "retokens" to "refresh tokens" in Security Considerations prose.
- **v0.6**: Added SharedWorker, BroadcastChannel, and Window Management API to browser platform APIs for multi-window support. Renamed section to "Real-Time Communication & Browser Platform APIs". All native W3C Standard/Draft — no licensing concern. See doc 06 and doc 16 for multi-window architecture details.
- **v0.5**: Added `react-grid-layout` v2 (MIT) for Console/Process multi-pane workspace grids, `zundo` v2 (MIT) for undo/redo via Zustand temporal middleware. Updated `@dnd-kit` rationale to cover Console Module supplemental usage. See `07_CONSOLE_MODULE.md`.
- **v0.4**: Added `ort` crate for ONNX inference supporting P&ID symbol recognition. See `26_PID_RECOGNITION.md`.
- **v0.3**: Added Universal Export crates: rust_xlsxwriter (XLSX), genpdf (PDF), parquet + arrow (Parquet). All MIT or Apache-2.0. CSV and JSON export reuse existing crates. See 25_EXPORT_SYSTEM.md.
- **v0.2**: Added Universal Import connector crates (24 new backend dependencies). Native database drivers: oracle. ODBC fallback: odbc-api. File parsers: calamine, quick-xml. Validation: jsonschema, strsim. Scheduling: cron, notify. Industrial protocols: tokio-modbus, rumqttc, prost. File transfer: ssh2, suppaftp, object_store. Messaging: rdkafka, lapin, async-nats. API clients: tonic, graphql_client. Authentication: ldap3, oauth2, openidconnect, sspi-rs. Utilities: sha2. Updated tiberius description (shared by Event Service and Import Service). Updated service count from 6 to 7. See 24_UNIVERSAL_IMPORT.md for full details.
- **v0.1**: Added Expression Builder libraries. Frontend: @dnd-kit (core, sortable, modifiers) for drag-and-drop tile workspace, expr-eval-fork v3.0.1 for safe client-side expression evaluation. Backend: Rhai v1.19.0 for server-side expression evaluation in expression-only mode. Added excluded technologies: mathjs (LGPL), evalexpr (AGPL), original expr-eval (unpatched CVE), react-beautiful-dnd (deprecated).
