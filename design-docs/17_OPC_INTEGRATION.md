# Inside/Operations - OPC UA Integration

## Overview

OPC Service connects to OPC UA servers to acquire real-time process data.

## OPC UA Client Configuration

### Source Configuration

OPC Service reads its connection configuration from the `point_sources` table (one row per OPC UA server). Each source record contains the endpoint URL, security settings, credentials, and polling parameters. On startup, OPC Service queries all `point_sources` rows where `source_type = 'opc_ua'` and establishes connections accordingly. Adding or updating a source row is sufficient to reconfigure the service on its next connection cycle.

### Connection Parameters (per source)
- Endpoint URL (opc.tcp://hostname:4840)
- Security Policy (None, Basic256Sha256, Aes256Sha256RsaPss)
- Security Mode (None, Sign, SignAndEncrypt)
- Client Certificate: dropdown selecting from client certificates in the centralized certificate store (Settings > Certificates). A "Manage Certificates" link navigates to the certificate management UI. No per-connection certificate file upload — all certificate management is centralized.
- Username/password (if required)

> **Certificate management for OPC UA connections is handled through the centralized certificate store. See [15_SETTINGS_MODULE.md](15_SETTINGS_MODULE.md) § Certificate Management.** OPC UA server certificates received during connection handshake are automatically stored in the Trusted CAs section of the central store.

### Connection Establishment
1. Load client certificate and private key from centralized certificate store (by certificate ID referenced in `point_sources` config)
2. Set `point_sources.status` to `'connecting'`
3. Create OPC session with endpoint
4. Authenticate (anonymous, username/password, or certificate)
5. Activate session
6. Update `point_sources.status` to `'active'` and set `last_connected_at`
7. Begin operations (browse, read, subscribe)

### Source Status Tracking

OPC Service maintains the health of each source in the `point_sources` table. Status mapping: On successful OPC UA connection, set status to `'active'`. On disconnect, set to `'inactive'`. During connection attempt, set to `'connecting'`. On error, set to `'error'`.

- **On connection attempt:** Set `status = 'connecting'`
- **On successful connect:** Set `status = 'active'`, update `last_connected_at`
- **On connection loss:** Set `status = 'inactive'`, update `last_error_at`, begin reconnect loop
- **On repeated failure:** Set `status = 'error'`, update `last_error_at` with error details
- **On reconnection:** Set `status = 'active'`, trigger backfill (see Backfill on Reconnection)

## Metadata Crawling

### Browse Server Namespace
- Start at root node (Objects folder)
- Recursively browse child nodes
- Identify variable nodes (data points)
- Extract: NodeId, BrowseName, DisplayName, DataType, Engineering Units
- Handle continuation points (servers limit results per browse)

### Point Discovery

Point discovery uses the `upsert_point_from_source(p_source_id, p_tagname, p_metadata_json)` database function, which is idempotent and handles three cases:

1. **New point (tagname + source_id not found):** Creates a new `points_metadata` row with a generated UUID and inserts version 0 into `points_metadata_versions` with the source metadata snapshot
2. **Existing point, metadata changed:** Creates a new version in `points_metadata_versions` with the updated metadata and syncs denormalized columns on `points_metadata` via trigger
3. **Existing point, metadata unchanged:** Updates `last_seen_at` on `points_metadata` only

Discovery steps:
- Filter for nodes with data values
- Skip folders and object nodes
- Extract tagname from BrowseName or DisplayName
- Call `upsert_point_from_source()` for each discovered point (batched)
- Returned point_id is used for the in-memory node_map

## Subscription Management

### Create Subscriptions
- Batch points into groups of 500 (avoid overwhelming server)
- Create subscription with publishing interval (1000ms typical)
- Add monitored items for each point in batch
- Set data change filter: **PercentDeadband 1%** for confirmed `AnalogItemType` nodes with `EURange`; **AbsoluteDeadband 0** (any-change) for all others. Reduces OPC subscription traffic by ~30–60% on typical analog-heavy DCS without missing real process changes. Servers that lack EURange for a given node return `BadDeadbandFilterInvalid` — fall back to AbsoluteDeadband 0 for that point.

### Handle Data Changes
1. OPC server sends DataChangeNotification
2. Extract point NodeId and new value
3. Look up point_id from node_map
4. Write to points_current (UPSERT)
5. Batch INSERT to points_history_raw with `ON CONFLICT (point_id, timestamp) DO NOTHING` (deduplication)
6. Batch NOTIFY to broker (accumulate point_ids over a short window, send single notification per batch for throughput)

### Subscription Prioritization
- Use points_in_use table to identify displayed points
- Create subscriptions for high-priority points first
- Poll low-priority points periodically (5-minute interval)

## Error Handling

### Connection Failures
- Retry connection with exponential backoff (5s, 10s, 20s, max 60s)
- Log all connection attempts
- Alert on repeated failures (> 10 attempts)

### Subscription Failures
- Recreate subscription if status code indicates failure
- Log failed monitored items
- Continue with successful items

### Backfill on Reconnection

After reconnecting to a source, OPC Service calls `backfill_upsert_history(p_point_ids, p_values, p_qualities, p_timestamps)` to batch-insert any buffered or replayed data accumulated during the outage. This function uses `INSERT ... ON CONFLICT (point_id, timestamp) DO NOTHING` for automatic deduplication, making it safe to replay overlapping ranges without creating duplicate rows.

### Data Quality

OPC UA status codes are categorized into three quality levels (per OPC UA Part 8):

**Good** - Value is reliable:
- `Good`: Normal operation, value reflects current process state
- `Good_LocalOverride`: Value is overridden locally at the device

**Uncertain** - Value may not be accurate:
- `Uncertain_SubNormal`: Value is derived from fewer sources than required
- `Uncertain_SensorNotAccurate`: Sensor is operating outside of calibration
- `Uncertain_EngineeringUnitsExceeded`: Value is outside normal operating range
- `Uncertain_LastUsableValue`: Communication lost, showing last known value

**Bad** - Value is not usable:
- `Bad_ConfigurationError`: Server configuration error
- `Bad_NotConnected`: Connection to device lost
- `Bad_NoCommunication`: No communication with data source
- `Bad_OutOfService`: Device is out of service
- `Bad_DeviceFailure`: Device has failed
- `Bad_SensorFailure`: Sensor has failed
- `Bad_WaitingForInitialData`: Startup, no data yet

**Storage:** All quality levels are written to `points_current` and `points_history_raw`. The raw table preserves full fidelity for forensic analysis regardless of quality.

**Aggregation:** Only values with `Good` quality are included in continuous aggregates (1m, 5m, 15m, 1h, 1d). This prevents bad or uncertain readings from skewing calculated averages, sums, and other statistics. The `count` field in aggregates reflects the number of good readings, which can be compared against expected count to detect data quality issues.

**UI:** Frontend displays quality indicators on current values (e.g., color coding, icons). Bad/Uncertain values should be visually distinct from Good values.

## Connection Flow — Live Discovery (Not Static Presets)

Commercial OPC UA clients (Ignition, UaExpert, Unified Automation) universally use a live discovery flow — security policy selection is always driven by the server's `GetEndpoints` response, never hardcoded. I/O follows this same pattern.

### Wizard Steps

1. **User enters discovery URL** — `opc.tcp://hostname:port` (port defaults to 4840, always editable)
2. **Optionally select vendor profile** — pre-fills rate-limit parameters only (not security policy)
3. **GetEndpoints discovery** — OPC Service calls GetEndpoints over an unauthenticated channel
4. **UI presents security options** — filtered list from server response; strongest policy pre-selected (Basic256Sha256 + SignAndEncrypt)
5. **User confirms security selection** — explicit choice required; `None` mode shows a warning badge
6. **Certificate trust dialog** — on first connection to new server, show server cert fingerprint/thumbprint with [Trust permanently] / [Trust once] / [Reject] options
7. **If server rejects client cert** — inline actionable error: *"The OPC server rejected the I/O client certificate. Export it and add it to the server's trusted certificates store."* + [Download Client Certificate] button

### Port Visibility

**Port is always a user-visible, editable field.** Default is 4840. Do not hardcode. Common non-standard ports:

| Platform | Default Port | Notes |
|----------|-------------|-------|
| Standard OPC UA | 4840 | IANA registered |
| Siemens WinCC V7 / Runtime Pro | **4861** | Different from S7-1500 |
| Rockwell FactoryTalk Linx Gateway | **4990** | Each endpoint +1 (4990, 4991...) |
| Emerson DeltaV (some versions) | **48040** | Alternate, appears alongside 4840 |
| Ignition SCADA | **62541** | Discovery path: `/discovery` |
| Kepware | **49320** | Configurable |
| Prosys Simulation | **53530** | Path: `/OPCUA/SimulationServer` |

### Security Policy Selection Algorithm

When presenting the endpoint list, sort and pre-select in this priority order:

1. `SignAndEncrypt` + `Basic256Sha256` ← pre-selected default
2. `SignAndEncrypt` + `Aes128_Sha256_RsaOaep`
3. `SignAndEncrypt` + `Aes256_Sha256_RsaPss`
4. `SignAndEncrypt` + `Basic256` (deprecated — show ⚠ badge)
5. `SignAndEncrypt` + `Basic128Rsa15` (deprecated — show ⚠ badge)
6. `Sign` + any policy (downgrade from encrypt — show ⚠ badge)
7. `None` (no security — show 🔴 warning)

**Never silently downgrade security.** If the user's saved preference is unavailable on reconnect, surface it as an error requiring admin attention.

**Deprecated policy support is required.** Basic128Rsa15 and Basic256 are deprecated in OPC UA 1.04 but remain the majority of the deployed OT base (legacy Siemens, ABB, GE). Log a warning in System Health when deprecated policies are in use, but do not refuse the connection.

### Certificate Application URI Stability

The OPC Service application instance certificate must have a stable `ApplicationUri` embedded in the SubjectAltName URI field. This URI must match the `ApplicationDescription.ApplicationUri` sent during every `CreateSession` call.

- Generate once at service startup if not present
- Never regenerate on restart — certificate identity must be persistent
- URI format: `urn:io-ops:opc-service:<site-id>` (site-id from `settings` table key `site.id`)
- Include all hostnames and IPs the service may be reached from in the SAN

**Siemens S7-1500 gotcha:** `BadCertificateUriInvalid` means the SAN URI in the client cert does not match the ApplicationUri in the Hello packet. This happens when the TIA Portal project was not password-protected before certificate generation. The fix is on the Siemens side — project must be password-protected before regenerating the cert. Surface this as a specific error hint: *"BadCertificateUriInvalid — if connecting to Siemens S7-1500, ensure the TIA Portal project is password-protected before regenerating the OPC UA certificate."*

### Namespace URI Stability

**Never store numeric namespace indices.** Namespace indices can change between server restarts, firmware upgrades, or configuration changes. Store namespace URIs.

On every connection (including reconnects):
1. Read `ns=0;i=2255` (`NamespaceArray` node)
2. Build a URI → index map
3. Translate all configured namespace URIs to current indices before use
4. Store the URI→index map in `connection_config.namespace_map` JSONB for diagnostics

### Session Reconnection

On transport-layer disconnect:
1. Open a new SecureChannel to the same endpoint
2. Call `ActivateSession` with the existing `authenticationToken` — this reassociates the session without losing subscriptions (within session timeout window, typically 60s)
3. If session expired, create a new session and re-create subscriptions
4. The server queues missed data change notifications (up to `monitoredItemQueueSize`, default 50 items per point) — retrieve queued items on session resume

---

## Connection Profiles and Rate Protection

### Problem

OPC UA servers have no built-in rate throttling (confirmed by IEEE ICIT 2018 research). When overloaded by aggressive clients, servers can enter degraded state, return high latencies, or become unavailable. DCS controllers are particularly constrained — Emerson DeltaV PK Controllers have only 6 sessions total and cap at 1,250 items/sec. I/O must protect the target system from being overwhelmed.

### Connection Profiles

I/O ships with pre-configured connection profiles for known platforms. During OPC connection setup, an optional dropdown ("What platform is this?") pre-populates rate-limit and session parameters only — security policy selection is always driven by live GetEndpoints discovery, not the profile. If the admin skips the dropdown, the system queries the server's `ApplicationDescription` on first connect and attempts to match a known profile.

**Vendor profile definitions and known gotchas:**

| Profile | Sessions | Items/Sub | Items/Call | Publish Interval | Default Port | Key Gotcha |
|---------|----------|-----------|------------|-----------------|-------------|------------|
| **Conservative (default)** | 1 | 1,000 | 500 | 1,000ms | 4840 | Safe everywhere |
| Siemens S7-1500 (TIA Portal) | 2 | 1,000 | 500 | 1,000ms | 4840 | `BadCertificateUriInvalid` if SAN URI mismatches; TIA project must be password-protected before cert gen |
| Siemens S7-1200 (TIA Portal) | 1 | 500 | 200 | 1,000ms | 4840 | Very constrained: 10 sessions, 1,000 items total |
| Siemens WinCC OA | 1 | 1,000 | 500 | 1,000ms | configurable | App URI format `urn:<DNS>:WinCC_OA:<Project>:<MgrNum>` must be in SAN exactly |
| Siemens WinCC V7 / RT Pro | 1 | 1,000 | 500 | 1,000ms | **4861** | Different default port from all other Siemens platforms |
| Rockwell FactoryTalk Linx Gateway | 1 | 1,000 | 500 | 1,000ms | **4990** | Security only in v6.10+; URI mismatch with non-Rockwell clients; cert regen bug |
| Rockwell Native (5480/5580) | 2 | 1,000 | 500 | 1,000ms | 4840 | Cert management via Studio 5000 / Logix Designer |
| Honeywell Experion PKS | 1 | 1,000 | 500 | 1,000ms | 4840 | OPC UA only on Application Station (not C300); R500+ required; anonymous enabled by default |
| ABB 800xA | 1 | 1,000 | 500 | 1,000ms | 4840 | OPC UA only on History Server tier; per-connection license; no GUI cert manager |
| DeltaV PK Controller | 1 | 1,000 | 500 | 1,000ms | 4840 | Hard cap: 6 sessions, 1,250 items/sec; PK only exposes controller-local data |
| DeltaV Application Station | 2 | 2,000 | 500 | 1,000ms | 4840 or **48040** | VE2200 license required; alternate port 48040 in some versions; redundant pair = two endpoints |
| Schneider EcoStruxure | 1 | 1,000 | 500 | 1,000ms | 4840 | No TransferSubscription support |
| Yokogawa Exaopc | 1 | 1,000 | 500 | 1,000ms | 4840 | Throughput cap: 2,000–4,000 items/sec |
| Ignition SCADA | 2 | 2,000 | 1,000 | 500ms | **62541** | Most flexible; 100 sessions default; discovery path `/discovery` |
| Kepware | 2 | 2,000 | 1,000 | 1,000ms | **49320** | Configurable port |
| **Custom** | User-defined | User-defined | User-defined | User-defined | User-defined | Full manual control |

> **AVEVA/OSIsoft PI:** PI Data Archive has **no native OPC UA server**. PI is OPC UA client-only (PI Connector for OPC UA, PI Adapter for OPC UA). A native PI OPC UA server is "In Development" per AVEVA's tracker as of 2025. To integrate PI data into I/O, use PI Web API (REST) or PI AF SDK via the Import module supplemental connector — not OPC UA direct. See § Supplemental Connectors.

All values in a profile are individually overridable by the admin, subject to the global minimum publish interval floor (`opc.minimum_publish_interval_ms`, default 1000ms, minimum allowed 100ms — see doc 15). No source can be configured with a publish interval faster than this global setting.

### OperationLimits Auto-Discovery

On first connect (and periodically thereafter), I/O queries the server's `OperationLimitsType` node (OPC UA Part 5 Section 6.3.11) to discover actual server limits:

- `MaxNodesPerRead` — batch size for Read calls
- `MaxNodesPerBrowse` — batch size for Browse calls
- `MaxMonitoredItemsPerCall` — batch size for CreateMonitoredItems
- `MaxNodesPerRegisterNodes` — batch size for RegisterNodes

If the server reports limits that conflict with the configured profile values, the system:
1. Uses the **more conservative** value (min of profile setting and server-reported limit)
2. Displays a warning in the connection status: "Server reports different limits than configured — review settings"
3. Logs the discrepancy for admin review

If the server does not expose OperationLimits (many don't), the profile defaults are used without warning.

### Adaptive Throttling

Runtime protection against server overload:

- **Response latency monitoring**: Track per-connection average response latency. If latency exceeds 2x baseline, automatically reduce request batch sizes by 50% and increase inter-batch delay.
- **StatusCode-based backoff**: On receiving `BadTooManyOperations`, `BadTooManySubscriptions`, or `BadTooManyMonitoredItems`, immediately reduce batch size, log the event, and surface it in System Health (doc 36).
- **Staggered initialization**: When connecting to a server with thousands of points, create subscriptions and add monitored items incrementally (e.g., 500 items every 2 seconds) rather than all at once.
- **Server-revised intervals**: When the server revises a requested sampling or publishing interval (returns a different value than requested), accept the revised value. Do not repeatedly request faster intervals.

### Reconnection Strategy

- **Exponential backoff**: 2s → 4s → 8s → 16s → 30s max. Jitter added to prevent thundering herd when multiple sources reconnect simultaneously.
- **Session recovery first**: Attempt to reactivate the existing session before creating a new one. Preserves subscriptions if the server still holds them.
- **TransferSubscription**: Attempt if supported by the server (Schneider EcoStruxure does NOT support this). If TransferSubscription fails, fall back to full subscription re-creation.
- **Monitored item queue size**: Default 50 — buffers ~50 seconds of data at 1s sampling during reconnection.
- **Keep-alive interval**: 10 seconds (~1/3 of typical 30s session timeout). Allows 2-3 missed keep-alives before timeout.

### Health Surfacing

Per-connection OPC health is surfaced in two places:
- **Settings > Point Sources**: Connection status, last communication, subscription count, data rate, any active warnings (out-of-sync limits, throttling active)
- **System Health dashboard** (doc 36): Per-source latency graph, status indicators, throttle events

---

---

## OPC UA Optional Services — Opportunistic Harvesting

OPC UA defines a rich set of optional services beyond basic data subscriptions. I/O harvests all available optional data from any connected OPC UA server and falls back to supplemental connectors (REST, proprietary APIs) for data the server does not expose. See § Supplemental Connectors for the fallback architecture.

### Part 8: Data Access — Engineering Metadata

OPC UA Part 8 defines `AnalogItemType`, a subtype of `DataItemType` that servers optionally expose for process variable nodes. When a node is typed as `AnalogItemType`, additional metadata properties are available on child nodes.

**On initial browse, attempt to read these properties for each discovered point:**

| OPC UA Property | BrowseName | Writes To | Notes |
|----------------|-----------|----------|-------|
| `EURange` | `EURange` | `points_metadata.min_value`, `points_metadata.max_value` | Instrument operating range (engineering scale). Two-field struct: `{low, high}`. |
| `InstrumentRange` | `InstrumentRange` | `points_metadata_versions.source_raw["instrument_range"]` | Sensor physical input range — wider than EURange |
| `EngineeringUnits` | `EngineeringUnits` | `points_metadata.engineering_units` | UNECE/OPC UA EU structure: `{namespaceUri, unitId, displayName, description}`. Extract `displayName.text` |
| `Definition` | `Definition` | `points_metadata.description` | Human-readable tag description string |
| `ValuePrecision` | `ValuePrecision` | `points_metadata_versions.source_raw["value_precision"]` | Number of significant decimal places |

**Alarm limit properties on `AnalogItemType`** (Part 9 overlap):

| OPC UA Property | BrowseName | Writes To |
|----------------|-----------|----------|
| High-High limit | `HighHighLimit` | `points_metadata.alarm_limit_hh` |
| High limit | `HighLimit` | `points_metadata.alarm_limit_h` |
| Low limit | `LowLimit` | `points_metadata.alarm_limit_l` |
| Low-Low limit | `LowLowLimit` | `points_metadata.alarm_limit_ll` |

> **Schema addition required (doc 04):** Add `alarm_limit_hh`, `alarm_limit_h`, `alarm_limit_l`, `alarm_limit_ll DOUBLE PRECISION` columns to `points_metadata` and `points_metadata_versions`. These are sourced from OPC UA Part 8/9 when available; otherwise from supplemental connectors; otherwise from the I/O threshold wizard (user-defined). Priority: OPC UA > supplemental connector > I/O wizard.

**Discrete types:**
- `TwoStateDiscreteType`: properties `TrueState`, `FalseState` — display names for boolean points
- `MultiStateDiscreteType`: property `EnumStrings` — array of display names for integer enum points
- Store in `points_metadata_versions.source_raw["enum_strings"]`

**EngineeringUnits encoding note (DeltaV caveat):** `EUInformation.displayName.text` is always authoritative. The `unitId` Int32 encodes the UNECE Common Code (see OPCFoundation/UA-Nodeset `UNECE_to_OPCUA.csv`). Emerson DeltaV maps EU units through a COM wrapper — `unitId` may not correctly encode UNECE codes; always use `displayName` for display and storage. Other vendors (Honeywell, ABB, Siemens) encode `unitId` correctly.

**Implementation:** On initial browse, read the `TypeDefinition` reference for each Variable node (returned as part of Browse `result_mask`). Use the TypeDefinition NodeId to determine which property set to request. Batch read child properties via `TranslateBrowsePathsToNodeIds` then `Read`. Treat `BadNoMatch` or `BadAttributeIdInvalid` responses as absent — do not treat as errors. Store complete raw EU struct in `source_raw` JSONB for later UNECE reverse-lookup.

---

### Part 9: Alarms and Conditions (A&C) — Event Subscription

OPC UA Part 9 defines a publish/subscribe model for alarms and events. Not all servers implement it — detect capability by checking the `EventNotifier` attribute on the `Server` node.

#### Capability Detection

```
Read ns=0;i=2253 (Server node), attribute EventNotifier (attribute id 12)
  - Bit 0 set (value & 1) → server supports event subscriptions
  - Bit 2 set (value & 4) → server supports historical event access
```

If `EventNotifier` bit 0 is not set, skip A&C subscription for this server. Log "OPC A&C not available — alarm events will come from supplemental connector if configured."

#### Event Subscription Setup

If A&C is available:

1. Create a subscription (same subscription as data values, or separate — separate is preferred for event isolation)
2. Create a monitored item for the Server node (`ns=0;i=2253`) with `monitoringMode = Reporting`
3. Set `EventFilter` with a `SelectClause` covering the fields below

**EventFilter SelectClause fields to request:**

| Field | TypeDefinition | BrowsePath | Maps To |
|-------|---------------|------------|---------|
| EventId | BaseEventType | `EventId` | `events.metadata["opc_event_id"]` |
| EventType | BaseEventType | `EventType` | Determines alarm class |
| SourceNode | BaseEventType | `SourceNode` | `events.metadata["opc_source_node"]` — resolves to point_id |
| SourceName | BaseEventType | `SourceName` | `events.metadata["opc_source_name"]` |
| Time | BaseEventType | `Time` | `events.timestamp` |
| ReceiveTime | BaseEventType | `ReceiveTime` | `events.source_timestamp` |
| Severity | BaseEventType | `Severity` | `events.severity` |
| Message | BaseEventType | `Message` | `events.message` |
| Retain | ConditionType | `Retain` | Alarm still active (true = event is active) |
| AckedState | AcknowledgeableConditionType | `AckedState/Id` | Alarm acked state boolean |
| ConfirmedState | AcknowledgeableConditionType | `ConfirmedState/Id` | Alarm confirmed boolean |
| ActiveState | AlarmConditionType | `ActiveState/Id` | Alarm in active state |
| ActiveState.EffectiveDisplayName | AlarmConditionType | `ActiveState/EffectiveDisplayName` | Human-readable alarm state |
| LimitState | LimitAlarmType | `LimitState/Id` | Limit that is violated (HighHigh/High/Low/LowLow) |
| HighHighLimit | ExclusiveLimitAlarmType | `HighHighLimit` | Alarm HH limit at time of alarm |
| HighLimit | ExclusiveLimitAlarmType | `HighLimit` | Alarm H limit at time of alarm |
| LowLimit | ExclusiveLimitAlarmType | `LowLimit` | Alarm L limit at time of alarm |
| LowLowLimit | ExclusiveLimitAlarmType | `LowLowLimit` | Alarm LL limit at time of alarm |
| ConditionId | ConditionType | `NodeId` | `events.metadata["opc_condition_id"]` |
| BranchId | ConditionType | `BranchId` | `events.metadata["opc_branch_id"]` — non-null for branched conditions |

**EventType → I/O event_type mapping:**

| OPC UA EventType | I/O event_type | Notes |
|-----------------|---------------|-------|
| AlarmConditionType / LimitAlarmType / ExclusiveLimitAlarmType | `process_alarm` | Standard limit alarm |
| NonExclusiveLimitAlarmType | `process_alarm` | Multiple limits active simultaneously |
| DiscreteAlarmType / OffNormalAlarmType | `process_alarm` | alarm_type = "DISCRETE" |
| TripAlarmType | `process_alarm` | alarm_type = "TRIP" |
| AuditEventType / AuditUpdateStateEventType | `operator_action` | DCS operator actions |
| AuditWriteUpdateEventType | `config_change` | Configuration change events |
| SystemEventType / DeviceFailureEventType | `system_event` | System/device fault events |
| TransitionEventType | `system_event` | State machine transitions |

#### ConditionRefresh

On session creation or reconnect, call `ConditionRefresh` to force the server to re-publish all currently active alarm conditions (`Retain=True`). Without this, I/O would miss alarms that tripped before the session was established.

```
// ConditionRefresh — Part 9 §5.5.7
// MethodId: ns=0;i=3875 (ConditionRefresh)
// ObjectId: ns=0;i=2782 (ConditionType — the call target per spec)
// InputArguments: [subscriptionId: UInt32]
```

Call immediately after creating the event MonitoredItem. **ConditionRefresh2** (MethodId `ns=0;i=12011`) refreshes a single MonitoredItem rather than the entire subscription.

#### Deadband Configuration

PercentDeadband uses the `EURange` property to compute the deadband threshold. Recommended defaults:
- Nodes confirmed as `AnalogItemType` with `EURange` present: use **PercentDeadband 1%** (reduces noise without missing real changes)
- All other nodes: use **AbsoluteDeadband 0** (any-change reporting)

Servers return `BadDeadbandFilterInvalid` if PercentDeadband is requested but the node has no `EURange`.

#### TypeDefinition Detection

Use the `TypeDefinition` BrowseName from Browse results to determine which metadata properties to read for each discovered node:

| TypeDefinition NodeId | Type | Properties to Harvest |
|---|---|---|
| ns=0;i=2365 | DataItemType | Definition, ValuePrecision |
| ns=0;i=2368 | AnalogItemType | + EURange, EngineeringUnits, InstrumentRange, HighHighLimit, HighLimit, LowLimit, LowLowLimit |
| ns=0;i=2373 | TwoStateDiscreteType | + TrueState, FalseState |
| ns=0;i=2376 | MultiStateDiscreteType | + EnumStrings |
| ns=0;i=11238 | MultiStateValueDiscreteType | + EnumValues |
| Any subtype | (inherit from nearest ancestor) | Use `IsAbstract` to walk hierarchy |

#### A&C Vendor Reality (Confirmed by Spec Research)

| Vendor | A&C Support | Part 11 Event History | Notes |
|--------|-----------|---------------------|-------|
| Emerson DeltaV v14+ | Yes (COM wrapper) | Unreliable | ExclusiveLevelAlarmType; ConditionRefresh works; EU unitId unreliable — use displayName only |
| Honeywell Experion R51x+ | Yes (native) | No | ExclusiveLevelAlarmType; ConditionRefresh works |
| ABB 800xA 6.0+ | Yes | Yes (with History license) | EventNotifier on History Server tier |
| Siemens WinCC OA | Yes (full) | Yes | Full A&C; ConditionRefresh; event history both supported |
| Siemens PCS 7 v9+ | Yes (via WinCC) | Yes (via WinCC historian) | WinCC V7.5+ required |
| Siemens S7-1500 TIA V16+ | Yes (native) | No (use WinCC) | OffNormalAlarmType/DiscreteAlarmType; max 10 conditions/notification; ConditionRefresh requires TIA V17+ |
| **Ignition SCADA** | **No** | No | **Ignition does NOT expose alarms via OPC UA A&C** — use supplemental Ignition REST connector |
| Rockwell FTLG | No | No | Tag data only |
| Kepware | Partial | No | Pass-through of source server events |

When A&C is not available from the OPC server, alarm events must come from a supplemental connector. See § Supplemental Connectors.

---

### Part 11: Historical Access — Event History

OPC UA Part 11 `HistoryRead` supports reading historical event data when the server's `EventNotifier` attribute has bit 2 set.

**Use case:** On session creation / reconnect, backfill missed alarm events by calling `HistoryRead` with `HistoryReadEventDetails`:

```
HistoryReadEventDetails {
    numValuesPerNode: 1000,
    startTime: last_processed_event_timestamp,
    endTime: NOW(),
    filter: <same EventFilter as subscription>
}
```

**Vendor support:** Most DCS historians (WinCC OA, DeltaV, Experion) support `HistoryRead` for process data but have limited or no support for `HistoryRead` for events. Check `EventNotifier` bit 2 before attempting. Fall back to supplemental connector event backfill when not available.

---

## Supplemental Connectors — Hybrid Data Architecture

**Principle:** Get as much as possible from OPC UA. When OPC UA doesn't provide it, supplement from vendor-native REST or proprietary APIs via the Import module.

### Data Sourcing Priority

For each data type, I/O applies this source priority:

| Data Type | Priority 1 | Priority 2 | Priority 3 |
|-----------|-----------|-----------|-----------|
| Real-time values | OPC UA subscription | Modbus/MQTT | Manual entry |
| Engineering units | OPC UA Part 8 AnalogItemType | Supplemental connector | Admin manual entry |
| Tag description | OPC UA Part 8 `Definition` | Supplemental connector | Admin manual entry |
| EU range (min/max) | OPC UA Part 8 `EURange` | Supplemental connector | Admin manual entry |
| Alarm limits (HH/H/L/LL) | OPC UA Part 8/9 limits | Supplemental connector | I/O threshold wizard |
| Alarm events | OPC UA Part 9 A&C subscription | Supplemental connector events API | Not available |
| Historical alarm events | OPC UA Part 11 HistoryRead | Supplemental connector history API | Not available |
| Operator actions | OPC UA Part 9 AuditEventType | Supplemental connector events API | Not available |
| SIS/safety events | OPC UA Part 9 SafetyEvent | Supplemental connector safety API | Not available |
| Point hierarchy/grouping | OPC UA address space structure | Supplemental connector asset model | Admin manual |

### Supplemental Connector Architecture

Supplemental connectors live in the **Import module** (doc 24) as `import_connections` rows with `is_supplemental_connector = true` and `point_source_id` set to the OPC UA source they supplement. This places them alongside all other Import connectors (ERP, CMMS, historians), reusing the Import module's scheduling, retry, field mapping, credential encryption, and error handling infrastructure.

```
point_sources (OPC UA)
    id = <source-uuid>
    source_type = 'opc_ua'
    connection_config = { endpoint_url, security_policy, ... }

import_connections (Supplemental — owned by Import module)
    point_source_id = <source-uuid>     -- links to the OPC source being supplemented
    is_supplemental_connector = true    -- distinguishes from general-purpose import connectors
    connector_type = 'experion_rest'    -- DCS-specific type (see types table below)
    connection_config = {
        base_url: "http://experion-server:58080/epdoc/api/v1",
        ...
    }
    auth_type = 'basic'
    -- Credentials encrypted at application layer (AES-256-GCM), same as all import connections
```

Multiple supplemental connections can reference the same `point_source_id` — for example, a DeltaV source may have one connection for alarm events and a separate connection for engineering-unit metadata from a different endpoint. The OPC Service only needs to declare which data it harvested; the Import Service handles filling the remainder via its standard connector pipeline.

**UI distinction:** In the Import module connection list, supplemental connectors appear under a dedicated **"DCS Supplemental"** category (domain = `'dcs_supplemental'` in `connector_templates`) and display which OPC source they are linked to. They cannot be accessed from the general Import wizard — they are configured through the OPC source detail page in Settings > Data Sources.

### Supplemental Connector Types

The Import module (doc 24) owns the implementation of supplemental connectors. The OPC Service declares which data types it successfully harvested from OPC UA, and the Import module's supplemental connectors fill the remainder.

There are two implementation approaches, both running natively in the Rust Import Service:

**REST connectors:** Custom `ImportConnector` implementations using `reqwest` for vendors with documented HTTP/JSON APIs.

**SQL/ODBC connectors:** The existing `mssql` (tiberius) and `odbc` (odbc-api, `spawn_blocking`) connector types from the general Import module. DeltaV's Event Chronicle, ABB's EventArchiveView, and Yokogawa's historian all run on SQL Server — connectable directly from Linux on port 1433 using `mssql`. No Windows sidecar required.

| Connector Type | Vendor | Implementation | Data Provided | Notes |
|---------------|--------|---------------|--------------|-------|
| `pi_web_api` | AVEVA/OSIsoft PI | Custom REST | Point metadata, EU, limits, history, alarm event frames | REST — PI Web API 2019+; IIS on-prem |
| `experion_rest` | Honeywell Experion PKS R500+ | Custom REST | Full metadata, alarm limits, alarm history, trend history | EPDOC API at `:58080/epdoc/api/v1`; Basic/NTLM |
| `siemens_sph_rest` | Siemens SIMATIC Process Historian 2019+ | Custom REST | Tag metadata, value history, aggregates, alarm history | SPH REST at `:18732/api/v1`; Windows/NTLM |
| `wincc_oa_rest` | Siemens WinCC OA 3.18+ | Custom REST | Tag metadata, value history, alarm history | WinCC OA REST at `:4999/rest/v1`; Basic/API key |
| `s800xa_rest` | ABB 800xA + Information Manager 3.5+ | Custom REST | Tag metadata, history, alarm/event records | ABB IM REST at `/abb-im-api/v1/`; API key or Windows |
| `kepware_rest` | PTC Kepware KEPServerEX 6.x | Custom REST | Tag EU, description, high/low EU (config view only) | Config API `:57412`; IoT GW `:39320`; Basic |
| `canary_rest` | Canary Labs Historian 22+ | Custom REST | Tag metadata, current values, history | REST at `:55236/api/v1`; Bearer token |
| `mssql` | DeltaV, ABB 800xA (brownfield), Yokogawa | Existing `mssql` connector | Alarm history, tag metadata from SQL Server backend | Standard connector type; pre-built templates in `dcs_supplemental` domain |
| `odbc` | Any remaining ODBC-capable DCS/historian | Existing `odbc` connector | Vendor-specific; admin configures SQL queries | `odbc-api` crate, `spawn_blocking`; unixODBC on Linux |

> **Note on DeltaV:** DeltaV has **no native REST API** in any release. DeltaV Edge exposes OPC UA and MQTT only. However, the Event Chronicle and module configuration databases run on SQL Server on the Application Station — connect using the `mssql` connector type (pre-built `dcs_supplemental` template) via port 1433 directly from Linux.

> **Note on Ignition:** Ignition SCADA does not need a supplemental connector — use I/O's OPC Service connecting to Ignition's built-in OPC UA server, which re-exposes all tags via UA.

### PI Web API Connector (`pi_web_api`)

Since PI has no native OPC UA server, `pi_web_api` is the **primary** integration path for PI Data Archive, not a fallback.

**Endpoints used by I/O:**

| PI Web API Endpoint | I/O Usage | Target Table |
|--------------------|----------|-------------|
| `GET /piwebapi/points?path=\\server\tag` | Discover point: descriptor, engineeringUnits, zero, span | `points_metadata` |
| `GET /piwebapi/elements/{webid}/attributes` | AF element attributes (alarm limits if in AF) | `points_metadata` alarm limit columns |
| `GET /piwebapi/streams/{webid}/value` | Current value snapshot | `points_current` |
| `GET /piwebapi/streams/{webid}/recorded?startTime=...&endTime=...` | Raw historical values | `points_history_raw` |
| `GET /piwebapi/assetdatabases/{id}/eventframes?templateName=Alarm&startTime=...` | Alarm event frames (activation, RTN, ack) | `events` |
| `POST /piwebapi/batch` | Bulk multi-point queries (up to 1000 sub-requests) | All of the above |

**Authentication:** Kerberos (Windows domain; no password over wire — preferred), Basic (HTTPS only), or OAuth2/Bearer (PI Web API 2019+ with AD FS). All stored encrypted in `import_connections.connection_config`.

**AF hierarchy:** PI AF element trees map to I/O's `area` field. Map the AF element path to `points_metadata.area` during point discovery.

**Alarm event frames:** Each Event Frame represents one alarm lifecycle. Fields: `StartTime` (activation), `EndTime` (RTN, null if still active), alarm limit attributes, `AckTime`, `AckUser`, severity, priority. Query `GET /assetdatabases/{id}/eventframes?searchMode=Overlapped` to catch alarms that started before the query window.

### Honeywell Experion EPDOC Connector (`experion_rest`)

Base URL: `http://<experion-server>:58080/epdoc/api/v1/`

| Endpoint | I/O Usage |
|---|---|
| `GET /points/{tagname}/config` | EU, alarm limits (HIHI/HI/LO/LOLO), descriptor, range |
| `GET /alarms` | Active alarm list |
| `GET /alarms/history?startTime=...&endTime=...` | Historical alarm records with ack data |
| `GET /history/{tagname}?startTime=...&endTime=...` | Trend history |

Auth: Basic or NTLM. Available on Experion R500+; R430 and earlier require OPC AE (no REST).

### Siemens Process Historian Connector (`siemens_sph_rest`)

Base URL: `http://<sph-server>:18732/api/v1/`

| Endpoint | I/O Usage |
|---|---|
| `GET /tags` | Tag list with EU, description, data type |
| `GET /tags/{name}/values?startTime=...&endTime=...` | Historical values with quality |
| `GET /tags/{name}/aggregated?aggregation=average&interval=60` | Aggregated history |
| `GET /alarms?startTime=...&endTime=...` | Alarm/event history (requires WinCC Alarm Logging feed) |

Auth: Windows/NTLM. Available SPH 2019 Update 3+. Max ~10 concurrent queries recommended by Siemens.

### DeltaV SQL Connector (connector_type: `mssql`)

DeltaV has no REST API, but its data stores are SQL Server databases accessible from Linux via the existing `mssql` connector type (tiberius crate, no ODBC drivers required):

- **Event Chronicle** (alarm history): SQL Server on the Application Station. Key columns: `EventTime`, `NodeName`, `ParameterName`, `EventCategory`, `State` (Active/Inactive/Acknowledged), `Priority`, `Limit`, `Message`. Query via standard T-SQL over port 1433.
- **Module configuration DB** (tag metadata): SQL Server tables on the ProPlus Station contain module parameters including descriptor text, `HIHI_SP`, `HI_SP`, `LO_SP`, `LOLO_SP`, `EngineeringUnits`. Exact table names vary by DeltaV version — admin configures the queries in the Import definition.

A pre-built `dcs_supplemental` connector template (`deltav-event-chronicle`) ships with I/O, pre-configured with the standard Event Chronicle table structure and field mappings to `events` and `points_metadata`.

### Event Connector Protocol

Supplemental connectors that provide events must deliver them in the I/O supplemental event format:

```jsonc
{
  "event_type": "process_alarm",        // I/O event_type_enum value
  "source": "opc",                      // Always "opc" for DCS-sourced events
  "timestamp": "2024-01-15T10:30:00Z",  // Event occurrence time (ISO 8601)
  "source_timestamp": "2024-01-15T10:30:00.123Z",  // DCS source time if different
  "severity": 700,                      // OPC UA severity scale 1-1000
  "priority": "high",                   // alarm_priority_enum
  "point_tagname": "FIC-101/PV",        // Used to resolve point_id
  "message": "FIC-101 High Flow",
  "alarm_type": "H",                    // HH|H|L|LL|DEV_H|DEV_L|ROC|BAD_PV|OOR|TRIP
  "limit_value": 150.0,
  "actual_value": 162.3,
  "deadband": 5.0,
  "alarm_state": "active",              // active|acknowledged|cleared
  "external_id": "DV-ALARM-00123"      // Vendor's internal alarm ID for dedup
}
```

The Event Service ingests this format from supplemental connectors and processes it through the ISA-18.2 state machine identically to OPC UA A&C events.

### OPC UA A&C vs Supplemental Event Deduplication

When both OPC UA A&C and a supplemental connector are active for the same source:
- Compare `opc_event_id` (from A&C) against `external_id` (from supplemental) to detect duplicates
- OPC UA A&C events take precedence — supplemental is skipped if OPC A&C already delivered the event
- Deduplication window: 5 minutes (events with same tagname + alarm_type + timestamp within 5 min are considered duplicate)

---

## Performance Considerations

### Batch Operations
- Browse in batches (respecting server's `MaxNodesPerBrowse` or default 1,000 nodes per call)
- Subscribe in batches (respecting server's `MaxMonitoredItemsPerCall` or default 500 items per subscription)
- Write to database in batches (max 1,000 rows per INSERT)

### Memory Management
- node_map stored in memory (NodeId → PointId lookup)
- Estimated size: 10,000 points × 100 bytes ≈ 1 MB

### Threading
- Use Tokio async tasks for concurrent operations
- Separate tasks for browsing, subscribing, and writing
- Use channels for inter-task communication

## Success Criteria

- Connects to OPC UA server successfully
- Metadata crawling discovers all points
- Subscriptions receive data changes
- Data written to database correctly with quality status preserved
- Quality codes accurately mapped (Good/Uncertain/Bad)
- Only Good quality values included in aggregates
- Handles connection failures gracefully

## Change Log

- **v0.9**: Revised Supplemental Connector Architecture — removed `connection_config.supplemental` JSONB (was wrong location). Supplemental connectors are now `import_connections` rows with `is_supplemental_connector = true` and `point_source_id` FK, owned by the Import module (doc 24, domain `dcs_supplemental`). Configured from Settings > Data Sources page, not the Import wizard. Labeled "Supplemental Point Data" in the UI. Updated connector types table to reflect research findings: DeltaV has NO native REST API (requires ODBC sidecar); Ignition uses OPC UA (no supplemental connector needed); added `siemens_sph_rest` (SIMATIC Process Historian, separate from WinCC OA); added `kepware_rest`, `canary_rest`; renamed `deltav_rest` → `deltav_sidecar` (Tier 2 ODBC); added `s800xa_odbc`, `yokogawa_sidecar` for brownfield ABB/Yokogawa. Full Tier 1/Tier 2 distinction documented. PI Web API, Experion EPDOC, and Siemens SPH REST endpoint tables added.
- **v0.8**: Major expansion — OPC UA Optional Services (Part 8 Data Access, Part 9 A&C, Part 11 HA), Supplemental Connector architecture (hybrid data sourcing), Vendor Connection Profiles expanded to 15 platforms with port gotchas and cert import notes. Added Connection Flow section (live discovery, not static presets). Port visibility requirement. Security policy selection algorithm. Certificate ApplicationUri stability spec. Namespace URI stability requirement. Session reconnection via ActivateSession. PI/AVEVA clarification (no native OPC UA server — use PI Web API connector). `BadCertificateUriInvalid` Siemens-specific error hint. Deprecated policy support required. Cert rejection UX with Download Client Certificate button. Data Sourcing Priority table. Supplemental event wire format. A&C/supplemental deduplication. Schema additions flagged: `alarm_limit_hh/h/l/ll` columns on `points_metadata` and `points_metadata_versions`.
- **v0.6**: Added global minimum publish interval floor reference (`opc.minimum_publish_interval_ms`, default 1000ms, min 100ms from doc 15). Per-source intervals cannot go below this floor. Protects DCS/historian systems from aggressive polling out of the box.
- **v0.5**: Added Connection Profiles and Rate Protection section. 9 pre-configured profiles for known DCS/historian/SCADA platforms (DeltaV, Siemens S7-1500/1200, Schneider, Yokogawa, Ignition, AVEVA PI) plus Conservative default and Custom. Optional platform dropdown in connection setup with ApplicationDescription auto-detection fallback. OperationLimits auto-discovery (Part 5 §6.3.11) with out-of-sync warnings. Adaptive throttling (latency monitoring, StatusCode backoff, staggered initialization, server-revised interval acceptance). Reconnection strategy (exponential backoff, session recovery, TransferSubscription with fallback, queue sizing). Health surfacing in Settings and System Health. Updated batch operation defaults to respect server-reported limits. Based on research across 12 platforms — see `.claude/agent-output/opc-rate-limit-research.md`.
- **v0.4**: Deep dive: OPC UA certificate management moved to centralized certificate store (doc 15). Connection config uses certificate dropdown instead of per-connection upload. Server certificates received during handshake stored in central Trusted CAs. Added cross-reference to doc 15 § Certificate Management.
- **v0.3**: Fixed source status values to match canonical `point_sources` CHECK constraint: `'connected'` → `'active'`, `'disconnected'` → `'inactive'`. Added `'connecting'` transitional state during connection setup. Added status mapping summary note.
- **v0.2**: Multi-source support via `point_sources` table. Point discovery now uses `upsert_point_from_source()` for idempotent create/version/touch semantics. Added source status tracking (`status`, `last_connected_at`, `last_error_at`). Backfill on reconnection via `backfill_upsert_history()`. History writes use batch INSERT with `ON CONFLICT DO NOTHING` deduplication. NOTIFY batching for broker throughput.
- **v0.1**: Expanded Data Quality section with full OPC UA status code categories (Good, Uncertain, Bad) and their subtypes. Added documentation on how quality codes affect aggregate calculations (Good-only filtering). Clarified that raw data preserves all quality levels for forensic analysis.
