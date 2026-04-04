//! FTP/FTPS ETL connector using suppaftp (async-rustls).
//!
//! Connects to an FTP server and polls a remote directory for new or modified files
//! matching a glob pattern. Uses `FilePollingState` for deduplication. Dispatches
//! each new file to the appropriate format parser.
//!
//! Connection config keys: `host`, `port` (default 21).
//! Auth config keys: `username`, `password`.
//! Source config keys: `remote_dir`, `file_pattern` (e.g. `"*.csv"`),
//!   `file_format` ("csv", "tsv", "json", "xml", "excel"),
//!   `archive_dir` (optional — remote path to move processed files into).
//!
//! After processing all new files, appends a sentinel `SourceRecord` carrying
//! the updated `FilePollingState` back to the pipeline.

use anyhow::{anyhow, Result};
use futures::io::AsyncReadExt as _;
use std::path::Path;
use suppaftp::AsyncFtpStream;
use tracing::{info, warn};
use uuid::Uuid;

use super::{
    file_csv::{CsvFileConnector, TsvFileConnector},
    file_excel::ExcelFileConnector,
    file_json::JsonFileConnector,
    file_xml::XmlFileConnector,
    file_polling::{make_sentinel, matches_pattern, FilePollingState},
    EtlConnector, EtlConnectorConfig,
};
use crate::handlers::import::{SchemaField, SchemaTable};
use crate::pipeline::SourceRecord;

// ---------------------------------------------------------------------------
// FtpConnector
// ---------------------------------------------------------------------------

pub struct FtpConnector;

impl FtpConnector {
    async fn open_ftp(cfg: &EtlConnectorConfig) -> Result<AsyncFtpStream> {
        let host = cfg
            .connection_config
            .get("host")
            .and_then(|v| v.as_str())
            .ok_or_else(|| anyhow!("ftp: host is required in connection_config"))?
            .to_string();
        let port = cfg
            .connection_config
            .get("port")
            .and_then(|v| v.as_u64())
            .unwrap_or(21) as u16;
        let username = cfg
            .auth_config
            .get("username")
            .and_then(|v| v.as_str())
            .ok_or_else(|| anyhow!("ftp: username is required in auth_config"))?
            .to_string();
        let password = cfg
            .auth_config
            .get("password")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();

        let addr = format!("{host}:{port}");
        let mut ftp = AsyncFtpStream::connect(&addr)
            .await
            .map_err(|e| anyhow!("ftp: connect to {addr} failed: {e}"))?;

        ftp.login(&username, &password)
            .await
            .map_err(|e| anyhow!("ftp: login as {username} failed: {e}"))?;

        // Use passive mode — required for NAT/firewall traversal.
        ftp.set_mode(suppaftp::Mode::ExtendedPassive);

        Ok(ftp)
    }

    async fn poll_directory(cfg: &EtlConnectorConfig, remote_dir: &str) -> Result<Vec<SourceRecord>> {
        let file_pattern = cfg
            .source_config
            .get("file_pattern")
            .and_then(|v| v.as_str())
            .unwrap_or("*");
        let file_format = cfg
            .source_config
            .get("file_format")
            .and_then(|v| v.as_str())
            .unwrap_or("csv");
        let archive_dir = cfg
            .source_config
            .get("archive_dir")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());

        let mut state = FilePollingState::from_watermark(cfg.watermark_state.as_ref());

        let mut ftp = match Self::open_ftp(cfg).await {
            Ok(f) => f,
            Err(e) => {
                warn!("ftp: could not connect: {e}; returning empty");
                return Ok(vec![make_sentinel(&state)]);
            }
        };

        // List files in remote directory
        let names = match ftp.nlst(Some(remote_dir)).await {
            Ok(n) => n,
            Err(e) => {
                warn!(remote_dir, "ftp: nlst failed: {e}; returning empty");
                let _ = ftp.quit().await;
                return Ok(vec![make_sentinel(&state)]);
            }
        };

        // Filter by pattern, collect metadata
        let mut entries: Vec<(String, String, i64, u64)> = Vec::new();
        for raw_name in names {
            // nlst may return full paths; extract just the filename
            let file_name = Path::new(&raw_name)
                .file_name()
                .map(|n| n.to_string_lossy().into_owned())
                .unwrap_or_else(|| raw_name.clone());

            if !matches_pattern(&file_name, file_pattern) {
                continue;
            }

            let remote_path = format!("{}/{}", remote_dir.trim_end_matches('/'), file_name);

            // Fetch size (best-effort)
            let size: u64 = ftp
                .size(&remote_path)
                .await
                .unwrap_or(0) as u64;

            // Fetch mtime via MDTM (best-effort).
            // suppaftp returns NaiveDateTime; use .and_utc() to get Unix timestamp.
            let mtime: i64 = ftp
                .mdtm(&remote_path)
                .await
                .map(|ndt| ndt.and_utc().timestamp())
                .unwrap_or(0);

            entries.push((file_name, remote_path, mtime, size));
        }

