# Refinery Operator Scheduling Software: Market Research & Integration Analysis

**Researched:** 2026-04-05  
**Purpose:** Evaluate whether integrating with refinery operator scheduling platforms is worth building into the Universal Import module.

---

## Executive Summary

Yes — refineries universally use dedicated scheduling software, and it is driven by hard regulatory compliance requirements (API RP 755 fatigue limits), complex union contract rules, and safety-critical operator qualification gating. The **eSOMS market** (Electronic Shift Operations Management Solutions) is valued at $5.77B (2024), growing to $11.4B by 2032 at 8.9% CAGR. Every serious refinery and petrochemical plant in North America runs one or more of these systems.

The data these systems hold is directly relevant to I/O's Shifts module: crew rosters, shift assignments, on-duty qualifications, fatigue/hours-of-service records, and muster group assignments. A well-built connector template could pull live shift data into I/O's presence tracking without manual entry.

**Integration viability varies sharply by vendor** — some have excellent public REST APIs, others are completely locked down.

---

## Part 1: The Market

### Why Every Refinery Uses This Software

**Regulatory pressure (non-negotiable):**

**API RP 755** — *Fatigue Risk Management Systems for Personnel in the Refining and Petrochemical Industries* — is the American Petroleum Institute's Recommended Practice governing operator shift scheduling. It was created directly after the 2005 BP Texas City explosion (15 killed), where operators had worked 12-hour shifts for up to 29 consecutive days. The 2nd edition (May 2019) elevated many requirements from "should" to "shall." OSHA cross-references this standard. Any U.S. refinery that isn't compliant is exposed.

**Core API RP 755 hours-of-service limits:**
- Maximum consecutive shifts per "work set" (e.g., 7 × 12-hour shifts before mandatory rest)
- Minimum 36 hours rest after completing a full work set
- Maximum 14 hours worked in any 24-hour period (including holdovers and OT)
- 54-hour average week rule measured over evaluation periods
- Outage/turnaround-specific rules

The work set concept is the hard part: a work set resets only after the **full minimum rest period**, not just a shift gap. Unplanned overtime (call-outs, holdovers) counts. This means the scheduling system must evaluate HoS counters in real-time before confirming any callout — a constraint a spreadsheet cannot enforce reliably.

**OSHA PSM 29 CFR 1910.119:** Requires documented operating procedures and qualified operators assigned to every covered unit. An unqualified operator in a PSM-covered control room is a violation. The scheduling system is the enforcement point.

**California CalOSHA §5189.1 (refineries):** Requires annual turnaround schedule submission, PSSR for all TA work, and Management of Organizational Change (MOOC) assessments before reducing staffing levels, changing shift duration, or reducing experience levels.

**Operational complexity:**
- 24/7 continuous operations with rotating 12-hour shifts (DuPont, Pitman, Panama patterns)
- Large contractor swells during turnarounds (hundreds to thousands of added workers)
- Union CBAs with extremely specific callout order rules and OT equalization requirements
- Operator qualification gating: board operators must hold active unit-specific certifications before assignment
- 40% of industrial accidents occur during shift handover periods (CCPS/AFPM statistic)

---

## Part 2: The Top 5 Systems

### Ranking Methodology

Ranked by: refinery-specific market penetration, regulatory compliance depth, breadth of the problem solved, and confirmed enterprise customer base.

---

### #1 — Shiftboard SchedulePro (now UKG)

**Category:** Purpose-built refinery/petrochemical operator scheduling  
**Vendor:** Shiftboard (acquired by UKG, May 2025)  
**Positioning:** The dominant purpose-built refinery scheduling tool. Shell Oil is the anchor customer — deployed across all 9 Shell U.S. refineries, 5,000 employees, 24 union agreements, $3M+/year savings vs. prior solution. Shell became the first major oil company with full API RP 755 compliance across all U.S. refineries using this product.

**What it does:**
- API RP 755 and PHMSA compliance engine — the rules are pre-configured, not custom ABAP. Enforces HoS limits at the moment of scheduling or callout.
- Callout management — orders candidates by union seniority and OT balance, skips anyone who would violate fatigue limits, sends push notifications automatically
- Turnaround scheduling — surge workforce management for outage events
- Union rules engine — configurable per-CBA; handles equitable OT, holiday rules, shift bidding
- Crew rostering, skills-based assignment

