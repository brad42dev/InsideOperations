/// Report generation engine for the API Gateway.
///
/// Supports four output formats: CSV, XLSX, HTML, JSON.
/// For "pdf" format, an HTML document is generated (PDF rendering via Typst
/// is deferred to a future phase when typst-as-lib compilation is stabilised).
///
/// Generation steps:
///   1. Fetch template config from report_templates (direct DB query).
///   2. Execute data queries based on template name / category.
///   3. Render output in the requested format.
///   4. Write file to export_dir and return (file_path, file_size_bytes).
use chrono::Utc;
use serde_json::Value as JsonValue;
use sqlx::PgPool;
use sqlx::Row;
use uuid::Uuid;

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

/// Generate a report job, writing the output file to `export_dir`.
/// Returns `(file_path, file_size_bytes)` on success or an error message.
pub async fn generate_report_job(
    db: &PgPool,
    job_id: Uuid,
    template_id: Uuid,
    format: &str,
    params: JsonValue,
    export_dir: &str,
) -> Result<(String, u64), String> {
    // Fetch the template
    let tmpl_row = sqlx::query(
        "SELECT id, name, description, category FROM report_templates WHERE id = $1",
    )
    .bind(template_id)
    .fetch_optional(db)
    .await
    .map_err(|e| format!("DB error fetching template: {e}"))?
    .ok_or_else(|| format!("Template {template_id} not found"))?;

    let template_name: String = tmpl_row.try_get("name").unwrap_or_default();
    let template_description: String = tmpl_row
        .try_get::<Option<String>, _>("description")
        .unwrap_or_default()
        .unwrap_or_default();
    let category: String = tmpl_row
        .try_get::<Option<String>, _>("category")
        .unwrap_or_default()
        .unwrap_or_default();

    // Execute data queries and build (headers, rows) based on template name
    let (headers, rows) = execute_report_query(db, &template_name, &category, &params).await?;

    // Determine file extension; pdf gets its own ext
    let file_ext = match format {
        "pdf" => "pdf",
        "csv" => "csv",
        "xlsx" => "xlsx",
        "json" => "json",
        "html" => "html",
        other => return Err(format!("Unknown format: {other}")),
    };

    // Build the file name: <job_id>.<ext>
    let file_name = format!("{job_id}.{file_ext}");
    let file_path = format!("{export_dir}/{file_name}");

    // Generate content bytes
    let content: Vec<u8> = match format {
        "csv" => generate_csv(&headers, &rows),
        "xlsx" => generate_xlsx(&template_name, &headers, &rows)
            .map_err(|e| format!("XLSX generation failed: {e}"))?,
        "json" => generate_json(&headers, &rows),
        "pdf" => generate_pdf_report(
            &template_name,
            &template_description,
            &headers,
            &rows,
            &params,
        ),
        _ => {
            // html
            generate_html_report(&template_name, &template_description, &headers, &rows, &params)
                .into_bytes()
        }
    };

    let file_size = content.len() as u64;

    // Ensure export directory exists
    std::fs::create_dir_all(export_dir)
        .map_err(|e| format!("Failed to create export dir {export_dir}: {e}"))?;

    std::fs::write(&file_path, &content)
        .map_err(|e| format!("Failed to write report file {file_path}: {e}"))?;

    Ok((file_path, file_size))
}

// ---------------------------------------------------------------------------
// Data query execution
// ---------------------------------------------------------------------------

/// Execute the appropriate DB query for the given template and return
/// (column_headers, data_rows).
async fn execute_report_query(
    db: &PgPool,
    template_name: &str,
    _category: &str,
    params: &JsonValue,
) -> Result<(Vec<String>, Vec<Vec<String>>), String> {
    match template_name {
        "Point Value Trend" => query_point_value_trend(db, params).await,
        "Statistical Summary" => query_statistical_summary(db, params).await,
        "Alarm Rate Summary" => query_alarm_rate_summary(db, params).await,
        "Top N Bad Actor Alarms" => query_top_bad_actors(db, params).await,
        "Standing/Stale Alarms" => query_standing_alarms(db, params).await,
        "Chattering Alarms" => query_chattering_alarms(db, params).await,
        "Alarm Flood Analysis" => query_alarm_flood(db, params).await,
        "Alarm Priority Distribution" => query_alarm_priority_distribution(db, params).await,
        "Alarm System Health Summary" => query_alarm_health_summary(db, params).await,
        "Alarm System Health Executive" => query_alarm_health_summary(db, params).await,
        "Round Completion Rate" => query_round_completion_rate(db, params).await,
        "Overdue Rounds" => query_overdue_rounds(db, params).await,
        "Exception Report" => query_round_exceptions(db, params).await,
        _ => Ok(placeholder_report(template_name, params)),
    }
}

// ---------------------------------------------------------------------------
// Individual query implementations
// ---------------------------------------------------------------------------

