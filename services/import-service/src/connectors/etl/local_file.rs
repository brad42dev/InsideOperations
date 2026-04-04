//! Local filesystem ETL connector.
//!
//! Watches a local directory (`source_config.watch_dir`) for new or modified files
//! matching a glob pattern (`source_config.file_pattern`, e.g. `"*.csv"`).
//! Uses `FilePollingState` (stored in `watermark_state` JSONB) to skip files that
//! have already been processed.
//!
//! After successfully parsing a file, optionally moves it to `source_config.archive_dir`.
//! Dispatches each new file to the appropriate format parser based on
//! `source_config.file_format` ("csv", "tsv", "json", "xml", "excel").
//!
//! Returns an `__io_fp_state__` sentinel record at the end so the pipeline can
//! persist the updated `FilePollingState` as `import_runs.watermark_state`.

use anyhow::{anyhow, Result};
use std::path::{Path, PathBuf};
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
// LocalFileConnector
// ---------------------------------------------------------------------------

pub struct LocalFileConnector;

impl LocalFileConnector {
    async fn poll_directory(cfg: &EtlConnectorConfig, watch_dir: &str) -> Result<Vec<SourceRecord>> {
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
        let mut all_records: Vec<SourceRecord> = Vec::new();

        // Verify watch directory exists
        let watch_path = Path::new(watch_dir);
        if !watch_path.exists() {
            warn!(watch_dir, "local_file: watch directory does not exist; returning empty");
            all_records.push(make_sentinel(&state));
            return Ok(all_records);
        }

        // Collect entries
        let mut entries: Vec<(String, PathBuf, i64, u64)> = Vec::new();
        let mut dir = tokio::fs::read_dir(watch_dir)
            .await
            .map_err(|e| anyhow!("local_file: read_dir({watch_dir}) failed: {e}"))?;

        while let Some(entry) = dir.next_entry().await.map_err(|e| {
            anyhow!("local_file: read_dir entry error in {watch_dir}: {e}")
        })? {
            let file_name = entry.file_name().to_string_lossy().into_owned();
            if !matches_pattern(&file_name, file_pattern) {
                continue;
            }
            let meta = match entry.metadata().await {
                Ok(m) => m,
                Err(e) => {
                    warn!(file = %file_name, "local_file: metadata error: {e}; skipping");
                    continue;
                }
            };
            if !meta.is_file() {
                continue;
            }
            let mtime = meta
                .modified()
                .ok()
                .and_then(|t| {
                    t.duration_since(std::time::UNIX_EPOCH)
                        .ok()
                        .map(|d| d.as_secs() as i64)
                })
                .unwrap_or(0);
            let size = meta.len();
            entries.push((file_name, entry.path(), mtime, size));
        }

        // Sort for deterministic ordering
        entries.sort_by(|a, b| a.0.cmp(&b.0));

        let mut row_offset = all_records.len() as i64;

        for (file_name, file_path, mtime, size) in entries {
            if !state.is_new(&file_name, mtime, size) {
                info!(file = %file_name, "local_file: already seen; skipping");
                continue;
            }

            info!(file = %file_name, "local_file: processing new/modified file");

            // Copy to upload_dir temp file for parser dispatch
            let file_id = Uuid::new_v4().to_string();
            let temp_path: PathBuf = Path::new(&cfg.upload_dir).join(&file_id);

            if let Err(e) = tokio::fs::copy(&file_path, &temp_path).await {
                warn!(file = %file_name, "local_file: copy to temp failed: {e}; skipping");
                continue;
            }

            let inline_cfg = make_inline_cfg(cfg, &file_id);
            let result = dispatch_to_parser(file_format, &inline_cfg).await;
            let _ = tokio::fs::remove_file(&temp_path).await;

            match result {
                Ok(mut records) => {
                    // Re-number rows relative to the global offset
                    for rec in &mut records {
                        rec.row_number += row_offset;
                    }
                    row_offset += records.len() as i64;
                    all_records.extend(records);

                    state.mark_seen(file_name.clone(), mtime, size);

                    // Archive if configured
                    if let Some(ref archive) = archive_dir {
                        let dest = Path::new(archive).join(&file_name);
                        if let Err(e) = tokio::fs::rename(&file_path, &dest).await {
                            warn!(file = %file_name, archive = %archive, "local_file: archive move failed: {e}");
                        }
                    }
                }
                Err(e) => {
                    warn!(file = %file_name, format = file_format, "local_file: parse failed: {e}; skipping");
                }
            }
        }

        // Append sentinel with updated state
        all_records.push(make_sentinel(&state));
        Ok(all_records)
    }
}

#[async_trait::async_trait]
impl EtlConnector for LocalFileConnector {
    fn connector_type(&self) -> &'static str {
        "local_file"
    }

    async fn test_connection(&self, cfg: &EtlConnectorConfig) -> Result<()> {
        let watch_dir = cfg
            .source_config
            .get("watch_dir")
            .and_then(|v| v.as_str())
            .ok_or_else(|| anyhow!("local_file: watch_dir is required in source_config"))?;
        if !std::path::Path::new(watch_dir).exists() {
            return Err(anyhow!("local_file: watch_dir does not exist: {watch_dir}"));
        }
        Ok(())
    }

    async fn discover_schema(&self, cfg: &EtlConnectorConfig) -> Result<Vec<SchemaTable>> {
        let records = self.extract(cfg).await?;
        // Filter out sentinel
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
                name: "local_files".to_string(),
                fields,
            }])
        } else {
            Ok(vec![])
        }
    }

    async fn extract(&self, cfg: &EtlConnectorConfig) -> Result<Vec<SourceRecord>> {
        let watch_dir = cfg
            .source_config
            .get("watch_dir")
            .and_then(|v| v.as_str())
            .ok_or_else(|| anyhow!("local_file: watch_dir is required in source_config"))?
            .to_string();
        Self::poll_directory(cfg, &watch_dir).await
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
        other => Err(anyhow!("local_file: unsupported file_format '{other}'")),
    }
}
