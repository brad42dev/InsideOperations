# Inside/Operations - Universal Import Interface

## 1. Overview

The Universal Import Interface is a configurable, no-code system that allows administrators to import data from any external system into the I/O database. It supports connections to databases, files, APIs, industrial protocols, messaging systems, and any other data source an organization may need to correlate with real-time point data.

### Purpose

OPC UA connectivity is the foundation of Inside/Operations -- everything else in the application revolves around point data. The Universal Import Interface extends this foundation by enabling administrators to bring in supplementary data from any external system and correlate it with point data. This includes:

- **ERP systems** (SAP, Oracle E-Business Suite, Microsoft Dynamics)
- **CMMS / Maintenance systems** (Maximo, SAP PM, Infor EAM)
- **Change management systems** (ServiceNow, BMC Remedy)
- **Historians** (AVEVA PI, Honeywell PHD, GE Proficy, AVEVA Historian)
- **Laboratory systems** (LIMS exports, lab result files)
- **Regulatory / compliance systems** (emissions monitoring, environmental reporting)
- **Databases** (PostgreSQL, MSSQL, MySQL, Oracle, and any ODBC-capable database)
- **File-based sources** (CSV, Excel, JSON, XML, Parquet)
- **APIs** (REST, GraphQL, SOAP, gRPC, webhooks)
- **Messaging systems** (Kafka, RabbitMQ, MQTT, NATS)
- **Unknown future systems** depending on the desired data correlation

The system is domain-agnostic: it handles any structured or semi-structured data that an administrator wants to import, not just industrial process data.

### Design Principles

1. **OPC is the anchor** -- All imported data correlates around the point model. Points come from OPC UA; everything else enriches, annotates, or extends point data.
2. **No-code configuration** -- Administrators configure imports through a wizard-based UI. No programming required for standard imports.
3. **Low-code extensibility** -- Rhai expressions handle complex transformations for power users, reusing the Expression Builder infrastructure.
4. **Single target database** -- All imports land in I/O's PostgreSQL database. This is not a general-purpose ETL platform.
5. **Build, don't integrate** -- Custom-built to ensure license compliance, architectural consistency, and tight integration with the I/O data model.
6. **Incremental by default** -- Watermark-based change detection avoids re-importing unchanged data.
7. **Safe by design** -- Preview, dry-run, and validation before committing data. Configurable error thresholds.

### QoS Service Tiers

The Import Service operates within a quality-of-service hierarchy that protects the real-time data path:

```
Priority   Service          Port   Purpose                    Latency Target
─────────────────────────────────────────────────────────────────────────────
Highest    OPC Service      3002   Real-time point data       < 2 seconds
Medium     Event Service    3003   Near-real-time events      < 30 seconds
Lowest     Import Service   3006   Batch/scheduled imports    Minutes to hours
```

These are three separate OS-level processes (systemd services). Resource isolation is enforced at the process level. The Import Service must never degrade the performance of the Event Service or OPC Service. If the server is under resource pressure, the Import Service is the first to be throttled or paused.

---

## 2. Architecture

### Service Placement

The Import Service is one of 11 Rust/Axum backend services in the I/O architecture, running on Port 3006.

```
┌─────────────────────────────────────────────────────────────────────┐
│                      NGINX (TLS, Reverse Proxy)                      │
└─────────────────────────────────────────────────────────────────────┘
                                │
          ┌─────────────────────┼─────────────────────┐
          │                     │                     │
          ▼                     ▼                     ▼
  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐
  │  Frontend    │    │ API Gateway  │    │  Data Broker │
  │  React SPA   │◄──►│  Rust/Axum   │    │   WebSocket  │
  │              │    │  Port 3000   │    │  Port 3001   │
  └──────────────┘    └──────────────┘    └──────────────┘
                            │                     ▲
                            ▼                     │
        ┌────────────────────────────────────────────────┐
        │        PostgreSQL 16 + TimescaleDB              │
        │   NOTIFY/LISTEN for inter-service events        │
        └────────────────────────────────────────────────┘
                            ▲
   ┌────────────────────────┼──────────────────────────────────────────┐
   │        │        │        │        │        │        │        │   │
┌──────┐┌──────┐┌──────┐┌──────┐┌════════════┐┌──────┐┌──────┐┌──────┐┌──────┐
│ OPC  ││Event ││Parser││Archiv││  IMPORT    ││Alert ││Email ││ Auth ││Recog.│
│ 3002 ││ 3003 ││ 3004 ││ 3005 ││   3006    ││ 3007 ││ 3008 ││ 3009 ││ 3010 │
│ HIGH ││MEDIUM││      ││      ││   LOW     ││ HIGH ││ LOW  ││      ││ LOW  │
└──────┘└──────┘└──────┘└──────┘└════════════┘└──────┘└──────┘└──────┘└──────┘
                                  │
                    ┌─────────────┼─────────────┐
                    │             │             │
                    ▼             ▼             ▼
             ┌───────────┐ ┌───────────┐ ┌───────────┐
             │ External  │ │ External  │ │ External  │
             │ Databases │ │ REST APIs │ │ Files     │
             └───────────┘ └───────────┘ └───────────┘
```

**Rationale for a separate service:**
- Import jobs are long-running (seconds to minutes). They must not block the API Gateway.
- Resource isolation prevents imports from impacting the real-time data path.
- Independent scaling: imports are bursty (many at night, few during the day).
- Consistent with the existing service-oriented architecture.

### Relationship to Other Services

| Concern | OPC Service | Event Service | Import Service |
|---|---|---|---|
| **QoS tier** | Highest | Medium | Lowest |
| **Data flow** | Continuous streaming | Near-real-time polling | Batch/scheduled |
| **Latency** | Sub-second | Seconds | Minutes to hours |
| **Protocol** | OPC UA (native subscription) | MSSQL (Tiberius) | Any (60+ connectors) |
| **Target tables** | points_current, points_history_raw | events, alarms | Any I/O table + custom_import_data |
| **Lifecycle** | Always-on connection | Always-on polling | Run-on-demand or scheduled |
| **Never merged** | Standalone | Standalone | Standalone |

The three services are architecturally independent and must never be merged. Each runs as its own systemd process with its own resource limits.

### Connector Architecture

All connectors implement a common Rust trait and are statically compiled into the Import Service binary:

```rust
#[async_trait]
pub trait ImportConnector: Send + Sync {
    /// Unique identifier for this connector type (e.g., "postgresql", "csv", "rest_json")
    fn connector_type(&self) -> &str;

    /// Test the connection with the given config. Returns Ok or error details.
    async fn test_connection(
        &self,
        config: &ConnectionConfig,
    ) -> Result<ConnectionTestResult>;

    /// Discover the schema of the remote source.
    /// Returns available tables/endpoints and their fields with data types.
    async fn discover_schema(
        &self,
        config: &ConnectionConfig,
        options: &DiscoveryOptions,
    ) -> Result<Vec<SourceSchema>>;

    /// Preview data: fetch a small sample for mapping validation.
    async fn preview_data(
        &self,
        config: &ConnectionConfig,
        query: &ImportQuery,
        limit: usize,
    ) -> Result<Vec<SourceRow>>;

    /// Execute the full data extraction. Returns a stream of row batches.
    async fn extract(
        &self,
        config: &ConnectionConfig,
        query: &ImportQuery,
        watermark: Option<&WatermarkState>,
    ) -> Result<Pin<Box<dyn Stream<Item = Result<RowBatch>> + Send>>>;
}

/// Source schema discovered from a remote system
pub struct SourceSchema {
    pub name: String,               // Table name, endpoint path, or file name
    pub fields: Vec<SourceField>,
}

pub struct SourceField {
    pub name: String,
    pub data_type: SourceDataType,
    pub nullable: bool,
    pub description: Option<String>,
}

/// A batch of rows from the source
pub struct RowBatch {
    pub rows: Vec<SourceRow>,
}

/// A single row of source data (column name → value)
pub type SourceRow = HashMap<String, SourceValue>;

/// Loosely typed source values before transformation
pub enum SourceValue {
    Null,
    Bool(bool),
    Int(i64),
    Float(f64),
    String(String),
    DateTime(chrono::DateTime<Utc>),
    Bytes(Vec<u8>),
}
```

**Why static compilation, not plugins?**
- Rust does not have a stable ABI. Dynamic plugin loading is fragile.
- For a known set of connector types, static compilation is simpler and safer.
- New connector types require a rebuild, acceptable given the systemd deployment model.
- All connectors compile into the single Import Service binary.

### Import Pipeline

Each import execution follows a linear pipeline:

```
Extract → Map → Transform → Validate → Load
   │        │        │           │         │
   │        │        │           │         └─► Target table (INSERT/UPSERT)
   │        │        │           └─► JSON Schema + cross-field rules
   │        │        └─► Built-in (Rust native) + custom (Rhai)
   │        └─► Source columns → target columns (JSONB config)
   └─► Connector-specific extraction (streamed in batches)

   At every stage:
   ├─► Success rows → next stage
   └─► Error rows → import_errors table (with original source data)
```

This is a linear chain, not an arbitrary DAG. Linear pipelines cover 95%+ of import use cases and are dramatically simpler to implement, configure, and debug than graph-based topologies.

### Inter-Service Communication

The Import Service communicates with other I/O services through PostgreSQL:

- **NOTIFY `import_status`**: Emitted when import runs start, complete, or fail. The API Gateway listens and can push status updates to the frontend via the Data Broker WebSocket.
- **NOTIFY `point_metadata_changed`**: Emitted when imports modify `points_metadata` (e.g., bulk point import from CSV). The OPC Service listens to update its subscription registry.
- **Direct table writes**: The Import Service writes directly to target tables (`points_metadata`, `events`, `custom_import_data`, etc.) using its own SQLx connection pool.
- **Shared functions**: Calls `upsert_point_from_source()` for point metadata imports, reusing the same idempotent logic as the OPC Service.

---

## 3. Connection Types

The Import Service supports 60+ connection types organized into 8 categories. Each connection type has specific configuration parameters, a Rust crate for implementation, and verified license compatibility.

### 3.1 Industrial Protocols

These connectors interface with industrial automation systems. Note: the OPC Service handles real-time OPC UA subscriptions. The Import Service handles batch/one-shot operations and non-OPC industrial protocols.

| Protocol | Description | Rust Crate | License | Approach |
|---|---|---|---|---|
| **OPC UA (metadata)** | Batch import of point metadata from OPC UA servers | `opcua` | MPL-2.0 | Browse service for metadata discovery (distinct from real-time subscriptions) |
| **OPC DA/HDA** | Legacy Windows-based industrial protocols | N/A | N/A | Not native; use OPC UA gateway/wrapper |
| **Modbus TCP** | Register-based communication with PLCs, RTUs, power meters | `tokio-modbus` | MIT/Apache-2.0 | Native async, poll-based |
| **Modbus RTU** | Serial variant of Modbus (RS-232/RS-485) | `tokio-modbus` | MIT/Apache-2.0 | Native via serial port |
| **MQTT** | Lightweight pub/sub messaging for IIoT | `rumqttc` | Apache-2.0 | Subscription-based consumer |
| **Sparkplug B** | Standardized IIoT payload format over MQTT | `rumqttc` + `prost` | Apache-2.0/MIT | Custom on MQTT + Protobuf |
| **DNP3** | Utility/SCADA protocol (IEEE 1815) | N/A (from-scratch, ~4 weeks minimal) | N/A | Deferred; OPC UA gateway workaround for now. Existing `dnp3` crate has commercial license. From-scratch implementation is feasible (IEEE 1815 is public) if market expands beyond refinery to power/water/pipeline. |
| **HART-IP** | Smart field instrument communication | N/A | N/A | Not native; access via Modbus/OPC multiplexers |
| **BACnet** | Building automation (ISO 16484-5) | `bacnet-rs` | Needs verification | Lower priority |
| **EtherNet/IP** | Allen-Bradley/Rockwell PLC communication | `rust-ethernet-ip` | Needs verification | Evaluate when needed |
| **PROFINET** | Siemens S7 PLC communication | N/A | N/A | Not native; use OPC UA (built into S7-1500) |

**Key insight**: Nearly all industrial protocols can be accessed via OPC UA gateways. Native support is only necessary where OPC UA gateways are unavailable or where direct access is significantly more practical (Modbus, MQTT).

### 3.2 Historians & SCADA Systems

These connectors access historical process data from vendor-specific historian platforms. Most historians expose data via OPC UA, SQL/ODBC, or REST APIs.

| System | Primary Integration | Rust Approach | Complexity |
|---|---|---|---|
| **AVEVA PI** (formerly OSIsoft) | PI Web API (REST/JSON) | `reqwest` + `serde_json` | Medium |
| **Honeywell PHD** | OPC HDA / OLE DB | OPC UA gateway or ODBC | Medium-High |
| **AVEVA Historian** (Wonderware InSQL) | SQL Server (InSQL OLE DB) | `tiberius` (native) | Medium |
| **GE Proficy** (GE Vernova) | REST API / OPC UA | `reqwest` or OPC UA | Medium-High |
| **Emerson DeltaV** | OPC UA (AspenTech IP.21) | OPC UA client | Medium |
| **Yokogawa Exaquantum** | SQL Server / OPC | `tiberius` or OPC UA | Medium |
| **AspenTech IP.21** | OPC UA / ODBC | OPC UA or `odbc-api` | Medium |
| **Siemens WinCC** | OPC UA (built-in) | OPC UA client | Medium |

**Common pattern**: Robust OPC UA Historical Access and generic SQL/ODBC connectors cover 80%+ of historian integration needs.

### 3.2.1 DCS Supplemental Connectors (domain: `dcs_supplemental`)

DCS supplemental connectors are a special subcategory of Import connections that fill gaps left by OPC UA. When a connected OPC UA server does not expose alarm limits, engineering units, alarm events, or tag descriptions via OPC UA Part 8/9/11, a supplemental connector fetches that data from the vendor's native REST or proprietary API.

**How they differ from general-purpose Import connectors:**

| Attribute | General Import Connector | DCS Supplemental Connector |
|---|---|---|
| `domain` | `maintenance`, `equipment`, etc. | `dcs_supplemental` |
| `is_supplemental_connector` | `false` | `true` |
| `point_source_id` | `NULL` | FK to `point_sources.id` |
| Configured via | Import wizard | Settings > Data Sources > [OPC Source] > Supplemental |
| Visible in Import list | Yes | Yes (labeled "Supplemental Point Data") |
| Runs independently | Yes | No — deferred if OPC source is inactive |

**Available connector types (DCS supplemental):**

DCS supplemental connectors use two existing connector types from the general Import module plus new vendor-specific REST types:

