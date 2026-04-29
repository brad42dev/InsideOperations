use crate::{config::Config, db};
use anyhow::{Context, Result};
use chrono::{DateTime, Utc};
use io_db::DbPool;
use jsonwebtoken::{encode, EncodingKey, Header};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sqlx::Row;
use std::process::Stdio;
use std::time::Instant;
use tokio::io::{AsyncBufReadExt, BufReader};
use uuid::Uuid;

// ─── Tuning constants ────────────────────────────────────────────────────────
// All parallelism runs as tabs within ONE Chromium instance, so the memory
// model is: ~700MB base browser + ~400MB per additional page.
// MIN_AVAILABLE_MB is the floor below which we stay serial.
const HARD_CAP_PAGES: usize = 4;
const MIN_AVAILABLE_MB: u64 = 2_500;
const MEM_PER_EXTRA_PAGE_MB: u64 = 500;
const MIN_FRAMES_PER_PAGE: usize = 100;
const LOAD_THRESHOLD: f64 = 0.70;
// Passed to the worker; it staggers page navigations by this many ms per page
// index so all tabs don't slam the server simultaneously on first load.
const PAGE_STAGGER_MS: u64 = 4_000;

// ─── Job row ─────────────────────────────────────────────────────────────────
struct JobRow {
    module: String,
    graphic_id: Uuid,
    range_start: DateTime<Utc>,
    range_end: DateTime<Utc>,
    step_ms: i32,
    fps: f64,
    width_px: i32,
    height_px: i32,
    device_pixel_ratio: f64,
    overlay_timestamp: bool,
    crf: i16,
    created_by: Uuid,
}

#[derive(Serialize, Deserialize)]
struct ExportClaims {
    sub: String,
    username: String,
    exp: i64,
    iat: i64,
    permissions: Vec<String>,
}

// ─── System introspection ─────────────────────────────────────────────────────
fn read_mem_available_mb() -> Option<u64> {
    let content = std::fs::read_to_string("/proc/meminfo").ok()?;
    for line in content.lines() {
        if line.starts_with("MemAvailable:") {
            let kb: u64 = line.split_whitespace().nth(1)?.parse().ok()?;
            return Some(kb / 1024);
        }
    }
    None
}

fn read_loadavg_1min() -> Option<f64> {
    std::fs::read_to_string("/proc/loadavg")
        .ok()?
        .split_whitespace()
        .next()?
        .parse()
        .ok()
}

fn count_cpus() -> usize {
    let content = std::fs::read_to_string("/proc/cpuinfo").unwrap_or_default();
    content
        .lines()
        .filter(|l| l.starts_with("processor"))
        .count()
        .max(1)
}

fn decide_page_count(frame_count: usize) -> usize {
    let available_mb = read_mem_available_mb().unwrap_or(0);
    let load_1min = read_loadavg_1min().unwrap_or(0.0);
    let cpus = count_cpus();
    let normalized_load = load_1min / cpus as f64;

    if available_mb < MIN_AVAILABLE_MB {
        tracing::info!(
            available_mb,
            normalized_load,
            reason = "insufficient memory for parallel pages",
            "video export: serial (1 page)"
        );
        return 1;
    }

    // How many extra pages can we afford beyond the base browser footprint?
    let extra = ((available_mb - MIN_AVAILABLE_MB) / MEM_PER_EXTRA_PAGE_MB) as usize;
    let max_by_memory = (1 + extra).min(HARD_CAP_PAGES);
    let max_by_frames = frame_count.div_ceil(MIN_FRAMES_PER_PAGE);

    let mut count = max_by_memory.min(max_by_frames).max(1);
    if normalized_load > LOAD_THRESHOLD {
        count = count.saturating_sub(1).max(1);
    }

    tracing::info!(
        available_mb,
        normalized_load,
        cpus,
        max_by_memory,
        max_by_frames,
        count,
        "video export: page count decision"
    );

    count
}

