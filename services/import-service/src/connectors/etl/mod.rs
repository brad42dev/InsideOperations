//! ETL connector trait and registry.
//!
//! ETL connectors implement full Extract-Transform-Load extraction (producing
//! `SourceRecord`s for the pipeline), as opposed to the supplemental `DcsConnector`
//! trait which augments OPC UA metadata with side-channel data.

pub mod file_csv;
pub mod file_excel;
pub mod file_json;
pub mod file_polling;
pub mod file_xml;
pub mod ftp;
pub mod local_file;
pub mod mongodb;
pub mod odbc;
pub mod rest;
pub mod s3;
pub mod sftp;
pub mod shiftboard;
pub mod sql_mssql;
pub mod sql_mysql;
pub mod sql_postgres;
pub mod ukg_wfm;

use anyhow::Result;
use serde_json::Value as JsonValue;
use uuid::Uuid;

use crate::handlers::import::SchemaTable;
use crate::pipeline::SourceRecord;

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

/// Config assembled from an `import_connections` row + `import_definitions.source_config`.
/// The connection holds credentials; the definition holds the query/path/endpoint.
#[derive(Debug, Clone)]
pub struct EtlConnectorConfig {
    pub connection_id: Uuid,
    /// Full `import_connections.config` JSONB (base_url, host, port, database, etc.)
    pub connection_config: JsonValue,
    /// Auth type from `import_connections.auth_type`
    pub auth_type: String,
    /// Decrypted `auth_config` JSONB from `import_connections`
    pub auth_config: JsonValue,
    /// The `import_definitions.source_config` JSONB (endpoint path, query, file_id, etc.)
    pub source_config: JsonValue,
    /// Upload directory for file-backed connectors (from `Config`)
    pub upload_dir: String,
    /// Previous run's watermark state (None on first run or when watermark is not configured).
    /// Shape: { "watermark_type": "timestamp"|"integer"|"objectid", "watermark_column": "col", "last_value": "..." }
    pub watermark_state: Option<JsonValue>,
}

// ---------------------------------------------------------------------------
// Trait
// ---------------------------------------------------------------------------

/// Trait that all ETL extraction connectors implement.
/// Separate from `DcsConnector` — this produces `SourceRecord`s for the pipeline.
#[async_trait::async_trait]
pub trait EtlConnector: Send + Sync {
    /// Identifier for this connector type (e.g. `"generic_rest"`, `"postgresql"`, `"csv_file"`).
    #[allow(dead_code)]
    fn connector_type(&self) -> &'static str;

    /// Test that the connection credentials are valid and the source is reachable.
    /// Uses only connection-level config (not `source_config`).
    async fn test_connection(&self, cfg: &EtlConnectorConfig) -> Result<()>;

    /// Discover available tables/collections/endpoints and their fields.
    /// Returns an empty `Vec` if discovery is not supported for this connector type.
    async fn discover_schema(&self, cfg: &EtlConnectorConfig) -> Result<Vec<SchemaTable>>;

    /// Extract records from the source using the definition's `source_config`.
    /// This is the main extraction method called by the pipeline.
    async fn extract(&self, cfg: &EtlConnectorConfig) -> Result<Vec<SourceRecord>>;
}

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

/// Map a `connection_type` string to an `EtlConnector` implementation.
/// Returns `None` if no implementation is registered for the given type.
pub fn get_etl_connector(connection_type: &str) -> Option<Box<dyn EtlConnector>> {
    match connection_type {
        "generic_rest" => Some(Box::new(rest::GenericRestConnector)),
        "csv_file" => Some(Box::new(file_csv::CsvFileConnector)),
        "tsv_file" => Some(Box::new(file_csv::TsvFileConnector)),
        "excel_file" => Some(Box::new(file_excel::ExcelFileConnector)),
        "json_file" => Some(Box::new(file_json::JsonFileConnector)),
        "xml_file" => Some(Box::new(file_xml::XmlFileConnector)),
        "postgresql" => Some(Box::new(sql_postgres::PostgresConnector)),
        "mysql" => Some(Box::new(sql_mysql::MySqlConnector)),
        "mssql" => Some(Box::new(sql_mssql::MssqlConnector)),
        "odbc" => Some(Box::new(odbc::OdbcConnector)),
        "sftp" => Some(Box::new(sftp::SftpConnector)),
        "mongodb" => Some(Box::new(mongodb::MongoConnector)),
        "ftp" => Some(Box::new(ftp::FtpConnector)),
        "local_file" => Some(Box::new(local_file::LocalFileConnector)),
        "s3" => Some(Box::new(s3::S3FileConnector)),
        "shiftboard_jsonrpc" => Some(Box::new(shiftboard::ShiftboardJsonRpcConnector)),
        "ukg_wfm" => Some(Box::new(ukg_wfm::UkgWfmConnector)),
        _ => None,
    }
}

