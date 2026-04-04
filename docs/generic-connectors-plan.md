# Generic Connector Types for the ETL Import Service

## Executive Summary

The import service currently supports only inline CSV and JSON array extraction via
`source_config.data`. All 48 named-system connector templates (SAP, Maximo, ServiceNow,
etc.) seed with `template_config: {}` and produce empty definitions with no working
extraction.

This plan adds six generic connector families that give users a fully functional ETL
pipeline for any data source:

1. **Generic REST API** — arbitrary HTTP endpoints with configurable auth and pagination
2. **File-based** — CSV/TSV, Excel (xlsx), JSON, XML from uploaded files or inline data
3. **SQL databases** — PostgreSQL, MySQL/MariaDB, MSSQL
4. **ODBC fallback** — any ODBC-accessible database
5. **SFTP/FTP** — remote file retrieval feeding into file parsers
6. **MongoDB** — collection queries with BSON-to-JSON extraction

The work is split into four phases. Each phase is self-contained, testable, and
deployable independently. The phasing is ordered by dependency: Phase 1 establishes the
`EtlConnector` trait and pipeline wiring that all subsequent phases depend on; Phase 2
adds file parsing (the most common import path); Phase 3 adds SQL connectors (second most
common); Phase 4 adds the long-tail connectors (ODBC, SFTP, MongoDB).

**Expected outcome:** After all four phases, users can create a connection to any of these
generic source types from the UI, test it, discover its schema, and run scheduled ETL
imports through the existing pipeline.

---

## Phase 1: EtlConnector Trait + Generic REST + Pipeline Wiring

### Goal

Establish the `EtlConnector` trait, wire it into `extract_records()` in the pipeline,
implement the Generic REST connector, and update `test_connection` / `discover_schema`
handlers to dispatch to ETL connectors.

### Files to CREATE

| Path | Purpose |
|------|---------|
| `services/import-service/src/connectors/etl/mod.rs` | `EtlConnector` trait definition, `get_etl_connector()` registry, `EtlConnectorConfig` struct |
| `services/import-service/src/connectors/etl/rest.rs` | Generic REST API connector implementation |
| `migrations/20260405000001_generic_connector_domains.up.sql` | Add `generic_api`, `generic_file`, `generic_database` domains to CHECK constraint |
| `migrations/20260405000001_generic_connector_domains.down.sql` | Rollback |

### Files to MODIFY

| Path | Change |
|------|--------|
| `services/import-service/src/connectors/mod.rs` | Add `pub mod etl;` module declaration |
| `services/import-service/src/pipeline.rs` | Update `extract_records()` to accept `db`, `connection_id`, `master_key`; add ETL connector dispatch |
| `services/import-service/src/handlers/import.rs` | Update `test_connection` to try `get_etl_connector()` when DCS connector not found; update `discover_schema` to dispatch to `EtlConnector::discover_schema()` |
| `services/import-service/src/main.rs` | Add `generic-rest-api` template seed; update seed upsert to also update `template_config` |
| `services/import-service/Cargo.toml` | No new crates needed (reqwest already in workspace) |

### Cargo.toml Additions

None for Phase 1. `reqwest` (with JSON feature), `serde_json`, and `async-trait` are
already workspace dependencies.

### New Trait and Struct Definitions