**Reported outcomes:** 88% higher shift coverage, 16% reduction in turnover, 23% OT cost reduction (Shell, BASF named customers)

**Key distinction from other tools:** The API RP 755 rules engine is the core product, not a bolt-on. Sites that need genuine compliance (not just reporting) gravitate here.

---

### #2 — Indeavor Schedule

**Category:** Purpose-built industrial operator scheduling  
**Vendor:** Indeavor (Madison, WI — independent, not acquired)  
**Positioning:** Direct Shiftboard competitor. Formally **certified compliant with API RP 755 2nd Edition** (announced April 2021, one of the few vendors to achieve this). Originally developed for the nuclear industry (NRC Hours of Service regulations), extended into oil/gas and petrochemicals. Now on the SAP Store (January 2025).

**What it does:**
- API RP 755 2nd Edition and NRC certified compliance — nuclear-grade rules applied to refinery scheduling
- Real-time emergency scheduling — handles unplanned events (emergency shutdowns, staffing shortages) with real-time schedule adjustment
- Competency/qualification gating — verifies operator certifications before confirming shift assignments
- Absence management
- SAP-certified integration (SAP Store, integrates with S/4HANA, SuccessFactors, SAP Timesheet)

**Key distinction:** The most directly comparable platform to SchedulePro; the split roughly follows SAP vs. non-SAP ERP environments. Refineries on SAP often choose Indeavor for the native SAP integration.

---

### #3 — UKG Pro Workforce Management (formerly Kronos Workforce Dimensions)

**Category:** General enterprise WFM with major refinery/industrial presence  
**Vendor:** UKG (Ultimate Kronos Group, ~$4B revenue, 2024)  
**Positioning:** The largest general-purpose WFM vendor globally. Heavily deployed in oil and gas for time-and-attendance, payroll integration, and shift scheduling across the broader industrial workforce. Post-Shiftboard acquisition (May 2025), UKG now offers both a general WFM layer (Pro WFM) and a refinery-specific scheduling layer (SchedulePro). Sites often run both: Pro WFM for the HCM/payroll backbone, SchedulePro for the fatigue-compliant operator scheduling rules.

**What it does:**
- Time and attendance tracking (punch in/out) — the system of record for actual worked time
- Automated shift creation from staffing needs, skills, availability
- Absence management, accruals, leave tracking
- Payroll integration (ADP, Ceridian, SAP, Oracle)
- AI-assisted scheduling (newer versions)

**Key distinction:** Even sites using SchedulePro or Indeavor for operator scheduling often use UKG/Kronos as the underlying time-and-attendance backbone. If you integrate with UKG, you potentially touch almost every major refinery workforce regardless of which scheduling overlay they use.

---

### #4 — SAP HCM / SAP SuccessFactors Workforce Scheduling

**Category:** ERP-integrated WFM  
**Vendor:** SAP SE  
**Positioning:** ~60–70% of major global refineries run SAP. Many manage shift scheduling through SAP HCM Time Management (the on-premise PP61/PP63 shift planning transactions) or SAP SuccessFactors. A brand-new module — **SAP SuccessFactors Workforce Scheduling** — specifically targets manufacturing and production industries, with early adopter access in January 2026 and GA expected H2 2026. This will make SAP a direct competitor to SchedulePro and Indeavor at SAP-shop refineries.

**What it does:**
- SAP HCM: Shift planning (PP63), Work Schedules, CATS (Cross-Application Time Sheet) time recording
- SuccessFactors Workforce Scheduling (new): Demand-driven shift planning, skills/certification-aware assignment, real-time coverage monitoring, mobile self-service
- Fieldglass: Contractor/contingent workforce management (separate system)

**Key distinction:** The only platform where the scheduling tool is part of the ERP itself. SAP does not natively enforce API RP 755 — most SAP-shop refineries bolt on Indeavor or SchedulePro specifically for the fatigue compliance layer, then export back to SAP for payroll. Once SuccessFactors Workforce Scheduling reaches GA, SAP may close this gap.

---

### #5 — Hexagon j5 Operations Management Suite

