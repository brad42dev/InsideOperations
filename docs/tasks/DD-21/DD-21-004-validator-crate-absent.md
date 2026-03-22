---
id: DD-21-004
title: Add validator crate for declarative input validation rules
unit: DD-21
status: pending
priority: low
depends-on: []
---

## What This Feature Should Do

Request bodies must be validated with field-level rules — not just structural deserialization. Required fields, string length limits, email format, URL format, UUID format, and numeric ranges must be checked before any database operation runs, and detailed `VALIDATION_ERROR` responses returned when checks fail.

## Spec Excerpt (verbatim)

> ### Validation Libraries
> - Use serde for deserialization (type safety)
> - Use validator crate for validation rules
> - Return 400 Bad Request with detailed error messages
> — design-docs/21_API_DESIGN.md, §Input Validation

> ### Backend Validation
> - Validate all inputs before processing
> - Type checking (string, number, boolean, UUID)
> - Range checking (min/max values)
> - Format checking (email, URL, date)
> - Required field checking
> — design-docs/21_API_DESIGN.md, §Input Validation

## Where to Look in the Codebase

Primary files:
- `services/api-gateway/Cargo.toml` — No `validator` dependency present.
- `services/api-gateway/src/handlers/console.rs:29-50` — `CreateWorkspaceBody` and `UpdateWorkspaceBody` have no validation attributes; `name: String` can be empty, whitespace-only, or over any length.
- `services/api-gateway/src/handlers/rounds.rs` — Template create/update bodies lack length/format checks.
- `services/api-gateway/src/handlers/logs.rs` — Log template/segment bodies lack validation.
- `services/api-gateway/src/handlers/dashboards.rs` — Dashboard create bodies lack validation.
- `crates/io-error/src/lib.rs:46` — `IoError::Validation(Vec<FieldError>)` is already defined and produces the correct `VALIDATION_ERROR` response envelope.

## Verification Checklist

- [ ] `validator` crate (MIT-licensed) is listed in `services/api-gateway/Cargo.toml` dependencies.
- [ ] Request body structs use `#[derive(Validate)]` and `#[validate(...)]` attributes for at minimum: non-empty strings, max length, email format where applicable.
- [ ] Handler functions call `.validate()` on the deserialized body and convert errors to `IoError::Validation(fields)` before any DB query.
- [ ] A `VALIDATION_ERROR` 400 response is returned (not a 500 serde error) when a field violates a rule.
- [ ] The `details` array in the error response contains one entry per invalid field with `field` and `message` keys.

## Assessment

- **Status**: ❌ Missing
- **If partial/missing**: No `validator` crate dependency. No `#[validate]` attributes anywhere in the handler codebase. Validation is entirely implicit through serde — a missing required JSON field causes a serde 422 or the field becomes `None` silently, not a `VALIDATION_ERROR` 400.

## Fix Instructions

1. **Add dependency** to `services/api-gateway/Cargo.toml`:
   ```toml
   validator = { version = "0.18", features = ["derive"] }
   ```
   The `validator` crate is MIT-licensed — acceptable under project licensing rules.

2. **Add `Validate` derive** to each request body struct. Example for `CreateWorkspaceBody`:
   ```rust
   use validator::Validate;

   #[derive(Debug, Deserialize, Validate)]
   pub struct CreateWorkspaceBody {
       #[validate(length(min = 1, max = 255, message = "Name must be 1–255 characters"))]
       pub name: String,
       pub metadata: Option<JsonValue>,
   }
   ```

3. **Add validation call** at the start of each handler that accepts a request body:
   ```rust
   if let Err(validation_errors) = body.validate() {
       let fields: Vec<io_error::FieldError> = validation_errors
           .field_errors()
           .iter()
           .flat_map(|(field, errors)| {
               errors.iter().map(|e| io_error::FieldError::new(
                   field.to_string(),
                   e.message.as_deref().unwrap_or("Invalid value").to_string(),
               ))
           })
           .collect();
       return IoError::Validation(fields).into_response();
   }
   ```

4. **Priority structs to annotate first** (highest risk for missing validation):
   - All `Create*Body` structs — name required, non-empty
   - Any struct with an email field — `#[validate(email)]`
   - Any struct with a URL field — `#[validate(url)]`
   - Any struct with UUID strings passed as body params — parse with `Uuid::parse_str` and return `IoError::field("field", "must be a valid UUID")` on error.

5. **Do not add validation to update structs with all-`Option` fields** — those are PATCH-style and any/all fields may be absent by design.

Do NOT:
- Replace the `validator` crate with a home-grown validation approach — the spec names this crate specifically.
- Remove serde deserialization — both serde and validator work together (serde handles type coercion, validator handles business rules).
- Return a generic 500 for validation failures — always use `IoError::Validation` which produces a 400 with field details.
