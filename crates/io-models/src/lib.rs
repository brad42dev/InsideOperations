use serde::{Deserialize, Serialize};

// ---------------------------------------------------------------------------
// Domain type submodules (doc 37 §8, §18)
// ---------------------------------------------------------------------------

pub mod point;
pub mod event;
pub mod alert;
pub mod auth;
pub mod source;
pub mod permission;

pub use point::{PointValue, PointQuality, PointMetadata};
pub use event::{Event, EventType, EventSeverity};
pub use alert::{AlertDispatch, AlertRecipient, AlertChannel};
pub use auth::{UserIdentity, WsTicket};
pub use source::{SourceStatus, SourceState};
pub use permission::Permission;

// ---------------------------------------------------------------------------
// Success envelope (doc 37 §2)
// ---------------------------------------------------------------------------

/// Standard success envelope for all API responses. `success` is always true.
#[derive(Debug, Clone, Serialize)]
pub struct ApiResponse<T: Serialize> {
    pub success: bool,
    pub data: T,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub message: Option<String>,
}

impl<T: Serialize> ApiResponse<T> {
    pub fn ok(data: T) -> Self {
        Self { success: true, data, message: None }
    }

    pub fn with_message(data: T, msg: impl Into<String>) -> Self {
        Self { success: true, data, message: Some(msg.into()) }
    }
}

// ---------------------------------------------------------------------------
// Paginated list envelope (doc 21 §Pagination)
// ---------------------------------------------------------------------------

/// Paginated list response with `data` array and `pagination` metadata.
#[derive(Debug, Clone, Serialize)]
pub struct PagedResponse<T: Serialize> {
    pub success: bool,
    pub data: Vec<T>,
    pub pagination: Pagination,
}

impl<T: Serialize> PagedResponse<T> {
    pub fn new(data: Vec<T>, page: u32, limit: u32, total: u64) -> Self {
        let pages = if limit == 0 { 1 } else { (total as u32).div_ceil(limit) }.max(1);
        Self {
            success: true,
            data,
            pagination: Pagination { page, limit, total, pages },
        }
    }
}

/// Pagination metadata included in list responses.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Pagination {
    pub page: u32,
    pub limit: u32,
    pub total: u64,
    pub pages: u32,
}

// ---------------------------------------------------------------------------
// Query params
// ---------------------------------------------------------------------------

/// Query parameters for paginated list endpoints.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PageParams {
    pub page: Option<u32>,
    pub limit: Option<u32>,
    pub sort: Option<String>,
    pub order: Option<SortOrder>,
}

impl PageParams {
    pub fn page(&self) -> u32 {
        self.page.unwrap_or(1).max(1)
    }

    pub fn limit(&self) -> u32 {
        self.limit.unwrap_or(50).clamp(1, 100)
    }

    pub fn offset(&self) -> i64 {
        ((self.page() - 1) * self.limit()) as i64
    }
}

/// Sort order for list queries.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "snake_case")]
pub enum SortOrder {
    #[default]
    Asc,
    Desc,
}

impl SortOrder {
    pub fn as_sql(&self) -> &'static str {
        match self {
            SortOrder::Asc => "ASC",
            SortOrder::Desc => "DESC",
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // ------------------------------------------------------------------
    // ApiResponse
    // ------------------------------------------------------------------

    #[test]
    fn api_response_ok_sets_success_true() {
        let r = ApiResponse::ok(42u32);
        assert!(r.success);
    }

    #[test]
    fn api_response_ok_carries_data() {
        let r = ApiResponse::ok("hello");
        assert_eq!(r.data, "hello");
    }

    #[test]
    fn api_response_ok_has_no_message() {
        let r = ApiResponse::ok(0u8);
        assert!(r.message.is_none());
    }

    #[test]
    fn api_response_with_message_sets_message() {
        let r = ApiResponse::with_message(1u32, "created");
        assert!(r.success);
        assert_eq!(r.message.as_deref(), Some("created"));
    }

    // ------------------------------------------------------------------
    // PageParams defaults and offset calculation
    // ------------------------------------------------------------------

    #[test]
    fn page_params_defaults_page_to_1() {
        let p = PageParams { page: None, limit: None, sort: None, order: None };
        assert_eq!(p.page(), 1);
    }

    #[test]
    fn page_params_defaults_limit_to_50() {
        let p = PageParams { page: None, limit: None, sort: None, order: None };
        assert_eq!(p.limit(), 50);
    }

    #[test]
    fn page_params_page_0_is_clamped_to_1() {
        let p = PageParams { page: Some(0), limit: Some(10), sort: None, order: None };
        assert_eq!(p.page(), 1);
    }

    #[test]
    fn page_params_limit_over_100_is_clamped_to_100() {
        let p = PageParams { page: Some(1), limit: Some(200), sort: None, order: None };
        assert_eq!(p.limit(), 100);
    }

    #[test]
    fn page_params_offset_page_3_limit_10_is_20() {
        let p = PageParams { page: Some(3), limit: Some(10), sort: None, order: None };
        assert_eq!(p.offset(), 20);
    }

    #[test]
    fn page_params_offset_page_1_is_0() {
        let p = PageParams { page: Some(1), limit: Some(25), sort: None, order: None };
        assert_eq!(p.offset(), 0);
    }

    // ------------------------------------------------------------------
    // PagedResponse
    // ------------------------------------------------------------------

    #[test]
    fn paged_response_success_is_true() {
        let r: PagedResponse<u32> = PagedResponse::new(vec![1, 2, 3], 1, 10, 3);
        assert!(r.success);
    }

    #[test]
    fn paged_response_computes_pages_correctly() {
        // 25 items with a limit of 10 → 3 pages
        let r: PagedResponse<u32> = PagedResponse::new(vec![], 1, 10, 25);
        assert_eq!(r.pagination.pages, 3);
    }

    #[test]
    fn paged_response_single_page_when_total_fits() {
        let r: PagedResponse<u32> = PagedResponse::new(vec![1], 1, 50, 1);
        assert_eq!(r.pagination.pages, 1);
    }

    // ------------------------------------------------------------------
    // SortOrder
    // ------------------------------------------------------------------

    #[test]
    fn sort_order_asc_as_sql() {
        assert_eq!(SortOrder::Asc.as_sql(), "ASC");
    }

    #[test]
    fn sort_order_desc_as_sql() {
        assert_eq!(SortOrder::Desc.as_sql(), "DESC");
    }

    #[test]
    fn sort_order_default_is_asc() {
        assert_eq!(SortOrder::default(), SortOrder::Asc);
    }
}
