//! Shared file polling state and deduplication for SFTP, FTP, S3, and local file connectors.
//!
//! `FilePollingState` is serialized into `import_runs.watermark_state` under the `"seen"` key.
//! Connectors load it from `EtlConnectorConfig.watermark_state` at the start of each run and
//! append an updated state as a sentinel `SourceRecord` (row_number = 0) at the end of the
//! extracted records. The pipeline strips the sentinel and persists the updated state.

use serde::{Deserialize, Serialize};
use serde_json::Value as JsonValue;
use std::collections::HashMap;

// ---------------------------------------------------------------------------
// FilePollingState
// ---------------------------------------------------------------------------

/// State tracking for file-based polling connectors.
/// Serialized as part of `import_runs.watermark_state` JSONB.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct FilePollingState {
    /// Map of filename → file metadata (mtime, size) for deduplication.
    /// A file is "new" if it is not in this map or if its mtime/size changed.
    pub seen: HashMap<String, SeenFile>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SeenFile {
    pub mtime: i64, // Unix timestamp (seconds)
    pub size: u64,
}

impl FilePollingState {
    /// Load from a `watermark_state` JSONB value (None on first run).
    pub fn from_watermark(wm: Option<&JsonValue>) -> Self {
        wm.and_then(|v| v.get("seen"))
            .and_then(|v| serde_json::from_value(v.clone()).ok())
            .map(|seen| FilePollingState { seen })
            .unwrap_or_default()
    }

    /// Serialize to a watermark JSONB value suitable for `import_runs.watermark_state`.
    pub fn to_watermark(&self) -> JsonValue {
        serde_json::json!({
            "watermark_type": "file_poll",
            "seen": self.seen,
        })
    }

    /// Returns true if the file has not been seen before or if its mtime/size changed.
    pub fn is_new(&self, filename: &str, mtime: i64, size: u64) -> bool {
        match self.seen.get(filename) {
            None => true,
            Some(prev) => prev.mtime != mtime || prev.size != size,
        }
    }

    /// Record a file as processed.
    pub fn mark_seen(&mut self, filename: String, mtime: i64, size: u64) {
        self.seen.insert(filename, SeenFile { mtime, size });
    }
}

// ---------------------------------------------------------------------------
// Pattern matching helper
// ---------------------------------------------------------------------------

/// Returns true if `filename` matches the given glob `pattern` (e.g. `"*.csv"`).
/// Returns false on invalid patterns rather than propagating an error.
pub fn matches_pattern(filename: &str, pattern: &str) -> bool {
    glob::Pattern::new(pattern)
        .map(|p| p.matches(filename))
        .unwrap_or(false)
}

// ---------------------------------------------------------------------------
// Sentinel record helpers
// ---------------------------------------------------------------------------

use crate::pipeline::SourceRecord;

/// Build the sentinel `SourceRecord` that carries the updated `FilePollingState`
/// back to the pipeline. Row number 0 and the `__io_fp_state__` field are used
/// as the signal. The pipeline strips this record before mapping/loading.
pub fn make_sentinel(state: &FilePollingState) -> SourceRecord {
    let mut fields = HashMap::new();
    fields.insert(
        "__io_fp_state__".to_string(),
        state.to_watermark(),
    );
    SourceRecord {
        row_number: 0,
        raw: String::new(),
        fields,
    }
}