async fn query_point_value_trend(
    db: &PgPool,
    params: &JsonValue,
) -> Result<(Vec<String>, Vec<Vec<String>>), String> {
    let time_range = params
        .get("time_range")
        .and_then(|v| v.as_str())
        .unwrap_or("last_24h");

    let (start_expr, end_expr) = time_range_to_sql(time_range);

    let rows = sqlx::query(
        &format!(
            "SELECT p.tag_path, ph.time, ph.value, ph.quality
             FROM points_history_1h ph
             JOIN points p ON p.id = ph.point_id
             WHERE ph.time >= {start_expr} AND ph.time <= {end_expr}
             ORDER BY p.tag_path, ph.time
             LIMIT 5000"
        ),
    )
    .fetch_all(db)
    .await
    .map_err(|e| format!("DB error in Point Value Trend: {e}"))?;

    let headers = vec![
        "Tag Path".to_string(),
        "Timestamp".to_string(),
        "Value".to_string(),
        "Quality".to_string(),
    ];

    let data: Vec<Vec<String>> = rows
        .iter()
        .map(|r| {
            vec![
                r.try_get::<String, _>("tag_path").unwrap_or_default(),
                r.try_get::<chrono::DateTime<Utc>, _>("time")
                    .map(|t| t.to_rfc3339())
                    .unwrap_or_default(),
                r.try_get::<f64, _>("value")
                    .map(|v| format!("{v:.4}"))
                    .unwrap_or_default(),
                r.try_get::<String, _>("quality").unwrap_or_default(),
            ]
        })
        .collect();

    Ok((headers, data))
}

async fn query_statistical_summary(
    db: &PgPool,
    params: &JsonValue,
) -> Result<(Vec<String>, Vec<Vec<String>>), String> {
    let time_range = params
        .get("time_range")
        .and_then(|v| v.as_str())
        .unwrap_or("last_24h");

    let (start_expr, end_expr) = time_range_to_sql(time_range);

    let rows = sqlx::query(
        &format!(
            "SELECT p.tag_path,
                    MIN(ph.value)  AS min_val,
                    MAX(ph.value)  AS max_val,
                    AVG(ph.value)  AS avg_val,
                    STDDEV(ph.value) AS stddev_val,
                    COUNT(*)       AS sample_count
             FROM points_history_1h ph
             JOIN points p ON p.id = ph.point_id
             WHERE ph.time >= {start_expr} AND ph.time <= {end_expr}
             GROUP BY p.tag_path
             ORDER BY p.tag_path
             LIMIT 1000"
        ),
    )
    .fetch_all(db)
    .await
    .map_err(|e| format!("DB error in Statistical Summary: {e}"))?;

    let headers = vec![
        "Tag Path".to_string(),
        "Minimum".to_string(),
        "Maximum".to_string(),
        "Average".to_string(),
        "Std Dev".to_string(),
        "Sample Count".to_string(),
    ];

    let data: Vec<Vec<String>> = rows
        .iter()
        .map(|r| {
            vec![
                r.try_get::<String, _>("tag_path").unwrap_or_default(),
                r.try_get::<f64, _>("min_val")
                    .map(|v| format!("{v:.4}"))
                    .unwrap_or_default(),
                r.try_get::<f64, _>("max_val")
                    .map(|v| format!("{v:.4}"))
                    .unwrap_or_default(),
                r.try_get::<f64, _>("avg_val")
                    .map(|v| format!("{v:.4}"))
                    .unwrap_or_default(),
                r.try_get::<f64, _>("stddev_val")
                    .map(|v| format!("{v:.4}"))
                    .unwrap_or_default(),
                r.try_get::<i64, _>("sample_count")
                    .map(|v| v.to_string())
                    .unwrap_or_default(),
            ]
        })
        .collect();

    Ok((headers, data))
}

async fn query_alarm_rate_summary(
    db: &PgPool,
    params: &JsonValue,
) -> Result<(Vec<String>, Vec<Vec<String>>), String> {
    let time_range = params
        .get("time_range")
        .and_then(|v| v.as_str())
        .unwrap_or("last_24h");

    let (start_expr, end_expr) = time_range_to_sql(time_range);

    // Count alarms per hour bucket
    let rows = sqlx::query(
        &format!(
            "SELECT
                 date_trunc('hour', occurred_at) AS hour_bucket,
                 COUNT(*) AS alarm_count
             FROM events
             WHERE occurred_at >= {start_expr} AND occurred_at <= {end_expr}
             GROUP BY hour_bucket
             ORDER BY hour_bucket"
        ),
    )
    .fetch_all(db)
    .await
    .map_err(|e| format!("DB error in Alarm Rate Summary: {e}"))?;

    let headers = vec![
        "Hour".to_string(),
        "Alarm Count".to_string(),
        "Rate (per 10 min)".to_string(),
        "EEMUA Status".to_string(),
    ];

    let data: Vec<Vec<String>> = rows
        .iter()
        .map(|r| {
            let count: i64 = r.try_get("alarm_count").unwrap_or(0);
            // EEMUA 191: >10 alarms/10 min is a flood
            let rate_per_10min = count as f64 / 6.0;
            let eemua_status = if rate_per_10min > 10.0 {
                "FLOOD"
            } else if rate_per_10min > 1.0 {
                "HIGH"
            } else if rate_per_10min > 0.5 {
                "MANAGEABLE"
            } else {
                "OK"
            };
            vec![
                r.try_get::<chrono::DateTime<Utc>, _>("hour_bucket")
                    .map(|t| t.to_rfc3339())
                    .unwrap_or_default(),
                count.to_string(),
                format!("{rate_per_10min:.2}"),
                eemua_status.to_string(),
            ]
        })
        .collect();

    Ok((headers, data))
}