**Category:** Shift operations management (logbook/handover/rounds)  
**Vendor:** Hexagon AB (PPM division)  
**Positioning:** Dominant shift *operations* platform — distinct from the *scheduling* systems above. j5 doesn't answer "who works Tuesday night" (that's SchedulePro/Indeavor). It answers "what happened on the night shift" — electronic logbook, structured shift handover, operator rounds, standing orders, work instructions, action items, permits, MOC. Over 50 documented refinery and petrochemical deployments. Widely used across oil/gas, mining, LNG, and utilities.

**What it does:**
- j5 Operations Logbook — electronic shift log replacing paper
- j5 Shift Handover — structured handover with DCS-auto-populated alarm/process state
- j5 Operator Rounds & Routine Duties — scheduled field inspections with round completion tracking
- j5 Standing Orders — safety and operational instructions per shift
- j5 Action Management — follow-up items from handover
- j5 Control of Work / Permit to Work integration
- j5 Management of Change

**Key distinction:** Direct overlap with I/O's Log and Rounds modules. A refinery running j5 would not run I/O for logging/rounds — but they might run I/O for process visualization while j5 handles the shift operations layer. The integration opportunity is cross-referencing shift context between the two systems.

---

### Honorable Mentions

| Platform | Category | Notes |
|----------|----------|-------|
| Hitachi Energy eSOMS | Shift ops management | 430+ sites globally; stronger in utilities/power; no public API |
| Infor WFM | ERP-integrated WFM | Relevant at Infor EAM/CloudSuite sites (~10–15% refinery share); shares ION API Gateway auth |
| Oracle Primavera P6 | Turnaround scheduling | Dominant for maintenance/turnaround project scheduling; craft labor resources; not operator shift scheduling |
| eschbach Shiftconnector | Shift ops management | BASF/Bayer pedigree; European chemical focus; no public API |
| Kahuna Workforce Solutions | Competency management | Purpose-built for frontline operator certification tracking; adjacent to scheduling |
| inFRONT AllClear | Emergency mustering | Badge-based muster accountability; relevant to I/O's muster feature |
| Snap Schedule 365 | Operator scheduling | Mid-market alternative; API RP 755 capable; smaller deployments |

---

## Part 3: What Data These Systems Contain (Relevant to I/O)

### Personnel Master
- Employee/contractor ID, badge ID (mapping is a known integration headache — badge ID ≠ employee ID)
- Role: Board Operator, Field Operator, Shift Supervisor, Console Operator, Unit Operator
- Department/unit assignment (crude unit, FCC, hydrotreater, utilities)
- Employee vs. contractor flag; contractor company, induction date/expiry, access level

### Shift Schedule Data
- Shift patterns: 12h×2 Day/Night; DuPont (28-day, 4-crew rotating); Pitman (14-day); Panama
- Crew assignments (Crew A/B/C/D → shift slots)
- Planned schedule by date: who is on, what unit, which role
- Handover overlap windows (typically 30 min — incoming crew appears "on shift" during overlap)
- Minimum safe staffing levels per unit

### Fatigue / HoS Records
- Accumulated hours in current work set per person
- Last rest period start/end
- Unscheduled overtime events (holdovers, callouts)
- Deviation log (authorized exceptions to HoS limits)
- Near-miss alerts (approaching HoS limits before the next callout)

### Certifications and Qualifications
- Unit-specific operator qualifications (e.g., "qualified: Crude Unit 1, FCC")
- Safety certs: ATEX/hazardous area (Zone 1/2, 3-year validity), confined space, H2S, fire watch
- DCS platform certs (Honeywell Experion, Emerson DeltaV, ABB 800xA)
- DOT drug & alcohol testing compliance
- All expiry dates with automated alerts

### Contractor-Specific Data
- Site induction date/expiry (typically annual)
- Pre-entry qualification checklist status
- Access level (which units/areas authorized)
- PTW authorization level
- Contract end date (triggers automatic access revocation)

---

## Part 4: API Integration Assessment

### Summary Table

