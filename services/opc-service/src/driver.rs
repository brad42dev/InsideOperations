//! Per-source OPC UA driver loop.
//!
//! Each enabled OPC UA source gets its own `run_source` task. The task
//! connects, crawls the namespace, subscribes to all variable nodes, and
//! forwards batched value updates to both the database and the Data Broker.

use std::collections::{HashMap, HashSet};
use std::sync::Arc;
use std::time::Duration;

use chrono::Utc;
use io_bus::{PointQuality, SourceStatusChange, UdsPointBatch, UdsPointUpdate, UdsSourceStatus};
use io_db::DbPool;
use opcua::client::{
    ClientBuilder, DataChangeCallback, EventCallback, HistoryReadAction, IdentityToken,
    MonitoredItem, Session,
};
use opcua::crypto::SecurityPolicy;
use opcua::types::{
    AttributeId, BrowseDescription, BrowseDirection, DataChangeFilter, DataChangeTrigger,
    DataValue, DeadbandType, EndpointDescription, ExtensionObject, HistoryData, HistoryEvent,
    HistoryReadValueId, MessageSecurityMode, MonitoredItemCreateRequest, MonitoringMode,
    MonitoringParameters, NodeClass, NodeId, NumericRange, QualifiedName, ReadEventDetails,
    ReadRawModifiedDetails, ReadValueId, ReferenceTypeId, StatusCode, TimestampsToReturn, UAString,
    Variant,
};
use tokio::sync::mpsc;
use tokio::time::Instant;
use tracing::{debug, error, info, warn};
use uuid::Uuid;

use crate::config::Config;
use crate::db::{self, AnalogMetadata, PointSource, PointUpdate};
use crate::ipc::UdsSender;
use crate::state::SessionRegistry;

// ---------------------------------------------------------------------------
// Exception-Based Recording (EBR) filter
// ---------------------------------------------------------------------------
// Lossless historian-style deduplication. Writes the first and last value
// of any stable (unchanged) run to the database. The frontend uses step
// interpolation to display the flat line between them.

struct EbrPointState {
    last_written_value: f64,
    last_written_quality: String,
    last_written_ts: chrono::DateTime<chrono::Utc>,
    /// Most recent unchanged value, buffered for flush when value changes or heartbeat fires.
    pending: Option<EbrPending>,
}

struct EbrPending {
    value: f64,
    quality: String,
    timestamp: chrono::DateTime<chrono::Utc>,
}

struct EbrFilter {
    state: std::collections::HashMap<uuid::Uuid, EbrPointState>,
    heartbeat_secs: u64,
}

impl EbrFilter {
    fn new(heartbeat_secs: u64) -> Self {
        Self {
            state: std::collections::HashMap::new(),
            heartbeat_secs,
        }
    }

    /// Process one incoming update. Returns 0, 1, or 2 PointUpdates to write to history.
    /// The caller writes ALL updates (unfiltered) to points_current and UDS.
    fn process(&mut self, update: &PointUpdate) -> Vec<PointUpdate> {
        let mut out = Vec::new();

        // Treat NaN as 0.0 for comparison purposes (extract_value already does this,
        // but guard defensively).
        let val = if update.value.is_nan() {
            0.0
        } else {
            update.value
        };

        match self.state.get_mut(&update.point_id) {
            None => {
                // First time seeing this point — always write.
                self.state.insert(
                    update.point_id,
                    EbrPointState {
                        last_written_value: val,
                        last_written_quality: update.quality.clone(),
                        last_written_ts: update.timestamp,
                        pending: None,
                    },
                );
                out.push(update.clone());
            }
            Some(state) => {
                let value_changed = (state.last_written_value - val).abs() > f64::EPSILON
                    || state.last_written_quality != update.quality;

                if value_changed {
                    // Flush pending-last (end of stable period) if its timestamp
                    // differs from what we already wrote — this closes the stable run.
                    if let Some(p) = state.pending.take() {
                        if p.timestamp != state.last_written_ts {
                            out.push(PointUpdate {
                                point_id: update.point_id,
                                value: p.value,
                                quality: p.quality,
                                timestamp: p.timestamp,
                            });
                        }
                    }
                    // Write the new (changed) value.
                    out.push(update.clone());
                    state.last_written_value = val;
                    state.last_written_quality = update.quality.clone();
                    state.last_written_ts = update.timestamp;
                } else {
                    // Value unchanged — buffer as pending (overwrites previous pending).
                    state.pending = Some(EbrPending {
                        value: val,
                        quality: update.quality.clone(),
                        timestamp: update.timestamp,
                    });
                }
            }
        }

        out
    }

