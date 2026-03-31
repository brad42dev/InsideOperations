use serde::{Deserialize, Serialize};
use thiserror::Error;

// ---------------------------------------------------------------------------
// ValidationError
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Error, Serialize, Deserialize)]
#[error("validation failed for field `{field}`: {message}")]
pub struct ValidationError {
    pub field: String,
    pub message: String,
}

impl ValidationError {
    pub fn new(field: impl Into<String>, message: impl Into<String>) -> Self {
        Self {
            field: field.into(),
            message: message.into(),
        }
    }
}

// ---------------------------------------------------------------------------
// Individual validators
// ---------------------------------------------------------------------------

/// Validate a username: 3–50 characters, alphanumeric + underscore only.
pub fn validate_username(username: &str) -> Result<(), ValidationError> {
    let len = username.len();
    if !(3..=50).contains(&len) {
        return Err(ValidationError::new(
            "username",
            "must be between 3 and 50 characters",
        ));
    }
    if !username.chars().all(|c| c.is_alphanumeric() || c == '_') {
        return Err(ValidationError::new(
            "username",
            "must contain only alphanumeric characters and underscores",
        ));
    }
    Ok(())
}

/// Validate an email address (basic RFC 5322 surface check).
pub fn validate_email(email: &str) -> Result<(), ValidationError> {
    let parts: Vec<&str> = email.splitn(2, '@').collect();
    if parts.len() != 2 || parts[0].is_empty() || parts[1].is_empty() {
        return Err(ValidationError::new(
            "email",
            "must be a valid email address",
        ));
    }
    if !parts[1].contains('.') {
        return Err(ValidationError::new("email", "domain must contain a dot"));
    }
    if email.len() > 254 {
        return Err(ValidationError::new(
            "email",
            "must be 254 characters or fewer",
        ));
    }
    Ok(())
}

/// Validate a password: at least 8 chars, one uppercase, one lowercase, one digit.
pub fn validate_password(password: &str) -> Result<(), ValidationError> {
    if password.len() < 8 {
        return Err(ValidationError::new(
            "password",
            "must be at least 8 characters",
        ));
    }
    let has_upper = password.chars().any(|c| c.is_uppercase());
    let has_lower = password.chars().any(|c| c.is_lowercase());
    let has_digit = password.chars().any(|c| c.is_ascii_digit());

    if !has_upper {
        return Err(ValidationError::new(
            "password",
            "must contain at least one uppercase letter",
        ));
    }
    if !has_lower {
        return Err(ValidationError::new(
            "password",
            "must contain at least one lowercase letter",
        ));
    }
    if !has_digit {
        return Err(ValidationError::new(
            "password",
            "must contain at least one digit",
        ));
    }
    Ok(())
}

/// Validate that a string is a valid UUID (any version).
pub fn validate_uuid_str(s: &str) -> Result<(), ValidationError> {
    uuid::Uuid::parse_str(s)
        .map(|_| ())
        .map_err(|_| ValidationError::new("id", format!("`{s}` is not a valid UUID")))
}

// ---------------------------------------------------------------------------
// Batch helper
// ---------------------------------------------------------------------------

/// Collect multiple validation results, returning the first error if any.
pub fn all(results: Vec<Result<(), ValidationError>>) -> Result<(), ValidationError> {
    for r in results {
        r?;
    }
    Ok(())
}

/// Strip leading/trailing ASCII whitespace and collapse runs of internal
/// whitespace to a single space.
pub fn sanitize_string(s: &str) -> String {
    s.split_whitespace().collect::<Vec<_>>().join(" ")
}

/// Validated pagination parameters with clamping.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ValidatedPagination {
    /// Current page number (≥ 1).
    pub page: u32,
    /// Items per page (1–100).
    pub per_page: u32,
}

impl Default for ValidatedPagination {
    fn default() -> Self {
        Self {
            page: 1,
            per_page: 25,
        }
    }
}

impl ValidatedPagination {
    /// 0-based offset suitable for SQL `OFFSET` clauses.
    pub fn offset(&self) -> u64 {
        (self.page.saturating_sub(1) as u64) * self.per_page as u64
    }
}

