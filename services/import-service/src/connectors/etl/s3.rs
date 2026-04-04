//! S3 / S3-compatible object storage ETL connector.
//!
//! Polls `list_objects_v2` with prefix filtering and `LastModified`-based watermark
//! deduplication using `FilePollingState`. Supports configurable `endpoint_url`
//! for MinIO, Ceph, and other S3-compatible stores.
//!
//! Connection config keys: `region` (default "us-east-1"), `endpoint_url` (optional).
//! Auth config keys: `access_key_id`, `secret_access_key` (optional — falls back to
//!   the standard AWS credential chain: env vars, instance profile, etc.).
//! Source config keys: `bucket`, `prefix` (default ""),
//!   `file_pattern` (glob, default "*"), `file_format` ("csv", "tsv", "json", "xml", "excel"),
//!   `archive_prefix` (optional — S3 prefix to move processed objects into).

use anyhow::{anyhow, Result};
use aws_sdk_s3::config::{Credentials, Region};
use aws_sdk_s3::Client as S3Client;
use tracing::{info, warn};
use uuid::Uuid;

use super::{
    file_csv::{CsvFileConnector, TsvFileConnector},
    file_excel::ExcelFileConnector,
    file_json::JsonFileConnector,
    file_polling::{make_sentinel, matches_pattern, FilePollingState},
    file_xml::XmlFileConnector,
    EtlConnector, EtlConnectorConfig,
};
use crate::handlers::import::{SchemaField, SchemaTable};
use crate::pipeline::SourceRecord;

// ---------------------------------------------------------------------------
// S3FileConnector
// ---------------------------------------------------------------------------

pub struct S3FileConnector;

impl S3FileConnector {
    async fn build_client(cfg: &EtlConnectorConfig) -> Result<S3Client> {
        let endpoint_url = cfg
            .connection_config
            .get("endpoint_url")
            .and_then(|v| v.as_str());
        let region_str = cfg
            .connection_config
            .get("region")
            .and_then(|v| v.as_str())
            .unwrap_or("us-east-1");

        let mut config_loader = aws_config::defaults(aws_config::BehaviorVersion::latest())
            .region(Region::new(region_str.to_string()));

        // Support explicit credentials from auth_config; fall back to credential chain.
        if let (Some(key_id), Some(secret)) = (
            cfg.auth_config
                .get("access_key_id")
                .and_then(|v| v.as_str()),
            cfg.auth_config
                .get("secret_access_key")
                .and_then(|v| v.as_str()),
        ) {
            config_loader = config_loader
                .credentials_provider(Credentials::new(key_id, secret, None, None, "io-import"));
        }

        let sdk_config = config_loader.load().await;
        let mut s3_config = aws_sdk_s3::config::Builder::from(&sdk_config);

        if let Some(endpoint) = endpoint_url {
            s3_config = s3_config.endpoint_url(endpoint).force_path_style(true);
        }

        Ok(S3Client::from_conf(s3_config.build()))
    }
}

