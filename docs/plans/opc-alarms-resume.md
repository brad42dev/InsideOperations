# OPC A&C Alarms Pipeline — Session Resume File

## Current state (as of 2026-04-07)

The full OPC A&C alarm pipeline is complete and verified working end-to-end.

### Architecture

```
SimBLAH OPC UA server
  → opc-service (A&C subscription + ConditionRefresh + HistoryRead)
  → events hypertable (event_type='process_alarm', source='opc', source_event_id for dedup)
  → event-service external alarm processor (5s poll)
  → alarms_current UPSERT (current state per point/condition)
  → pg_notify('alarm_state_changed') broadcast
  → /alarms/opc/active REST endpoint (queryable)
```

### Priority mapping (severity_to_priority)

OPC UA Severity (0–1000) → ISA-18.2 priority. SimBLAH discrete values: 900, 600, 300, 0.

| Severity range | Priority enum | Priority int | SimBLAH alarm type |
|---|---|---|---|
| 750–1000 | `urgent` | 1 | HighHigh / LowLow (severity=900) |
| 450–749 | `high` | 2 | High / Low limit (severity=600) |
| 150–449 | `medium` | 3 | Equipment / operational (severity=300) |
| 1–149 | `low` | 4 | (not used by SimBLAH) |
| 0 | `diagnostic` | 0 | State conditions, system meta |

LimitState/CurrentState is NOT populated by SimBLAH; severity ranges are the sole priority source.
Both `services/opc-service/src/db.rs` and `services/event-service/src/alarm_evaluator.rs` use these boundaries.

### Key migration

**`migrations/20260508000002_events_source_event_id`** — adds `source_event_id TEXT` column and
`UNIQUE INDEX ON events(timestamp, source_event_id) WHERE source_event_id IS NOT NULL`.
Used for `ON CONFLICT DO NOTHING` deduplication during ConditionRefresh replays and history recovery.

### Files changed (this session)

**`services/opc-service/src/db.rs`**
- Added `severity_to_priority_enum(severity: i16) -> &'static str` (750/450/150 boundaries)
- `write_opc_events()`: added `priority` and `source_event_id` columns to INSERT with `ON CONFLICT (timestamp, source_event_id) WHERE source_event_id IS NOT NULL DO NOTHING`

**`services/opc-service/src/driver.rs`**
- Added `recover_alarm_event_history()` — spawned as background tokio task after A&C subscription created
- Uses `HistoryReadAction::ReadEventDetails` against Server node (ns=0;i=2253)
- Watermark = `MAX(timestamp) FROM events WHERE event_type='process_alarm' AND source='opc'`, fallback = now() - 90 days
- Fetches 10-field EventFilter, paginates with continuation points (1000 events/page)
- Deduplication via ON CONFLICT on source_event_id

**`services/event-service/src/alarm_evaluator.rs`**
- Replaced `limit_state_to_priority()` with `severity_to_priority(i16) -> i32` + `severity_to_priority_enum(i16) -> &'static str`
- Added `severity` to SELECT in `run_external_alarm_processor()`
- Changed `source IN ('opc', 'import')` → `source = 'opc'`
- Added full UPSERT to `alarms_current` (was missing despite prior session claiming otherwise)
  - Tracks `activated_at` / `cleared_at` transitions correctly

**`services/event-service/src/handlers/alarms.rs`**
- Added `GET /alarms/opc/active` endpoint (queries `alarms_current`, joins `points_metadata` for tagname)
- Added `POST /alarms/opc/:point_id/acknowledge` endpoint (proxies to opc-service)

**`services/event-service/src/config.rs`**
- Added `opc_service_url` (env `OPC_SERVICE_URL`, default `http://127.0.0.1:3002`)

**`services/event-service/src/state.rs`**
- Added `http: reqwest::Client` for the acknowledge proxy

**`services/event-service/src/main.rs`**
- Initializes `reqwest::Client` and registers the two new OPC routes

**`services/event-service/Cargo.toml`**
- Added `reqwest.workspace = true`

### Data state (as of session end 2026-04-07)

Full 90-day historical recovery run. SimBLAH had ~3 weeks of process alarm history and ~1 month of diagnostics.

- **62,553 events** in `events` table (deduped via source_event_id)
- **486 rows** in `alarms_current` (9 active, 8 acked)
- Priority breakdown: urgent=1749, high=2072, medium=502, low=1, diagnostic=58239

---

## Next session: Designer alarm test graphic

Build a test graphic in the Designer using SimBLAH alarm test points to verify end-to-end alarm display:
- Active alarm indicators on display elements
- Color changes by priority (urgent=red, high=orange, medium=yellow, low=blue)
- Acknowledge flow: click → POST /alarms/opc/:point_id/acknowledge

**Key endpoints for the Designer/frontend:**
- `GET /api/v1/alarms/opc/active` — list active OPC alarms (proxied through API gateway)
- `POST /api/v1/alarms/opc/:point_id/acknowledge` — acknowledge an OPC alarm

**Check active alarms before starting:**
```sql
SELECT tagname, priority::text, severity, state::text, condition_name
FROM alarms_current ac
JOIN points_metadata pm ON pm.id = ac.point_id
WHERE alarm_source::text = 'opc' AND active = true
ORDER BY severity DESC;
```