// ─── DB / auth helpers ────────────────────────────────────────────────────────
async fn load_job(pool: &DbPool, job_id: Uuid) -> Result<JobRow> {
    let row = sqlx::query(
        "SELECT module, graphic_id, range_start, range_end, step_ms, fps,
                width_px, height_px, device_pixel_ratio::FLOAT8, overlay_timestamp,
                crf, created_by
         FROM video_export_jobs WHERE id = $1",
    )
    .bind(job_id)
    .fetch_optional(pool)
    .await?
    .with_context(|| format!("job {job_id} not found"))?;

    Ok(JobRow {
        module: row.try_get("module")?,
        graphic_id: row.try_get("graphic_id")?,
        range_start: row.try_get("range_start")?,
        range_end: row.try_get("range_end")?,
        step_ms: row.try_get("step_ms")?,
        fps: row.try_get("fps")?,
        width_px: row.try_get("width_px")?,
        height_px: row.try_get("height_px")?,
        device_pixel_ratio: row.try_get("device_pixel_ratio")?,
        overlay_timestamp: row.try_get("overlay_timestamp")?,
        crf: row.try_get("crf")?,
        created_by: row.try_get("created_by")?,
    })
}

async fn fetch_username(pool: &DbPool, user_id: Uuid) -> Result<String> {
    let row = sqlx::query("SELECT username FROM users WHERE id = $1")
        .bind(user_id)
        .fetch_optional(pool)
        .await?
        .with_context(|| format!("user {user_id} not found"))?;
    Ok(row.try_get("username")?)
}

async fn fetch_user_permissions(pool: &DbPool, user_id: Uuid) -> Result<Vec<String>> {
    let rows = sqlx::query(
        "SELECT DISTINCT p.name
         FROM permissions p
         JOIN role_permissions rp ON rp.permission_id = p.id
         JOIN user_roles ur ON ur.role_id = rp.role_id
         WHERE ur.user_id = $1
         ORDER BY p.name",
    )
    .bind(user_id)
    .fetch_all(pool)
    .await?;

    Ok(rows
        .into_iter()
        .map(|r| r.get::<String, _>("name"))
        .collect())
}

// ─── Main entry point ─────────────────────────────────────────────────────────
pub async fn render_job(pool: &DbPool, cfg: &Config, job_id: Uuid) -> Result<()> {
    let job = load_job(pool, job_id).await?;
    let user_id = job.created_by;

    let (all_permissions, username) = tokio::try_join!(
        fetch_user_permissions(pool, user_id),
        fetch_username(pool, user_id),
    )?;

    let start_ms = job.range_start.timestamp_millis();
    let end_ms = job.range_end.timestamp_millis();
    let mut frames: Vec<Value> = Vec::new();
    let mut t = start_ms;
    let mut idx = 0i32;
    while t <= end_ms {
        frames.push(json!({ "timestamp": t, "frame_index": idx }));
        t += job.step_ms as i64;
        idx += 1;
    }
    let frame_count = frames.len();

    db::set_processing_with_frames(pool, job_id, frame_count as i32).await?;

    let now = Utc::now().timestamp();
    let read_only_perms: Vec<String> = all_permissions
        .into_iter()
        .filter(|p| {
            !p.contains("write")
                && !p.contains("delete")
                && !p.contains("admin")
                && !p.contains("configure")
                && !p.contains("export")
        })
        .collect();
    let claims = ExportClaims {
        sub: user_id.to_string(),
        username,
        exp: now + 1800,
        iat: now,
        permissions: read_only_perms,
    };
    let ticket = encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(cfg.jwt_secret.as_bytes()),
    )?;

    let overlay = if job.overlay_timestamp { 1 } else { 0 };
    let url_template = format!(
        "{}/export-render?module={}&graphicId={}&width={}&height={}&dpr={}&overlay={}&theme=dark&timestamp={{timestamp}}",
        cfg.frontend_base_url,
        job.module,
        job.graphic_id,
        job.width_px,
        job.height_px,
        job.device_pixel_ratio,
        overlay,
    );

    let videos_dir = format!("{}/videos", cfg.export_dir);
    let tmp_dir = format!("{}/videos/.tmp", cfg.export_dir);
    tokio::fs::create_dir_all(&tmp_dir).await?;
    let output_path = format!("{}/{}.webm", videos_dir, job_id);

    let graphic_id_str = job.graphic_id.to_string();
    let dt_str = job.range_start.format("%Y-%m-%d_%H%M").to_string();
    let original_filename = format!("{}_{}_{}.webm", job.module, &graphic_id_str[..8], dt_str);

    let worker = std::env::var("CAPTURE_WORKER_PATH")
        .unwrap_or_else(|_| "services/video-export-service/capture-worker/index.mjs".to_string());

    let page_count = if std::env::var("VIDEO_EXPORT_FAKE_WORKER").is_ok() {
        1
    } else {
        decide_page_count(frame_count)
    };

    let started = Instant::now();

    let result = if page_count <= 1 {
        run_export(
            pool,
            job_id,
            &worker,
            &tmp_dir,
            &frames,
            &url_template,
            &ticket,
            &job,
            &output_path,
            &original_filename,
            1,
            false,
        )
        .await
    } else {
        let r = run_export(
            pool,
            job_id,
            &worker,
            &tmp_dir,
            &frames,
            &url_template,
            &ticket,
            &job,
            &output_path,
            &original_filename,
            page_count,
            true,
        )
        .await;
        // If parallel pages failed, fall back to a single-page serial run
        if let Err(ref parallel_err) = r {
            tracing::warn!(
                %job_id,
                error = %parallel_err,
                "parallel-page render failed; attempting serial fallback"
            );
            run_export(
                pool,
                job_id,
                &worker,
                &tmp_dir,
                &frames,
                &url_template,
                &ticket,
                &job,
                &output_path,
                &original_filename,
                1,
                false,
            )
            .await
        } else {
            r
        }
    };

    let duration_secs = started.elapsed().as_secs_f64();
    match &result {
        Ok(()) => {
            metrics::counter!("video_export_jobs_total", "status" => "completed").increment(1);
            metrics::histogram!("video_export_render_duration_seconds").record(duration_secs);
            metrics::histogram!("video_export_frames_total").record(frame_count as f64);
        }
        Err(_) => {
            metrics::counter!("video_export_jobs_total", "status" => "failed").increment(1);
        }
    }

    result
}