async fn query_top_bad_actors(
    db: &PgPool,
    params: &JsonValue,
) -> Result<(Vec<String>, Vec<Vec<String>>), String> {
    let time_range = params
        .get("time_range")
        .and_then(|v| v.as_str())
        .unwrap_or("last_24h");

    let top_n: i64 = params
        .get("top_n")
        .and_then(|v| v.as_i64())
        .unwrap_or(20);

    let (start_expr, end_expr) = time_range_to_sql(time_range);

    let rows = sqlx::query(
        &format!(
            "SELECT
                 ad.name AS alarm_name,
                 p.tag_path,
                 ae.priority,
                 COUNT(*) AS occurrence_count
             FROM events ae
             JOIN alarm_definitions ad ON ad.id = ae.alarm_definition_id
             LEFT JOIN points p ON p.id = ad.point_id
             WHERE ae.occurred_at >= {start_expr} AND ae.occurred_at <= {end_expr}
             GROUP BY ad.name, p.tag_path, ae.priority
             ORDER BY occurrence_count DESC
             LIMIT $1"
        ),
    )
    .bind(top_n)
    .fetch_all(db)
    .await
    .map_err(|e| format!("DB error in Top Bad Actors: {e}"))?;

    let headers = vec![
        "Alarm Name".to_string(),
        "Tag Path".to_string(),
        "Priority".to_string(),
        "Occurrences".to_string(),
    ];

    let data: Vec<Vec<String>> = rows
        .iter()
        .map(|r| {
            vec![
                r.try_get::<String, _>("alarm_name").unwrap_or_default(),
                r.try_get::<Option<String>, _>("tag_path")
                    .unwrap_or_default()
                    .unwrap_or_default(),
                r.try_get::<String, _>("priority").unwrap_or_default(),
                r.try_get::<i64, _>("occurrence_count")
                    .map(|v| v.to_string())
                    .unwrap_or_default(),
            ]
        })
        .collect();

    Ok((headers, data))
}

async fn query_standing_alarms(
    db: &PgPool,
    params: &JsonValue,
) -> Result<(Vec<String>, Vec<Vec<String>>), String> {
    let threshold_hours: i64 = params
        .get("threshold_hours")
        .and_then(|v| v.as_i64())
        .unwrap_or(24);

    let rows = sqlx::query(
        "SELECT
             ad.name AS alarm_name,
             p.tag_path,
             ast.priority,
             ast.current_state,
             ast.last_state_change,
             EXTRACT(EPOCH FROM (NOW() - ast.last_state_change))/3600.0 AS hours_active
         FROM alarm_states ast
         JOIN alarm_definitions ad ON ad.id = ast.alarm_definition_id
         LEFT JOIN points p ON p.id = ad.point_id
         WHERE ast.current_state != 'normal'
           AND ast.last_state_change <= NOW() - ($1 || ' hours')::interval
         ORDER BY hours_active DESC
         LIMIT 500",
    )
    .bind(threshold_hours.to_string())
    .fetch_all(db)
    .await
    .map_err(|e| format!("DB error in Standing Alarms: {e}"))?;

    let headers = vec![
        "Alarm Name".to_string(),
        "Tag Path".to_string(),
        "Priority".to_string(),
        "Current State".to_string(),
        "Last Change".to_string(),
        "Hours Active".to_string(),
    ];

    let data: Vec<Vec<String>> = rows
        .iter()
        .map(|r| {
            vec![
                r.try_get::<String, _>("alarm_name").unwrap_or_default(),
                r.try_get::<Option<String>, _>("tag_path")
                    .unwrap_or_default()
                    .unwrap_or_default(),
                r.try_get::<String, _>("priority").unwrap_or_default(),
                r.try_get::<String, _>("current_state").unwrap_or_default(),
                r.try_get::<chrono::DateTime<Utc>, _>("last_state_change")
                    .map(|t| t.to_rfc3339())
                    .unwrap_or_default(),
                r.try_get::<f64, _>("hours_active")
                    .map(|v| format!("{v:.1}"))
                    .unwrap_or_default(),
            ]
        })
        .collect();

    Ok((headers, data))
}

async fn query_chattering_alarms(
    db: &PgPool,
    params: &JsonValue,
) -> Result<(Vec<String>, Vec<Vec<String>>), String> {
    let time_range = params
        .get("time_range")
        .and_then(|v| v.as_str())
        .unwrap_or("last_24h");

    // Chattering: alarm that transitions > N times in the window
    let chatter_threshold: i64 = params
        .get("chatter_threshold")
        .and_then(|v| v.as_i64())
        .unwrap_or(12); // ISA-18.2 suggests >12 transitions/hour

    let (start_expr, end_expr) = time_range_to_sql(time_range);

    let rows = sqlx::query(
        &format!(
            "SELECT
                 ad.name AS alarm_name,
                 p.tag_path,
                 COUNT(*) AS transition_count
             FROM events ae
             JOIN alarm_definitions ad ON ad.id = ae.alarm_definition_id
             LEFT JOIN points p ON p.id = ad.point_id
             WHERE ae.occurred_at >= {start_expr} AND ae.occurred_at <= {end_expr}
             GROUP BY ad.name, p.tag_path
             HAVING COUNT(*) >= $1
             ORDER BY transition_count DESC
             LIMIT 500"
        ),
    )
    .bind(chatter_threshold)
    .fetch_all(db)
    .await
    .map_err(|e| format!("DB error in Chattering Alarms: {e}"))?;

    let headers = vec![
        "Alarm Name".to_string(),
        "Tag Path".to_string(),
        "Transition Count".to_string(),
    ];

    let data: Vec<Vec<String>> = rows
        .iter()
        .map(|r| {
            vec![
                r.try_get::<String, _>("alarm_name").unwrap_or_default(),
                r.try_get::<Option<String>, _>("tag_path")
                    .unwrap_or_default()
                    .unwrap_or_default(),
                r.try_get::<i64, _>("transition_count")
                    .map(|v| v.to_string())
                    .unwrap_or_default(),
            ]
        })
        .collect();

    Ok((headers, data))
}