    /// Heartbeat: flush pending values whose last-written time is older than
    /// heartbeat_secs. Call on every flush tick to guarantee regularity in the DB
    /// even for signals that hold steady for long periods.
    ///
    /// Uses wall-clock `now` as the written timestamp (not the OPC source timestamp).
    /// OPC servers only advance source_timestamp when the value changes, so for stable
    /// signals the source timestamp never moves — using it would cause every heartbeat
    /// write to produce the same (point_id, timestamp) pair and be silently discarded
    /// by the ON CONFLICT DO NOTHING constraint in write_history_batch.
    fn heartbeat_flush(&mut self, now: chrono::DateTime<chrono::Utc>) -> Vec<PointUpdate> {
        if self.heartbeat_secs == 0 {
            return Vec::new();
        }
        let cutoff = now - chrono::Duration::seconds(self.heartbeat_secs as i64);
        let mut out = Vec::new();

        for (&point_id, state) in self.state.iter_mut() {
            if let Some(ref p) = state.pending {
                if state.last_written_ts <= cutoff {
                    // Use wall-clock now as the timestamp so each heartbeat write lands
                    // at a unique, advancing timestamp regardless of whether the OPC server
                    // is repeating the same source_timestamp for an unchanged value.
                    out.push(PointUpdate {
                        point_id,
                        value: p.value,
                        quality: p.quality.clone(),
                        timestamp: now,
                    });
                    state.last_written_value = p.value;
                    state.last_written_quality = p.quality.clone();
                    state.last_written_ts = now;
                    state.pending = None;
                }
            }
        }

        out
    }
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

/// Run the OPC UA driver for a single source forever (reconnecting on failure).
///
/// `reconnect_notify` — when signalled (via the internal reconnect HTTP endpoint)
/// the driver wakes immediately from its backoff sleep and retries the connection.
pub async fn run_source(
    source: PointSource,
    db: DbPool,
    uds: Arc<UdsSender>,
    config: Arc<Config>,
    reconnect_notify: Arc<tokio::sync::Notify>,
    sessions: SessionRegistry,
) {
    let mut attempt: u32 = 0;
    let mut backoff_secs: u64 = 5;
    let mut last_error: Option<String> = None;

    loop {
        attempt += 1;

        // Count every attempt beyond the first as a reconnection.
        if attempt > 1 {
            metrics::counter!("io_opc_reconnections_total").increment(1);
        }

        // After 10 failed attempts in a row, slow down and stay in "error".
        if attempt > 10 {
            let msg = last_error
                .as_deref()
                .unwrap_or("Too many reconnect failures");
            error!(
                source = %source.name,
                "Persistent OPC UA connection failure after 10 attempts; marking error"
            );
            if let Err(e) = db::set_source_status(&db, source.id, "error", Some(msg)).await {
                warn!(source = %source.name, error = %e, "Failed to set source status to error");
            }
            // Wait longer, but still honour manual reconnect requests.
            tokio::select! {
                _ = tokio::time::sleep(Duration::from_secs(config.reconnect_max_secs)) => {}
                _ = reconnect_notify.notified() => {
                    info!(source = %source.name, "Manual reconnect requested; retrying now");
                }
            }
            attempt = 0;
            backoff_secs = 5;
            continue;
        }

        info!(
            source = %source.name,
            attempt,
            endpoint = %source.endpoint_url,
            "Connecting to OPC UA server"
        );

        // Store the last error message while transitioning to "connecting".
        if let Err(e) =
            db::set_source_status(&db, source.id, "connecting", last_error.as_deref()).await
        {
            warn!(source = %source.name, error = %e, "Failed to set source status to connecting");
        }

        match run_source_once(&source, &db, &uds, &config, &sessions).await {
            Ok(watchdog_triggered) => {
                info!(source = %source.name, "OPC UA driver exited cleanly");
                last_error = None;
                attempt = 0;
                backoff_secs = 5;

                if watchdog_triggered {
                    // Watchdog fired — no updates for 5 minutes.  Schedule a history
                    // recovery job covering from (earliest-of-last-100-points − 5 min)
                    // to now, with an additional 5% overlap buffer, so no data is lost
                    // across the reconnect cycle.
                    let now = Utc::now();
                    let recovery_from_raw = match db::get_earliest_of_recent_points(&db, source.id)
                        .await
                    {
                        Ok(Some(earliest)) => earliest - chrono::Duration::minutes(5),
                        Ok(None) => now - chrono::Duration::minutes(10),
                        Err(e) => {
                            warn!(source = %source.name, error = %e, "Watchdog: failed to get earliest point timestamp; recovering last 10 minutes");
                            now - chrono::Duration::minutes(10)
                        }
                    };
                    // Apply 5% overlap buffer.
                    let gap_secs = (now - recovery_from_raw).num_seconds().max(0) as f64;
                    let buffer_secs = (gap_secs * 0.05) as i64;
                    let recovery_from = recovery_from_raw - chrono::Duration::seconds(buffer_secs);

                    match db::create_recovery_job(&db, source.id, recovery_from, now, None).await {
                        Ok(job_id) => info!(
                            source = %source.name,
                            %job_id,
                            from = %recovery_from,
                            to = %now,
                            "Watchdog: history recovery job scheduled"
                        ),
                        Err(e) => {
                            warn!(source = %source.name, error = %e, "Watchdog: failed to schedule history recovery job")
                        }
                    }
                }
            }
            Err(e) => {
                let msg = e.to_string();
                warn!(source = %source.name, error = %msg, "OPC UA driver error");
                last_error = Some(msg);
            }
        }

        // Mark inactive/error and broadcast offline via UDS.
        let (next_status, err_ref) = if attempt >= 2 {
            ("error", last_error.as_deref())
        } else {
            ("inactive", last_error.as_deref())
        };
        if let Err(e) = db::set_source_status(&db, source.id, next_status, err_ref).await {
            warn!(source = %source.name, error = %e, "Failed to set source status after error");
        }

        let status_msg = UdsSourceStatus {
            source_id: source.id,
            status: SourceStatusChange::Offline,
        };
        if let Err(e) = uds.send_status(&status_msg).await {
            warn!(source = %source.name, error = %e, "Failed to send offline status via UDS");
        }

        info!(
            source = %source.name,
            backoff = backoff_secs,
            "Waiting before reconnect"
        );
        // Wait for backoff OR a manual reconnect signal.
        tokio::select! {
            _ = tokio::time::sleep(Duration::from_secs(backoff_secs)) => {}
            _ = reconnect_notify.notified() => {
                info!(source = %source.name, "Manual reconnect requested; retrying now");
                // Reset backoff on manual reconnect.
                backoff_secs = 5;
                attempt = 0;
            }
        }

        // Exponential backoff: 5 → 10 → 20 → 40 → 60 (capped).
        // (Manual reconnect already resets backoff_secs above.)
        backoff_secs = (backoff_secs * 2).min(config.reconnect_max_secs);
    }
}

// ---------------------------------------------------------------------------
// Inner driver (single connection lifetime)
// ---------------------------------------------------------------------------

async fn run_source_once(
    source: &PointSource,
    db: &DbPool,
    uds: &Arc<UdsSender>,
    config: &Arc<Config>,
    sessions: &SessionRegistry,
) -> anyhow::Result<bool> {
    let (mut security_policy, security_mode, identity) = build_security(
        &source.security_policy,
        &source.security_mode,
        source.username.clone(),
        source.password.clone(),
    );

    let pki_dir = config.pki_dir.clone();
    let auto_trust = config.auto_trust_server_certs;
    let endpoint_url = source.endpoint_url.clone();

    // Build client without keypair first — some servers hide their None
    // endpoint when they detect a certificate-capable client.
    let mut client = ClientBuilder::new()
        .application_name("io-opc-service")
        .application_uri("urn:io-opc-service")
        .pki_dir(&pki_dir)
        .trust_server_certs(auto_trust)
        .create_sample_keypair(false)
        .session_retry_limit(0)
        .max_chunk_size(327_675)
        .max_incoming_chunk_size(327_675)
        .max_message_size(327_675)
        .client()
        .map_err(|errs| anyhow::anyhow!("ClientBuilder errors: {}", errs.join(", ")))?;

    // Build the endpoint description from our configured parameters.
    let mut connect_endpoint = EndpointDescription {
        endpoint_url: UAString::from(endpoint_url.as_str()),
        security_policy_uri: UAString::from(security_policy.to_uri()),
        security_mode,
        server: opcua::types::ApplicationDescription::default(),
        server_certificate: opcua::types::ByteString::null(),
        user_identity_tokens: None,
        transport_profile_uri: UAString::null(),
        security_level: 0,
    };

    // Probe the server's endpoint list to handle URL mismatches (NAT,
    // path-based URIs, different ports, etc.)  Many OPC UA servers
    // advertise endpoints with internal addresses (127.0.0.1, internal
    // hostnames) that don't match the DNS name the client uses to reach
    // them.  We discover the actual endpoint, patch its hostname with
    // ours, and use it for the real connection.
    // A 30-second timeout prevents a hung TCP connection from blocking the
    // reconnect loop indefinitely when the server accepts TCP but stops
    // responding to OPC UA discovery requests.
    let discovery_result = tokio::time::timeout(
        Duration::from_secs(30),
        client.get_server_endpoints_from_url(endpoint_url.as_str()),
    )
    .await
    .unwrap_or_else(|_| {
        warn!(endpoint_url = %endpoint_url, "OPC UA endpoint discovery timed out (30s) — using configured endpoint");
        Ok(vec![])
    });
    match discovery_result {
        Ok(server_endpoints) if !server_endpoints.is_empty() => {
            let is_none_policy = security_policy == SecurityPolicy::None;

            // Step 1: standard matching (policy + mode + URL normalisation).
            let found = opcua::client::Client::find_matching_endpoint(
                &server_endpoints,
                endpoint_url.as_str(),
                security_policy,
                security_mode,
            )
            // Step 2: URL-agnostic match — server advertises a different
            // hostname/path.  Match by policy+mode only and rewrite URL.
            .or_else(|| {
                server_endpoints
                    .iter()
                    .find(|e| {
                        e.security_mode == security_mode
                            && SecurityPolicy::from_uri(e.security_policy_uri.as_ref())
                                == security_policy
                    })
                    .cloned()
                    .map(|mut ep| {
                        let rewritten = rewrite_hostname(ep.endpoint_url.as_ref(), &endpoint_url);
                        tracing::info!(
                            original = ep.endpoint_url.as_ref(),
                            rewritten = %rewritten,
                            "Rewrote server endpoint URL to match client address"
                        );
                        ep.endpoint_url = UAString::from(rewritten.as_str());
                        ep
                    })
            })
            // Step 3 (only when the user left policy as "None" / default):
            // auto-select the lowest-security endpoint on offer.
            .or_else(|| {
                if !is_none_policy {
                    // Configured policy not found — don't silently downgrade.
                    let available: Vec<_> = server_endpoints
                        .iter()
                        .map(|e| format!("{}/{:?}", e.security_policy_uri, e.security_mode))
                        .collect();
                    tracing::warn!(
                        endpoint_url = %endpoint_url,
                        available = ?available,
                        configured_policy = ?security_policy,
                        configured_mode = ?security_mode,
                        "Configured security policy not offered by server"
                    );
                    return None;
                }
                // Policy is None — pick the highest-security endpoint available.
                let mut candidates = server_endpoints.clone();
                candidates.sort_by_key(|e| std::cmp::Reverse(e.security_level));
                candidates.into_iter().next().map(|mut ep| {
                    security_policy = SecurityPolicy::from_uri(ep.security_policy_uri.as_ref());
                    tracing::info!(
                        endpoint_url = %endpoint_url,
                        server_policy = %ep.security_policy_uri,
                        mode = ?ep.security_mode,
                        "Auto-selected highest-security endpoint"
                    );
                    let rewritten = rewrite_hostname(ep.endpoint_url.as_ref(), &endpoint_url);
                    ep.endpoint_url = UAString::from(rewritten.as_str());
                    ep
                })
            });

            if let Some(ep) = found {
                connect_endpoint = ep;
            } else {
                // Configured policy not offered by this server. Still grab the
                // server certificate from any endpoint so the secure-channel
                // request can be encrypted — without it the server will return
                // BadDecodingError because it can't decrypt our message.
                if let Some(any_ep) = server_endpoints.first() {
                    connect_endpoint.server_certificate = any_ep.server_certificate.clone();
                    tracing::warn!(
                        endpoint_url = %endpoint_url,
                        "Configured security policy not offered by server; \
                         proceeding with configured policy and server cert from discovery"
                    );
                }
            }
        }
        Ok(_) | Err(_) => {
            // Server returned empty list or discovery failed — proceed
            // with our configured endpoint as-is. Try to pre-populate the
            // server certificate from the PKI trusted directory so that the
            // secure-channel handshake can proceed without a discovery round.
            let trusted_dir = std::path::Path::new(&pki_dir).join("trusted");
            if let Ok(entries) = std::fs::read_dir(&trusted_dir) {
                for entry in entries.flatten() {
                    let path = entry.path();
                    if path.extension().is_some_and(|e| e == "der") {
                        if let Ok(der) = std::fs::read(&path) {
                            tracing::debug!(
                                cert = %path.display(),
                                "Preloading trusted server cert for direct connect"
                            );
                            connect_endpoint.server_certificate =
                                opcua::types::ByteString::from(der.as_slice());
                            break;
                        }
                    }
                }
            }
        }
    }

    // If the endpoint needs signing, rebuild the client with a keypair.
    if connect_endpoint.security_mode != MessageSecurityMode::None {
        client = ClientBuilder::new()
            .application_name("io-opc-service")
            .application_uri("urn:io-opc-service")
            .pki_dir(&pki_dir)
            .trust_server_certs(auto_trust)
            .create_sample_keypair(true)
            .session_retry_limit(0)
            .max_chunk_size(327_675)
            .max_incoming_chunk_size(327_675)
            .max_message_size(327_675)
            .client()
            .map_err(|errs| anyhow::anyhow!("ClientBuilder errors: {}", errs.join(", ")))?;
    }

    // connect_to_endpoint_directly bypasses the second endpoint discovery round
    // that connect_to_matching_endpoint would do internally. This avoids failures
    // when the server advertises an internal hostname (e.g. simblah:4840) that
    // the client can't resolve from outside.
    let (session, event_loop) = client
        .connect_to_endpoint_directly(connect_endpoint, identity)
        .map_err(|e| anyhow::anyhow!("OPC UA session creation failed: {}", e))?;

    // Spawn the event loop — this starts the actual TCP connection handshake
    // in a background Tokio task.  We hold onto the JoinHandle so we can
    // detect an early exit.  With session_retry_limit(0) the event loop makes
    // exactly one TCP attempt; if that fails the task exits and
    // wait_for_connection() would hang forever (state_watch_tx lives in
    // Arc<Session>, so the watch channel is never closed even after the event
    // loop task ends).  The select! below catches that case immediately.
    let event_loop_handle = event_loop.spawn();

    // Wait until the session is fully established, or bail out if the event
    // loop exits before connecting (e.g. server unreachable on first attempt).
    let connected = tokio::select! {
        connected = session.wait_for_connection() => connected,
        result = event_loop_handle => {
            let sc = result.unwrap_or(opcua::types::StatusCode::BadUnexpectedError);
            return Err(anyhow::anyhow!(
                "OPC UA event loop exited before connecting: {}", sc
            ));
        }
        _ = tokio::time::sleep(Duration::from_secs(30)) => {
            return Err(anyhow::anyhow!("OPC UA session connect timed out after 30s"));
        }
    };
    if !connected {
        return Err(anyhow::anyhow!("OPC UA session failed to connect"));
    }

    info!(source = %source.name, "Connected to OPC UA server");

    // Register the live session so HTTP alarm-method handlers can reach it.
    {
        let mut guard = sessions.lock().unwrap_or_else(|e| e.into_inner());
        guard.insert(source.id, session.clone());
        metrics::gauge!("io_opc_sources_connected").set(guard.len() as f64);
    }

    // Register the server certificate in the DB (non-fatal if it fails).
    register_server_cert(source, db, config).await;

    // --- Browse namespace ---
    let (mut node_map, analog_nodes, discrete_nodes) =
        browse_namespace(source, db, &session).await?;

    if node_map.is_empty() {
        warn!(source = %source.name, "No variable nodes discovered; disconnecting");
        return Ok(false);
    }

    info!(
        source = %source.name,
        points = node_map.len(),
        analog_points = analog_nodes.len(),
        discrete_points = discrete_nodes.len(),
        "Namespace browse complete"
    );

    // --- Harvest OPC UA Part 8 analog metadata (EU, limits, description) ---
    // Opportunistic — failures are non-fatal; missing properties are skipped.
    // The return value (eu_ranges) is intentionally discarded — EBR is now handled
    // client-side in flush_loop; we no longer apply PercentDeadband at the OPC level.
    harvest_analog_metadata(source, db, &session, &node_map, &analog_nodes).await;

    // --- Harvest MinimumSamplingInterval (AttributeId 11) for all variable nodes ---
    // Declares the OPC server's per-tag update rate (e.g. 1000ms, 300000ms for GC analyzers).
    // Stored in points_metadata and used by the frontend for step rendering and staleness.
    harvest_minimum_sampling_intervals(source, db, &session, &node_map).await;

    // --- Harvest discrete-type metadata (EnumStrings, TrueState/FalseState) ---
    // Opportunistic — failures are non-fatal.
    harvest_discrete_metadata(source, db, &session, &discrete_nodes).await;

    // --- Startup history auto-recovery ---
    // On every connect:
    // 1. Reset any jobs that were 'running' when we last crashed back to 'pending'
    //    (original to_time is preserved; a fresh job covers any new gap below).
    // 2. If no pending jobs exist, split the gap from the last stored value to now
    //    into 6-hour sub-jobs so each completes quickly and can be compressed
    //    individually, keeping disk usage low during long catch-up runs.
    // Recovery runs in the background flush-loop poller — it does NOT block subscription
    // setup and survives service restarts without losing progress.
    {
        let now = Utc::now();

        // Step 1: Resume any job that was interrupted mid-run.
        match db::reset_interrupted_recovery_jobs(db, source.id).await {
            Ok(n) if n > 0 => info!(
                source = %source.name,
                count = n,
                "Resumed {} interrupted history recovery job(s)",
                n
            ),
            Ok(_) => {}
            Err(e) => {
                warn!(source = %source.name, error = %e, "Failed to reset interrupted recovery jobs (non-fatal)")
            }
        }

        // Step 2: Create new jobs only if:
        //   a) nothing is already queued, AND
        //   b) the raw history table already has data older than 1 hour — meaning
        //      this is not a first-time startup with an empty DB.  On a fresh install
        //      there is nothing to recover and the initial 6-hour backfill would just
        //      pull OPC server history that may not exist.
        let already_queued = db::has_pending_recovery_jobs(db, source.id)
            .await
            .unwrap_or(false);
        let has_established_history =
            db::has_history_older_than(db, source.id, chrono::Duration::hours(1))
                .await
                .unwrap_or(false);
        if !already_queued && has_established_history {
            let point_ids: Vec<Uuid> = node_map.values().copied().collect();
            let recover_from = match db::get_last_history_timestamp(db, &point_ids).await {
                Ok(Some(last_ts)) => {
                    use chrono::Timelike;
                    // Round down to the start of the hour containing the last stored value.
                    let hour_start = last_ts
                        .with_minute(0)
                        .and_then(|t: chrono::DateTime<Utc>| t.with_second(0))
                        .and_then(|t: chrono::DateTime<Utc>| t.with_nanosecond(0))
                        .unwrap_or(last_ts);
                    Some(hour_start)
                }
                Ok(None) => {
                    // No history yet — recover the last 6 hours as an initial backfill.
                    Some(now - chrono::Duration::hours(6))
                }
                Err(e) => {
                    warn!(source = %source.name, error = %e, "Failed to query last history timestamp (skipping auto-recovery)");
                    None
                }
            };

            if let Some(from_time) = recover_from {
                if from_time < now {
                    // Apply a 5% overlap buffer to the very first job's start so data
                    // at the boundary of what was already stored is never missed.
                    let gap_secs = (now - from_time).num_seconds().max(0) as f64;
                    let buffer_secs = (gap_secs * 0.05) as i64;
                    let buffered_from = from_time - chrono::Duration::seconds(buffer_secs);

                    // Split into 6-hour jobs so each finishes quickly, lets the disk
                    // reclaim space via per-job compression, and keeps restart overhead low.
                    const JOB_WINDOW_SECS: i64 = 6 * 3600;
                    let mut job_start = buffered_from;
                    let mut created = 0u32;
                    while job_start < now {
                        let job_end =
                            (job_start + chrono::Duration::seconds(JOB_WINDOW_SECS)).min(now);
                        match db::create_recovery_job(db, source.id, job_start, job_end, None).await
                        {
                            Ok(_) => created += 1,
                            Err(e) => {
                                warn!(source = %source.name, error = %e, "Failed to queue history recovery sub-job (non-fatal)");
                                break;
                            }
                        }
                        job_start = job_end;
                    }
                    if created > 0 {
                        info!(
                            source = %source.name,
                            jobs = created,
                            from = %buffered_from,
                            to = %now,
                            gap_hours = (gap_secs / 3600.0) as u64,
                            "Startup history recovery: {} 6-hour jobs queued",
                            created
                        );
                    }
                }
            }
        } else {
            info!(source = %source.name, "Pending history recovery jobs already exist — skipping duplicate");
        }
    }

    // Mark active; send UDS online status.
    if let Err(e) = db::set_source_status(db, source.id, "active", None).await {
        warn!(source = %source.name, error = %e, "Failed to set status to active");
    }

    let status_msg = UdsSourceStatus {
        source_id: source.id,
        status: SourceStatusChange::Online,
    };
    if let Err(e) = uds.send_status(&status_msg).await {
        warn!(
            source = %source.name,
            error = %e,
            "Failed to send online status via UDS (non-fatal)"
        );
    }

    // --- Subscribe ---
    let (update_tx, update_rx) = mpsc::unbounded_channel::<PointUpdate>();

    // Keep a clone of the sender so flush_loop can create new subscriptions
    // during incremental rediscovery while the channel stays open.
    let (good_items, _subscription_ids) =
        create_subscriptions(source, &session, &node_map, update_tx.clone(), config).await?;

    // Record how many points are currently subscribed after subscription creation.
    metrics::gauge!("io_opc_points_subscribed").set(good_items as f64);

    // --- OPC UA Part 9 A&C event subscription (non-fatal) ---
    // Build a name→UUID lookup from the node_map so the event callback can resolve
    // OPC SourceName strings (e.g. "25-TIC-1010.PV") to point UUIDs.
    // SimBLAH uses ns=1 string NodeIds of the form ns=1;s="<name>" — strip the quotes.
    let source_name_to_id: Arc<HashMap<String, Uuid>> = Arc::new(
        node_map
            .iter()
            .filter_map(|(nid, &uuid)| {
                if nid.namespace == 1 {
                    if let opcua::types::Identifier::String(s) = &nid.identifier {
                        if let Some(raw) = s.value() {
                            let name = raw.trim_matches('"').to_string();
                            return Some((name, uuid));
                        }
                    }
                }
                None
            })
            .collect(),
    );

    // Store the handle so we can abort the drain task when this session ends,
    // preventing stale tasks from accumulating across reconnect cycles.
    let event_task =
        create_event_subscription(source, db, &session, config, source_name_to_id.clone()).await;

    // Spawn alarm event history recovery as a background task.
    // Runs concurrently with the flush loop; ON CONFLICT DO NOTHING in write_opc_events
    // handles deduplication with live subscription events.
    {
        let recover_source_id = source.id;
        let recover_source_name = source.name.clone();
        let recover_db = db.clone();
        let recover_session = session.clone();
        let recover_map = source_name_to_id.clone();
        tokio::spawn(async move {
            recover_alarm_event_history(
                recover_source_id,
                &recover_source_name,
                &recover_db,
                recover_session,
                recover_map,
            )
            .await;
        });
    }

    // If all monitored items returned BadServiceUnsupported (0 good items), fall back to
    // periodic polling via OPC UA Read instead of subscriptions.  This handles servers
    // that implement Browse and Read but not the Subscription service, or servers that
    // have exhausted their subscription quota from zombie sessions.
    let watchdog_triggered = if good_items == 0 && !node_map.is_empty() {
        warn!(
            source = %source.name,
            points = node_map.len(),
            "All monitored items returned non-Good status — falling back to polling mode"
        );
        drop(update_rx); // won't be used in polling mode
                         // Rediscovery is not implemented for poll_loop — subscriptions are required.
                         // TODO: add rediscovery support to poll_loop if subscription-less servers need it.
        poll_loop(source, db, uds, config, &session, &node_map).await;
        false
    } else {
        info!(source = %source.name, "Entering flush loop — waiting for OPC UA DataChange callbacks");
        // --- Flush loop (runs until session ends; returns true if watchdog triggered) ---
        flush_loop(
            source,
            db,
            uds,
            config,
            &session,
            &mut node_map,
            update_tx,
            update_rx,
        )
        .await
    };

    // Abort the A&C drain task — the session is gone, events will no longer arrive.
    if let Some(handle) = event_task {
        handle.abort();
    }

    // Points for this source are no longer subscribed — set to 0 so the gauge reflects reality.
    metrics::gauge!("io_opc_points_subscribed").set(0.0);

    // Deregister from the session registry before closing — HTTP handlers will now
    // get 404 for this source rather than trying to use a dead session.
    {
        let mut guard = sessions.lock().unwrap_or_else(|e| e.into_inner());
        guard.remove(&source.id);
        metrics::gauge!("io_opc_sources_connected").set(guard.len() as f64);
    }

    // Send OPC UA CloseSession so the server can immediately release all
    // server-side session state (subscriptions, monitored items, locks).
    // Without this, "zombie" sessions accumulate on the server across restarts
    // until the server-side timeout expires, consuming server session/item
    // quota and causing BadServiceUnsupported on monitored item creation.
    if let Err(e) = session.disconnect().await {
        tracing::warn!(source = %source.name, error = %e, "OPC UA disconnect returned error (non-fatal)");
    } else {
        tracing::info!(source = %source.name, "OPC UA session closed cleanly");
    }

    Ok(watchdog_triggered)
}

// ---------------------------------------------------------------------------
// A&C operator method call helper
// ---------------------------------------------------------------------------

/// Call an OPC UA A&C method (Acknowledge, Enable, Disable, TimedShelve, etc.)
/// on a live session.
///
/// The condition object NodeId is built from `condition_node_id`, which is the
/// string form of the condition instance node (e.g. `ns=2;s="alarm.PV001.HHigh"`).
///
/// The method NodeId construction here uses a synthetic `ns=1;s="alarm-method:X"`
/// placeholder that matches SimBLAH's naming convention.
///
/// TODO: verify method NodeIds against SimBLAH's actual OPC UA nodeset once
/// alarms are exercised end-to-end.  Standard OPC UA Part 9 method IDs are in
/// ns=0 (e.g. Acknowledge=9111, Enable=9027, Disable=9028, TimedShelve=11093)
/// but many servers require calling the method node on the condition instance
/// rather than the type definition.
///
/// Returns the OPC `StatusCode` from the method result; callers treat `Good` as
/// success and any bad status as a protocol-level failure.
pub async fn call_alarm_method(
    session: &Session,
    condition_node_id: &str,
    method_name: &str,
    args: Option<Vec<Variant>>,
) -> StatusCode {
    let obj_id = NodeId::new(1u16, UAString::from(condition_node_id));
    let method_id = NodeId::new(
        1u16,
        UAString::from(format!("alarm-method:{}", method_name)),
    );

    match session.call_one((obj_id, method_id, args)).await {
        Ok(result) => result.status_code,
        Err(sc) => sc,
    }
}

// ---------------------------------------------------------------------------
// Namespace browsing
// ---------------------------------------------------------------------------

/// OPC UA TypeDefinition NodeIds for Part 8 Data Access types.
/// Used to determine which metadata properties to harvest during browse.
mod type_defs {
    /// DataItemType — exposes Definition, ValuePrecision
    pub const DATA_ITEM: u32 = 2365;
    /// AnalogItemType — also exposes EURange, EngineeringUnits, InstrumentRange, alarm limits
    pub const ANALOG_ITEM: u32 = 2368;
    /// TwoStateDiscreteType — exposes TrueState, FalseState
    pub const TWO_STATE_DISCRETE: u32 = 2373;
    /// MultiStateDiscreteType — exposes EnumStrings
    pub const MULTI_STATE_DISCRETE: u32 = 2376;
    /// MultiStateValueDiscreteType — exposes EnumValues
    pub const MULTI_STATE_VALUE_DISCRETE: u32 = 11238;
}

/// Returns `(node_map, analog_nodes)` where:
/// - `node_map`: all discovered variable NodeIds → point UUIDs
/// - `analog_nodes`: subset of NodeIds whose TypeDefinition is AnalogItemType or DataItemType.
///   Used by `harvest_analog_metadata` to skip nodes that cannot have Part 8 properties.
///   If empty (server did not report TypeDefinitions), the caller falls back to all nodes.
// Discrete node info collected during browse — used by harvest_discrete_metadata.
struct DiscreteNodeInfo {
    point_id: Uuid,
    tagname: String,
    type_name: &'static str,
}

async fn browse_namespace(
    source: &PointSource,
    db: &DbPool,
    session: &Arc<Session>,
) -> anyhow::Result<(
    HashMap<NodeId, Uuid>,
    HashSet<NodeId>,
    Vec<DiscreteNodeInfo>,
)> {
    // OPC UA Objects folder node id = ns=0;i=85
    let root = NodeId::new(0u16, 85u32);
    let mut node_map: HashMap<NodeId, Uuid> = HashMap::new();
    // Track which nodes are AnalogItemType or DataItemType (have Part 8 properties).
    let mut analog_nodes: HashSet<NodeId> = HashSet::new();
    // Track MultiStateDiscreteType and TwoStateDiscreteType nodes for EnumStrings/state harvest.
    let mut discrete_nodes: Vec<DiscreteNodeInfo> = Vec::new();
    let mut to_visit: Vec<NodeId> = vec![root];

    while !to_visit.is_empty() {
        let batch: Vec<NodeId> = std::mem::take(&mut to_visit);

        for parent_id in batch {
            let children_result = browse_children(session, &parent_id).await;

            match children_result {
                Ok(children) => {
                    for (node_id, display_name, node_class, type_def_id) in children {
                        // Skip ns=0 nodes — those are OPC UA server infrastructure
                        // (Server diagnostics, Endpoints, SessionDiagnostics, etc.).
                        // Process data lives in vendor namespaces (ns >= 2).
                        // NOTE: Do NOT recurse into ns=0 Objects — SimBLAH's address space
                        // contains ns=2 metadata nodes under ns=0 Objects (e.g. Server node)
                        // that return BadServiceUnsupported when monitored.  The correct
                        // process data is accessible directly from Objects (ns=0;i=85) via
                        // ns>=2 Object children without recursing through ns=0.
                        if node_id.namespace == 0 {
                            continue;
                        }
                        match node_class {
                            NodeClass::Variable => {
                                // Determine type for metadata harvesting.
                                let type_name = type_name_from_typedef(&type_def_id);
                                // Track whether this node is AnalogItemType or DataItemType so
                                // harvest_analog_metadata can skip nodes that can never have
                                // Part 8 properties (EU, EURange, alarm limits, Definition).
                                let is_analog_or_data_item = matches!(
                                    type_name,
                                    Some("AnalogItemType") | Some("DataItemType")
                                );
                                // Derive the OPC data_type to store in the DB.
                                // TwoStateDiscreteType → Boolean, MultiStateDiscreteType → String,
                                // everything else → Double (OPC numeric/float types).
                                let data_type = match type_name {
                                    Some("TwoStateDiscreteType") => "Boolean",
                                    Some("MultiStateDiscreteType")
                                    | Some("MultiStateValueDiscreteType") => "String",
                                    _ => "Double",
                                };
                                // Use the OPC node identifier string as the tagname when
                                // available (e.g. "25-FI-1001.PV" from ns=1;s=25-FI-1001.PV).
                                // This matches the point_tag values used in .iographic files
                                // exported from the same OPC server.  Fall back to the
                                // DisplayName for numeric/GUID identifiers.
                                let node_id_str = node_id.to_string(); // "ns=N;s=..." or "ns=N;i=..."
                                let tagname = node_id_str
                                    .split_once(";s=")
                                    .map(|(_, ident)| ident.to_string())
                                    .unwrap_or_else(|| display_name.clone());
                                let metadata = serde_json::json!({
                                    "node_id": node_id.to_string(),
                                    "display_name": display_name,
                                    "type_def": type_def_id.map(|nid| nid.to_string()),
                                    "type_name": type_name,
                                });
                                match db::upsert_point_from_source(
                                    db, source.id, &tagname, data_type, metadata,
                                )
                                .await
                                {
                                    Ok(point_id) => {
                                        if is_analog_or_data_item {
                                            analog_nodes.insert(node_id.clone());
                                        }
                                        // Track discrete nodes for a second-pass EnumStrings harvest.
                                        if matches!(
                                            type_name,
                                            Some("TwoStateDiscreteType")
                                                | Some("MultiStateDiscreteType")
                                                | Some("MultiStateValueDiscreteType")
                                        ) {
                                            discrete_nodes.push(DiscreteNodeInfo {
                                                point_id,
                                                tagname: tagname.clone(),
                                                type_name: type_name.unwrap(),
                                            });
                                            // Set initial point_category immediately so the point
                                            // is classified before the second-pass label harvest.
                                            let initial_category = match type_name {
                                                Some("TwoStateDiscreteType") => "boolean",
                                                _ => "discrete_enum",
                                            };
                                            if let Err(e) = db::set_point_category(
                                                db,
                                                point_id,
                                                initial_category,
                                            )
                                            .await
                                            {
                                                warn!(
                                                    source = %source.name,
                                                    tag = %tagname,
                                                    error = %e,
                                                    "Failed to set initial point_category"
                                                );
                                            }
                                        }
                                        node_map.insert(node_id, point_id);
                                    }
                                    Err(e) => {
                                        warn!(
                                            source = %source.name,
                                            tag = %tagname,
                                            error = %e,
                                            "Failed to upsert point"
                                        );
                                    }
                                }
                            }
                            NodeClass::Object => {
                                to_visit.push(node_id);
                            }
                            _ => {}
                        }
                    }
                }
                Err(e) => {
                    warn!(
                        source = %source.name,
                        node = %parent_id,
                        error = %e,
                        "Browse failed for node"
                    );
                }
            }
        }
    }

    Ok((node_map, analog_nodes, discrete_nodes))
}

/// A single variable node discovered during a lightweight BFS (no DB upsert).
struct DiscoveredNode {
    node_id: NodeId,
    /// Tagname derived by the same ns:s= / DisplayName fallback as browse_namespace.
    tagname: String,
    /// OPC data type string: "Double", "Boolean", or "String".
    data_type: &'static str,
    #[allow(dead_code)]
    type_def_id: Option<NodeId>,
}

/// Lightweight namespace BFS — same traversal as `browse_namespace` but does NOT
/// upsert to the DB and does NOT harvest metadata.  Returns the full set of
/// discovered variable nodes so callers can diff against what is already known.
async fn browse_namespace_nodes_only(
    source: &PointSource,
    session: &Arc<Session>,
) -> anyhow::Result<Vec<DiscoveredNode>> {
    let root = NodeId::new(0u16, 85u32);
    let mut results: Vec<DiscoveredNode> = Vec::new();
    let mut to_visit: Vec<NodeId> = vec![root];

    while !to_visit.is_empty() {
        let batch: Vec<NodeId> = std::mem::take(&mut to_visit);

        for parent_id in batch {
            let children_result = browse_children(session, &parent_id).await;
            match children_result {
                Ok(children) => {
                    for (node_id, display_name, node_class, type_def_id) in children {
                        if node_id.namespace == 0 {
                            continue;
                        }
                        match node_class {
                            NodeClass::Variable => {
                                let type_name = type_name_from_typedef(&type_def_id);
                                let data_type = match type_name {
                                    Some("TwoStateDiscreteType") => "Boolean",
                                    Some("MultiStateDiscreteType")
                                    | Some("MultiStateValueDiscreteType") => "String",
                                    _ => "Double",
                                };
                                let node_id_str = node_id.to_string();
                                let tagname = node_id_str
                                    .split_once(";s=")
                                    .map(|(_, ident)| ident.to_string())
                                    .unwrap_or_else(|| display_name.clone());
                                results.push(DiscoveredNode {
                                    node_id,
                                    tagname,
                                    data_type,
                                    type_def_id,
                                });
                            }
                            NodeClass::Object => {
                                to_visit.push(node_id);
                            }
                            _ => {}
                        }
                    }
                }
                Err(e) => {
                    warn!(
                        source = %source.name,
                        node = %parent_id,
                        error = %e,
                        "Browse (nodes-only) failed for node"
                    );
                }
            }
        }
    }

    Ok(results)
}

/// Map TypeDefinition NodeId to a human-readable name for metadata storage.
fn type_name_from_typedef(type_def: &Option<NodeId>) -> Option<&'static str> {
    let nid = type_def.as_ref()?;
    if nid.namespace != 0 {
        return None; // Vendor-specific type
    }
    match nid.identifier {
        opcua::types::Identifier::Numeric(id) => match id {
            n if n == type_defs::ANALOG_ITEM => Some("AnalogItemType"),
            n if n == type_defs::DATA_ITEM => Some("DataItemType"),
            n if n == type_defs::TWO_STATE_DISCRETE => Some("TwoStateDiscreteType"),
            n if n == type_defs::MULTI_STATE_DISCRETE => Some("MultiStateDiscreteType"),
            n if n == type_defs::MULTI_STATE_VALUE_DISCRETE => Some("MultiStateValueDiscreteType"),
            _ => None,
        },
        _ => None,
    }
}

