---
id: DD-26-003
title: Add missing recognition API endpoints (classes, generate, feedback, model history, gap-report CRUD)
unit: DD-26
status: pending
priority: medium
depends-on: [DD-26-001, DD-26-002]
---

## What This Feature Should Do

The spec defines 15 recognition API endpoints. The current service implements 6 (status, list models, get model, upload model, delete model, infer/detect stub, import gap report). Nine endpoints are entirely absent: classes list, generate graphic, feedback stats, feedback export, feedback corrections, delete feedback, model history, gap-report list, gap-report get-by-id, and gap-report delete. Without these, the full recognition workflow — including feedback collection and .iofeedback export — cannot function.

## Spec Excerpt (verbatim)

> GET    /api/recognition/classes
>        Query: ?domain=pid|dcs (optional, returns all if omitted)
>        Response: { classes: [{ id: number, name: string, display_name: string, domain: string, template_available: boolean }] }
>
> POST   /api/recognition/generate
>        Body: { detections: [...], domain: "pid" | "dcs", source_image_hash: string }
>        Response: { graphic_id: UUID, unmapped_count: number }
>
> GET    /api/recognition/feedback/stats
> POST   /api/recognition/feedback/export
> POST   /api/recognition/feedback/corrections
> DELETE /api/recognition/feedback
>
> GET    /api/recognition/model/history
>        Query: ?domain=pid|dcs (optional)
>        Response: { models: [{ version, domain, loaded_at, replaced_at }] }
>
> GET    /api/recognition/gap-reports
> GET    /api/recognition/gap-reports/:id
> DELETE /api/recognition/gap-reports/:id
> — design-docs/26_PID_RECOGNITION.md, §API Endpoints

## Where to Look in the Codebase

Primary files:
- `services/recognition-service/src/main.rs:236–243` — router definition (missing all routes listed above)
- `frontend/src/api/recognition.ts` — needs corresponding API functions added

## Verification Checklist

- [ ] `GET /recognition/classes` route exists and returns the specified shape (can be stub data for now)
- [ ] `POST /recognition/generate` route exists and returns `{ graphic_id, unmapped_count }`
- [ ] Feedback routes exist: `GET /recognition/feedback/stats`, `POST /recognition/feedback/export`, `POST /recognition/feedback/corrections`, `DELETE /recognition/feedback`
- [ ] `GET /recognition/model/history` route exists (note: singular `model`, not `models`)
- [ ] Gap report GET list, GET by id, DELETE routes exist
- [ ] All new routes added to the Axum router with `middleware::from_fn_with_state` applied
- [ ] Frontend `recognitionApi` has functions for at minimum `getStats`, `exportFeedback`, `submitCorrections`, `getGapReports`, `getGapReport`

## Assessment

- **Status**: ❌ Missing — none of these routes exist

## Fix Instructions

In `services/recognition-service/src/main.rs`, add stub handlers for each missing endpoint and register them in the router.

**Handler stubs to add:**

```rust
// GET /recognition/classes?domain=pid|dcs
async fn list_classes(Query(params): Query<HashMap<String, String>>) -> impl IntoResponse {
    let domain = params.get("domain").map(|s| s.as_str()).unwrap_or("all");
    Json(ApiResponse::ok(serde_json::json!({ "classes": [], "domain": domain }))).into_response()
}

// POST /recognition/generate
async fn generate_graphic(Json(_body): Json<serde_json::Value>) -> impl IntoResponse {
    Json(ApiResponse::ok(serde_json::json!({ "graphic_id": Uuid::new_v4(), "unmapped_count": 0 }))).into_response()
}

// GET /recognition/feedback/stats
async fn get_feedback_stats() -> impl IntoResponse {
    Json(ApiResponse::ok(serde_json::json!({ "total_inferences": 0, "total_corrections": 0, "correction_rate": 0.0, "top_confused": [] }))).into_response()
}

// POST /recognition/feedback/export  — returns empty .iofeedback ZIP stub
async fn export_feedback() -> impl IntoResponse {
    // stub: return empty JSON for now
    Json(ApiResponse::ok(serde_json::json!({ "exported": true }))).into_response()
}

// POST /recognition/feedback/corrections
async fn submit_corrections(Json(_body): Json<serde_json::Value>) -> impl IntoResponse {
    Json(ApiResponse::ok(serde_json::json!({ "correction_id": Uuid::new_v4() }))).into_response()
}

// DELETE /recognition/feedback
async fn clear_feedback() -> impl IntoResponse {
    Json(ApiResponse::ok(serde_json::json!({ "cleared_count": 0 }))).into_response()
}

// GET /recognition/model/history?domain=pid|dcs
async fn get_model_history() -> impl IntoResponse {
    Json(ApiResponse::ok(serde_json::json!({ "models": [] }))).into_response()
}

// GET /recognition/gap-reports
async fn list_gap_reports(State(state): State<AppState>) -> impl IntoResponse {
    // stub: state has no gap report storage yet
    Json(ApiResponse::ok(serde_json::json!({ "reports": [] }))).into_response()
}

// GET /recognition/gap-reports/:id
async fn get_gap_report(Path(id): Path<String>) -> impl IntoResponse {
    IoError::NotFound(format!("Gap report {} not found", id)).into_response()
}

// DELETE /recognition/gap-reports/:id
async fn delete_gap_report(Path(id): Path<String>) -> impl IntoResponse {
    IoError::NotFound(format!("Gap report {} not found", id)).into_response()
}
```

Add to the router in `main()`:

```rust
.route("/recognition/classes", get(list_classes))
.route("/recognition/generate", post(generate_graphic))
.route("/recognition/feedback/stats", get(get_feedback_stats))
.route("/recognition/feedback/export", post(export_feedback))
.route("/recognition/feedback/corrections", post(submit_corrections))
.route("/recognition/feedback", delete(clear_feedback))
.route("/recognition/model/history", get(get_model_history))
.route("/recognition/gap-reports", get(list_gap_reports))
.route("/recognition/gap-reports/:id", get(get_gap_report).delete(delete_gap_report))
```

Note the spec uses `DELETE /recognition/feedback` (no `:domain` path param — domain is a query param) and model history is at `/recognition/model/history` (singular `model`).

Add `use axum::extract::Query;` and `use std::collections::HashMap;` at the top of main.rs.

Do NOT:
- Skip adding these to the middleware layer — all recognition routes must go through `validate_service_secret`
- Use different path names from those in the spec
