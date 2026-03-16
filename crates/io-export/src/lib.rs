use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use thiserror::Error;
use uuid::Uuid;

// ---------------------------------------------------------------------------
// Export format
// ---------------------------------------------------------------------------

/// Supported export file formats.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ExportFormat {
    Csv,
    Xlsx,
    Pdf,
    Json,
    Parquet,
    Html,
}

impl ExportFormat {
    pub fn mime_type(&self) -> &'static str {
        match self {
            ExportFormat::Csv => "text/csv",
            ExportFormat::Xlsx => {
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            }
            ExportFormat::Pdf => "application/pdf",
            ExportFormat::Json => "application/json",
            ExportFormat::Parquet => "application/octet-stream",
            ExportFormat::Html => "text/html",
        }
    }

    pub fn extension(&self) -> &'static str {
        match self {
            ExportFormat::Csv => "csv",
            ExportFormat::Xlsx => "xlsx",
            ExportFormat::Pdf => "pdf",
            ExportFormat::Json => "json",
            ExportFormat::Parquet => "parquet",
            ExportFormat::Html => "html",
        }
    }
}

// ---------------------------------------------------------------------------
// Export job lifecycle
// ---------------------------------------------------------------------------

/// Lifecycle state of an async export job.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ExportStatus {
    Queued,
    Processing,
    Completed,
    Failed,
    Cancelled,
}

impl ExportStatus {
    pub fn is_terminal(&self) -> bool {
        matches!(
            self,
            ExportStatus::Completed | ExportStatus::Failed | ExportStatus::Cancelled
        )
    }
}

/// Represents an async export job.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub struct ExportJob {
    pub id: Uuid,
    pub format: ExportFormat,
    pub status: ExportStatus,
    pub created_at: DateTime<Utc>,
    pub completed_at: Option<DateTime<Utc>>,
    pub file_path: Option<String>,
    pub error_message: Option<String>,
    pub row_count: Option<u64>,
    pub file_size_bytes: Option<u64>,
}

impl ExportJob {
    pub fn new(format: ExportFormat) -> Self {
        Self {
            id: Uuid::new_v4(),
            format,
            status: ExportStatus::Queued,
            created_at: Utc::now(),
            completed_at: None,
            file_path: None,
            error_message: None,
            row_count: None,
            file_size_bytes: None,
        }
    }
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

#[derive(Debug, Error)]
pub enum ExportError {
    #[error("unsupported format: {0:?}")]
    UnsupportedFormat(ExportFormat),

    #[error("export job not found: {0}")]
    JobNotFound(Uuid),

    #[error("export failed: {0}")]
    Failed(String),

    #[error("export cancelled")]
    Cancelled,
}