```rust
// services/import-service/src/connectors/etl/mod.rs

pub mod rest;

use anyhow::Result;
use serde_json::Value as JsonValue;
use uuid::Uuid;

use crate::pipeline::SourceRecord;
use crate::handlers::import::{SchemaTable, SchemaField};

/// Config assembled from import_connections row + import_definitions.source_config.
/// The connection holds credentials; the definition holds the query/path/endpoint.
#[derive(Debug, Clone)]
pub struct EtlConnectorConfig {
    pub connection_id: Uuid,
    /// Full `import_connections.config` JSONB (base_url, host, port, database, etc.)
    pub connection_config: JsonValue,
    /// Auth type from import_connections.auth_type
    pub auth_type: String,
    /// Decrypted auth_config JSONB from import_connections
    pub auth_config: JsonValue,
    /// The import_definitions.source_config JSONB (query, endpoint path, file_id, etc.)
    pub source_config: JsonValue,
    /// Upload directory for file-backed connectors (from Config)
    pub upload_dir: String,
}

/// Trait that all ETL extraction connectors implement.
/// Separate from DcsConnector — this produces SourceRecords for the ETL pipeline.
#[async_trait::async_trait]
pub trait EtlConnector: Send + Sync {
    /// Identifier for this connector type (e.g. "generic_rest", "postgresql", "csv_file")
    fn connector_type(&self) -> &'static str;

    /// Test that the connection credentials are valid and the source is reachable.
    /// Uses only connection-level config (not source_config).
    async fn test_connection(&self, cfg: &EtlConnectorConfig) -> Result<()>;

    /// Discover available tables/collections/endpoints and their fields.
    /// Returns empty vec if discovery is not supported for this type.
    async fn discover_schema(&self, cfg: &EtlConnectorConfig) -> Result<Vec<SchemaTable>>;

    /// Extract records from the source using the definition's source_config.
    /// This is the main extraction method called by the pipeline.
    async fn extract(&self, cfg: &EtlConnectorConfig) -> Result<Vec<SourceRecord>>;
}

/// Registry: map connection_type string to an EtlConnector implementation.
pub fn get_etl_connector(connection_type: &str) -> Option<Box<dyn EtlConnector>> {
    match connection_type {
        "generic_rest" => Some(Box::new(rest::GenericRestConnector)),
        // Phase 2: "csv_file", "tsv_file", "excel_file", "json_file", "xml_file"
        // Phase 3: "postgresql", "mysql", "mssql"
        // Phase 4: "odbc", "sftp", "ftp", "mongodb"
        _ => None,
    }
}
```

### Pipeline Wiring (`pipeline.rs`)

Change `extract_records()` from:

```rust
async fn extract_records(source_config: &JsonValue) -> Result<Vec<SourceRecord>>
```

To:

```rust
async fn extract_records(
    db: &PgPool,
    source_config: &JsonValue,
    connection_id: Option<Uuid>,
    master_key: &[u8; 32],
    upload_dir: &str,
) -> Result<Vec<SourceRecord>>
```

Logic inside:
1. If `source_config.source_type` is `"csv"` or `"json_array"` → existing inline extractors (unchanged).
2. If `connection_id` is `Some(id)` → fetch the connection row, build `EtlConnectorConfig` (decrypting auth_config), dispatch to `get_etl_connector(connection_type)`, call `connector.extract(&cfg).await`.
3. Otherwise → return empty with DD-24-002 log.

The `execute()` function must pass `db`, `connection_id` (from the definition row), and `master_key` through to `run_pipeline_in_tx` and then to `extract_records`. Add `connection_id` to the definition fetch query:

```sql
SELECT connection_id, source_config, field_mappings, transforms, target_table
FROM import_definitions WHERE id = $1
```

### `test_connection` Handler Changes (`handlers/import.rs`)

Add ETL connector dispatch branch after the existing DCS connector check:

```rust
if let Some(connector) = connectors::get_connector(&connection_type) {
    // existing DCS path (unchanged)
} else if let Some(etl) = connectors::etl::get_etl_connector(&connection_type) {
    let etl_cfg = EtlConnectorConfig {
        connection_id: id,
        connection_config: config.clone(),
        auth_type: auth_type.clone(),
        auth_config: decrypted_auth_config,
        source_config: JsonValue::Null, // test doesn't need source_config
        upload_dir: state.config.upload_dir.clone(),
    };
    match etl.test_connection(&etl_cfg).await {
        Ok(()) => ("connected".to_string(), "Connection successful".to_string()),
        Err(e) => ("error".to_string(), e.to_string()),
    }
} else {
    ("error".to_string(), format!("Connection test not supported for type '{connection_type}'"))
}
```

### `discover_schema` Handler Changes (`handlers/import.rs`)

Replace the empty stub with ETL connector dispatch:

```rust
if let Some(etl) = connectors::etl::get_etl_connector(&connection_type) {
    let etl_cfg = /* build EtlConnectorConfig from connection row */;
    match etl.discover_schema(&etl_cfg).await {
        Ok(tables) => Json(ApiResponse::ok(tables)).into_response(),
        Err(e) => IoError::Internal(format!("Schema discovery failed: {e}")).into_response(),
    }
} else {
    Json(ApiResponse::ok(Vec::<SchemaTable>::new())).into_response()
}
```

### Generic REST Connector (`connectors/etl/rest.rs`)