/// (NodeId, display_name, NodeClass, optional TypeDefinition NodeId)
type BrowseEntry = (NodeId, String, NodeClass, Option<NodeId>);

/// Async browse of a single node's children.
/// Returns (NodeId, display_name, NodeClass, optional TypeDefinition NodeId).
async fn browse_children(session: &Session, node_id: &NodeId) -> Result<Vec<BrowseEntry>, String> {
    let desc = BrowseDescription {
        node_id: node_id.clone(),
        browse_direction: BrowseDirection::Forward,
        reference_type_id: ReferenceTypeId::HierarchicalReferences.into(),
        include_subtypes: true,
        node_class_mask: 0xff, // all node classes
        result_mask: 63,       // includes TypeDefinition in result
    };

    let results = session
        .browse(&[desc], 0, None)
        .await
        .map_err(|e| format!("browse error: {}", e))?;

    let mut children = Vec::new();

    for result in &results {
        if let Some(refs) = &result.references {
            for r in refs {
                let nid = r.node_id.node_id.clone();
                let nc = r.node_class;
                let name = r
                    .display_name
                    .text
                    .value()
                    .as_ref()
                    .and_then(|s| {
                        if s.is_empty() {
                            None
                        } else {
                            Some(s.to_string())
                        }
                    })
                    .or_else(|| {
                        r.browse_name.name.value().as_ref().and_then(|s| {
                            if s.is_empty() {
                                None
                            } else {
                                Some(s.to_string())
                            }
                        })
                    })
                    .unwrap_or_else(|| nid.to_string());
                // TypeDefinition is available via HasTypeDefinition reference in browse results.
                // In async-opcua, ReferenceDescription.type_definition is an ExpandedNodeId.
                // Only include it when namespace == 0 (OPC UA standard types).
                let type_def = {
                    let td = &r.type_definition;
                    if td.server_index == 0 {
                        Some(td.node_id.clone())
                    } else {
                        None
                    }
                };
                children.push((nid, name, nc, type_def));
            }
        }
    }

    Ok(children)
}

// ---------------------------------------------------------------------------
// OPC UA Part 8: Analog metadata harvesting
// ---------------------------------------------------------------------------

/// For each variable node in `node_map` that is an AnalogItemType or DataItemType, attempt to
/// read OPC UA Part 8 optional properties (EURange, EngineeringUnits, Definition, alarm limits).
/// Writes any discovered metadata to the DB via `update_point_analog_metadata`.
/// Non-fatal — individual property read failures are logged and skipped.
///
/// `analog_nodes` is the set of NodeIds known to be AnalogItemType or DataItemType from browse.
/// If empty (server did not report TypeDefinitions), all nodes are processed as a compatibility
/// fallback (preserves behaviour with servers that omit TypeDefinition in browse results).
///
/// EURange data is stored in the DB (points_metadata) for display in the UI but is no longer
/// used for OPC UA subscription filtering — EBR is handled client-side in flush_loop.
async fn harvest_analog_metadata(
    source: &PointSource,
    db: &DbPool,
    session: &Arc<Session>,
    node_map: &HashMap<NodeId, Uuid>,
    analog_nodes: &HashSet<NodeId>,
) {
    // Filter to only AnalogItemType/DataItemType nodes to avoid unnecessary load on large servers.
    // Fall back to all nodes when analog_nodes is empty (server didn't report TypeDefinitions).
    let node_ids: Vec<(NodeId, Uuid)> = if analog_nodes.is_empty() {
        // Compatibility fallback: server did not report TypeDefinitions during browse.
        node_map.iter().map(|(n, p)| (n.clone(), *p)).collect()
    } else {
        node_map
            .iter()
            .filter(|(nid, _)| analog_nodes.contains(nid))
            .map(|(n, p)| (n.clone(), *p))
            .collect()
    };

    // Process in batches to avoid overwhelming the server.
    const BATCH: usize = 50;
    let mut harvested = 0usize;

    for chunk in node_ids.chunks(BATCH) {
        for (node_id, point_id) in chunk {
            let meta = read_analog_properties(session, node_id).await;

            // Only write to DB if at least one field was populated.
            let has_data = meta.description.is_some()
                || meta.engineering_units.is_some()
                || meta.eu_range_low.is_some()
                || meta.eu_range_high.is_some()
                || meta.alarm_limit_hh.is_some()
                || meta.alarm_limit_h.is_some()
                || meta.alarm_limit_l.is_some()
                || meta.alarm_limit_ll.is_some();

            if has_data {
                if let Err(e) = db::update_point_analog_metadata(db, *point_id, &meta).await {
                    warn!(
                        source = %source.name,
                        point_id = %point_id,
                        error = %e,
                        "Failed to write analog metadata"
                    );
                } else {
                    harvested += 1;
                }
            }
        }
    }

    if harvested > 0 {
        info!(
            source = %source.name,
            harvested,
            total = node_map.len(),
            "OPC UA Part 8 analog metadata harvested"
        );
    }
}

/// Read the `MinimumSamplingInterval` attribute (AttributeId 11) for every variable node
/// and persist it to `points_metadata.minimum_sampling_interval_ms`.
///
/// This attribute is the OPC UA standard mechanism for a server to declare how often a
/// tag produces a meaningful new value — e.g. 1000 ms for 1 Hz process tags, 300 000 ms
/// for GC analyzer tags, 3 600 000 ms for hourly lab analyzers.  The frontend uses it to
/// select step/hold-last-value rendering and to set the per-tag staleness window.
async fn harvest_minimum_sampling_intervals(
    source: &PointSource,
    db: &DbPool,
    session: &Arc<Session>,
    node_map: &HashMap<NodeId, Uuid>,
) {
    const BATCH: usize = 200;
    let nodes: Vec<(NodeId, Uuid)> = node_map.iter().map(|(n, p)| (n.clone(), *p)).collect();
    let mut updated = 0usize;

    for chunk in nodes.chunks(BATCH) {
        let read_requests: Vec<ReadValueId> = chunk
            .iter()
            .map(|(node_id, _)| ReadValueId {
                node_id: node_id.clone(),
                attribute_id: AttributeId::MinimumSamplingInterval as u32,
                index_range: NumericRange::None,
                data_encoding: QualifiedName::null(),
            })
            .collect();

        let results = match session
            .read(&read_requests, TimestampsToReturn::Neither, 0.0)
            .await
        {
            Ok(r) => r,
            Err(e) => {
                warn!(
                    source = %source.name,
                    error = %e,
                    "Failed to read MinimumSamplingInterval batch — skipping"
                );
                continue;
            }
        };

        let mut ids: Vec<uuid::Uuid> = Vec::new();
        let mut intervals: Vec<f64> = Vec::new();

        for ((_, point_id), dv) in chunk.iter().zip(results.iter()) {
            if let Some(opcua::types::Variant::Double(ms)) = &dv.value {
                if *ms > 0.0 {
                    ids.push(*point_id);
                    intervals.push(*ms);
                }
            }
        }

        if !ids.is_empty() {
            match db::update_minimum_sampling_intervals(db, &ids, &intervals).await {
                Ok(()) => updated += ids.len(),
                Err(e) => warn!(
                    source = %source.name,
                    error = %e,
                    "Failed to write MinimumSamplingInterval batch"
                ),
            }
        }
    }

    if updated > 0 {
        info!(
            source = %source.name,
            updated,
            total = node_map.len(),
            "MinimumSamplingInterval harvested from OPC server"
        );
    }
}

/// Build (category, labels) from the JSON returned by read_discrete_properties_simblah.
fn extract_discrete_labels(
    type_name: &str,
    json: &serde_json::Value,
) -> (&'static str, Vec<(i16, String)>) {
    match type_name {
        "TwoStateDiscreteType" => {
            let false_label = json
                .get("false_state")
                .and_then(|v| v.as_str())
                .unwrap_or("False")
                .to_string();
            let true_label = json
                .get("true_state")
                .and_then(|v| v.as_str())
                .unwrap_or("True")
                .to_string();
            ("boolean", vec![(0, false_label), (1, true_label)])
        }
        "MultiStateDiscreteType" | "MultiStateValueDiscreteType" => {
            let labels: Vec<(i16, String)> = json
                .get("enum_strings")
                .and_then(|v| v.as_array())
                .map(|arr| {
                    arr.iter()
                        .enumerate()
                        .filter_map(|(i, v)| v.as_str().map(|s| (i as i16, s.to_string())))
                        .collect()
                })
                .unwrap_or_default();
            ("discrete_enum", labels)
        }
        _ => ("analog", vec![]),
    }
}

