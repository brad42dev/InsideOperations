# DCS Supplemental Connectors — Research & Analysis

**Date:** 2026-04-04
**Scope:** DCS supplemental connectors in `services/import-service/src/connectors/`. These are
distinct from ETL connectors — they augment OPC UA point metadata with side-channel data from
DCS-specific REST APIs. They do not go through the ETL pipeline.

---

## 1. What DCS Supplemental Connectors Do Today

### Conceptual role

The DCS supplemental connector path exists because OPC UA, while excellent for real-time values,
often carries minimal metadata: no engineering unit labels, no alarm limits, sparse descriptions.
DCS vendors expose richer metadata through their own REST APIs. The supplemental connectors pull
that data on a regular schedule and "fill in the gaps" in `points_metadata` — but only for fields
that OPC UA left NULL, using `COALESCE` semantics. OPC UA data always wins over supplemental data.

### The `DcsConnector` trait

Defined in `services/import-service/src/connectors/mod.rs`:

```rust
pub trait DcsConnector: Send + Sync {
    fn connector_type(&self) -> &'static str;
    async fn test_connection(&self, cfg: &ConnectorConfig) -> Result<()>;
    async fn fetch_metadata(&self, cfg: &ConnectorConfig) -> Result<Vec<SupplementalMetadata>>;
    async fn fetch_events(&self, cfg: &ConnectorConfig, since: DateTime<Utc>) -> Result<Vec<SupplementalEvent>>;
}
```

Two output types:

**`SupplementalMetadata`** — per-tag fields that augment `points_metadata`:
- `tagname` (match key)
- `description`
- `engineering_units`
- `eu_range_low`, `eu_range_high`
- `alarm_limit_hh`, `alarm_limit_h`, `alarm_limit_l`, `alarm_limit_ll`

**`SupplementalEvent`** — alarm/event records written to the `events` hypertable:
- `event_type`, `source_name`, `timestamp`, `severity`, `message`
- `alarm_type`, `alarm_state`, `external_id`, `limit_value`, `actual_value`

### The 5-minute poll cycle

`run_supplemental_connectors()` (spawned at service startup):
1. Fires a `tokio::time::interval(Duration::from_secs(300))` — fires every 5 minutes.
2. Queries `import_connections WHERE is_supplemental_connector = true AND enabled = true`.
3. For each row: dispatches to `get_connector(connection_type)`, calls `fetch_metadata()` and
   `fetch_events()` directly — no ETL pipeline, no `import_runs` record.
4. The `since` timestamp passed to `fetch_events()` is hardcoded to `Utc::now() - 10 minutes`
   regardless of poll interval. This is a known inconsistency — the lookback window is 2x the poll
   interval as a safety margin, but there is no watermark tracking across restarts. If the service
   restarts, events from the gap window will be re-fetched and deduplicated by `external_id`.

### Database writes

`db_writes.rs` — two functions:

**`write_supplemental_metadata(db, source_id, items)`:**
- Matches by `(tagname, source_id)` against `points_metadata`.
- Uses `COALESCE` for every field: only overwrites NULL columns.
- Sets `alarm_limit_source = 'supplemental'` only if the field was previously NULL.
- Emits `pg_notify('point_metadata_changed', '{}')` after any updates — the OPC Service listens
  to this channel to refresh its subscription registry.
- Does NOT insert new rows. Tags must already exist in `points_metadata` (added by OPC crawl or
  import). Unmatched tags are silently skipped (logged at DEBUG).

**`write_supplemental_events(db, source_id, events)`:**
- Deduplicates via `metadata->>'external_id'` before inserting.
- Inserts into the `events` hypertable with `source = 'supplemental'`.
- Maps `event_type` strings to `event_type_enum` values; defaults to `'process_alarm'`.
- Severity is clamped to `[0, 1000]` (ISA-18.2 scale), defaulting to 500 if absent.

### What is NOT tracked

The supplemental poll creates no `import_runs` rows, no per-run error records, no timing metrics.
It is entirely invisible to the run history UI. Errors surface only in service logs at WARN level.

---

## 2. Per-Connector Summary

### 2a. AVEVA/OSIsoft PI Web API (`pi_web_api`)