- **Custom REST connectors** (`pi_web_api`, `experion_rest`, etc.): Purpose-built `ImportConnector` implementations using `reqwest` for vendors with documented HTTP/JSON APIs.
- **`mssql` connector** (existing): DeltaV's Event Chronicle, ABB 800xA's EventArchiveView, and Yokogawa's historian all run on SQL Server. The existing `mssql` connector (tiberius crate) connects directly from Linux on port 1433 — no Windows dependency. Pre-built `dcs_supplemental` templates ship with I/O for the standard table structures.
- **`odbc` connector** (existing): For any remaining ODBC-capable DCS system; `odbc-api` crate with `spawn_blocking`, unixODBC on Linux.

| Connector Type | Vendor | Implementation | Data Provided | Notes |
|---|---|---|---|---|
| `pi_web_api` | AVEVA/OSIsoft PI | Custom REST | Metadata, EU, limits, history, alarm event frames | Primary PI path (no OPC UA server) |
| `experion_rest` | Honeywell Experion PKS R500+ | Custom REST | Full metadata, alarm limits, alarm history, trends | EPDOC API at `:58080/epdoc/api/v1`; Basic/NTLM |
| `siemens_sph_rest` | Siemens SIMATIC Process Historian 2019+ | Custom REST | Tag metadata, history, aggregates, alarm history | SPH REST at `:18732/api/v1`; Windows/NTLM |
| `wincc_oa_rest` | Siemens WinCC OA 3.18+ | Custom REST | Tag metadata, history, alarm history | WinCC OA REST at `:4999/rest/v1`; Basic/API key |
| `s800xa_rest` | ABB 800xA + Information Manager 3.5+ | Custom REST | Tag metadata, history, alarm/event records | ABB IM REST at `/abb-im-api/v1/`; API key/Windows |
| `kepware_rest` | PTC Kepware KEPServerEX 6.x | Custom REST | Tag EU, description, high/low EU (config view) | Config API `:57412` + IoT GW `:39320`; Basic |
| `canary_rest` | Canary Labs Historian 22+ | Custom REST | Tag metadata, current values, history | REST at `:55236/api/v1`; Bearer token |
| `mssql` | DeltaV, ABB 800xA (brownfield), Yokogawa | Existing | Alarm history, tag metadata from SQL Server | Pre-built `dcs_supplemental` templates; port 1433 |
| `odbc` | Any ODBC-capable DCS/historian | Existing | Admin-configured SQL queries | unixODBC on Linux; `spawn_blocking` |

> **Ignition SCADA** does not need a supplemental connector — connect directly to Ignition's built-in OPC UA server.

> **DeltaV** has no native REST API, but its Event Chronicle and module configuration databases are SQL Server — use the `mssql` connector type directly from Linux.

All DCS supplemental connectors implement the standard `ImportConnector` trait. The `point_source_id` FK tells the Import Service which OPC source's gaps to fill. On each run, the connector only writes values that are still `NULL` in `points_metadata` — it does not overwrite OPC UA-sourced data.

**PI Web API connector (`pi_web_api`):**

Since PI has no native OPC UA server, all PI integration uses PI Web API. This connector is the primary integration path for PI, not a fallback.

| PI Web API Endpoint | I/O Usage | Target |
|---|---|---|
| `GET /piwebapi/points?path=\\server\tag` | Point discovery: descriptor, EU, zero, span | `points_metadata` |
| `GET /piwebapi/elements/{webid}/attributes` | AF attributes including alarm limit setpoints | `points_metadata` alarm limit columns |
| `GET /piwebapi/streams/{webid}/value` | Current value | `points_current` |
| `GET /piwebapi/streams/{webid}/recorded?startTime=...&endTime=...` | Raw historical values | `points_history_raw` |
| `GET /piwebapi/assetdatabases/{id}/eventframes?templateName=Alarm&startTime=...&searchMode=Overlapped` | Alarm lifecycle records | `events` |
| `POST /piwebapi/batch` | Bulk queries (up to 1000 sub-requests) | All of the above |

Auth: Kerberos (preferred for Windows domain — no password over wire), Basic (HTTPS only), or OAuth2/Bearer (PI Web API 2019+ with AD FS). Credentials stored encrypted via standard Import connection `auth_config`.

### 3.3 Database Connections

The Import Service uses a hybrid driver strategy: **native async drivers** for the 4 most common databases (best performance), with **ODBC as a fallback** for all others.

#### Native Drivers (Async, High Performance)

| Database | Rust Crate | License | Async | Notes |
|---|---|---|---|---|
| **PostgreSQL** | `sqlx` | MIT/Apache-2.0 | Yes | Already in project; covers external PG instances |
| **Microsoft SQL Server** | `tiberius` | MIT/Apache-2.0 | Yes | Already in project; covers historians and enterprise DBs |
| **MySQL / MariaDB** | `sqlx` (mysql feature) | MIT/Apache-2.0 | Yes | Pure Rust, no client library needed |
| **Oracle** | `oracle` | UPL-1.0/Apache-2.0 | No (sync) | Requires Oracle Instant Client; use `spawn_blocking` |

#### ODBC Fallback (Universal)

| Database | Rust Crate | License | Notes |
|---|---|---|---|
| **Any ODBC-capable DB** | `odbc-api` | MIT | Covers Access, Informix, DB2, Teradata, Snowflake, etc. |

ODBC operations are synchronous and must be wrapped in `tokio::task::spawn_blocking()`. Row batches are streamed from the blocking task to the async pipeline via `tokio::sync::mpsc` channels.

#### Specialty Databases

| Database | Rust Crate | License | Async | Typical Use |
|---|---|---|---|---|
| **SQLite** | `sqlx` / `rusqlite` | MIT/Apache-2.0 | Yes/No | Portable data exchange, embedded device data |
| **MongoDB** | `mongodb` | Apache-2.0 | Yes | IoT platforms, custom applications |
| **InfluxDB** | `influxdb2` | MIT | Yes | Time-series from IoT monitoring systems |
| **Redis** | `redis` | BSD-3-Clause | Yes | Cache data, real-time state |
| **Elasticsearch** | `elasticsearch` | Apache-2.0 | Yes | Log aggregation, event correlation |
| **Microsoft Access** | `odbc-api` (ODBC) | MIT | Via blocking | Legacy equipment lists, calibration records |

**Schema discovery** for SQL databases uses `information_schema` queries (or equivalent per database). ODBC provides standardized metadata functions (`SQLTables`, `SQLColumns`).

### 3.4 File-Based Sources

| Format | Rust Crate | License | Complexity | Notes |
|---|---|---|---|---|
| **CSV** | `csv` | MIT/Unlicense | Low | Configurable delimiter, encoding, headers |
| **TSV** | `csv` (tab delimiter) | MIT/Unlicense | Low | Same crate, different config |
| **Excel (.xlsx/.xls/.xlsb/.ods)** | `calamine` | MIT | Low-Medium | Read-only, sheet selection, header detection |
| **JSON** | `serde_json` | MIT/Apache-2.0 | Low | JSONPath for nested data extraction |
| **NDJSON** (newline-delimited) | `serde_json` | MIT/Apache-2.0 | Low | Line-by-line streaming |
| **XML** | `quick-xml` | MIT | Medium | XPath-like extraction, namespace handling |
| **Apache Parquet** | `parquet` (arrow-rs) | Apache-2.0 | Low-Medium | Columnar, self-describing, efficient |
| **Apache Arrow IPC** | `arrow` | Apache-2.0 | Low | Zero-copy data exchange |
| **Fixed-width text** | `nom` | MIT | Medium | Column positions defined in config |
| **Log files** (syslog, custom) | `nom` / `regex` | MIT/Apache-2.0 | Medium-High | Configurable parse patterns |
| **PDF (tabular)** | `lopdf` | MIT | Very High | Future; consider external extraction service |

**Schema inference** for file sources: Read the first N rows (configurable, default 100) and infer column types by attempting to parse as integer → float → timestamp → boolean → string. Present the inferred schema to the user for review and correction.

### 3.5 API & Web Protocols

| Protocol | Rust Crate | License | Complexity | Notes |
|---|---|---|---|---|
| **REST (JSON)** | `reqwest` + `serde_json` | MIT/Apache-2.0 | Low-Medium | Pagination, rate limiting, path extraction |
| **REST (XML)** | `reqwest` + `quick-xml` | MIT | Medium | SOAP-like responses |
| **GraphQL** | `graphql_client` / `cynic` | MIT/Apache-2.0 | Medium | Schema-aware queries |
| **SOAP / WSDL** | `quick-xml` + `reqwest` | MIT | High | XML template approach; full WSDL auto-discovery deferred |
| **gRPC** | `tonic` + `prost` | MIT | Medium-High | Requires .proto file or service reflection |
| **Webhooks (incoming)** | Axum (built-in) | N/A | Low-Medium | Push from external systems; registration, HMAC validation |
| **WebSocket client** | `tokio-tungstenite` | MIT/Apache-2.0 | Medium | Persistent streaming connections |
| **RSS/Atom feeds** | `feed-rs` | MIT | Low | Regulatory updates, vendor advisories |

**REST API configuration** includes: base URL, HTTP method, authentication (see Section 4), headers, query parameters, request body template, response JSONPath for data extraction, pagination strategy (offset/cursor/link-header), rate limit, timeout, and retry policy.

### 3.6 File Transfer Protocols

| Protocol | Rust Crate | License | Notes |
|---|---|---|---|
| **SFTP** | `ssh2` / `russh-sftp` | MIT/Apache-2.0 | Retrieve files from remote servers |
| **FTP / FTPS** | `suppaftp` | Apache-2.0 | Legacy file servers |
| **SMB/CIFS** (Windows shares) | `pavao` (Linux) / `windows-rs` (Windows) | MIT | Network share access |
| **NFS** | OS-level mount | N/A | Appears as local filesystem |
| **S3-compatible storage** | `object_store` | Apache-2.0 | AWS S3, MinIO, Ceph, DigitalOcean Spaces |
| **Email / IMAP** | `async-imap` + `mail-parser` | MIT/Apache-2.0 | Extract attachments from automated report emails |

File transfer connectors retrieve files from remote locations, then hand off to the appropriate file-based source connector (CSV, Excel, JSON, etc.) for parsing.

### 3.7 Messaging Systems

| System | Rust Crate | License | Notes |
|---|---|---|---|
| **Apache Kafka** | `rdkafka` | MIT (crate), BSD-2 (librdkafka) | Consumer groups, offset tracking, Avro/Protobuf deserialization |
| **RabbitMQ / AMQP** | `lapin` | MIT | Queue consumption, routing, prefetch |
| **NATS** | `async-nats` | Apache-2.0 | JetStream persistent subscriptions |
| **ZeroMQ** | `zeromq` | MIT/Apache-2.0 | Pure Rust; SUB/PULL patterns |

Messaging connectors operate as continuous consumers. They process messages as they arrive rather than on a schedule.

### 3.8 Identity & Directory Services

These are primarily relevant for authenticating the Import Service against external systems that require domain credentials.

| Service | Rust Crate | License | Notes |
|---|---|---|---|
| **LDAP / Active Directory** | `ldap3` | MIT/Apache-2.0 | User/group lookup, bind authentication |
| **Kerberos** | `sspi-rs` / `windows-rs` | MIT/Apache-2.0 | Windows Integrated Authentication for MSSQL, PI Web API |
| **SAML 2.0** | `samael` | MIT | Enterprise SSO (deferred) |
| **OIDC / OAuth 2.0** | `openidconnect` / `oauth2` | MIT/Apache-2.0 | Token-based API authentication |

---

## 4. Authentication Mechanisms

Each import connection specifies an authentication method. The Import Service supports 14 authentication types to cover the full range of external systems.

| Auth Method | Config Parameters | Common Use Cases |
|---|---|---|
| **No Auth** | None | Local files, trusted internal services |
| **Basic Auth** | username, password | Legacy REST APIs, some SFTP/FTP servers |
| **API Key (Header)** | header_name, key_value | Modern REST APIs, cloud services |
| **API Key (Query)** | param_name, key_value | Some legacy APIs |
| **Bearer Token (Static)** | token_value | Service accounts, long-lived tokens |
| **OAuth 2.0 Client Credentials** | token_url, client_id, client_secret, scope | Cloud APIs, machine-to-machine auth |
| **OAuth 2.0 Authorization Code** | auth_url, token_url, client_id, client_secret, redirect_uri, scope | APIs requiring user-delegated access |
| **OAuth 2.0 + PKCE** | Same as auth code + code_verifier | Public clients, enhanced security |
| **Certificate (mTLS)** | ca_cert_path, client_cert_path, client_key_path, key_passphrase | OPC UA, high-security APIs |
| **Kerberos / SPNEGO** | keytab_path or credential_cache, service_principal | PI Web API, MSSQL, Windows services |
| **NTLM** | domain, username, password | Older Windows services, legacy APIs |
| **SSH Key** | key_file_path, key_passphrase, known_hosts_file | SFTP connections |
| **Database Auth** | connection_string, username, password (format varies) | Direct database connections |
| **Custom Token Exchange** | login_url, credential_fields, token_extraction_path, token_header | Proprietary API authentication flows |

### Credential Storage

Credentials are stored in `import_connections.connection_config` JSONB, **encrypted at the application layer** (AES-256-GCM) before writing to the database. This follows the same pattern used by `point_sources.connection_config` for OPC UA credentials.

- **Encryption key**: The application master key (delivered via systemd encrypted credentials, see doc 03) encrypts credential fields. The key is never stored in the database or in plaintext on disk.
- **API responses**: Never return decrypted credentials (masked with `****`)
- **Decryption**: Only occurs internally during connection test and import execution
- **Audit logging**: All credential access (create, update, test) logged to `audit_log`
- **Key rotation**: Credentials can be updated without recreating the import definition

---

## 5. Database Schema

All tables follow the conventions established in `04_DATABASE_DESIGN.md`: UUID primary keys, `gen_random_uuid()`, `TIMESTAMPTZ`, `VARCHAR` with `CHECK` constraints (no PostgreSQL ENUMs), `ON DELETE RESTRICT` for critical foreign keys, and `update_updated_at_column()` / `log_audit_trail()` triggers.

### Import Tables