/// Read EnumStrings / TrueState+FalseState properties for discrete variable nodes and merge
/// them into source_raw in the DB.  Opportunistic — failures are non-fatal.
async fn harvest_discrete_metadata(
    source: &PointSource,
    db: &DbPool,
    session: &Arc<Session>,
    discrete_nodes: &[DiscreteNodeInfo],
) {
    if discrete_nodes.is_empty() {
        return;
    }

    const BATCH: usize = 50;
    let mut harvested = 0usize;

    for chunk in discrete_nodes.chunks(BATCH) {
        for node_info in chunk {
            let extra =
                read_discrete_properties_simblah(session, &node_info.tagname, node_info.type_name)
                    .await;
            if let Some(json) = extra {
                // Merge into source_raw (existing behavior)
                if let Err(e) =
                    db::merge_point_source_raw(db, node_info.point_id, json.clone()).await
                {
                    warn!(
                        source = %source.name,
                        point_id = %node_info.point_id,
                        error = %e,
                        "Failed to merge discrete metadata into source_raw"
                    );
                } else {
                    harvested += 1;
                }

                // Promote to structured point_category + point_enum_labels
                let (category, labels) = extract_discrete_labels(node_info.type_name, &json);
                if let Err(e) =
                    db::upsert_discrete_labels(db, node_info.point_id, category, &labels).await
                {
                    warn!(
                        source = %source.name,
                        point_id = %node_info.point_id,
                        error = %e,
                        "Failed to upsert discrete labels"
                    );
                }
            }
        }
    }

    if harvested > 0 {
        info!(
            source = %source.name,
            harvested,
            "Discrete point metadata (EnumStrings/state labels) harvested"
        );
    }
}

/// Read discrete-type OPC UA properties for a single SimBLAH variable node.
/// Returns a JSON object suitable for merging into source_raw, or None if nothing was found.
async fn read_discrete_properties_simblah(
    session: &Session,
    point_name: &str,
    type_name: &str,
) -> Option<serde_json::Value> {
    use opcua::types::Identifier;

    match type_name {
        "MultiStateDiscreteType" | "MultiStateValueDiscreteType" => {
            let key = format!("prop:EnumStrings:{}", point_name);
            let read_nodes = vec![ReadValueId {
                node_id: NodeId {
                    namespace: 1,
                    identifier: Identifier::String(UAString::from(key)),
                },
                attribute_id: AttributeId::Value as u32,
                index_range: NumericRange::None,
                data_encoding: QualifiedName::null(),
            }];

            let data_values = session
                .read(&read_nodes, TimestampsToReturn::Neither, 0.0)
                .await
                .ok()?;
            let dv = data_values.first()?;
            let variant = dv.value.as_ref()?;

            // EnumStrings is a LocalizedText[] variant — extract the text fields.
            let labels: Vec<String> = match variant {
                Variant::Array(arr) => arr
                    .values
                    .iter()
                    .filter_map(|v| {
                        if let Variant::LocalizedText(lt) = v {
                            lt.text.value().as_ref().map(|s| s.to_string())
                        } else {
                            None
                        }
                    })
                    .collect(),
                _ => return None,
            };

            if labels.is_empty() {
                return None;
            }
            Some(serde_json::json!({ "enum_strings": labels }))
        }
        "TwoStateDiscreteType" => {
            let props: &[(&str, &str)] = &[
                ("prop:TrueState", "true_state"),
                ("prop:FalseState", "false_state"),
            ];
            let read_nodes: Vec<ReadValueId> = props
                .iter()
                .map(|(prefix, _)| {
                    let key = format!("{}:{}", prefix, point_name);
                    ReadValueId {
                        node_id: NodeId {
                            namespace: 1,
                            identifier: Identifier::String(UAString::from(key)),
                        },
                        attribute_id: AttributeId::Value as u32,
                        index_range: NumericRange::None,
                        data_encoding: QualifiedName::null(),
                    }
                })
                .collect();

            let data_values = session
                .read(&read_nodes, TimestampsToReturn::Neither, 0.0)
                .await
                .ok()?;

            let mut obj = serde_json::Map::new();
            for ((_, json_key), dv) in props.iter().zip(data_values.iter()) {
                if let Some(ref v) = dv.value {
                    let text = match v {
                        Variant::LocalizedText(lt) => {
                            lt.text.value().as_ref().map(|s| s.to_string())
                        }
                        Variant::String(s) => s.value().as_ref().map(|s| s.to_string()),
                        _ => None,
                    };
                    if let Some(t) = text {
                        obj.insert(json_key.to_string(), serde_json::Value::String(t));
                    }
                }
            }

            if obj.is_empty() {
                return None;
            }
            Some(serde_json::Value::Object(obj))
        }
        _ => None,
    }
}

/// Read OPC UA Part 8 AnalogItemType properties for a single variable node.
///
/// Fast path: if the node uses SimBLAH's `ns=1;s="<point_name>"` convention, the property
/// NodeIds are predictable (`ns=1;s="prop:EURange:<name>"`, `ns=1;s="prop:EU:<name>"`) and
/// can be batch-read directly without a prior Browse round-trip.
///
/// Slow path (generic servers): Browse HasProperty children, then batch-read their values.
/// All failures are silently ignored (returns empty AnalogMetadata).
async fn read_analog_properties(session: &Session, node_id: &NodeId) -> AnalogMetadata {
    // Fast path — SimBLAH publishes properties at known NodeIds under ns=1 string identifiers.
    if node_id.namespace == 1 {
        if let opcua::types::Identifier::String(ref s) = node_id.identifier {
            if let Some(point_name) = s.value() {
                // Reject anything that already looks like a property or folder prefix.
                if !point_name.starts_with("prop:") && !point_name.starts_with("folder:") {
                    if let Some(meta) = read_analog_properties_simblah(session, point_name).await {
                        return meta;
                    }
                }
            }
        }
    }

    read_analog_properties_generic(session, node_id).await
}

/// SimBLAH-specific fast path: construct property NodeIds directly and batch-read.
/// Returns None if the batch read itself fails (caller falls back to generic path).
async fn read_analog_properties_simblah(
    session: &Session,
    point_name: &str,
) -> Option<AnalogMetadata> {
    use opcua::types::Identifier;

    let prop_names: &[(&str, &str)] = &[
        ("prop:EURange", "EURange"),
        ("prop:EU", "EngineeringUnits"),
        ("prop:TrueState", "TrueState"),
        ("prop:FalseState", "FalseState"),
        ("prop:EnumStrings", "EnumStrings"),
    ];

    let read_nodes: Vec<ReadValueId> = prop_names
        .iter()
        .map(|(prefix, _)| {
            let key = format!("{}:{}", prefix, point_name);
            ReadValueId {
                node_id: NodeId {
                    namespace: 1,
                    identifier: Identifier::String(UAString::from(key)),
                },
                attribute_id: AttributeId::Value as u32,
                index_range: NumericRange::None,
                data_encoding: QualifiedName::null(),
            }
        })
        .collect();

    let data_values = session
        .read(&read_nodes, TimestampsToReturn::Neither, 0.0)
        .await
        .ok()?;

    let mut meta = AnalogMetadata::default();
    for ((_, prop_name), dv) in prop_names.iter().zip(data_values.iter()) {
        let Some(ref variant) = dv.value else {
            continue;
        };
        match *prop_name {
            "EngineeringUnits" => {
                meta.engineering_units = extract_eu_display_name(variant);
            }
            "EURange" => {
                if let Some((low, high)) = extract_eu_range(variant) {
                    meta.eu_range_low = Some(low);
                    meta.eu_range_high = Some(high);
                }
            }
            // TrueState/FalseState/EnumStrings are browse metadata — not stored in AnalogMetadata.
            _ => {}
        }
    }

    Some(meta)
}

