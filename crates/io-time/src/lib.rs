use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

// ---------------------------------------------------------------------------
// Bucket rounding
// ---------------------------------------------------------------------------

/// Round a Unix timestamp (seconds) down to the nearest bucket boundary.
///
/// `bucket_secs` must be > 0; a value of 0 is treated as 1.
pub fn round_to_bucket(timestamp_secs: i64, bucket_secs: i64) -> i64 {
    let b = bucket_secs.max(1);
    (timestamp_secs / b) * b
}

// ---------------------------------------------------------------------------
// Human-readable duration formatting
// ---------------------------------------------------------------------------

/// Format a duration in seconds as a human-readable string.
///
/// Examples: `45s`, `1m 30s`, `1h 1m`, `2h 0m`.
pub fn format_duration_human(total_secs: u64) -> String {
    let hours = total_secs / 3600;
    let mins = (total_secs % 3600) / 60;
    let secs = total_secs % 60;

    if hours > 0 {
        format!("{}h {}m", hours, mins)
    } else if mins > 0 {
        format!("{}m {}s", mins, secs)
    } else {
        format!("{}s", secs)
    }
}

// ---------------------------------------------------------------------------
// Window membership (inclusive on both ends)
// ---------------------------------------------------------------------------

/// Return `true` if `ts` falls within the closed window `[start, end]`.
pub fn is_within_window(ts: DateTime<Utc>, start: DateTime<Utc>, end: DateTime<Utc>) -> bool {
    ts >= start && ts <= end
}

/// Return the current UTC timestamp.
pub fn now_utc() -> DateTime<Utc> {
    Utc::now()
}

/// Parse an RFC 3339 string into a `DateTime<Utc>`.
pub fn parse_rfc3339(s: &str) -> Result<DateTime<Utc>, chrono::ParseError> {
    s.parse::<DateTime<Utc>>()
}

/// A half-open time interval `[start, end)`.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub struct TimeRange {
    pub start: DateTime<Utc>,
    pub end: DateTime<Utc>,
}

impl TimeRange {
    pub fn new(start: DateTime<Utc>, end: DateTime<Utc>) -> Self {
        Self { start, end }
    }

    /// Duration of the range.
    pub fn duration(&self) -> chrono::Duration {
        self.end - self.start
    }

    /// Returns true if the given timestamp falls within `[start, end)`.
    pub fn contains(&self, ts: &DateTime<Utc>) -> bool {
        ts >= &self.start && ts < &self.end
    }

    /// Construct a TimeRange for the last `minutes` minutes up to now.
    pub fn last_minutes(minutes: i64) -> Self {
        let end = Utc::now();
        let start = end - chrono::Duration::minutes(minutes);
        Self { start, end }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::TimeZone;

    // Helper: build a UTC DateTime from a Unix timestamp (seconds).
    fn ts(secs: i64) -> DateTime<Utc> {
        Utc.timestamp_opt(secs, 0).single().unwrap()
    }

    // ------------------------------------------------------------------
    // round_to_bucket
    // ------------------------------------------------------------------

    #[test]
    fn round_to_bucket_65s_rounds_to_60s_with_60s_bucket() {
        assert_eq!(round_to_bucket(65, 60), 60);
    }

    #[test]
    fn round_to_bucket_3700s_rounds_to_3600s_with_1h_bucket() {
        assert_eq!(round_to_bucket(3700, 3600), 3600);
    }

    #[test]
    fn round_to_bucket_exact_boundary_is_unchanged() {
        assert_eq!(round_to_bucket(3600, 3600), 3600);
    }

    #[test]
    fn round_to_bucket_zero_bucket_treated_as_one() {
        assert_eq!(round_to_bucket(42, 0), 42);
    }

    // ------------------------------------------------------------------
    // format_duration_human
    // ------------------------------------------------------------------

    #[test]
    fn format_duration_human_45_seconds() {
        assert_eq!(format_duration_human(45), "45s");
    }

    #[test]
    fn format_duration_human_90_seconds_is_1m_30s() {
        assert_eq!(format_duration_human(90), "1m 30s");
    }

    #[test]
    fn format_duration_human_3661_seconds_is_1h_1m() {
        assert_eq!(format_duration_human(3661), "1h 1m");
    }

    #[test]
    fn format_duration_human_0_seconds() {
        assert_eq!(format_duration_human(0), "0s");
    }

    #[test]
    fn format_duration_human_exactly_1_hour() {
        assert_eq!(format_duration_human(3600), "1h 0m");
    }

    // ------------------------------------------------------------------
    // is_within_window
    // ------------------------------------------------------------------

    #[test]
    fn is_within_window_timestamp_in_middle_returns_true() {
        assert!(is_within_window(ts(500), ts(0), ts(1000)));
    }

    #[test]
    fn is_within_window_timestamp_exactly_at_start_returns_true() {
        assert!(is_within_window(ts(0), ts(0), ts(1000)));
    }

    #[test]
    fn is_within_window_timestamp_exactly_at_end_returns_true() {
        assert!(is_within_window(ts(1000), ts(0), ts(1000)));
    }

    #[test]
    fn is_within_window_timestamp_before_start_returns_false() {
        assert!(!is_within_window(ts(0), ts(1), ts(1000)));
    }

    #[test]
    fn is_within_window_timestamp_after_end_returns_false() {
        assert!(!is_within_window(ts(1001), ts(0), ts(1000)));
    }

    // ------------------------------------------------------------------
    // TimeRange::contains (half-open [start, end))
    // ------------------------------------------------------------------

    #[test]
    fn time_range_contains_start_is_inclusive() {
        let r = TimeRange::new(ts(100), ts(200));
        assert!(r.contains(&ts(100)));
    }

    #[test]
    fn time_range_contains_end_is_exclusive() {
        let r = TimeRange::new(ts(100), ts(200));
        assert!(!r.contains(&ts(200)));
    }

    #[test]
    fn time_range_contains_interior_timestamp() {
        let r = TimeRange::new(ts(100), ts(200));
        assert!(r.contains(&ts(150)));
    }

    #[test]
    fn time_range_contains_before_start_is_false() {
        let r = TimeRange::new(ts(100), ts(200));
        assert!(!r.contains(&ts(99)));
    }
}
