# Inside/Operations - Project Overview

## Executive Summary

**Inside/Operations** is a modern, high-performance web application designed for refinery and industrial process monitoring and operations management. The system provides real-time visualization of process data, operational logging capabilities, field operations support, and advanced data analysis tools across 11 integrated modules.

## Vision

Create a comprehensive, user-friendly platform that enables refinery operators, engineers, and management to:

- **Monitor processes in real-time** with multi-pane graphics workspaces displaying thousands of data points
- **Log operational activities** with structured, searchable shift logs and equipment documentation
- **Conduct field operations** efficiently with mobile-capable checklists and equipment rounds
- **Analyze historical data** through dashboards, reports, and forensic investigation tools
- **Manage process graphics** with an intuitive designer for creating and editing visual displays

## Goals

### Primary Goals

1. **Real-Time Performance**
   - Sub-second latency for data updates from OPC UA sources to frontend display
   - Support for 10,000+ concurrent data points per view
   - Handle 200+ concurrent web clients with smooth performance

2. **Operational Excellence**
   - Reduce time spent on shift handovers with structured logging
   - Improve field operation efficiency with mobile checklists
   - Enable faster incident investigation with forensic tools

3. **User Experience**
   - Intuitive, professional interface suitable for industrial environments
   - Responsive design that works on control room monitors and field tablets
   - Customizable workspaces and dashboards for different roles

4. **Reliability & Security**
   - 24/7 uptime suitable for critical infrastructure
   - Role-based access control with fine-grained permissions
   - Comprehensive audit logging for compliance

### Secondary Goals

- **Scalability** - Architecture that can grow from single refinery to enterprise deployment
- **Maintainability** - Clean codebase with comprehensive documentation
- **Extensibility** — Trait-based adapter pattern for integrations (email providers, alert channels, auth providers, import connectors) and a documented REST API for external system integration
- **Performance** - Optimized for low-latency operations on standard hardware
- **Shared Crate First** — Common functionality is implemented as internal workspace crates (`io-*`), never duplicated across services. If two or more services need the same capability, it's a shared crate. Services depend on shared crates at compile time, not on each other at runtime

## Scope

### In Scope

