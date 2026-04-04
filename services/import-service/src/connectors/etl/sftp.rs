//! SFTP ETL connector using russh + russh-sftp.
//!
//! Two modes:
//! - **Single-file** (original): `source_config.remote_path` — downloads one file.
//! - **Directory polling** (new): `source_config.remote_dir` — lists the directory,
//!   filters by `file_pattern` glob, downloads new/modified files using `FilePollingState`.
//!
//! In directory mode, processed files can be archived by setting `source_config.archive_dir`.
//! A sentinel `SourceRecord` with `__io_fp_state__` is appended for the pipeline to persist
//! the updated state.
//!
//! FTP is handled by the separate `ftp` connector.

use anyhow::{anyhow, Result};
use russh::client;
use russh_sftp::client::SftpSession;
use serde_json::Value as JsonValue;
use std::sync::Arc;
use tokio::io::AsyncReadExt;
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
// SSH handler — accepts all host keys (connection is user-configured)
// ---------------------------------------------------------------------------

struct SshHandler;

#[async_trait::async_trait]
impl client::Handler for SshHandler {
    type Error = anyhow::Error;

    async fn check_server_key(
        &mut self,
        _server_public_key: &russh_keys::key::PublicKey,
    ) -> Result<bool, Self::Error> {
        Ok(true)
    }
}

// ---------------------------------------------------------------------------
// SftpConnector
// ---------------------------------------------------------------------------

pub struct SftpConnector;

impl SftpConnector {
    async fn open_sftp(cfg: &EtlConnectorConfig) -> Result<SftpSession> {
        let host = cfg
            .connection_config
            .get("host")
            .and_then(|v| v.as_str())
            .ok_or_else(|| anyhow!("sftp: host is required in connection_config"))?
            .to_string();
        let port = cfg
            .connection_config
            .get("port")
            .and_then(|v| v.as_u64())
            .unwrap_or(22) as u16;
        let protocol = cfg
            .connection_config
            .get("protocol")
            .and_then(|v| v.as_str())
            .unwrap_or("sftp");
        if protocol == "ftp" {
            return Err(anyhow!("sftp: FTP protocol is not yet supported; use SFTP"));
        }
        let username = cfg
            .connection_config
            .get("username")
            .and_then(|v| v.as_str())
            .ok_or_else(|| anyhow!("sftp: username is required in connection_config"))?
            .to_string();
        let password = cfg
            .auth_config
            .get("password")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());

        let config = Arc::new(client::Config::default());
        let mut session = client::connect(config, (host.as_str(), port), SshHandler)
            .await
            .map_err(|e| anyhow!("sftp: SSH connect failed: {e}"))?;

        let authenticated = if let Some(pw) = password {
            session
                .authenticate_password(username, pw)
                .await
                .map_err(|e| anyhow!("sftp: SSH password auth failed: {e}"))?
        } else {
            return Err(anyhow!("sftp: password is required in auth_config"));
        };

        if !authenticated {
            return Err(anyhow!("sftp: SSH authentication rejected by server"));
        }

        let channel = session
            .channel_open_session()
            .await
            .map_err(|e| anyhow!("sftp: channel_open_session failed: {e}"))?;
        channel
            .request_subsystem(true, "sftp")
            .await
            .map_err(|e| anyhow!("sftp: request_subsystem failed: {e}"))?;