```sql
-- ============================================================
-- CONNECTOR TEMPLATES: Pre-built import definitions for known applications
-- ============================================================
CREATE TABLE connector_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug VARCHAR(100) UNIQUE NOT NULL,          -- 'servicenow-itsm', 'sap-pm-work-orders'
    name VARCHAR(200) NOT NULL,                 -- 'ServiceNow ITSM'
    domain VARCHAR(50) NOT NULL
        CHECK (domain IN (
            'maintenance', 'equipment', 'access_control', 'erp_financial',
            'ticketing', 'environmental', 'lims_lab', 'regulatory',
            'dcs_supplemental'  -- Supplemental point data connectors linked to OPC UA sources
        )),
    vendor VARCHAR(100) NOT NULL,               -- 'ServiceNow', 'SAP', 'IBM'
    description TEXT,
    template_config JSONB NOT NULL,             -- Complete pre-built import definition (with {{placeholders}})
    required_fields JSONB NOT NULL,             -- Array of fields the user must fill in
    -- [{key, label, placeholder, help, type: "text"|"secret"|"number"|"select"}]
    target_tables TEXT[] NOT NULL,              -- I/O tables this template populates
    version VARCHAR(20) NOT NULL DEFAULT '1.0',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_connector_templates_domain ON connector_templates(domain);
CREATE INDEX idx_connector_templates_vendor ON connector_templates(vendor);

-- ============================================================
-- IMPORT CONNECTIONS: Reusable connection configurations
-- ============================================================
CREATE TABLE import_connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    connector_type VARCHAR(50) NOT NULL
        CHECK (connector_type IN (
            -- Database (native)
            'postgresql', 'mssql', 'mysql', 'oracle',
            -- Database (ODBC fallback)
            'odbc',
            -- File-based
            'csv', 'excel', 'json', 'xml', 'parquet', 'ndjson', 'fixed_width',
            -- API
            'rest_json', 'rest_xml', 'graphql', 'soap', 'grpc', 'webhook', 'websocket',
            -- Industrial
            'opc_ua_browse', 'modbus_tcp', 'modbus_rtu', 'mqtt', 'sparkplug_b',
            -- DCS supplemental REST connectors (linked to point_sources via point_source_id; is_supplemental_connector=true)
            -- DeltaV/ABB brownfield/Yokogawa use existing 'mssql' or 'odbc' types above with dcs_supplemental templates
            'pi_web_api', 'experion_rest', 'siemens_sph_rest', 'wincc_oa_rest', 's800xa_rest', 'kepware_rest', 'canary_rest',
            -- File transfer
            'sftp', 'ftp', 'smb', 's3', 'email_imap',
            -- Messaging
            'kafka', 'rabbitmq', 'nats', 'zeromq',
            -- Identity
            'ldap'
        )),
    auth_type VARCHAR(30) NOT NULL DEFAULT 'none'
        CHECK (auth_type IN (
            'none', 'basic', 'api_key_header', 'api_key_query', 'bearer_token',
            'oauth2_client_credentials', 'oauth2_authorization_code', 'oauth2_pkce',
            'certificate_mtls', 'kerberos', 'ntlm', 'ssh_key',
            'database_auth', 'custom_token'
        )),
    connection_config JSONB NOT NULL DEFAULT '{}',
    -- Connection parameters vary by connector_type (host, port, database, base_url, etc.)
    -- Credentials within this JSONB are AES-256-GCM encrypted by the application layer

    -- DCS supplemental connector linkage (NULL for general-purpose connectors)
    point_source_id UUID REFERENCES point_sources(id) ON DELETE SET NULL,
    -- When true, this connection supplements an OPC UA source rather than performing
    -- a general-purpose import. Displayed as "Supplemental Point Data" in the UI.
    -- Configured via Settings > Data Sources, not the Import wizard.
    is_supplemental_connector BOOLEAN NOT NULL DEFAULT false,

    status VARCHAR(20) NOT NULL DEFAULT 'untested'
        CHECK (status IN ('untested', 'connected', 'error', 'disabled')),
    last_connected_at TIMESTAMPTZ,
    last_error_at TIMESTAMPTZ,
    last_error_message TEXT,

    enabled BOOLEAN NOT NULL DEFAULT true,
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_import_connections_name UNIQUE (name),
    -- A supplemental connector must reference an OPC source
    CONSTRAINT chk_supplemental_has_source
        CHECK (NOT is_supplemental_connector OR point_source_id IS NOT NULL)
);

-- ============================================================
-- IMPORT DEFINITIONS: What to import and how to map/transform it
-- ============================================================
CREATE TABLE import_definitions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    connection_id UUID NOT NULL REFERENCES import_connections(id) ON DELETE RESTRICT,

    -- Source configuration (connector-specific query/path/topic)
    source_config JSONB NOT NULL DEFAULT '{}',
    -- Database: {query, table, schema, mode: "query"|"table"}
    -- CSV/Excel: {delimiter, has_header, encoding, date_format, sheet_name}
    -- REST: {endpoint, method, params, json_path, pagination}
    -- MQTT/Kafka: {topic, consumer_group, offset_reset}

    -- Target configuration
    target_table VARCHAR(100) NOT NULL,
    target_mode VARCHAR(20) NOT NULL DEFAULT 'insert'
        CHECK (target_mode IN ('insert', 'upsert', 'replace')),
    upsert_key_columns TEXT[],

    -- Field mappings (array of mapping objects)
    field_mappings JSONB NOT NULL DEFAULT '[]',

    -- Transformation pipeline (ordered steps)
    transform_pipeline JSONB NOT NULL DEFAULT '{"steps": []}',

    -- Validation configuration
    validation_schema JSONB,          -- JSON Schema for row validation
    cross_field_rules JSONB,          -- Rhai expressions for cross-field validation

    -- Import behavior
    batch_size INTEGER NOT NULL DEFAULT 500,
    error_strategy VARCHAR(20) NOT NULL DEFAULT 'quarantine'
        CHECK (error_strategy IN ('stop', 'skip', 'quarantine', 'threshold')),
    error_threshold INTEGER,          -- NULL = unlimited; stop after N errors
    dry_run_default BOOLEAN NOT NULL DEFAULT false,

    -- Incremental import (watermark)
    watermark_enabled BOOLEAN NOT NULL DEFAULT false,
    watermark_column VARCHAR(255),
    watermark_state JSONB,            -- {last_value: "2024-01-15T10:30:00Z"} or {last_id: 12345}

    -- Template provenance (NULL if created manually)
    template_id UUID REFERENCES connector_templates(id) ON DELETE SET NULL,
    template_version VARCHAR(20),     -- Version of template used to create this definition

    -- Metadata
    enabled BOOLEAN NOT NULL DEFAULT true,
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_import_definitions_name UNIQUE (name)
);

-- ============================================================
-- IMPORT SCHEDULES: When to run imports automatically
-- ============================================================
CREATE TABLE import_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    definition_id UUID NOT NULL REFERENCES import_definitions(id) ON DELETE CASCADE,

    schedule_type VARCHAR(20) NOT NULL DEFAULT 'cron'
        CHECK (schedule_type IN ('cron', 'interval', 'file_arrival', 'webhook', 'dependency')),
    cron_expression VARCHAR(100),            -- e.g., "0 */15 * * * *"
    interval_seconds INTEGER,                -- for interval-based schedules
    watch_path VARCHAR(500),                 -- for file_arrival schedules
    watch_pattern VARCHAR(255),              -- glob pattern for file_arrival (e.g., "*.csv")
    depends_on_definition_id UUID REFERENCES import_definitions(id),  -- for dependency chain

    timezone VARCHAR(50) NOT NULL DEFAULT 'UTC',
    enabled BOOLEAN NOT NULL DEFAULT true,
    next_run_at TIMESTAMPTZ,
    running BOOLEAN NOT NULL DEFAULT false,
    last_heartbeat_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_import_schedules_definition UNIQUE (definition_id)
);

-- ============================================================
-- IMPORT RUNS: History of each import execution
-- ============================================================
CREATE TABLE import_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    definition_id UUID NOT NULL REFERENCES import_definitions(id) ON DELETE CASCADE,
    schedule_id UUID REFERENCES import_schedules(id) ON DELETE SET NULL,

    status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (status IN (
            'pending', 'running', 'completed', 'completed_with_errors',
            'failed', 'cancelled', 'dry_run'
        )),
    triggered_by VARCHAR(50) NOT NULL,       -- 'manual', 'schedule', 'file_arrival', 'webhook', 'dependency:<uuid>'
    triggered_by_user_id UUID REFERENCES users(id),

    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,

    -- Row counts
    rows_extracted INTEGER DEFAULT 0,
    rows_transformed INTEGER DEFAULT 0,
    rows_loaded INTEGER DEFAULT 0,
    rows_skipped INTEGER DEFAULT 0,
    rows_errored INTEGER DEFAULT 0,

    -- Top-level error (if entire run failed)
    error_message TEXT,

    -- Watermark tracking
    watermark_state_before JSONB,
    watermark_state_after JSONB,

    -- Timing breakdown
    extract_duration_ms INTEGER,
    transform_duration_ms INTEGER,
    validate_duration_ms INTEGER,
    load_duration_ms INTEGER,
    total_duration_ms INTEGER,

    -- Source metadata (file name, query used, etc.)
    source_metadata JSONB,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- IMPORT ERRORS: Per-row error details
-- ============================================================
CREATE TABLE import_errors (
    id BIGSERIAL PRIMARY KEY,
    run_id UUID NOT NULL REFERENCES import_runs(id) ON DELETE CASCADE,
    row_number INTEGER NOT NULL,
    source_data JSONB,                       -- Original source row (preserved for triage)
    error_type VARCHAR(50) NOT NULL
        CHECK (error_type IN (
            'validation', 'transformation', 'type_cast',
            'constraint', 'duplicate', 'referential', 'unknown'
        )),
    field_name VARCHAR(255),
    error_message TEXT NOT NULL,
    severity VARCHAR(20) NOT NULL DEFAULT 'error'
        CHECK (severity IN ('error', 'warning')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- CUSTOM IMPORT DATA: Generic table for imported reference data
-- ============================================================
CREATE TABLE custom_import_data (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    import_definition_id UUID NOT NULL REFERENCES import_definitions(id) ON DELETE RESTRICT,
    category VARCHAR(100) NOT NULL,          -- Admin-defined category (e.g., "equipment_list", "maintenance_schedule")
    data JSONB NOT NULL,                     -- The imported row as JSONB
    source_key VARCHAR(255),                 -- Optional dedup key from source
    imported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    import_run_id UUID REFERENCES import_runs(id) ON DELETE SET NULL,
    CONSTRAINT uq_custom_import_data_key UNIQUE (import_definition_id, source_key)
);
```

### Indexes

```sql
-- import_connections
CREATE INDEX idx_import_connections_type ON import_connections(connector_type);
CREATE INDEX idx_import_connections_enabled ON import_connections(enabled) WHERE enabled = true;
CREATE INDEX idx_import_connections_point_source ON import_connections(point_source_id) WHERE point_source_id IS NOT NULL;
CREATE INDEX idx_import_connections_supplemental ON import_connections(is_supplemental_connector) WHERE is_supplemental_connector = true;

-- import_definitions
CREATE INDEX idx_import_definitions_connection ON import_definitions(connection_id);
CREATE INDEX idx_import_definitions_enabled ON import_definitions(enabled) WHERE enabled = true;
CREATE INDEX idx_import_definitions_target ON import_definitions(target_table);

-- import_schedules
CREATE INDEX idx_import_schedules_next_run ON import_schedules(next_run_at)
    WHERE enabled = true AND running = false;
CREATE INDEX idx_import_schedules_definition ON import_schedules(definition_id);

-- import_runs
CREATE INDEX idx_import_runs_definition ON import_runs(definition_id);
CREATE INDEX idx_import_runs_status ON import_runs(status);
CREATE INDEX idx_import_runs_started_at ON import_runs(started_at DESC);
CREATE INDEX idx_import_runs_definition_started ON import_runs(definition_id, started_at DESC);

-- import_errors
CREATE INDEX idx_import_errors_run ON import_errors(run_id);
CREATE INDEX idx_import_errors_type ON import_errors(error_type);

-- custom_import_data
CREATE INDEX idx_custom_import_data_definition ON custom_import_data(import_definition_id);
CREATE INDEX idx_custom_import_data_category ON custom_import_data(category);
CREATE INDEX idx_custom_import_data_imported ON custom_import_data(imported_at DESC);
```

### Triggers

```sql
-- updated_at triggers
CREATE TRIGGER trg_import_connections_updated_at
    BEFORE UPDATE ON import_connections
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_import_definitions_updated_at
    BEFORE UPDATE ON import_definitions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_import_schedules_updated_at
    BEFORE UPDATE ON import_schedules
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Audit triggers (on config tables only, NOT on hot-path tables)
CREATE TRIGGER trg_audit_import_connections
    AFTER INSERT OR UPDATE OR DELETE ON import_connections
    FOR EACH ROW EXECUTE FUNCTION log_audit_trail();

CREATE TRIGGER trg_audit_import_definitions
    AFTER INSERT OR UPDATE OR DELETE ON import_definitions
    FOR EACH ROW EXECUTE FUNCTION log_audit_trail();
```

**Note**: No audit triggers on `import_runs`, `import_errors`, or `custom_import_data`. These are high-write tables and auditing them would create excessive overhead. The `import_runs` table is itself an audit trail of import operations.

---

## 5b. Integration Data Tables — Typed Target Architecture

### Design Decision

All imported data from external systems targets **typed internal tables** with uniform schemas, regardless of the source system. Universal Import handles all source-to-schema transforms. Application code only reads from I/O's own well-defined tables — zero awareness of source systems.

This replaces the original three-level approach (raw JSONB → template-mapped JSONB → typed table promotion). Every data domain gets a typed table from day one.

### Architecture

```
External System (SAP, Maximo, ServiceNow, CSV, ...)
        │
        ▼
┌─────────────────────────────────────────────┐
│        Universal Import Service              │
│  ┌───────────┐  ┌──────────┐  ┌───────────┐ │
│  │ Connector │→ │ Transform│→ │ Validator  │ │
│  │ (Extract) │  │ (Map)    │  │ (Schema)   │ │
│  └───────────┘  └──────────┘  └───────────┘ │
└─────────────────────┬───────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────┐
│           I/O Typed Internal Tables          │
│                                              │
│  ┌──────────────┐  ┌──────────────────────┐ │
│  │ work_orders  │  │ equipment            │ │
│  │ tickets      │  │ equipment_points     │ │
│  │ lab_samples  │  │ lab_results          │ │
│  │ emissions    │  │ permits              │ │
│  │ moc_records  │  │ safety_incidents     │ │
│  │ inspections  │  │ spare_parts          │ │
│  │ ...          │  │ ...                  │ │
│  └──────────────┘  └──────────────────────┘ │
│                                              │
│  ┌──────────────────────────────────────┐   │
│  │ custom_import_data (JSONB fallback)  │   │
│  │ For truly unknown data types only    │   │
│  └──────────────────────────────────────┘   │
└─────────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────┐
│     Application Code (read-only consumer)    │
│  Console, Dashboards, Forensics, Reports...  │
│  Only knows I/O schemas. Never source schemas│
└─────────────────────────────────────────────┘
```