        // Sort for deterministic order
        entries.sort_by(|a, b| a.0.cmp(&b.0));

        let mut all_records: Vec<SourceRecord> = Vec::new();
        let mut row_offset: i64 = 0;

        for (file_name, remote_path, mtime, size) in entries {
            if !state.is_new(&file_name, mtime, size) {
                info!(file = %file_name, "ftp: already seen; skipping");
                continue;
            }

            info!(file = %file_name, "ftp: processing new/modified file");

            // Download to temp file via streaming retrieval.
            // suppaftp's AsyncDataStream implements futures::io::AsyncRead.
            let bytes = {
                let mut stream = match ftp.retr_as_stream(&remote_path).await {
                    Ok(s) => s,
                    Err(e) => {
                        warn!(file = %file_name, "ftp: retr_as_stream failed: {e}; skipping");
                        continue;
                    }
                };
                let mut buf = vec![];
                let read_ok = stream.read_to_end(&mut buf).await.is_ok();
                let _ = ftp.finalize_retr_stream(stream).await;
                if !read_ok {
                    warn!(file = %file_name, "ftp: read stream failed; skipping");
                    continue;
                }
                buf
            };

            let file_id = Uuid::new_v4().to_string();
            let temp_path = Path::new(&cfg.upload_dir).join(&file_id);
            if let Err(e) = tokio::fs::write(&temp_path, &bytes).await {
                warn!(file = %file_name, "ftp: write temp file failed: {e}; skipping");
                continue;
            }

            let inline_cfg = make_inline_cfg(cfg, &file_id);
            let result = dispatch_to_parser(file_format, &inline_cfg).await;
            let _ = tokio::fs::remove_file(&temp_path).await;

            match result {
                Ok(mut records) => {
                    for rec in &mut records {
                        rec.row_number += row_offset;
                    }
                    row_offset += records.len() as i64;
                    all_records.extend(records);

                    state.mark_seen(file_name.clone(), mtime, size);

                    // Archive: rename on the FTP server
                    if let Some(ref archive) = archive_dir {
                        let dest = format!("{}/{}", archive.trim_end_matches('/'), file_name);
                        if let Err(e) = ftp.rename(&remote_path, &dest).await {
                            warn!(file = %file_name, archive = %archive, "ftp: archive rename failed: {e}");
                        }
                    }
                }
                Err(e) => {
                    warn!(file = %file_name, format = file_format, "ftp: parse failed: {e}; skipping");
                }
            }
        }

        let _ = ftp.quit().await;

        all_records.push(make_sentinel(&state));
        Ok(all_records)
    }
}

#[async_trait::async_trait]
impl EtlConnector for FtpConnector {
    fn connector_type(&self) -> &'static str {
        "ftp"
    }

    async fn test_connection(&self, cfg: &EtlConnectorConfig) -> Result<()> {
        let mut ftp = Self::open_ftp(cfg).await?;
        let _ = ftp.quit().await;
        Ok(())
    }

    async fn discover_schema(&self, cfg: &EtlConnectorConfig) -> Result<Vec<SchemaTable>> {
        let records = self.extract(cfg).await?;
        let data_records: Vec<_> = records
            .iter()
            .filter(|r| !r.fields.contains_key("__io_fp_state__"))
            .collect();
        if let Some(first) = data_records.first() {
            let fields = first
                .fields
                .keys()
                .map(|k| SchemaField {
                    name: k.clone(),
                    data_type: "text".to_string(),
                })
                .collect();
            Ok(vec![SchemaTable {
                name: "ftp_files".to_string(),
                fields,
            }])
        } else {
            Ok(vec![])
        }
    }

    async fn extract(&self, cfg: &EtlConnectorConfig) -> Result<Vec<SourceRecord>> {
        let remote_dir = cfg
            .source_config
            .get("remote_dir")
            .and_then(|v| v.as_str())
            .ok_or_else(|| anyhow!("ftp: remote_dir is required in source_config"))?
            .to_string();
        Self::poll_directory(cfg, &remote_dir).await
    }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

fn make_inline_cfg(cfg: &EtlConnectorConfig, file_id: &str) -> EtlConnectorConfig {
    let mut inline_source = cfg.source_config.clone();
    if let Some(obj) = inline_source.as_object_mut() {
        obj.insert("file_id".to_string(), serde_json::Value::String(file_id.to_string()));
    }
    let mut inline_cfg = cfg.clone();
    inline_cfg.source_config = inline_source;
    inline_cfg
}

async fn dispatch_to_parser(
    file_format: &str,
    cfg: &EtlConnectorConfig,
) -> Result<Vec<SourceRecord>> {
    match file_format {
        "csv" => CsvFileConnector.extract(cfg).await,
        "tsv" => TsvFileConnector.extract(cfg).await,
        "json" => JsonFileConnector.extract(cfg).await,
        "xml" => XmlFileConnector.extract(cfg).await,
        "excel" | "xlsx" => ExcelFileConnector.extract(cfg).await,
        other => Err(anyhow!("ftp: unsupported file_format '{other}'")),
    }
}