async fn query_alarm_flood(
    db: &PgPool,
    params: &JsonValue,
) -> Result<(Vec<String>, Vec<Vec<String>>), String> {
    let time_range = params
        .get("time_range")
        .and_then(|v| v.as_str())
        .unwrap_or("last_24h");

    let (start_expr, end_expr) = time_range_to_sql(time_range);

    // Find 10-minute windows with > 10 alarms (EEMUA 191 flood threshold)
    let rows = sqlx::query(
        &format!(
            "SELECT
                 date_trunc('minute', occurred_at) -
                     (EXTRACT(MINUTE FROM occurred_at)::int % 10) * INTERVAL '1 minute' AS window_start,
                 COUNT(*) AS alarm_count
             FROM events
             WHERE occurred_at >= {start_expr} AND occurred_at <= {end_expr}
             GROUP BY window_start
             HAVING COUNT(*) > 10
             ORDER BY alarm_count DESC, window_start
             LIMIT 200"
        ),
    )
    .fetch_all(db)
    .await
    .map_err(|e| format!("DB error in Alarm Flood Analysis: {e}"))?;

    let headers = vec![
        "10-Minute Window Start".to_string(),
        "Alarm Count".to_string(),
        "Flood Severity".to_string(),
    ];

    let data: Vec<Vec<String>> = rows
        .iter()
        .map(|r| {
            let count: i64 = r.try_get("alarm_count").unwrap_or(0);
            let severity = if count > 100 {
                "SEVERE"
            } else if count > 30 {
                "MAJOR"
            } else {
                "FLOOD"
            };
            vec![
                r.try_get::<chrono::DateTime<Utc>, _>("window_start")
                    .map(|t| t.to_rfc3339())
                    .unwrap_or_default(),
                count.to_string(),
                severity.to_string(),
            ]
        })
        .collect();

    Ok((headers, data))
}

async fn query_alarm_priority_distribution(
    db: &PgPool,
    params: &JsonValue,
) -> Result<(Vec<String>, Vec<Vec<String>>), String> {
    let time_range = params
        .get("time_range")
        .and_then(|v| v.as_str())
        .unwrap_or("last_24h");

    let (start_expr, end_expr) = time_range_to_sql(time_range);

    let rows = sqlx::query(
        &format!(
            "SELECT
                 priority,
                 COUNT(*) AS count,
                 ROUND(100.0 * COUNT(*) / NULLIF(SUM(COUNT(*)) OVER (), 0), 1) AS pct
             FROM events
             WHERE occurred_at >= {start_expr} AND occurred_at <= {end_expr}
             GROUP BY priority
             ORDER BY
                 CASE priority
                     WHEN 'critical'     THEN 1
                     WHEN 'high'         THEN 2
                     WHEN 'medium'       THEN 3
                     WHEN 'low'          THEN 4
                     WHEN 'diagnostic'   THEN 5
                     ELSE 6
                 END"
        ),
    )
    .fetch_all(db)
    .await
    .map_err(|e| format!("DB error in Alarm Priority Distribution: {e}"))?;

    // ISA-18.2 recommended distribution guidance
    let isa_guidance: std::collections::HashMap<&str, &str> = [
        ("critical", "~5%"),
        ("high", "~15%"),
        ("medium", "~30%"),
        ("low", "~50%"),
    ]
    .iter()
    .cloned()
    .collect();

    let headers = vec![
        "Priority".to_string(),
        "Count".to_string(),
        "Actual %".to_string(),
        "ISA-18.2 Target".to_string(),
    ];

    let data: Vec<Vec<String>> = rows
        .iter()
        .map(|r| {
            let priority: String = r.try_get("priority").unwrap_or_default();
            let isa_target = isa_guidance
                .get(priority.as_str())
                .copied()
                .unwrap_or("N/A")
                .to_string();
            vec![
                priority,
                r.try_get::<i64, _>("count")
                    .map(|v| v.to_string())
                    .unwrap_or_default(),
                r.try_get::<f64, _>("pct")
                    .map(|v| format!("{v:.1}%"))
                    .unwrap_or_default(),
                isa_target,
            ]
        })
        .collect();

    Ok((headers, data))
}