/// Generic OPC UA property harvest: Browse HasProperty children, then batch-read their values.
async fn read_analog_properties_generic(session: &Session, node_id: &NodeId) -> AnalogMetadata {
    let mut meta = AnalogMetadata::default();

    // Browse the node's properties (PropertyType reference = ns=0;i=68).
    let desc = BrowseDescription {
        node_id: node_id.clone(),
        browse_direction: BrowseDirection::Forward,
        reference_type_id: NodeId::new(0u16, 46u32), // HasProperty = ns=0;i=46
        include_subtypes: true,
        node_class_mask: 0xff,
        result_mask: 63,
    };

    let results = match session.browse(&[desc], 0, None).await {
        Ok(r) => r,
        Err(_) => return meta,
    };

    // Collect property node ids keyed by BrowseName.
    let mut prop_nodes: HashMap<String, NodeId> = HashMap::new();
    for result in &results {
        if let Some(refs) = &result.references {
            for r in refs {
                if let Some(name) = r.browse_name.name.value() {
                    prop_nodes.insert(name.to_string(), r.node_id.node_id.clone());
                }
            }
        }
    }

    if prop_nodes.is_empty() {
        return meta;
    }

    // Build a batch Read request for the properties we care about.
    // Simultaneously build `selected_props` — the names of properties that were actually
    // found in `prop_nodes`, in the same order they appear in `read_nodes`.  This avoids
    // the fragile manual idx counter pattern and keeps name→result mapping self-consistent
    // regardless of which properties the server exposes.
    let property_names: &[&'static str] = &[
        "Definition",
        "EngineeringUnits",
        "EURange",
        "HighHighLimit",
        "HighLimit",
        "LowLimit",
        "LowLowLimit",
    ];

    let (read_nodes, selected_props): (Vec<ReadValueId>, Vec<&'static str>) = property_names
        .iter()
        .filter_map(|name| {
            prop_nodes.get(*name).map(|nid| {
                (
                    ReadValueId {
                        node_id: nid.clone(),
                        attribute_id: AttributeId::Value as u32,
                        index_range: NumericRange::None,
                        data_encoding: QualifiedName::null(),
                    },
                    *name,
                )
            })
        })
        .unzip();

    if read_nodes.is_empty() {
        return meta;
    }

    let data_values = match session
        .read(&read_nodes, TimestampsToReturn::Neither, 0.0)
        .await
    {
        Ok(dvs) => dvs,
        Err(_) => return meta,
    };

    // Map results back to property names using the parallel selected_props vec.
    // Both vecs have identical length and order, so zip is exact.
    for (name, dv) in selected_props.iter().zip(data_values.iter()) {
        if let Some(ref variant) = dv.value {
            match *name {
                "Definition" => {
                    if let Variant::String(s) = variant {
                        if let Some(text) = s.value() {
                            meta.description = Some(text.to_string());
                        }
                    }
                }
                "EngineeringUnits" => {
                    // EUInformation is an ExtensionObject; extract displayName.text
                    meta.engineering_units = extract_eu_display_name(variant);
                }
                "EURange" => {
                    // Range struct: {low: Double, high: Double}
                    if let Some((low, high)) = extract_eu_range(variant) {
                        meta.eu_range_low = Some(low);
                        meta.eu_range_high = Some(high);
                    }
                }
                "HighHighLimit" => meta.alarm_limit_hh = variant_to_f64(variant),
                "HighLimit" => meta.alarm_limit_h = variant_to_f64(variant),
                "LowLimit" => meta.alarm_limit_l = variant_to_f64(variant),
                "LowLowLimit" => meta.alarm_limit_ll = variant_to_f64(variant),
                _ => {}
            }
        }
    }

    meta
}

/// Extract EU display name from an EUInformation ExtensionObject variant.
/// OPC UA encodes EngineeringUnits as EUInformation (ns=0;i=887):
///   { namespaceUri: String, unitId: Int32, displayName: LocalizedText, description: LocalizedText }
fn extract_eu_display_name(variant: &Variant) -> Option<String> {
    match variant {
        Variant::ExtensionObject(ext) => decode_eu_display_name(ext),
        Variant::String(s) => s.value().as_ref().map(|s| s.to_string()),
        _ => None,
    }
}

/// Decode EUInformation from an ExtensionObject using async-opcua's inner_as method.
fn decode_eu_display_name(ext: &ExtensionObject) -> Option<String> {
    ext.inner_as::<opcua::types::EUInformation>()
        .and_then(|eu| eu.display_name.text.value().as_ref().map(|s| s.to_string()))
}

/// Extract (low, high) from an OPC UA Range ExtensionObject variant.
/// Range is encoded as { low: Double (f64 LE), high: Double (f64 LE) }.
fn extract_eu_range(variant: &Variant) -> Option<(f64, f64)> {
    match variant {
        Variant::ExtensionObject(ext) => decode_eu_range(ext),
        _ => None,
    }
}

/// Decode Range from an ExtensionObject using async-opcua's inner_as method.
fn decode_eu_range(ext: &ExtensionObject) -> Option<(f64, f64)> {
    let range = ext.inner_as::<opcua::types::Range>()?;
    let (low, high) = (range.low, range.high);
    if low.is_nan() || low.is_infinite() || high.is_nan() || high.is_infinite() {
        return None;
    }
    Some((low, high))
}

// ---------------------------------------------------------------------------
// Subscription creation
// ---------------------------------------------------------------------------

/// Returns the total number of monitored items that were accepted (Good status) by the server.
/// A return value of 0 means all items failed — caller should fall back to polling mode.
///
/// All nodes use AbsoluteDeadband 0 (report any change). EBR deduplication is handled
/// client-side in flush_loop so no data is lost at the OPC UA transport layer.
async fn create_subscriptions(
    source: &PointSource,
    session: &Arc<Session>,
    node_map: &HashMap<NodeId, Uuid>,
    update_tx: mpsc::UnboundedSender<PointUpdate>,
    config: &Arc<Config>,
) -> anyhow::Result<(usize, Vec<u32>)> {
    let node_ids: Vec<(NodeId, Uuid)> = node_map.iter().map(|(n, p)| (n.clone(), *p)).collect();

    let publishing_ms = config.publishing_interval_ms;
    let mut total_good: usize = 0;
    let mut sub_ids: Vec<u32> = Vec::new();

    for (chunk_idx, chunk) in node_ids.chunks(config.subscription_batch_size).enumerate() {
        let chunk: Vec<(NodeId, Uuid)> = chunk.to_vec();
        let tx = update_tx.clone();

        // Capture node_id → point_id map for the callback.
        let id_map: HashMap<NodeId, Uuid> = chunk.iter().cloned().collect();

        // Per-item DataChange callback (async-opcua calls this once per changed item).
        let callback = DataChangeCallback::new(move |dv: DataValue, item: &MonitoredItem| {
            let now = Utc::now();
            let node_id = &item.item_to_monitor().node_id;
            let point_id = match id_map.get(node_id) {
                Some(id) => *id,
                None => return,
            };

            let (value, quality) = extract_value(&dv);

            let timestamp = dv
                .source_timestamp
                .as_ref()
                .map(|dt| dt.as_chrono())
                .or_else(|| dv.server_timestamp.as_ref().map(|dt| dt.as_chrono()))
                .unwrap_or(now);

            let update = PointUpdate {
                point_id,
                value,
                quality: quality.as_str().to_string(),
                timestamp,
            };

            let _ = tx.send(update);
        });

        // All nodes use AbsoluteDeadband 0 (report every change).
        // EBR deduplication is applied client-side in flush_loop, so the OPC layer
        // is lossless and signals at low end of their EURange are not suppressed.
        let make_absolute_filter = || -> ExtensionObject {
            let dcf = DataChangeFilter {
                trigger: DataChangeTrigger::StatusValue,
                deadband_type: DeadbandType::None as u32,
                deadband_value: 0.0,
            };
            ExtensionObject::from_message(dcf)
        };

        let monitored_items: Vec<MonitoredItemCreateRequest> = chunk
            .iter()
            .map(|(node_id, _)| MonitoredItemCreateRequest {
                item_to_monitor: ReadValueId {
                    node_id: node_id.clone(),
                    attribute_id: AttributeId::Value as u32,
                    index_range: NumericRange::None,
                    data_encoding: QualifiedName::null(),
                },
                monitoring_mode: MonitoringMode::Reporting,
                requested_parameters: MonitoringParameters {
                    client_handle: 0,
                    sampling_interval: publishing_ms as f64,
                    filter: make_absolute_filter(),
                    queue_size: 1,
                    discard_oldest: true,
                },
            })
            .collect();

        let sub_id = session
            .create_subscription(
                Duration::from_millis(publishing_ms),
                10,
                10,
                1000,
                0u8,
                true,
                callback,
            )
            .await
            .map_err(|sc| anyhow::anyhow!("create_subscription failed: {}", sc))?;

        let item_results = session
            .create_monitored_items(sub_id, TimestampsToReturn::Both, monitored_items)
            .await
            .map_err(|sc| anyhow::anyhow!("create_monitored_items failed: {}", sc))?;

        // Count items with non-Good status codes and log them for diagnostics.
        let bad_items: Vec<String> = item_results
            .iter()
            .enumerate()
            .filter(|(_, r)| !r.result.status_code.is_good())
            .take(10)
            .map(|(i, r)| format!("[{}]={}", i, r.result.status_code))
            .collect();
        if !bad_items.is_empty() {
            warn!(
                source = %source.name,
                chunk = chunk_idx,
                bad_count = item_results.iter().filter(|r| !r.result.status_code.is_good()).count(),
                first_bad = %bad_items.join(", "),
                "Some monitored items returned non-Good status codes"
            );
        }

        // Log any items where the server revised the sampling interval significantly
        // above what we requested — these nodes will update less frequently than expected.
        let revised_slow: Vec<String> = chunk
            .iter()
            .zip(item_results.iter())
            .filter(|(_, r)| {
                r.result.status_code.is_good()
                    && r.result.revised_sampling_interval > (publishing_ms as f64 * 2.0)
            })
            .map(|((node_id, _), r)| {
                format!("{} → {:.0}ms", node_id, r.result.revised_sampling_interval)
            })
            .collect();
        if !revised_slow.is_empty() {
            warn!(
                source = %source.name,
                chunk = chunk_idx,
                count = revised_slow.len(),
                items = %revised_slow.join(", "),
                requested_ms = publishing_ms,
                "Server revised sampling interval above requested rate for some nodes"
            );
        }

        let chunk_good = item_results
            .iter()
            .filter(|r| r.result.status_code.is_good())
            .count();
        total_good += chunk_good;
        sub_ids.push(sub_id);

        info!(
            source = %source.name,
            chunk = chunk_idx,
            items = chunk.len(),
            good_items = chunk_good,
            sub_id,
            "Created OPC UA subscription"
        );
    }

    Ok((total_good, sub_ids))
}

// ---------------------------------------------------------------------------
// OPC UA Part 9 Alarms & Conditions event subscription
// ---------------------------------------------------------------------------

/// Attempt to subscribe to OPC UA A&C events from the Server node.
/// Non-fatal: any failure is logged and the data subscription continues normally.
/// Returns the JoinHandle of the background drain task so the caller can abort it
/// when the session ends, preventing stale tasks from accumulating across reconnects.
async fn create_event_subscription(
    source: &PointSource,
    db: &DbPool,
    session: &Arc<Session>,
    config: &Arc<Config>,
    // Maps point name strings (SourceName from OPC events) → point UUIDs.
    // Built from node_map: ns=1 string NodeId → strip quotes → point name.
    source_name_to_id: Arc<std::collections::HashMap<String, uuid::Uuid>>,
) -> Option<tokio::task::JoinHandle<()>> {
    // Step 1: Check EventNotifier bit 0 on Server node (ns=0;i=2253).
    let server_node_id = NodeId::new(0u16, 2253u32);

    let event_notifier_result = {
        let read_req = ReadValueId {
            node_id: server_node_id.clone(),
            attribute_id: 12, // EventNotifier
            index_range: NumericRange::None,
            data_encoding: QualifiedName::null(),
        };
        session
            .read(&[read_req], TimestampsToReturn::Neither, 0.0)
            .await
    };

    let subscribable = match event_notifier_result {
        Ok(dvs) => dvs
            .first()
            .and_then(|dv| dv.value.as_ref())
            .and_then(|v| {
                if let Variant::Byte(b) = v {
                    Some(*b)
                } else {
                    None
                }
            })
            .map(|b| b & 0x01 != 0)
            .unwrap_or(false),
        Err(sc) => {
            info!(
                source = %source.name,
                status = %sc,
                "EventNotifier read returned status code; skipping event subscription"
            );
            return None;
        }
    };

    if !subscribable {
        info!(
            source = %source.name,
            "Server node EventNotifier bit 0 not set; skipping A&C event subscription"
        );
        return None;
    }

    // Step 2 & 3: Build EventFilter and create the subscription.
    // We use an mpsc channel to bridge the OPC UA callback to async DB writes.
    let (event_tx, mut event_rx) = tokio::sync::mpsc::unbounded_channel::<db::OpcEvent>();

    let source_id = source.id;
    let source_name_for_log = source.name.clone();
    let publishing_ms = config.publishing_interval_ms;

    // Build select clauses — one SimpleAttributeOperand per event field.
    // type_definition_id = BaseEventType (ns=0;i=2041) for all fields.
    let base_event_type = NodeId::new(0u16, 2041u32);

    struct FieldDef {
        name: &'static str,
        attr_id: u32,
    }

    let fields: &[FieldDef] = &[
        FieldDef {
            name: "EventId",
            attr_id: 13,
        },
        FieldDef {
            name: "EventType",
            attr_id: 13,
        },
        FieldDef {
            name: "SourceName",
            attr_id: 13,
        },
        FieldDef {
            name: "Time",
            attr_id: 13,
        },
        FieldDef {
            name: "Severity",
            attr_id: 13,
        },
        FieldDef {
            name: "Message",
            attr_id: 13,
        },
        FieldDef {
            name: "ConditionName",
            attr_id: 13,
        },
        FieldDef {
            name: "AckedState/Id",
            attr_id: 13,
        },
        FieldDef {
            name: "ActiveState/Id",
            attr_id: 13,
        },
        FieldDef {
            name: "Retain",
            attr_id: 13,
        },
        // ExclusiveLimitAlarmType fields (SimBLAH A&C spec):
        FieldDef {
            name: "LimitState/CurrentState",
            attr_id: 13,
        }, // 10
        FieldDef {
            name: "SuppressedOrShelved",
            attr_id: 13,
        }, // 11
        FieldDef {
            name: "HighHighLimit",
            attr_id: 13,
        }, // 12
        FieldDef {
            name: "HighLimit",
            attr_id: 13,
        }, // 13
        FieldDef {
            name: "LowLimit",
            attr_id: 13,
        }, // 14
        FieldDef {
            name: "LowLowLimit",
            attr_id: 13,
        }, // 15
    ];

    use opcua::types::{ContentFilter, EventFilter, SimpleAttributeOperand};

    let select_clauses: Vec<SimpleAttributeOperand> = fields
        .iter()
        .map(|f| {
            // browse_path: single element with the field name (ns=0).
            let parts: Vec<QualifiedName> = f
                .name
                .split('/')
                .map(|p| QualifiedName::new(0, p))
                .collect();
            SimpleAttributeOperand {
                type_definition_id: base_event_type.clone(),
                browse_path: Some(parts),
                attribute_id: f.attr_id,
                index_range: NumericRange::None,
            }
        })
        .collect();

    let event_filter = EventFilter {
        select_clauses: Some(select_clauses),
        where_clause: ContentFilter { elements: None },
    };

    // Encode the EventFilter into an ExtensionObject for MonitoringParameters.filter.
    let filter_ext = ExtensionObject::from_message(event_filter);

    // Build the callback: extract fields and send to the async channel.
    // The new async-opcua EventCallback is per-event: called with Option<Vec<Variant>>
    // containing the fields in the same order as the select_clauses above.
    let tx = event_tx.clone();
    let src_name_cb = source_name_for_log.clone();
    let callback = EventCallback::new(
        move |event_fields: Option<Vec<Variant>>, _item: &MonitoredItem| {
            let fields_vec = match event_fields {
                Some(f) => f,
                None => return,
            };

            // Field order matches select_clauses above:
            // 0=EventId, 1=EventType, 2=SourceName, 3=Time, 4=Severity,
            // 5=Message, 6=ConditionName, 7=AckedState/Id, 8=ActiveState/Id, 9=Retain,
            // 10=LimitState/CurrentState, 11=SuppressedOrShelved,
            // 12=HighHighLimit, 13=HighLimit, 14=LowLimit, 15=LowLowLimit

            let get = |i: usize| fields_vec.get(i);

            let event_id = get(0).and_then(|v| {
                if let Variant::ByteString(bs) = v {
                    bs.value.as_ref().map(|b| {
                        b.iter()
                            .map(|byte| format!("{:02x}", byte))
                            .collect::<String>()
                    })
                } else {
                    None
                }
            });

            let event_type = get(1).and_then(|v| {
                if let Variant::NodeId(nid) = v {
                    Some(nid.to_string())
                } else {
                    None
                }
            });

            // Skip ConditionRefresh bracket events — these are OPC UA meta-events
            // that bracket a ConditionRefresh replay (RefreshStart/RefreshEnd) and
            // carry no alarm state of their own.
            // RefreshStart = ns=0;i=2787, RefreshEnd = ns=0;i=2788.
            if matches!(
                event_type.as_deref(),
                Some("ns=0;i=2787") | Some("ns=0;i=2788")
            ) {
                return;
            }

            let source_name = get(2).and_then(|v| {
                if let Variant::String(s) = v {
                    s.value().as_ref().map(|s| s.to_string())
                } else {
                    None
                }
            });

            let timestamp = get(3)
                .and_then(|v| {
                    if let Variant::DateTime(dt) = v {
                        Some(dt.as_chrono())
                    } else {
                        None
                    }
                })
                .unwrap_or_else(Utc::now);

            let severity = get(4).and_then(|v| {
                if let Variant::UInt16(s) = v {
                    Some(*s)
                } else {
                    None
                }
            });

            let message = get(5).and_then(|v| match v {
                Variant::LocalizedText(lt) => lt.text.value().as_ref().map(|s| s.to_string()),
                Variant::String(s) => s.value().as_ref().map(|s| s.to_string()),
                _ => None,
            });

            let condition_name = get(6).and_then(|v| {
                if let Variant::String(s) = v {
                    s.value().as_ref().map(|s| s.to_string())
                } else {
                    None
                }
            });

            let acked = get(7)
                .map(|v| matches!(v, Variant::Boolean(true)))
                .unwrap_or(false);

            let active = get(8)
                .map(|v| matches!(v, Variant::Boolean(true)))
                .unwrap_or(false);

            let retain = get(9)
                .map(|v| matches!(v, Variant::Boolean(true)))
                .unwrap_or(false);

            // LimitState/CurrentState — LocalizedText or String, e.g. "HighHigh"
            let limit_state = get(10).and_then(|v| match v {
                Variant::LocalizedText(lt) => lt.text.value().as_ref().map(|s| s.to_string()),
                Variant::String(s) => s.value().as_ref().map(|s| s.to_string()),
                _ => None,
            });

            let suppressed_or_shelved = get(11)
                .map(|v| matches!(v, Variant::Boolean(true)))
                .unwrap_or(false);

            let high_high_limit = get(12).and_then(|v| {
                if let Variant::Double(f) = v {
                    Some(*f)
                } else {
                    None
                }
            });
            let high_limit = get(13).and_then(|v| {
                if let Variant::Double(f) = v {
                    Some(*f)
                } else {
                    None
                }
            });
            let low_limit = get(14).and_then(|v| {
                if let Variant::Double(f) = v {
                    Some(*f)
                } else {
                    None
                }
            });
            let low_low_limit = get(15).and_then(|v| {
                if let Variant::Double(f) = v {
                    Some(*f)
                } else {
                    None
                }
            });

            // Resolve SourceName → point_id using the name→UUID map.
            let point_id = source_name
                .as_deref()
                .and_then(|name| source_name_to_id.get(name))
                .copied();

            let ev = db::OpcEvent {
                source_id,
                point_id,
                event_id,
                event_type,
                source_name,
                timestamp,
                severity,
                message: message.or_else(|| Some("(no message)".to_string())),
                condition_name,
                acked,
                active,
                retain,
                limit_state,
                suppressed_or_shelved,
                high_high_limit,
                high_limit,
                low_limit,
                low_low_limit,
            };

            if tx.send(ev).is_err() {
                // Channel closed — driver shutting down.
                tracing::debug!(source = %src_name_cb, "Event channel closed");
            }
        },
    );

    let sub_id = match session
        .create_subscription(
            Duration::from_millis(publishing_ms),
            10,
            10,
            1000,
            0u8,
            true,
            callback,
        )
        .await
    {
        Ok(id) => {
            info!(
                source = %source_name_for_log,
                sub_id = id,
                "OPC UA A&C event subscription created"
            );
            id
        }
        Err(e) => {
            warn!(source = %source_name_for_log, error = %e, "Failed to create A&C event subscription (non-fatal)");
            return None;
        }
    };

    // Monitor Server node (ns=0;i=2253) attribute 12 (EventNotifier) with the EventFilter.
    let server_nid = NodeId::new(0u16, 2253u32);
    let monitored = MonitoredItemCreateRequest {
        item_to_monitor: ReadValueId {
            node_id: server_nid,
            attribute_id: 12, // EventNotifier
            index_range: NumericRange::None,
            data_encoding: QualifiedName::null(),
        },
        monitoring_mode: MonitoringMode::Reporting,
        requested_parameters: MonitoringParameters {
            client_handle: 0,
            sampling_interval: 0.0, // as fast as possible
            filter: filter_ext,
            queue_size: 100,
            discard_oldest: true,
        },
    };

    if let Err(e) = session
        .create_monitored_items(sub_id, TimestampsToReturn::Both, vec![monitored])
        .await
    {
        warn!(source = %source_name_for_log, error = %e, "create_monitored_items (event) failed (non-fatal)");
        return None;
    }

    // Step 4: ConditionRefresh — request all currently active conditions.
    {
        let src_name = source_name_for_log.clone();
        let sub_id_variant = Variant::UInt32(sub_id);
        // Server node: ns=0;i=2253 (per OPC UA Part 9, ConditionRefresh is called on the Server node)
        // ConditionRefresh method: ns=0;i=3875
        let obj_id = NodeId::new(0u16, 2253u32);
        let method_id = NodeId::new(0u16, 3875u32);
        let args: Option<Vec<Variant>> = Some(vec![sub_id_variant]);
        match session.call_one((obj_id, method_id, args)).await {
            Ok(_) => {
                tracing::debug!(source = %src_name, "ConditionRefresh succeeded");
            }
            Err(sc) => {
                tracing::info!(
                    source = %src_name,
                    status = %sc,
                    "ConditionRefresh failed (non-fatal)"
                );
            }
        }
    }

    // Step 5: background task to drain event_rx and write to DB.
    // Return the JoinHandle so the caller can abort the task when the session ends,
    // preventing stale drain tasks from accumulating across reconnect cycles.
    let db_clone = db.clone();
    let src_name = source_name_for_log.clone();
    let event_handle = tokio::spawn(async move {
        // Collect batches of events and write them every 500ms or when 50 events accumulate.
        let mut batch: Vec<db::OpcEvent> = Vec::with_capacity(50);
        let mut next_flush = tokio::time::Instant::now() + std::time::Duration::from_millis(500);

        loop {
            tokio::select! {
                biased;

                maybe = event_rx.recv() => {
                    match maybe {
                        Some(ev) => {
                            batch.push(ev);
                            if batch.len() >= 50 {
                                if let Err(e) = db::write_opc_events(&db_clone, &batch).await {
                                    warn!(source = %src_name, error = %e, "Failed to write OPC events");
                                }
                                batch.clear();
                                next_flush = tokio::time::Instant::now() + std::time::Duration::from_millis(500);
                            }
                        }
                        None => {
                            // Channel closed — driver shutting down.
                            if !batch.is_empty() {
                                if let Err(e) = db::write_opc_events(&db_clone, &batch).await {
                                    warn!(source = %src_name, error = %e, "Failed to write final OPC events");
                                }
                            }
                            break;
                        }
                    }
                }

                _ = tokio::time::sleep_until(next_flush) => {
                    if !batch.is_empty() {
                        if let Err(e) = db::write_opc_events(&db_clone, &batch).await {
                            warn!(source = %src_name, error = %e, "Failed to write OPC events");
                        }
                        batch.clear();
                    }
                    next_flush = tokio::time::Instant::now() + std::time::Duration::from_millis(500);
                }
            }
        }
    });
    Some(event_handle)
}

// ---------------------------------------------------------------------------
// History recovery
// ---------------------------------------------------------------------------

/// Performs an OPC UA HistoricalRead for all nodes in `node_map` over the range
/// [from_time, to_time], writing results to `points_history_raw`.
/// Returns the total number of data-value rows recovered.
///
/// Uses server-side pagination (continuation points) so arbitrarily large ranges
/// are handled correctly even when the server limits results per request.
async fn harvest_history(
    _source: &PointSource,
    db: &DbPool,
    session: &Arc<Session>,
    node_map: &HashMap<NodeId, Uuid>,
    from_time: chrono::DateTime<Utc>,
    to_time: chrono::DateTime<Utc>,
) -> anyhow::Result<u64> {
    use opcua::types::DateTime as OpcDateTime;

    let node_ids: Vec<(NodeId, Uuid)> = node_map.iter().map(|(n, p)| (n.clone(), *p)).collect();

    // SimBLAH executes each node's query sequentially within a single HistoryRead
    // call, so per-request latency scales linearly with node count.  20 nodes is
    // the confirmed sweet spot (server-documented: 20–50 nodes reliable).
    const HISTORY_CHUNK: usize = 20;
    // async-opcua properly advertises the configured max_message_size in HEL.
    // With 327,675 bytes: 20 nodes × 100 values × ~30 bytes = 60,000 bytes per page.
    // Keep VALUES_PER_PAGE at 100 for a safe margin; continuation points page remaining values.
    const VALUES_PER_PAGE: u32 = 100;
    // Time slices limit total continuation-point pages per node-chunk.
    const TIME_SLICE_SECS: i64 = 3600; // 1 hour per node-chunk iteration

    let mut total_written: u64 = 0;

    let mut slice_start = from_time;
    while slice_start < to_time {
        let slice_end = (slice_start + chrono::Duration::seconds(TIME_SLICE_SECS)).min(to_time);

        for chunk in node_ids.chunks(HISTORY_CHUNK) {
            // Track continuation points per node (null = first request).
            let mut continuations: Vec<opcua::types::ByteString> =
                vec![opcua::types::ByteString::null(); chunk.len()];
            // Once a node has no more pages we remove it from subsequent requests.
            let mut active: Vec<bool> = vec![true; chunk.len()];

            loop {
                let nodes_to_read: Vec<HistoryReadValueId> = chunk
                    .iter()
                    .enumerate()
                    .filter(|(i, _)| active[*i])
                    .map(|(i, (nid, _))| HistoryReadValueId {
                        node_id: nid.clone(),
                        index_range: NumericRange::None,
                        data_encoding: QualifiedName::null(),
                        continuation_point: continuations[i].clone(),
                    })
                    .collect();

                if nodes_to_read.is_empty() {
                    break;
                }

                let details = ReadRawModifiedDetails {
                    is_read_modified: false,
                    start_time: OpcDateTime::from(slice_start),
                    end_time: OpcDateTime::from(slice_end),
                    num_values_per_node: VALUES_PER_PAGE,
                    // true = include bounding values just outside the requested range
                    // (Part 11 §6.4.2.1); ensures no gap at range boundaries.
                    return_bounds: true,
                };

                let results = session
                    .history_read(
                        HistoryReadAction::ReadRawModifiedDetails(details),
                        TimestampsToReturn::Source,
                        false,
                        &nodes_to_read,
                    )
                    .await
                    .map_err(|sc| anyhow::anyhow!("OPC UA history_read returned: {}", sc))?;

                let mut batch: Vec<crate::db::PointUpdate> = Vec::new();
                let mut any_continuation = false;

                // `results` is indexed over the ACTIVE nodes only — map back to chunk indices.
                let active_indices: Vec<usize> = (0..chunk.len()).filter(|i| active[*i]).collect();

                for (res_idx, result) in results.into_iter().enumerate() {
                    let chunk_idx = active_indices[res_idx];
                    let point_id = chunk[chunk_idx].1;

                    if !result.status_code.is_good() {
                        warn!(
                            point_id = %point_id,
                            status = %result.status_code,
                            "HistoryRead returned non-Good status for node — skipping"
                        );
                        active[chunk_idx] = false;
                        continue;
                    }

                    // Decode HistoryData from the ExtensionObject using inner_as.
                    let history_data = match result.history_data.inner_as::<HistoryData>() {
                        Some(hd) => hd,
                        None => {
                            warn!(point_id = %point_id, "Failed to decode HistoryData for node");
                            active[chunk_idx] = false;
                            continue;
                        }
                    };

                    if let Some(data_values) = &history_data.data_values {
                        for dv in data_values {
                            let (value, quality) = extract_value(dv);
                            let timestamp = dv
                                .source_timestamp
                                .as_ref()
                                .map(|dt| dt.as_chrono())
                                .or_else(|| dv.server_timestamp.as_ref().map(|dt| dt.as_chrono()))
                                .unwrap_or(slice_start);
                            batch.push(crate::db::PointUpdate {
                                point_id,
                                value,
                                quality: quality.as_str().to_string(),
                                timestamp,
                            });
                        }
                    }

                    // Update continuation point for next page.
                    if result.continuation_point.is_null() {
                        active[chunk_idx] = false;
                    } else {
                        continuations[chunk_idx] = result.continuation_point;
                        any_continuation = true;
                    }
                }

                if !batch.is_empty() {
                    db::write_history_batch(db, &batch).await?;
                    total_written += batch.len() as u64;
                } else {
                    debug!(
                        active_nodes = nodes_to_read.len(),
                        "HistoryRead page returned 0 data values"
                    );
                }

                if !any_continuation {
                    break;
                }
            }
        }

        debug!(
            from = %slice_start,
            to = %slice_end,
            "Time slice complete"
        );
        slice_start = slice_end;
    } // end while slice_start < to_time

    Ok(total_written)
}

/// Runs pending history recovery jobs for this source.
/// Called periodically from the data loop.  Picks up jobs in order and runs
/// them one at a time; each job is marked running → complete/failed atomically.
async fn run_pending_recovery_jobs(
    source: &PointSource,
    db: &DbPool,
    session: &Arc<Session>,
    node_map: &HashMap<NodeId, Uuid>,
) {
    let jobs = match db::get_pending_recovery_jobs(db, source.id).await {
        Ok(j) => j,
        Err(e) => {
            warn!(source = %source.name, error = %e, "Failed to fetch recovery jobs");
            return;
        }
    };

    for job in jobs {
        info!(
            source = %source.name,
            job_id = %job.id,
            from = %job.from_time,
            to = %job.to_time,
            "Starting history recovery job"
        );

        if let Err(e) = db::claim_recovery_job(db, job.id).await {
            warn!(source = %source.name, job_id = %job.id, error = %e, "Failed to claim recovery job");
            continue;
        }

        match harvest_history(source, db, session, node_map, job.from_time, job.to_time).await {
            Ok(n) => {
                info!(
                    source = %source.name,
                    job_id = %job.id,
                    rows = n,
                    "History recovery complete"
                );
                let _ = db::complete_recovery_job(db, job.id, n as i64).await;

                // Compress any fully-completed chunks that fall within this job's
                // window so disk space is reclaimed incrementally.
                match db::compress_completed_chunks(db, job.to_time).await {
                    Ok(0) => {}
                    Ok(n) => info!(
                        source = %source.name,
                        job_id = %job.id,
                        chunks = n,
                        "Compressed {} chunk(s) after history recovery",
                        n
                    ),
                    Err(e) => {
                        warn!(source = %source.name, job_id = %job.id, error = %e, "Chunk compression failed (non-fatal)")
                    }
                }

                // Refresh continuous aggregates so the recovered data becomes
                // visible immediately. The scheduled policies only cover a short
                // recent window and won't reach historical recovery dates.
                info!(
                    source = %source.name,
                    job_id = %job.id,
                    from = %job.from_time,
                    to = %job.to_time,
                    "Refreshing continuous aggregates for recovered range"
                );
                if let Err(e) =
                    db::refresh_aggregates_for_range(db, job.from_time, job.to_time).await
                {
                    warn!(source = %source.name, job_id = %job.id, error = %e, "Aggregate refresh failed (non-fatal)");
                }
            }
            Err(e) => {
                let err_str = e.to_string();
                // On BadResponseTooLarge, bisect the window and re-queue two smaller
                // jobs rather than giving up.  Minimum window is 60 seconds — below
                // that we just fail rather than splitting indefinitely.
                if err_str.contains("BadResponseTooLarge") {
                    let window = job.to_time - job.from_time;
                    if window > chrono::Duration::seconds(120) {
                        let mid = job.from_time + window / 2;
                        let r1 =
                            db::create_recovery_job(db, source.id, job.from_time, mid, None).await;
                        let r2 =
                            db::create_recovery_job(db, source.id, mid, job.to_time, None).await;
                        match (r1, r2) {
                            (Ok(id1), Ok(id2)) => {
                                warn!(
                                    source = %source.name,
                                    job_id = %job.id,
                                    sub_job_1 = %id1,
                                    sub_job_2 = %id2,
                                    "BadResponseTooLarge — window bisected into 2 sub-jobs"
                                );
                                let _ = db::fail_recovery_job(
                                    db,
                                    job.id,
                                    "BadResponseTooLarge — bisected into 2 sub-jobs",
                                )
                                .await;
                            }
                            _ => {
                                warn!(
                                    source = %source.name,
                                    job_id = %job.id,
                                    error = %err_str,
                                    "BadResponseTooLarge and could not create sub-jobs"
                                );
                                let _ = db::fail_recovery_job(db, job.id, &err_str).await;
                            }
                        }
                        // Compress any completed chunks within this window regardless of bisect outcome.
                        match db::compress_completed_chunks(db, job.to_time).await {
                            Ok(0) => {}
                            Ok(n) => {
                                info!(source = %source.name, job_id = %job.id, chunks = n, "Compressed {} chunk(s) after failed job", n)
                            }
                            Err(e) => {
                                warn!(source = %source.name, job_id = %job.id, error = %e, "Chunk compression failed (non-fatal)")
                            }
                        }
                    } else {
                        warn!(
                            source = %source.name,
                            job_id = %job.id,
                            error = %err_str,
                            "BadResponseTooLarge — window too small to bisect further"
                        );
                        let _ = db::fail_recovery_job(db, job.id, &err_str).await;
                        match db::compress_completed_chunks(db, job.to_time).await {
                            Ok(0) => {}
                            Ok(n) => {
                                info!(source = %source.name, job_id = %job.id, chunks = n, "Compressed {} chunk(s) after failed job", n)
                            }
                            Err(e) => {
                                warn!(source = %source.name, job_id = %job.id, error = %e, "Chunk compression failed (non-fatal)")
                            }
                        }
                    }
                } else {
                    warn!(
                        source = %source.name,
                        job_id = %job.id,
                        error = %e,
                        "History recovery failed"
                    );
                    let _ = db::fail_recovery_job(db, job.id, &err_str).await;
                    match db::compress_completed_chunks(db, job.to_time).await {
                        Ok(0) => {}
                        Ok(n) => {
                            info!(source = %source.name, job_id = %job.id, chunks = n, "Compressed {} chunk(s) after failed job", n)
                        }
                        Err(e) => {
                            warn!(source = %source.name, job_id = %job.id, error = %e, "Chunk compression failed (non-fatal)")
                        }
                    }
                }
            }
        }
    }
}

// ---------------------------------------------------------------------------
// Alarm event history recovery (OPC UA Part 11 — ReadEventDetails)
// ---------------------------------------------------------------------------

/// Recover historical alarm events from SimBLAH via OPC UA HistoryRead / ReadEventDetails.
///
/// Queries the Server node (ns=0;i=2253) — the OPC UA standard target for historical
/// event access.  Uses the same 10-field EventFilter as the live subscription but skips
/// the limit-value fields (HighHighLimit etc.) that SimBLAH does not populate in history.
///
/// Returns the number of events written.  A non-fatal error (BadServiceUnsupported,
/// server capability gap) is logged and treated as 0 events so startup continues.
pub async fn recover_alarm_event_history(
    source_id: Uuid,
    source_name: &str,
    db: &DbPool,
    session: Arc<Session>,
    source_name_to_id: Arc<HashMap<String, Uuid>>,
) -> usize {
    match recover_alarm_event_history_inner(source_id, source_name, db, session, source_name_to_id)
        .await
    {
        Ok(n) => n,
        Err(e) => {
            warn!(
                source = source_name,
                error = %e,
                "Alarm event history recovery failed (non-fatal)"
            );
            0
        }
    }
}

async fn recover_alarm_event_history_inner(
    source_id: Uuid,
    source_name: &str,
    db: &DbPool,
    session: Arc<Session>,
    source_name_to_id: Arc<HashMap<String, Uuid>>,
) -> anyhow::Result<usize> {
    use anyhow::Context as _;
    use opcua::types::{
        ContentFilter, DateTime as OpcDateTime, EventFilter, SimpleAttributeOperand,
    };

    // Watermark: most recent event in DB for this source, or 90 days ago.
    let watermark: chrono::DateTime<Utc> = sqlx::query_scalar(
        "SELECT MAX(timestamp) FROM events WHERE event_type = 'process_alarm' AND source = 'opc'",
    )
    .fetch_optional(db)
    .await
    .unwrap_or(None)
    .flatten()
    .unwrap_or_else(|| Utc::now() - chrono::Duration::days(90));

    let end_time = Utc::now();

    if watermark >= end_time - chrono::Duration::seconds(5) {
        debug!(
            source = source_name,
            "Alarm event history already up to date — skipping"
        );
        return Ok(0);
    }

    info!(
        source = source_name,
        from = %watermark,
        to = %end_time,
        "Starting alarm event history recovery"
    );

    // Build a 10-field EventFilter matching indices 0-9 of the live subscription.
    // SimBLAH historical records don't include per-limit fields (12-15) so we omit them.
    let field_names = [
        "EventId",        // 0
        "EventType",      // 1
        "SourceName",     // 2
        "Time",           // 3
        "Severity",       // 4
        "Message",        // 5
        "ConditionName",  // 6
        "AckedState/Id",  // 7
        "ActiveState/Id", // 8
        "Retain",         // 9
    ];

    let base_event_type = NodeId::new(0u16, 2041u32); // BaseEventType
    let select_clauses: Vec<SimpleAttributeOperand> = field_names
        .iter()
        .map(|name| {
            let parts: Vec<QualifiedName> =
                name.split('/').map(|p| QualifiedName::new(0, p)).collect();
            SimpleAttributeOperand {
                type_definition_id: base_event_type.clone(),
                browse_path: Some(parts),
                attribute_id: 13, // Value
                index_range: NumericRange::None,
            }
        })
        .collect();

    let event_filter = EventFilter {
        select_clauses: Some(select_clauses),
        where_clause: ContentFilter { elements: None },
    };

    let details = ReadEventDetails {
        num_values_per_node: 1000,
        start_time: OpcDateTime::from(watermark),
        end_time: OpcDateTime::from(end_time),
        filter: event_filter,
    };

    // Server node: ns=0;i=2253 — historical events are always queried globally.
    let server_node_id = NodeId::new(0u16, 2253u32);

    let mut continuation_point = opcua::types::ByteString::null();
    let mut total = 0usize;
    let mut page = 0u32;

    loop {
        page += 1;

        let node = HistoryReadValueId {
            node_id: server_node_id.clone(),
            index_range: NumericRange::None,
            data_encoding: QualifiedName::null(),
            continuation_point: continuation_point.clone(),
        };

        let results = session
            .history_read(
                HistoryReadAction::ReadEventDetails(details.clone()),
                TimestampsToReturn::Source,
                false,
                &[node],
            )
            .await
            .map_err(|sc| anyhow::anyhow!("HistoryRead(events) page {page}: {sc}"))?;

        let result = results
            .into_iter()
            .next()
            .context("HistoryRead(events): empty result list")?;

        if !result.status_code.is_good() {
            // BadHistoryOperationUnsupported or similar — server doesn't support event history.
            anyhow::bail!("HistoryRead(events) returned {}", result.status_code);
        }

        let history_event = match result.history_data.inner_as::<HistoryEvent>() {
            Some(he) => he,
            None => {
                warn!(
                    source = source_name,
                    page, "Failed to decode HistoryEvent — stopping"
                );
                break;
            }
        };

        let event_rows = history_event.events.as_deref().unwrap_or(&[]);
        let mut batch: Vec<db::OpcEvent> = Vec::with_capacity(event_rows.len());

        for row in event_rows {
            let fields = row.event_fields.as_deref().unwrap_or(&[]);
            let get = |i: usize| fields.get(i);

            // Skip ConditionRefresh bracket events (shouldn't appear in history but be safe).
            let event_type = get(1).and_then(|v| {
                if let Variant::NodeId(nid) = v {
                    Some(nid.to_string())
                } else {
                    None
                }
            });
            if matches!(
                event_type.as_deref(),
                Some("ns=0;i=2787") | Some("ns=0;i=2788")
            ) {
                continue;
            }

            let event_id = get(0).and_then(|v| {
                if let Variant::ByteString(bs) = v {
                    bs.value.as_ref().map(|b| {
                        b.iter()
                            .map(|byte| format!("{:02x}", byte))
                            .collect::<String>()
                    })
                } else {
                    None
                }
            });

            let source_name_field = get(2).and_then(|v| {
                if let Variant::String(s) = v {
                    s.value().as_ref().map(|s| s.to_string())
                } else {
                    None
                }
            });

            let timestamp = get(3)
                .and_then(|v| {
                    if let Variant::DateTime(dt) = v {
                        Some(dt.as_chrono())
                    } else {
                        None
                    }
                })
                .unwrap_or_else(Utc::now);

            let severity = get(4).and_then(|v| {
                if let Variant::UInt16(s) = v {
                    Some(*s)
                } else {
                    None
                }
            });

            let message = get(5).and_then(|v| match v {
                Variant::LocalizedText(lt) => lt.text.value().as_ref().map(|s| s.to_string()),
                Variant::String(s) => s.value().as_ref().map(|s| s.to_string()),
                _ => None,
            });

            let condition_name = get(6).and_then(|v| {
                if let Variant::String(s) = v {
                    s.value().as_ref().map(|s| s.to_string())
                } else {
                    None
                }
            });

            let acked = get(7)
                .map(|v| matches!(v, Variant::Boolean(true)))
                .unwrap_or(false);

            let active = get(8)
                .map(|v| matches!(v, Variant::Boolean(true)))
                .unwrap_or(false);

            let retain = get(9)
                .map(|v| matches!(v, Variant::Boolean(true)))
                .unwrap_or(false);

            let point_id = source_name_field
                .as_deref()
                .and_then(|name| source_name_to_id.get(name))
                .copied();

            batch.push(db::OpcEvent {
                source_id,
                point_id,
                event_id,
                event_type,
                source_name: source_name_field,
                timestamp,
                severity,
                message: message.or_else(|| Some("(no message)".to_string())),
                condition_name,
                acked,
                active,
                retain,
                limit_state: None,
                suppressed_or_shelved: false,
                high_high_limit: None,
                high_limit: None,
                low_limit: None,
                low_low_limit: None,
            });
        }

        let batch_len = batch.len();
        if batch_len > 0 {
            db::write_opc_events(db, &batch)
                .await
                .context("write_opc_events during history recovery")?;
            total += batch_len;
        }

        debug!(
            source = source_name,
            page,
            batch = batch_len,
            total,
            "Alarm event history page"
        );

        continuation_point = result.continuation_point;
        if continuation_point.is_null() {
            break;
        }
    }

    info!(
        source = source_name,
        total,
        pages = page,
        "Alarm event history recovery complete"
    );

    Ok(total)
}

// ---------------------------------------------------------------------------
// Polling loop (fallback when subscriptions are unsupported)
// ---------------------------------------------------------------------------

/// Fallback data collection when `CreateMonitoredItems` returns `BadServiceUnsupported`
/// for all items.  Periodically reads all nodes via OPC UA Read and pushes the results
/// through the normal flush path.  Exits when the OPC UA session dies.
async fn poll_loop(
    source: &PointSource,
    db: &DbPool,
    uds: &Arc<UdsSender>,
    config: &Arc<Config>,
    session: &Arc<Session>,
    node_map: &HashMap<NodeId, Uuid>,
) {
    let poll_interval = Duration::from_millis(config.publishing_interval_ms);
    let node_ids: Vec<(NodeId, Uuid)> = node_map.iter().map(|(n, p)| (n.clone(), *p)).collect();
    let mut total_polls: u64 = 0;

    info!(
        source = %source.name,
        points = node_ids.len(),
        interval_ms = config.publishing_interval_ms,
        "Polling mode active — reading all nodes periodically"
    );

    loop {
        tokio::time::sleep(poll_interval).await;

        let mut pending: Vec<PointUpdate> = Vec::new();
        let now = Utc::now();

        for chunk in node_ids.chunks(500) {
            let read_ids: Vec<ReadValueId> = chunk
                .iter()
                .map(|(nid, _)| ReadValueId {
                    node_id: nid.clone(),
                    attribute_id: AttributeId::Value as u32,
                    index_range: NumericRange::None,
                    data_encoding: QualifiedName::null(),
                })
                .collect();

            match session.read(&read_ids, TimestampsToReturn::Both, 0.0).await {
                Ok(data_values) => {
                    for (i, dv) in data_values.iter().enumerate() {
                        if let Some((_, point_id)) = chunk.get(i) {
                            if dv.status.as_ref().is_none_or(|s| s.is_good()) {
                                let (value, quality) = extract_value(dv);
                                let timestamp = dv
                                    .source_timestamp
                                    .as_ref()
                                    .map(|dt| dt.as_chrono())
                                    .or_else(|| {
                                        dv.server_timestamp.as_ref().map(|dt| dt.as_chrono())
                                    })
                                    .unwrap_or(now);
                                pending.push(PointUpdate {
                                    point_id: *point_id,
                                    value,
                                    quality: quality.as_str().to_string(),
                                    timestamp,
                                });
                            }
                        }
                    }
                }
                Err(sc) => {
                    warn!(source = %source.name, status = %sc, "Poll read failed — session may have dropped");
                    return; // Trigger reconnect
                }
            }
        }

        total_polls += 1;
        if !pending.is_empty() {
            if total_polls == 1 {
                info!(source = %source.name, points = pending.len(), "First poll read succeeded — data flowing");
            }
            flush(source, db, uds, &mut pending).await;
        } else if total_polls.is_multiple_of(10) {
            warn!(source = %source.name, "Poll returned 0 good values — nodes may be offline or unsupported");
        }

        // Check for pending history recovery jobs every 60 polls (background task).
        if total_polls % 60 == 1 {
            let src = source.clone();
            let db2 = db.clone();
            let sess = session.clone();
            let nm: HashMap<NodeId, Uuid> = node_map.clone();
            tokio::spawn(async move {
                run_pending_recovery_jobs(&src, &db2, &sess, &nm).await;
            });
        }
    }
}

// ---------------------------------------------------------------------------
// Periodic namespace rediscovery
// ---------------------------------------------------------------------------

/// Compute a `tokio::time::Instant` corresponding to the next 03:00 UTC wall-clock time.
fn next_3am_instant() -> tokio::time::Instant {
    let now = chrono::Utc::now();
    let today_3am = now.date_naive().and_hms_opt(3, 0, 0).unwrap().and_utc();
    let next_3am = if now < today_3am {
        today_3am
    } else {
        today_3am + chrono::Duration::days(1)
    };
    let secs = (next_3am - now).num_seconds().max(0) as u64;
    tokio::time::Instant::now() + std::time::Duration::from_secs(secs)
}

/// Discover new nodes that are not yet in `node_map`, upsert them, and create a
/// new OPC UA subscription for them.  Returns the count of newly discovered nodes.
async fn incremental_rediscovery(
    source: &PointSource,
    db: &DbPool,
    session: &Arc<Session>,
    config: &Arc<Config>,
    node_map: &mut HashMap<NodeId, Uuid>,
    update_tx: &mpsc::UnboundedSender<PointUpdate>,
) -> anyhow::Result<usize> {
    let discovered = browse_namespace_nodes_only(source, session).await?;

    // Filter to nodes not already in node_map.
    let new_nodes: Vec<DiscoveredNode> = discovered
        .into_iter()
        .filter(|n| !node_map.contains_key(&n.node_id))
        .collect();

    if new_nodes.is_empty() {
        return Ok(0);
    }

    // Upsert each new node into points_metadata and track in node_map.
    let mut new_analog_nodes: HashSet<NodeId> = HashSet::new();
    let mut new_node_map: HashMap<NodeId, Uuid> = HashMap::new();

    for node in &new_nodes {
        let metadata = serde_json::json!({
            "node_id": node.node_id.to_string(),
            "display_name": node.tagname,
        });
        match db::upsert_point_from_source(db, source.id, &node.tagname, node.data_type, metadata)
            .await
        {
            Ok(point_id) => {
                if node.data_type == "Double" {
                    new_analog_nodes.insert(node.node_id.clone());
                }
                new_node_map.insert(node.node_id.clone(), point_id);
                node_map.insert(node.node_id.clone(), point_id);
            }
            Err(e) => {
                warn!(
                    source = %source.name,
                    tag = %node.tagname,
                    error = %e,
                    "Incremental rediscovery: failed to upsert point"
                );
            }
        }
    }

    if new_node_map.is_empty() {
        return Ok(0);
    }

    // Harvest analog metadata for new analog nodes (writes to DB; return discarded).
    harvest_analog_metadata(source, db, session, &new_node_map, &new_analog_nodes).await;

    // Create a new OPC UA subscription for the new nodes only.
    match create_subscriptions(source, session, &new_node_map, update_tx.clone(), config).await {
        Ok((good, _sub_ids)) => {
            info!(
                source = %source.name,
                new_nodes = new_node_map.len(),
                subscribed = good,
                "Incremental rediscovery: subscribed new nodes"
            );
            // TODO: newly discovered nodes won't resolve in the event subscription
            // until the next reconnect (the Arc<HashMap> source_name_to_id is frozen).
        }
        Err(e) => {
            warn!(
                source = %source.name,
                error = %e,
                "Incremental rediscovery: failed to create subscription for new nodes"
            );
        }
    }

    Ok(new_node_map.len())
}

/// Full nightly rediscovery: deactivate removed nodes, touch last_seen_at for
/// surviving ones, then run incremental logic for any newly appeared nodes.
/// Returns `(new_count, deactivated_count)`.
async fn nightly_full_rediscovery(
    source: &PointSource,
    db: &DbPool,
    session: &Arc<Session>,
    config: &Arc<Config>,
    node_map: &mut HashMap<NodeId, Uuid>,
    update_tx: &mpsc::UnboundedSender<PointUpdate>,
) -> anyhow::Result<(usize, u64)> {
    let discovered = browse_namespace_nodes_only(source, session).await?;

    let discovered_tagnames: Vec<String> = discovered.iter().map(|n| n.tagname.clone()).collect();

    // Deactivate points that no longer appear in the server's address space.
    let deactivated = db::deactivate_removed_points(db, source.id, &discovered_tagnames).await?;

    // Build a set of discovered NodeIds for efficient retain.
    let discovered_node_ids: HashSet<NodeId> =
        discovered.iter().map(|n| n.node_id.clone()).collect();

    // Remove deactivated entries from the in-memory node_map.
    node_map.retain(|node_id, _| discovered_node_ids.contains(node_id));

    // Refresh last_seen_at for all nodes still present.
    if let Err(e) = db::touch_last_seen_at(db, source.id, &discovered_tagnames).await {
        warn!(source = %source.name, error = %e, "Nightly rediscovery: touch_last_seen_at failed (non-fatal)");
    }

    // Run incremental logic for any nodes that appeared since last connect/rediscovery.
    // Pass discovered back as a new browse to avoid a second server round-trip — reuse
    // the already-collected set by filtering against node_map inside incremental_rediscovery.
    let new_count =
        incremental_rediscovery(source, db, session, config, node_map, update_tx)
            .await
            .unwrap_or_else(|e| {
                warn!(source = %source.name, error = %e, "Nightly rediscovery: incremental phase failed (non-fatal)");
                0
            });

    Ok((new_count, deactivated))
}

// ---------------------------------------------------------------------------
// Flush loop
// ---------------------------------------------------------------------------

/// Returns `true` if the loop exited because the watchdog fired (no updates for
/// 5 minutes), `false` if the session's update channel closed normally.
#[allow(clippy::too_many_arguments)]
async fn flush_loop(
    source: &PointSource,
    db: &DbPool,
    uds: &Arc<UdsSender>,
    config: &Arc<Config>,
    session: &Arc<Session>,
    node_map: &mut HashMap<NodeId, Uuid>,
    update_tx: mpsc::UnboundedSender<PointUpdate>,
    mut update_rx: mpsc::UnboundedReceiver<PointUpdate>,
) -> bool {
    const WATCHDOG_DURATION: Duration = Duration::from_secs(300); // 5 minutes

    let interval = Duration::from_millis(config.batch_interval_ms);
    // All updates — used for points_current writes and UDS (live display must always
    // show the latest value, even for stable signals that EBR would suppress in history).
    let mut pending_all: Vec<PointUpdate> = Vec::with_capacity(config.batch_max_points);
    // EBR-filtered updates — written to points_history_raw only.
    let mut pending_history: Vec<PointUpdate> = Vec::with_capacity(config.batch_max_points);
    let mut next_flush = Instant::now() + interval;
    let mut heartbeat = tokio::time::Instant::now();
    let heartbeat_interval = Duration::from_secs(30);
    let mut job_check = tokio::time::Instant::now();
    let job_check_interval = Duration::from_secs(60);
    let mut total_updates: u64 = 0;
    let mut last_update_time = tokio::time::Instant::now();
    // Recovery jobs run in a background task so they don't block live DataChange callbacks.
    let mut recovery_task: Option<tokio::task::JoinHandle<()>> = None;

    // EBR filter — lossless historian deduplication applied only to history writes.
    let mut ebr = EbrFilter::new(config.ebr_heartbeat_secs);

    // Rediscovery timers.
    let rediscovery_enabled = config.rediscovery_interval_secs > 0;
    let rediscovery_interval = Duration::from_secs(config.rediscovery_interval_secs.max(1));
    let mut next_rediscovery = tokio::time::Instant::now() + rediscovery_interval;

    let nightly_enabled = config.nightly_cleanup_enabled;
    let mut next_nightly = next_3am_instant();

    loop {
        tokio::select! {
            biased;

            maybe = update_rx.recv() => {
                match maybe {
                    Some(update) => {
                        total_updates += 1;
                        last_update_time = tokio::time::Instant::now();
                        metrics::counter!("io_opc_updates_received_total").increment(1);
                        if total_updates == 1 {
                            info!(source = %source.name, "First DataChange callback received!");
                        }
                        // All updates go to current/UDS for live display.
                        pending_all.push(update.clone());
                        // EBR-filtered updates go to history.
                        let ebr_out = ebr.process(&update);
                        pending_history.extend(ebr_out);
                        if pending_all.len() >= config.batch_max_points {
                            flush_split(source, db, uds, &mut pending_all, &mut pending_history).await;
                            next_flush = Instant::now() + interval;
                        }
                    }
                    None => {
                        // Channel closed — session ended normally.
                        if !pending_all.is_empty() || !pending_history.is_empty() {
                            flush_split(source, db, uds, &mut pending_all, &mut pending_history).await;
                        }
                        return false;
                    }
                }
            }

            _ = tokio::time::sleep_until(next_flush) => {
                // Heartbeat flush: write any stable EBR-pending values that are
                // older than ebr_heartbeat_secs so the DB has regular timestamps.
                let hb = ebr.heartbeat_flush(Utc::now());
                pending_history.extend(hb);

                if !pending_all.is_empty() || !pending_history.is_empty() {
                    flush_split(source, db, uds, &mut pending_all, &mut pending_history).await;
                }
                next_flush = Instant::now() + interval;

                // Heartbeat: log every 30s if no data is arriving
                if heartbeat.elapsed() >= heartbeat_interval {
                    if total_updates == 0 {
                        warn!(source = %source.name, "No OPC UA DataChange callbacks received in 30s — subscriptions may not be delivering data");
                    }
                    heartbeat = tokio::time::Instant::now();
                }

                // Watchdog: force reconnect if no updates for 5 minutes
                if last_update_time.elapsed() >= WATCHDOG_DURATION {
                    warn!(
                        source = %source.name,
                        elapsed_secs = last_update_time.elapsed().as_secs(),
                        "Watchdog: no point updates received — forcing reconnect and scheduling history recovery"
                    );
                    return true;
                }

                // Spawn recovery jobs in a background task so live data keeps flowing.
                if job_check.elapsed() >= job_check_interval {
                    let task_done = recovery_task.as_ref().is_none_or(|h| h.is_finished());
                    if task_done {
                        let src = source.clone();
                        let db2 = db.clone();
                        let sess = session.clone();
                        let nm: HashMap<NodeId, Uuid> = node_map.clone();
                        recovery_task = Some(tokio::spawn(async move {
                            run_pending_recovery_jobs(&src, &db2, &sess, &nm).await;
                        }));
                    }
                    job_check = tokio::time::Instant::now();
                }

                // Incremental rediscovery: find and subscribe to new nodes.
                if rediscovery_enabled
                    && tokio::time::Instant::now() >= next_rediscovery
                {
                    match incremental_rediscovery(
                        source, db, session, config, node_map, &update_tx,
                    )
                    .await
                    {
                        Ok(0) => debug!(source = %source.name, "Incremental rediscovery: no new nodes"),
                        Ok(n) => info!(source = %source.name, new_nodes = n, "Incremental rediscovery complete"),
                        Err(e) => warn!(source = %source.name, error = %e, "Incremental rediscovery failed"),
                    }
                    next_rediscovery = tokio::time::Instant::now() + rediscovery_interval;
                }

                // Nightly full rediscovery: deactivate removed nodes at 03:00 UTC.
                if nightly_enabled && tokio::time::Instant::now() >= next_nightly {
                    match nightly_full_rediscovery(
                        source, db, session, config, node_map, &update_tx,
                    )
                    .await
                    {
                        Ok((new, deactivated)) => info!(
                            source = %source.name,
                            new_nodes = new,
                            deactivated,
                            "Nightly full rediscovery complete"
                        ),
                        Err(e) => warn!(source = %source.name, error = %e, "Nightly full rediscovery failed"),
                    }
                    next_nightly = next_3am_instant();
                }
            }
        }
    }
}

/// Flush accumulated updates to DB and UDS.
///
/// `all` — all received updates, written to `points_current` and forwarded via UDS for live
///         display. Must always reflect the latest value regardless of EBR filtering.
/// `history` — EBR-filtered subset, written to `points_history_raw` only.
async fn flush_split(
    source: &PointSource,
    db: &DbPool,
    uds: &Arc<UdsSender>,
    all: &mut Vec<PointUpdate>,
    history: &mut Vec<PointUpdate>,
) {
    if all.is_empty() && history.is_empty() {
        return;
    }

    let batch_all = std::mem::take(all);
    let batch_history = std::mem::take(history);

    // Write latest values to points_current (all updates — unfiltered).
    if !batch_all.is_empty() {
        if let Err(e) = db::write_points_current(db, &batch_all).await {
            warn!(source = %source.name, error = %format!("{:#}", e), "Failed to write points_current");
        }
    }

    // Write EBR-filtered values to history.
    if !batch_history.is_empty() {
        if let Err(e) = db::write_history_batch(db, &batch_history).await {
            warn!(source = %source.name, error = %e, "Failed to write points_history_raw");
        }
    }

    // Forward all updates to Data Broker via UDS for live display.
    if !batch_all.is_empty() {
        let uds_points: Vec<UdsPointUpdate> = batch_all
            .iter()
            .map(|u| UdsPointUpdate {
                point_id: u.point_id,
                value: u.value,
                quality: str_to_quality(&u.quality),
                timestamp: u.timestamp.timestamp_millis(),
            })
            .collect();

        let uds_batch = UdsPointBatch {
            source_id: source.id,
            points: uds_points,
        };

        if let Err(e) = uds.send_batch(&uds_batch).await {
            warn!(
                source = %source.name,
                error = %e,
                "UDS send failed; falling back to NOTIFY"
            );
            if let Err(ne) = db::notify_broker(db, source.id, &batch_all).await {
                warn!(
                    source = %source.name,
                    error = %ne,
                    "NOTIFY fallback also failed"
                );
            }
        }
    }
}

/// Legacy flush wrapper used by poll_loop — no EBR applied (polling mode is
/// already low-frequency; EBR would suppress the first value of each poll cycle).
async fn flush(
    source: &PointSource,
    db: &DbPool,
    uds: &Arc<UdsSender>,
    pending: &mut Vec<PointUpdate>,
) {
    if pending.is_empty() {
        return;
    }
    let batch = std::mem::take(pending);

    // Write to DB (current + history — no EBR in polling mode).
    if let Err(e) = db::write_points_current(db, &batch).await {
        warn!(source = %source.name, error = %format!("{:#}", e), "Failed to write points_current");
    }
    if let Err(e) = db::write_history_batch(db, &batch).await {
        warn!(source = %source.name, error = %e, "Failed to write points_history_raw");
    }

    // Build UDS batch and send to Data Broker.
    let uds_points: Vec<UdsPointUpdate> = batch
        .iter()
        .map(|u| UdsPointUpdate {
            point_id: u.point_id,
            value: u.value,
            quality: str_to_quality(&u.quality),
            timestamp: u.timestamp.timestamp_millis(),
        })
        .collect();

    let uds_batch = UdsPointBatch {
        source_id: source.id,
        points: uds_points,
    };

    if let Err(e) = uds.send_batch(&uds_batch).await {
        warn!(
            source = %source.name,
            error = %e,
            "UDS send failed; falling back to NOTIFY"
        );
        if let Err(ne) = db::notify_broker(db, source.id, &batch).await {
            warn!(
                source = %source.name,
                error = %ne,
                "NOTIFY fallback also failed"
            );
        }
    }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

fn build_security(
    policy: &str,
    mode: &str,
    username: Option<String>,
    password: Option<String>,
) -> (SecurityPolicy, MessageSecurityMode, IdentityToken) {
    // Support deprecated policies (Basic128Rsa15, Basic256) for legacy DCS compatibility.
    // These are deprecated in OPC UA 1.04 but remain the majority of the installed OT base.
    // Doc 17 mandates we support them and log a warning rather than refusing the connection.
    let security_policy = match policy {
        "Basic256Sha256" => SecurityPolicy::Basic256Sha256,
        "Aes128Sha256RsaOaep" => SecurityPolicy::Aes128Sha256RsaOaep,
        "Aes256Sha256RsaPss" => SecurityPolicy::Aes256Sha256RsaPss,
        "Basic256" => SecurityPolicy::Basic256,
        "Basic128Rsa15" => SecurityPolicy::Basic128Rsa15,
        _ => SecurityPolicy::None,
    };

    let security_mode = match mode {
        "Sign" => MessageSecurityMode::Sign,
        "SignAndEncrypt" => MessageSecurityMode::SignAndEncrypt,
        _ => MessageSecurityMode::None,
    };

    let identity = if let (Some(user), Some(pass)) = (username, password) {
        IdentityToken::UserName(user, pass.into())
    } else {
        IdentityToken::Anonymous
    };

    (security_policy, security_mode, identity)
}

/// Extract (f64, PointQuality) from a DataValue.
///
/// NaN and infinity are mapped to (0.0, Bad) per doc 37.
fn extract_value(dv: &DataValue) -> (f64, PointQuality) {
    let quality = status_to_quality(dv.status.as_ref());

    let value = dv.value.as_ref().and_then(variant_to_f64).unwrap_or(0.0);

    // NaN/infinity → 0.0 with Bad quality.
    if value.is_nan() || value.is_infinite() {
        return (0.0, PointQuality::Bad);
    }

    (value, quality)
}

fn status_to_quality(status: Option<&StatusCode>) -> PointQuality {
    match status {
        None => PointQuality::Good,
        Some(sc) => {
            if sc.is_good() {
                PointQuality::Good
            } else if sc.is_uncertain() {
                PointQuality::Uncertain
            } else {
                PointQuality::Bad
            }
        }
    }
}

fn variant_to_f64(v: &Variant) -> Option<f64> {
    match v {
        Variant::Double(f) => Some(*f),
        Variant::Float(f) => Some(*f as f64),
        Variant::Int64(i) => Some(*i as f64),
        Variant::UInt64(i) => Some(*i as f64),
        Variant::Int32(i) => Some(*i as f64),
        Variant::UInt32(i) => Some(*i as f64),
        Variant::Int16(i) => Some(*i as f64),
        Variant::UInt16(i) => Some(*i as f64),
        Variant::SByte(i) => Some(*i as f64),
        Variant::Byte(i) => Some(*i as f64),
        Variant::Boolean(b) => Some(if *b { 1.0 } else { 0.0 }),
        // String values (MultiStateDiscreteType) — try numeric parse first, then give up.
        // Proper enum-to-index mapping requires schema support; this preserves numeric strings.
        Variant::String(s) => s.value().as_deref().and_then(|s| s.parse::<f64>().ok()),
        _ => None,
    }
}

fn str_to_quality(s: &str) -> PointQuality {
    match s {
        "good" => PointQuality::Good,
        "uncertain" => PointQuality::Uncertain,
        _ => PointQuality::Bad,
    }
}

// ---------------------------------------------------------------------------
// OPC UA server certificate registration
// ---------------------------------------------------------------------------

/// After a successful connection, scan the PKI trust dirs for DER cert files
/// belonging to this source and upsert them into the opc_server_certs table.
///
/// We scan both `trusted/certs/` (auto-trusted or admin-approved) and
/// `rejected/certs/` (pending admin approval when auto_trust=false).
async fn register_server_cert(source: &PointSource, db: &DbPool, config: &Arc<Config>) {
    use sha2::{Digest, Sha256};

    let pki_dir = std::path::Path::new(&config.pki_dir);
    let auto_trust = config.auto_trust_server_certs;

    // Scan trusted and rejected dirs.
    // The opcua library writes server certs directly to pki/trusted/ and pki/rejected/
    // (not a certs/ subdirectory), so we look there.
    let dirs: &[(&str, &str)] = &[("trusted", "trusted"), ("rejected", "pending")];

    for (subdir, initial_status) in dirs {
        let cert_dir = pki_dir.join(subdir);
        let entries = match std::fs::read_dir(&cert_dir) {
            Ok(e) => e,
            Err(_) => continue,
        };

        for entry in entries.flatten() {
            let path = entry.path();
            if path.extension().and_then(|e| e.to_str()) != Some("der") {
                continue;
            }

            let der_bytes = match std::fs::read(&path) {
                Ok(b) => b,
                Err(e) => {
                    warn!(path = %path.display(), error = %e, "register_server_cert: failed to read cert file");
                    continue;
                }
            };

            // Compute SHA-256 fingerprint
            let mut hasher = Sha256::new();
            hasher.update(&der_bytes);
            let fingerprint = format!("{:x}", hasher.finalize());

            // Parse cert for human-readable fields
            let (subject, issuer, not_before, not_after) = parse_der_cert_fields(&der_bytes);

            let status = if auto_trust && *subdir == "trusted" {
                "trusted"
            } else {
                initial_status
            };

            // Upsert: update last_seen_at and status if already exists
            let result = sqlx::query(
                "INSERT INTO opc_server_certs \
                 (source_id, source_name, fingerprint, subject, issuer, \
                  not_before, not_after, cert_der, status, auto_trusted, first_seen_at, last_seen_at) \
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, now(), now()) \
                 ON CONFLICT (fingerprint) DO UPDATE SET \
                   last_seen_at = now(), \
                   source_id = EXCLUDED.source_id, \
                   source_name = EXCLUDED.source_name",
            )
            .bind(source.id)
            .bind(&source.name)
            .bind(&fingerprint)
            .bind(&subject)
            .bind(&issuer)
            .bind(not_before)
            .bind(not_after)
            .bind(&der_bytes)
            .bind(status)
            .bind(auto_trust && *subdir == "trusted")
            .execute(db)
            .await;

            match result {
                Ok(_) => info!(
                    source = %source.name,
                    fingerprint = %&fingerprint[..16],
                    status,
                    "register_server_cert: upserted OPC server cert"
                ),
                Err(e) => warn!(
                    error = %e,
                    source = %source.name,
                    "register_server_cert: DB upsert failed (non-fatal)"
                ),
            }
        }
    }
}

// ---------------------------------------------------------------------------
// URL helpers
// ---------------------------------------------------------------------------

/// Rewrite the hostname (and port) portion of `server_url` to match the
/// hostname and port in `client_url`, preserving the server's path.
///
/// This handles the common OPC UA scenario where a server advertises its
/// endpoints using an internal address (e.g. `opc.tcp://127.0.0.1:4840/UA/App`)
/// while the client reaches it via a different DNS name or IP.
fn rewrite_hostname(server_url: &str, client_url: &str) -> String {
    // Extract authority (host[:port]) from client_url.
    let client_authority = if let Some(rest) = client_url.strip_prefix("opc.tcp://") {
        // authority = everything up to the first '/'
        match rest.find('/') {
            Some(i) => &rest[..i],
            None => rest,
        }
    } else {
        return server_url.to_string();
    };

    // Replace the authority in server_url.
    if let Some(rest) = server_url.strip_prefix("opc.tcp://") {
        let path_start = rest.find('/').unwrap_or(rest.len());
        let server_path = &rest[path_start..];
        format!("opc.tcp://{}{}", client_authority, server_path)
    } else {
        server_url.to_string()
    }
}

/// (subject, issuer, not_before, not_after)
type CertFields = (
    Option<String>,
    Option<String>,
    Option<chrono::DateTime<chrono::Utc>>,
    Option<chrono::DateTime<chrono::Utc>>,
);

/// Parse DER-encoded X.509 cert to extract subject, issuer, and validity period.
/// Returns empty strings / None on parse failure.
fn parse_der_cert_fields(der: &[u8]) -> CertFields {
    use chrono::{TimeZone, Utc};
    use x509_parser::prelude::*;

    let Ok((_, cert)) = X509Certificate::from_der(der) else {
        return (None, None, None, None);
    };

    let subject = Some(cert.subject().to_string());
    let issuer = Some(cert.issuer().to_string());

    let not_before = Utc
        .timestamp_opt(cert.validity().not_before.timestamp(), 0)
        .single();
    let not_after = Utc
        .timestamp_opt(cert.validity().not_after.timestamp(), 0)
        .single();

    (subject, issuer, not_before, not_after)
}

// ---------------------------------------------------------------------------
// Reconnect backoff — pure helper (extracted for testability)
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    // --- next_backoff pure helper (mirrors the backoff_secs doubling in run_source) ---

    fn next_backoff(current_secs: u64, max_secs: u64) -> u64 {
        (current_secs * 2).min(max_secs)
    }

    // --- variant_to_f64 ---

    #[test]
    fn variant_double_converts_to_f64() {
        assert!((variant_to_f64(&Variant::Double(1.5)).unwrap() - 1.5).abs() < f64::EPSILON);
    }

    #[test]
    fn variant_float_converts_to_f64() {
        let v = variant_to_f64(&Variant::Float(1.0_f32)).unwrap();
        assert!((v - 1.0).abs() < 1e-6);
    }

    #[test]
    fn variant_int32_converts_to_f64() {
        assert_eq!(variant_to_f64(&Variant::Int32(-7)).unwrap(), -7.0);
    }

    #[test]
    fn variant_uint32_converts_to_f64() {
        assert_eq!(variant_to_f64(&Variant::UInt32(42)).unwrap(), 42.0);
    }

    #[test]
    fn variant_boolean_true_converts_to_1() {
        assert_eq!(variant_to_f64(&Variant::Boolean(true)).unwrap(), 1.0);
    }

    #[test]
    fn variant_boolean_false_converts_to_0() {
        assert_eq!(variant_to_f64(&Variant::Boolean(false)).unwrap(), 0.0);
    }

    #[test]
    fn variant_numeric_string_converts_to_f64() {
        let v = Variant::String(UAString::from("99.5"));
        assert!((variant_to_f64(&v).unwrap() - 99.5).abs() < f64::EPSILON);
    }

    #[test]
    fn variant_non_numeric_string_returns_none() {
        let v = Variant::String(UAString::from("not-a-number"));
        assert!(variant_to_f64(&v).is_none());
    }

    // --- str_to_quality ---

    #[test]
    fn str_to_quality_maps_good_string() {
        assert_eq!(str_to_quality("good"), PointQuality::Good);
    }

    #[test]
    fn str_to_quality_maps_uncertain_string() {
        assert_eq!(str_to_quality("uncertain"), PointQuality::Uncertain);
    }

    #[test]
    fn str_to_quality_maps_unknown_strings_to_bad() {
        assert_eq!(str_to_quality("bad"), PointQuality::Bad);
        assert_eq!(str_to_quality(""), PointQuality::Bad);
        assert_eq!(str_to_quality("GOOD"), PointQuality::Bad);
    }

    // --- extract_value: NaN/infinity → Bad quality ---

    #[test]
    fn extract_value_maps_nan_to_zero_with_bad_quality() {
        let dv = DataValue {
            value: Some(Variant::Double(f64::NAN)),
            ..Default::default()
        };
        let (val, q) = extract_value(&dv);
        assert_eq!(val, 0.0, "NaN must be normalised to 0.0");
        assert_eq!(
            q,
            PointQuality::Bad,
            "NaN must produce Bad quality per doc 37"
        );
    }

    #[test]
    fn extract_value_maps_infinity_to_zero_with_bad_quality() {
        let dv = DataValue {
            value: Some(Variant::Double(f64::INFINITY)),
            ..Default::default()
        };
        let (val, q) = extract_value(&dv);
        assert_eq!(val, 0.0);
        assert_eq!(
            q,
            PointQuality::Bad,
            "Infinity must produce Bad quality per doc 37"
        );
    }

    #[test]
    fn extract_value_normal_float_passes_through() {
        let dv = DataValue {
            value: Some(Variant::Double(55.5)),
            ..Default::default()
        };
        let (val, q) = extract_value(&dv);
        assert!((val - 55.5).abs() < f64::EPSILON);
        assert_eq!(q, PointQuality::Good);
    }

    // --- next_backoff ---

    #[test]
    fn backoff_doubles_from_initial_value() {
        assert_eq!(next_backoff(5, 60), 10);
    }

    #[test]
    fn backoff_doubles_again_on_second_failure() {
        assert_eq!(next_backoff(10, 60), 20);
    }

    #[test]
    fn backoff_is_capped_at_max_secs() {
        // 40 * 2 = 80, but cap is 60.
        assert_eq!(next_backoff(40, 60), 60);
    }

    #[test]
    fn backoff_stays_at_cap_once_reached() {
        assert_eq!(next_backoff(60, 60), 60);
    }

    #[test]
    fn backoff_sequence_matches_documented_5_10_20_40_60() {
        let max = 60u64;
        let mut backoff = 5u64;
        let mut sequence = vec![backoff];
        for _ in 0..4 {
            backoff = next_backoff(backoff, max);
            sequence.push(backoff);
        }
        assert_eq!(sequence, vec![5, 10, 20, 40, 60]);
    }

    #[test]
    fn backoff_with_custom_max_caps_correctly() {
        // max=30: 5→10→20→30→30
        let max = 30u64;
        let mut b = 5u64;
        let seq: Vec<u64> = (0..4)
            .map(|_| {
                b = next_backoff(b, max);
                b
            })
            .collect();
        assert_eq!(seq, vec![10, 20, 30, 30]);
    }
}