| Platform | Public API | Auth Mechanism | Real-Time / Push | Integration Difficulty | Priority |
|----------|-----------|----------------|-----------------|----------------------|----------|
| **UKG Pro WFM** | ✅ Full REST, documented | OAuth 2.0 ROPC + appkey header | Webhooks (unreliable; poll required) | Medium | **HIGH** |
| **Shiftboard SchedulePro** | ✅ REST, separate portal | Static JWT (integration token) | No webhooks — polling only | Low-Medium | **HIGH** |
| **Oracle P6 EPPM** | ✅ Full REST, public docs | OAuth Bearer (user credentials) | No push — polling only | Low | **MEDIUM** |
| **SAP SuccessFactors** | ✅ OData V2 (existing entities) | OAuth 2.0 SAML Bearer / X.509 | No push — Integration Center extracts | Medium-High | **MEDIUM** |
| **Hexagon j5** | ✅ REST, documented | Bearer token (OAuth2-style) | No documented push | Medium | **MEDIUM** |
| **Infor WFM** | ⚠️ REST via ION Gateway (instance-gated spec) | OAuth 2.0 via .ionapi file | BOD pub/sub via ION | Low (shares EAM infra) | **LOW-MEDIUM** |
| **Indeavor** | ⚠️ REST (customer-gated docs) | Proprietary session token | No documented push | High (no public docs) | LOW |
| **Hitachi Energy eSOMS** | ❌ No public API | N/A | N/A | Very High (DB or System Interfaces only) | SKIP |
| **eschbach Shiftconnector** | ❌ Explicitly confirmed absent | N/A | N/A | Not viable | SKIP |

---

### Platform-by-Platform Technical Detail

---

#### UKG Pro WFM (Kronos Workforce Dimensions)

**Developer Portal:** `https://developer.ukg.com` (public, browsable without login)  
**API Reference:** `developer.ukg.com/wfm/reference/`

**Authentication — 5 credentials required:**
```
POST https://{tenant}.mykronos.com/api/authentication/access_token
Header: appkey: {APP_KEY}   ← mandatory on EVERY request, not just auth
Body: username=...&password=...&client_id=...&client_secret=...&grant_type=password&auth_chain=OAuthLdapService
```
- `APP_KEY` obtained from a UKG employee with Developer Admin permissions
- OAuth grant type: Resource Owner Password Credentials (ROPC — not standard client_credentials)
- Refresh tokens expire in 7 days; must rotate

**Key scheduling endpoints:**
```
POST /api/v1/scheduling/schedule/multi_read
  → employees[] × date range → shifts[], payCodeEdits[], leaveEdits[], availabilities[]

GET  /api/v1/commons/persons/{personId}
POST /api/v1/commons/data/multi_read          ← bulk employee query via Hyperfind
POST /api/v1/commons/hyperfind/execute        ← get employee ID sets by group

GET  /api/v1/commons/persons/skills/{personId}
GET  /api/v1/commons/persons/certifications/{personId}

GET  /api/v1/timekeeping/timecard             ← actual punch-in/out events
POST /api/v1/timekeeping/timecard_metrics/multi_read  ← worked hours aggregates
```

**Service limits:**
- Max 500 employees per Information Access request (batch required for large rosters)
- Max 365 days per request
- Max 50 employees per Activity Shift net changes call
- Rate limiting: HTTP 429 on excess (1-min rolling window; limits not published)
- Hyperfind default threshold: 3,500 employees (configurable to 50,000)

**Webhooks:** Available at `webhooks.ukg.net` as a separate add-on. **Not reliable for mission-critical use** — UKG explicitly warns events are lost during database restores, mass updates, and trigger outages. 14-day event retention. Always maintain a polling fallback.

**Third-party connectors:** Official Boomi connector (best-supported); Microsoft Power Automate Premium connector (Timekeeping only, Preview); Merge.dev Beta.

**No official SDK.** Raw HTTP client required (Rust: standard `reqwest` + `serde_json`).

---

#### Shiftboard SchedulePro

**Developer Portal:** `https://developer.scheduleproweb.com` (requires verified account)

**Authentication:**
```
Authorization: Bearer {integration_token}
```
Static JWT issued from within SchedulePro (Settings → Integration Tokens → New). Shown only once at creation. Does not expire like OAuth tokens. Separate credential from UKG WFM even post-acquisition.