```rust
pub struct GenericRestConnector;

impl GenericRestConnector {
    fn base_url(cfg: &EtlConnectorConfig) -> Result<&str> {
        cfg.connection_config.get("base_url")
            .and_then(|v| v.as_str())
            .ok_or_else(|| anyhow!("base_url is required"))
    }

    fn build_request_url(base: &str, endpoint: &str) -> String {
        if endpoint.is_empty() { return base.to_string(); }
        if endpoint.starts_with("http") { return endpoint.to_string(); }
        format!("{}/{}", base.trim_end_matches('/'), endpoint.trim_start_matches('/'))
    }
}

#[async_trait::async_trait]
impl EtlConnector for GenericRestConnector {
    fn connector_type(&self) -> &'static str { "generic_rest" }

    async fn test_connection(&self, cfg: &EtlConnectorConfig) -> Result<()> {
        let url = Self::base_url(cfg)?;
        let client = reqwest::Client::new();
        let resp = apply_auth_etl(client.get(url), cfg).send().await?;
        if !resp.status().is_success() {
            return Err(anyhow!("generic_rest: test_connection: HTTP {}", resp.status()));
        }
        Ok(())
    }

    async fn discover_schema(&self, cfg: &EtlConnectorConfig) -> Result<Vec<SchemaTable>> {
        let records = self.extract(cfg).await?;
        if let Some(first) = records.first() {
            let fields = first.fields.keys()
                .map(|k| SchemaField { name: k.clone(), data_type: "string".into() })
                .collect();
            Ok(vec![SchemaTable { name: "response".into(), fields }])
        } else {
            Ok(vec![])
        }
    }

    async fn extract(&self, cfg: &EtlConnectorConfig) -> Result<Vec<SourceRecord>> {
        let base = Self::base_url(cfg)?;
        let endpoint = cfg.source_config.get("endpoint").and_then(|v| v.as_str()).unwrap_or("");
        let url = Self::build_request_url(base, endpoint);
        let method = cfg.source_config.get("method").and_then(|v| v.as_str()).unwrap_or("GET");
        let pagination_type = cfg.source_config.get("pagination_type").and_then(|v| v.as_str()).unwrap_or("none");
        let records_path = cfg.source_config.get("records_path").and_then(|v| v.as_str()).unwrap_or("");
        let max_pages = cfg.source_config.get("max_pages").and_then(|v| v.as_u64()).unwrap_or(100) as usize;
        let page_size = cfg.source_config.get("page_size").and_then(|v| v.as_u64()).unwrap_or(100);

        let client = reqwest::Client::new();
        let mut all_records: Vec<SourceRecord> = Vec::new();
        let mut next_url: Option<String> = Some(url.clone());
        let mut offset: u64 = 0;
        let mut page = 0usize;

        while let Some(current_url) = next_url.take() {
            if page >= max_pages { break; }
            let req = match method.to_uppercase().as_str() {
                "POST" => {
                    let body = cfg.source_config.get("request_body").cloned().unwrap_or(JsonValue::Null);
                    client.post(&current_url).json(&body)
                }
                _ => client.get(&current_url),
            };
            let resp = apply_auth_etl(req, cfg).send().await?;
            if !resp.status().is_success() {
                return Err(anyhow!("generic_rest: extract: HTTP {} from {}", resp.status(), current_url));
            }
            let body: JsonValue = resp.json().await?;
            let data = extract_by_path(&body, records_path);
            let arr: Vec<JsonValue> = match data {
                v if v.is_array() => v.as_array().unwrap().clone(),
                v if v.is_object() => vec![v.clone()],
                _ => vec![],
            };
            for item in &arr {
                if let Some(map) = item.as_object() {
                    all_records.push(SourceRecord {
                        row_number: (all_records.len() + 1) as i64,
                        raw: item.to_string(),
                        fields: map.iter().map(|(k, v)| (k.clone(), v.clone())).collect(),
                    });
                }
            }
            // Advance pagination
            match pagination_type {
                "cursor" => {
                    let cursor_path = cfg.source_config.get("cursor_path").and_then(|v| v.as_str()).unwrap_or("next");
                    if let Some(next_str) = extract_by_path(&body, cursor_path).as_str() {
                        if !next_str.is_empty() {
                            next_url = Some(if next_str.starts_with("http") {
                                next_str.to_string()
                            } else {
                                format!("{}?cursor={}", url, next_str)
                            });
                        }
                    }
                }
                "offset_limit" => {
                    if arr.len() as u64 >= page_size {
                        offset += page_size;
                        let sep = if url.contains('?') { "&" } else { "?" };
                        next_url = Some(format!("{}{}offset={}&limit={}", url, sep, offset, page_size));
                    }
                }
                _ => { /* none — single page */ }
            }
            page += 1;
        }
        Ok(all_records)
    }
}

/// Apply ETL connector auth to a reqwest::RequestBuilder.
fn apply_auth_etl(builder: reqwest::RequestBuilder, cfg: &EtlConnectorConfig) -> reqwest::RequestBuilder {
    match cfg.auth_type.as_str() {
        "basic" => {
            let u = cfg.auth_config.get("username").and_then(|v| v.as_str()).unwrap_or("");
            let p = cfg.auth_config.get("password").and_then(|v| v.as_str()).unwrap_or("");
            builder.basic_auth(u, Some(p))
        }
        "bearer_token" => {
            let t = cfg.auth_config.get("bearer_token")
                .or_else(|| cfg.auth_config.get("token"))
                .and_then(|v| v.as_str()).unwrap_or("");
            builder.bearer_auth(t)
        }
        "api_key_header" | "api_key" => {
            let key = cfg.auth_config.get("api_key").and_then(|v| v.as_str()).unwrap_or("");
            let header = cfg.auth_config.get("api_key_header_name").and_then(|v| v.as_str()).unwrap_or("X-Api-Key");
            builder.header(header, key)
        }
        _ => builder,
    }
}

/// Navigate a serde_json::Value by dot-separated path (e.g. "data.results").
fn extract_by_path<'a>(value: &'a JsonValue, path: &str) -> &'a JsonValue {
    if path.is_empty() { return value; }
    let mut cur = value;
    for key in path.split('.') {
        cur = match cur.get(key) { Some(v) => v, None => return &JsonValue::Null };
    }
    cur
}
```