### Benefits

1. **App code simplicity**: Query `work_orders WHERE status = 'open'` regardless of whether data came from SAP PM, IBM Maximo, or a CSV upload.
2. **Uniform indexing**: Every typed table has proper indexes, foreign keys, and constraints. JSONB can't match this for query performance.
3. **Cross-domain joins**: Equipment + work orders + lab results + events can be joined through typed foreign keys, not JSONB path queries.
4. **Schema validation at import**: Type errors are caught during import, not at query time.
5. **Reporting consistency**: Canned reports and dashboards can be built against stable schemas.

### The `extra_data` Pattern

Every typed integration table includes a `extra_data JSONB` column for source-specific fields that don't map to the standard schema. This preserves all source data without bloating the typed columns:

```sql
-- Example: work_orders table
-- Standard columns: id, external_id, title, status, priority, ...
-- Source-specific overflow:
extra_data JSONB NOT NULL DEFAULT '{}'
-- SAP might store: {"order_type": "PM02", "system_status": "REL MANC", "user_status": "INPR"}
-- Maximo might store: {"pluspcustomer": "ACME", "origrecordid": "SR-1234"}
```

`extra_data` is queryable via JSONB operators but is NOT indexed by default. If a site consistently needs a specific extra field, the admin can add a GIN index on that path.

### Data Domains and Their Typed Tables

Each data domain has one or more typed tables. Full DDL is in `04_DATABASE_DESIGN.md`. Connector-specific profiles (field mappings, API endpoints, transform rules) are in the `24_integrations/` subfolder.

| Domain | Typed Tables | Subfolder | Apps Profiled |
|--------|-------------|-----------|---------------|
| **Maintenance / CMMS** | `work_orders`, `spare_parts`, `pm_schedules` | `24_integrations/maintenance/` | SAP PM, IBM Maximo, HxGN EAM, Oracle eAM, eMaint/Fiix |
| **Equipment Registry** | `equipment`, `equipment_points`, `equipment_nameplate`, `equipment_criticality` | `24_integrations/equipment/` | SAP PM, IBM Maximo, Hexagon SPF, AVEVA AIM, GE APM |
| **Access Control** | `badge_events`, `presence_status` (already in Doc 30) | `24_integrations/access-control/` | Lenel OnGuard, C-CURE 9000, Genetec, Honeywell Pro-Watch, Gallagher |
| **ERP / Financial** | `inventory_items`, `purchase_orders`, `purchase_order_lines`, `vendor_master`, `cost_centers` | `24_integrations/erp-financial/` | SAP S/4HANA, Oracle Fusion/EBS, Infor CloudSuite, Dynamics 365, Hitachi Ellipse |
| **Ticketing / ITSM** | `tickets`, `ticket_comments` | `24_integrations/ticketing/` | ServiceNow, BMC Helix, Jira SM, ManageEngine, Ivanti |
| **Environmental** | `emissions_events`, `compliance_records`, `ambient_monitoring`, `ldar_records`, `permits`, `waste_manifests` | `24_integrations/environmental/` | Cority, Intelex, Sphera, Enablon, SAP EHS |
| **LIMS / Lab** | `lab_samples`, `lab_results`, `product_specifications`, `sample_points` | `24_integrations/lims-lab/` | SampleManager, LabWare, STARLIMS, LabVantage, Siemens Opcenter |
| **Regulatory / Compliance** | `moc_records`, `safety_incidents`, `inspection_findings`, `regulatory_permits`, `risk_assessments` | `24_integrations/regulatory/` | Sphera, Intelex, Enablon, SAP EHS, Cority |

### Equipment as the Cross-Domain Join Key

The `equipment` table is the Rosetta Stone that connects all other domains. Every typed integration table that references physical equipment includes an `equipment_id` foreign key:

```
equipment ←── work_orders.equipment_id
equipment ←── lab_samples.equipment_id
equipment ←── tickets.equipment_id (nullable)
equipment ←── inspection_findings.equipment_id
equipment ←── points_metadata (via equipment_points junction)
equipment ←── round_templates (via checkpoint equipment references)
equipment ←── events (via point_id → equipment_points)
```

Equipment records can be:
- **Imported from CMMS** (primary path) — via Universal Import from SAP PM, Maximo, etc.
- **Auto-seeded from OPC tags** — parse tag prefixes to create stub equipment records
- **Manually entered** — lightweight internal registry for sites without a CMMS

The `data_source` column tracks origin: `'imported'` (read-only except I/O-specific fields) vs `'manual'` (fully editable).

### Connector Profile Files

Each application-specific connector profile is a standalone Markdown file in the `24_integrations/` subfolder, organized by domain. Each file specifies:

1. **Application overview** — Vendor, version, market position, licensing
2. **API surface** — REST endpoints, authentication, pagination, rate limits
3. **Field mapping** — Source fields → I/O typed table columns, with transform rules
4. **Sync strategy** — Polling interval, watermark column, incremental vs full sync
5. **Pre-built import definition** — Ready-to-use JSONB config for the import wizard