**Key endpoints:**
```
GET  /api/employees          → all employees
GET  /api/employees/{id}     → single employee
GET  GetSchedule             → shift snapshot, up to 28-day window
GET  GetScheduleChanges      → delta since modifiedAfter epoch (ms) ← primary sync mechanism
GET  GetTimesheets           → timesheet snapshot
GET  GetPayroll              → payable hours with pay rules applied
```

**Rate limits:**
- 1,000 calls/minute
- 2,000 calls/5 minutes  
- 10 concurrent connections/IP

**No webhooks.** Use `GetScheduleChanges` with stored `lastSyncEpochMs` watermark for incremental polling.

**Post-acquisition status:** Two separate products, two separate APIs. No published roadmap for API consolidation. Build two independent connector configs.

**Note on skills/qualifications:** Not documented in the public API surface. Employee fields are profile/contact/assignment data only. The API RP 755 compliance enforcement happens in the scheduling engine, not an extractable endpoint.

---

#### Oracle Primavera P6 EPPM (Turnaround Scheduling)

**Documentation:** `https://docs.oracle.com/cd/F51301_01/English/Integration_Documentation/rest_api/`  
*Actively maintained through v25 (Dec 2025) and v26 (2026)*

**Authentication:**
```bash
POST https://{server}/p6ws/oauth/token
Header: Authorization: Basic {base64(user:password)}
→ returns raw Bearer token

All calls: Authorization: Bearer {token}
```

**Key workforce/resource endpoints:**
```
GET /p6ws/restapi/resource              → resource master (people, roles, equipment)
GET /p6ws/restapi/resourceAssignment    → who is assigned to which activity (planned vs. actual hours)
GET /p6ws/restapi/activity             → work activities with labor, start/finish, percent complete
GET /p6ws/restapi/project              → project enumeration
GET /p6ws/restapi/wbs                  → Work Breakdown Structure
GET /p6ws/restapi/calendar             → work calendars
```

**ResourceAssignment fields relevant to I/O:**
- `ResourceName`, `ActivityName`, `ProjectName`, `WBSNamePath`
- `PlannedStartDate`, `PlannedFinishDate`, `PlannedUnits`
- `ActualStartDate`, `ActualFinishDate`, `ActualUnits`, `ActualRegularUnits`, `ActualOvertimeUnits`
- `RemainingUnits`, `PercentComplete`, `StaffedRemainingUnits`, `UnstaffedRemainingUnits`
- `ResourceType` (Labor/Nonlabor/Material)

**Pagination caveat:** No native `limit`/`offset` pagination. Use `Filter` by date range or WBS branch + cursor on `ObjectId` for large turnaround schedules (10K+ activities). Always use `Fields` parameter — never request all 200 fields on bulk reads.

**Query example:**
```
GET /restapi/resourceAssignment
  ?Fields=ResourceName,ActivityName,PlannedUnits,ActualUnits,PlannedStartDate,PlannedFinishDate
  &Filter=ProjectObjectId:eq:456:and:IsActive:eq:true
```

**SOAP:** Still active (not deprecated). Use REST for new work; SOAP as fallback for operations not exposed in REST.

**OIC Adapter:** Oracle Integration Cloud has a pre-built P6 EPPM adapter (since v23.10). Not useful for I/O directly (adds Oracle middleware dependency), but confirms the integration surface.

**Community:** GitHub `EnverMT/Primavera_REST_API` — Python library demonstrating the credential pattern.

---

#### SAP SuccessFactors (Workforce Scheduling)

**Status of new Workforce Scheduling module:** Early adopter January 2026; GA H2 2026 (November 2026 expected). No dedicated OData entity names for the new module's shift assignment planner published yet.

**Existing Employee Central OData V2 (relevant today):**
```
Base: https://api{N}.successfactors.{com|eu}/odata/v2/

GET /odata/v2/WorkSchedule              → work schedule definitions
GET /odata/v2/EmpJob?$expand=workScheduleNav  → employee-to-schedule assignments
GET /odata/v2/EmployeeTime             → time records (Time Tracking module)
```