async fn query_alarm_health_summary(
    db: &PgPool,
    params: &JsonValue,
) -> Result<(Vec<String>, Vec<Vec<String>>), String> {
    let time_range = params
        .get("time_range")
        .and_then(|v| v.as_str())
        .unwrap_or("last_24h");

    let (start_expr, end_expr) = time_range_to_sql(time_range);

    // Compute aggregate metrics for the EEMUA health summary
    let total_row = sqlx::query(
        &format!(
            "SELECT COUNT(*) AS total_alarms,
                    COUNT(DISTINCT alarm_definition_id) AS distinct_alarms
             FROM events
             WHERE occurred_at >= {start_expr} AND occurred_at <= {end_expr}"
        ),
    )
    .fetch_one(db)
    .await
    .map_err(|e| format!("DB error in Alarm Health Summary (totals): {e}"))?;

    let total_alarms: i64 = total_row.try_get("total_alarms").unwrap_or(0);
    let distinct_alarms: i64 = total_row.try_get("distinct_alarms").unwrap_or(0);

    // Average alarm rate per 10 minutes over the window
    // (hours in window * 6 windows/hour)
    let hours = time_range_hours(time_range);
    let windows = (hours * 6.0).max(1.0);
    let avg_rate = total_alarms as f64 / windows;

    // EEMUA classification
    let eemua_class = if avg_rate > 10.0 {
        "Unacceptable"
    } else if avg_rate > 1.0 {
        "Overloaded"
    } else if avg_rate > 0.5 {
        "Manageable"
    } else {
        "Achievable"
    };

    let headers = vec![
        "Metric".to_string(),
        "Value".to_string(),
    ];

    let data = vec![
        vec!["Total Alarms".to_string(), total_alarms.to_string()],
        vec!["Distinct Alarm Types".to_string(), distinct_alarms.to_string()],
        vec!["Analysis Window".to_string(), format!("{hours:.0} hours")],
        vec!["Avg Rate (per 10 min)".to_string(), format!("{avg_rate:.2}")],
        vec!["EEMUA 191 Classification".to_string(), eemua_class.to_string()],
    ];

    Ok((headers, data))
}

async fn query_round_completion_rate(
    db: &PgPool,
    params: &JsonValue,
) -> Result<(Vec<String>, Vec<Vec<String>>), String> {
    let time_range = params
        .get("time_range")
        .and_then(|v| v.as_str())
        .unwrap_or("last_24h");

    let (start_expr, end_expr) = time_range_to_sql(time_range);

    let rows = sqlx::query(
        &format!(
            "SELECT
                 rt.name AS round_name,
                 COUNT(*) AS total_scheduled,
                 COUNT(*) FILTER (WHERE ri.status = 'completed') AS completed,
                 COUNT(*) FILTER (WHERE ri.status = 'missed' OR (ri.due_at < NOW() AND ri.status = 'pending')) AS missed,
                 ROUND(
                     100.0 * COUNT(*) FILTER (WHERE ri.status = 'completed') /
                     NULLIF(COUNT(*), 0),
                     1
                 ) AS completion_pct
             FROM round_instances ri
             JOIN round_templates rt ON rt.id = ri.template_id
             WHERE ri.scheduled_at >= {start_expr} AND ri.scheduled_at <= {end_expr}
             GROUP BY rt.name
             ORDER BY completion_pct ASC"
        ),
    )
    .fetch_all(db)
    .await
    .map_err(|e| format!("DB error in Round Completion Rate: {e}"))?;

    let headers = vec![
        "Round Name".to_string(),
        "Scheduled".to_string(),
        "Completed".to_string(),
        "Missed".to_string(),
        "Completion %".to_string(),
    ];

    let data: Vec<Vec<String>> = rows
        .iter()
        .map(|r| {
            vec![
                r.try_get::<String, _>("round_name").unwrap_or_default(),
                r.try_get::<i64, _>("total_scheduled")
                    .map(|v| v.to_string())
                    .unwrap_or_default(),
                r.try_get::<i64, _>("completed")
                    .map(|v| v.to_string())
                    .unwrap_or_default(),
                r.try_get::<i64, _>("missed")
                    .map(|v| v.to_string())
                    .unwrap_or_default(),
                r.try_get::<f64, _>("completion_pct")
                    .map(|v| format!("{v:.1}%"))
                    .unwrap_or_default(),
            ]
        })
        .collect();

    Ok((headers, data))
}

async fn query_overdue_rounds(
    db: &PgPool,
    _params: &JsonValue,
) -> Result<(Vec<String>, Vec<Vec<String>>), String> {
    let rows = sqlx::query(
        "SELECT
             rt.name AS round_name,
             ri.scheduled_at,
             ri.due_at,
             EXTRACT(EPOCH FROM (NOW() - ri.due_at))/3600.0 AS hours_overdue,
             COALESCE(u.display_name, 'Unassigned') AS assigned_to
         FROM round_instances ri
         JOIN round_templates rt ON rt.id = ri.template_id
         LEFT JOIN users u ON u.id = ri.assigned_to
         WHERE ri.status = 'pending' AND ri.due_at < NOW()
         ORDER BY ri.due_at ASC
         LIMIT 500",
    )
    .fetch_all(db)
    .await
    .map_err(|e| format!("DB error in Overdue Rounds: {e}"))?;

    let headers = vec![
        "Round Name".to_string(),
        "Scheduled At".to_string(),
        "Due At".to_string(),
        "Hours Overdue".to_string(),
        "Assigned To".to_string(),
    ];

    let data: Vec<Vec<String>> = rows
        .iter()
        .map(|r| {
            vec![
                r.try_get::<String, _>("round_name").unwrap_or_default(),
                r.try_get::<chrono::DateTime<Utc>, _>("scheduled_at")
                    .map(|t| t.to_rfc3339())
                    .unwrap_or_default(),
                r.try_get::<chrono::DateTime<Utc>, _>("due_at")
                    .map(|t| t.to_rfc3339())
                    .unwrap_or_default(),
                r.try_get::<f64, _>("hours_overdue")
                    .map(|v| format!("{v:.1}"))
                    .unwrap_or_default(),
                r.try_get::<String, _>("assigned_to").unwrap_or_default(),
            ]
        })
        .collect();

    Ok((headers, data))
}