### source_config Schema: Generic REST

`import_connections.config`:
```json
{ "base_url": "https://api.example.com" }
```

`import_connections.auth_config` (encrypted):
```json
{ "username": "user", "password": "...", "bearer_token": "...", "api_key": "...", "api_key_header_name": "X-Api-Key" }
```

`import_definitions.source_config`:
```json
{
  "source_type": "generic_rest",
  "endpoint": "/api/v1/work-orders",
  "method": "GET",
  "request_body": null,
  "records_path": "data.results",
  "pagination_type": "offset_limit",
  "page_size": 100,
  "max_pages": 50,
  "cursor_path": "meta.next_cursor"
}
```

### Connector Template: `generic-rest-api`

```rust
// In seed_connector_templates() in main.rs
(
    "generic-rest-api",
    "Generic REST API",
    "generic_api",
    "Generic",
    "Import data from any REST API endpoint with configurable authentication and pagination.",
    &["custom_import_data"],
    r##"[
        {"key":"base_url","label":"Base URL","placeholder":"https://api.example.com","type":"text"},
        {"key":"auth_type","label":"Authentication Type","type":"select","options":[
            {"value":"none","label":"None"},
            {"value":"basic","label":"Basic Auth"},
            {"value":"bearer_token","label":"Bearer Token"},
            {"value":"api_key_header","label":"API Key (Header)"}
        ]},
        {"key":"username","label":"Username (Basic Auth)","type":"text"},
        {"key":"password","label":"Password (Basic Auth)","type":"secret"},
        {"key":"bearer_token","label":"Bearer Token","type":"secret"},
        {"key":"api_key","label":"API Key","type":"secret"},
        {"key":"api_key_header_name","label":"API Key Header Name","placeholder":"X-Api-Key","type":"text"}
    ]"##,
    // template_config — enables instantiate to create a working connection+definition:
    r##"{
        "connection": { "base_url": "{{base_url}}" },
        "auth_type": "{{auth_type}}",
        "auth_config": {
            "username": "{{username}}",
            "password": "{{password}}",
            "bearer_token": "{{bearer_token}}",
            "api_key": "{{api_key}}",
            "api_key_header_name": "{{api_key_header_name}}"
        },
        "definitions": [{
            "name": "REST API Import",
            "source_config": {
                "source_type": "generic_rest",
                "endpoint": "",
                "method": "GET",
                "records_path": "",
                "pagination_type": "none",
                "max_pages": 100
            },
            "target_table": "custom_import_data"
        }]
    }"##,
)
```

**Important:** Update the seed upsert SQL (currently `ON CONFLICT (slug) DO UPDATE SET required_fields = EXCLUDED.required_fields`) to also update `template_config`:

```sql
ON CONFLICT (slug) DO UPDATE
SET required_fields = EXCLUDED.required_fields,
    template_config = EXCLUDED.template_config,
    description = EXCLUDED.description
```

### DB Migration (Phase 1)

```sql
-- migrations/20260405000001_generic_connector_domains.up.sql
ALTER TABLE connector_templates
    DROP CONSTRAINT IF EXISTS connector_templates_domain_check;

ALTER TABLE connector_templates
    ADD CONSTRAINT connector_templates_domain_check
        CHECK (domain IN (
            'maintenance', 'equipment', 'access_control', 'erp_financial',
            'ticketing', 'environmental', 'lims_lab', 'regulatory',
            'dcs_supplemental',
            'generic_api', 'generic_file', 'generic_database'
        ));
```

```sql
-- migrations/20260405000001_generic_connector_domains.down.sql
ALTER TABLE connector_templates
    DROP CONSTRAINT IF EXISTS connector_templates_domain_check;

ALTER TABLE connector_templates
    ADD CONSTRAINT connector_templates_domain_check
        CHECK (domain IN (
            'maintenance', 'equipment', 'access_control', 'erp_financial',
            'ticketing', 'environmental', 'lims_lab', 'regulatory',
            'dcs_supplemental'
        ));
```

---

## Phase 2: File-Based Connectors

### Goal

Support CSV/TSV, Excel (xlsx), JSON (array/NDJSON), and XML file imports from
already-uploaded `file_id` references or inline data. Wire the existing `/upload` endpoint
into the pipeline.

### Files to CREATE

| Path | Purpose |
|------|---------|
| `services/import-service/src/connectors/etl/file_csv.rs` | CSV/TSV connector (file_id or inline) |
| `services/import-service/src/connectors/etl/file_excel.rs` | Excel (xlsx/xls) connector |
| `services/import-service/src/connectors/etl/file_json.rs` | JSON array / NDJSON connector |
| `services/import-service/src/connectors/etl/file_xml.rs` | XML connector with simple path-based extraction |

### Files to MODIFY

| Path | Change |
|------|--------|
| `services/import-service/src/connectors/etl/mod.rs` | Add module declarations; register `"csv_file"`, `"tsv_file"`, `"excel_file"`, `"json_file"`, `"xml_file"` |
| `services/import-service/src/main.rs` | Add 5 new template seeds |
| `services/import-service/Cargo.toml` | Add `calamine`, `csv`, `quick-xml` |
| `frontend/src/api/import.ts` | Add `"textarea"` to `TemplateFieldDef.type` union |
| `frontend/src/pages/settings/Import.tsx` | Add `textarea` rendering branch in `TemplateField` component |

### Cargo.toml Additions

```toml
calamine = "0.26"          # MIT — Excel xlsx/xls reading
csv = "1.3"                # MIT/Unlicense — CSV/TSV streaming parser
quick-xml = { version = "0.36", features = ["serialize"] }  # MIT — XML parsing
```

### File Resolution Helper (shared by all file connectors)

```rust
/// Resolve file content from an uploaded file_id or inline source_config.data.
async fn resolve_file_content(source_config: &JsonValue, upload_dir: &str) -> Result<Vec<u8>> {
    if let Some(file_id) = source_config.get("file_id").and_then(|v| v.as_str()) {
        let mut entries = tokio::fs::read_dir(upload_dir).await?;
        while let Some(entry) = entries.next_entry().await? {
            if entry.file_name().to_string_lossy().starts_with(file_id) {
                return Ok(tokio::fs::read(entry.path()).await?);
            }
        }
        Err(anyhow!("Uploaded file not found: file_id={file_id}"))
    } else if let Some(data) = source_config.get("data").and_then(|v| v.as_str()) {
        Ok(data.as_bytes().to_vec())
    } else {
        Err(anyhow!("Either file_id or inline data is required"))
    }
}
```

### source_config Schemas

**CSV/TSV (`csv_file` / `tsv_file`):**
```json
{
  "source_type": "csv_file",
  "file_id": "a1b2c3d4-...",
  "delimiter": ",",
  "has_header": true,
  "encoding": "utf-8",
  "skip_rows": 0
}
```

**Excel (`excel_file`):**
```json
{
  "source_type": "excel_file",
  "file_id": "a1b2c3d4-...",
  "sheet_name": "Sheet1",
  "sheet_index": 0,
  "header_row": 0
}
```