See [Integration Connector Index](#integration-connector-index) for the full list.

### Integration Connector Index

```
24_integrations/
├── maintenance/
│   ├── sap-pm.md
│   ├── ibm-maximo.md
│   ├── hxgn-eam.md
│   ├── oracle-eam.md
│   └── emaint-fiix.md
├── equipment/
│   ├── sap-pm.md
│   ├── ibm-maximo.md
│   ├── hexagon-spf.md
│   ├── aveva-aim.md
│   └── ge-apm.md
├── access-control/
│   ├── lenel-onguard.md
│   ├── ccure-9000.md
│   ├── genetec-security-center.md
│   ├── honeywell-prowatch.md
│   └── gallagher-command-centre.md
├── erp-financial/
│   ├── sap-s4hana.md
│   ├── oracle-fusion-ebs.md
│   ├── infor-cloudsuite.md
│   ├── microsoft-dynamics-365.md
│   └── hitachi-ellipse.md
├── ticketing/
│   ├── servicenow.md
│   ├── bmc-helix.md
│   ├── jira-service-management.md
│   ├── manageengine-servicedesk.md
│   └── ivanti-neurons.md
├── environmental/
│   ├── cority.md
│   ├── intelex.md
│   ├── sphera.md
│   ├── enablon.md
│   └── sap-ehs.md
├── lims-lab/
│   ├── thermo-samplemanager.md
│   ├── labware.md
│   ├── starlims.md
│   ├── labvantage.md
│   └── siemens-opcenter.md
└── regulatory/
    ├── sphera.md
    ├── intelex.md
    ├── enablon.md
    ├── sap-ehs.md
    └── cority.md
```

Each file follows a standard template documented in `24_integrations/README.md`.

---

## 5c. Connector Templates — Turnkey Integration

### Concept

I/O ships with **40 pre-built connector templates** (one per connector profile in `24_integrations/`) that let administrators set up integrations by entering only a hostname and credentials. Templates pre-populate the entire import definition — connection config, source endpoints, field mappings, value maps, sync strategy, and validation — so that a fresh I/O install can start pulling data from a known application in minutes.

### Architecture

```
┌─────────────────────────────────────────────────────────┐
│                 connector_templates table                │
│  40 rows (seed data), each containing:                  │
│  • connection_config template (with {{placeholders}})   │
│  • source_config (endpoints, pagination, watermarks)    │
│  • field_mappings (source→target with transforms)       │
│  • value_maps (vendor status/priority→I/O enums)        │
│  • required_fields (what the user must fill in)         │
└──────────────────────────┬──────────────────────────────┘
                           │
                    User selects template
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│              Import Definition Wizard                    │
│  Step 0: "Start from Template" or "Manual Config"       │
│  → Template selected: show dynamic form for             │
│    required_fields only (hostname, credentials)         │
│  → {{placeholder}} substitution                         │
│  → [Test Connection]                                    │
│  → Optionally customize any wizard step                 │
│  → Save as normal import_connection + import_definition │
└─────────────────────────────────────────────────────────┘
```

### Template Structure

Each template row contains a complete import definition JSONB blob with `{{placeholder}}` variables for site-specific values. The `required_fields` column drives the wizard's dynamic form.

```jsonc
// Example: required_fields for ServiceNow
[
  {
    "key": "instance",
    "label": "ServiceNow Instance Name",
    "placeholder": "your-company",
    "help": "The subdomain before .service-now.com",
    "type": "text"
  },
  {
    "key": "SERVICENOW_CLIENT_ID",
    "label": "OAuth Client ID",
    "type": "text"
  },
  {
    "key": "SERVICENOW_CLIENT_SECRET",
    "label": "OAuth Client Secret",
    "type": "secret"
  },
  {
    "key": "SERVICENOW_USERNAME",
    "label": "Integration Username",
    "type": "text"
  },
  {
    "key": "SERVICENOW_PASSWORD",
    "label": "Password",
    "type": "secret"
  }
]
```

### Template Variable Substitution

The Import Service performs `{{variable}}` replacement on the template JSONB before saving it as a real `import_connection` + `import_definition`. Substitution is recursive through all string values in the JSONB tree. Variables not present in `required_fields` are left as-is (they may be optional configuration the user can customize later).

All `{{placeholder}}` patterns in the existing connector profile files (`24_integrations/`) are already written in this format.

### Wizard Integration

The existing 7-step wizard gains a **Step 0** that offers two paths:

```
┌──────────────────────────────────────────────────────────┐
│  New Import Definition                                    │
│  ─────────────────────────────                           │
│                                                          │
│  How would you like to set up this import?               │
│                                                          │
│  ┌────────────────────────────────────────────────────┐  │
│  │  📋 Start from Template                            │  │
│  │  Pre-configured for 40 common applications.       │  │
│  │  Just enter your hostname and credentials.        │  │
│  │                                        [Browse →] │  │
│  └────────────────────────────────────────────────────┘  │
│                                                          │
│  ┌────────────────────────────────────────────────────┐  │
│  │  ⚙  Manual Configuration                          │  │
│  │  Build an import from scratch for any data source.│  │
│  │                                        [Start →]  │  │
│  └────────────────────────────────────────────────────┘  │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

**Template Browser** (when "Browse" is clicked):

```
┌──────────────────────────────────────────────────────────┐
│  Select a Connector Template                              │
│  ─────────────────────────────                           │
│                                                          │
│  Search: [___________________]                           │
│                                                          │
│  Filter by domain:                                       │
│  [All] [Maintenance] [Equipment] [Ticketing] [ERP]      │
│  [Access Control] [Environmental] [Lab/LIMS] [Regulatory]│
│                                                          │
│  ┌──────────────────────────────────────────────────┐    │
│  │ SAP PM — Work Orders            [Maintenance]    │    │
│  │ SAP S/4HANA Plant Maintenance via OData API      │    │
│  │ Targets: work_orders, spare_parts, pm_schedules  │    │
│  │                                       [Select]   │    │
│  ├──────────────────────────────────────────────────┤    │
│  │ ServiceNow ITSM                 [Ticketing]      │    │
│  │ Incidents, changes, problems via REST API        │    │
│  │ Targets: tickets, ticket_comments                │    │
│  │                                       [Select]   │    │
│  ├──────────────────────────────────────────────────┤    │
│  │ IBM Maximo — Work Orders        [Maintenance]    │    │
│  │ Maximo OSLC/REST API for work order sync         │    │
│  │ Targets: work_orders, spare_parts                │    │
│  │                                       [Select]   │    │
│  ├──────────────────────────────────────────────────┤    │
│  │ ... (40 templates total)                         │    │
│  └──────────────────────────────────────────────────┘    │
│                                                          │
│                                         [← Back]        │
└──────────────────────────────────────────────────────────┘
```

**Template Configuration** (after selecting a template):

```
┌──────────────────────────────────────────────────────────┐
│  Configure: ServiceNow ITSM                               │
│  ─────────────────────────────                           │
│                                                          │
│  Fill in your connection details:                        │
│                                                          │
│  Instance Name:    [_______________]                     │
│                    ↳ subdomain before .service-now.com   │
│  OAuth Client ID:  [_______________]                     │
│  OAuth Secret:     [•••••••••••••••]                     │
│  Username:         [_______________]                     │
│  Password:         [•••••••••••••••]                     │
│                                                          │
│  [Test Connection]                                       │
│  Status: ○ Not tested                                    │
│                                                          │
│  ┌────────────────────────────────────────────────────┐  │
│  │ This template will create:                         │  │
│  │ • 1 connection (ServiceNow REST API)               │  │
│  │ • 3 import definitions (incidents, changes,        │  │
│  │   problems) → tickets table                        │  │
│  │ • Incremental sync every 5-30 minutes              │  │
│  └────────────────────────────────────────────────────┘  │
│                                                          │
│  [Advanced: Customize Mappings →]                        │
│                                                          │
│              [← Back]  [Save & Start Sync]               │
└──────────────────────────────────────────────────────────┘
```

The "Advanced: Customize Mappings" link drops the user into the standard wizard at Step 3 (field mapping) with all fields pre-populated from the template. They can adjust any mapping, transform, schedule, or validation rule before saving.

### Multi-Definition Templates

Some templates create multiple import definitions from a single connection. For example:

- **ServiceNow ITSM**: 1 connection → 3 definitions (incidents, changes, problems)
- **SAP PM**: 1 connection → 3 definitions (work orders, spare parts, PM schedules)
- **Cority**: 1 connection → 3+ definitions (emissions, compliance, waste manifests)

The template's `template_config` contains a `sources` array (matching the connector profile structure). Each source becomes a separate `import_definition` linked to the shared `import_connection`.

### Template Updates

Templates are bundled as seed data and updated with each I/O release. They are read-only — administrators cannot modify the templates themselves, only the import definitions created from them. If a template is updated in a new release, existing import definitions created from the previous version are unaffected (they are independent copies).

A `template_id` and `template_version` are stored on `import_definitions` for provenance tracking. The UI can show "Update available" if the template version has changed since the definition was created.

### Database Schema

See `04_DATABASE_DESIGN.md` for the `connector_templates` table DDL.

---

## 6. Field Mapping System

### Schema Discovery

When an administrator configures an import, the system discovers the source schema automatically:

| Source Type | Discovery Method |
|---|---|
| **PostgreSQL** | `information_schema.columns` query |
| **MSSQL** | `sys.columns` + `sys.types` query |
| **MySQL** | `information_schema.columns` query |
| **Oracle** | `all_tab_columns` query |
| **ODBC** | `SQLTables()` + `SQLColumns()` metadata functions |
| **CSV/TSV** | Header row + type inference from first 100 rows |
| **Excel** | Sheet header row + `calamine` cell type detection |
| **JSON** | Structure inference from first 100 records |
| **XML** | Element/attribute enumeration from sample document |
| **REST API** | Sample response + JSONPath extraction |
| **OPC UA** | Browse service node enumeration |

**Type inference algorithm** for file sources:
```
For each column:
  Sample first N non-null values
  Try parse as: integer → float → timestamp → boolean → string
  Assign the most specific type that succeeds for >90% of samples
  Flag ambiguous columns (e.g., "0"/"1" could be boolean or integer)
```

### Auto-Mapping

The system suggests field mappings automatically using Jaro-Winkler fuzzy string matching via the `strsim` crate (MIT):

```rust
use strsim::jaro_winkler;

fn suggest_mappings(
    source_cols: &[&str],
    target_cols: &[&str],
) -> Vec<(String, String, f64)> {
    let mut suggestions = Vec::new();
    for src in source_cols {
        let mut best = ("", 0.0);
        for tgt in target_cols {
            let score = jaro_winkler(
                &normalize_name(src),
                &normalize_name(tgt),
            );
            if score > best.1 { best = (tgt, score); }
        }
        if best.1 > 0.75 {
            suggestions.push((src.to_string(), best.0.to_string(), best.1));
        }
    }
    suggestions
}
```

**Name normalization** before comparison: strip prefixes/suffixes, replace separators (`_`, `-`, `.`, camelCase) with spaces, lowercase. A synonym dictionary maps common aliases (`tag` ↔ `point_name`, `desc` ↔ `description`, `eng_units` ↔ `engineering_units`).

**Confidence levels**:

| Confidence | Score Range | UI Treatment |
|---|---|---|
| High | > 0.90 | Auto-mapped, green indicator |
| Medium | 0.75 - 0.90 | Suggested, yellow indicator, requires confirmation |
| Low | 0.50 - 0.75 | Listed as possibility, manual confirmation required |
| None | < 0.50 | No suggestion, manual mapping required |

### Manual Mapping UI

The field mapping interface uses a grid/table layout (see Section 13 for full UI design):

```
┌─────────────────────────────────────────────────────────────────┐
│  Source Field       │  Target Column    │  Type       │  Action │
│  ──────────────────┼──────────────────┼────────────┼─────────│
│  AlarmDateTime      │ [timestamp ▼]    │ timestamptz│ [Edit]  │
│  AlarmMessage       │ [message ▼]      │ text       │ [Edit]  │
│  Severity           │ [severity ▼]     │ varchar    │ [Edit]  │
│  SourceTag          │ [source ▼]       │ varchar    │ [Edit]  │
│  EventValue         │ [-- skip -- ▼]   │            │ [Edit]  │
│  (unmapped)         │ [event_type ▼]   │ varchar    │ [Edit]  │
└─────────────────────────────────────────────────────────────────┘
```

### Multi-Table Mapping

A single import definition can map source fields to multiple target tables. For example, a CSV file might contain both point metadata and time-series data. The `field_mappings` JSONB supports this:

```json
[
    {
        "source_field": "TagName",
        "target_table": "points_metadata",
        "target_column": "tagname",
        "transform": null,
        "required": true
    },
    {
        "source_field": "Timestamp",
        "target_table": "points_history_raw",
        "target_column": "timestamp",
        "transform": {"type": "parse_datetime", "format": "%Y-%m-%d %H:%M:%S"},
        "required": true
    },
    {
        "source_field": "Value",
        "target_table": "points_history_raw",
        "target_column": "value_numeric",
        "transform": {"type": "cast", "target_type": "float8"},
        "required": true
    }
]
```

---

## 7. Transformation Pipeline

Transformations execute per-row after field mapping and before validation. The pipeline supports two types: **built-in transforms** (native Rust, high performance) and **custom transforms** (Rhai scripted, flexible).

### Built-in Transforms (Native Rust)

High-frequency transformations implemented as optimized Rust functions. The administrator selects these from a dropdown and configures parameters.

#### Type Conversions

| Transform | Parameters | Example |
|---|---|---|
| `cast` | target_type | "123.45" → 123.45 (float) |
| `string_to_boolean` | true_values, false_values | "Yes"/"No" → true/false |
| `parse_datetime` | format_string, timezone | "01/15/2024 14:30" → timestamptz |
| `epoch_to_datetime` | unit (s/ms/us) | 1705312200 → timestamptz |
| `number_to_string` | format, precision | 1234.5 → "1234.50" |

#### String Operations

| Transform | Parameters | Example |
|---|---|---|
| `trim` | chars (optional) | "  hello  " → "hello" |
| `uppercase` / `lowercase` | — | "Hello" → "HELLO" |
| `substring` | start, length | "POINT.TAG.001" → "TAG" |
| `regex_extract` | pattern, group | "T-(\d+)" → "123" |
| `regex_replace` | pattern, replacement | Replace "." with "_" |
| `split` | delimiter, index | "first.last" at index 0 → "first" |
| `concat` | fields, separator | first + " " + last → "John Smith" |
| `pad` | direction, length, char | "42" → "0042" |

#### Numeric Operations

| Transform | Parameters | Example |
|---|---|---|
| `scale` | factor | value × 1.8 |
| `offset` | amount | value + 32 |
| `scale_and_offset` | factor, offset | (value × 1.8) + 32 |
| `round` | precision | 3.14159 → 3.14 |
| `clamp` | min, max | Restrict to range |
| `unit_convert` | from_unit, to_unit | Leverage I/O's UOM catalog |

#### Date/Time Operations

| Transform | Parameters | Example |
|---|---|---|
| `parse_datetime` | format_string | "01/15/2024" → datetime |
| `format_datetime` | format_string | datetime → "2024-01-15" |
| `timezone_convert` | from_tz, to_tz | UTC → America/Chicago |
| `extract_component` | component | datetime → year, month, day, hour |

#### Lookup / Enrichment

| Transform | Parameters | Example |
|---|---|---|
| `static_map` | mapping (JSON object) | {"H": "High", "M": "Medium", "L": "Low"} |
| `lookup_table` | table, key_column, value_column | Code "A" → "Active" |
| `default_value` | value | null → 0.0 |
| `coalesce` | field_list | First non-null from list |

#### Structural Operations

| Transform | Parameters | Example |
|---|---|---|
| `split_field` | delimiter, target_fields | "John Smith" → first_name, last_name |
| `merge_fields` | source_fields, separator, target | lat + "," + lon → coordinates |
| `flatten_json` | path | Nested object → flat columns |
| `filter_row` | condition (Rhai expression) | Skip rows where status = "deleted" |

### Custom Transforms (Rhai)

For complex or domain-specific transformations, administrators write Rhai expressions. This reuses the existing Expression Builder infrastructure (Rhai v1.19.0, MIT/Apache-2.0).

**Custom functions registered for the import context:**

```rust
let mut engine = Engine::new();

// Safety limits
engine.set_max_operations(100_000);
engine.set_max_expr_depths(32, 32);
engine.set_max_string_size(1_048_576);   // 1 MB
engine.set_max_array_size(10_000);

// Regex operations
engine.register_fn("regex_match", |s: &str, pattern: &str| -> bool { ... });
engine.register_fn("regex_extract", |s: &str, pattern: &str| -> String { ... });
engine.register_fn("regex_replace", |s: &str, pattern: &str, repl: &str| -> String { ... });

// Date parsing
engine.register_fn("parse_date", |s: &str, fmt: &str| -> i64 { ... });
engine.register_fn("format_date", |epoch: i64, fmt: &str| -> String { ... });

// Null handling
engine.register_fn("is_empty", |s: &str| -> bool { ... });
engine.register_fn("default_if_empty", |s: &str, default: &str| -> String { ... });

// Industrial helpers
engine.register_fn("lookup", |table: String, key: String| -> String { ... });
engine.register_fn("point_exists", |tagname: &str| -> bool { ... });
engine.register_fn("convert_uom", |value: f64, from: &str, to: &str| -> f64 { ... });
engine.register_fn("quality_to_string", |code: i64| -> String { ... });
```

**Example Rhai transform script:**

```rhai
// Multi-step transformation
let tag = tag_name.trim().to_upper();
let parts = tag.split(".");
let area = if parts.len() > 0 { parts[0] } else { "UNKNOWN" };

let eng_value = if source_type == "PI" {
    raw_value * pi_scale_factor
} else {
    raw_value
};

#{
    tag_name: tag,
    area: area,
    value: eng_value,
    quality: if quality_code >= 192 { "Good" } else { "Bad" }
}
```

### Transform Configuration Schema

Each transform step is stored as JSON in `import_definitions.transform_pipeline`:

```json
{
    "steps": [
        {
            "order": 1,
            "type": "built_in",
            "operation": "trim",
            "source_field": "tag_name",
            "target_field": "tag_name"
        },
        {
            "order": 2,
            "type": "built_in",
            "operation": "static_map",
            "source_field": "severity",
            "target_field": "severity",
            "params": {"map": {"H": "high", "M": "medium", "L": "low"}}
        },
        {
            "order": 3,
            "type": "rhai_expression",
            "expression": "if quality_code >= 192 { \"Good\" } else { \"Bad\" }",
            "source_fields": ["quality_code"],
            "target_field": "quality"
        }
    ]
}
```

### Performance Considerations

| Rows | Simple Rhai (130ns/row) | Complex Rhai (1μs/row) | Built-in Rust only |
|---|---|---|---|
| 1,000 | 0.13 ms | 1 ms | < 0.1 ms |
| 10,000 | 1.3 ms | 10 ms | < 1 ms |
| 100,000 | 13 ms | 100 ms | < 10 ms |
| 1,000,000 | 130 ms | 1 s | < 100 ms |

**Strategy**: Use built-in Rust transforms for 90% of operations. Rhai handles the remaining 10% requiring custom logic. For million-row imports, restrict Rhai to simple expressions and rely on native built-ins for performance-critical transforms.

---

## 8. Validation System

Validation occurs at multiple stages to catch issues early and provide actionable error messages.

### JSON Schema Validation

Each import definition optionally includes a JSON Schema that validates rows after transformation. The `jsonschema` crate (MIT, v0.28+) compiles the schema once and validates every row -- up to 645x faster than alternatives.

```json
{
    "type": "object",
    "properties": {
        "tag_name": {"type": "string", "minLength": 1, "maxLength": 255},
        "value": {"type": "number", "minimum": -1000, "maximum": 5000},
        "timestamp": {"type": "string", "format": "date-time"},
        "quality": {"type": "string", "enum": ["Good", "Bad", "Uncertain"]}
    },
    "required": ["tag_name", "value", "timestamp"]
}
```

**Supported constraints:**
- Type matching (`string`, `number`, `integer`, `boolean`, `null`)
- String: `minLength`, `maxLength`, `pattern` (regex), `format` (date-time, email, uri, uuid)
- Numeric: `minimum`, `maximum`, `exclusiveMinimum`, `exclusiveMaximum`, `multipleOf`
- Enum: `enum` (allowed value list)
- Required fields: `required` array
- Nullable: `"type": ["string", "null"]`
- Conditional: `if`/`then`/`else` keywords

### Cross-Field Validation

For rules that span multiple fields (e.g., `max_value > min_value`), Rhai expressions evaluate cross-field conditions:

```json
{
    "cross_field_rules": [
        {"expression": "high_limit > low_limit", "message": "High limit must exceed low limit"},
        {"expression": "end_time > start_time", "message": "End time must be after start time"}
    ]
}
```

### Referential Integrity

Before loading, the pipeline checks that foreign key references exist in the target database:

```sql
-- Check that referenced points exist
SELECT s.tag_name FROM staging_table s
LEFT JOIN points_metadata p ON s.tag_name = p.tagname
WHERE p.tagname IS NULL;
```

Rows with unresolvable references are routed to the error queue with `error_type = 'referential'`.

### Duplicate Detection

| Strategy | Approach | Use Case |
|---|---|---|
| **Exact match** | Compare on configured key columns | tag_name + timestamp deduplication |
| **Hash-based** | SHA-256 of concatenated key fields | Efficient for large datasets |
| **Fuzzy match** | Jaro-Winkler on string fields (`strsim`) | Entity name matching |
| **Window-based** | Check within a time window | Time-series dedup (value within 1s) |

### Data Quality Scoring

Each row receives an optional quality score (0.0 to 1.0) based on configurable criteria:

- **Completeness**: Percentage of non-null fields filled
- **Format score**: Percentage of fields passing format validation
- **Range score**: Percentage of numeric fields within expected ranges

Rows below a configurable quality threshold can be quarantined for manual review.

### Industrial Validation Functions

Pre-built validation functions for industrial data:

- `is_valid_tagname(value)` -- Validates against I/O tagname conventions
- `is_valid_timestamp(value, format)` -- Parses and validates timestamps
- `is_valid_numeric(value)` -- Handles NaN, Infinity edge cases
- `is_in_range(value, min, max)` -- Range check for process values
- `is_valid_quality_code(value)` -- OPC quality code validation
- `point_exists(tagname)` -- Checks existence in `points_metadata`
- `is_valid_engineering_unit(value)` -- Validates against the UOM catalog

---

## 9. Scheduling and Job Management

### PostgreSQL-Based Job Queue

The Import Service uses PostgreSQL as its job queue, avoiding external dependencies (no Redis, no RabbitMQ). The scheduler polls the `import_schedules` table and uses `FOR UPDATE SKIP LOCKED` for concurrency control:

```sql
-- Poll for runnable schedules (executed every 30 seconds by Import Service)
SELECT s.id, s.definition_id, s.schedule_type
FROM import_schedules s
WHERE s.enabled = true
  AND s.next_run_at <= NOW()
  AND (s.running = false
       OR s.last_heartbeat_at < NOW() - INTERVAL '5 minutes')