async fn query_round_exceptions(
    db: &PgPool,
    params: &JsonValue,
) -> Result<(Vec<String>, Vec<Vec<String>>), String> {
    let time_range = params
        .get("time_range")
        .and_then(|v| v.as_str())
        .unwrap_or("last_24h");

    let (start_expr, end_expr) = time_range_to_sql(time_range);

    let rows = sqlx::query(
        &format!(
            "SELECT
                 rt.name AS round_name,
                 rc.label AS checkpoint_label,
                 ro.value_text AS recorded_value,
                 ro.is_exception,
                 ro.recorded_at,
                 COALESCE(u.display_name, 'Unknown') AS recorded_by
             FROM round_observations ro
             JOIN round_checkpoints rc ON rc.id = ro.checkpoint_id
             JOIN round_instances ri ON ri.id = ro.instance_id
             JOIN round_templates rt ON rt.id = ri.template_id
             LEFT JOIN users u ON u.id = ro.recorded_by
             WHERE ro.is_exception = true
               AND ro.recorded_at >= {start_expr} AND ro.recorded_at <= {end_expr}
             ORDER BY ro.recorded_at DESC
             LIMIT 1000"
        ),
    )
    .fetch_all(db)
    .await
    .map_err(|e| format!("DB error in Exception Report: {e}"))?;

    let headers = vec![
        "Round".to_string(),
        "Checkpoint".to_string(),
        "Value".to_string(),
        "Exception".to_string(),
        "Recorded At".to_string(),
        "Recorded By".to_string(),
    ];

    let data: Vec<Vec<String>> = rows
        .iter()
        .map(|r| {
            vec![
                r.try_get::<String, _>("round_name").unwrap_or_default(),
                r.try_get::<String, _>("checkpoint_label").unwrap_or_default(),
                r.try_get::<Option<String>, _>("recorded_value")
                    .unwrap_or_default()
                    .unwrap_or_default(),
                r.try_get::<bool, _>("is_exception")
                    .map(|v| if v { "Yes" } else { "No" }.to_string())
                    .unwrap_or_default(),
                r.try_get::<chrono::DateTime<Utc>, _>("recorded_at")
                    .map(|t| t.to_rfc3339())
                    .unwrap_or_default(),
                r.try_get::<String, _>("recorded_by").unwrap_or_default(),
            ]
        })
        .collect();

    Ok((headers, data))
}

/// Placeholder report for templates not yet data-connected.
fn placeholder_report(
    template_name: &str,
    params: &JsonValue,
) -> (Vec<String>, Vec<Vec<String>>) {
    let headers = vec!["Field".to_string(), "Value".to_string()];
    let mut rows = vec![
        vec![
            "Report".to_string(),
            template_name.to_string(),
        ],
        vec![
            "Generated At".to_string(),
            Utc::now().to_rfc3339(),
        ],
        vec![
            "Status".to_string(),
            "Data query not yet implemented for this template".to_string(),
        ],
    ];

    // Append each parameter as its own row
    if let Some(obj) = params.as_object() {
        for (k, v) in obj {
            rows.push(vec![
                format!("Param: {k}"),
                v.as_str().unwrap_or(&v.to_string()).to_string(),
            ]);
        }
    }

    (headers, rows)
}

// ---------------------------------------------------------------------------
// Format renderers
// ---------------------------------------------------------------------------

/// Generate CSV bytes from headers and rows.
pub fn generate_csv(headers: &[String], rows: &[Vec<String>]) -> Vec<u8> {
    let mut wtr = csv::WriterBuilder::new()
        .has_headers(true)
        .from_writer(vec![]);

    // Write header row
    if let Err(e) = wtr.write_record(headers) {
        tracing::warn!(error = %e, "CSV header write failed");
    }

    // Write data rows
    for row in rows {
        if let Err(e) = wtr.write_record(row) {
            tracing::warn!(error = %e, "CSV row write failed");
        }
    }

    wtr.into_inner().unwrap_or_default()
}

/// Generate XLSX bytes from headers and rows using rust_xlsxwriter.
pub fn generate_xlsx(
    title: &str,
    headers: &[String],
    rows: &[Vec<String>],
) -> Result<Vec<u8>, String> {
    use rust_xlsxwriter::{Format, Workbook};

    let mut workbook = Workbook::new();
    let worksheet = workbook
        .add_worksheet()
        .set_name(title.chars().take(31).collect::<String>().as_str())
        .map_err(|e| format!("XLSX worksheet name failed: {e}"))?;

    // Bold format for headers
    let header_format = Format::new().set_bold();

    // Write headers
    for (col, header) in headers.iter().enumerate() {
        worksheet
            .write_string_with_format(0, col as u16, header, &header_format)
            .map_err(|e| format!("XLSX header write failed: {e}"))?;
    }

    // Write data rows
    for (row_idx, row) in rows.iter().enumerate() {
        for (col_idx, cell) in row.iter().enumerate() {
            worksheet
                .write_string((row_idx + 1) as u32, col_idx as u16, cell)
                .map_err(|e| format!("XLSX cell write failed: {e}"))?;
        }
    }

    workbook
        .save_to_buffer()
        .map_err(|e| format!("XLSX save failed: {e}"))
}