**JSON file (`json_file`):**
```json
{
  "source_type": "json_file",
  "file_id": "a1b2c3d4-...",
  "format": "array",
  "records_path": "data.items"
}
```
(`format` = `"array"` or `"ndjson"`)

**XML file (`xml_file`):**
```json
{
  "source_type": "xml_file",
  "file_id": "a1b2c3d4-...",
  "record_element": "item",
  "field_elements": ["Name", "Value", "Status"]
}
```

### New Template Seeds

| Slug | Name | Domain | Required Fields |
|------|------|--------|-----------------|
| `generic-csv-file` | CSV File Import | `generic_file` | file_id, delimiter (select), has_header (select) |
| `generic-tsv-file` | TSV File Import | `generic_file` | file_id |
| `generic-excel-file` | Excel (XLSX) File Import | `generic_file` | file_id, sheet_name |
| `generic-json-file` | JSON File Import | `generic_file` | file_id, records_path |
| `generic-xml-file` | XML File Import | `generic_file` | file_id, record_element |

### Frontend: `textarea` Field Type

`frontend/src/api/import.ts`:
```typescript
type: "text" | "secret" | "number" | "select" | "textarea";
```

`frontend/src/pages/settings/Import.tsx` — add branch in `TemplateField`:
```tsx
if (field.type === "textarea") {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={field.placeholder ?? ""}
      rows={4}
      style={{ ...inputStyle, resize: "vertical", fontFamily: "monospace" }}
    />
  );
}
```

### Implementation Notes

**CSV with `csv` crate:** Use `csv::ReaderBuilder` with configurable `delimiter`. If `has_header` is false, generate synthetic names (`col_0`, `col_1`, ...).

**Excel with `calamine`:** `calamine::open_workbook_auto_from_rs(Cursor::new(bytes))`. Read sheet by name or index. First non-skipped row provides column headers.

**XML with `quick-xml`:** Parse document, find all `<{record_element}>` elements, extract named child text nodes as fields.

---

## Phase 3: SQL Database Connectors

### Goal

Support PostgreSQL, MySQL/MariaDB, and MSSQL as ETL sources via user-supplied SQL queries.

### Files to CREATE

| Path | Purpose |
|------|---------|
| `services/import-service/src/connectors/etl/sql_postgres.rs` | PostgreSQL via sqlx (already in workspace) |
| `services/import-service/src/connectors/etl/sql_mysql.rs` | MySQL/MariaDB via mysql_async |
| `services/import-service/src/connectors/etl/sql_mssql.rs` | MSSQL via tiberius |

### Files to MODIFY

| Path | Change |
|------|--------|
| `services/import-service/src/connectors/etl/mod.rs` | Register `"postgresql"`, `"mysql"`, `"mssql"` |
| `services/import-service/src/main.rs` | Add 3 new template seeds |
| `services/import-service/Cargo.toml` | Add `mysql_async`, `tiberius`, `tokio-util` with `compat` feature |

### Cargo.toml Additions

```toml
mysql_async = "0.34"                                          # MIT — MySQL/MariaDB async driver
tiberius = { version = "0.12", features = ["rustls"] }       # MIT — MSSQL TDS protocol
tokio-util = { version = "0.7", features = ["compat"] }      # MIT — TokioAsyncWriteCompatExt for tiberius
```

Note: `sqlx` with postgres features is already in the workspace. No additional postgres crate needed.

### source_config Schemas

`import_connections.config` (all 3 types):
```json
{ "host": "db.example.com", "port": 5432, "database": "prod", "ssl_mode": "require" }
```

`import_connections.auth_config`:
```json
{ "username": "readonly", "password": "$enc:..." }
```

`import_definitions.source_config`:
```json
{
  "source_type": "postgresql",
  "query": "SELECT id, name, status FROM work_orders WHERE created_at > '2024-01-01'",
  "max_rows": 50000
}
```

### New Template Seeds

| Slug | Name | Domain | Default Port |
|------|------|--------|--------------|
| `generic-postgresql` | PostgreSQL Database | `generic_database` | 5432 |
| `generic-mysql` | MySQL / MariaDB Database | `generic_database` | 3306 |
| `generic-mssql` | Microsoft SQL Server | `generic_database` | 1433 |

All three templates include `required_fields`: host, port (number), database, username, password (secret), ssl_mode (select), and a `template_config` that wires connection config + a definition with an empty `query` field.

### Schema Discovery for SQL Connectors