// ─── Shared render path ───────────────────────────────────────────────────────
// Handles both serial (page_count=1) and multi-page (page_count>1) modes.
// The worker itself manages tab parallelism; from Rust's perspective it's always
// one Node.js process. `with_retries` enables the 3-attempt retry policy.
#[allow(clippy::too_many_arguments)]
async fn run_export(
    pool: &DbPool,
    job_id: Uuid,
    worker: &str,
    tmp_dir: &str,
    frames: &[Value],
    url_template: &str,
    ticket: &str,
    job: &JobRow,
    output_path: &str,
    original_filename: &str,
    page_count: usize,
    with_retries: bool,
) -> Result<()> {
    let params_path = format!("{}/{}.json", tmp_dir, job_id);
    let params = build_params_json(frames, url_template, ticket, job, output_path, page_count);
    tokio::fs::write(&params_path, serde_json::to_string(&params)?).await?;

    let result = if with_retries {
        run_capture_with_retries(pool, job_id, worker, &params_path, output_path).await
    } else {
        run_capture_worker(pool, job_id, worker, &params_path, output_path).await
    };

    let _ = tokio::fs::remove_file(&params_path).await;

    match result {
        Ok((file_size, duration_secs)) => {
            db::set_completed(
                pool,
                job_id,
                output_path,
                original_filename,
                file_size,
                duration_secs,
            )
            .await?;
            db::notify_complete(pool, job_id, "completed").await?;
            Ok(())
        }
        Err(e) => {
            fail_job(pool, job_id, &e).await;
            Err(anyhow::anyhow!("{}", e))
        }
    }
}