/// Generate a JSON bytes — array of objects (header keys, row values).
pub fn generate_json(headers: &[String], rows: &[Vec<String>]) -> Vec<u8> {
    let objects: Vec<serde_json::Value> = rows
        .iter()
        .map(|row| {
            let mut obj = serde_json::Map::new();
            for (i, header) in headers.iter().enumerate() {
                obj.insert(
                    header.clone(),
                    serde_json::Value::String(
                        row.get(i).cloned().unwrap_or_default(),
                    ),
                );
            }
            serde_json::Value::Object(obj)
        })
        .collect();

    serde_json::to_vec_pretty(&objects).unwrap_or_default()
}

/// Generate a print-friendly HTML report.
pub fn generate_html_report(
    title: &str,
    description: &str,
    headers: &[String],
    rows: &[Vec<String>],
    params: &JsonValue,
) -> String {
    let generated_at = Utc::now().to_rfc3339();
    let row_count = rows.len();

    // Build parameter summary
    let params_html = if let Some(obj) = params.as_object() {
        let param_rows: String = obj
            .iter()
            .map(|(k, v)| {
                let val = v.as_str().unwrap_or(&v.to_string()).to_string();
                format!("<tr><td class=\"param-key\">{}</td><td>{}</td></tr>", escape_html(k), escape_html(&val))
            })
            .collect();
        format!(
            r#"<section class="params">
              <h2>Parameters</h2>
              <table class="param-table">
                <tbody>{param_rows}</tbody>
              </table>
            </section>"#
        )
    } else {
        String::new()
    };

    // Build data table headers
    let th_cells: String = headers
        .iter()
        .map(|h| format!("<th>{}</th>", escape_html(h)))
        .collect();

    // Build data table rows
    let tr_rows: String = if rows.is_empty() {
        let colspan = headers.len();
        format!(
            r#"<tr><td colspan="{colspan}" class="empty-row">No data for selected parameters.</td></tr>"#
        )
    } else {
        rows.iter()
            .map(|row| {
                let tds: String = row
                    .iter()
                    .map(|cell| format!("<td>{}</td>", escape_html(cell)))
                    .collect();
                format!("<tr>{tds}</tr>")
            })
            .collect()
    };

    format!(
        r#"<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>{title}</title>
  <style>
    *, *::before, *::after {{ box-sizing: border-box; }}
    body {{
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 13px;
      color: #1a1a2e;
      background: #fff;
      margin: 0;
      padding: 24px 32px;
    }}
    .report-header {{
      border-bottom: 2px solid #1a1a2e;
      margin-bottom: 20px;
      padding-bottom: 12px;
    }}
    .report-header h1 {{
      font-size: 20px;
      font-weight: 700;
      margin: 0 0 4px;
    }}
    .report-header .description {{
      color: #555;
      margin: 0 0 8px;
    }}
    .report-meta {{
      display: flex;
      gap: 24px;
      font-size: 12px;
      color: #666;
    }}
    .params {{
      margin-bottom: 20px;
    }}
    .params h2 {{
      font-size: 14px;
      font-weight: 600;
      margin: 0 0 6px;
    }}
    .param-table {{
      border-collapse: collapse;
      font-size: 12px;
    }}
    .param-table td {{
      padding: 3px 12px 3px 0;
    }}
    .param-key {{
      font-weight: 600;
      color: #444;
    }}
    table.data-table {{
      width: 100%;
      border-collapse: collapse;
      margin-top: 4px;
    }}
    table.data-table th {{
      background: #1a1a2e;
      color: #fff;
      font-weight: 600;
      padding: 8px 10px;
      text-align: left;
      white-space: nowrap;
    }}
    table.data-table td {{
      padding: 6px 10px;
      border-bottom: 1px solid #e5e7eb;
      vertical-align: top;
    }}
    table.data-table tr:nth-child(even) td {{
      background: #f9fafb;
    }}
    .empty-row {{
      color: #888;
      text-align: center;
      padding: 24px;
    }}
    .row-count {{
      font-size: 12px;
      color: #666;
      margin-top: 8px;
    }}
    @media print {{
      body {{ padding: 12px; }}
      table.data-table {{ font-size: 11px; }}
    }}
  </style>
</head>
<body>
  <header class="report-header">
    <h1>{title}</h1>
    {description_html}
    <div class="report-meta">
      <span>Generated: {generated_at}</span>
      <span>Rows: {row_count}</span>
    </div>
  </header>

  {params_html}

  <section class="data">
    <table class="data-table">
      <thead><tr>{th_cells}</tr></thead>
      <tbody>{tr_rows}</tbody>
    </table>
    <p class="row-count">{row_count} row(s)</p>
  </section>
</body>
</html>"#,
        title = escape_html(title),
        description_html = if description.is_empty() {
            String::new()
        } else {
            format!("<p class=\"description\">{}</p>", escape_html(description))
        },
        generated_at = generated_at,
        row_count = row_count,
        params_html = params_html,
        th_cells = th_cells,
        tr_rows = tr_rows,
    )
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/// Convert a time_range string into SQL NOW()-based expressions.
fn time_range_to_sql(time_range: &str) -> (String, String) {
    match time_range {
        "last_1h" => (
            "NOW() - INTERVAL '1 hour'".to_string(),
            "NOW()".to_string(),
        ),
        "last_8h" => (
            "NOW() - INTERVAL '8 hours'".to_string(),
            "NOW()".to_string(),
        ),
        "last_24h" => (
            "NOW() - INTERVAL '24 hours'".to_string(),
            "NOW()".to_string(),
        ),
        "last_7d" => (
            "NOW() - INTERVAL '7 days'".to_string(),
            "NOW()".to_string(),
        ),
        "last_30d" => (
            "NOW() - INTERVAL '30 days'".to_string(),
            "NOW()".to_string(),
        ),
        "this_month" => (
            "date_trunc('month', NOW())".to_string(),
            "NOW()".to_string(),
        ),
        "last_month" => (
            "date_trunc('month', NOW() - INTERVAL '1 month')".to_string(),
            "date_trunc('month', NOW())".to_string(),
        ),
        _ => (
            // Default: last 24 hours
            "NOW() - INTERVAL '24 hours'".to_string(),
            "NOW()".to_string(),
        ),
    }
}

/// Convert time_range string to approximate number of hours (for rate calculations).
fn time_range_hours(time_range: &str) -> f64 {
    match time_range {
        "last_1h" => 1.0,
        "last_8h" => 8.0,
        "last_24h" => 24.0,
        "last_7d" => 168.0,
        "last_30d" => 720.0,
        "this_month" | "last_month" => 720.0,
        _ => 24.0,
    }
}

/// Generate a PDF report.
///
/// Attempts Typst-based PDF compilation via the `typst-as-lib` feature.
/// When that feature is not enabled (or compilation fails), falls back to
/// a print-optimised HTML document wrapped in a minimal PDF shell that
/// browsers can render via `Content-Type: application/pdf`.  In practice
/// this fallback produces an HTML file with a `.pdf` extension; most modern
/// browsers open it directly.
///
/// A structured log message is emitted so operators know which path was taken.
pub fn generate_pdf_report(
    title: &str,
    description: &str,
    headers: &[String],
    rows: &[Vec<String>],
    params: &JsonValue,
) -> Vec<u8> {
    // --- Typst path (feature-gated) ------------------------------------------
    #[cfg(feature = "typst-pdf")]
    {
        match compile_typst_pdf(title, headers, rows) {
            Ok(bytes) => {
                tracing::info!(report = %title, "PDF generated via Typst");
                return bytes;
            }
            Err(e) => {
                tracing::warn!(
                    report = %title,
                    error = %e,
                    "Typst PDF compilation failed, falling back to HTML-in-PDF"
                );
            }
        }
    }

    // --- HTML fallback -------------------------------------------------------
    tracing::info!(
        report = %title,
        "PDF generation using HTML fallback (typst-pdf feature not enabled)"
    );
    generate_html_report(title, description, headers, rows, params).into_bytes()
}

/// Build a Typst source document for the given report data.
#[allow(dead_code)]
pub fn build_typst_template(title: &str, headers: &[String], rows: &[Vec<String>]) -> String {
    let generated_at = Utc::now().to_rfc3339();
    let table_content = rows_to_typst_table(headers, rows);

    format!(
        r#"
#set page(margin: 1.5cm, header: [
  #text(size: 8pt, fill: gray)[{title} | Generated: {generated_at}]
  #line(length: 100%)
])

#set text(font: "Libertinus Serif", size: 11pt)

= {title}

{table_content}
"#,
        title = title,
        generated_at = generated_at,
        table_content = table_content,
    )
}