        SftpSession::new(channel.into_stream())
            .await
            .map_err(|e| anyhow!("sftp: SftpSession::new failed: {e}"))
    }

    /// Download the remote file and write it as a temp file in upload_dir,
    /// returning an `EtlConnectorConfig` with `source_config.file_id` pointing
    /// to the temp file so that Phase-2 parsers can resolve it.
    async fn download_to_temp(
        cfg: &EtlConnectorConfig,
    ) -> Result<(EtlConnectorConfig, std::path::PathBuf)> {
        let remote_path = cfg
            .source_config
            .get("remote_path")
            .and_then(|v| v.as_str())
            .ok_or_else(|| anyhow!("sftp: remote_path is required in source_config"))?
            .to_string();

        let sftp = Self::open_sftp(cfg).await?;
        let mut remote_file = sftp
            .open(&remote_path)
            .await
            .map_err(|e| anyhow!("sftp: open remote file '{remote_path}' failed: {e}"))?;
        let mut bytes = Vec::new();
        remote_file
            .read_to_end(&mut bytes)
            .await
            .map_err(|e| anyhow!("sftp: read remote file failed: {e}"))?;

        // Write to a temp file in upload_dir
        let file_id = Uuid::new_v4().to_string();
        let temp_path: std::path::PathBuf = std::path::Path::new(&cfg.upload_dir)
            .join(&file_id);
        tokio::fs::write(&temp_path, &bytes)
            .await
            .map_err(|e| anyhow!("sftp: failed to write temp file: {e}"))?;

        // Build an EtlConnectorConfig variant that references the temp file
        let mut inline_source = cfg.source_config.clone();
        if let Some(obj) = inline_source.as_object_mut() {
            obj.insert(
                "file_id".to_string(),
                JsonValue::String(file_id),
            );
        }
        let mut inline_cfg = cfg.clone();
        inline_cfg.source_config = inline_source;

        Ok((inline_cfg, temp_path))
    }

    /// Download a file from a remote SFTP path and write it to a temp file.
    /// Returns (inline config with file_id, temp path, file bytes length).
    async fn download_file_to_temp(
        sftp: &mut SftpSession,
        remote_path: &str,
        cfg: &EtlConnectorConfig,
    ) -> Result<(EtlConnectorConfig, std::path::PathBuf)> {
        let mut remote_file = sftp
            .open(remote_path)
            .await
            .map_err(|e| anyhow!("sftp: open '{remote_path}' failed: {e}"))?;
        let mut bytes = Vec::new();
        remote_file
            .read_to_end(&mut bytes)
            .await
            .map_err(|e| anyhow!("sftp: read '{remote_path}' failed: {e}"))?;

        let file_id = Uuid::new_v4().to_string();
        let temp_path: std::path::PathBuf = std::path::Path::new(&cfg.upload_dir).join(&file_id);
        tokio::fs::write(&temp_path, &bytes)
            .await
            .map_err(|e| anyhow!("sftp: write temp file failed: {e}"))?;

        let mut inline_source = cfg.source_config.clone();
        if let Some(obj) = inline_source.as_object_mut() {
            obj.insert("file_id".to_string(), JsonValue::String(file_id));
        }
        let mut inline_cfg = cfg.clone();
        inline_cfg.source_config = inline_source;
        Ok((inline_cfg, temp_path))
    }

    /// Directory polling mode: list `remote_dir`, filter by `file_pattern`,
    /// download new/modified files, dispatch to parser, optionally archive.
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

        let mut sftp = match Self::open_sftp(cfg).await {
            Ok(s) => s,
            Err(e) => {
                warn!("sftp: poll_directory: could not connect: {e}; returning empty");
                return Ok(vec![make_sentinel(&state)]);
            }
        };

        // List remote directory
        let dir_entries = match sftp.read_dir(remote_dir).await {
            Ok(entries) => entries,
            Err(e) => {
                warn!(remote_dir, "sftp: read_dir failed: {e}; returning empty");
                return Ok(vec![make_sentinel(&state)]);
            }
        };

        // Collect new/modified files matching the pattern.
        // ReadDir implements Iterator<Item = DirEntry> for &mut ReadDir.
        let mut to_download: Vec<(String, i64, u64)> = Vec::new();
        let mut dir_entries = dir_entries;
        for entry in &mut dir_entries {
            let file_name_str: String = entry.file_name().to_string();
            if !matches_pattern(&file_name_str, file_pattern) {
                continue;
            }
            let meta = entry.metadata();
            let size: u64 = meta.size.unwrap_or(0);
            let mtime: i64 = meta.mtime.unwrap_or(0) as i64;
            if state.is_new(&file_name_str, mtime, size) {
                to_download.push((file_name_str, mtime, size));
            } else {
                info!(file = %file_name_str, "sftp: already seen; skipping");
            }
        }
        to_download.sort_by(|a, b| a.0.cmp(&b.0));

        let mut all_records: Vec<SourceRecord> = Vec::new();
        let mut row_offset: i64 = 0;

        for (file_name, mtime, size) in to_download {
            let remote_path = format!("{}/{}", remote_dir.trim_end_matches('/'), file_name);
            info!(file = %file_name, "sftp: processing new/modified file");

            match Self::download_file_to_temp(&mut sftp, &remote_path, cfg).await {
                Ok((inline_cfg, temp_path)) => {
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

                            // Archive: rename on the remote server
                            if let Some(ref archive) = archive_dir {
                                let dest = format!(
                                    "{}/{}",
                                    archive.trim_end_matches('/'),
                                    file_name
                                );
                                if let Err(e) = sftp.rename(&remote_path, &dest).await {
                                    warn!(file = %file_name, archive = %archive, "sftp: archive rename failed: {e}");
                                }
                            }
                        }
                        Err(e) => {
                            warn!(file = %file_name, format = file_format, "sftp: parse failed: {e}; skipping");
                        }
                    }
                }
                Err(e) => {
                    warn!(file = %file_name, "sftp: download failed: {e}; skipping");
                }
            }
        }

        all_records.push(make_sentinel(&state));
        Ok(all_records)
    }
}

#[async_trait::async_trait]
impl EtlConnector for SftpConnector {
    fn connector_type(&self) -> &'static str {
        "sftp"
    }

    async fn test_connection(&self, cfg: &EtlConnectorConfig) -> Result<()> {
        let _ = Self::open_sftp(cfg).await?;
        Ok(())
    }

    async fn discover_schema(&self, cfg: &EtlConnectorConfig) -> Result<Vec<SchemaTable>> {
        let (inline_cfg, temp_path) = Self::download_to_temp(cfg).await?;
        let file_format = cfg
            .source_config
            .get("file_format")
            .and_then(|v| v.as_str())
            .unwrap_or("csv");

        let result = dispatch_to_parser(file_format, &inline_cfg).await;
        let _ = tokio::fs::remove_file(&temp_path).await;

        let records = result?;
        if let Some(first) = records.first() {
            let fields = first
                .fields
                .keys()
                .map(|k| SchemaField {
                    name: k.clone(),
                    data_type: "text".to_string(),
                })
                .collect();
            Ok(vec![SchemaTable {
                name: "remote_file".to_string(),
                fields,
            }])
        } else {
            Ok(vec![])
        }
    }

    async fn extract(&self, cfg: &EtlConnectorConfig) -> Result<Vec<SourceRecord>> {
        // Directory polling mode when remote_dir is set; single-file otherwise.
        let remote_dir = cfg
            .source_config
            .get("remote_dir")
            .and_then(|v| v.as_str());

        if let Some(dir) = remote_dir {
            Self::poll_directory(cfg, dir).await
        } else {
            let file_format = cfg
                .source_config
                .get("file_format")
                .and_then(|v| v.as_str())
                .unwrap_or("csv");
            let (inline_cfg, temp_path) = Self::download_to_temp(cfg).await?;
            let result = dispatch_to_parser(file_format, &inline_cfg).await;
            let _ = tokio::fs::remove_file(&temp_path).await;
            result
        }
    }
}

/// Dispatch to the appropriate Phase-2 file connector based on format string.
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
        other => Err(anyhow!("sftp: unsupported file_format '{other}'")),
    }
}