Query `information_schema.columns` (standard across all three):
```sql
SELECT table_schema, table_name, column_name, data_type
FROM information_schema.columns
WHERE table_schema NOT IN ('pg_catalog', 'information_schema', 'sys', 'INFORMATION_SCHEMA')
ORDER BY table_schema, table_name, ordinal_position
```

Group into `Vec<SchemaTable>` with `name = "schema.table_name"`.

### Implementation Notes

**PostgreSQL:** Create a per-connection `PgPool` with `max_connections(2)` and 10s connect timeout. Build connection string from `host`, `port`, `database`, `username`, `password`, `ssl_mode`. Execute user query with `sqlx::query(sql).fetch_all(&pool)`. Convert each `PgRow` to `SourceRecord` by iterating `row.columns()` and calling `row.try_get::<serde_json::Value, _>(idx)` per column.

**Security:** Wrap user queries in `SET TRANSACTION READ ONLY` for PostgreSQL. For MySQL, use `SET SESSION TRANSACTION READ ONLY` before the query. For MSSQL, document that the connection user should have read-only permissions.

**MSSQL with tiberius:** `tiberius::Client::connect(config, tcp_stream.compat_write())`. Use `tokio::net::TcpStream::connect(addr)` and `.compat_write()` via `tokio_util::compat`. Execute with `client.query(sql, &[])` and iterate `Row` objects. Convert `ColumnData` enum variants to `serde_json::Value` via pattern matching.

**MySQL with mysql_async:** `mysql_async::Pool::new(opts)` where opts built from `mysql_async::OptsBuilder`. Execute with `conn.query_iter(sql)` mapping rows to `SourceRecord`.

---

## Phase 4: ODBC, SFTP/FTP, MongoDB

### Goal

Add long-tail connectors for ODBC-accessible databases, remote file retrieval via SFTP/FTP, and MongoDB collection queries.

### Files to CREATE

| Path | Purpose |
|------|---------|
| `services/import-service/src/connectors/etl/odbc.rs` | ODBC via odbc-api + spawn_blocking |
| `services/import-service/src/connectors/etl/sftp.rs` | SFTP/FTP remote file + file parser dispatch |
| `services/import-service/src/connectors/etl/mongodb.rs` | MongoDB collection queries |

### Files to MODIFY

| Path | Change |
|------|--------|
| `services/import-service/src/connectors/etl/mod.rs` | Register `"odbc"`, `"sftp"`, `"ftp"`, `"mongodb"` |
| `services/import-service/src/main.rs` | Add 3 new template seeds |
| `services/import-service/src/crypto.rs` | Add `"connection_string"` to `SENSITIVE_FIELDS` |
| `services/import-service/Cargo.toml` | Add `odbc-api`, `russh`, `russh-sftp`, `mongodb` |

### Cargo.toml Additions

```toml
odbc-api = "8"                                              # MIT — ODBC driver interface (unixODBC)
russh = "0.46"                                              # Apache-2.0 — SSH transport
russh-sftp = "2.1"                                          # Apache-2.0 — SFTP over SSH
mongodb = { version = "3.1", features = ["tokio-runtime"] } # Apache-2.0 — MongoDB async driver
```

### source_config Schemas

**ODBC:**

`import_connections.config`:
```json
{ "connection_string": "Driver={ODBC Driver 18 for SQL Server};Server=...;Database=...;" }
```

`import_definitions.source_config`:
```json
{ "source_type": "odbc", "query": "SELECT * FROM table", "max_rows": 50000 }
```

**SFTP:**

`import_connections.config`:
```json
{ "host": "sftp.example.com", "port": 22, "protocol": "sftp" }
```

`import_definitions.source_config`:
```json
{
  "source_type": "sftp",
  "remote_path": "/exports/daily.csv",
  "file_format": "csv",
  "delimiter": ","
}
```

**MongoDB:**

`import_connections.config`:
```json
{ "connection_string": "mongodb://host:27017", "database": "production" }
```

`import_definitions.source_config`:
```json
{
  "source_type": "mongodb",
  "collection": "work_orders",
  "filter": { "status": "open" },
  "projection": { "_id": 0, "name": 1, "status": 1 },
  "max_rows": 50000
}
```

### New Template Seeds

| Slug | Name | Domain |
|------|------|--------|
| `generic-odbc` | ODBC Database (Snowflake, DB2, Teradata, etc.) | `generic_database` |
| `generic-sftp` | SFTP / FTP File Import | `generic_file` |
| `generic-mongodb` | MongoDB Collection Import | `generic_database` |