// ---------------------------------------------------------------------------
// Shared helper: resolve file bytes from file_id or inline data
// ---------------------------------------------------------------------------

/// Read file bytes from either an uploaded file (by file_id prefix match in upload_dir)
/// or from inline `source_config.data` text.
pub async fn resolve_file_content(
    source_config: &JsonValue,
    upload_dir: &str,
) -> anyhow::Result<Vec<u8>> {
    if let Some(file_id) = source_config.get("file_id").and_then(|v| v.as_str()) {
        let mut entries = tokio::fs::read_dir(upload_dir).await?;
        while let Some(entry) = entries.next_entry().await? {
            if entry.file_name().to_string_lossy().starts_with(file_id) {
                return Ok(tokio::fs::read(entry.path()).await?);
            }
        }
        Err(anyhow::anyhow!(
            "Uploaded file not found: file_id={file_id}"
        ))
    } else if let Some(data) = source_config.get("data").and_then(|v| v.as_str()) {
        Ok(data.as_bytes().to_vec())
    } else {
        Err(anyhow::anyhow!("Either file_id or inline data is required"))
    }
}

// ---------------------------------------------------------------------------
// Shared helper: apply ETL connector auth to a reqwest::RequestBuilder
// ---------------------------------------------------------------------------

pub fn apply_auth_etl(
    builder: reqwest::RequestBuilder,
    cfg: &EtlConnectorConfig,
) -> reqwest::RequestBuilder {
    match cfg.auth_type.as_str() {
        "basic" => {
            let u = cfg
                .auth_config
                .get("username")
                .and_then(|v| v.as_str())
                .unwrap_or("");
            let p = cfg
                .auth_config
                .get("password")
                .and_then(|v| v.as_str())
                .unwrap_or("");
            builder.basic_auth(u, Some(p))
        }
        "bearer_token" => {
            let t = cfg
                .auth_config
                .get("bearer_token")
                .or_else(|| cfg.auth_config.get("token"))
                .and_then(|v| v.as_str())
                .unwrap_or("");
            builder.bearer_auth(t)
        }
        "api_key_header" | "api_key" => {
            let key = cfg
                .auth_config
                .get("api_key")
                .and_then(|v| v.as_str())
                .unwrap_or("");
            let header = cfg
                .auth_config
                .get("api_key_header_name")
                .and_then(|v| v.as_str())
                .unwrap_or("X-Api-Key");
            builder.header(header, key)
        }
        _ => builder,
    }
}

// ---------------------------------------------------------------------------
// Shared helper: validate SQL identifiers used in format! queries
// ---------------------------------------------------------------------------

/// Validate a SQL identifier (table or schema name) used in non-parameterized
/// schema-discovery queries. Accepts alphanumeric, underscore, dot (schema.table),
/// and square brackets ([dbo].[table]) — all standard SQL identifier characters.
///
/// Returns an error if the name contains any other character, preventing SQL injection
/// through user-supplied table names in `discover_schema` implementations that cannot
/// use parameterized identifiers.
pub fn validate_sql_identifier(name: &str) -> anyhow::Result<()> {
    if name.is_empty() {
        anyhow::bail!("SQL identifier cannot be empty");
    }
    if name
        .chars()
        .all(|c| c.is_alphanumeric() || matches!(c, '_' | '.' | '[' | ']'))
    {
        Ok(())
    } else {
        anyhow::bail!("invalid SQL identifier '{name}': contains disallowed characters")
    }
}

// ---------------------------------------------------------------------------
// Shared helper: navigate a JsonValue by dot-separated path
// ---------------------------------------------------------------------------

/// Navigate a `serde_json::Value` by a dot-separated path (e.g. `"data.results"`).
/// Returns `&JsonValue::Null` when any segment is missing.
pub fn extract_by_path<'a>(value: &'a JsonValue, path: &str) -> &'a JsonValue {
    if path.is_empty() {
        return value;
    }
    let mut cur = value;
    for key in path.split('.') {
        cur = match cur.get(key) {
            Some(v) => v,
            None => return &JsonValue::Null,
        };
    }
    cur
}