**11 Application Modules:**
1. [Console](obsidian://open?vault=Markdown&file=InOps%2Fdesign-docs%2F07_CONSOLE_MODULE) - Multi-pane real-time graphics display
2. [**Process**](obsidian://open?vault=Markdown&file=InOps%2Fdesign-docs%2F08_PROCESS_MODULE) - Large-scale single-pane process views
3. **Designer** - Graphics editor and template creation tool
4. **Dashboards** - Real-time data visualization with custom widgets
5. **Reports** - Historical data reports with flexible export
6. **Forensics** - Advanced data correlation and investigation
7. **Log** - Operational log book with rich formatting
8. **Rounds** - Field operations checklists and equipment rounds
9. **Settings** - System configuration and user management
10. **Shifts** - Shift schedule management, crew rosters, badge-based presence tracking, emergency mustering
11. **Alerts** - Human-initiated alerts, emergency notifications, muster command center

**11 Backend Services:**
- API Gateway (REST endpoints, request routing)
- Auth Service (Authentication, authorization, session management)
- Data Broker (WebSocket fanout for real-time updates)
- OPC Service (OPC UA client for industrial data acquisition)
- Event Service (Historical event/alarm data ingestion)
- Parser Service (3rd party graphics import)
- Archive Service (Time-series data management)
- Import Service (Universal data import from external systems)
- Alert Service (Emergency and operational alerting with escalation)
- Email Service (System-wide email delivery with multiple providers)
- Recognition Service (P&ID and DCS symbol recognition inference)

**Data Integration:**
- OPC UA servers (primary real-time data source)
- MSSQL event historians (alarm and event data)
- 3rd party graphics file import (various formats)

**Deployment:**
- Linux server deployment (Ubuntu/RHEL/Debian)
- Docker Compose for development
- Systemd + nginx for production
- PostgreSQL + TimescaleDB database

### Out of Scope

**Not included in initial release:**
- Windows server deployment
- Native mobile applications (Log and Rounds will have mobile web interface; native apps deferred to future phase)
- Predictive failure modeling (e.g., "valve will fail in 3 days") — permanent exclusion due to liability; if a CMMS provides predictive data, import it via Universal Import (doc 24)
- Multi-tenancy (single refinery deployment initially)
- Cloud-managed deployment services (AWS ECS, Azure App Service, GCP Cloud Run, etc.) — deploying I/O on a cloud-hosted Linux VM is fine; what's excluded is cloud-native managed infrastructure

**Covered elsewhere (removed from Out of Scope):**
- ~~ERP integration (SAP, Oracle)~~ — Read-only ERP data import is handled by Universal Import (doc 24) with connector templates for SAP S/4HANA, Oracle Fusion/EBS, Infor CloudSuite, Dynamics 365, and Hitachi Ellipse. Write-back to ERP systems is not in scope.
- ~~Advanced analytics (ML/AI)~~ — Broken into specific items: ML-assisted symbol recognition is in scope (doc 26, SymBA). Forensics statistical analysis is in scope (doc 12). Predictive failure modeling is permanently excluded (see above). AI-assisted field mapping for imports is deferred (doc 24 future extensibility).

## Target Users

### Primary Users

1. **Control Room Operators**
   - Monitor real-time process graphics (Console, Process modules)
   - View dashboards with key performance indicators
   - Review operational logs from field personnel

2. **Field Operators**
   - Create operational log entries (Log module)
   - Complete equipment rounds using checklists (Rounds module)
   - Access via tablets or smartphones in field locations

3. **Process Engineers**
   - Analyze historical data (Reports, Forensics modules)
   - Create custom dashboards and reports
   - Investigate process incidents and anomalies

4. **Maintenance Personnel**
   - Review equipment status and trends
   - Complete maintenance rounds
   - Document equipment issues in logs

### Secondary Users

5. **Supervisors**
   - Review team logs and round completions
   - Assign rounds to operators
   - Monitor overall operations

6. **System Administrators**
   - Configure users, groups, and permissions (Settings module)
   - Manage graphics and templates (Designer module)
   - Configure OPC UA connections and data sources

7. **Management**
   - View high-level dashboards
   - Export reports for regulatory compliance
   - Review operational metrics

## Key Features

### Real-Time Monitoring
- Multi-pane workspace layouts with save/restore functionality
- Live data updates via WebSocket (sub-second latency)
- Support for thousands of data points per view
- Smooth rendering of SVG graphics with complex animations

### Operational Logging
- Rich text editing with formatting (fonts, colors, bullets, tables)
- Template-based entry forms for structured data
- Photo, video, and audio attachments
- Full-text search across all log entries
- Mobile-friendly interface for field use

### Field Operations
- Pre-configured equipment round checklists
- Assignment and scheduling of rounds
- Offline-capable mobile interface
- Progress tracking and completion verification
- Exception handling and escalation

### Data Analysis
- Historical data queries with flexible date ranges
- Custom dashboards with real-time widgets
- Advanced forensic search across multiple data sources
- Pattern detection and anomaly identification
- Export to CSV, PDF, Excel formats

### Graphics Management
- Import 3rd party graphics files (various formats)
- Visual editor for creating and modifying process graphics
- Point binding for real-time data display
- Template creation for reusable graphics components
- Version control and change tracking

### Emergency Alerting
- Multi-channel plant-wide alerts with configurable escalation policies
- Acknowledgment tracking with escalation on timeout
- Delivery channels: SMS/voice (Twilio), radio dispatch, PA system, WebSocket (in-app), browser push, email
- Recipient roster management with on-call schedules
- Full delivery audit trail for compliance

### Email Service
- System-wide email delivery for alerts, reports, notifications, and administrative messages
- Multiple simultaneous provider support (SMTP, SMTP+XOAUTH2, Microsoft Graph API, Gmail API, Webhook, Amazon SES)
- Template-based email rendering with MiniJinja engine
- PostgreSQL-backed queue with retry and delivery tracking

### Security & Compliance
- Role-based access control (8 predefined roles: Viewer, Operator, Analyst, Supervisor, Content Manager, Maintenance, Contractor, Admin)
- Fine-grained permissions per module and action
- Comprehensive audit logging
- Secure authentication with JWT tokens
- SAML SSO integration capability

## Success Metrics

The application will be considered successful when:

1. **Performance Targets Met**
   - Point update latency < 2 seconds end-to-end
   - Graphic render time < 1.5 seconds for typical views
   - API response time < 200ms (95th percentile)
   - Support 200+ concurrent users

2. **User Adoption**
   - 80%+ of operators use Console module daily
   - 90%+ of shift logs created digitally (vs paper)
   - 100% of equipment rounds completed via Rounds module

3. **Operational Impact**
   - 50% reduction in shift handover time
   - 30% reduction in incident investigation time
   - 100% compliance with regulatory logging requirements

4. **Technical Excellence**
   - 99.9% uptime (< 9 hours downtime per year)
   - Zero critical security vulnerabilities
   - < 100ms average database query time

## Constraints

### Technical Constraints
- Must run on Linux servers (Ubuntu 20.04+, RHEL 8+, Debian 11+)
- Must support PostgreSQL 16+ with TimescaleDB extension
- Must integrate with OPC UA servers (all standard profiles)
- Must handle network latency up to 100ms for OPC connections

### Business Constraints
- All libraries and dependencies must be royalty-free for commercial use
- No GPL/AGPL licensed components
- Must support air-gapped (isolated network) deployment
- Initial deployment for single refinery (not multi-tenant)

### User Constraints
- Control room monitors typically 1920x1080 or higher resolution
- Field tablets may use gloves (60px minimum touch targets)
- Network connectivity in field may be intermittent
- Users may have varying technical skill levels

### Regulatory Constraints
- Must maintain audit trail for all data modifications
- Must support role-based access control for compliance
- Must handle time-series data retention (7 years typical)
- Must provide exportable reports for regulatory submissions

## Assumptions

1. **Infrastructure**
   - Adequate server hardware available (16+ GB RAM, 8+ CPU cores)
   - Network connectivity between servers and OPC UA sources
   - PostgreSQL database server available

2. **Data Sources**
   - OPC UA servers properly configured and accessible
   - Event historian (if used) supports MSSQL connectivity
   - 3rd party graphics files available for import

3. **Users**
   - Basic computer literacy among all users
   - Training provided for specialized modules (Designer, Forensics)
   - Mobile devices available for field personnel

4. **Operations**
   - System administrators available for initial configuration
   - Database backups handled by existing infrastructure
   - Network security managed by IT department

## Dependencies

### External Dependencies
- OPC UA server availability and stability
- Network infrastructure and connectivity
- Database server (PostgreSQL + TimescaleDB)
- Certificate authority for SSL certificates (if HTTPS required)
- Twilio API (SMS and voice delivery for emergency alerts)
- SMTP servers (email delivery)
- Microsoft Graph API (email delivery and OAuth2 authentication)
- Radio dispatch software (alert delivery to field radios)

### Internal Dependencies
- Phase-based development: later modules depend on foundational services
- Graphics import depends on 3rd party file format specifications
- Mobile capabilities depend on web module completion
- Forensics depends on historical data accumulation

## Risks & Mitigation

### Technical Risks
1. **Real-time Performance Risk**
   - *Risk:* WebSocket fanout may not scale to 200+ concurrent users
   - *Mitigation:* Subscription deduplication, backpressure handling, horizontal scaling capability

2. **Graphics Rendering Risk**
   - *Risk:* SVG performance may degrade with 10,000+ elements
   - *Mitigation:* Viewport culling, level-of-detail rendering, Canvas/WebGL fallback option

3. **OPC UA Integration Risk**
   - *Risk:* OPC server may not support required features
   - *Mitigation:* Polling fallback, multiple security profile support, extensive testing

### Operational Risks
1. **User Adoption Risk**
   - *Risk:* Users may resist change from existing systems
   - *Mitigation:* Phased rollout, comprehensive training, champion users

2. **Data Migration Risk**
   - *Risk:* Historical data may be difficult to migrate
   - *Mitigation:* Focus on new data first, migrate historical data as separate project

### Business Risks
1. **Schedule Risk**
   - *Risk:* Development may take longer than estimated
   - *Mitigation:* Phased approach with early value delivery, MVP focus

2. **Resource Risk**
   - *Risk:* Limited development resources
   - *Mitigation:* Prioritize core features, defer nice-to-have features

## Timeline

The project follows a phased approach with the following approximate timeline:

| Phase | Focus | Duration |
|-------|-------|----------|
| 1 | Foundation | 3-5 weeks |
| 2 | Auth & Core API | 2-4 weeks |
| 3 | Real-Time Pipeline | 3-5 weeks |
| 4 | Frontend Shell & Settings Core | 2-4 weeks |
| 5 | Shared Components | 2-3 weeks |
| 6 | Graphics System & Designer | 4-6 weeks |
| 7 | Console & Process | 3-5 weeks |
| 8 | Expression Builder | 2-3 weeks |
| 9 | Reports | 3-5 weeks |
| 10 | Dashboards | 2-4 weeks |
| 11 | Forensics | 3-5 weeks |
| 12 | Log & Rounds | 3-5 weeks |
| 13 | Alerts, Shifts & Email | 4-6 weeks |
| 14 | Universal Import & Integrations | 4-6 weeks |
| 15 | Recognition & SymBA Pipeline | 2-3 weeks |
| 16 | Templates & Polish | 3-5 weeks |
| 17 | Production Hardening | 2-3 weeks |

**Total Estimated Timeline:** 44-77 weeks (approximately 11-19 months)

*Note: Timeline assumes single developer with Claude Code assistance. See 05_DEVELOPMENT_PHASES.md for detailed phase breakdown, installer milestones, and parallel development opportunities.*

## Change Log

- **v0.8**: Updated timeline table to match doc 05 v2.0 (17 phases, 44-77 weeks, demo-first order). Updated role names from old 3-role model to 8 predefined roles per doc 03.
- **v0.7**: Refined Out of Scope section. Removed ERP integration (covered by Universal Import doc 24). Replaced broad "ML/AI predictions" with specific items: predictive failure modeling (permanent exclusion, liability), ML-assisted recognition (in scope), Forensics analytics (in scope), AI-assisted field mapping (deferred). Clarified cloud deployment exclusion (cloud-managed services excluded, cloud-hosted Linux VMs are fine).
- **v0.6**: Updated frontend modules from 9 to 11 (added Shifts and Alerts modules). Shifts module covers shift schedule management, crew rosters, badge-based presence tracking, and emergency mustering (doc 30). Alerts module covers human-initiated alerts, emergency notifications, and muster command center (doc 31).
- **v0.5**: Updated backend services from 9 to 11 (Auth Service and Recognition Service split from API Gateway). Replaced "plugin architecture" extensibility goal with trait-based adapter pattern. Added "Shared Crate First" design principle.
- **v0.4**: Updated timeline section to match current phase plan (17 phases, 46-76 weeks).
- **v0.3**: Added Alert Service and Email Service to backend services (7 → 9). Added Emergency Alerting and Email Service to Key Features. Added external dependencies: Twilio API, SMTP servers, Microsoft Graph API, radio dispatch software. See docs 27 and 28.
- **v0.2**: Fixed PostgreSQL version constraint from "14+" to "16+" (consistent with all other design docs). Added Import Service to Backend Services listing and changed label from "Backend Services" to "7 Backend Services".
- **v0.1**: Updated timeline estimates to match current 05_DEVELOPMENT_PHASES.md (total from 23-36 weeks to 32-51 weeks). Phase 3-4 expanded to reflect Multi-Source Integration scope.

---

**Next Steps:** Review remaining design documents for detailed technical specifications and requirements for each component.