### crypto.rs: SENSITIVE_FIELDS Addition

Add `"connection_string"` to prevent embedded credentials in ODBC/MongoDB URIs from being stored in plaintext:

```rust
const SENSITIVE_FIELDS: &[&str] = &[
    "password", "api_key", "token", "secret", "client_secret",
    "key_passphrase", "bearer_token",
    "connection_string",  // Phase 4: ODBC/MongoDB URIs may embed credentials
];
```

### Implementation Notes

**ODBC (blocking):** `odbc-api` is synchronous. Use `tokio::task::spawn_blocking()` for all calls. Create a `lazy_static` or `once_cell::sync::Lazy<Environment>` since the environment is expensive to create. Call `env.connect_with_connection_string(conn_str, NoTls)` or with DSN. Execute the query, iterate the `Cursor`, extract all columns as strings via `CursorRow::get_text()`, convert to `JsonValue::String`.

**SFTP with russh/russh-sftp:** 1) Connect TCP stream to `host:port`. 2) Create SSH session via `russh::client::connect()`. 3) Authenticate (password or public key). 4) Open SFTP subsystem via `russh_sftp::client::SftpSession::new()`. 5) Read the remote file via `sftp.read(remote_path)`. 6) Write to temp file or keep in memory as `Vec<u8>`. 7) Dispatch to the appropriate Phase 2 file parser based on `file_format`. The SFTP connector depends on Phase 2 file connectors.

**MongoDB:** Use `mongodb::Client::with_uri_str(connection_string)`. Get database and collection. Build `FindOptions` with projection and limit from `source_config`. Call `collection.find(filter_doc, options)`. Iterate the `Cursor<Document>`. Convert each BSON `Document` to `serde_json::Value` via `bson::to_raw_document_buf(&doc)` then `serde_json::from_slice()`. Handle ObjectId and date BSON types by converting to string representations.

**MongoDB schema discovery:** `db.list_collection_names()` for table names, then `collection.find_one()` to sample a document and infer field types from BSON types.

---

## Cross-Cutting Concerns

### Error Handling Convention

All `EtlConnector` methods return `anyhow::Result<T>`. Error messages follow:

```
"{connector_type}: {operation}: {detail}"
```

Example: `"postgresql: extract: connection refused at db.example.com:5432"`

Row-level extraction failures (file parse errors, type conversion) should emit `ErrorRecord`s rather than aborting extraction. Consider a wrapper:

```rust
pub struct ExtractionResult {
    pub records: Vec<SourceRecord>,
    pub errors: Vec<ErrorRecord>,
}
```

If adopted, update `extract()` return type and merge errors in `pipeline::execute()`.

### Streaming vs. Batch

Phases 1–4 use batch extraction (all records into `Vec<SourceRecord>` before map/transform/load). This is acceptable for typical import sizes (<1M rows / <500 MB). The `batch_size` field on `import_definitions` is reserved for a future streaming implementation.

### SENSITIVE_FIELDS

The existing list covers all Phase 1–3 auth fields. Phase 4 adds `"connection_string"`.

### Frontend: `textarea` Field Type

Needed for:
- SQL queries (Phase 3 templates)  
- ODBC connection strings (Phase 4)
- MongoDB filter documents (Phase 4)
- XML XPath/element expressions (Phase 2)

Implement in Phase 2 and reuse in subsequent phases.

---

## Complete Connector Template Slug Index

| Slug | Domain | Phase | Connection Type |
|------|--------|-------|-----------------|
| `generic-rest-api` | `generic_api` | 1 | `generic_rest` |
| `generic-csv-file` | `generic_file` | 2 | `csv_file` |
| `generic-tsv-file` | `generic_file` | 2 | `tsv_file` |
| `generic-excel-file` | `generic_file` | 2 | `excel_file` |
| `generic-json-file` | `generic_file` | 2 | `json_file` |
| `generic-xml-file` | `generic_file` | 2 | `xml_file` |
| `generic-postgresql` | `generic_database` | 3 | `postgresql` |
| `generic-mysql` | `generic_database` | 3 | `mysql` |
| `generic-mssql` | `generic_database` | 3 | `mssql` |
| `generic-odbc` | `generic_database` | 4 | `odbc` |
| `generic-sftp` | `generic_file` | 4 | `sftp` |
| `generic-mongodb` | `generic_database` | 4 | `mongodb` |

**Total: 12 new connector templates** across 3 new domains.