ORDER BY s.next_run_at
FOR UPDATE SKIP LOCKED
LIMIT 1;
```

This pattern:
- Prevents duplicate runs of the same import (`FOR UPDATE SKIP LOCKED`)
- Recovers from crashed jobs (heartbeat timeout at 5 minutes)
- Requires no external infrastructure
- Keeps all scheduling state visible in the admin UI

### Schedule Types

| Type | Implementation | Example |
|---|---|---|
| **Cron** | `cron` crate (MIT/Apache-2.0) parses expressions | `0 */15 * * * *` (every 15 min) |
| **Interval** | Fixed seconds between runs | Every 300 seconds |
| **Manual** | No schedule; triggered via UI or API | One-shot import |
| **File arrival** | `notify` crate (CC0) detects new files in watched directory | New CSV in `/imports/daily/` |
| **Webhook** | External system POST to registered endpoint | Triggered by upstream system |
| **Dependency chain** | Run after another import completes successfully | Import B depends on Import A |

### Watermark-Based Incremental Imports

Each import definition can track a watermark -- the last imported timestamp or ID -- to enable incremental imports:

```json
{
    "watermark_enabled": true,
    "watermark_column": "updated_at",
    "watermark_state": {"last_value": "2024-01-15T10:30:00Z"}
}
```

The source query automatically includes a `WHERE updated_at > $watermark` filter. After a successful import, the watermark is advanced to the maximum value seen in the imported batch.

### Job Lifecycle

```
PENDING → RUNNING → COMPLETED
                  → COMPLETED_WITH_ERRORS (some rows failed, good rows committed)
                  → FAILED (entire run failed)
                  → CANCELLED (user cancelled)
                  → DRY_RUN (full pipeline, no commit)
```

### Heartbeat

While an import job is running, the Import Service updates `import_schedules.last_heartbeat_at` every 60 seconds. If a job's heartbeat is stale by more than 5 minutes, the scheduler considers it crashed and eligible for re-execution.

### Concurrency

The Import Service processes one job at a time by default. Multiple concurrent jobs can be configured via an environment variable (`IMPORT_MAX_CONCURRENT_JOBS`, default 1). Each job runs in its own Tokio task with its own database transaction scope.

---

## 10. Error Handling and Recovery

### Configurable Error Strategies

Each import definition specifies how to handle row-level errors:

| Strategy | Behavior | When to Use |
|---|---|---|
| **Stop** | Halt on first error, rollback all | Critical data where partial imports are unacceptable |
| **Skip** | Log error, skip row, continue | Tolerant imports (historical backfill) |
| **Quarantine** | Good rows → target table, bad rows → `import_errors` with full source data | Most common default |
| **Threshold** | Stop if error count exceeds `error_threshold` | Production imports with quality expectations |

### Error Classification

| Error Type | Retryable? | Example |
|---|---|---|
| `validation` | No | Value out of range, missing required field |
| `transformation` | No | Rhai expression evaluation failure |
| `type_cast` | No | Cannot parse "abc" as integer |
| `constraint` | No | Foreign key or unique constraint violation |
| `duplicate` | No | Row already exists (dedup detection) |
| `referential` | No | Referenced point does not exist |
| `connection` | Yes | Source database connection timeout |
| `unknown` | Maybe | Unexpected errors |

### Retry with Exponential Backoff

For transient errors (connection failures, timeouts), the Import Service retries with exponential backoff:

- Initial delay: 30 seconds
- Multiplier: 2x
- Maximum delay: 1 hour
- Maximum retries: 3

**Retry decision tree:**
1. **Transient error** (connection timeout, network issue) → Retry with backoff
2. **Source unavailable** (database down, file locked) → Retry with longer backoff
3. **Data error** (validation, constraint) → Do NOT retry; quarantine bad rows
4. **Configuration error** (bad mapping, missing table) → Do NOT retry; notify admin

### Recovery Patterns

| Scenario | Recovery |
|---|---|
| Crash during extract | Re-run from last watermark (idempotent) |
| Crash during transform | Re-run entire batch (transforms are stateless) |
| Crash during load | Transaction rollback; re-run from extract |
| Partial commit | Watermark updated only on full success; re-run processes same data |
| Source schema changed | Alert admin; pause import; require mapping review |

### Alerting

- **PostgreSQL NOTIFY `import_alert`**: Emitted on run failure or threshold breach. The API Gateway can relay to the frontend.
- **Import run status**: Visible in the Settings > Imports > History UI.
- **Configurable thresholds**: Alert when error rate > X%, when duration > Y minutes, when no data arrives for Z hours.

---

## 11. Test, Preview, and Dry Run

### Preview Mode

Preview extracts a small sample (default 10 rows) and runs it through the full mapping + transformation + validation pipeline without writing to the target table.

```
┌─────────────────────────────┬──────────────────────────────┐
│  SOURCE DATA (raw)          │  TARGET DATA (transformed)   │
│                             │                              │
│  AlarmDateTime: "1/15/24.." │  timestamp: 2024-01-15T...   │
│  AlarmMessage: "High Temp"  │  message: "High Temp"        │
│  Severity: "H"              │  severity: "high"            │
│  SourceTag: "TI-1234"       │  source: "TI-1234"           │
│  EventValue: 450.2          │  (skipped)                   │
│                             │  event_type: "alarm"         │
│                             │                              │
│  Row 1 of 10: Valid         │                              │
│  Row 2 of 10: Valid         │                              │
│  Row 3 of 10: Validation    │                              │
│     error on 'severity':    │                              │
│     value "X" not in enum   │                              │
└─────────────────────────────┴──────────────────────────────┘
```

### Dry Run

Dry run executes the complete pipeline against all source data within a PostgreSQL transaction that is rolled back at the end. Nothing is persisted, but the full statistics are captured:

```rust
async fn dry_run(config: &ImportDefinition, pool: &PgPool) -> DryRunResult {
    let mut tx = pool.begin().await?;

    // Run full pipeline inside transaction
    let result = execute_pipeline(&mut tx, config).await;

    // Collect statistics before rollback
    let stats = collect_run_statistics(&mut tx, &result).await?;

    // ROLLBACK - nothing persisted
    tx.rollback().await?;

    stats
}
```

### Validation Report

Both preview and dry-run produce a validation report:

```json
{
    "source": {
        "type": "csv",
        "file": "daily_tags.csv",
        "total_rows": 15234
    },
    "validation": {
        "passed": 15100,
        "warnings": 89,
        "errors": 45,
        "error_rate_percent": 0.30,
        "top_errors": [
            {"field": "timestamp", "error": "invalid format", "count": 23},
            {"field": "value", "error": "out of range", "count": 15},
            {"field": "tag_name", "error": "not found in points_metadata", "count": 7}
        ]
    },
    "impact": {
        "new_records": 234,
        "updated_records": 14866,
        "unchanged_records": 0
    },
    "estimated_load_time_seconds": 12,
    "recommendation": "proceed"
}
```

---

## 12. Import History and Monitoring

### Run History

Every import execution creates a record in `import_runs` with complete statistics:

- **Status**: pending, running, completed, completed_with_errors, failed, cancelled, dry_run
- **Row counts**: extracted, transformed, loaded, skipped, errored
- **Timing**: extract, transform, validate, and load durations (milliseconds)
- **Watermark**: Before and after states for incremental tracking
- **Trigger source**: manual, schedule, file_arrival, webhook, dependency

### Error Review

Administrators can drill down from a run to its individual errors:

1. **Run list** → click a run to see its detail
2. **Run detail** → shows row counts, timing breakdown, error summary
3. **Error list** → filterable by error_type, field_name, severity
4. **Error detail** → shows the original source row (preserved in `source_data` JSONB), the error message, and the field that failed

### Monitoring Metrics

The Import Service exposes metrics via its health endpoint:

- `import_runs_total` (counter by status)
- `import_rows_processed_total` (counter)
- `import_errors_total` (counter by error_type)
- `import_duration_seconds` (histogram)
- `import_connections_status` (gauge by status: connected/error/disabled)
- `import_schedules_overdue` (gauge: count of schedules past their next_run_at)

---

## 13. User Interface Design

### Settings Module Integration

The Universal Import Interface lives in the **Settings module** under an "Imports" tab, alongside existing tabs for Users, Sources, Points, etc.

### UI Structure

```
Settings > Imports
├── Connections (sub-tab)
│   ├── Connection list table
│   │   columns: Name, Type, Status, Last Connected, Actions
│   ├── Add Connection (modal)
│   ├── Edit Connection (modal)
│   ├── Test Connection (inline button with status feedback)
│   └── Delete Connection (confirmation dialog)
│
├── Import Definitions (sub-tab)
│   ├── Definition list table
│   │   columns: Name, Connection, Target, Schedule, Last Run, Status, Actions
│   ├── New Import Definition (wizard - see below)
│   ├── Edit Definition (same wizard, pre-populated)
│   ├── Clone Definition
│   ├── Run Now (manual trigger)
│   ├── Dry Run
│   └── Delete Definition (confirmation dialog)
│
└── Import History (sub-tab)
    ├── Run list table
    │   columns: Definition, Status, Rows, Duration, Errors, Started, Actions
    ├── Run detail panel
    │   sections: Summary, Timing Breakdown, Error Summary
    └── Error list panel
        columns: Row #, Field, Error Type, Message, Source Data (expandable)
