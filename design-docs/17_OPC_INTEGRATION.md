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
- Set data change filter (on value change, deadband optional)

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

## Connection Profiles and Rate Protection

### Problem

OPC UA servers have no built-in rate throttling (confirmed by IEEE ICIT 2018 research). When overloaded by aggressive clients, servers can enter degraded state, return high latencies, or become unavailable. DCS controllers are particularly constrained — Emerson DeltaV PK Controllers have only 6 sessions total and cap at 1,250 items/sec. I/O must protect the target system from being overwhelmed.

### Connection Profiles

I/O ships with pre-configured connection profiles for known platforms. During OPC connection setup, an optional dropdown ("What platform is this?") pre-populates all OPC settings with that profile's defaults. If the admin skips the dropdown, the system queries the server's `ApplicationDescription` on first connect and attempts to match a known profile.

| Profile | Sessions | Items/Sub | Items/Call | Publish Interval | Notes |
|---------|----------|-----------|------------|-----------------|-------|
| **Conservative (default)** | 1 | 1,000 | 500 | 1,000ms | Safe everywhere |
| DeltaV PK Controller | 1 | 1,000 | 500 | 1,000ms | Hard cap: 6 sessions, 1,250 items/sec |
| DeltaV Application Station | 2 | 2,000 | 500 | 1,000ms | Higher capacity than PK Controller |
| Siemens S7-1500 | 2 | 1,000 | 500 | 1,000ms | Split sub limits: max 10 subs >1000 items, max 20 subs ≤1000 items |
| Siemens S7-1200 | 1 | 500 | 200 | 1,000ms | Very constrained: 10 sessions, 1,000 items total |
| Schneider EcoStruxure | 1 | 1,000 | 500 | 1,000ms | No TransferSubscription support |
| Yokogawa Exaopc | 1 | 1,000 | 500 | 1,000ms | Throughput cap: 2,000-4,000 items/sec |
| Ignition | 2 | 2,000 | 1,000 | 500ms | Most flexible, 100 sessions default |
| AVEVA PI (via connector) | 1 | 1,000 | 1,000 | 1,000ms | Typically read via PI Web API, not OPC UA |
| **Custom** | User-defined | User-defined | User-defined | User-defined | Full manual control |

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

- **v0.6**: Added global minimum publish interval floor reference (`opc.minimum_publish_interval_ms`, default 1000ms, min 100ms from doc 15). Per-source intervals cannot go below this floor. Protects DCS/historian systems from aggressive polling out of the box.
- **v0.5**: Added Connection Profiles and Rate Protection section. 9 pre-configured profiles for known DCS/historian/SCADA platforms (DeltaV, Siemens S7-1500/1200, Schneider, Yokogawa, Ignition, AVEVA PI) plus Conservative default and Custom. Optional platform dropdown in connection setup with ApplicationDescription auto-detection fallback. OperationLimits auto-discovery (Part 5 §6.3.11) with out-of-sync warnings. Adaptive throttling (latency monitoring, StatusCode backoff, staggered initialization, server-revised interval acceptance). Reconnection strategy (exponential backoff, session recovery, TransferSubscription with fallback, queue sizing). Health surfacing in Settings and System Health. Updated batch operation defaults to respect server-reported limits. Based on research across 12 platforms — see `.claude/agent-output/opc-rate-limit-research.md`.
- **v0.4**: Deep dive: OPC UA certificate management moved to centralized certificate store (doc 15). Connection config uses certificate dropdown instead of per-connection upload. Server certificates received during handshake stored in central Trusted CAs. Added cross-reference to doc 15 § Certificate Management.
- **v0.3**: Fixed source status values to match canonical `point_sources` CHECK constraint: `'connected'` → `'active'`, `'disconnected'` → `'inactive'`. Added `'connecting'` transitional state during connection setup. Added status mapping summary note.
- **v0.2**: Multi-source support via `point_sources` table. Point discovery now uses `upsert_point_from_source()` for idempotent create/version/touch semantics. Added source status tracking (`status`, `last_connected_at`, `last_error_at`). Backfill on reconnection via `backfill_upsert_history()`. History writes use batch INSERT with `ON CONFLICT DO NOTHING` deduplication. NOTIFY batching for broker throughput.
- **v0.1**: Expanded Data Quality section with full OPC UA status code categories (Good, Uncertain, Bad) and their subtypes. Added documentation on how quality codes affect aggregate calculations (Good-only filtering). Clarified that raw data preserves all quality levels for forensic analysis.
