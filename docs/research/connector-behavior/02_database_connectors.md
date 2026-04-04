# Database Connector Trigger/Delivery Modes — Research

**Date:** 2026-04-04
**Author:** Research agent
**Scope:** Enhanced trigger and delivery modes for the five database ETL connector types already present in the import-service: PostgreSQL, MySQL/MariaDB, MSSQL, ODBC, MongoDB.
**Context file read:** `01_current_architecture.md`

---

## Contents

1. [Framing: What "mode" means relative to the current architecture](#1-framing)
2. [PostgreSQL](#2-postgresql)
3. [MySQL / MariaDB](#3-mysql--mariadb)
4. [Microsoft SQL Server](#4-microsoft-sql-server)
5. [ODBC (generic)](#5-odbc-generic)
6. [MongoDB](#6-mongodb)
7. [Debezium: Java incumbent and Rust equivalents](#7-debezium-java-incumbent-and-rust-equivalents)
8. [Watermark-based incremental: patterns and state storage](#8-watermark-based-incremental-patterns-and-state-storage)
9. [Recommendation table](#9-recommendation-table)

---

## 1. Framing

The current architecture has one execution mode for all ETL connectors: **one-shot bulk extract**. `EtlConnector::extract()` is called once, returns `Vec<SourceRecord>` (everything in RAM), and the pipeline commits it. The `watermark_state JSONB` column in `import_runs` exists but is never written. The scheduler is broken (missing DDL columns).

This document answers: for each DB type, what *should* the enhanced modes look like, and what Rust ecosystem support exists?

The four modes defined for this research:

| Mode | Description |
|---|---|
| **One-time** | Single extract. Current behavior. Bootstrapping or historical loads. |
| **Scheduled/polling** | Re-run the query on a cron or interval schedule. Duplicate avoidance handled by a watermark column in the query. |
| **Incremental with watermark** | A sub-variant of scheduled/polling where the query is parameterized by the last successful high-watermark value, stored in `import_runs.watermark_state`. |
| **CDC (Change Data Capture)** | Real-time, log-based row-level change streaming. The connector maintains a persistent connection/slot to the source DB and pushes inserts/updates/deletes as events. |

---

## 2. PostgreSQL

### 2.1 Industrial use cases

PostgreSQL appears in industrial/refinery environments as the backend for:

- **LIMS** (Laboratory Information Management Systems): sample submissions, test results, QC limits, instrument calibrations. Schema typically has `sample_results` with `updated_at` timestamps and `result_status` columns.
- **Access control systems**: badge swipe history, personnel rosters, certification expiry. OpenELIS and similar open-source platforms use PostgreSQL. Key tables: `personnel`, `badge_events`, `certifications`.
- **Historian supplemental metadata**: some OPC-UA historians store tag metadata (descriptions, engineering units, limit sets) in PostgreSQL side-tables alongside the time-series store.
- **Maintenance/CMMS databases**: work order status, equipment records, inspection intervals. Some open-source CMMS tools (e.g., Maintenance Connection, ERPNext) support PostgreSQL.
- **OSIsoft PI Integrator / AF databases**: in environments that mirror PI AF element attributes into relational tables for reporting, PostgreSQL is occasionally used.

### 2.2 Trigger/delivery modes

#### One-time
Current behavior. Query is specified in `source_config.query`, all rows returned. Useful for bootstrapping tag metadata from a LIMS or personnel roster from an access control system.

#### Scheduled/polling with watermark
Parameterize the query with the last successful watermark value. On each scheduled run:
1. Read `watermark_state` from the most recent completed `import_runs` row for this definition.
2. Substitute `$last_watermark` into the query: `WHERE updated_at > $last_watermark ORDER BY updated_at`.
3. Record the `MAX(updated_at)` of the extracted rows as the new `watermark_state` for this run.

This is the most practical mode for LIMS result delivery (results are append-heavy, `updated_at` is reliably set). Interval of 5–60 minutes covers most LIMS refresh needs.

**Query pattern:**
```sql
SELECT * FROM sample_results
WHERE updated_at > $last_watermark
ORDER BY updated_at
LIMIT 10000
```

**Limitations:** Does not capture deletes. If the source schema does not have a reliable `updated_at` column (common in legacy systems), use `id`-based watermark instead:
```sql
SELECT * FROM sample_results WHERE id > $last_id ORDER BY id LIMIT 10000
```

`id`-based watermark misses out-of-order inserts but is safe for append-only tables.

#### CDC via PostgreSQL logical replication (pgoutput)

PostgreSQL's built-in logical replication protocol (available since PostgreSQL 10) decodes WAL changes into a row-level event stream using the `pgoutput` output plugin. This requires no third-party plugins on the source server — `pgoutput` ships with every PostgreSQL installation.

**Source server setup required:**
```sql
-- postgresql.conf
wal_level = logical          -- must be 'logical', not 'replica' or 'minimal'
max_replication_slots = 5    -- at least 1 per consumer + headroom
max_wal_senders = 10         -- at least = max_replication_slots

-- Create a dedicated replication user
CREATE ROLE io_replication REPLICATION LOGIN PASSWORD '...';
GRANT SELECT ON TABLE sample_results TO io_replication;

-- Create a publication for the tables of interest
CREATE PUBLICATION io_lims_pub FOR TABLE sample_results, badge_events;

-- Create a replication slot (consumer does this, but DBA may pre-create)
SELECT pg_create_logical_replication_slot('io_lims_slot', 'pgoutput');
```

**Key operational risk:** Replication slots hold WAL until the consumer confirms (`pg_lsn` advance). If the I/O import service is offline for hours, the source PostgreSQL server accumulates WAL and can fill disk. This is the single largest reason CDC is risky for industrial monitoring products where the I/O service may go offline for maintenance.

**Mitigation:** Set a slot inactivity timeout in PostgreSQL 13+:
```sql
ALTER SYSTEM SET wal_receiver_timeout = '30min';
-- For slot auto-drop on disconnect (PostgreSQL 17+):
-- max_slot_wal_keep_size = '10GB'
```

**Rust crates:**

| Crate | Version | License | Notes |
|---|---|---|---|
| `pgwire-replication` | 0.2.0 | MIT or Apache-2.0 | Low-level wire-protocol client using pgoutput. Tokio-async. TLS via rustls. SCRAM auth. Extracted from Deltaforge CDC project. Crates.io-published. |
| `pg_replicate` | git-only (Supabase) | Apache-2.0 | Higher-level building blocks for building replication pipelines. Not published on crates.io — must use git dependency. |
| `postgres-replication-types` | 0.1.1 | MIT | Supplementary type decoding for logical replication messages. |

For I/O's use case, `pgwire-replication 0.2.0` is the preferred crate — it is on crates.io (so no git dependency), MIT/Apache-2.0 dual-licensed, and provides direct access to the pgoutput message stream (Begin, Commit, Insert, Update, Delete, Relation). The higher-level `pg_replicate` is more ergonomic but requires a git dependency, which complicates reproducible builds.

**What the connector implementation looks like at a high level:**
1. Open a replication connection (separate from the regular query connection — PostgreSQL distinguishes these at the protocol level).
2. Start `START_REPLICATION SLOT io_lims_slot LOGICAL 0/0 (proto_version '1', publication_names 'io_lims_pub')`.
3. Receive pgoutput messages: `Relation` (schema), `Begin`, `Insert`/`Update`/`Delete`/`Truncate`, `Commit`.
4. Buffer a transaction's worth of changes; on `Commit`, write to I/O's pipeline.
5. Send `standby_status_update` to advance the LSN and release WAL on the source.

This is a **long-running async task**, not a one-shot `extract()` call. It does not fit the current `EtlConnector` trait and would require a new trait or a dedicated CDC connector type.

### 2.3 Recommended pattern for I/O

**Primary recommendation: Scheduled incremental with watermark.**

Rationale: Industrial monitoring does not need sub-second LIMS result delivery. A 5–15 minute polling interval is sufficient. Watermark-based incremental is simple, stateless between restarts, and requires zero source server configuration changes (no `wal_level` change, no replication user, no slots).

CDC is architecturally appropriate only if the source PostgreSQL database:
- Already has `wal_level = logical` (check with `SHOW wal_level`).
- Is under DBA control (so a replication slot can be managed).
- Delivers data that genuinely needs < 60-second latency in I/O.

If those three conditions are met (unlikely for a read-only LIMS integration), CDC is viable using `pgwire-replication`.

---

## 3. MySQL / MariaDB

### 3.1 Industrial use cases

MySQL and MariaDB appear frequently in industrial environments because many commercial LIMS, CMMS, and access control vendors ship embedded MySQL:

- **LabVantage LIMS**: ships with Oracle or SQL Server, but MariaDB-based variants exist in mid-market deployments.
- **Maximo (some configurations)**: uses DB2 primarily, but some mid-tier sites run MySQL-backed connectors.
- **Lenel OnGuard, Software House C-CURE 9000**: access control systems with MySQL backends storing personnel, badge transactions, alarm events.
- **Wonderware Information Server (historical)**: some older deployment profiles used MySQL for non-time-series metadata.
- **Custom DCS supplemental databases**: plant-floor applications built on LAMP stacks with tag alias tables, equipment inventories, calibration records.

### 3.2 Trigger/delivery modes

#### One-time
Same as PostgreSQL. Current behavior.

#### Scheduled/polling with watermark
Same query parameterization pattern as PostgreSQL. MySQL's `information_schema` has `TABLES.UPDATE_TIME` but it's not row-level — use an `updated_at` column.

**MySQL-specific:** MySQL does not have multi-version concurrency control as clean as PostgreSQL. A large `SELECT ... WHERE updated_at > ?` can cause lock contention if the application is also writing heavily. Use `SELECT ... WITH (NOLOCK)` equivalent in MySQL via transaction isolation:
```sql
SET SESSION TRANSACTION ISOLATION LEVEL READ UNCOMMITTED;
SELECT * FROM badge_events WHERE recorded_at > ? ORDER BY recorded_at LIMIT 5000;
```
Read-uncommitted is acceptable for monitoring (dirty reads are low-risk in this context; the alternative is stale data).

#### CDC via MySQL binlog

MySQL binary logging (binlog) in ROW format records before/after images of every changed row. Replication clients connect as a MySQL replica and receive binlog events.

**Source server setup required:**
```sql
-- my.cnf / my.ini
[mysqld]
server-id        = 1          -- must be non-zero, unique
log-bin          = mysql-bin  -- enable binary logging
binlog-format    = ROW        -- required for row-level CDC; STATEMENT or MIXED do not give reliable before/after images
binlog-row-image = FULL       -- ensures full row image (default in MySQL 5.7+)
expire-logs-days = 7          -- prevent unbounded binlog growth

-- GTID mode (recommended, simplifies position tracking)
gtid-mode              = ON
enforce-gtid-consistency = ON

-- Replication user
CREATE USER 'io_binlog'@'%' IDENTIFIED BY '...';
GRANT REPLICATION SLAVE, REPLICATION CLIENT ON *.* TO 'io_binlog'@'%';
```

**MariaDB differences:** MariaDB 10.x uses its own GTID implementation (`@@global.gtid_current_pos`) distinct from MySQL's. The `mysql_cdc` crate handles both. MariaDB 10.x enables binary logging by default (MySQL 5.7 does not enable it by default in all distributions).

**Rust crates:**

| Crate | Version | License | Notes |
|---|---|---|---|
| `mysql_cdc` | 0.9.x | MIT | MySQL/MariaDB binlog replication client. Supports GTID-based and position-based replication. Offline binlog file reading. Active on crates.io. Does NOT support SSL yet — relevant if source is remote. |
| `mysql-cdc-rs` | pre-release | unknown | Alternative Rust binlog parser. Clean Rust implementation including JSONB type. Less mature than `mysql_cdc`; license not clearly documented on crates.io. |
| `mysql_async` | 0.34 | MIT or Apache-2.0 | Already in use for polling queries. Does NOT provide binlog access. |

**Recommendation:** `mysql_cdc` (MIT) is the only viable Rust crate for binlog CDC. The SSL limitation is a real concern: if the MySQL source is on a different host and TLS is required by network policy, `mysql_cdc` cannot be used. In that case, fall back to watermark-based polling.

**What binlog CDC looks like at a high level:**
1. Register as a MySQL replica with a `server-id` not in use by any existing replica.
2. Request binlog from a given file/position or GTID set.
3. Receive `RotateEvent`, `TableMapEvent`, `WriteRowsEvent`/`UpdateRowsEvent`/`DeleteRowsEvent`, `XidEvent` (transaction commit).
4. On `TableMapEvent`, learn column types. On `WriteRowsEvent`, decode rows using column metadata.
5. Persist binlog position or GTID after each commit.

Like PostgreSQL CDC, this is a long-running task, not a one-shot extract.

### 3.3 Recommended pattern for I/O

**Primary recommendation: Scheduled incremental with watermark.**

Same rationale as PostgreSQL. Badge event systems and LIMS results don't need sub-60-second delivery to a monitoring tool. Watermark polling requires only a standard MySQL SELECT user — no `REPLICATION SLAVE` grant, no `binlog_format=ROW` requirement from the DBA.

CDC via `mysql_cdc` is appropriate when:
- The source DBA can confirm `binlog_format=ROW` (or set it — requires MySQL restart in older versions).
- SSL is not required (or the connection is on a private network).
- A unique `server-id` can be allocated to I/O without conflicting with existing replicas.

---

## 4. Microsoft SQL Server

### 4.1 Industrial use cases

SQL Server is the dominant relational database in industrial/refinery environments because major DCS and ERP vendors ship SQL Server:

- **SAP ERP (S/4HANA, SAP ECC)**: uses SQL Server in mid-tier refinery deployments. Relevant data: work orders (`AUFK`/`AUFAL`), materials management, purchase orders, equipment maintenance records.
- **Maximo EAM**: SQL Server is the primary supported DB. Key tables: `WORKORDER`, `ASSET`, `FAILURECODE`, `JOBPLAN`, `PM` (preventive maintenance schedules).
- **Infor EAM**: SQL Server backend. Equipment, work orders, inventory.
- **Wonderware System Platform / eDNA**: stores alarm history, batch records, event logs in SQL Server.
- **OSIsoft PI Server (SQL Server side)**: PI AF element attribute metadata is stored in SQL Server databases (`PIAFSecurity`, `PIAFConfiguration`). PI batch databases also use SQL Server.
- **Emerson DeltaV SIS / Batch**: historian batch records and event journals land in SQL Server.
- **Honeywell PHD / Uniformance**: supplemental event data in SQL Server side databases.
- **LIMS vendors**: LabWare LIMS, STARLIMS use SQL Server exclusively.

This is where MSSQL has the broadest and most critical industrial use cases of all the DB types covered here.

### 4.2 Trigger/delivery modes

#### One-time
Current behavior.

#### Scheduled/polling with watermark
SQL Server has reliable `GETDATE()` and `SYSDATETIMEOFFSET()`. Most ERP and CMMS tables have `MODIFIEDON`, `UPDATED_AT`, or `MODIFIEDDATETIME` columns.

**Work order polling example:**
```sql
SELECT wo.WONUM, wo.DESCRIPTION, wo.STATUS, wo.ACTFINISH, wo.ASSET, wo.MODIFIEDON
FROM WORKORDER wo
WHERE wo.MODIFIEDON > @last_watermark
ORDER BY wo.MODIFIEDON
```

For tables without a reliable modified timestamp, `ROWVERSION` (formerly `TIMESTAMP`) is a SQL Server-specific monotonic byte counter that increments on every row write:
```sql
SELECT * FROM ASSET
WHERE RowVersion > @last_row_version
ORDER BY RowVersion
```
`ROWVERSION` is better than a timestamp for watermarks because it is guaranteed monotonically increasing within the database and does not suffer from clock drift.

#### SQL Server Change Tracking (CT)

Change Tracking is SQL Server's lightweight built-in mechanism for recording *which* rows changed (PK + operation type: insert/update/delete), without storing before/after values. Available in SQL Server 2008+, including Express edition. It requires no SQL Agent jobs.

**Source server setup:**
```sql
-- Enable at database level
ALTER DATABASE MyDB SET CHANGE_TRACKING = ON
  (CHANGE_RETENTION = 7 DAYS, AUTO_CLEANUP = ON);

-- Enable on specific tables
ALTER TABLE WORKORDER ENABLE CHANGE_TRACKING WITH (TRACK_COLUMNS_UPDATED = ON);

-- Grant user SELECT and VIEW CHANGE TRACKING on tables
GRANT SELECT ON WORKORDER TO io_user;
GRANT VIEW CHANGE TRACKING ON OBJECT::WORKORDER TO io_user;
```

**Polling query pattern (via tiberius):**
```sql
DECLARE @sync_version BIGINT = @last_sync_version;
SELECT ct.SYS_CHANGE_OPERATION, ct.WONUM, t.*
FROM CHANGETABLE(CHANGES WORKORDER, @sync_version) AS ct
LEFT JOIN WORKORDER t ON ct.WONUM = t.WONUM
ORDER BY ct.SYS_CHANGE_VERSION;
```
The consumer stores `MAX(SYS_CHANGE_VERSION)` as the watermark. On the next poll, pass it as `@last_sync_version`.

**Important:** CT only retains changes for the `CHANGE_RETENTION` window (e.g., 7 days). If I/O's import service is offline for longer than the retention period, the consumer must fall back to a full re-extract.

Get the current version before first poll:
```sql
SELECT CHANGE_TRACKING_CURRENT_VERSION();
```

Change Tracking is the **best CDC-like option for SQL Server** because:
- It is available on all SQL Server editions (including Express — common in mid-market).
- It requires no SQL Server Agent.
- It does not require `REPLICATION` permissions or enabling the distribution database.
- The `CHANGETABLE` query runs over a regular SQL connection — compatible with tiberius as-is.
- It delivers deletes (unlike watermark-based timestamp polling).

The downside: CT does not provide before-images (old column values before an update). For monitoring purposes (tracking current equipment/work order state), this is not a material limitation.

#### SQL Server CDC (Full Change Data Capture)

SQL Server also has full CDC (`sys.sp_cdc_enable_db`, `sys.sp_cdc_enable_table`) which captures before/after row images in a set of `cdc.*_CT` shadow tables. This is more powerful than CT but requires:
- SQL Server Enterprise or Developer edition (CT is available on Standard/Express too; full CDC is not on Express).
- SQL Server Agent to be running (manages the capture and cleanup jobs).
- `db_owner` or `sysadmin` to enable.

Full CDC can also be polled via tiberius using `cdc.fn_cdc_get_all_changes_<table>()` functions. No Rust-specific CDC library is needed — it's just SQL queries via the existing tiberius connector.

#### SQL Server 2025 Change Event Streaming (CES)

SQL Server 2025 introduces a native Change Event Streaming feature that can emit row change events directly to external systems (Kafka, EventHub, etc.) without polling. This is not yet relevant for I/O's target sites (SQL Server 2025 was in preview as of early 2026; production deployments are minimal in industrial environments), but it is worth noting for future consideration.

### 4.3 Rust crate situation

There is no Rust crate for SQL Server binlog/CDC that parallels `mysql_cdc` or `pgwire-replication`. SQL Server's full CDC and Change Tracking are queried via standard T-SQL over a normal TDS connection. The existing `tiberius` crate (already a dependency) is sufficient for all three MSSQL modes:
- One-time extract: current implementation.
- Watermark polling: parameterized T-SQL query via `client.query()`.
- Change Tracking: `CHANGETABLE(CHANGES ...)` T-SQL via `client.query()`.
- Full CDC: `cdc.fn_cdc_get_all_changes_...()` T-SQL via `client.query()`.

No new crate dependencies are required for MSSQL enhanced modes.

### 4.4 Recommended pattern for I/O

**Primary recommendation: SQL Server Change Tracking (scheduled polling).**

Change Tracking is specifically the right answer for the I/O → Maximo/ERP integration pattern. It:
- Delivers deletes (personnel record removals, work order cancellations) — something pure watermark polling cannot do.
- Requires only a SELECT-level grant and `VIEW CHANGE TRACKING` (DBA-friendly, no enterprise features).
- Runs over a normal tiberius connection.
- Is available on all SQL Server editions the target customer base actually runs.

For sites where CT is not enabled and the DBA cannot enable it (common in locked-down enterprise SQL Server environments), fall back to watermark polling with `ROWVERSION` or `MODIFIEDON`.

---

## 5. ODBC (generic)

### 5.1 Industrial use cases

The ODBC connector is the catch-all for databases that lack a native Rust driver. Industrial sources that require ODBC:

- **Oracle Database**: the dominant DB in large refineries (BP, Shell, ExxonMobil). SAP ERP on Oracle, LabWare LIMS on Oracle, GE Proficy Plant Applications on Oracle. The `oracle` Rust crate (0.6.3, MIT/Apache-2.0, based on ODPI-C) exists but requires Oracle Instant Client installation, making deployment complex. ODBC via the Oracle ODBC driver is often simpler.
- **IBM DB2**: used in some SAP ECC on DB2 deployments, IBM Maximo on DB2. No usable async Rust DB2 driver exists. ODBC is the only path.
- **Sybase / SAP ASE**: legacy historian databases at older refineries.
- **Progress OpenEdge**: used by some asset management systems.
- **Interbase / Firebird**: rare but present in legacy calibration management systems.
- **Any database accessible via a DSN-less connection string**: ODBC is the integration path of last resort.

### 5.2 Trigger/delivery modes

ODBC's synchronous, blocking API (wrapped in `tokio::task::spawn_blocking`) limits what modes are practical.

#### One-time
Current behavior. `spawn_blocking` wraps the entire extract.

#### Scheduled/polling with watermark
Parameterize the SQL query with a watermark value. The ODBC connector can accept a query with a placeholder that gets substituted before execution. Since ODBC parameter binding is driver-dependent (some drivers use `?`, others use `:param`, others use `@param`), the safest approach for ODBC is string substitution of validated values rather than ODBC parameter binding.

```sql
-- Example (Oracle via ODBC)
SELECT ASSET_ID, ASSET_NAME, MODIFIED_DATE
FROM ASSET_MASTER
WHERE MODIFIED_DATE > TO_DATE('$last_watermark', 'YYYY-MM-DD HH24:MI:SS')
ORDER BY MODIFIED_DATE
```

For Oracle specifically, `ROWNUM` pagination is needed for large result sets (Oracle lacks `LIMIT`):
```sql
SELECT * FROM (
  SELECT * FROM ASSET_MASTER WHERE MODIFIED_DATE > TO_DATE('$last_watermark', 'YYYY-MM-DD HH24:MI:SS')
  ORDER BY MODIFIED_DATE
) WHERE ROWNUM <= 10000
```

#### CDC via ODBC
Not viable. ODBC provides no standard interface to transaction logs or change streams. Any CDC-like functionality must be implemented at the SQL query level (Change Tracking for SQL Server, timestamp polling for Oracle, etc.).

For Oracle specifically:
- **Oracle Flashback Query** (`AS OF TIMESTAMP`/`AS OF SCN`) can retrieve past states but is not a CDC stream.
- **Oracle LogMiner** exposes redo log changes via SQL queries (`DBMS_LOGMNR`). This is Oracle's version of binlog reading, but it requires DBA privileges and significant setup. It is not practical as a general import-service feature.
- **Oracle Change Data Capture** (deprecated in 12c) and Oracle GoldenGate (licensed separately) are the enterprise CDC solutions for Oracle. They are not accessible via ODBC in a useful way for I/O.

**Summary:** ODBC connectors support only one-time and watermark-based polling. No CDC.

### 5.3 Oracle via the native `oracle` crate vs ODBC

The `oracle` crate (v0.6.3, UPL-1.0 or Apache-2.0, based on ODPI-C) is a strong alternative to ODBC for Oracle-specific deployments. License check: UPL-1.0 (Universal Permissive License) is a permissive OSI-approved license compatible with commercial use. Apache-2.0 dual-license is explicitly acceptable per I/O's licensing policy.

**Tradeoff:**
| | `oracle` crate | ODBC connector |
|---|---|---|
| Requires Oracle Instant Client on server | Yes | Yes (Oracle ODBC driver) |
| Async | No (wraps synchronous OCI) | No (spawn_blocking) |
| Type fidelity | High (native Oracle types) | Medium (ODBC type mapping) |
| MariaDB/DB2/Sybase support | No | Yes (via different drivers) |
| Connection string format | Native Oracle | ODBC DSN string |

For I/O, adding a dedicated `oracle` connector type (distinct from `odbc`) is worth considering given the prevalence of Oracle at large refinery sites. But that is a new connector, not an enhancement to the existing ODBC connector.

### 5.4 Recommended pattern for I/O

**Primary recommendation: Scheduled/polling with watermark.**

ODBC is inherently a polling-only connector. The implementation should:
1. Accept `source_config.watermark_column` (e.g., `"MODIFIED_DATE"`).
2. Accept `source_config.watermark_type` (`"timestamp"` or `"integer"`).
3. Substitute the watermark value into the query at extraction time.
4. Record the max watermark from the extracted rows into `import_runs.watermark_state`.

For sites with Oracle, document that the user must supply an Oracle-appropriate `WHERE` clause (including `TO_DATE()` wrapping, `ROWNUM` limits, etc.).

---

## 6. MongoDB

### 6.1 Industrial use cases

MongoDB is less common in core industrial infrastructure but appears in:

- **Newer LIMS platforms** (some cloud-native LIMS vendors use MongoDB for sample metadata and flexible schema storage).
- **Access control systems** (Lenel S2 NetBox, Genetec Security Center have MongoDB-backed audit logs).
- **IoT/device data aggregators**: some modern data collection platforms (e.g., certain versions of Aveva Edge, custom Node-RED historians) land JSON event data in MongoDB before forwarding to a historian.
- **Calibration and document management systems**: equipment passports, procedure documents stored as JSON with nested structures.
- **Custom analytics databases**: MongoDB used as a landing zone for API-sourced data (weather, energy pricing) that gets correlated with process data in I/O Forensics.

### 6.2 Trigger/delivery modes

#### One-time
Current behavior. `find()` with optional filter and projection.

#### Scheduled/polling with watermark

MongoDB documents don't have a standard `updated_at` field (unlike SQL tables), but every document has an `_id` field that is an `ObjectId`. The ObjectId embeds a 4-byte Unix timestamp in its first 4 bytes, making it a monotonically increasing (within a single insert batch) rough timestamp watermark.

**ObjectId watermark query pattern:**
```javascript
// In Rust via the mongodb crate using bson::oid::ObjectId::from_datetime()
let watermark_id = ObjectId::from_datetime(last_watermark_datetime);
let filter = doc! { "_id": { "$gt": watermark_id } };
collection.find(filter).sort(doc! { "_id": 1 }).limit(10000);
```

Limitations:
- `ObjectId` watermark only detects insertions, not updates to existing documents.
- If documents have an explicit `updatedAt` field (ISODate), prefer that.

For update-detection with a `updatedAt` field:
```javascript
{ "updatedAt": { "$gt": ISODate("$last_watermark") } }
```

#### CDC via MongoDB Change Streams

MongoDB Change Streams (available since MongoDB 3.6, requires a replica set or sharded cluster) provide a real-time stream of insert/update/replace/delete events from any collection, database, or entire deployment. The stream is based on the MongoDB oplog.

**Requirements on the source MongoDB:**
- Must be running as a **replica set** (even a single-node replica set, not a standalone `mongod`). Sharded clusters are also supported.
- WiredTiger storage engine (default since MongoDB 3.2; MMAPv1 is not supported).
- The user must have `read` role on the database (for collection-level streams) or `readAnyDatabase` (for deployment-level streams).
- `changeStreamPreAndPostImages` must be enabled on the collection to receive before-images (optional; for monitoring, after-images are sufficient).

Converting a standalone MongoDB to a replica set is a brief DBA operation (add `--replSet rs0` to startup, call `rs.initiate()`), but it is a change that requires DBA buy-in.

**Rust implementation using the existing `mongodb` crate (3.x, already a dependency):**

The `mongodb` 3.x crate natively supports change streams:

```rust
use futures::TryStreamExt;
let pipeline = vec![
    doc! { "$match": { "operationType": { "$in": ["insert", "update", "replace", "delete"] } } }
];
let mut change_stream = collection.watch().pipeline(pipeline).await?;
while let Some(event) = change_stream.try_next().await? {
    // event.operation_type: OperationType::Insert / Update / Delete
    // event.full_document: Option<Document> (the after-image)
    // event.document_key: the _id
    // change_stream.resume_token() — persist for resumability
}
```

Resume tokens: the MongoDB driver automatically resumes change streams after transient network failures using the `resumeAfter` token. The consumer should persist the latest `resume_token()` to storage so it can restart from the correct position after a service restart.

**Crate situation:** No additional crates are required. The `mongodb` 3.1+ crate (already in `Cargo.toml`) includes `ChangeStream` support. `rs-mongo-stream` is a community wrapper but adds no necessary functionality.

Like PostgreSQL CDC and MySQL binlog, change streams are a long-running async task incompatible with the current one-shot `EtlConnector::extract()` trait.

### 6.3 Recommended pattern for I/O

**Primary recommendation: Scheduled/polling with watermark (ObjectId or `updatedAt`).**

The replica set requirement for change streams is the key barrier. Most MongoDB deployments encountered at industrial sites are either:
- Standalone `mongod` instances (cannot use change streams without converting to replica set).
- Cloud Atlas deployments (always replica sets, so change streams would work — but cloud Atlas is uncommon in air-gapped refinery environments).

Watermark-based polling using ObjectId or an explicit `updatedAt` field handles the vast majority of I/O's MongoDB integration cases.

If the source is a confirmed replica set (or Atlas), change streams are the correct upgrade path using the already-available `mongodb` crate.

---

## 7. Debezium: Java incumbent and Rust equivalents

### 7.1 What Debezium does

Debezium is an open-source CDC platform (Apache License 2.0, Red Hat) implemented in Java/Kafka Streams. It reads transaction logs from source databases (PostgreSQL WAL, MySQL binlog, SQL Server CDC, MongoDB oplog, Oracle LogMiner) and publishes per-table change events to Apache Kafka topics in a standardized envelope format.

**Debezium's strengths:**
- Comprehensive: supports PostgreSQL, MySQL, SQL Server, Oracle, MongoDB, DB2, Cassandra, Vitess, etc.
- Battle-tested in large-scale data pipelines.
- Rich schema evolution, dead-letter queuing, metrics.

**Debezium's weaknesses for I/O:**
- Requires a running Kafka cluster (or Kafka Connect worker). This is a major infrastructure dependency completely alien to an industrial monitoring product deployed on a single server or VM pair.
- Java runtime required (~200MB JVM overhead per connector).
- Designed as an ETL-to-warehouse pipeline tool, not a monitoring integration.
- Configuration is complex (connector JSON, Kafka Connect REST API).

**Verdict:** Debezium is not suitable for embedding in I/O's import service. I/O should implement its own log-based CDC using native Rust crates.

### 7.2 Pure Rust alternatives

| Project | Status | DB Support | License | Notes |
|---|---|---|---|---|
| `pgwire-replication` 0.2.0 | Stable, crates.io | PostgreSQL only | MIT/Apache-2.0 | Best option for PG CDC in Rust |
| `pg_replicate` (Supabase) | Active, git-only | PostgreSQL only | Apache-2.0 | Higher-level; git dep only |
| `mysql_cdc` 0.9.x | Stable, crates.io | MySQL, MariaDB | MIT | Only Rust MySQL binlog client |
| `chgcap-rs` | Early alpha | PostgreSQL, MySQL | MIT | Multi-DB CDC lib; not production-ready |
| Supermetal | Commercial | PostgreSQL, MySQL | Proprietary | High-performance, single binary; not embeddable |

**Conclusion:** There is no Rust equivalent to Debezium that covers all five DB types I/O needs. Each DB type requires a separate strategy:
- PostgreSQL CDC → `pgwire-replication`
- MySQL/MariaDB CDC → `mysql_cdc`
- SQL Server CDC → tiberius + `CHANGETABLE` T-SQL
- MongoDB CDC → `mongodb` crate change streams
- ODBC/Oracle CDC → not feasible

### 7.3 Should I/O embed any CDC?

**Short answer: Not in Phase 7 (the current phase). Design for it; don't implement it yet.**

CDC requires:
1. A new connector trait (long-running tasks, not one-shot `extract()`).
2. Persistent replication slot/position state beyond `watermark_state JSONB` in `import_runs`.
3. A supervision model (the long-running task must be monitored, restarted on failure, and cleanly stopped).
4. Source-side setup requirements that the I/O installer cannot automate.

All of this is significant scope. The immediate priority should be:
1. Fix the broken scheduler (missing DDL columns).
2. Implement watermark-based polling (which handles 90% of industrial DB integration needs without any source-side changes).
3. Design CDC as a future connector mode with a new trait, not crammed into `EtlConnector`.

---

## 8. Watermark-based incremental: patterns and state storage

### 8.1 The two watermark column types

**Timestamp watermark (`updated_at`, `MODIFIEDON`, `MODIFIED_DATE`, `LAST_UPDATED`)**
- Pros: human-readable, easy to query, works with most schema styles.
- Cons: vulnerable to clock skew if the source DB runs on a different server with clock drift. A record inserted at T=12:00:00.001 on a server with +1ms drift might be missed if the consumer's clock says 12:00:00.000. Mitigation: subtract a small safety margin from the watermark (e.g., `WHERE updated_at > $last_watermark - INTERVAL '30 seconds'`), accepting a small amount of re-processing.

**Integer/sequence watermark (`id`, `ROWVERSION`, `SYS_CHANGE_VERSION`, `auto_increment`)**
- Pros: strictly monotonic (no clock skew), works even without application-level timestamps.
- Cons: misses updates to existing rows (only detects inserts for standard auto-increment IDs). SQL Server `ROWVERSION` detects updates too. MongoDB ObjectId is a rough timestamp-based integer.

### 8.2 `last_imported_id` vs `last_imported_at`

| Approach | Best for | Misses |
|---|---|---|
| `WHERE id > $last_id` | Append-only tables (events, badge swipes, sample submissions) | Updates to existing rows; non-sequential IDs |
| `WHERE updated_at > $last_at` | Tables with update patterns (work orders, equipment records) | Deletes; rows with backdated timestamps |
| `WHERE rowversion > $last_rv` (MSSQL) | Any SQL Server table | Deletes (with CT); before-images (without full CDC) |
| `WHERE _id > ObjectId(...)` (MongoDB) | Append-only collections | Updates to existing documents |
| `CHANGETABLE` version (MSSQL) | Any SQL Server table with CT enabled | Before-images |

For I/O's use cases, the most common patterns are:
- **LIMS sample results**: `WHERE submitted_at > $last_at ORDER BY submitted_at` (append-only, timestamp safe).
- **Access control badge events**: `WHERE event_id > $last_id ORDER BY event_id` (auto-increment, append-only).
- **ERP work orders**: `WHERE MODIFIEDON > $last_at ORDER BY MODIFIEDON` (update-heavy, timestamp needed).
- **Equipment/asset records**: `WHERE ROWVERSION > $last_rv ORDER BY ROWVERSION` (MSSQL CT or ROWVERSION preferred).

### 8.3 State storage in I/O

The `import_runs.watermark_state JSONB` column already exists but is never written. The recommended schema for the JSONB value:

```json
{
  "watermark_type": "timestamp",
  "watermark_column": "updated_at",
  "last_value": "2026-04-04T08:30:00Z",
  "last_run_row_count": 142,
  "last_run_completed_at": "2026-04-04T08:31:15Z"
}
```

Or for integer-based:
```json
{
  "watermark_type": "integer",
  "watermark_column": "id",
  "last_value": 1048576
}
```

Or for SQL Server Change Tracking:
```json
{
  "watermark_type": "change_tracking_version",
  "last_sync_version": 8192,
  "last_run_completed_at": "2026-04-04T08:31:15Z"
}
```

**How the pipeline reads and writes it:**
1. Before `extract()`, read the most recent `import_runs` row for this `import_definition_id` where `status = 'completed'` and `watermark_state IS NOT NULL`.
2. Parse `watermark_state` to get `last_value`.
3. Pass `last_value` to the connector as part of `source_config` (or as a new field in `EtlConnectorConfig`).
4. After a successful load, write the new `watermark_state` to the completed `import_runs` row.

The `source_config` already accepts arbitrary JSON. The cleanest implementation passes the watermark as a runtime-injected field rather than user-configured, to avoid the user having to manually update it.

### 8.4 Safety: the safety margin and re-processing

For timestamp watermarks, always query with a small lookback:
```sql
WHERE updated_at > ($last_watermark - INTERVAL '2 minutes')
```
And deduplicate on load using `ON CONFLICT (source_row_id) DO UPDATE` (which requires a `UNIQUE` constraint on `source_row_id` in `custom_import_data` — currently not present).

Alternatively, rely on the current pipeline's `rows_skipped` mechanism (if a duplicate can be detected by some other means during transformation).

---

## 9. Recommendation table

| DB Type | Mode | Crates needed | Source-side setup | I/O suitability | Priority |
|---|---|---|---|---|---|
| **PostgreSQL** | One-time bulk | `sqlx` (existing) | None | Current behavior | Done |
| **PostgreSQL** | Watermark polling | `sqlx` (existing) | None (need `updated_at` col) | High — covers LIMS, access control | **Implement first** |
| **PostgreSQL** | CDC (pgoutput) | `pgwire-replication` 0.2.0 (MIT/Apache-2.0) | `wal_level=logical`, publication, replication slot, replication user | Medium — requires DBA changes; only worth it for near-real-time need | Design now, implement later |
| **MySQL/MariaDB** | One-time bulk | `mysql_async` (existing) | None | Current behavior | Done |
| **MySQL/MariaDB** | Watermark polling | `mysql_async` (existing) | None (need `updated_at` col) | High | **Implement first** |
| **MySQL/MariaDB** | CDC (binlog) | `mysql_cdc` 0.9.x (MIT) | `binlog_format=ROW`, replication user | Low-Medium — SSL gap; DBA setup; no SSL in `mysql_cdc` | Design now, implement later |
| **MSSQL** | One-time bulk | `tiberius` (existing) | None | Current behavior | Done |
| **MSSQL** | Watermark polling (`ROWVERSION`/`MODIFIEDON`) | `tiberius` (existing) | None | High — covers Maximo, SAP, PI AF | **Implement first** |
| **MSSQL** | Change Tracking polling (`CHANGETABLE`) | `tiberius` (existing) | CT enabled per table; `VIEW CHANGE TRACKING` grant | High — delivers deletes; no enterprise license required | **Implement alongside watermark** |
| **MSSQL** | Full CDC (`cdc.*` tables) | `tiberius` (existing) | SQL Agent + Enterprise edition + DBA enablement | Medium — more powerful but higher bar | Implement later |
| **ODBC** | One-time bulk | `odbc-api` (existing) | None | Current behavior | Done |
| **ODBC** | Watermark polling | `odbc-api` (existing) | None (need watermark col) | Medium — covers Oracle, DB2, legacy systems | **Implement first** |
| **ODBC** | CDC | Not viable | N/A | None | Skip |
| **MongoDB** | One-time bulk | `mongodb` (existing) | None | Current behavior | Done |
| **MongoDB** | Watermark polling (ObjectId / `updatedAt`) | `mongodb` (existing) | None | Medium | **Implement first** |
| **MongoDB** | CDC (change streams) | `mongodb` (existing) | Replica set required (not standalone) | Low-Medium — replica set requirement limits applicability | Design now, implement later |

### Summary of new Cargo dependencies required

For watermark-based polling (the recommended first-priority for all five DB types): **zero new dependencies**. All required crates are already in `Cargo.toml`.

For CDC (future work):
- PostgreSQL CDC: add `pgwire-replication = "0.2"` (MIT/Apache-2.0, crates.io-published).
- MySQL/MariaDB CDC: add `mysql_cdc = "0.9"` (MIT, crates.io-published). Note SSL limitation.
- SQL Server CDC: no new dependency (tiberius + T-SQL).
- MongoDB CDC: no new dependency (mongodb 3.x already supports change streams).
- ODBC/Oracle CDC: not feasible.

### The one-sentence recommendation per DB type

- **PostgreSQL**: Implement watermark polling now; design pgoutput CDC for a future phase when a near-real-time LIMS use case justifies it.
- **MySQL/MariaDB**: Implement watermark polling now; consider `mysql_cdc` binlog CDC only if the target has guaranteed `binlog_format=ROW` and no TLS requirement.
- **MSSQL**: Implement watermark polling AND Change Tracking polling now — they use the same tiberius connection and cover the widest range of industrial SQL Server deployments with no new dependencies.
- **ODBC**: Implement watermark polling with user-supplied parameterized query; document Oracle-specific SQL patterns.
- **MongoDB**: Implement ObjectId-based watermark polling now; change streams viable only for confirmed replica set deployments.

---

*Research conducted 2026-04-04. Crate versions as of crates.io at time of writing.*