#[async_trait::async_trait]
impl EtlConnector for S3FileConnector {
    fn connector_type(&self) -> &'static str {
        "s3"
    }

    async fn test_connection(&self, cfg: &EtlConnectorConfig) -> Result<()> {
        let bucket = cfg
            .source_config
            .get("bucket")
            .and_then(|v| v.as_str())
            .ok_or_else(|| anyhow!("s3: bucket is required in source_config"))?
            .to_string();
        let client = Self::build_client(cfg).await?;
        client
            .list_objects_v2()
            .bucket(&bucket)
            .max_keys(1)
            .send()
            .await
            .map_err(|e| anyhow!("s3: test connection failed: {e}"))?;
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
                name: "s3_objects".to_string(),
                fields,
            }])
        } else {
            Ok(vec![])
        }
    }

    async fn extract(&self, cfg: &EtlConnectorConfig) -> Result<Vec<SourceRecord>> {
        let bucket = cfg
            .source_config
            .get("bucket")
            .and_then(|v| v.as_str())
            .ok_or_else(|| anyhow!("s3: bucket is required in source_config"))?
            .to_string();
        let prefix = cfg
            .source_config
            .get("prefix")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();
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
        let archive_prefix = cfg
            .source_config
            .get("archive_prefix")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());

        let mut state = FilePollingState::from_watermark(cfg.watermark_state.as_ref());

        let client = match Self::build_client(cfg).await {
            Ok(c) => c,
            Err(e) => {
                warn!("s3: could not build client: {e}; returning empty");
                return Ok(vec![make_sentinel(&state)]);
            }
        };

        // List objects with prefix
        let list_output = match client
            .list_objects_v2()
            .bucket(&bucket)
            .prefix(&prefix)
            .send()
            .await
        {
            Ok(o) => o,
            Err(e) => {
                warn!(bucket = %bucket, prefix = %prefix, "s3: list_objects_v2 failed: {e}; returning empty");
                return Ok(vec![make_sentinel(&state)]);
            }
        };

        // Collect new/modified objects matching the pattern
        let mut to_process: Vec<(String, String, i64, u64)> = Vec::new();
        for obj in list_output.contents() {
            let key = match obj.key() {
                Some(k) => k,
                None => continue,
            };
            // Extract filename from key (last path segment)
            let file_name = key
                .rsplit('/')
                .next()
                .filter(|s| !s.is_empty())
                .unwrap_or(key);

            if !matches_pattern(file_name, file_pattern) {
                continue;
            }

            let mtime: i64 = obj
                .last_modified()
                .map(|dt| dt.secs())
                .unwrap_or(0);
            let size: u64 = obj.size().unwrap_or(0) as u64;

            if state.is_new(file_name, mtime, size) {
                to_process.push((file_name.to_string(), key.to_string(), mtime, size));
            } else {
                info!(key = %key, "s3: already seen; skipping");
            }
        }

        // Deterministic order
        to_process.sort_by(|a, b| a.0.cmp(&b.0));

        let mut all_records: Vec<SourceRecord> = Vec::new();
        let mut row_offset: i64 = 0;

        for (file_name, key, mtime, size) in to_process {
            info!(key = %key, "s3: processing new/modified object");

            // Download object
            let bytes = match client
                .get_object()
                .bucket(&bucket)
                .key(&key)
                .send()
                .await
            {
                Ok(output) => match output.body.collect().await {
                    Ok(aggregated) => aggregated.into_bytes().to_vec(),
                    Err(e) => {
                        warn!(key = %key, "s3: read body failed: {e}; skipping");
                        continue;
                    }
                },
                Err(e) => {
                    warn!(key = %key, "s3: get_object failed: {e}; skipping");
                    continue;
                }
            };

            // Write to temp file
            let file_id = Uuid::new_v4().to_string();
            let temp_path = std::path::Path::new(&cfg.upload_dir).join(&file_id);
            if let Err(e) = tokio::fs::write(&temp_path, &bytes).await {
                warn!(key = %key, "s3: write temp file failed: {e}; skipping");
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

                    // Archive: S3 copy + delete (no server-side rename)
                    if let Some(ref archive) = archive_prefix {
                        let dest_key =
                            format!("{}/{}", archive.trim_end_matches('/'), file_name);
                        let copy_source = format!("{}/{}", bucket, key);
                        let copy_ok = client
                            .copy_object()
                            .bucket(&bucket)
                            .copy_source(&copy_source)
                            .key(&dest_key)
                            .send()
                            .await
                            .is_ok();
                        if copy_ok {
                            if let Err(e) = client
                                .delete_object()
                                .bucket(&bucket)
                                .key(&key)
                                .send()
                                .await
                            {
                                warn!(key = %key, "s3: archive delete failed: {e}");
                            }
                        } else {
                            warn!(key = %key, archive = %archive, "s3: archive copy failed");
                        }
                    }
                }
                Err(e) => {
                    warn!(key = %key, format = file_format, "s3: parse failed: {e}; skipping");
                }
            }
        }

        all_records.push(make_sentinel(&state));
        Ok(all_records)
    }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

fn make_inline_cfg(cfg: &EtlConnectorConfig, file_id: &str) -> EtlConnectorConfig {
    let mut inline_source = cfg.source_config.clone();
    if let Some(obj) = inline_source.as_object_mut() {
        obj.insert(
            "file_id".to_string(),
            serde_json::Value::String(file_id.to_string()),
        );
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
        other => Err(anyhow!("s3: unsupported file_format '{other}'")),
    }
}