**API used:** PI Web API (OSIsoft/AVEVA PI Data Archive side-channel REST API)
**Auth:** Basic auth primary; Kerberos detected but falls back to unauthenticated (not implemented)

**`fetch_metadata`:**
- Queries `/piwebapi/dataservers` — iterates all PI Data Archive servers.
- For each server, paginates `/piwebapi/dataservers/{webid}/points` with `maxCount=5000`,
  following `Links.Next` for subsequent pages.
- Selected fields: `WebId`, `Name`, `Descriptor`, `EngineeringUnits`, `Zero`, `Span`.
- Fills: `description` (Descriptor), `engineering_units` (EngineeringUnits), `eu_range_low` (Zero),
  `eu_range_high` (`Zero + Span` — note: the connector stores `Span` directly in `eu_range_high`,
  NOT `Zero + Span`. This is semantically wrong — PI's Span is a delta, not an absolute ceiling).
- Alarm limits: **not fetched** (all four alarm_limit fields are None).

**`fetch_events`:**
- Queries `/piwebapi/assetdatabases` — iterates all AF asset databases.
- For each database, queries event frames: `{dbLinks}/eventframes?startTime=...&searchMode=Overlapped`.
- Maps event frames to `SupplementalEvent` with `event_type='process_alarm'`.
- Severity: **not set** (None). Alarm type/state: **not set**.
- External ID: **not set** — no deduplication for PI event frames across restarts.

**Missing from current implementation:**
- PI alarm limits (available via `/piwebapi/points/{webid}/attributes` or the `PointAttribute` collection)
- PI event frame severity and category fields
- External IDs for event frame deduplication
- Kerberos auth (common in enterprise PI deployments)
- The `eu_range_high = Zero + Span` bug

---

### 2b. Honeywell Experion PKS (`experion_rest` / EPDOC)

**API used:** Honeywell EPDOC (Experion Process Data and Operations Cloud) REST API — available
from Experion PKS R500 onward.
**Auth:** Basic auth (standard for EPDOC)

**`fetch_metadata`:**
- Fetches tag list via `GET /points` — returns a flat array of tag name strings.
- **No bulk config endpoint exists in EPDOC** — fetches per-tag config via `GET /points/{tag}/config`.
- Runs 20 concurrent requests per batch using `tokio::task::JoinSet` to avoid overwhelming the server.
- Fills: `description` (descriptor/description), `engineering_units` (eu/engineering_units),
  `alarm_limit_hh` (HIHI/hihi), `alarm_limit_h` (HI/hi), `alarm_limit_l` (LO/lo),
  `alarm_limit_ll` (LOLO/lolo). EU range bounds: **not set**.
- Alarm limits are the most complete of any connector — Experion EPDOC exposes HI/LO/HIHI/LOLO
  directly in the per-tag config response.

**`fetch_events`:**
- Queries `GET /alarms/history?startTime=...&endTime=...`.
- Maps `activationTime`/`timestamp` → event timestamp; `tag`/`tagname` → source_name.
- Fills: severity (priority field), alarm_state (state field).
- External ID: `"experion:{id}"` when present — deduplication works.
- Alarm type: **not filled** (field exists in EPDOC but not extracted).

**Missing from current implementation:**
- Pagination — EPDOC alarm history may be paged; the connector assumes a single response.
- EU range bounds (EPDOC may expose rangeMin/rangeMax on some point types).
- The 20-concurrent-request fan-out is efficient but unbounded in total — a site with 100K tags
  will make 5,000 serial batches of 20 requests. At 50ms per request this is ~4 minutes per poll
  cycle, exceeding the 5-minute interval.

---

### 2c. Siemens SIMATIC Process Historian REST (`siemens_sph_rest`)

**API used:** Siemens SIMATIC Process Historian (SPH) REST API (SPH 2019 Update 3+, port 18732)
**Auth:** Basic auth preferred; NTLM detected but not implemented (logs a warning and proceeds
unauthenticated). NTLM is common in Windows-domain SPH deployments — this is a significant gap.

**`fetch_metadata`:**
- Fetches `GET /api/v1/tags` — returns a flat array or `{"items":[...]}`.
- Fills: `description`, `engineering_units` (unit field).
- Alarm limits: **not set**. EU range bounds: **not set**.
- SPH does expose alarm limits via its REST API but they are not fetched here.

**`fetch_events`:**
- Queries `GET /api/v1/alarms?startTime=...&endTime=...`.
- Fills: severity, message, alarm_type (alarmType field), alarm_state (state field).
- External ID: `"sph:{id}"` — deduplication works.
- This is the only connector besides Experion that extracts `alarm_type`.

**Missing from current implementation:**
- NTLM auth (critical for Windows-domain deployments).
- Alarm limit fields from tag config.
- Pagination — SPH tag list response may be large.

---

### 2d. Siemens WinCC OA REST (`wincc_oa_rest`)

**API used:** WinCC OA built-in REST API (introduced in WinCC OA 3.18, default port 8443)
**Auth:** Basic auth (WinCC OA uses username/password for REST sessions)

**`fetch_metadata`:**
- Fetches `GET /rest/v1/datapoints` — returns a flat array of datapoint names.
- **No bulk config endpoint** — fetches per-datapoint config via `GET /rest/v1/datapoints/{name}/config`.
  Sequential (no concurrency), which is slow for large systems.
- Fills: `description`, `engineering_units` (unit/engineering_units), `eu_range_low` (rangeMin),
  `eu_range_high` (rangeMax). Alarm limits: **not set**.
- WinCC OA alarm configuration lives in the datapoint element config (`.._config` DPE), not the
  main config endpoint, so alarm limits would require additional per-element requests.

**`fetch_events`:**
- Queries `GET /rest/v1/alerts/history?startTime=...&endTime=...`.
- Fills: severity, message, alarm_state (state field).
- External ID: `"wincc:{id}"` — deduplication works.
- Alarm type: **not filled**.

**Missing from current implementation:**
- Alarm limits (accessible via DPE attribute queries but require deeper traversal).
- Concurrent fetching for the per-datapoint config loop.
- WinCC OA 3.18+ supports WebSocket subscriptions for live data — not exploited here.

---

### 2e. PTC Kepware KEPServerEX (`kepware_rest`)

**API used:** KEPServerEX Configuration REST API (port 57412, always HTTP, self-signed cert option)
**Auth:** Basic auth (KEPServerEX Configuration API uses Windows credentials)

**`fetch_metadata`:**
- Walks the project tree: `GET /config/v1/project/channels` → for each channel, `GET .../devices`
  → for each device, `GET .../tags`.
- Builds fully-qualified tagname as `{channel}.{device}.{tag}`.
- Fills: `description` (common.ALLTYPES_DESCRIPTION), `engineering_units` (servermain.TAG_EU_UNITS),
  `eu_range_low` (servermain.TAG_EU_LOW), `eu_range_high` (servermain.TAG_EU_HIGH).
- Alarm limits: **not set**. Kepware does not manage alarm limits — alarms are defined in the
  connected DCS/SCADA, not in Kepware itself.
- Tag groups within devices are **not traversed** — only the top-level tags array, not nested
  tag groups (common in large Kepware projects). This means tag groups are silently skipped.

**`fetch_events`:**
- Returns `Ok(vec![])` unconditionally with a comment: "Kepware doesn't provide alarm history via REST."
- This is accurate. The Kepware REST API is configuration-only; it has no alarm history endpoint.

**Missing from current implementation:**
- Tag group recursion (missing tags nested under groups).
- The Kepware IoT Gateway plugin adds data publishing capabilities but not a subscribable alarm
  history endpoint.

---

### 2f. Canary Labs Historian (`canary_rest`)

**API used:** Canary Labs Historian REST API (v22+, configurable port, commonly 55236)
**Auth:** API key (token-based) via `apply_auth` → `X-Api-Key` header

**`fetch_metadata`:**
- Fetches `GET /api/v1/tags` — returns an array or `{"items":[...]}`.
- Fills: `description`, `engineering_units` (engineeringUnits/units).
- EU range bounds: **not set**. Alarm limits: **not set**.
- Canary's REST API focuses on historical values, not alarm limit configuration.

**`fetch_events`:**
- Returns `Ok(vec![])` unconditionally with a comment: "Canary is values-only — no alarm history."
- This is accurate. Canary Labs Historian is a time-series data store and tag browser; it does not
  store alarm events (those remain in the source DCS/SCADA historian).

**Missing from current implementation:**
- Canary exposes historical values (GetData, GetRawData endpoints) which could be used to back-fill
  I/O's TimescaleDB with historical data for tags not covered by OPC UA — this use case is entirely
  absent from the current implementation.

---

### 2g. ABB 800xA Information Manager (`s800xa_rest`)

**API used:** ABB Information Manager (IM) REST API (`/abb-im-api/v1`, port unspecified)
**Auth:** Basic or bearer token via `apply_auth`

**`fetch_metadata`:**
- Paginates `GET /abb-im-api/v1/tags?$skip=N&$top=1000` using OData-style parameters.
- Follows `value`/`items` envelope. Stops when a page is smaller than 1000.
- Fills: `description`, `engineering_units` (unit/engineeringUnits).
- EU range bounds: **not set**. Alarm limits: **not set**.
- ABB IM does expose alarm configuration but through a different endpoint hierarchy.

**`fetch_events`:**
- Queries `GET /abb-im-api/v1/events?startTime=...&endTime=...&category=alarms`.
- Supports `value`/`items` envelope or flat array.
- Fills: severity, message (message/description), alarm_type, alarm_state.
- External ID: `"abb:{id}"` — deduplication works.
- Pagination: **not implemented** — the events query fetches a single page. Large alarm windows
  may return incomplete data.

**Missing from current implementation:**
- Alarm limit fields.
- Events pagination.

---

## 3. Cross-Cutting Gaps

### 3a. The `eu_range_high` bug in PI Web API

PI's `Span` attribute is a delta (the engineering range width), not the absolute upper bound.
The current code stores `Span` directly in `eu_range_high`. The correct value is `Zero + Span`.
The stored `eu_range_high` is therefore wrong for any PI tag where Zero is non-zero (e.g., a
pressure transmitter with Zero=0 and Span=100 is fine, but a temperature transmitter with
Zero=-40 and Span=240 would store 240 instead of 200).

### 3b. No watermark persistence across restarts

`since` is always `Utc::now() - 10 minutes`. On service restart the gap is at most 10 minutes of
events. For slow-polling connectors (e.g., PI metadata which is stable for days) this is fine.
For alarm events, a service restart during a high-activity alarm period could cause missed events.
External ID deduplication mitigates duplicate processing but does not recover missed events
that fall outside the 10-minute lookback.

### 3c. No per-connection poll tracking

There is no record of when a specific connection was last successfully polled. All connections
poll on the same 5-minute clock. If a connection's `fetch_metadata` takes longer than 5 minutes
(possible for large Experion or Kepware sites), the next poll starts before the previous one
finishes — both run concurrently against the same external API.

### 3d. No run history for supplemental connectors

Supplemental polls are completely invisible. There is no way for operators to see:
- When each connection was last polled
- How many tags were updated
- Whether the last poll failed

This is a significant observability gap.

### 3e. Kepware tag group recursion gap

The Kepware connector only fetches the top-level `tags` endpoint per device. KEPServerEX organizes
tags into nested tag groups. Any tag not in the device root (i.e., in a tag group) is silently
missed. This is likely to affect the majority of real Kepware configurations.

### 3f. Canary and Kepware have no events to offer

Both connectors return empty event vectors. This is architecturally correct — these systems do not
store alarm history. However, the poller still calls `fetch_events()` on them every 5 minutes for
no reason. A `has_events() -> bool` capability flag on the trait would allow the poller to skip
the event fetch for these connectors.

---

## 4. Should the Poll Interval Be Configurable?

**Current state:** Hardcoded `Duration::from_secs(300)` — 5 minutes for all connections.

**Analysis by connector type:**

| Connector | Metadata stability | Events urgency | Realistic interval |
|---|---|---|---|
| PI Web API | Days to weeks (tag config changes rarely) | Hours (event frames are retroactive, not live) | Metadata: 1h–24h / Events: 15–30m |
| Experion EPDOC | Days to weeks | Minutes to hours (alarm history) | Metadata: 1h / Events: 5–15m |
| Siemens SPH | Days | Minutes to hours | Metadata: 1h / Events: 5–15m |
| WinCC OA | Days | Minutes to hours | Metadata: 1h / Events: 5–15m |
| Kepware | Hours (project changes during engineering) | N/A | Metadata: 15m–1h |
| Canary | Weeks (tag list is very stable) | N/A | Metadata: 4h–24h |
| ABB 800xA IM | Days to weeks | Minutes to hours | Metadata: 1h / Events: 5–15m |

**Recommendation:** Yes, the poll interval should be configurable per connection, with separate
intervals for metadata and events. The simplest approach is to add `poll_interval_seconds` and
`event_poll_interval_seconds` to `import_connections.config` (the JSONB extra field) and read
them in the poller, with the current 300s as the fallback default. This requires no schema
migration — the values live in the existing `config` JSONB column.

A more structured approach would add these columns to `import_connections`:
- `supplemental_metadata_interval_seconds INTEGER DEFAULT 3600`
- `supplemental_event_interval_seconds INTEGER DEFAULT 300`
- `supplemental_last_metadata_poll_at TIMESTAMPTZ`
- `supplemental_last_event_poll_at TIMESTAMPTZ`

This would also solve the watermark tracking gap (§3b) and the observability gap (§3d).

---

## 5. Real-Time / Push Capabilities by Vendor

### 5a. OSIsoft/AVEVA PI Web API

PI Web API supports:
- **PI Streaming (WebSocket):** The PI Web API `streams` endpoint supports Server-Sent Events
  (SSE) via `GET /piwebapi/streams/{webId}/channel`. This is a long-lived HTTP stream that
  pushes value updates as they occur in the PI Data Archive. Not a subscription model — each
  tag needs its own stream channel.
- **PI AF Notifications:** PI AF (Asset Framework) has a separate notification system, but it
  delivers via email/SMS/SNMP, not REST callbacks.
- **Change detection via `GetRecorded`:** For event frames, polling `GetRecorded` with
  `startTime=*-5m` is the practical approach.

**Verdict:** PI Web API has SSE streaming for individual tag values, which could theoretically
replace the 5-minute metadata poll for value monitoring. However, for metadata (EU, alarm limits)
and event frames, polling is the only practical REST-based option. The SSE channel is useful for
the OPC Service tier (real-time values), not for the supplemental metadata connector (which only
cares about configuration data). Polling remains appropriate here.

**Realistic best trigger mode:** Configurable poll — 1h for metadata, 15–30m for event frames.

### 5b. Honeywell Experion (EPDOC)

Honeywell Experion PKS R500+ EPDOC REST API:
- **No subscription/notification API.** EPDOC is polling-only.
- Honeywell has a separate "Experion Station" API for real-time process values, but it is
  proprietary and not REST-based.
- The alarm history endpoint (`/alarms/history`) is designed for polling with time windows.
- Per-tag config (`/points/{tag}/config`) has no change-notification mechanism.

**Verdict:** Polling is the only option. The per-tag config fan-out at 20 concurrent requests
is the right approach, but the total volume must be bounded. Sites with >10K points will need
a longer metadata poll interval (1h+) to avoid hammering the EPDOC server.

**Realistic best trigger mode:** Configurable poll — 1h for metadata, 10–15m for alarm events.

### 5c. Siemens SIMATIC Process Historian

SPH REST API (2019 Update 3+):
- **No push/subscription API.** Polling only.
- SPH's primary data access model is its OLEDB/ODBC interface and the proprietary SIMATIC HMI
  API. The REST API is a simplified read-only interface.
- NTLM authentication is common and currently unsupported.

**Verdict:** Polling only. NTLM support is the more urgent gap than poll interval.

**Realistic best trigger mode:** Configurable poll — 1h for metadata, 10–15m for alarms.

### 5d. Siemens WinCC OA

WinCC OA 3.18+ REST API:
- **WebSocket support exists** for live datapoint value subscriptions (`/rest/v1/ws` or similar
  endpoint depending on version). This is for real-time value monitoring, not alarm history.
- Alarm history is polling-only via the REST endpoints.
- The REST WebSocket is primarily for SCADA operator displays, not historian integration.

**Verdict:** For I/O's use case (metadata augmentation), polling is appropriate. The WebSocket
is only relevant if I/O wanted to use WinCC OA as a real-time data source (instead of or
alongside OPC UA) — outside the supplemental connector scope.

**Realistic best trigger mode:** Configurable poll — 1h for metadata, 10–15m for alerts.

### 5e. Kepware KEPServerEX

Kepware REST APIs:
- **Configuration REST API (port 57412):** Read/write project configuration. Polling only. No
  notification mechanism.
- **IoT Gateway plugin:** Kepware has an IoT Gateway add-on that can publish tag values via
  MQTT or REST (as a client). This is a push-out model — Kepware pushes TO a broker, not a
  subscribable endpoint for I/O to connect to.
- **ThingWorx Kepware Server:** The enterprise version has streaming capabilities but requires
  ThingWorx, which is a separate platform.

**Verdict:** Polling via the Configuration API is the only REST-based option for metadata. No
alarm history is available via any REST endpoint.

**Realistic best trigger mode:** Configurable poll — 15–30m for metadata (project changes are
semi-frequent during commissioning), no events.

### 5f. Canary Labs

Canary Labs REST API:
- **No real-time streaming or subscriptions.** The REST API is for historical data queries and
  tag browsing.
- Canary's real-time path is OPC UA (Canary acts as an OPC UA server on top of its historian),
  or via its native Canary SDK. OPC UA is already handled by I/O's OPC Service.
- The REST API's primary value for I/O is historical data backfill, not real-time augmentation.

**Verdict:** Polling for metadata. For historical data backfill (a completely missing use case
currently), the Canary REST `GetData`/`GetRawData` endpoints could be used as an ETL source.
The current connector only uses it as a supplemental metadata source, which is its weakest
capability — Canary's EU labels are minimal compared to a native DCS.

**Realistic best trigger mode:** Configurable poll — 4h–24h for metadata, no events.
**Better use case:** ETL historical data pull into TimescaleDB via the generic ETL pipeline.

### 5g. ABB 800xA Information Manager

ABB IM REST API:
- **No push/subscription.** Polling only.
- The ABB 800xA system has its own real-time data bus (the 800xA "fieldbus" and the MMS-based
  communication layer), but none of this is accessible via the IM REST API.
- Events and alarm history are available via polling, which is what the connector does.

**Verdict:** Polling is appropriate. Events pagination is the most important missing feature.

**Realistic best trigger mode:** Configurable poll — 1h for metadata, 10–15m for events.

---

## 6. Should DCS Connectors Join the `import_schedules` Framework?

**Current model:** DCS connectors bypass `import_schedules` entirely. They are polled by a
dedicated background loop that runs all enabled supplemental connections on the same fixed schedule.

**Arguments for joining `import_schedules`:**
- Unified configuration surface — operators configure all scheduled data fetches in one place.
- Per-connection interval configuration is inherent in the schedule row.
- Run tracking (visibility of last poll, errors) would come for free via `import_runs`.
- The SKIP LOCKED mechanism would be correct for multi-instance deployments.

**Arguments against joining `import_schedules`:**
- DCS connectors write to `points_metadata` and `events`, not `custom_import_data`. The ETL
  pipeline's load step always targets `custom_import_data`. Routing to other tables requires
  fixing the `target_table` field (currently ignored) — a separate known gap.
- The current scheduler has unresolved schema mismatches (missing columns) and is non-functional.
  Coupling DCS connectors to a broken system would break them.
- The supplemental write semantics (COALESCE, only update NULLs) are fundamentally different
  from the ETL pipeline's INSERT-based approach. These would need a custom load step.
- DCS connectors benefit from having metadata and events on different schedules — the
  `import_schedules` model would need enhancement to support two intervals per definition.

**Recommendation:** Keep DCS connectors in their own poller for now, but upgrade the poller to:
1. Read per-connection interval from `import_connections.config` (or new columns) instead of
   the global hardcoded 300s.
2. Track `last_polled_at`, `last_metadata_count`, `last_event_count` in new columns on
   `import_connections`.
3. Emit a structured log line per poll with outcome metrics (for Prometheus scraping).
4. Consider joining `import_schedules` only after the scheduler bug is fixed and `target_table`
   routing is implemented. At that point, define a `'supplemental'` schedule type with a
   `'supplemental_metadata_upsert'` load mode.

---

## 7. Missing Patterns: Historical Data Backfill vs. Metadata Augmentation

The current DCS connectors are exclusively metadata augmenters. A second use case exists that is
entirely absent: using the DCS REST API to pull **historical process data** into I/O's TimescaleDB
for time ranges not covered by the live OPC UA subscription.

This matters for:
- Onboarding a new I/O installation against an existing plant — years of historical data lives
  in the DCS historian but I/O's OPC UA subscription only starts when I/O goes live.
- Canary Labs Historian — its primary value is historical values via `GetData`/`GetRawData`,
  not its sparse tag metadata.
- PI Web API — `GetRecorded` and `GetInterpolated` endpoints return time-series data that
  could populate TimescaleDB.

This would be an ETL path (using `EtlConnector`, writing to a `process_data` target table),
not a supplemental connector path. The existing `canary_rest` supplemental connector would
have a parallel ETL sibling. This use case should be tracked as a separate feature.

---

## 8. New DCS Connector Candidates

### 8a. Emerson DeltaV

**REST API availability:** DeltaV does not have a first-party REST API for process data or
metadata. Its integration paths are:
- **OPC UA:** DeltaV v14.3+ includes an OPC UA server — this is already handled by I/O's OPC
  Service and is the correct integration path.
- **DeltaV Event Chronicle (SQL Server):** The alarm and event database lives in SQL Server on
  the DeltaV Application Station. It is accessible via SQL (`mssql` ETL connector). There is
  already a `deltav-event-chronicle` connector template seeded in the DB using the MSSQL ETL
  connector — this is the right approach.
- **DeltaV Continuous Historian (ODBC):** Tag configuration and historical values are
  accessible via ODBC from the Application Station. The `odbc` ETL connector handles this.

**Verdict:** No DCS REST connector needed. OPC UA covers real-time values. SQL Server covers
alarm history. ODBC covers tag config. All three paths already exist in I/O's ETL layer.
The existing `deltav-event-chronicle` template is the right artifact.

### 8b. Yokogawa CENTUM VP

**REST API availability:**
- Yokogawa introduced a REST API in CENTUM VP R6.09 (2021) via the Plant Resource Manager (PRM).
- Endpoints expose: plant hierarchy, instrument data, maintenance records.
- Tag metadata and engineering units are available.
- Alarm history is available via the historian API (CENTUM VP has an integrated historian).
- Auth: Basic auth or API key depending on deployment.

**Verdict:** A `yokogawa_centum_rest` DCS connector is a viable addition. Yokogawa is common
in refinery and petrochemical plants. The REST API is mature enough (R6.09 is widely deployed).
Would implement `fetch_metadata` via PRM tag browse and `fetch_events` via historian alarm query.

**Priority:** Medium. Yokogawa is the fourth most common DCS in refinery applications
(after Honeywell Experion, Emerson DeltaV, and ABB 800xA).

### 8c. Rockwell Automation FactoryTalk

**REST API availability:**
- **FactoryTalk Optix (formerly Archestra/Wonderware MES):** Has a REST API for plant model
  and tag queries.
- **FactoryTalk Historian (formerly PI-based):** FactoryTalk Historian Site Edition is an
  OPC DA/UA server — no native REST API for historians.
- **FactoryTalk AssetCentre:** Has a REST API for asset management and audit log, not process data.
- **FactoryTalk Remote Access:** Cloud-based, not relevant for on-premise integration.

**Verdict:** Rockwell's DCS story for REST APIs is fragmented. FactoryTalk Historian uses OPC
UA (already covered). The tag metadata use case is covered by OPC UA crawl. No clear REST
connector target exists for refinery applications. FactoryTalk Optix is more common in
manufacturing than oil & gas.

**Priority:** Low for refinery/petrochemical scope.

### 8d. AVEVA/Schneider EcoStruxure

**REST API availability:**
- **EcoStruxure Foxboro DCS (formerly Foxboro I/A):** Foxboro has a REST API as of I/A v9.4
  via the FoxConnect platform. Exposes compound/block hierarchy, parameter values, and alarm
  events. Used in refinery and specialty chemical applications.
- **EcoStruxure Plant SCADA (formerly ClearSCADA/Geo SCADA):** Has a REST API for server
  status and basic tag queries, but alarm history requires the SOAP/Web Services API.
- **AVEVA System Platform (formerly Wonderware):** Has a REST API via IntelaTrac or OMI.

**Verdict:** A `foxboro_rest` DCS connector for EcoStruxure Foxboro DCS is the most relevant
refinery-focused addition. Foxboro is common in older refineries and chemical plants. The
FoxConnect REST API covers both metadata and alarm events.

**Priority:** Medium. Foxboro is less common than Honeywell, Emerson, or ABB but still
significant in legacy refinery applications.

### 8e. AspenTech

**REST API availability:**
- **Aspen InfoPlus.21 (IP.21):** The primary AspenTech process historian. REST API via
  AspenTech REST API for IP.21, introduced around 2019. Exposes: tag list, tag attributes
  (EU, description, alarm limits), historical data queries.
- **Aspen APC (Advanced Process Control):** No REST API for I/O integration.
- **Aspen Mtell:** Predictive maintenance, has a REST API but for maintenance use cases.

**Verdict:** A `aspen_ip21_rest` DCS connector for AspenTech IP.21 is viable and valuable.
IP.21 is common in refinery advanced process control and hydrocarbon processing environments.
The REST API exposes tag attributes (including HIHI/HI/LO/LOLO alarm limits) and historical
data — making it one of the richer metadata sources available.

**Priority:** High. AspenTech IP.21 is very common in refineries that also run Aspen APC.
The alarm limit data from IP.21 is particularly valuable for I/O's alarm management view.

---

## 9. Summary Recommendations Table

| Connector | Current poll | Recommended metadata interval | Recommended event interval | Push/subscription viable? | Key gap to fix |
|---|---|---|---|---|---|
| PI Web API | 5 min (same clock) | 1h | 20m | No (SSE for values, not metadata) | eu_range_high bug; alarm limits; event dedup |
| Experion EPDOC | 5 min (same clock) | 1h | 10m | No | Pagination; rate limiting for large tag sets |
| Siemens SPH | 5 min (same clock) | 1h | 10m | No | NTLM auth; alarm limits |
| WinCC OA | 5 min (same clock) | 1h | 10m | No (WebSocket is for values, not metadata) | Sequential per-dp fetch (add concurrency) |
| Kepware | 5 min (same clock) | 30m | N/A (no events) | No | Tag group recursion |
| Canary | 5 min (same clock) | 6h | N/A (no events) | No | Historical backfill use case entirely missing |
| ABB 800xA | 5 min (same clock) | 1h | 10m | No | Events pagination |
| Yokogawa CENTUM | Not implemented | 1h | 15m | No | Build new connector |
| AspenTech IP.21 | Not implemented | 1h | 15m | No | Build new connector (high priority) |
| Foxboro EcoStruxure | Not implemented | 1h | 15m | No | Build new connector (medium priority) |

### Top 5 actionable gaps (in priority order)

1. **Make poll interval configurable per connection** — read from `import_connections.config`
   JSONB, fall back to 300s. Separate metadata and event intervals.

2. **Fix the PI Web API `eu_range_high` bug** — store `Zero + Span`, not `Span` alone.

3. **Add NTLM auth support** for Siemens SPH (and potentially WinCC OA) — critical for any
   Windows-domain Siemens deployment.

4. **Fix Kepware tag group recursion** — the current connector misses the majority of tags in
   typical Kepware projects that use tag groups.

5. **Add AspenTech IP.21 REST connector** — high-value target for refinery sites; exposes alarm
   limits natively.

### Structural recommendation

Add `supplemental_last_polled_at TIMESTAMPTZ` and `supplemental_last_error TEXT` columns to
`import_connections` so that the Settings UI can show health status per supplemental connection.
This is the minimum observability improvement needed before supplemental connectors can be
considered production-ready.