// 3 attempts: no delay, 5s, 15s. Removes partial output before each retry.
async fn run_capture_with_retries(
    pool: &DbPool,
    job_id: Uuid,
    worker_path: &str,
    params_path: &str,
    output_path: &str,
) -> Result<(i64, f64), String> {
    const BACKOFF: [u64; 3] = [0, 5, 15];
    let mut last_error = String::new();

    for (attempt, &backoff_secs) in BACKOFF.iter().enumerate() {
        if attempt > 0 {
            tokio::time::sleep(tokio::time::Duration::from_secs(backoff_secs)).await;
            let _ = tokio::fs::remove_file(output_path).await;
        }
        match run_capture_worker(pool, job_id, worker_path, params_path, output_path).await {
            Ok(r) => return Ok(r),
            Err(e) => {
                tracing::warn!(%job_id, attempt = attempt + 1, error = %e, "capture attempt failed");
                last_error = e;
            }
        }
    }

    Err(last_error)
}

// ─── Capture worker ───────────────────────────────────────────────────────────
async fn run_capture_worker(
    pool: &DbPool,
    job_id: Uuid,
    worker_path: &str,
    params_path: &str,
    output_path: &str,
) -> Result<(i64, f64), String> {
    if std::env::var("VIDEO_EXPORT_FAKE_WORKER").is_ok() {
        tokio::fs::write(
            output_path,
            &[0x1a, 0x45, 0xdf, 0xa3, 0x01, 0x00, 0x00, 0x00],
        )
        .await
        .map_err(|e| e.to_string())?;
        return Ok((8, 1.0));
    }

    let mut child = tokio::process::Command::new("node")
        .arg(worker_path)
        .arg(params_path)
        .stdout(Stdio::piped())
        .stderr(Stdio::inherit())
        .kill_on_drop(true)
        .spawn()
        .map_err(|e| format!("failed to spawn capture worker: {worker_path}: {e}"))?;

    let stdout = child.stdout.take().expect("stdout is piped");
    let mut lines = BufReader::new(stdout).lines();
    let mut file_size = 0i64;
    let mut duration_secs = 0.0f64;
    let mut last_progress = Instant::now();

    loop {
        match lines.next_line().await {
            Ok(Some(line)) => {
                let msg: Value = serde_json::from_str(&line).unwrap_or(json!({"type":"unknown"}));
                match msg.get("type").and_then(|t| t.as_str()) {
                    Some("progress") => {
                        if last_progress.elapsed().as_secs() >= 1 {
                            if let Some(frame) = msg.get("frame").and_then(|f| f.as_i64()) {
                                db::update_frames_rendered(pool, job_id, frame as i32)
                                    .await
                                    .ok();
                            }
                            last_progress = Instant::now();
                        }
                    }
                    Some("done") => {
                        file_size = msg.get("file_size").and_then(|v| v.as_i64()).unwrap_or(0);
                        duration_secs = msg
                            .get("duration_seconds")
                            .and_then(|v| v.as_f64())
                            .unwrap_or(0.0);
                    }
                    Some("error") => {
                        let err = msg
                            .get("message")
                            .and_then(|m| m.as_str())
                            .unwrap_or("capture worker error")
                            .to_string();
                        let _ = child.kill().await;
                        return Err(err);
                    }
                    _ => {}
                }
            }
            Ok(None) => break,
            Err(e) => return Err(format!("failed to read capture worker output: {e}")),
        }
    }

    let exit = child
        .wait()
        .await
        .map_err(|e| format!("wait failed: {e}"))?;
    if !exit.success() {
        return Err(format!("capture worker exited with code {:?}", exit.code()));
    }

    Ok((file_size, duration_secs))
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
fn build_params_json(
    frames: &[Value],
    url_template: &str,
    ticket: &str,
    job: &JobRow,
    output_path: &str,
    page_count: usize,
) -> Value {
    json!({
        "frames": frames,
        "url_template": url_template,
        "width": job.width_px,
        "height": job.height_px,
        "dpr": job.device_pixel_ratio,
        "ticket": ticket,
        "fps": job.fps,
        "crf": job.crf,
        "output_path": output_path,
        "parallel_pages": page_count,
        "page_stagger_ms": PAGE_STAGGER_MS,
    })
}

async fn fail_job(pool: &DbPool, job_id: Uuid, msg: &str) {
    db::set_failed(pool, job_id, msg).await.ok();
    db::notify_complete(pool, job_id, "failed").await.ok();
}