```

### Connection Configuration

The connection modal dynamically renders fields based on `connector_type`:

**Database (PostgreSQL example):**
```
┌──────────────────────────────────────────────┐
│  New Connection                               │
│                                              │
│  Name: [________________________]            │
│  Type: [PostgreSQL           ▼]              │
│                                              │
│  Host:     [db.example.com      ]            │
│  Port:     [5432                ]            │
│  Database: [production          ]            │
│  Schema:   [public              ]            │
│  Username: [readonly_user       ]            │
│  Password: [••••••••••          ]            │
│  SSL Mode: [require          ▼]             │
│                                              │
│  [Test Connection]  [Cancel]  [Save]         │
└──────────────────────────────────────────────┘
```

**REST API example:**
```
┌──────────────────────────────────────────────┐
│  New Connection                               │
│                                              │
│  Name: [________________________]            │
│  Type: [REST API (JSON)      ▼]              │
│                                              │
│  Base URL:  [https://api.example.com/v2]     │
│  Auth Type: [OAuth 2.0 Client Creds  ▼]     │
│                                              │
│  Token URL:     [https://auth.example.com/t] │
│  Client ID:     [io-import-client          ] │
│  Client Secret: [••••••••••                ] │
│  Scope:         [read:data                 ] │
│                                              │
│  [Test Connection]  [Cancel]  [Save]         │
└──────────────────────────────────────────────┘
```

### Import Definition Wizard

A 7-step wizard guides the administrator through creating an import definition:

**Step 1: Select Connection**
```
┌──────────────────────────────────────────────┐
│  Step 1 of 7: Select Connection               │
│  ─────────────────────────────               │
│                                              │
│  Connection: [Production MSSQL        ▼]     │
│  Status: Connected (last: 2 min ago)         │
│                                              │
│  -- or --                                    │
│  [+ Create New Connection]                   │
│                                              │
│                         [Cancel] [Next →]    │
└──────────────────────────────────────────────┘
```

**Step 2: Configure Source**
```
┌──────────────────────────────────────────────┐
│  Step 2 of 7: Configure Source                │
│  ─────────────────────────────               │
│                                              │
│  Mode: (•) Table  ( ) Custom Query           │
│                                              │
│  Schema: [dbo              ▼]                │
│  Table:  [AlarmHistory     ▼]                │
│                                              │
│  -- or for Custom Query --                   │
│  ┌────────────────────────────────────────┐  │
│  │ SELECT AlarmTime, Message, Severity   │  │
│  │ FROM dbo.AlarmHistory                 │  │
│  │ WHERE AlarmTime > @watermark          │  │
│  └────────────────────────────────────────┘  │
│                                              │
│                    [← Back] [Next →]         │
└──────────────────────────────────────────────┘
```

**Step 3: Discover & Map Fields**
```
┌──────────────────────────────────────────────────────────┐
│  Step 3 of 7: Map Fields                                  │
│  ─────────────────────────────                           │
│  Target Table: [events                     ▼]            │
│                                                          │
│  [Auto-Map]  [Clear All]                                 │
│                                                          │
│  Source Field    │ Target Column   │ Type      │ Action  │
│  ───────────────┼────────────────┼──────────┼────────  │
│  AlarmTime       │ [timestamp ▼]  │ tstz     │ [Edit]  │
│  Message         │ [message ▼]    │ text     │ [Edit]  │
│  Severity        │ [severity ▼]   │ varchar  │ [Edit]  │
│  SourceTag       │ [point_id ▼]   │ uuid     │ [Edit]  │
│  EventValue      │ [-- skip --▼]  │          │         │
│                                                          │
│  [Preview 10 Rows]             [← Back] [Next →]        │
└──────────────────────────────────────────────────────────┘
```

**Step 4: Configure Transformations**
```
┌──────────────────────────────────────────────────────────┐
│  Step 4 of 7: Transformations                             │
│  ─────────────────────────────                           │
│                                                          │
│  Transform Pipeline (applied in order):                  │
│  ┌────────────────────────────────────────────────────┐  │
│  │ 1. [Severity] → Static Map                        │  │
│  │    {"H": "high", "M": "medium", "L": "low"}      │  │
│  │                                         [Edit] [×]│  │
│  ├────────────────────────────────────────────────────┤  │
│  │ 2. [SourceTag] → Lookup (points_metadata.tagname) │  │
│  │    Returns: point_id                              │  │
│  │                                         [Edit] [×]│  │
│  └────────────────────────────────────────────────────┘  │
│                                                          │
│  [+ Add Transform]                                       │
│  [+ Add Rhai Expression]                                 │
│                                                          │
│                              [← Back] [Next →]          │
└──────────────────────────────────────────────────────────┘
```

**Step 5: Validation Rules**
```
┌──────────────────────────────────────────────────────────┐
│  Step 5 of 7: Validation                                  │
│  ─────────────────────────────                           │
│                                                          │
│  Field Rules:                                            │
│  ┌────────────────────────────────────────────────────┐  │
│  │ timestamp   Required, valid datetime               │  │
│  │ message     Required, max length 1000              │  │
│  │ severity    Required, enum: high/medium/low        │  │
│  │ point_id    Required, must exist in points_metadata│  │
│  └────────────────────────────────────────────────────┘  │
│                                                          │
│  Cross-Field Rules:                                      │
│  ┌────────────────────────────────────────────────────┐  │
│  │ (none configured)                      [+ Add]    │  │
│  └────────────────────────────────────────────────────┘  │
│                                                          │
│                              [← Back] [Next →]          │
└──────────────────────────────────────────────────────────┘
```

**Step 6: Import Options**
```
┌──────────────────────────────────────────────────────────┐
│  Step 6 of 7: Options                                     │
│  ─────────────────────────────                           │
│                                                          │
│  Import Mode:   (•) Insert  ( ) Upsert  ( ) Replace     │
│  Upsert Key:    [timestamp, point_id]  (if upsert)      │
│  Batch Size:    [500        ]                            │
│                                                          │
│  Error Handling: [Quarantine (skip bad, log errors) ▼]   │
│  Error Limit:    [___] (blank = unlimited)               │
│                                                          │
│  Incremental:                                            │
│  [✓] Enable watermark tracking                           │
│  Watermark Column: [AlarmTime     ▼]                     │
│                                                          │
│  Schedule:                                               │
│  ( ) Manual only                                         │
│  (•) Cron: [0 */5 * * * *]  (every 5 minutes)          │
│  ( ) Interval: [___] seconds                             │
│  Timezone: [America/Chicago ▼]                           │
│                                                          │
│                              [← Back] [Next →]          │
└──────────────────────────────────────────────────────────┘
```

**Step 7: Review & Save**
```
┌──────────────────────────────────────────────────────────┐
│  Step 7 of 7: Review                                      │
│  ─────────────────────────────                           │
│                                                          │
│  Name: [MSSQL Alarm Import        ]                      │
│  Description: [Import alarms from event historian]       │
│                                                          │
│  Summary:                                                │
│  ┌────────────────────────────────────────────────────┐  │
│  │ Connection:  Production MSSQL (connected)          │  │
│  │ Source:      dbo.AlarmHistory                      │  │
│  │ Target:      events (insert)                       │  │
│  │ Mappings:    4 fields mapped, 1 skipped            │  │
│  │ Transforms:  2 steps (static_map, lookup)          │  │
│  │ Validation:  4 field rules, 0 cross-field rules    │  │
│  │ Schedule:    Every 5 minutes (America/Chicago)     │  │
│  │ Incremental: Yes (watermark on AlarmTime)          │  │
│  └────────────────────────────────────────────────────┘  │
│                                                          │
│  [Dry Run]  [Preview 10 Rows]                            │
│                                                          │
│                    [← Back] [Save] [Save & Run Now]      │
└──────────────────────────────────────────────────────────┘
```

---

## 14. API Endpoints

All endpoints are proxied through the API Gateway at `/api/imports/*` and require JWT authentication. Follows the response/error format from `21_API_DESIGN.md`.

### Connector Templates

| Method | Endpoint | Permission | Description |
|---|---|---|---|
| `GET` | `/api/imports/templates` | `system:import_definitions` | List all connector templates (filterable by domain, vendor) |
| `GET` | `/api/imports/templates/:id` | `system:import_definitions` | Get template details including full template_config |
| `POST` | `/api/imports/templates/:id/instantiate` | `system:import_connections` + `system:import_definitions` | Create connection + definition(s) from template with user-provided field values |
| `POST` | `/api/imports/templates/:id/test` | `system:import_connections` | Test connection using template config with user-provided field values (without saving) |

**Template instantiation** accepts a JSON body with `required_fields` values. The Import Service performs `{{placeholder}}` substitution, creates one `import_connection`, and one or more `import_definitions` (one per source in the template). Returns the created connection and definition IDs.

### Connection Management

| Method | Endpoint | Permission | Description |
|---|---|---|---|
| `GET` | `/api/imports/connections` | `system:import_connections` | List all connections |
| `GET` | `/api/imports/connections/:id` | `system:import_connections` | Get connection details (credentials masked) |
| `POST` | `/api/imports/connections` | `system:import_connections` | Create connection |
| `PUT` | `/api/imports/connections/:id` | `system:import_connections` | Update connection |
| `DELETE` | `/api/imports/connections/:id` | `system:import_connections` | Delete connection (fails if definitions reference it) |
| `POST` | `/api/imports/connections/:id/test` | `system:import_connections` | Test connection |

### Import Definitions

| Method | Endpoint | Permission | Description |
|---|---|---|---|
| `GET` | `/api/imports/definitions` | `system:import_definitions` | List all definitions |
| `GET` | `/api/imports/definitions/:id` | `system:import_definitions` | Get definition details |
| `POST` | `/api/imports/definitions` | `system:import_definitions` | Create definition |
| `PUT` | `/api/imports/definitions/:id` | `system:import_definitions` | Update definition |
| `DELETE` | `/api/imports/definitions/:id` | `system:import_definitions` | Delete definition |
| `POST` | `/api/imports/definitions/:id/clone` | `system:import_definitions` | Clone definition |

### Schema Discovery

| Method | Endpoint | Permission | Description |
|---|---|---|---|
| `POST` | `/api/imports/connections/:id/discover` | `system:import_definitions` | Discover source schema (tables/columns) |
| `POST` | `/api/imports/connections/:id/preview` | `system:import_definitions` | Preview source data (N rows) |

### Import Operations

| Method | Endpoint | Permission | Description |
|---|---|---|---|
| `POST` | `/api/imports/definitions/:id/run` | `system:import_execute` | Trigger manual import |
| `POST` | `/api/imports/definitions/:id/dry-run` | `system:import_execute` | Execute dry run |
| `POST` | `/api/imports/definitions/:id/preview` | `system:import_execute` | Preview with mapping applied |
| `POST` | `/api/imports/runs/:id/cancel` | `system:import_execute` | Cancel running import |
| `POST` | `/api/imports/definitions/:id/enable` | `system:import_definitions` | Enable definition |
| `POST` | `/api/imports/definitions/:id/disable` | `system:import_definitions` | Disable definition |

### Scheduling

| Method | Endpoint | Permission | Description |
|---|---|---|---|
| `GET` | `/api/imports/definitions/:id/schedule` | `system:import_definitions` | Get schedule config |
| `PUT` | `/api/imports/definitions/:id/schedule` | `system:import_definitions` | Update schedule |
| `POST` | `/api/imports/definitions/:id/schedule/enable` | `system:import_definitions` | Enable schedule |
| `POST` | `/api/imports/definitions/:id/schedule/disable` | `system:import_definitions` | Disable schedule |

### Import History

| Method | Endpoint | Permission | Description |
|---|---|---|---|
| `GET` | `/api/imports/runs` | `system:import_history` | List all runs (paginated, filterable) |
| `GET` | `/api/imports/runs/:id` | `system:import_history` | Get run details |
| `GET` | `/api/imports/runs/:id/errors` | `system:import_history` | Get errors for a run (paginated) |
| `GET` | `/api/imports/definitions/:id/runs` | `system:import_history` | List runs for a definition |

### File Upload

| Method | Endpoint | Permission | Description |
|---|---|---|---|
| `POST` | `/api/imports/upload` | `system:import_execute` | Upload file for import (CSV, Excel, JSON, XML) |

**File upload** accepts `multipart/form-data` with a maximum file size of 100 MB. Uploaded files are stored temporarily on disk and cleaned up after the import completes.

---

## 15. RBAC Permissions

Four new permissions are added to the **System** permission group:

| Permission | Description | Default Roles |
|---|---|---|
| `system:import_connections` | Create, edit, delete, and test import connections | Admin |
| `system:import_definitions` | Create, edit, delete import definitions and schedules | Admin |
| `system:import_execute` | Trigger imports (manual, dry-run), upload files | Supervisor, Admin |
| `system:import_history` | View import run history and error details | All roles |

*Role-permission assignments are managed centrally in doc 03. Defaults shown for reference.*

**Permission count**: 59 (existing) + 4 (new) = **63 total permissions**.

**Note**: The existing `system:import_data` permission (system-level data import/restore) remains unchanged. The new permissions are specifically for the Universal Import Interface.

### Audit Logging

All import operations are logged to the audit trail:
- Connection CRUD operations (via `log_audit_trail()` trigger on `import_connections`)
- Definition CRUD operations (via `log_audit_trail()` trigger on `import_definitions`)
- Import executions (tracked in `import_runs` table, which serves as its own audit log)
- File uploads (logged with file metadata)

---

## 16. Relationship to Point Model

The Universal Import Interface interacts with the I/O point model at multiple levels:

### Point Metadata Import

Bulk import of point metadata from external systems (CSV, databases, APIs) uses the existing `upsert_point_from_source()` function. This ensures:
- Idempotent creation (no duplicates)
- Automatic metadata versioning (via `points_metadata_versions`)
- Source tracking (via `point_sources`)
- Trigger-synced denormalized metadata

For bulk point imports, the Import Service first creates a `point_source` entry representing the import source, then calls `upsert_point_from_source()` for each row.

### Time-Series Data Import

Historical data backfill (e.g., importing years of data from a legacy historian) writes to `points_history_raw` using batch `INSERT ... ON CONFLICT (point_id, timestamp) DO UPDATE`. The existing dedup constraint prevents duplicates.

### Event Import

Event data from any source (MSSQL historian, CSV, REST API) is written to the `events` table. The Import Service handles the same event schema as the Event Service but for batch operations rather than near-real-time polling.

### Custom Data Import

Data that doesn't map to existing I/O tables (equipment lists, maintenance schedules, vendor data, regulatory compliance records) is stored in `custom_import_data` as JSONB. This table is queryable for correlation with point data in the Forensics and Reports modules.

### Data Flow Summary

```
External Source
    │
    ▼
Import Service (extract, map, transform, validate)
    │
    ├─► points_metadata (via upsert_point_from_source)
    ├─► points_history_raw (batch INSERT with dedup)
    ├─► events / alarms (event data from any source)
    └─► custom_import_data (everything else)
```

---

## 17. Import Designer (Placeholder)

A future visual pipeline builder could provide a drag-and-drop canvas for designing complex import workflows with branching, merging, and multi-step transformations. This would use a library like React Flow (MIT) to draw connection lines between processing nodes.

**Planned for late v1 build**, after the wizard-based approach (Section 13) is proven. The Import Designer extends the wizard with a visual canvas for complex multi-step workflows that involve branching, merging, or multi-source enrichment. Uses React Flow (MIT).

---

## 18. Technology Stack

### New Rust Crates

| Crate | Version | License | Purpose |
|---|---|---|---|
| `odbc-api` | 9.x | MIT | ODBC database connectivity (fallback for uncommon databases) |
| `oracle` | 0.6+ | UPL-1.0/Apache-2.0 | Oracle database native driver |
| `calamine` | 0.26+ | MIT | Excel/ODS file reading (.xlsx, .xls, .xlsb, .ods) |
| `jsonschema` | 0.28+ | MIT | Runtime JSON Schema validation (compile once, validate many) |
| `strsim` | 0.11+ | MIT | Jaro-Winkler fuzzy string matching for auto-mapping |
| `cron` | 0.13+ | MIT/Apache-2.0 | Cron expression parsing for schedule management |
| `notify` | 7.0+ | CC0-1.0 | Filesystem watching for file-arrival scheduling |
| `quick-xml` | 0.37+ | MIT | XML parsing for XML file and SOAP imports |
| `tokio-modbus` | 0.15+ | MIT/Apache-2.0 | Modbus TCP/RTU industrial protocol client |
| `rumqttc` | 0.24+ | Apache-2.0 | MQTT client for IIoT messaging |
| `ssh2` | 0.9+ | MIT/Apache-2.0 | SFTP file transfer |
| `suppaftp` | 6.0+ | Apache-2.0 | FTP/FTPS file transfer |
| `object_store` | 0.11+ | Apache-2.0 | S3-compatible object storage access |
| `rdkafka` | 0.36+ | MIT | Apache Kafka consumer |
| `lapin` | 2.5+ | MIT | RabbitMQ/AMQP client |
| `async-nats` | 0.38+ | Apache-2.0 | NATS messaging client |
| `tonic` | 0.12+ | MIT | gRPC client (for gRPC API imports) |
| `prost` | 0.13+ | MIT | Protocol Buffers (for Sparkplug B and gRPC) |
| `graphql_client` | 0.14+ | MIT/Apache-2.0 | GraphQL API client |
| `ldap3` | 0.11+ | MIT/Apache-2.0 | LDAP/Active Directory client |
| `oauth2` | 5.0+ | MIT/Apache-2.0 | OAuth 2.0 authentication flows |
| `openidconnect` | 4.0+ | MIT/Apache-2.0 | OpenID Connect authentication |
| `sspi-rs` | 0.13+ | MIT/Apache-2.0 | Kerberos/NTLM Windows authentication |
| `sha2` | 0.10+ | MIT/Apache-2.0 | Row hashing for dedup detection |

### Crates Already in Project

| Crate | Purpose in Import Service |
|---|---|
| `sqlx` | PostgreSQL/MySQL native driver, import tables, staging |
| `tiberius` | MSSQL native driver |
| `reqwest` | HTTP client for REST/GraphQL/SOAP API imports |
| `serde` / `serde_json` | JSON serialization for config, mappings, JSONB |
| `rhai` | Custom transformation expressions (reuse Expression Builder) |
| `chrono` | Timestamp parsing and timezone conversion |
| `regex` | Pattern matching for Rhai custom functions |
| `csv` | CSV file parsing |
| `tokio` | Async runtime |
| `axum` | HTTP server for Import Service API |
| `uuid` | ID generation |

### Frontend Libraries

No new frontend libraries required. The import UI uses existing React components (forms, tables, modals, wizards) from the application shell.

**Late v1:** React Flow (MIT) for the visual Import Designer (Section 17).

### License Compliance

All new crates comply with the project's licensing requirements: MIT, Apache-2.0, BSD, ISC, PostgreSQL License, MPL-2.0, UPL-1.0, CC0-1.0. No GPL, AGPL, or copyleft licenses.

---

## 19. User Stories

1. **As an administrator**, I want to import point metadata from a CSV exported by our CMMS, so that I can bulk-create points in I/O without manual entry.

2. **As an administrator**, I want to connect to our MSSQL event historian and schedule automatic event imports every 5 minutes, so that alarm data is continuously available in I/O for correlation with real-time point data.

3. **As an administrator**, I want to preview 10 rows of transformed data before committing an import, so that I can verify my field mappings and transformations are correct.

4. **As an administrator**, I want to import equipment maintenance schedules from our ERP system's REST API, so that maintenance events can be correlated with process anomalies in the Forensics module.

5. **As an administrator**, I want to configure watermark-based incremental imports, so that each scheduled run only imports new or changed records from the source.

6. **As an administrator**, I want bad rows to be quarantined with their original source data preserved, so that I can review, fix, and re-import them without losing information.

7. **As an administrator**, I want to import historical time-series data from a legacy PI historian export (CSV), so that years of archived data are available for trend analysis in I/O.

8. **As an administrator**, I want to set up a dependency chain where Import B runs only after Import A completes, so that reference data is loaded before the data that references it.

9. **As an administrator**, I want to connect to an Oracle database used by our change management system and import work order data on a daily schedule.

10. **As a power user**, I want to view the history of import runs and drill down into errors, so that I can monitor data quality and report issues to the administrator.

11. **As an administrator**, I want the system to auto-suggest field mappings based on column name similarity, so that configuring a new import is faster.

12. **As an administrator**, I want to write a Rhai expression to transform OPC quality codes into human-readable labels during import, so that imported event data uses consistent quality terminology.

---

## 20. Success Criteria

- [ ] Administrators can create, configure, and execute imports without writing code
- [ ] Import connections support the 4 native database drivers (PostgreSQL, MSSQL, MySQL, Oracle) plus ODBC fallback
- [ ] CSV, Excel, JSON, and XML files can be imported via file upload
- [ ] REST API connections support authentication (Basic, Bearer, OAuth 2.0 Client Credentials)
- [ ] Field mappings can be auto-suggested and manually configured via grid UI
- [ ] Built-in transforms cover type conversion, string operations, date parsing, and static mapping
- [ ] Rhai expressions handle custom transformation logic with safety limits
- [ ] JSON Schema validation catches data quality issues before loading
- [ ] Preview and dry-run modes prevent bad data from reaching production tables
- [ ] Watermark-based incremental imports avoid re-processing unchanged data
- [ ] Cron-based scheduling runs imports on configurable intervals
- [ ] Error handling supports configurable strategies (stop, skip, quarantine, threshold)
- [ ] Import history provides complete run statistics and per-row error details
- [ ] The Import Service runs as an independent process that does not impact OPC or Event Service performance
- [ ] All Rust crate dependencies are on the approved license list

---

## 21. Integration Points

The Universal Import Interface touches the following design documents:

| Document | Integration |
|---|---|
| **01_TECHNOLOGY_STACK** | New crates (odbc-api, calamine, jsonschema, strsim, cron, notify, etc.) |
| **02_SYSTEM_ARCHITECTURE** | Import Service as 7th service (Port 3006), QoS tier diagram |
| **03_SECURITY_RBAC** | 4 new permissions (59 → 63 total) |
| **04_DATABASE_DESIGN** | 6 new tables, indexes, triggers |
| **05_DEVELOPMENT_PHASES** | New phase for Import Service development |
| **12_FORENSICS_MODULE** | Custom import data available for correlation analysis |
| **15_SETTINGS_MODULE** | Imports tab in Settings UI |
| **17_OPC_INTEGRATION** | Shared `upsert_point_from_source()` for point metadata imports |
| **18_TIMESERIES_DATA** | Bulk writes to `points_history_raw` for historical backfill |
| **21_API_DESIGN** | `/api/imports/*` endpoint namespace |
| **22_DEPLOYMENT_GUIDE** | Import Service systemd unit, ODBC driver requirements, Oracle Instant Client |
| **23_EXPRESSION_BUILDER** | Rhai engine reuse for custom transforms |

---

## 22. Data Links

### 22.1 Overview

Data Links are admin-configured correlations between any two imported datasets. They declare that "Column A in Dataset X corresponds to Column B in Dataset Y," enabling the system to traverse between datasets that have no direct foreign key relationship.

Data Links are the universal mechanism for cross-source data correlation in I/O. They power the Point Detail popup (doc 32), enable cross-source queries in Reports and Forensics, and support inventory/maintenance/ticketing correlation that would otherwise require custom code.

### 22.2 Point Column Designator

Each import definition can optionally designate a **point column** — a column in the source data whose values match `points_metadata.tag_name` in I/O. This is the anchor that connects any imported dataset back to the core process data model.

- Configured during import wizard setup (new step after field mapping)
- Stored on `import_definitions.point_column` (nullable VARCHAR)
- An optional **transform pipeline** (`import_definitions.point_column_transforms`) normalizes the values before matching. Example: OPC tags are `FIC-301.PV` but the CMMS stores `FIC301` — transforms strip the dot-suffix and remove dashes.

**Datasets without a point column** are still useful — they connect to point data through Data Links. The system follows the link chain until it reaches a dataset that *does* have a point column.

**Config-time validation**: When an admin adds a dataset to the Point Detail configuration that has no point column, the system traces the link chain. If no path reaches a dataset with a designated point column, an error is shown: *"Cannot resolve [DatasetName] to point data — no link chain reaches a dataset with a point column. Add a Data Link or designate a point column."*

### 22.3 Link Definition

Each Data Link connects a column in one dataset to a column in another:

| Field | Description |
|-------|-------------|
| **Name** | Human-readable label (e.g., "CMMS Parts → ERP Inventory") |
| **Source dataset** | Import definition, selected by name (e.g., "RefineryBMaximo01") |
| **Source column** | Column in the source dataset |
| **Target dataset** | Import definition, selected by name (e.g., "Site7SAP02") |
| **Target column** | Column in the target dataset |
| **Source transforms** | Optional transform pipeline applied to source values before matching |
| **Target transforms** | Optional transform pipeline applied to target values before matching |
| **Match type** | `exact`, `case_insensitive`, or `transformed` (match after applying transforms) |
| **Bidirectional** | Whether the link works in both directions (default: yes) |

Links are **app-wide** — once created, they are available to Point Detail, Reports, Forensics, Dashboards, and any module that queries cross-source data. This enables queries like "all valves with an alarm in the last month that have open work orders" without custom code.

### 22.4 Transform Pipeline

Transforms normalize column values before matching. They are presented to the admin as **stackable plain-English operations** (chip stack UI), not regex:

| Transform | Description | Example |
|-----------|-------------|---------|
| Remove dashes | Strip all `-` | `FIC-301` → `FIC301` |
| Remove underscores | Strip all `_` | `TI_101A` → `TI101A` |
| Remove spaces | Strip whitespace | `FIC 301` → `FIC301` |
| Remove non-alphanumeric | Letters and numbers only | `FIC-301.PV` → `FIC301PV` |
| Uppercase | Convert to uppercase | `fic-301` → `FIC-301` |
| Lowercase | Convert to lowercase | `FIC-301` → `fic-301` |
| Strip after dot | Remove `.` and everything right | `FIC-301.PV` → `FIC-301` |
| Strip after slash | Remove last `/` and everything right | `UNIT2/FIC301/PV` → `UNIT2/FIC301` |
| Strip before slash | Remove everything left of last `/` | `UNIT2/FIC301/PV` → `PV` |
| Strip prefix | Remove a specified prefix string | `TAG_FIC301` → `FIC301` |
| Strip suffix | Remove a specified suffix string | `FIC301_RAW` → `FIC301` |
| Remove leading zeros | Strip leading `0`s from numeric segments | `FIC-0301` → `FIC-301` |
| Custom pattern | Regex — escape hatch for power users | Freeform |

Transforms are applied at **query time** — raw imported data stays untouched. The link configuration stores the ordered transform list.

**Live preview**: When configuring transforms, the UI shows a before/after preview using 5 sample values from each side of the link. If nothing matches in preview, the admin knows the transforms need adjustment.

The same transform pipeline is used for both Data Link matching and Point Column designation.

### 22.5 Link Traversal

When the system needs to resolve data for a point (e.g., for Point Detail), it:

1. Gets the point's `tag_name` from `points_metadata`
2. Finds all import definitions with a designated `point_column` → queries each for rows matching this tag name (applying point column transforms)
3. For datasets without a point column, follows Data Links: find link chains that lead to a dataset with a point column
4. Traversal terminates when a dataset with a point column is reached — no further links are followed beyond that point
5. Returns the correlated rows from each dataset

**Traversal depth**: The point column designator is the chain terminator. The system never searches beyond a dataset that has a point column. This prevents circular or runaway chains without needing an explicit depth limit. Circular link detection (A→B→C→A) is enforced at link creation time.

**Performance**: Each link traversal is an indexed JOIN between two columns. With typical data volumes (thousands to tens of thousands of rows per dataset), each hop completes in <10ms. All dataset queries run in parallel.

### 22.6 Settings UI — Data Links

Located in **Settings > Integrations > Data Links** (tab alongside Import Connections and Import Definitions).

**Link list view**: Table showing all configured links with name, source dataset → target dataset, match type, enabled toggle. "Test" button per link shows match statistics.

**Add/Edit link wizard**:

1. **Pick source**: Dropdown of import definitions by name → pick a column
2. **Pick target**: Dropdown of import definitions by name → pick a column
3. **Configure transforms**: Chip stack builder with live preview (5 sample values from each side)
4. **Test**: Show match count, sample matches, unmatched records count, multi-match warnings
5. **Save**

```
┌─────────────────────────────────────────────────────────┐
│  New Data Link                                           │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  Source:  [RefineryBMaximo01 ▼]  Column: [part_number ▼] │
│  Target:  [Site7SAP02 ▼]        Column: [material_no ▼] │
│                                                          │
│  Source Transforms: [Uppercase ×] [+ Add ▼]              │
│  Target Transforms: [Uppercase ×] [+ Add ▼]              │
│                                                          │
│  Match Type: (●) Exact  ( ) Case-Insensitive             │
│  ☑ Bidirectional                                         │
│                                                          │
│  TEST RESULTS ──────────────────────────────────────     │
│  ✓ 847 of 1,203 source rows matched                     │
│  ✗ 356 unmatched  ⚠ 12 multi-match                      │
│                                                          │
│  Sample Matches:                                         │
│  ┌──────────────┬──────────────┐                         │
│  │ Source       │ Target       │                         │
│  ├──────────────┼──────────────┤                         │
│  │ BRG-6205-2RS│ BRG-6205-2RS │                         │
│  │ SEAL-CR-123 │ SEAL-CR-123  │                         │
│  └──────────────┴──────────────┘                         │
│                                                          │
│  [Cancel]                    [Save Link]                 │
└─────────────────────────────────────────────────────────┘
```

### 22.7 API Endpoints

| Method | Path | Permission | Description |
|--------|------|-----------|-------------|
| `GET` | `/api/v1/data-links` | `system:import_definitions` | List all data links |
| `POST` | `/api/v1/data-links` | `system:import_definitions` | Create data link |
| `PUT` | `/api/v1/data-links/:id` | `system:import_definitions` | Update data link |
| `DELETE` | `/api/v1/data-links/:id` | `system:import_definitions` | Soft-delete data link |
| `POST` | `/api/v1/data-links/:id/test` | `system:import_definitions` | Test link (returns match statistics and sample matches) |

---

## 23. Future Extensibility

The following capabilities are designed for but not included in the initial implementation (unless noted):

- **Change Data Capture (CDC)**: Real-time database replication via PostgreSQL logical replication (`pg2any` crate, MIT) for continuous synchronization from external PostgreSQL databases. Deferred — niche, most external sources don't expose logical replication.
- **MQTT streaming imports (Phase 3)**: Persistent MQTT consumers that process messages as they arrive rather than on a schedule. Builds on the MQTT client already added for real-time data acquisition (doc 02). Kafka streaming imports remain deferred (separate `rdkafka` dependency).
- **Custom connector SDK**: Allow administrators to define new connector types via Rhai scripts or WASM modules without rebuilding the Import Service.
- **AI-assisted field mapping**: Use historical mapping decisions to train a model that suggests mappings with higher accuracy than string similarity alone.
- **Reverse ETL**: Export I/O data to external systems (push point data to an ERP, publish events to Kafka). Deferred well past launch.
- **Import definition export/import**: Export import definitions (connection configs, field mappings, transforms) as portable JSON packages for re-import into other I/O installations. Post-Universal Import v1 build.
- **Data quality dashboard (v1)**: Aggregate quality metrics across all imports with trend analysis — error rates, record counts, freshness per source, trend charts. Promoted to v1 build.

**Promoted to v1 (moved out of future extensibility):**
- **Visual Import Designer** — late v1 build (see Section 17)
- **Data quality dashboard** — see above

---

## Change Log

- **v0.8**: Replaced 3-column role format (Admin/Power User/User) with "Default Roles" column listing canonical 8-role names. Added doc 03 cross-reference note under permission table.
- **v0.7**: Fixed stale credential storage reference — encryption key now sourced from systemd encrypted credentials (doc 03 master key), not .env file.
- **v0.6**: Deferred items review. DNP3: updated to note from-scratch implementation feasible (~4 weeks) if market expands beyond refinery; existing crate has commercial license. Import Designer promoted to late v1 build. MQTT streaming imports planned for Phase 3 (reuses MQTT client from real-time data acquisition). Data quality dashboard promoted to v1. Import definition export/import added as post-Universal-Import feature. Import templates marketplace replaced with portable export/import. Reverse ETL deferred well past launch.
- **v0.5**: Added Section 22 — Data Links. Generic cross-dataset correlation mechanism: `data_links` table for column-to-column linking between any import datasets. Point Column Designator on `import_definitions` (marks which column contains OPC tag names). Transform Pipeline with 12 built-in stackable transforms (chip stack UI) plus regex fallback. Link traversal logic with point column as chain terminator. Config-time validation catches broken chains. Settings UI wireframe for Data Links configuration. 5 Data Link API endpoints. See doc 32 for Point Detail floating panel and Transform Pipeline components; doc 04 for schema.
- **v0.4**: Added Section 5c — Connector Templates. I/O ships with 40 pre-built connector templates (seed data) that let administrators set up integrations by entering only hostname and credentials. Added `connector_templates` table DDL to Section 5 schema. Added `template_id` and `template_version` provenance columns to `import_definitions`. Added "Step 0" template browser to the import definition wizard with search, domain filtering, dynamic required-fields form, and test connection. Templates support multi-definition creation (one connection → multiple definitions). Added 4 template API endpoints to Section 14. Templates are read-only seed data updated per release; instantiated definitions are independent copies.
- **v0.3**: Added Section 5b — Typed Target Architecture. All imported data targets typed internal tables (work_orders, equipment, tickets, lab_samples, etc.) with uniform schemas regardless of source system. Universal Import handles all source-to-schema transforms. Added `extra_data JSONB` overflow pattern. Equipment table as cross-domain join key. Integration Connector Index linking to `24_integrations/` subfolder with 40 application-specific connector profiles across 8 domains. `custom_import_data` retained as fallback for truly unknown data types.
- **v0.2**: Updated service count from 7 to 11 and architecture diagram to include Alert (3007), Email (3008), Auth (3009), and Recognition (3010) services added since initial doc creation.
- **v0.1**: Initial design. Universal Import Interface with 7th Rust/Axum service (Port 3006), QoS-tiered service architecture (OPC > Events > Import), 60+ connection types across 8 categories, hybrid native+ODBC database strategy, trait-based connector model, linear import pipeline (Extract → Map → Transform → Validate → Load), 6 database tables, 14 authentication mechanisms, JSON Schema validation, Rhai-based custom transforms, Jaro-Winkler auto-mapping, grid-based field mapping UI, 7-step import definition wizard, PostgreSQL-based job scheduling, watermark incremental imports, 4 configurable error strategies, preview/dry-run modes, 4 new RBAC permissions (63 total), ~25 API endpoints, Import Designer placeholder (deferred).
