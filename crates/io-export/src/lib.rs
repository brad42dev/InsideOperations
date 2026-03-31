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

#[cfg(test)]
mod tests {
    use super::*;

    // --- ExportFormat::mime_type ---

    #[test]
    fn csv_format_has_correct_mime_type_and_extension() {
        assert_eq!(ExportFormat::Csv.mime_type(), "text/csv");
        assert_eq!(ExportFormat::Csv.extension(), "csv");
    }

    #[test]
    fn json_format_has_correct_mime_type_and_extension() {
        assert_eq!(ExportFormat::Json.mime_type(), "application/json");
        assert_eq!(ExportFormat::Json.extension(), "json");
    }

    #[test]
    fn xlsx_format_has_correct_mime_type() {
        assert_eq!(
            ExportFormat::Xlsx.mime_type(),
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        );
        assert_eq!(ExportFormat::Xlsx.extension(), "xlsx");
    }

    #[test]
    fn pdf_format_has_correct_mime_type_and_extension() {
        assert_eq!(ExportFormat::Pdf.mime_type(), "application/pdf");
        assert_eq!(ExportFormat::Pdf.extension(), "pdf");
    }

    #[test]
    fn parquet_format_has_correct_mime_type_and_extension() {
        assert_eq!(
            ExportFormat::Parquet.mime_type(),
            "application/octet-stream"
        );
        assert_eq!(ExportFormat::Parquet.extension(), "parquet");
    }

    #[test]
    fn html_format_has_correct_mime_type_and_extension() {
        assert_eq!(ExportFormat::Html.mime_type(), "text/html");
        assert_eq!(ExportFormat::Html.extension(), "html");
    }

    // --- ExportStatus::is_terminal ---

    #[test]
    fn completed_status_is_terminal() {
        assert!(ExportStatus::Completed.is_terminal());
    }

    #[test]
    fn failed_status_is_terminal() {
        assert!(ExportStatus::Failed.is_terminal());
    }

    #[test]
    fn cancelled_status_is_terminal() {
        assert!(ExportStatus::Cancelled.is_terminal());
    }

    #[test]
    fn queued_status_is_not_terminal() {
        assert!(!ExportStatus::Queued.is_terminal());
    }

    #[test]
    fn processing_status_is_not_terminal() {
        assert!(!ExportStatus::Processing.is_terminal());
    }

    // --- ExportJob::new ---

    #[test]
    fn new_export_job_starts_in_queued_state() {
        let job = ExportJob::new(ExportFormat::Csv);
        assert_eq!(job.format, ExportFormat::Csv);
        assert_eq!(job.status, ExportStatus::Queued);
        assert!(job.completed_at.is_none());
        assert!(job.file_path.is_none());
        assert!(job.error_message.is_none());
        assert!(job.row_count.is_none());
        assert!(job.file_size_bytes.is_none());
    }

    #[test]
    fn new_export_job_generates_unique_ids() {
        let job1 = ExportJob::new(ExportFormat::Json);
        let job2 = ExportJob::new(ExportFormat::Json);
        assert_ne!(job1.id, job2.id, "Each export job must receive a unique ID");
    }

    // --- ExportError display ---

    #[test]
    fn export_error_unsupported_format_message_contains_format() {
        let err = ExportError::UnsupportedFormat(ExportFormat::Parquet);
        let msg = err.to_string();
        assert!(msg.contains("unsupported format"), "Error message: {msg}");
    }

    #[test]
    fn export_error_job_not_found_message_contains_id() {
        let id = Uuid::new_v4();
        let err = ExportError::JobNotFound(id);
        let msg = err.to_string();
        assert!(
            msg.contains(&id.to_string()),
            "JobNotFound error must include the job ID: {msg}"
        );
    }

    #[test]
    fn export_error_failed_message_propagates_inner_text() {
        let err = ExportError::Failed("disk full".to_string());
        assert!(err.to_string().contains("disk full"));
    }

    #[test]
    fn export_error_cancelled_has_descriptive_message() {
        let err = ExportError::Cancelled;
        assert!(err.to_string().contains("cancelled"));
    }
}