/// Validate and clamp pagination query parameters.
///
/// * `page` is clamped to a minimum of 1 (zero becomes 1).
/// * `per_page` is clamped to the range `[1, max_per_page]` (zero becomes 25).
pub fn validate_pagination(page: u32, per_page: u32, max_per_page: u32) -> ValidatedPagination {
    let max = max_per_page.max(1);
    ValidatedPagination {
        page: page.max(1),
        per_page: if per_page == 0 { 25 } else { per_page.min(max) },
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // ------------------------------------------------------------------
    // validate_username
    // ------------------------------------------------------------------

    #[test]
    fn valid_username_is_accepted() {
        assert!(validate_username("alice").is_ok());
        assert!(validate_username("user_name_42").is_ok());
        assert!(validate_username("abc").is_ok()); // minimum length
    }

    #[test]
    fn empty_username_is_rejected() {
        assert!(validate_username("").is_err());
    }

    #[test]
    fn username_too_short_is_rejected() {
        assert!(validate_username("ab").is_err());
    }

    #[test]
    fn username_too_long_is_rejected() {
        let long = "a".repeat(51);
        assert!(validate_username(&long).is_err());
    }

    #[test]
    fn username_exactly_50_chars_is_accepted() {
        let name = "a".repeat(50);
        assert!(validate_username(&name).is_ok());
    }

    #[test]
    fn username_with_semicolon_is_rejected() {
        assert!(validate_username("user;name").is_err());
    }

    #[test]
    fn username_with_sql_injection_characters_is_rejected() {
        assert!(validate_username("drop--table").is_err());
        assert!(validate_username("user'or'1'='1").is_err());
    }

    #[test]
    fn username_with_space_is_rejected() {
        assert!(validate_username("hello world").is_err());
    }

    // ------------------------------------------------------------------
    // validate_email
    // ------------------------------------------------------------------

    #[test]
    fn valid_email_is_accepted() {
        assert!(validate_email("user@example.com").is_ok());
        assert!(validate_email("first.last+tag@sub.domain.org").is_ok());
    }

    #[test]
    fn email_missing_at_sign_is_rejected() {
        assert!(validate_email("notanemail.com").is_err());
    }

    #[test]
    fn empty_email_is_rejected() {
        assert!(validate_email("").is_err());
    }

    #[test]
    fn email_with_empty_local_part_is_rejected() {
        assert!(validate_email("@example.com").is_err());
    }

    #[test]
    fn email_with_empty_domain_part_is_rejected() {
        assert!(validate_email("user@").is_err());
    }

    #[test]
    fn email_domain_without_dot_is_rejected() {
        assert!(validate_email("user@localhost").is_err());
    }

    // ------------------------------------------------------------------
    // sanitize_string
    // ------------------------------------------------------------------

    #[test]
    fn sanitize_string_strips_leading_whitespace() {
        assert_eq!(sanitize_string("  hello"), "hello");
    }

    #[test]
    fn sanitize_string_strips_trailing_whitespace() {
        assert_eq!(sanitize_string("hello  "), "hello");
    }

    #[test]
    fn sanitize_string_collapses_internal_whitespace() {
        assert_eq!(sanitize_string("hello   world"), "hello world");
    }

    #[test]
    fn sanitize_string_handles_tabs_and_newlines() {
        assert_eq!(sanitize_string("\thello\n  world\t"), "hello world");
    }

    #[test]
    fn sanitize_string_empty_input_returns_empty() {
        assert_eq!(sanitize_string(""), "");
    }

    // ------------------------------------------------------------------
    // validate_pagination
    // ------------------------------------------------------------------

    #[test]
    fn validate_pagination_zero_page_is_clamped_to_one() {
        let p = validate_pagination(0, 10, 100);
        assert_eq!(p.page, 1);
    }

    #[test]
    fn validate_pagination_zero_per_page_defaults_to_25() {
        let p = validate_pagination(1, 0, 100);
        assert_eq!(p.per_page, 25);
    }

    #[test]
    fn validate_pagination_per_page_clamped_to_max() {
        let p = validate_pagination(1, 200, 100);
        assert_eq!(p.per_page, 100);
    }

    #[test]
    fn validate_pagination_valid_values_pass_through() {
        let p = validate_pagination(3, 10, 100);
        assert_eq!(p.page, 3);
        assert_eq!(p.per_page, 10);
    }

    #[test]
    fn validated_pagination_default_values() {
        let p = ValidatedPagination::default();
        assert_eq!(p.page, 1);
        assert_eq!(p.per_page, 25);
    }

    #[test]
    fn validated_pagination_offset_for_page_3_per_page_10() {
        let p = ValidatedPagination {
            page: 3,
            per_page: 10,
        };
        assert_eq!(p.offset(), 20);
    }

    #[test]
    fn validated_pagination_offset_page_1_is_zero() {
        let p = ValidatedPagination {
            page: 1,
            per_page: 25,
        };
        assert_eq!(p.offset(), 0);
    }
}