**Authentication:**
```
POST /oauth/token
grant_type=urn:ietf:params:oauth:grant-type:saml2-bearer
→ Bearer token
```
- Register OAuth2 client in SuccessFactors Admin Center
- Generate X.509 certificate
- **Basic Auth deprecated/removed November 2026** — do not build against it

**SAP Fieldglass (contractor management) — separate system:**
- Own REST API with OAuth 2.0 client credentials (client ID + secret)
- Key resources: Workers/assignments, Work Orders, Timesheets, Expense sheets
- Documentation: `api.sap.com/package/FieldglassAPI`

**Practical path until Workforce Scheduling GA:** Use `EmpJob?$expand=workScheduleNav` for schedule assignments. Monitor SAP Help Portal for new Workforce Scheduling OData entity names post-GA.

---

#### Hexagon j5 Operations Management Suite

**Documentation:** `https://docs.hexagonali.com/r/en-US/j5-Framework-IndustraForm-API-Reference/Version-30/`

**Authentication:** Bearer token (OAuth2-style). Dedicated `Bearer token requirements` doc in installation guide. (Hexagon's EAM product uses the same auth pattern — Basic/Bearer/API key.)

**Data accessible via API:**
- Logbook entries — dedicated `logbook-query` REST endpoint (v1 and v2). Queryable by date range, unit, category. Designed for Power BI integration; the highest-confidence extraction path.
- Shift handover records — IndustraForm module, accessible via Application REST API
- Operator rounds data — data point REST methods (readings, user ID, timestamp, scan status)
- Action items — j5 Action Management records
- Standing orders, incidents — additional IndustraForm modules

**External connectors (licensed add-on, separate from the REST API):**
- SAP PM Connector — SOAP-based, SAP-certified (v30, Dec 2023)
- IBM Maximo Connector — Maximo web services
- OPC Connector — DA/UA historian real-time tag values into forms
- AVEVA PI Connector — OSIsoft/AVEVA historian (PI Event Frames)
- Aspen InfoPlus.21 Connector

**Note:** j5 is a competitor to I/O's Log and Rounds modules. The integration use case is cross-referencing shift context (j5 knows what happened during the shift; I/O visualizes the process state). A customer running both would need the systems to share shift IDs and timestamps.

---

#### Infor WFM

**Auth:** Identical `.ionapi` file / OAuth 2.0 pattern as the existing Infor EAM connector. Scope: `Infor-WFMPublic`.

**REST API spec:** Instance-gated — fetch `GET /wfmOpenApi` from live instance to get the OpenAPI spec. Not publicly published. Plan for auto-discovery in the connector.

**BOD messaging:** Uses OAGIS XML via ION Connect (same pattern as EAM). Confirmed inbound BODs: `Process.PersonEmployee`, `Sync.PersonEmployee`. Shift-specific BOD names (e.g., `Sync.ShiftAssignment`) not publicly confirmed — need Infor documentation access or live ION Desk inspection to verify.

**Reuse opportunity:** `.ionapi` file parse, OAuth token acquisition, pagination (`offset`/`limit`, max 1000/page), and BOD webhook endpoint from EAM connector are all reusable verbatim.

---

#### Indeavor Schedule

**API:** Exists — customer-gated at `support.indeavor.com`. Not a public developer portal.

**Authentication:** Proprietary session token. POST username+password → receive `SessionID` JSON → pass on all subsequent calls. Not OAuth, not API key.

**Data model:** XML + JSON over HTTP. Key export template: `EmployeeScheduleReport` (shift schedule data). `EmployeeUpdates` (employee master bidirectional sync). Also: Leave Balances, Reporting API (v1.1.7), Call Out API (v3.4.2).

**No webhooks.** Poll-based only. Indeavor Connect (on-premise middleware agent) handles scheduled sync via Windows Task Scheduler — suggests batch/nightly is the typical integration pattern.

**SAP certification:** On SAP Store (Jan 2025). Native integrations with SAP S/4HANA, SuccessFactors, SAP Timesheet, Workday, Oracle PeopleSoft, ADP, Ceridian, UKG.

**Practical conclusion:** Buildable, but high effort due to no public docs. Requires customer-supplied credentials AND documentation. Worth building if a specific customer requests it, not as a speculative connector.

---

#### Hitachi Energy eSOMS — SKIP

No published REST API. System Interfaces module uses preconfigured adapters (likely SOAP or proprietary). The only viable extraction paths are: (a) direct SQL Server database access, (b) PI historian as intermediary, or (c) professional services engagement with Hitachi. Not a self-service connector candidate.

---

#### eschbach Shiftconnector — SKIP

No API — confirmed explicitly on GetApp listing. Integration only through SAP-packaged plugins or professional services. Not a viable connector template.

---

## Part 5: Implications for I/O's Shifts Module Design

Based on this research, the current doc 30 (ACCESS_CONTROL_SHIFTS) has several gaps relative to real-world refinery requirements:

| Gap | Real-World Requirement | Current I/O State |
|-----|----------------------|-------------------|
| HoS tracking | API RP 755 requires system to track accumulated hours per work set and enforce limits at callout time | Not specified in doc 30 |
| Qualification gating | Before confirming shift assignment, verify certification currency | Not mentioned |
| Callout/OT management | Union-ordered callout lists, equitable OT distribution | Not specified |
| Contractor vs. employee | Contractors have induction dates, company affiliation, access-level restrictions, contract expiry | Not modeled |
| Turnaround mode | Staffing model during major maintenance events is structurally different | Not addressed |

These are not necessarily things I/O needs to implement (the spec is the authority), but they explain why standalone scheduling software exists and why data integration with those systems is valuable.

---

## Part 6: Recommended Connector Templates (Priority Order)

### Priority 1 — Build Now

**`ukg-pro-wfm`** (Connector template for UKG Pro Workforce Management)
- Rationale: Largest WFM vendor; Kronos/UKG deeply deployed in oil and gas; post-Shiftboard acquisition, covers the refinery-specific scheduling problem too. Published REST API with developer portal. Highest value for effort.
- Auth: OAuth 2.0 ROPC + appkey header; 7-day refresh rotation
- Primary import: `POST /api/v1/scheduling/schedule/multi_read` batched via Hyperfind employee groups (max 500/request)
- Employee sync: `POST /api/v1/commons/data/multi_read` with EMP view
- Punch data: `GET /api/v1/timekeeping/timecard` per symbolic period
- Polling strategy: Full sync weekly; delta via `net_changes/multi_read` for incremental

**`shiftboard-schedulepro`** (Connector template for Shiftboard SchedulePro)
- Rationale: Purpose-built refinery tool; Shell/BASF customers; separate API even post-UKG acquisition. Simple polling-first design.
- Auth: Static JWT (integration token from SchedulePro admin portal)
- Primary import: `GetScheduleChanges` with stored `lastSyncEpochMs` watermark for delta; `GetSchedule` for full resync (28-day window)
- Employee sync: `GET /api/employees`

### Priority 2 — Build for SAP and P6 shops

**`sap-successfactors-shifts`** (Extension of existing SAP connector, or new template)
- Today: `EmpJob?$expand=workScheduleNav` via existing EC OData V2 infrastructure
- Post-H2 2026: Add Workforce Scheduling entities when GA'd
- Auth: Same OAuth 2.0 SAML Bearer as existing SAP connector; avoid Basic Auth (deprecated Nov 2026)
- SAP Fieldglass: Separate connector template for contractor workforce data

**`oracle-p6-eppm`** (Turnaround resource connector)
- Rationale: Dominant turnaround scheduling tool; 10K+ activity refinery schedules generate significant workforce context during outages. Enriches I/O's shift context with current TA status.
- Auth: OAuth Bearer via `/p6ws/oauth/token`
- Primary import: `/resourceAssignment` (planned/actual hours per person per activity), `/activity` (work status)
- Pagination: Filter by date range + WBS branch; cursor on `ObjectId`

**`hexagon-j5`** (Shift operations logbook connector)
- Rationale: 50+ refinery deployments; documented REST API; logbook data is operationally meaningful context for I/O's process visualization
- Auth: Bearer token (OAuth2-style from j5 admin)
- Primary import: `logbook-query` REST endpoint (v1/v2) for shift log entries; date range filter
- Use case: Cross-reference j5 shift IDs and handover records with I/O's shift timeline

### Priority 3 — Build on Demand

**`infor-wfm`** (Infor Workforce Management)
- Low incremental cost given existing EAM connector infrastructure
- `.ionapi` auth, ION pagination, and BOD patterns are identical — only scope and endpoint mappings differ
- Scope: `Infor-WFMPublic`; auto-discover endpoint spec via `/wfmOpenApi` on first connect
- Build when a customer with Infor EAM also has Infor WFM

**`indeavor`**
- Build only when a specific customer requests it (no public docs, high implementation effort)
- Auth: POST login → SessionID session token
- Export template: `EmployeeScheduleReport` XML

### Do Not Build (at this time)

- **Hitachi Energy eSOMS** — no public API
- **eschbach Shiftconnector** — no API at all
- **Snap Schedule 365** — mid-market only; smaller opportunity

---

## Part 7: Sources

First-round research sources:
- API RP 755 — American Petroleum Institute: `api.org/oil-and-natural-gas/health-and-safety/refinery-and-plant-safety/process-safety/process-safety-standards/rp-755`
- Shiftboard Shell Oil case study: `shiftboard.com/customer-overview/shell-oil/`
- Shiftboard for Refining and Petrochemical: `shiftboard.com/resources/shiftboard-for-refining-petrochemical-solution-sheet/`
- Indeavor API RP 755 2nd Edition compliance: `indeavor.com/blog/indeavor-schedule-technology-compliant-for-api-rp-755-2nd-edition/`
- Hexagon j5 product pages: `hexagon.com/products/j5-operations-management-solutions`
- Hitachi Energy eSOMS: `hitachienergy.com/products/electronic-shift-operations-management-system-esoms`
- UKG acquires Shiftboard: `ukg.com/company/newsroom/ukg-acquires-shiftboard`
- eSOMS market report (Credence Research, 2024): USD 5.77B (2024) → USD 11.42B (2032)
- Cal/OSHA §5189.1: `dir.ca.gov/title8/5189_1.html`
- OSHA PSM 29 CFR 1910.119: `osha.gov/laws-regs/regulations/standardnumber/1910/1910.119`
- Kahuna Workforce Solutions: `kahunaworkforce.com/energy-competency-management/`

Second-round API research sources:
- UKG Developer Hub: `developer.ukg.com`
- UKG WFM Authentication: `developer.ukg.com/wfm/docs/authentication-and-security-doc`
- UKG WFM Limits: `developer.ukg.com/wfm/docs/limits-doc`
- UKG Webhooks: `developer.ukg.com/proplatform/docs/ukg-webhooks-user-guide`
- SchedulePro Developer Portal: `developer.scheduleproweb.com`
- SAP SuccessFactors OData V2 API Reference: `help.sap.com/docs/successfactors-platform/sap-successfactors-api-reference-guide-odata-v2/`
- SAP SuccessFactors Workforce Scheduling: `sap.com/products/hcm/workforce-scheduling.html`
- SAP Fieldglass API: `api.sap.com/package/FieldglassAPI`
- Indeavor integrations: `indeavor.com/integrations/`
- Indeavor on SAP Store: `businesswire.com/news/home/20250116711005/en/Indeavor-Now-Available-on-SAP-Store`
- Hexagon j5 API v30: `docs.hexagonali.com/r/en-US/j5-Framework-IndustraForm-API-Reference/Version-30/`
- Hexagon j5 logbook-query endpoint: `docs.hexagonali.com/r/en-US/j5-Framework-IndustraForm-API-Reference/Version-30/1217026`
- Infor WFM ION API Gateway docs: `docs.infor.com/wfm/2026/en-us/wfmopolh/api_config_on-premise/`
- Oracle P6 EPPM REST API v22: `docs.oracle.com/cd/F51301_01/English/Integration_Documentation/rest_api/`
- Oracle P6 EPPM REST API v25: `docs.oracle.com/cd/G18294_01/English/Integration_Documentation/rest_api/`
- GitHub Primavera REST API Python library: `github.com/EnverMT/Primavera_REST_API`
- Shiftconnector GetApp listing (no API confirmed): `getapp.com/operations-management-software/a/shiftconnector/`
- eSOMS mobile rounds user guide: `usermanual.wiki/Document/esomsmobileoperatorroundsuserguidejun16`