/// Render a Typst `#table(…)` block from headers and row data.
#[allow(dead_code)]
pub fn rows_to_typst_table(headers: &[String], rows: &[Vec<String>]) -> String {
    if headers.is_empty() {
        return String::new();
    }

    let col_count = headers.len();

    // Header cells using table.header
    let header_cells: String = headers
        .iter()
        .map(|h| format!("table.header([*{}*])", escape_typst(h)))
        .collect::<Vec<_>>()
        .join(", ");

    // Data row cells
    let data_rows: String = rows
        .iter()
        .map(|row| {
            row.iter()
                .map(|cell| format!("[{}]", escape_typst(cell)))
                .collect::<Vec<_>>()
                .join(", ")
        })
        .collect::<Vec<_>>()
        .join(",\n  ");

    format!(
        "#table(\n  columns: {col_count},\n  {header_cells},\n  {data_rows}\n)"
    )
}

/// Escape Typst special characters in cell content.
#[allow(dead_code)]
fn escape_typst(s: &str) -> String {
    s.replace('\\', "\\\\")
        .replace('[', "\\[")
        .replace(']', "\\]")
        .replace('#', "\\#")
        .replace('@', "\\@")
        .replace('*', "\\*")
        .replace('_', "\\_")
}

/// Compile Typst source to PDF bytes.
/// Only compiled when the `typst-pdf` Cargo feature is enabled.
#[cfg(feature = "typst-pdf")]
fn compile_typst_pdf(
    title: &str,
    headers: &[String],
    rows: &[Vec<String>],
) -> Result<Vec<u8>, String> {
    use typst_as_lib::TypstEngine;

    let source = build_typst_template(title, headers, rows);

    let engine = TypstEngine::builder()
        .main_file(source)
        .build();

    engine
        .compile_pdf()
        .map_err(|e| format!("Typst compile error: {e:?}"))
}

/// Minimal HTML escaping for report content.
fn escape_html(s: &str) -> String {
    s.replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
        .replace('\'', "&#x27;")
}
